// Página de compras: mostra os pedidos exportados na página de pedidos da Jamble.
(() => {
  const app = document.getElementById('app');
  const sub = document.getElementById('sub');
  const nf = (n) => n.toLocaleString('pt-BR');
  const brl = (n) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const dt = (s) => (s ? new Date(s).toLocaleDateString('pt-BR') : '');
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let ROWS = [];
  let quando = 0, falhas = 0;
  const st = { q: '', sit: '', transp: '', loja: '', ordem: 'data', dir: -1 };

  const COLS = [
    ['loja', 'Loja'], ['preco', 'Preço', 1], ['situacao', 'Situação'], ['transportadora', 'Transportadora'],
    ['statusEntrega', 'Status da entrega'], ['rastreio', 'Rastreio'], ['pedido', 'Pedido'],
    ['produto', 'Produto'], ['data', 'Data'], ['itens', 'Itens', 1],
  ];

  function carregar() {
    chrome.storage.local.get({ purchases: null }, ({ purchases }) => {
      ROWS = (purchases && purchases.rows) || [];
      quando = (purchases && purchases.at) || 0;
      falhas = (purchases && purchases.falhas) || 0;
      render();
    });
  }

  const pill = (s) => {
    const t = (s || '').toLowerCase();
    const c = /cancel|reembols/.test(t) ? 'p-vermelho' : /entregue|recebid|conclu/.test(t) ? 'p-verde'
      : /entrega|enviad|trânsito/.test(t) ? 'p-roxo' : /confirm|aguard|pendente/.test(t) ? 'p-ambar' : 'p-cinza';
    return `<span class="pill ${c}">${esc(s || '—')}</span>`;
  };

  function filtrar() {
    const q = st.q.toLowerCase();
    let r = ROWS.filter((x) =>
      (!st.sit || (x.situacao || '—') === st.sit) &&
      (!st.transp || (x.transportadora || '—') === st.transp) &&
      (!st.loja || (x.loja || '—') === st.loja) &&
      (!q || [x.loja, x.produto, x.pedido, x.rastreio, x.transportadora].join(' ').toLowerCase().includes(q)));
    const k = st.ordem;
    return r.sort((a, b) => {
      const va = a[k], vb = b[k];
      const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'pt-BR');
      return cmp * st.dir;
    });
  }

  function render() {
    app.textContent = '';
    if (!ROWS.length) {
      sub.textContent = 'nada exportado ainda';
      app.innerHTML = `<div class="empty">Nenhuma compra exportada ainda.<br>
        Abra <b>jamble.com/account/purchases</b> e clique em <b>↓ Exportar compras</b>.<br>
        Os pedidos aparecem aqui automaticamente.</div>`;
      return;
    }
    sub.textContent = `${nf(ROWS.length)} pedidos · exportado em ${new Date(quando).toLocaleString('pt-BR')}`
      + (falhas ? ` · ${falhas} sem detalhes` : '');

    const dados = filtrar();
    const total = dados.reduce((a, r) => a + r.preco, 0);
    const pacotes = new Set(dados.map((r) => r.rastreio).filter(Boolean)).size;
    const semRastreio = dados.filter((r) => !r.rastreio).length;
    const emEntrega = dados.filter((r) => /entrega/i.test(r.situacao)).length;

    const cards = document.createElement('div');
    cards.className = 'cards';
    [['pedidos', nf(dados.length)], ['valor somado', brl(total)], ['em entrega', nf(emEntrega)],
     ['pacotes', nf(pacotes)], ['sem rastreio', nf(semRastreio)], ['lojas', nf(new Set(dados.map((r) => r.loja)).size)]]
      .forEach(([k, v]) => {
        const c = document.createElement('div');
        c.className = 'card';
        c.innerHTML = `<span>${k}</span><b>${v}</b>`;
        cards.appendChild(c);
      });
    app.appendChild(cards);
    app.appendChild(filtros());
    app.appendChild(tabela(dados));

    const rodape = document.createElement('div');
    rodape.className = 'rodape';
    rodape.textContent = `${nf(dados.length)} de ${nf(ROWS.length)} pedidos · ${brl(total)}`;
    app.appendChild(rodape);
  }

  function filtros() {
    const box = document.createElement('div');
    box.className = 'filtros';
    const busca = document.createElement('input');
    busca.type = 'search';
    busca.placeholder = 'Buscar loja, produto, pedido ou rastreio…';
    busca.value = st.q;
    busca.oninput = () => { st.q = busca.value; render(); setTimeout(() => { const i = app.querySelector('input'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 0); };
    box.appendChild(busca);

    const sel = (campo, rotulo, chave) => {
      const s = document.createElement('select');
      const vals = [...new Set(ROWS.map((r) => r[campo] || '—'))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
      s.innerHTML = `<option value="">${rotulo}</option>` + vals.map((v) => `<option${st[chave] === v ? ' selected' : ''}>${esc(v)}</option>`).join('');
      s.onchange = () => { st[chave] = s.value; render(); };
      box.appendChild(s);
    };
    sel('situacao', 'Todas as situações', 'sit');
    sel('transportadora', 'Todas as transportadoras', 'transp');
    sel('loja', 'Todas as lojas', 'loja');
    return box;
  }

  function tabela(dados) {
    const box = document.createElement('div');
    box.className = 'tabela';
    const t = document.createElement('table');
    t.innerHTML = `<thead><tr>${COLS.map(([k, rot, num]) =>
      `<th data-k="${k}" class="${num ? 'num' : ''}">${rot}${st.ordem === k ? (st.dir > 0 ? ' ▲' : ' ▼') : ''}</th>`).join('')}</tr></thead>
      <tbody>${dados.map((r) => `<tr>
        <td>${esc(r.loja)}</td>
        <td class="num">${brl(r.preco)}</td>
        <td>${pill(r.situacao)}</td>
        <td>${esc(r.transportadora || '—')}</td>
        <td class="muted">${esc(r.statusEntrega || '—')}</td>
        <td>${r.rastreio
          ? `<code title="Clique para copiar">${esc(r.rastreio)}</code>${r.linkRastreio ? ` <a href="${esc(r.linkRastreio)}" target="_blank" rel="noopener">rastrear ↗</a>` : ''}`
          : '<span class="muted">sem rastreio</span>'}</td>
        <td><code>${esc(r.pedido)}</code></td>
        <td><div class="prod">${r.imagem ? `<img class="thumb" src="${esc(r.imagem)}" alt="" loading="lazy">` : ''}<span>${esc(r.produto)}</span></div></td>
        <td>${dt(r.data)}</td>
        <td class="num">${nf(r.itens)}</td>
      </tr>`).join('')}</tbody>`;
    t.querySelector('thead').onclick = (e) => {
      const th = e.target.closest('th');
      if (!th) return;
      const k = th.dataset.k;
      st.dir = st.ordem === k ? -st.dir : 1;
      st.ordem = k;
      render();
    };
    t.querySelector('tbody').onclick = (e) => {
      const c = e.target.closest('code');
      if (!c || !navigator.clipboard) return;
      navigator.clipboard.writeText(c.textContent).then(() => {
        c.classList.add('ok');
        setTimeout(() => c.classList.remove('ok'), 900);
      });
    };
    box.appendChild(t);
    return box;
  }

  document.getElementById('csv').onclick = () => {
    const cell = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
    const head = ['Loja', 'Preço', 'Situação', 'Transportadora', 'Status da entrega', 'Código de rastreio',
      'Link do rastreio', 'Pedido', 'Produto', 'Data', 'Itens', 'Produto (R$)', 'Frete (R$)', 'Taxas (R$)', 'Cidade', 'UF'];
    const linhas = filtrar().map((r) => [r.loja, r.preco.toFixed(2).replace('.', ','), r.situacao, r.transportadora,
      r.statusEntrega, r.rastreio, r.linkRastreio, r.pedido, r.produto, dt(r.data), r.itens,
      r.precoProduto.toFixed(2).replace('.', ','), r.frete.toFixed(2).replace('.', ','), r.taxas.toFixed(2).replace('.', ','),
      r.cidade, r.uf].map(cell).join(';'));
    const blob = new Blob(['﻿' + [head.map(cell).join(';'), ...linhas].join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `compras-jamble-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  document.getElementById('print').onclick = () => window.print();
  document.getElementById('atualizar').onclick = () => chrome.tabs.create({ url: 'https://www.jamble.com/account/purchases' });

  if (chrome.storage.onChanged) chrome.storage.onChanged.addListener((ch) => { if (ch.purchases) carregar(); });
  carregar();
})();
