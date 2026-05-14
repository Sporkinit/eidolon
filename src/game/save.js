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
    // Pick one random 1-star (B or C) creature per type as the free starter.
    // Only creatures with an animated sprite (locked !== true) are eligible.
    const TYPES = ['primal','flora','water','fire','terra','fae','dark','volt','ice'];
    const chosen = new Set();
    for (const type of TYPES) {
      const pool = pokedex.filter(c =>
        (c.rank === 'B' || c.rank === 'C') &&
        !c.locked &&
        c.types.includes(type)
      );
      if (pool.length) {
        chosen.add(pool[Math.floor(Math.random() * pool.length)].name);
      }
    }
    save.unlocked = [...chosen];
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
