// Sem login, a página da live recebe só o botão dourado (gems-bar.js) e este
// arquivo, que dá a ele o mínimo que precisa: saber se está numa live e pedir a
// janela do painel, onde fica a tela de login. Nada é lido da live.
(() => {
  window.WiseLive = window.WiseLive || {
    estaEmLive: () => location.pathname.startsWith('/live/'),
    livesDoVendedor: () => [],
  };
  window.__jambleTransporte = window.__jambleTransporte || {
    abrirPainel: () => window.postMessage({ tag: 'jamble-ext', type: 'painel-abrir', payload: {} }, location.origin),
  };
})();
