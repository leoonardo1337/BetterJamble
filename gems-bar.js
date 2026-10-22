// ============================================================================
// BetterJamble — botão na página (world MAIN)
//
// É só isto: um botão redondo dourado com o "BJ" do ícone, do tamanho do botão
// de recompensa (o diamante) e logo à direita dele, à esquerda do campo de
// comentário. Ele abre
// o painel; o resumo da live aparece na dica (title). Todo o conteúdo mora no
// painel.
//
// Por que `position:fixed` pendurado no <body> e não dentro do DOM do site:
// a página da live é React e qualquer nó que a gente enfie na árvore dele é
// removido no próximo render. Então medimos onde está o diamante e desenhamos
// por cima, empurrando o campo de comentário para a direita com margin-left.
//
// Consequência que NÃO pode regredir: como o botão é filho do <body>, quando o
// usuário sai da live o React desmonta a página dele mas não encosta no botão.
// Por isso os ganchos de pushState/replaceState/popstate tiram o botão na hora,
// e um setInterval de 1500 ms serve de rede de segurança.
// ============================================================================
(() => {
  if (window.__jambleBarraLoaded) return;
  window.__jambleBarraLoaded = true;

  const TAMANHO = 40;    // diâmetro quando o diamante não dá a medida
  const API = () => window.BetterJamble;
  // mesmos rótulos que o resgate.js usa para achar o botão do diamante
  const ROTULOS_DIAMANTE = ['Recompensa por assistir', 'Watch reward'];
  // icons/bj-letras.png (só as letras do ícone, fundo transparente) embutido:
  // imagem da pasta icons/ dentro da página exigiria web_accessible_resources
  // (ver docs/HANDOFF.md). Se o ícone mudar, gere de novo com
  // `base64 -w0 icons/bj-letras.png`.
  const ICONE = 'data:image/png;base64,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';

  let botao = null;
  let campo = null;           // o bloco do campo de comentário que empurramos
  let margemOriginal = null;
  let folga = null;           // espaço que o site já deixa entre diamante e campo

  // ---------------------------------------------------------------- estilo
  const CSS = `
  .bj-botao{position:fixed;z-index:40;box-sizing:border-box;display:grid;place-items:center;
    width:${TAMANHO}px;height:${TAMANHO}px;padding:0;border:0;border-radius:50%;
    background:linear-gradient(180deg,#cf8a03,#e3a80f);cursor:pointer;transition:filter .15s,transform .15s}
  .bj-botao:hover{filter:brightness(1.15)}
  .bj-botao:active{transform:scale(.94)}
  .bj-botao img{width:84%;height:auto;pointer-events:none;display:block}
  .bj-botao.bj-solta{left:auto!important;top:auto!important;right:24px;bottom:24px;
    width:44px!important;height:44px!important;box-shadow:0 8px 24px rgba(0,0,0,.45)}
  .bj-botao.bj-orfa::after{content:'↻';position:absolute;right:-3px;top:-3px;width:16px;height:16px;
    border-radius:50%;background:#f2f2f2;color:#0d0d0d;font:700 11px/16px system-ui,-apple-system,"Segoe UI",sans-serif;
    text-align:center}
  @media (prefers-reduced-motion:reduce){.bj-botao{transition:none}}`;

  function garantirEstilo() {
    if (document.getElementById('bj-barra-style')) return;
    const s = document.createElement('style');
    s.id = 'bj-barra-style';
    s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  }

  // ---------------------------------------------------------------- geometria
  function diamante() {
    for (const r of ROTULOS_DIAMANTE) {
      const b = document.querySelector(`button[aria-label="${r}"]`);
      if (b) return b;
    }
    return null;
  }

  const temFundo = (st) =>
    (st.backgroundImage && st.backgroundImage !== 'none') ||
    !/^(transparent|rgba\(\s*0,\s*0,\s*0,\s*0\s*\))$/.test(st.backgroundColor);

  // O círculo pintado pode ser o próprio botão, um filho dele ou o pai; vale o
  // primeiro que tiver fundo. É dele que copiamos a medida.
  function circuloDo(d) {
    const candidatos = [d, ...d.querySelectorAll(':scope > *, :scope > * > *'), d.parentElement];
    for (const c of candidatos) {
      if (!c) continue;
      const st = getComputedStyle(c);
      const r = c.getBoundingClientRect();
      if (temFundo(st) && r.width >= 24 && r.width <= 80) return { el: c, st, r };
    }
    return { el: d, st: getComputedStyle(d), r: d.getBoundingClientRect() };
  }

  // Sobe do diamante até o ancestral cujo irmão contém o campo de comentário.
  function blocos(d) {
    let n = d;
    for (let i = 0; i < 6 && n && n.parentElement; i++) {
      const irmao = [...n.parentElement.children].find((x) => x !== n && x.querySelector('input, textarea, [contenteditable="true"]'));
      if (irmao) return { lado: n, campo: irmao };
      n = n.parentElement;
    }
    return null;
  }

  function devolverCampo() {
    if (campo && margemOriginal !== null) campo.style.marginLeft = margemOriginal;
    campo = null;
    margemOriginal = null;
    folga = null;
  }

  // Põe o botão logo à direita do diamante, do mesmo tamanho, e empurra o campo de comentário o bastante para ele caber. Se o
  // diamante não aparecer, o botão vai para o canto inferior direito (solto)
  // em vez de desaparecer.
  function posicionar() {
    if (!botao) return;
    const d = diamante();
    const b = d && blocos(d);
    if (!b) {
      devolverCampo();
      botao.classList.add('bj-solta');
      return;
    }
    botao.classList.remove('bj-solta');
    const c = circuloDo(d);
    const tam = Math.round(c.r.width) || TAMANHO;
    botao.style.width = botao.style.height = tam + 'px';

    if (campo !== b.campo) {
      devolverCampo();
      campo = b.campo;
      margemOriginal = campo.style.marginLeft || '';
      folga = Math.max(6, Math.round(campo.getBoundingClientRect().left - b.lado.getBoundingClientRect().right));
    }
    const margem = tam + folga + 'px';
    if (campo.style.marginLeft !== margem) campo.style.marginLeft = margem;

    const lado = b.lado.getBoundingClientRect();
    Object.assign(botao.style, {
      left: Math.round(lado.right + folga) + 'px',
      top: Math.round(c.r.top + (c.r.height - tam) / 2) + 'px',
    });
  }

  // ---------------------------------------------------------------- montagem
  function montar() {
    if (botao && document.body && document.body.contains(botao)) { atualizar(); posicionar(); return; }
    if (!document.body) return;
    garantirEstilo();
    botao = document.createElement('button');
    botao.type = 'button';
    botao.className = 'bj-botao';
    botao.setAttribute('data-bj-barra', '1');
    botao.setAttribute('aria-label', 'Abrir painel do BetterJamble');
    const img = document.createElement('img');
    img.src = ICONE;
    img.alt = '';
    botao.appendChild(img);
    botao.onclick = () => {
      if (orfa) location.reload();
      else if (window.__jambleTransporte) window.__jambleTransporte.abrirPainel();
      else avisarFalha();
    };
    document.body.appendChild(botao);
    if (orfa) avisarFalha();          // o botão remontou depois da extensão recarregar
    atualizar();
    posicionar();
  }

  function desmontar() {
    devolverCampo();
    if (botao) { botao.remove(); botao = null; }
  }

  const nf = (n) => Number(n || 0).toLocaleString('pt-BR');

  // A extensão foi recarregada com esta aba aberta: os scripts daqui ficaram
  // órfãos e não falam mais com ela. Só recarregar a página resolve — o botão
  // ganha um ↻ e passa a recarregar a página em vez de não fazer nada.
  let orfa = false;
  function avisarFalha() {
    orfa = true;
    if (!botao) return;
    botao.classList.add('bj-orfa');
    botao.title = 'A extensão foi recarregada. Clique para atualizar esta página (F5).';
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
    if (!botao || orfa) return;
    const api = API();
    if (!api) return;
    // A dica fala SEMPRE da live aberta e do total inteiro: ela não segue nem o
    // escopo nem o filtro de gema que o usuário escolheu lá dentro do painel.
    // `livesDoVendedor()` dá justamente os números crus de cada live.
    const t = (api.livesDoVendedor() || []).find((l) => l.atual);
    botao.title = 'BetterJamble · ' + (t && t.envios
      ? `${nf(t.gemas)} gemas · ${nf(t.pessoas)} pessoa(s) · ${nf(t.envios)} envio(s)`
      : 'nenhuma gema ainda nesta live') + '\nClique para abrir o painel';
  }

  function garantir() {
    const api = API();
    if (!api || !api.estaEmLive()) { desmontar(); return; }
    montar();
  }

  // ---------------------------------------------------------------- ganchos
  window.addEventListener('bj:atualizou', () => { garantir(); atualizar(); });
  window.addEventListener('resize', () => { folga = null; devolverCampo(); posicionar(); });
  window.addEventListener('scroll', posicionar, true);
  ['pushState', 'replaceState'].forEach((fn) => {
    const orig = history[fn];
    history[fn] = function () { const r = orig.apply(this, arguments); garantir(); setTimeout(garantir, 0); return r; };
  });
  window.addEventListener('popstate', () => { garantir(); setTimeout(garantir, 0); });
  setInterval(() => { garantir(); posicionar(); }, 1500);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', garantir);
  garantir();

  window.__jambleBarra = { montar, desmontar, posicionar, garantir, atualizar, elemento: () => botao };
})();
