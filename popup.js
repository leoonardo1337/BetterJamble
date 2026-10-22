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

const abrir = (url) => chrome.tabs.create({ url });
document.getElementById('compras').onclick = () => abrir(chrome.runtime.getURL('compras.html'));
document.getElementById('exportar').onclick = () => abrir('https://www.jamble.com/account/purchases');
