// Badge com a soma do que já foi vendido na live, ao lado da aba "Vendidos (n)".
// Estratégia: os ids vêm das respostas que o site já busca (feed/produtos), o total é
// recalculado quando a contagem da aba muda, e cada live fica em cache. A cada minuto o
// botão de atualizar do card "Anúncios" é clicado, para a contagem não ficar parada; se a
// janela é estreita e o card nem aparece, as vendas são buscadas direto a cada 30 s.
(() => {
  // relógios que também andam com o tique do painel (ritmo.js): a aba da live
  // escondida não trava o que é periódico
  const relogio = window.__bjRitmo || window;
  if (window.__jambleLiveTotalLoaded) return;
  window.__jambleLiveTotalLoaded = true;

  const sellers = new Map();            // showId -> sellerId
  const cache = new Map();              // showId -> resumo
  let authHeaders = null;
  const inflight = new Map();          // showId -> Promise
  const current = { showId: null, lastCount: null };
  let vendidosChegaramEm = 0;          // última resposta da aba "Vendidos" que o próprio site buscou

  // ---------- cache entre trocas de live ----------
  const SKEY = 'jamble:live-totals:v1';
  try {
    const saved = JSON.parse(sessionStorage.getItem(SKEY) || '{}');
    Object.entries(saved).forEach(([k, v]) => cache.set(k, v));
  } catch {}
  const persist = () => {
    try {
      const obj = {};
      [...cache.entries()].slice(-60).forEach(([k, v]) => (obj[k] = v));
      sessionStorage.setItem(SKEY, JSON.stringify(obj));
    } catch {}
  };

  // ---------- aprende com as chamadas que o site já faz (sem gerar chamada extra) ----------
  const origFetch = window.fetch;
  const toObj = (h) => {
    if (!h) return null;
    if (h instanceof Headers) { const o = {}; h.forEach((v, k) => (o[k] = v)); return o; }
    if (Array.isArray(h)) return Object.fromEntries(h);
    return { ...h };
  };

  window.fetch = async function (input, init) {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input && input.url) || '';
    const isLive = url.includes('/api/live/');
    let section = null, reqShow = null, comCursor = false;
    if (isLive) {
      try {
        const q = new URLSearchParams(url.split('?')[1] || '');
        section = q.get('section');
        reqShow = q.get('show_id');
        comCursor = !!(q.get('after') || q.get('cursor'));
        if (reqShow && q.get('seller_id')) sellers.set(reqShow, q.get('seller_id'));
      } catch {}
      const h = toObj(init && init.headers) || (input instanceof Request ? toObj(input.headers) : null);
      if (h && Object.keys(h).some((k) => k.toLowerCase() === 'authorization')) authHeaders = h;
    }
    const res = await origFetch.apply(this, arguments);
    if (isLive && /\/api\/live\/(feed|products)/.test(url)) {
      res.clone().json().then((j) => {
        // O feed traz sellerId de todas as lives do carrossel: ids prontos antes mesmo de trocar.
        if (Array.isArray(j.shows)) {
          j.shows.forEach((s) => s && s.id && s.sellerId && sellers.set(s.id, s.sellerId));
          schedule(0);
        }
        // Se o próprio site buscou a aba "Vendidos", aproveitamos a resposta: zero chamada extra.
        // Só quando ela é a lista inteira: primeira página (sem cursor) e sem próxima. A última
        // página de uma lista paginada também vem sem próxima, mas traz só o resto das vendas;
        // aceitá-la gravava um total menor (o site faz isso com a aba em segundo plano).
        if (section === 'sold' && !comCursor && Array.isArray(j.items) && !j.hasNextPage) {
          vendidosChegaramEm = Date.now();
          const sum = summarize(j.items);
          store(reqShow, sum);
          if (reqShow) compradoresDaLive(reqShow, j.items);
        }
      }).catch(() => {});
    }
    return res;
  };

  function fallbackHeaders() {
    try {
      const key = Object.keys(localStorage).find((k) => k.startsWith('firebase:authUser:'));
      const tok = key && JSON.parse(localStorage.getItem(key)).stsTokenManager.accessToken;
      return tok ? { Authorization: 'Bearer ' + tok } : null;
    } catch { return null; }
  }

  // ---------- identificação da live atual ----------
  const showIdFromUrl = () => {
    const m = location.pathname.match(/^\/live\/[^/]+\/([^/?#]+)/);
    return m ? m[1] : null;
  };

  function sellerFor(showId) {
    if (sellers.has(showId)) return sellers.get(showId);
    // Último recurso: as fotos dos produtos da live carregam sob o id do vendedor.
    const img = document.querySelector('img[src*="/products/user_id="]');
    const m = img && img.src.match(/products\/user_id=([^/]+)/);
    if (m) { sellers.set(showId, m[1]); return m[1]; }
    return null;
  }

  // ---------- dados ----------
  async function getJSON(url) {
    for (const headers of [authHeaders, fallbackHeaders(), null]) {
      try {
        const r = await origFetch(url, { headers: headers || undefined, credentials: 'include' });
        if (r.ok) return await r.json();
      } catch {}
    }
    return null;
  }

  async function fetchSold(showId, sellerId) {
    const items = [];
    let after = null;
    for (let page = 0; page < 40; page++) {
      const q = new URLSearchParams({ seller_id: sellerId, show_id: showId, section: 'sold' });
      if (after) q.set('after', after);
      const j = await getJSON('/api/live/products?' + q.toString());
      if (!j || !Array.isArray(j.items)) return items.length ? items : null;
      items.push(...j.items);
      if (!j.hasNextPage || !j.nextCursor || j.nextCursor === after) break;
      after = j.nextCursor;
    }
    return items;
  }

  // Itens de uma linha de vendidos. No leilão é sempre 1; no preço fixo
  // (saleType BUY_IT_NOW) uma compra de várias unidades vem numa linha só, com
  // soldCount = quantidade, soldPrice = preço da unidade e totalSoldPrice = total.
  const itensDaLinha = (it) => Math.max(1, Number(it && it.soldCount) || 1);
  const ehFixo = (it) => !!it && it.saleType === 'BUY_IT_NOW';

  // Ranking de compradores desta live, para o card do BetterJamble desenhar.
  // Nada é gravado no armazenamento: vale só enquanto a aba está aberta.
  // n = itens comprados (5 no preço fixo + 1 no leilão = 6), p = compras.
  function compradoresDaLive(showId, items) {
    try {
      const porComprador = new Map();
      const tipos = { leilao: { valor: 0, vendas: 0 }, fixo: { valor: 0, compras: 0, itens: 0 } };
      for (const it of items) {
        const v = it && it.sold;
        if (!v || v.isCanceled || !v.buyerId) continue;
        const c = porComprador.get(v.buyerId) || { id: v.buyerId, u: v.buyerUsername || v.buyerId, a: v.buyerAvatarUrl || '', n: 0, p: 0, v: 0 };
        const valor = Number(v.totalSoldPrice != null ? v.totalSoldPrice : v.soldPrice) || 0;
        const itens = itensDaLinha(it);
        c.n += itens;
        c.p++;
        c.v += valor;
        porComprador.set(v.buyerId, c);
        if (ehFixo(it)) { tipos.fixo.valor += valor; tipos.fixo.compras++; tipos.fixo.itens += itens; }
        else { tipos.leilao.valor += valor; tipos.leilao.vendas++; }
      }
      window.__jambleCompradores = {
        showId,
        at: Date.now(),
        tipos,
        lista: [...porComprador.values()].sort((a, b) => b.v - a.v),
      };
      window.dispatchEvent(new CustomEvent('jamble:compradores'));
    } catch {}
  }

  function summarize(items) {
    const s = { total: 0, vendas: 0, pago: 0, pagas: 0, canceladas: 0, count: items.length, at: Date.now() };
    for (const it of items) {
      const v = it && it.sold;
      if (!v) continue;
      if (v.isCanceled) { s.canceladas++; continue; }
      const price = Number(v.totalSoldPrice != null ? v.totalSoldPrice : v.soldPrice) || 0;
      s.total += price;
      s.vendas++;
      s.itens = (s.itens || 0) + itensDaLinha(it);
      if (v.isPaid) { s.pago += price; s.pagas++; }
    }
    return s;
  }

  function store(showId, sum) {
    if (!showId || !sum) return;
    cache.set(showId, sum);
    persist();
    if (showId === showIdFromUrl()) paint(sum);
  }

  // ---------- badge ----------
  const brl = (n) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const soldButton = () =>
    [...document.querySelectorAll('button')].find((b) => /^Vendidos\s*\(/.test(b.textContent.trim()));
  const countOf = (btn) => {
    const m = btn && btn.textContent.match(/Vendidos\s*\((\d+)\)/);
    return m ? +m[1] : null;
  };

  function paint(sum, pending) {
    const btn = soldButton();
    if (!btn) return false;
    let badge = btn.querySelector('.jamble-total-badge');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'jamble-total-badge';
      Object.assign(badge.style, {
        marginLeft: '6px', padding: '1px 8px', borderRadius: '999px', color: '#fff',
        font: '600 12px system-ui, sans-serif', whiteSpace: 'nowrap', verticalAlign: 'middle',
        display: 'inline-block', background: '#44444f',
      });
      btn.appendChild(badge);
    }
    if (!sum) {
      if (badge.textContent !== '…') badge.textContent = '…';
      badge.style.background = '#44444f';
      badge.style.opacity = '1';
      badge.title = 'Somando as vendas…';
      return true;
    }
    const txt = brl(sum.total);
    if (badge.textContent !== txt) badge.textContent = txt;
    badge.style.background = sum.total > 0 ? '#1f7a4d' : '#44444f';
    badge.style.opacity = pending ? '.65' : '1';
    badge.title = `${sum.vendas} venda(s)` + (sum.itens && sum.itens !== sum.vendas ? ` · ${sum.itens} itens` : '') + ` · ${brl(sum.pago)} já pago (${sum.pagas})` +
      (sum.canceladas ? ` · ${sum.canceladas} cancelada(s) fora da soma` : '');
    return true;
  }

  // ---------- orquestração ----------
  let timer = null;
  const schedule = (ms) => {
    relogio.clearTimeout(timer);
    if (!ms) { Promise.resolve().then(run); return; }
    timer = relogio.setTimeout(run, ms);
  };

  // Busca (ou reaproveita) o resumo de uma live. Nunca dispara duas buscas para a mesma live.
  function ensureData(showId, force) {
    if (!showId) return Promise.resolve(null);
    if (!force && cache.has(showId)) return Promise.resolve(cache.get(showId));
    if (inflight.has(showId)) return inflight.get(showId);
    const sellerId = sellerFor(showId);
    if (!sellerId) return Promise.resolve(null);
    const job = fetchSold(showId, sellerId)
      .then((items) => {
        const sum = items ? summarize(items) : null;
        if (sum) { store(showId, sum); compradoresDaLive(showId, items); }
        return sum;
      })
      .catch(() => null)
      .finally(() => inflight.delete(showId));
    inflight.set(showId, job);
    return job;
  }

  // Deixa pronta a live de cima e a de baixo do carrossel: trocar fica instantâneo.
  function prefetchNeighbors() {
    document.querySelectorAll('a[aria-label="Próxima live"], a[aria-label="Live anterior"]').forEach((a) => {
      const m = (a.getAttribute('href') || '').match(/^\/live\/[^/]+\/([^/?#]+)/);
      if (m && !cache.has(m[1]) && !inflight.has(m[1])) ensureData(m[1]);
    });
  }

  async function run() {
    const showId = showIdFromUrl();
    if (!showId) return;
    const btn = soldButton();
    const count = countOf(btn);
    const cached = cache.get(showId);

    if (btn) paint(cached || null, cached && count != null && count !== cached.count);
    else schedule(150);                                   // painel ainda montando: só o desenho espera

    const stale = !cached || (count != null && count !== cached.count);
    if (stale) {
      const sum = await ensureData(showId, !!cached);
      if (!sum && !sellerFor(showId)) { schedule(200); return; }  // ids ainda não chegaram
    }
    current.lastCount = countOf(soldButton());
    relogio.setTimeout(prefetchNeighbors, 1200);
  }

  // O resumo pode vir do cache sem buscar nada; mesmo assim precisamos da lista de
  // compradores desta live para o card do BetterJamble.
  let buscandoCompradores = false;
  async function garantirCompradores() {
    const showId = showIdFromUrl();
    if (!showId || buscandoCompradores) return;
    const atual = window.__jambleCompradores;
    if (atual && atual.showId === showId) return;
    const sellerId = sellerFor(showId);
    if (!sellerId) return;
    buscandoCompradores = true;
    try {
      const items = await fetchSold(showId, sellerId);
      if (items) compradoresDaLive(showId, items);
    } catch {} finally { buscandoCompradores = false; }
  }

  // Recalcula quando a aba "Vendidos (n)" muda de número (venda nova ou cancelamento)
  // e repõe o badge se o React redesenhar o botão.
  const observer = new MutationObserver(() => {
    const btn = soldButton();
    if (!btn) return;
    const count = countOf(btn);
    const cached = cache.get(showIdFromUrl());
    paint(cached || null, !!cached && count != null && count !== cached.count);
    if (count !== current.lastCount) { current.lastCount = count; schedule(0); }
  });
  observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true });

  // Troca de live sem recarregar a página: reage na hora.
  const onNav = () => {
    const showId = showIdFromUrl();
    if (showId === current.showId) return;
    current.showId = showId;
    current.lastCount = null;
    schedule(0);
  };
  ['pushState', 'replaceState'].forEach((fn) => {
    const orig = history[fn];
    history[fn] = function () { const r = orig.apply(this, arguments); onNav(); return r; };
  });
  window.addEventListener('popstate', onNav);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) schedule(0); });

  // Sincronização: às vezes o site não atualiza a lista de anúncios sozinho e a
  // contagem de "Vendidos (n)" fica parada. A cada minuto clicamos no botão de
  // atualizar do card "Anúncios" (o mesmo que a pessoa clicaria); se a aba
  // Vendidos estiver aberta, a resposta dele já chega pelo fetch acima. Se não
  // chegar, buscamos as vendas uma vez nós mesmos.
  function botaoAtualizarAnuncios() {
    const vendidos = soldButton();
    let card = vendidos && vendidos.parentElement;
    for (let i = 0; card && i < 10; i++, card = card.parentElement) {
      const titulo = [...card.querySelectorAll('h1,h2,h3,h4,p,span,div')]
        .find((e) => e.childElementCount === 0 && e.textContent.trim() === 'Anúncios');
      if (!titulo) continue;
      // o botão de atualizar fica na linha do título: um botão só com ícone
      let linha = titulo.parentElement;
      for (let j = 0; linha && j < 3; j++, linha = linha.parentElement) {
        const b = [...linha.querySelectorAll('button')].find((x) => x.querySelector('svg') && !x.textContent.trim());
        if (b) return { botao: b, card };
      }
      return null;
    }
    return null;
  }
  // Em janela estreita (tela dividida) a Jamble nem desenha o card de anúncios:
  // sem a aba "Vendidos" não há contagem para comparar nem botão para clicar,
  // e as vendas ficavam paradas. Aí buscamos as vendas direto, a cada 30 s.
  let rodadaSync = 0;
  function sincronizarAnuncios() {
    const showId = showIdFromUrl();
    if (!showId) return;
    rodadaSync++;
    const achado = botaoAtualizarAnuncios();
    if (!achado) {
      if (!soldButton()) ensureData(showId, true);
      return;
    }
    if (rodadaSync % 2) return;              // com o card à vista, o clique vai a cada minuto
    // não atrapalha quem está digitando na busca do card
    if (achado.card.contains(document.activeElement) && /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)) return;
    const antes = Date.now();
    achado.botao.click();
    relogio.setTimeout(() => {
      if (vendidosChegaramEm < antes && showIdFromUrl() === showId) ensureData(showId, true);
    }, 4000);
  }

  relogio.setInterval(() => { if (!document.hidden) schedule(0); }, 20000);
  relogio.setInterval(sincronizarAnuncios, 30000);
  relogio.setInterval(garantirCompradores, 3000);
  garantirCompradores();
  window.__jambleLiveDebug = { sincronizarAnuncios, botaoAtualizarAnuncios, cache, sellers, inflight, run, ensureData, paint, showIdFromUrl, sellerFor, soldButton, countOf, current };
  onNav();
  schedule(0);
})();
