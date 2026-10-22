// ============================================================================
// BetterJamble — audiência da live (world MAIN)
//
// Coleta o que os Insights precisam sobre quem assiste:
//   - quantas pessoas assistem (show.audience_count, que a Jamble manda pelo
//     WebSocket a cada poucos segundos);
//   - interações por minuto: mensagens no chat, entradas ("entrou 👋"), gemas
//     e lances — tudo do mesmo WebSocket;
//   - quem está assistindo: a lista da aba "Espectadores" (/api/live/viewers),
//     consultada a cada ~30s. Comparando uma consulta com a anterior sabemos
//     quando cada pessoa entrou e saiu — é daí que sai o tempo de cada uma.
//
// A lista de espectadores só traz quem está logado: quem assiste sem conta
// entra só no número total.
//
// Cuidados com a Jamble (ver docs/AUDIENCIA.md):
//   - /api/live/viewers exige o token App Check do próprio site. Não geramos
//     token: reaproveitamos os cabeçalhos da última chamada que o site fez;
//   - só consultamos com o painel aberto, numa live, uma aba por vez;
//   - intervalo de 30s com variação aleatória; 429/403/5xx respeitam o
//     Retry-After e dobram a espera; depois de 4 erros seguidos a consulta
//     pausa e o painel avisa.
// ============================================================================
(() => {
  if (window.__jambleAudienciaLoaded) return;
  window.__jambleAudienciaLoaded = true;

  const LS = 'jamble:audiencia:v1';
  const MAX_LIVES = 8;                 // lives guardadas
  const INTERVALO = 30000;             // consulta da lista de espectadores
  const VARIACAO = 6000;               // ± aleatório, para não ter ritmo de robô
  const ESPERA_MAX = 8 * 60000;        // teto do recuo depois de erro
  const ERROS_PARA_PAUSAR = 4;
  const PAUSA = 10 * 60000;            // pausado: tenta de novo só depois disso
  const PAGINAS_MAX = 5;               // lives grandes: até 5 páginas da lista
  const PAGINAS_A_CADA = 4;            // ...e as páginas extras só a cada 4 consultas
  const TRAVA = 'jamble:audiencia:trava';
  const ENVIO_MS = 5000;               // ritmo de envio ao painel

  const eu = Math.random().toString(36).slice(2);

  // ------------------------------------------------------------ estado
  // showId -> {seller, inicio, amostras:[[t,n]], min:{minuto:[chat,gemas,entradas,lances]},
  //            pessoas:{id:{u,a,r,s:[[ini,fim]],v,c,g}}, lanceDe:{saleId:n}}
  let db = {};
  try { db = JSON.parse(localStorage.getItem(LS) || '{}') || {}; } catch { db = {}; }

  let showAtual = null;
  let sellerAtual = null;
  const consulta = { status: 'aguardando', ultima: 0, erros: 0, espera: 0, timer: 0, rodada: 0, motivo: '' };
  let cabecalhos = null;               // cabeçalhos da última chamada do site com App Check
  let mudou = false;

  const showIdDaUrl = () => {
    const m = location.pathname.match(/^\/live\/[^/]+\/([^/?#]+)/);
    return m ? m[1] : null;
  };

  function live(id) {
    if (!id) return null;
    if (!db[id]) {
      db[id] = { seller: null, inicio: Date.now(), amostras: [], min: {}, pessoas: {}, lanceDe: {} };
      const ids = Object.keys(db);
      if (ids.length > MAX_LIVES) {
        ids.sort((a, b) => (db[a].inicio || 0) - (db[b].inicio || 0))
          .slice(0, ids.length - MAX_LIVES).forEach((x) => delete db[x]);
      }
    }
    return db[id];
  }

  let timerSalvar = 0;
  function salvar() {
    mudou = true;
    clearTimeout(timerSalvar);
    timerSalvar = setTimeout(() => { try { localStorage.setItem(LS, JSON.stringify(db)); } catch {} }, 3000);
  }

  const minuto = (t) => Math.floor(t / 60000) * 60000;
  function contar(sh, t, i, n) {
    const k = minuto(t);
    const b = sh.min[k] || (sh.min[k] = [0, 0, 0, 0]);
    b[i] += n || 1;
  }

  // Feed de entradas e saídas para o painel: {t, tipo:'entrou'|'saiu'|'inicio', id, u, a, ms, n}
  function evento(sh, e) {
    const ev = sh.eventos || (sh.eventos = []);
    ev.push(e);
    if (ev.length > 400) ev.splice(0, ev.length - 400);
  }

  // Marca a pessoa como presente agora. Se ela estava fora, abre uma sessão
  // nova e registra a entrada — a não ser que `silencioso` (primeira consulta
  // da aba: quem já estava lá não "entrou" agora).
  function presente(sh, id, dados, t, silencioso) {
    const p = sh.pessoas[id] || (sh.pessoas[id] = { u: '', a: '', r: null, s: [], v: 0, c: 0, g: 0 });
    if (dados.u) p.u = dados.u;
    if (dados.a) p.a = dados.a;
    if (dados.r !== undefined) p.r = dados.r;
    const ultima = p.s[p.s.length - 1];
    // sessão aberta mas sem notícia há mais de 2 min (painel fechado, aba
    // recarregada): o intervalo não conta, fecha na última vez visto e reabre
    // sem anunciar — não sabemos se a pessoa saiu de verdade nesse meio tempo
    let lacuna = false;
    if (ultima && ultima[1] === null && t - p.v > 120000) { ultima[1] = p.v; lacuna = true; }
    if (!p.s.length || p.s[p.s.length - 1][1] !== null) {
      p.s.push([t, null]);
      if (!silencioso && !lacuna && p.r !== 'host') evento(sh, { t, tipo: 'entrou', id, u: p.u, a: p.a });
    }
    p.v = t;
    return p;
  }

  // ------------------------------------------------------------ WebSocket
  const WSAntes = window.WebSocket;
  function WSComAudiencia(url, protocolos) {
    const sock = protocolos ? new WSAntes(url, protocolos) : new WSAntes(url);
    if (String(url).includes('ws.jamble.com')) {
      sock.addEventListener('message', (ev) => {
        if (typeof ev.data !== 'string') return;
        const d = ev.data;
        if (d.indexOf('"show"') < 0 && d.indexOf('"messages"') < 0 && d.indexOf('"LIKE"') < 0 && d.indexOf('sale_entry_count') < 0) return;
        try { ingerir(JSON.parse(d)); } catch {}
      });
    }
    return sock;
  }
  WSComAudiencia.prototype = WSAntes.prototype;
  Object.assign(WSComAudiencia, WSAntes);
  window.WebSocket = WSComAudiencia;

  function ingerir(msg) {
    const d = msg && msg.data;
    if (!d) return;
    const agora = Date.now();

    // gemas: vêm em pacotes próprios, com o show_id em cada evento
    if (Array.isArray(d.events)) {
      d.events.forEach((e) => {
        if (!e || e.event_type !== 'LIKE' || !e.show_id) return;
        const sh = live(e.show_id);
        contar(sh, agora, 1);
        const uid = e.user_id || (e.liker_profile || {}).id;
        if (uid && sh.pessoas[uid]) sh.pessoas[uid].g++;
      });
      salvar();
    }

    const show = d.show;
    const id = (show && show.id) || showAtual || showIdDaUrl();
    if (!id) return;
    const sh = live(id);
    if (show && show.id) {
      showAtual = show.id;
      if (show.seller_id) sh.seller = sellerAtual = show.seller_id;
      if (typeof show.audience_count === 'number') {
        const ult = sh.amostras[sh.amostras.length - 1];
        // guarda quando muda ou a cada 30s, para o gráfico não ter buracos
        if (!ult || ult[1] !== show.audience_count || agora - ult[0] > 30000) {
          sh.amostras.push([agora, show.audience_count]);
          // Passou do limite: afina a metade mais antiga (fica uma amostra a
          // cada duas) em vez de descartar o começo, para o gráfico ainda
          // cobrir a live inteira.
          if (sh.amostras.length > 3000) {
            const velhas = sh.amostras.splice(0, 1500).filter((_, i) => i % 2 === 0);
            sh.amostras.unshift(...velhas);
          }
          salvar();
        }
      }
      if (show.has_started && !sh.comecou) sh.comecou = Math.round((show.started_at || 0) * 1000) || agora;
    }
    if (d.seller && d.seller.id) sh.seller = sellerAtual = d.seller.id;

    if (Array.isArray(d.messages)) {
      // O "snapshot" que chega ao conectar traz o histórico recente do chat:
      // são mensagens antigas, de gente que pode já ter saído. Só marcamos
      // como vistas, sem contar como interação nem presença.
      const historico = msg.event_type === 'snapshot';
      d.messages.forEach((m) => {
        if (!m || !m.id || (sh.msgVistas || (sh.msgVistas = [])).indexOf(m.id) >= 0) return;
        sh.msgVistas.push(m.id);
        if (sh.msgVistas.length > 300) sh.msgVistas.shift();
        if (historico) return;
        const p = m.sender_profile || {};
        const uid = m.sender_id || p.id;
        if (m.message_type === 'JOINED_SHOW') {
          contar(sh, agora, 2);
          // quem entrou está assistindo: a sessão começa aqui, não na próxima consulta
          if (uid) presente(sh, uid, { u: p.username, a: avatarDe(p, uid) }, agora);
        } else if (m.message_type === 'STANDARD') {
          contar(sh, agora, 0);
          if (uid) presente(sh, uid, { u: p.username, a: avatarDe(p, uid) }, agora).c++;
        }
      });
      salvar();
    }

    // lances: a Jamble manda o total do leilão; contamos a diferença
    if (d.sale && d.sale.id && typeof d.sale_entry_count === 'number') {
      const antes = sh.lanceDe[d.sale.id] || 0;
      if (d.sale_entry_count > antes) {
        contar(sh, agora, 3, d.sale_entry_count - antes);
        sh.lanceDe[d.sale.id] = d.sale_entry_count;
        const ids = Object.keys(sh.lanceDe);
        if (ids.length > 200) delete sh.lanceDe[ids[0]];
        salvar();
      }
    }
  }

  function avatarDe(p, uid) {
    const img = (p && p.profile_image) || {};
    if (img.low) return img.low;
    if (img.url) return img.url;
    if (img.id && uid) return `https://jamble.b-cdn.net/profiles/user_id=${uid}/profile_images/${img.id}.png`;
    return '';
  }

  // ------------------------------------------------------------ cabeçalhos do site
  // Toda chamada do site à API leva o token App Check. Guardamos a última e
  // usamos na nossa consulta; quando o site renova o token, a próxima chamada
  // dele traz o novo.
  const fetchAntes = window.fetch;
  window.fetch = function (input, init) {
    try {
      const url = typeof input === 'string' ? input : (input && input.url) || '';
      if (url.indexOf('/api/') >= 0) {
        const h = (init && init.headers) || (input && input.headers);
        const obj = h instanceof Headers ? Object.fromEntries(h) : h && typeof h === 'object' ? Object.assign({}, h) : null;
        if (obj && Object.keys(obj).some((k) => k.toLowerCase() === 'x-firebase-appcheck')) cabecalhos = obj;
      }
    } catch {}
    return fetchAntes.apply(this, arguments);
  };

  // ------------------------------------------------------------ consulta
  // Uma aba por vez: a trava no localStorage vale 90s e é renovada a cada consulta.
  function pegarTrava() {
    try {
      const t = JSON.parse(localStorage.getItem(TRAVA) || 'null');
      if (t && t.dono !== eu && t.show === showAtual && Date.now() - t.em < 90000) return false;
      localStorage.setItem(TRAVA, JSON.stringify({ dono: eu, show: showAtual, em: Date.now() }));
      return true;
    } catch { return true; }
  }

  const painelAberto = () => !!(window.__jambleTransporte && window.__jambleTransporte.aberto());

  function agendar(ms) {
    clearTimeout(consulta.timer);
    consulta.timer = setTimeout(rodar, ms);
  }

  // A live acabou (aviso do gems-core, que vê is_over e o título da página):
  // fecha as sessões de quem ainda estava assistindo e para de consultar a
  // lista. Quem foi visto até perto do fim fica até o fim; quem já estava sem
  // notícia fica até a última vez em que foi visto. Não vira "saiu": a live
  // acabar não é a pessoa ir embora (a janela de retenção conta como "ficou
  // pelo menos até aqui").
  function encerrarLive(showId, fim) {
    const sh = db[showId];
    if (!sh || sh.encerradaEm) return;
    sh.encerradaEm = fim;
    Object.values(sh.pessoas || {}).forEach((p) => {
      const ultima = p.s[p.s.length - 1];
      if (!ultima || ultima[1] !== null) return;
      const ate = fim - p.v < 120000 ? fim : p.v;
      ultima[1] = Math.max(ultima[0], ate);
      p.v = ultima[1];
    });
    salvar();
  }
  window.addEventListener('bj:live-status', (ev) => {
    const d = ev && ev.detail;
    if (!d || !d.showId) return;
    if (d.encerrada) encerrarLive(d.showId, d.fim || Date.now());
    else if (db[d.showId] && db[d.showId].encerradaEm) {
      // fim provisório desfeito: a live voltou ao ar
      delete db[d.showId].encerradaEm;
      salvar();
    }
  });

  async function rodar() {
    const variacao = Math.round((Math.random() * 2 - 1) * VARIACAO);
    const proxima = () => agendar(INTERVALO + variacao);

    const id = showAtual || showIdDaUrl();
    if (id && db[id] && db[id].encerradaEm) {
      // live fechada: nada a consultar (confere de novo de vez em quando, caso volte)
      if (consulta.status !== 'encerrada') { consulta.status = 'encerrada'; mudou = true; }
      agendar(5 * 60000);
      return;
    }
    if (!painelAberto() || !id || !showIdDaUrl()) { consulta.status = 'aguardando'; proxima(); return; }
    if (!cabecalhos || !sellerAtual) { consulta.status = 'sem-token'; mudou = true; proxima(); return; }
    if (!pegarTrava()) { consulta.status = 'outra-aba'; mudou = true; proxima(); return; }

    consulta.rodada++;
    const paginasNesta = consulta.rodada % PAGINAS_A_CADA === 1 ? PAGINAS_MAX : 1;
    const vistos = [];
    let completa = false;
    let cursor = null;
    try {
      for (let pag = 0; pag < paginasNesta; pag++) {
        const q = new URLSearchParams({ seller_id: sellerAtual, show_id: id });
        if (cursor) q.set('after', cursor);
        const r = await fetchAntes.call(window, '/api/live/viewers?' + q, { headers: cabecalhos, credentials: 'include' });
        if (!r.ok) throw Object.assign(new Error('http'), { status: r.status, depois: Number(r.headers.get('retry-after')) || 0 });
        const j = await r.json();
        (j.items || []).forEach((x) => x && x.id && vistos.push(x));
        if (!j.hasNextPage || !j.nextCursor) { completa = true; break; }
        cursor = j.nextCursor;
      }
    } catch (e) {
      consulta.erros++;
      consulta.motivo = e && e.status ? 'HTTP ' + e.status : 'falha de rede';
      // 403 costuma ser token vencido: esquecemos e esperamos o site mandar outro
      if (e && e.status === 403) cabecalhos = null;
      mudou = true;
      if (consulta.erros >= ERROS_PARA_PAUSAR) {
        consulta.status = 'pausado';
        agendar(PAUSA);
        return;
      }
      consulta.status = 'recuando';
      const recuo = Math.min(ESPERA_MAX, INTERVALO * Math.pow(2, consulta.erros));
      agendar(Math.max(recuo, (e && e.depois ? e.depois * 1000 : 0)) + Math.abs(variacao));
      return;
    }

    consulta.erros = 0;
    consulta.status = 'ok';
    consulta.motivo = '';
    consulta.ultima = Date.now();
    aplicarLista(live(id), vistos, completa, consulta.ultima);
    proxima();
  }

  // Quem está na lista está assistindo. Quem estava e sumiu, saiu — mas só
  // dá para afirmar isso com a lista inteira em mãos.
  let jaConsultouNestaAba = false;
  function aplicarLista(sh, lista, completa, t) {
    // a primeira lista desta aba é o retrato de quem já estava: não vira
    // uma enxurrada de "entrou", vira uma linha só
    const silencioso = !jaConsultouNestaAba;
    jaConsultouNestaAba = true;
    // gravado junto com a live: depois de recarregar a página o resumo ainda
    // sabe que a lista estava em dia (antes isso vivia só na memória da aba,
    // e até a próxima consulta todo mundo parecia ter saído)
    sh.ultimaConsulta = t;
    const agora = new Set();
    lista.forEach((x) => {
      agora.add(x.id);
      presente(sh, x.id, { u: x.username, a: x.avatarUrl, r: x.role || null }, t, silencioso);
    });
    if (silencioso) evento(sh, { t, tipo: 'inicio', n: lista.filter((x) => x.role !== 'host').length });
    // a lista traz a foto atual de cada um: o gems-core atualiza o cache de
    // fotos com ela (ranking, feed e sorteio passam a mostrar a foto nova)
    try {
      window.dispatchEvent(new CustomEvent('bj:fotos', {
        detail: { fotos: lista.filter((x) => x.avatarUrl).map((x) => ({ id: x.id, url: x.avatarUrl })) },
      }));
    } catch {}
    if (completa) {
      Object.entries(sh.pessoas).forEach(([id, p]) => {
        const ultima = p.s[p.s.length - 1];
        // fecha na última vez em que foi visto (precisão de ~30s)
        if (ultima && ultima[1] === null && !agora.has(id)) {
          ultima[1] = Math.max(ultima[0], p.v);
          if (p.r !== 'host') evento(sh, { t: ultima[1], tipo: 'saiu', id, u: p.u, a: p.a, ms: ultima[1] - ultima[0] });
        }
      });
    }
    salvar();
  }

  // ------------------------------------------------------------ resumo para o painel
  function resumo() {
    const id = showAtual || showIdDaUrl();
    const sh = id && db[id];
    if (!sh) return { showId: id, status: consulta.status };
    const agora = Date.now();
    // Sem consulta recente não dá para dizer quem continua: a sessão aberta
    // conta só até a última vez em que a pessoa foi vista. A última consulta
    // boa vem da memória ou do que ficou gravado (página recarregada).
    const ultimaOk = Math.max(consulta.ultima || 0, sh.ultimaConsulta || 0);
    const fresca = !sh.encerradaEm && consulta.status !== 'pausado' && agora - ultimaOk < 90000;
    const pessoas = Object.entries(sh.pessoas).map(([pid, p]) => {
      const ms = p.s.reduce((a, [ini, fim]) => a + ((fim === null ? (fresca ? agora : p.v) : fim) - ini), 0);
      const ativo = fresca && !!(p.s.length && p.s[p.s.length - 1][1] === null);
      return { id: pid, usuario: p.u, avatar: p.a, papel: p.r, ms, ativo, visto: p.v, chat: p.c, gemas: p.g, entrou: p.s.length ? p.s[0][0] : 0 };
    }).filter((p) => p.papel !== 'host');
    const min = Object.entries(sh.min).map(([k, v]) => [Number(k), v[0], v[1], v[2], v[3]]).sort((a, b) => a[0] - b[0]);
    return {
      showId: id,
      inicio: sh.comecou || sh.inicio,
      amostras: sh.amostras,
      minutos: min,
      pessoas,
      eventos: (sh.eventos || []).slice(-250),
      // logo depois de recarregar a aba ainda não consultou, mas os dados gravados estão em dia
      status: sh.encerradaEm ? 'encerrada'
        : fresca && (consulta.status === 'aguardando' || consulta.status === 'sem-token') ? 'ok' : consulta.status,
      encerradaEm: sh.encerradaEm || null,
      motivo: consulta.motivo,
      ultimaConsulta: ultimaOk,
    };
  }

  // Envio ao painel: um pacote a cada 5s, só se algo mudou e o painel está aberto.
  setInterval(() => {
    if (!painelAberto()) return;
    if (!mudou && consulta.status !== 'ok') return;
    mudou = false;
    try { window.postMessage({ tag: 'jamble-ext', type: 'painel-audiencia', payload: resumo() }, location.origin); } catch {}
  }, ENVIO_MS);

  agendar(4000);
  window.__jambleAudiencia = { resumo, consulta };
})();
