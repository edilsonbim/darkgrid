'use strict';

const state = { accounts: [] };
const $ = (selector) => document.querySelector(selector);

function render() {
  const grid = $('#accountsGrid');
  $('#activeCount').textContent = `${state.accounts.length}/4`;
  grid.innerHTML = state.accounts.map((account, index) => `<article class="account-card"><div class="account-name"><span class="account-avatar">${index + 1}</span><div><strong>${escapeHtml(account.name || `Conta ${index + 1}`)}</strong><small>${escapeHtml(account.hunt || 'Sessão não iniciada')}</small></div></div><span class="account-status">${escapeHtml(account.status || 'Desconectada')}</span></article>`).join('');
  $('#emptyState').style.display = state.accounts.length ? 'none' : 'grid';
}

function escapeHtml(value) { return String(value).replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char])); }

function addDemoAccount() {
  if (state.accounts.length >= 4) return;
  state.accounts.push({ name: `Conta ${state.accounts.length + 1}`, hunt: 'Pronta para conectar', status: 'Aguardando login' });
  render();
}

$('#loginButton').addEventListener('click', addDemoAccount);
$('#emptyLoginButton').addEventListener('click', addDemoAccount);
$('#manageAccountsButton').addEventListener('click', addDemoAccount);
$('#refreshButton').addEventListener('click', render);
document.querySelectorAll('.nav-item').forEach((button) => button.addEventListener('click', () => {
  document.querySelectorAll('.nav-item').forEach((item) => item.classList.remove('active'));
  button.classList.add('active');
}));

render();
