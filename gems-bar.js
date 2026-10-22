// ============================================================================
// BetterJamble — botão na página (world MAIN)
//
// É só isto: o ícone da extensão, sem fundo, da altura do círculo do botão de
// recompensa (o diamante) e logo à direita dele, à esquerda do campo de
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
  // icons/128.png reduzido para 96 px e embutido: imagem da pasta icons/ dentro
  // da página exigiria web_accessible_resources (ver docs/HANDOFF.md). Se o
  // ícone mudar, gere de novo a partir dele.
  const ICONE = 'data:image/png;base64,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';

  let botao = null;
  let campo = null;           // o bloco do campo de comentário que empurramos
  let margemOriginal = null;
  let folga = null;           // espaço que o site já deixa entre diamante e campo

  // ---------------------------------------------------------------- estilo
  const CSS = `
  .bj-botao{position:fixed;z-index:40;box-sizing:border-box;display:grid;place-items:center;
    width:${TAMANHO}px;height:${TAMANHO}px;padding:0;border:0;border-radius:22%;
    background:transparent;cursor:pointer;transition:filter .15s,transform .15s}
  .bj-botao:hover{filter:brightness(1.15)}
  .bj-botao:active{transform:scale(.94)}
  .bj-botao img{width:100%;height:100%;border-radius:22%;pointer-events:none;display:block}
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

  // O círculo pintado pode ser o próprio botão, um filho/neto dele ou o pai.
  // Vale o maior elemento quadrado (é o círculo) que tenha fundo ou cantos
  // arredondados; o timer pendurado embaixo deixa os outros mais altos que
  // largos. É dele que copiamos a medida e a altura.
  function circuloDo(d) {
    const candidatos = [d, ...d.querySelectorAll(':scope > *, :scope > * > *, :scope > * > * > *'), d.parentElement];
    let melhor = null;
    for (const c of candidatos) {
      if (!c) continue;
      const r = c.getBoundingClientRect();
      if (r.width < 24 || r.width > 80 || Math.abs(r.width - r.height) > 2) continue;
      const st = getComputedStyle(c);
      if (!temFundo(st) && !(parseFloat(st.borderTopLeftRadius) > 0)) continue;
      if (!melhor || r.width > melhor.r.width) melhor = { el: c, r };
    }
    return melhor || { el: d, r: d.getBoundingClientRect() };
  }

  // O elemento medido pode ser mais alto que largo: o timer ("09:55") fica
  // pendurado embaixo do círculo e entra na altura. Nesse caso o círculo é o
  // quadrado de cima; só um elemento quadrado tem o círculo no meio.
  function topoDoCirculo(r, tam) {
    return r.height > r.width + 2 ? r.top : r.top + (r.height - tam) / 2;
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

  // Põe o botão logo à direita do diamante, do mesmo tamanho, e empurra o
  // campo de comentário o bastante para ele caber. Se o diamante não aparecer,
  // o botão vai para o canto inferior direito (solto) em vez de desaparecer.
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
      top: Math.round(topoDoCirculo(c.r, tam)) + 'px',
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
