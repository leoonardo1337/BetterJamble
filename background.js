// Service worker: abre páginas da extensão e cuida da janela do painel.
//
// A janela do painel é única: um segundo pedido só traz a que já existe para a
// frente. O background também é o roteador entre a aba da Jamble (onde os dados
// nascem) e a janela do painel (onde eles são desenhados).
//
// Atenção MV3: este worker pode ser desligado. Toda a memória abaixo é
// descartável — ela se reconstrói sozinha porque a aba manda um pulso a cada
// poucos segundos enquanto o painel está aberto (ver gems-transporte.js).

const PAINEL = 'painel.html';
const LARGURA = 1120;
const ALTURA = 780;

let janelaDoPainel = null;   // windowId da janela do painel
let abaDeOrigem = null;      // tabId da aba da Jamble que alimenta o painel
let portaDoPainel = null;    // chrome.runtime.Port do painel

// A aba de origem sobrevive ao worker ser desligado (storage.session dura até
// o navegador fechar). Sem isso, depois de um reinício qualquer aba da Jamble
// que falasse primeiro viraria a origem.
function definirOrigem(id) {
  abaDeOrigem = id;
  try { chrome.storage.session.set({ abaDeOrigem: id }); } catch {}
}
try {
  chrome.storage.session.get('abaDeOrigem', (r) => {
    if (abaDeOrigem == null && r && r.abaDeOrigem != null) abaDeOrigem = r.abaDeOrigem;
  });
} catch {}

chrome.tabs.onRemoved.addListener((id) => {
  if (id === abaDeOrigem) definirOrigem(null);
  marcarAbaNaLive(id, false);
});

// ---------------------------------------------------------------- auto resgate
// O resgate (resgate.js) agenda o clique com setTimeout, mas o Chrome segura os
// timers de abas em segundo plano. A cada 30s o alarme "acorda" as abas que
// estão numa live (mesma ideia da extensão Jamble Auto Resgate). A lista de
// abas vem do aviso 'bj-aba-estado' que cada aba manda ao entrar/sair de live
// e sobrevive ao worker ser desligado (storage.session).
const ALARME_RESGATE = 'bj-resgate-tick';
function garantirAlarme() {
  try { chrome.alarms.create(ALARME_RESGATE, { periodInMinutes: 0.5 }); } catch {}
}
chrome.runtime.onInstalled.addListener(garantirAlarme);
chrome.runtime.onStartup.addListener(garantirAlarme);
garantirAlarme();

function marcarAbaNaLive(id, naLive) {
  try {
    chrome.storage.session.get({ abasNaLive: [] }, (r) => {
      const lista = new Set(r.abasNaLive || []);
      if (naLive) lista.add(id); else lista.delete(id);
      chrome.storage.session.set({ abasNaLive: [...lista] });
    });
  } catch {}
}

chrome.alarms.onAlarm.addListener((alarme) => {
  if (alarme.name !== ALARME_RESGATE) return;
  chrome.storage.session.get({ abasNaLive: [] }, (r) => {
    (r.abasNaLive || []).forEach((id) => {
      chrome.tabs.sendMessage(id, { type: 'bj-do-painel', msg: { tipo: 'resgate-tick' } }, () => {
        // aba fechada ou recarregada sem a extensão: sai da lista
        if (chrome.runtime.lastError) marcarAbaNaLive(id, false);
      });
    });
  });
});

// ---------------------------------------------------------------- utilidades
function paraOPainel(msg) {
  if (!portaDoPainel) return false;
  try { portaDoPainel.postMessage(msg); return true; } catch { portaDoPainel = null; return false; }
}

function paraAPagina(msg) {
  if (abaDeOrigem == null) return;
  try { chrome.tabs.sendMessage(abaDeOrigem, { type: 'bj-do-painel', msg }, () => void chrome.runtime.lastError); } catch {}
}

async function abrirPainel() {
  if (janelaDoPainel != null) {
    try {
      await chrome.windows.get(janelaDoPainel);
      await chrome.windows.update(janelaDoPainel, { focused: true, drawAttention: true });
      // A janela já existia: ela pede o estado de novo para pegar a live certa.
      paraOPainel({ tipo: 'painel-reatar' });
      return;
    } catch { janelaDoPainel = null; }
  }
  try {
    const w = await chrome.windows.create({
      url: chrome.runtime.getURL(PAINEL),
      type: 'popup',
      width: LARGURA,
      height: ALTURA,
    });
    janelaDoPainel = w && w.id != null ? w.id : null;
  } catch (e) {
    // Janela popup recusada (acontece, por exemplo, em modo quiosque ou quando o
    // perfil não permite). Melhor abrir numa aba do que não abrir nada.
    try { await chrome.tabs.create({ url: chrome.runtime.getURL(PAINEL) }); } catch {}
  }
}

// ---------------------------------------------------------------- mensagens da página
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (!msg) return;

  // Atalho antigo: abrir uma página da extensão numa aba.
  if (msg.type === 'open-page' && typeof msg.page === 'string' && /^[a-z-]+\.html$/.test(msg.page)) {
    chrome.tabs.create({ url: chrome.runtime.getURL(msg.page) });
    return;
  }

  // O painel pertence a UMA aba. Antes, qualquer aba da Jamble que falasse
  // tomava o painel para si: abrir a mesma live numa segunda aba misturava os
  // dados das duas e o chat de uma delas sumia. Agora a origem só muda quando
  // a pessoa clica em "Abrir painel" numa aba, ou quando não há origem nenhuma
  // (worker reiniciado, aba de origem fechada) — aí a primeira aba que falar
  // assume, como antes.
  const deQuem = sender && sender.tab && sender.tab.id != null ? sender.tab.id : null;
  if (deQuem != null && msg.type === 'bj-abrir-painel' && deQuem !== abaDeOrigem) {
    if (abaDeOrigem != null) paraAPagina({ tipo: 'painel-fechou' });   // a antiga para de mandar
    definirOrigem(deQuem);
    if (portaDoPainel) {
      paraOPainel({ tipo: 'painel-reatar' });
      paraAPagina({ tipo: 'painel-abriu' });
    }
  } else if (deQuem != null && abaDeOrigem == null) {
    definirOrigem(deQuem);
    if (portaDoPainel) paraAPagina({ tipo: 'painel-abriu' });
  }
  const daOrigem = deQuem != null && deQuem === abaDeOrigem;

  // Enquanto a aba está numa live, pedimos ao Chrome que não a descarte sozinho
  // quando a memória aperta. Não é garantia — com memória no limite ele descarta
  // assim mesmo — mas tira a aba da fila do Economizador de Memória, que é o que
  // mata a captura quando a pessoa passa um tempo em outra aba.
  if (msg.type === 'bj-aba-estado') {
    const id = sender && sender.tab ? sender.tab.id : null;
    if (id != null) {
      try {
        chrome.tabs.update(id, { autoDiscardable: !msg.naLive }, () => void chrome.runtime.lastError);
      } catch {}
      marcarAbaNaLive(id, !!msg.naLive);
    }
    return;
  }

  if (msg.type === 'bj-abrir-painel') { abrirPainel(); return; }

  if (msg.type === 'bj-pagina-pronta') {
    // A aba de origem (re)carregou: o painel precisa se reatar. Outra aba
    // carregando não mexe no painel.
    if (portaDoPainel && daOrigem) {
      paraOPainel({ tipo: 'painel-reatar' });
      paraAPagina({ tipo: 'painel-abriu' });
    }
    return;
  }

  if (msg.type === 'bj-para-painel' && msg.msg) {
    if (!daOrigem) return;   // dados de outra aba não entram no painel
    if (msg.msg.tipo === 'painel-pulso') { paraOPainel({ tipo: 'painel-pulso' }); return; }
    paraOPainel(msg.msg);
  }
});

// ---------------------------------------------------------------- porta do painel
chrome.runtime.onConnect.addListener((porta) => {
  if (porta.name !== 'bj-painel') return;
  portaDoPainel = porta;
  if (porta.sender && porta.sender.tab && porta.sender.tab.windowId != null) {
    janelaDoPainel = porta.sender.tab.windowId;
  }
  // Avisa a aba que o painel está de pé e já quer o estado completo.
  paraAPagina({ tipo: 'painel-abriu' });

  porta.onMessage.addListener((msg) => {
    if (!msg || !msg.tipo) return;
    if (msg.tipo === 'painel-pronto') { paraAPagina({ tipo: 'pedir-estado' }); return; }
    paraAPagina(msg);
  });

  porta.onDisconnect.addListener(() => {
    if (portaDoPainel === porta) portaDoPainel = null;
    paraAPagina({ tipo: 'painel-fechou' });
  });
});

chrome.windows.onRemoved.addListener((id) => {
  if (id === janelaDoPainel) {
    janelaDoPainel = null;
    portaDoPainel = null;
    paraAPagina({ tipo: 'painel-fechou' });
  }
});
