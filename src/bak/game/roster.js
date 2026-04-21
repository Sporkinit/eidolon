import { POKEDEX, MOVES_DB } from './data.js';
import { typeBadge, typeDots, rankStars, showPoolTip, hidePoolTip, codexUrl, typeColor } from '../shared/helpers.js';
import { RANK_UNLOCK, PUBLIC_PATH, TYPE_COLORS } from '../shared/constants.js';
import { getSave, isUnlocked, unlock, spendCoins } from './save.js';
import { toast, updateCoinDisplay } from './main.js';

// ── Filter state ──────────────────────────────────────────────────────────────
let rosterRankFilter = '';   // '' | '3' | '2' | '1'
let rosterTypeFilter = '';   // '' | 'fire' | 'water' | ...
let rosterSearch     = '';

function rankToStars(rank) {
  if (rank === 'SS' || rank === 'S') return '3';
  if (rank === 'A') return '2';
  return '1';
}

// ── Rank filter ───────────────────────────────────────────────────────────────
export function setRosterRankFilter(stars) {
  rosterRankFilter = stars;
  document.querySelectorAll('#roster-rank-filters .filter-btn').forEach(b => {
    b.classList.toggle('filter-active', b.dataset.stars === (stars || ''));
  });
  renderMyRoster();
}

// ── Type filter ───────────────────────────────────────────────────────────────
export function setRosterTypeFilter(type) {
  rosterTypeFilter = type;
  document.querySelectorAll('#roster-type-filters .filter-btn').forEach(b => {
    b.classList.toggle('filter-active', b.dataset.type === (type || ''));
  });
  renderMyRoster();
}

// ── Build filter bars (called once when screen opens) ─────────────────────────
export function buildRosterFilters() {
  const rankWrap = document.getElementById('roster-rank-filters');
  if (rankWrap) {
    rankWrap.innerHTML = `
      <button class="filter-btn filter-active" data-stars="" onclick="setRosterRankFilter('')">All</button>
      <button class="filter-btn" data-stars="3" onclick="setRosterRankFilter('3')">★★★</button>
      <button class="filter-btn" data-stars="2" onclick="setRosterRankFilter('2')">★★</button>
      <button class="filter-btn" data-stars="1" onclick="setRosterRankFilter('1')">★</button>`;
  }

  const typeWrap = document.getElementById('roster-type-filters');
  if (typeWrap) {
    const types = ['primal','flora','water','fire','terra','fae','dark','volt','ice'];
    typeWrap.innerHTML =
      `<button class="filter-btn filter-active" data-type="" onclick="setRosterTypeFilter('')">All</button>`
      + types.map(t =>
        `<button class="filter-btn" data-type="${t}"
          style="background:${TYPE_COLORS[t]};color:#fff;border-color:transparent;opacity:0.75"
          onclick="setRosterTypeFilter('${t}')">${t}</button>`
      ).join('');
  }
}

// ── My Roster ─────────────────────────────────────────────────────────────────
export function renderMyRoster() {
  updateCoinDisplay();
  const grid = document.getElementById('my-roster-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const search = rosterSearch.toLowerCase().trim();

  const all = POKEDEX.filter(c => {
    if (rosterRankFilter && rankToStars(c.rank) !== rosterRankFilter) return false;
    if (rosterTypeFilter && !c.types.includes(rosterTypeFilter)) return false;
    if (search && !c.name.toLowerCase().includes(search)) return false;
    return true;
  }).sort((a, b) => a.name.localeCompare(b.name));

  all.forEach(c => {
    const locked = !isUnlocked(c.name);
    const cost   = RANK_UNLOCK[c.rank] || 0;
    const div = document.createElement('div');
    div.className = 'creature-card' + (locked ? ' locked-card' : '');
    div.innerHTML = `
      <img class="card-thumb" src="${PUBLIC_PATH}front_thumb/${c.name}.webp" alt="${c.name}" onerror="this.style.opacity='0.1'">
      <div class="card-name-row">${typeDots(c.types)}<div class="card-name">${c.name}</div></div>
      <div class="rank-stars">${rankStars(c.rank)}</div>
      ${locked
        ? `<div class="lock-tag">🔒 ${cost > 0 ? cost.toLocaleString() + '⬡' : 'Free'}</div>`
        : `<div style="font-size:0.65rem;color:#3aad5e;margin-top:2px">✓ Unlocked</div>`}`;
    div.onclick = () => { if (locked) tryUnlock(c.name); else window.open(codexUrl(c.name), '_blank'); };
    div.onmouseenter = () => showPoolTip(c, MOVES_DB, div);
    div.onmouseleave = () => hidePoolTip();
    grid.appendChild(div);
  });

  if (!all.length) {
    grid.innerHTML = '<div style="color:var(--muted);padding:2rem;text-align:center">No creatures match.</div>';
  }
}

// ── Unlock ────────────────────────────────────────────────────────────────────
export function tryUnlock(name) {
  const c    = POKEDEX.find(x => x.name === name);
  const cost = RANK_UNLOCK[c.rank] || 0;
  if (cost === 0) { unlock(name); renderMyRoster(); return; }
  if (!spendCoins(cost)) { toast('Not enough coins!'); return; }
  unlock(name);
  toast(`${c.name} unlocked!`);
  renderMyRoster();
  updateCoinDisplay();
}

// ── Search (called from HTML oninput) ─────────────────────────────────────────
export function setRosterSearch(val) {
  rosterSearch = val;
  renderMyRoster();
}
