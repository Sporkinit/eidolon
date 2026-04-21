import { POKEDEX, MOVES_DB } from './data.js';
import { typeBadge, typeDots, rankStars, showPoolTip, hidePoolTip, shuffle } from '../shared/helpers.js';
import { POOL_MAX, PUBLIC_PATH, TYPE_COLORS } from '../shared/constants.js';
import { getSave, isUnlocked } from './save.js';
import { toast, showScreen } from './main.js';
import { initBattle } from './battle.js';
import { startBattleUI } from './battle-ui.js';

// ── Pool filter state ─────────────────────────────────────────────────────────
let poolRankFilter = '';
let poolTypeFilter = '';
let poolSearch     = '';

function rankToStars(rank) {
  if (rank === 'SS' || rank === 'S') return '3';
  if (rank === 'A') return '2';
  return '1';
}

export function setPoolRankFilter(stars) {
  poolRankFilter = stars;
  document.querySelectorAll('#pool-rank-filters .filter-btn').forEach(b => {
    b.classList.toggle('filter-active', b.dataset.stars === (stars || ''));
  });
  applyPoolFilters();
}

export function setPoolTypeFilter(type) {
  poolTypeFilter = type;
  document.querySelectorAll('#pool-type-filters .filter-btn').forEach(b => {
    b.classList.toggle('filter-active', b.dataset.type === (type || ''));
  });
  applyPoolFilters();
}

export function setPoolSearch(val) {
  poolSearch = val;
  applyPoolFilters();
}

export function buildPoolFilters() {
  const rankWrap = document.getElementById('pool-rank-filters');
  if (rankWrap) {
    rankWrap.innerHTML = `
      <button class="filter-btn filter-active" data-stars="" onclick="setPoolRankFilter('')">All</button>
      <button class="filter-btn" data-stars="3" onclick="setPoolRankFilter('3')">★★★</button>
      <button class="filter-btn" data-stars="2" onclick="setPoolRankFilter('2')">★★</button>
      <button class="filter-btn" data-stars="1" onclick="setPoolRankFilter('1')">★</button>`;
  }
  const typeWrap = document.getElementById('pool-type-filters');
  if (typeWrap) {
    const types = ['primal','flora','water','fire','terra','fae','dark','volt','ice'];
    typeWrap.innerHTML =
      `<button class="filter-btn filter-active" data-type="" onclick="setPoolTypeFilter('')">All</button>`
      + types.map(t =>
        `<button class="filter-btn" data-type="${t}"
          style="background:${TYPE_COLORS[t]};color:#fff;border-color:transparent;opacity:0.75"
          onclick="setPoolTypeFilter('${t}')">${t}</button>`
      ).join('');
  }
}

function applyPoolFilters() {
  const search = poolSearch.toLowerCase().trim();
  document.querySelectorAll('#pool-grid .creature-card').forEach(el => {
    const name = el.dataset.name;
    if (!name) return;
    const c = POKEDEX.find(x => x.name === name);
    if (!c) return;
    const rankOk = !poolRankFilter || rankToStars(c.rank) === poolRankFilter;
    const typeOk = !poolTypeFilter || c.types.includes(poolTypeFilter);
    const nameOk = !search || name.toLowerCase().includes(search);
    el.style.display = (rankOk && typeOk && nameOk) ? '' : 'none';
    // Keep selected state in sync
    el.classList.toggle('selected-card', myPool.includes(name));
  });
  // Hide section labels if no visible cards follow them
  document.querySelectorAll('#pool-grid .pool-section-label').forEach(label => {
    let next = label.nextElementSibling;
    let hasVisible = false;
    while (next && !next.classList.contains('pool-section-label')) {
      if (next.style.display !== 'none') { hasVisible = true; break; }
      next = next.nextElementSibling;
    }
    label.style.display = hasVisible ? '' : 'none';
  });
}

// ── Pool state ────────────────────────────────────────────────────────────────
export let myPool  = [];
export let oppPool = [];
export let myTeam  = [];
export let oppTeam = [];
export let poolConfirmed = false;
export let teamConfirmed = false;

export function resetDraftState() {
  myPool = []; oppPool = []; myTeam = []; oppTeam = [];
  poolConfirmed = false; teamConfirmed = false;
}

// ── Favourites — persisted in localStorage ────────────────────────────────────
const FAV_KEY = 'creature_favourites';
function loadFavourites() {
  try { return new Set(JSON.parse(localStorage.getItem(FAV_KEY) || '[]')); }
  catch { return new Set(); }
}
function saveFavourites(set) {
  localStorage.setItem(FAV_KEY, JSON.stringify([...set]));
}
let favourites = loadFavourites();

function toggleFavourite(name, btnEl) {
  if (favourites.has(name)) {
    favourites.delete(name);
  } else {
    favourites.add(name);
  }
  saveFavourites(favourites);
  btnEl.classList.toggle('fav-active', favourites.has(name));
  btnEl.title = favourites.has(name) ? 'Remove from favourites' : 'Add to favourites';
  // Re-render so the favourites section at the top updates
  _renderPoolCards();
}

// ── Pool grid ─────────────────────────────────────────────────────────────────
export function renderPoolGrid() {
  myPool = []; poolConfirmed = false;
  poolRankFilter = ''; poolTypeFilter = ''; poolSearch = '';
  document.getElementById('pool-max-label').textContent = POOL_MAX;
  updatePoolUI();
  buildPoolFilters();
  const si = document.getElementById('pool-search-input');
  if (si) si.value = '';
  _renderPoolCards();
}

function _buildCreatureCard(c) {
  const isFav = favourites.has(c.name);
  const div = document.createElement('div');
  div.className = 'creature-card';
  div.id = `pc-${c.name}`;
  div.dataset.name = c.name;

  const dots = c.types.map(t =>
    `<span class="type-dot" style="background:${typeColor(t)}" title="${t}"></span>`
  ).join('');

  div.innerHTML = `
    <button class="fav-btn${isFav ? ' fav-active' : ''}" title="${isFav ? 'Remove from favourites' : 'Add to favourites'}">★</button>
    <img class="card-thumb" src="${PUBLIC_PATH}front_thumb/${c.name}.webp" alt="${c.name}" onerror="this.style.opacity='0.1'">
    <div class="card-name-row"><div class="type-dots">${dots}</div><div class="card-name">${c.name}</div></div>`;

  div.querySelector('.fav-btn').addEventListener('click', e => {
    e.stopPropagation();
    toggleFavourite(c.name, e.currentTarget);
  });
  div.onclick = () => togglePool(c.name);
  div.onmouseenter = () => showPoolTip(c, MOVES_DB, div);
  div.onmouseleave = () => hidePoolTip();
  return div;
}

function _sectionLabel(text, isFav = false) {
  const el = document.createElement('div');
  el.className = 'pool-section-label' + (isFav ? ' fav-label' : '');
  el.style.gridColumn = '1 / -1';
  el.textContent = text;
  return el;
}

function _renderPoolCards() {
  const grid = document.getElementById('pool-grid');
  grid.innerHTML = '';

  const unlocked = POKEDEX.filter(c => isUnlocked(c.name))
    .sort((a, b) => a.name.localeCompare(b.name));

  const favList  = unlocked.filter(c => favourites.has(c.name));
  const restList = unlocked.filter(c => !favourites.has(c.name));

  if (favList.length > 0) {
    grid.appendChild(_sectionLabel('★  Favourites', true));
    favList.forEach(c => grid.appendChild(_buildCreatureCard(c)));
    grid.appendChild(_sectionLabel('All Creatures'));
  }
  restList.forEach(c => grid.appendChild(_buildCreatureCard(c)));

  applyPoolFilters();
}

export function togglePool(name) {
  if (myPool.includes(name)) myPool = myPool.filter(x => x !== name);
  else {
    if (myPool.length >= POOL_MAX) { toast(`Max ${POOL_MAX} in pool`); return; }
    myPool.push(name);
  }
  updatePoolUI();
}

export function updatePoolUI() {
  document.getElementById('pool-count').textContent = myPool.length;
  const row = document.getElementById('pool-selected-row');
  row.innerHTML = '';
  myPool.forEach(name => {
    const c    = POKEDEX.find(x => x.name === name);
    const pill = document.createElement('div');
    pill.className = 'pool-mini-pill';
    pill.innerHTML = c.types.map(t =>
      `<span style="width:8px;height:8px;border-radius:50%;background:${typeColor(t)};display:inline-block"></span>`
    ).join('') + ' ' + name;
    pill.title = 'Click to remove';
    pill.onclick = () => togglePool(name);
    row.appendChild(pill);
  });
  // Sync selected state on all visible cards
  applyPoolFilters();
  const btn = document.getElementById('pool-confirm-btn');
  if (btn) btn.disabled = myPool.length < 3;
}

export function confirmPool(isSolo, ws) {
  if (myPool.length < 3) { toast('Need at least 3'); return; }
  poolConfirmed = true;
  if (!isSolo && ws) {
    ws.send(JSON.stringify({ type: 'pool_submitted', pool: myPool }));
    document.getElementById('pool-confirm-btn').disabled = true;
    document.getElementById('pool-confirm-btn').textContent = 'Waiting...';
    checkBothPools();
  } else {
    const aiOptions = POKEDEX.filter(c => isUnlocked(c.name)).map(c => c.name);
    oppPool = shuffle(aiOptions).slice(0, Math.min(POOL_MAX, aiOptions.length));
    showScreen('draft');
    renderDraftScreen();
  }
}

export function checkBothPools() {
  if (poolConfirmed && oppPool.length > 0) { showScreen('draft'); renderDraftScreen(); }
}

// ── Draft ─────────────────────────────────────────────────────────────────────
export function renderDraftScreen() {
  myTeam = []; teamConfirmed = false;
  const myGrid = document.getElementById('my-draft-grid');
  myGrid.innerHTML = '';
  myPool.forEach(name => {
    const c = POKEDEX.find(x => x.name === name);
    const div = document.createElement('div');
    div.className = 'draft-card'; div.id = `dc-${name}`;
    div.innerHTML = `
      <img class="draft-card-img" src="${PUBLIC_PATH}front_thumb/${name}.webp" alt="${name}" onerror="this.style.opacity='0.1'">
      <div class="draft-card-name">${name}</div>
      <div class="badge-row" style="justify-content:center">${c.types.map(typeBadge).join('')}</div>`;
    div.onclick = () => toggleDraft(name);
    div.onmouseenter = () => showPoolTip(c, MOVES_DB, div);
    div.onmouseleave = () => hidePoolTip();
    myGrid.appendChild(div);
  });
  renderOppPoolDisplay();
  updateDraftUI();
}

export function renderOppPoolDisplay() {
  const cont = document.getElementById('opp-pool-display');
  if (!cont) return;
  cont.innerHTML = '';
  oppPool.forEach(name => {
    const c = POKEDEX.find(x => x.name === name);
    if (!c) return;
    const el = document.createElement('div');
    el.className = 'opp-pool-mini';
    el.innerHTML = `<img src="${PUBLIC_PATH}front_thumb/${name}.webp" alt="${name}" onerror="this.style.opacity='0.1'">
      <div class="opp-pool-mini-name">${name}</div>
      ${typeDots(c.types)}`;
    el.onmouseenter = () => showPoolTip(c, MOVES_DB, el);
    el.onmouseleave = () => hidePoolTip();
    cont.appendChild(el);
  });
}

export function toggleDraft(name) {
  if (myTeam.includes(name)) myTeam = myTeam.filter(x => x !== name);
  else { if (myTeam.length >= 3) { toast('Already picked 3'); return; } myTeam.push(name); }
  updateDraftUI();
}

export function updateDraftUI() {
  myPool.forEach(name => {
    const el = document.getElementById(`dc-${name}`);
    if (el) el.classList.toggle('draft-selected', myTeam.includes(name));
  });
  document.getElementById('my-pick-count').textContent = myTeam.length;
  const row = document.getElementById('my-draft-picks');
  row.innerHTML = '';
  myTeam.forEach(name => {
    const pill = document.createElement('div');
    pill.className = 'pool-mini-pill';
    pill.textContent = name;
    pill.onclick = () => toggleDraft(name);
    row.appendChild(pill);
  });
  const btn = document.getElementById('draft-confirm-btn');
  if (btn) btn.disabled = myTeam.length !== 3;
}

export function confirmDraft(isSolo, ws) {
  if (myTeam.length !== 3) return;
  teamConfirmed = true;
  if (!isSolo && ws) {
    ws.send(JSON.stringify({ type: 'draft_submitted', team: myTeam }));
    document.getElementById('draft-confirm-btn').disabled = true;
    document.getElementById('draft-confirm-btn').textContent = 'Waiting...';
    checkBothDrafts(isSolo, ws);
  } else {
    oppTeam = shuffle([...oppPool]).slice(0, 3);
    const battleState = initBattle(myTeam, oppTeam);
    startBattleUI(battleState, true, null, 0);
  }
}

export function checkBothDrafts(isSolo, ws) {
  if (teamConfirmed && oppTeam.length > 0) {
    const battleState = initBattle(myTeam, oppTeam);
    startBattleUI(battleState, isSolo, ws, 0);
  }
}

// typeColor used in updatePoolUI - import here to avoid circular
import { typeColor } from '../shared/helpers.js';
