import { TYPE_COLORS, TYPE_CHART, RANK_STARS, PUBLIC_PATH } from './constants.js';

// ── Type helpers ──────────────────────────────────────────────────────────────
export function typeColor(t) {
  return TYPE_COLORS[t?.toLowerCase()] || '#555';
}

export function typeBadge(t) {
  return `<span class="type-badge type-${t}" style="background:${typeColor(t)}">${t}</span>`;
}

export function tagBadge(t) {
  return `<span class="tag-badge">${t}</span>`;
}

export function typeDots(types) {
  return '<div class="type-dots">' +
    types.map(t => `<span class="type-dot" style="background:${typeColor(t)}" title="${t}"></span>`).join('') +
    '</div>';
}

// ── Rank helpers ──────────────────────────────────────────────────────────────
export function rankStars(rank) {
  return RANK_STARS[rank] || '';
}

// ── Type effectiveness ────────────────────────────────────────────────────────
export function getEffectiveness(atkType, defTypes) {
  const chart = TYPE_CHART[atkType?.toLowerCase()];
  if (!chart) return 1;
  let mult = 1;
  defTypes.forEach(dt => {
    if (chart.immune.includes(dt))  mult *= 0;
    else if (chart.strong.includes(dt)) mult *= 2;
    else if (chart.resist.includes(dt)) mult *= 0.5;
  });
  return mult;
}

export function effLabel(mult) {
  if (mult === 0)  return 'No effect!';
  if (mult >= 4)   return 'Incredibly effective!!';
  if (mult >= 2)   return 'Super effective!';
  if (mult < 1)    return 'Not very effective...';
  return '';
}

// ── Stat scaling (codex base stats → battle values) ──────────────────────────
export function battleHP(base)   { return base * 8 + 50; }
export function battleStat(base) { return base * 3 + 10; }

export function stageMultiplier(stage) {
  const t = [0.25, 0.28, 0.33, 0.4, 0.5, 0.66, 1, 1.5, 2, 2.5, 3, 3.5, 4];
  return t[Math.max(0, Math.min(12, stage + 6))];
}

// ── Misc ──────────────────────────────────────────────────────────────────────
export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function toast(msg, dur = 2500) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), dur);
}

// ── Hover tooltip (pool / roster / draft cards) ───────────────────────────────
// Integrated patch for showPoolTip and hidePoolTip

// ── Hover tooltip (pool / roster / draft cards) ───────────────────────────────
const _isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

export function showPoolTip(c, movesDb, anchorEl) {
  if (_isTouchDevice) return;
  let tip = document.getElementById('pool-tip-global');
  if (!tip) {
    tip = document.createElement('div');
    tip.id = 'pool-tip-global';
    tip.className = 'creature-tooltip';
    tip.style.cssText = 'position:fixed;z-index:200;pointer-events:none;max-width:240px;min-width:210px;background:rgba(13,13,18,0.97);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:0.75rem;box-shadow:0 8px 32px rgba(0,0,0,0.7);backdrop-filter:blur(8px);font-family:"Outfit",sans-serif;font-size:13px;transition:opacity 0.12s';
    document.body.appendChild(tip);
  }

  // Build flat name→move lookup
  const byName = {};
  for (const group of Object.values(movesDb)) {
    for (const m of group) {
      if (m.name) byName[m.name.toLowerCase()] = m;
    }
  }
  const moves = (c.moves || []).map(n => byName[n.toLowerCase()]).filter(Boolean);

  const idStr  = String(c.id).padStart(3, '0');
  const STAT_LABELS = { hp: 'HP', atk: 'ATK', def: 'DEF', special: 'SP.ATK', spd: 'SPD' };
  const STAT_MAX = 45;
  const total = Object.values(c.stats || {}).reduce((s, v) => s + (v || 0), 0);

  tip.innerHTML = `
    <div style="font-family:'Caesar Dressing',cursive;font-size:1rem;text-transform:capitalize;margin-bottom:2px">${c.name}</div>
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;flex-wrap:wrap">
      <span style="font-size:11px;color:var(--muted)">#${idStr}</span>
      ${(c.types || []).map(typeBadge).join('')}
      <span style="font-size:11px;color:#c9a800;margin-left:2px">${rankStars(c.rank)}</span>
    </div>
    <div style="display:flex;flex-direction:column;gap:4px;margin-bottom:7px">
      ${Object.entries(STAT_LABELS).map(([k, label]) => {
        const val = c.stats?.[k] || 0;
        const pct = Math.min(100, (val / STAT_MAX) * 100);
        const col = pct > 66 ? '#4ade80' : pct > 33 ? '#facc15' : '#f87171';
        return `<div style="display:grid;grid-template-columns:52px 1fr 28px;align-items:center;gap:6px">
          <span style="font-size:10px;font-weight:600;color:var(--muted);text-transform:uppercase;text-align:right">${label}</span>
          <div style="height:5px;background:var(--surface2);border-radius:3px;overflow:hidden">
            <div style="width:${pct}%;height:100%;background:${col};border-radius:3px"></div>
          </div>
          <span style="font-size:11px;font-weight:600;text-align:right">${val || '—'}</span>
        </div>`;
      }).join('')}
      <div style="font-size:10px;color:var(--muted);text-align:right;margin-top:1px">Total: ${total}</div>
    </div>
    ${moves.length ? `
      <div style="font-size:10px;color:var(--muted);letter-spacing:0.05em;margin-bottom:3px">MOVES</div>
      <div style="display:flex;flex-direction:column;gap:2px">
        ${moves.slice(0, 5).map(m => `
          <div style="background:var(--surface2);border-radius:4px;padding:2px 6px;font-size:11px;display:flex;align-items:center;gap:5px">
            <span style="font-weight:600">${m.name}</span>
            <span class="type-badge" style="background:${typeColor(m.type)};font-size:9px;padding:0 4px;border-radius:3px;color:#fff">${m.type}</span>
            ${m.category !== 'Status'
              ? `<span style="color:var(--muted);margin-left:auto">${m.power || '—'} pwr</span>`
              : `<span style="color:var(--muted);margin-left:auto">status</span>`}
          </div>`).join('')}
      </div>` : ''}`;

  // Position: prefer right of anchor, flip left if near edge
  const rect = anchorEl.getBoundingClientRect();
  const tipW = 240, tipH = 360;
  let left = rect.right + 8;
  let top  = rect.top;
  if (left + tipW > window.innerWidth  - 8) left = rect.left - tipW - 8;
  if (top  + tipH > window.innerHeight - 8) top  = window.innerHeight - tipH - 8;
  if (top < 8) top = 8;
  tip.style.left    = left + 'px';
  tip.style.top     = top  + 'px';
  tip.style.opacity = '1';
  tip.style.display = 'block';
}

export function hidePoolTip() {
  const tip = document.getElementById('pool-tip-global');
  if (tip) {
    tip.style.opacity = '0';
    // Small delay for the fade transition if desired, or just hide
    setTimeout(() => { if(tip.style.opacity === '0') tip.style.display = 'none'; }, 120);
  }
}

// ── Codex deep-link URL ──────────────────────────────────────────────────────
export function codexUrl(creatureName) {
  return `${PUBLIC_PATH}#/entry/${encodeURIComponent(creatureName)}`;
}