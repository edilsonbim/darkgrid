'use strict';

const state = { accounts: [], busy: false, auth: { ok: false } };
const $ = (selector) => document.querySelector(selector);
const statusLabels = { loading: 'Carregando jogo', login_required: 'Login necessário', online: 'Online', stale: 'Sem atividade recente', offline: 'Offline', error: 'Erro no painel' };

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

function setAuthStatus(status) {
  const label = $('#licenseLabel');
  if (!status?.ok) { label.textContent = status?.reason === 'auth_server_not_configured' ? 'Servidor não configurado' : 'Licença não verificada'; label.className = 'license-badge'; return; }
  label.textContent = `Plano ${status.plan || 'ativo'}`;
  label.className = 'license-badge active';
}

function openAuthModal() { $('#authModal').hidden = false; $('#authEmail').focus(); }
function closeAuthModal() { $('#authModal').hidden = true; $('#authError').textContent = ''; }

async function addAccount() {
  if (!state.auth.ok) { openAuthModal(); return; }
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

$('#loginButton').addEventListener('click', openAuthModal);
$('#emptyLoginButton').addEventListener('click', addAccount);
$('#manageAccountsButton').addEventListener('click', addAccount);
$('#refreshButton').addEventListener('click', render);
$('#authClose').addEventListener('click', closeAuthModal);
$('#authModal').addEventListener('click', (event) => { if (event.target.id === 'authModal') closeAuthModal(); });
$('#authForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = event.currentTarget.querySelector('button[type="submit"]');
  const error = $('#authError');
  button.disabled = true;
  error.textContent = '';
  try {
    const result = await window.darkGridAPI.authLogin($('#authEmail').value, $('#authPassword').value);
    if (!result?.ok) throw new Error(result?.reason || 'auth_failed');
    state.auth = result.license;
    setAuthStatus(state.auth);
    closeAuthModal();
    await addAccount();
  } catch (cause) { error.textContent = `Não foi possível entrar: ${cause.message}`; } finally { button.disabled = false; }
});
window.addEventListener('resize', syncLayout);
window.darkGridAPI.onAccountStatus((payload) => { const account = state.accounts.find((item) => item.id === payload.id); if (account) { account.status = payload.status; render(); } });
window.darkGridAPI.onAccountState((payload) => { const account = state.accounts.find((item) => item.id === payload.accountId); const snapshot = payload.state; if (account && snapshot) { account.status = snapshot.status; account.name = snapshot.name || account.name; account.hunt = snapshot.hunt?.name || snapshot.hunt?.slug || 'Sem hunt'; render(); } });
document.querySelectorAll('.nav-item').forEach((button) => button.addEventListener('click', () => {
  document.querySelectorAll('.nav-item').forEach((item) => item.classList.remove('active'));
  button.classList.add('active');
}));

Promise.all([window.darkGridAPI.authStatus(), restoreAccounts()]).then(([status]) => { state.auth = status || { ok: false }; setAuthStatus(state.auth); render(); }).catch(() => render());
