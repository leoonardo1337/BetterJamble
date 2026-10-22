// ============================================================================
// BetterJamble — auto resgate da "Recompensa por assistir" (world MAIN)
//
// Trazido da extensão Jamble Auto Resgate (E:\projects\jamble_resgate\page.js).
// A lógica de calibrar e clicar é a mesma; mudou só a comunicação, que agora
// passa pelos canais do BetterJamble:
//   - status  -> window.postMessage({tag:'jamble-ext', type:'painel-resgate'})
//                (o bridge leva ao painel, como as outras mensagens painel-*);
//   - comandos <- {tag:'jamble-painel', type:'resgate-config'|'resgate-tick'|
//                  'painel-abriu'|'pedir-estado'} (do painel ou do alarme do background).
// Liga/desliga e histórico ficam no localStorage da Jamble.
//
// O servidor devolve o tempo assistido em minutos inteiros, então o timer do
// site é só uma estimativa. Este script descobre o instante exato em que o
// servidor vira o minuto (calibração) e agenda o resgate para logo depois do
// marco ser atingido.
//
// Endpoint lido: GET /api/live/watch-time -> { tracker: { convertedMins, unconvertedMins, milestones[] } }
// ============================================================================
(() => {
  if (window.__jambleResgateLoaded) return;
  window.__jambleResgateLoaded = true;

  const LS_ATIVO = 'bj:resgate:ativo';
  const LS_HIST = 'bj:resgate:historico';
  const BUTTON_LABELS = ['Recompensa por assistir', 'Watch reward'];
  const CLAIM_LABELS = ['reivindicar', 'claim'];
  const DONE_LABELS = ['próximo dia', 'next day'];
  const MINUTE = 60_000;
  const COARSE_POLL_MS = 2000; // calibração inicial
  const FINE_POLL_MS = 500; // refinamento na virada seguinte
  const MARGIN_MS = 1500; // folga após a virada prevista
  const CLICK_COOLDOWN_MS = 8000;
  const MAX_ATTEMPTS_PER_MILESTONE = 5;
  const dryRun = !!window.__JAMBLE_AUTO_DRYRUN;

  let enabled = (() => { try { return localStorage.getItem(LS_ATIVO) !== '0'; } catch { return true; } })();
  let lastTracker = null;
  let captureSeq = 0;
  // Instante (relógio local) logo após uma virada de minuto no servidor, e o total nesse instante.
  let boundaryAt = null;
  let boundaryLow = null;
  let boundaryMins = null;
  let refined = false;
  let target = null; // { at, mins, gems }
  let lateSince = null;
  let running = false;
  let timer = null;
  let lastClickAt = 0;
  const attempts = new Map(); // marco (min) -> tentativas

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const log = (...a) => console.log('[BetterJamble resgate]', ...a);
  const post = (payload) => {
    try { window.postMessage({ tag: 'jamble-ext', type: 'painel-resgate', payload }, location.origin); } catch {}
  };

  function historico() {
    try { return JSON.parse(localStorage.getItem(LS_HIST) || '[]') || []; } catch { return []; }
  }
  function registrar(entrada) {
    try { localStorage.setItem(LS_HIST, JSON.stringify([entrada, ...historico()].slice(0, 20))); } catch {}
  }

  // ---- captura das respostas do próprio site ----
  const origFetch = window.fetch;
  window.fetch = async function (input, init) {
    const res = await origFetch.apply(this, arguments);
    try {
      const url = typeof input === 'string' ? input : input?.url || String(input);
      if (url.includes('/api/live/watch-time')) {
        const isConvert = url.includes('/convert');
        res.clone().json().then((body) => {
          if (!isConvert && body?.tracker) {
            lastTracker = body.tracker;
            captureSeq++;
          }
          if (isConvert) log('convert', res.status, body);
        }).catch(() => {});
      }
    } catch {}
    return res;
  };

  // ---- helpers do site ----
  function findButton() {
    for (const label of BUTTON_LABELS) {
      const btn = document.querySelector(`button[aria-label="${label}"]`);
      if (btn) return btn;
    }
    return null;
  }

  function buttonLabel(btn) {
    return (btn?.parentElement?.querySelector(':scope > span')?.textContent || '').trim();
  }

  function getCtx() {
    const btn = findButton();
    if (!btn) return null;
    const key = Object.keys(btn).find((k) => k.startsWith('__reactFiber'));
    for (let f = btn[key]; f; f = f.return) {
      const v = f.memoizedProps?.value;
      if (v && typeof v.claim === 'function' && typeof v.refresh === 'function') return v;
    }
    return null;
  }

  // Mesma regra do site (watchTimeStanding)
  function standing(t) {
    const total = t.convertedMins + t.unconvertedMins;
    const claimable = t.milestones.find(
      (m) => m.watchTimeInMins <= total && m.watchTimeInMins > t.convertedMins && !m.reward?.redeemedCount,
    );
    const next = t.milestones.find((m) => m.watchTimeInMins > total) || null;
    return { total, claimable: claimable || null, next };
  }

  // "Próximo dia": todos os marcos resgatados (o site usa !next && !claimable)
  const isDone = (t) => {
    const st = standing(t);
    return !st.next && !st.claimable;
  };

  // O trackerId é a data local ("2026-09-15"), então os marcos voltam à meia-noite local.
  function nextDayAt() {
    const d = new Date();
    d.setHours(24, 0, 10, 0);
    return d.getTime();
  }

  // Busca o tracker no servidor. Retorna { tracker, total, end } ou null.
  async function sample() {
    const ctx = getCtx();
    if (!ctx) return null;
    const seq = captureSeq;
    const start = Date.now();
    let t = await ctx.refresh(true).catch(() => null);
    if (!t) {
      // outra chamada do site pode ter substituído a nossa; usa a resposta capturada
      const until = Date.now() + 3000;
      while (!t && Date.now() < until) {
        if (captureSeq > seq) t = lastTracker;
        else await sleep(150);
      }
    }
    if (!t) return null;
    lastTracker = t;
    return { tracker: t, total: t.convertedMins + t.unconvertedMins, start, end: Date.now() };
  }

  // Espera o total mudar, consultando a cada `every` ms.
  // Retorna { hit, prev }: a virada aconteceu entre prev.start e hit.end.
  async function waitForRollover(from, every, timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      await sleep(every);
      const s = await sample();
      if (s && s.total !== from.total) return { hit: s, prev: from };
      if (s) from = s;
    }
    return null;
  }

  async function calibrate() {
    const first = await sample();
    if (!first) return false;
    if (standing(first.tracker).claimable) await claim(first.tracker);
    if (!standing(first.tracker).next) return true; // nada a agendar (ex.: "Próximo dia")

    report('calibrating');
    const r = await waitForRollover(first, COARSE_POLL_MS, 75_000);
    if (!r) {
      log('o tempo não avançou em 75s (live parada?)');
      return false;
    }
    setBoundary(r);
    refined = false;
    log('calibrado: virada entre', new Date(boundaryLow).toLocaleTimeString(), 'e', new Date(boundaryAt).toLocaleTimeString());
    return true;
  }

  function setBoundary({ hit, prev }) {
    boundaryAt = hit.end; // limite superior (nunca resgata antes da hora)
    boundaryLow = prev.start; // limite inferior
    boundaryMins = hit.total;
  }

  // Refina a precisão para ~0,5s observando a próxima virada de perto.
  async function refine() {
    refined = true;
    const from = boundaryLow + MINUTE - 1000;
    const until = boundaryAt + MINUTE + 3000;
    await sleep(Math.max(0, from - Date.now()));
    const before = await sample();
    if (!before || before.total !== boundaryMins) return; // já virou/fora do esperado; mantém a calibração
    const r = await waitForRollover(before, FINE_POLL_MS, until - Date.now());
    if (!r) return;
    setBoundary(r);
    log('refinado: virada entre', new Date(boundaryLow).toLocaleTimeString(), 'e', new Date(boundaryAt).toLocaleTimeString());
  }

  const predictedTotal = (at) => boundaryMins + Math.floor((at - boundaryAt) / MINUTE);

  function computeTarget(t) {
    const st = standing(t);
    if (!st.next || boundaryAt == null) return null;
    return {
      at: boundaryAt + (st.next.watchTimeInMins - boundaryMins) * MINUTE + MARGIN_MS,
      mins: st.next.watchTimeInMins,
      gems: st.next.gems,
    };
  }

  async function claim(tracker) {
    const st = standing(tracker);
    const key = st.claimable?.watchTimeInMins ?? 'dom';
    if (!enabled) return report('ready');
    if (Date.now() - lastClickAt < CLICK_COOLDOWN_MS) return;
    const n = attempts.get(key) || 0;
    if (n >= MAX_ATTEMPTS_PER_MILESTONE || (dryRun && n > 0)) return;
    const btn = findButton();
    if (!btn || btn.disabled) return;

    attempts.set(key, n + 1);
    lastClickAt = Date.now();
    if (dryRun) log('[dry-run] clicaria agora no marco de', key, 'min');
    else btn.click();
    log('resgate disparado — marco', key, 'min');
    if (!dryRun) registrar({ at: lastClickAt, marco: key, gemas: st.claimable?.gems ?? null, url: location.pathname });
  }

  // ---- ciclo principal ----
  async function loop() {
    if (running) return;
    running = true;
    try {
      if (!getCtx()) {
        boundaryAt = null; // saiu da live; a fase pode mudar na próxima
        refined = false;
        return report('missing');
      }
      // Desligado = parado: diferente da extensão original, não fica
      // calibrando nem consultando o tempo assistido sem motivo.
      if (!enabled) return report('off');

      if (boundaryAt == null) {
        if (!(await calibrate())) return;
        if (!lastTracker || !standing(lastTracker).next) return;
      }
      if (!refined && boundaryAt != null) await refine();

      const now = Date.now();
      target = computeTarget(lastTracker);

      if (!target) {
        if (standing(lastTracker).claimable) {
          await claim(lastTracker);
          await sleep(3000);
          await sample();
        }
        if (isDone(lastTracker)) {
          // Marcos do dia concluídos: o servidor para de contar e a fase muda no dia seguinte.
          boundaryAt = null;
          refined = false;
        }
        return;
      }

      if (now >= target.at) {
        const s = await sample();
        if (!s) return;
        const st = standing(s.tracker);
        if (st.claimable) {
          lateSince = null;
          await claim(s.tracker);
          await sleep(3000);
          await sample(); // atualiza convertedMins e o próximo marco
          target = computeTarget(lastTracker);
        } else if (s.total < target.mins) {
          lateSince ??= now;
          if (now - lateSince > 20_000) {
            log('o marco não chegou no horário previsto; recalibrando');
            boundaryAt = null;
            lateSince = null;
          }
        } else {
          target = computeTarget(s.tracker); // marco já resgatado por outro meio
        }
        return;
      }

      // Checagem de meio de caminho: longe da virada, confere se a contagem não pausou.
      const offset = (now - boundaryAt) % MINUTE;
      if (target.at - now > 90_000 && offset > 15_000 && offset < 45_000) {
        const s = await sample();
        if (s && s.total !== predictedTotal(s.end)) {
          log(`contagem fora do previsto (${s.total} vs ${predictedTotal(s.end)}); recalibrando`);
          boundaryAt = null;
        }
      }
    } finally {
      running = false;
      if (lastTracker) target = computeTarget(lastTracker);
      report();
      arm();
    }
  }

  function arm() {
    clearTimeout(timer);
    const now = Date.now();
    let wait;
    if (!getCtx()) wait = 5000;
    else if (!enabled) wait = 60_000;
    else if (lastTracker && isDone(lastTracker)) wait = Math.min(nextDayAt() - now, 30 * MINUTE); // "Próximo dia"
    else if (boundaryAt == null) wait = 30_000;
    else if (!target) wait = COARSE_POLL_MS;
    else if (now >= target.at) wait = COARSE_POLL_MS;
    else {
      // acorda no alvo, ou antes para uma checagem de meio de caminho (a cada ~5 min, fora da virada)
      const k = Math.ceil((now + 5 * MINUTE - boundaryAt) / MINUTE);
      const checkAt = boundaryAt + k * MINUTE + 30_000;
      wait = Math.min(target.at, checkAt) - now;
    }
    timer = setTimeout(loop, Math.max(250, wait));
  }

  // Estado para o painel. Só manda quando muda (o painel conta o tempo sozinho).
  let ultimoRelato = '';
  function report(stateOverride, forcar) {
    const t = lastTracker;
    const st = t ? standing(t) : null;
    const label = buttonLabel(findButton());
    const labelDone = DONE_LABELS.includes(label.toLowerCase());
    const state =
      stateOverride ||
      (!getCtx()
        ? 'missing'
        : !enabled
          ? 'off'
        : !st
          ? labelDone ? 'done' : 'loading'
          : st.claimable ? 'ready' : !st.next ? 'done' : boundaryAt == null ? 'calibrating' : 'scheduled');
    const hist = historico();
    const payload = {
      state,
      dryRun,
      enabled,
      total: st?.total ?? null,
      next: st?.next ? { mins: st.next.watchTimeInMins, gems: st.next.gems } : null,
      targetAt: target?.at ?? null,
      boundaryAt,
      refined,
      dayResetAt: state === 'done' ? nextDayAt() : null,
      historico: hist,
    };
    const chave = JSON.stringify([state, enabled, payload.total, payload.next, payload.targetAt, refined, hist.length]);
    if (!forcar && chave === ultimoRelato) return;
    ultimoRelato = chave;
    post(payload);
  }

  // Fallback: se o site mostrar "Reivindicar", clica.
  let domScheduled = false;
  function domCheck() {
    domScheduled = false;
    const btn = findButton();
    if (btn && CLAIM_LABELS.includes(buttonLabel(btn).toLowerCase()) && lastTracker) {
      if (standing(lastTracker).claimable || !boundaryAt) claim(lastTracker);
    }
  }

  // Comandos do painel (via background -> bridge) e o "acorda" do alarme.
  window.addEventListener('message', (e) => {
    if (e.source !== window) return;
    let m;
    try {
      m = e.data;
      if (!m || typeof m !== 'object' || m.tag !== 'jamble-painel') return;
    } catch { return; }
    if (m.type === 'resgate-config') {
      enabled = !!(m.payload && m.payload.ativo);
      try { localStorage.setItem(LS_ATIVO, enabled ? '1' : '0'); } catch {}
      report(undefined, true);
      if (enabled) loop();
    } else if (m.type === 'resgate-tick') {
      loop();
    } else if (m.type === 'painel-abriu' || m.type === 'pedir-estado') {
      report(undefined, true);   // painel recém-aberto precisa do estado atual
    }
  });

  // Ligar/desligar numa aba vale para as outras abas da Jamble também.
  window.addEventListener('storage', (e) => {
    if (e.key !== LS_ATIVO) return;
    enabled = e.newValue !== '0';
    report(undefined, true);
    if (enabled) loop();
  });

  function start() {
    new MutationObserver(() => {
      if (!domScheduled) {
        domScheduled = true;
        setTimeout(domCheck, 300);
      }
    }).observe(document.body, { subtree: true, childList: true, characterData: true });
    loop();
  }

  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start, { once: true });

  window.__jambleResgate = {
    get state() {
      return { enabled, dryRun, boundaryLow, boundaryAt, boundaryMins, refined, target, lastTracker };
    },
    loop,
  };
})();
