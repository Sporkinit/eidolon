// ── Type colours ─────────────────────────────────────────────────────────────
export const TYPE_COLORS = {
  primal: '#c0614a',
  flora:  '#3aad5e',
  water:  '#2680d4',
  fire:   '#e8601f',
  terra:  '#8b6840',
  fae:    '#c760d4',
  dark:   '#3a2260',
  volt:   '#c9a800',
  ice:    '#58c8e8',
  flex:   '#888888',
};

// ── Type effectiveness (attacker perspective) ─────────────────────────────────
// strong: defender types that take 2×   resist: defender types that deal 0.5×
export const TYPE_CHART = {
  volt:   { strong: ['water', 'ice'],     resist: ['terra', 'dark'],   immune: [] },
  water:  { strong: ['fire', 'terra'],    resist: ['flora', 'volt'],   immune: [] },
  flora:  { strong: ['water', 'terra'],   resist: ['fire', 'ice'],     immune: [] },
  fire:   { strong: ['flora', 'ice'],     resist: ['water', 'terra'],  immune: [] },
  terra:  { strong: ['volt', 'fire'],     resist: ['water', 'flora'],  immune: [] },
  ice:    { strong: ['flora', 'dark'],    resist: ['fire', 'volt'],    immune: [] },
  dark:   { strong: ['fae', 'volt'],      resist: ['primal', 'ice'],   immune: [] },
  fae:    { strong: ['primal', 'terra'],  resist: ['dark', 'fire'],    immune: [] },
  primal: { strong: ['dark', 'ice'],      resist: ['fae', 'volt'],     immune: [] },
  flex:   { strong: [],                   resist: [],                  immune: [] },
};

// ── Rank unlock costs (coins) — SS/S=20k, A=10k, B/C=5k ─────────────────────
export const RANK_UNLOCK = { SS: 20000, S: 20000, A: 10000, B: 5000, C: 5000 };

// ── Rank star display (SS/S=3★  A=2★  B/C=1★) ───────────────────────────────
export const RANK_STARS = { SS: '★★★', S: '★★★', A: '★★', B: '★', C: '★' };

// ── Save key ──────────────────────────────────────────────────────────────────
export const SAVE_KEY = 'bc_v2';

// ── Game config ───────────────────────────────────────────────────────────────
export const POOL_MAX = 8;
export const PUBLIC_PATH = '';
