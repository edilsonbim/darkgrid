'use strict';

const state = { accounts: [], busy: false };
const $ = (selector) => document.querySelector(selector);
const statusLabels = { loading: 'Carregando jogo', login_required: 'Login necessário', online: 'Online', offline: 'Offline', error: 'Erro no painel' };

function render() {
  const grid = $('#accountsGrid');
  $('#activeCount').textContent = `${state.accounts.length}/4`;
  grid.replaceChildren(...state.accounts.map((account, index) => {
    const card = document.createElement('article'); card.className = 'account-card';
    const name = document.createElement('div'); name.className = 'account-name';
    const avatar = document.createElement('span'); avatar.className = 'account-avatar'; avatar.textContent = String(index + 1);
    const details = document.createElement('div'); const title = document.createElement('strong'); title.textContent = account.name || `Conta ${index + 1}`;
    const hunt = document.createElement('small'); hunt.textContent = account.hunt || 'Sessão não iniciada'; details.append(title, hunt); name.append(avatar, details);
    const actions = document.createElement('div'); actions.className = 'account-actions';
    const status = document.createElement('span'); status.className = 'account-status'; status.textContent = statusLabels[account.status] || account.status || 'Desconectada';
    const open = document.createElement('button'); open.className = 'mini-button'; open.textContent = 'Abrir'; open.addEventListener('click', () => openAccount(account));
    actions.append(status, open); card.append(name, actions); return card;
  }));
  $('#emptyState').style.display = state.accounts.length ? 'none' : 'grid';
}

async function addAccount() {
  if (state.accounts.length >= 4 || state.busy) return;
  state.busy = true;
  const slot = state.accounts.length;
  const account = { id: `account-${Date.now()}-${slot}`, slot, name: `Conta ${slot + 1}`, label: `Conta ${slot + 1}`, enabled: true, hunt: 'Pronta para conectar', status: 'loading' };
  const result = await window.darkGridAPI.addAccount({ id: account.id, slot });
  state.busy = false;
  if (!result?.ok) { $('#connectionLabel').textContent = 'Falha ao criar painel'; return; }
  state.accounts.push(account);
  await saveProfiles();
  render();
}

async function saveProfiles() {
  await window.darkGridAPI.saveProfiles(state.accounts.map(({ id, label, enabled }) => ({ id, label, enabled })));
}

async function restoreAccounts() {
  const profiles = await window.darkGridAPI.loadProfiles();
  for (const profile of profiles) {
    const result = await window.darkGridAPI.addAccount({ id: profile.id, slot: profile.slot });
    if (result?.ok) state.accounts.push({ ...profile, name: profile.label, hunt: 'Pronta para conectar', status: 'loading' });
  }
  render();
}

async function openAccount(account) { await window.darkGridAPI.openAccount(account.id); syncLayout(); }
function syncLayout() { window.darkGridAPI.setAccountLayout({ x: 250, y: 112, width: Math.max(500, window.innerWidth - 270), height: Math.max(400, window.innerHeight - 135) }); }

$('#loginButton').addEventListener('click', addAccount);
$('#emptyLoginButton').addEventListener('click', addAccount);
$('#manageAccountsButton').addEventListener('click', addAccount);
$('#refreshButton').addEventListener('click', render);
window.addEventListener('resize', syncLayout);
window.darkGridAPI.onAccountStatus((payload) => { const account = state.accounts.find((item) => item.id === payload.id); if (account) { account.status = payload.status; render(); } });
document.querySelectorAll('.nav-item').forEach((button) => button.addEventListener('click', () => {
  document.querySelectorAll('.nav-item').forEach((item) => item.classList.remove('active'));
  button.classList.add('active');
}));

restoreAccounts().catch(() => render());
