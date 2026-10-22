// ============================================================================
// BetterJamble — barra na página (world MAIN)
//
// É só isto: um retângulo de pouca altura, na coluna dos anúncios, com um
// resumo mínimo e o botão "Abrir Painel". Todo o conteúdo mora no painel.
//
// Por que `position:fixed` pendurado no <body> e não dentro do DOM do site:
// a página da live é React e qualquer nó que a gente enfie na árvore dele é
// removido no próximo render. Então medimos a geometria da coluna (o grid) e
// desenhamos por cima, encolhendo só a altura do card de anúncios.
//
// Consequência que NÃO pode regredir: como a barra é filha do <body>, quando o
// usuário sai da live o React desmonta a página dele mas não encosta na barra.
// Por isso os ganchos de pushState/replaceState/popstate tiram a barra na hora,
// e um setInterval de 1500 ms serve de rede de segurança.
// ============================================================================
(() => {
  if (window.__jambleBarraLoaded) return;
  window.__jambleBarraLoaded = true;

  const ALTURA = 46;     // altura da barra em px
  const ESPACO = 14;     // respiro entre o card de anúncios e a barra
  const API = () => window.BetterJamble;

  let barra = null;
  let alturaOriginal = null;
  let medida = null;

  // ---------------------------------------------------------------- estilo
  const CSS = `
  .bj-barra{position:fixed;z-index:40;box-sizing:border-box;display:flex;align-items:center;gap:10px;
    height:${ALTURA}px;padding:0 10px 0 13px;border-radius:14px;
    background:#0d0d0d;border:1px solid #2e2e2e;color:#f2f2f2;
    box-shadow:0 8px 24px rgba(0,0,0,.45);
    font:13px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif}
  .bj-barra .bj-marca{display:flex;align-items:center;gap:7px;font-weight:700;font-size:12.5px;letter-spacing:.01em;
    white-space:nowrap;flex:none}
  .bj-barra .bj-resumo{flex:1;min-width:0;color:#9a9a9a;font-size:11.5px;white-space:nowrap;
    overflow:hidden;text-overflow:ellipsis;font-variant-numeric:tabular-nums}
  .bj-barra .bj-abrir{flex:none;padding:8px 14px;border:0;border-radius:999px;
    background:#f2f2f2;color:#0d0d0d;font:700 12px system-ui,-apple-system,"Segoe UI",sans-serif;
    cursor:pointer;white-space:nowrap;transition:filter .15s,transform .15s}
  .bj-barra .bj-abrir:hover{filter:brightness(.9)}
  .bj-barra .bj-abrir:active{transform:scale(.97)}
  .bj-barra.bj-solta{left:auto!important;top:auto!important;right:24px;bottom:24px;width:300px}
  @media (prefers-reduced-motion:reduce){.bj-barra .bj-abrir{transition:none}}`;

  function garantirEstilo() {
    if (document.getElementById('bj-barra-style')) return;
    const s = document.createElement('style');
    s.id = 'bj-barra-style';
    s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  }

  // ---------------------------------------------------------------- geometria
  // O card de anúncios é o container em coluna que contém as abas
  // "Disponíveis (n)" / "Vendidos (n)".
  function cardDosAnuncios() {
    const b = [...document.querySelectorAll('button')].find((x) => /^Dispon[ií]veis\s*\(/.test(x.textContent.trim()));
    if (!b) return null;
    let n = b.parentElement;
    for (let i = 0; i < 4 && n; i++) {
      const st = getComputedStyle(n);
      if (st.display === 'flex' && st.flexDirection === 'column' && n.getBoundingClientRect().height > 240) return n;
      n = n.parentElement;
    }
    return null;
  }

  // A área da coluna vem do grid (coluna 1 x linha 1): continua estável mesmo
  // depois de encolhermos o card, que é o que mede errado se lermos o card.
  function areaDaColuna(pai) {
    const grid = pai.parentElement;
    if (!grid) return null;
    const g = getComputedStyle(grid);
    const r = grid.getBoundingClientRect();
    if (g.display.indexOf('grid') >= 0) {
      const col = parseFloat((g.gridTemplateColumns || '').split(' ')[0]);
      const row = parseFloat((g.gridTemplateRows || '').split(' ')[0]);
      if (col > 0 && row > 0) {
        const pl = parseFloat(g.paddingLeft) || 0, pt = parseFloat(g.paddingTop) || 0;
        return { top: r.top + pt, left: r.left + pl, width: col, altura: row };
      }
    }
    if (!medida) {
      const rc = pai.getBoundingClientRect();
      medida = { top: rc.top, left: rc.left, width: rc.width, altura: rc.height };
    }
    return medida;
  }

  // Encolhe o card de anúncios só o necessário para a barra caber embaixo dele.
  // Se a geometria não aparecer, a barra vai para o canto inferior direito
  // (solta) em vez de desaparecer.
  function posicionar() {
    if (!barra) return;
    const pai = cardDosAnuncios();
    const m = pai && areaDaColuna(pai);
    if (!m || m.altura < ALTURA + ESPACO + 160) {
      barra.classList.add('bj-solta');
      return;
    }
    barra.classList.remove('bj-solta');
    const alturaPai = Math.round(m.altura - ALTURA - ESPACO);
    if (alturaOriginal === null) alturaOriginal = pai.style.height || '';
    if (pai.style.height !== alturaPai + 'px') pai.style.height = alturaPai + 'px';
    Object.assign(barra.style, {
      left: Math.round(m.left) + 'px',
      top: Math.round(m.top + m.altura - ALTURA) + 'px',
      width: Math.round(m.width) + 'px',
    });
  }

  // ---------------------------------------------------------------- montagem
  function montar() {
    if (barra && document.body && document.body.contains(barra)) { atualizar(); posicionar(); return; }
    if (!document.body) return;
    garantirEstilo();
    barra = document.createElement('div');
    barra.className = 'bj-barra';
    barra.setAttribute('data-bj-barra', '1');
    barra.innerHTML =
      '<span class="bj-marca">💎 BetterJamble</span>' +
      '<span class="bj-resumo" data-bj-resumo></span>' +
      '<button type="button" class="bj-abrir" data-bj-abrir>Abrir Painel</button>';
    barra.querySelector('[data-bj-abrir]').onclick = () => {
      if (window.__jambleTransporte) window.__jambleTransporte.abrirPainel();
      else avisarFalha();
    };
    document.body.appendChild(barra);
    if (orfa) avisarFalha();          // a barra remontou depois da extensão recarregar
    atualizar();
    posicionar();
  }

  function desmontar() {
    const pai = cardDosAnuncios();
    if (pai && alturaOriginal !== null) { pai.style.height = alturaOriginal; alturaOriginal = null; }
    medida = null;
    if (barra) { barra.remove(); barra = null; }
  }

  const nf = (n) => Number(n || 0).toLocaleString('pt-BR');

  // A extensão foi recarregada com esta aba aberta: os scripts daqui ficaram
  // órfãos e não falam mais com ela. Só recarregar a página resolve — e é melhor
  // dizer isso do que deixar o botão não fazer nada.
  let orfa = false;
  function avisarFalha() {
    orfa = true;
    if (!barra) return;
    const alvo = barra.querySelector('[data-bj-resumo]');
    const botao = barra.querySelector('[data-bj-abrir]');
    if (alvo) alvo.textContent = 'a extensão foi recarregada — atualize esta página (F5)';
    if (botao) botao.textContent = 'Atualizar página';
    if (botao) botao.onclick = () => location.reload();
  }
  window.addEventListener('message', (ev) => {
    if (ev.source !== window) return;
    // recebe todas as mensagens da página; as do site podem não ser legíveis (ver bridge.js)
    try {
      const m = ev.data;
      if (m && typeof m === 'object' && m.tag === 'jamble-painel' && m.type === 'painel-falhou') avisarFalha();
    } catch {}
  });

  function atualizar() {
    if (!barra || orfa) return;
    const alvo = barra.querySelector('[data-bj-resumo]');
    const api = API();
    if (!alvo || !api) return;
    // A barra fala SEMPRE da live aberta e do total inteiro: ela não segue nem o
    // escopo nem o filtro de gema que o usuário escolheu lá dentro do painel.
    // `livesDoVendedor()` dá justamente os números crus de cada live.
    const t = (api.livesDoVendedor() || []).find((l) => l.atual);
    alvo.textContent = t && t.envios
      ? `${nf(t.gemas)} gemas · ${nf(t.pessoas)} pessoa(s) · ${nf(t.envios)} envio(s)`
      : 'nenhuma gema ainda nesta live';
  }

  function garantir() {
    const api = API();
    if (!api || !api.estaEmLive()) { desmontar(); return; }
    montar();
  }

  // ---------------------------------------------------------------- ganchos
  window.addEventListener('bj:atualizou', () => { garantir(); atualizar(); });
  window.addEventListener('resize', () => { medida = null; posicionar(); });
  window.addEventListener('scroll', posicionar, true);
  ['pushState', 'replaceState'].forEach((fn) => {
    const orig = history[fn];
    history[fn] = function () { const r = orig.apply(this, arguments); garantir(); setTimeout(garantir, 0); return r; };
  });
  window.addEventListener('popstate', () => { garantir(); setTimeout(garantir, 0); });
  setInterval(() => { garantir(); posicionar(); }, 1500);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', garantir);
  garantir();

  window.__jambleBarra = { montar, desmontar, posicionar, garantir, atualizar, elemento: () => barra };
})();
