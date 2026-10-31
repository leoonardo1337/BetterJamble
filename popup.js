// Menu da extensão: login e atalhos para as compras exportadas.
const nf = (n) => n.toLocaleString('pt-BR');

// Sem acesso liberado, só o formulário de entrada aparece.
function mostrarAcesso(r) {
  const ok = !!(r && r.ok);
  document.getElementById('login').hidden = ok;
  document.getElementById('menu').hidden = !ok;
  document.getElementById('conta').hidden = !ok;
  if (ok) document.getElementById('contaNome').textContent = (r.email || '') + (r.semConexao ? ' · sem conexão' : '');
  else document.getElementById('quando').textContent = 'Entre para usar';
  document.getElementById('erroLogin').textContent = (r && r.motivo) || '';
  if (ok) mostrarCompras();
}
chrome.runtime.sendMessage({ type: 'bj-acesso-conferir' }, (r) => { void chrome.runtime.lastError; mostrarAcesso(r); });
// a tela de login fica na janela do painel
document.getElementById('entrar').onclick = () => {
  chrome.runtime.sendMessage({ type: 'bj-abrir-painel' }, () => { void chrome.runtime.lastError; window.close(); });
};
document.getElementById('sair').onclick = () => {
  chrome.runtime.sendMessage({ type: 'bj-acesso-sair' }, () => { void chrome.runtime.lastError; mostrarAcesso({ ok: false }); });
};

const mostrarCompras = () => chrome.storage.local.get({ purchases: null }, ({ purchases }) => {
  const linhas = (purchases && purchases.rows) || [];
  const quando = (purchases && purchases.at) || 0;
  document.getElementById('quando').textContent = quando
    ? `${nf(linhas.length)} compras salvas · ${new Date(quando).toLocaleString('pt-BR')}`
    : 'Nenhuma compra exportada ainda';
});

// Resquício da antiga página de histórico: não é mais gravado nem usado.
chrome.storage.local.remove('sales');

// Atualização: o navegador só confere a loja de tempos em tempos; aqui dá para
// pedir na hora. A versão nova, quando baixa, é aplicada recarregando a
// extensão (a janela do painel fecha e as abas da Jamble recarregam sozinhas).
const $ = (id) => document.getElementById(id);
const status = (txt, ok) => { $('statusAtualizacao').textContent = txt; $('statusAtualizacao').classList.toggle('ok', !!ok); };
const mostrarAplicar = (versao) => {
  $('aplicarTxt').textContent = 'Atualizar agora' + (versao && versao !== '?' ? ' para ' + versao : '');
  $('aplicar').hidden = false;
};
$('versao').textContent = chrome.runtime.getManifest().version;
// Ao abrir o popup já procura sozinho e, se tiver versão nova, ela entra assim
// que terminar de baixar (não precisa clicar em nada).
const procurar = () => {
  $('procurar').disabled = true;
  status('Procurando na Web Store…');
  chrome.runtime.sendMessage({ type: 'bj-procurar-atualizacao', aplicar: true }, (r) => {
    void chrome.runtime.lastError;
    $('procurar').disabled = false;
    if (!r) { status('Não deu para falar com a extensão. Tente de novo.'); return; }
    if (r.status === 'aplicando') { status('Atualizando para ' + r.versao + '… a janela do WiseLive vai fechar e as abas da Jamble vão recarregar.', true); return; }
    if (r.status === 'update_available') { status('Tem versão nova' + (r.versao ? ' (' + r.versao + ')' : '') + '. Ela está baixando e entra sozinha em seguida.', true); mostrarAplicar(r.versao); }
    else if (r.status === 'no_update') status('Você já está na versão mais nova (' + r.atual + ').', true);
    else if (r.status === 'throttled') status('A loja já foi consultada há pouco. Você está na ' + r.atual + '; dá para procurar de novo em alguns minutos.');
    else status('Não deu para consultar a loja' + (r.erro ? ': ' + r.erro : '') + '. Se a extensão não veio da Web Store, ela não atualiza por aqui.');
  });
};
$('procurar').onclick = procurar;
procurar();
$('aplicar').onclick = () => {
  $('aplicar').disabled = true;
  status('Atualizando… a janela do WiseLive vai fechar e as abas da Jamble vão recarregar.');
  chrome.runtime.sendMessage({ type: 'bj-aplicar-atualizacao' }, () => void chrome.runtime.lastError);
};

const abrir = (url) => chrome.tabs.create({ url });
document.getElementById('compras').onclick = () => abrir(chrome.runtime.getURL('compras.html'));
document.getElementById('exportar').onclick = () => abrir('https://www.jamble.com/account/purchases');
