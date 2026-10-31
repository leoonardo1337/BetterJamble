// Comemoração da meta de pontos: muitas carpas, confete e o aviso no meio da tela.
// É tudo desenhado num canvas por cima do painel, que continua clicável por baixo.
(() => {
  const CORES = ['#f15a24', '#ff8a4c', '#ffb37a', '#ffd166', '#ffffff'];
  const SOLTANDO = 8900;  // tempo soltando coisas
  const DURACAO = 10000;  // duração total: nos últimos instantes tudo some
  const MAX_PARTICULAS = 1000;
  let parar = null;

  const sorte = (a, b) => a + Math.random() * (b - a);

  function comemorar({ carpaUrl, titulo, texto } = {}) {
    if (parar) parar();

    const raiz = document.createElement('div');
    raiz.style.cssText = 'position:fixed;inset:0;z-index:90;pointer-events:none;overflow:hidden';
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
    raiz.appendChild(canvas);

    const brilho = document.createElement('div');
    brilho.style.cssText = 'position:absolute;inset:0;background:radial-gradient(circle at 50% 45%,rgba(241,90,36,.55),transparent 62%)';
    raiz.appendChild(brilho);

    const aviso = document.createElement('div');
    aviso.style.cssText = 'position:absolute;left:50%;top:42%;transform:translate(-50%,-50%);text-align:center;white-space:nowrap;'
      + 'color:#fff;font-family:inherit;text-shadow:0 6px 30px rgba(0,0,0,.65)';
    const grande = document.createElement('div');
    grande.style.cssText = 'font-size:clamp(40px,7vw,92px);font-weight:800;line-height:1.05;letter-spacing:-.02em';
    grande.textContent = titulo || 'META BATIDA!';
    const menor = document.createElement('div');
    menor.style.cssText = 'margin-top:10px;font-size:clamp(18px,2.4vw,30px);font-weight:700;color:#ffd166';
    menor.textContent = texto || '';
    aviso.append(grande, menor);
    raiz.appendChild(aviso);
    document.body.appendChild(raiz);

    const ctx = canvas.getContext('2d');
    let L = 0;
    let A = 0;
    const medir = () => {
      L = canvas.width = window.innerWidth;
      A = canvas.height = window.innerHeight;
    };
    medir();
    window.addEventListener('resize', medir);

    // sem a imagem da gema, a carpa vira emoji; pronta num canvas, centenas por
    // quadro continuam leves
    const TAM_CARPA = 128;
    const carpa = document.createElement('canvas');
    carpa.width = carpa.height = TAM_CARPA;
    const ctxCarpa = carpa.getContext('2d');
    ctxCarpa.font = TAM_CARPA * .82 + 'px serif';
    ctxCarpa.textAlign = 'center';
    ctxCarpa.textBaseline = 'middle';
    ctxCarpa.fillText('🐟', TAM_CARPA / 2, TAM_CARPA / 2);
    if (carpaUrl) {
      const img = new Image();
      img.onload = () => {
        ctxCarpa.clearRect(0, 0, TAM_CARPA, TAM_CARPA);
        ctxCarpa.drawImage(img, 0, 0, TAM_CARPA, TAM_CARPA);
      };
      img.src = carpaUrl;
    }

    const particulas = [];
    const novoConfete = (x, y, vx, vy) => ({
      carpa: false, x, y, vx, vy,
      l: sorte(6, 12), a: sorte(4, 9), giro: sorte(0, 6.28), vg: sorte(-.25, .25),
      fase: sorte(0, 6.28), cor: CORES[Math.floor(Math.random() * CORES.length)],
    });
    const novaCarpa = (x, y, vx, vy) => ({
      carpa: true, x, y, vx, vy,
      t: sorte(34, 110), giro: sorte(-.6, .6), vg: sorte(-.14, .14), fase: sorte(0, 6.28),
    });
    const por = (p) => { if (particulas.length < MAX_PARTICULAS) particulas.push(p); };

    function canhao(x, y, angulo, n) {
      for (let i = 0; i < n; i++) {
        const a = angulo + sorte(-.5, .5);
        const v = sorte(9, 25);
        por(novoConfete(x, y, Math.cos(a) * v, Math.sin(a) * v));
      }
    }
    function fonteDeCarpas(n) {
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + sorte(-.7, .7);
        const v = sorte(14, 27);
        por(novaCarpa(L / 2 + sorte(-90, 90), A + 50, Math.cos(a) * v, Math.sin(a) * v));
      }
    }

    function explosao(x, y, carpas, confetes) {
      for (let i = 0; i < carpas; i++) {
        const a = sorte(0, 6.28);
        const v = sorte(8, 30);
        por(novaCarpa(x, y, Math.cos(a) * v, Math.sin(a) * v));
      }
      for (let i = 0; i < confetes; i++) {
        const a = sorte(0, 6.28);
        const v = sorte(5, 26);
        por(novoConfete(x, y, Math.cos(a) * v, Math.sin(a) * v));
      }
    }

    // estouro inicial
    canhao(0, A * .75, -.9, 110);
    canhao(L, A * .75, -Math.PI + .9, 110);
    fonteDeCarpas(26);
    explosao(L / 2, A / 2, 60, 90);

    brilho.animate([{ opacity: 0 }, { opacity: 1, offset: .08 }, { opacity: .35, offset: .5 }, { opacity: 0 }],
      { duration: DURACAO, fill: 'forwards', easing: 'ease-out' });
    aviso.animate([
      { transform: 'translate(-50%,-50%) scale(.2) rotate(-7deg)', opacity: 0 },
      { transform: 'translate(-50%,-50%) scale(1.18) rotate(2deg)', opacity: 1, offset: .07 },
      { transform: 'translate(-50%,-50%) scale(.96) rotate(-1deg)', offset: .12 },
      { transform: 'translate(-50%,-50%) scale(1) rotate(0)', offset: .17 },
      { transform: 'translate(-50%,-50%) scale(1.05)', offset: .45 },
      { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: .86 },
      { transform: 'translate(-50%,-50%) scale(1.25)', opacity: 0 },
    ], { duration: DURACAO, fill: 'forwards' });

    const inicio = performance.now();
    let ultimo = inicio;
    let proximaOnda = inicio + 900;
    let chuva = 0;
    let quadro = 0;

    function desenharParticula(p, t) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.giro);
      if (p.carpa) {
        ctx.drawImage(carpa, -p.t / 2, -p.t / 2, p.t, p.t);
      } else {
        // o confete "vira" no ar: a altura encolhe e volta
        const a = p.a * Math.abs(Math.cos(p.fase + t / 130));
        ctx.fillStyle = p.cor;
        ctx.fillRect(-p.l / 2, -a / 2, p.l, a);
      }
      ctx.restore();
    }

    function passo(t) {
      const dt = Math.min(2.5, (t - ultimo) / 16.67);
      ultimo = t;
      const passou = t - inicio;

      if (passou < SOLTANDO) {
        if (t >= proximaOnda) {
          proximaOnda = t + 900;
          canhao(0, A * sorte(.45, .85), -.9, 55);
          canhao(L, A * sorte(.45, .85), -Math.PI + .9, 55);
          fonteDeCarpas(26);
        }
        chuva += dt;
        while (chuva > 1) {
          chuva -= 1;
          por(novoConfete(sorte(0, L), -14, sorte(-1, 1), sorte(2, 5)));
          if (Math.random() < .55) por(novaCarpa(sorte(0, L), -60, sorte(-1.5, 1.5), sorte(3, 8)));
        }
      }

      ctx.clearRect(0, 0, L, A);
      for (let i = particulas.length - 1; i >= 0; i--) {
        const p = particulas[i];
        p.vy += (p.carpa ? .3 : .17) * dt;
        if (p.vy > (p.carpa ? 11 : 6)) p.vy = p.carpa ? 11 : 6;
        p.vx *= Math.pow(.985, dt);
        p.x += (p.vx + Math.sin(p.fase + t / 340) * (p.carpa ? .8 : 1.1)) * dt;
        p.y += p.vy * dt;
        p.giro += p.vg * dt;
        if (p.y > A + 120 || p.x < -160 || p.x > L + 160) { particulas.splice(i, 1); continue; }
        desenharParticula(p, t);
      }

      canvas.style.opacity = String(Math.min(1, (DURACAO - passou) / 700));
      if (passou >= DURACAO) { fim(); return; }
      quadro = requestAnimationFrame(passo);
    }

    function fim() {
      cancelAnimationFrame(quadro);
      window.removeEventListener('resize', medir);
      raiz.remove();
      parar = null;
    }
    parar = fim;
    quadro = requestAnimationFrame(passo);
  }

  window.comemorarMeta = comemorar;
})();
