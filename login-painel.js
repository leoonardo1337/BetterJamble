// Tela de login da janela do painel: cobre tudo até o acesso estar liberado.
// Entrar liga a extensão nas abas da Jamble (ver acesso.js) e recarrega a janela.
// "Esqueci a senha" manda um código por e-mail e troca a senha aqui mesmo.
(() => {
  const tela = document.createElement('div');
  tela.id = 'bj-login';
  tela.innerHTML = `
    <style>
      #bj-login{position:fixed;inset:0;z-index:100000;display:flex;padding:24px;overflow:auto;background:#000;color:#fff;font:400 14px/20px "Inter","Segoe UI Variable Text","Segoe UI",system-ui,sans-serif}
      #bj-login[hidden]{display:none}
      #bj-login .fundo{position:fixed;inset:0;pointer-events:none;background-size:200% 200%;animation:bj-aura 15s linear infinite;background-image:radial-gradient(at 62% 9%,rgba(241,90,36,.38) 0,transparent 50%),radial-gradient(at 69% 60%,rgba(200,60,20,.3) 0,transparent 50%),radial-gradient(at 24% 89%,rgba(255,120,50,.26) 0,transparent 50%),radial-gradient(at 51% 77%,#000 0,transparent 50%),radial-gradient(at 78% 92%,rgba(241,90,36,.38) 0,transparent 50%)}
      @keyframes bj-aura{
        0%,100%{background-position:50% 50%,30% 100%,100% 10%,23% 23%,0% 80%}
        33.333%{background-position:10% 75%,40% 80%,60% 20%,43% 23%,16% 30%}
        66.666%{background-position:25% 35%,80% 50%,10% 10%,66% 5%,30% 0%}}
      @media (prefers-reduced-motion:reduce){#bj-login .fundo{animation:none}}
      #bj-login .grao{position:fixed;inset:0;pointer-events:none;transform:translateZ(0);opacity:.13;background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)'/%3E%3C/svg%3E")}
      #bj-login form{position:relative;box-sizing:border-box;display:flex;flex-direction:column;gap:10px;width:100%;max-width:400px;margin:auto;padding:32px 30px 24px;z-index:0}
      #bj-login form::before{content:'';position:absolute;inset:0;z-index:-1;border-radius:24px;border:1px solid rgba(255,255,255,.22);background:linear-gradient(135deg,rgba(255,255,255,.17),rgba(255,255,255,.06));box-shadow:0 30px 70px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.2)}
      #bj-login form[hidden],#bj-login [hidden]{display:none}
      #bj-login .marca{align-self:center;height:40px;width:auto;margin-bottom:14px}
      #bj-login h1{margin:0;font-size:20px;line-height:28px;font-weight:600}
      #bj-login p{margin:0 0 10px;color:rgba(255,255,255,.72)}
      #bj-login input{height:44px;padding:0 14px;border:1px solid rgba(255,255,255,.14);border-radius:12px;background:rgba(0,0,0,.28);color:#fff;font:inherit;outline:0}
      #bj-login input::placeholder{color:rgba(255,255,255,.55)}
      #bj-login input:focus{border-color:rgb(241,90,36)}
      #bj-login button{height:44px;border:0;border-radius:12px;background:#fff;color:#000;font:600 14px inherit;cursor:pointer}
      #bj-login button:disabled{opacity:.5;cursor:default}
      #bj-login a{align-self:center;color:rgba(255,255,255,.75);font-size:12px;text-decoration:underline;cursor:pointer}
      #bj-login .erro{min-height:20px;color:#ff8a8a;font-size:12px}
      #bj-login .ok{min-height:20px;color:#3fc07a;font-size:12px}
      #bj-login .firma{position:absolute;left:50%;bottom:44px;width:120px;height:auto;opacity:.75;transform:translateX(-50%)}
      #bj-login form[hidden]~.firma{display:none}
      @media (max-height:560px){#bj-login .firma{display:none}}
      /* entrada: o logo surge no meio da tela e se encaixa; depois vêm o card e o resto */
      @keyframes bj-logo{
        0%{opacity:0;transform:translate(var(--dx),var(--dy)) scale(.4);animation-timing-function:cubic-bezier(.34,1.3,.64,1)}
        35%{opacity:1;transform:translate(var(--dx),var(--dy)) scale(1.6)}
        55%{transform:translate(var(--dx),var(--dy)) scale(1.6);animation-timing-function:cubic-bezier(.65,0,.35,1)}
        100%{transform:none}}
      @keyframes bj-card{from{opacity:0;transform:scale(.96)}}
      @keyframes bj-item{from{opacity:0;transform:translateY(12px)}}
      @keyframes bj-firma{from{opacity:0}}
      #bj-login.bj-entrada .marca{animation:bj-logo 2100ms both}
      #bj-login.bj-entrada form::before{animation:bj-card 850ms 1150ms ease-out both}
      #bj-login.bj-entrada form>:not(.marca){animation:bj-item 700ms calc(1600ms + var(--i)*110ms) cubic-bezier(.22,1,.36,1) both}
      #bj-login.bj-entrada .firma{animation:bj-firma 900ms 2500ms ease-out both}
      @media (prefers-reduced-motion:reduce){#bj-login.bj-entrada .marca,#bj-login.bj-entrada form::before,#bj-login.bj-entrada form>*,#bj-login.bj-entrada .firma{animation:none}}
    </style>
    <div class="fundo"></div>
    <div class="grao"></div>
    <form hidden>
      <img class="marca" src="icons/wise-live.png" alt="WiseLive">
      <h1 id="bj-titulo" hidden></h1>
      <p id="bj-texto">Entre para abrir o painel.</p>
      <input name="email" type="email" placeholder="E-mail" autocomplete="username" required>
      <input name="senha" type="password" placeholder="Senha" autocomplete="current-password" required>
      <input name="codigo" inputmode="numeric" placeholder="Código do e-mail" autocomplete="one-time-code">
      <input name="nova" type="password" placeholder="Senha nova (mínimo 8 caracteres)" minlength="8" autocomplete="new-password">
      <button type="submit" id="bj-enviar">Entrar</button>
      <div class="erro" role="alert"></div>
      <a id="bj-trocar">Esqueci a senha</a>
    </form>
    <img class="firma" src="icons/wise-inc.png" alt="Wise Inc.">`;
  document.body.appendChild(tela);
  const form = tela.querySelector('form');
  const erro = tela.querySelector('.erro');
  const botao = tela.querySelector('#bj-enviar');
  const trocar = tela.querySelector('#bj-trocar');

  const pedir = (msg) => new Promise((r) => chrome.runtime.sendMessage(msg, (x) => { void chrome.runtime.lastError; r(x); }));

  // entrar | esqueci (pede o e-mail) | codigo (código + senha nova)
  const MODOS = {
    entrar: { titulo: '', texto: 'Entre para abrir o painel.', campos: ['email', 'senha'], botao: 'Entrar', link: 'Esqueci a senha' },
    esqueci: { titulo: 'Recuperar a senha', texto: 'Vamos enviar um código para o seu e-mail.', campos: ['email'], botao: 'Enviar código', link: 'Voltar' },
    codigo: { titulo: 'Criar senha nova', texto: 'Digite o código que chegou no seu e-mail. Confira também o spam.', campos: ['codigo', 'nova'], botao: 'Trocar a senha', link: 'Voltar' },
  };
  let modo = 'entrar';

  // Só quando a tela aparece: trocar entre entrar e esqueci a senha não anima.
  let fimEntrada = null;
  function animarEntrada() {
    tela.classList.remove('bj-entrada');
    const r = tela.querySelector('.marca').getBoundingClientRect();
    tela.style.setProperty('--dx', (innerWidth / 2 - r.left - r.width / 2) + 'px');
    tela.style.setProperty('--dy', (innerHeight / 2 - r.top - r.height / 2) + 'px');
    [...form.children].filter((c) => !c.classList.contains('marca') && !c.hidden)
      .forEach((c, i) => c.style.setProperty('--i', i));
    void tela.offsetWidth;   // recomeça a animação ao voltar do Sair
    tela.classList.add('bj-entrada');
    clearTimeout(fimEntrada);
    fimEntrada = setTimeout(() => tela.classList.remove('bj-entrada'), 3600);
  }

  function irPara(novo, motivo) {
    const apareceu = tela.hidden || form.hidden;
    modo = novo;
    const m = MODOS[novo];
    tela.querySelector('#bj-titulo').textContent = m.titulo;
    tela.querySelector('#bj-titulo').hidden = !m.titulo;
    tela.querySelector('#bj-texto').textContent = m.texto;
    ['email', 'senha', 'codigo', 'nova'].forEach((c) => {
      const usado = m.campos.includes(c);
      form[c].hidden = !usado;
      form[c].required = usado;
    });
    botao.textContent = m.botao;
    trocar.textContent = m.link;
    erro.textContent = motivo || '';
    tela.hidden = false;
    form.hidden = false;
    form[m.campos[0]].focus();
    if (apareceu) animarEntrada();
  }

  trocar.onclick = () => irPara(modo === 'entrar' ? 'esqueci' : 'entrar');

  pedir({ type: 'bj-acesso-conferir' }).then((r) => {
    if (r && r.ok) tela.hidden = true;
    else irPara('entrar', r && r.motivo);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    botao.disabled = true;
    erro.textContent = '';
    const falhou = 'Não deu para falar com a extensão. Tente de novo.';
    let r;
    if (modo === 'entrar') {
      r = await pedir({ type: 'bj-acesso-entrar', email: form.email.value, senha: form.senha.value });
      form.senha.value = '';
    } else if (modo === 'esqueci') {
      r = await pedir({ type: 'bj-acesso-recuperar', email: form.email.value });
      botao.disabled = false;
      if (r && r.enviado) irPara('codigo');
      else irPara('esqueci', (r && r.motivo) || falhou);
      return;
    } else {
      r = await pedir({ type: 'bj-acesso-redefinir', email: form.email.value, codigo: form.codigo.value, senha: form.nova.value });
      form.nova.value = '';
    }
    botao.disabled = false;
    if (r && r.ok) location.reload();
    else irPara(modo, (r && r.motivo) || falhou);
  });

  // Sair: a mudança em bjSessao, logo abaixo, traz a tela de volta
  const sair = document.createElement('button');
  sair.id = 'btnSair';
  sair.type = 'button';
  sair.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10"/></svg>Sair';
  sair.title = 'Sair da sua conta';
  sair.onclick = () => pedir({ type: 'bj-acesso-sair' });
  const fim = document.querySelector('.lat-fim');   // a página de compras não tem
  if (fim) {
    fim.appendChild(sair);
    const versao = document.createElement('div');
    versao.className = 'lat-versao';
    try { versao.textContent = 'v' + chrome.runtime.getManifest().version; } catch {}
    fim.appendChild(versao);
  }

  // saiu pelo popup ou foi bloqueado: a tela volta na hora
  chrome.storage.onChanged.addListener((mudou, area) => {
    if (area === 'local' && mudou.bjSessao && !mudou.bjSessao.newValue) {
      chrome.storage.local.get('bjAcesso').then(({ bjAcesso }) => irPara('entrar', bjAcesso && bjAcesso.motivo));
    }
  });
})();
