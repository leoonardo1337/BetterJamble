// ============================================================================
// WiseLive — botão na página (world MAIN)
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
  const API = () => window.WiseLive;
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
  let montadoEm = 0;
  let ultimaPos = '';         // o botão só aparece quando a posição parou de mudar
  let espera = null;
  const ESPERA_SOLTA = 15000; // sem diamante até aqui, aparece no canto mesmo assim

  // ---------------------------------------------------------------- estilo
  const CSS = `
  .bj-botao{position:fixed;z-index:40;box-sizing:border-box;display:grid;place-items:center;
    width:${TAMANHO}px;height:${TAMANHO}px;padding:0;border:0;border-radius:22%;
    background:transparent;cursor:pointer;transition:filter .15s,transform .15s}
  .bj-botao.bj-oculta{visibility:hidden}
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
  // o botão vai para o canto inferior direito (solto) em vez de desaparecer,
  // mas só depois de ESPERA_SOLTA: a página carregando ainda não tem o diamante.
  function posicionar() {
    if (!botao) return;
    const d = diamante();
    const b = d && blocos(d);
    if (!b) {
      devolverCampo();
      ultimaPos = '';
      if (Date.now() - montadoEm < ESPERA_SOLTA) return;
      botao.classList.add('bj-solta');
      botao.classList.remove('bj-oculta');
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
    const pos = botao.style.left + botao.style.top + tam;
    if (pos === ultimaPos) botao.classList.remove('bj-oculta');
    ultimaPos = pos;
  }

  // ---------------------------------------------------------------- montagem
  function montar() {
    if (botao && document.body && document.body.contains(botao)) { atualizar(); posicionar(); return; }
    if (!document.body) return;
    garantirEstilo();
    botao = document.createElement('button');
    botao.type = 'button';
    botao.className = 'bj-botao bj-oculta';
    botao.setAttribute('data-bj-barra', '1');
    botao.setAttribute('aria-label', 'Abrir painel do WiseLive');
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
    montadoEm = Date.now();
    ultimaPos = '';
    // enquanto escondido, confere bem mais rápido que o intervalo geral
    clearInterval(espera);
    espera = setInterval(() => {
      if (!botao || !botao.classList.contains('bj-oculta')) clearInterval(espera);
      else posicionar();
    }, 150);
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
    botao.title = 'WiseLive · ' + (t && t.envios
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
