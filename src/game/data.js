// ── Data module ───────────────────────────────────────────────────────────────
// Fetches pokedex.json and moves_db.json once on startup.
// All game modules import { POKEDEX, MOVES_DB, dataReady } from here.

export let POKEDEX  = [];
export let MOVES_DB = {};

let _resolve;
export const dataReady = new Promise(res => { _resolve = res; });

export async function loadData() {
  try {
    const [poke, moves] = await Promise.all([
      fetch('pokedex.json').then(r => r.json()),
      fetch('moves_db.json').then(r => r.json()),
    ]);
    POKEDEX  = poke;
    MOVES_DB = moves;
    _resolve();
  } catch (err) {
    console.error('Failed to load game data:', err);
  }
}
