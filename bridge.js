// Ponte entre os scripts que rodam na página (world MAIN) e as APIs da extensão.
// A página não enxerga chrome.*; este script roda no world ISOLATED e faz a passagem
// nos dois sentidos:
//   MAIN  -> window.postMessage({tag:'jamble-ext'})    -> aqui -> chrome.runtime
//   painel -> background -> chrome.tabs.sendMessage     -> aqui -> window.postMessage({tag:'jamble-painel'}) -> MAIN
(() => {
  const TAG_DA_PAGINA = 'jamble-ext';
  const TAG_PARA_PAGINA = 'jamble-painel';

  // Recarregar a extensão com a aba aberta deixa este script órfão: ele
  // continua recebendo as mensagens da página, mas toda chamada a chrome.*
  // dá "Extension context invalidated" (e enchia a página de erros a cada
  // snapshot). Órfão, ele fica quieto até a aba recarregar.
  const vivo = () => { try { return !!(chrome.runtime && chrome.runtime.id); } catch { return false; } };

  // ---------------------------------------------------- página -> extensão
  window.addEventListener('message', (ev) => {
    if (ev.source !== window) return;
    // Este ouvinte recebe TODAS as mensagens da página, inclusive as do site
    // (player de vídeo etc.). Algumas não podem ser lidas daqui e ler `data`
    // ou `.tag` dava erro na página de erros da extensão: só as nossas importam.
    let msg;
    try {
      msg = ev.data;
      if (!msg || typeof msg !== 'object' || msg.tag !== TAG_DA_PAGINA) return;
    } catch { return; }

    // órfão: só o pedido de abrir o painel tem resposta (o aviso "recarregue a página")
    if (!vivo() && msg.type !== 'painel-abrir') return;

    if (msg.type === 'purchases-snapshot' && msg.payload) {
      try { chrome.storage.local.set({ purchases: msg.payload }); } catch {}
      return;
    }

    if (msg.type === 'open-page' && msg.payload && msg.payload.page) {
      try { chrome.runtime.sendMessage({ type: 'open-page', page: msg.payload.page }); } catch {}
      return;
    }

    if (msg.type === 'gems-snapshot' && msg.payload) {
      try { chrome.storage.local.set({ gems: msg.payload, gemsAt: Date.now() }); } catch {}
      return;
    }

    // Entrou ou saiu de uma live: o background liga/desliga a proteção da aba
    // contra o descarte automático do Chrome.
    if (msg.type === 'aba-estado') {
      try {
        chrome.runtime.sendMessage({ type: 'bj-aba-estado', naLive: !!(msg.payload && msg.payload.naLive) });
      } catch {}
      return;
    }

    // Pedido de abertura da janela do painel.
    // Este é o único caminho em que o silêncio é inaceitável: a pessoa clicou e
    // espera uma janela. A causa mais comum de nada acontecer é a extensão ter
    // sido recarregada com a aba aberta — os scripts desta aba viram órfãos e
    // todo chrome.runtime.sendMessage falha até a página recarregar.
    if (msg.type === 'painel-abrir') {
      const falhou = (motivo) => {
        try { window.postMessage({ tag: TAG_PARA_PAGINA, type: 'painel-falhou', payload: { motivo } }, location.origin); } catch {}
      };
      try {
        if (!chrome.runtime || !chrome.runtime.id) { falhou('orfao'); return; }
        chrome.runtime.sendMessage({ type: 'bj-abrir-painel', payload: msg.payload || null }, () => {
          const erro = chrome.runtime.lastError;
          if (!erro) return;
          // "port closed" = o background recebeu e só não respondeu: não é falha.
          // Órfão de verdade é "context invalidated" (extensão recarregada) ou
          // ninguém do outro lado ("Receiving end does not exist").
          const texto = String(erro.message || '');
          if (/port closed/i.test(texto)) return;
          falhou('orfao');
        });
      } catch { falhou('orfao'); }
      return;
    }

    // Qualquer outra mensagem com o prefixo painel- vai direto para a janela.
    if (typeof msg.type === 'string' && msg.type.indexOf('painel-') === 0) {
      try { chrome.runtime.sendMessage({ type: 'bj-para-painel', msg: { tipo: msg.type, payload: msg.payload } }); } catch {}
    }
  });

  // ---------------------------------------------------- extensão -> página
  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg || msg.type !== 'bj-do-painel' || !msg.msg) return;
    try {
      window.postMessage({ tag: TAG_PARA_PAGINA, type: msg.msg.tipo, payload: msg.msg.payload }, location.origin);
    } catch {}
  });

  // Avisa o background que esta aba tem a extensão ativa. Serve para o caso de
  // a página recarregar com o painel já aberto: o background reatribui o painel
  // a esta aba e o painel pede o estado de novo.
  try { chrome.runtime.sendMessage({ type: 'bj-pagina-pronta' }); } catch {}
})();
