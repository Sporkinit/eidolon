import { SAVE_KEY, RANK_UNLOCK } from '../shared/constants.js';

// ── Load / initialise save ────────────────────────────────────────────────────
let save = {};
try {
  save = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}');
} catch (e) {
  save = {};
}

// Default starting state
if (!save.coins)    save.coins = 800;
if (!save.unlocked) {
  // C and B are free to start; A costs coins; S is rare
  // (populated after POKEDEX loads — see initSave)
  save.unlocked = null; // sentinel: will be set in initSave()
}

export function initSave(pokedex) {
  if (save.unlocked === null) {
    save.unlocked = pokedex
      .filter(c => c.rank === 'B' || c.rank === 'C')
      .map(c => c.name);
    persist();
  }
}

export function persist() {
  localStorage.setItem(SAVE_KEY, JSON.stringify(save));
}

export function getSave() {
  return save;
}

export function addCoins(amount) {
  save.coins += amount;
  persist();
}

export function spendCoins(amount) {
  if (save.coins < amount) return false;
  save.coins -= amount;
  persist();
  return true;
}

export function isUnlocked(name) {
  return save.unlocked.includes(name);
}

export function unlock(name) {
  if (!isUnlocked(name)) {
    save.unlocked.push(name);
    persist();
  }
}
