// Botão "Exportar compras" na página de pedidos.
// Carrega todos os pedidos, busca os detalhes (transportadora, rastreio, entrega),
// grava no armazenamento da extensão e abre a página de compras.
// Segurança: o único botão do site que este script clica é "Ver mais".
(() => {
  if (window.__jambleExportLoaded) return;
  window.__jambleExportLoaded = true;

  const PAGE = '/account/purchases';
  const cap = { headers: null, list: new Map() };
  let waiters = [];

  // ---------- captura das respostas que o próprio site busca ----------
  const origFetch = window.fetch;
  const toObj = (h) => {
    if (!h) return null;
    if (h instanceof Headers) { const o = {}; h.forEach((v, k) => (o[k] = v)); return o; }
    if (Array.isArray(h)) return Object.fromEntries(h);
    return { ...h };
  };
  const hasAuth = (h) => h && Object.keys(h).some((k) => k.toLowerCase() === 'authorization');

  window.fetch = async function (input, init) {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input && input.url) || '';
    const isPurchases = url.includes('/api/account/purchases');
    if (isPurchases) {
      const h = toObj(init && init.headers) || (input instanceof Request ? toObj(input.headers) : null);
      if (hasAuth(h)) cap.headers = h;
    }
    const res = await origFetch.apply(this, arguments);
    if (isPurchases) {
      res.clone().json().then((j) => {
        (j.purchases || []).forEach((p) => cap.list.set(p.id, p));
        if (j.purchase) cap.list.set(j.purchase.id, j.purchase);
        waiters.splice(0).forEach((f) => f());
      }).catch(() => {});
    }
    return res;
  };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const nextResponse = (ms) => new Promise((r) => {
    const t = setTimeout(() => r(false), ms);
    waiters.push(() => { clearTimeout(t); r(true); });
  });

  // O token do localStorage é sempre o mais novo; o capturado fica como reserva.
  function freshHeaders() {
    try {
      const key = Object.keys(localStorage).find((k) => k.startsWith('firebase:authUser:'));
      const tok = key && JSON.parse(localStorage.getItem(key)).stsTokenManager.accessToken;
      return tok ? { Authorization: 'Bearer ' + tok } : null;
    } catch { return null; }
  }

  // ---------- leitura da página ----------
  const findVerMais = () =>
    [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Ver mais' && !b.disabled);

  // O código do pedido precisa vir do elemento que contém só ele: lendo o texto da linha
  // inteira, o código gruda no texto seguinte (ex.: "JMB-7H9CPBY" + "27 de set") e a API falha.
  function collectIds() {
    const ids = [];
    document.querySelectorAll('tbody tr').forEach((tr) => {
      let code = null;
      for (const el of tr.querySelectorAll('*')) {
        const t = el.textContent.trim();
        if (/^JMB-[A-Z0-9]+$/.test(t)) { code = t; break; }
      }
      if (!code) {
        const m = tr.textContent.match(/JMB-[A-Z0-9]+/);
        if (m) code = m[0];
      }
      if (code && !ids.includes(code)) ids.push(code);
    });
    return ids;
  }

  async function loadAllRows(progress) {
    let stale = 0;
    for (;;) {
      const btn = findVerMais();
      if (!btn) {
        await sleep(1200);
        if (!findVerMais()) break;
        continue;
      }
      const before = collectIds().length;
      btn.scrollIntoView({ block: 'center' });
      const wait = nextResponse(15000);
      btn.click();
      await wait;
      await sleep(400);
      const now = collectIds().length;
      progress(`Carregando lista… ${now}`);
      if (now === before) { if (++stale >= 4) break; } else stale = 0;
    }
    return collectIds();
  }

  async function fetchDetail(id) {
    const opcoes = [freshHeaders(), cap.headers].filter(Boolean);
    if (!opcoes.length) opcoes.push(undefined);
    for (const headers of opcoes) {
      for (let tentativa = 0; tentativa < 2; tentativa++) {
        try {
          const r = await origFetch(`/api/account/purchases/${encodeURIComponent(id)}`, { headers, credentials: 'include' });
          if (r.status === 401 || r.status === 403) break;     // token errado: tenta a próxima opção
          if (r.ok) { const j = await r.json(); if (j.purchase) return j.purchase; }
        } catch {}
        await sleep(300);
      }
    }
    return null;
  }

  async function fetchAllDetails(ids, progress) {
    const out = new Array(ids.length);
    let next = 0, done = 0, failed = 0;
    const worker = async () => {
      while (next < ids.length) {
        const i = next++;
        const d = await fetchDetail(ids[i]);
        if (d) { out[i] = d; cap.list.set(d.id, d); }
        else { out[i] = cap.list.get(ids[i]) || { id: ids[i] }; failed++; }
        progress(`Detalhes ${++done}/${ids.length}`);
      }
    };
    await Promise.all([worker(), worker(), worker(), worker(), worker(), worker()]);
    return { purchases: out, failed };
  }

  // ---------- normalização ----------
  function toRow(p) {
    const si = p.statusInfo || {};
    const etapa = si.step != null && si.maxStep != null ? `Etapa ${si.step} de ${si.maxStep}` : '';
    const partes = [];
    if (p.trackingStatus) partes.push(p.trackingStatus);
    if (etapa) partes.push(etapa);
    if (p.trackingEstimatedDate) partes.push('Previsão ' + new Date(p.trackingEstimatedDate).toLocaleDateString('pt-BR'));
    const end = p.deliveryAddress || {};
    return {
      pedido: p.id || '',
      produto: (p.product && p.product.title) || '',
      imagem: (p.product && p.product.imageUrl) || '',
      loja: (p.seller && (p.seller.displayName || p.seller.username)) || '',
      lojaUser: (p.seller && p.seller.username) || '',
      data: p.createdAt || '',
      itens: Number(p.quantity) || 0,
      preco: Number(p.totalPrice) || 0,
      precoProduto: Number(p.productPrice) || 0,
      frete: Number(p.shippingPrice) || 0,
      taxas: Number(p.buyerFees) || 0,
      situacao: si.status || p.status || '',
      situacaoRaw: p.status || '',
      statusEntrega: partes.join(' · '),
      etapa: si.step != null ? si.step : null,
      etapaMax: si.maxStep != null ? si.maxStep : null,
      transportadora: p.shippingDescription || '',
      rastreio: p.trackingNumber || '',
      linkRastreio: p.trackingUrl || '',
      cidade: end.city || '',
      uf: end.stateCode || '',
    };
  }

  // ---------- interface ----------
  let btn, toast, running = false;
  const style = (el, css) => (Object.assign(el.style, css), el);

  function makeButton() {
    btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'jamble-export-btn';
    btn.textContent = '⬇ Exportar compras';
    style(btn, {
      position: 'fixed', zIndex: 2147483000, padding: '9px 16px', borderRadius: '999px',
      border: '1px solid #3a3a44', background: '#ededf3', color: '#101018', font: '600 14px system-ui, sans-serif',
      cursor: 'pointer', boxShadow: '0 4px 14px rgba(0,0,0,.35)', whiteSpace: 'nowrap', transition: 'filter .15s',
    });
    btn.onmouseenter = () => (btn.style.filter = 'brightness(1.12)');
    btn.onmouseleave = () => (btn.style.filter = '');
    btn.onclick = runExport;
    document.body.appendChild(btn);
  }

  function position() {
    if (!btn) return;
    const search = document.querySelector('input[placeholder*="Buscar"]');
    const r = search && search.getBoundingClientRect();
    if (r && r.width > 0 && r.top >= 0 && r.top < window.innerHeight) {
      style(btn, { top: `${r.top + (r.height - btn.offsetHeight) / 2}px`, left: `${Math.max(8, r.left - btn.offsetWidth - 12)}px`, bottom: '', right: '' });
    } else {
      style(btn, { top: '', left: '', bottom: '24px', right: '96px' });
    }
  }

  function showToast(msg, acoes = []) {
    if (toast) toast.remove();
    toast = style(document.createElement('div'), {
      position: 'fixed', zIndex: 2147483001, right: '24px', bottom: '80px', maxWidth: '360px', padding: '14px 16px',
      borderRadius: '12px', background: '#1d1d24', color: '#f2f2f5', border: '1px solid #34343f',
      font: '14px/1.45 system-ui, sans-serif', boxShadow: '0 8px 30px rgba(0,0,0,.45)',
    });
    const p = document.createElement('div');
    p.textContent = msg;
    toast.appendChild(p);
    const row = style(document.createElement('div'), { display: 'flex', gap: '8px', marginTop: '10px', justifyContent: 'flex-end' });
    [...acoes, ['Fechar', () => toast.remove()]].forEach(([label, fn], i) => {
      const b = style(document.createElement('button'), {
        padding: '6px 12px', borderRadius: '999px', border: '1px solid #44444f', cursor: 'pointer',
        background: i === 0 && acoes.length ? '#ededf3' : 'transparent', color: i === 0 && acoes.length ? '#101018' : '#fff', font: '600 13px system-ui, sans-serif',
      });
      b.textContent = label;
      b.onclick = fn;
      row.appendChild(b);
    });
    toast.appendChild(row);
    document.body.appendChild(toast);
    setTimeout(() => { if (toast) toast.remove(); }, 15000);
  }

  const setLabel = (t) => { if (btn) { btn.textContent = t; position(); } };
  const enviar = (type, payload) => {
    try { window.postMessage({ tag: 'jamble-ext', type, payload }, location.origin); } catch {}
  };

  async function runExport() {
    if (running) return;
    running = true;
    btn.disabled = true;
    btn.style.cursor = 'progress';
    try {
      setLabel('Carregando lista…');
      const ids = await loadAllRows(setLabel);
      if (!ids.length) {
        showToast('Nenhum pedido encontrado na tabela. Espere a página carregar e tente de novo.');
        return;
      }
      const { purchases, failed } = await fetchAllDetails(ids, setLabel);
      setLabel('Abrindo página…');
      enviar('purchases-snapshot', { at: Date.now(), falhas: failed, rows: purchases.map(toRow) });
      enviar('open-page', { page: 'compras.html' });
      const aviso = failed ? ` ${failed} pedido(s) ficaram sem detalhes — recarregue a página e exporte de novo.` : '';
      showToast(`${purchases.length} pedidos exportados.${aviso}`, [['Abrir de novo', () => enviar('open-page', { page: 'compras.html' })]]);
    } catch (e) {
      console.error('[BetterJamble]', e);
      showToast('Erro ao exportar: ' + (e && e.message ? e.message : e));
    } finally {
      running = false;
      btn.disabled = false;
      btn.style.cursor = 'pointer';
      setLabel('⬇ Exportar compras');
    }
  }

  function tick() {
    const onPage = location.pathname.startsWith(PAGE);
    if (onPage && document.body && !document.getElementById('jamble-export-btn')) makeButton();
    if (!onPage && btn && !running) { btn.remove(); btn = null; }
    position();
  }

  setInterval(tick, 700);
  // Mesma história do card das gemas: o botão é fixo e fica no <body>, então sai na hora em que a
  // navegação acontece, sem esperar o próximo giro do intervalo acima.
  ['pushState', 'replaceState'].forEach((fn) => {
    const orig = history[fn];
    history[fn] = function () { const r = orig.apply(this, arguments); tick(); setTimeout(tick, 0); return r; };
  });
  window.addEventListener('popstate', () => { tick(); setTimeout(tick, 0); });
  window.addEventListener('resize', position);
  window.addEventListener('scroll', position, true);
})();
