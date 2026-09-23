'use strict';

const state = { accounts: [], history: [], alerts: {}, busy: false, auth: { ok: false } };
let gameLoginAccount = null;
let operationsAccount = null;
let inventoryAccount = null;
let teamAccount = null;
const $ = (selector) => document.querySelector(selector);
const statusLabels = { loading: 'Carregando jogo', login_required: 'Login necessário', online: 'Online', stale: 'Sem atividade recente', offline: 'Offline', error: 'Erro no painel', opened: 'Painel aberto', closed: 'Painel oculto' };

function render() {
  const grid = $('#accountsGrid');
  $('#activeCount').textContent = `${state.accounts.length}/4`;
  const online = state.accounts.filter((account) => account.status === 'online' || account.status === 'stale').length;
  const hunting = state.accounts.filter((account) => account.status === 'online' && account.hunt).length;
  const metrics = state.accounts.reduce((total, account) => ({
    kills: total.kills + Number(account.metrics?.kills || 0),
    xph: total.xph + Number(account.metrics?.xph || 0),
    captures: total.captures + Number(account.metrics?.captures || 0),
    shiny: total.shiny + Number(account.metrics?.shiny || 0)
  }), { kills: 0, xph: 0, captures: 0, shiny: 0 });
  $('#activeSummary').textContent = online ? `${online} sessão(ões) conectada(s)` : 'nenhuma sessão conectada';
  $('#farmStatus').textContent = hunting ? 'Operando' : online ? 'Aguardando' : 'Parado';
  $('#farmSummary').textContent = hunting ? `${hunting} conta(s) em hunt` : 'conecte uma conta para começar';
  $('#performanceValue').textContent = metrics.xph ? `${metrics.xph.toLocaleString('pt-BR')} XP/h` : 'Eco';
  $('#performanceSummary').textContent = metrics.kills ? `${metrics.kills.toLocaleString('pt-BR')} kills · ${metrics.captures} capturas · ${metrics.shiny} shiny` : 'painel leve ativado';
  grid.replaceChildren(...state.accounts.map((account, index) => {
    const card = document.createElement('article'); card.className = 'account-card';
    const name = document.createElement('div'); name.className = 'account-name';
    const avatar = document.createElement('span'); avatar.className = 'account-avatar'; avatar.textContent = String(index + 1);
    const details = document.createElement('div'); const title = document.createElement('strong'); title.textContent = account.name || `Conta ${index + 1}`;
    const hunt = document.createElement('small'); hunt.textContent = account.hunt || 'Sessão não iniciada';
    const stats = document.createElement('small'); stats.className = 'account-stats'; stats.textContent = account.level ? `Nível ${account.level} · ${account.gold || 0} gold · ${Number(account.metrics?.kph || 0).toLocaleString('pt-BR')} kills/h · ${Number(account.metrics?.xph || 0).toLocaleString('pt-BR')} XP/h` : 'Estado aguardando leitura';
    details.append(title, hunt, stats); name.append(avatar, details);
    const actions = document.createElement('div'); actions.className = 'account-actions';
    const status = document.createElement('span'); status.className = 'account-status'; status.textContent = statusLabels[account.status] || account.status || 'Desconectada';
    const open = document.createElement('button'); open.className = 'mini-button'; open.textContent = 'Abrir'; open.addEventListener('click', () => openAccount(account));
    const actionBar = document.createElement('div'); actionBar.className = 'account-action-bar';
    for (const [label, action] of [['Login', 'gameLogin'], ['Market', 'openMarket'], ['Depot', 'openDepot'], ['Equipe', 'team'], ['Inventário', 'inventory'], ['Operações', 'operations'], ['Retornar', 'returnToLastHunt'], ['Atualizar', 'refresh']]) {
      const button = document.createElement('button'); button.className = 'mini-button'; button.textContent = label; button.disabled = Boolean(account.actionBusy);
      button.addEventListener('click', () => action === 'refresh' ? refreshAccount(account) : action === 'gameLogin' ? openGameLogin(account) : action === 'inventory' ? openInventory(account) : action === 'team' ? openTeam(account) : action === 'operations' ? openOperations(account) : runAccountAction(account, action, action === 'returnToLastHunt' ? { slug: account.huntSlug, name: account.hunt } : {})); actionBar.append(button);
    }
    actions.append(status, open); card.append(name, actions, actionBar); return card;
  }));
  $('#emptyState').style.display = state.accounts.length ? 'none' : 'grid';
  const history = $('#historyList');
  if (!state.history.length) { history.replaceChildren(Object.assign(document.createElement('p'), { className: 'history-empty', textContent: 'Nenhuma hunt encerrada ainda.' })); return; }
  history.replaceChildren(...state.history.slice(0, 8).map((entry) => {
    const row = document.createElement('article'); row.className = 'history-row';
    const title = document.createElement('div'); title.className = 'history-title';
    const hunt = document.createElement('strong'); hunt.textContent = entry.huntName || entry.huntSlug;
    const account = document.createElement('small'); account.textContent = entry.accountName || entry.accountId;
    title.append(hunt, account);
    const stats = document.createElement('span'); stats.className = 'history-stats'; stats.textContent = `${Number(entry.kills || 0).toLocaleString('pt-BR')} kills · ${Number(entry.xp || 0).toLocaleString('pt-BR')} XP · ${entry.captures || 0} capturas · ${entry.shiny || 0} shiny`;
    const date = document.createElement('time'); date.className = 'history-date'; date.dateTime = new Date(entry.finishedAt).toISOString(); date.textContent = new Date(entry.finishedAt).toLocaleString('pt-BR');
    row.append(title, stats, date); return row;
  }));
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
function openOperations(account) { operationsAccount = account; $('#operationsAccountLabel').textContent = account.name || 'Conta selecionada'; $('#operationsError').textContent = ''; $('#operationsModal').hidden = false; $('#ballId').focus(); }
function closeOperations() { operationsAccount = null; $('#operationsModal').hidden = true; $('#operationsError').textContent = ''; }
async function openInventory(account) { inventoryAccount = account; await refreshAccount(account); $('#inventoryAccountLabel').textContent = account.name || 'Conta selecionada'; const list = $('#inventoryList'); const items = Array.isArray(account.inventory) ? account.inventory : []; list.replaceChildren(...(items.length ? items.map((item) => { const row = document.createElement('div'); row.className = 'inventory-row'; const name = document.createElement('span'); name.textContent = item.name || `Item ${item.itemId}`; const category = document.createElement('small'); category.textContent = item.category || `#${item.itemId}`; const quantity = document.createElement('strong'); quantity.textContent = String(item.quantity); row.append(name, category, quantity); return row; }) : [Object.assign(document.createElement('p'), { className: 'history-empty', textContent: 'Nenhum item encontrado.' })])); $('#inventoryModal').hidden = false; }
function renderDepot(account) { const list = $('#depotList'); const items = Array.isArray(account?.depot) ? account.depot : []; list.replaceChildren(...(items.length ? items.map((item) => { const row = document.createElement('div'); row.className = 'inventory-row'; const name = document.createElement('span'); name.textContent = item.name || `Item ${item.itemId}`; const category = document.createElement('small'); category.textContent = item.category || `#${item.itemId}`; const quantity = document.createElement('strong'); quantity.textContent = String(item.quantity); row.append(name, category, quantity); return row; }) : [Object.assign(document.createElement('p'), { className: 'history-empty', textContent: 'Nenhum item no Depot.' })])); }
function closeInventory() { inventoryAccount = null; $('#inventoryModal').hidden = true; }
async function openTeam(account) { teamAccount = account; await refreshAccount(account); $('#teamAccountLabel').textContent = account.name || 'Conta selecionada'; renderTeam(account); $('#teamModal').hidden = false; }
function renderTeam(account) { const list = $('#teamList'); const team = Array.isArray(account?.team) ? account.team : []; list.replaceChildren(...(team.length ? team.map((pokemon) => { const row = document.createElement('div'); row.className = 'team-row'; const name = document.createElement('div'); name.className = 'team-name'; const title = document.createElement('strong'); title.textContent = `${pokemon.leader ? '★ ' : ''}${pokemon.name}`; const meta = document.createElement('small'); meta.textContent = `Nv. ${pokemon.level} · IV ${pokemon.ivTotal} · Q ${pokemon.quality.toFixed(2)}`; name.append(title, meta); const hp = document.createElement('span'); hp.className = 'team-hp'; hp.textContent = `${pokemon.hp}/${pokemon.maxHp} HP${pokemon.shiny ? ' · shiny' : ''}`; row.append(name, hp); return row; }) : [Object.assign(document.createElement('p'), { className: 'history-empty', textContent: 'Nenhum Pokémon na equipe.' })])); }
function closeTeam() { teamAccount = null; $('#teamModal').hidden = true; }
$('#loadDepotButton').addEventListener('click', async () => { if (!inventoryAccount || inventoryAccount.actionBusy) return; const account = inventoryAccount; const button = $('#loadDepotButton'); button.disabled = true; $('#depotStatus').textContent = 'Lendo…'; try { const response = await window.darkGridAPI.accountAction(account.id, 'readDepot', {}); if (!response?.ok || !response.result?.ok) throw new Error(response?.reason || response?.result?.reason || 'depot_read_failed'); account.depot = Array.isArray(response.result.items) ? response.result.items : []; renderDepot(account); $('#depotStatus').textContent = `${account.depot.length} item(ns)`; } catch (cause) { $('#depotStatus').textContent = cause.message === 'game_auth_required' ? 'Login necessário' : 'Não disponível'; } finally { button.disabled = false; } });
function renderAlertSettings() { const config = state.alerts || {}; $('#alertEnabled').checked = config.enabled !== false; $('#alertOffline').checked = config.accountOffline !== false; $('#alertNoBalls').checked = config.noBalls !== false; $('#alertNoProgress').checked = config.noProgress !== false; $('#alertLowBalls').value = Number(config.lowBalls || 0); $('#alertNoProgressMinutes').value = Math.max(1, Math.round(Number(config.noProgressSeconds || 600) / 60)); }
function showAlert(alert) { if (!alert?.message) return; const toast = document.createElement('div'); toast.className = `alert-toast ${alert.severity || 'info'}`; const title = document.createElement('strong'); title.textContent = alert.type === 'watchdog' ? 'Recuperação' : 'Atenção'; const message = document.createElement('span'); message.textContent = alert.message; toast.append(title, message); $('#alertToasts').append(toast); setTimeout(() => toast.remove(), 8000); }
async function submitOperation(event, action, inputFactory) {
  event.preventDefault();
  if (!operationsAccount || operationsAccount.actionBusy) return;
  const account = operationsAccount;
  const button = event.currentTarget.querySelector('button[type="submit"]');
  button.disabled = true; $('#operationsError').textContent = '';
  account.actionBusy = true; render();
  try {
    const response = await window.darkGridAPI.accountAction(account.id, action, inputFactory());
    if (!response?.ok || !response.result?.ok) throw new Error(response?.reason || response?.result?.reason || 'operation_failed');
    account.status = 'online';
    closeOperations();
  } catch (cause) {
    $('#operationsError').textContent = `Operação não concluída: ${cause.message}`;
  } finally {
    account.actionBusy = false;
    button.disabled = false; render();
  }
}

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
  account.status = snapshot.status; account.name = snapshot.name || account.name; account.hunt = snapshot.hunt?.name || snapshot.hunt?.slug || 'Sem hunt'; account.huntSlug = snapshot.hunt?.slug || account.huntSlug || ''; account.level = snapshot.level; account.gold = snapshot.gold; account.metrics = snapshot.metrics || account.metrics || {};
}
function syncLayout() { window.darkGridAPI.setAccountLayout({ x: 250, y: 112, width: Math.max(500, window.innerWidth - 270), height: Math.max(400, window.innerHeight - 135) }); }

$('#loginButton').addEventListener('click', openAuthModal);
$('#emptyLoginButton').addEventListener('click', addAccount);
$('#manageAccountsButton').addEventListener('click', addAccount);
$('#refreshButton').addEventListener('click', render);
$('#exportHistoryButton').addEventListener('click', async () => { const result = await window.darkGridAPI.exportHuntHistory(); $('#historyExportStatus').textContent = result?.ok ? `Histórico exportado: ${result.filePath}` : result?.canceled ? '' : 'Não foi possível exportar o histórico'; });
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
$('#operationsClose').addEventListener('click', closeOperations);
$('#operationsModal').addEventListener('click', (event) => { if (event.target.id === 'operationsModal') closeOperations(); });
$('#inventoryClose').addEventListener('click', closeInventory);
$('#inventoryModal').addEventListener('click', (event) => { if (event.target.id === 'inventoryModal') closeInventory(); });
$('#teamClose').addEventListener('click', closeTeam);
$('#teamModal').addEventListener('click', (event) => { if (event.target.id === 'teamModal') closeTeam(); });
$('#alertSettingsForm').addEventListener('submit', async (event) => { event.preventDefault(); const result = await window.darkGridAPI.saveAlertConfig({ enabled: $('#alertEnabled').checked, accountOffline: $('#alertOffline').checked, noBalls: $('#alertNoBalls').checked, noProgress: $('#alertNoProgress').checked, lowBalls: Number($('#alertLowBalls').value), noProgressSeconds: Number($('#alertNoProgressMinutes').value) * 60 }); if (result?.ok) { state.alerts = result.config; $('#settingsSaved').textContent = 'Preferências salvas'; } else $('#settingsSaved').textContent = 'Não foi possível salvar'; });
$('#buyBallsForm').addEventListener('submit', (event) => submitOperation(event, 'buyBalls', () => ({ ballId: Number($('#ballId').value), quantity: Number($('#ballQuantity').value) })));
$('#sellStoneForm').addEventListener('submit', (event) => submitOperation(event, 'sellStone', () => ({ itemId: Number($('#stoneItemId').value), quantity: Number($('#stoneQuantity').value) })));
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
window.darkGridAPI.onHistoryUpdated((entry) => { if (!entry) return; state.history = [entry, ...state.history.filter((item) => item.finishedAt !== entry.finishedAt || item.accountId !== entry.accountId)].slice(0, 150); render(); });
window.darkGridAPI.onAccountAlert(showAlert);
document.querySelectorAll('.nav-item').forEach((button) => button.addEventListener('click', () => {
  document.querySelectorAll('.nav-item').forEach((item) => item.classList.remove('active'));
  button.classList.add('active');
  $('#settingsPanel').hidden = button.dataset.view !== 'settings';
  if (button.dataset.view === 'settings') { renderAlertSettings(); $('#settingsPanel').scrollIntoView({ block: 'start' }); }
}));

async function bootstrap() {
  try {
    state.auth = await window.darkGridAPI.authStatus() || { ok: false };
    setAuthStatus(state.auth);
    state.alerts = await window.darkGridAPI.loadAlertConfig();
    if (state.auth.ok) state.history = await window.darkGridAPI.loadHuntHistory();
    if (state.auth.ok) await restoreAccounts();
    else render();
  } catch { state.auth = { ok: false, reason: 'auth_required' }; setAuthStatus(state.auth); render(); }
}

bootstrap();
