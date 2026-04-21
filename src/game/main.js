import { loadData, dataReady } from './data.js';
import { initSave, getSave } from './save.js';
import { renderMyRoster, setRosterRankFilter, setRosterTypeFilter, setRosterSearch, buildRosterFilters, tryUnlock } from './roster.js';
import {
  renderPoolGrid, confirmPool, togglePool,
  renderDraftScreen, toggleDraft, confirmDraft,
  resetDraftState, setPoolRankFilter, setPoolTypeFilter, setPoolSearch,
} from './pool.js';
import { startSolo, showJoinInput, createRoom, joinRoom, setCurrentScreen } from './lobby.js';
import { switchBattleTab, showCreatureTip, hideTip } from './battle-ui.js';

// ── Screen router ─────────────────────────────────────────────────────────────
let _currentScreen = 'title';

export function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById('screen-' + name);
  if (el) el.classList.add('active');
  _currentScreen = name;
  setCurrentScreen(name);

  if (name === 'title')   updateCoinDisplay();
  if (name === 'roster')  { buildRosterFilters(); renderMyRoster(); }
}

export function updateCoinDisplay() {
  const coins = getSave().coins;
  document.querySelectorAll('#title-coins,#roster-coins,#my-roster-coins').forEach(el => {
    if (el) el.textContent = coins;
  });
}

export function toast(msg, dur = 2500) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), dur);
}

// ── Play-again ────────────────────────────────────────────────────────────────
export function playAgain(isSolo) {
  resetDraftState();
  if (isSolo) { showScreen('pool'); renderPoolGrid(); }
  else         { showScreen('lobby'); }
}

// ── Codex inline view (game-side) ─────────────────────────────────────────────
// The game doesn't render the codex inline — it opens the React codex app
// in a new tab via codexUrl(). This keeps codex and game fully separate.

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  await loadData();
  initSave(await import('./data.js').then(m => m.POKEDEX));
  updateCoinDisplay();
}

init();

// ── Expose to HTML onclick attributes ────────────────────────────────────────
// Vite bundles modules — inline onclick="fn()" needs globals.
// We assign them to window here so the existing HTML works unchanged.
Object.assign(window, {
  showScreen,
  updateCoinDisplay,
  toast,
  playAgain: () => {
    import('./lobby.js').then(m => playAgain(m.isSolo));
  },

  // Title / Lobby
  startSolo,
  showJoinInput,
  createRoom,
  joinRoom,

  // Pool
  togglePool,
  confirmPool: () => import('./lobby.js').then(m => confirmPool(m.isSolo, m.ws)),
  renderPoolGrid,

  // Draft
  toggleDraft,
  confirmDraft: () => import('./lobby.js').then(m => confirmDraft(m.isSolo, m.ws)),

  // Battle
  switchBattleTab,
  showCreatureTip,
  hideTip,

  // Roster
  setRosterRankFilter,
  setRosterTypeFilter,
  setRosterSearch,
  tryUnlock,

  // Pool filters
  setPoolRankFilter,
  setPoolTypeFilter,
  setPoolSearch,
});
