// ============================================================================
// BetterJamble — camada de dados das gemas (world MAIN)
//
// Responsabilidade ÚNICA deste arquivo: capturar, guardar e agregar dados.
// Ele não desenha nada e não conhece o painel. Quem desenha consome a API
// pública `window.BetterJamble` e escuta o evento `bj:atualizou`.
//
// De onde vêm os dados:
//   - gemas: hook no WebSocket wss://ws.jamble.com (eventos event_type "LIKE");
//   - preço/nome de cada gema: catálogo /api/live/emojis (hook no fetch + busca
//     própria quando o site não pede);
//   - compradores da live: publicados por live.js em window.__jambleCompradores;
//   - fotos de perfil que não carregam: /api/profile/full?user_id=...
//
// A Jamble não tem endpoint de histórico de gemas: só entra o que acontece com
// a live aberta no navegador. O que já entrou fica em localStorage.
// ============================================================================
(() => {
  // relógios que também andam com o tique do painel (ritmo.js): a aba da live
  // escondida não trava o que é periódico
  const relogio = window.__bjRitmo || window;
  if (window.__jambleGemsCoreLoaded) return;
  window.__jambleGemsCoreLoaded = true;

  // ---------------------------------------------------------------- constantes
  const LS_DADOS = 'jamble:gems:v1';
  const LS_CATALOGO = 'jamble:gems:catalogo:v1';
  const LS_AVATARES = 'jamble:gems:avatars:v1';
  const MAX_SHOWS = 300;          // lives guardadas (só agregados)
  const MAX_SHOWS_COM_FEED = 30;  // lives que mantêm o feed de envios
  const MAX_FEED_POR_SHOW = 300;  // envios guardados por live
  const MAX_IDS_POR_SHOW = 400;   // ids de evento guardados por live (anti-duplicata)
  const MAX_SEEN = 4000;          // ids de evento em memória

  // ---------------------------------------------------------------- estado
  const precos = new Map();   // iconId -> {name, gemPrice, iconUrl, ordem}
  const vistos = new Set();   // ids de evento já contados
  let db = { shows: {} };     // showId -> {seller, sellerId, startedAt, lastAt, users, ids, feed}
  let timerSalvar = null;
  let seq = 0;                // contador monotônico de envios (memória, não persiste)

  let escopo = 'live';        // 'live' | 'vendedor'
  let filtro = '';            // '' = todas as gemas, senão o iconId
  let ultimaLive = null;      // showId da última navegação observada
  let catalogoDaLive = null;  // showId para o qual já buscamos /api/live/emojis

  // Quem já ganhou sorteio, por canal (vendedor), guardado no localStorage:
  // sobrevive à recarga da aba. `jaGanharam` sai sempre do histórico.
  const LS_SORTEIO = 'jamble:gems:sorteio:v1';
  const MAX_HISTORICO = 200;
  const jaGanharam = new Set();
  let historico = [];         // [{t, id, usuario, tipo, modo, escopo, filtro, motivo?}] do canal aberto
  let canalDoHistorico = null;

  const inscritos = new Set();

  try { db = JSON.parse(localStorage.getItem(LS_DADOS) || '') || { shows: {} }; } catch { db = { shows: {} }; }
  if (!db.shows) db.shows = {};
  Object.values(db.shows).forEach((s) => (s.ids || []).forEach((id) => vistos.add(id)));

  // Os envios que vieram do localStorage não têm seq (ele é de memória).
  // Numeramos todos em ordem de tempo para que `feedDesde()` funcione desde o início.
  (() => {
    const todos = [];
    Object.values(db.shows).forEach((s) => (s.feed || []).forEach((e) => todos.push(e)));
    todos.sort((a, b) => a.t - b.t).forEach((e) => (e.s = ++seq));
  })();

  try {
    const salvo = JSON.parse(localStorage.getItem(LS_CATALOGO) || '{}');
    Object.entries(salvo).forEach(([k, v]) => precos.set(k, v));
  } catch {}

  let avatares = {};
  try { avatares = JSON.parse(localStorage.getItem(LS_AVATARES) || '{}') || {}; } catch {}
  // quando cada foto do cache foi conferida pela última vez (ver conferirFoto)
  const LS_AVATARES_EM = 'jamble:gems:avatars-em:v1';
  let avataresEm = {};
  try { avataresEm = JSON.parse(localStorage.getItem(LS_AVATARES_EM) || '{}') || {}; } catch {}

  // ---------------------------------------------------------------- avisos
  // Um único canal de notificação: inscritos diretos + evento no window.
  // `motivo` diz o que mudou, para quem desenha decidir se precisa redesenhar tudo.
  //   nav | dados | escopo | filtro | catalogo | compradores | avatar | sorteio | reset
  let avisoPendente = null;
  function avisar(motivo) {
    const detalhe = { motivo, seq };
    if (avisoPendente === motivo) return;   // coalesce rajadas do mesmo tipo no mesmo tick
    avisoPendente = motivo;
    Promise.resolve().then(() => {
      avisoPendente = null;
      inscritos.forEach((fn) => { try { fn(detalhe); } catch {} });
      try { window.dispatchEvent(new CustomEvent('bj:atualizou', { detail: detalhe })); } catch {}
    });
  }

  // ---------------------------------------------------------------- persistência
  function salvar() {
    relogio.clearTimeout(timerSalvar);
    timerSalvar = relogio.setTimeout(() => {
      try {
        const ids = Object.keys(db.shows);
        if (ids.length > MAX_SHOWS) {
          ids.sort((a, b) => (db.shows[a].lastAt || 0) - (db.shows[b].lastAt || 0))
            .slice(0, ids.length - MAX_SHOWS).forEach((id) => delete db.shows[id]);
        }
        const recentes = Object.keys(db.shows)
          .sort((a, b) => (db.shows[b].lastAt || 0) - (db.shows[a].lastAt || 0))
          .slice(0, MAX_SHOWS_COM_FEED);
        Object.entries(db.shows).forEach(([id, sh]) => {
          if (sh.feed && recentes.indexOf(id) < 0) delete sh.feed;
        });
        localStorage.setItem(LS_DADOS, JSON.stringify(db));
      } catch {}
    }, 1500);
  }

  const salvarAvatares = () => {
    try {
      localStorage.setItem(LS_AVATARES, JSON.stringify(avatares));
      localStorage.setItem(LS_AVATARES_EM, JSON.stringify(avataresEm));
    } catch {}
  };

  // Foto de perfil vista agora (gema, chat, compra, lista de espectadores):
  // vira a foto da pessoa no cache. Antes o cache guardava a primeira foto
  // resolvida para sempre e ela tinha prioridade sobre a dos eventos — quem
  // trocava de foto continuava com a antiga (o endereço velho ainda existe no
  // CDN, então nunca dava erro para forçar a renovação).
  let timerFotos = 0;
  function fotoNova(userId, url) {
    url = foto(url);
    if (!userId || !url) return;
    avataresEm[userId] = Date.now();   // acabou de ser vista: está em dia
    if (avatares[userId] === url) return;
    avatares[userId] = url;
    avatarFalhou.delete(userId);
    relogio.clearTimeout(timerFotos);
    timerFotos = relogio.setTimeout(() => { salvarAvatares(); avisar('avatar'); }, 1000);
  }

  // ---------------------------------------------------------------- auth / fetch
  const fetchOriginal = window.fetch;

  // A Jamble passou a exigir o token App Check (x-firebase-appcheck) em várias
  // rotas. Não geramos token: guardamos os cabeçalhos da última chamada do
  // próprio site à /api/ e usamos nas nossas. Sem eles, só o login (que hoje
  // leva 403 nessas rotas).
  let cabecalhosDoSite = null;
  // showId -> sellerId, aprendido sem depender do que está na tela: dos
  // parâmetros das chamadas que o site faz e dos pacotes "show" do WebSocket.
  // Em janela estreita a Jamble esconde o card de anúncios (de onde vinham as
  // fotos de produto com o id) e o ranking de vendedores virava "—".
  const sellerDoShow = new Map();
  function cabecalhos() {
    if (cabecalhosDoSite) return cabecalhosDoSite;
    try {
      const k = Object.keys(localStorage).find((x) => x.startsWith('firebase:authUser:'));
      const tok = k && JSON.parse(localStorage.getItem(k)).stsTokenManager.accessToken;
      return tok ? { Authorization: 'Bearer ' + tok } : undefined;
    } catch { return undefined; }
  }

  const aprenderPrecos = (j) => {
    if (!j || !Array.isArray(j.emojis)) return;
    j.emojis.forEach((e) => e && e.id && precos.set(e.id, {
      name: e.name || e.id,
      gemPrice: Number(e.gemPrice) || 0,
      iconUrl: e.iconUrl || '',
      ordem: precos.size,
    }));
    try { localStorage.setItem(LS_CATALOGO, JSON.stringify(Object.fromEntries(precos))); } catch {}
    avisar('catalogo');
  };

  // Aproveita a chamada que o próprio site faz; não gera chamada extra.
  window.fetch = async function (input, init) {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input && input.url) || '';
    try {
      if (url.indexOf('/api/') >= 0) {
        const q = new URLSearchParams(url.split('?')[1] || '');
        if (q.get('show_id') && q.get('seller_id')) sellerDoShow.set(q.get('show_id'), q.get('seller_id'));
        const h = (init && init.headers) || (input && input.headers);
        const obj = h instanceof Headers ? Object.fromEntries(h) : h && typeof h === 'object' ? Object.assign({}, h) : null;
        if (obj && Object.keys(obj).some((k) => k.toLowerCase() === 'x-firebase-appcheck')) cabecalhosDoSite = obj;
      }
    } catch {}
    const res = await fetchOriginal.apply(this, arguments);
    // o próprio site buscou o ranking de vendedores (aba "Ranking" da live)
    if (url.includes('/api/live/seller-ranking') && res.ok) res.clone().json().then(aprenderRanking).catch(() => {});
    if (url.includes('/api/live/emojis') && res.ok) {
      res.clone().json().then(aprenderPrecos).catch(() => {});
      // o site já buscou o catálogo desta live: não precisamos buscar de novo
      const h = live();
      if (h && url.includes(h.showId)) catalogoDaLive = h.showId;
    }
    return res;
  };

  // Se o site não pedir o catálogo, pedimos uma vez por live. Falhou? Espera
  // cada vez mais (30s, 1min, 2min... até 10min) — antes tentava a cada 1,5s
  // e enchia a Jamble de 403.
  let catalogoFalhas = 0;
  let catalogoProxima = 0;
  let catalogoTentando = null;      // live das falhas contadas acima
  async function garantirCatalogo() {
    const h = live();
    if (!h || catalogoDaLive === h.showId) return;
    if (catalogoTentando !== h.showId) { catalogoTentando = h.showId; catalogoFalhas = 0; catalogoProxima = 0; }
    if (Date.now() < catalogoProxima) return;
    const sellerId = h.sellerId;
    if (!sellerId) return;
    catalogoProxima = Date.now() + 60000;   // segura outras chamadas enquanto esta roda
    try {
      const r = await fetchOriginal(
        `/api/live/emojis?seller_id=${encodeURIComponent(sellerId)}&show_id=${encodeURIComponent(h.showId)}`,
        { headers: cabecalhos(), credentials: 'include' });
      if (r.ok) {
        aprenderPrecos(await r.json());
        catalogoDaLive = h.showId;
        catalogoFalhas = 0;
        catalogoProxima = 0;
        return;
      }
      if (r.status === 403) cabecalhosDoSite = null;   // token vencido: espera o site mandar outro
    } catch {}
    catalogoFalhas++;
    catalogoProxima = Date.now() + Math.min(10 * 60000, 30000 * Math.pow(2, catalogoFalhas - 1));
  }

  // ---------------------------------------------------------------- pontuação da loja
  // Ranking mensal de vendedores da Jamble (aba "Ranking" da live):
  // GET /api/live/seller-ranking?seller_id=… → {seller: {rank, points}, participants: top 20}.
  // Pede o token App Check (cabecalhos()). Consulta a cada ~2 min com o painel
  // aberto; o que o próprio site buscar também entra (gancho no fetch acima).
  //
  // Entre uma consulta e outra, os pontos sobem NA HORA com o que a extensão
  // vê acontecer nesta live (gemas e vendas), pelas regras que a própria
  // resposta manda (rules[].entryPoints: hoje +2 por gema e +3 por R$1).
  // É estimativa: a próxima consulta substitui pelo valor oficial.
  // Suposição: "+2 por gema enviada" conta o VALOR em gemas (um coração de
  // 10 gemas = +20). Se a Jamble contar por envio, a sincronização corrige.
  let pontosLoja = null;   // {sellerId, rank, points, acima: {rank, points, usuario} | null, em}
  let regrasLoja = { porGema: 2, porReal: 3 };
  let gemasDesdeSync = 0;      // valor em gemas recebido nesta live desde a última consulta
  let vendasNaSync = 0;        // R$ vendidos nesta live no momento da última consulta
  const valorVendido = () => compradores().reduce((a, c) => a + c.valor, 0);

  function aprenderRanking(j) {
    if (!j || !j.seller) return;
    const s = j.seller;
    const lista = Array.isArray(j.participants) ? j.participants : [];
    const rank = Number(s.rank) || null;
    const acima = rank ? lista.find((p) => Number(p.rank) === rank - 1) : null;
    (Array.isArray(j.rules) ? j.rules : []).forEach((r) => {
      const n = Number(r && r.entryPoints);
      if (!n) return;
      if (r.icon === 'gem') regrasLoja.porGema = n;
      else if (r.icon === 'shop') regrasLoja.porReal = n;
    });
    pontosLoja = {
      sellerId: s.sellerId || s.id || null,
      rank,
      points: Number(s.points) || 0,
      acima: acima ? { rank: Number(acima.rank), points: Number(acima.points) || 0, usuario: acima.username || '' } : null,
      em: Date.now(),
    };
    // o oficial já inclui tudo até agora: a estimativa recomeça do zero
    gemasDesdeSync = 0;
    vendasNaSync = valorVendido();
    avisar('loja');
  }

  // Valor para a tela: oficial + o que aconteceu desde a consulta.
  function pontosLojaAgora() {
    if (!pontosLoja) return null;
    const vendasNovas = Math.max(0, valorVendido() - vendasNaSync);
    const extra = Math.round(gemasDesdeSync * regrasLoja.porGema + vendasNovas * regrasLoja.porReal);
    return Object.assign({}, pontosLoja, { oficial: pontosLoja.points, points: pontosLoja.points + extra, estimado: extra });
  }

  let rankingFalhas = 0;
  let rankingProxima = 0;
  async function atualizarRanking() {
    const h = live();
    const painel = window.__jambleTransporte && window.__jambleTransporte.aberto();
    if (!h || !h.sellerId || !painel || Date.now() < rankingProxima) return;
    const est = estadoDaLive(h.showId);
    if (est && est.fim) return;   // live encerrada: os pontos dela já estão fechados
    rankingProxima = Date.now() + 120000 + Math.round(Math.random() * 20000);   // ~2 min, com variação
    try {
      const r = await fetchOriginal('/api/live/seller-ranking?seller_id=' + encodeURIComponent(h.sellerId),
        { headers: cabecalhos(), credentials: 'include' });
      if (r.ok) { aprenderRanking(await r.json()); rankingFalhas = 0; return; }
      if (r.status === 403) cabecalhosDoSite = null;
    } catch {}
    rankingFalhas++;
    rankingProxima = Date.now() + Math.min(15 * 60000, 120000 * Math.pow(2, rankingFalhas));
  }

  // ---------------------------------------------------------------- fotos de perfil
  // O avatar montado a partir do evento às vezes não existe no CDN. Nesse caso
  // quem desenha chama `resolverAvatar(userId)` e nós buscamos o oficial (uma vez).
  const avatarFalhou = new Set();
  const filaAvatar = [];
  let avatarOcupado = 0;

  function resolverAvatar(userId) {
    if (!userId || avatares[userId] || avatarFalhou.has(userId) || filaAvatar.includes(userId)) return;
    filaAvatar.push(userId);
    bombearAvatares();
  }

  function bombearAvatares() {
    while (avatarOcupado < 2 && filaAvatar.length) {
      const id = filaAvatar.shift();
      avatarOcupado++;
      (async () => {
        try {
          const r = await fetchOriginal('/api/profile/full?user_id=' + encodeURIComponent(id),
            { headers: cabecalhos(), credentials: 'include' });
          if (r.status === 403) cabecalhosDoSite = null;   // token vencido: espera o site mandar outro
          const j = r.ok ? await r.json() : null;
          const url = j && j.user && j.user.avatarUrl;
          if (url) fotoNova(id, url);
          else {
            avatarFalhou.add(id);
            // não deu agora: tenta de novo daqui a ~1h, e não a cada pacote
            avataresEm[id] = Date.now() - FOTO_VALE + 3600000;
          }
        } catch { avatarFalhou.add(id); avataresEm[id] = Date.now() - FOTO_VALE + 3600000; }
        finally { avatarOcupado--; relogio.setTimeout(bombearAvatares, 1500); }   // uma folga entre consultas
      })();
    }
  }

  // Quem trocou de foto e não apareceu de novo (sem gema, chat ou compra)
  // ficava com a antiga para sempre. Fotos conferidas há mais de 12h são
  // buscadas de novo no perfil (/api/profile/full, a mesma chamada do site),
  // só para quem está na tela, no máximo 40 a cada 10 min.
  const FOTO_VALE = 12 * 3600000;
  let conferenciasJanela = 0;
  let janelaDesde = Date.now();
  function conferirFoto(userId) {
    if (!userId || filaAvatar.includes(userId)) return;
    if (Date.now() - (avataresEm[userId] || 0) < FOTO_VALE) return;
    if (Date.now() - janelaDesde > 10 * 60000) { janelaDesde = Date.now(); conferenciasJanela = 0; }
    if (conferenciasJanela >= 40) return;
    conferenciasJanela++;
    avatarFalhou.delete(userId);
    filaAvatar.push(userId);
    bombearAvatares();
  }

  function esquecerAvatar(userId, url) {
    if (userId && avatares[userId] === url) { delete avatares[userId]; salvarAvatares(); }
    resolverAvatar(userId);
  }

  // ---------------------------------------------------------------- live atual
  // `sellerSlug` é o @ do vendedor na URL; `sellerId` é o uuid usado pelas APIs.
  function live() {
    const m = location.pathname.match(/^\/live\/([^/]+)\/([^/?#]+)/);
    if (!m) return null;
    const showId = m[2];
    const guardado = db.shows[showId];
    let sellerId = (guardado && guardado.sellerId) || sellerDoShow.get(showId) || null;
    if (!sellerId) {
      const img = document.querySelector('img[src*="/products/user_id="]');
      const mm = img && img.src.match(/products\/user_id=([^/]+)/);
      if (mm) sellerId = mm[1];
    }
    return { showId, sellerSlug: m[1], sellerId };
  }

  // ---------------------------------------------------------------- captura (WebSocket)
  const WSOriginal = window.WebSocket;
  function WSComHook(url, protocolos) {
    const sock = protocolos ? new WSOriginal(url, protocolos) : new WSOriginal(url);
    if (String(url).includes('ws.jamble.com')) {
      sock.addEventListener('message', (ev) => {
        if (typeof ev.data !== 'string') return;
        const temGema = ev.data.indexOf('"LIKE"') >= 0;
        const temChat = ev.data.indexOf('"messages"') >= 0;
        const temShow = ev.data.indexOf('"has_started"') >= 0;
        if (!temGema && !temChat && !temShow) return;
        try {
          const msg = JSON.parse(ev.data);
          if (temGema) ingerir(msg);
          if (temChat) ingerirChat(msg);
          if (temShow) ingerirShow(msg);
        } catch {}
      });
    }
    return sock;
  }
  WSComHook.prototype = WSOriginal.prototype;
  Object.assign(WSComHook, WSOriginal);
  window.WebSocket = WSComHook;

  function avatarDoEvento(perfil, userId) {
    const p = perfil || {};
    const img = p.profile_image || {};
    // a Jamble já manda as versões prontas; "low" é a menor
    const pronta = img.low || img.medium || img.url || img.original_url;
    if (pronta) return pronta;
    // ATENÇÃO: este CDN serve a imagem em tamanho cheio (~1,5 MB) e não aceita
    // parâmetro de resize. Quem desenha PRECISA limitar por CSS.
    // O id já vem com a extensão ("<uuid>.png"); acrescentar outra dava
    // ".png.png" e a foto não carregava.
    if (img.id && userId) {
      const arquivo = /\.\w{3,4}$/.test(img.id) ? img.id : img.id + '.png';
      return `https://jamble.b-cdn.net/profiles/user_id=${userId}/profile_images/${arquivo}`;
    }
    return p.avatar_url || p.avatarUrl || '';
  }

  // Conserta as fotos já gravadas com a extensão duplicada (ver acima).
  function foto(u) {
    return String(u || '').replace(/(\.(?:png|jpe?g|webp|gif))\.png$/i, '$1');
  }

  // Chat da live. Vem no mesmo socket, dentro dos pacotes "update" da live
  // (data.messages). Não é guardado: só é repassado a quem escuta 'bj:chat'
  // (o transporte manda ao painel, que usa para a confirmação de presença do
  // sorteio). Só mensagens escritas por alguém (STANDARD) — "entrou 👋" e
  // afins ficam de fora.
  const chatVisto = new Set();
  function ingerirChat(msg) {
    const lista = msg && msg.data && msg.data.messages;
    if (!Array.isArray(lista)) return;
    // o "snapshot" da conexão traz o histórico recente: mensagem antiga não
    // pode confirmar presença de ninguém
    const historico = msg.event_type === 'snapshot';
    const agora = Date.now();
    const novas = [];
    for (const m of lista) {
      if (!m || m.message_type !== 'STANDARD' || !m.content || m.is_visible === false) continue;
      if (m.id) {
        if (chatVisto.has(m.id)) continue;
        chatVisto.add(m.id);
        if (chatVisto.size > 2000) chatVisto.delete(chatVisto.values().next().value);
      }
      const p = m.sender_profile || {};
      fotoNova(m.sender_id || p.id, avatarDoEvento(p, m.sender_id || p.id));
      if (historico) continue;
      novas.push({
        id: m.id || '',
        userId: m.sender_id || p.id || '',
        usuario: p.username || '',
        avatar: avatarDoEvento(p, m.sender_id || p.id),
        texto: String(m.content).slice(0, 300),
        t: Math.round((Number(m.created_at) || Date.now() / 1000) * 1000),
        chegou: agora,   // hora em que a aba recebeu (mede o atraso até o painel)
      });
    }
    if (!novas.length) return;
    try { window.dispatchEvent(new CustomEvent('bj:chat', { detail: { mensagens: novas } })); } catch {}
  }

  let novosDesdeOAviso = [];   // envios que ainda não foram anunciados

  function ingerir(msg) {
    const eventos = msg && msg.data && msg.data.events;
    if (!Array.isArray(eventos)) return 0;
    let entraram = 0;
    for (const ev of eventos) {
      if (!ev || ev.event_type !== 'LIKE') continue;
      const showId = ev.show_id;
      const p = ev.liker_profile || {};
      const userId = ev.user_id || p.id;
      if (!showId || !userId) continue;

      const icone = ev.like_icon_id || 'desconhecido';
      const valor = precos.has(icone) ? precos.get(icone).gemPrice : Number(ev.like_icon_battle_entry_count) || 0;
      const quando = Math.round((Number(ev.created_at) || Date.now() / 1000) * 1000);

      const atual = live();
      const show = db.shows[showId] || (db.shows[showId] = {
        seller: (atual && atual.showId === showId ? atual.sellerSlug : null) || ev.seller_id || '?',
        sellerId: ev.seller_id || (atual && atual.showId === showId ? atual.sellerId : null) || null,
        startedAt: quando, lastAt: quando, users: {}, ids: [],
      });
      if (!show.sellerId && ev.seller_id) show.sellerId = ev.seller_id;
      show.lastAt = Math.max(show.lastAt || 0, quando);

      if (ev.id) {
        if (vistos.has(ev.id)) continue;
        vistos.add(ev.id);
        if (vistos.size > MAX_SEEN) vistos.delete(vistos.values().next().value);
        (show.ids || (show.ids = [])).push(ev.id);
        if (show.ids.length > MAX_IDS_POR_SHOW) show.ids.splice(0, show.ids.length - MAX_IDS_POR_SHOW);
      }

      const u = show.users[userId] || (show.users[userId] = { u: p.username || userId, n: 0, g: 0, icons: {}, last: 0 });
      if (p.username) u.u = p.username;
      const av = avatarDoEvento(p, userId);
      if (av) { u.a = av; fotoNova(userId, av); }
      u.n++;
      u.g += valor;
      u.icons[icone] = (u.icons[icone] || 0) + 1;
      u.last = Math.max(u.last, quando);

      const cat = precos.get(icone) || {};
      const envio = {
        i: ev.id || `${userId}-${quando}`, s: ++seq, t: quando,
        u: userId, n: u.u, a: av || u.a || '',
        ic: icone, nm: cat.name || icone, p: valor,
        url: ev.like_icon_url || cat.iconUrl || '',
      };
      (show.feed || (show.feed = [])).push(envio);
      if (show.feed.length > MAX_FEED_POR_SHOW) show.feed.splice(0, show.feed.length - MAX_FEED_POR_SHOW);
      novosDesdeOAviso.push(normalizarEnvio(envio, showId, show.seller));
      // pontuação da loja: soma na hora, até a próxima consulta oficial
      if (atual && atual.showId === showId) gemasDesdeSync += valor;
      entraram++;
    }
    if (entraram) { salvar(); avisar('dados'); }
    return entraram;
  }

  // ---------------------------------------------------------------- consultas
  // Todas as consultas aceitam um escopo explícito. Sem argumento vale o escopo
  // atual (o que o painel escolheu). A barra na página, por exemplo, sempre
  // pergunta por 'live', porque ela fala da live aberta e não do painel.
  const livesDoEscopo = (esc) => {
    const h = live();
    if (!h) return [];
    const e = esc || escopo;
    return Object.entries(db.shows).filter(([id, s]) =>
      e === 'vendedor' ? s.seller === h.sellerSlug : id === h.showId);
  };

  function preco(icone) {
    const c = precos.get(icone);
    if (c && c.gemPrice) return c.gemPrice;
    for (const sh of Object.values(db.shows)) {
      const achou = (sh.feed || []).find((e) => e.ic === icone && e.p);
      if (achou) return achou.p;
    }
    return 0;
  }

  function nomeDaGema(icone) {
    const c = precos.get(icone);
    if (c && c.name) return c.name;
    for (const sh of Object.values(db.shows)) {
      const achou = (sh.feed || []).find((e) => e.ic === icone && e.nm);
      if (achou) return achou.nm;
    }
    return icone;
  }

  function urlDaGema(icone) {
    const c = precos.get(icone);
    if (c && c.iconUrl) return c.iconUrl;
    for (const sh of Object.values(db.shows)) {
      const achou = (sh.feed || []).find((e) => e.ic === icone && e.url);
      if (achou) return achou.url;
    }
    return '';
  }

  // Ranking de quem mandou gema, já com o filtro de tipo aplicado. `f` é o
  // filtro a usar (o do Ranking, por padrão; o sorteio passa o dele).
  function ranking(esc, f = filtro) {
    const acc = new Map();
    for (const [, s] of livesDoEscopo(esc)) {
      for (const [uid, u] of Object.entries(s.users || {})) {
        const envios = f ? ((u.icons || {})[f] || 0) : u.n;
        if (f && !envios) continue;
        const cur = acc.get(uid) || { id: uid, usuario: u.u, avatar: foto(u.a), gemas: 0, envios: 0, lives: 0, ultimo: 0, icones: {} };
        cur.usuario = u.u || cur.usuario;
        if (u.a) cur.avatar = foto(u.a);
        if (avatares[uid]) cur.avatar = foto(avatares[uid]);
        cur.envios += envios;
        cur.gemas += f ? envios * preco(f) : u.g;
        cur.lives++;
        cur.ultimo = Math.max(cur.ultimo, u.last || 0);
        Object.entries(u.icons || {}).forEach(([k, v]) => (cur.icones[k] = (cur.icones[k] || 0) + v));
        acc.set(uid, cur);
      }
    }
    return [...acc.values()].sort((a, b) => b.gemas - a.gemas || b.envios - a.envios);
  }

  function normalizarEnvio(e, showId, sellerSlug) {
    return {
      id: e.i, seq: e.s || 0, t: e.t,
      userId: e.u, usuario: e.n, avatar: foto(avatares[e.u] || e.a),
      iconeId: e.ic, iconeNome: e.nm || nomeDaGema(e.ic), iconeUrl: e.url || urlDaGema(e.ic),
      gemas: e.p || 0,
      showId, sellerSlug: sellerSlug || '',
    };
  }

  // Feed do escopo, do mais antigo para o mais novo (é assim que o console desenha).
  function feed(limite, esc) {
    const envios = [];
    livesDoEscopo(esc).forEach(([id, sh]) => {
      (sh.feed || []).forEach((e) => {
        if (!filtro || e.ic === filtro) envios.push(normalizarEnvio(e, id, sh.seller));
      });
    });
    envios.sort((a, b) => a.t - b.t || a.seq - b.seq);
    const n = limite || 250;
    return envios.length > n ? envios.slice(envios.length - n) : envios;
  }

  // Só os envios com seq maior que o informado — para o painel acrescentar no fim
  // sem receber o feed inteiro de novo.
  function feedDesde(desde, esc) {
    const n = Number(desde) || 0;
    const envios = [];
    livesDoEscopo(esc).forEach(([id, sh]) => {
      (sh.feed || []).forEach((e) => {
        if ((e.s || 0) > n && (!filtro || e.ic === filtro)) envios.push(normalizarEnvio(e, id, sh.seller));
      });
    });
    return envios.sort((a, b) => a.seq - b.seq);
  }

  // Tipos de gema que já apareceram no escopo + o catálogo completo da live.
  // `envios` é quantas vezes aquele tipo apareceu no escopo (0 = existe mas ninguém mandou).
  function catalogo(esc) {
    const contagem = new Map();
    livesDoEscopo(esc).forEach(([, sh]) => {
      Object.values(sh.users || {}).forEach((u) => {
        Object.entries(u.icons || {}).forEach(([ic, n]) => contagem.set(ic, (contagem.get(ic) || 0) + n));
      });
    });
    const lista = [...precos.entries()]
      .sort((a, b) => (a[1].ordem || 0) - (b[1].ordem || 0))
      .map(([id, info]) => ({
        id, nome: info.name || id, iconeUrl: info.iconUrl || '',
        preco: Number(info.gemPrice) || 0, envios: contagem.get(id) || 0,
      }));
    // gemas que apareceram mas não estão no catálogo carregado
    contagem.forEach((n, ic) => {
      if (!precos.has(ic)) lista.push({ id: ic, nome: nomeDaGema(ic), iconeUrl: urlDaGema(ic), preco: preco(ic), envios: n });
    });
    return lista;
  }

  // Ranking de compradores DESTA live. Vem de live.js (a lista completa de
  // vendidos da live aberta). Desde a 3.5 ela também é gravada na live
  // (show.buyers), para o sorteio de compradores poder somar todas as lives
  // do canal. A Jamble não dá histórico: só entram as lives em que a
  // extensão estava aberta, daqui para a frente.
  function compradores() {
    const h = live();
    if (!h) return [];
    const d = window.__jambleCompradores;
    const lista = d && d.showId === h.showId && Array.isArray(d.lista)
      ? d.lista
      // aba recarregada: até o live.js buscar de novo, vale o que foi gravado
      : Object.entries((db.shows[h.showId] || {}).buyers || {}).map(([id, c]) => ({ id, ...c }));
    return lista.map((c) => ({
      id: c.id, usuario: c.u, avatar: foto(avatares[c.id] || c.a),
      compras: Number(c.n) || 0, valor: Number(c.v) || 0,
    }));
  }

  // Grava a lista de vendidos da live aberta. A lista do live.js é sempre a
  // completa (ele só monta quando já leu todas as páginas), então substitui.
  function guardarCompradores() {
    const h = live();
    const d = window.__jambleCompradores;
    if (!h || !d || d.showId !== h.showId || !Array.isArray(d.lista)) return;
    const agora = Date.now();
    const show = db.shows[h.showId] || (db.shows[h.showId] = {
      seller: h.sellerSlug, sellerId: h.sellerId || null, startedAt: agora, lastAt: agora, users: {}, ids: [],
    });
    if (!show.seller || show.seller === '?') show.seller = h.sellerSlug;
    show.buyers = {};
    d.lista.forEach((c) => {
      show.buyers[c.id] = { u: c.u, a: c.a || '', n: Number(c.n) || 0, v: Number(c.v) || 0 };
      fotoNova(c.id, c.a);   // a lista de vendidos traz a foto atual de quem comprou
    });
    salvar();
  }

  // Compradores do escopo: 'live' = a aberta; 'vendedor' = todas as lives do
  // canal que a extensão gravou, somando compras e valor de cada pessoa.
  function compradoresDoEscopo(esc) {
    if (esc !== 'vendedor') return compradores();
    const h = live();
    const acc = new Map();
    for (const [id, s] of livesDoEscopo('vendedor')) {
      // a live aberta usa a lista em memória (pode ser mais nova que a gravada)
      const doShow = h && id === h.showId
        ? compradores().map((c) => [c.id, { u: c.usuario, a: c.avatar, n: c.compras, v: c.valor }])
        : Object.entries(s.buyers || {});
      for (const [uid, c] of doShow) {
        const cur = acc.get(uid) || { id: uid, usuario: c.u, avatar: '', compras: 0, valor: 0, lives: 0 };
        cur.usuario = c.u || cur.usuario;
        if (avatares[uid] || c.a) cur.avatar = foto(avatares[uid] || c.a);
        cur.compras += c.n || 0;
        cur.valor += c.v || 0;
        cur.lives++;
        acc.set(uid, cur);
      }
    }
    return [...acc.values()].sort((a, b) => b.compras - a.compras || b.valor - a.valor);
  }

  function totais(esc) {
    const r = ranking(esc);
    const c = compradores();
    return {
      pessoas: r.length,
      gemas: r.reduce((a, x) => a + x.gemas, 0),
      envios: r.reduce((a, x) => a + x.envios, 0),
      livesNoEscopo: livesDoEscopo(esc).length,
      compradores: c.length,
      vendasValor: c.reduce((a, x) => a + x.valor, 0),
      vendasCount: c.reduce((a, x) => a + x.compras, 0),
    };
  }

  // ---------------------------------------------------------------- live no ar / encerrada
  // Os dados já são separados por live (show_id), nunca por dia: uma live que
  // passa da meia-noite continua uma só. Aqui marcamos quando ela está no ar e
  // quando acabou, para "fechar" os números dela.
  //
  // De onde vem:
  //   - cada pacote "show" da conexão ao vivo traz has_started, is_over e
  //     started_at (hora exata do início);
  //   - o título da página diz "· Ao vivo |" ou "· Live encerrada |" (a página de
  //     uma live encerrada nem abre a conexão).
  // A Jamble não manda a hora do fim. Se a extensão viu a live no ar há pouco,
  // o fim é o momento em que ela acabou; se a página já abriu encerrada, o fim
  // é o último dado recebido daquela live e fica marcado como provisório.
  const estadosLive = {};   // showId -> {aoVivo, inicio, fim, provisorio, vistoNoArEm} (memória)

  function estadoDaLive(showId) {
    const s = db.shows[showId];
    const m = estadosLive[showId] || {};
    if (!s && !estadosLive[showId]) return null;
    return {
      aoVivo: s && s.fimEm ? false : !!m.aoVivo,
      inicio: (s && s.inicioJamble) || m.inicio || (s && s.startedAt) || 0,
      fim: (s && s.fimEm) || m.fim || 0,
      provisorio: !!((s && s.fimProvisorio) || m.provisorio),
    };
  }

  function registrarEstadoLive(showId, info) {
    if (!showId) return;
    const m = estadosLive[showId] || (estadosLive[showId] = {});
    const s = db.shows[showId];   // só lives que a extensão já guarda (nada de criar entrada vazia)
    const agora = Date.now();
    let mudou = false;
    if (info.inicio && !m.inicio) { m.inicio = info.inicio; mudou = true; }
    if (s && info.inicio && s.inicioJamble !== info.inicio) { s.inicioJamble = info.inicio; mudou = true; }
    if (info.aoVivo) {
      m.vistoNoArEm = agora;
      if (!m.aoVivo) { m.aoVivo = true; mudou = true; }
      // a live voltou (ex.: o vendedor reabriu): desfaz um fim provisório
      if ((s && s.fimEm && s.fimProvisorio) || (m.fim && m.provisorio)) {
        if (s) { delete s.fimEm; delete s.fimProvisorio; }
        delete m.fim; delete m.provisorio;
        mudou = true;
        try { window.dispatchEvent(new CustomEvent('bj:live-status', { detail: { showId, encerrada: false } })); } catch {}
      }
    }
    if (info.encerrada && !(s && s.fimEm) && !m.fim) {
      const viuNoAr = m.vistoNoArEm && agora - m.vistoNoArEm < 5 * 60000;
      const fim = viuNoAr ? agora : ((s && s.lastAt) || m.vistoNoArEm || agora);
      m.aoVivo = false;
      m.fim = fim;
      m.provisorio = !viuNoAr;
      if (s) { s.fimEm = fim; s.fimProvisorio = !viuNoAr; }
      mudou = true;
      try { window.dispatchEvent(new CustomEvent('bj:live-status', { detail: { showId, encerrada: true, fim, provisorio: !viuNoAr } })); } catch {}
    }
    if (mudou) { salvar(); avisar('live'); }
  }

  function ingerirShow(msg) {
    const sh = msg && msg.data && msg.data.show;
    if (!sh || !sh.id) return;
    if (sh.seller_id) sellerDoShow.set(sh.id, sh.seller_id);
    registrarEstadoLive(sh.id, {
      inicio: sh.started_at ? Math.round(Number(sh.started_at) * 1000) : 0,
      aoVivo: !!sh.has_started && !sh.is_over,
      encerrada: !!sh.is_over,
    });
  }

  // O título da página também diz o estado (e é o único sinal numa live que
  // já abriu encerrada, porque ela nem conecta).
  function conferirTitulo() {
    const h = live();
    if (!h) return;
    const t = document.title || '';
    if (/Live encerrada|Live ended/i.test(t)) registrarEstadoLive(h.showId, { encerrada: true });
    else if (/·\s*Ao vivo\s*\||·\s*Live\s*\|/i.test(t)) registrarEstadoLive(h.showId, { aoVivo: true });
  }

  // Lives do vendedor atual que a extensão acompanhou — serve para deixar
  // explícito, na tela, o que "todas as lives" está somando.
  function livesDoVendedor() {
    const h = live();
    if (!h) return [];
    return Object.entries(db.shows)
      .filter(([, s]) => s.seller === h.sellerSlug)
      .map(([id, s]) => {
        const users = Object.values(s.users || {});
        return {
          showId: id,
          atual: id === h.showId,
          // início e fim de verdade quando a extensão viu (ver estadoDaLive);
          // senão, o primeiro e o último dado guardados
          inicio: s.inicioJamble || s.startedAt || 0,
          fim: s.fimEm || s.lastAt || 0,
          encerrada: !!s.fimEm,
          pessoas: users.length,
          envios: users.reduce((a, u) => a + (u.n || 0), 0),
          gemas: users.reduce((a, u) => a + (u.g || 0), 0),
          compradores: id === h.showId ? compradores().length : Object.keys(s.buyers || {}).length,
          temFeed: !!(s.feed && s.feed.length),
        };
      })
      .sort((a, b) => b.fim - a.fim);
  }

  // ---------------------------------------------------------------- sorteio
  // Por padrão sorteia entre quem mandou gema NESTA live (o escopo pode ser trocado,
  // mas quem desenha deve deixar claro qual está valendo).
  //
  // tipo 'compradores': sorteia entre quem comprou (nesta live ou em todas as
  // lives do canal gravadas — ver compradoresDoEscopo) e, no modo "por
  // quantidade", cada compra é uma chance. Quem já ganhou é contado por tipo:
  // ganhar no sorteio de gemas não tira ninguém do sorteio de compradores.
  const chaveGanhou = (tipo, id) => (tipo === 'compradores' ? 'c:' : '') + id;

  // Ganhou no outro tipo de sorteio? Pelo id e, por garantia, pelo @: o id de
  // quem manda gema e o de quem compra vêm de respostas diferentes da Jamble.
  function ganhouNoOutro(tipo, r) {
    const outro = tipo === 'compradores' ? 'gemas' : 'compradores';
    if (jaGanharam.has(chaveGanhou(outro, r.id))) return true;
    const u = String(r.usuario || '').toLowerCase();
    return !!u && historico.some((h) => h.tipo === outro && String(h.usuario || '').toLowerCase() === u);
  }

  function participantes(op) {
    garantirHistorico();
    const o = op || {};
    const modo = o.modo === 'pessoa' ? 'pessoa' : 'peso';
    const tipo = o.tipo === 'compradores' ? 'compradores' : 'gemas';
    const base = tipo === 'compradores'
      ? compradoresDoEscopo(o.escopo || 'live').map((c) => ({ ...c, envios: c.compras }))
      : ranking(o.escopo || escopo, o.filtro != null ? o.filtro : filtro);
    const peso = (r) => (tipo === 'compradores' ? r.compras : r.gemas);
    // marcado como "já sorteado" ou "ausente" sai da urna mesmo sem "não repetir"
    const marcados = new Set(historico.filter((h) => h.motivo && h.tipo === tipo).map((h) => h.id));
    return base
      .filter((r) => !marcados.has(r.id))
      .filter((r) => !o.semRepetir || !jaGanharam.has(chaveGanhou(tipo, r.id)))
      // quem ganhou no outro tipo (gemas <-> compradores) fica de fora
      .filter((r) => !o.entreTipos || !ganhouNoOutro(tipo, r))
      .map((r) => ({ ...r, bilhetes: modo === 'peso' ? Math.max(1, peso(r)) : 1 }));
  }

  function sortear(op) {
    const o = op || {};
    const lista = participantes(o);   // já garante o histórico do canal
    const bilhetes = lista.reduce((a, r) => a + r.bilhetes, 0);
    if (!lista.length) return { vencedor: null, participantes: lista, bilhetes: 0, historico: historico.slice() };
    let n = Math.random() * bilhetes;
    let vencedor = lista[lista.length - 1];
    for (const r of lista) { n -= r.bilhetes; if (n <= 0) { vencedor = r; break; } }
    const tipo = o.tipo === 'compradores' ? 'compradores' : 'gemas';
    jaGanharam.add(chaveGanhou(tipo, vencedor.id));
    const lv = live();
    historico.unshift({
      t: Date.now(), id: vencedor.id, usuario: vencedor.usuario,
      showId: (lv && lv.showId) || '',   // de qual live: o palco só traz de volta o ganhador desta
      tipo,
      modo: o.modo === 'pessoa' ? 'pessoa' : 'peso',
      escopo: o.escopo || (tipo === 'compradores' ? 'live' : escopo),
      filtro: tipo === 'compradores' ? '' : ((o.filtro != null ? o.filtro : filtro) || ''),
    });
    historico = historico.slice(0, MAX_HISTORICO);
    recalcularGanhadores();
    salvarHistorico();
    avisar('sorteio');
    return { vencedor, participantes: lista, bilhetes, historico: historico.slice() };
  }

  function lerSorteios() {
    try { return JSON.parse(localStorage.getItem(LS_SORTEIO) || '{}') || {}; } catch { return {}; }
  }
  function recalcularGanhadores() {
    jaGanharam.clear();
    historico.forEach((h) => jaGanharam.add(chaveGanhou(h.tipo || 'gemas', h.id)));
  }
  // Troca o histórico quando muda o canal aberto (chamado antes de qualquer uso).
  function garantirHistorico() {
    const h = live();
    const canal = h ? h.sellerSlug : '';
    if (!canal || canal === canalDoHistorico) return;
    canalDoHistorico = canal;
    const tudo = lerSorteios();
    historico = Array.isArray(tudo[canal]) ? tudo[canal] : [];
    recalcularGanhadores();
  }
  function salvarHistorico() {
    if (!canalDoHistorico) return;
    const tudo = lerSorteios();
    if (historico.length) tudo[canalDoHistorico] = historico;
    else delete tudo[canalDoHistorico];
    try { localStorage.setItem(LS_SORTEIO, JSON.stringify(tudo)); } catch {}
  }

  // Tira uma pessoa da lista de quem já ganhou: ela volta para a urna.
  function removerGanhador(t, id) {
    garantirHistorico();
    const antes = historico.length;
    historico = historico.filter((x) => !(x.t === t && x.id === id));
    if (historico.length === antes) return;
    recalcularGanhadores();
    salvarHistorico();
    avisar('sorteio');
  }

  // Quem conduz o sorteio marca o vencedor que não respondeu: 'ja-sorteado'
  // (outra conta de quem já ganhou) ou 'ausente'. '' desmarca.
  function marcarMotivo(t, id, motivo) {
    garantirHistorico();
    const h = historico.find((x) => x.t === t && x.id === id);
    if (!h) return;
    if (motivo === 'ja-sorteado' || motivo === 'ausente') h.motivo = motivo;
    else delete h.motivo;
    salvarHistorico();
    avisar('sorteio');
  }

  // O vencedor apareceu no chat (presença confirmada): fica marcado na lista.
  function marcarConfirmado(t, id) {
    garantirHistorico();
    const h = historico.find((x) => x.t === t && x.id === id);
    if (!h || h.confirmado) return;
    h.confirmado = true;
    salvarHistorico();
    avisar('sorteio');
  }

  function limparHistorico() {
    garantirHistorico();
    historico = [];
    jaGanharam.clear();
    salvarHistorico();
    avisar('sorteio');
  }

  // ---------------------------------------------------------------- snapshot
  // Pacote que o transporte manda para o painel. `completo` troca tudo;
  // sem ele vêm só os envios novos (`feedNovos`) para acrescentar no fim.
  // Insights da tela Ao vivo: sempre só a live aberta e sem o filtro de gema,
  // independente do escopo e do filtro escolhidos no Ranking/Sorteio.
  function vivo() {
    const f = filtro;
    filtro = '';
    try {
      return {
        totais: totais('live'),
        ranking: ranking('live'),
        catalogo: catalogo('live'),
        tempos: feed(250, 'live').map((e) => e.t),
      };
    } finally {
      filtro = f;
    }
  }

  function estado(op) {
    garantirHistorico();
    const o = op || {};
    const h = live();
    const base = {
      seq,
      em: Date.now(),
      completo: !!o.completo,
      live: h ? { showId: h.showId, sellerSlug: h.sellerSlug, sellerId: h.sellerId || null, estado: estadoDaLive(h.showId) } : null,
      escopo,
      filtro,
      nomeDoFiltro: filtro ? nomeDaGema(filtro) : '',
      catalogo: catalogo(),
      ranking: ranking(),
      compradores: compradores(),
      totais: totais(),
      vivo: vivo(),
      livesDoVendedor: livesDoVendedor(),
      historico: historico.slice(),
      // por tipo de sorteio (ver chaveGanhou)
      jaGanharam: [...jaGanharam].filter((k) => k.indexOf('c:') !== 0),
      jaGanharamCompradores: [...jaGanharam].filter((k) => k.indexOf('c:') === 0).map((k) => k.slice(2)),
      // só vale se for desta loja (a pessoa pode ter trocado de live)
      pontosLoja: pontosLoja && h && (!h.sellerId || pontosLoja.sellerId === h.sellerId) ? pontosLojaAgora() : null,
    };
    if (o.completo) base.feed = feed(o.limiteFeed || 250);
    else base.feedNovos = feedDesde(o.desde || 0);
    // fotos de quem está na tela: as conferidas há mais de 12h são buscadas de novo
    base.ranking.slice(0, 40).forEach((r) => conferirFoto(r.id));
    base.compradores.slice(0, 20).forEach((c) => conferirFoto(c.id));
    (base.feed || base.feedNovos || []).slice(-30).forEach((e) => conferirFoto(e.userId));
    return base;
  }

  // Envios que chegaram desde a última chamada — para animação/celebração.
  function drenarNovos() {
    const n = novosDesdeOAviso;
    novosDesdeOAviso = [];
    return n;
  }

  // ---------------------------------------------------------------- navegação
  // Trocar de live é uma troca de contexto completa: quem desenha precisa
  // jogar o conteúdo antigo fora. Daí o motivo 'nav'.
  function aoNavegar() {
    const h = live();
    const id = h ? h.showId : null;
    if (id === ultimaLive) return;
    ultimaLive = id;
    catalogoDaLive = null;
    novosDesdeOAviso = [];
    avisar('nav');
  }

  ['pushState', 'replaceState'].forEach((fn) => {
    const orig = history[fn];
    history[fn] = function () { const r = orig.apply(this, arguments); aoNavegar(); relogio.setTimeout(aoNavegar, 0); return r; };
  });
  window.addEventListener('popstate', () => { aoNavegar(); relogio.setTimeout(aoNavegar, 0); });
  window.addEventListener('jamble:compradores', () => { guardarCompradores(); avisar('compradores'); });
  // fotos atuais vindas da lista de espectadores (audiencia.js)
  window.addEventListener('bj:fotos', (ev) => {
    const lista = ev && ev.detail && ev.detail.fotos;
    if (Array.isArray(lista)) lista.forEach((f) => f && fotoNova(f.id, f.url));
  });

  // Rede de segurança: a navegação da Jamble é SPA e nem sempre passa pelos ganchos.
  relogio.setInterval(() => { aoNavegar(); garantirCatalogo(); atualizarRanking(); conferirTitulo(); }, 1500);
  aoNavegar();
  garantirCatalogo();

  // ---------------------------------------------------------------- API pública
  // Tudo que a interface precisa saber está aqui. Nada de tocar em `db` direto.
  window.BetterJamble = {
    versao: '3.6.0',

    // contexto
    live,                       // () -> {showId, sellerSlug, sellerId} | null
    estadoDaLive,               // (showId) -> {aoVivo, inicio, fim, provisorio} | null
    estaEmLive: () => !!live(),

    // escopo e filtro
    escopo: () => escopo,       // 'live' | 'vendedor'
    definirEscopo: (e) => {
      const novo = e === 'vendedor' ? 'vendedor' : 'live';
      if (novo === escopo) return escopo;
      escopo = novo;
      avisar('escopo');
      return escopo;
    },
    filtro: () => filtro,       // '' = todas
    definirFiltro: (ic) => {
      const novo = ic || '';
      if (novo === filtro) return filtro;
      filtro = novo;
      avisar('filtro');
      return filtro;
    },

    // consultas
    // Em todas as consultas abaixo o escopo é opcional ('live' | 'vendedor');
    // sem ele vale o escopo atual, que é o que o painel escolheu.
    catalogo,                   // (escopo?) -> [{id,nome,iconeUrl,preco,envios}]
    ranking,                    // (escopo?) -> [{id,usuario,avatar,gemas,envios,lives,ultimo,icones}]
    feed,                       // (limite=250, escopo?) -> [envio]  (antigo -> novo)
    feedDesde,                  // (seq, escopo?) -> [envio]
    compradores,                // () -> [{id,usuario,avatar,compras,valor}]
    totais,                     // (escopo?) -> {pessoas,gemas,envios,livesNoEscopo,compradores,vendasValor,vendasCount}
    livesDoVendedor,            // () -> [{showId,atual,inicio,fim,encerrada,pessoas,envios,gemas,temFeed}]
    estado,                     // ({completo,desde,limiteFeed}) -> snapshot do protocolo
    drenarNovos,                // () -> [envio] recém-chegados (consome)

    // gemas
    nomeDaGema, urlDaGema, precoDaGema: preco,

    // sorteio
    participantes,              // ({modo,semRepetir,escopo}) -> [{...ranking, bilhetes}]
    sortear,                    // ({modo,semRepetir,escopo}) -> {vencedor,participantes,bilhetes,historico}
    historico: () => { garantirHistorico(); return historico.slice(); },
    marcarMotivo,               // (t, id, 'ja-sorteado'|'ausente'|'') -> marca a entrada do histórico
    removerGanhador,            // (t, id) -> tira a entrada do histórico; a pessoa volta para a urna
    marcarConfirmado,           // (t, id) -> o vencedor confirmou presença no chat
    limparHistorico,

    // fotos
    avatarDe: (userId) => avatares[userId] || '',
    resolverAvatar,
    esquecerAvatar,

    // assinatura
    assinar: (fn) => { inscritos.add(fn); return () => inscritos.delete(fn); },

    // diagnóstico (harness/depuração — não usar na interface)
    _debug: { db: () => db, precos, vistos, ingerir, avisar },
  };

  avisar('reset');
})();
