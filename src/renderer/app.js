'use strict';

const state = { accounts: [], history: [], alerts: {}, credentials: {}, busy: false, auth: { ok: false } };
let compactMode = false;
let layoutMode = ['grid', 'row', 'column'].includes(localStorage.getItem('darkgrid-layout')) ? localStorage.getItem('darkgrid-layout') : 'grid';
let gameLoginAccount = null;
let operationsAccount = null;
let inventoryAccount = null;
let teamAccount = null;
let huntAccount = null;
let sidebarOpen = false;
let maximizedAccountId = null;
let protectedItemIds = (() => { try { return new Set(JSON.parse(localStorage.getItem('darkgrid-protected-items') || '[]').map(String)); } catch { return new Set(); } })();
let protectAccount = null;
const panelZooms = Object.assign({}, (() => { try { return JSON.parse(localStorage.getItem('darkgrid-panel-zooms') || '{}'); } catch { return {}; } })());
const $ = (selector) => document.querySelector(selector);
const statusLabels = { loading: 'Carregando jogo', login_required: 'Login necessário', online: 'Online', stale: 'Sem atividade recente', offline: 'Offline', error: 'Erro no painel', opened: 'Painel aberto', closed: 'Painel oculto' };
const actionIcons = { gameLogin: '▶', hunt: '🎯', openMarket: '🛒', openDepot: '🗄', team: '👥', iv: '◉', scripts: '🧩', inventory: '🎒', operations: '⚙', returnToLastHunt: '↩', refresh: '⟳' };
const PANEL_GAME_Y = 90;
const PANEL_HEADER_HEIGHT = 34;
function panelGeometry(index, count = state.accounts.length) {
  const availableX = sidebarOpen ? 340 : 0;
  const availableWidth = Math.max(300, window.innerWidth - availableX);
  const availableHeight = Math.max(240, window.innerHeight - PANEL_GAME_Y);
  const columns = maximizedAccountId ? 1 : layoutMode === 'row' ? Math.max(1, count) : layoutMode === 'column' ? 1 : count <= 1 ? 1 : 2;
  const rows = maximizedAccountId ? 1 : Math.max(1, Math.ceil(count / columns));
  const gap = 6;
  const width = maximizedAccountId ? availableWidth : Math.max(240, Math.floor((availableWidth - gap * (columns - 1)) / columns));
  const height = maximizedAccountId ? availableHeight : Math.max(180, Math.floor((availableHeight - gap * (rows - 1) - PANEL_HEADER_HEIGHT * (rows - 1)) / rows));
  const position = maximizedAccountId ? 0 : index;
  const row = Math.floor(position / columns);
  return { x: availableX + (position % columns) * (width + gap), y: PANEL_GAME_Y + row * (height + gap + PANEL_HEADER_HEIGHT), width, height, headerY: PANEL_GAME_Y - PANEL_HEADER_HEIGHT + row * (height + gap + PANEL_HEADER_HEIGHT) };
}
function positionPanelHeaders() {
  const cards = [...document.querySelectorAll('#accountsGrid .classic-panel')];
  cards.forEach((card, index) => { const account = state.accounts[index]; const hidden = maximizedAccountId && account?.id !== maximizedAccountId; const box = panelGeometry(index); card.style.display = hidden ? 'none' : ''; card.style.left = `${box.x}px`; card.style.top = `${box.headerY}px`; card.style.width = `${box.width}px`; card.style.height = `${PANEL_HEADER_HEIGHT}px`; });
}
const GAME_ORIGIN = 'https://poke.idleworld.online';
function gameIconUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try { const url = new URL(raw, GAME_ORIGIN); return url.origin === GAME_ORIGIN ? url.href : ''; } catch { return ''; }
}
function gameIcon(value, alt = '') {
  const src = gameIconUrl(value);
  if (!src) return null;
  const image = document.createElement('img'); image.className = 'game-icon'; image.src = src; image.alt = alt; image.loading = 'lazy'; image.addEventListener('error', () => image.remove()); return image;
}
function setGameViewsVisible(visible) { return window.darkGridAPI.setAccountsVisible(Boolean(visible) && !compactMode); }
function showUiOverlay() { setGameViewsVisible(false); }
function restoreGameViews() { setGameViewsVisible(true); }
async function buy1000Balls(account, button) {
  if (!account || account.actionBusy) return;
  account.actionBusy = true; button.disabled = true; button.textContent = '…'; render();
  try {
    const response = await window.darkGridAPI.accountAction(account.id, 'buyBalls', { ballId: 1, quantity: 1000 });
    if (!response?.ok || !response.result?.ok) throw new Error(response?.reason || response?.result?.reason || 'purchase_failed');
    await refreshAccount(account);
  } catch (cause) { account.error = cause.message; account.status = cause.message === 'game_auth_required' ? 'login_required' : 'error'; }
  finally { account.actionBusy = false; render(); }
}
async function maximizeAccount(account) {
  if (!account) return;
  compactMode = false; document.body.classList.remove('compact-mode'); $('#compactButton').setAttribute('aria-pressed', 'false'); $('#compactButton').textContent = '🃏 Cartas';
  maximizedAccountId = maximizedAccountId === account.id ? null : account.id;
  await window.darkGridAPI.setAccountMaximized(maximizedAccountId);
  await window.darkGridAPI.setAccountsVisible(true);
  await window.darkGridAPI.openAccount(account.id);
  syncLayout();
}
async function openMarketAndMaximize(account) {
  await runAccountAction(account, 'openMarket');
  if (account.status === 'online') await maximizeAccount(account);
}

function render() {
  document.body.classList.add('panels-active');
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
    const card = document.createElement('article'); card.className = 'account-card classic-panel';
    const name = document.createElement('div'); name.className = 'account-name';
    const avatar = gameIcon((account.inventory || []).find((item) => item.icon)?.icon, account.name || `Conta ${index + 1}`) || document.createElement('span');
    if (avatar.tagName === 'SPAN') { avatar.className = 'account-avatar'; avatar.textContent = String(index + 1); }
    const details = document.createElement('div'); const title = document.createElement('strong'); title.textContent = account.name || `Conta ${index + 1}`;
    const hunt = document.createElement('small'); hunt.textContent = account.hunt || 'Sessão não iniciada';
    const stats = document.createElement('small'); stats.className = 'account-stats'; stats.textContent = account.level ? `Nível ${account.level} · ${account.gold || 0} gold · ${Number(account.metrics?.kph || 0).toLocaleString('pt-BR')} kills/h · ${Number(account.metrics?.xph || 0).toLocaleString('pt-BR')} XP/h` : 'Estado aguardando leitura';
    details.append(title, hunt, stats); name.append(avatar, details);
    const actions = document.createElement('div'); actions.className = 'account-actions';
    const status = document.createElement('span'); status.className = 'account-status'; status.textContent = statusLabels[account.status] || account.status || 'Desconectada';
    const open = document.createElement('button'); open.className = 'mini-button'; open.textContent = '⛶ Abrir'; open.title = 'Abrir painel'; open.addEventListener('click', () => openAccount(account));
    const remove = document.createElement('button'); remove.className = 'mini-button danger-button'; remove.textContent = '✕ Remover'; remove.title = 'Remover painel'; remove.disabled = Boolean(account.actionBusy); remove.addEventListener('click', () => removeAccount(account));
    const actionBar = document.createElement('div'); actionBar.className = 'account-action-bar';
    for (const [label, action] of [['Login', 'gameLogin'], ['Hunt', 'hunt'], ['Market', 'openMarket'], ['Depot', 'openDepot'], ['Equipe', 'team'], ['IV', 'iv'], ['Scripts', 'scripts'], ['Inventário', 'inventory'], ['Operações', 'operations'], ['Retornar', 'returnToLastHunt'], ['Atualizar', 'refresh']]) {
      const button = document.createElement('button'); button.className = 'mini-button panel-action'; button.textContent = `${actionIcons[action] || '•'} ${label}`; button.title = label; button.disabled = Boolean(account.actionBusy);
      button.addEventListener('click', () => action === 'refresh' ? refreshAccount(account) : action === 'gameLogin' ? openGameLogin(account) : action === 'inventory' ? openInventory(account) : action === 'team' ? openTeam(account) : action === 'iv' ? openIv(account) : action === 'scripts' ? openScripts(account) : action === 'hunt' ? openHunt(account) : action === 'operations' ? openOperations(account) : action === 'openMarket' ? openMarketAndMaximize(account) : runAccountAction(account, action, action === 'returnToLastHunt' ? { slug: account.huntSlug, name: account.hunt } : {})); actionBar.append(button);
    }
    const buy = document.createElement('button'); buy.className = 'mini-button buy-button'; buy.textContent = '◉ +1000'; buy.title = 'Comprar 1000 Pokébolas'; buy.disabled = Boolean(account.actionBusy); buy.addEventListener('click', () => buy1000Balls(account, buy));
    const balls = document.createElement('span'); balls.className = 'ball-count'; balls.textContent = `◉ ${Number(account.balls || 0).toLocaleString('pt-BR')}`; balls.title = 'Pokébolas disponíveis';
    const zoomOut = document.createElement('button'); zoomOut.className = 'mini-button panel-control'; zoomOut.textContent = '−'; zoomOut.title = 'Reduzir interface'; zoomOut.addEventListener('click', () => changePanelZoom(account, -0.05));
    const zoomLabel = document.createElement('span'); zoomLabel.className = 'panel-zoom-label'; zoomLabel.textContent = `${Math.round(Number(panelZooms[account.id] || 1) * 100)}%`;
    const zoomIn = document.createElement('button'); zoomIn.className = 'mini-button panel-control'; zoomIn.textContent = '+'; zoomIn.title = 'Aumentar interface'; zoomIn.addEventListener('click', () => changePanelZoom(account, 0.05));
    const reload = document.createElement('button'); reload.className = 'mini-button panel-control'; reload.textContent = '↻'; reload.title = 'Recarregar jogo'; reload.addEventListener('click', () => reloadPanel(account));
    const maximize = document.createElement('button'); maximize.className = 'mini-button panel-control'; maximize.textContent = maximizedAccountId === account.id ? '↙' : '⛶'; maximize.title = 'Maximizar/minimizar painel'; maximize.addEventListener('click', () => maximizeAccount(account));
    actions.append(status, balls, buy, zoomOut, zoomLabel, zoomIn, reload, maximize, open, remove); card.append(name, actions, actionBar); return card;
  }));
  positionPanelHeaders();
  renderSimpleDashboard();
  $('#emptyState').style.display = state.accounts.length ? 'none' : 'grid';
  const history = $('#historyList');
  if (!state.history.length) { history.replaceChildren(Object.assign(document.createElement('p'), { className: 'history-empty', textContent: 'Nenhuma hunt encerrada ainda.' })); return; }
  history.replaceChildren(...state.history.slice(0, 8).map((entry) => {
    const row = document.createElement('article'); row.className = 'history-row';
    const title = document.createElement('div'); title.className = 'history-title';
    const hunt = document.createElement('strong'); hunt.textContent = entry.huntName || entry.huntSlug;
    const account = document.createElement('small'); account.textContent = entry.accountName || entry.accountId;
    title.append(hunt, account);
    const stats = document.createElement('span'); stats.className = 'history-stats'; stats.textContent = `${Number(entry.kills || 0).toLocaleString('pt-BR')} kills · ${Number(entry.xp || 0).toLocaleString('pt-BR')} XP · ${entry.captures || 0} capturas · ${entry.shiny || 0} shiny${entry.gph ? ` · ${Number(entry.gph).toLocaleString('pt-BR')} gold/h` : ''}`;
    const date = document.createElement('time'); date.className = 'history-date'; date.dateTime = new Date(entry.finishedAt).toISOString(); date.textContent = new Date(entry.finishedAt).toLocaleString('pt-BR');
    row.append(title, stats, date); return row;
  }));
}

function renderSimpleDashboard() {
  const accounts = state.accounts;
  const total = accounts.reduce((out, account) => { const metrics = account.metrics || {}; out.gold += Number(metrics.gph || 0); out.xp += Number(metrics.xph || 0); out.kills += Number(metrics.kph || 0); out.captures += Number(metrics.captures || 0); out.shiny += Number(metrics.shiny || 0); return out; }, { gold: 0, xp: 0, kills: 0, captures: 0, shiny: 0 });
  const kpis = [['+Gold/h líquido', total.gold.toLocaleString('pt-BR'), 'gold'], ['XP/h total', total.xp.toLocaleString('pt-BR'), 'blue'], ['Kills/h', total.kills.toLocaleString('pt-BR'), ''], ['Capturas (sessão)', total.captures.toLocaleString('pt-BR'), ''], ['Shiny enc/cap', `${total.shiny} / 0`, 'pink'], ['Contas ativas', `${accounts.filter((account) => account.status === 'online' || account.status === 'stale').length} / 4`, 'green']];
  $('#simpleKpis').replaceChildren(...kpis.map(([label, value, tone]) => { const item = document.createElement('div'); item.className = `simple-kpi ${tone}`; const strong = document.createElement('strong'); strong.textContent = value; const small = document.createElement('small'); small.textContent = label; item.append(strong, small); return item; }));
  const today = $('#simpleToday'); today.replaceChildren(...[['GOLD', total.gold], ['XP', total.xp], ['KILLS', total.kills], ['CAPTURAS', total.captures], ['SHINY ENC/CAP', `${total.shiny} / 0`]].map(([label, value]) => { const item = document.createElement('div'); item.className = 'simple-today-card'; const strong = document.createElement('strong'); strong.textContent = typeof value === 'number' ? value.toLocaleString('pt-BR') : value; const small = document.createElement('small'); small.textContent = label; item.append(strong, small); return item; }));
  $('#simpleAccounts').replaceChildren(...accounts.map((account) => { const row = document.createElement('tr'); row.addEventListener('click', () => openAccount(account)); const name = document.createElement('td'); name.textContent = account.name || account.label || 'Conta'; const pokemon = document.createElement('td'); pokemon.textContent = account.team?.[0]?.name || '—'; pokemon.addEventListener('mouseenter', (event) => showIvHover(account, event)); pokemon.addEventListener('mousemove', (event) => positionIvHover(event)); pokemon.addEventListener('mouseleave', hideIvHover); const hunt = document.createElement('td'); hunt.textContent = account.hunt || 'Sem hunt'; const metrics = account.metrics || {}; for (const value of [metrics.gph, metrics.xph, metrics.kph, metrics.captures]) { const cell = document.createElement('td'); cell.textContent = Number(value || 0).toLocaleString('pt-BR'); row.append(cell); } const status = document.createElement('td'); status.textContent = statusLabels[account.status] || account.status || 'Aguardando'; row.prepend(name, pokemon, hunt); row.append(status); return row; }));
}

function showIvHover(account, event) { const pokemon = account.team?.[0]; if (!pokemon) return; const card = $('#ivHoverCard'); const stats = pokemon.ivs || {}; card.replaceChildren(); const title = document.createElement('strong'); title.textContent = `${pokemon.name || 'Pokémon'} · Nv. ${pokemon.level || 0}`; const meta = document.createElement('small'); meta.textContent = `IV total ${pokemon.ivTotal || 0}/192 · Qualidade ${Number(pokemon.quality || 0).toFixed(2)}`; const grid = document.createElement('div'); grid.className = 'iv-hover-grid'; for (const key of ['hp', 'atk', 'def', 'spa', 'spd', 'speed']) { const item = document.createElement('span'); item.textContent = `${key.toUpperCase()} ${Number(stats[key] || 0).toFixed(1)}/32`; grid.append(item); } card.append(title, meta, grid); card.hidden = false; positionIvHover(event); }
function positionIvHover(event) { const card = $('#ivHoverCard'); if (card.hidden) return; card.style.left = `${Math.min(window.innerWidth - card.offsetWidth - 12, event.clientX + 14)}px`; card.style.top = `${Math.min(window.innerHeight - card.offsetHeight - 12, event.clientY + 14)}px`; }
function hideIvHover() { $('#ivHoverCard').hidden = true; }

function setAuthStatus(status) {
  const label = $('#licenseLabel');
  $('#logoutButton').hidden = !status?.ok || status?.bypass === true;
  if (status?.bypass) { label.textContent = 'Login desativado'; label.className = 'license-badge active'; return; }
  if (!status?.ok) { label.textContent = status?.reason === 'auth_server_not_configured' ? 'Servidor não configurado' : 'Licença não verificada'; label.className = 'license-badge'; return; }
  label.textContent = status.offlineGrace ? 'Licença offline · grace' : status.offline ? 'Licença offline' : `Plano ${status.plan || 'ativo'}`;
  label.className = 'license-badge active';
}

function openAuthModal() { showUiOverlay(); $('#authModal').hidden = false; $('#authEmail').focus(); }
function closeAuthModal() { $('#authModal').hidden = true; $('#authError').textContent = ''; restoreGameViews(); }
async function openGameLogin(account) { showUiOverlay(); gameLoginAccount = account; const saved = state.credentials[account.id] || {}; $('#gameUsername').value = saved.username || ''; $('#gamePassword').value = saved.password || ''; $('#rememberGameCredentials').checked = true; await window.darkGridAPI.openAccount(account.id); syncLayout(); $('#gameLoginModal').hidden = false; $('#gameUsername').focus(); }
function closeGameLogin() { gameLoginAccount = null; $('#gameLoginModal').hidden = true; $('#gameUsername').value = ''; $('#gamePassword').value = ''; $('#rememberGameCredentials').checked = true; $('#gameLoginError').textContent = ''; restoreGameViews(); }
async function openOperations(account) { showUiOverlay(); operationsAccount = account; $('#operationsAccountLabel').textContent = account.name || 'Conta selecionada'; $('#operationsError').textContent = ''; $('#pokemonStatus').textContent = 'Carregando Pokémon…'; const catalog = Array.isArray(account.ballCatalog) && account.ballCatalog.length ? account.ballCatalog : [{ id: 1, name: 'Pokébola' }, { id: 2, name: 'Great Ball' }, { id: 3, name: 'Ultra Ball' }, { id: 4, name: 'Master Ball' }, { id: 5, name: 'Premier Ball' }]; $('#ballId').replaceChildren(...catalog.map((ball) => { const option = document.createElement('option'); option.value = String(ball.id); option.textContent = ball.name || `Pokébola #${ball.id}`; return option; })); $('#operationsModal').hidden = false; $('#ballId').focus(); try { const response = await window.darkGridAPI.accountAction(account.id, 'readPokemon', {}); if (response?.ok && response.result?.ok) { account.pokemon = Array.isArray(response.result.items) ? response.result.items : []; $('#pokemonStatus').textContent = `${account.pokemon.length} Pokémon lido(s)`; } else $('#pokemonStatus').textContent = 'Lista de Pokémon indisponível'; } catch { $('#pokemonStatus').textContent = 'Lista de Pokémon indisponível'; } }
function closeOperations() { operationsAccount = null; $('#operationsModal').hidden = true; $('#operationsError').textContent = ''; restoreGameViews(); }
function renderProtectedItems() {
  if (!protectAccount) return;
  const filter = String($('#protectFilter').value || '').toLowerCase();
  const items = (Array.isArray(protectAccount.inventory) ? protectAccount.inventory : []).filter((item) => !filter || String(item.name || item.itemId).toLowerCase().includes(filter));
  $('#protectList').replaceChildren(...(items.length ? items.map((item) => { const id = String(item.itemId); const label = document.createElement('label'); label.className = 'protect-item'; const input = document.createElement('input'); input.type = 'checkbox'; input.dataset.itemId = id; input.checked = protectedItemIds.has(`${protectAccount.id}:${id}`) || protectedItemIds.has(id); const icon = gameIcon(item.icon, item.name || ''); const name = document.createElement('span'); name.textContent = item.name || `Item ${id}`; const qty = document.createElement('small'); qty.textContent = `×${Number(item.quantity || 0).toLocaleString('pt-BR')}`; label.append(input); if (icon) label.append(icon); label.append(name, qty); return label; }) : [Object.assign(document.createElement('p'), { className: 'history-empty', textContent: 'Nenhum item carregado nesta conta.' })]));
  $('#protectStatus').textContent = `${items.length} item(ns) exibido(s) · seleção salva por conta`;
}
async function openProtectedItems(account) { showUiOverlay(); protectAccount = account; await refreshAccount(account); const select = $('#protectAccount'); select.replaceChildren(...state.accounts.map((item) => { const option = document.createElement('option'); option.value = item.id; option.textContent = item.name || item.label || item.id; return option; })); select.value = account.id; $('#protectFilter').value = ''; $('#protectModal').hidden = false; renderProtectedItems(); }
function closeProtectedItems() { protectAccount = null; $('#protectModal').hidden = true; $('#protectFilter').value = ''; restoreGameViews(); }
function saveProtectedItems() { if (!protectAccount) return; const prefix = `${protectAccount.id}:`; for (const id of [...protectedItemIds]) if (id.startsWith(prefix)) protectedItemIds.delete(id); document.querySelectorAll('#protectList input[data-item-id]:checked').forEach((input) => protectedItemIds.add(`${prefix}${input.dataset.itemId}`)); localStorage.setItem('darkgrid-protected-items', JSON.stringify([...protectedItemIds])); $('#protectStatus').textContent = 'Proteção salva neste computador.'; }
async function protectedSale(kind, button) { if (!operationsAccount || operationsAccount.actionBusy) return; const account = operationsAccount; const source = kind === 'items' ? account.inventory : account.pokemon; const previewAction = kind === 'items' ? 'previewSellItems' : 'previewSellPokemon'; const saleAction = kind === 'items' ? 'sellItems' : 'sellPokemon'; const input = kind === 'items' ? { items: Array.isArray(source) ? source : [], protectedIds: [...protectedItemIds].filter((id) => id.startsWith(`${account.id}:`)).map((id) => id.slice(account.id.length + 1)) } : { pokemon: Array.isArray(source) ? source : [] }; button.disabled = true; account.actionBusy = true; $('#operationsError').textContent = ''; try { const preview = await window.darkGridAPI.accountAction(account.id, previewAction, input); if (!preview?.ok || !preview.result?.ok) throw new Error(preview?.reason || 'preview_failed'); const count = kind === 'items' ? preview.result.items.length : preview.result.pokeIds.length; if (!count) throw new Error('nenhum_item_permitido'); const label = kind === 'items' ? `${count} tipo(s) de item permitido(s)` : `${count} Pokémon permitido(s)`; if (!window.confirm(`${label} serão vendidos. Itens raros e Pokémon protegidos permanecem bloqueados. Continuar?`)) return; const result = await window.darkGridAPI.accountAction(account.id, saleAction, input); if (!result?.ok || !result.result?.ok) throw new Error(result?.reason || result?.result?.reason || 'sale_failed'); account.status = 'online'; $('#operationsError').textContent = 'Venda concluída'; } catch (cause) { $('#operationsError').textContent = cause.message === 'nenhum_item_permitido' ? 'Nenhum item permitido para vender.' : `Venda não concluída: ${cause.message}`; } finally { account.actionBusy = false; button.disabled = false; render(); } }
async function openInventory(account) { showUiOverlay(); inventoryAccount = account; await refreshAccount(account); $('#inventoryAccountLabel').textContent = account.name || 'Conta selecionada'; const list = $('#inventoryList'); const items = Array.isArray(account.inventory) ? account.inventory : []; list.replaceChildren(...(items.length ? items.map((item) => { const row = document.createElement('div'); row.className = 'inventory-row'; const icon = gameIcon(item.icon, item.name || ''); const name = document.createElement('span'); name.className = 'inventory-name'; if (icon) name.append(icon); name.append(document.createTextNode(item.name || `Item ${item.itemId}`)); const category = document.createElement('small'); category.textContent = item.category || `#${item.itemId}`; const quantity = document.createElement('strong'); quantity.textContent = String(item.quantity); row.append(name, category, quantity); return row; }) : [Object.assign(document.createElement('p'), { className: 'history-empty', textContent: 'Nenhum item encontrado.' })])); $('#inventoryModal').hidden = false; }
function renderDepot(account) { const list = $('#depotList'); const items = Array.isArray(account?.depot) ? account.depot : []; list.replaceChildren(...(items.length ? items.map((item) => { const row = document.createElement('div'); row.className = 'inventory-row'; const name = document.createElement('span'); name.textContent = item.name || `Item ${item.itemId}`; const category = document.createElement('small'); category.textContent = item.category || `#${item.itemId}`; const quantity = document.createElement('strong'); quantity.textContent = String(item.quantity); row.append(name, category, quantity); return row; }) : [Object.assign(document.createElement('p'), { className: 'history-empty', textContent: 'Nenhum item no Depot.' })])); }
function closeInventory() { inventoryAccount = null; $('#inventoryModal').hidden = true; restoreGameViews(); }
async function openTeam(account) { showUiOverlay(); teamAccount = account; await refreshAccount(account); $('#teamAccountLabel').textContent = account.name || 'Conta selecionada'; renderTeam(account); $('#teamModal').hidden = false; }
function renderTeam(account) { const list = $('#teamList'); const team = Array.isArray(account?.team) ? account.team : []; list.replaceChildren(...(team.length ? team.map((pokemon) => { const row = document.createElement('div'); row.className = 'team-row'; const name = document.createElement('div'); name.className = 'team-name'; const title = document.createElement('strong'); title.textContent = `${pokemon.leader ? '★ ' : ''}${pokemon.name}`; const meta = document.createElement('small'); meta.textContent = `Nv. ${pokemon.level} · IV ${pokemon.ivTotal} · Q ${pokemon.quality.toFixed(2)}`; name.append(title, meta); const hp = document.createElement('span'); hp.className = 'team-hp'; hp.textContent = `${pokemon.hp}/${pokemon.maxHp} HP${pokemon.shiny ? ' · shiny' : ''}`; row.append(name, hp); return row; }) : [Object.assign(document.createElement('p'), { className: 'history-empty', textContent: 'Nenhum Pokémon na equipe.' })])); }
function closeTeam() { teamAccount = null; $('#teamModal').hidden = true; restoreGameViews(); }
let ivAccount = null;
let scriptAccount = null;
function fillIvFields(pokemon = {}) {
  $('#ivLevel').value = Number(pokemon.level || ivAccount?.level || 1);
  $('#ivQuality').value = Number(pokemon.quality || 1);
  $('#ivTotal').value = Number(pokemon.ivTotal || 96);
  document.querySelectorAll('[data-iv]').forEach((input) => { input.value = Number.isFinite(Number(pokemon.ivs?.[input.dataset.iv])) ? pokemon.ivs[input.dataset.iv] : ''; });
  document.querySelectorAll('[data-base]').forEach((input) => { input.value = Number.isFinite(Number(pokemon.baseStats?.[input.dataset.base])) ? pokemon.baseStats[input.dataset.base] : ''; });
}
async function openIv(account) {
  showUiOverlay();
  ivAccount = account;
  await refreshAccount(account);
  try {
    const catalogResponse = await window.darkGridAPI.accountAction(account.id, 'readHunts', {});
    const creatures = catalogResponse?.ok && catalogResponse.result?.ok && Array.isArray(catalogResponse.result.creatures) ? catalogResponse.result.creatures : [];
    const normalize = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    for (const pokemon of account.team || []) {
      const wanted = normalize(pokemon.name);
      const creature = creatures.find((item) => normalize(item.name) === wanted || normalize(item.name).endsWith(wanted) || wanted.endsWith(normalize(item.name)));
      if (creature?.baseStats) pokemon.baseStats = creature.baseStats;
    }
  } catch {}
  $('#ivAccountLabel').textContent = `${account.name || 'Conta'} · stats base carregados do catálogo quando disponíveis`;
  const select = $('#ivPokemon');
  const team = Array.isArray(account.team) ? account.team : [];
  select.replaceChildren(...(team.length ? team.map((pokemon, index) => { const option = document.createElement('option'); option.value = String(index); option.textContent = pokemon.name || `Pokémon ${index + 1}`; return option; }) : [Object.assign(document.createElement('option'), { value: '-1', textContent: 'Entrada manual' })]));
  fillIvFields(team[0] || {});
  $('#ivResult').replaceChildren(); $('#ivError').textContent = ''; $('#ivModal').hidden = false;
}
function closeIv() { ivAccount = null; $('#ivModal').hidden = true; $('#ivError').textContent = ''; restoreGameViews(); }
function renderIvResult(result) {
  const items = [['Fonte', result.ivSource || 'desconhecida'], ['Poder', result.power == null ? '—' : Number(result.power).toLocaleString('pt-BR')], ...Object.entries(result.stats || {}).map(([key, value]) => [key.toUpperCase(), value == null ? '—' : Number(value).toLocaleString('pt-BR')])];
  $('#ivResult').replaceChildren(...items.map(([label, value]) => { const item = document.createElement('div'); item.className = 'analyzer-kpi'; const title = document.createElement('span'); title.textContent = label; const number = document.createElement('strong'); number.textContent = String(value); item.append(title, number); return item; }));
}
function openScripts(account) {
  showUiOverlay();
  scriptAccount = account;
  const select = $('#scriptAccount');
  select.replaceChildren(...state.accounts.map((item) => { const option = document.createElement('option'); option.value = item.id; option.textContent = item.name || item.label || item.id; return option; }));
  select.value = account.id;
  $('#userScriptEditor').value = localStorage.getItem('darkgrid-user-script') || 'return { ok: true };';
  $('#scriptsError').textContent = ''; $('#scriptsStatus').textContent = ''; $('#scriptsModal').hidden = false;
}
function closeScripts() { scriptAccount = null; $('#scriptsModal').hidden = true; $('#scriptsError').textContent = ''; restoreGameViews(); }
async function openHunt(account) { showUiOverlay(); huntAccount = account; $('#huntAccountLabel').textContent = account.name || 'Conta selecionada'; $('#huntSlug').value = account.huntSlug || ''; $('#huntName').value = account.hunt || ''; $('#huntError').textContent = ''; $('#huntStatus').textContent = 'Carregando catálogo…'; $('#huntModal').hidden = false; try { const response = await window.darkGridAPI.accountAction(account.id, 'readHunts', {}); const hunts = response?.ok && response.result?.ok && Array.isArray(response.result.hunts) ? response.result.hunts : []; $('#huntOptions').replaceChildren(...hunts.map((hunt) => { const option = document.createElement('option'); option.value = hunt.slug; option.label = hunt.level ? `${hunt.name} · Nv. ${hunt.level}` : hunt.name; return option; })); $('#huntStatus').textContent = hunts.length ? `${hunts.length} hunts disponíveis` : 'Catálogo indisponível; use o slug manualmente'; } catch { $('#huntStatus').textContent = 'Catálogo indisponível; use o slug manualmente'; } $('#huntSlug').focus(); }
function closeHunt() { huntAccount = null; $('#huntModal').hidden = true; $('#huntError').textContent = ''; restoreGameViews(); }
async function openTierlist(account = state.accounts.find((item) => item.status === 'online' || item.status === 'stale') || state.accounts[0]) { showUiOverlay(); $('#tierlistModal').hidden = false; $('#tierlistList').replaceChildren(Object.assign(document.createElement('p'), { className: 'history-empty', textContent: 'Carregando catálogo e cálculo…' })); if (!account) { $('#tierlistStatus').textContent = 'Conecte uma conta para carregar os dados do jogo.'; return; } $('#tierlistStatus').textContent = `Analisando com os dados de ${account.name || 'conta selecionada'}…`; try { const catalogResponse = await window.darkGridAPI.accountAction(account.id, 'readHunts', {}); if (!catalogResponse?.ok || !catalogResponse.result?.ok) throw new Error(catalogResponse?.reason || catalogResponse?.result?.reason || 'catalog_unavailable'); const result = await window.darkGridAPI.calculateTierlist(catalogResponse.result, account.level || 0); if (!result?.ok) throw new Error(result?.reason || 'tierlist_failed'); const rows = Array.isArray(result.rows) ? result.rows.slice(0, 60) : []; $('#tierlistStatus').textContent = rows.length ? `${rows.length} espécies analisadas · nível ${account.level || 'por hunt'}` : 'Dados insuficientes para calcular a tierlist.'; $('#tierlistList').replaceChildren(...(rows.length ? rows.map((row, index) => { const element = document.createElement('article'); element.className = 'tierlist-row'; const rank = document.createElement('span'); rank.className = 'tierlist-rank'; rank.textContent = `${index + 1}.`; const info = document.createElement('div'); info.className = 'tierlist-name'; const name = document.createElement('strong'); name.textContent = row.baseName || row.name; const detail = document.createElement('small'); detail.textContent = `${row.types.join('/')} · ${row.move?.name || 'sem golpe'} · melhor em ${row.hunt?.name || '—'}`; info.append(name, detail); const score = document.createElement('strong'); score.className = 'tierlist-score'; score.textContent = `${Math.round(row.score).toLocaleString('pt-BR')} XP/h*`; element.append(rank, info, score); return element; }) : [Object.assign(document.createElement('p'), { className: 'history-empty', textContent: 'Nenhuma linha disponível.' })])); } catch (cause) { $('#tierlistStatus').textContent = `Não foi possível calcular: ${cause.message}`; } }
function closeTierlist() { $('#tierlistModal').hidden = true; restoreGameViews(); }
async function openAnalyzer(account = state.accounts.find((item) => item.status === 'online' || item.status === 'stale') || state.accounts[0]) { showUiOverlay(); $('#analyzerModal').hidden = false; $('#analyzerGrid').replaceChildren(); $('#analyzerDrops').replaceChildren(Object.assign(document.createElement('p'), { className: 'history-empty', textContent: 'Lendo sessão…' })); if (!account) { $('#analyzerStatus').textContent = 'Conecte uma conta para ler o Hunt Analyzer.'; return; } try { await refreshAccount(account); const metrics = account.metrics || {}; const analyzer = account.analyzer; $('#analyzerStatus').textContent = `${account.name || 'Conta'} · ${account.hunt || 'sem hunt'} · ${analyzer?.serverBacked ? 'dados confirmados pelo servidor' : 'estimativa local'}`; const values = [['Kills/h', Number(metrics.kph || 0).toLocaleString('pt-BR')], ['XP/h', Number(metrics.xph || 0).toLocaleString('pt-BR')], ['Gold/h', Number(metrics.gph || 0).toLocaleString('pt-BR')], ['Saldo', Number(metrics.balance || 0).toLocaleString('pt-BR')], ['Capturas', Number(metrics.captures || 0).toLocaleString('pt-BR')], ['Pokébolas', Number(metrics.ballsUsed || 0).toLocaleString('pt-BR')]]; $('#analyzerGrid').replaceChildren(...values.map(([label, value]) => { const item = document.createElement('div'); item.className = 'analyzer-kpi'; const title = document.createElement('span'); title.textContent = label; const number = document.createElement('strong'); number.textContent = value; item.append(title, number); return item; })); const drops = Array.isArray(analyzer?.drops) ? analyzer.drops : Array.isArray(account.drops) ? account.drops : []; $('#analyzerDrops').replaceChildren(...(drops.length ? drops.slice(0, 20).map((drop) => { const row = document.createElement('div'); row.className = 'inventory-row'; const name = document.createElement('span'); name.textContent = drop.name; const quantity = document.createElement('strong'); quantity.textContent = String(drop.qty || 0); const gold = document.createElement('small'); gold.textContent = `${Number(drop.gold || 0).toLocaleString('pt-BR')} gold`; row.append(name, gold, quantity); return row; }) : [Object.assign(document.createElement('p'), { className: 'history-empty', textContent: 'Nenhum drop registrado.' })])); } catch (cause) { $('#analyzerStatus').textContent = `Não foi possível ler: ${cause.message}`; } }
function closeAnalyzer() { $('#analyzerModal').hidden = true; restoreGameViews(); }
$('#loadDepotButton').addEventListener('click', async () => { if (!inventoryAccount || inventoryAccount.actionBusy) return; const account = inventoryAccount; const button = $('#loadDepotButton'); button.disabled = true; $('#depotStatus').textContent = 'Lendo…'; try { const response = await window.darkGridAPI.accountAction(account.id, 'readDepot', {}); if (!response?.ok || !response.result?.ok) throw new Error(response?.reason || response?.result?.reason || 'depot_read_failed'); account.depot = Array.isArray(response.result.items) ? response.result.items : []; renderDepot(account); $('#depotStatus').textContent = `${account.depot.length} item(ns)`; } catch (cause) { $('#depotStatus').textContent = cause.message === 'game_auth_required' ? 'Login necessário' : 'Não disponível'; } finally { button.disabled = false; } });
async function renderAlertSettings() { const config = state.alerts || {}; const autoStart = await window.darkGridAPI.getAutoStart(); const discord = await window.darkGridAPI.getDiscordStatus(); $('#startWithWindows').checked = autoStart?.enabled === true; $('#startWithWindows').disabled = autoStart?.supported === false; $('#alertEnabled').checked = config.enabled !== false; $('#alertNativeNotifications').checked = config.nativeNotifications !== false; $('#alertOffline').checked = config.accountOffline !== false; $('#alertNoBalls').checked = config.noBalls !== false; $('#alertNoProgress').checked = config.noProgress !== false; $('#alertDiscordNotifications').checked = config.discordNotifications === true; $('#alertLowBalls').value = Number(config.lowBalls || 0); $('#alertNoProgressMinutes').value = Math.max(1, Math.round(Number(config.noProgressSeconds || 600) / 60)); $('#discordWebhookUrl').value = ''; $('#discordWebhookStatus').textContent = discord?.configured ? 'Webhook configurado (URL protegida)' : 'Não configurado'; }
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

function openTrainers() {
  showUiOverlay();
  const list = $('#trainersList');
  const rows = [...state.accounts];
  while (rows.length < 4) rows.push({ id: '', slot: rows.length, name: '', label: '', username: '', password: '' });
  list.replaceChildren(...rows.map((account, index) => {
    const row = document.createElement('div'); row.className = 'trainer-row'; row.dataset.slot = String(index); row.dataset.id = account.id || '';
    for (const [key, placeholder, type] of [['name', `Treinador ${index + 1}`, 'text'], ['username', 'E-mail ou usuário', 'text'], ['password', 'Senha', 'password']]) {
      const input = document.createElement('input'); input.dataset.field = key; input.type = type; input.placeholder = placeholder; input.value = key === 'name' ? (account.name || account.label || '') : key === 'username' ? (state.credentials[account.id]?.username || '') : (state.credentials[account.id]?.password || ''); input.autocomplete = key === 'password' ? 'current-password' : 'off'; row.append(input);
    }
    const remove = document.createElement('button'); remove.className = 'mini-button danger-button'; remove.type = 'button'; remove.textContent = '✕'; remove.title = 'Limpar treinador'; remove.addEventListener('click', () => row.querySelectorAll('input').forEach((input) => { input.value = ''; })); row.append(remove); return row;
  }));
  $('#trainersStatus').textContent = ''; $('#trainersModal').hidden = false;
}
function closeTrainers() { $('#trainersModal').hidden = true; $('#trainersStatus').textContent = ''; restoreGameViews(); }
async function saveTrainers() {
  const rows = [...document.querySelectorAll('.trainer-row')];
  for (const row of rows) {
    const values = Object.fromEntries([...row.querySelectorAll('input')].map((input) => [input.dataset.field, input.value.trim()]));
    if (!values.username && !values.password && !values.name) continue;
    let account = state.accounts.find((item) => item.id === row.dataset.id);
    if (!account) {
      if (state.accounts.length >= 4) continue;
      const id = `account-${Date.now()}-${row.dataset.slot}`; const result = await window.darkGridAPI.addAccount({ id, slot: Number(row.dataset.slot) }); if (!result?.ok) throw new Error(result?.reason || 'account_create_failed');
      account = { id, slot: Number(row.dataset.slot), label: values.name || `Conta ${Number(row.dataset.slot) + 1}`, name: values.name || `Conta ${Number(row.dataset.slot) + 1}`, enabled: true, hunt: 'Pronta para conectar', status: 'loading' }; state.accounts.push(account); row.dataset.id = id;
    }
    account.name = values.name || account.name; account.label = values.name || account.label; state.credentials[account.id] = { id: account.id, username: values.username, password: values.password };
  }
  await window.darkGridAPI.saveCredentials(Object.values(state.credentials)); await saveProfiles(); closeTrainers(); render();
}
async function loginTeam() { const accounts = state.accounts.filter((account) => state.credentials[account.id]?.username && state.credentials[account.id]?.password); if (!accounts.length) { openTrainers(); return; } for (const account of accounts) { await window.darkGridAPI.openAccount(account.id); const credentials = state.credentials[account.id]; await window.darkGridAPI.accountAction(account.id, 'fillGameCredentials', credentials); await window.darkGridAPI.accountAction(account.id, 'submitGameLogin', {}); } await window.darkGridAPI.setAccountsVisible(true); syncLayout(); }
function renderSidebar(account) { const root = $('#statsSidebarContent'); if (!account) { root.innerHTML = '<p class="history-empty">Selecione uma conta para ver os dados.</p>'; return; } const metrics = account.metrics || {}; root.replaceChildren(...[['Status', statusLabels[account.status] || account.status], ['Hunt', account.hunt || '—'], ['Nível', account.level || '—'], ['Gold', Number(account.gold || 0).toLocaleString('pt-BR')], ['Kills/h', Number(metrics.kph || 0).toLocaleString('pt-BR')], ['XP/h', Number(metrics.xph || 0).toLocaleString('pt-BR')], ['Capturas', Number(metrics.captures || 0).toLocaleString('pt-BR')]].map(([label, value]) => { const row = document.createElement('div'); row.className = 'sidebar-stat'; row.innerHTML = `<span>${label}</span><strong>${value}</strong>`; return row; })); }
function toggleStatsSidebar() { sidebarOpen = !sidebarOpen; $('#statsSidebar').hidden = !sidebarOpen; if (sidebarOpen) renderSidebar(focusedAccount()); syncLayout(); }

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

async function removeAccount(account) {
  if (account.actionBusy || !window.confirm(`Remover ${account.name || 'esta conta'} do DarkGrid? O perfil local será removido, mas nada será alterado no jogo.`)) return;
  account.actionBusy = true; render();
  try {
    const result = await window.darkGridAPI.removeAccount(account.id);
    if (!result?.ok) throw new Error(result?.reason || 'remove_failed');
    state.accounts = state.accounts.filter((item) => item.id !== account.id);
    await saveProfiles();
  } catch (cause) {
    account.actionBusy = false; account.status = 'error'; account.error = cause.message;
  }
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

async function openAccount(account) { if (compactMode) await setCompactMode(false); await window.darkGridAPI.openAccount(account.id); syncLayout(); }
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
  account.status = snapshot.status; account.name = snapshot.name || account.name; account.hunt = snapshot.hunt?.name || snapshot.hunt?.slug || 'Sem hunt'; account.huntSlug = snapshot.hunt?.slug || account.huntSlug || ''; account.level = snapshot.level; account.gold = snapshot.gold; account.balls = snapshot.balls; account.potions = snapshot.potions; account.ballCatalog = Array.isArray(snapshot.ballCatalog) ? snapshot.ballCatalog : account.ballCatalog || []; account.inventory = Array.isArray(snapshot.inventory) ? snapshot.inventory : account.inventory || []; account.team = Array.isArray(snapshot.team) ? snapshot.team : account.team || []; account.metrics = snapshot.metrics || account.metrics || {}; account.analyzer = snapshot.analyzer || account.analyzer || null; account.drops = snapshot.drops || account.drops || [];
}
function syncLayout() { const x = sidebarOpen ? 340 : 0; window.darkGridAPI.setAccountLayout({ x, y: PANEL_GAME_Y, width: Math.max(500, window.innerWidth - x), height: Math.max(400, window.innerHeight - PANEL_GAME_Y) }); positionPanelHeaders(); }
async function changePanelZoom(account, delta) { const current = Number(panelZooms[account.id] || 1); const next = Math.min(1.5, Math.max(0.5, Math.round((current + delta) * 20) / 20)); panelZooms[account.id] = next; localStorage.setItem('darkgrid-panel-zooms', JSON.stringify(panelZooms)); await window.darkGridAPI.setAccountZoom(account.id, next); render(); }
async function reloadPanel(account) { await window.darkGridAPI.reloadAccount(account.id); }
async function refreshAllAccounts() { await Promise.all(state.accounts.map((account) => window.darkGridAPI.reloadAccount(account.id))); await Promise.all(state.accounts.map((account) => refreshAccount(account))); }
function renderLayoutButton() { $('#layoutButton').textContent = `Layout: ${{ grid: 'Grade', row: 'Uma linha', column: 'Uma coluna' }[layoutMode]}`; }
async function cycleLayout() {
  const modes = ['grid', 'row', 'column'];
  const next = modes[(modes.indexOf(layoutMode) + 1) % modes.length];
  if (await window.darkGridAPI.setLayoutMode(next)) { layoutMode = next; localStorage.setItem('darkgrid-layout', layoutMode); renderLayoutButton(); syncLayout(); }
}
async function setCompactMode(enabled) {
  compactMode = Boolean(enabled);
  document.body.classList.toggle('compact-mode', compactMode);
  document.body.classList.toggle('simple-mode', compactMode);
  const button = $('#compactButton');
  button.setAttribute('aria-pressed', String(compactMode));
  button.textContent = compactMode ? '🃏 Mostrar jogo' : '🃏 Simples';
  await window.darkGridAPI.setAccountsVisible(!compactMode);
  if (!compactMode) syncLayout();
}

$('#loginButton').addEventListener('click', loginTeam);
$('#emptyLoginButton').addEventListener('click', addAccount);
$('#manageAccountsButton').addEventListener('click', openTrainers);
$('#refreshButton').addEventListener('click', refreshAllAccounts);
$('#compactButton').addEventListener('click', () => setCompactMode(!compactMode));
$('#layoutButton').addEventListener('click', cycleLayout);
const focusedAccount = () => state.accounts.find((account) => account.status === 'online' || account.status === 'stale') || state.accounts[0];
const openFocused = (handler) => { const account = focusedAccount(); if (account) handler(account); else $('#connectionLabel').textContent = 'Adicione uma conta primeiro'; };
$('#ivTopButton').addEventListener('click', () => openFocused(openIv));
$('#protectItemsButton').addEventListener('click', () => openFocused(openProtectedItems));
$('#optionsButton').addEventListener('click', () => { const menu = $('#optionsMenu'); const show = !menu.classList.contains('show'); menu.classList.toggle('show', show); if (show) showUiOverlay(); else restoreGameViews(); });
$('#huntMenuButton').addEventListener('click', () => { $('#optionsMenu').classList.remove('show'); openFocused(openHunt); });
$('#scriptsButton').addEventListener('click', () => { $('#optionsMenu').classList.remove('show'); openFocused(openScripts); });
$('#operationsMenuButton').addEventListener('click', () => { $('#optionsMenu').classList.remove('show'); openFocused(openOperations); });
$('#inventoryMenuButton').addEventListener('click', () => { $('#optionsMenu').classList.remove('show'); openFocused(openInventory); });
$('#teamMenuButton').addEventListener('click', () => { $('#optionsMenu').classList.remove('show'); openFocused(openTeam); });
$('#panelsMenuButton').addEventListener('click', () => { $('#optionsMenu').classList.remove('show'); restoreGameViews(); syncLayout(); });
$('#gridMenuButton').addEventListener('click', () => { $('#optionsMenu').classList.remove('show'); if (layoutMode !== 'grid') { layoutMode = 'grid'; localStorage.setItem('darkgrid-layout', layoutMode); window.darkGridAPI.setLayoutMode(layoutMode); renderLayoutButton(); syncLayout(); } });
$('#settingsMenuButton').addEventListener('click', () => { $('#optionsMenu').classList.remove('show'); restoreGameViews(); document.querySelector('[data-view="settings"]').click(); });
document.addEventListener('click', (event) => { if (!event.target.closest('.menu-wrap')) { const menu = $('#optionsMenu'); if (menu.classList.contains('show')) { menu.classList.remove('show'); restoreGameViews(); } } });
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
$('#ivClose').addEventListener('click', closeIv);
$('#ivModal').addEventListener('click', (event) => { if (event.target.id === 'ivModal') closeIv(); });
$('#ivPokemon').addEventListener('change', () => { const index = Number($('#ivPokemon').value); fillIvFields(ivAccount?.team?.[index] || {}); });
$('#scriptsClose').addEventListener('click', closeScripts);
$('#scriptsModal').addEventListener('click', (event) => { if (event.target.id === 'scriptsModal') closeScripts(); });
$('#scriptAccount').addEventListener('change', () => { scriptAccount = state.accounts.find((account) => account.id === $('#scriptAccount').value) || scriptAccount; });
$('#huntClose').addEventListener('click', closeHunt);
$('#huntModal').addEventListener('click', (event) => { if (event.target.id === 'huntModal') closeHunt(); });
$('#tierlistButton').addEventListener('click', () => openTierlist());
$('#tierlistClose').addEventListener('click', closeTierlist);
$('#tierlistModal').addEventListener('click', (event) => { if (event.target.id === 'tierlistModal') closeTierlist(); });
$('#analyzerButton').addEventListener('click', toggleStatsSidebar);
$('#statsSidebarClose').addEventListener('click', toggleStatsSidebar);
$('#trainersClose').addEventListener('click', closeTrainers);
$('#trainersCancel').addEventListener('click', closeTrainers);
$('#trainersModal').addEventListener('click', (event) => { if (event.target.id === 'trainersModal') closeTrainers(); });
$('#trainersSave').addEventListener('click', async () => { const button = $('#trainersSave'); button.disabled = true; try { await saveTrainers(); } catch (cause) { $('#trainersStatus').textContent = `Não foi possível salvar: ${cause.message}`; } finally { button.disabled = false; } });
$('#protectClose').addEventListener('click', closeProtectedItems);
$('#protectCancel').addEventListener('click', closeProtectedItems);
$('#protectSave').addEventListener('click', saveProtectedItems);
$('#protectFilter').addEventListener('input', renderProtectedItems);
$('#protectAccount').addEventListener('change', async () => { protectAccount = state.accounts.find((account) => account.id === $('#protectAccount').value) || protectAccount; await refreshAccount(protectAccount); renderProtectedItems(); });
$('#protectModal').addEventListener('click', (event) => { if (event.target.id === 'protectModal') closeProtectedItems(); });
$('#analyzerClose').addEventListener('click', closeAnalyzer);
$('#analyzerModal').addEventListener('click', (event) => { if (event.target.id === 'analyzerModal') closeAnalyzer(); });
$('#ivForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  $('#ivError').textContent = '';
  const ivs = Object.fromEntries([...document.querySelectorAll('[data-iv]')].filter((input) => input.value !== '').map((input) => [input.dataset.iv, Number(input.value)]));
  const baseStats = Object.fromEntries([...document.querySelectorAll('[data-base]')].filter((input) => input.value !== '').map((input) => [input.dataset.base, Number(input.value)]));
  try {
    const response = await window.darkGridAPI.calculateIv({ level: Number($('#ivLevel').value), quality: Number($('#ivQuality').value), ivTotal: Number($('#ivTotal').value), ivs, baseStats });
    if (!response?.ok) throw new Error(response?.reason || 'iv_failed');
    renderIvResult(response.result);
    if (!response.result.valid) $('#ivError').textContent = 'Preencha os seis stats base para projetar os atributos.';
  } catch (cause) { $('#ivError').textContent = `Não foi possível calcular: ${cause.message}`; }
});
$('#scriptsForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const script = $('#userScriptEditor').value;
  if (!scriptAccount || !script.trim()) { $('#scriptsError').textContent = 'Selecione uma conta e informe um script.'; return; }
  $('#scriptsError').textContent = ''; $('#scriptsStatus').textContent = 'Executando…';
  try {
    localStorage.setItem('darkgrid-user-script', script);
    const response = await window.darkGridAPI.accountAction(scriptAccount.id, 'runUserScript', { script });
    if (!response?.ok || !response.result?.ok) throw new Error(response?.reason || response?.result?.reason || 'user_script_failed');
    $('#scriptsStatus').textContent = response.result.result == null ? 'Script concluído.' : `Resultado: ${JSON.stringify(response.result.result).slice(0, 400)}`;
  } catch (cause) { $('#scriptsError').textContent = `Script não executado: ${cause.message}`; $('#scriptsStatus').textContent = ''; }
});
$('#huntForm').addEventListener('submit', async (event) => { event.preventDefault(); if (!huntAccount || huntAccount.actionBusy) return; const account = huntAccount; const button = event.currentTarget.querySelector('button[type="submit"]'); button.disabled = true; $('#huntError').textContent = ''; account.actionBusy = true; render(); try { const slug = $('#huntSlug').value.trim(); const name = $('#huntName').value.trim() || slug; const response = await window.darkGridAPI.accountAction(account.id, 'travelToHunt', { slug, name }); if (!response?.ok || !response.result?.ok) throw new Error(response?.reason || response?.result?.reason || 'travel_failed'); account.huntSlug = slug; account.hunt = name; account.status = 'online'; closeHunt(); } catch (cause) { $('#huntError').textContent = `Não foi possível viajar: ${cause.message}`; } finally { account.actionBusy = false; button.disabled = false; render(); } });
$('#clearDiscordWebhook').addEventListener('click', async () => { const result = await window.darkGridAPI.clearDiscordWebhook(); if (result?.ok) { $('#discordWebhookUrl').value = ''; $('#discordWebhookStatus').textContent = 'Não configurado'; $('#alertDiscordNotifications').checked = false; } });
$('#alertSettingsForm').addEventListener('submit', async (event) => { event.preventDefault(); const webhook = $('#discordWebhookUrl').value.trim(); if (webhook) { const savedWebhook = await window.darkGridAPI.saveDiscordWebhook(webhook); if (!savedWebhook?.ok) { $('#settingsSaved').textContent = 'Webhook do Discord inválido ou inseguro'; return; } $('#discordWebhookStatus').textContent = 'Webhook configurado (URL protegida)'; } const discord = await window.darkGridAPI.getDiscordStatus(); if ($('#alertDiscordNotifications').checked && !discord?.configured) { $('#settingsSaved').textContent = 'Configure um webhook antes de ativar os alertas do Discord'; return; } const result = await window.darkGridAPI.saveAlertConfig({ enabled: $('#alertEnabled').checked, nativeNotifications: $('#alertNativeNotifications').checked, accountOffline: $('#alertOffline').checked, noBalls: $('#alertNoBalls').checked, noProgress: $('#alertNoProgress').checked, discordNotifications: $('#alertDiscordNotifications').checked, lowBalls: Number($('#alertLowBalls').value), noProgressSeconds: Number($('#alertNoProgressMinutes').value) * 60 }); const autoStart = await window.darkGridAPI.setAutoStart($('#startWithWindows').checked); if (result?.ok && (autoStart?.ok || autoStart?.supported === false)) { state.alerts = result.config; $('#settingsSaved').textContent = 'Preferências salvas'; } else $('#settingsSaved').textContent = 'Não foi possível salvar todas as preferências'; });
$('#buyBallsForm').addEventListener('submit', (event) => submitOperation(event, 'buyBalls', () => ({ ballId: Number($('#ballId').value), quantity: Number($('#ballQuantity').value) })));
$('#sellStoneForm').addEventListener('submit', (event) => submitOperation(event, 'sellStone', () => ({ itemId: Number($('#stoneItemId').value), quantity: Number($('#stoneQuantity').value) })));
$('#sellItemsButton').addEventListener('click', (event) => protectedSale('items', event.currentTarget));
$('#sellPokemonButton').addEventListener('click', (event) => protectedSale('pokemon', event.currentTarget));
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
    state.credentials[gameLoginAccount.id] = { id: gameLoginAccount.id, username: $('#gameUsername').value, password: $('#gamePassword').value };
    await window.darkGridAPI.saveCredentials(Object.values(state.credentials));
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
    await window.darkGridAPI.setLayoutMode(layoutMode);
    renderLayoutButton();
    const savedCredentials = await window.darkGridAPI.loadCredentials();
    state.credentials = Object.fromEntries((Array.isArray(savedCredentials) ? savedCredentials : []).map((item) => [item.id, item]));
    if (state.auth.ok) state.history = await window.darkGridAPI.loadHuntHistory();
    if (state.auth.ok) await restoreAccounts();
    else render();
  } catch { state.auth = { ok: false, reason: 'auth_required' }; setAuthStatus(state.auth); render(); }
}

bootstrap();
