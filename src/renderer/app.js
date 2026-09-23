'use strict';

const state = { accounts: [], busy: false, auth: { ok: false } };
let gameLoginAccount = null;
const $ = (selector) => document.querySelector(selector);
const statusLabels = { loading: 'Carregando jogo', login_required: 'Login necessário', online: 'Online', stale: 'Sem atividade recente', offline: 'Offline', error: 'Erro no painel', opened: 'Painel aberto', closed: 'Painel oculto' };

function render() {
  const grid = $('#accountsGrid');
  $('#activeCount').textContent = `${state.accounts.length}/4`;
  grid.replaceChildren(...state.accounts.map((account, index) => {
    const card = document.createElement('article'); card.className = 'account-card';
    const name = document.createElement('div'); name.className = 'account-name';
    const avatar = document.createElement('span'); avatar.className = 'account-avatar'; avatar.textContent = String(index + 1);
    const details = document.createElement('div'); const title = document.createElement('strong'); title.textContent = account.name || `Conta ${index + 1}`;
    const hunt = document.createElement('small'); hunt.textContent = account.hunt || 'Sessão não iniciada';
    const stats = document.createElement('small'); stats.className = 'account-stats'; stats.textContent = account.level ? `Nível ${account.level} · ${account.gold || 0} gold` : 'Estado aguardando leitura';
    details.append(title, hunt, stats); name.append(avatar, details);
    const actions = document.createElement('div'); actions.className = 'account-actions';
    const status = document.createElement('span'); status.className = 'account-status'; status.textContent = statusLabels[account.status] || account.status || 'Desconectada';
    const open = document.createElement('button'); open.className = 'mini-button'; open.textContent = 'Abrir'; open.addEventListener('click', () => openAccount(account));
    const actionBar = document.createElement('div'); actionBar.className = 'account-action-bar';
    for (const [label, action] of [['Login', 'gameLogin'], ['Market', 'openMarket'], ['Depot', 'openDepot'], ['Retornar', 'returnToLastHunt'], ['Atualizar', 'refresh']]) {
      const button = document.createElement('button'); button.className = 'mini-button'; button.textContent = label; button.disabled = Boolean(account.actionBusy);
      button.addEventListener('click', () => action === 'refresh' ? refreshAccount(account) : action === 'gameLogin' ? openGameLogin(account) : runAccountAction(account, action, action === 'returnToLastHunt' ? { slug: account.huntSlug, name: account.hunt } : {})); actionBar.append(button);
    }
    actions.append(status, open); card.append(name, actions, actionBar); return card;
  }));
  $('#emptyState').style.display = state.accounts.length ? 'none' : 'grid';
}

function setAuthStatus(status) {
  const label = $('#licenseLabel');
  $('#logoutButton').hidden = !status?.ok;
  if (!status?.ok) { label.textContent = status?.reason === 'auth_server_not_configured' ? 'Servidor não configurado' : 'Licença não verificada'; label.className = 'license-badge'; return; }
  label.textContent = status.offlineGrace ? 'Licença offline · grace' : `Plano ${status.plan || 'ativo'}`;
  label.className = 'license-badge active';
}

function openAuthModal() { $('#authModal').hidden = false; $('#authEmail').focus(); }
function closeAuthModal() { $('#authModal').hidden = true; $('#authError').textContent = ''; }
async function openGameLogin(account) { gameLoginAccount = account; await window.darkGridAPI.openAccount(account.id); syncLayout(); $('#gameLoginModal').hidden = false; $('#gameUsername').focus(); }
function closeGameLogin() { gameLoginAccount = null; $('#gameLoginModal').hidden = true; $('#gameUsername').value = ''; $('#gamePassword').value = ''; $('#gameLoginError').textContent = ''; }

async function addAccount() {
  if (!state.auth.ok) { openAuthModal(); return; }
  if (state.auth.offlineGrace) { $('#connectionLabel').textContent = 'Grace offline: novas ativações bloqueadas'; return; }
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
async function refreshAccount(account) {
  if (account.actionBusy) return;
  account.actionBusy = true; render();
  try {
    const response = await window.darkGridAPI.getAccountState(account.id);
    if (!response?.ok) throw new Error(response?.reason || 'state_failed');
    applySnapshot(account, response.state);
  } catch (cause) { account.status = 'error'; account.error = cause.message; }
  finally { account.actionBusy = false; render(); }
}
async function runAccountAction(account, action, input = {}) {
  if (account.actionBusy) return;
  account.actionBusy = true; render();
  try {
    const response = await window.darkGridAPI.accountAction(account.id, action, input);
    if (!response?.ok || !response.result?.ok) throw new Error(response?.reason || response?.result?.reason || 'action_failed');
    account.status = 'online';
  } catch (cause) { account.status = cause.message === 'game_auth_required' ? 'login_required' : 'error'; account.error = cause.message; }
  finally { account.actionBusy = false; render(); }
}
function applySnapshot(account, snapshot) {
  if (!snapshot) return;
  account.status = snapshot.status; account.name = snapshot.name || account.name; account.hunt = snapshot.hunt?.name || snapshot.hunt?.slug || 'Sem hunt'; account.huntSlug = snapshot.hunt?.slug || account.huntSlug || ''; account.level = snapshot.level; account.gold = snapshot.gold;
}
function syncLayout() { window.darkGridAPI.setAccountLayout({ x: 250, y: 112, width: Math.max(500, window.innerWidth - 270), height: Math.max(400, window.innerHeight - 135) }); }

$('#loginButton').addEventListener('click', openAuthModal);
$('#emptyLoginButton').addEventListener('click', addAccount);
$('#manageAccountsButton').addEventListener('click', addAccount);
$('#refreshButton').addEventListener('click', render);
$('#logoutButton').addEventListener('click', async () => {
  const result = await window.darkGridAPI.authLogout();
  if (!result?.ok) { $('#connectionLabel').textContent = 'Falha ao sair'; return; }
  for (const account of state.accounts) await window.darkGridAPI.removeAccount(account.id);
  state.accounts = []; state.auth = { ok: false, reason: 'auth_required' }; setAuthStatus(state.auth); render();
});
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
$('#gameLoginClose').addEventListener('click', closeGameLogin);
$('#gameLoginModal').addEventListener('click', (event) => { if (event.target.id === 'gameLoginModal') closeGameLogin(); });
$('#gameLoginForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!gameLoginAccount) return;
  const button = event.currentTarget.querySelector('button[type="submit"]');
  const error = $('#gameLoginError'); button.disabled = true; error.textContent = '';
  try {
    const filled = await window.darkGridAPI.accountAction(gameLoginAccount.id, 'fillGameCredentials', { username: $('#gameUsername').value, password: $('#gamePassword').value });
    if (!filled?.ok || !filled.result?.ok) throw new Error(filled?.reason || filled?.result?.reason || 'game_login_failed');
    const submitted = await window.darkGridAPI.accountAction(gameLoginAccount.id, 'submitGameLogin', {});
    if (!submitted?.ok || !submitted.result?.ok) { error.textContent = 'Campos preenchidos. Conclua o desafio humano no painel do jogo e pressione novamente.'; return; }
    closeGameLogin();
  } catch (cause) { error.textContent = `Não foi possível preencher o login: ${cause.message}`; } finally { button.disabled = false; }
});
window.addEventListener('resize', syncLayout);
window.darkGridAPI.onAccountStatus((payload) => { const account = state.accounts.find((item) => item.id === payload.id); if (account) { account.status = payload.status; render(); } });
window.darkGridAPI.onAccountState((payload) => { const account = state.accounts.find((item) => item.id === payload.accountId); if (account) { applySnapshot(account, payload.state); render(); } });
document.querySelectorAll('.nav-item').forEach((button) => button.addEventListener('click', () => {
  document.querySelectorAll('.nav-item').forEach((item) => item.classList.remove('active'));
  button.classList.add('active');
}));

async function bootstrap() {
  try {
    state.auth = await window.darkGridAPI.authStatus() || { ok: false };
    setAuthStatus(state.auth);
    if (state.auth.ok) await restoreAccounts();
    else render();
  } catch { state.auth = { ok: false, reason: 'auth_required' }; setAuthStatus(state.auth); render(); }
}

bootstrap();
