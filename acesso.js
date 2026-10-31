// Login da extensão (Supabase Auth). Carregado pelo background.
//
// A extensão só age na Jamble com acesso liberado: os content scripts deixaram
// de estar no manifesto e são registrados aqui. Sem login, a página recebe só o
// botão dourado, que abre a janela do painel com a tela de login (login-painel.js).
//
// A senha não é guardada: só a sessão (bjSessao) e o resultado da última
// conferência (bjAcesso). Quem bloqueia alguém muda a linha dele na tabela
// `acessos` no painel do Supabase; a extensão percebe na conferência seguinte.
// Sem internet, a licença guardada vale até vencer.

const SUPABASE = 'https://rjmskhfotpkmphzapzdy.supabase.co';
const CHAVE_PUBLICA = 'sb_publishable_2cDA1V6vv8A6eUt9QV3LDw_Zej6n6zn';   // pública por natureza; quem protege é a RLS
const ALARME_ACESSO = 'bj-acesso';
const JAMBLE = 'https://www.jamble.com/*';

const SCRIPTS_COMPLETOS = ['ritmo.js', 'content.js', 'live.js', 'gems-core.js', 'gems-transporte.js', 'audiencia.js', 'resgate.js', 'gems-bar.js'];
const SCRIPTS_SEM_LOGIN = ['botao-login.js', 'gems-bar.js'];
const scriptsDa = (js) => [
  { id: 'bj-main', matches: [JAMBLE], js, runAt: 'document_start', world: 'MAIN' },
  { id: 'bj-bridge', matches: [JAMBLE], js: ['bridge.js'], runAt: 'document_start' },
];

async function pedirAuth(caminho, corpo) {
  const r = await fetch(SUPABASE + '/auth/v1' + caminho, {
    method: 'POST',
    headers: { apikey: CHAVE_PUBLICA, 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  });
  return { status: r.status, dados: await r.json().catch(() => ({})) };
}

const guardarSessao = (d) => chrome.storage.local.set({
  bjSessao: { access: d.access_token, refresh: d.refresh_token, expiraEm: Date.now() + (d.expires_in || 3600) * 1000, email: d.user && d.user.email },
});

// Liga ou desliga a extensão nas páginas da Jamble. Só mexe nas abas se mudou.
// Uma aplicação por vez: duas juntas registrariam o mesmo script e dariam erro.
let filaAplicar = Promise.resolve();
function aplicarAcesso(liberado) {
  filaAplicar = filaAplicar.catch(() => {}).then(() => trocarScripts(liberado));
  return filaAplicar;
}

async function trocarScripts(liberado) {
  const js = liberado ? SCRIPTS_COMPLETOS : SCRIPTS_SEM_LOGIN;
  const atuais = await chrome.scripting.getRegisteredContentScripts({ ids: ['bj-main'] });
  chrome.action.setBadgeText({ text: liberado ? '' : '!' });
  if (atuais[0] && atuais[0].js.length === js.length) return;
  await chrome.scripting.unregisterContentScripts();
  await chrome.scripting.registerContentScripts(scriptsDa(js));
  const abas = await chrome.tabs.query({ url: JAMBLE });
  abas.forEach((t) => chrome.tabs.reload(t.id, () => void chrome.runtime.lastError));
}

async function encerrar(motivo) {
  await chrome.storage.local.set({ bjAcesso: { ok: false, motivo: motivo || '', em: Date.now() } });
  await chrome.storage.local.remove(['bjLicenca', 'bjSessao']);
  await aplicarAcesso(false);
}

// A licença é emitida e assinada pelo servidor (função licenca). Só ela libera a
// extensão: editar bjSessao ou bjLicenca no armazenamento local não adianta.
const CHAVE_LICENCA = {
  kty: 'EC', crv: 'P-256',
  x: 'oGOLmwrhdJsJ2yYmXN2iEs6fB7O3kKIgCVCx4WEabOg',
  y: 'dj5GABCIavkbYxXtfgX0thdStCBNaQqxLkj13QfctiM',
};

async function idDispositivo() {
  let { bjDispositivo } = await chrome.storage.local.get('bjDispositivo');
  if (!bjDispositivo) {
    bjDispositivo = crypto.randomUUID();
    await chrome.storage.local.set({ bjDispositivo });
  }
  return bjDispositivo;
}

async function licencaValida() {
  const { bjLicenca, bjDispositivo } = await chrome.storage.local.get(['bjLicenca', 'bjDispositivo']);
  if (!bjLicenca || !bjLicenca.licenca || !bjLicenca.assinatura) return false;
  try {
    const chave = await crypto.subtle.importKey('jwk', CHAVE_LICENCA, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    const assinatura = Uint8Array.from(atob(bjLicenca.assinatura), (c) => c.charCodeAt(0));
    const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, chave, assinatura, new TextEncoder().encode(bjLicenca.licenca));
    if (!ok) return false;
    const l = JSON.parse(bjLicenca.licenca);
    return l.dispositivo === bjDispositivo && Date.now() < l.expira;
  } catch { return false; }
}

const MOTIVOS = {
  bloqueado: 'Seu acesso não está liberado.',
  limite: 'Esta conta já está no limite de dispositivos.',
};

// Pede ao servidor uma licença nova: confere a sessão, o acesso e o limite de
// dispositivos. Sem internet, vale a licença guardada até ela vencer (24 h).
async function conferirAcesso() {
  const { bjSessao } = await chrome.storage.local.get('bjSessao');
  if (!bjSessao) { await aplicarAcesso(false); return { ok: false }; }
  try {
    let sessao = bjSessao;
    if (Date.now() > sessao.expiraEm - 60000) {
      const r = await pedirAuth('/token?grant_type=refresh_token', { refresh_token: sessao.refresh });
      if (r.status >= 400 && r.status < 500) { await encerrar('Sua sessão expirou. Entre de novo.'); return { ok: false }; }
      if (r.status !== 200) throw new Error('auth ' + r.status);
      await guardarSessao(r.dados);
      ({ bjSessao: sessao } = await chrome.storage.local.get('bjSessao'));
    }
    const r = await fetch(SUPABASE + '/functions/v1/licenca', {
      method: 'POST',
      headers: { apikey: CHAVE_PUBLICA, Authorization: 'Bearer ' + sessao.access, 'Content-Type': 'application/json' },
      body: JSON.stringify({ dispositivo: await idDispositivo() }),
    });
    if (r.status === 401) { await encerrar('Sua sessão expirou. Entre de novo.'); return { ok: false }; }
    if (r.status === 403) {
      const { motivo } = await r.json().catch(() => ({}));
      const texto = MOTIVOS[motivo] || MOTIVOS.bloqueado;
      await encerrar(texto);
      return { ok: false, motivo: texto };
    }
    if (!r.ok) throw new Error('licenca ' + r.status);
    await chrome.storage.local.set({ bjLicenca: await r.json() });
    if (!(await licencaValida())) throw new Error('assinatura');
    await chrome.storage.local.set({ bjAcesso: { ok: true, em: Date.now() } });
    await aplicarAcesso(true);
    return { ok: true, email: sessao.email };
  } catch {
    if (await licencaValida()) {
      await aplicarAcesso(true);
      return { ok: true, email: bjSessao.email, semConexao: true };
    }
    await aplicarAcesso(false);
    return { ok: false, motivo: 'Sem conexão para conferir seu acesso.' };
  }
}

const SEM_CONEXAO = { ok: false, motivo: 'Sem conexão. Tente de novo.' };

// ------------------------------------------------------ resumos das lives
// Guardados na conta (tabela resumos_live). A RLS garante que cada conta só
// enxerga os próprios e que só quem tem acesso liberado grava.
async function tokenAtual() {
  if (!(await licencaValida())) return null;
  let { bjSessao: sessao } = await chrome.storage.local.get('bjSessao');
  if (!sessao) return null;
  if (Date.now() > sessao.expiraEm - 60000) {
    const r = await pedirAuth('/token?grant_type=refresh_token', { refresh_token: sessao.refresh });
    if (r.status !== 200) return null;
    await guardarSessao(r.dados);
    ({ bjSessao: sessao } = await chrome.storage.local.get('bjSessao'));
  }
  return sessao.access;
}

async function pedirResumos(caminho, opcoes) {
  const token = await tokenAtual();
  if (!token) return { ok: false, motivo: 'Entre de novo para ver os resumos.' };
  try {
    const r = await fetch(SUPABASE + '/rest/v1/' + caminho, {
      ...opcoes,
      headers: { apikey: CHAVE_PUBLICA, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', ...((opcoes && opcoes.headers) || {}) },
    });
    if (!r.ok) return { ok: false, motivo: 'Não deu para falar com o servidor agora.' };
    const texto = await r.text();
    return { ok: true, dados: texto ? JSON.parse(texto) : null };
  } catch { return SEM_CONEXAO; }
}

async function salvarResumo(m) {
  const id = encodeURIComponent(String(m.showId || ''));
  if (!id || !m.fim) return { ok: false };
  // reabrir uma live com menos dados no navegador não apaga o que já foi salvo
  const atual = await pedirResumos('resumos_live?select=peso&show_id=eq.' + id);
  if (!atual.ok) return atual;
  if (atual.dados[0] && atual.dados[0].peso > m.peso) return { ok: true, ignorado: true };
  return pedirResumos('resumos_live?on_conflict=user_id,show_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      show_id: String(m.showId), seller: String(m.seller || ''),
      inicio: m.inicio ? new Date(m.inicio).toISOString() : null, fim: new Date(m.fim).toISOString(),
      provisorio: !!m.provisorio, peso: Math.round(Number(m.peso) || 0), resumo: m.resumo,
      atualizado_em: new Date().toISOString(),
    }),
  });
}
const listarResumos = () => pedirResumos('resumos_live?select=show_id,seller,inicio,fim,provisorio,audiencia:resumo->audiencia,vendas:resumo->vendas&order=fim.desc&limit=200');
const resumosDoPeriodo = (de, ate) => pedirResumos('resumos_live?select=show_id,seller,inicio,fim,provisorio,resumo&order=fim.asc&limit=200'
  + '&fim=gte.' + encodeURIComponent(new Date(de).toISOString()) + '&fim=lte.' + encodeURIComponent(new Date(ate).toISOString()));
const lerResumo = (id) => pedirResumos('resumos_live?select=show_id,seller,inicio,fim,provisorio,resumo&show_id=eq.' + encodeURIComponent(String(id || '')));

async function entrar(email, senha) {
  let r;
  try { r = await pedirAuth('/token?grant_type=password', { email: String(email || '').trim(), password: senha }); }
  catch { return SEM_CONEXAO; }
  if (r.status !== 200) return { ok: false, motivo: r.status === 400 ? 'E-mail ou senha incorretos.' : 'Não deu para entrar agora. Tente de novo.' };
  await guardarSessao(r.dados);
  return conferirAcesso();
}

// Esqueci a senha: o Supabase manda um código por e-mail. A resposta é a mesma
// para e-mail cadastrado ou não, para ninguém descobrir quem tem conta.
async function recuperar(email) {
  let r;
  try { r = await pedirAuth('/recover', { email: String(email || '').trim() }); }
  catch { return SEM_CONEXAO; }
  if (r.status === 429) return { ok: false, motivo: 'Muitos pedidos seguidos. Espere alguns minutos e tente de novo.' };
  if (r.status !== 200) return { ok: false, motivo: 'Não deu para enviar o código agora. Tente de novo.' };
  return { ok: false, enviado: true };
}

async function redefinir(email, codigo, senha) {
  try {
    const r = await pedirAuth('/verify', { type: 'recovery', email: String(email || '').trim(), token: String(codigo || '').trim() });
    if (r.status !== 200) return { ok: false, motivo: 'Código errado ou vencido.' };
    const t = await fetch(SUPABASE + '/auth/v1/user', {
      method: 'PUT',
      headers: { apikey: CHAVE_PUBLICA, Authorization: 'Bearer ' + r.dados.access_token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: senha }),
    });
    if (!t.ok) {
      const d = await t.json().catch(() => ({}));
      return { ok: false, motivo: d.error_code === 'same_password' ? 'A senha nova precisa ser diferente da antiga.' : 'Não deu para trocar a senha. Peça outro código.' };
    }
    await guardarSessao(r.dados);
    return conferirAcesso();
  } catch { return SEM_CONEXAO; }
}

chrome.runtime.onMessage.addListener((msg, sender, responder) => {
  if (!msg) return;
  // só as páginas da própria extensão mexem nos resumos
  if (/^bj-resumo-/.test(msg.type || '') && sender.id === chrome.runtime.id && String(sender.url || '').startsWith('chrome-extension://')) {
    (msg.type === 'bj-resumo-salvar' ? salvarResumo(msg)
      : msg.type === 'bj-resumo-listar' ? listarResumos()
        : msg.type === 'bj-resumo-periodo' ? resumosDoPeriodo(msg.de, msg.ate)
          : lerResumo(msg.showId)).then(responder);
    return true;
  }
  if (msg.type === 'bj-acesso-conferir') { conferirAcesso().then(responder); return true; }
  if (msg.type === 'bj-acesso-entrar') { entrar(msg.email, msg.senha).then(responder); return true; }
  if (msg.type === 'bj-acesso-recuperar') { recuperar(msg.email).then(responder); return true; }
  if (msg.type === 'bj-acesso-redefinir') { redefinir(msg.email, msg.codigo, msg.senha).then(responder); return true; }
  if (msg.type === 'bj-acesso-sair') { encerrar().then(() => responder({ ok: false })); return true; }
});

chrome.alarms.onAlarm.addListener((a) => { if (a.name === ALARME_ACESSO) conferirAcesso(); });
const iniciarAcesso = () => {
  chrome.alarms.create(ALARME_ACESSO, { periodInMinutes: 5 });
  chrome.action.setBadgeBackgroundColor({ color: '#e5484d' });
  conferirAcesso().then((r) => chrome.action.setBadgeText({ text: r.ok ? '' : '!' }));
};
chrome.runtime.onInstalled.addListener(iniciarAcesso);
chrome.runtime.onStartup.addListener(iniciarAcesso);
