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

  // ------------------------------------------------------------ som
  // Músicas em arquivo (sons/), se existirem: o tema de batalha no campo, o
  // do duelo final e a fanfarra da vitória. Os efeitos (golpe, nocaute,
  // subiu de nível, especial) são gerados na hora com Web Audio, no timbre de
  // Game Boy: tocam dezenas de vezes numa briga cheia e assim não pesam.
  // M liga/desliga (a mesma escolha da corrida de patos).
  const MUSICAS = { campo: 'sons/pokemon-batalha.mp3', duelo: 'sons/pokemon-duelo.mp3', vitoria: 'sons/pokemon-vitoria.mp3' };
  const buffersMusica = {};
  let carregandoMusicas = null;
  function carregarMusicas() {
    if (carregandoMusicas) return carregandoMusicas;
    const Off = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!Off || !window.fetch) return (carregandoMusicas = Promise.resolve());
    const dec = new Off(2, 1, 44100);
    carregandoMusicas = Promise.all(Object.entries(MUSICAS).map(([k, url]) => fetch(url)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error('sem ' + k))))
      .then((b) => dec.decodeAudioData(b))
      .then((b) => { buffersMusica[k] = b; })
      .catch(() => { /* sem o arquivo: só os efeitos */ })));
    return carregandoMusicas;
  }
  function criarSom() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    let mudo = false;
    try { mudo = localStorage.getItem('bj-som-corrida') === 'mudo'; } catch (e) { /* sem storage */ }
    const nada = { musica() {}, golpe() {}, nocaute() {}, subiu() {}, cura() {}, carga() {}, impacto() {}, alternar() {}, fechar() {} };
    if (!Ctx) return nada;
    let ac;
    try { ac = new Ctx(); } catch (e) { return nada; }
    if (ac.state === 'suspended') ac.resume().catch(() => {});
    // volume geral ~6 dB acima do antigo (0,8), para ouvir bem no alto-falante
    // do notebook e o celular captar; o limitador na saída segura os picos
    // para o som não estourar quando vários efeitos tocam juntos
    const VOLUME = 1.6;
    const limitador = ac.createDynamicsCompressor();
    limitador.threshold.value = -10; limitador.knee.value = 6; limitador.ratio.value = 12;
    limitador.attack.value = 0.003; limitador.release.value = 0.25;
    limitador.connect(ac.destination);
    const mestre = ac.createGain(); mestre.gain.value = mudo ? 0 : VOLUME; mestre.connect(limitador);
    const efeitos = ac.createGain(); efeitos.gain.value = 0.55; efeitos.connect(mestre);
    const musicaG = ac.createGain(); musicaG.gain.value = 0.42; musicaG.connect(mestre);
    let tocando = null, tocandoNome = '';
    const ruido = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const dd = ruido.getChannelData(0); for (let i = 0; i < dd.length; i++) dd[i] = Math.random() * 2 - 1;
    const saida = (pan) => {
      if (!ac.createStereoPanner) return efeitos;
      const p = ac.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan || 0)); p.connect(efeitos); return p;
    };
    const tom = (tipo, f0, f1, ini, dura, vol, destino) => {
      const o = ac.createOscillator(); o.type = tipo;
      o.frequency.setValueAtTime(f0, ini); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), ini + dura);
      const g = ac.createGain(); g.gain.setValueAtTime(vol, ini); g.gain.exponentialRampToValueAtTime(0.001, ini + dura);
      o.connect(g); g.connect(destino); o.start(ini); o.stop(ini + dura + 0.02);
    };
    const chiado = (ini, dura, vol, freq, destino, tipo) => {
      const s = ac.createBufferSource(); s.buffer = ruido;
      const f = ac.createBiquadFilter(); f.type = tipo || 'bandpass'; f.frequency.value = freq; f.Q.value = 1.2;
      const g = ac.createGain(); g.gain.setValueAtTime(vol, ini); g.gain.exponentialRampToValueAtTime(0.001, ini + dura);
      s.connect(f); f.connect(g); g.connect(destino); s.start(ini); s.stop(ini + dura + 0.02);
    };
    // golpes no máximo ~14 por segundo (numa briga cheia, mais que isso vira barulho)
    let ultimoGolpe = 0;
    return {
      // troca a música (com um corte suave); sem o arquivo, mantém a que está tocando
      musica(nome, laco = true) {
        const b = buffersMusica[nome];
        if (!b || tocandoNome === nome) return;
        const t = ac.currentTime;
        if (tocando) {
          const velho = tocando;
          velho.g.gain.setTargetAtTime(0, t, 0.25);
          setTimeout(() => { try { velho.s.stop(); } catch (e) { /* já parou */ } }, 1500);
        }
        const g = ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1, t + 0.4); g.connect(musicaG);
        const s = ac.createBufferSource(); s.buffer = b; s.loop = laco; s.connect(g); s.start(t);
        tocando = { s, g }; tocandoNome = nome;
      },
      golpe(pan) {
        const t = ac.currentTime;
        if (t - ultimoGolpe < 0.07) return;
        ultimoGolpe = t;
        const o = saida(pan);
        chiado(t, 0.09, 0.5, 1400 + Math.random() * 900, o);
        tom('square', 160, 55, t, 0.08, 0.22, o);
      },
      // desmaio: o tom descendo com vibrato, como no jogo
      nocaute(pan) {
        const t = ac.currentTime, o = saida(pan);
        const os = ac.createOscillator(); os.type = 'square';
        os.frequency.setValueAtTime(900, t); os.frequency.exponentialRampToValueAtTime(110, t + 0.55);
        const lfo = ac.createOscillator(); lfo.frequency.value = 22; const pr = ac.createGain(); pr.gain.value = 40; lfo.connect(pr); pr.connect(os.frequency);
        const g = ac.createGain(); g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
        os.connect(g); g.connect(o); os.start(t); lfo.start(t); os.stop(t + 0.62); lfo.stop(t + 0.62);
      },
      // subiu de nível: três notinhas subindo
      subiu(pan) {
        const t = ac.currentTime, o = saida(pan);
        [1047, 1319, 1568].forEach((f, i) => tom('square', f, f, t + i * 0.07, 0.09, 0.07, o));
      },
      // cura: arpejo suave subindo, duas vezes
      cura(pan) {
        const t = ac.currentTime, o = saida(pan);
        [523, 659, 784, 1047, 784, 1047, 1319, 1568].forEach((f, i) => tom('triangle', f, f, t + i * 0.08, 0.16, 0.09, o));
      },
      // carga do especial: um tom subindo e tremendo
      carga(pan) {
        const t = ac.currentTime, o = saida(pan);
        const os = ac.createOscillator(); os.type = 'sawtooth';
        os.frequency.setValueAtTime(180, t); os.frequency.exponentialRampToValueAtTime(1400, t + 0.85);
        const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09, t + 0.7); g.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
        const lfo = ac.createOscillator(); lfo.frequency.value = 18; const pr = ac.createGain(); pr.gain.value = 0.05; lfo.connect(pr); pr.connect(g.gain);
        os.connect(g); g.connect(o); os.start(t); lfo.start(t); os.stop(t + 0.92); lfo.stop(t + 0.92);
      },
      // impacto do especial: estrondo grave com chiado
      impacto(pan) {
        const t = ac.currentTime, o = saida(pan);
        chiado(t, 0.6, 0.7, 900, o, 'lowpass');
        tom('sine', 110, 30, t, 0.45, 0.6, o);
      },
      alternar() {
        mudo = !mudo;
        try { localStorage.setItem('bj-som-corrida', mudo ? 'mudo' : 'som'); } catch (e) { /* sem storage */ }
        mestre.gain.setTargetAtTime(mudo ? 0 : VOLUME, ac.currentTime, 0.05);
      },
      fechar() {
        try { mestre.gain.setTargetAtTime(0, ac.currentTime, 0.15); } catch (e) { /* já fechado */ }
        setTimeout(() => ac.close().catch(() => {}), 700);
      },
    };
  }

  // Plataforma do duelo (Diamond/Pearl): beirada de terra clara com contorno
  // marrom, grama por cima e a borda da grama em pontas (tufos), em SVG.
  let urlPlat = '';
  function urlPlataforma() {
    if (urlPlat) return urlPlat;
    const rnd = semente(42), w = 300, cx = 150;
    let tufos = '';
    for (let i = 0; i <= 46; i++) {
      const a = Math.PI * (0.94 + 1.12 * (i / 46));   // da esquerda, por cima, até a direita
      const x = cx + Math.cos(a) * 138, y = 44 + Math.sin(a) * 25;
      const alto = 8 + rnd() * 9, larg = 4 + rnd() * 3, cor = i % 3 ? '#5cb840' : '#86d858';
      tufos += '<path d="M' + (x - larg).toFixed(1) + ' ' + (y + 3).toFixed(1) + 'L' + (x + rnd() * 3 - 1.5).toFixed(1) + ' ' + (y - alto).toFixed(1) + 'L' + (x + larg).toFixed(1) + ' ' + (y + 3).toFixed(1) + 'Z" fill="' + cor + '"/>';
    }
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' 90" preserveAspectRatio="none">'
      + '<ellipse cx="150" cy="54" rx="146" ry="32" fill="#e8d48a" stroke="#a07a30" stroke-width="3"/>'
      + '<ellipse cx="150" cy="58" rx="132" ry="22" fill="#d8bc6c"/>'
      + tufos
      + '<ellipse cx="150" cy="46" rx="138" ry="26" fill="#6cc84a"/>'
      + '<ellipse cx="150" cy="43" rx="112" ry="17" fill="#84d860"/>'
      + '<ellipse cx="135" cy="40" rx="60" ry="7" fill="#9ce672" opacity=".7"/>'
      + '</svg>';
    urlPlat = 'data:image/svg+xml,' + encodeURIComponent(svg);
    return urlPlat;
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

  // opcoes: {camada, participantes:[{id, usuario, dex, vida}], vencedorId, aoFim(), aoCancelar(),
  //          lateralHp: true = a barra lateral mostra o HP em pontos (senão, em %)}
  function batalhar(op) {
    const camada = op.camada;
    let fase = 'saguao', parado = false;
    // vida: HP máximo de cada um (vem do painel pela fatia da urna; sem teto)
    const pessoas = op.participantes.map((p) => ({ ...p, escolheu: !!p.dex, dex: p.dex || dexDoId(p.id), vida: Math.max(1, Math.round(p.vida || 100)) }));
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
    carregarMusicas();
    let som = null;   // criado no Iniciar (o navegador só deixa tocar depois de um clique)

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
      c.append(im, el('div', 'pk-card-nome', '@' + p.usuario), el('div', 'pk-card-poke'), el('div', 'pk-card-hp', 'HP ' + p.vida));
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
        + n + ' ' + (n === 1 ? 'escolheu' : 'escolheram') + ' · quem não escolher fica com um aleatório (?) · M liga/desliga o som';
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
    // O que pesa em tela cheia é pintar pixels: como na corrida de patos, a
    // batalha desenha numa resolução interna de até LARGURA_MAX e o navegador
    // estica (fica igual, é pixel art). Com muita gente, um pouco menos.
    let cv, ctx, W = 0, H = 0, E = 3, mapa = null, estado = null, cssW = 0, cssH = 0;
    const LARGURA_MAX = pessoas.length > 60 ? 1280 : 1440;
    function medir() {
      const r = cv.getBoundingClientRect();
      cssW = Math.round(r.width); cssH = Math.round(r.height);
      const k = Math.min(1, LARGURA_MAX / Math.max(1, r.width));
      W = Math.max(1, Math.round(r.width * k)); H = Math.max(1, Math.round(r.height * k));
      cv.width = W; cv.height = H;
      ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false;
      E = Math.max(2, Math.round(Math.min(W, H) / 260));
      mapa = fazerMapa(Math.ceil((W - coluna()) / E), Math.ceil(H / E));   // o campo é só a parte da esquerda
      etiquetas.clear(); sombra = null;
    }
    // Etiqueta pronta de cada Pokémon (caixa bege, borda e o @): um drawImage
    // por quadro em vez de medir e escrever o texto toda vez.
    const etiquetas = new Map();   // id -> {c, w, h, fs}
    let sombra = null, esperandoFonte = false;
    function etiquetaDe(p) {
      let t = etiquetas.get(p.id);
      if (t) return t;
      const k0 = estado.tam, fs = Math.max(7, Math.round(9 * k0));
      const medida = document.createElement('canvas').getContext('2d');
      medida.font = fs + 'px "Press Start 2P",monospace';
      // só o nome: o nível aparece na barra lateral, não no campo
      const nome = '@' + p.usuario;
      const w = Math.ceil(Math.max(medida.measureText(nome).width + 10, 50 * k0)), h = fs + 13;
      const c = document.createElement('canvas'); c.width = w + 2; c.height = h + 2;
      const x = c.getContext('2d');
      x.beginPath(); x.roundRect(1, 1, w, h, 3); x.fillStyle = '#f8f8d8'; x.fill();
      x.lineWidth = Math.max(1, E * 0.7); x.strokeStyle = '#506858'; x.stroke();
      x.font = fs + 'px "Press Start 2P",monospace'; x.fillStyle = '#383838'; x.textAlign = 'center'; x.textBaseline = 'top';
      x.fillText(nome, 1 + w / 2, 4);
      t = { c, w, h, fs };
      etiquetas.set(p.id, t);
      // a fonte de jogo pode não ter carregado ainda: refaz todas uma vez
      // quando ela chegar (antes, refazia a cada quadro e pesava)
      if (!esperandoFonte && document.fonts && document.fonts.load) {
        esperandoFonte = true;
        document.fonts.load(fs + 'px "Press Start 2P"').then(() => etiquetas.clear(), () => {});
      }
      return t;
    }
    function sombraPronta() {
      if (sombra) return sombra;
      const k0 = estado.tam, rx = Math.ceil(24 * k0), ry = Math.ceil(7 * k0);
      const c = document.createElement('canvas'); c.width = rx * 2 + 2; c.height = ry * 2 + 2;
      const x = c.getContext('2d');
      x.fillStyle = 'rgba(24,56,32,.3)'; x.beginPath(); x.ellipse(rx + 1, ry + 1, rx, ry, 0, 0, 6.29); x.fill();
      sombra = { c, rx: rx + 1, ry: ry + 1 };
      return sombra;
    }
    // A tela é dividida: à esquerda o campo; à direita a coluna do ranking
    // de quem está de pé, com fundo próprio (nada por cima do campo).
    const larguraRanking = () => Math.round(Math.max(200, Math.min(300, W * 0.22)));
    const coluna = () => larguraRanking() + 24;
    const meioCampo = () => (W - coluna()) / 2;
    const arena = () => ({ x0: 22 * E, y0: 30 * E, x1: W - coluna() - 22 * E, y1: H - 18 * E });

    function comecarCampo() {
      if (fase !== 'saguao') return;
      fase = 'campo';
      som = criarSom();
      carregarMusicas().then(() => { if (som && fase === 'campo') som.musica('campo'); });
      saguao.classList.add('saindo');
      depois(300, () => saguao.remove());
      cv = el('canvas', 'pk-campo');
      camada.appendChild(cv);
      medir();
      const A = arena();
      // com muita gente os Pokémon diminuem (mas não somem)
      const tam = Math.max(0.5, Math.min(1, Math.sqrt(50 / Math.max(1, pessoas.length))));
      // o dano acompanha a vida de quem está no meio (mediana): a briga dura o
      // mesmo e quem tem muito mais vida (32 entradas, por exemplo) aguenta
      // muito mais golpes. Com a média, um só com vida enorme fazia todo mundo
      // cair em poucos golpes.
      const vidas = pessoas.map((p) => p.vida).sort((a, b) => a - b);
      const vidaMedia = vidas.length ? vidas[Math.floor((vidas.length - 1) / 2)] : 100;
      estado = {
        t0: performance.now(), ultimo: performance.now(), log: [], faiscas: [], numeros: [], especial: null, tam, escalaDano: vidaMedia / 100,
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
    // quantos ainda estão de pé (conferido a cada golpe: dois golpes no mesmo
    // quadro podiam levar de 3 para 1 e o duelo ficava sem adversário)
    const emPe = () => { let n = 0; for (const x of estado.vivos) if (!x.morto && !x.caindo) n++; return n; };
    const lado = (p) => (W ? (p.x / W) * 2 - 1 : 0);
    function ferir(p, dano, agora, atacante) {
      if (p.caindo) return;
      const antes = p.hp;
      // o vencedor sorteado nunca desmaia; e com 2 de pé ninguém mais cai no
      // campo: os dois últimos se resolvem no duelo final
      const piso = p.ganha ? 0.22 : emPe() <= 2 ? 0.05 : 0;
      // o dano vem em pontos de uma vida de 100: quem tem mais vida perde
      // uma fatia menor da barra com o mesmo golpe
      p.hp = Math.max(piso, p.hp - dano * 100 / p.vida);
      p.treme = agora;
      if (atacante) { estado.numeros.push({ x: p.x, y: p.y - 70 * estado.tam, ini: agora, txt: '-' + Math.max(1, Math.round((antes - p.hp) * p.vida)) }); if (som) som.golpe(lado(p)); }
      if (p.hp <= 0) derrubar(p, agora, atacante);
    }
    // Recompensa por nocaute: quem derruba alguém sobe de nível, bate 10% mais
    // forte e ataca 8% mais rápido, acumulando até 4 nocautes. Não muda quem
    // ganha (já sorteado): muda a história da briga.
    const MAX_BONUS = 4;
    const bonus = (p) => Math.min(p.kos || 0, MAX_BONUS);
    function derrubar(q, agora, atacante) {
      q.hp = 0; q.caindo = agora;
      estado.ultimoCaido = q;
      if (som) som.nocaute(lado(q));
      if (atacante && !atacante.caindo) {
        atacante.kos = (atacante.kos || 0) + 1;
        estado.numeros.push({ x: atacante.x, y: atacante.y - 86 * estado.tam, ini: agora, txt: 'SUBIU!', cor: '#7ad151' });
        narrar('@' + atacante.usuario + ' derrubou @' + q.usuario + '!');
        if (som) setTimeout(() => som && som.subiu(lado(atacante)), 350);
      } else narrar('@' + q.usuario + ' desmaiou!');
    }
    function iniciarEspecial(p, q, agora) {
      const [nome, cor] = escolherDe(ESPECIAIS);
      estado.especial = { de: p, para: q, ini: agora, nome, cor, bateu: false };
      p.olha = q.x > p.x ? 1 : -1;
      narrar('@' + p.usuario + ' usou ' + nome + '!');
      if (som) som.carga(lado(p));
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
        if (som) som.impacto(lado(s.para));
        const q = s.para;
        q.treme = agora;
        // o vencedor aguenta; e se já só restam 2 de pé, o alvo também aguenta
        if (q.ganha || emPe() <= 2 || s.de.caindo) {
          q.hp = Math.min(q.hp, 0.12);
          estado.numeros.push({ x: q.x, y: q.y - 80 * estado.tam, ini: agora, txt: 'AGUENTOU!', grande: true });
          narrar('@' + q.usuario + ' aguentou o ' + s.nome + '!');
        } else {
          estado.numeros.push({ x: q.x, y: q.y - 80 * estado.tam, ini: agora, txt: 'NOCAUTE!', grande: true });
          derrubar(q, agora, s.de);
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
            p.recarga = agora + alea(700, 1300) * (1 - 0.08 * bonus(p));
            // Um alvo por vez: só quem ataca dá dano. Quem apanha não devolve
            // nada nesse golpe (não tinha escolhido brigar com quem bateu).
            ferir(q, alea(0.12, 0.24) * e.escalaDano * furia * (1 + 0.1 * bonus(p)) * (q.ganha ? 0.6 : 1), agora, p);
            q.vx += (dx / d) * 260; q.vy += (dy / d) * 260;
            e.faiscas.push({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 - 30 * e.tam, ini: agora, cor: escolherDe(CORES) });
            if (Math.random() < 0.3) narrar('@' + p.usuario + ' ' + escolherDe(GOLPES) + '!');
            // Quem apanhou só vira contra quem bateu se estava livre (sem alvo ou
            // com o alvo longe); se já estava brigando com outro, continua nele.
            const ocupado = q.alvo && !q.alvo.caindo && !q.alvo.morto && Math.hypot(q.alvo.x - q.x, q.alvo.y - q.y) < encosta * 2;
            if (!q.caindo && !ocupado && Math.random() < 0.6) { q.alvo = p; q.trocaAlvo = agora + alea(2000, 3500); }
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
      const sb = sombraPronta();
      ctx.drawImage(sb.c, Math.round(p.x - sb.rx), Math.round(p.y + 4 - sb.ry));
      const anim = quadroAnimado(p.dex, agora, p.fase);
      const im = estaticos[p.dex];
      if (anim || (im && im.complete && im.naturalWidth)) {
        ctx.save();
        ctx.translate(Math.round(p.x + dx), Math.round(p.y + 6 - pulo + dy));
        if (escala !== 1) ctx.scale(escala, escala);
        // os sprites de frente olham para a esquerda: vira quando anda para a direita
        if (p.olha > 0) ctx.scale(-1, 1);
        let sw, sh, fonte;
        if (anim) { const k = 1.4 * k0; sw = anim.width * k; sh = anim.height * k; fonte = anim; }
        else { sw = sh = 72 * k0; fonte = im; }
        ctx.drawImage(fonte, -sw / 2, -sh, sw, sh);
        // clarão de quando apanha: o mesmo sprite somado por cima (o filtro
        // de brilho, com dezenas de golpes por quadro, era o que pesava)
        if (p.treme && agora - p.treme < 120) {
          ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= 0.8;
          ctx.drawImage(fonte, -sw / 2, -sh, sw, sh);
        }
        ctx.restore();
      }
      // etiqueta no estilo da caixa de HP do jogo (pronta) e a barrinha de HP
      const tg = etiquetaDe(p);
      const ty = Math.round(p.y + 9), tx = Math.round(p.x - tg.w / 2 - 1);
      ctx.drawImage(tg.c, tx, ty);
      const bw = tg.w - 10, by = ty + tg.fs + 7;
      ctx.fillStyle = '#506858'; ctx.fillRect(tx + 6, by, bw, 4);
      if (p.hp > 0) { ctx.fillStyle = p.hp > 0.5 ? '#58d080' : p.hp > 0.2 ? '#f8c030' : '#f05838'; ctx.fillRect(tx + 7, by + 1, (bw - 2) * p.hp, 2); }
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
    // s: {de:{x,y}, para:{x,y}, ini, nome, cor}; k0: escala dos Pokémon. O
    // duelo chama com o canvas dele no lugar de ctx (ver especialNoDuelo).
    function desenharEspecial(agora, s = estado && estado.especial, k0 = estado ? estado.tam : 1) {
      if (!s) return;
      const t = agora - s.ini, ti = t - CARGA_MS, kc = Math.min(1, t / CARGA_MS);
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

    // Ranking à direita, numa caixa do jogo: quem está de pé, do mais inteiro
    // para o mais machucado, com o ícone do Pokémon, o @, a barrinha e o %.
    // Cabe o que der na altura; o resto vira "+N".
    function desenharRanking(e) {
      const rw = larguraRanking(), cx0 = W - coluna(), x0 = cx0 + 12, y0 = 12, alt = H - 24;
      // fundo da coluna: o azul dos menus do jogo, com uma borda separando do campo
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#5878b8'); g.addColorStop(1, '#384c88');
      ctx.fillStyle = g; ctx.fillRect(cx0, 0, coluna(), H);
      ctx.fillStyle = 'rgba(255,255,255,.06)';
      for (let yy = -H; yy < H; yy += 18) { ctx.beginPath(); ctx.moveTo(cx0, yy); ctx.lineTo(W, yy + coluna()); ctx.lineTo(W, yy + coluna() + 8); ctx.lineTo(cx0, yy + 8); ctx.closePath(); ctx.fill(); }
      ctx.fillStyle = '#283048'; ctx.fillRect(cx0, 0, 4, H);
      caixaTexto(x0, y0, rw, alt);
      const vivos = e.vivos.filter((p) => !p.morto && !p.caindo).sort((a, b) => b.hp - a.hp || (b.kos || 0) - (a.kos || 0));
      ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
      ctx.font = '11px "Press Start 2P",monospace'; ctx.fillStyle = '#383838';
      ctx.fillText('VIVOS: ' + vivos.length, x0 + 16, y0 + 24);
      ctx.fillStyle = '#a0a8b8'; ctx.fillRect(x0 + 12, y0 + 40, rw - 24, 2);
      const linha = 34, cabem = Math.max(1, Math.floor((alt - 60) / linha));
      const mostra = vivos.length > cabem ? cabem - 1 : cabem;
      vivos.slice(0, mostra).forEach((p, i) => {
        const y = y0 + 50 + i * linha;
        const im = estaticos[p.dex];
        if (im && im.complete && im.naturalWidth) ctx.drawImage(im, x0 + 10, y - 2, 30, 30);
        ctx.fillStyle = '#383838'; ctx.font = '9px "Press Start 2P",monospace';
        const nome = '@' + p.usuario;
        const max = Math.floor((rw - 104) / 9);
        ctx.fillText(nome.length > max ? nome.slice(0, max - 1) + '.' : nome, x0 + 44, y + 7);
        if (p.kos) { ctx.fillStyle = '#3c8c3c'; ctx.textAlign = 'right'; ctx.fillText('Nv' + (50 + p.kos), x0 + rw - 14, y + 7); ctx.textAlign = 'left'; }
        // barrinha de HP no estilo do jogo, com a porcentagem
        const bx = x0 + 44, bw = rw - 104, by = y + 17;
        ctx.fillStyle = '#f8b030'; ctx.font = '7px "Press Start 2P",monospace'; ctx.fillText('HP', bx, by + 3);
        ctx.fillStyle = '#506858'; ctx.fillRect(bx + 18, by, bw - 18, 6);
        ctx.fillStyle = p.hp > 0.5 ? '#58d080' : p.hp > 0.2 ? '#f8c030' : '#f05838';
        ctx.fillRect(bx + 19, by + 1, Math.max(0, (bw - 20) * p.hp), 4);
        ctx.fillStyle = '#383838'; ctx.font = '8px "Press Start 2P",monospace'; ctx.textAlign = 'right';
        // HP em pontos (aba Batalha) ou em porcentagem (sorteio)
        ctx.fillText(op.lateralHp ? String(Math.max(1, Math.round(p.hp * p.vida))) : Math.max(1, Math.round(p.hp * 100)) + '%', x0 + rw - 14, by + 4);
        ctx.textAlign = 'left';
      });
      if (vivos.length > mostra) {
        ctx.fillStyle = '#707880'; ctx.font = '9px "Press Start 2P",monospace'; ctx.textAlign = 'center';
        ctx.fillText('+' + (vivos.length - mostra) + ' vivos', x0 + rw / 2, y0 + 50 + mostra * linha + 10);
        ctx.textAlign = 'left';
      }
    }

    function quadro(agora) {
      if (parado || fase !== 'campo') return;
      const ini = performance.now();
      desenharCampo(agora);
      // custo médio de cada quadro (para depurar: __bjBatalha.estado.msQuadro)
      if (estado) estado.msQuadro = (estado.msQuadro || 0) * 0.95 + (performance.now() - ini) * 0.05;
      if (fase === 'campo' && !parado) requestAnimationFrame(quadro);
    }
    function desenharCampo(agora) {
      if (cv.clientWidth !== cssW || cv.clientHeight !== cssH) medir();
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
        ctx.globalAlpha = 1 - k * k; ctx.lineWidth = n.grande ? 6 : 4; ctx.strokeStyle = '#000'; ctx.fillStyle = n.cor || (n.grande ? '#ffd84a' : '#fff');
        ctx.strokeText(n.txt, n.x, n.y - k * 26); ctx.fillText(n.txt, n.x, n.y - k * 26);
        return true;
      });
      ctx.globalAlpha = 1;
      // placar e narração em caixas de texto do jogo
      const restam = e.vivos.filter((p) => !p.caindo && !p.morto).length;
      ctx.font = '16px "Press Start 2P",monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const txt = 'RESTAM ' + restam;
      const tw = ctx.measureText(txt).width + 40;
      caixaTexto(meioCampo() - tw / 2, 14, tw, 46);
      ctx.fillStyle = '#383838'; ctx.fillText(txt, meioCampo(), 38);
      // narração embaixo, à esquerda do campo
      if (e.log.length) {
        const lw = Math.min(560, (W - coluna()) * 0.62), lh = 26 + e.log.length * 22;
        caixaTexto(16, H - lh - 14, lw, lh);
        ctx.font = '11px "Press Start 2P",monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillStyle = '#383838';
        // cada letra da fonte de jogo tem 11 px: corta na largura da caixa
        const cabe = Math.max(10, Math.floor((lw - 40) / 11));
        e.log.forEach((l, i) => { ctx.globalAlpha = 1 - i * 0.2; ctx.fillText(l.length > cabe ? l.slice(0, cabe - 1) + '.' : l, 34, H - lh + 2 + i * 22); });
        ctx.globalAlpha = 1;
      }
      desenharRanking(e);
      if (e.acabou) {
        const k = Math.min(1, (agora - e.acabou) / 300);
        ctx.font = '22px "Press Start 2P",monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.globalAlpha = k; ctx.lineWidth = 7; ctx.strokeStyle = '#000'; ctx.fillStyle = '#ffd84a';
        ctx.strokeText('RESTAM 2! DUELO FINAL!', meioCampo(), H / 2); ctx.fillText('RESTAM 2! DUELO FINAL!', meioCampo(), H / 2);
        ctx.globalAlpha = 1;
        if (agora - e.acabou > 1800) comecarDuelo();
      }
    }

    // ---------------------------------------------------------- duelo final
    // A tela de batalha do Ruby/Emerald: o vencedor de costas (embaixo, à
    // esquerda), o último adversário de frente (em cima, à direita), caixas
    // de HP e o texto aparecendo letra por letra.
    function comecarDuelo() {
      if (fase === 'duelo' || fase === 'vencedor') return;
      fase = 'duelo';
      if (som) som.musica('duelo');
      // o adversário é quem sobrou de pé (se por algum motivo não houver, o
      // último que caiu; nunca alguém qualquer da lista)
      const resto = estado ? estado.vivos.filter((p) => !p.morto && !p.caindo && !p.ganha) : [];
      const outro = resto[0] || (estado && estado.ultimoCaido) || pessoas.find((p) => p !== vencedor);
      if (!outro) { mostrarVencedor(); return; }
      const d = el('div', 'pk-duelo');
      // a cena (em cima) é medida em unidades da própria cena, como a tela do
      // jogo: tudo mantém a proporção em qualquer tamanho de janela
      d.innerHTML = '<div class="pk-cena"><div class="pk-ceu"></div>'
        + '<div class="pk-plat pk-plat-op"></div><div class="pk-plat pk-plat-eu"></div>'
        + '<img class="pk-spr pk-spr-op" alt=""><img class="pk-spr pk-spr-eu" alt="">'
        + '<div class="pk-hp pk-hp-op"><div class="pk-hp-caixa"><div class="pk-hp-l"><span class="n"></span><span class="nv">Nv50</span></div><div class="pk-hp-b"><b>HP</b><div class="pk-hp-t"><div class="pk-hp-v"></div></div></div><div class="pk-hp-num"></div></div></div>'
        + '<div class="pk-hp pk-hp-eu"><div class="pk-hp-caixa"><div class="pk-hp-l"><span class="n"></span><span class="nv">Nv50</span></div><div class="pk-hp-b"><b>HP</b><div class="pk-hp-t"><div class="pk-hp-v"></div></div></div><div class="pk-hp-num"></div></div></div>'
        + '</div><div class="pk-texto"><div></div></div>';
      camada.appendChild(d);
      if (cv) { cv.classList.add('saindo'); depois(400, () => cv && cv.remove()); }
      const $ = (s) => d.querySelector(s);
      d.querySelectorAll('.pk-plat').forEach((pl) => { pl.style.backgroundImage = 'url("' + urlPlataforma() + '")'; });
      // O lado do vencedor é sorteado: metade das vezes ele fica embaixo (de
      // costas), metade em cima (de frente). Antes ficava sempre embaixo e dava
      // para saber quem ia ganhar antes do fim. 'eu' = embaixo, 'op' = em cima.
      const ladoGanha = Math.random() < 0.5 ? 'eu' : 'op', ladoPerde = ladoGanha === 'eu' ? 'op' : 'eu';
      const quemNo = { [ladoGanha]: vencedor, [ladoPerde]: outro };
      const sprOp = $('.pk-spr-op'), sprEu = $('.pk-spr-eu');
      sprOp.src = animado(quemNo.op.dex, false); sprOp.onerror = () => { sprOp.src = estatico(quemNo.op.dex); };
      sprEu.src = animado(quemNo.eu.dex, true); sprEu.onerror = () => { sprEu.src = estatico(quemNo.eu.dex); sprEu.classList.add('sem-costas'); };
      // Cada um entra com a vida dele (a mesma do campo: mais entradas, mais HP)
      // e a barra cheia. Os números e a barra andam em pontos de vida de verdade.
      const MAX = { [ladoGanha]: Math.max(1, Math.round(vencedor.vida || 100)), [ladoPerde]: Math.max(1, Math.round(outro.vida || 100)) };
      const hpAgora = { op: MAX.op, eu: MAX.eu };
      const pintarNum = (lado, n) => { $('.pk-hp-' + lado + ' .pk-hp-num').textContent = n + '/' + MAX[lado]; };
      ['op', 'eu'].forEach((l) => { $('.pk-hp-' + l + ' .n').textContent = '@' + quemNo[l].usuario; pintarNum(l, MAX[l]); });
      // o número corre junto com a barra (~0,6 s), como no jogo
      function contarHp(lado, alvo) {
        const de = hpAgora[lado], ini = performance.now();
        hpAgora[lado] = alvo;
        const passo = (t) => {
          if (parado) return;
          const k = Math.min(1, (t - ini) / 600);
          pintarNum(lado, Math.round(de + (alvo - de) * k));
          if (k < 1 && hpAgora[lado] === alvo) requestAnimationFrame(passo);
        };
        requestAnimationFrame(passo);
      }
      // número subindo em cima do Pokémon, como no campo: "-23" no golpe, "+12" na cura
      function numeroNoSprite(lado, txt, tipo) {
        const spr = lado === 'op' ? sprOp : sprEu, cena = $('.pk-cena');
        const rs = spr.getBoundingClientRect(), rc = cena.getBoundingClientRect();
        const n = el('div', 'pk-dano' + (tipo ? ' ' + tipo : ''), txt);
        n.style.left = (rs.left - rc.left + rs.width / 2) + 'px';
        n.style.top = (rs.top - rc.top + rs.height * 0.18) + 'px';
        cena.appendChild(n);
        depois(1100, () => n.remove());
      }
      const vida = (lado, v) => {
        const pct = (v / MAX[lado]) * 100;
        const b = $('.pk-hp-' + lado + ' .pk-hp-v'); b.style.width = pct + '%'; b.style.background = pct > 50 ? '#58d080' : pct > 20 ? '#f8c030' : '#f05838';
        contarHp(lado, v);
      };
      const nomeNo = (l) => nomeDe(quemNo[l].dex) + ' de @' + quemNo[l].usuario;
      // Roteiro de ~20 s: rodadas de duas ações (quem começa é sorteado) e o
      // golpe final é sempre do vencedor, esteja ele em cima ou embaixo; quem
      // perde nunca cai antes do fim e o vencedor nunca chega a zero.
      //
      // A vida conta: cada um tem a vida dele e o dano é em pontos.
      //   - quem perde bate em pedaços da MENOR vida dos dois, do mesmo tamanho
      //     que os golpes de quem ganha teriam com vidas iguais: em quem tem
      //     muito mais vida a barra quase não mexe;
      //   - os golpes de quem ganha levam quem perde do cheio até o alcance do
      //     golpe final: se quem perde tem bem mais vida, cada golpe é enorme
      //     ("É super efetivo!") — é assim que o azarão derruba o favorito.
      // Com vidas iguais os dois perdem mais ou menos o mesmo por golpe.
      //
      // O roteiro é planejado antes (quantas rodadas, quem cura e quando) e o
      // dano é dividido para caber: todo golpe tira vida de verdade e ninguém
      // fica parado no piso (antes, quem estava no piso "tomava" o golpe sem
      // perder nada). Sortear golpes ao acaso e descartar os roteiros que não
      // cabiam favorecia, sem querer, os roteiros com cura.
      //
      // Cura: cada lado decide sozinho se vai curar (35%) e em qual das próprias
      // vezes (nunca a primeira, e o vencedor nunca na do golpe final). Não cura
      // com a vida acima de 80% nem logo depois de o outro curar.
      //
      // Especial: em 30% dos duelos, um dos dois (sorteado) usa um especial no
      // meio do duelo, com a mesma animação do campo. Tira 40 a 55% da vida do
      // outro, nunca na primeira vez de quem usa nem no golpe final. Ninguém cai
      // com ele: se passaria do piso, o alvo "AGUENTOU!" com um fio de vida.
      // É um dos golpes do plano: os outros golpes de quem usou encolhem para o
      // total continuar cabendo.
      const U = Math.min(MAX.eu, MAX.op);
      const piso = (l) => Math.max(1, Math.ceil(MAX[l] * 0.08));
      const superEfetivo = MAX[ladoPerde] >= U * 1.5;
      const pesos = (n) => { const w = Array.from({ length: n }, () => alea(0.7, 1.3)); const t = w.reduce((x, y) => x + y, 0); return w.map((x) => x / t); };
      const roteiro = () => {
        const R = Math.random() < 0.6 ? 4 : 5;   // rodadas: ~8 ou ~10 ações
        const G = ladoGanha, P = ladoPerde;
        // quem começa é sorteado; se o vencedor começa, o golpe final abre a
        // última rodada e quem perde age uma vez a menos
        const ordem = Math.random() < 0.5 ? [P, G] : [G, P];
        const vezesP = ordem[0] === G ? R - 1 : R;
        // vez em que cada um cura (nunca a primeira; o vencedor nunca na do final), ou -1
        const curaP = vezesP > 1 && Math.random() < 0.35 ? 1 + Math.floor(Math.random() * Math.min(3, vezesP - 1)) : -1;
        const curaG = R > 2 && Math.random() < 0.35 ? 1 + Math.floor(Math.random() * Math.min(3, R - 2)) : -1;
        const golpesG = R - (curaG >= 0 ? 1 : 0);   // o último é o final
        const golpesP = vezesP - (curaP >= 0 ? 1 : 0);
        const ganhoP = curaP >= 0 ? Math.round(MAX[P] * alea(0.3, 0.45)) : 0;
        const ganhoG = curaG >= 0 ? Math.round(MAX[G] * alea(0.3, 0.45)) : 0;
        // quem perde: dos golpes normais do vencedor, sai do cheio (+ cura) e
        // termina ao alcance do golpe final (18 a 34% da vida)
        const fimP = Math.max(piso(P) + 1, Math.round(MAX[P] * alea(0.18, 0.34)));
        const danoG = pesos(golpesG - 1).map((w) => Math.max(1, Math.round(w * (MAX[P] + ganhoP - fimP))));
        // o vencedor: golpes do tamanho dos de quem ganha (com vidas iguais),
        // em pedaços da menor vida, encolhidos se não couberem
        const porGolpe = (1 - alea(0.18, 0.34)) / Math.max(1, R - 1);
        let danoP = Array.from({ length: golpesP }, () => Math.max(1, Math.round(U * porGolpe * alea(0.7, 1.3))));
        const cabe = MAX[G] + ganhoG - piso(G) - Math.ceil(MAX[G] * alea(0.02, 0.2));
        // especial: quem usa e em qual dos próprios golpes normais (nunca o primeiro)
        let esp = null;
        if (Math.random() < 0.3) {
          const quem = Math.random() < 0.5 ? G : P;
          const normais = quem === G ? golpesG - 1 : golpesP;
          if (normais >= 2) esp = { quem, idx: 1 + Math.floor(Math.random() * (normais - 1)), aguentou: false, ...(() => { const [nome, cor] = escolherDe(ESPECIAIS); return { nome, cor }; })() };
        }
        // encaixa o especial na lista de golpes de quem usa: ele pesa 40 a 55%
        // da vida do alvo e os outros golpes dividem o que sobra
        const encaixar = (lista, total, idx, forte) => {
          const outros = lista.length - 1;
          let grande = Math.min(forte, total - outros);
          if (grande < 1 || outros < 0) return null;
          const resto = total - grande, somaOutros = lista.reduce((x, y, j) => (j === idx ? x : x + y), 0) || 1;
          const nova = lista.map((d, j) => (j === idx ? grande : Math.max(1, Math.floor(d * resto / somaOutros))));
          return { nova, cortado: grande < forte };
        };
        if (esp && esp.quem === G) {
          const total = MAX[P] + ganhoP - fimP;
          const r = encaixar(danoG, total, esp.idx, Math.round(MAX[P] * alea(0.4, 0.55)));
          if (!r) return null;
          danoG.splice(0, danoG.length, ...r.nova);
        }
        let soma = danoP.reduce((x, y) => x + y, 0);
        if (soma > cabe) danoP = danoP.map((d) => Math.max(1, Math.floor(d * Math.max(1, cabe) / soma)));
        if (esp && esp.quem === P) {
          soma = danoP.reduce((x, y) => x + y, 0);
          const forte = Math.round(MAX[G] * alea(0.4, 0.55));
          // cabe inteiro? senão os outros golpes dele encolhem; se nem assim,
          // o vencedor aguenta com o que sobrar acima do piso
          const r = encaixar(danoP, Math.max(soma - danoP[esp.idx] + forte > cabe ? cabe : soma - danoP[esp.idx] + forte, danoP.length), esp.idx, forte);
          if (!r) return null;
          danoP = r.nova;
          esp.aguentou = r.cortado;
        }
        const hp = { [G]: MAX[G], [P]: MAX[P] };
        const lista = [{ txt: 'Restam 2! O duelo final vai começar!' }];
        let iG = 0, iP = 0, curouAntes = false;
        for (let r = 0; r < R; r++) {
          for (const quem of ordem) {
            const outro = quem === P ? G : P, nome = nomeNo(quem);
            const final = quem === G && r === R - 1;
            if (!final && r === (quem === P ? curaP : curaG)) {
              // curar com a vida quase cheia ou logo depois do outro não serve
              if (hp[quem] > MAX[quem] * 0.8 || curouAntes) return null;
              curouAntes = true;
              hp[quem] = Math.min(MAX[quem], hp[quem] + (quem === P ? ganhoP : ganhoG));
              lista.push({ txt: nome + ' usou ' + escolherDe(['RECUPERAR', 'DESCANSO', 'BROTO DE VIDA']) + '!', cura: quem, [quem]: hp[quem] });
              continue;
            }
            curouAntes = false;
            const golpe = nome + ' ' + escolherDe(GOLPES) + '!';
            if (final) {
              lista.push({ txt: golpe, alvo: outro, [outro]: 0 });
              lista.push({ txt: nomeNo(P) + ' desmaiou!', desmaia: true });
              return lista;
            }
            const idx = quem === G ? iG++ : iP++;
            const dano = quem === G ? danoG[idx] : danoP[idx];
            if (!(dano >= 1) || hp[outro] - dano < piso(outro)) return null;
            hp[outro] -= dano;
            if (esp && esp.quem === quem && esp.idx === idx) {
              // o especial "cortado" deixa o alvo com pouca vida: ele aguentou
              const aguentou = esp.aguentou || hp[outro] - piso(outro) < MAX[outro] * 0.05;
              lista.push({ txt: nome + ' usou ' + esp.nome + '!' + (aguentou ? ' @' + quemNo[outro].usuario + ' aguentou!' : ''),
                alvo: outro, [outro]: hp[outro], especial: esp, aguentou });
              continue;
            }
            lista.push({ txt: quem === G && superEfetivo ? golpe + ' É super efetivo!' : golpe, alvo: outro, [outro]: hp[outro] });
          }
        }
        return null;
      };
      let passos = null;
      for (let tentativa = 0; !passos && tentativa < 500; tentativa++) passos = roteiro();
      if (!passos) {
        // quase impossível (500 planos seguidos sem servir): só o golpe final
        passos = [{ txt: 'Restam 2! O duelo final vai começar!' },
          { txt: nomeNo(ladoGanha) + ' ' + escolherDe(GOLPES) + '!', alvo: ladoPerde, [ladoPerde]: 0 },
          { txt: nomeNo(ladoPerde) + ' desmaiou!', desmaia: true }];
      }
      // O especial no duelo: o mesmo desenho do campo num canvas por cima da
      // cena. Durante a carga quem usa cresce com a aura; no impacto o alvo
      // pisca, a vida desce e o número sobe.
      function especialNoDuelo(s) {
        const atkLado = s.alvo === 'op' ? 'eu' : 'op';
        const atk = atkLado === 'op' ? sprOp : sprEu, alvoSpr = s.alvo === 'op' ? sprOp : sprEu;
        const cena = $('.pk-cena');
        const fx = el('canvas', 'pk-fx');
        cena.appendChild(fx);
        const rc = cena.getBoundingClientRect();
        fx.width = Math.max(1, Math.round(rc.width)); fx.height = Math.max(1, Math.round(rc.height));
        const fctx = fx.getContext('2d');
        // o desenho mira 40*k0 acima do ponto: passa o pé do sprite + 40*k0
        const k0 = Math.max(0.6, Math.min(1.6, rc.height / 420));
        const ponto = (spr) => { const r = spr.getBoundingClientRect(); return { x: r.left - rc.left + r.width / 2, y: r.top - rc.top + r.height * 0.55 + 40 * k0 }; };
        const esp = { de: ponto(atk), para: ponto(alvoSpr), ini: performance.now(), nome: s.especial.nome, cor: s.especial.cor };
        atk.classList.add('carregando');
        if (som) som.carga(atkLado === 'op' ? 0.4 : -0.4);
        let bateu = false;
        const quadroFx = (agora) => {
          if (parado) return;
          fctx.clearRect(0, 0, fx.width, fx.height);
          const antes = ctx; ctx = fctx;
          try { desenharEspecial(agora, esp, k0); } finally { ctx = antes; }
          const t = agora - esp.ini;
          if (!bateu && t >= CARGA_MS) {
            bateu = true;
            atk.classList.remove('carregando');
            alvoSpr.classList.remove('golpeia', 'golpeia-op', 'apanha'); void alvoSpr.offsetWidth; alvoSpr.classList.add('apanha');
            if (som) som.impacto(s.alvo === 'op' ? 0.4 : -0.4);
            const dano = hpAgora[s.alvo] - s[s.alvo];
            if (dano > 0) numeroNoSprite(s.alvo, '-' + dano, 'forte');
            if (s.aguentou) depois(350, () => numeroNoSprite(s.alvo, 'AGUENTOU!', 'aguentou'));
            vida(s.alvo, s[s.alvo]);
          }
          if (t < CARGA_MS + IMPACTO_MS) requestAnimationFrame(quadroFx);
          else fx.remove();
        };
        requestAnimationFrame(quadroFx);
      }

      let i = 0;
      const tocar = () => {
        if (parado) return;
        const s = passos[i];
        const caixa = $('.pk-texto div');
        let n = 0; caixa.textContent = '';
        const letra = setInterval(() => { if (parado) return clearInterval(letra); caixa.textContent = s.txt.slice(0, ++n); if (n >= s.txt.length) clearInterval(letra); }, 26);
        if (s.especial) especialNoDuelo(s);
        else if (s.alvo) {
          const atk = s.alvo === 'op' ? sprEu : sprOp, alvo = s.alvo === 'op' ? sprOp : sprEu;
          // uma animação por vez em cada sprite (duas classes juntas, só uma tocava)
          const limpa = (x) => { x.classList.remove('golpeia', 'golpeia-op', 'apanha'); void x.offsetWidth; };
          limpa(atk); atk.classList.add(s.alvo === 'op' ? 'golpeia' : 'golpeia-op');
          depois(450, () => {
            limpa(alvo); alvo.classList.add('apanha'); if (som) som.golpe(s.alvo === 'op' ? 0.4 : -0.4);
            const dano = hpAgora[s.alvo] - s[s.alvo];
            if (s[s.alvo] != null && dano > 0) numeroNoSprite(s.alvo, '-' + dano);
          });
          depois(800, () => { if (s.eu != null) vida('eu', s.eu); if (s.op != null) vida('op', s.op); });
        }
        if (s.cura) {
          // cura: brilho verde subindo em volta do Pokémon e a barra enchendo
          const spr = s.cura === 'op' ? sprOp : sprEu;
          const brilho = el('div', 'pk-cura ' + (s.cura === 'op' ? 'pk-cura-op' : 'pk-cura-eu'));
          for (let b = 0; b < 14; b++) {
            const pt = el('i'); pt.style.left = (8 + Math.random() * 84) + '%'; pt.style.animationDelay = (Math.random() * 0.7).toFixed(2) + 's';
            brilho.appendChild(pt);
          }
          $('.pk-cena').appendChild(brilho);
          spr.classList.add('curando');
          if (som) som.cura(s.cura === 'op' ? 0.4 : -0.4);
          depois(700, () => {
            const ganho = s[s.cura] - hpAgora[s.cura];
            if (s[s.cura] != null && ganho > 0) numeroNoSprite(s.cura, '+' + ganho, 'cura');
            if (s.eu != null) vida('eu', s.eu);
            if (s.op != null) vida('op', s.op);
          });
          depois(1600, () => { brilho.remove(); spr.classList.remove('curando'); });
        }
        if (s.desmaia) { (ladoPerde === 'op' ? sprOp : sprEu).classList.add('desmaia'); if (som) som.nocaute(ladoPerde === 'op' ? 0.4 : -0.4); }
        i++;
        if (i < passos.length) depois(s.desmaia ? 1600 : s.especial ? 2700 : 1800, tocar);
        else depois(1700, mostrarVencedor);
      };
      depois(450, tocar);
    }

    // ---------------------------------------------------------- vencedor
    function mostrarVencedor() {
      if (fase === 'vencedor') return;
      fase = 'vencedor';
      if (som) som.musica('vitoria', false);
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
      // Esc antes de o vencedor aparecer cancela a batalha (quem chamou desfaz
      // o sorteio); depois dele, só fecha
      if (ev.key === 'Escape') { ev.preventDefault(); if (fase !== 'vencedor' && op.aoCancelar) op.aoCancelar(); else if (op.aoFim) op.aoFim(); }
      else if ((ev.key === 'm' || ev.key === 'M') && som) som.alternar();
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
        if (som) { som.fechar(); som = null; }
        timers.forEach(clearTimeout); timers.clear();
        document.removeEventListener('keydown', tecla);
      },
    };
  }

  window.BJPokemon = { buscar, nomeDe, dexDoId, estatico, animado, batalhar, MAX_DEX };
})();
