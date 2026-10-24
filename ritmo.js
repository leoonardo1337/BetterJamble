// ============================================================================
// BetterJamble — ritmo da aba da live (world MAIN, primeiro script a carregar)
//
// Quando a janela do navegador fica coberta (o painel em tela cheia por cima,
// por exemplo) ou minimizada, o Chrome trata a aba como escondida:
//   1. a página fica sabendo (document.hidden / visibilitychange) e a Jamble
//      pode pausar o que recebe;
//   2. os relógios da página (setTimeout / setInterval) passam a rodar no
//      máximo 1x por segundo e, depois de ~5 min sem som, 1x por minuto — e
//      era deles que dependiam o pulso para o painel, a audiência, as vendas,
//      o ranking e o auto resgate.
//
// Duas defesas:
//   - numa live, a página sempre se vê visível (document.hidden = false, e o
//     evento visibilitychange não chega aos ouvintes do site);
//   - window.__bjRitmo: setTimeout/setInterval dos nossos scripts que, além do
//     relógio normal, também disparam no "tique" que o painel manda a cada
//     segundo. A janela do painel está à vista, então o relógio dela não é
//     travado, e mensagens chegam na hora mesmo com a aba escondida.
// ============================================================================
(() => {
  if (window.__bjRitmo) return;

  const naLive = () => /^\/live\//.test(location.pathname);

  // ------------------------------------------------------- sempre visível
  try {
    const proto = Document.prototype;
    const fingir = (nome, visivel) => {
      const desc = Object.getOwnPropertyDescriptor(proto, nome);
      if (!desc || !desc.get) return;
      Object.defineProperty(proto, nome, {
        configurable: true,
        enumerable: desc.enumerable,
        get() { return naLive() ? visivel : desc.get.call(this); },
      });
    };
    fingir('hidden', false);
    fingir('visibilityState', 'visible');
    fingir('webkitHidden', false);
    fingir('webkitVisibilityState', 'visible');
    // o evento chega primeiro aqui (window, fase de captura): numa live ele
    // para antes dos ouvintes do site
    const engolir = (e) => { if (naLive()) e.stopImmediatePropagation(); };
    window.addEventListener('visibilitychange', engolir, true);
    window.addEventListener('webkitvisibilitychange', engolir, true);
  } catch {}

  // ------------------------------------------------------- relógio com tique
  const nativo = {
    setTimeout: window.setTimeout.bind(window),
    clearTimeout: window.clearTimeout.bind(window),
    setInterval: window.setInterval.bind(window),
    clearInterval: window.clearInterval.bind(window),
  };
  const tarefas = new Map();   // id -> {fn, quando, cada, timer}
  let seq = 0;

  function disparar(id) {
    const t = tarefas.get(id);
    if (!t) return;
    if (t.cada) {
      t.quando = Date.now() + t.cada;
    } else {
      tarefas.delete(id);
      nativo.clearTimeout(t.timer);
    }
    try { t.fn(); } catch (e) { setTimeout(() => { throw e; }); }
  }

  function depois(fn, ms) {
    const id = ++seq;
    const espera = Math.max(0, Number(ms) || 0);
    const t = { fn, quando: Date.now() + espera, cada: 0, timer: 0 };
    t.timer = nativo.setTimeout(() => disparar(id), espera);
    tarefas.set(id, t);
    return id;
  }
  function aCada(fn, ms) {
    const id = ++seq;
    const cada = Math.max(10, Number(ms) || 0);
    const t = { fn, quando: Date.now() + cada, cada, timer: 0 };
    // o relógio normal só dispara se o tique ainda não fez a vez dele
    t.timer = nativo.setInterval(() => { const x = tarefas.get(id); if (x && Date.now() >= x.quando - 50) disparar(id); }, cada);
    tarefas.set(id, t);
    return id;
  }
  function cancelar(id) {
    const t = tarefas.get(id);
    if (!t) return;
    tarefas.delete(id);
    if (t.cada) nativo.clearInterval(t.timer); else nativo.clearTimeout(t.timer);
  }

  // o tique do painel: roda tudo o que já venceu
  let ultimoTique = 0;
  window.addEventListener('message', (ev) => {
    if (ev.source !== window) return;
    let m;
    try { m = ev.data; if (!m || m.tag !== 'jamble-painel' || m.type !== 'painel-tique') return; } catch { return; }
    ultimoTique = Date.now();
    const agora = Date.now();
    [...tarefas.entries()].forEach(([id, t]) => { if (agora >= t.quando) disparar(id); });
  });

  window.__bjRitmo = {
    setTimeout: depois,
    clearTimeout: cancelar,
    setInterval: aCada,
    clearInterval: cancelar,
    ultimoTique: () => ultimoTique,
  };
})();
