// Menu da extensão: atalhos para as compras exportadas.
const nf = (n) => n.toLocaleString('pt-BR');

chrome.storage.local.get({ purchases: null }, ({ purchases }) => {
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
chrome.runtime.sendMessage({ type: 'bj-estado-atualizacao' }, (r) => {
  void chrome.runtime.lastError;
  if (r && r.versao) { status('Versão ' + r.versao + ' já baixada, esperando para entrar.', true); mostrarAplicar(r.versao); }
});
$('procurar').onclick = () => {
  $('procurar').disabled = true;
  status('Procurando na Web Store…');
  chrome.runtime.sendMessage({ type: 'bj-procurar-atualizacao' }, (r) => {
    void chrome.runtime.lastError;
    $('procurar').disabled = false;
    if (!r) { status('Não deu para falar com a extensão. Tente de novo.'); return; }
    if (r.status === 'update_available') { status('Tem versão nova' + (r.versao ? ' (' + r.versao + ')' : '') + '. Ela está baixando.', true); mostrarAplicar(r.versao); }
    else if (r.status === 'no_update') status('Você já está na versão mais nova (' + r.atual + ').', true);
    else if (r.status === 'throttled') status('O navegador pediu um tempo entre as consultas. Tente de novo em alguns minutos.');
    else status('Não deu para consultar a loja' + (r.erro ? ': ' + r.erro : '') + '. Se a extensão não veio da Web Store, ela não atualiza por aqui.');
  });
};
$('aplicar').onclick = () => {
  $('aplicar').disabled = true;
  status('Atualizando… a janela do BetterJamble vai fechar e as abas da Jamble vão recarregar.');
  chrome.runtime.sendMessage({ type: 'bj-aplicar-atualizacao' }, () => void chrome.runtime.lastError);
};

const abrir = (url) => chrome.tabs.create({ url });
document.getElementById('compras').onclick = () => abrir(chrome.runtime.getURL('compras.html'));
document.getElementById('exportar').onclick = () => abrir('https://www.jamble.com/account/purchases');
