// ============================================================================
// Painel do BetterJamble — interface.
//
// A camada de dados vive na aba da Jamble (gems-core.js) e manda pacotes
// prontos por uma porta persistente. Aqui só se desenha.
//
// O que NÃO se mexe: `ligar()`, `aplicar()` e `absorver()` são a cola com o
// protocolo (docs/HANDOFF.md, seção 4). Todo o resto é desenho.
//
// Mapa: docs/PAINEL.md — três telas (Ao vivo, Sorteio, Resumo das Lives),
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

  // anim: 'subida' (nomes subindo + pouso do vencedor), 'patos' (corrida de patos
  // na janela inteira) ou 'feixes' (a original,
  // versão antiga está no commit c8fa2b9, em backup/sorteio-feixes-v1). Fica salva só neste navegador.
  // tipo: 'gemas' (quem mandou gema) ou 'compradores' (quem comprou nesta live)
  const sorteio = {
    tipo: 'gemas', escopo: 'live', modo: 'peso', semRepetir: false, anim: lerAnim(), presenca: lerPresenca(),
    // quem ganhou num tipo (gemas/compradores) fica fora do outro
    entreTipos: (() => { try { return localStorage.getItem('bj-sorteio-entre-tipos') === '1'; } catch { return false; } })(),
  };
  const deCompradores = () => sorteio.tipo === 'compradores';
  function lerPresenca() {
    try { return localStorage.getItem('bj-sorteio-presenca') === '1'; } catch { return false; }
  }
  // Confirmação de presença: depois de revelado, o vencedor precisa escrever
  // no chat. Só contam mensagens dele que chegaram depois do sorteio.
  // {userId, usuario, t, msgs: [{id, texto}], confirmado, motivo}
  // `t` é a hora da entrada no histórico, para marcar o motivo nela.
  let presenca = null;
  const MAX_MSGS_PRESENCA = 3;
  // Vencedor que não confirmou: quem conduz marca o motivo e sorteia de novo.
  const MOTIVOS = { 'ja-sorteado': { rot: 'Já sorteado', cor: 'amarelo' }, ausente: { rot: 'Ausente', cor: 'vermelho' } };
  // Os motivos marcados aqui, por entrada do histórico ("t:id"). A aba é dona
  // do histórico, mas um pacote que saiu dela antes de o motivo chegar não
  // pode apagar o badge: cada histórico recebido passa por aplicarMotivos.
  const motivosMarcados = new Map();
  // Presenças confirmadas aqui, pelo mesmo motivo (a aba pode demorar a saber).
  const confirmadosMarcados = new Set();
  function aplicarMotivos(lista) {
    (lista || []).forEach((h) => {
      const k = h.t + ':' + h.id;
      if (confirmadosMarcados.has(k)) h.confirmado = true;
      if (!motivosMarcados.has(k)) return;
      const m = motivosMarcados.get(k);
      if (m) h.motivo = m; else delete h.motivo;
    });
    return lista;
  }
  function lerAnim() {
    try { const v = localStorage.getItem('bj-anim-sorteio'); return v === 'feixes' || v === 'patos' ? v : 'subida'; } catch { return 'subida'; }
  }
  // Ranking: de gemas ou de compradores (ordenado por valor ou por compras) e
  // o olho que deixa só o ranking na tela (e, em compradores, esconde os valores).
  const lerLS = (k, ok, padrao) => { try { const v = localStorage.getItem(k); return ok.indexOf(v) >= 0 ? v : padrao; } catch { return padrao; } };
  const salvarLS = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
  let rkTipo = lerLS('bj-rk-tipo', ['gemas', 'compradores'], 'gemas');
  let rkMetrica = lerLS('bj-rk-metrica', ['valor', 'compras'], 'valor');
  let rkOculto = lerLS('bj-rk-oculto', ['1', '0'], '0') === '1';
  const METRICAS = { valor: 'Valor total', compras: 'Quantidade de compras' };
  let rkCompradoresCanal = null;   // compradores de todas as lives (pedidos à aba)
  let rkCanalVelho = true;
  let rkCanalPedidoEm = 0;
  let urnaRemota = null;        // {escopo, lista} quando o escopo do sorteio é outro
  let urnaVelha = false;        // chegou gema nova depois da última lista pedida
  let urnaPedidaEm = 0;
  let girando = false;
  let esperandoSorteio = false;   // pediu à aba e a resposta ainda não chegou
  let ultimoResultado = null;
  let liveDoPalco = null;         // showId da live a que o palco se refere
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
      case 'painel-audiencia':
        audiencia = payload || null;
        if (paneAtivo === 'insights') { desenharAudiencia(); desenharFeedViewers(); desenharLances(); }
        break;
      case 'painel-resgate':
        resgate = payload || null;
        desenharResgate();
        break;
      case 'painel-chat':
        receberChat(payload && payload.mensagens);
        break;
      case 'painel-urna':
        if (payload && payload.escopo) {
          const tipo = payload.tipo || 'gemas';
          // a mesma resposta serve ao ranking de compradores do canal
          if (tipo === 'compradores' && payload.escopo === 'vendedor') {
            rkCompradoresCanal = payload.lista || [];
            rkCanalVelho = false;
            if (rkTipo === 'compradores' && dados) desenharRanking();
          }
          if (payload.escopo === sorteio.escopo && tipo === sorteio.tipo) {
            urnaRemota = { escopo: payload.escopo, tipo, lista: payload.lista || [] };
            urnaVelha = false;
          }
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
    rkCanalVelho = true;
    // Trocou de live (no mesmo canal ou em outro): o palco não pode continuar
    // mostrando o ganhador de antes nem esperando a presença dele.
    const novaLive = p.live && p.live.showId;
    if (novaLive && novaLive !== liveDoPalco) {
      if (liveDoPalco !== null && !girando) { pararPalco(); ultimoResultado = null; presenca = null; }
      liveDoPalco = novaLive;
    }
    if (p.completo || !dados) {
      dados = Object.assign({}, p, { feed: p.feed || [] });
      reconstruirFeed = true;
      urnaRemota = null;
      limiteRanking = PASSO_RANKING;
      historico = aplicarMotivos(p.historico || []);
      return;
    }
    const feed = dados.feed.concat(p.feedNovos || []);
    dados = Object.assign({}, dados, p, { feed: feed.slice(Math.max(0, feed.length - 250)) });
    historico = aplicarMotivos(dados.historico || historico);
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

  // Tique a cada segundo para a aba da live: escondida (janela coberta ou
  // minimizada), ela tem os relógios travados pelo Chrome, e os nossos scripts
  // de lá andam também com este tique (ritmo.js). O painel está à vista, então
  // o relógio dele não trava.
  // (vai mesmo sem sinal: é justamente o tique que traz o pulso de volta)
  setInterval(() => mandar('painel-tique'), 1000);

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
      const est = d.live.estado;
      const inicio = (est && est.inicio) || (atual && atual.inicio);
      ctx.appendChild(el('span', 'viva', vendedorArroba()));
      ctx.appendChild(document.createTextNode(inicio ? ' · live de ' + quando(inicio) : ' · live aberta'));
      // no ar / encerrada (com a hora do fim e a duração, quando a extensão viu)
      if (est && est.fim) {
        ctx.appendChild(el('span', 'ctx-encerrada', ' · encerrada ' + (est.provisorio ? 'por volta das ' : 'às ')
          + horaCurta(est.fim) + (inicio ? ' (' + duracao(est.fim - inicio) + ')' : '')));
      } else if (est && est.aoVivo) {
        ctx.appendChild(el('span', 'ctx-aovivo', ' · ao vivo' + (inicio ? ' há ' + duracao(Date.now() - inicio) : '')));
      }
    } else {
      ctx.appendChild(document.createTextNode('nenhuma live aberta'));
    }

    $('aba-lives').disabled = !d.live;
    // o ponto vermelho só pisca com a live no ar; encerrada, ela não grava mais nada
    $('aba-vivo').classList.toggle('gravando', !!d.live && !(d.live.estado && d.live.estado.fim));
    if (!d.live && tela === 'lives') trocarTela('vivo');

    pintarSemLive(!d.live);
    atualizarMenuCsv();

    if (d.live) {
      desenharVivo();
      desenharSorteio();
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
  // Os Insights são sempre só da live aberta, sem filtro de gema: o escopo e
  // o filtro escolhidos no Ranking/Sorteio não valem aqui. Vem pronto da aba
  // (`vivo`); sem ele (aba com versão antiga), cai no que o snapshot tiver.
  function dadosDaLive() {
    const d = dados || {};
    return d.vivo || { totais: d.totais || {}, ranking: d.ranking || [], catalogo: d.catalogo || [], tempos: (d.feed || []).map((e) => e.t) };
  }

  function desenharVivo() {
    const d = dados;
    const t = dadosDaLive().totais || {};

    // ---- 5 indicadores, todos da live aberta
    numero($('iGemas'), t.gemas);
    numero($('iEnvios'), t.envios);
    numero($('iVendido'), t.vendasValor, brl);
    // compradores únicos: cada pessoa uma vez. Ticket por cliente: quanto
    // cada comprador gasta na live; ticket por venda: preço médio do que sai.
    // pontos da loja no ranking mensal de vendedores da Jamble: posição e
    // quanto falta para passar quem está logo acima
    const pl = d.pontosLoja;
    if (pl) numero($('iPontosLoja'), pl.points);
    else { $('iPontosLoja').textContent = '—'; delete $('iPontosLoja').dataset.v; }
    // "+20" ao lado da posição = pontos somados na hora desde a última
    // consulta oficial (some quando a Jamble confirma)
    $('rPontosLoja').textContent = (pl && pl.rank ? 'Ranking geral #' + pl.rank : 'Ranking geral')
      + (pl && pl.estimado ? ' · +' + nf(pl.estimado) : '');
    // o detalhe (quanto falta para subir, o que é estimado) fica na dica
    const dicas = [];
    if (pl && pl.acima) dicas.push('Faltam ' + nf(Math.max(0, pl.acima.points - pl.points)) + ' pontos para passar @' + pl.acima.usuario + ' (#' + pl.acima.rank + ')');
    if (pl && pl.estimado) dicas.push('+' + nf(pl.estimado) + ' somados agora com as gemas e vendas desta live; o oficial da Jamble é ' + nf(pl.oficial) + ' e chega na próxima consulta (a cada ~2 min)');
    $('cardPontosLoja').title = dicas.join('\n');
    numero($('iCompradores'), t.compradores);
    numero($('iTicketCliente'), t.compradores ? t.vendasValor / t.compradores : 0, brl);
    numero($('iTicketVenda'), t.vendasCount ? t.vendasValor / t.vendasCount : 0, brl);
    $('rGemas').textContent = 'gemas';
    $('rEnvios').textContent = 'envios';
    $('rVendido').textContent = 'vendido';
    $('rCompradores').textContent = 'compradores únicos';
    $('rTicketVenda').textContent = 'ticket médio por venda'
      + (t.vendasCount ? ' · ' + nf(t.vendasCount) + ' ' + plural(t.vendasCount, 'venda', 'vendas') : '');

    // ---- escopo: escrito por extenso, com número
    document.querySelectorAll('[data-escopo]').forEach((b) => {
      b.setAttribute('aria-checked', b.dataset.escopo === d.escopo ? 'true' : 'false');
    });
    $('rotEscopoVendedor').textContent = 'Todas as lives';
    const desdeRk = registroMaisAntigo(rkTipo === 'compradores');
    $('subEscopoVendedor').textContent = 'Todas as lives do canal' + (desdeRk ? ' desde ' + dataLonga(desdeRk) : '');
    desenharSeletoresRanking();

    // ---- filtro: faixa de fichas (7.6: sem catálogo, sem faixa); só no de gemas
    desenharFichas();
    if (rkTipo === 'compradores') $('fichas').hidden = true;

    const tag = $('tagRanking');
    tag.hidden = !d.filtro || rkTipo === 'compradores';
    if (d.filtro) tag.textContent = 'só ' + (d.nomeDoFiltro || d.filtro);

    // ---- pódio + lista
    desenharRanking();

    // ---- feed (esse segue o escopo e o filtro do Ranking)
    const tEsc = d.totais || {};
    const envios = (d.feed || []).length;
    if (!modoViewers) $('tagFeed').textContent = d.escopo === 'vendedor' ? nf(tEsc.livesNoEscopo) + ' lives' : 'esta live';
    limpar($('subFeed')).append(frase(
      ['span', nf(envios) + ' ' + plural(envios, 'envio', 'envios')],
      [null, ' · ' + nf(tEsc.gemas) + ' 💎' + (d.filtro ? ' · só ' + (d.nomeDoFiltro || d.filtro) : '')],
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
    $('notaCompradores').hidden = true;   // os Insights são sempre da live aberta: o aviso não se aplica

    const lista = limpar($('compradores'));
    if (!cp.length) {
      lista.appendChild(vazioSimples('Nenhuma venda registrada nesta live ainda.'));
    } else {
      cp.slice(0, 40).forEach((c, i) => lista.appendChild(linhaPessoa(
        i + 1, c, nf(c.compras) + ' ' + plural(c.compras, 'compra', 'compras'), brl(c.valor), '',
      )));
    }

  }

  // ------------------------------------------------------- produtos e lances
  // O mesmo card do BetterJamble Panel: qual produto puxou mais lances
  // (somando os leilões dele) e quais leilões foram mais disputados. Vem pronto
  // do audiencia.js (audiencia.leiloes), que lê os leilões do WebSocket.
  let vistaLances = (() => { try { return localStorage.getItem('bj-lances-vista') === 'leilao' ? 'leilao' : 'produto'; } catch { return 'produto'; } })();
  function desenharLances() {
    const L = (audiencia && audiencia.leiloes) || { produtos: [], leiloes: [], total: 0, lances: 0 };
    $('tagLances').textContent = nf(L.total) + ' ' + plural(L.total, 'leilão', 'leilões') + ' · ' + nf(L.lances) + ' lances';
    document.querySelectorAll('[data-vista-lances]').forEach((b) => b.setAttribute('aria-checked', b.dataset.vistaLances === vistaLances ? 'true' : 'false'));
    const topo = L.produtos[0];
    const dest = limpar($('destaqueLance'));
    dest.hidden = !topo;
    if (topo) {
      dest.append(frase(
        [null, 'O produto com mais lances foi '], ['b', topo.titulo || 'sem título'],
        [null, ': ' + nf(topo.lances) + ' ' + plural(topo.lances, 'lance', 'lances')
          + (topo.leiloes > 1 ? ' em ' + nf(topo.leiloes) + ' leilões' : '')
          + (topo.media != null ? ', saindo em média por ' + brl(topo.media) : '') + '.'],
      ));
    }
    const alvo = limpar($('lances'));
    const lista = vistaLances === 'produto' ? L.produtos : L.leiloes;
    if (!lista.length) {
      alvo.appendChild(vazioSimples('Os leilões desta live aparecem aqui assim que alguém der o primeiro lance.'));
      return;
    }
    const maior = lista[0].lances || 1;
    lista.forEach((x, i) => {
      const l = el('div', 'linha linha-prod');
      l.appendChild(el('div', 'pos', String(i + 1)));
      const foto = el('div', 'prod-img');
      if (x.img) {
        const img = el('img');
        img.src = x.img; img.alt = ''; img.loading = 'lazy'; img.width = 40; img.height = 40;
        img.onerror = () => img.remove();
        foto.appendChild(img);
      }
      l.appendChild(foto);
      const q = el('div', 'quem');
      q.appendChild(el('span', 'prod-nome', x.titulo || 'sem título'));
      q.appendChild(el('span', 'prod-sub', vistaLances === 'produto'
        ? nf(x.leiloes) + ' ' + plural(x.leiloes, 'leilão', 'leilões')
          + (x.vendidos ? ' · média ' + brl(x.media) + (x.vendidos > 1 ? ' · maior ' + brl(x.maior) : '') : '')
        : (x.status === 'FINISHED' ? 'saiu por ' + brl(x.final) + (x.vencedor ? ' para @' + x.vencedor : '')
          : x.status === 'CANCELED' ? 'cancelado' : 'em andamento' + (x.final != null ? ' · ' + brl(x.final) : ''))
          + (x.quem ? ' · ' + nf(x.quem) + ' ' + plural(x.quem, 'pessoa deu lance', 'pessoas deram lance') : '')));
      l.appendChild(q);
      l.appendChild(el('div', 'val', nf(x.lances) + ' ' + plural(x.lances, 'lance', 'lances')));
      const barra = el('span', 'barra-lance');
      barra.style.width = Math.max(3, Math.round(((x.lances || 0) / maior) * 100)) + '%';
      l.appendChild(barra);
      alvo.appendChild(l);
    });
  }
  document.querySelectorAll('[data-vista-lances]').forEach((b) => {
    b.onclick = () => {
      vistaLances = b.dataset.vistaLances;
      try { localStorage.setItem('bj-lances-vista', vistaLances); } catch {}
      desenharLances();
    };
  });

  // ------------------------------------------------------------- audiência
  // Vem pronto do audiencia.js (na aba da live): amostras de quantas pessoas
  // assistem, interações por minuto e o tempo de cada espectador logado.
  let audiencia = null;
  let janelaAud = (() => {
    try { const v = Number(localStorage.getItem('bj-aud-janela')); return [1, 5, 15].indexOf(v) >= 0 ? v : 5; } catch { return 5; }
  })();
  const SERIES_AUD = [
    ['pessoas', 'Pessoas assistindo'], ['chat', 'Mensagens'], ['gemas', 'Gemas'], ['entradas', 'Entradas'], ['lances', 'Lances'],
  ];
  // séries escondidas pela legenda (clicar no nome liga e desliga a linha)
  const seriesOcultas = new Set();
  const NS = 'http://www.w3.org/2000/svg';
  const svgEl = (tag, attrs) => {
    const n = document.createElementNS(NS, tag);
    Object.entries(attrs || {}).forEach(([k, v]) => n.setAttribute(k, v));
    return n;
  };

  function duracaoCurta(ms) {
    const m = Math.round(ms / 60000);
    if (m < 1) return '<1 min';
    if (m < 60) return m + ' min';
    return Math.floor(m / 60) + 'h' + String(m % 60).padStart(2, '0');
  }
  const hhmm = (t) => new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  // Para tempos curtos os segundos importam ("45s", "2 min 30s"). A lista
  // de espectadores é consultada a cada ~30s, então não adianta mais precisão
  // que isso: arredonda para 5s abaixo de 1 min e para 10s até 10 min.
  function duracaoFina(ms) {
    const s = Math.max(0, Math.round(ms / 1000));
    if (s < 60) return Math.max(5, Math.round(s / 5) * 5) + 's';
    if (s < 600) {
      const r = Math.round(s / 10) * 10;
      const m = Math.floor(r / 60);
      const resto = r % 60;
      return m + ' min' + (resto ? ' ' + resto + 's' : '');
    }
    return duracaoCurta(ms);
  }

  // "Janela de retenção": a mediana de quanto tempo fica quem ENTRA na live
  // (só entradas vistas acontecendo — quem já estava quando a contagem
  // começou não tem hora de entrada conhecida). Quem ainda está assistindo
  // não é ignorado nem tratado como saída: ele conta como "ficou pelo menos
  // até agora" (Kaplan–Meier). Sem isso o número sairia curto demais, porque
  // só quem já foi embora teria tempo fechado.
  function tempoParaPrender(eventos, pessoas) {
    const porId = new Map(pessoas.map((p) => [p.id, p]));
    const abertos = new Map();
    const amostras = [];   // [duração, saiu?]
    eventos.slice().sort((x, y) => x.t - y.t).forEach((e) => {
      if (e.tipo === 'entrou') abertos.set(e.id, e.t);
      else if (e.tipo === 'saiu' && abertos.has(e.id)) {
        amostras.push([Math.max(0, e.t - abertos.get(e.id)), true]);
        abertos.delete(e.id);
      }
    });
    const agora = Date.now();
    // Entrou e não saiu: ficou pelo menos até agora (se ainda está na lista) ou
    // até a última vez em que foi visto (lista sem consulta recente — página
    // recarregada, painel fechado). Antes, sem consulta recente essas pessoas
    // eram descartadas e a janela de retenção zerava depois de recarregar.
    abertos.forEach((t0, id) => {
      const p = porId.get(id);
      if (!p) return;
      const ate = p.ativo ? agora : (p.visto || 0);
      if (ate > t0) amostras.push([ate - t0, false]);
    });
    if (amostras.length < 5) return null;

    amostras.sort((x, y) => x[0] - y[0]);
    let vivos = amostras.length;
    let s = 1;
    let mediana = null;
    let i = 0;
    while (i < amostras.length) {
      const t = amostras[i][0];
      let saidas = 0;
      let mesmos = 0;
      while (i < amostras.length && amostras[i][0] === t) { if (amostras[i][1]) saidas++; mesmos++; i++; }
      if (saidas) s *= 1 - saidas / vivos;
      vivos -= mesmos;
      if (mediana == null && s <= 0.5) mediana = t;
    }
    const noPrimeiroMinuto = amostras.filter(([d, saiu]) => saiu && d < 60000).length / amostras.length;
    return { ms: mediana, maior: amostras[amostras.length - 1][0], n: amostras.length, rapido: noPrimeiroMinuto };
  }

  function textoStatusAudiencia(a) {
    switch (a.status) {
      case 'ok': {
        const s = Math.max(0, Math.round((Date.now() - a.ultimaConsulta) / 1000));
        return 'Lista de espectadores atualizada há ' + s + 's · consulta a cada ~30s enquanto o painel está aberto.';
      }
      case 'sem-token': return 'Esperando a aba da live falar com a Jamble pela primeira vez para começar a contar os espectadores.';
      case 'outra-aba': return 'Outra aba desta live já está contando os espectadores.';
      case 'recuando': return 'A Jamble pediu para esperar (' + (a.motivo || 'erro') + '). A contagem de espectadores volta sozinha em instantes.';
      case 'pausado': return 'Contagem de espectadores pausada: a Jamble recusou 4 vezes seguidas (' + (a.motivo || 'erro') + '). Tenta de novo em 10 min.';
      case 'encerrada': return 'Live encerrada' + (a.encerradaEm ? ' às ' + horaCurta(a.encerradaEm) : '') + ' — estes são os números finais dela.';
      default: return 'Abra a aba da live para começar a contar a audiência.';
    }
  }

  // Janelas de tempo alinhadas no relógio (14:00, 14:05...), da primeira
  // amostra até agora. Audiência = média das amostras na janela (ou o último
  // valor conhecido, se nada mudou nela); interações = soma dos minutos.
  function janelasAudiencia(a, passoMin) {
    const passo = passoMin * 60000;
    const am = a.amostras || [];
    const mins = a.minutos || [];
    const inicio = Math.min(am.length ? am[0][0] : Infinity, mins.length ? mins[0][0] : Infinity);
    if (!isFinite(inicio)) return [];
    const agora = Date.now();
    // a live inteira, do começo até agora: em lives longas as janelas só ficam
    // mais estreitas no gráfico
    const t0 = Math.floor(inicio / passo) * passo;
    const lista = [];
    let ia = 0;
    let ultimo = null;
    while (ia < am.length && am[ia][0] < t0) ultimo = am[ia++][1];
    let im = 0;
    while (im < mins.length && mins[im][0] < t0) im++;
    for (let t = t0; t <= agora; t += passo) {
      const vals = [];
      while (ia < am.length && am[ia][0] < t + passo) { vals.push(am[ia][1]); ultimo = am[ia++][1]; }
      const soma = [0, 0, 0, 0];
      while (im < mins.length && mins[im][0] < t + passo) { for (let k = 0; k < 4; k++) soma[k] += mins[im][k + 1]; im++; }
      const base = vals.length ? vals : (ultimo != null ? [ultimo] : []);
      lista.push({
        t, fim: t + passo,
        media: base.length ? base.reduce((x, y) => x + y, 0) / base.length : null,
        pico: base.length ? Math.max(...base) : null,
        inter: soma,
      });
    }
    return lista;
  }

  // Curva monotônica (Fritsch–Carlson): passa por todos os pontos sem inventar
  // picos que não existem nem afundar abaixo de zero entre dois pontos — com
  // curva comum, uma janela de 0 mensagens virava um "vale" negativo.
  function caminhoCurvo(pts) {
    const n = pts.length;
    if (!n) return '';
    if (n === 1) return 'M' + pts[0][0] + ',' + pts[0][1];
    const dx = [];
    const m = [];
    for (let i = 0; i < n - 1; i++) {
      dx[i] = pts[i + 1][0] - pts[i][0];
      m[i] = (pts[i + 1][1] - pts[i][1]) / dx[i];
    }
    const t = [m[0]];
    for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
    t[n - 1] = m[n - 2];
    for (let i = 0; i < n - 1; i++) {
      if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
      const p = t[i] / m[i];
      const q = t[i + 1] / m[i];
      const s = p * p + q * q;
      if (s > 9) { const k = 3 / Math.sqrt(s); t[i] = k * p * m[i]; t[i + 1] = k * q * m[i]; }
    }
    let d = 'M' + pts[0][0] + ',' + pts[0][1];
    for (let i = 0; i < n - 1; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[i + 1];
      const h = dx[i] / 3;
      d += 'C' + (x0 + h) + ',' + (y0 + t[i] * h) + ' ' + (x1 - h) + ',' + (y1 - t[i + 1] * h) + ' ' + x1 + ',' + y1;
    }
    return d;
  }

  // Um gráfico só, uma linha por dado. Todas são contagens na mesma escala
  // (pessoas e interações por janela), então um eixo só basta.
  function graficoLinhas(caixa, janelas, series) {
    limpar(caixa);
    const L = Math.max(260, caixa.clientWidth || 560);
    const A = 220;
    const esq = 30, dir = 10, base = A - 20, topo = 10;
    const visiveis = series.filter((s) => !seriesOcultas.has(s.k));
    const max = Math.max(1, ...visiveis.flatMap((s) => s.vals.filter((v) => v != null)));
    const escalaMax = max <= 4 ? max : Math.ceil(max / 4) * 4;
    const n = janelas.length;
    const xDe = (i) => (n === 1 ? esq + (L - esq - dir) / 2 : esq + ((L - esq - dir) * i) / (n - 1));
    const yDe = (v) => base - ((base - topo) * v) / escalaMax;

    const svg = svgEl('svg', { viewBox: '0 0 ' + L + ' ' + A, role: 'img' });
    const defs = svgEl('defs');
    const f = svgEl('filter', { id: 'neon', x: '-10%', y: '-40%', width: '120%', height: '180%' });
    f.appendChild(svgEl('feGaussianBlur', { stdDeviation: '3.5' }));
    defs.appendChild(f);
    svg.appendChild(defs);

    [0, 0.25, 0.5, 0.75, 1].forEach((fr) => {
      const y = yDe(escalaMax * fr);
      svg.appendChild(svgEl('line', { class: 'grade', x1: esq, x2: L - dir, y1: y, y2: y }));
      if (fr === 0 || fr === 0.5 || fr === 1) {
        const r = svgEl('text', { class: 'eixo', x: esq - 6, y: y + 3.5, 'text-anchor': 'end' });
        r.textContent = nf(Math.round(escalaMax * fr));
        svg.appendChild(r);
      }
    });
    const passoRot = Math.max(1, Math.ceil(n / 6));
    for (let i = 0; i < n; i += passoRot) {
      const r = svgEl('text', { class: 'eixo', x: xDe(i), y: A - 4, 'text-anchor': 'middle' });
      r.textContent = hhmm(janelas[i].t);
      svg.appendChild(r);
    }

    visiveis.forEach((s) => {
      const pts = [];
      s.vals.forEach((v, i) => { if (v != null) pts.push([xDe(i), yDe(v)]); });
      if (!pts.length) return;
      const cor = 'var(--serie-' + s.k + ')';
      if (pts.length === 1) {
        svg.appendChild(svgEl('circle', { cx: pts[0][0], cy: pts[0][1], r: 4, fill: cor }));
        return;
      }
      const d = caminhoCurvo(pts);
      svg.appendChild(svgEl('path', { class: 'linha-halo', d, stroke: cor }));
      svg.appendChild(svgEl('path', { class: 'linha', d, stroke: cor }));
    });

    // mira: linha vertical + pontos + tooltip na janela mais próxima do mouse
    const mira = svgEl('g', { visibility: 'hidden' });
    const linhaMira = svgEl('line', { class: 'mira', y1: topo, y2: base });
    mira.appendChild(linhaMira);
    const pontos = visiveis.map((s) => {
      const c = svgEl('circle', { class: 'ponto', r: 4.5, fill: 'var(--serie-' + s.k + ')' });
      mira.appendChild(c);
      return c;
    });
    svg.appendChild(mira);
    const alvo = svgEl('rect', { x: esq, y: topo, width: L - esq - dir, height: base - topo, fill: 'transparent' });
    alvo.addEventListener('mousemove', (ev) => {
      const r = svg.getBoundingClientRect();
      const x = ((ev.clientX - r.left) / r.width) * L;
      const i = n === 1 ? 0 : Math.max(0, Math.min(n - 1, Math.round(((x - esq) / (L - esq - dir)) * (n - 1))));
      const cx = xDe(i);
      linhaMira.setAttribute('x1', cx);
      linhaMira.setAttribute('x2', cx);
      visiveis.forEach((s, k) => {
        const v = s.vals[i];
        pontos[k].setAttribute('visibility', v == null ? 'hidden' : 'visible');
        if (v != null) { pontos[k].setAttribute('cx', cx); pontos[k].setAttribute('cy', yDe(v)); }
      });
      mira.setAttribute('visibility', 'visible');
      const j = janelas[i];
      mostrarDica(ev, [el('div', null, hhmm(j.t) + '–' + hhmm(j.fim))].concat(visiveis.map((s) => {
        const v = s.vals[i];
        return linhaDica('var(--serie-' + s.k + ')', s.rot, v == null ? '—' : nf(Math.round(v)));
      })));
    });
    alvo.addEventListener('mouseleave', () => { mira.setAttribute('visibility', 'hidden'); esconderDica(); });
    svg.appendChild(alvo);
    caixa.appendChild(svg);
  }

  function mostrarDica(ev, partes) {
    if (privadoB) return;   // a dica mostraria os números que o modo privado esconde
    const d = $('audDica');
    limpar(d);
    partes.forEach((p) => d.appendChild(p));
    d.hidden = false;
    const x = Math.min(ev.clientX + 14, window.innerWidth - d.offsetWidth - 8);
    d.style.left = x + 'px';
    d.style.top = (ev.clientY - d.offsetHeight - 10) + 'px';
  }
  function esconderDica() { $('audDica').hidden = true; }

  function linhaDica(cor, rotulo, valor) {
    const l = el('div');
    if (cor) { const i = el('i'); i.style.background = cor; l.appendChild(i); }
    l.appendChild(document.createTextNode(rotulo + ' '));
    l.appendChild(el('b', null, valor));
    return l;
  }

  function desenharAudiencia() {
    const a = audiencia;
    $('subAudiencia').textContent = a ? textoStatusAudiencia(a) : 'Abra a aba da live para começar a contar a audiência.';
    document.querySelectorAll('[data-janela]').forEach((b) => b.setAttribute('aria-checked', Number(b.dataset.janela) === janelaAud ? 'true' : 'false'));

    const am = (a && a.amostras) || [];
    const pessoas = (a && a.pessoas) || [];
    const comTempo = pessoas.filter((p) => p.ms >= 60000);
    const mediaMs = comTempo.length ? comTempo.reduce((x, p) => x + p.ms, 0) / comTempo.length : 0;
    const pico = am.reduce((m, s) => (s[1] > m[1] ? s : m), [0, 0]);
    const prender = tempoParaPrender((a && a.eventos) || [], pessoas);
    const ind = limpar($('audIndicadores'));
    [
      [am.length ? nf(am[am.length - 1][1]) : '—', 'assistindo agora'],
      [am.length ? nf(pico[1]) : '—', am.length ? 'pico · ' + hhmm(pico[0]) : 'pico'],
      [!prender ? '—' : prender.ms != null ? duracaoFina(prender.ms) : '+' + duracaoFina(prender.maior), 'janela de retenção',
        'Metade de quem entra na live vai embora antes desse tempo: é a janela que você tem para prender quem acabou de chegar.'],
      [comTempo.length ? duracaoCurta(mediaMs) : '—', 'tempo médio assistido'],
      [nf(pessoas.length), plural(pessoas.length, 'espectador único', 'espectadores únicos')],
    ].forEach(([v, r, dica]) => {
      const c = el('div', 'ind');
      c.appendChild(el('div', 'ind-v', v));
      c.appendChild(el('span', 'ind-r', r));
      if (dica) c.title = dica;
      ind.appendChild(c);
    });

    // a frase explica o número, com quantas entradas ele se apoia
    const exp = limpar($('audPrender'));
    if (!prender) {
      exp.textContent = 'Janela de retenção: aparece depois de 5 entradas acompanhadas desde o começo — quem já estava na live quando a contagem começou não entra nessa conta.';
    } else if (prender.ms != null) {
      exp.append(frase(
        [null, 'Metade de quem entra na live sai antes de '], ['b', duracaoFina(prender.ms)],
        [null, prender.rapido ? '; ' + nf(Math.round(prender.rapido * 100)) + '% sai já no primeiro minuto' : ''],
        [null, '. É o tempo que você tem para prender quem acabou de chegar · ' + nf(prender.n) + ' ' + plural(prender.n, 'entrada', 'entradas') + '.'],
      ));
    } else {
      exp.append(frase(
        [null, 'Mais da metade de quem entra continua assistindo depois de '], ['b', duracaoFina(prender.maior)],
        [null, ' — o público está ficando · ' + nf(prender.n) + ' ' + plural(prender.n, 'entrada', 'entradas') + '.'],
      ));
    }

    const janelas = a ? janelasAudiencia(a, janelaAud) : [];
    const leg = limpar($('legAudiencia'));
    SERIES_AUD.forEach(([k, rot]) => {
      const b = el('button');
      b.type = 'button';
      b.setAttribute('aria-pressed', seriesOcultas.has(k) ? 'false' : 'true');
      const i = el('i');
      i.style.background = 'var(--serie-' + k + ')';
      b.appendChild(i);
      b.appendChild(document.createTextNode(rot));
      b.onclick = () => { if (seriesOcultas.has(k)) seriesOcultas.delete(k); else seriesOcultas.add(k); desenharAudiencia(); };
      leg.appendChild(b);
    });
    const gA = $('grafAudiencia');
    if (!janelas.length) {
      limpar(gA).appendChild(el('div', 'aud-vazio', 'O gráfico começa assim que a live mandar o primeiro número de audiência.'));
    } else {
      graficoLinhas(gA, janelas, SERIES_AUD.map(([k, rot], idx) => ({
        k, rot,
        // pessoas = média na janela; o resto = soma de interações na janela
        vals: janelas.map((j) => (idx === 0 ? j.media : j.inter[idx - 1])),
      })));
    }

    const lista = limpar($('audPessoas'));
    if (!pessoas.length) {
      lista.appendChild(vazioSimples('Ninguém na lista de espectadores ainda. Ela começa a encher na primeira consulta com o painel aberto.'));
      return;
    }
    pessoas.slice().sort((x, y) => y.ms - x.ms).slice(0, 12).forEach((p, i) => {
      const det = 'entrou ' + hhmm(p.entrou)
        + (p.chat ? ' · ' + nf(p.chat) + ' ' + plural(p.chat, 'mensagem', 'mensagens') : '')
        + (p.gemas ? ' · ' + nf(p.gemas) + ' ' + plural(p.gemas, 'gema', 'gemas') : '');
      const l = linhaPessoa(i + 1, p, det, duracaoCurta(p.ms), '');
      const q = l.querySelector('.quem');
      if (p.ativo) { const b = el('span', 'ativo'); b.title = 'assistindo agora'; q.insertBefore(b, q.querySelector('.det')); }
      // ficou bastante e não falou nem mandou nada: público calado
      if (!p.chat && !p.gemas && p.ms >= 10 * 60000) q.appendChild(el('span', 'calado', 'calado'));
      lista.appendChild(l);
    });
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

  // Seletores do ranking (tipo, métrica, escopo) e o olho.
  function desenharSeletoresRanking() {
    const comp = rkTipo === 'compradores';
    document.querySelectorAll('[data-rtipo]').forEach((b) => b.setAttribute('aria-checked', b.dataset.rtipo === rkTipo ? 'true' : 'false'));
    $('fichasMetrica').hidden = !comp;
    document.querySelectorAll('[data-rmetrica]').forEach((b) => b.setAttribute('aria-checked', b.dataset.rmetrica === rkMetrica ? 'true' : 'false'));
    $('subEscopoLive').textContent = 'Só a live aberta agora';
    $('pane-ranking').classList.toggle('rk-oculto', rkOculto);
    const olho = $('btnRkOlho');
    olho.setAttribute('aria-pressed', rkOculto ? 'true' : 'false');
    olho.title = rkOculto
      ? 'Mostrar os seletores' + (comp ? ' e os valores' : '')
      : 'Mostrar só o ranking' + (comp ? ' e esconder os valores' : '');
    // título no formato do sorteio: diz o que está na tela (sobra sozinho
    // quando o olho esconde os seletores)
    $('rkResumo').textContent = (comp ? 'Ranking de compradores · ' + METRICAS[rkMetrica].toLowerCase() : 'Ranking de gemas')
      + ' · ' + ((dados && dados.escopo) === 'vendedor' ? 'todas as lives' : 'nesta live');
  }

  // Compradores do escopo do ranking, já ordenados pela métrica. Os de todas
  // as lives vêm da aba (a mesma lista que a urna de compradores usa).
  function rankingCompradores() {
    const d = dados;
    let base;
    if (d.escopo === 'vendedor') {
      if ((!rkCompradoresCanal || rkCanalVelho) && Date.now() - rkCanalPedidoEm > 2000) {
        rkCanalPedidoEm = Date.now();
        mandar('participantes', { escopo: 'vendedor', tipo: 'compradores' });
      }
      if (!rkCompradoresCanal) return null;
      base = rkCompradoresCanal;
    } else {
      base = d.compradores || [];
    }
    const [a, b] = rkMetrica === 'compras' ? ['compras', 'valor'] : ['valor', 'compras'];
    return base.slice().sort((x, y) => (y[a] || 0) - (x[a] || 0) || (y[b] || 0) - (x[b] || 0));
  }

  // Como cada tipo de ranking se escreve: valor grande, unidade e detalhe.
  // Compradores com o olho fechado: valores viram ***.
  function formatoRanking() {
    const vendedor = dados.escopo === 'vendedor';
    const lives = (r) => (vendedor && r.lives ? ' · ' + nf(r.lives) + ' ' + plural(r.lives, 'live', 'lives') : '');
    if (rkTipo !== 'compradores') {
      return {
        num: (r) => r.gemas || 0,
        valor: (r) => nf(r.gemas),
        unidade: '💎',
        det: (r) => nf(r.envios) + ' ' + plural(r.envios, 'envio', 'envios') + lives(r),
        aria: (r) => nf(r.gemas) + ' gemas',
      };
    }
    const oculto = rkOculto;
    const porValor = rkMetrica === 'valor';
    const compras = (r) => nf(r.compras) + ' ' + plural(r.compras, 'compra', 'compras');
    return {
      num: (r) => (porValor ? r.valor : r.compras) || 0,
      valor: (r) => (oculto ? '***' : porValor ? brl(r.valor) : nf(r.compras)),
      unidade: porValor ? '' : '🛍',
      det: (r) => (oculto ? '***' : porValor ? compras(r) : brl(r.valor)) + lives(r),
      aria: (r) => (oculto ? 'valor escondido' : porValor ? brl(r.valor) : compras(r)),
    };
  }

  function desenharRanking() {
    const d = dados;
    const comp = rkTipo === 'compradores';
    const rk = comp ? rankingCompradores() : (d.ranking || []);
    const podio = $('podio');
    const alvo = limpar($('ranking'));
    const btnMais = $('maisRanking');

    if (!rk || !rk.length) {
      podio.hidden = true;
      limpar(podio);
      assinaturaPodio = '';
      btnMais.hidden = true;
      alvo.appendChild(!comp ? vazioRanking()
        : !rk ? vazioSimples('Buscando os compradores das lives salvas…')
          : vazioSimples(d.escopo === 'vendedor'
            ? 'Nenhuma compra salva ainda nas lives deste canal.'
            : 'Ninguém comprou nesta live ainda.'));
      return;
    }

    const f = formatoRanking();
    // O pódio só nasce com 3 pessoas: com 1 ou 2 ele parece defeito.
    const temPodio = rk.length >= 3;
    podio.hidden = !temPodio;
    if (temPodio) desenharPodio(rk, f);
    else { limpar(podio); assinaturaPodio = ''; }

    const inicio = temPodio ? 3 : 0;
    const resto = rk.slice(inicio);
    resto.slice(0, limiteRanking).forEach((r, i) => {
      alvo.appendChild(linhaPessoa(inicio + i + 1, r, f.det(r), f.valor(r), f.unidade));
    });

    const faltam = resto.length - limiteRanking;
    btnMais.hidden = faltam <= 0;
    if (faltam > 0) btnMais.textContent = 'mostrar mais ' + Math.min(PASSO_RANKING, faltam);
  }

  let assinaturaPodio = '';
  function desenharPodio(rk, f) {
    const topo = rk.slice(0, 3);
    const assinatura = rkTipo + rkMetrica + (rkOculto ? 'o' : '') + (dados.escopo || '') + '|'
      // a foto entra na conta: quando alguém do pódio troca de foto, ele redesenha
      + topo.map((r) => r.id + ':' + f.num(r) + ':' + f.det(r) + ':' + (r.avatar || '')).join('|');
    const igual = assinatura === assinaturaPodio;
    assinaturaPodio = assinatura;
    if (igual) return;              // sem reanimar a entrada a cada delta

    const podio = limpar($('podio'));
    const max = Math.max(...topo.map((r) => f.num(r)), 1);
    const medalhas = ['👑', '🥈', '🥉'];
    [1, 0, 2].forEach((idx) => {
      const r = topo[idx];
      const g = el('div', 'degrau p' + (idx + 1));
      g.setAttribute('aria-label', (idx + 1) + 'º lugar: @' + r.usuario + ', ' + f.aria(r));
      g.appendChild(el('div', 'medalha', medalhas[idx]));
      g.appendChild(avatar(r.avatar, r.usuario, r.id, idx === 0 ? 'av-g' : 'av-m'));
      g.appendChild(el('div', 'quem', '@' + r.usuario));
      g.appendChild(el('div', 'gem', f.valor(r)));
      g.appendChild(el('div', 'det', f.det(r)));
      const pedestal = el('div', 'pedestal', String(idx + 1) + 'º');
      pedestal.style.height = Math.round(18 + 34 * (f.num(r) / max)) + 'px';
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

    // O atalho só aparece se houver conteúdo de verdade. (O das lives
    // anteriores saiu junto com a tela Resumo das Lives, que está em breve.)
    const compradores = (d.compradores || []).length;
    if (compradores) {
      const atalhos = el('div', 'atalhos');
      {
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
    l.appendChild(avatar(e.avatar, e.usuario, e.userId));
    // nome em cima, a gema embaixo (mesma linha em duas camadas do Panel)
    const m = el('span', 'fl-main');
    m.appendChild(el('span', 'nome', '@' + e.usuario));
    const g = el('span', 'gema');
    g.appendChild(iconeGema({ iconeUrl: e.iconeUrl }));
    g.appendChild(el('span', null, e.iconeNome || e.iconeId));
    m.appendChild(g);
    l.appendChild(m);
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
    $('novas').hidden = modoViewers || novasNoFeed <= 0;
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

  // ------------------------------------------------------- modo privado
  // O olho no menu do card borra o card inteiro e troca todo número por
  // "***" — para mostrar o painel em tela compartilhada ou na própria live
  // sem expor gemas, vendas e audiência. O card continua se atualizando por
  // baixo: um observador mascara cada texto novo assim que ele é escrito,
  // e ao desligar cada texto volta ao valor original (ou ao mais novo, se
  // ele mudou nesse meio tempo).
  //
  // Cada área tem o seu estado e só o seu olho mexe nela:
  //   - Sorteio: o olho do menu, com a aba Sorteio aberta — ali ele não borra
  //     nem troca números: esconde a configuração e deixa só o palco;
  //   - Insights (topo, indicadores): o olho do menu, com a aba Insights aberta;
  //   - Insights (Audiência para baixo, "B"): o olho no título dela.
  // O olho do menu é um botão só, mas guarda um estado por aba e mostra o da
  // aba aberta. A aba Ranking tem o olho dela (btnRkOlho) e o do menu some.
  const NUMERO = /\d[\d.,:%]*/g;
  const textosOriginais = new WeakMap();   // nó de texto -> {orig, masc}
  const lerLigado = (k) => { try { return localStorage.getItem(k) === '1'; } catch { return false; } };
  const CHAVE_PRIVADO = { sorteio: 'bj-privado-sorteio', insights: 'bj-privado' };
  const privadoAba = { sorteio: lerLigado(CHAVE_PRIVADO.sorteio), insights: lerLigado(CHAVE_PRIVADO.insights) };
  let privadoB = lerLigado('bj-privado-b');   // Insights, da Audiência para baixo
  const naAreaB = (n) => $('secaoAudiencia').contains(n);
  const noTopoInsights = (n) => $('pane-insights').contains(n) && !naAreaB(n);
  // números trocados por *** (o Sorteio não entra: lá o olho só esconde a configuração)
  const escondido = (n) => (privadoAba.insights && noTopoInsights(n))
    || (privadoB && naAreaB(n));
  const algumPrivado = () => privadoAba.sorteio || privadoAba.insights || privadoB;

  function mascararTexto(n) {
    const t = n.nodeValue;
    if (!t || !/\d/.test(t)) return;
    const masc = t.replace(NUMERO, '***');
    textosOriginais.set(n, { orig: t, masc });
    n.nodeValue = masc;
  }
  function percorrerTextos(raiz, fn) {
    if (raiz.nodeType === 3) { fn(raiz); return; }
    const w = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) fn(n);
  }

  const observadorPrivado = new MutationObserver((muts) => {
    if (!algumPrivado()) return;
    const talvez = (n) => { if (escondido(n)) mascararTexto(n); };
    muts.forEach((m) => {
      if (m.type === 'characterData') talvez(m.target);
      else m.addedNodes.forEach((n) => percorrerTextos(n, talvez));
    });
  });

  // O olho do menu mostra o estado da aba aberta (chamado também ao trocar de aba).
  function atualizarOlhoDoMenu() {
    const on = !!privadoAba[paneAtivo];
    $('btnPrivado').setAttribute('aria-pressed', on ? 'true' : 'false');
    $('btnPrivado').title = paneAtivo === 'sorteio'
      ? (on ? 'Mostrar a configuração do sorteio' : 'Esconder a configuração do sorteio (fica só o palco)')
      : (on ? 'Mostrar números desta aba' : 'Esconder números desta aba (modo privado)');
  }

  function aplicarPrivado() {
    const card = $('cardRanking');
    $('pane-sorteio').classList.toggle('privado', privadoAba.sorteio);
    $('pane-insights').classList.toggle('privado', privadoAba.insights);
    $('secaoAudiencia').classList.toggle('privado', privadoB);
    atualizarOlhoDoMenu();
    $('btnPrivadoB').setAttribute('aria-pressed', privadoB ? 'true' : 'false');
    $('btnPrivadoB').title = privadoB ? 'Mostrar números' : 'Esconder números (modo privado)';
    if (privadoB) esconderDica();   // a dica do gráfico fica na área B
    // mascara o que está escondido e devolve o que não está mais
    percorrerTextos(card, (n) => {
      if (escondido(n)) { if (!textosOriginais.has(n)) mascararTexto(n); return; }
      const o = textosOriginais.get(n);
      if (o && n.nodeValue === o.masc) n.nodeValue = o.orig;
      textosOriginais.delete(n);
    });
    if (algumPrivado()) observadorPrivado.observe(card, { subtree: true, childList: true, characterData: true });
    else observadorPrivado.disconnect();
  }

  $('btnPrivado').onclick = () => {
    const aba = paneAtivo;
    if (!(aba in privadoAba)) return;
    privadoAba[aba] = !privadoAba[aba];
    try { localStorage.setItem(CHAVE_PRIVADO[aba], privadoAba[aba] ? '1' : '0'); } catch {}
    aplicarPrivado();
  };
  $('btnPrivadoB').onclick = () => {
    privadoB = !privadoB;
    try { localStorage.setItem('bj-privado-b', privadoB ? '1' : '0'); } catch {}
    aplicarPrivado();
  };
  // depois do carregamento: aplicarPrivado lê paneAtivo, que é declarado mais abaixo
  setTimeout(() => { if (algumPrivado()) aplicarPrivado(); }, 0);
  $('btnPrivado').hidden = true;   // o painel abre na aba Ranking, que tem o olho dela

  // ------------------------------------------------- feed de espectadores
  // Nos Insights o card do feed troca de assunto: em vez dos envios de gema,
  // quem entrou e quem saiu da live (vem do audiencia.js). Mesma linha do
  // feed de envios: hora, foto, @ e o que aconteceu.
  const idsViewers = new Set();
  let modoViewers = false;

  function modoFeedViewers(ligar) {
    modoViewers = ligar;
    $('tituloFeed').textContent = ligar ? 'Feed de espectadores' : 'Feed de envios';
    ['subFeed', 'feed'].forEach((id) => { $(id).hidden = ligar; });
    ['subViewers', 'feedViewers'].forEach((id) => { $(id).hidden = !ligar; });
    if (ligar) {
      $('novas').hidden = true;
      $('tagFeed').textContent = 'esta live';
      desenharFeedViewers();
    } else {
      atualizarNovas();
      if (dados) $('tagFeed').textContent = dados.escopo === 'vendedor' ? nf((dados.totais || {}).livesNoEscopo) + ' lives' : 'esta live';
    }
  }

  const chaveViewer = (e) => e.t + ':' + e.tipo + ':' + (e.id || '');

  function linhaViewer(e, animar) {
    if (e.tipo === 'inicio') {
      return el('div', 'fl inicio', nf(e.n) + ' ' + plural(e.n, 'espectador já estava', 'espectadores já estavam')
        + ' assistindo às ' + hora(e.t));
    }
    const l = el('div', 'fl' + (animar ? ' chegou' : ''));
    l.appendChild(el('span', 'hora', hora(e.t)));
    l.appendChild(avatar(e.a, e.u, e.id));
    const m = el('span', 'fl-main');
    m.appendChild(el('span', 'nome', '@' + (e.u || '?')));
    const acao = el('span', 'acao ' + e.tipo);
    acao.appendChild(el('i'));
    acao.appendChild(el('span', null, e.tipo === 'entrou' ? 'entrou' : 'saiu'));
    m.appendChild(acao);
    l.appendChild(m);
    l.appendChild(el('span', 'ficou', e.tipo === 'saiu' && e.ms ? 'ficou ' + duracaoCurta(e.ms) : ''));
    return l;
  }

  function desenharFeedViewers() {
    if (!modoViewers) return;
    const caixa = $('feedViewers');
    const eventos = ((audiencia && audiencia.eventos) || []).slice().sort((x, y) => x.t - y.t);
    const entradas = eventos.filter((e) => e.tipo === 'entrou').length;
    const saidas = eventos.filter((e) => e.tipo === 'saiu').length;
    const agora = ((audiencia && audiencia.pessoas) || []).filter((p) => p.ativo).length;
    limpar($('subViewers')).append(frase(
      ['span', nf(agora) + ' ' + plural(agora, 'logado assistindo', 'logados assistindo')],
      [null, ' · ' + nf(entradas) + ' ' + plural(entradas, 'entrada', 'entradas') + ' · ' + nf(saidas) + ' ' + plural(saidas, 'saída', 'saídas')],
    ));
    $('subViewers').firstChild.className = 'forte';

    if (!eventos.length) {
      limpar(caixa);
      idsViewers.clear();
      caixa.appendChild(vazioSimples(audiencia
        ? 'As entradas e saídas aparecem aqui a partir da primeira consulta da lista de espectadores.'
        : 'Abra a aba da live para acompanhar quem entra e sai.'));
      return;
    }
    // incremental, como o feed de envios: só acrescenta o que é novo
    const novos = eventos.filter((e) => !idsViewers.has(chaveViewer(e)));
    if (!novos.length) return;
    const primeiro = !idsViewers.size;
    const perto = primeiro || caixa.scrollHeight - caixa.scrollTop - caixa.clientHeight < 50;
    if (primeiro) limpar(caixa);
    // uma saída pode ser registrada com a hora da última vez visto, antes de
    // linhas que já estão na tela: aí redesenha tudo em ordem
    const ultimoNaTela = caixa.lastElementChild && Number(caixa.lastElementChild.dataset.t);
    if (!primeiro && ultimoNaTela && novos[0].t < ultimoNaTela) {
      limpar(caixa);
      idsViewers.clear();
      eventos.forEach((e) => { const l = linhaViewer(e, false); l.dataset.t = e.t; caixa.appendChild(l); idsViewers.add(chaveViewer(e)); });
    } else {
      novos.forEach((e) => { const l = linhaViewer(e, !primeiro); l.dataset.t = e.t; caixa.appendChild(l); idsViewers.add(chaveViewer(e)); });
    }
    if (perto) caixa.scrollTop = caixa.scrollHeight;
  }

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

    // Compradores de outras lives existem só a partir de quando a extensão
    // passou a gravá-los (3.5): o texto do card diz desde quando há registro.
    const comp = deCompradores();
    document.querySelectorAll('[data-tipo]').forEach((b) => b.setAttribute('aria-checked', b.dataset.tipo === sorteio.tipo ? 'true' : 'false'));
    document.querySelectorAll('[data-sesc]').forEach((b) => b.setAttribute('aria-checked', b.dataset.sesc === sorteio.escopo ? 'true' : 'false'));
    document.querySelectorAll('[data-modo]').forEach((b) => b.setAttribute('aria-checked', b.dataset.modo === sorteio.modo ? 'true' : 'false'));
    document.querySelectorAll('[data-anim]').forEach((b) => b.setAttribute('aria-checked', b.dataset.anim === sorteio.anim ? 'true' : 'false'));
    $('rotSorteioLive').textContent = 'Nesta live';
    $('rotSorteioVendedor').textContent = 'Todas as lives';
    const desde = registroMaisAntigo(comp);
    $('subSorteioVendedor').textContent = 'Todas as lives do canal' + (desde ? ' desde ' + dataLonga(desde) : '');
    $('rotModoPeso').textContent = 'Por quantidade';
    $('subModoPeso').textContent = comp ? 'Cada compra vale uma chance' : 'Cada gema vale uma chance';

    // O filtro de gema é herdado da tela "Ao vivo" e tem que aparecer por extenso:
    // sortear sem perceber que havia filtro é o erro mais caro da interface.
    // Agora ele aparece (e se troca) no próprio card de Gemas; o aviso antigo
    // abaixo dos cards ficou redundante. No sorteio de compradores ele não vale.
    $('soGemas').hidden = true;
    desenharFiltroGema();
    if (d.filtro) $('soGemasNome').textContent = (d.nomeDoFiltro || d.filtro);

    const base = baseDaUrna();
    const urna = base ? calcularUrna(base) : null;

    const fora = urna ? urna.fora.length : 0;
    $('rotSemRepetir').textContent = 'Não repetir ganhador'
      + (sorteio.semRepetir && fora ? ' (' + nf(fora) + ' ' + plural(fora, 'fora', 'fora') + ')' : '');
    $('semRepetir').checked = sorteio.semRepetir;
    $('exigirPresenca').checked = sorteio.presenca;
    $('entreTipos').checked = sorteio.entreTipos;

    desenharUrna(urna);
    $('btnSortear').disabled = girando || !urna || !urna.lista.length;

    desenharHistorico();
    if (!ultimoResultado) desenharResultadoVazio();
  }

  // Início da live mais antiga deste canal que a extensão guardou (com compras,
  // no sorteio de compradores; com gemas, no de gemas).
  function registroMaisAntigo(comp) {
    const ts = ((dados && dados.livesDoVendedor) || [])
      .filter((l) => (comp ? l.compradores : l.pessoas) > 0)
      .map((l) => l.inicio || l.fim)
      .filter((t) => t > 0);
    return ts.length ? Math.min(...ts) : 0;
  }
  const dataLonga = (t) => new Date(t).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  // O escopo do sorteio é independente do escopo do ranking. Quando são iguais
  // o ranking do snapshot já serve; quando são diferentes, pedimos a lista
  // daquele escopo (mensagem `participantes` -> `painel-urna`).
  function baseDaUrna() {
    if (!dados) return null;
    // os compradores da live aberta vêm no snapshot; os do canal inteiro
    // são pedidos à aba, como a urna de gemas de outro escopo
    if (deCompradores() && sorteio.escopo === 'live') {
      return (dados.compradores || []).map((c) => Object.assign({}, c, { envios: c.compras }));
    }
    if (!deCompradores() && sorteio.escopo === (dados.escopo || 'live')) return dados.ranking || [];
    const temCache = urnaRemota && urnaRemota.escopo === sorteio.escopo && urnaRemota.tipo === sorteio.tipo;
    if ((!temCache || urnaVelha) && Date.now() - urnaPedidaEm > 900) {
      urnaPedidaEm = Date.now();
      mandar('participantes', { escopo: sorteio.escopo, tipo: sorteio.tipo });
    }
    return temCache ? urnaRemota.lista : null;
  }

  // modo e "não repetir" são aplicados aqui: trocar um deles não precisa de
  // viagem até a aba.
  function calcularUrna(base) {
    const comp = deCompradores();
    const ganhadores = new Set(sorteio.semRepetir ? ((comp ? dados.jaGanharamCompradores : dados.jaGanharam) || []) : []);
    // marcado como "já sorteado" ou "ausente" sai sempre (a aba faz o mesmo)
    const tipo = comp ? 'compradores' : 'gemas';
    (historico || []).forEach((h) => { if (h.motivo && (h.tipo || 'gemas') === tipo) ganhadores.add(h.id); });
    // "Não repetir ganhadores entre gemas e compradores": quem ganhou no outro tipo, pelo id
    // ou pelo @ (os ids das duas listas vêm de respostas diferentes da Jamble)
    const nomesOutro = new Set();
    if (sorteio.entreTipos) {
      ((comp ? dados.jaGanharam : dados.jaGanharamCompradores) || []).forEach((id) => ganhadores.add(id));
      (historico || []).forEach((h) => { if ((h.tipo || 'gemas') !== tipo) nomesOutro.add(String(h.usuario || '').toLowerCase()); });
    }
    const dentro = [];
    const fora = [];
    base.forEach((r) => (ganhadores.has(r.id) || nomesOutro.has(String(r.usuario || '').toLowerCase()) ? fora : dentro).push(r));
    const lista = dentro
      .map((r) => Object.assign({}, r, { bilhetes: sorteio.modo === 'peso' ? Math.max(1, comp ? r.compras : r.gemas) : 1 }))
      .sort((a, b) => b.bilhetes - a.bilhetes || b.envios - a.envios);
    const total = lista.reduce((a, x) => a + x.bilhetes, 0);
    return { lista, total, fora };
  }

  function desenharUrna(urna) {
    const caixa = limpar($('urna'));
    const tag = $('tagUrna');
    const sub = $('subUrna');
    $('notaConcentracao').hidden = true;

    const comp = deCompradores();
    if (!urna) {
      tag.textContent = '';
      sub.textContent = '';
      caixa.appendChild(vazioSimples(comp ? 'Buscando os compradores das lives salvas…' : 'Buscando quem mandou gema nesse escopo…'));
      return;
    }

    tag.textContent = (comp ? 'compradores · ' : '') + (sorteio.escopo === 'live' ? 'esta live' : 'todas as lives');
    limpar(sub).append(frase(
      ['span', nf(urna.lista.length) + ' ' + plural(urna.lista.length, 'pessoa', 'pessoas')],
      [null, ' · ' + nf(urna.total) + ' ' + plural(urna.total, 'chance', 'chances')
        + (!comp && dados.filtro ? ' · só ' + (dados.nomeDoFiltro || dados.filtro) : '')],
    ));
    sub.firstChild.className = 'forte';

    if (!urna.lista.length) {
      caixa.appendChild(vazioSimples(comp
        ? (sorteio.semRepetir && urna.fora.length
          ? 'Todo mundo que comprou já ganhou. Desmarque “Não repetir quem já ganhou neste sorteio” ou limpe a lista.'
          : sorteio.escopo === 'vendedor'
            ? 'Nenhuma compra salva ainda. A extensão guarda os compradores de cada live daqui em diante.'
            : 'Ninguém comprou nesta live ainda. O sorteio abre quando sair a primeira venda.')
        : dados.filtro
          ? 'Ninguém mandou ' + (dados.nomeDoFiltro || dados.filtro) + ' nesse escopo ainda — não há ninguém para sortear.'
          : sorteio.semRepetir && urna.fora.length
            ? 'Todo mundo que mandou gema já ganhou. Desmarque “Não repetir quem já ganhou neste sorteio” ou limpe a lista.'
            : 'Ninguém mandou gema ainda. O sorteio abre sozinho quando a primeira gema chegar.'));
      return;
    }

    const maior = urna.lista[0];
    urna.lista.slice(0, 60).forEach((r) => {
      const p = urna.total ? (r.bilhetes / urna.total) * 100 : 0;
      const l = el('div', 'ul');
      l.appendChild(avatar(r.avatar, r.usuario, r.id, 'av-p'));
      l.appendChild(el('div', 'quem', '@' + r.usuario));
      l.appendChild(el('div', 'gem', comp
        ? nf(r.compras) + ' ' + plural(r.compras, 'compra', 'compras')
        : nf(r.gemas) + ' 💎'));
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
      r.appendChild(el('div', 'txt', 'Fora desta vez (já ganharam ou foram marcados): '
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
    // A lista é guardada por canal: depois de recarregar, o palco volta com o
    // último ganhador (e, se ainda não se resolveu, a espera pela presença) —
    // mas só se ele saiu nesta live. Ganhador de outra live fica só na lista.
    const h = (historico || [])[0];
    if (h && h.showId && h.showId === liveDoPalco && !girando && !esperandoSorteio) { restaurarUltimo(h); return; }
    const alvo = limpar($('resultado'));
    alvo.appendChild(vazioSimples('Nenhum sorteio nesta live ainda. A urna abaixo mostra quem está dentro e com que chance.'));
  }

  function restaurarUltimo(h) {
    const d = dados || {};
    // a foto vem da urna/ranking/compradores, se a pessoa ainda estiver lá
    const achado = [].concat(d.ranking || [], d.compradores || [], (urnaRemota && urnaRemota.lista) || [])
      .find((x) => x.id === h.id);
    const vencedor = { id: h.id, usuario: h.usuario, avatar: (achado && achado.avatar) || '' };
    ultimoResultado = { vencedor, chance: 0, participantes: 0, bilhetes: 0, restaurado: true };
    presenca = sorteio.presenca && h.t
      ? {
        userId: h.id, usuario: String(h.usuario || '').toLowerCase(), t: h.t,
        msgs: [], confirmado: !!h.confirmado, revelado: false, motivo: h.motivo || '',
      }
      : null;
    pintarResultado(ultimoResultado);
  }

  function mostrarSorteio(r) {
    if (!r) return;
    esperandoSorteio = false;
    historico = aplicarMotivos(r.historico || historico);
    if (!r.vencedor) {
      girando = false;
      $('btnSortear').classList.remove('girando');
      const alvo = limpar($('resultado'));
      alvo.appendChild(vazioSimples('Ninguém elegível com essas opções. Confira o filtro de gema e a opção “Não repetir quem já ganhou neste sorteio”.'));
      desenharSorteio();
      return;
    }
    const chance = (() => {
      const p = (r.participantes || []).find((x) => x.id === r.vencedor.id);
      return p && r.bilhetes ? (p.bilhetes / r.bilhetes) * 100 : 0;
    })();
    ultimoResultado = { vencedor: r.vencedor, chance, participantes: (r.participantes || []).length, bilhetes: r.bilhetes };
    // A presença vale a partir daqui (hora de chegada no painel, não a do
    // servidor da Jamble: assim relógio adiantado ou atrasado não importa).
    // O que o vencedor escrever durante a animação já conta.
    const entrada = (r.historico || [])[0];
    presenca = sorteio.presenca
      ? {
        userId: r.vencedor.id, usuario: String(r.vencedor.usuario || '').toLowerCase(),
        t: entrada && entrada.id === r.vencedor.id ? entrada.t : 0,
        msgs: [], confirmado: false, revelado: false, motivo: '',
      }
      : null;
    $('palco').classList.remove('com-presenca');
    preCarregarFotos([r.vencedor].concat(r.participantes || []));
    const pronto = () => { pintarResultado(ultimoResultado); desenharSorteio(); };
    if (sorteio.anim === 'feixes') girar(r.participantes || [], r.vencedor, pronto);
    else if (sorteio.anim === 'patos') correrPatos(r.participantes || [], r.vencedor, pronto);
    else girarSubida(r.participantes || [], r.vencedor, pronto);
  }

  // ------------------------------------------------------------- palco
  // Cinco segundos (o mesmo tempo da animação de subida) de feixes e nomes
  // inclinados convergindo para o centro, depois a revelação com onda de choque
  // e confete. Tudo em canvas aqui mesmo — nenhuma biblioteca externa, porque a
  // CSP de página de extensão não carrega script de fora e não quero uma
  // dependência inteira por causa de um efeito.
  const GIRO_MS = 5000;   // o confete continua depois
  const REVELA_MS = 5100;
  let palco = null;

  function pararPalco() {
    if (!palco) return;
    clearInterval(palco.raf);
    clearTimeout(palco.rede);
    clearTimeout(palco.fecha);
    if (palco.overlay) palco.overlay.remove();   // a corrida de patos usa a janela inteira
    if (palco.soltar) palco.soltar();
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
      const livre = Math.round(limite - topoFinal - 36);   // 14 de folga + 22 do padding do card
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
      desenharNomesVoando(p, t);
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

    desenharConfete(p, t > REVELA_MS + 900);
  }

  // Nomes sugados para o centro junto com os feixes: cada um sai da borda,
  // inclinado, acelera e encolhe até sumir no meio. Usa as mesmas imagens
  // prontas da animação de subida (spriteDoNome).
  function desenharNomesVoando(p, t) {
    const { ctx, l, a } = p;
    const cx = l / 2;
    const cy = a / 2;
    const s = t / 1000;
    for (const n of p.voando) {
      const k = (t - n.sai) / n.dura;
      if (k < 0 || k > 1) continue;
      if (!n.spr) n.spr = spriteDoNome(n, p.fonte);
      const e = Math.pow(k, 1.7);              // começa devagar e é puxado no fim
      const x = cx + Math.cos(n.ang) * l * 0.62 * (1 - e);
      const y = cy + Math.sin(n.ang) * a * 0.62 * (1 - e);
      const esc = 1 - e * 0.7;
      ctx.globalAlpha = (0.3 + n.prof * 0.65) * Math.min(1, k * 7, (1 - k) * 4);
      const ang = n.incl + Math.sin(n.f1 + s * n.w) * 0.08;
      const cos = Math.cos(ang) * esc * p.base;
      const sin = Math.sin(ang) * esc * p.base;
      ctx.setTransform(cos, sin, -sin, cos, p.base * x, p.base * y);
      ctx.drawImage(n.spr, -n.larg / 2, -n.alt / 2, n.larg, n.alt);
    }
    ctx.globalAlpha = 1;
    ctx.setTransform(p.base, 0, 0, p.base, 0, 0);
  }

  function desenharConfete(p, sumindo) {
    const { ctx, a } = p;
    for (const c of p.pecas) {
      c.vy += 0.17;
      c.vx *= 0.992;
      c.x += c.vx;
      c.y += c.vy;
      c.g += c.vg;
      if (c.y > a + 30) c.vida = 0;
      if (c.vida > 0 && sumindo) c.vida -= 0.025;
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

  // Giro: 5s de palco. É desenho — o vencedor já veio pronto do gems-core.
  function girar(todos, vencedor, pronto) {
    // O letreiro desacelera e para no último nome: esse nome tem que ser o
    // vencedor, senão parece que ia ser um e foi outro. A ordem é a urna
    // embaralhada com o vencedor no fim.
    const outros = todos.filter((x) => !vencedor || x.id !== vencedor.id);
    const participantes = embaralhar(outros.slice()).concat(vencedor ? [vencedor] : []);
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
    // Fila dos nomes que voam para o centro: todos, embaralhados, repetindo
    // quando a urna é pequena para os feixes não ficarem sozinhos.
    const fila = [];
    while (fila.length < Math.max(nomes.length, 40)) fila.push(...embaralhar(nomes.slice()));
    const voo = Math.max(800, Math.min(1500, 1500 - (fila.length - 40) * 1.2));
    const janela = GIRO_MS - voo - 60;
    const p = {
      cv, ctx: medida.ctx, l: medida.l, a: medida.a, pecas: [], feixes: [], onda: null,
      revelado: false, inicio: performance.now(), raf: 0, rede: 0, fecha: 0,
      base: Math.min(window.devicePixelRatio || 1, 2),
      fonte: getComputedStyle(document.body).fontFamily || 'sans-serif',
      mostrado: -1,
      // urna pequena dá mais de uma volta no letreiro; a última volta sempre
      // termina no último nome (o vencedor), exatamente no fim do giro
      passos: nomes.length * Math.max(1, Math.ceil(30 / nomes.length)),
      voando: fila.map((txt, i) => {
        const prof = Math.random();
        const lado = Math.random() < 0.5 ? -1 : 1;
        return {
          txt, prof,
          sai: (janela * (i + Math.random())) / fila.length,
          dura: voo * (1.15 - prof * 0.3),
          ang: Math.random() * Math.PI * 2,
          incl: lado * (0.12 + Math.random() * 0.3),
          f1: Math.random() * 6.28,
          w: 2 + Math.random() * 2.5,
          tam: 12 + prof * 14,
          verm: Math.random() < 0.05,
        };
      }),
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

      // O letreiro passa por TODOS os nomes da urna, numa ordem embaralhada
      // que termina no vencedor: o "N de N" é ele. A posição sai do relógio (e não
      // de um nome por quadro): assim urna de centenas cabe nos 5s sem a rede
      // de segurança revelar no meio da volta. Começa rápido e desacelera.
      // O vencedor não sai daqui: ele já veio sorteado pelo gems-core.
      if (t < GIRO_MS) {
        const e = 1 - Math.pow(1 - t / GIRO_MS, 2.2);
        const passo = Math.min(p.passos - 1, Math.floor(e * p.passos));
        if (passo !== p.mostrado) {
          p.mostrado = passo;
          pintarGiro(participantes[passo % nomes.length], passo % nomes.length, nomes.length);
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

  // --------------------------------------------------------- palco: subida
  // Cinco segundos de nomes subindo de baixo para cima, tortos e balançando.
  // Todo nome da urna passa pelo menos uma vez; com pouca gente eles repetem
  // para a tela não ficar vazia. Depois o vencedor sobe sozinho e pousa no meio
  // com impacto ("pouso de super-herói"). Tudo no canvas, de propósito: a CSS
  // apaga animação quando o Windows pede menos movimento, e esta foi pedida.
  const SUBIDA_MS = 5000;
  const POUSO = { sobe: 360, cai: 150, segura: 1500 };   // contados depois dos 5s

  // ------------------------------------------------------- corrida de patos
  // Fiel ao duckrace-game.com: as raias em diagonal (a de trás mais à direita),
  // a largada e a chegada quadriculadas inclinadas com o número de cada raia ao
  // lado, patos grandes de contorno preto e fantasia (patos.js), o rio passando
  // devagar com a câmera acompanhando o grupo e a diferença entre os patos de
  // no máximo um corpo, mudando aos poucos. No último segundo a chegada entra
  // pela direita; depois a câmera segue só o vencedor. A corrida toma a janela
  // inteira do painel. O vencedor já vem sorteado da urna (com a chance de cada
  // um); a corrida só é montada para ele cruzar primeiro.
  const CORRIDA_MS = 60000;        // relógio do tiro de largada até zerar (1 minuto)
  const ARRANCADA_MS = 8000;       // nos últimos segundos o vencedor acelera e passa todo mundo
  const LARGADA_MS = 800;          // patos parados na linha antes do tiro
  const CHEGADA_MS = 1300;         // a chegada entrando pela direita antes de zerar
  const VENCEDOR_MS = 3800;        // os outros ficam para trás e o vencedor vai ao meio

  function correrPatos(participantes, vencedor, pronto) {
    const fim = () => {
      girando = false;
      $('btnSortear').classList.remove('girando');
      pronto();
    };
    if (!participantes.length || !vencedor || !window.BJPatos) { pararPalco(); fim(); return; }
    pararPalco();
    limpar($('resultado'));

    const camada = el('div', 'corrida');
    camada.setAttribute('role', 'dialog');
    camada.setAttribute('aria-label', 'Corrida de patos');
    const cv = el('canvas');
    camada.appendChild(cv);
    camada.appendChild(el('div', 'corrida-dica', 'Esc pula para o resultado'));
    document.body.appendChild(camada);
    const fonte = getComputedStyle(document.body).fontFamily || 'sans-serif';
    let med = medirPalco(cv);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    // Como no original, todo mundo da urna entra na água, mesmo que fique tudo
    // amontoado; o teto é só para não pesar (o vencedor sempre corre)
    const maxRaias = 200;
    let corredores = participantes.filter((x) => x.id !== vencedor.id);
    const doVencedor = participantes.find((x) => x.id === vencedor.id) || { id: vencedor.id, usuario: vencedor.usuario };
    embaralhar(corredores);
    corredores = embaralhar(corredores.slice(0, maxRaias - 1).concat([doVencedor]));
    const fora = Math.max(0, participantes.length - corredores.length);
    const n = corredores.length;
    BJPatos.preparar(corredores.map((x) => x.id));

    // Vantagem de cada pato sobre o grupo, em corpos. Ela sai de algumas ondas
    // lentas somadas (de 12 a 40 s cada), então a velocidade de cada pato muda
    // devagar, sem tranco: um vai ganhando terreno, outro perde aos poucos. Nos
    // últimos ARRANCADA_MS o vencedor dá uma arrancada suave e termina na frente
    // de quem estiver liderando.
    // Com muita gente o bolo se espalha mais (no original, 60 patos ocupam metade
    // do rio na horizontal): a diferença cresce com o número de patos.
    const espalha = Math.min(4, 1 + n / 20);
    const patos = corredores.map((x, i) => {
      const ondas = [0, 1, 2].map((k) => ({
        w: (2 * Math.PI) / ((k === 0 ? 28000 : k === 1 ? 17000 : 11000) * (0.75 + Math.random() * 0.5)),
        f: Math.random() * 6.28,
        a: (k === 0 ? 0.75 : k === 1 ? 0.4 : 0.18) * (0.6 + Math.random() * 0.8) * espalha,
      }));
      return { id: x.id, nome: '@' + (x.usuario || '?'), ganha: x.id === vencedor.id, raia: i, ondas, fase: Math.random() * 6.28, extra: 0 };
    });
    const suave = (q) => (1 - Math.cos(Math.PI * Math.max(0, Math.min(1, q)))) / 2;
    // largada: as ondas entram aos poucos nos primeiros 4 s (todos saem juntos)
    function ondas(pt, t) {
      const tt = Math.max(0, Math.min(t, CORRIDA_MS));
      let v = 0;
      for (const o of pt.ondas) v += o.a * (Math.sin(o.w * tt + o.f) - Math.sin(o.f));
      return v * suave(tt / 4000);
    }
    const lider = Math.max(...patos.filter((x) => !x.ganha).map((x) => ondas(x, CORRIDA_MS)), -Infinity);
    const gv0 = patos.find((x) => x.ganha);
    gv0.extra = Math.max(0, (isFinite(lider) ? lider : 0) + 0.6 - ondas(gv0, CORRIDA_MS));
    function vantagem(pt, t) {
      const v = ondas(pt, t);
      return pt.ganha ? v + pt.extra * suave((t - (CORRIDA_MS - ARRANCADA_MS)) / (ARRANCADA_MS - 500)) : v;
    }
    const vantFinal = (pt) => vantagem(pt, CORRIDA_MS);
    // ordem de chegada, para o 2º e o 3º
    const ordem = patos.slice().sort((a, b) => vantFinal(b) - vantFinal(a));

    const p = { ctx: med.ctx, cv, overlay: camada, inicio: performance.now(), raf: 0, rede: 0, fecha: 0, pecas: [], l: med.l, a: med.a, acabou: false };
    palco = p;

    function pilula(ctx, x, y, w, h, r, fundo, borda) {
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
      ctx.fillStyle = fundo; ctx.fill();
      if (borda) { ctx.lineWidth = borda; ctx.strokeStyle = '#000'; ctx.stroke(); }
    }
    function etiqueta(ctx, xDir, yMeio, txt, tam, destaque) {
      ctx.font = '500 ' + tam + 'px ' + fonte;
      const w = ctx.measureText(txt).width + tam * 0.9;
      const h = tam * 1.45;
      pilula(ctx, xDir - w, yMeio - h / 2, w, h, tam * 0.35, destaque ? '#ffd23f' : '#fff', Math.max(1.5, tam * 0.12));
      ctx.fillStyle = '#000'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
      ctx.fillText(txt, xDir - w + tam * 0.45, yMeio + 0.5);
    }
    // faixa quadriculada inclinada (paralela à diagonal das raias)
    function linhaXadrez(ctx, xBase, yTopo, yFundo, incl, q) {
      const linhas = Math.ceil((yFundo - yTopo) / q);
      for (let r = 0; r < linhas; r++) {
        const y0 = yTopo + r * q;
        const y1 = Math.min(yFundo, y0 + q);
        for (let c = 0; c < 2; c++) {
          const x0 = xBase + (yFundo - y0) * incl + c * q;
          const x1 = xBase + (yFundo - y1) * incl + c * q;
          ctx.fillStyle = (r + c) % 2 ? '#000' : '#fff';
          ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + q, y0); ctx.lineTo(x1 + q, y1); ctx.lineTo(x1, y1); ctx.closePath(); ctx.fill();
        }
      }
      ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(xBase + (yFundo - yTopo) * incl, yTopo); ctx.lineTo(xBase, yFundo);
      ctx.moveTo(xBase + (yFundo - yTopo) * incl + 2 * q, yTopo); ctx.lineTo(xBase + 2 * q, yFundo);
      ctx.stroke();
    }

    function quadro() {
      if (palco !== p) return;
      const agora = performance.now();
      const t = agora - p.inicio - LARGADA_MS;
      if (Math.round(cv.clientWidth) !== Math.round(med.l) || Math.round(cv.clientHeight) !== Math.round(med.a)) {
        med = medirPalco(cv); p.ctx = med.ctx;
      }
      const { ctx, l, a } = med;
      p.l = l; p.a = a;

      // geometria: margem em cima, rio embaixo, raias em diagonal
      const rioY = a * 0.2;
      // O pato e o nome têm tamanho fixo (como no original): com pouca gente o
      // pato é grande; com muita, encolhe só um pouco e as raias se apertam, os
      // patos se amontoam uns por cima dos outros na mesma diagonal.
      // altura de referência (a do original) e o pato desenhado no dobro dela;
      // a vantagem entre os patos continua medida na referência, senão o bolo
      // ficaria largo demais para a tela
      const hRef = a * Math.max(0.11, 0.2 * Math.pow(4 / Math.max(4, n), 0.22));
      const h = Math.min(a * 0.42, hRef * 2);                    // altura do pato
      const yPrimeira = rioY + h * 0.5;                          // raia de trás
      const yUltima = a - h * 0.32;                              // raia da frente
      const dy = n > 1 ? (yUltima - yPrimeira) / (n - 1) : 0;
      const yRaia = (r) => (n > 1 ? yPrimeira + dy * r : (yPrimeira + yUltima) / 2);
      const tamNome = Math.max(10, Math.min(20, a * 0.03));
      const tamNum = Math.max(8, Math.min(15, a * 0.022));
      const AN = BJPatos.ancora;                                 // onde ficam bico, cabeça e corpo no desenho
      const w = h * AN.aspecto;
      const incl = 0.5;                                          // quanto a raia de cima anda para a direita, por px de altura
      const sx = dy * incl;
      // pato da raia de baixo, na largada; com o bolo espalhado, mais para dentro
      // para quem fica para trás não sair da tela pela esquerda
      const x0 = Math.max(l * 0.06, w * 0.2) + (espalha - 1) * hRef * (130 / 118) * 0.9;
      const v = l * 0.075;                                       // px/s do rio passando
      const corpo = hRef * (130 / 118) * 0.9;                    // "um corpo" de vantagem (na referência)

      // câmera: o grupo nada a v (o rio passa); os patos quase não saem do lugar na tela
      const fimRelogio = CORRIDA_MS;
      const cam = (Math.max(0, Math.min(t, fimRelogio + 2000)) / 1000) * v;
      // A linha é guardada pela base (x no pé da faixa); na raia de cada pato ela
      // está em base + (yFundo - y) * incl, a mesma inclinação das raias. Por isso
      // basta comparar a base com o nariz do pato "trazido" para a raia de baixo.
      const yFundoL = yRaia(n - 1) + h * 0.35;
      const baseNoNariz = (vant) => x0 + w * AN.bico + vant * corpo - h * 0.35 * incl;
      // nos últimos CHEGADA_MS a chegada desliza da direita até o nariz do vencedor
      // e continua no mesmo passo, cruzando os outros em ordem
      let xChegada = null;
      if (t > fimRelogio - CHEGADA_MS) {
        const k = (t - (fimRelogio - CHEGADA_MS)) / CHEGADA_MS;
        const alvo = baseNoNariz(vantFinal(patos.find((x) => x.ganha)));
        const de = l * 1.05;
        xChegada = de + (alvo - de) * Math.min(k, 1.7);
      }

      // fase do vencedor: depois de zerar, os outros ficam para trás e ele vai ao meio
      const dv = Math.max(0, t - fimRelogio - 300);
      const kv = Math.min(1, dv / 1400);

      // ---- margem
      ctx.fillStyle = '#5cc93f'; ctx.fillRect(0, 0, l, rioY);
      ctx.fillStyle = '#4bb330';
      for (let k = Math.floor(cam / 70) - 1; k < (cam + l) / 70 + 1; k++) {
        const gx = k * 70 - cam * 1 + ((k * 37) % 50 + 50) % 50;
        const gy = rioY * (0.35 + ((k * 53) % 40) / 100);
        ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx + 4, gy - 9); ctx.lineTo(gx + 7, gy); ctx.lineTo(gx + 10, gy - 7); ctx.lineTo(gx + 13, gy); ctx.closePath(); ctx.fill();
      }
      for (let k = Math.floor(cam / 330) - 1; k < (cam + l) / 330 + 1; k++) {
        const bx = k * 330 - cam + ((k * 131) % 160 + 160) % 160;
        const r = Math.max(10, rioY * 0.16);
        ctx.fillStyle = '#3f9e2e'; ctx.strokeStyle = '#1d4d15'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(bx, rioY - 6, r, Math.PI, 0); ctx.arc(bx + r * 1.3, rioY - 6, r * 0.8, Math.PI, 0); ctx.arc(bx + r * 2.4, rioY - 6, r * 0.65, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      ctx.fillStyle = '#8a5a2b'; ctx.fillRect(0, rioY - 6, l, 8);

      // ---- rio: faixas onduladas que passam com a câmera
      ctx.fillStyle = '#3d86ad'; ctx.fillRect(0, rioY + 2, l, a - rioY);
      const faixas = 7;
      for (let f = 0; f < faixas; f++) {
        const y = rioY + 2 + ((a - rioY) * f) / faixas;
        const alt = (a - rioY) / faixas;
        const desl = cam * (0.9 + f * 0.04) + agora * 0.012;
        ctx.fillStyle = f % 2 ? '#4797bf' : '#3a80a8';
        ctx.beginPath();
        ctx.moveTo(0, y + alt);
        for (let x = 0; x <= l + 20; x += 20) ctx.lineTo(x, y + Math.sin((x + desl) / 46) * alt * 0.12);
        ctx.lineTo(l, y + alt); ctx.closePath(); ctx.fill();
      }
      ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 2;
      for (let f = 0; f < faixas * 2; f++) {
        const y = rioY + 10 + ((a - rioY) * f) / (faixas * 2);
        const desl = (cam * 1.0 + f * 53) % 220;
        ctx.beginPath();
        for (let x = -desl; x < l + 220; x += 220) { ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 22, y - 4, x + 44, y); }
        ctx.stroke();
      }

      // ---- largada (fica para trás) e chegada, inclinadas, com o número das raias
      const q = Math.max(6, Math.min(16, a * 0.02));
      const yFundo = yFundoL;
      const yTopo = Math.max(rioY + 4, yRaia(0) - h * 0.55);
      const numeros = (xLinha) => {
        if (dy < 22) return;   // amontoado: os números não cabem (o original também some com eles)
        ctx.fillStyle = '#000';
        ctx.font = 'italic 800 ' + Math.round(Math.max(12, Math.min(64, dy * 0.85))) + 'px ' + fonte;
        ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
        patos.forEach((pt) => {
          const y = yRaia(pt.raia);
          ctx.fillText(String(n - pt.raia), xLinha + (yFundo - y) * incl + 2 * q + 8, y);
        });
      };
      const xLargada = baseNoNariz(0) + 2 - cam;
      if (xLargada + (yFundo - yTopo) * incl > -80) { linhaXadrez(ctx, xLargada, yTopo, yFundo, incl, q); numeros(xLargada); }
      if (xChegada != null) {
        const xc = xChegada - (dv > 0 ? kv * l * 0.4 : 0);
        if (xc < l + 40) { linhaXadrez(ctx, xc, yTopo, yFundo, incl, q); numeros(xc); }
      }

      // ---- patos, da raia de trás para a da frente
      const gv = patos.find((x) => x.ganha);
      patos.forEach((pt) => {
        let x = x0 + (n - 1 - pt.raia) * sx + vantagem(pt, t) * corpo;
        let y = yRaia(pt.raia);
        if (dv > 0) {
          if (pt.ganha) {
            // vai para o meio da tela, na altura do meio do rio
            const xm = l / 2 - w / 2;
            const ym = rioY + (a - rioY) * 0.5;
            x += (xm - x) * suave(kv); y += (ym - y) * suave(kv);
          } else {
            x -= kv * kv * l * 0.9;     // ficam para trás
          }
        }
        const bob = Math.sin(agora / 260 + pt.fase);
        const img = BJPatos.imagem(pt.id, h, dpr);
        const yTopoPato = y - h * 0.86 + bob * h * 0.025;   // a raia é a linha d'água
        ctx.save();
        ctx.translate(x + w / 2, yTopoPato + h / 2);
        ctx.rotate(bob * 0.03);
        if (img) ctx.drawImage(img, -w / 2, -h / 2, w, h);
        else { ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.ellipse(0, h * 0.15, w * 0.42, h * 0.3, 0, 0, Math.PI * 2); ctx.fill(); }
        ctx.restore();
        // número da raia no corpo e o nome perto da cabeça
        const tamN = tamNum;
        ctx.font = '700 ' + tamN + 'px ' + fonte;
        const nw = Math.max(tamN * 1.6, ctx.measureText(String(n - pt.raia)).width + tamN);
        const tagX = x + w * AN.corpoX;
        const tagY = yTopoPato + h * AN.corpoY - tamN * 0.7;
        pilula(ctx, tagX, tagY, nw, tamN * 1.35, tamN * 0.3, '#fff', Math.max(1.2, tamN * 0.12));
        ctx.fillStyle = '#000'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(n - pt.raia), tagX + nw / 2, tagY + tamN * 0.7);
        etiqueta(ctx, x + w * (AN.cabecaEsq + 0.08), yTopoPato + h * AN.cabecaTopo, pt.nome, tamNome, dv > 0 && pt.ganha);
      });

      // ---- relógio (HH:MM:SS, como no site)
      const resta = t < 0 ? CORRIDA_MS : Math.max(0, CORRIDA_MS - t);
      const s = Math.ceil(resta / 1000);
      const txt = '00:' + String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
      const th = rioY * 0.62;
      ctx.font = '500 ' + Math.round(th * 0.7) + 'px ' + fonte;
      const tw = ctx.measureText(txt).width + th * 0.8;
      pilula(ctx, l / 2 - tw / 2, rioY * 0.1, tw, th, th * 0.22, '#eceefc', 3);
      ctx.fillStyle = '#000'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(txt, l / 2, rioY * 0.1 + th / 2 + 1);
      ctx.textAlign = 'left';
      if (fora) {
        ctx.font = '600 13px ' + fonte; ctx.fillStyle = '#000';
        ctx.fillText(n + ' patos · ' + fora + ' da urna não couberam (a chance de todos já contou)', 14, rioY * 0.1 + th + 16);
      }

      // ---- faixa do vencedor
      if (kv >= 1) {
        const d = dv - 1400;
        const k = Math.min(1, d / 300);
        const tam = Math.max(20, Math.min(40, a * 0.05));
        ctx.globalAlpha = k;
        ctx.font = '800 ' + tam + 'px ' + fonte;
        const frase = gv.nome + ' venceu!';
        const fw = ctx.measureText(frase).width + tam * 1.4;
        const fy = rioY + (a - rioY) * 0.5 - h * 1.05;
        pilula(ctx, l / 2 - fw / 2, fy - tam, fw, tam * 1.8, tam * 0.5, '#fff', 3);
        ctx.fillStyle = '#000'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(frase, l / 2, fy - tam + tam * 0.9 + 1);
        const outros = ordem.filter((x) => !x.ganha).slice(0, 2).map((x, j) => (j + 2) + 'º ' + x.nome).join('   ');
        if (outros) {
          ctx.font = '600 ' + Math.round(tam * 0.5) + 'px ' + fonte;
          ctx.fillStyle = '#fff'; ctx.lineWidth = 4; ctx.strokeStyle = '#000';
          const oy = rioY + (a - rioY) * 0.5 + h * 0.75;
          ctx.strokeText(outros, l / 2, oy); ctx.fillText(outros, l / 2, oy);
        }
        ctx.textAlign = 'left';
        ctx.globalAlpha = 1;
      }

      if (!p.acabou && t >= fimRelogio + 300 + VENCEDOR_MS) encerrar();
    }
    function encerrar() {
      if (p.acabou) return;
      p.acabou = true;
      camada.classList.add('saindo');
      fim();
      p.fecha = setTimeout(() => { if (palco === p) pararPalco(); }, 420);
    }
    // Esc pula a corrida e mostra o resultado no palco
    const tecla = (e) => { if (e.key === 'Escape' && palco === p) encerrar(); };
    document.addEventListener('keydown', tecla);
    p.soltar = () => document.removeEventListener('keydown', tecla);
    p.raf = setInterval(quadro, 16);
    quadro();
    p.rede = setTimeout(() => { if (palco === p) encerrar(); }, LARGADA_MS + CORRIDA_MS + 300 + VENCEDOR_MS + 1500);
  }

  function embaralhar(v) {
    for (let i = v.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [v[i], v[j]] = [v[j], v[i]];
    }
    return v;
  }

  function girarSubida(participantes, vencedor, pronto) {
    const nomes = participantes.map((x) => '@' + x.usuario);
    const fim = () => {
      girando = false;
      $('btnSortear').classList.remove('girando');
      pronto();
    };
    const cv = $('confete');
    if (!nomes.length || !vencedor || !cv || !cv.getContext) { pararPalco(); fim(); return; }

    pararPalco();
    limpar($('resultado'));
    const medida = medirPalco(cv);
    const fonte = getComputedStyle(document.body).fontFamily || 'sans-serif';

    const fila = [];
    while (fila.length < Math.max(nomes.length, 42)) fila.push(...embaralhar(nomes.slice()));
    // urna grande sobe mais depressa para todo mundo caber nos 5s
    const viagem = Math.max(850, Math.min(1700, 1700 - (fila.length - 42) * 1.2));
    // o nome mais lento (o do fundo) leva viagem * 1.25: a última saída tem que
    // chegar ao topo antes dos 5s
    const janela = SUBIDA_MS - viagem * 1.25 - 80;
    const p = {
      cv, ctx: medida.ctx, l: medida.l, a: medida.a, pecas: [], poeira: [], rachas: [],
      revelado: false, impacto: null, inicio: performance.now(), raf: 0, rede: 0, fecha: 0,
      nomes: fila.map((txt, i) => {
        const prof = Math.random();             // 0 = lá no fundo, 1 = perto
        return {
          txt, prof,
          sai: (janela * (i + Math.random())) / fila.length,
          dura: viagem * (1.25 - prof * 0.45),  // o que está perto passa mais rápido
          x: 0.08 + 0.84 * ((i * 0.618034 + Math.random() * 0.12) % 1),
          f1: Math.random() * 6.28, f2: Math.random() * 6.28,
          w: 2.2 + Math.random() * 2.4,
          tam: 12 + prof * 15,
          verm: Math.random() < 0.05,
        };
      }),
    };
    palco = p;
    abrirPalco(true);

    function quadro() {
      if (palco !== p) return;
      const t = performance.now() - p.inicio;
      if (Math.round(p.cv.clientHeight) !== Math.round(p.a) || Math.round(p.cv.clientWidth) !== Math.round(p.l)) {
        const m = medirPalco(p.cv);
        p.ctx = m.ctx; p.l = m.l; p.a = m.a;
      }
      const { ctx, l, a } = p;
      ctx.clearRect(0, 0, l, a);
      ctx.save();

      // tremida do impacto: o quadro inteiro chacoalha e acalma em 450ms
      p.base = Math.min(window.devicePixelRatio || 1, 2);
      p.dx = 0; p.dy = 0;
      if (p.impacto != null) {
        const d = t - p.impacto;
        if (d < 450) {
          const amp = 11 * Math.pow(1 - d / 450, 2);
          p.dx = (Math.random() - 0.5) * amp * 2;
          p.dy = (Math.random() - 0.5) * amp * 2;
          ctx.translate(p.dx, p.dy);
        }
      }

      // um holofote que acende devagar enquanto os nomes passam
      const luz = Math.min(1, t / SUBIDA_MS);
      const g = ctx.createRadialGradient(l / 2, a / 2, 0, l / 2, a / 2, Math.max(l, a) * 0.6);
      g.addColorStop(0, 'rgba(237,237,243,' + (0.03 + luz * 0.07) + ')');
      g.addColorStop(1, 'rgba(237,237,243,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, l, a);

      desenharNomesSubindo(p, t, fonte);
      if (t >= SUBIDA_MS) desenharPouso(p, t - SUBIDA_MS, vencedor, fonte);
      desenharConfete(p, t > SUBIDA_MS + POUSO.sobe + POUSO.cai + 1300);
      ctx.restore();

      const fimDoPouso = SUBIDA_MS + POUSO.sobe + POUSO.cai + POUSO.segura;
      if (!p.revelado && t >= fimDoPouso) {
        p.revelado = t;
        fim();
        p.fecha = setTimeout(() => { if (palco === p) abrirPalco(false); }, 1900);
      }
      if (p.revelado && t > p.revelado + 2600 && !p.pecas.length) pararPalco();
    }
    p.raf = setInterval(quadro, 16);
    quadro();
    p.rede = setTimeout(() => {
      if (palco === p && !p.revelado) { p.revelado = performance.now() - p.inicio; fim(); }
    }, SUBIDA_MS + POUSO.sobe + POUSO.cai + POUSO.segura + 800);
  }

  // Cada nome vira uma imagem pequena na primeira vez que aparece: com urna de
  // centenas de pessoas, fillText a cada quadro derrubava o palco para ~24fps,
  // e drawImage da imagem pronta fica liso.
  function spriteDoNome(n, fonte) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const font = (n.prof > 0.7 ? '800 ' : '600 ') + n.tam.toFixed(1) + 'px ' + fonte;
    const c = document.createElement('canvas');
    const cx = c.getContext('2d');
    cx.font = font;
    n.larg = Math.ceil(cx.measureText(n.txt).width) + 4;
    n.alt = Math.ceil(n.tam * 1.5);
    c.width = n.larg * dpr;
    c.height = n.alt * dpr;
    cx.scale(dpr, dpr);
    cx.font = font;
    cx.textAlign = 'center';
    cx.textBaseline = 'middle';
    cx.fillStyle = n.verm ? '#ff4a4a' : '#ededf3';
    cx.fillText(n.txt, n.larg / 2, n.alt / 2);
    return c;
  }

  function desenharNomesSubindo(p, t, fonte) {
    const { ctx, l, a } = p;
    const s = t / 1000;
    for (const n of p.nomes) {
      const k = (t - n.sai) / n.dura;
      if (k < 0 || k > 1) continue;
      if (!n.spr) n.spr = spriteDoNome(n, fonte);
      const y = a + 26 - (a + 52) * k;
      const meia = n.larg / 2 + 6;
      const x = Math.min(l - meia, Math.max(meia, n.x * l)) + Math.sin(n.f1 + s * n.w) * 12;
      ctx.globalAlpha = (0.22 + n.prof * 0.7) * Math.min(1, k * 6, (1 - k) * 6);
      const ang = Math.sin(n.f2 + s * n.w * 1.3) * 0.22;
      const cos = Math.cos(ang);
      const sin = Math.sin(ang);
      // a transformação vai composta com a base (dpr) em vez de save/restore
      const base = p.base;
      ctx.setTransform(base * cos, base * sin, -base * sin, base * cos, base * (x + p.dx), base * (y + p.dy));
      ctx.drawImage(n.spr, -n.larg / 2, -n.alt / 2, n.larg, n.alt);
    }
    ctx.globalAlpha = 1;
    ctx.setTransform(p.base, 0, 0, p.base, p.base * p.dx, p.base * p.dy);
  }

  // O vencedor sobe rápido, passa um pouco do meio, despenca e crava no centro:
  // amassa com o impacto, solta poeira para os lados, racha o "chão" e o palco
  // chacoalha. Depois de POUSO.segura o resultado de verdade (com avatar) entra
  // por cima e o nome do canvas some.
  function desenharPouso(p, T, vencedor, fonte) {
    const { ctx, l, a } = p;
    const cx = l / 2;
    const cy = a / 2;
    const txt = '@' + vencedor.usuario;
    let tam = 44;
    ctx.font = '900 ' + tam + 'px ' + fonte;
    const larg = ctx.measureText(txt).width;
    if (larg > l * 0.84) { tam = Math.max(18, (tam * l * 0.84) / larg); ctx.font = '900 ' + tam.toFixed(1) + 'px ' + fonte; }
    const topo = cy - tam * 1.1;
    const chao = cy + tam * 0.55;

    let y, rot = 0, sx = 1, sy = 1, rastro = 0;
    if (T < POUSO.sobe) {
      const k = T / POUSO.sobe;
      const e = 1 - Math.pow(1 - k, 3);
      y = a + tam + (topo - (a + tam)) * e;
      rot = -0.14 * (1 - e);
      sy = 1.18 - 0.12 * e; sx = 0.92 + 0.06 * e;
      rastro = 1 - e * 0.6;
    } else if (T < POUSO.sobe + POUSO.cai) {
      const k = (T - POUSO.sobe) / POUSO.cai;
      y = topo + (cy - topo) * k * k;
      sy = 1.06 + 0.08 * k; sx = 0.97;
    } else {
      y = cy;
      const L = T - POUSO.sobe - POUSO.cai;
      if (p.impacto == null) {
        p.impacto = SUBIDA_MS + T;
        soltarConfete(p, 90);
        setTimeout(() => { if (palco === p) soltarConfete(p, 60); }, 170);
        for (let i = 0; i < 46; i++) {
          const lado = i % 2 ? 1 : -1;
          p.poeira.push({
            x: cx + lado * Math.random() * 30, y: chao,
            vx: lado * (1.5 + Math.random() * 6.5), vy: -Math.random() * 2.4,
            r: 2 + Math.random() * 5, vida: 1,
          });
        }
        for (let i = 0; i < 7; i++) {
          const lado = i % 2 ? 1 : -1;
          const pts = [[cx + lado * 8, chao]];
          let px = cx + lado * 8;
          let py = chao;
          const passos = 3 + ((Math.random() * 3) | 0);
          for (let j = 0; j < passos; j++) {
            px += lado * (14 + Math.random() * 30);
            py += (Math.random() - 0.35) * 9;
            pts.push([px, py]);
          }
          p.rachas.push(pts);
        }
      }
      // mola: amassa no impacto e volta oscilando
      const mola = Math.exp(-L / 120) * Math.cos(L / 42);
      sx = 1 + 0.26 * mola;
      sy = 1 - 0.24 * mola;
    }

    const d = p.impacto != null ? SUBIDA_MS + T - p.impacto : -1;
    if (d >= 0) {
      // rachaduras no chão
      const fadeR = Math.max(0, 1 - d / 1400);
      ctx.strokeStyle = 'rgba(237,237,243,' + 0.5 * fadeR + ')';
      ctx.lineWidth = 1.4;
      ctx.lineJoin = 'round';
      for (const r of p.rachas) {
        ctx.beginPath();
        r.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
        ctx.stroke();
      }
      // onda achatada no chão + anel aberto
      if (d < 650) {
        const k = d / 650;
        ctx.strokeStyle = 'rgba(237,237,243,' + 0.6 * (1 - k) + ')';
        ctx.lineWidth = 3 * (1 - k) + 0.5;
        ctx.beginPath();
        ctx.ellipse(cx, chao, 20 + k * l * 0.55, 4 + k * 22, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, 20 + k * Math.max(l, a) * 0.7, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(237,237,243,' + 0.3 * (1 - k) + ')';
        ctx.stroke();
      }
      // poeira
      for (const q of p.poeira) {
        q.x += q.vx; q.y += q.vy;
        q.vx *= 0.94; q.vy = q.vy * 0.94 - 0.03;
        q.r += 0.18; q.vida -= 0.018;
        if (q.vida <= 0) continue;
        ctx.fillStyle = 'rgba(160,160,165,' + 0.35 * q.vida + ')';
        ctx.beginPath();
        ctx.arc(q.x, q.y, q.r, 0, Math.PI * 2);
        ctx.fill();
      }
      p.poeira = p.poeira.filter((q) => q.vida > 0);
    }

    // o nome some quando o resultado de verdade entra por cima
    let alfa = 1;
    if (p.revelado) alfa = Math.max(0, 1 - (SUBIDA_MS + T - p.revelado) / 220);
    if (alfa > 0) {
      ctx.save();
      ctx.globalAlpha = alfa;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // rastro de velocidade abaixo do nome enquanto sobe
      if (rastro > 0) {
        ctx.strokeStyle = 'rgba(237,237,243,' + 0.35 * rastro + ')';
        ctx.lineWidth = 1.5;
        for (let i = -3; i <= 3; i++) {
          const rx = cx + i * (larg / 7);
          ctx.beginPath();
          ctx.moveTo(rx, y + tam * 0.7);
          ctx.lineTo(rx, y + tam * 0.7 + 30 + Math.abs(i) * -5 + 60 * rastro);
          ctx.stroke();
        }
      }
      ctx.translate(cx, y);
      ctx.rotate(rot);
      // o amassado acontece apoiado no chão, não no meio do texto
      ctx.translate(0, tam * 0.5);
      ctx.scale(sx, sy);
      ctx.translate(0, -tam * 0.5);
      // depois do impacto o brilho vira dourado, respirando como a aura do
      // card do resultado que entra em seguida
      ctx.shadowColor = d >= 0 ? 'rgba(255,200,60,.85)' : 'rgba(255,255,255,.45)';
      ctx.shadowBlur = d >= 0 ? 20 + Math.sin(d / 450) * 10 : 10;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(txt, 0, 0);
      ctx.restore();
    }

    // clarão branco no instante do impacto
    if (d >= 0 && d < 170) {
      ctx.fillStyle = 'rgba(255,255,255,' + 0.22 * (1 - d / 170) + ')';
      ctx.fillRect(-20, -20, l + 40, a + 40);
    }
  }

  // Fotos da urna baixadas antes do giro: o letreiro troca de pessoa a cada
  // poucos quadros, e uma <img> criada na hora (e ainda "lazy") não tinha tempo
  // de carregar — por isso o círculo ficava sempre vazio. O vencedor vai
  // primeiro na fila, para a foto dele estar pronta na revelação.
  const fotosDoGiro = new Map();   // url -> Image
  function preCarregarFotos(lista) {
    lista.slice(0, 400).forEach((x) => {
      if (!x || !x.avatar || fotosDoGiro.has(x.avatar)) return;
      const im = new Image();
      im.decoding = 'async';
      im.src = x.avatar;
      fotosDoGiro.set(x.avatar, im);
    });
  }

  function pintarGiro(pessoa, i, total) {
    const alvo = limpar($('resultado'));
    const bloco = el('div', 'resultado');
    bloco.appendChild(el('span', 'trofeu', '🎲'));
    const caixa = el('div', 'caixa-av');
    // só usa a foto se ela já baixou; senão, as iniciais (nunca um círculo vazio)
    const foto = pessoa.avatar && fotosDoGiro.get(pessoa.avatar);
    const av = el('div', 'av av-xg');
    if (foto && foto.complete && foto.naturalWidth) {
      const img = el('img');
      img.src = pessoa.avatar;
      img.alt = '';
      img.width = 64;
      img.height = 64;
      av.appendChild(img);
    } else {
      av.textContent = iniciais(pessoa.usuario);
    }
    caixa.appendChild(av);
    bloco.appendChild(caixa);
    const info = el('div', 'info');
    info.appendChild(el('div', 'nome girando-nome', '@' + pessoa.usuario));
    info.appendChild(el('div', 'det', total ? 'passando pela urna · ' + nf(i + 1) + ' de ' + nf(total) : 'sorteando…'));
    bloco.appendChild(info);
    alvo.appendChild(bloco);
  }

  function pintarResultado(res) {
    const alvo = limpar($('resultado'));
    const v = res.vencedor;
    // card de ouro com aura no lugar do troféu (CSS: .card-ouro)
    const bloco = el('div', 'resultado ganhou card-ouro');
    const caixa = el('div', 'caixa-av');
    caixa.appendChild(avatar(v.avatar, v.usuario, v.id, 'av-xg'));
    bloco.appendChild(caixa);
    const info = el('div', 'info');
    info.appendChild(el('div', 'nome', '@' + v.usuario));
    bloco.appendChild(info);
    if (!presenca) { $('palco').classList.remove('com-presenca'); alvo.appendChild(bloco); return; }

    // card + área de presença empilhados no meio do palco
    const coluna = el('div', 'resultado-coluna');
    coluna.appendChild(bloco);
    const area = el('div', 'presenca');
    area.id = 'presenca';
    area.appendChild(el('div', 'presenca-acoes'));
    area.appendChild(el('div', 'presenca-status'));
    area.appendChild(el('div', 'presenca-msgs'));
    coluna.appendChild(area);
    alvo.appendChild(coluna);
    $('palco').classList.add('com-presenca');
    presenca.revelado = true;
    pintarStatusPresenca();
    // o que chegou durante a animação entra agora, uma por vez
    presenca.msgs.forEach((m, i) => setTimeout(() => entrarMsgPresenca(m), 200 + i * 220));
  }

  // "Aguardando presença no chat..." com os pontos em onda, até a primeira
  // mensagem do vencedor; depois, "Presença confirmada". Enquanto aguarda,
  // os badges "Já sorteado" e "Ausente" ficam em cima; marcado um deles, o
  // status vira "Sortear novamente".
  function pintarStatusPresenca() {
    const st = document.querySelector('#presenca .presenca-status');
    const acoes = document.querySelector('#presenca .presenca-acoes');
    if (!st || !presenca) return;
    limpar(st);
    if (acoes) {
      limpar(acoes);
      acoes.hidden = presenca.confirmado;
      if (!presenca.confirmado) {
        Object.entries(MOTIVOS).forEach(([k, m]) => {
          const b = el('button', 'bj-badge ' + m.cor + (presenca.motivo === k ? ' ativo' : ''), m.rot);
          b.type = 'button';
          b.setAttribute('aria-pressed', presenca.motivo === k ? 'true' : 'false');
          b.onclick = () => marcarMotivo(presenca.motivo === k ? '' : k);
          acoes.appendChild(b);
        });
      }
    }
    if (presenca.confirmado) {
      st.classList.add('ok');
      const linha = el('span', 'presenca-confirmada');
      linha.appendChild(el('span', 'presenca-ok', '✓'));
      linha.appendChild(document.createTextNode(' Presença confirmada'));
      st.appendChild(linha);
      // já dá para seguir para o próximo prêmio sem voltar à configuração
      // (funciona mesmo com ela escondida pelo olho)
      st.appendChild(botaoSortearDeNovo('Sortear mais uma pessoa', 'M12 5v14M5 12h14'));
      return;
    }
    st.classList.remove('ok');
    if (presenca.motivo) {
      st.appendChild(botaoSortearDeNovo('Sortear novamente', 'M20 11a8 8 0 1 0-2.34 5.66M20 4v7h-7'));
      return;
    }
    st.appendChild(document.createTextNode('Aguardando presença no chat'));
    const pontos = el('span', 'onda');
    for (let i = 0; i < 3; i++) pontos.appendChild(el('i', null, '.'));
    st.appendChild(pontos);
  }

  // Link do palco que dispara outro sorteio com as opções atuais (o mesmo
  // clique do botão Sortear, que pode estar escondido pelo olho).
  function botaoSortearDeNovo(texto, desenhoIcone) {
    const b = el('button', 'sortear-de-novo');
    b.type = 'button';
    b.appendChild(svgEl('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' }));
    b.firstChild.appendChild(svgEl('path', { d: desenhoIcone }));
    b.appendChild(document.createTextNode(texto));
    b.onclick = () => $('btnSortear').click();
    return b;
  }

  // Guarda o motivo na entrada do histórico (na aba, que é dona dele) e já
  // mostra aqui, sem esperar o próximo pacote.
  function marcarMotivo(motivo) {
    if (!presenca) return;
    presenca.motivo = motivo;
    motivosMarcados.set(presenca.t + ':' + presenca.userId, motivo);
    aplicarMotivos(historico);
    if (presenca.t) mandar('motivo-sorteio', { t: presenca.t, id: presenca.userId, motivo });
    pintarStatusPresenca();
    desenharSorteio();   // a urna e o histórico mudam junto
  }

  // Presença confirmada: o vencedor ganha o badge "Ganhador" na lista (e fica
  // guardado na aba, junto com o histórico).
  function confirmarGanhador() {
    if (!presenca || !presenca.t) return;
    confirmadosMarcados.add(presenca.t + ':' + presenca.userId);
    aplicarMotivos(historico);
    mandar('confirmar-ganhador', { t: presenca.t, id: presenca.userId });
    desenharHistorico();
  }

  function receberChat(lista) {
    if (!presenca || !Array.isArray(lista)) return;
    for (const m of lista) {
      const ehDele = (presenca.userId && m.userId === presenca.userId)
        || (presenca.usuario && String(m.usuario || '').toLowerCase() === presenca.usuario);
      if (!ehDele || presenca.msgs.some((x) => x.id && x.id === m.id)) continue;
      presenca.msgs.push(m);
      if (presenca.msgs.length > MAX_MSGS_PRESENCA) presenca.msgs.shift();
      if (presenca.revelado) entrarMsgPresenca(m);
    }
  }

  // Cada mensagem entra por baixo com fade; no máximo 3 na tela, a mais
  // antiga sai por cima.
  function entrarMsgPresenca(m) {
    const caixa = document.querySelector('#presenca .presenca-msgs');
    if (!caixa || !presenca) return;
    // Marcado como "já sorteado"/"ausente", a decisão vale: a mensagem aparece,
    // mas não confirma a presença nem apaga o motivo (a outra conta de quem já
    // ganhou costuma escrever no chat).
    if (!presenca.confirmado && !presenca.motivo) {
      presenca.confirmado = true;
      pintarStatusPresenca();
      confirmarGanhador();
    }
    // igual ao chat da Jamble: foto, @ em cinza e o texto embaixo
    const linha = el('div', 'presenca-msg');
    linha.appendChild(avatar(m.avatar, m.usuario, m.userId, 'av-chat'));
    const corpo = el('div', 'presenca-corpo');
    corpo.appendChild(el('div', 'presenca-nome', '@' + m.usuario));
    corpo.appendChild(el('div', 'presenca-txt', m.texto));
    linha.appendChild(corpo);

    const vivas = [...caixa.querySelectorAll('.presenca-msg:not(.saindo)')];
    if (vivas.length < MAX_MSGS_PRESENCA) { caixa.appendChild(linha); return; }

    // Já tem 3: a mais antiga sobe e some, as outras sobem uma posição e a
    // nova entra embaixo — tudo junto, como um chat rolando. Feito com Web
    // Animations (e não CSS) porque a regra de "menos movimento" do painel
    // apaga animação CSS, e esta foi pedida.
    const caixaTopo = caixa.getBoundingClientRect();
    const antes = new Map(vivas.map((v) => [v, v.getBoundingClientRect().top]));
    const velha = vivas[0];
    const rv = velha.getBoundingClientRect();
    velha.classList.add('saindo');
    // sai do fluxo no mesmo lugar, para as de baixo poderem subir
    Object.assign(velha.style, {
      position: 'absolute', top: (rv.top - caixaTopo.top) + 'px', left: (rv.left - caixaTopo.left) + 'px', width: rv.width + 'px',
    });
    const saida = velha.animate(
      [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-26px)' }],
      { duration: 380, easing: 'ease-in', fill: 'forwards' },
    );
    saida.onfinish = () => velha.remove();
    // janela escondida não termina animação: some de qualquer jeito
    setTimeout(() => velha.remove(), 450);
    caixa.appendChild(linha);
    vivas.slice(1).forEach((v) => {
      const d = antes.get(v) - v.getBoundingClientRect().top;
      if (d) v.animate([{ transform: 'translateY(' + d + 'px)' }, { transform: 'none' }], { duration: 380, easing: 'cubic-bezier(.2,.75,.3,1)' });
    });
  }

  function desenharHistorico() {
    const caixa = limpar($('historico'));
    $('limparHistorico').hidden = !(historico || []).length;
    if (!(historico || []).length) {
      caixa.appendChild(vazioSimples('Ninguém foi sorteado neste canal ainda. A lista fica guardada até você limpar.'));
      return;
    }
    // o histórico guarda o id da gema; quem lê quer o nome
    const nomes = nomesDasGemas();
    const hoje = soDia(Date.now());
    historico.forEach((h) => {
      const l = el('div', 'hl');
      // a lista fica guardada: de outro dia, mostra a data junto
      l.appendChild(el('span', 'hora', soDia(h.t) === hoje ? horaCurta(h.t) : quando(h.t)));
      l.appendChild(el('span', 'quem', '@' + h.usuario));
      const motivo = MOTIVOS[h.motivo];
      if (motivo) l.appendChild(el('span', 'motivo ' + motivo.cor, motivo.rot));
      else if (h.confirmado) l.appendChild(el('span', 'motivo verde', 'Ganhador'));
      const como = (h.tipo === 'compradores' ? 'compradores · ' : '')
        + (h.modo === 'pessoa' ? '1 por pessoa' : 'por quantidade')
        + (h.escopo === 'vendedor' ? ' · todas as lives' : '')
        + (h.filtro ? ' · só ' + (nomes.get(h.filtro) || h.filtro) : '');
      l.appendChild(el('span', 'como', como));
      // × tira a pessoa da lista: ela volta para a urna
      const x = el('button', 'hl-remover', '×');
      x.type = 'button';
      x.title = 'Tirar @' + h.usuario + ' da lista (volta para a urna)';
      x.setAttribute('aria-label', x.title);
      x.onclick = () => removerGanhador(h);
      l.appendChild(x);
      caixa.appendChild(l);
    });
  }

  // A aba é dona da lista; aqui ela já some da tela e da urna, sem esperar o
  // próximo pacote.
  function removerGanhador(h) {
    historico = historico.filter((x) => !(x.t === h.t && x.id === h.id));
    motivosMarcados.delete(h.t + ':' + h.id);
    if (dados) {
      const ids = (tipo) => [...new Set(historico.filter((x) => (x.tipo || 'gemas') === tipo).map((x) => x.id))];
      dados.jaGanharam = ids('gemas');
      dados.jaGanharamCompradores = ids('compradores');
    }
    mandar('remover-ganhador', { t: h.t, id: h.id });
    desenharSorteio();
  }

  // ============================================================ RESUMO DAS LIVES
  // A tela ainda não tem conteúdo: mostra só o aviso "Em breve" do HTML.

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
    $('btnPrivado').hidden = nome === 'ranking';
    atualizarOlhoDoMenu();   // cada aba tem o seu estado de modo privado
    moverFundoDoMenu(true);
    // O sorteio precisa de largura (palco, urna, dois grupos de opções lado a
    // lado); o feed cede espaço enquanto essa aba estiver aberta.
    const duas = document.querySelector('#tela-vivo .duas');
    if (duas) duas.classList.toggle('sorteio', nome === 'sorteio');
    if (nome !== 'sorteio') pararPalco();
    if (nome === 'insights') { desenharLances(); desenharAudiencia(); }
    modoFeedViewers(nome === 'insights');
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

  // ---- ranking: tipo, métrica dos compradores e o olho
  function redesenharRanking() {
    if (!dados) return;
    limiteRanking = PASSO_RANKING;
    desenharSeletoresRanking();
    desenharFichas();
    if (rkTipo === 'compradores') $('fichas').hidden = true;
    $('tagRanking').hidden = !dados.filtro || rkTipo === 'compradores';
    desenharRanking();
  }
  function trocarTipoRanking(tipo) {
    if (rkTipo === tipo) return;
    rkTipo = tipo;
    salvarLS('bj-rk-tipo', tipo);
    assinaturaFichas = '';   // as fichas voltam ao trocar para gemas
    redesenharRanking();
  }
  document.querySelectorAll('[data-rtipo]').forEach((b) => {
    b.onclick = () => trocarTipoRanking(b.dataset.rtipo);
    // o card de Compradores é um div: teclado como num botão
    b.onkeydown = (e) => {
      if (e.target !== b || (e.key !== 'Enter' && e.key !== ' ')) return;
      e.preventDefault();
      b.click();
    };
  });
  $('btnRkOlho').onclick = () => {
    rkOculto = !rkOculto;
    salvarLS('bj-rk-oculto', rkOculto ? '1' : '0');
    redesenharRanking();
  };

  // "Valor total / Quantidade de compras": fichas embaixo dos cards, no lugar das de gema
  document.querySelectorAll('[data-rmetrica]').forEach((b) => {
    b.onclick = () => {
      rkMetrica = b.dataset.rmetrica;
      salvarLS('bj-rk-metrica', rkMetrica);
      redesenharRanking();
    };
  });

  document.querySelectorAll('[data-sesc]').forEach((b) => {
    b.onclick = () => {
      if (b.getAttribute('aria-disabled') === 'true') return;
      sorteio.escopo = b.dataset.sesc;
      desenharSorteio();
    };
  });

  document.querySelectorAll('[data-modo]').forEach((b) => {
    b.onclick = () => { sorteio.modo = b.dataset.modo; desenharSorteio(); };
  });

  document.querySelectorAll('[data-tipo]').forEach((b) => {
    b.onclick = () => { sorteio.tipo = b.dataset.tipo; desenharSorteio(); };
    // o card de Gemas é um div (tem o filtro dentro): teclado como num botão
    b.onkeydown = (e) => {
      if (e.target !== b || (e.key !== 'Enter' && e.key !== ' ')) return;
      e.preventDefault();
      b.click();
    };
  });

  // ------------------------------------------------ filtro de gema do sorteio
  // O mesmo filtro das fichas do Ranking: escolher uma gema aqui faz o ranking,
  // a urna e o sorteio contarem só quem mandou aquela gema.
  function desenharFiltroGema() {
    const b = $('filtroGema');
    limpar(b);
    const d = dados || {};
    const atual = d.filtro ? (d.catalogo || []).find((c) => c.id === d.filtro) : null;
    if (d.filtro) {
      b.appendChild(iconeGema(atual || {}));
      b.appendChild(el('span', 'nome-g', d.nomeDoFiltro || (atual && atual.nome) || d.filtro));
    } else {
      b.appendChild(el('span', 'emj', '💎'));
      b.appendChild(el('span', 'nome-g', 'Todos'));
    }
    b.appendChild(el('span', 'seta', '▾'));
  }

  function fecharMenuGemas() {
    $('menuGemas').hidden = true;
    $('filtroGema').setAttribute('aria-expanded', 'false');
  }

  function escolherGema(id) {
    sorteio.tipo = 'gemas';
    fecharMenuGemas();
    if ((dados && dados.filtro || '') !== id) trocarFiltro(id);
    desenharSorteio();
  }

  function abrirMenuGemas() {
    const menu = limpar($('menuGemas'));
    const d = dados || {};
    const opcao = (id, icone, nome, info) => {
      const o = el('button');
      o.type = 'button';
      o.setAttribute('role', 'option');
      o.setAttribute('aria-selected', (d.filtro || '') === id ? 'true' : 'false');
      o.appendChild(icone);
      o.appendChild(el('span', 'nome-g', nome));
      if (info) o.appendChild(el('span', 'info-g', info));
      o.onclick = (e) => { e.stopPropagation(); escolherGema(id); };
      menu.appendChild(o);
    };
    opcao('', el('span', 'emj', '💎'), 'Todos', 'Qualquer gema');
    menu.appendChild(el('div', 'sep'));
    (d.catalogo || []).forEach((c) => opcao(c.id, iconeGema(c), c.nome, nf(c.preco) + ' 💎'));
    if (!(d.catalogo || []).length) menu.appendChild(vazioSimples('O catálogo de gemas ainda não carregou.'));

    // abaixo do botão, na largura do card (ou um pouco maior)
    const r = $('filtroGema').getBoundingClientRect();
    const larg = Math.max(r.width, 260);
    menu.style.width = larg + 'px';
    menu.style.left = Math.min(r.left, window.innerWidth - larg - 8) + 'px';
    menu.hidden = false;
    const cabeAbaixo = window.innerHeight - r.bottom - 8 >= Math.min(300, menu.scrollHeight);
    menu.style.top = (cabeAbaixo ? r.bottom + 4 : Math.max(8, r.top - menu.offsetHeight - 4)) + 'px';
    $('filtroGema').setAttribute('aria-expanded', 'true');
    tamanhoAoAbrir = innerWidth + 'x' + innerHeight;
    const marcada = menu.querySelector('[aria-selected="true"]');
    if (marcada) marcada.scrollIntoView({ block: 'nearest' });
  }

  // O menu mora no body: dentro da área do sorteio, o container-type dela
  // (usado para empilhar os cards em janela estreita) vira referência do
  // position:fixed e o menu abria deslocado.
  document.body.appendChild($('menuGemas'));

  $('filtroGema').onclick = (e) => {
    e.stopPropagation();   // não conta como clique no card
    if (!$('menuGemas').hidden) { fecharMenuGemas(); return; }
    if (sorteio.tipo !== 'gemas') { sorteio.tipo = 'gemas'; desenharSorteio(); }
    abrirMenuGemas();
  };
  $('filtroGema').onkeydown = (e) => e.stopPropagation();
  document.addEventListener('mousedown', (e) => {
    if ($('menuGemas').hidden || $('menuGemas').contains(e.target) || $('filtroGema').contains(e.target)) return;
    fecharMenuGemas();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fecharMenuGemas(); });
  // só fecha se a janela mudou de tamanho de verdade (há resize sem mudança)
  let tamanhoAoAbrir = '';
  window.addEventListener('resize', () => {
    if (innerWidth + 'x' + innerHeight !== tamanhoAoAbrir) fecharMenuGemas();
  });
  document.addEventListener('scroll', (e) => { if (!$('menuGemas').contains(e.target)) fecharMenuGemas(); }, true);

  document.querySelectorAll('[data-anim]').forEach((b) => {
    b.onclick = () => {
      sorteio.anim = b.dataset.anim;
      try { localStorage.setItem('bj-anim-sorteio', sorteio.anim); } catch {}
      desenharSorteio();
    };
  });

  $('semRepetir').onchange =(e) => { sorteio.semRepetir = !!e.target.checked; desenharSorteio(); };
  document.querySelectorAll('[data-janela]').forEach((b) => {
    b.onclick = () => {
      janelaAud = Number(b.dataset.janela);
      try { localStorage.setItem('bj-aud-janela', String(janelaAud)); } catch {}
      desenharAudiencia();
    };
  });
  // a largura dos gráficos acompanha a janela
  let timerAudResize = 0;
  window.addEventListener('resize', () => {
    clearTimeout(timerAudResize);
    timerAudResize = setTimeout(() => { if (paneAtivo === 'insights') desenharAudiencia(); }, 150);
  });

  $('entreTipos').onchange = (e) => {
    sorteio.entreTipos = !!e.target.checked;
    try { localStorage.setItem('bj-sorteio-entre-tipos', sorteio.entreTipos ? '1' : '0'); } catch {}
    desenharSorteio();
  };
  $('exigirPresenca').onchange = (e) => {
    sorteio.presenca = !!e.target.checked;
    try { localStorage.setItem('bj-sorteio-presenca', sorteio.presenca ? '1' : '0'); } catch {}
  };
  $('limparFiltroSorteio').onclick = () => trocarFiltro('');
  $('maisRanking').onclick = () => { limiteRanking += PASSO_RANKING; desenharRanking(); };
  $('limparHistorico').onclick = () => { historico = []; motivosMarcados.clear(); confirmadosMarcados.clear(); ultimoResultado = null; presenca = null; mandar('limpar-historico'); desenharSorteio(); };

  $('btnSortear').onclick = () => {
    if (girando) return;
    girando = true;
    $('btnSortear').classList.add('girando');
    $('btnSortear').disabled = true;
    esperandoSorteio = true;
    mandar('sortear', {
      tipo: sorteio.tipo,
      modo: sorteio.modo,
      semRepetir: sorteio.semRepetir,
      entreTipos: sorteio.entreTipos,
      escopo: sorteio.escopo,
    });
    // Se a aba não responder, o botão não pode ficar preso. Se respondeu, a
    // animação pode durar mais que isso (a de subida tem ~7s) e não é cortada.
    setTimeout(() => {
      if (!girando || !esperandoSorteio) return;
      esperandoSorteio = false;
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

  // ------------------------------------------------------------ auto resgate
  // Estado vem do resgate.js (aba da live) pela mensagem painel-resgate; só é
  // mandado quando muda, então a contagem regressiva roda aqui.
  let resgate = null;
  const ESTADO_RESGATE = {
    loading: 'carregando', calibrating: 'calibrando…', scheduled: 'agendado', ready: 'disponível!',
    done: 'próximo dia', missing: 'sem botão na página', off: 'desligado',
  };
  const relogio = (ms) => {
    const s = Math.max(0, Math.round(ms / 1000));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const p = (n) => String(n).padStart(2, '0');
    return h ? h + ':' + p(m) + ':' + p(s % 60) : p(m) + ':' + p(s % 60);
  };

  function desenharResgate() {
    const r = resgate;
    const btn = $('btnResgate');
    const est = r ? r.state : null;
    btn.className = 'btn chip-resgate' + (est === 'scheduled' ? ' agendado' : est === 'ready' ? ' pronto' : est === 'calibrating' ? ' calibrando' : '');
    let txt = '🎁 Resgate';
    if (r) {
      if (est === 'scheduled' && r.targetAt) txt = '🎁 ' + relogio(r.targetAt - Date.now());
      else if (est === 'ready') txt = '🎁 disponível';
      else if (est === 'calibrating') txt = '🎁 calibrando';
      else if (est === 'done') txt = '🎁 amanhã';
      else if (est === 'off') txt = '🎁 desligado';
    }
    $('resgateTxt').textContent = txt;

    $('resgateAtivo').checked = r ? r.enabled !== false : true;
    $('resEstado').textContent = r ? (ESTADO_RESGATE[est] || est) + (r.dryRun ? ' (teste)' : '') : 'aguardando a aba da live';
    $('resTotal').textContent = r && r.total != null ? r.total + ' min' : '—';
    $('resProximo').textContent = r && r.next ? r.next.mins + ' min · ' + nf(r.next.gems) + ' 💎' : (est === 'done' ? 'todos resgatados ✓' : '—');
    if (r && r.targetAt && est === 'scheduled') {
      $('resQuandoRot').textContent = 'Resgate às ' + new Date(r.targetAt).toLocaleTimeString('pt-BR');
      $('resQuando').textContent = relogio(r.targetAt - Date.now());
    } else if (r && est === 'done' && r.dayResetAt) {
      $('resQuandoRot').textContent = 'Marcos voltam à meia-noite';
      $('resQuando').textContent = relogio(r.dayResetAt - Date.now());
    } else {
      $('resQuandoRot').textContent = 'Resgate';
      $('resQuando').textContent = est === 'ready' ? 'agora' : '—';
    }
    const hist = limpar($('resHist'));
    const lista = (r && r.historico) || [];
    if (!lista.length) hist.appendChild(el('li', null, 'Nenhum ainda'));
    lista.forEach((h) => hist.appendChild(el('li', null,
      new Date(h.at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
      + ' — ' + h.marco + ' min' + (h.gemas ? ' · ' + nf(h.gemas) + ' 💎' : ''))));
  }
  setInterval(() => { if (resgate && (resgate.targetAt || resgate.dayResetAt)) desenharResgate(); }, 1000);

  const menuResgate = $('menuResgate');
  $('btnResgate').onclick = (ev) => {
    ev.stopPropagation();
    const abrir = menuResgate.hidden;
    menuResgate.hidden = !abrir;
    $('btnResgate').setAttribute('aria-expanded', abrir ? 'true' : 'false');
    if (abrir) desenharResgate();
  };
  document.addEventListener('click', (ev) => {
    if (!menuResgate.hidden && !menuResgate.contains(ev.target)) {
      menuResgate.hidden = true;
      $('btnResgate').setAttribute('aria-expanded', 'false');
    }
  });
  $('resgateAtivo').onchange = (e) => {
    const ativo = !!e.target.checked;
    mandar('resgate-config', { ativo });
    // mostra já; a aba confirma em seguida
    resgate = Object.assign({}, resgate || {}, { enabled: ativo, state: ativo ? 'calibrating' : 'off' });
    desenharResgate();
  };
  desenharResgate();

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
          // atraso entre a aba receber a mensagem e o painel: se a presença
          // demorar, é aqui que se vê de onde veio a demora
          : tipo === 'painel-chat' && payload ? (payload.mensagens || []).map((m) => '@' + m.usuario
            + (m.chegou ? ' aba→painel=' + (Date.now() - m.chegou) + 'ms' : '')).join(' ')
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
