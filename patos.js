// ============================================================================
// BetterJamble — patos da corrida do sorteio (desenhos próprios, em SVG)
//
// Cada pato é montado aqui: corpo de pato de borracha com contorno preto, numa
// cor, e um acessório na cabeça (chapéu, coroa, capacete...). A mesma pessoa
// cai sempre no mesmo pato (a combinação sai do id dela), então quem participa
// de vários sorteios reconhece o seu.
//
// O painel pede BJPatos.imagem(id, alturaEmPx) e recebe um canvas pronto para
// drawImage (o SVG é rasterizado uma vez por pato e por tamanho).
// ============================================================================
(() => {
  // cor do corpo, sombra da asa
  const CORES = [
    ['#ffd23f', '#e8b10f'], ['#ffd23f', '#e8b10f'], ['#ffd23f', '#e8b10f'],   // amarelo é o clássico: mais vezes
    ['#ff4d4d', '#d62f3a'], ['#4cb3f0', '#2f8fcc'], ['#6fd36a', '#43a843'],
    ['#ff8fc7', '#e56aa6'], ['#b388eb', '#8f63cf'], ['#ff9f43', '#e07b1a'],
    ['#ffffff', '#d9d9d9'], ['#3a3a3a', '#1f1f1f'], ['#2ec4b6', '#1b9e92'],
  ];

  // Acessórios desenhados por cima da cabeça (cabeça: centro 82,36, raio 21)
  const ACESSORIOS = {
    nenhum: '',
    coroa: '<path d="M64 20 L66 4 L74 13 L82 1 L90 13 L98 4 L100 20 Z" fill="#ffcc00" stroke="#000" stroke-width="3" stroke-linejoin="round"/><circle cx="82" cy="12" r="2.6" fill="#ff3b3b" stroke="#000" stroke-width="1.5"/>',
    cartola: '<rect x="66" y="-6" width="30" height="24" rx="2" fill="#222" stroke="#000" stroke-width="3"/><rect x="66" y="10" width="30" height="5" fill="#d62f3a"/><path d="M58 20 Q82 13 104 20 Q104 25 82 24 Q58 25 58 20 Z" fill="#222" stroke="#000" stroke-width="3" stroke-linejoin="round"/>',
    festa: '<path d="M70 19 L84 -12 L96 19 Z" fill="#4cb3f0" stroke="#000" stroke-width="3" stroke-linejoin="round"/><path d="M74 10 L92 10 M77 2 L89 2" stroke="#ffd23f" stroke-width="4"/><circle cx="84" cy="-13" r="4.5" fill="#ff4d4d" stroke="#000" stroke-width="2.5"/>',
    capacete: '<path d="M60 34 Q60 9 84 9 Q106 9 106 32 L106 38 L60 38 Z" fill="#fff" stroke="#000" stroke-width="3" stroke-linejoin="round"/><path d="M78 30 Q92 25 106 30 L106 40 Q92 44 78 40 Z" fill="#9fd8ff" stroke="#000" stroke-width="2.5"/><path d="M70 14 l2 4 4.5 .5 -3.3 3 1 4.4 -4.2 -2.3 -4.2 2.3 1 -4.4 -3.3 -3 4.5 -.5 z" fill="#000"/>',
    moicano: '<path d="M64 22 L62 4 L71 15 L73 -3 L80 13 L86 -4 L89 14 L97 2 L97 20 Z" fill="#c03bd6" stroke="#000" stroke-width="3" stroke-linejoin="round"/>',
    bone: '<path d="M62 24 Q62 8 82 8 Q100 8 101 22 Z" fill="#d62f3a" stroke="#000" stroke-width="3" stroke-linejoin="round"/><path d="M96 20 Q112 18 116 24 Q104 27 94 25 Z" fill="#d62f3a" stroke="#000" stroke-width="3" stroke-linejoin="round"/><circle cx="82" cy="8" r="2.5" fill="#fff" stroke="#000" stroke-width="1.5"/>',
    oculos: '<rect x="76" y="27" width="15" height="11" rx="4" fill="#111" stroke="#000" stroke-width="2"/><rect x="93" y="27" width="12" height="11" rx="4" fill="#111" stroke="#000" stroke-width="2"/><path d="M91 31 L93 31 M70 30 L76 31" stroke="#000" stroke-width="2.5"/><path d="M79 30 l4 0" stroke="#fff" stroke-width="2" stroke-linecap="round"/>',
    laco: '<path d="M70 15 L60 6 L60 24 Z M70 15 L80 6 L80 24 Z" fill="#ff5fa8" stroke="#000" stroke-width="3" stroke-linejoin="round"/><circle cx="70" cy="15" r="4.5" fill="#ff5fa8" stroke="#000" stroke-width="2.5"/>',
    cowboy: '<path d="M52 21 Q82 30 112 21 Q110 28 82 30 Q54 28 52 21 Z" fill="#a0682e" stroke="#000" stroke-width="3" stroke-linejoin="round"/><path d="M66 22 Q64 2 74 4 Q82 10 90 4 Q100 2 98 22 Z" fill="#b87a3a" stroke="#000" stroke-width="3" stroke-linejoin="round"/><path d="M66 18 Q82 22 98 18" stroke="#5a3613" stroke-width="3" fill="none"/>',
    chef: '<path d="M68 20 L68 12 Q60 4 68 -2 Q72 -10 82 -6 Q92 -12 97 -2 Q105 4 96 12 L96 20 Z" fill="#fff" stroke="#000" stroke-width="3" stroke-linejoin="round"/><path d="M68 15 L96 15" stroke="#000" stroke-width="2"/>',
    fones: '<path d="M62 34 Q62 10 82 10 Q102 10 102 34" fill="none" stroke="#222" stroke-width="5"/><rect x="56" y="28" width="11" height="16" rx="4" fill="#ff4d4d" stroke="#000" stroke-width="2.5"/><rect x="97" y="28" width="11" height="16" rx="4" fill="#ff4d4d" stroke="#000" stroke-width="2.5"/>',
    flor: '<g transform="translate(66 14)"><circle cx="0" cy="-7" r="5" fill="#fff" stroke="#000" stroke-width="2"/><circle cx="7" cy="0" r="5" fill="#fff" stroke="#000" stroke-width="2"/><circle cx="0" cy="7" r="5" fill="#fff" stroke="#000" stroke-width="2"/><circle cx="-7" cy="0" r="5" fill="#fff" stroke="#000" stroke-width="2"/><circle cx="0" cy="0" r="4" fill="#ffcc00" stroke="#000" stroke-width="2"/></g>',
    gorro: '<path d="M62 26 Q60 4 82 4 Q104 4 102 26 Z" fill="#2f8fcc" stroke="#000" stroke-width="3" stroke-linejoin="round"/><rect x="60" y="20" width="44" height="9" rx="4" fill="#fff" stroke="#000" stroke-width="2.5"/><circle cx="82" cy="2" r="6" fill="#fff" stroke="#000" stroke-width="2.5"/>',
    pirata: '<path d="M62 24 Q62 8 82 8 Q102 8 102 24 Z" fill="#d62f3a" stroke="#000" stroke-width="3" stroke-linejoin="round"/><circle cx="70" cy="14" r="2" fill="#fff"/><circle cx="90" cy="12" r="2" fill="#fff"/><path d="M62 22 L54 30 M62 22 L56 18" stroke="#d62f3a" stroke-width="4" stroke-linecap="round"/><path d="M84 25 L100 36" stroke="#000" stroke-width="2"/><ellipse cx="92" cy="31" rx="5.5" ry="5" fill="#111"/>',
    aureola: '<ellipse cx="82" cy="6" rx="16" ry="5" fill="none" stroke="#ffcc00" stroke-width="4"/>',
  };
  const NOMES_ACESS = Object.keys(ACESSORIOS);

  function svgDoPato(cor, sombra, acess) {
    // de frente para a direita, como os patos da corrida
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-6 -18 130 118">'
      // corpo + rabinho
      + '<path d="M10 52 Q4 38 14 32 Q20 44 32 47 Q46 43 62 46 Q80 47 92 54 Q106 62 102 76 Q96 94 64 95 Q28 96 15 84 Q6 72 10 52 Z" fill="' + cor + '" stroke="#000" stroke-width="3.2" stroke-linejoin="round"/>'
      // asa
      + '<path d="M36 64 Q50 54 68 61 Q66 77 48 79 Q36 77 36 64 Z" fill="' + sombra + '" stroke="#000" stroke-width="2.6" stroke-linejoin="round"/>'
      // cabeça
      + '<circle cx="82" cy="36" r="21" fill="' + cor + '" stroke="#000" stroke-width="3.2"/>'
      // bico
      + '<path d="M98 35 Q116 32 118 40 Q116 46 98 46 Z" fill="#ff8a1f" stroke="#000" stroke-width="2.8" stroke-linejoin="round"/>'
      + '<path d="M99 41 Q109 42 117 41" stroke="#000" stroke-width="2" fill="none"/>'
      // olho
      + '<circle cx="88" cy="29" r="5" fill="#fff" stroke="#000" stroke-width="2"/><circle cx="89.5" cy="29.5" r="2.6" fill="#000"/>'
      // brilho do plástico
      + '<path d="M22 60 Q24 52 32 52" stroke="rgba(255,255,255,.6)" stroke-width="4" stroke-linecap="round" fill="none"/>'
      + ACESSORIOS[acess]
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
    const [cor, sombra] = CORES[h % CORES.length];
    const acess = NOMES_ACESS[(h >>> 8) % NOMES_ACESS.length];
    return { cor, sombra, acess, chave: cor + acess };
  }

  const imgs = new Map();      // chave -> Image (carregando ou pronta)
  const rasters = new Map();   // chave|altura -> canvas
  function imagemBase(e) {
    let im = imgs.get(e.chave);
    if (!im) {
      im = new Image();
      im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgDoPato(e.cor, e.sombra, e.acess));
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
      const w = Math.round(h * (130 / 118));
      c.width = w * dpr; c.height = h * dpr;
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      c.larg = w; c.alt = h;
      rasters.set(k, c);
      if (rasters.size > 400) rasters.delete(rasters.keys().next().value);
    }
    return c;
  }
  // começa a carregar os desenhos de quem vai correr
  function preparar(ids) { ids.forEach((id) => imagemBase(escolha(id))); }

  window.BJPatos = { imagem, preparar, svgDoPato, CORES, ACESSORIOS };
})();
