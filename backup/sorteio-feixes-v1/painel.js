// ============================================================================
// Painel do BetterJamble — interface.
//
// A camada de dados vive na aba da Jamble (gems-core.js) e manda pacotes
// prontos por uma porta persistente. Aqui só se desenha.
//
// O que NÃO se mexe: `ligar()`, `aplicar()` e `absorver()` são a cola com o
// protocolo (docs/HANDOFF.md, seção 4). Todo o resto é desenho.
//
// Mapa: docs/PAINEL.md — três telas (Ao vivo, Sorteio, Lives do vendedor),
// escopo e filtro morando dentro do card de ranking, seis estados vazios.
// ============================================================================
(() => {
  const $ = (id) => document.getElementById(id);

  // ------------------------------------------------------------------ formato
  const nf = (n) => Math.round(Number(n) || 0).toLocaleString('pt-BR');
  const brl = (n) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const hora = (t) => new Date(t).toLocaleTimeString('pt-BR', { hour12: false });
  const horaCurta = (t) => new Date(t).toLocaleTimeString('pt-BR', { hour12: false, hour: '2-digit', minute: '2-digit' });
  const pct = (n) => (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
  const plural = (n, um, muitos) => (Number(n) === 1 ? um : muitos);

  const DIA = 86400000;
  const soDia = (t) => { const d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };

  // "hoje, 20:14" / "ontem, 19:02" / "18/10, 20:30"
  function quando(t) {
    if (!t) return '—';
    const atraso = Math.round((soDia(Date.now()) - soDia(t)) / DIA);
    if (atraso === 0) return 'hoje, ' + horaCurta(t);
    if (atraso === 1) return 'ontem, ' + horaCurta(t);
    return new Date(t).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ', ' + horaCurta(t);
  }

  const diaMes = (t) => new Date(t).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });

  function duracao(ms) {
    const min = Math.max(0, Math.round(ms / 60000));
    return Math.floor(min / 60) + 'h' + String(min % 60).padStart(2, '0');
  }

  const iniciais = (usuario) => (String(usuario || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase() || '?');

  // O sellerSlug já vem com o '@' da URL (/live/@lojinha/... -> "@lojinha").
  // Nunca prefixar de novo — e tolerar o dia em que vier sem.
  function vendedorArroba() {
    const s = dados && dados.live ? String(dados.live.sellerSlug || '') : '';
    if (!s) return 'este vendedor';
    return s.charAt(0) === '@' ? s : '@' + s;
  }

  const reduzido = () => {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
  };

  // ------------------------------------------------------------ estado local
  let dados = null;             // último snapshot, com o feed acumulado
  let ultimoPulso = 0;
  let conectado = false;
  let estadoConexao = 'esperando';  // esperando | ligado | sem-sinal | fechado
  let tela = 'vivo';

  let reconstruirFeed = true;   // um snapshot completo joga o feed fora
  let colado = true;            // rolagem do feed presa no fim
  let ultimoAutoScroll = 0;     // para ignorar a rolagem que nós mesmos geramos
  let novasNoFeed = 0;
  const idsNoFeed = new Set();

  let limiteRanking = 10;
  const PASSO_RANKING = 10;

  const sorteio = { escopo: 'live', modo: 'peso', semRepetir: false };
  let urnaRemota = null;        // {escopo, lista} quando o escopo do sorteio é outro
  let urnaVelha = false;        // chegou gema nova depois da última lista pedida
  let urnaPedidaEm = 0;
  let girando = false;
  let ultimoResultado = null;
  let historico = [];

  const avatarPedidos = new Set();

  // ------------------------------------------------------------- transporte
  // Dentro da extensão: porta persistente com o background.
  // Fora dela (harness local, sem chrome.*): mensagens pelo window, para teste.
  let mandar = () => {};

  function ligar() {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.connect) {
      const porta = chrome.runtime.connect({ name: 'bj-painel' });
      mandar = (tipo, payload) => { try { porta.postMessage({ tipo, payload }); } catch {} };
      porta.onMessage.addListener((msg) => msg && aplicar(msg.tipo, msg.payload));
      porta.onDisconnect.addListener(() => { marcarConexao('fechado', 'extensão reiniciou — reabra o painel'); });
      mandar('painel-pronto');
      window.addEventListener('beforeunload', () => mandar('painel-fechou'));
      return;
    }
    // modo harness
    mandar = (tipo, payload) => {
      try { (window.opener || window.parent || window).postMessage({ tag: 'bj-painel-cmd', tipo, payload }, '*'); } catch {}
    };
    window.addEventListener('message', (ev) => {
      const m = ev.data;
      if (m && m.tag === 'bj-painel-teste') aplicar(m.tipo, m.payload);
    });
    mandar('painel-pronto');
  }

  function aplicar(tipo, payload) {
    switch (tipo) {
      case 'painel-estado':
        absorver(payload);
        desenhar();
        marcarConexao('ligado');
        if (payload && !payload.completo) celebrar(payload.celebrar);
        break;
      case 'painel-sorteio':
        mostrarSorteio(payload);
        break;
      case 'painel-urna':
        if (payload && payload.escopo) {
          urnaRemota = { escopo: payload.escopo, lista: payload.lista || [] };
          urnaVelha = false;
        }
        desenharSorteio();
        break;
      case 'painel-pulso':
        ultimoPulso = Date.now();
        marcarConexao('ligado');
        break;
      case 'painel-reatar':
        dados = null;
        urnaRemota = null;
        mandar('painel-pronto');
        break;
      case 'painel-fechou':
        marcarConexao('fechado');
        break;
      case 'painel-lacuna':
        mostrarLacunas(payload && payload.lista);
        break;
      default:
        break;
    }
    diag(tipo, payload);
  }

  // Um snapshot 'completo' substitui tudo; sem ele, só acrescentamos o feed novo.
  function absorver(p) {
    if (!p) return;
    ultimoPulso = Date.now();
    // Qualquer pacote pode ter mudado o ranking do outro escopo: a lista da
    // urna que veio por fora passa a ser velha (mas continua na tela até a
    // nova chegar, para não piscar).
    urnaVelha = true;
    if (p.completo || !dados) {
      dados = Object.assign({}, p, { feed: p.feed || [] });
      reconstruirFeed = true;
      urnaRemota = null;
      limiteRanking = PASSO_RANKING;
      historico = p.historico || [];
      return;
    }
    const feed = dados.feed.concat(p.feedNovos || []);
    dados = Object.assign({}, dados, p, { feed: feed.slice(Math.max(0, feed.length - 250)) });
    historico = dados.historico || historico;
  }

  // -------------------------------------------------------------- conexão
  function marcarConexao(estado, detalhe) {
    estadoConexao = estado;
    conectado = estado === 'ligado';
    const ponto = $('ponto');
    ponto.classList.toggle('on', conectado);
    ponto.classList.toggle('off', !conectado);
    document.body.classList.toggle('sem-sinal', !conectado);

    if (conectado) {
      $('conexao').textContent = 'ligado à aba da Jamble';
      $('faixa').hidden = true;
      return;
    }

    const idade = ultimoPulso ? Date.now() - ultimoPulso : 0;
    const desde = !ultimoPulso ? '' : idade < 90000
      ? ' (há ' + Math.max(1, Math.round(idade / 1000)) + ' s)'
      : ' (há ' + Math.round(idade / 60000) + ' min)';

    if (estado === 'fechado') {
      $('conexao').textContent = detalhe || 'a aba da Jamble fechou';
      $('faixaTexto').innerHTML = '';
      $('faixaTexto').append(frase(
        ['b', 'A aba da Jamble fechou.'],
        [null, ' O que está na tela é a última foto recebida' + desde + '. Abra a live de novo — a ligação se refaz sozinha.'],
      ));
      $('faixa').hidden = false;
      return;
    }

    if (estado === 'sem-sinal') {
      $('conexao').textContent = 'sem sinal há mais de 12 s';
      $('faixaTexto').innerHTML = '';
      $('faixaTexto').append(frase(
        ['b', 'Sem sinal da aba da Jamble.'],
        [null, ' O que está aqui é a última foto recebida' + desde + '. Volte para a aba da live — a ligação se refaz sozinha.'],
      ));
      $('faixa').hidden = false;
      return;
    }

    $('conexao').textContent = detalhe || 'aguardando a aba da Jamble…';
    $('faixa').hidden = true;
  }

  // O Chrome congelou ou descartou a aba da live: houve um intervalo em que nada foi
  // capturado, e a Jamble não dá como recuperar. Avisar é tudo o que dá para fazer —
  // calar seria pior, porque o ranking ficaria errado sem ninguém saber.
  let lacunasVistas = 0;
  function mostrarLacunas(lista) {
    if (!Array.isArray(lista) || lista.length <= lacunasVistas) return;   // dispensada continua dispensada
    lacunasVistas = lista.length;
    const ultima = lista[lista.length - 1];
    const quando = (t) => new Date(t).toLocaleTimeString('pt-BR');
    const quantas = lista.length > 1 ? ' (' + nf(lista.length) + ' vezes nesta sessão)' : '';
    const texto = ultima.motivo === 'descartada'
      ? ['b', 'O Chrome descartou a aba da live e ela recarregou.']
      : ['b', 'A aba da live ficou congelada pelo Chrome.'];
    const detalhe = ultima.motivo === 'descartada'
      ? ' Tudo que foi enviado enquanto ela esteve fora não entrou na contagem' + quantas
        + '. Para evitar, deixe a aba fixada ou marque o site como "sempre ativo" no Economizador de Memória.'
      : ' Das ' + quando(ultima.de) + ' às ' + quando(ultima.ate)
        + ' nada foi capturado' + quantas + ' — a Jamble não guarda histórico, então esse pedaço se perdeu.';
    const alvo = $('lacunaTexto');
    alvo.innerHTML = '';
    alvo.append(frase(texto, [null, detalhe]));
    $('faixaLacuna').hidden = false;
  }
  if ($('lacunaFechar')) $('lacunaFechar').onclick = () => { $('faixaLacuna').hidden = true; };

  // Monta um fragmento com pedaços em negrito, sem innerHTML com dado de fora.
  function frase(...partes) {
    const f = document.createDocumentFragment();
    partes.forEach(([tag, txt]) => {
      const n = tag ? document.createElement(tag) : document.createTextNode('');
      if (tag) n.textContent = txt; else n.nodeValue = txt;
      f.appendChild(n);
    });
    return f;
  }

  // Mais de 12 s sem pulso = a aba não está mais falando com o painel.
  // Repete a cada 4 s de propósito: é assim que o "há N min" da faixa anda.
  setInterval(() => {
    if (!ultimoPulso || Date.now() - ultimoPulso <= 12000) return;
    marcarConexao(estadoConexao === 'fechado' ? 'fechado' : 'sem-sinal');
  }, 4000);

  // ------------------------------------------------------------- utilidades
  function el(tag, classe, texto) {
    const n = document.createElement(tag);
    if (classe) n.className = classe;
    if (texto !== undefined && texto !== null) n.textContent = texto;
    return n;
  }

  function limpar(n) { while (n.firstChild) n.removeChild(n.firstChild); return n; }

  // O CDN da Jamble serve a foto em tamanho cheio e não aceita resize: o
  // tamanho vem do CSS (.av tem width/height na regra base) e o atributo
  // width/height aqui é só uma rede de segurança.
  function avatar(url, usuario, userId, classe) {
    const d = el('div', 'av' + (classe ? ' ' + classe : ''));
    const ini = iniciais(usuario);
    if (!url) { d.textContent = ini; return d; }
    const img = el('img');
    img.src = url;
    img.alt = '';
    img.loading = 'lazy';
    img.width = 64;
    img.height = 64;
    img.onerror = () => { img.remove(); d.textContent = ini; pedirAvatar(userId); };
    d.appendChild(img);
    return d;
  }

  function pedirAvatar(userId) {
    if (!userId || avatarPedidos.has(userId)) return;
    avatarPedidos.add(userId);
    mandar('resolver-avatar', { userId });
  }

  // Ícone da gema: imagem do catálogo quando dá, emoji quando não dá.
  function iconeGema(gema) {
    if (gema && gema.iconeUrl) {
      const img = el('img', 'gema-ico');
      img.src = gema.iconeUrl;
      img.alt = '';
      img.loading = 'lazy';
      img.width = 16;
      img.height = 16;
      img.onerror = () => { const s = el('span', 'emj', '💎'); img.replaceWith(s); };
      return img;
    }
    return el('span', 'emj', '💎');
  }

  // --------------------------------------------------- contagem dos números
  const contadores = new Map();
  let tickContadores = null;

  // requestAnimationFrame não roda em aba oculta: a contagem usa timer.
  function numero(alvo, valor, fmt) {
    const f = fmt || nf;
    const v = Number(valor) || 0;
    const antes = alvo.dataset.v === undefined ? null : Number(alvo.dataset.v);
    alvo.dataset.v = String(v);
    if (antes === v) return;
    if (reduzido() || antes === null && v === 0) { alvo.textContent = f(v); return; }
    contadores.set(alvo, { de: antes === null ? 0 : antes, para: v, ini: Date.now(), f });
    if (!tickContadores) tickContadores = setInterval(passoContadores, 28);
  }

  function passoContadores() {
    const agora = Date.now();
    contadores.forEach((c, alvo) => {
      const k = Math.min(1, (agora - c.ini) / 420);
      const e = 1 - Math.pow(1 - k, 3);
      alvo.textContent = c.f(c.de + (c.para - c.de) * e);
      if (k >= 1) contadores.delete(alvo);
    });
    if (!contadores.size) { clearInterval(tickContadores); tickContadores = null; }
  }

  // ================================================================ DESENHO
  function desenhar() {
    if (!dados) return;
    const d = dados;

    // cabeçalho
    const ctx = $('contexto');
    limpar(ctx);
    if (d.live) {
      const atual = (d.livesDoVendedor || []).find((l) => l.atual);
      ctx.appendChild(el('span', 'viva', vendedorArroba()));
      ctx.appendChild(document.createTextNode(atual && atual.inicio ? ' · live de ' + quando(atual.inicio) : ' · live aberta'));
    } else {
      ctx.appendChild(document.createTextNode('nenhuma live aberta'));
    }

    $('aba-lives').disabled = !d.live;
    $('aba-vivo').classList.toggle('gravando', !!d.live);
    if (!d.live && tela === 'lives') trocarTela('vivo');

    pintarSemLive(!d.live);
    atualizarMenuCsv();

    if (d.live) {
      desenharVivo();
      desenharSorteio();
      desenharLives();
    }
  }

  // --------------------------------------------------- 7.1 sem live aberta
  let capa = null;
  function pintarSemLive(mostrar) {
    if (mostrar && !capa) {
      capa = el('div');
      capa.style.cssText = 'position:absolute;inset:0;display:grid;place-items:center;overflow:auto;padding:28px';
      const v = el('div', 'vazio');
      v.appendChild(el('div', 'emj-g', '📺'));
      v.appendChild(el('div', 'tit', 'Nenhuma live aberta'));
      v.appendChild(el('div', 'txt', 'Abra uma live em jamble.com e o painel volta a encher sozinho. O que já foi capturado continua guardado.'));
      capa.appendChild(v);
      $('main').appendChild(capa);
    }
    if (!mostrar && capa) { capa.remove(); capa = null; }
    document.querySelectorAll('.tela').forEach((t) => {
      t.classList.toggle('ativa', !mostrar && t.id === 'tela-' + tela);
    });
  }

  // ============================================================ TELA AO VIVO
  function desenharVivo() {
    const d = dados;
    const t = d.totais || {};
    const vendedor = d.escopo === 'vendedor';
    const nLives = (d.livesDoVendedor || []).length;

    // ---- 4 indicadores (seguem o escopo, menos VENDIDO)
    numero($('iGemas'), t.gemas);
    numero($('iPessoas'), t.pessoas);
    numero($('iEnvios'), t.envios);
    numero($('iVendido'), t.vendasValor, brl);
    $('rGemas').textContent = vendedor ? 'gemas em ' + nf(t.livesNoEscopo) + ' ' + plural(t.livesNoEscopo, 'live', 'lives') : 'gemas';
    $('rPessoas').textContent = vendedor ? 'pessoas diferentes' : 'pessoas';
    $('rEnvios').textContent = 'envios';
    $('rVendido').textContent = vendedor ? 'vendido nesta live' : 'vendido';

    // ---- escopo: escrito por extenso, com número
    document.querySelectorAll('[data-escopo]').forEach((b) => {
      b.setAttribute('aria-checked', b.dataset.escopo === d.escopo ? 'true' : 'false');
    });
    // O rótulo é curto; quem é o vendedor e quantas lives entram fica na linha de baixo.
    $('rotEscopoVendedor').textContent = 'Todas as lives';
    $('subEscopoVendedor').textContent = nLives > 1
      ? 'as ' + nf(nLives) + ' lives de ' + vendedorArroba() + ' que a extensão salvou'
      : 'de ' + vendedorArroba() + ' — por enquanto só esta';
    $('escopoCtx').textContent = textoDoEscopo();

    // ---- filtro: faixa de fichas (7.6: sem catálogo, sem faixa)
    desenharFichas();

    const tag = $('tagRanking');
    tag.hidden = !d.filtro;
    if (d.filtro) tag.textContent = 'só ' + (d.nomeDoFiltro || d.filtro);

    // ---- pódio + lista
    desenharRanking();

    // ---- feed
    const envios = (d.feed || []).length;
    $('tagFeed').textContent = vendedor ? nf(t.livesNoEscopo) + ' lives' : 'esta live';
    limpar($('subFeed')).append(frase(
      ['span', nf(envios) + ' ' + plural(envios, 'envio', 'envios')],
      [null, ' · ' + nf(t.gemas) + ' 💎' + (d.filtro ? ' · só ' + (d.nomeDoFiltro || d.filtro) : '')],
    ));
    $('subFeed').firstChild.className = 'forte';
    desenharFeed();

    // ---- compradores (nunca herda o escopo)
    const cp = d.compradores || [];
    limpar($('subCompradores')).append(frase(
      ['span', nf(cp.length) + ' ' + plural(cp.length, 'pessoa', 'pessoas')],
      [null, ' · ' + brl(t.vendasValor) + ' · ' + nf(t.vendasCount) + ' ' + plural(t.vendasCount, 'compra', 'compras')],
    ));
    $('subCompradores').firstChild.className = 'forte';
    $('notaCompradores').hidden = !vendedor;

    const lista = limpar($('compradores'));
    if (!cp.length) {
      lista.appendChild(vazioSimples('Nenhuma venda registrada nesta live ainda.'));
    } else {
      cp.slice(0, 40).forEach((c, i) => lista.appendChild(linhaPessoa(
        i + 1, c, nf(c.compras) + ' ' + plural(c.compras, 'compra', 'compras'), brl(c.valor), '',
      )));
    }

    // Só recalcula as leituras se elas estiverem à vista.
    if (paneAtivo === 'insights') desenharLeituras();
  }

  // ------------------------------------------------------------- leituras
  // Insights = o que os números já dizem mas ninguém lê sozinho. Tudo sai do que
  // já está no snapshot: nenhuma chamada nova à Jamble.
  function desenharLeituras() {
    const d = dados;
    if (!d) return;
    const alvo = limpar($('leituras'));
    const t = d.totais || {};
    const rank = d.ranking || [];
    const envios = d.feed || [];
    const compradores = d.compradores || [];
    const linhas = [];

    const total = t.gemas || 0;

    if (rank.length && total) {
      const topo = rank[0];
      const pct = Math.round((topo.gemas / total) * 1000) / 10;
      linhas.push([pct.toLocaleString('pt-BR') + '%', [
        ['b', '@' + topo.usuario], [null, ' sozinho responde por essa fatia das gemas.'],
        [null, rank.length > 2
          ? ' O top 3 junto dá ' + Math.round((rank.slice(0, 3).reduce((a, r) => a + r.gemas, 0) / total) * 100) + '%.'
          : ''],
      ]]);
    }

    if (t.pessoas) {
      linhas.push([nf(Math.round(total / t.pessoas)), [
        [null, 'é a média de gemas por pessoa. '],
        ['b', nf(t.pessoas) + ' ' + plural(t.pessoas, 'pessoa mandou', 'pessoas mandaram')],
        [null, ' até agora, em ' + nf(t.envios) + ' ' + plural(t.envios, 'envio', 'envios') + '.'],
      ]]);
    }

    // Gema que mais rendeu: envios x preço de cada tipo.
    const porTipo = (d.catalogo || []).filter((c) => c.envios > 0)
      .map((c) => ({ nome: c.nome, total: c.envios * c.preco, envios: c.envios }))
      .sort((a, b) => b.total - a.total);
    if (porTipo.length) {
      const g = porTipo[0];
      linhas.push([nf(g.total), [
        [null, 'gemas vieram de '], ['b', g.nome],
        [null, ' — ' + nf(g.envios) + ' ' + plural(g.envios, 'envio', 'envios')
          + (porTipo.length > 1 ? ', mais que qualquer outra das ' + nf(porTipo.length) + ' usadas.' : '.')],
      ]]);
    }

    // Ritmo: o feed guarda o horário de cada envio.
    if (envios.length > 1) {
      const agora = Date.now();
      const ultimos = envios.filter((e) => agora - e.t < 300000);
      const janela = Math.max(1, Math.min(5, Math.round((agora - envios[0].t) / 60000)));
      linhas.push([nf(ultimos.length), [
        [null, ultimos.length
          ? 'envios nos últimos ' + janela + ' ' + plural(janela, 'minuto', 'minutos') + '. '
          : 'envios nos últimos minutos — '],
        ['b', ultimos.length ? 'a live está ativa agora.' : 'esfriou desde o último envio.'],
      ]]);
    }

    // Cruzamento: quem compra também manda gema?
    if (compradores.length && rank.length) {
      const nomes = new Set(rank.map((r) => String(r.usuario || '').toLowerCase()));
      const ambos = compradores.filter((c) => nomes.has(String(c.usuario || c.u || '').toLowerCase()));
      linhas.push([nf(ambos.length) + '/' + nf(compradores.length), [
        [null, 'dos compradores desta live também mandaram gema'],
        [null, ambos.length ? ': ' + ambos.slice(0, 3).map((c) => '@' + (c.usuario || c.u)).join(', ') + '.' : '.'],
      ]]);
    }

    if (!linhas.length) {
      alvo.appendChild(vazioSimples('As leituras aparecem quando chegarem as primeiras gemas.'));
      return;
    }

    linhas.forEach(([valor, partes]) => {
      const l = el('div', 'leitura');
      l.appendChild(el('div', 'lv', valor));
      const txt = el('div', 'lt');
      txt.appendChild(frase(...partes));
      l.appendChild(txt);
      alvo.appendChild(l);
    });
  }

  function textoDoEscopo() {
    const d = dados;
    const lives = d.livesDoVendedor || [];
    if (!lives.length) return 'A Jamble não dá histórico: só entra o que acontece com a aba da live aberta.';
    const inicio = Math.min(...lives.map((l) => l.inicio || l.fim || Date.now()).filter(Boolean));
    const fim = Math.max(...lives.map((l) => l.fim || l.inicio || 0));
    const periodo = soDia(inicio) === soDia(fim) ? 'no dia ' + diaMes(fim) : 'de ' + diaMes(inicio) + ' a ' + diaMes(fim);
    const quantas = lives.length > 1
      ? nf(lives.length) + ' lives de ' + vendedorArroba() + ' acompanhadas com a extensão, ' + periodo + '. '
      : '1 live de ' + vendedorArroba() + ' acompanhada com a extensão, ' + periodo + '. ';
    return quantas + 'A Jamble não dá histórico: só entra o que aconteceu com a aba aberta.';
  }

  // ------------------------------------------------------------- fichas
  // Só entram as gemas que alguém realmente mandou: o catálogo da Jamble passa de 70 itens e
  // tomava a tela inteira com fichas zeradas. Cada gema nova aparece aqui assim que chega a
  // primeira, com uma entradinha para a pessoa perceber. A gema filtrada fica visível mesmo
  // zerada, senão o filtro ligado some da tela e não dá para desligar.
  let assinaturaFichas = '';
  let escopoDasFichas = null;
  const fichasJaVistas = new Set();
  function desenharFichas() {
    const d = dados;
    const cat = (d.catalogo || []).filter((c) => c.envios > 0 || c.id === d.filtro);
    const caixa = $('fichas');

    // Trocar de escopo troca a faixa inteira: não é gema nova chegando, é outra conta.
    if (d.escopo !== escopoDasFichas) {
      escopoDasFichas = d.escopo;
      fichasJaVistas.clear();
      cat.forEach((c) => { if (c.envios > 0) fichasJaVistas.add(c.id); });
    }

    // 7.6 — ninguém mandou nada ainda: a faixa não aparece (o estado vazio abaixo já explica)
    if (!cat.length) { caixa.hidden = true; limpar(caixa); assinaturaFichas = ''; fichasJaVistas.clear(); return; }
    caixa.hidden = false;

    const assinatura = (d.filtro || '-') + '|' + cat.map((c) => c.id + ':' + c.envios + ':' + c.preco).join(',');
    if (assinatura === assinaturaFichas) return;
    assinaturaFichas = assinatura;
    limpar(caixa);

    const totalEnvios = cat.reduce((a, c) => a + (c.envios || 0), 0);

    const todas = el('button', 'ficha');
    todas.type = 'button';
    todas.setAttribute('aria-pressed', d.filtro ? 'false' : 'true');
    todas.appendChild(el('span', 'emj', '💎'));
    todas.appendChild(el('span', null, 'Todas'));
    todas.appendChild(el('span', 'ficha-n', nf(totalEnvios)));
    todas.onclick = () => trocarFiltro('');
    caixa.appendChild(todas);

    cat.forEach((c) => {
      const nova = c.envios > 0 && !fichasJaVistas.has(c.id);
      if (c.envios > 0) fichasJaVistas.add(c.id);
      const f = el('button', 'ficha' + (c.envios ? '' : ' zerada') + (nova ? ' nova' : ''));
      f.type = 'button';
      f.setAttribute('aria-pressed', d.filtro === c.id ? 'true' : 'false');
      f.appendChild(iconeGema(c));
      f.appendChild(el('span', null, c.nome));
      f.appendChild(el('span', 'ficha-n', nf(c.preco) + ' 💎' + (c.envios ? ' · ' + nf(c.envios) : '')));
      f.title = c.envios
        ? c.nome + ' · ' + nf(c.preco) + ' gemas cada · ' + nf(c.envios) + ' ' + plural(c.envios, 'envio', 'envios')
        : c.nome + ' · ' + nf(c.preco) + ' gemas cada · filtro ligado, ninguém mandou neste escopo';
      f.onclick = () => trocarFiltro(d.filtro === c.id ? '' : c.id);
      caixa.appendChild(f);
    });
  }

  function trocarFiltro(id) {
    assinaturaFichas = '';           // o próximo snapshot redesenha a faixa
    mandar('filtro', { iconeId: id });
  }

  // ------------------------------------------------------------- ranking
  function linhaPessoa(pos, r, detalhe, valor, unidade) {
    const l = el('div', 'linha');
    l.appendChild(el('div', 'pos', String(pos)));
    l.appendChild(avatar(r.avatar, r.usuario, r.id));
    const q = el('div', 'quem');
    q.appendChild(document.createTextNode('@' + r.usuario));
    if (detalhe) q.appendChild(el('span', 'det', detalhe));
    l.appendChild(q);
    const v = el('div', 'val', valor);
    if (unidade) v.appendChild(el('span', 'u', unidade));
    l.appendChild(v);
    return l;
  }

  function desenharRanking() {
    const d = dados;
    const rk = d.ranking || [];
    const podio = $('podio');
    const alvo = limpar($('ranking'));
    const btnMais = $('maisRanking');

    if (!rk.length) {
      podio.hidden = true;
      limpar(podio);
      btnMais.hidden = true;
      alvo.appendChild(vazioRanking());
      return;
    }

    // O pódio só nasce com 3 pessoas: com 1 ou 2 ele parece defeito.
    const temPodio = rk.length >= 3;
    podio.hidden = !temPodio;
    if (temPodio) desenharPodio(rk);
    else limpar(podio);

    const inicio = temPodio ? 3 : 0;
    const resto = rk.slice(inicio);
    const vendedor = d.escopo === 'vendedor';
    resto.slice(0, limiteRanking).forEach((r, i) => {
      const det = nf(r.envios) + ' ' + plural(r.envios, 'envio', 'envios')
        + (vendedor ? ' · ' + nf(r.lives) + ' ' + plural(r.lives, 'live', 'lives') : '');
      alvo.appendChild(linhaPessoa(inicio + i + 1, r, det, nf(r.gemas), '💎'));
    });

    const faltam = resto.length - limiteRanking;
    btnMais.hidden = faltam <= 0;
    if (faltam > 0) btnMais.textContent = 'mostrar mais ' + Math.min(PASSO_RANKING, faltam);
  }

  let assinaturaPodio = '';
  function desenharPodio(rk) {
    const topo = rk.slice(0, 3);
    const assinatura = topo.map((r) => r.id + ':' + r.gemas).join('|');
    const igual = assinatura === assinaturaPodio;
    assinaturaPodio = assinatura;
    if (igual) return;              // sem reanimar a entrada a cada delta

    const podio = limpar($('podio'));
    const max = Math.max(...topo.map((r) => r.gemas || 0), 1);
    const medalhas = ['👑', '🥈', '🥉'];
    [1, 0, 2].forEach((idx) => {
      const r = topo[idx];
      const g = el('div', 'degrau p' + (idx + 1));
      g.setAttribute('aria-label', (idx + 1) + 'º lugar: @' + r.usuario + ', ' + nf(r.gemas) + ' gemas');
      g.appendChild(el('div', 'medalha', medalhas[idx]));
      g.appendChild(avatar(r.avatar, r.usuario, r.id, idx === 0 ? 'av-g' : 'av-m'));
      g.appendChild(el('div', 'quem', '@' + r.usuario));
      g.appendChild(el('div', 'gem', nf(r.gemas)));
      g.appendChild(el('div', 'det', nf(r.envios) + ' ' + plural(r.envios, 'envio', 'envios')
        + (dados.escopo === 'vendedor' ? ' · ' + nf(r.lives) + ' ' + plural(r.lives, 'live', 'lives') : '')));
      const pedestal = el('div', 'pedestal', String(idx + 1) + 'º');
      pedestal.style.height = Math.round(18 + 34 * ((r.gemas || 0) / max)) + 'px';
      g.appendChild(pedestal);
      podio.appendChild(g);
    });
  }

  // ------------------------------------------- estados vazios do ranking
  function vazioSimples(texto) {
    const v = el('div', 'vazio vazio-p');
    v.appendChild(el('div', 'txt', texto));
    return v;
  }

  function vazioRanking() {
    const d = dados;
    const v = el('div', 'vazio');

    // 7.3 — filtro de gema sem resultado
    if (d.filtro) {
      v.appendChild(el('div', 'emj-g', '🔍'));
      v.appendChild(el('div', 'tit', 'Ninguém mandou ' + (d.nomeDoFiltro || d.filtro)
        + (d.escopo === 'live' ? ' nesta live ainda.' : ' nas lives deste vendedor ainda.')));
      const atalhos = el('div', 'atalhos');
      const b = el('button', 'btn btn-claro', 'ver todas as gemas');
      b.type = 'button';
      b.onclick = () => trocarFiltro('');
      atalhos.appendChild(b);
      v.appendChild(atalhos);
      return v;
    }

    // 7.4 — escopo "todas as lives" sem nada
    if (d.escopo === 'vendedor') {
      v.appendChild(el('div', 'emj-g', '💎'));
      v.appendChild(el('div', 'tit', 'Esta é a primeira live de ' + vendedorArroba() + ' que você acompanha.'));
      v.appendChild(el('div', 'txt', 'A partir de agora, cada live fica somada aqui.'));
      return v;
    }

    // 7.2 — o caso principal: live aberta, nenhuma gema ainda
    v.appendChild(el('div', 'emj-g', '💎'));
    v.appendChild(el('div', 'tit', 'Nenhuma gema nesta live ainda'));
    v.appendChild(el('div', 'txt', 'Deixe esta janela aberta: cada gema enviada aparece aqui na hora.'));

    const nota = el('p', 'nota');
    nota.appendChild(el('span', 'emj', 'ⓘ'));
    const txt = el('span');
    txt.append(frase(
      ['b', 'A Jamble não guarda histórico de gemas.'],
      [null, ' A extensão só consegue registrar o que acontece com a aba da live aberta — o que rolou antes de você entrar não dá para recuperar.'],
    ));
    nota.appendChild(txt);
    v.appendChild(nota);

    // Os atalhos só aparecem se houver conteúdo de verdade.
    const anteriores = (d.livesDoVendedor || []).filter((l) => !l.atual).length;
    const compradores = (d.compradores || []).length;
    if (anteriores || compradores) {
      const atalhos = el('div', 'atalhos');
      if (anteriores) {
        const b = el('button', 'btn', 'ver as ' + nf(anteriores) + ' ' + plural(anteriores, 'live anterior', 'lives anteriores') + ' de ' + vendedorArroba());
        b.type = 'button';
        b.onclick = () => trocarTela('lives');
        atalhos.appendChild(b);
      }
      if (compradores) {
        const b = el('button', 'btn', 'ver os compradores desta live (' + nf(compradores) + ')');
        b.type = 'button';
        b.onclick = () => trocarPane('insights');
        atalhos.appendChild(b);
      }
      v.appendChild(atalhos);
    }
    return v;
  }

  // ---------------------------------------------------------------- feed
  // O feed é incremental: um snapshot completo reconstrói, um delta só
  // acrescenta no fim. Redesenhar tudo brigaria com a rolagem de quem lê.
  function desenharFeed() {
    const caixa = $('feed');
    const envios = dados.feed || [];

    if (reconstruirFeed) {
      reconstruirFeed = false;
      limpar(caixa);
      idsNoFeed.clear();
      novasNoFeed = 0;
      colado = true;
      if (!envios.length) {
        caixa.appendChild(vazioSimples('Os envios aparecem aqui conforme acontecem.'));
      } else {
        envios.forEach((e) => { caixa.appendChild(linhaFeed(e, false)); idsNoFeed.add(e.id); });
      }
      atualizarNovas();
      aoFim();
      return;
    }

    const novos = envios.filter((e) => !idsNoFeed.has(e.id));
    if (!novos.length) return;

    // A decisão de prender é tomada com a posição real, ANTES de inserir.
    // Depender só do evento de rolagem é frágil: em janela oculta o navegador
    // estrangula os eventos e o feed passaria a brigar com quem está lendo.
    const estavaVazio = !idsNoFeed.size;
    const perto = estavaVazio || caixa.scrollHeight - caixa.scrollTop - caixa.clientHeight < 50;

    if (estavaVazio) limpar(caixa);
    novos.forEach((e) => { caixa.appendChild(linhaFeed(e, true)); idsNoFeed.add(e.id); });

    // o DOM nunca passa de 250 linhas (o mesmo corte do estado)
    while (caixa.children.length > 250) {
      const fora = caixa.firstElementChild;
      if (fora && fora.dataset.id) idsNoFeed.delete(fora.dataset.id);
      caixa.removeChild(fora);
    }

    if (perto) { aoFim(); } else { colado = false; novasNoFeed += novos.length; atualizarNovas(); }
  }

  function linhaFeed(e, animar) {
    // sem o gate de reduzido(): esta entrada foi pedida explicitamente e a CSS
    // já a mantém viva mesmo com o sistema pedindo menos movimento
    const l = el('div', 'fl' + (animar ? ' chegou' : ''));
    l.dataset.id = e.id;
    l.appendChild(el('span', 'hora', hora(e.t)));
    l.appendChild(avatar(e.avatar, e.usuario, e.userId, 'av-p'));
    l.appendChild(el('span', 'nome', '@' + e.usuario));
    const g = el('span', 'gema');
    g.appendChild(iconeGema({ iconeUrl: e.iconeUrl }));
    g.appendChild(el('span', null, e.iconeNome || e.iconeId));
    l.appendChild(g);
    l.appendChild(el('span', 'mais-g', '+' + nf(e.gemas)));
    return l;
  }

  function aoFim() {
    const caixa = $('feed');
    const fixar = (agora) => {
      // os reforços só valem se continuamos por ali: se a pessoa já saiu do
      // fim nesses milissegundos, não a arrastamos de volta
      if (!agora && caixa.scrollHeight - caixa.scrollTop - caixa.clientHeight > 200) return;
      ultimoAutoScroll = Date.now();
      caixa.scrollTop = caixa.scrollHeight;
    };
    fixar(true);
    // a fonte do feed e as fotos chegam depois do primeiro desenho e mudam a
    // altura: sem estes dois reforços o "fim" fica alguns pixels acima do fim
    setTimeout(() => fixar(false), 0);
    setTimeout(() => fixar(false), 160);
    colado = true;
    novasNoFeed = 0;
    atualizarNovas();
  }

  function atualizarNovas() {
    $('novas').hidden = novasNoFeed <= 0;
    $('novasN').textContent = nf(novasNoFeed);
  }

  $('feed').addEventListener('scroll', () => {
    // Rolagem que nós mesmos geramos não deve soltar o feed.
    if (Date.now() - ultimoAutoScroll < 300) return;
    const caixa = $('feed');
    const perto = caixa.scrollHeight - caixa.scrollTop - caixa.clientHeight < 50;
    colado = perto;
    if (perto && novasNoFeed) { novasNoFeed = 0; atualizarNovas(); }
  });

  $('novas').onclick = aoFim;

  // --------------------------------------------- celebração dos envios novos
  function celebrar(envios) {
    if (!envios || !envios.length || reduzido()) return;
    const grandes = envios.filter((e) => (e.gemas || 0) >= 100).sort((a, b) => b.gemas - a.gemas).slice(0, 2);
    grandes.forEach((e, i) => setTimeout(() => toast(e), i * 180));
  }

  function toast(e) {
    const caixa = $('toasts');
    if (caixa.children.length > 3) caixa.removeChild(caixa.firstElementChild);
    const t = el('div', 'toast');
    t.appendChild(iconeGema({ iconeUrl: e.iconeUrl }));
    const txt = el('span');
    txt.append(frase(['b', '@' + e.usuario], [null, ' mandou ' + (e.iconeNome || e.iconeId)]));
    t.appendChild(txt);
    t.appendChild(el('span', 'v', '+' + nf(e.gemas)));
    caixa.appendChild(t);
    setTimeout(() => { t.classList.add('saindo'); setTimeout(() => t.remove(), 260); }, 3600);
  }

  // ============================================================ TELA SORTEIO
  function desenharSorteio() {
    if (!dados || !dados.live) return;
    const d = dados;
    const nLives = (d.livesDoVendedor || []).length;

    document.querySelectorAll('[data-sesc]').forEach((b) => b.setAttribute('aria-checked', b.dataset.sesc === sorteio.escopo ? 'true' : 'false'));
    document.querySelectorAll('[data-modo]').forEach((b) => b.setAttribute('aria-checked', b.dataset.modo === sorteio.modo ? 'true' : 'false'));
    $('rotSorteioVendedor').textContent = 'Quem mandou em qualquer live';
    $('subSorteioVendedor').textContent = nLives > 1
      ? 'as ' + nf(nLives) + ' lives de ' + vendedorArroba() + ' que a extensão salvou'
      : 'de ' + vendedorArroba() + ' — por enquanto só esta';

    // O filtro de gema é herdado da tela "Ao vivo" e tem que aparecer por extenso:
    // sortear sem perceber que havia filtro é o erro mais caro da interface.
    $('soGemas').hidden = !d.filtro;
    if (d.filtro) $('soGemasNome').textContent = (d.nomeDoFiltro || d.filtro);

    const base = baseDaUrna();
    const urna = base ? calcularUrna(base) : null;

    const fora = urna ? urna.fora.length : 0;
    $('rotSemRepetir').textContent = 'não repetir quem já ganhou'
      + (sorteio.semRepetir && fora ? ' (' + nf(fora) + ' ' + plural(fora, 'fora', 'fora') + ')' : '');
    $('semRepetir').checked = sorteio.semRepetir;

    desenharUrna(urna);
    $('btnSortear').disabled = girando || !urna || !urna.lista.length;

    desenharHistorico();
    if (!ultimoResultado) desenharResultadoVazio();
  }

  // O escopo do sorteio é independente do escopo do ranking. Quando são iguais
  // o ranking do snapshot já serve; quando são diferentes, pedimos a lista
  // daquele escopo (mensagem `participantes` -> `painel-urna`).
  function baseDaUrna() {
    if (!dados) return null;
    if (sorteio.escopo === (dados.escopo || 'live')) return dados.ranking || [];
    const temCache = urnaRemota && urnaRemota.escopo === sorteio.escopo;
    if ((!temCache || urnaVelha) && Date.now() - urnaPedidaEm > 900) {
      urnaPedidaEm = Date.now();
      mandar('participantes', { escopo: sorteio.escopo });
    }
    return temCache ? urnaRemota.lista : null;
  }

  // modo e "não repetir" são aplicados aqui: trocar um deles não precisa de
  // viagem até a aba.
  function calcularUrna(base) {
    const ganhadores = new Set(sorteio.semRepetir ? (dados.jaGanharam || []) : []);
    const dentro = [];
    const fora = [];
    base.forEach((r) => (ganhadores.has(r.id) ? fora : dentro).push(r));
    const lista = dentro
      .map((r) => Object.assign({}, r, { bilhetes: sorteio.modo === 'peso' ? Math.max(1, r.gemas) : 1 }))
      .sort((a, b) => b.bilhetes - a.bilhetes || b.envios - a.envios);
    const total = lista.reduce((a, x) => a + x.bilhetes, 0);
    return { lista, total, fora };
  }

  function desenharUrna(urna) {
    const caixa = limpar($('urna'));
    const tag = $('tagUrna');
    const sub = $('subUrna');
    $('notaConcentracao').hidden = true;

    if (!urna) {
      tag.textContent = '';
      sub.textContent = '';
      caixa.appendChild(vazioSimples('Buscando quem mandou gema nesse escopo…'));
      return;
    }

    tag.textContent = sorteio.escopo === 'live' ? 'esta live' : 'todas as lives';
    limpar(sub).append(frase(
      ['span', nf(urna.lista.length) + ' ' + plural(urna.lista.length, 'pessoa', 'pessoas')],
      [null, ' · ' + nf(urna.total) + ' ' + plural(urna.total, 'chance', 'chances')
        + (dados.filtro ? ' · só ' + (dados.nomeDoFiltro || dados.filtro) : '')],
    ));
    sub.firstChild.className = 'forte';

    if (!urna.lista.length) {
      caixa.appendChild(vazioSimples(dados.filtro
        ? 'Ninguém mandou ' + (dados.nomeDoFiltro || dados.filtro) + ' nesse escopo ainda — não há ninguém para sortear.'
        : sorteio.semRepetir && urna.fora.length
          ? 'Todo mundo que mandou gema já ganhou. Desmarque “não repetir” ou limpe a lista.'
          : 'Ninguém mandou gema ainda. O sorteio abre sozinho quando a primeira gema chegar.'));
      return;
    }

    const maior = urna.lista[0];
    urna.lista.slice(0, 60).forEach((r) => {
      const p = urna.total ? (r.bilhetes / urna.total) * 100 : 0;
      const l = el('div', 'ul');
      l.appendChild(avatar(r.avatar, r.usuario, r.id, 'av-p'));
      l.appendChild(el('div', 'quem', '@' + r.usuario));
      l.appendChild(el('div', 'gem', nf(r.gemas) + ' 💎'));
      l.appendChild(el('div', 'pct', pct(p)));
      const trilha = el('div', 'trilha');
      const i = el('i');
      i.style.width = Math.max(2, Math.round(p)) + '%';
      trilha.appendChild(i);
      l.appendChild(trilha);
      l.title = '@' + r.usuario + ' · ' + nf(r.bilhetes) + ' ' + plural(r.bilhetes, 'chance', 'chances') + ' de ' + nf(urna.total);
      caixa.appendChild(l);
    });

    if (urna.fora.length) {
      caixa.appendChild(el('div', 'regua'));
      const r = el('div', 'vazio vazio-p');
      r.appendChild(el('div', 'txt', 'Fora desta vez (já ganharam): '
        + urna.fora.map((x) => '@' + x.usuario).join(', ')));
      caixa.appendChild(r);
    }

    // O aviso de concentração é o jeito honesto de dizer que isto não é um
    // sorteio justo, é um ranking com dado.
    const topo = urna.total ? (maior.bilhetes / urna.total) * 100 : 0;
    if (sorteio.modo === 'peso' && urna.lista.length > 1 && topo > 40) {
      $('textoConcentracao').textContent = '@' + maior.usuario + ' tem ' + pct(topo)
        + ' das chances' + (topo >= 45 ? ' — quase metade ou mais' : '')
        + '. Para dar chance igual a todo mundo, use “1 por pessoa”.';
      $('notaConcentracao').hidden = false;
    }
  }

  function desenharResultadoVazio() {
    const alvo = limpar($('resultado'));
    alvo.appendChild(vazioSimples('Nenhum sorteio nesta sessão. A urna ao lado mostra quem está dentro e com que chance.'));
  }

  function mostrarSorteio(r) {
    if (!r) return;
    historico = r.historico || historico;
    if (!r.vencedor) {
      girando = false;
      $('btnSortear').classList.remove('girando');
      const alvo = limpar($('resultado'));
      alvo.appendChild(vazioSimples('Ninguém elegível com essas opções. Confira o filtro de gema e a opção “não repetir”.'));
      desenharSorteio();
      return;
    }
    const chance = (() => {
      const p = (r.participantes || []).find((x) => x.id === r.vencedor.id);
      return p && r.bilhetes ? (p.bilhetes / r.bilhetes) * 100 : 0;
    })();
    ultimoResultado = { vencedor: r.vencedor, chance, participantes: (r.participantes || []).length, bilhetes: r.bilhetes };
    girar(r.participantes || [], () => { pintarResultado(ultimoResultado); desenharSorteio(); });
  }

  // ------------------------------------------------------------- palco
  // Três segundos: 2,2s de giro com feixes convergindo para o centro, depois a
  // revelação com onda de choque e confete. Tudo em canvas aqui mesmo — nenhuma
  // biblioteca externa, porque a CSP de página de extensão não carrega script de
  // fora e não quero uma dependência inteira por causa de um efeito.
  const GIRO_MS = 2900;   // o giro ocupa os 3 segundos pedidos; o confete continua depois
  const REVELA_MS = 3000;
  let palco = null;

  function pararPalco() {
    if (!palco) return;
    clearInterval(palco.raf);
    clearTimeout(palco.rede);
    clearTimeout(palco.fecha);
    abrirPalco(false);
    const ctx = palco.ctx;
    if (ctx) ctx.clearRect(0, 0, palco.l, palco.a);
    palco = null;
  }

  // Abre e fecha o palco: a configuração recolhe e o palco cresce para cima,
  // ocupando exatamente o espaço que ela deixou. As duas alturas vão em px para
  // a curva de aceleração valer de verdade — com max-height o começo da animação
  // não se mexe e fica com cara de travada.
  const PALCO_BASE = 250;
  const alturas = { conf: 0, pos: 0 };
  function abrirPalco(abrir) {
    const conf = document.querySelector('#pane-sorteio .sorteio-conf');
    const pos = document.querySelector('#pane-sorteio .pos-palco');
    const pal = $('palco');
    const card = $('cardRanking');
    if (!conf || !pal || !card) return;
    const blocos = pos ? [conf, pos] : [conf];

    if (abrir) {
      alturas.conf = conf.scrollHeight;
      alturas.pos = pos ? pos.scrollHeight : 0;
      // O limite é a coluna visível, não o card: com urna grande o card fica
      // muito mais alto que a tela (ele cresce com o conteúdo), e medir por ele
      // fazia o palco passar da janela. Subimos a rolagem antes de medir para o
      // topo final não depender de onde a pessoa estava olhando.
      const col = document.querySelector('#tela-vivo .col-a');
      if (col) col.scrollTop = 0;
      const topoFinal = pal.getBoundingClientRect().top - alturas.conf;
      const limite = (col || card).getBoundingClientRect().bottom;
      const livre = Math.round(limite - topoFinal - 14);
      blocos.forEach((b) => { b.style.height = b.scrollHeight + 'px'; b.style.overflow = 'hidden'; });
      // o quadro seguinte é o que torna a transição possível: sem ele o
      // navegador junta as duas alturas num valor só e nada anima
      setTimeout(() => {
        if (!palco) return;
        blocos.forEach((b) => { b.classList.add('saindo'); b.style.height = '0px'; });
        pal.style.height = Math.max(PALCO_BASE, livre) + 'px';
      }, 16);
    } else {
      // nada aberto: não mexe (evita deixar altura inline à toa)
      if (!conf.classList.contains('saindo') && !conf.style.height) return;
      conf.style.height = (alturas.conf || conf.scrollHeight) + 'px';
      if (pos) pos.style.height = (alturas.pos || pos.scrollHeight) + 'px';
      blocos.forEach((b) => b.classList.remove('saindo'));
      pal.style.height = '';
      setTimeout(() => {
        // se um sorteio novo começou nesse meio tempo, não desfaz o recolhimento dele
        if (conf.classList.contains('saindo')) return;
        blocos.forEach((b) => { b.style.height = ''; b.style.overflow = ''; });
      }, 500);
    }
  }

  function medirPalco(cv) {
    const r = cv.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.max(1, Math.round(r.width * dpr));
    cv.height = Math.max(1, Math.round(r.height * dpr));
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, l: r.width, a: r.height };
  }

  const TONS = ['#f2f2f2', '#d6d6d6', '#9b9b9b', '#6e6e6e', '#ff4a4a'];

  function soltarConfete(p, n) {
    const cx = p.l / 2;
    const cy = p.a / 2;
    for (let i = 0; i < n; i++) {
      const ang = (Math.PI * 2 * i) / n + Math.random() * 0.4;
      const vel = 3.4 + Math.random() * 5.2;
      p.pecas.push({
        x: cx, y: cy,
        vx: Math.cos(ang) * vel * 1.5,
        vy: Math.sin(ang) * vel - 2.2,
        c: TONS[(Math.random() * TONS.length) | 0],
        w: 3 + Math.random() * 5,
        h: 5 + Math.random() * 7,
        g: Math.random() * Math.PI,
        vg: (Math.random() - 0.5) * 0.4,
        vida: 1,
      });
    }
  }

  function desenharQuadro(p, t) {
    const { ctx, l, a } = p;
    const cx = l / 2;
    const cy = a / 2;
    ctx.clearRect(0, 0, l, a);

    if (t < GIRO_MS) {
      // feixes correndo para o centro: quanto mais perto do fim, mais lentos
      const avanco = t / GIRO_MS;
      const vel = 1 - avanco * 0.75;
      ctx.lineCap = 'round';
      for (const f of p.feixes) {
        f.d -= f.v * vel * 9;
        if (f.d < 12) { f.d = Math.max(l, a) * 0.62; f.ang = Math.random() * Math.PI * 2; }
        const x1 = cx + Math.cos(f.ang) * f.d;
        const y1 = cy + Math.sin(f.ang) * f.d * 0.55;
        const x2 = cx + Math.cos(f.ang) * (f.d - f.c);
        const y2 = cy + Math.sin(f.ang) * (f.d - f.c) * 0.55;
        ctx.strokeStyle = 'rgba(237,237,243,' + (0.05 + (1 - f.d / (l * 0.62)) * 0.22) + ')';
        ctx.lineWidth = f.e;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
      // anel pulsando no centro, acelerando até a revelação
      const pulso = (t % 520) / 520;
      ctx.strokeStyle = 'rgba(237,237,243,' + (0.3 * (1 - pulso)) + ')';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, 34 + pulso * 54, 0, Math.PI * 2);
      ctx.stroke();
    }

    // onda de choque da revelação
    if (p.onda != null) {
      const d = t - p.onda;
      if (d < 700) {
        const k = d / 700;
        ctx.strokeStyle = 'rgba(237,237,243,' + (0.55 * (1 - k)) + ')';
        ctx.lineWidth = 3 * (1 - k) + 0.5;
        ctx.beginPath();
        ctx.arc(cx, cy, 20 + k * Math.max(l, a) * 0.7, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // confete
    for (const c of p.pecas) {
      c.vy += 0.17;
      c.vx *= 0.992;
      c.x += c.vx;
      c.y += c.vy;
      c.g += c.vg;
      if (c.y > a + 30) c.vida = 0;
      if (c.vida > 0 && t > REVELA_MS + 900) c.vida -= 0.025;
      if (c.vida <= 0) continue;
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.g);
      ctx.globalAlpha = Math.max(0, c.vida);
      ctx.fillStyle = c.c;
      // o "achatamento" pelo giro dá a sensação de papel virando no ar
      ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h * Math.abs(Math.cos(c.g * 0.6)));
      ctx.restore();
    }
    p.pecas = p.pecas.filter((c) => c.vida > 0);
  }

  // Giro: 3s de palco. É desenho — o vencedor já veio pronto do gems-core.
  function girar(participantes, pronto) {
    const nomes = participantes.map((p) => '@' + p.usuario);
    const fim = () => {
      girando = false;
      $('btnSortear').classList.remove('girando');
      pronto();
    };
    const cv = $('confete');
    if (reduzido() || nomes.length < 2 || !cv || !cv.getContext) { pararPalco(); fim(); return; }

    pararPalco();
    const medida = medirPalco(cv);
    const p = {
      cv, ctx: medida.ctx, l: medida.l, a: medida.a, pecas: [], feixes: [], onda: null,
      revelado: false, inicio: performance.now(), raf: 0, rede: 0, fecha: 0,
      idx: 0, voltas: 0,
      // ritmo base: urna pequena passa devagar, urna grande acelera para caber
      // a volta inteira no tempo do giro
      base: Math.max(11, Math.min(70, (GIRO_MS * 0.55) / nomes.length)),
    };
    for (let i = 0; i < 46; i++) {
      p.feixes.push({
        ang: Math.random() * Math.PI * 2,
        d: 20 + Math.random() * Math.max(p.l, p.a) * 0.62,
        v: 0.5 + Math.random(),
        c: 16 + Math.random() * 46,
        e: 0.6 + Math.random() * 1.5,
      });
    }
    palco = p;
    abrirPalco(true);

    let ultimoNome = 0;
    // Timer e não requestAnimationFrame: o rAF para de correr com a janela
    // escondida (e em ambientes que desligam animação), e aí o palco congelava
    // no meio do giro. A 16ms o desenho em canvas fica igualmente liso.
    function quadro() {
      if (palco !== p) return;
      const agora = performance.now();
      const t = agora - p.inicio;
      // o palco cresce enquanto o giro já começou: sem remedir, o desenho fica
      // esticado porque o bitmap continua do tamanho antigo
      if (Math.round(p.cv.clientHeight) !== Math.round(p.a) || Math.round(p.cv.clientWidth) !== Math.round(p.l)) {
        const m = medirPalco(p.cv);
        p.ctx = m.ctx; p.l = m.l; p.a = m.a;
      }

      // O giro passa por TODOS os nomes da urna, na ordem dela, e só termina
      // depois de pelo menos uma volta completa — com muita gente a volta é um
      // borrão, mas ninguém fica de fora. O vencedor não sai daqui: ele já veio
      // sorteado pelo gems-core antes de a animação começar.
      if (t < GIRO_MS || p.voltas < 1) {
        const intervalo = p.base + Math.pow(Math.min(1, t / GIRO_MS), 3) * 420;
        if (agora - ultimoNome > intervalo) {
          ultimoNome = agora;
          pintarGiro(nomes[p.idx % nomes.length], p.idx % nomes.length, nomes.length);
          p.idx++;
          if (p.idx % nomes.length === 0) p.voltas++;
        }
      } else if (!p.revelado) {
        p.revelado = true;
        p.onda = t;
        soltarConfete(p, 90);
        setTimeout(() => { if (palco === p) soltarConfete(p, 60); }, 160);
        fim();
        // uma pausa para ver o vencedor e o confete, e o palco volta ao tamanho
        p.fecha = setTimeout(() => { if (palco === p) abrirPalco(false); }, 1900);
      }

      desenharQuadro(p, t);
      if (t > REVELA_MS + 2600 && !p.pecas.length) pararPalco();
    }
    p.raf = setInterval(quadro, 16);
    quadro();
    // rede de segurança: aconteça o que acontecer com o desenho, o resultado
    // tem que aparecer.
    p.rede = setTimeout(() => { if (palco === p && !p.revelado) { p.revelado = true; fim(); } }, REVELA_MS + 400);
  }

  function pintarGiro(nome, i, total) {
    const alvo = limpar($('resultado'));
    const bloco = el('div', 'resultado');
    bloco.appendChild(el('span', 'trofeu', '🎲'));
    const caixa = el('div', 'caixa-av');
    caixa.appendChild(el('div', 'av av-xg', '…'));
    bloco.appendChild(caixa);
    const info = el('div', 'info');
    info.appendChild(el('div', 'nome girando-nome', nome));
    info.appendChild(el('div', 'det', total ? 'passando pela urna · ' + nf(i + 1) + ' de ' + nf(total) : 'sorteando…'));
    bloco.appendChild(info);
    alvo.appendChild(bloco);
  }

  function pintarResultado(res) {
    const alvo = limpar($('resultado'));
    const v = res.vencedor;
    const bloco = el('div', 'resultado ganhou');
    bloco.appendChild(el('span', 'trofeu', '🏆'));
    const caixa = el('div', 'caixa-av');
    caixa.appendChild(avatar(v.avatar, v.usuario, v.id, 'av-xg'));
    bloco.appendChild(caixa);
    const info = el('div', 'info');
    info.appendChild(el('div', 'nome', '@' + v.usuario));
    info.appendChild(el('div', 'det', nf(v.gemas) + ' 💎 · ' + nf(v.envios) + ' ' + plural(v.envios, 'envio', 'envios')
      + ' · ' + pct(res.chance) + ' de chance · entre ' + nf(res.participantes) + ' ' + plural(res.participantes, 'pessoa', 'pessoas')));
    bloco.appendChild(info);
    alvo.appendChild(bloco);
  }

  function desenharHistorico() {
    const caixa = limpar($('historico'));
    $('limparHistorico').hidden = !(historico || []).length;
    if (!(historico || []).length) {
      caixa.appendChild(vazioSimples('Ninguém ganhou nesta sessão ainda. A lista zera quando a aba da Jamble recarrega.'));
      return;
    }
    // o histórico guarda o id da gema; quem lê quer o nome
    const nomes = nomesDasGemas();
    historico.slice(0, 20).forEach((h) => {
      const l = el('div', 'hl');
      l.appendChild(el('span', 'hora', horaCurta(h.t)));
      l.appendChild(el('span', 'quem', '@' + h.usuario));
      const como = (h.modo === 'pessoa' ? '1 por pessoa' : 'por quantidade')
        + (h.escopo === 'vendedor' ? ' · todas as lives' : '')
        + (h.filtro ? ' · só ' + (nomes.get(h.filtro) || h.filtro) : '');
      l.appendChild(el('span', 'como', como));
      caixa.appendChild(l);
    });
  }

  // ====================================================== TELA LIVES DO VENDEDOR
  function desenharLives() {
    const d = dados;
    const lives = d.livesDoVendedor || [];
    const alvo = limpar($('corpoLives'));
    $('tituloLives').textContent = 'As lives de ' + vendedorArroba() + ' que você acompanhou';

    const gemas = lives.reduce((a, l) => a + (l.gemas || 0), 0);
    const envios = lives.reduce((a, l) => a + (l.envios || 0), 0);
    const sub = limpar($('subLives'));
    sub.append(frase(
      ['span', nf(lives.length) + ' ' + plural(lives.length, 'live', 'lives')],
      [null, ' · ' + nf(gemas) + ' gemas · ' + nf(envios) + ' envios'
        + (d.escopo === 'vendedor' ? ' · ' + nf((d.totais || {}).pessoas) + ' pessoas diferentes' : '')],
    ));
    sub.firstChild.className = 'forte';

    // Com uma live só (primeiro uso), uma tabela de uma linha não ensina nada.
    if (lives.length <= 1) {
      const v = el('div', 'vazio');
      v.appendChild(el('div', 'emj-g', '📅'));
      v.appendChild(el('div', 'tit', 'Esta é a primeira live de ' + vendedorArroba() + ' que você acompanha.'));
      v.appendChild(el('div', 'txt', 'A partir de agora, cada live que você assistir com a extensão entra nesta lista e passa a somar no escopo “todas as lives”.'));
      alvo.appendChild(v);
      return;
    }

    const tabela = el('table', 'tabela');
    const thead = el('thead');
    const tr = el('tr');
    ['Quando', 'Duração', 'Pessoas', 'Envios', 'Gemas', 'Feed'].forEach((h) => tr.appendChild(el('th', null, h)));
    thead.appendChild(tr);
    tabela.appendChild(thead);

    const tbody = el('tbody');
    lives.forEach((l) => {
      const linha = el('tr', l.atual ? 'agora' : '');
      const q = el('td');
      q.appendChild(document.createTextNode(quando(l.inicio || l.fim)));
      if (l.atual) q.appendChild(el('span', 'selo', 'AGORA'));
      linha.appendChild(q);
      linha.appendChild(el('td', 'n', duracao((l.atual ? Date.now() : l.fim) - (l.inicio || l.fim))));
      linha.appendChild(el('td', 'n', nf(l.pessoas)));
      linha.appendChild(el('td', 'n', nf(l.envios)));
      linha.appendChild(el('td', 'n', nf(l.gemas)));
      const f = el('td');
      if (l.temFeed) f.appendChild(el('span', null, '✓'));
      else f.appendChild(el('span', 'fraco', '—  só totais'));
      linha.appendChild(f);
      tbody.appendChild(linha);
    });
    tabela.appendChild(tbody);
    alvo.appendChild(tabela);

    const rodape = el('div', 'rodape-lives');
    if (d.escopo === 'vendedor') {
      const b = el('button', 'btn', 'voltar a somar só esta live → Ao vivo');
      b.type = 'button';
      b.onclick = () => { mandar('escopo', { escopo: 'live' }); trocarTela('vivo'); };
      rodape.appendChild(b);
    } else {
      const b = el('button', 'btn btn-claro', 'somar todas no ranking → Ao vivo');
      b.type = 'button';
      b.onclick = () => { mandar('escopo', { escopo: 'vendedor' }); trocarTela('vivo'); };
      rodape.appendChild(b);
    }
    alvo.appendChild(rodape);
  }

  // =============================================================== navegação
  function trocarTela(nome) {
    tela = nome;
    document.querySelectorAll('[data-tela]').forEach((b) => b.setAttribute('aria-selected', b.dataset.tela === nome ? 'true' : 'false'));
    document.querySelectorAll('.tela').forEach((t) => t.classList.toggle('ativa', !capa && t.id === 'tela-' + nome));
    deslizarFundo($('abaFundo'), document.querySelector('.aba[data-tela="' + nome + '"]'), true);
    if (nome === 'vivo') aoFim();
  }

  document.querySelectorAll('[data-tela]').forEach((b) => {
    b.onclick = () => { if (!b.disabled) trocarTela(b.dataset.tela); };
  });

  // ---------------------------------------------- menu de dentro do card
  // O fundo claro é um elemento só: medimos o botão escolhido e deslizamos o
  // fundo até ele. Por isso a posição é recalculada quando a janela muda de
  // tamanho — texto e largura dos botões mudam junto.
  let paneAtivo = 'ranking';

  // Um fundo claro só, que desliza até o item escolhido. Serve os dois menus:
  // as abas do cabeçalho e o menu de dentro do card.
  function deslizarFundo(fundo, alvo, animar) {
    if (!fundo || !alvo || !alvo.offsetWidth) return;
    // Só a colocação inicial e o redimensionamento são secos; o clique desliza
    // sempre, inclusive com o sistema pedindo menos movimento (ver painel.html).
    if (!animar) fundo.classList.add('sem-transicao');
    // Copia a caixa inteira do botão (altura e topo também, senão o fundo não
    // fica centralizado no texto quando o botão tem margem). Medimos pelo
    // retângulo real, e não por offsetLeft/offsetWidth: aqueles são inteiros e
    // deixavam o fundo 1px fora do botão quando a largura dá fração de pixel.
    const base = (fundo.offsetParent || fundo.parentElement).getBoundingClientRect();
    const r = alvo.getBoundingClientRect();
    fundo.style.width = r.width + 'px';
    fundo.style.height = r.height + 'px';
    fundo.style.transform = 'translate(' + (r.left - base.left) + 'px,' + (r.top - base.top) + 'px)';
    fundo.classList.add('pronto');
    if (!animar) {
      // devolve a transição depois do quadro, senão o próximo clique não anima
      setTimeout(() => fundo.classList.remove('sem-transicao'), 30);
    }
  }

  function moverFundoDoMenu(animar) {
    deslizarFundo($('menuFundo'), document.querySelector('.navc-i[data-pane="' + paneAtivo + '"]'), animar);
    deslizarFundo($('abaFundo'), document.querySelector('.aba[data-tela="' + tela + '"]'), animar);
  }

  function trocarPane(nome) {
    paneAtivo = nome;
    document.querySelectorAll('.navc-i').forEach((b) => {
      b.setAttribute('aria-selected', b.dataset.pane === nome ? 'true' : 'false');
    });
    ['ranking', 'sorteio', 'insights'].forEach((n) => {
      const p = $('pane-' + n);
      if (p) p.hidden = n !== nome;
    });
    moverFundoDoMenu(true);
    // O sorteio precisa de largura (palco, urna, dois grupos de opções lado a
    // lado); o feed cede espaço enquanto essa aba estiver aberta.
    const duas = document.querySelector('#tela-vivo .duas');
    if (duas) duas.classList.toggle('sorteio', nome === 'sorteio');
    if (nome !== 'sorteio') pararPalco();
    if (nome === 'insights') desenharLeituras();
    if (nome === 'sorteio') desenharSorteio();
  }

  document.querySelectorAll('.navc-i').forEach((b) => {
    b.onclick = () => trocarPane(b.dataset.pane);
  });
  window.addEventListener('resize', () => moverFundoDoMenu(false));
  // A fonte chega depois do primeiro desenho e muda a largura dos botões.
  setTimeout(() => moverFundoDoMenu(false), 0);
  setTimeout(() => moverFundoDoMenu(false), 250);
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => moverFundoDoMenu(false)).catch(() => {});
  }
  // Rede de segurança: se a largura de um botão mudar por qualquer motivo (fonte
  // que chega, texto que o CSS esconde em janela estreita), o fundo se recoloca.
  // Sem isto, uma medida tirada antes de a barra assentar ficava errada para sempre.
  if (window.ResizeObserver) {
    const ro = new ResizeObserver(() => moverFundoDoMenu(false));
    document.querySelectorAll('.navc-i, .aba').forEach((b) => ro.observe(b));
  }

  // =============================================================== controles
  document.querySelectorAll('[data-escopo]').forEach((b) => {
    b.onclick = () => { assinaturaPodio = ''; mandar('escopo', { escopo: b.dataset.escopo }); };
  });

  document.querySelectorAll('[data-sesc]').forEach((b) => {
    b.onclick = () => { sorteio.escopo = b.dataset.sesc; desenharSorteio(); };
  });

  document.querySelectorAll('[data-modo]').forEach((b) => {
    b.onclick = () => { sorteio.modo = b.dataset.modo; desenharSorteio(); };
  });

  $('semRepetir').onchange = (e) => { sorteio.semRepetir = !!e.target.checked; desenharSorteio(); };
  $('limparFiltroSorteio').onclick = () => trocarFiltro('');
  $('maisRanking').onclick = () => { limiteRanking += PASSO_RANKING; desenharRanking(); };
  $('limparHistorico').onclick = () => { historico = []; ultimoResultado = null; mandar('limpar-historico'); desenharSorteio(); };

  $('btnSortear').onclick = () => {
    if (girando) return;
    girando = true;
    $('btnSortear').classList.add('girando');
    $('btnSortear').disabled = true;
    mandar('sortear', { modo: sorteio.modo, semRepetir: sorteio.semRepetir, escopo: sorteio.escopo });
    // Se a aba não responder, o botão não pode ficar preso.
    setTimeout(() => {
      if (!girando) return;
      girando = false;
      $('btnSortear').classList.remove('girando');
      const alvo = limpar($('resultado'));
      alvo.appendChild(vazioSimples('A aba da Jamble não respondeu ao sorteio. Volte para a aba da live e tente de novo.'));
      desenharSorteio();
    }, 6000);
  };

  // ===================================================================== CSV
  // O painel tem todos os dados: o arquivo é gerado aqui, respeitando escopo e
  // filtro. `;` como separador, BOM UTF-8 e CRLF — abre direto no Excel pt-BR.
  function celula(v) {
    const s = v === null || v === undefined ? '' : String(v);
    return /[;"\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  const decimal = (n) => (Number(n) || 0).toFixed(2).replace('.', ',');
  const dataHora = (t) => new Date(t).toLocaleString('pt-BR', { hour12: false });

  function montarCsv(cabecalho, linhas) {
    return '﻿' + [cabecalho].concat(linhas).map((l) => l.map(celula).join(';')).join('\r\n') + '\r\n';
  }

  function nomesDasGemas() {
    const m = new Map();
    (dados.catalogo || []).forEach((c) => m.set(c.id, c.nome));
    return m;
  }

  function csvFeed() {
    const nomes = nomesDasGemas();
    return montarCsv(
      ['Data/hora', 'Usuário', 'ID do usuário', 'Emoji', 'ID do emoji', 'Gemas', 'Live', 'Vendedor', 'ID do evento'],
      (dados.feed || []).map((e) => [
        dataHora(e.t), '@' + e.usuario, e.userId,
        e.iconeNome || nomes.get(e.iconeId) || e.iconeId, e.iconeId,
        e.gemas, e.showId, e.sellerSlug, e.id,
      ]),
    );
  }

  function csvRanking() {
    const nomes = nomesDasGemas();
    return montarCsv(
      ['Posição', 'Usuário', 'Gemas', 'Envios', 'Lives', 'Último envio', 'Ícones'],
      (dados.ranking || []).map((r, i) => [
        i + 1, '@' + r.usuario, r.gemas, r.envios, r.lives, r.ultimo ? dataHora(r.ultimo) : '',
        Object.entries(r.icones || {}).map(([k, n]) => (nomes.get(k) || k) + '×' + n).join(' · '),
      ]),
    );
  }

  function csvCompradores() {
    return montarCsv(
      ['Posição', 'Usuário', 'ID do usuário', 'Compras', 'Valor (R$)'],
      (dados.compradores || []).map((c, i) => [i + 1, '@' + c.usuario, c.id, c.compras, decimal(c.valor)]),
    );
  }

  function nomeDoArquivo(qual) {
    const d = dados;
    const slug = (d.live && d.live.sellerSlug ? d.live.sellerSlug : 'jamble').replace(/[^a-zA-Z0-9@._-]/g, '');
    const agora = new Date();
    const data = agora.toISOString().slice(0, 10) + '-' + String(agora.getHours()).padStart(2, '0') + String(agora.getMinutes()).padStart(2, '0');
    const escopo = qual === 'compradores' ? 'live' : (d.escopo === 'vendedor' ? 'todas-as-lives' : 'live');
    const filtro = qual === 'compradores' || !d.filtro ? '' : '-' + String(d.filtro).replace(/[^a-zA-Z0-9_-]/g, '');
    return ['betterjamble', qual, slug, escopo + filtro, data].join('-') + '.csv';
  }

  function baixar(nome, texto) {
    try {
      const url = URL.createObjectURL(new Blob([texto], { type: 'text/csv;charset=utf-8' }));
      const a = el('a');
      a.href = url;
      a.download = nome;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) {
      diag('csv-falhou', { erro: String(e) });
    }
  }

  function atualizarMenuCsv() {
    const d = dados;
    if (!d) return;
    const t = d.totais || {};
    const escopo = d.escopo === 'vendedor' ? nf(t.livesNoEscopo) + ' lives' : 'esta live';
    const filtro = d.filtro ? ' · só ' + (d.nomeDoFiltro || d.filtro) : '';
    $('csvFeedSub').textContent = nf((d.feed || []).length) + ' linhas · ' + escopo + filtro;
    $('csvRankSub').textContent = nf((d.ranking || []).length) + ' pessoas · ' + escopo + filtro;
    $('csvCompSub').textContent = nf((d.compradores || []).length) + ' pessoas · sempre a live aberta';
    $('csvNota').textContent = 'O arquivo sai com ; como separador e acentos em UTF-8 — abre direto no Excel em português. '
      + (d.filtro ? 'O filtro de gema ativo vale para o feed e o ranking.' : '');
  }

  const menuCsv = $('menuCsv');
  $('btnCsv').onclick = (ev) => {
    ev.stopPropagation();
    const abrir = menuCsv.hidden;
    menuCsv.hidden = !abrir;
    $('btnCsv').setAttribute('aria-expanded', abrir ? 'true' : 'false');
  };
  document.addEventListener('click', (ev) => {
    if (!menuCsv.hidden && !menuCsv.contains(ev.target)) {
      menuCsv.hidden = true;
      $('btnCsv').setAttribute('aria-expanded', 'false');
    }
  });
  menuCsv.querySelectorAll('[data-csv]').forEach((b) => {
    b.onclick = () => {
      if (!dados) return;
      const qual = b.dataset.csv;
      const texto = qual === 'feed' ? csvFeed() : qual === 'ranking' ? csvRanking() : csvCompradores();
      baixar(nomeDoArquivo(qual), texto);
      menuCsv.hidden = true;
      $('btnCsv').setAttribute('aria-expanded', 'false');
    };
  });

  // ============================================================ diagnóstico
  // A fila de mensagens que passaram pelo transporte. É a primeira coisa a
  // olhar quando nada aparece na tela. Atalho: clique no estado da conexão
  // (ou Shift+D).
  const registro = [];
  function diag(tipo, payload) {
    const resumo = tipo === 'painel-estado' && payload
      ? 'completo=' + payload.completo + ' seq=' + payload.seq
        + ' ranking=' + (payload.ranking || []).length
        + ' feed=' + (payload.feed || payload.feedNovos || []).length
        + ' compradores=' + (payload.compradores || []).length
        + ' catalogo=' + (payload.catalogo || []).length
      : tipo === 'painel-urna' && payload ? 'escopo=' + payload.escopo + ' lista=' + (payload.lista || []).length
        : tipo === 'painel-sorteio' && payload ? 'vencedor=' + (payload.vencedor ? '@' + payload.vencedor.usuario : 'ninguém')
          + ' bilhetes=' + payload.bilhetes
          : '';
    registro.unshift(hora(Date.now()) + '  ' + tipo + (resumo ? '  ' + resumo : ''));
    if (registro.length > 80) registro.pop();
    if (!$('diag').hidden) $('diagLog').textContent = registro.slice(0, 40).join('\n');
  }

  function alternarDiag(forcar) {
    const g = $('diag');
    g.hidden = forcar === undefined ? !g.hidden : !forcar;
    if (!g.hidden) $('diagLog').textContent = registro.slice(0, 40).join('\n');
  }

  $('sinal').onclick = () => alternarDiag();
  $('fecharDiag').onclick = () => alternarDiag(false);
  $('pedirEstado').onclick = () => mandar('painel-pronto');
  window.addEventListener('keydown', (ev) => {
    if (ev.shiftKey && (ev.key === 'D' || ev.key === 'd') && !/^(INPUT|TEXTAREA)$/.test(ev.target.tagName)) alternarDiag();
  });

  // =================================================================== início
  ligar();
  marcarConexao('esperando');
  trocarTela('vivo');

  window.__bjPainel = {
    dados: () => dados,
    aplicar,
    mandar: (t, p) => mandar(t, p),
    // usado pela validação: o conteúdo do CSV sem precisar baixar o arquivo
    csv: {
      feed: () => (dados ? csvFeed() : ''),
      ranking: () => (dados ? csvRanking() : ''),
      compradores: () => (dados ? csvCompradores() : ''),
      nome: (q) => (dados ? nomeDoArquivo(q) : ''),
    },
    tela: () => tela,
    irPara: trocarTela,
    sorteio,
    urna: () => { const b = baseDaUrna(); return b ? calcularUrna(b) : null; },
  };
})();
