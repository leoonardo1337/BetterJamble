// ============================================================================
// BetterJamble — botão na página (world MAIN)
//
// É só isto: um botão redondo com o ícone da extensão, ao lado do botão de
// recompensa (o diamante) que fica à esquerda do campo de comentário. Ele abre
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
  // icons/48.png embutido: imagem da pasta icons/ dentro da página exigiria
  // web_accessible_resources (ver docs/HANDOFF.md). Se o ícone mudar, gere de
  // novo com `base64 -w0 icons/48.png`.
  const ICONE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAPtUlEQVR42nWaWYxl11WGv7X3PueONXR1dbe7PbVnS7YVDwJnUIgAKclDsAXigQekkIcAD0HIEkIgQogiwQsvSH7BCPGAkgBSRHAYbBHJlu1YjuIYx922Yzs2brsHd7trrlt3OmfvxcPeZ7gVU1Lp1r117j5r/Ne/1jry1huvqJdl8tFzrH7453TcLiYfkPUyfvY/m2xdGeOcAQERPuJH8aXSG2Tc/clrARN/VQGFQ9+xVnjjxUvsbEywmUFV42WmuVCDAsJ8VnLq9nVuufc4s719dLrPOJxm6/hfE7o3Y8I+zssyg9lzHNn7K0zfgFnHWM9sUjLamSICQRUCaLqBSJIr3TMEMA4Mc4IHxKR/avMlAFXEgFil9ApGUVVUQYLWBlKNhhEj7F0dUc6PYrI+wQzpzzfJdr/KZvaXzOxNuKX5M5zsPInc9hsE6aFaYoylvPoWa2v/jLhOFNIrIYCqEoLWBlagnJcsHVlBlu6AskAq4UWSNNF9qgqZY7D6JrPRRWzuEKLgYkBEMCZ6wxgQFGMtYeVz2N46JpSA0PUbdEePcUF/D3eN+R70biaQJ2vl4PqYziqdvsVY24SORMscCgq0GNM9cQo98TBSTBevEVJYgWhA8wHDq/+CmV3E5DkQoNKzUjZ9T0PAGIu4ZZA+SAEUeLNG1ptyavS3OBlci0ovmcBC8KAlaEADBImWlCqetS1YE0LBBwgzNEyROhbShXVoBNQ71Hu8B4LGeBea6006XqM+QYnyUEZlEUDw9hh5b4JTMwBxKDbFdUzCyp3p+iamDyWliNZaSX2xLAjeaG1iWBlThwyymFuaIi++qVxTnVIp4BDxaH4Sh7hW0jU3CyEQFMxhiT/CA9G6StDQ1vgjEas2qyRlpCWkkDxt6utVEypVdhLACGiGRvky2mJWZ3UHXZyT9P7/E6i5vtNz2CyGR6OpLiCRhoBxju4gQ4hgEPNbkh5aR51qDM28Y8i7eY1W1Q1VLJgcEzRZO3g0BLJOB9Mx/ODff8yF8wW9viCS4C6hUHWYKjin2CznmSfOceXdC2RrK2gIBB/iuelVg5KtLLN75UOeevxNAo48j2dENZPnVAheEZT+wPLamREvPf0KbnWAdS7JEWUJAVw27MVYE4EA2x9c4YXvPMHrz79Kb8lwcDDlplsd3a4gIqg23ghe2drwvPpKwbtvj7ly8TE+89sPcct992A6nVZoCGFecO7Fn/DMNx/n8vvb7Fx2fOz+gqPrFmubcCF5YTIOvHa25PWzJfrjx5nubXHf5z5Df3U1hVgAPPKDRx/U4doq5XzG5sXLXHnrbcK8ZGnVUhTKwUGg2zMcXTcsrRjyjhACTCeB3e3A9mbACAwGwmQcGI9h/fQpTt15G8vra4gI+5tbXHn7ba7+7wU6OXT6htF+oPDCkTXD0WOGXt8gAvO5srcT2NrwFHNlaSmG9852IF/qc/K2W1i95jjWGkbbO8jf/yZa5VKnC8Mlode3GIkx6ktlPBEmE8X7Vh5Z6ObQ6wudTpOLxRz2dgOTSUIUA06g04PBsqWTVdCrTKbK6CB+J4JczIksE/o96PcFl8U0KkrD/l7JeARlGcNHDLjrb3Qp/hTnwBrFGMVYUswLvZ5Q+lgiQoI5awVjFZP+FhODuZNDr2/xPnqqvjadK6aRNe8IgwHUeY+k6+N3rCNCOZCVgU5uKY9ILQeA6/VCzdKMiQglJoWZSo18WUouVakPNUYaodIZMbkSwjQsItYV2yaEgg+Qp4SswMoYgSSHMY1nrRVCUDJPfXZQcHnOApTFwnQIJsVgFdRpfaMq7IxZLFriTIJAH8lbi1JIjfvpI2PqwlKXEBIXQlH1IInfmhgNwcbXGgWNlboiVpaKQaq1oL4oFumNNiwhtJmPUlvTdsBkOQvmFQi+QFM4avjo4igAGdiuS5xQG6ahoCkXNYAzJsZvRR20EkQEUUMxLTh6169z4sFHUD9pVcmfr2jBT5nvXmR88UV23/kvZruXcf0c0Zhx5bSgu34nNz30D5STqxTjLbQYo6FsJFcwrsvBhefYPPstbCcWvZjfVaFLzBhwxipRiRgOdWEJoGoIhdK95gGG130a2ATcIbO1fwxg4b4vUh5c4eLTf8HGT/4R280RYyimyrFbH2Jw6uPABtA9RD0itsMK2eoprr78TbJupVWKDgU1AqWiotEDMYxSTNtUHVvEqpzto3qZML+KGJdKvaJ1DMSEr2Mcxfa73PiFRynnIzbO/CvZoINXWDr9IBreJRSjRW9WjDV4bLZEMb5KCFGpaNzGbFWaqhectbGbkprrC2IETW6KwgZEZkARraQBYx1iei1vWGBOKGYgBi12kWzOyU//AZs/fZJiPKZ/4g7Wbr0f2MPYgGrZcmTlBY+YAiSSSRIqGttydGwhCDGEwDipDEedLhrbg3iuByagU9QbTN5h673X+dE/PUaWW0DJuivc89CXOHLt9YRyjIgQiind1TXyI7cwu3yW6cGIcz/6Huunb6YzGGJdjrEx8UJIyR4CqAWdN51aylEq0pdAT4JGFDKiNbpJsobaFHoGRDxwAP4AsIixFHuX2T77NL1hvMn+Jsz2N/jsnzwKfpxwzyPOYlwHsaDTS7z0d3+IdPrY7gq2O6ScCcfu+Bif+tIj+NleFCJQK2BS7De1KaaaSa9OTGyehYp1tuhCogyChzCJvxjwDsOM5SEMVqNFbAlrJ46BzCAcoMEgopTTwHT3Eq4DnSzjliVlPp0wn44pSxjtg99Zih2XH1dRBDpP4VNV8UQmJbamVaDEJK7HDJE4xaZdW6OUAKGAMI/N+XyP3upxbvzlL5L3DBoU2zvGDZ/4PDq+goQCDQVm9Vree+6/mW1dYnAyR0NAgd7Q0RuAD4Y8K8iXcvBTJEzjfYMBLepKLEkRqYugQRPdcbXwIvU0wRgIqdeL/w7R+n6CGIvO5gzXj3DPb325lVklOtlEiyJ6Oe/w3gtP8ebjf8PJa2ykHDbyfq1gzivGhHT+NN5DAW8QykYBI4gxDQ3R5CWjOLFNb1oXCq1KeaVACWXKAc1AHGE2I4w3m5xB4wTBGkQVpc/+Bxus9A/I8oYHRW4jqRuTSCBtiEXSTxPKmNjIpxyowkfMIgsQEZyIYOo+XJpSbBoPgIcwSyEEhALrMuzyoAXgCvMZYT6JiTO+xN0Pf56tm49x4ftfx2RS05T2wMA6MKLJA7P4oReEIiWupDyQpuZVdQBJZfXQIEFpqlgsIFUSz1E8JsvYvXKZt154KY4Hg2JdxnV338P6DacIswMwBv/ha6zdfic7P/sU4/PPkg86yfcpZCsPG40J7EcJJAJQ1IYVY+LosTW6E0KjgNbyK0pD7irIWgihYJB8yGTzIu8+9R/0hlFXX8I7zz7BrzzyNVbXc8K8jKxr9gGDa+9i+41nsR1Td79QopI13vOTeA9x4BXCjFZ6RuYqggZtjAw4k8YUItXHSRWJc55YoJMH/DieVgiZLTh2AgYraYLgYWdjwvxgihwN4OfRAj6a6NSvfpUjp28nzA8w+TIbZ77D5tnvEhDE++hdP40V3SqiBWKltrxqU6Oq6gyCwwjGmEUuq2BMajQMkUL4g6SAhTJS5e6x23H9SFJ8YbntFz7OseuPEA7eQ8ShIdKOyf6IpZPrdIcbhPEE09ln5cZ7uPzyE8z3p5y874FIVfw0ShYiL2/DZyxiTc3S1Gy5yjVVOxc9KjUPtyYVsnKcYNQRJlNWjq/xi7/zlRrXYtUcE/bfTLV+BmUB0uWDN84QfMHaydvQ8T5+EhguD7jj4T9iPnesnhoQ9n4a0St4wDDa3ACNw91KaEyjCCF6xkUNTQuFpJ7haj0PLRsPqI1umYyRyfkWLCheDSKxCw9lgVvK2bq4w+47r9Hpd5H7b4T5FuIcOtpmqdeBoSNs79TnSDlBw5CNd16n35XGuO0krrt4xdXQIw3MNeSwqg8FOttD56OG19Zk43BvECJ2D4fs7jpe/u6/cfxEYPfcWa6cu5sTJwvK3R3EZvhiFBsPYyJEhwJ79BjvnDlPufUW3Rt6rdZTFplrktdJu1dFEtlumJ+1cYwnSwOcTBeJuZHFflIsqGU8dVx4ZZtzLzzJ0eEWgyM5Jpvw6hP/ifu1z3J0PYODPQhl6pwCZDn0j/P2mRGXfvh9rjudIcbG/DRyqGnQZtHy/rcGKjbyZiNVLY4jEVQJxYzN7QHmyJ0YSpQ4mWgPrCstfOmZjfaZbF3FldscPyl0+h28j8Ovg905l68OOX7XvZy6ZY3BwGCMUJSws11y/tV3KT58jetOO/J+N4Z2NSapeUIaQmpAvUfOf3uokrhq1SA1XX9s/eeTKaOtGT4NlNrtR72ASRbJOtAfWvJejoqpewwNEVWKacHG5ZLJLEPyIWIc6qdYv8/KCqye6CI2S7jf7tikGb1X04Pgkfe/vaQipl6yxVJmWoZNGhvS0kMXRy6qzTy/nWLKoa1gWmYQh2G+LChnHlXFOkPWycDYiIBV5UXqsU7kQCEZJCAaxxNOWtotrIPqfDB1DyziEKu18EIzvK1gWFpt0c+tFTS1p4CzDpvHTqtej4i05khSV9xQhY9Wr03X6KowEWkL3m7UGz4SzzX1QqNd+GiRwmaCrQvzinir2DixsIZiwXttsBQFkybWVTUW04zlXdxRKSLtr7YWbS17VnQjIpRZnHQtwG4DdRXZJlGT2Ey110bVelXqhr19T62iQrXm0qoVeCku+JDQJ87vErNv7auauU1Qba3MtKkb0t6P6eI2sw6vdKBpVjAL/Kb2qiz0JZqGVFovfEJaFgZ84XHFzOMUjNPoZmkfkA41klwbIVTTEKCpY4cWgNIGAE3JqPXEQ6r39RKviu9mj1ahYA0mIc6hNG2TQukpZh43GQU6A8jSCily7ya5ROIAqSpsVeesKOoXQ1nk0Cq25ulta0NAG6rSmsM2ntH6kYMqnzR4VNPKqiyZT5XJSHH7uyGOYgbgsoBxqfpVbWaaIJs0EQAh1D201h6re6DWswiVx2qLcmiZVz8bIY3lE2w3TwNUVo/C+8JTFlH40Z7H9e//Gvs//DreOzo9Ie+UWGdSNyZgYriEarBEa7aeaIhKTKqmEdIWdVFauIsGaRCs/XCHNNbX+tEGrWtP8IGyCBRzZTaG/a2SlU/+GW753i8Dgd3nv0G5ZAkDg8s81gnWCWJC4uSpoNTEr9opSKJFgtZeamNZ81xFuzw0aNRsPGsFVGsF1FfCx1XUdKwc7HpWP/HHrD7wFZyfbLF87++DHbDz/DcoyxmdHmS54lzcvliXHr6QRpmFUYcqaqVu8xp0SsnZCpnq8Zrq72rEEqrHDlQJqoQybXo8+FIp5jAZC5NJztFf+lPWHvhdyvEm/wcVm8fBZ+0NTAAAAABJRU5ErkJggg==';

  let botao = null;
  let campo = null;           // o bloco do campo de comentário que empurramos
  let margemOriginal = null;
  let folga = null;           // espaço que o site já deixa entre diamante e campo

  // ---------------------------------------------------------------- estilo
  const CSS = `
  .bj-botao{position:fixed;z-index:40;box-sizing:border-box;display:grid;place-items:center;
    width:${TAMANHO}px;height:${TAMANHO}px;padding:0;border:0;border-radius:50%;
    background:#1f1f1f;cursor:pointer;transition:filter .15s,transform .15s}
  .bj-botao:hover{filter:brightness(1.15)}
  .bj-botao:active{transform:scale(.94)}
  .bj-botao img{width:62%;height:62%;border-radius:22%;pointer-events:none;display:block}
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
  // primeiro que tiver fundo. É dele que copiamos a cor e a medida.
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

  // Põe o botão logo à direita do diamante, do mesmo tamanho e com o mesmo
  // fundo, e empurra o campo de comentário o bastante para ele caber. Se o
  // diamante não aparecer, o botão vai para o canto inferior direito (solto)
  // em vez de desaparecer.
  function posicionar() {
    if (!botao) return;
    const d = diamante();
    const b = d && blocos(d);
    if (!b) {
      devolverCampo();
      botao.classList.add('bj-solta');
      botao.style.background = '';
      return;
    }
    botao.classList.remove('bj-solta');
    const c = circuloDo(d);
    const tam = Math.round(c.r.width) || TAMANHO;
    botao.style.width = botao.style.height = tam + 'px';
    botao.style.background = c.st.backgroundImage !== 'none' ? c.st.backgroundImage : c.st.backgroundColor;

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
