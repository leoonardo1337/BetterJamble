// Batalha Pokémon do sorteio. Cada participante vira um Pokémon (o que ele
// escolheu no chat com "!pokemon nome", ou um sorteado pelo id dele) e todos
// brigam num campo no estilo dos jogos clássicos: andam, escolhem um alvo,
// vão até ele e se batem. Quando restam dois, entra a tela de batalha do
// Ruby/Emerald para o duelo final; depois, a tela do vencedor.
//
// O vencedor JÁ VEM SORTEADO (o mesmo sorteio justo de sempre, no gems-core);
// a batalha só encena: ele briga como os outros, mas nunca desmaia. Quem cai,
// e em que ordem, sai da própria briga.
//
// Os sprites vêm da PokéAPI (repositório público no GitHub, com CORS
// liberado) e não vão no pacote: Emerald para os estáticos até o 386,
// Black/White para os animados (1 a 649) e para os estáticos do 387 em diante.
(function () {
  'use strict';
  if (window.BJPokemon) return;

  const SPR = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon';
  const MAX_DEX = 649;
  const estatico = (n) => SPR + (n <= 386 ? '/versions/generation-iii/emerald/' : '/versions/generation-v/black-white/') + n + '.png';
  const animado = (n, costas) => SPR + '/versions/generation-v/black-white/animated/' + (costas ? 'back/' : '') + n + '.gif';

  // nomes da Pokédex nacional, na ordem (índice + 1 = número)
  const SLUGS = 'bulbasaur ivysaur venusaur charmander charmeleon charizard squirtle wartortle blastoise caterpie metapod butterfree weedle kakuna beedrill pidgey pidgeotto pidgeot rattata raticate spearow fearow ekans arbok pikachu raichu sandshrew sandslash nidoran-f nidorina nidoqueen nidoran-m nidorino nidoking clefairy clefable vulpix ninetales jigglypuff wigglytuff zubat golbat oddish gloom vileplume paras parasect venonat venomoth diglett dugtrio meowth persian psyduck golduck mankey primeape growlithe arcanine poliwag poliwhirl poliwrath abra kadabra alakazam machop machoke machamp bellsprout weepinbell victreebel tentacool tentacruel geodude graveler golem ponyta rapidash slowpoke slowbro magnemite magneton farfetchd doduo dodrio seel dewgong grimer muk shellder cloyster gastly haunter gengar onix drowzee hypno krabby kingler voltorb electrode exeggcute exeggutor cubone marowak hitmonlee hitmonchan lickitung koffing weezing rhyhorn rhydon chansey tangela kangaskhan horsea seadra goldeen seaking staryu starmie mr-mime scyther jynx electabuzz magmar pinsir tauros magikarp gyarados lapras ditto eevee vaporeon jolteon flareon porygon omanyte omastar kabuto kabutops aerodactyl snorlax articuno zapdos moltres dratini dragonair dragonite mewtwo mew chikorita bayleef meganium cyndaquil quilava typhlosion totodile croconaw feraligatr sentret furret hoothoot noctowl ledyba ledian spinarak ariados crobat chinchou lanturn pichu cleffa igglybuff togepi togetic natu xatu mareep flaaffy ampharos bellossom marill azumarill sudowoodo politoed hoppip skiploom jumpluff aipom sunkern sunflora yanma wooper quagsire espeon umbreon murkrow slowking misdreavus unown wobbuffet girafarig pineco forretress dunsparce gligar steelix snubbull granbull qwilfish scizor shuckle heracross sneasel teddiursa ursaring slugma magcargo swinub piloswine corsola remoraid octillery delibird mantine skarmory houndour houndoom kingdra phanpy donphan porygon2 stantler smeargle tyrogue hitmontop smoochum elekid magby miltank blissey raikou entei suicune larvitar pupitar tyranitar lugia ho-oh celebi treecko grovyle sceptile torchic combusken blaziken mudkip marshtomp swampert poochyena mightyena zigzagoon linoone wurmple silcoon beautifly cascoon dustox lotad lombre ludicolo seedot nuzleaf shiftry taillow swellow wingull pelipper ralts kirlia gardevoir surskit masquerain shroomish breloom slakoth vigoroth slaking nincada ninjask shedinja whismur loudred exploud makuhita hariyama azurill nosepass skitty delcatty sableye mawile aron lairon aggron meditite medicham electrike manectric plusle minun volbeat illumise roselia gulpin swalot carvanha sharpedo wailmer wailord numel camerupt torkoal spoink grumpig spinda trapinch vibrava flygon cacnea cacturne swablu altaria zangoose seviper lunatone solrock barboach whiscash corphish crawdaunt baltoy claydol lileep cradily anorith armaldo feebas milotic castform kecleon shuppet banette duskull dusclops tropius chimecho absol wynaut snorunt glalie spheal sealeo walrein clamperl huntail gorebyss relicanth luvdisc bagon shelgon salamence beldum metang metagross regirock regice registeel latias latios kyogre groudon rayquaza jirachi deoxys turtwig grotle torterra chimchar monferno infernape piplup prinplup empoleon starly staravia staraptor bidoof bibarel kricketot kricketune shinx luxio luxray budew roserade cranidos rampardos shieldon bastiodon burmy wormadam mothim combee vespiquen pachirisu buizel floatzel cherubi cherrim shellos gastrodon ambipom drifloon drifblim buneary lopunny mismagius honchkrow glameow purugly chingling stunky skuntank bronzor bronzong bonsly mime-jr happiny chatot spiritomb gible gabite garchomp munchlax riolu lucario hippopotas hippowdon skorupi drapion croagunk toxicroak carnivine finneon lumineon mantyke snover abomasnow weavile magnezone lickilicky rhyperior tangrowth electivire magmortar togekiss yanmega leafeon glaceon gliscor mamoswine porygon-z gallade probopass dusknoir froslass rotom uxie mesprit azelf dialga palkia heatran regigigas giratina cresselia phione manaphy darkrai shaymin arceus victini snivy servine serperior tepig pignite emboar oshawott dewott samurott patrat watchog lillipup herdier stoutland purrloin liepard pansage simisage pansear simisear panpour simipour munna musharna pidove tranquill unfezant blitzle zebstrika roggenrola boldore gigalith woobat swoobat drilbur excadrill audino timburr gurdurr conkeldurr tympole palpitoad seismitoad throh sawk sewaddle swadloon leavanny venipede whirlipede scolipede cottonee whimsicott petilil lilligant basculin sandile krokorok krookodile darumaka darmanitan maractus dwebble crustle scraggy scrafty sigilyph yamask cofagrigus tirtouga carracosta archen archeops trubbish garbodor zorua zoroark minccino cinccino gothita gothorita gothitelle solosis duosion reuniclus ducklett swanna vanillite vanillish vanilluxe deerling sawsbuck emolga karrablast escavalier foongus amoonguss frillish jellicent alomomola joltik galvantula ferroseed ferrothorn klink klang klinklang tynamo eelektrik eelektross elgyem beheeyem litwick lampent chandelure axew fraxure haxorus cubchoo beartic cryogonal shelmet accelgor stunfisk mienfoo mienshao druddigon golett golurk pawniard bisharp bouffalant rufflet braviary vullaby mandibuzz heatmor durant deino zweilous hydreigon larvesta volcarona cobalion terrakion virizion tornadus thundurus reshiram zekrom landorus kyurem keldeo meloetta genesect'.split(' ');
  const ESPECIAIS_NOME = {
    'nidoran-f': 'NIDORAN F', 'nidoran-m': 'NIDORAN M', 'mr-mime': 'MR. MIME', 'mime-jr': 'MIME JR.',
    farfetchd: "FARFETCH'D", 'ho-oh': 'HO-OH', 'porygon-z': 'PORYGON-Z',
  };
  const nomeDe = (dex) => {
    const s = SLUGS[dex - 1] || '';
    return ESPECIAIS_NOME[s] || s.toUpperCase();
  };
  const normal = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/♀/g, 'f').replace(/♂/g, 'm').replace(/[^a-z0-9]/g, '');
  const INDICE = new Map(SLUGS.map((s, i) => [normal(s), i + 1]));

  // distância de edição (para aceitar erro de digitação: "pikaxu" -> PIKACHU)
  function distancia(a, b) {
    if (Math.abs(a.length - b.length) > 2) return 9;
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    return d[a.length][b.length];
  }
  // "!pokemon pikachu", "!pokemon 25", "!pokemon mr mime", "!pokemon pikaxu"
  function buscar(texto) {
    const t = normal(texto);
    if (!t) return 0;
    if (/^\d+$/.test(t)) { const n = Number(t); return n >= 1 && n <= MAX_DEX ? n : 0; }
    if (INDICE.has(t)) return INDICE.get(t);
    // começo único ("charm" não serve: charmander e charmeleon)
    const comeco = SLUGS.map((s, i) => [normal(s), i + 1]).filter(([s]) => s.startsWith(t));
    if (t.length >= 4 && comeco.length === 1) return comeco[0][1];
    // erro de digitação: um em nomes curtos, até dois a partir de 5 letras
    let melhor = 0, nota = t.length >= 5 ? 3 : 2;
    for (const [s, i] of INDICE) { const d = distancia(t, s); if (d < nota) { nota = d; melhor = i; } }
    return melhor;
  }
  // quem não escolheu: um Pokémon tirado do id (sempre o mesmo para a mesma pessoa)
  function dexDoId(id) {
    let h = 2166136261;
    for (const c of String(id || '')) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
    return ((h >>> 0) % MAX_DEX) + 1;
  }

  // ------------------------------------------------------------ sprites
  const estaticos = {};   // dex -> Image
  function imgEstatica(dex) {
    if (!estaticos[dex]) { const im = new Image(); im.crossOrigin = 'anonymous'; im.src = estatico(dex); estaticos[dex] = im; }
    return estaticos[dex];
  }
  // Animados: o canvas só desenha o 1º quadro de um GIF, então o ImageDecoder
  // separa os quadros (com a duração de cada um). Cada Pokémon animado ocupa
  // ~1 MB de memória: com muita gente, só os MAX_ANIMADOS primeiros (o
  // vencedor sempre) ficam animados; os outros usam o estático.
  const MAX_ANIMADOS = 80;
  const animados = {};    // dex -> {quadros, total} | 'fila' | 'carregando' | 'falhou'
  const fila = [];
  let baixando = 0;
  function pedirAnimado(dex) {
    if (animados[dex] || !('ImageDecoder' in window)) return;
    animados[dex] = 'fila'; fila.push(dex); proximoAnimado();
  }
  function proximoAnimado() {
    while (baixando < 4 && fila.length) {
      const dex = fila.shift();
      baixando++;
      animados[dex] = 'carregando';
      decodificar(dex).then((a) => { animados[dex] = a; }, () => { animados[dex] = 'falhou'; })
        .finally(() => { baixando--; proximoAnimado(); });
    }
  }
  async function decodificar(dex) {
    const r = await fetch(animado(dex, false));
    if (!r.ok) throw new Error('http ' + r.status);
    const dec = new ImageDecoder({ data: r.body, type: 'image/gif' });
    await dec.tracks.ready;
    const n = dec.tracks.selectedTrack.frameCount;
    const quadros = []; let t = 0;
    for (let i = 0; i < n; i++) {
      const { image } = await dec.decode({ frameIndex: i });
      t += Math.max(20, (image.duration || 100000) / 1000);
      quadros.push({ bmp: await createImageBitmap(image), ate: t });
      image.close();
    }
    dec.close();
    return { quadros, total: t };
  }
  function quadroAnimado(dex, agora, fase) {
    const a = animados[dex];
    if (!a || typeof a === 'string') return null;
    const t = (agora + fase * 1000) % a.total;
    for (const q of a.quadros) if (t < q.ate) return q.bmp;
    return a.quadros[a.quadros.length - 1].bmp;
  }

  // ------------------------------------------------------------ pixel art
  // Desenhada numa tela pequena (1 px = 1 "pixel do jogo") e ampliada sem
  // suavizar, para ficar com cara de Game Boy Advance.
  const PALETA = {
    b: '#88d070', v: '#68b058', w: '#a8e090',                 // grama
    g: '#40a048', h: '#78d068', k: '#2c7034',                 // mato alto
    o: '#183820', d: '#2a6a32', m: '#3c8c3c', l: '#5cb050',   // árvore
    t: '#7a4a24', T: '#4a2e16', s: 'rgba(24,56,32,.35)',
    r: '#e8503a', y: '#f8d838', p: '#f088c0', W: '#f8f8f8',   // flores
  };
  const ARVORE = [
    '......oooo......', '....oollmmoo....', '...ollllmmmmo...', '..ollllmmmmddo..',
    '.ollllmmmmmmddo.', '.olllmmmmmmmddo.', 'ollmmmmmmmmmdddo', 'olmmmmmmmmmddddo',
    'olmmmmmmmmdddddo', 'ommmmmmmmddddddo', '.ommmmmmdddddddo', '.oddmmmdddddddo.',
    '..oddddddddddo..', '...ooddddddoo...', '......otTo......', '......otTo......',
    '.....ootTToo....', '....ssssssss....',
  ];
  const MATO = ['...h....', '..hgh...', '.hgggh.h', 'hgkggghg', 'gkggkggg', 'ggkgggkg', 'gggkgggg', 'kgggkggk'];
  // flor redonda: pétalas em volta do miolo amarelo e duas folhinhas
  const flor = (c) => ['.' + c + '.' + c + '.', c + c + 'y' + c + c, '.' + c + c + c + '.', '..v..', '.v.v.'];
  const FLOR = [flor('r'), flor('W'), flor('p')];
  function pintar(x, arte, px, py) {
    arte.forEach((linha, j) => {
      for (let i = 0; i < linha.length; i++) {
        const c = linha[i];
        if (c === '.') continue;
        x.fillStyle = PALETA[c]; x.fillRect(px + i, py + j, 1, 1);
      }
    });
  }
  // gerador fixo (o mapa não muda de um quadro para o outro)
  function semente(n) { let s = n >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function blocoDeGrama(x, x0, y0) {
    x.fillStyle = PALETA.b; x.fillRect(x0, y0, 16, 16);
    x.fillStyle = PALETA.v;
    [[3, 4], [10, 2], [6, 11], [13, 9]].forEach(([i, j]) => { x.fillRect(x0 + i, y0 + j, 1, 2); x.fillRect(x0 + i + 2, y0 + j, 1, 2); x.fillRect(x0 + i + 1, y0 + j + 1, 1, 1); });
    x.fillStyle = PALETA.w; x.fillRect(x0 + 8, y0 + 6, 1, 1); x.fillRect(x0 + 1, y0 + 13, 1, 1);
  }
  // fundo de grama (para o saguão): um bloco em data URL, repetido no CSS
  let urlGrama = '';
  function fundoGrama() {
    if (urlGrama) return urlGrama;
    const c = document.createElement('canvas'); c.width = 32; c.height = 32;
    const x = c.getContext('2d');
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) blocoDeGrama(x, i * 16, j * 16);
    pintar(x, MATO, 20, 18);
    urlGrama = c.toDataURL();
    return urlGrama;
  }
  // O campo: árvores em volta, mato alto nos cantos, flores, e no meio a
  // clareira de terra com o símbolo da Pokébola riscado no chão (como numa
  // arena de ginásio ao ar livre).
  function fazerMapa(L, A) {
    const c = document.createElement('canvas'); c.width = L; c.height = A;
    const x = c.getContext('2d');
    for (let j = 0; j < A; j += 16) for (let i = 0; i < L; i += 16) blocoDeGrama(x, i, j);
    const cx = L / 2, cy = A / 2 + 6, rx = L * 0.36, ry = A * 0.3;
    // clareira de terra (pixel a pixel: borda escura, terra, Pokébola)
    const rp = Math.min(rx, ry) * 0.32;
    for (let j = Math.floor(cy - ry - 3); j < cy + ry + 3; j++) for (let i = Math.floor(cx - rx - 3); i < cx + rx + 3; i++) {
      const v = ((i - cx) / rx) ** 2 + ((j - cy) / ry) ** 2;
      if (v > 1.06) continue;
      let cor = v > 1 ? '#70b858' : v > 0.9 ? '#c8a060' : '#e0c088';
      if (v <= 0.9) {
        const d = Math.hypot(i - cx, (j - cy) * (rx / ry) * 0.85);
        if (Math.abs(d - rp) < 1.2 || (Math.abs(j - cy) < 1 && d < rp) || Math.abs(d - rp * 0.3) < 1) cor = '#c8a060';
        else if (((i * 7 + j * 13) % 97) === 0) cor = '#b89060';
      }
      x.fillStyle = cor; x.fillRect(i, j, 1, 1);
    }
    const rnd = semente(L * 31 + A);
    // mato alto em moitas nos quatro cantos
    [[0.1, 0.22], [0.82, 0.22], [0.1, 0.78], [0.82, 0.78]].forEach(([fx, fy]) => {
      for (let j = 0; j < 3; j++) for (let i = 0; i < 4; i++) pintar(x, MATO, Math.round(L * fx) + i * 8, Math.round(A * fy) + j * 7);
    });
    // flores espalhadas pela grama (fora da clareira)
    for (let n = 0; n < 26; n++) {
      const fx = Math.round(rnd() * (L - 40)) + 20, fy = Math.round(rnd() * (A - 50)) + 30;
      if (((fx - cx) / rx) ** 2 + ((fy - cy) / ry) ** 2 < 1.2) continue;
      pintar(x, FLOR[n % 3], fx, fy);
    }
    // árvores: duas fileiras em cima, uma embaixo e nas laterais
    for (let i = -8; i < L + 8; i += 14) { pintar(x, ARVORE, i, -6); pintar(x, ARVORE, i + 7, 4); }
    for (let i = -8; i < L + 8; i += 14) pintar(x, ARVORE, i, A - 14);
    for (let j = 18; j < A - 14; j += 12) { pintar(x, ARVORE, -9, j); pintar(x, ARVORE, L - 7, j); }
    return c;
  }

  // ------------------------------------------------------------ batalha
  const GOLPES = ['usou INVESTIDA', 'usou CHOQUE DO TROVAO', 'usou LANCA-CHAMAS', "usou JATO D'AGUA", 'usou FOLHA NAVALHA', 'usou PSIQUICO', 'usou MORDIDA', 'usou ATAQUE RAPIDO'];
  const CORES = ['#ffd23f', '#ff6b3d', '#4cb3f0', '#7ad151', '#c77dff', '#ff5aa5'];
  // Ataque especial: 1,5% por golpe. Roda no meio da briga (nada congela):
  // o atacante cresce com uma aura, o golpe tem animação própria e derruba o
  // alvo de uma vez; o vencedor sorteado aguenta com o HP no vermelho.
  const CHANCE_ESPECIAL = 0.015;
  const CARGA_MS = 850, IMPACTO_MS = 650;
  const ESPECIAIS = [
    ['HIPER RAIO', '#ffd23f'], ['RAIO SOLAR', '#9be15d'], ['TROVAO', '#ffe14a'],
    ['DRACO METEORO', '#b06bff'], ['NEVASCA', '#8fe3ff'], ['EXPLOSAO', '#ff6b3d'],
  ];
  const DE_LONGE = ['HIPER RAIO', 'RAIO SOLAR', 'NEVASCA'];   // feixes: precisam de distância
  const alea = (a, b) => a + Math.random() * (b - a);
  const escolherDe = (v) => v[(Math.random() * v.length) | 0];

  // opcoes: {camada, participantes:[{id, usuario, dex}], vencedorId, aoFim()}
  function batalhar(op) {
    const camada = op.camada;
    let fase = 'saguao', parado = false;
    const pessoas = op.participantes.map((p) => ({ ...p, escolheu: !!p.dex, dex: p.dex || dexDoId(p.id) }));
    const vencedor = pessoas.find((p) => p.id === op.vencedorId) || pessoas[0];
    const timers = new Set();
    const depois = (ms, fn) => { const t = setTimeout(() => { timers.delete(t); if (!parado) fn(); }, ms); timers.add(t); return t; };
    const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };

    // já começa a baixar os sprites enquanto o pessoal escolhe
    function carregarSprites() {
      const unicos = [...new Set([vencedor.dex].concat(pessoas.map((p) => p.dex)))];
      unicos.forEach((d) => imgEstatica(d));
      unicos.slice(0, MAX_ANIMADOS).forEach(pedirAnimado);
    }
    carregarSprites();

    // ---------------------------------------------------------- saguão
    const saguao = el('div', 'pk-saguao');
    saguao.style.backgroundImage = 'url(' + fundoGrama() + ')';
    const janela = el('div', 'pk-janela');
    const titulo = el('div', 'pk-titulo');
    titulo.append('Escolha seu Pokémon digitando ', el('b', null, '!pokemon nome'));
    const sub = el('div', 'pk-sub');
    const lista = el('div', 'pk-lista');
    const cards = new Map();
    function cartao(p) {
      const c = el('div', 'pk-card' + (p.id === vencedor.id ? '' : ''));
      const im = el('img', 'pk-card-img'); im.alt = ''; im.loading = 'lazy'; im.width = 64; im.height = 64;
      c.append(im, el('div', 'pk-card-nome', '@' + p.usuario), el('div', 'pk-card-poke'));
      cards.set(p.id, c);
      pintarCartao(p);
      return c;
    }
    function pintarCartao(p) {
      const c = cards.get(p.id);
      if (!c) return;
      c.querySelector('img').src = estatico(p.dex);
      c.querySelector('.pk-card-poke').textContent = nomeDe(p.dex) + (p.escolheu ? '' : ' ?');
      c.classList.toggle('escolheu', p.escolheu);
      c.title = p.escolheu ? 'Escolhido no chat' : 'Aleatório (ainda não escolheu)';
    }
    function pintarSub() {
      const n = pessoas.filter((p) => p.escolheu).length;
      sub.textContent = pessoas.length + ' ' + (pessoas.length === 1 ? 'treinador' : 'treinadores') + ' · '
        + n + ' ' + (n === 1 ? 'escolheu' : 'escolheram') + ' · quem não escolher fica com um aleatório (?)';
    }
    pessoas.forEach((p) => lista.appendChild(cartao(p)));
    pintarSub();
    const btn = el('button', 'pk-iniciar', 'Iniciar');
    btn.type = 'button';
    btn.addEventListener('click', () => comecarCampo());
    janela.append(titulo, sub, lista);
    saguao.append(janela, btn);
    camada.appendChild(saguao);
    btn.focus();

    // "!pokemon nome" no chat: troca o Pokémon da pessoa enquanto o saguão está aberto
    function escolher(id, usuario, dex) {
      if (fase !== 'saguao' || !dex) return false;
      const u = String(usuario || '').toLowerCase();
      const p = pessoas.find((x) => (id && x.id === id) || (u && String(x.usuario).toLowerCase() === u));
      if (!p) return false;
      p.dex = dex; p.escolheu = true;
      if (p === vencedor) carregarSprites();
      imgEstatica(dex); pedirAnimado(dex);
      pintarCartao(p); pintarSub();
      const c = cards.get(p.id);
      c.classList.remove('trocou'); void c.offsetWidth; c.classList.add('trocou');
      return true;
    }

    // ---------------------------------------------------------- campo
    let cv, ctx, W = 0, H = 0, E = 3, mapa = null, estado = null;
    function medir() {
      const r = cv.getBoundingClientRect();
      W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
      cv.width = W; cv.height = H;
      ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false;
      E = Math.max(2, Math.round(Math.min(W, H) / 260));
      mapa = fazerMapa(Math.ceil(W / E), Math.ceil(H / E));
    }
    const arena = () => ({ x0: 22 * E, y0: 30 * E, x1: W - 22 * E, y1: H - 18 * E });

    function comecarCampo() {
      if (fase !== 'saguao') return;
      fase = 'campo';
      saguao.classList.add('saindo');
      depois(300, () => saguao.remove());
      cv = el('canvas', 'pk-campo');
      camada.appendChild(cv);
      medir();
      const A = arena();
      // com muita gente os Pokémon diminuem (mas não somem)
      const tam = Math.max(0.5, Math.min(1, Math.sqrt(50 / Math.max(1, pessoas.length))));
      estado = {
        t0: performance.now(), ultimo: performance.now(), log: [], faiscas: [], numeros: [], especial: null, tam,
        vivos: pessoas.map((p) => ({
          ...p, hp: 1, x: alea(A.x0 + 20, A.x1 - 20), y: alea(A.y0 + 30, A.y1 - 10), vx: 0, vy: 0,
          vel: alea(70, 105) * (0.7 + 0.3 * tam), alvo: null, trocaAlvo: 0, recarga: alea(600, 1600), fase: alea(0, 6.28),
          treme: 0, investida: 0, caindo: 0, olha: Math.random() < 0.5 ? -1 : 1, ganha: p === vencedor,
        })),
      };
      if (pessoas.length <= 2) { depois(600, () => comecarDuelo()); return; }
      requestAnimationFrame(quadro);
    }

    function escolherAlvo(p, vivos, agora) {
      let melhor = null, nota = Infinity;
      for (const q of vivos) {
        if (q === p || q.caindo) continue;
        const d = Math.hypot(q.x - p.x, q.y - p.y) * alea(0.6, 1.4);
        if (d < nota) { nota = d; melhor = q; }
      }
      p.alvo = melhor;
      p.trocaAlvo = agora + alea(2500, 5000);
    }
    function narrar(t) { estado.log.unshift(t); estado.log = estado.log.slice(0, 4); }
    function ferir(p, dano, agora, deAlguem) {
      if (p.caindo) return;
      const antes = p.hp;
      p.hp = Math.max(p.ganha ? 0.22 : 0, p.hp - dano);   // o vencedor sorteado nunca desmaia
      p.treme = agora;
      if (deAlguem) estado.numeros.push({ x: p.x, y: p.y - 70 * estado.tam, ini: agora, txt: '-' + Math.max(1, Math.round((antes - p.hp) * 120)) });
      if (p.hp <= 0) { p.caindo = agora; narrar('@' + p.usuario + ' desmaiou!'); }
    }
    function iniciarEspecial(p, q, agora) {
      const [nome, cor] = escolherDe(ESPECIAIS);
      estado.especial = { de: p, para: q, ini: agora, nome, cor, bateu: false };
      p.olha = q.x > p.x ? 1 : -1;
      narrar('@' + p.usuario + ' usou ' + nome + '!');
    }
    function avancarEspecial(agora) {
      const s = estado.especial, t = agora - s.ini;
      // feixes: na carga o atacante salta para trás, longe do alvo
      if (t < CARGA_MS * 0.6 && DE_LONGE.includes(s.nome)) {
        const p = s.de, q = s.para, A = arena();
        const dx = p.x - q.x, dy = p.y - q.y, d = Math.hypot(dx, dy) || 1, longe = 190 * estado.tam + 40;
        if (d < longe) {
          const passo = Math.min(longe - d, 14);
          let nx = p.x + (dx / d) * passo, ny = p.y + (dy / d) * passo;
          if (nx < A.x0 || nx > A.x1) { nx = Math.max(A.x0, Math.min(A.x1, nx)); ny += (dy >= 0 ? 1 : -1) * passo; }
          if (ny < A.y0 || ny > A.y1) { ny = Math.max(A.y0, Math.min(A.y1, ny)); nx += (dx >= 0 ? 1 : -1) * passo; }
          p.x = Math.max(A.x0, Math.min(A.x1, nx)); p.y = Math.max(A.y0, Math.min(A.y1, ny));
        }
        p.olha = q.x > p.x ? 1 : -1;
      }
      if (!s.bateu && t >= CARGA_MS) {
        s.bateu = true;
        const q = s.para;
        q.treme = agora;
        if (q.ganha) {
          q.hp = Math.min(q.hp, 0.12);
          estado.numeros.push({ x: q.x, y: q.y - 80 * estado.tam, ini: agora, txt: 'AGUENTOU!', grande: true });
          narrar('@' + q.usuario + ' aguentou o ' + s.nome + '!');
        } else {
          q.hp = 0; q.caindo = agora;
          estado.numeros.push({ x: q.x, y: q.y - 80 * estado.tam, ini: agora, txt: 'NOCAUTE!', grande: true });
          narrar('@' + q.usuario + ' caiu com UM golpe!');
        }
      }
      if (t >= CARGA_MS + IMPACTO_MS) estado.especial = null;
    }

    function passo(agora) {
      const e = estado;
      const dt = Math.min(0.05, (agora - e.ultimo) / 1000);
      e.ultimo = agora;
      const A = arena();
      if (e.especial) avancarEspecial(agora);
      const noEspecial = (p) => e.especial && (p === e.especial.de || p === e.especial.para);
      const ativos = e.vivos.filter((p) => !p.morto && !p.caindo);
      if (ativos.length <= 2) { if (!e.acabou && !e.especial) e.acabou = agora; return; }
      // A briga dura de 22 a 45 s (mais gente, mais tempo): os golpes começam
      // fracos e vão ficando fortes; passou muito do tempo, esquenta de vez.
      const t = agora - e.t0;
      const dura = Math.max(22000, Math.min(45000, 18000 + pessoas.length * 150));
      const furia = (0.3 + 1.7 * (t / dura) ** 2) * (1 + Math.max(0, 8 - ativos.length) * 0.05) * (t > dura * 1.25 ? 3 : 1);
      const encosta = 46 * e.tam + 6;
      for (const p of ativos) {
        if (noEspecial(p)) { p.vx *= 0.8; p.vy *= 0.8; continue; }
        if (!p.alvo || p.alvo.caindo || p.alvo.morto || noEspecial(p.alvo) || agora > p.trocaAlvo) escolherAlvo(p, ativos.filter((x) => !noEspecial(x)), agora);
        const q = p.alvo;
        if (!q) continue;
        const dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy) || 1;
        if (d > encosta) {
          p.vx += ((dx / d) * p.vel - p.vx) * Math.min(1, dt * 4);
          p.vy += ((dy / d) * p.vel - p.vy) * Math.min(1, dt * 4);
        } else {
          p.vx *= 0.8; p.vy *= 0.8;
          if (agora > p.recarga && !e.especial && ativos.length > 3 && Math.random() < CHANCE_ESPECIAL) {
            p.recarga = agora + alea(900, 1400);
            iniciarEspecial(p, q, agora);
            continue;
          }
          if (agora > p.recarga) {
            p.investida = agora;
            p.recarga = agora + alea(700, 1300);
            ferir(q, alea(0.1, 0.2) * furia * (q.ganha ? 0.6 : 1), agora, p);
            ferir(p, alea(0.02, 0.05) * furia * (p.ganha ? 0.6 : 1), agora, null);
            q.vx += (dx / d) * 260; q.vy += (dy / d) * 260;
            e.faiscas.push({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 - 30 * e.tam, ini: agora, cor: escolherDe(CORES) });
            if (Math.random() < 0.3) narrar('@' + p.usuario + ' ' + escolherDe(GOLPES) + '!');
            if (!q.caindo && Math.random() < 0.6) { q.alvo = p; q.trocaAlvo = agora + alea(2000, 3500); }
          }
        }
        if (Math.abs(p.vx) > 8) p.olha = p.vx > 0 ? 1 : -1;
      }
      // ninguém em cima de ninguém (grade de células: centenas não pesam)
      const min = 40 * e.tam, cel = new Map(), chave = (i, j) => i * 7919 + j;
      for (const p of ativos) {
        const k = chave(Math.floor(p.x / min), Math.floor(p.y / min));
        (cel.get(k) || cel.set(k, []).get(k)).push(p);
      }
      for (const a of ativos) {
        const ci = Math.floor(a.x / min), cj = Math.floor(a.y / min);
        for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
          for (const b of cel.get(chave(ci + di, cj + dj)) || []) {
            if (b === a) continue;
            const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
            if (d < min) { const f = (min - d) / 4; a.x -= (dx / d) * f; a.y -= (dy / d) * f; }
          }
        }
      }
      for (const p of ativos) {
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.vx *= 1 - Math.min(1, dt * 1.5); p.vy *= 1 - Math.min(1, dt * 1.5);
        p.x = Math.max(A.x0, Math.min(A.x1, p.x)); p.y = Math.max(A.y0, Math.min(A.y1, p.y));
      }
    }

    function pilula(x, y, w, h, r, cor, borda) {
      ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fillStyle = cor; ctx.fill();
      if (borda) { ctx.lineWidth = Math.max(1, E * 0.7); ctx.strokeStyle = borda; ctx.stroke(); }
    }
    function desenharPoke(p, agora, escala) {
      const k0 = estado.tam;
      let alfa = 1, dx = 0, dy = 0;
      if (p.caindo) { const k = (agora - p.caindo) / 800; alfa = Math.max(0, 1 - k); if (k >= 1) { p.morto = true; return; } dy = k * 18; }
      if (p.treme && agora - p.treme < 280) dx = Math.sin((agora - p.treme) / 16) * 5;
      if (p.investida && agora - p.investida < 220 && p.alvo) {
        const k = Math.sin(((agora - p.investida) / 220) * Math.PI);
        const ax = p.alvo.x - p.x, ay = p.alvo.y - p.y, d = Math.hypot(ax, ay) || 1;
        dx += (ax / d) * 16 * k; dy += (ay / d) * 16 * k;
      }
      const anda = Math.hypot(p.vx, p.vy) > 15;
      const pulo = anda ? Math.abs(Math.sin(agora / 110 + p.fase)) * 5 * k0 : Math.sin(agora / 300 + p.fase) * 1.5;
      ctx.globalAlpha = (p.caindo && Math.floor(agora / 70) % 2) ? alfa * 0.3 : alfa;
      ctx.fillStyle = 'rgba(24,56,32,.3)'; ctx.beginPath(); ctx.ellipse(p.x, p.y + 4, 24 * k0, 7 * k0, 0, 0, 6.29); ctx.fill();
      const anim = quadroAnimado(p.dex, agora, p.fase);
      const im = estaticos[p.dex];
      if (anim || (im && im.complete && im.naturalWidth)) {
        ctx.save();
        ctx.translate(p.x + dx, p.y + 6 - pulo + dy);
        if (escala !== 1) ctx.scale(escala, escala);
        // os sprites de frente olham para a esquerda: vira quando anda para a direita
        if (p.olha > 0) ctx.scale(-1, 1);
        if (p.treme && agora - p.treme < 120) ctx.filter = 'brightness(2.2)';
        if (anim) { const k = 1.4 * k0; ctx.drawImage(anim, -anim.width * k / 2, -anim.height * k, anim.width * k, anim.height * k); }
        else { const t2 = 72 * k0; ctx.drawImage(im, -t2 / 2, -t2, t2, t2); }
        ctx.restore();
      }
      // etiqueta no estilo da caixa de HP do jogo: nome e barrinha
      const fs = Math.max(7, Math.round(9 * k0));
      ctx.font = fs + 'px "Press Start 2P",monospace';
      const nome = '@' + p.usuario;
      const nw = Math.max(ctx.measureText(nome).width + 10, 50 * k0);
      const ty = p.y + 9;
      pilula(p.x - nw / 2, ty, nw, fs + 13, 3, '#f8f8d8', '#506858');
      ctx.fillStyle = '#383838'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText(nome, p.x, ty + 3);
      const bw = nw - 10;
      pilula(p.x - bw / 2, ty + fs + 6, bw, 4, 2, '#506858');
      const cor = p.hp > 0.5 ? '#58d080' : p.hp > 0.2 ? '#f8c030' : '#f05838';
      if (p.hp > 0) pilula(p.x - bw / 2 + 1, ty + fs + 7, (bw - 2) * p.hp, 2, 1, cor);
      ctx.globalAlpha = 1;
    }
    function caixaTexto(x, y, w, h) {
      // caixa de texto do jogo: borda dupla azul-acinzentada, fundo branco
      pilula(x, y, w, h, 8, '#f8f8f8', '#506070');
      ctx.lineWidth = 2; ctx.strokeStyle = '#a0a8b8';
      ctx.beginPath(); ctx.roundRect(x + 5, y + 5, w - 10, h - 10, 5); ctx.stroke();
    }
    function explosao(x, y, k, cor, raio) {
      const r = 12 + k * raio;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(255,255,255,' + (1 - k) + ')'); g.addColorStop(0.4, cor); g.addColorStop(1, cor + '00');
      ctx.globalAlpha = 1 - k * 0.7; ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r, 0, 6.29); ctx.fill();
      ctx.globalAlpha = 1;
    }
    function desenharEspecial(agora) {
      const s = estado.especial;
      if (!s) return;
      const t = agora - s.ini, ti = t - CARGA_MS, kc = Math.min(1, t / CARGA_MS), k0 = estado.tam;
      const de = s.de, para = s.para;
      const ax = de.x, ay = de.y - 40 * k0, bx = para.x, by = para.y - 40 * k0;
      const sai = Math.max(0, (t - CARGA_MS - IMPACTO_MS + 250) / 250);
      if (ti < 200) {
        ctx.save();
        const r = (46 + Math.sin(agora / 50) * 6 + kc * 14) * (0.6 + 0.4 * k0);
        const g = ctx.createRadialGradient(ax, ay, 4, ax, ay, r);
        g.addColorStop(0, 'rgba(255,255,255,.55)'); g.addColorStop(0.5, s.cor + '88'); g.addColorStop(1, s.cor + '00');
        ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(ax, ay, r, 0, 6.29); ctx.fill();
        for (let i = 0; i < 16; i++) {
          const ang = i * 2.4 + agora / 400, k = ((t / 420) + i / 16) % 1, dist = 110 * k0 * (1 - k);
          ctx.fillStyle = i % 3 ? s.cor : '#fff';
          ctx.beginPath(); ctx.arc(ax + Math.cos(ang) * dist, ay + Math.sin(ang) * dist * 0.7, 3 + k * 2, 0, 6.29); ctx.fill();
        }
        ctx.restore();
      }
      ctx.save();
      ctx.globalAlpha = Math.min(1, t / 150) * (1 - sai);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
      ctx.font = '13px "Press Start 2P",monospace'; ctx.lineWidth = 5; ctx.strokeStyle = '#000'; ctx.fillStyle = s.cor;
      const fy = ay - 62 * k0 - Math.min(1, t / 200) * 10;
      ctx.strokeText(s.nome + '!', ax, fy); ctx.fillText(s.nome + '!', ax, fy);
      ctx.restore();
      if (ti < 0) return;
      const k = Math.min(1, ti / IMPACTO_MS);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      if (s.nome === 'HIPER RAIO' || s.nome === 'RAIO SOLAR') {
        const solar = s.nome === 'RAIO SOLAR';
        const larg = (solar ? 46 : 32) * (1 - k * 0.85) * (0.6 + 0.4 * k0);
        const ang = Math.atan2(by - ay, bx - ax), comp = Math.hypot(bx - ax, by - ay);
        ctx.translate(ax, ay); ctx.rotate(ang);
        const g = ctx.createLinearGradient(0, -larg, 0, larg);
        g.addColorStop(0, s.cor + '00'); g.addColorStop(0.35, s.cor); g.addColorStop(0.5, '#ffffff'); g.addColorStop(0.65, s.cor); g.addColorStop(1, s.cor + '00');
        ctx.fillStyle = g; ctx.shadowColor = s.cor; ctx.shadowBlur = 30;
        ctx.fillRect(0, -larg, comp * Math.min(1, ti / 90), larg * 2);
        if (solar) for (let i = 0; i < 10; i++) { ctx.fillStyle = 'rgba(255,255,200,.5)'; ctx.fillRect(Math.random() * comp, -larg * 1.6, 3, larg * 3.2); }
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        explosao(bx, by, k, s.cor, 70 * k0);
      } else if (s.nome === 'TROVAO') {
        if (Math.floor(ti / 45) % 3 !== 2) {
          ctx.strokeStyle = '#fffbe0'; ctx.lineWidth = 7 * (1 - k * 0.6); ctx.shadowColor = s.cor; ctx.shadowBlur = 40;
          ctx.beginPath(); let x = bx + (Math.random() - 0.5) * 40, y = 0; ctx.moveTo(x, y);
          while (y < by) { y = Math.min(by, y + 28 + Math.random() * 22); x = y >= by ? bx : x + (Math.random() - 0.5) * 46; ctx.lineTo(x, y); }
          ctx.stroke(); ctx.strokeStyle = s.cor; ctx.lineWidth = 2; ctx.stroke();
        }
        explosao(bx, by, k, s.cor, 55 * k0);
      } else if (s.nome === 'DRACO METEORO') {
        for (let i = 0; i < 5; i++) {
          const ki = (ti - i * 70) / 260;
          if (ki < 0) continue;
          const ox = (i - 2) * 22 * k0;
          if (ki < 1) {
            const mx = bx + ox + (1 - ki) * 160, my = by - (1 - ki) * (by + 60);
            const g = ctx.createLinearGradient(mx, my, mx + 70, my - 90);
            g.addColorStop(0, '#fff'); g.addColorStop(0.2, '#ff9a3d'); g.addColorStop(1, 'rgba(176,107,255,0)');
            ctx.strokeStyle = g; ctx.lineWidth = 12; ctx.lineCap = 'round'; ctx.shadowColor = s.cor; ctx.shadowBlur = 24;
            ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx + 70, my - 90); ctx.stroke();
            ctx.fillStyle = '#fff3d0'; ctx.beginPath(); ctx.arc(mx, my, 9, 0, 6.29); ctx.fill();
          } else explosao(bx + ox, by + 10, Math.min(1, ki - 1), i % 2 ? '#ff9a3d' : s.cor, 36 * k0);
        }
      } else if (s.nome === 'NEVASCA') {
        for (let i = 0; i < 40; i++) {
          const ki = ((ti / 380) + i / 40) % 1, x = ax + (bx - ax) * ki, y = ay + (by - ay) * ki, gira = ki * 12 + i;
          ctx.fillStyle = i % 4 ? '#e8fbff' : s.cor; ctx.shadowColor = '#bff3ff'; ctx.shadowBlur = 8;
          ctx.beginPath(); ctx.arc(x + Math.cos(gira) * 18 * (1 - ki), y + Math.sin(gira) * 18 * (1 - ki), 2.5, 0, 6.29); ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over'; ctx.shadowBlur = 0;
        const q = 40 * k0;
        if (ti < 420) {
          const kg = Math.min(1, ti / 200);
          ctx.fillStyle = 'rgba(170,235,255,' + 0.55 * kg + ')'; ctx.strokeStyle = 'rgba(255,255,255,' + 0.9 * kg + ')'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(bx - q * 0.85, by + q); ctx.lineTo(bx - q, by - q * 0.75); ctx.lineTo(bx - q * 0.25, by - q * 1.3); ctx.lineTo(bx + q * 0.75, by - q); ctx.lineTo(bx + q, by + q * 0.1); ctx.lineTo(bx + q * 0.75, by + q * 1.05); ctx.closePath(); ctx.fill(); ctx.stroke();
        } else {
          const kq = (ti - 420) / (IMPACTO_MS - 420);
          for (let i = 0; i < 12; i++) {
            const a2 = i * 0.52, d2 = kq * 90 * k0;
            ctx.fillStyle = 'rgba(200,245,255,' + (1 - kq) + ')';
            ctx.save(); ctx.translate(bx + Math.cos(a2) * d2, by + Math.sin(a2) * d2 * 0.8); ctx.rotate(a2 + kq * 4);
            ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(6, 0); ctx.lineTo(0, 9); ctx.lineTo(-6, 0); ctx.closePath(); ctx.fill(); ctx.restore();
          }
        }
      } else {
        explosao(bx, by, k, '#ff6b3d', 120 * k0);
        for (let i = 0; i < 3; i++) {
          const kr = Math.max(0, k - i * 0.12);
          ctx.strokeStyle = 'rgba(255,' + (200 - i * 60) + ',80,' + (1 - kr) + ')'; ctx.lineWidth = 6 - i;
          ctx.beginPath(); ctx.ellipse(bx, by + 30 * k0, 30 + kr * 220 * k0, 10 + kr * 60 * k0, 0, 0, 6.29); ctx.stroke();
        }
        for (let i = 0; i < 18; i++) {
          const a2 = i * 0.35, d2 = k * 150 * k0;
          ctx.fillStyle = i % 2 ? '#ffd23f' : '#5a3a1a';
          ctx.fillRect(bx + Math.cos(a2) * d2, by + Math.sin(a2) * d2 * 0.6 - Math.sin(k * 3.1) * 40, 5, 5);
        }
      }
      ctx.restore();
      if (ti < 140) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; explosao(bx, by, ti / 140, '#ffffff', 50 * k0); ctx.restore(); }
    }

    function quadro(agora) {
      if (parado || fase !== 'campo') return;
      if (Math.round(cv.getBoundingClientRect().width) !== W || Math.round(cv.getBoundingClientRect().height) !== H) medir();
      passo(agora);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(mapa, 0, 0, mapa.width * E, mapa.height * E);
      const e = estado;
      const s = e.especial;
      const cresce = s ? 1 + 0.3 * (agora - s.ini < CARGA_MS ? Math.min(1, (agora - s.ini) / CARGA_MS) : Math.max(0, 1 - (agora - s.ini - CARGA_MS) / 300)) : 1;
      e.vivos.filter((p) => !p.morto).sort((a, b) => a.y - b.y).forEach((p) => desenharPoke(p, agora, s && p === s.de ? cresce : 1));
      e.faiscas = e.faiscas.filter((f) => {
        const k = (agora - f.ini) / 260;
        if (k >= 1) return false;
        ctx.save(); ctx.translate(f.x, f.y); ctx.globalAlpha = 1 - k;
        ctx.fillStyle = '#fff'; ctx.strokeStyle = f.cor; ctx.lineWidth = 3;
        const r = (10 + k * 18) * (0.6 + 0.4 * e.tam);
        ctx.beginPath();
        for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.283, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
        ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
        return true;
      });
      desenharEspecial(agora);
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      e.numeros = e.numeros.filter((n) => {
        const k = (agora - n.ini) / (n.grande ? 1300 : 700);
        if (k >= 1) return false;
        ctx.font = (n.grande ? 20 : 12) + 'px "Press Start 2P",monospace';
        ctx.globalAlpha = 1 - k * k; ctx.lineWidth = n.grande ? 6 : 4; ctx.strokeStyle = '#000'; ctx.fillStyle = n.grande ? '#ffd84a' : '#fff';
        ctx.strokeText(n.txt, n.x, n.y - k * 26); ctx.fillText(n.txt, n.x, n.y - k * 26);
        return true;
      });
      ctx.globalAlpha = 1;
      // placar e narração em caixas de texto do jogo
      const restam = e.vivos.filter((p) => !p.caindo && !p.morto).length;
      ctx.font = '16px "Press Start 2P",monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const txt = 'RESTAM ' + restam;
      const tw = ctx.measureText(txt).width + 40;
      caixaTexto(W / 2 - tw / 2, 14, tw, 46);
      ctx.fillStyle = '#383838'; ctx.fillText(txt, W / 2, 38);
      if (e.log.length) {
        const lw = Math.min(520, W * 0.46), lh = 26 + e.log.length * 22;
        caixaTexto(W - lw - 16, H - lh - 14, lw, lh);
        ctx.font = '11px "Press Start 2P",monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillStyle = '#383838';
        e.log.forEach((l, i) => { ctx.globalAlpha = 1 - i * 0.2; ctx.fillText(l.slice(0, 44), W - lw + 2, H - lh + 2 + i * 22); });
        ctx.globalAlpha = 1;
      }
      if (e.acabou) {
        const k = Math.min(1, (agora - e.acabou) / 300);
        ctx.font = '22px "Press Start 2P",monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.globalAlpha = k; ctx.lineWidth = 7; ctx.strokeStyle = '#000'; ctx.fillStyle = '#ffd84a';
        ctx.strokeText('RESTAM 2! DUELO FINAL!', W / 2, H / 2); ctx.fillText('RESTAM 2! DUELO FINAL!', W / 2, H / 2);
        ctx.globalAlpha = 1;
        if (agora - e.acabou > 1800) { comecarDuelo(); return; }
      }
      requestAnimationFrame(quadro);
    }

    // ---------------------------------------------------------- duelo final
    // A tela de batalha do Ruby/Emerald: o vencedor de costas (embaixo, à
    // esquerda), o último adversário de frente (em cima, à direita), caixas
    // de HP e o texto aparecendo letra por letra.
    function comecarDuelo() {
      if (fase === 'duelo' || fase === 'vencedor') return;
      fase = 'duelo';
      const resto = estado ? estado.vivos.filter((p) => !p.morto && !p.caindo && !p.ganha) : [];
      const outro = resto[0] || pessoas.find((p) => p !== vencedor);
      if (!outro) { mostrarVencedor(); return; }
      const d = el('div', 'pk-duelo');
      d.innerHTML = '<div class="pk-plat pk-plat-op"></div><div class="pk-plat pk-plat-eu"></div>'
        + '<img class="pk-spr pk-spr-op" alt=""><img class="pk-spr pk-spr-eu" alt="">'
        + '<div class="pk-hp pk-hp-op"><div class="pk-hp-l"><span class="n"></span><span>Nv50</span></div><div class="pk-hp-p"></div><div class="pk-hp-b">HP<div class="pk-hp-t"><div class="pk-hp-v"></div></div></div></div>'
        + '<div class="pk-hp pk-hp-eu"><div class="pk-hp-l"><span class="n"></span><span>Nv50</span></div><div class="pk-hp-p"></div><div class="pk-hp-b">HP<div class="pk-hp-t"><div class="pk-hp-v"></div></div></div><div class="pk-hp-num">120/120</div></div>'
        + '<div class="pk-texto"><div></div></div>';
      camada.appendChild(d);
      if (cv) { cv.classList.add('saindo'); depois(400, () => cv && cv.remove()); }
      const $ = (s) => d.querySelector(s);
      const sprOp = $('.pk-spr-op'), sprEu = $('.pk-spr-eu');
      sprOp.src = animado(outro.dex, false); sprOp.onerror = () => { sprOp.src = estatico(outro.dex); };
      sprEu.src = animado(vencedor.dex, true); sprEu.onerror = () => { sprEu.src = estatico(vencedor.dex); sprEu.classList.add('sem-costas'); };
      $('.pk-hp-op .n').textContent = '@' + outro.usuario; $('.pk-hp-op .pk-hp-p').textContent = nomeDe(outro.dex);
      $('.pk-hp-eu .n').textContent = '@' + vencedor.usuario; $('.pk-hp-eu .pk-hp-p').textContent = nomeDe(vencedor.dex);
      const vida = (lado, v) => { const b = $('.pk-hp-' + lado + ' .pk-hp-v'); b.style.width = v + '%'; b.style.background = v > 50 ? '#58d080' : v > 20 ? '#f8c030' : '#f05838'; };
      const nOp = nomeDe(outro.dex) + ' de @' + outro.usuario, nEu = nomeDe(vencedor.dex) + ' de @' + vencedor.usuario;
      const especial = Math.random() < 0.25 ? escolherDe(ESPECIAIS)[0] : null;
      const vEu1 = Math.round(alea(30, 60)), vOp1 = Math.round(alea(35, 60));
      const passos = [
        { txt: 'Restam 2! O duelo final vai começar!' },
        { txt: nOp + ' ' + escolherDe(GOLPES) + '!', alvo: 'eu', eu: vEu1 },
        { txt: nEu + ' ' + escolherDe(GOLPES) + '!', alvo: 'op', op: vOp1 },
        { txt: nOp + ' ' + escolherDe(GOLPES) + '!', alvo: 'eu', eu: Math.max(8, vEu1 - Math.round(alea(15, 25))) },
        { txt: nEu + (especial ? ' usou ' + especial + '!' : ' ' + escolherDe(GOLPES) + '!'), alvo: 'op', op: 0, forte: !!especial },
        { txt: nOp + ' desmaiou!', desmaia: true },
      ];
      let i = 0;
      const tocar = () => {
        if (parado) return;
        const s = passos[i];
        const caixa = $('.pk-texto div');
        let n = 0; caixa.textContent = '';
        const letra = setInterval(() => { if (parado) return clearInterval(letra); caixa.textContent = s.txt.slice(0, ++n); if (n >= s.txt.length) clearInterval(letra); }, 26);
        if (s.alvo) {
          const atk = s.alvo === 'op' ? sprEu : sprOp, alvo = s.alvo === 'op' ? sprOp : sprEu;
          // uma animação por vez em cada sprite (duas classes juntas, só uma tocava)
          const limpa = (x) => { x.classList.remove('golpeia', 'golpeia-op', 'apanha'); void x.offsetWidth; };
          limpa(atk); atk.classList.add(s.alvo === 'op' ? 'golpeia' : 'golpeia-op');
          if (s.forte) d.classList.add('clarao');
          depois(450, () => { limpa(alvo); alvo.classList.add('apanha'); });
          depois(800, () => { if (s.eu != null) { vida('eu', s.eu); $('.pk-hp-num').textContent = Math.round(1.2 * s.eu) + '/120'; } if (s.op != null) vida('op', s.op); d.classList.remove('clarao'); });
        }
        if (s.desmaia) sprOp.classList.add('desmaia');
        i++;
        if (i < passos.length) depois(s.desmaia ? 1600 : 2100, tocar);
        else depois(1700, mostrarVencedor);
      };
      depois(450, tocar);
    }

    // ---------------------------------------------------------- vencedor
    function mostrarVencedor() {
      if (fase === 'vencedor') return;
      fase = 'vencedor';
      camada.querySelectorAll('.pk-duelo, .pk-campo, .pk-saguao').forEach((x) => { x.classList.add('saindo'); depois(400, () => x.remove()); });
      const v = el('div', 'pk-vencedor');
      const cf = el('canvas', 'pk-confete');
      const centro = el('div', 'pk-v-centro');
      const im = el('img', 'pk-v-img'); im.alt = '';
      im.src = animado(vencedor.dex, false); im.onerror = () => { im.src = estatico(vencedor.dex); };
      const faixa = el('div', 'pk-v-faixa', '@' + vencedor.usuario + ' venceu!');
      faixa.appendChild(el('small', null, nomeDe(vencedor.dex) + ' foi o último de pé · ' + pessoas.length + ' Pokémon na batalha'));
      centro.append(im, faixa);
      v.append(cf, centro);
      camada.appendChild(v);
      // confete
      const r = cf.getBoundingClientRect(); cf.width = r.width; cf.height = r.height;
      const x = cf.getContext('2d');
      const pecas = Array.from({ length: 160 }, () => ({ x: Math.random() * cf.width, y: -Math.random() * cf.height, v: 1 + Math.random() * 2.5, a: Math.random() * 6, cor: escolherDe(CORES) }));
      (function anima() {
        if (parado || !v.isConnected) return;
        x.clearRect(0, 0, cf.width, cf.height);
        pecas.forEach((p) => { p.y += p.v; p.a += 0.05; if (p.y > cf.height) p.y = -10; x.fillStyle = p.cor; x.save(); x.translate(p.x + Math.sin(p.a) * 12, p.y); x.rotate(p.a); x.fillRect(-4, -2, 8, 4); x.restore(); });
        requestAnimationFrame(anima);
      })();
      // como na corrida: a tela fica 3 s com o vencedor e fecha
      depois(3600, () => op.aoFim && op.aoFim());
    }

    // ---------------------------------------------------------- teclas
    const tecla = (ev) => {
      if (parado) return;
      if (ev.key === 'Escape') { ev.preventDefault(); op.aoFim && op.aoFim(); }
      else if (fase === 'saguao' && (ev.key === 'Enter' || ev.key === ' ') && document.activeElement !== btn) { ev.preventDefault(); comecarCampo(); }
    };
    document.addEventListener('keydown', tecla);

    return {
      escolher,
      iniciar: comecarCampo,
      get fase() { return fase; },
      get estado() { return estado; },   // para depurar
      parar() {
        parado = true;
        timers.forEach(clearTimeout); timers.clear();
        document.removeEventListener('keydown', tecla);
      },
    };
  }

  window.BJPokemon = { buscar, nomeDe, dexDoId, estatico, animado, batalhar, MAX_DEX };
})();
