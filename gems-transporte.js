// ============================================================================
// BetterJamble — transporte entre a camada de dados (world MAIN) e o painel
// (janela popup da extensão). Roda no world MAIN.
//
// Caminho completo de ida:
//   gems-core  ->  este arquivo  -- window.postMessage -->  bridge.js (ISOLATED)
//              -- chrome.runtime.sendMessage -->  background.js  -- port -->  painel.js
// E de volta na ordem inversa (background -> chrome.tabs.sendMessage -> bridge ->
// window.postMessage -> este arquivo -> gems-core).
//
// Regras:
//   - nada é enviado enquanto o painel estiver fechado (economia de mensagens);
//   - 'completo' troca o estado inteiro; sem ele vão só os envios novos;
//   - rajadas de gema são juntadas numa janela de 250 ms.
// ============================================================================
(() => {
  // relógios que também andam com o tique do painel (ritmo.js): a aba da live
  // escondida não trava o que é periódico
  const relogio = window.__bjRitmo || window;
  if (window.__jambleTransporteLoaded) return;
  window.__jambleTransporteLoaded = true;

  const TAG_SAIDA = 'jamble-ext';      // nós -> bridge
  const TAG_ENTRADA = 'jamble-painel'; // bridge -> nós
  const INTERVALO = 250;               // ms de coalescência das rajadas

  const API = () => window.BetterJamble;

  let painelAberto = false;
  let ultimoSeq = 0;
  let timer = null;
  let pedidoCompleto = false;

  const enviar = (type, payload) => {
    try { window.postMessage({ tag: TAG_SAIDA, type, payload }, location.origin); } catch {}
  };

  // ---------------------------------------------------------------- envio
  function despachar() {
    timer = null;
    const api = API();
    if (!api || !painelAberto) return;
    const completo = pedidoCompleto;
    pedidoCompleto = false;
    const pacote = api.estado({ completo, desde: ultimoSeq });
    ultimoSeq = pacote.seq;
    const novos = api.drenarNovos();
    if (novos.length) pacote.celebrar = novos;
    enviar('painel-estado', pacote);
  }

  function agendar(completo) {
    if (completo) pedidoCompleto = true;
    if (!painelAberto) return;
    if (completo) { relogio.clearTimeout(timer); timer = null; despachar(); return; }
    if (timer) return;
    timer = relogio.setTimeout(despachar, INTERVALO);
  }

  // Motivos que invalidam o que o painel tem na tela inteiro.
  const MOTIVO_COMPLETO = { nav: 1, escopo: 1, filtro: 1, reset: 1 };

  function ligarAssinatura() {
    const api = API();
    if (!api || !api.assinar) return false;
    api.assinar(({ motivo }) => {
      if (MOTIVO_COMPLETO[motivo]) { ultimoSeq = 0; agendar(true); return; }
      agendar(false);
    });
    return true;
  }
  if (!ligarAssinatura()) {
    // gems-core carrega antes deste arquivo no manifest, mas se a ordem mudar
    // o evento no window resolve sem acoplamento.
    window.addEventListener('bj:atualizou', (ev) => {
      const motivo = ev && ev.detail && ev.detail.motivo;
      if (MOTIVO_COMPLETO[motivo]) { ultimoSeq = 0; agendar(true); } else agendar(false);
    });
  }

  // Chat: vai direto, sem coalescer — a confirmação de presença do sorteio
  // espera a mensagem do vencedor e cada segundo conta.
  window.addEventListener('bj:chat', (ev) => {
    const lista = ev && ev.detail && ev.detail.mensagens;
    if (!lista || !lista.length) return;
    if (painelAberto) enviar('painel-chat', { mensagens: lista });
    else guardarPendentes(lista);
  });

  // Comandos "!pokemon" que chegam com o painel fechado: a aba guarda (os
  // últimos 300, de até 12 h, também no localStorage para sobreviver a uma
  // recarga) e entrega quando o painel abrir. Vão marcados como pendentes:
  // o painel só usa para a escolha do Pokémon, nunca como presença.
  const LS_PENDENTES = 'jamble:pokemon-pendentes';
  const MAX_PENDENTES = 300, IDADE_PENDENTES = 12 * 3600 * 1000;
  const ehComandoPokemon = (m) => /^\s*!pok[eé]mon(\s|$)/i.test(String((m && m.texto) || ''));
  let pendentes = [];
  try { pendentes = JSON.parse(localStorage.getItem(LS_PENDENTES) || '[]') || []; } catch { pendentes = []; }
  function salvarPendentes() { try { localStorage.setItem(LS_PENDENTES, JSON.stringify(pendentes)); } catch {} }
  function guardarPendentes(lista) {
    const novos = lista.filter(ehComandoPokemon)
      .map((m) => ({ id: m.id, userId: m.userId, usuario: m.usuario, texto: m.texto, t: m.t || Date.now() }));
    if (!novos.length) return;
    const limite = Date.now() - IDADE_PENDENTES;
    pendentes = pendentes.concat(novos).filter((m) => m.t >= limite).slice(-MAX_PENDENTES);
    salvarPendentes();
  }
  function entregarPendentes() {
    const limite = Date.now() - IDADE_PENDENTES;
    const lista = pendentes.filter((m) => m.t >= limite);
    pendentes = [];
    salvarPendentes();
    if (lista.length) enviar('painel-chat', { mensagens: lista, pendentes: true });
  }

  // ---------------------------------------------------------------- recepção
  window.addEventListener('message', (ev) => {
    if (ev.source !== window) return;
    // recebe todas as mensagens da página; as do site podem não ser legíveis (ver bridge.js)
    let msg;
    try {
      msg = ev.data;
      if (!msg || typeof msg !== 'object' || msg.tag !== TAG_ENTRADA) return;
    } catch { return; }
    const api = API();
    const p = msg.payload || {};

    switch (msg.type) {
      case 'painel-abriu':
        painelAberto = true;
        ultimoSeq = 0;
        agendar(true);
        entregarPendentes();
        break;
      case 'painel-fechou':
        painelAberto = false;
        relogio.clearTimeout(timer);
        timer = null;
        break;
      case 'pedir-estado':
        painelAberto = true;
        ultimoSeq = 0;
        agendar(true);
        // O painel pode ter aberto depois do buraco: ele precisa saber mesmo assim.
        if (lacunas.length) enviar('painel-lacuna', { lista: lacunas });
        entregarPendentes();
        break;
      case 'escopo':
        if (api) api.definirEscopo(p.escopo);
        break;
      case 'filtro':
        if (api) api.definirFiltro(p.iconeId || '');
        break;
      case 'sortear':
        if (api) enviar('painel-sorteio', api.sortear({ modo: p.modo, semRepetir: !!p.semRepetir, entreTipos: !!p.entreTipos, escopo: p.escopo, tipo: p.tipo, filtro: p.filtro || '' }));
        break;
      // A tela de sorteio mostra a urna (quem está dentro e com que chance)
      // ANTES de clicar, e o escopo do sorteio é independente do escopo do
      // ranking. Quando os dois diferem, o snapshot não tem a lista daquele
      // escopo — é o único dado que o painel precisa pedir à parte.
      // O modo e o "não repetir" ficam por conta do painel.
      case 'participantes':
        if (api) {
          const esc = p.escopo === 'vendedor' ? 'vendedor' : 'live';
          const tipo = p.tipo === 'compradores' ? 'compradores' : 'gemas';
          // o sorteio tem o filtro de gema dele, independente do Ranking
          const filtro = p.filtro || '';
          enviar('painel-urna', { escopo: esc, tipo, filtro, lista: api.participantes({ modo: 'peso', escopo: esc, tipo, filtro }) });
        }
        break;
      case 'motivo-sorteio':
        if (api) api.marcarMotivo(p.t, p.id, p.motivo || '');
        break;
      case 'confirmar-ganhador':
        if (api && api.marcarConfirmado) api.marcarConfirmado(p.t, p.id);
        break;
      case 'remover-ganhador':
        if (api && api.removerGanhador) api.removerGanhador(p.t, p.id);
        break;
      case 'limpar-historico':
        if (api) api.limparHistorico();
        break;
      case 'resolver-avatar':
        if (api && p.userId) api.resolverAvatar(p.userId);
        break;
      // aba Batalha: foto de quem está na lista, pelo @
      case 'fotos-por-nome':
        if (api && api.fotosPorNome && Array.isArray(p.nomes)) {
          api.fotosPorNome(p.nomes).then((fotos) => enviar('painel-fotos-nome', { fotos })).catch(() => {});
        }
        break;
      default:
        break;
    }
  });

  // ---------------------------------------------------------------- saúde da aba
  // O Chrome congela e às vezes descarta abas de segundo plano. Enquanto isso dura,
  // o WebSocket cai e nenhuma gema entra — e como a Jamble não guarda histórico, o
  // que passou nesse intervalo está perdido para sempre. A página não consegue se
  // defender disso sozinha (quem pede proteção é o background, via autoDiscardable);
  // o que dá para fazer aqui é registrar o buraco e contar para quem lê o painel.
  const lacunas = [];
  let congelouEm = 0;

  function registrarLacuna(de, motivo) {
    const ate = Date.now();
    if (motivo !== 'descartada' && (!de || ate - de < 2000)) return;   // piscadas não contam
    lacunas.push({ de: de || 0, ate, motivo });
    if (lacunas.length > 20) lacunas.shift();
    enviar('painel-lacuna', { lista: lacunas });
  }

  document.addEventListener('freeze', () => { congelouEm = Date.now(); }, true);
  document.addEventListener('resume', () => { registrarLacuna(congelouEm, 'congelada'); congelouEm = 0; }, true);

  // A aba foi descartada e esta carga é a volta dela: tudo que passou se perdeu.
  try { if (document.wasDiscarded) registrarLacuna(0, 'descartada'); } catch {}

  // ---------------------------------------------------------------- pulso
  // Serve a três propósitos:
  //   1. o painel sabe que a aba de origem continua viva (senão mostra "desconectado");
  //   2. o service worker do MV3 pode ser desligado e perder a quem o painel
  //      pertence; qualquer mensagem da aba reatribui essa ligação;
  //   3. avisa o background quando entra/sai de uma live, para ele ligar e desligar
  //      a proteção contra descarte automático da aba.
  let naLiveAvisado = null;
  function verificarAba() {
    const api = API();
    const naLive = !!(api && api.live && api.live());
    if (naLive !== naLiveAvisado) { naLiveAvisado = naLive; enviar('aba-estado', { naLive }); }
  }
  relogio.setInterval(() => {
    if (painelAberto) enviar('painel-pulso', { em: Date.now() });
    verificarAba();
  }, 4000);
  // Sem esperar o primeiro giro: entrar numa live acontece com a aba na frente.
  verificarAba();
  relogio.setTimeout(verificarAba, 1200);
  window.addEventListener('bj:atualizou', (ev) => {
    if (ev && ev.detail && ev.detail.motivo === 'nav') verificarAba();
  });

  // ---------------------------------------------------------------- abertura
  // Chamado pela barra na página. O pedido vai até o background, que é quem
  // sabe se já existe uma janela aberta (e então só a traz para a frente).
  function abrirPainel() {
    enviar('painel-abrir', { showId: (API() && API().live() || {}).showId || null });
  }

  window.__jambleTransporte = {
    abrirPainel,
    aberto: () => painelAberto,
    forcarEnvio: () => agendar(true),
  };
})();
