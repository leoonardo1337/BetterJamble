// ============================================================================
// BetterJamble — patos da corrida do sorteio (desenhos próprios, em SVG)
//
// Estilo "pato fofo" chapado (sem contorno): cabeça grande e redonda, corpo em
// pílula, asa/rabo num tom mais claro, olho grande sorrindo (ou aberto), bico
// em dois tons de laranja e um topetinho. Para cada pessoa se reconhecer no
// meio de dezenas, cada pato combina:
//   cor (14) x acessório (20) x olho (3) x bochecha (2) = 1.680 patos.
// A mesma pessoa cai sempre no mesmo pato (a combinação sai do id dela).
//
// Coordenadas: o pato olha para a direita. Cabeça: centro (245,175), raio 75;
// corpo: 100..320 x 240..370. O painel usa BJPatos.ancora para saber onde
// ficam o bico, a cabeça e o corpo (nome, número e linha de chegada).
// ============================================================================
(() => {
  // [corpo, asa (mais clara), topete de trás (mais escuro)]
  const CORES = [
    ['#fed72b', '#fef53a', '#fe9711'], ['#fed72b', '#fef53a', '#fe9711'],   // o amarelo clássico, mais vezes
    ['#f7f3ea', '#ffffff', '#d8cfbd'], ['#ff9ec7', '#ffc4dd', '#e86fa6'],
    ['#6cc4f5', '#a8e0fb', '#3a9bd6'], ['#7fd66b', '#b4ec9f', '#4fae3e'],
    ['#b38bff', '#d4bfff', '#8a5fe0'], ['#ffad42', '#ffd08a', '#e8811a'],
    ['#ff6b6b', '#ffa0a0', '#d94848'], ['#5fe0c4', '#a6f1e1', '#33b39a'],
    ['#c48a5a', '#e0b48d', '#9a6438'], ['#b9bec7', '#dde0e6', '#8c929c'],
    ['#4a4a57', '#6b6b7a', '#2a2a33'], ['#ffe08a', '#fff1c2', '#f2b84b'],
  ];
  const OLHOS = ['feliz', 'aberto', 'piscando'];

  // Acessórios por cima da cabeça (topo da cabeça em y=100, centro x=245)
  const A = {
    nenhum: '',
    coroa: '<path d="M192 112 L196 52 L220 82 L245 40 L270 82 L294 52 L298 112 Z" fill="#ffc62b"/><path d="M192 112 L298 112 L298 100 L192 100 Z" fill="#f0a91c"/><circle cx="245" cy="88" r="7" fill="#ff4d6d"/><circle cx="214" cy="96" r="5" fill="#4cb3f0"/><circle cx="276" cy="96" r="5" fill="#7fd66b"/>',
    cartola: '<rect x="203" y="30" width="80" height="78" rx="6" fill="#2b2b33"/><rect x="203" y="86" width="80" height="14" fill="#e84a5f"/><ellipse cx="243" cy="108" rx="68" ry="12" fill="#2b2b33"/>',
    festa: '<path d="M208 112 L250 14 L292 112 Z" fill="#4cb3f0"/><path d="M220 84 L280 84 L286 98 L214 98 Z M234 50 L266 50 L272 64 L228 64 Z" fill="#ffd23f"/><circle cx="250" cy="14" r="12" fill="#ff6b9d"/>',
    bone: '<path d="M178 132 Q178 70 245 70 Q312 70 312 132 Z" fill="#e84a5f"/><path d="M300 118 Q356 112 372 128 Q340 140 296 134 Z" fill="#c93a4d"/><circle cx="245" cy="72" r="8" fill="#fff"/>',
    laco: '<path d="M212 104 L172 82 L176 132 Z M212 104 L246 78 L250 128 Z" fill="#ff6fae"/><circle cx="212" cy="106" r="12" fill="#ff4f97"/>',
    oculos: '<path d="M196 166 L170 156" stroke="#1f1f26" stroke-width="8" stroke-linecap="round"/><rect x="194" y="150" width="66" height="46" rx="16" fill="#1f1f26"/><path d="M206 162 l16 -5" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".7"/><path d="M258 164 L270 162" stroke="#1f1f26" stroke-width="7" stroke-linecap="round"/>',
    coracao: '<path d="M226 204 C184 180 188 140 210 140 C222 140 226 150 226 155 C226 150 230 140 242 140 C264 140 268 180 226 204 Z" fill="#ff3d7f"/><path d="M206 154 q6 -6 12 -4" stroke="#fff" stroke-width="5" stroke-linecap="round" fill="none" opacity=".7"/>',
    flor: '<g transform="translate(196 108)"><circle cx="0" cy="-17" r="13" fill="#fff"/><circle cx="17" cy="0" r="13" fill="#fff"/><circle cx="0" cy="17" r="13" fill="#fff"/><circle cx="-17" cy="0" r="13" fill="#fff"/><circle cx="0" cy="0" r="11" fill="#ffc62b"/></g>',
    gorro: '<path d="M176 130 Q172 56 245 56 Q318 56 314 130 Z" fill="#3a9bd6"/><rect x="170" y="116" width="150" height="24" rx="12" fill="#f5f5f5"/><circle cx="245" cy="52" r="17" fill="#f5f5f5"/>',
    chef: '<path d="M200 118 L200 92 Q178 82 190 58 Q200 36 226 46 Q240 24 262 40 Q290 34 296 60 Q306 84 290 92 L290 118 Z" fill="#fff"/><rect x="200" y="104" width="90" height="14" fill="#e6e6e6"/>',
    fones: '<path d="M184 160 Q186 94 248 94 Q292 96 302 124" fill="none" stroke="#2b2b33" stroke-width="14" stroke-linecap="round"/><ellipse cx="182" cy="182" rx="24" ry="32" fill="#ff5a5f"/><ellipse cx="188" cy="182" rx="13" ry="21" fill="#d63f45"/>',
    pirata: '<clipPath id="cab"><circle cx="245" cy="175" r="75"/></clipPath><path d="M176 128 Q176 76 245 76 Q314 76 314 128 Z" fill="#d93b3b"/><circle cx="214" cy="100" r="6" fill="#fff"/><circle cx="250" cy="94" r="6" fill="#fff"/><circle cx="284" cy="102" r="6" fill="#fff"/><path d="M178 122 L150 142 M178 122 L154 112" stroke="#d93b3b" stroke-width="12" stroke-linecap="round"/><path d="M176 126 L226 174 L290 124" fill="none" stroke="#1f1f26" stroke-width="9" stroke-linejoin="round" clip-path="url(#cab)"/><ellipse cx="226" cy="174" rx="31" ry="29" fill="#1f1f26"/>',
    aureola: '<ellipse cx="240" cy="64" rx="56" ry="15" fill="none" stroke="#ffd23f" stroke-width="10"/>',
    moicano: '<path d="M184 128 L178 64 L204 96 L210 40 L232 88 L246 30 L258 88 L280 46 L282 96 L304 70 L300 128 Z" fill="#c03bd6"/>',
    viking: '<path d="M178 132 Q178 68 245 68 Q312 68 312 132 Z" fill="#9aa3ad"/><rect x="176" y="118" width="138" height="18" rx="6" fill="#7b838c"/><path d="M184 102 Q148 92 150 40 Q168 74 196 82 Z" fill="#f4ead2"/><path d="M306 102 Q342 92 340 40 Q322 74 294 82 Z" fill="#f4ead2"/>',
    cowboy: '<path d="M150 116 Q245 140 340 116 Q336 132 245 136 Q154 132 150 116 Z" fill="#a8672e"/><path d="M190 118 Q184 50 214 56 Q245 74 276 56 Q306 50 300 118 Z" fill="#bf7a3a"/><path d="M190 104 Q245 116 300 104" stroke="#6b3d16" stroke-width="8" fill="none"/>',
    orelhas: '<path d="M184 120 L190 54 L232 98 Z" fill="#2b2b33"/><path d="M258 98 L300 54 L306 120 Z" fill="#2b2b33"/><path d="M194 106 L198 74 L220 98 Z M270 98 L292 74 L296 106 Z" fill="#ff9ec7"/>',
    estrela: '<path d="M206 62 l12 24 27 4 -20 18 5 27 -24 -13 -24 13 5 -27 -20 -18 27 -4 z" fill="#ffd23f"/>',
    mago: '<path d="M184 116 Q230 100 238 8 Q262 70 312 116 Z" fill="#5b4bd6"/><path d="M168 118 Q245 134 322 118 Q318 130 245 132 Q172 130 168 118 Z" fill="#4535b8"/><circle cx="238" cy="62" r="5" fill="#ffd23f"/><circle cx="262" cy="92" r="4" fill="#ffd23f"/><circle cx="214" cy="96" r="4" fill="#ffd23f"/>',
    tiara: '<path d="M182 120 Q245 70 308 120" fill="none" stroke="#c9a7ff" stroke-width="10" stroke-linecap="round"/><circle cx="245" cy="86" r="11" fill="#ff6fae"/><circle cx="214" cy="98" r="8" fill="#ffd23f"/><circle cx="276" cy="98" r="8" fill="#4cb3f0"/>',
  };
  const ACESS = Object.keys(A);

  // o topete some debaixo de chapéu
  const TAPA_OLHO = { coracao: 1, pirata: 1 };
  const COBRE_TOPETE = { cartola: 1, festa: 1, bone: 1, gorro: 1, chef: 1, pirata: 1, viking: 1, cowboy: 1, mago: 1, coroa: 1 };

  function olho(tipo, cor) {
    // olho grande: anel branco + pupila; "feliz" cobre a metade de baixo com a
    // cor do corpo (fica o sorriso de olho fechado)
    const base = '<circle cx="226" cy="173" r="27" fill="#fefefe"/><circle cx="226" cy="173" r="14" fill="#434453"/><circle cx="231" cy="168" r="4.5" fill="#fff"/>';
    if (tipo === 'aberto') return base;
    if (tipo === 'piscando') return '<path d="M200 176 Q226 152 252 176" fill="none" stroke="#434453" stroke-width="9" stroke-linecap="round"/>';
    return base + '<rect x="198" y="192" width="56" height="22" fill="' + cor + '"/>';
  }

  function svgDoPato(c, acess, tipoOlho, bochecha) {
    const [corpo, asa, escuro] = c;
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="50 10 330 365">'
      // topete de trás (só a ponta aparece, atrás da cabeça)
      + (COBRE_TOPETE[acess] ? '' : '<rect x="160" y="120" width="80" height="20" rx="10" fill="' + escuro + '"/>')
      + '<circle cx="245" cy="175" r="75" fill="' + corpo + '"/>'
      + '<rect x="100" y="240" width="220" height="130" rx="65" fill="' + corpo + '"/>'
      // asa + rabinho apontando para trás e para cima
      + '<path d="M58 218 Q92 226 124 232 L196 236 Q234 250 230 286 Q222 332 150 332 Q90 332 70 300 Q54 268 58 218 Z" fill="' + asa + '"/>'
      // topete da frente e a sobrancelha clarinha
      + (COBRE_TOPETE[acess] ? '' : '<rect x="175" y="98" width="70" height="25" rx="12" fill="' + corpo + '"/>')
      + '<rect x="211" y="131" width="30" height="10" rx="5" fill="' + asa + '"/>'
      // o coração e o tapa-olho ficam no lugar do olho (o olho não aparece atrás)
      + (TAPA_OLHO[acess] ? '' : olho(tipoOlho, corpo))
      + (bochecha ? '<ellipse cx="262" cy="214" rx="15" ry="9" fill="#ff7aa2" opacity=".55"/>' : '')
      // bico: parte de cima laranja, de baixo mais escura, e a narina
      + '<path d="M268 198 L268 166 Q302 156 340 168 Q364 178 360 198 Z" fill="#fe9711"/>'
      + '<path d="M270 196 L344 196 Q356 199 352 206 Q330 214 270 212 Z" fill="#d55326"/>'
      + '<rect x="300" y="163" width="15" height="7" rx="3.5" fill="#d45326"/>'
      + A[acess]
      + '</svg>';
  }

  // número estável a partir do id
  function hash(txt) {
    let h = 2166136261;
    for (let i = 0; i < txt.length; i++) { h ^= txt.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function escolha(id) {
    const h = hash(String(id || '?'));
    const cor = CORES[h % CORES.length];
    const acess = ACESS[Math.floor(h / CORES.length) % ACESS.length];
    const tipoOlho = OLHOS[Math.floor(h / (CORES.length * ACESS.length)) % OLHOS.length];
    const bochecha = (h >>> 27) & 1;
    return { cor, acess, tipoOlho, bochecha, chave: cor[0] + acess + tipoOlho + bochecha };
  }

  const ASPECTO = 330 / 365;
  const imgs = new Map();      // chave -> Image (carregando ou pronta)
  const rasters = new Map();   // chave|altura -> canvas
  function imagemBase(e) {
    let im = imgs.get(e.chave);
    if (!im) {
      im = new Image();
      im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgDoPato(e.cor, e.acess, e.tipoOlho, e.bochecha));
      imgs.set(e.chave, im);
    }
    return im;
  }
  // canvas do pato na altura pedida (px de CSS), já com o dpr; null enquanto carrega
  function imagem(id, altura, dpr) {
    const e = escolha(id);
    const im = imagemBase(e);
    if (!im.complete || !im.naturalWidth) return null;
    const h = Math.max(8, Math.round(altura));
    const k = e.chave + '|' + h + '|' + dpr;
    let c = rasters.get(k);
    if (!c) {
      c = document.createElement('canvas');
      const w = Math.round(h * ASPECTO);
      c.width = w * dpr; c.height = h * dpr;
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      rasters.set(k, c);
      if (rasters.size > 500) rasters.delete(rasters.keys().next().value);
    }
    return c;
  }
  // começa a carregar os desenhos de quem vai correr
  function preparar(ids) { ids.forEach((id) => imagemBase(escolha(id))); }

  // onde ficam as partes, em frações da largura/altura da imagem
  const ancora = {
    aspecto: ASPECTO,
    bico: (360 - 50) / 330,          // ponta do bico (linha de chegada)
    cabecaEsq: (172 - 50) / 330,     // lado de trás da cabeça (o nome fica aí)
    cabecaTopo: (104 - 10) / 365,
    corpoX: (112 - 50) / 330,        // número da raia, na asa
    corpoY: (300 - 10) / 365,
    agua: (352 - 10) / 365,          // linha d'água
  };

  window.BJPatos = { imagem, preparar, svgDoPato, escolha, CORES, ACESSORIOS: A, OLHOS, ancora };
})();
