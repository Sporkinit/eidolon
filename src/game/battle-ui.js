import { POKEDEX, MOVES_DB } from './data.js';
import { typeColor, typeBadge, getEffectiveness, effLabel, battleStat, stageMultiplier } from '../shared/helpers.js';
import { PUBLIC_PATH } from '../shared/constants.js';
import { executeAction, getAIAction, endBattle } from './battle.js';
import { getSave, addCoins, persist } from './save.js';
import { showScreen } from './main.js';

// ── State ─────────────────────────────────────────────────────────────────────
let battle = null;
let currentBattleTab = 'moves';
export let isSolo = false;
export let ws = null;
export let myIndex = 0;

let battleBgSrc = '', playerTrainerSrc = '', enemyTrainerSrc = '';
let turnNumber = 0;

// ── Touch detection — disable all hover tooltips on touch devices ─────────────
const _isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

// ── Image discovery (probe up to 50 files) ────────────────────────────────────
async function pickRandom(folder, prefix, suffix, maxScan = 10) {
  const available = [];
  await Promise.all(
    Array.from({ length: maxScan }, (_, i) => i + 1).map(i =>
      new Promise(res => {
        const img = new Image();
        const src = `${PUBLIC_PATH}${folder}/${prefix}${i}${suffix}`;
        img.onload  = () => { available.push(`${folder}/${prefix}${i}${suffix}`); res(); };
        img.onerror = () => res();
        img.src = src;
      })
    )
  );
  if (!available.length) return `${folder}/${prefix}1${suffix}`;
  return available[Math.floor(Math.random() * available.length)];
}

// ── Start battle ──────────────────────────────────────────────────────────────
export function startBattleUI(battleState, solo, websocket, playerIndex) {
  battle  = battleState;
  isSolo  = solo;
  ws      = websocket;
  myIndex = playerIndex;

  document.getElementById('battle-log').innerHTML = '';
  turnNumber = 0;
  showScreen('battle');

  // Pick bg / trainer images asynchronously
  pickRandom('backgrounds', 'bg', '.webp').then(s => {
    battleBgSrc = s;
    const el = document.getElementById('battle-bg-img');
    if (el) { el.src = PUBLIC_PATH + s; el.style.display = 'block'; }
  });
  pickRandom('trainers', 'trainer_p', '.webp').then(s => {
    playerTrainerSrc = s;
    const el = document.getElementById('player-trainer-img');
    if (el) { el.src = PUBLIC_PATH + s; el.style.opacity = ''; }
  });
  pickRandom('trainers', 'trainer_e', '.webp').then(s => {
    enemyTrainerSrc = s;
    const el = document.getElementById('enemy-trainer-img');
    if (el) { el.src = PUBLIC_PATH + s; el.style.opacity = ''; }
  });

  renderBattle();
  logBattle('Battle Start!', 'log-highlight');

  if (!isSolo && myIndex === 1) {
    battle.waitingForOpponent = true;
    setActionsWaiting();
  } else {
    renderBattleActions();
  }
}

// ── Animated WebP support ─────────────────────────────────────────────────────
// Cache: name → 'anim' | 'static' | undefined (pending)
const _animCache = {};

// Probe whether name_anim.webp exists; resolves to the correct src string.
// Result is cached so subsequent renders are instant.
function resolveSpriteSrc(name, folder) {
  const animSrc   = `${PUBLIC_PATH}${folder}/${name}_anim.webp`;
  const staticSrc = `${PUBLIC_PATH}${folder}/${name}.webp`;

  return new Promise(resolve => {
    if (_animCache[name] === 'anim')   { resolve(animSrc);   return; }
    if (_animCache[name] === 'static') { resolve(staticSrc); return; }
    // Probe
    const probe = new Image();
    probe.onload  = () => { _animCache[name] = 'anim';   resolve(animSrc);   };
    probe.onerror = () => { _animCache[name] = 'static'; resolve(staticSrc); };
    probe.src = animSrc;
  });
}

// Set src on an img element, using animated WebP if available.
// el      — the <img> DOM element
// name    — creature name
// folder  — e.g. 'side_battle'
function setAnimatedSrc(el, name, folder) {
  resolveSpriteSrc(name, folder).then(src => {
    if (el.src !== src) el.src = src;
  });
}

// ── Render battle field ───────────────────────────────────────────────────────
export function renderBattle() {
  renderBattleSide('player', battle.player);
  renderBattleSide('enemy',  battle.enemy);
  renderTeamHpPanel('player', battle.player);
  renderTeamHpPanel('enemy',  battle.enemy);
}

function getPokedexScale(name) {
  const entry = POKEDEX.find(x => x.name.toLowerCase() === name.toLowerCase());
  return entry?.scale ?? 1.0;
}

function renderBattleSide(side, sideState) {
  const isEnemy = side === 'enemy';
  const active  = sideState.team[sideState.activeIdx];
  const folder  = 'side_battle';

  const activeImg = document.getElementById(`${side}-active-img`);
  if (activeImg) {
    activeImg.style.opacity = '';
    activeImg.className = `active-side-img${active.fainted ? ' fainted-sprite' : ''}`;
    const activeScale = getPokedexScale(active.name);
    const flipX = isEnemy ? -1 : 1;
    activeImg.style.transform = `scaleX(${flipX * activeScale}) scaleY(${activeScale})`;
    setAnimatedSrc(activeImg, active.name, folder);
  }

  const benchEl = document.getElementById(`${side}-bench-sprites`);
  if (benchEl) {
    benchEl.innerHTML = '';
    benchEl.style.cssText = 'position:absolute;bottom:0;display:flex;flex-direction:row;z-index:2;'
      + (isEnemy ? 'right:0;' : 'left:0;');
    sideState.team.forEach((slot, idx) => {
      if (idx === sideState.activeIdx) return;
      const benchScale = getPokedexScale(slot.name);
      const wrap = document.createElement('div');
      wrap.style.cssText = 'margin-left:-14px;' + (idx === 0 ? 'margin-left:0;' : '');
      wrap.className = 'bench-sprite-wrap' + (slot.fainted ? ' fainted-bench' : '');
      const img = document.createElement('img');
      img.className = 'bench-side-img';
      img.style.transform = `scaleX(${isEnemy ? -benchScale : benchScale}) scaleY(${benchScale})`;
      img.alt   = slot.name;
      img.title = slot.name;
      img.onerror = () => { img.style.opacity = '0.1'; };
      setAnimatedSrc(img, slot.name, folder);
      wrap.appendChild(img);
      benchEl.appendChild(wrap);
    });
    if (benchEl.firstChild) benchEl.firstChild.style.marginLeft = '0';
  }
}

function renderTeamHpPanel(side, sideState) {
  const slot   = sideState.team[sideState.activeIdx];
  const pct    = slot.maxHp > 0 ? Math.max(0, slot.currentHp / slot.maxHp) : 0;
  const barCol = pct > 0.5 ? '#4ade80' : pct > 0.25 ? '#facc15' : '#f87171';
  const prefix = side === 'player' ? 'p' : 'e';

  const nameEl  = document.getElementById(`${prefix}-name`);
  const typesEl = document.getElementById(`${prefix}-types`);
  const barEl   = document.getElementById(`${prefix}-hp-bar`);
  const numsEl  = document.getElementById(`${prefix}-hp-nums`);

  if (nameEl)  nameEl.textContent = slot.name;
  if (typesEl) typesEl.innerHTML  = slot.types.map(typeBadge).join('');
  if (barEl)   { barEl.style.width = (pct * 100) + '%'; barEl.style.background = barCol; }
  if (numsEl)  numsEl.innerHTML = `${Math.max(0, slot.currentHp)} / ${slot.maxHp} HP`
    + (slot.status ? ` <span class="status-pip pip-${slot.status}">${slot.status.slice(0, 3).toUpperCase()}</span>` : '');

  const benchHpEl = document.getElementById(`${prefix}-bench-hp`);
  if (benchHpEl) {
    const isRight = side === 'enemy';
    benchHpEl.innerHTML = sideState.team.map((s, idx) => {
      if (idx === sideState.activeIdx) return '';
      const bpct = s.maxHp > 0 ? Math.max(0, s.currentHp / s.maxHp) : 0;
      const bCol = s.fainted ? '#444' : bpct > 0.5 ? '#4ade80' : bpct > 0.25 ? '#facc15' : '#f87171';
      const statusBadge = s.status
        ? ` <span class="status-pip pip-${s.status}" style="font-size:0.55rem;padding:0 3px">${s.status.slice(0, 3).toUpperCase()}</span>`
        : '';
      return `<div class="bench-hp-row${s.fainted ? ' bench-hp-fainted' : ''}"${isRight ? ' style="text-align:right"' : ''}>
        <div class="bench-hp-name">${s.name}${statusBadge}</div>
        <div class="bench-hp-bar-bg"><div class="bench-hp-bar-fill" style="width:${bpct * 100}%;background:${bCol}"></div></div>
      </div>`;
    }).join('');
  }
}

// ── Move description generator ────────────────────────────────────────────────
function getMoveDescription(move) {
  const lines = [];
  const cat = move.category;
  const type = (move.resolvedType || move.type || '').toLowerCase();

  if (cat === 'Status') {
    // Self-buff effects
    const selfBuffMap = {
      atk_up:    'Raises own ATK by 1 stage.',
      atk_up2:   'Sharply raises own ATK by 2 stages.',
      def_up:    'Raises own DEF by 1 stage.',
      def_up2:   'Sharply raises own DEF by 2 stages.',
      spd_up:    'Raises own SPD by 1 stage.',
      spd_up2:   'Sharply raises own SPD by 2 stages.',
      spAtk_up:  'Raises own SP.ATK by 1 stage.',
      spAtk_up2: 'Sharply raises own SP.ATK by 2 stages.',
      heal50:    'Restores 50% of max HP.',
    };
    // Foe-debuff or status effects
    const foeEffectMap = {
      burn:     'Inflicts Burn — deals 1/16 HP per turn, halves ATK.',
      poison:   'Inflicts Poison — deals 1/8 HP per turn.',
      freeze:   'Inflicts Freeze — target can\'t act; 25% chance to thaw each turn.',
      paralyze: 'Inflicts Paralysis — 25% chance to lose turn; SPD halved.',
      sleep:    'Inflicts Sleep — target can\'t act for 2–3 turns.',
      curse:    'Inflicts Curse — drains 1/12 HP per turn; can\'t be cured by switching.',
      soak:     'Inflicts Soak — halves SPD and reduces accuracy.',
      trapped:  'Inflicts Trapped — target can\'t switch out for 2–3 turns.',
      frenzy:   'Triggers Frenzy — forces random move use for 2–3 turns.',
      daze:     'Inflicts Daze — significantly reduces accuracy.',
      atk_down:    'Lowers foe\'s ATK by 1 stage.',
      atk_down2:   'Sharply lowers foe\'s ATK by 2 stages.',
      def_down:    'Lowers foe\'s DEF by 1 stage.',
      def_down2:   'Sharply lowers foe\'s DEF by 2 stages.',
      spd_down:    'Lowers foe\'s SPD by 1 stage.',
      spAtk_down:  'Lowers foe\'s SP.ATK by 1 stage.',
      accuracy_down: 'Lowers foe\'s accuracy by 2 stages.',
    };
    const tgt = move.effectTarget || 'foe';
    const eff = move.effect;
    if (eff) {
      const desc = tgt === 'self' ? selfBuffMap[eff] : foeEffectMap[eff];
      if (desc) lines.push(desc);
    }
  } else {
    // Damaging move — describe category and calc method
    const calcNote = cat === 'Physical'
      ? 'Physical — uses ATK vs DEF.'
      : 'Special — uses SP.ATK vs DEF.';
    lines.push(calcNote);

    // Priority note
    const pri = move.priority ?? 0;
    if (pri > 0)  lines.push(`+${pri} priority — acts before most moves.`);
    if (pri < 0)  lines.push(`${pri} priority — acts after most moves.`);

    // Secondary effect
    if (move.effect && (move.effectChance ?? 0) > 0) {
      const effectLabels = {
        burn:     `${move.effectChance}% chance to Burn (1/16 HP/turn, ATK halved).`,
        poison:   `${move.effectChance}% chance to Poison (1/8 HP/turn).`,
        freeze:   `${move.effectChance}% chance to Freeze (can't act).`,
        paralyze: `${move.effectChance}% chance to Paralyze (SPD halved, 25% to lose turn).`,
        sleep:    `${move.effectChance}% chance to Sleep (2–3 turns).`,
        curse:    `${move.effectChance}% chance to Curse (1/12 HP/turn, persists on switch).`,
        soak:     `${move.effectChance}% chance to Soak (SPD halved, accuracy reduced).`,
        trapped:  `${move.effectChance}% chance to Trap (can't switch for 2–3 turns).`,
        frenzy:   `${move.effectChance}% chance to trigger Frenzy (random moves for 2–3 turns).`,
        daze:     `${move.effectChance}% chance to Daze (accuracy reduced).`,
        def_down: `${move.effectChance}% chance to lower foe's DEF.`,
        atk_down: `${move.effectChance}% chance to lower foe's ATK.`,
        spd_down: `${move.effectChance}% chance to lower foe's SPD.`,
      };
      const label = effectLabels[move.effect];
      if (label) lines.push(label);
    }
  }

  // PP note
  lines.push(`PP: ${move.currentPP ?? move.pp} / ${move.pp}`);

  return lines.join(' ');
}

// ── Shared stat bar renderer for battle tooltips ──────────────────────────────
// Battle stats are scaled (battleStat(45) = 145), HP max is ~410 (battleHP(45))
const TIP_STAT_MAX = { HP: 410, ATK: 145, DEF: 145, 'SP.ATK': 145, SPD: 145 };
function statBarsHtml(stats) {
  return Object.entries(stats).map(([k, v]) => {
    const max = TIP_STAT_MAX[k] || 145;
    const pct = Math.min(100, (v / max) * 100);
    const col = pct > 66 ? '#4ade80' : pct > 33 ? '#facc15' : '#f87171';
    return `<div style="display:grid;grid-template-columns:46px 1fr 28px;align-items:center;gap:5px;margin-bottom:2px">
      <span style="font-size:10px;font-weight:600;color:var(--muted);text-transform:uppercase;text-align:right">${k}</span>
      <div style="height:5px;background:var(--surface2);border-radius:3px;overflow:hidden">
        <div style="width:${pct}%;height:100%;background:${col};border-radius:3px"></div>
      </div>
      <span style="font-size:11px;font-weight:600;text-align:right">${v}</span>
    </div>`;
  }).join('');
}

// ── Hover tooltips ────────────────────────────────────────────────────────────
export function showCreatureTip(side, evt, slotIdx) {
  if (_isTouch) return;
  const sideState = side === 'player' ? battle.player : battle.enemy;
  const slot = slotIdx !== undefined ? sideState.team[slotIdx] : sideState.team[sideState.activeIdx];
  const tip  = document.getElementById(`${side}-tip`);
  const pct  = Math.max(0, slot.currentHp / slot.maxHp);
  const barCol = pct > 0.5 ? '#4ade80' : pct > 0.25 ? '#facc15' : '#f87171';
  const statBattle = {
    HP: slot.maxHp,
    ATK: battleStat(slot.stats.atk || 10),
    DEF: battleStat(slot.stats.def || 10),
    'SP.ATK': battleStat(slot.stats.special || 10),
    SPD: battleStat(slot.stats.spd || 10),
  };
  const pdEntry = POKEDEX.find(x => x.name === slot.name);
  const tipId   = pdEntry ? String(pdEntry.id).padStart(3, '0') : '???';
  tip.innerHTML = `
    <div class="tip-name">${slot.name}</div>
    <div class="tip-id">#${tipId}</div>
    <div class="badge-row" style="margin-bottom:5px">${slot.types.map(typeBadge).join('')}</div>
    <div class="tip-hp-bar"><div class="tip-hp-fill" style="width:${pct * 100}%;background:${barCol}"></div></div>
    <div style="font-size:0.7rem;color:var(--muted);margin-bottom:6px">
      ${Math.max(0, slot.currentHp)} / ${slot.maxHp} HP
      ${slot.status ? `<span class="status-pip pip-${slot.status}">${slot.status.slice(0, 3).toUpperCase()}</span>` : ''}
    </div>
    ${statBarsHtml(statBattle)}
    <div style="margin-top:6px;font-size:0.68rem;color:var(--muted);letter-spacing:0.05em;margin-bottom:3px">MOVES</div>
    <div class="tip-moves">${slot.moves.slice(0, 4).map(m => `
      <div class="tip-move">
        <span style="font-weight:600">${m.name}</span>
        <span class="type-badge" style="background:${typeColor(m.resolvedType || m.type)};font-size:9px">${m.resolvedType || m.type}</span>
        ${m.category !== 'Status' ? `<span style="color:var(--muted)"> · ${m.power || '—'} pwr</span>` : '<span style="color:var(--muted)"> · status</span>'}
      </div>`).join('')}
    </div>`;
  const spriteEl = document.getElementById(`${side}-active-img`);
  const sr = spriteEl ? spriteEl.getBoundingClientRect() : null;
  tip.style.position = 'fixed';
  tip.style.top    = 'auto';
  if (sr) {
    const tipHeight = 320;
    const topPos = Math.max(8, sr.top + sr.height / 2 - tipHeight / 2);
    tip.style.bottom = 'auto';
    tip.style.top    = `${topPos}px`;
    if (side === 'player') {
      tip.style.left  = `${sr.right + 10}px`;
      tip.style.right = 'auto';
    } else {
      tip.style.right = `${window.innerWidth - sr.left + 10}px`;
      tip.style.left  = 'auto';
    }
  } else {
    tip.style.bottom = 'calc(100% + 8px)';
    tip.style.left   = side === 'player' ? '0' : 'auto';
    tip.style.right  = side === 'enemy'  ? '0' : 'auto';
  }
  tip.classList.remove('tip-hidden');
}

export function hideTip(side) {
  if (_isTouch) return;
  document.getElementById(`${side}-tip`)?.classList.add('tip-hidden');
}

// ── Move tooltip (floating, appended to body) ─────────────────────────────────
function getMoveTipEl() {
  let el = document.getElementById('move-hover-tip');
  if (!el) {
    el = document.createElement('div');
    el.id = 'move-hover-tip';
    el.className = 'creature-tooltip tip-hidden move-tooltip';
    el.style.cssText = 'position:fixed;z-index:200;pointer-events:none;max-width:220px;min-width:180px';
    document.body.appendChild(el);
  }
  return el;
}

function showMoveTip(move, anchorEl, enemy) {
  const tip = getMoveTipEl();
  const isExhausted = (move.currentPP ?? 0) <= 0;
  const typeClr = typeColor(move.resolvedType || move.type);
  const eff = move.category !== 'Status'
    ? getEffectiveness((move.resolvedType || move.type).toLowerCase(), enemy.types)
    : null;
  const effStr  = eff != null ? effLabel(eff) : '';
  const effClass = eff != null ? (eff >= 2 ? 'move-eff-super' : eff < 1 ? 'move-eff-weak' : '') : '';
  const ppColor = isExhausted ? '#c0614a' : (move.currentPP ?? move.pp) <= 2 ? '#facc15' : 'var(--muted)';

  tip.innerHTML = `
    <div style="display:flex;align-items:center;gap:5px;margin-bottom:5px">
      <span style="font-family:'Caesar Dressing',cursive;font-size:0.95rem;flex:1">${move.name}</span>
      <span class="type-badge" style="background:${typeClr};font-size:9px">${move.resolvedType || move.type}</span>
    </div>
    <div style="font-size:0.7rem;color:var(--muted);margin-bottom:6px">
      ${move.category}
      ${move.category !== 'Status' ? ` · <strong style="color:var(--text)">${move.power || '—'}</strong> pwr` : ''}
      ${move.accuracy != null ? ` · ${Math.round(move.accuracy * 100)}% acc` : ''}
      ${(move.priority ?? 0) !== 0 ? ` · <span style="color:${(move.priority??0)>0?'#4ade80':'#f87171'}">pri ${(move.priority??0)>0?'+':''}${move.priority}</span>` : ''}
    </div>
    ${effStr ? `<div style="font-size:0.7rem;margin-bottom:5px" class="move-eff-hint ${effClass}">${effStr}</div>` : ''}
    <div style="font-size:0.68rem;color:var(--text);line-height:1.5;margin-bottom:6px">${getMoveDescription(move)}</div>
    <div style="font-size:0.68rem;color:${ppColor};font-weight:600">
      PP: ${move.currentPP ?? move.pp} / ${move.pp}${isExhausted ? ' — no PP left!' : ''}
    </div>`;

  // Position: above the button, aligned to its left edge; flip to right if near screen edge
  const btnRect = anchorEl.getBoundingClientRect();
  const tipW = 220;
  const tipH = 170; // approximate
  let left = btnRect.left;
  if (left + tipW > window.innerWidth - 8) left = window.innerWidth - tipW - 8;
  const top = btnRect.top - tipH - 8;
  tip.style.left   = `${left}px`;
  tip.style.right  = 'auto';
  tip.style.top    = `${Math.max(8, top)}px`;
  tip.style.bottom = 'auto';
  tip.classList.remove('tip-hidden');
}

function hideMoveTip() {
  getMoveTipEl().classList.add('tip-hidden');
}

// ── Trainer speech bubble ─────────────────────────────────────────────────────
let _bubbleTimers = {};
function showTrainerBubble(side, text) {
  const trainerEl = document.getElementById(`${side}-trainer-img`);
  if (!trainerEl) return;
  const sideEl = trainerEl.closest('.battle-side');
  if (!sideEl) return;

  // Reuse or create the bubble element
  let bubble = sideEl.querySelector('.trainer-bubble');
  if (!bubble) {
    bubble = document.createElement('div');
    bubble.className = 'trainer-bubble';
    sideEl.appendChild(bubble);
  }

  bubble.textContent = text;
  // Force reflow so transition fires even on rapid re-triggers
  bubble.classList.remove('bubble-visible');
  void bubble.offsetWidth;
  bubble.classList.add('bubble-visible');

  // Clear any existing hide timer for this side
  clearTimeout(_bubbleTimers[side]);
  _bubbleTimers[side] = setTimeout(() => {
    bubble.classList.remove('bubble-visible');
  }, 2200);
}

// ── Action UI ─────────────────────────────────────────────────────────────────
export function switchBattleTab(tab) {
  currentBattleTab = tab;
  document.getElementById('tab-moves').classList.toggle('tab-active', tab === 'moves');
  document.getElementById('tab-switch').classList.toggle('tab-active', tab === 'switch');
  if (battle && !battle.waitingForOpponent) renderBattleActions();
}

export function renderBattleActions() {
  if (battle.isOver) return;
  if (currentBattleTab === 'moves') renderMoveButtons();
  else renderSwitchButtons();
}

function renderMoveButtons() {
  const panel  = document.getElementById('action-panel');
  const active = battle.player.team[battle.player.activeIdx];
  const enemy  = battle.enemy.team[battle.enemy.activeIdx];
  panel.innerHTML = '';
  active.moves.forEach(move => {
    const eff      = move.category !== 'Status' ? getEffectiveness(move.resolvedType || move.type.toLowerCase(), enemy.types) : 1;
    const effStr   = effLabel(eff);
    const effClass = eff >= 2 ? 'move-eff-super' : eff < 1 ? 'move-eff-weak' : '';
    const isOut    = (move.currentPP ?? 0) <= 0;
    const ppLow    = !isOut && (move.currentPP ?? move.pp) <= 2;
    const ppColor  = isOut ? '#c0614a' : ppLow ? '#facc15' : 'var(--muted)';
    const catClass = move.category === 'Physical' ? 'move-cat-physical'
                   : move.category === 'Special'  ? 'move-cat-special'
                   : 'move-cat-status';
    const catLabel = move.category === 'Physical' ? 'PHY'
                   : move.category === 'Special'  ? 'SPC'
                   : 'STA';
    const pwrStr   = move.category !== 'Status'
                   ? `<span class="move-stat"><strong>${move.power || '—'}</strong> PWR</span>` : '';
    const accStr   = `<span class="move-stat"><strong>${move.accuracy != null ? Math.round(move.accuracy * 100) + '%' : '—'}</strong> ACC</span>`;
    const priTag   = (move.priority ?? 0) !== 0
                   ? `<span style="color:${(move.priority??0)>0?'#4ade80':'#f87171'};font-size:0.62rem;flex-shrink:0">${(move.priority??0)>0?'▲':'▼'}PRI</span>`
                   : '';

    const btn = document.createElement('button');
    btn.className = 'move-btn' + (isOut ? ' move-btn-exhausted' : '');
    btn.disabled  = isOut;
    btn.innerHTML = `
      <div class="move-btn-top">
        <span style="width:9px;height:9px;border-radius:50%;flex-shrink:0;display:inline-block;background:${typeColor(move.resolvedType || move.type)}"></span>
        <span class="move-name">${move.name}</span>
        ${priTag}
      </div>
      <div class="move-btn-bottom">
        <span class="move-cat-badge ${catClass}">${catLabel}</span>
        ${pwrStr}
        ${accStr}
        ${effStr ? `<span class="move-eff-hint ${effClass}">${effStr}</span>` : ''}
      </div>`;
    if (!isOut) {
      btn.onclick = () => doPlayerAction({ type: 'move', moveName: move.name });
    }
    if (!_isTouch) {
      btn.addEventListener('mouseenter', () => showMoveTip(move, btn, enemy));
      btn.addEventListener('mouseleave', () => hideMoveTip());
    }
    panel.appendChild(btn);
  });
}

function renderSwitchButtons() {
  const panel = document.getElementById('action-panel');
  const enemy = battle.enemy.team[battle.enemy.activeIdx];
  panel.innerHTML = '';
  battle.player.team.forEach((slot, idx) => {
    if (idx === battle.player.activeIdx || slot.fainted) return;

    let bestEff = 1;
    slot.moves.forEach(m => {
      if (m.category === 'Status') return;
      const e = getEffectiveness((m.resolvedType || m.type).toLowerCase(), enemy.types);
      if (e > bestEff) bestEff = e;
    });
    let worstDef = 1;
    enemy.moves.forEach(m => {
      if (m.category === 'Status') return;
      const e = getEffectiveness((m.resolvedType || m.type).toLowerCase(), slot.types);
      if (e > worstDef) worstDef = e;
    });

    const offStr   = effLabel(bestEff);
    const offClass = bestEff >= 2 ? 'move-eff-super' : bestEff < 1 ? 'move-eff-weak' : '';
    const defStr   = worstDef >= 2 ? `▼ weak` : worstDef === 0 ? `✦ immune` : worstDef < 1 ? `▲ resists` : '';
    const defClass = worstDef >= 2 ? 'move-eff-weak' : (worstDef === 0 || worstDef < 1) ? 'move-eff-super' : '';

    const btn = document.createElement('button');
    btn.className = 'switch-btn';
    btn.innerHTML = `
      <img class="switch-thumb" src="front_thumb/${slot.name}.webp" onerror="this.style.opacity='0.1'" alt="">
      <div style="flex:1;min-width:0">
        <div style="font-size:0.85rem;font-weight:600;font-family:'Caesar Dressing',cursive;text-transform:capitalize">${slot.name}</div>
        <div style="font-size:0.7rem;color:var(--muted)">${slot.currentHp}/${slot.maxHp} HP · ${slot.types.map(typeBadge).join('')}</div>
        ${(offStr || defStr) ? `<div style="font-size:0.68rem;margin-top:2px;display:flex;gap:6px">
          ${offStr ? `<span class="move-eff-hint ${offClass}">⚔ ${offStr}</span>` : ''}
          ${defStr ? `<span class="move-eff-hint ${defClass}">${defStr}</span>` : ''}
        </div>` : ''}
      </div>`;
    btn.onclick = () => doPlayerAction({ type: 'switch', idx });
    if (!_isTouch) {
      btn.addEventListener('mouseenter', () => showSwitchTip(slot, btn));
      btn.addEventListener('mouseleave', () => hideSwitchTip());
    }
    panel.appendChild(btn);
  });
}

// ── Switch-tab tooltip ────────────────────────────────────────────────────────
function getSwitchTipEl() {
  let el = document.getElementById('switch-bench-tip');
  if (!el) {
    el = document.createElement('div');
    el.id = 'switch-bench-tip';
    el.className = 'creature-tooltip tip-hidden';
    el.style.cssText = 'position:fixed;z-index:200;pointer-events:none;max-width:230px;min-width:200px';
    document.body.appendChild(el);
  }
  return el;
}

function showSwitchTip(slot, anchorEl) {
  const tip    = getSwitchTipEl();
  const pct    = Math.max(0, slot.currentHp / slot.maxHp);
  const barCol = pct > 0.5 ? '#4ade80' : pct > 0.25 ? '#facc15' : '#f87171';
  const statBattle = {
    HP:       slot.maxHp,
    ATK:      battleStat(slot.stats.atk     || 10),
    DEF:      battleStat(slot.stats.def     || 10),
    'SP.ATK': battleStat(slot.stats.special || 10),
    SPD:      battleStat(slot.stats.spd     || 10),
  };
  const pdEntry2 = POKEDEX.find(x => x.name === slot.name);
  const tipId2   = pdEntry2 ? String(pdEntry2.id).padStart(3, '0') : '???';
  tip.innerHTML = `
    <div class="tip-name">${slot.name}</div>
    <div class="tip-id">#${tipId2}</div>
    <div class="badge-row" style="margin-bottom:5px">${slot.types.map(typeBadge).join('')}</div>
    <div class="tip-hp-bar"><div class="tip-hp-fill" style="width:${pct * 100}%;background:${barCol}"></div></div>
    <div style="font-size:0.7rem;color:var(--muted);margin-bottom:6px">
      ${Math.max(0, slot.currentHp)} / ${slot.maxHp} HP
      ${slot.status ? `<span class="status-pip pip-${slot.status}">${slot.status.slice(0,3).toUpperCase()}</span>` : ''}
    </div>
    ${statBarsHtml(statBattle)}
    <div style="margin-top:6px;font-size:0.68rem;color:var(--muted);letter-spacing:0.05em;margin-bottom:3px">MOVES</div>
    <div class="tip-moves">${slot.moves.slice(0, 4).map(m => `
      <div class="tip-move">
        <span style="font-weight:600">${m.name}</span>
        <span class="type-badge" style="background:${typeColor(m.resolvedType || m.type)};font-size:9px">${m.resolvedType || m.type}</span>
        ${m.category !== 'Status' ? `<span style="color:var(--muted)"> · ${m.power || '—'} pwr</span>` : '<span style="color:var(--muted)"> · status</span>'}
      </div>`).join('')}
    </div>`;
  const btnRect = anchorEl.getBoundingClientRect();
  tip.style.bottom = (window.innerHeight - btnRect.bottom) + 'px';
  tip.style.top    = 'auto';
  tip.style.right  = (window.innerWidth - btnRect.left + 10) + 'px';
  tip.style.left   = 'auto';
  tip.classList.remove('tip-hidden');
}

function hideSwitchTip() {
  getSwitchTipEl().classList.add('tip-hidden');
}

function setActionsWaiting() {
  document.getElementById('action-panel').innerHTML = '<div class="waiting-msg">Waiting for opponent…</div>';
}

// ── Move animations ───────────────────────────────────────────────────────────
const PUBLIC_MOVES = `${PUBLIC_PATH}moves/`;
const ANIM_DURATION = 550; // ms per sprite

function getMoveAnimData(moveName) {
  for (const group of Object.values(MOVES_DB)) {
    for (const m of group) {
      if (m.name.toLowerCase() === moveName.toLowerCase()) {
        if (!m.sprite) return null;
        return {
          sprite: m.sprite,
          target: (m.target || 'enemy').toLowerCase(),
          count:  Math.min(4, Math.max(1, parseInt(m.count) || 1)),
          rotate: (m.rotate || 'n').toLowerCase() === 'y',
        };
      }
    }
  }
  return null;
}

function getSpriteRect(side) {
  const el = document.getElementById(`${side}-active-img`);
  if (!el) return { x: window.innerWidth / 2, y: window.innerHeight / 2, w: 80, h: 80 };
  const r = el.getBoundingClientRect();
  return {
    x: r.left + r.width / 2,
    y: r.top  + r.height / 2,
    w: r.width,
    h: r.height,
  };
}

function flashHit(side) {
  const r    = getSpriteRect(side);
  const size = Math.max(r.w, r.h) * 1.4;
  const div  = document.createElement('div');
  div.className = 'hit-flash';
  div.style.width  = `${size}px`;
  div.style.height = `${size}px`;
  div.style.left   = `${r.x - size / 2}px`;
  div.style.top    = `${r.y - size / 2}px`;
  document.body.appendChild(div);
  div.addEventListener('animationend', () => div.remove(), { once: true });
}

function playMoveAnim(moveName, attackerSide) {
  const anim = getMoveAnimData(moveName);
  if (!anim) return Promise.resolve();

  const defenderSide = attackerSide === 'player' ? 'enemy' : 'player';
  const isProjectile = anim.target === 'projectile';
  const spawnSide    = isProjectile ? attackerSide
                     : anim.target === 'self' ? attackerSide
                     : defenderSide;

  const spawnRect  = getSpriteRect(spawnSide);
  const targetRect = isProjectile ? getSpriteRect(defenderSide) : null;

  const spriteUrl = `${PUBLIC_MOVES}${anim.sprite.toLowerCase()}.webp`;
  const flip      = attackerSide === 'enemy';
  const promises  = [];

  for (let i = 0; i < anim.count; i++) {
    promises.push(new Promise(resolve => {
      const delay = i * 120;
      setTimeout(() => {
        const wrap = document.createElement('div');
        wrap.style.cssText = 'position:fixed;z-index:500;pointer-events:none;width:192px;height:192px;'
          + `left:${spawnRect.x - 96 + (i - (anim.count - 1) / 2) * 18}px;`
          + `top:${spawnRect.y - 96 + i * -10}px;`
          + (flip ? 'transform:scaleX(-1);' : '');

        const img = document.createElement('img');
        img.className = 'move-anim-sprite';
        img.src = spriteUrl;
        img.onerror = () => img.style.display = 'none';

        if (isProjectile && targetRect) {
          const dx = flip ? -(targetRect.x - spawnRect.x) : (targetRect.x - spawnRect.x);
          const dy = targetRect.y - spawnRect.y;
          img.style.setProperty('--proj-dx', `${dx}px`);
          img.style.setProperty('--proj-dy', `${dy}px`);
          const kf = anim.rotate
            ? `anim-projectile-${attackerSide}-rotate`
            : `anim-projectile-${attackerSide}`;
          img.style.animation = `${kf} ${ANIM_DURATION}ms ease-in forwards`;
        } else {
          const kf       = anim.rotate ? 'anim-hit-flip-rotate' : 'anim-hit-flip';
          const kfNormal = anim.rotate ? 'anim-hit-rotate'      : 'anim-hit';
          img.style.animation = `${flip ? kf : kfNormal} ${ANIM_DURATION}ms ease-out forwards`;
        }

        wrap.appendChild(img);
        document.body.appendChild(wrap);
        img.addEventListener('animationend', () => { wrap.remove(); resolve(); }, { once: true });
        setTimeout(() => { wrap.remove(); resolve(); }, ANIM_DURATION + delay + 500);
      }, delay);
    }));
  }

  return Promise.all(promises);
}

// ── Player action dispatch ────────────────────────────────────────────────────
async function doPlayerAction(action) {
  if (battle.isOver) return;
  hideMoveTip();
  hideSwitchTip();

  // Increment turn and inject a header before this turn's log lines
  turnNumber++;
  logTurnHeader(turnNumber);

  const logger = (msg, cls, ctx) => logBattle(msg, cls, ctx);

  if (!isSolo && ws) {
    ws.send(JSON.stringify({ type: 'battle_action', action }));
    battle.waitingForOpponent = true;
    battle.pendingAction = action;
    setActionsWaiting();
  } else {
    if (action.type === 'move') {
      showTrainerBubble('player', action.moveName + '!');
      await playMoveAnim(action.moveName, 'player');
    }
    const enemyHpBefore = battle.enemy.team[battle.enemy.activeIdx].currentHp;
    executeAction('player', action, battle, logger);
    if (battle.enemy.team[battle.enemy.activeIdx].currentHp < enemyHpBefore) flashHit('enemy');
    renderBattle();

    if (!battle.isOver) {
      await new Promise(r => setTimeout(r, 350));
      const aiAction = getAIAction(battle);
      if (aiAction.type === 'move') {
        showTrainerBubble('enemy', aiAction.moveName + '!');
        await playMoveAnim(aiAction.moveName, 'enemy');
      }
      const playerHpBefore = battle.player.team[battle.player.activeIdx].currentHp;
      executeAction('enemy', aiAction, battle, logger);
      if (battle.player.team[battle.player.activeIdx].currentHp < playerHpBefore) flashHit('player');
      renderBattle();
      if (battle.isOver) {
        finishBattle(battle.isOver);
      } else {
        renderBattleActions();
      }
    } else {
      finishBattle(battle.isOver);
    }
  }
}

export function processOpponentAction(msg) {
  const myAct  = battle.pendingAction;
  const oppAct = msg.action;
  battle.pendingAction = null;
  battle.waitingForOpponent = false;
  turnNumber++;
  logTurnHeader(turnNumber);
  const logger = (m, c, ctx) => logBattle(m, c, ctx);
  const ps = battle.player.team[battle.player.activeIdx];
  const es = battle.enemy.team[battle.enemy.activeIdx];
  const spdMod = s => (s.status === 'paralyze' || s.status === 'soak') ? 0.5 : 1;
  const mySpd  = battleStat(ps.stats.spd || 10) * stageMultiplier(ps.stages.spd) * spdMod(ps);
  const oppSpd = battleStat(es.stats.spd || 10) * stageMultiplier(es.stages.spd) * spdMod(es);
  if (mySpd >= oppSpd) { executeAction('player', myAct, battle, logger); if (!battle.isOver) executeAction('enemy', oppAct, battle, logger); }
  else                  { executeAction('enemy', oppAct, battle, logger); if (!battle.isOver) executeAction('player', myAct, battle, logger); }
  renderBattle();
  if (battle.isOver) finishBattle(); else renderBattleActions();
}

// ── End-of-battle ─────────────────────────────────────────────────────────────
function finishBattle(result) {
  const playerAlive = battle.player.team.some(s => !s.fainted);
  const win = playerAlive;
  const reward = win ? 150 + Math.floor(Math.random() * 100) : 30;
  addCoins(reward);

  if (!isSolo && ws) ws.send(JSON.stringify({ type: 'battle_over', result: win ? 'win' : 'lose' }));

  const save = getSave();
  document.getElementById('result-title').textContent = win ? 'Victory!' : 'Defeated';
  document.getElementById('result-title').className   = 'result-title ' + (win ? 'win-title' : 'lose-title');
  document.getElementById('result-sub').textContent   = win ? 'Your team won the battle!' : 'Better luck next time.';
  document.getElementById('result-coins').textContent = `+${reward} ⬡ coins (Total: ${save.coins})`;
  setTimeout(() => showScreen('result'), 900);
}

// ── Battle log ────────────────────────────────────────────────────────────────

// Status full names for richer messages
const STATUS_NAMES = {
  burn:     'Burn',
  poison:   'Poison',
  freeze:   'Freeze',
  paralyze: 'Paralysis',
  sleep:    'Sleep',
  curse:    'Curse',
  soak:     'Soak',
  trapped:  'Trapped',
  frenzy:   'Frenzy',
  daze:     'Daze',
};

// Status effect descriptions for "already affected" context
const STATUS_EFFECTS = {
  burn:     'loses 1/16 HP/turn, ATK halved',
  poison:   'loses 1/8 HP/turn',
  freeze:   'can\'t act, 25% thaw each turn',
  paralyze: 'SPD halved, 25% to lose turn',
  sleep:    'can\'t act for 2–3 turns',
  curse:    'loses 1/12 HP/turn, persists on switch',
  soak:     'SPD halved, accuracy reduced',
  trapped:  'can\'t switch out for 2–3 turns',
  frenzy:   'forced random moves for 2–3 turns',
  daze:     'accuracy sharply reduced',
};

function logTurnHeader(turn) {
  const log = document.getElementById('battle-log');
  const el  = document.createElement('div');
  el.className = 'log-turn-header';
  el.textContent = `— Turn ${turn} —`;
  log.appendChild(el);
  log.scrollTop = log.scrollHeight;
}

// ctx is an optional object carrying extra detail: { dmg, status, maxHp, stageStat, stageDir }
export function logBattle(msg, cls = '', ctx = {}) {
  const log  = document.getElementById('battle-log');
  const line = document.createElement('div');
  line.className = 'log-line' + (cls ? ' ' + cls : '');

  // Enrich messages that battle.js emits
  let rich = msg;

  // "X took N damage!" — add % of max HP
  if (ctx.dmg != null && ctx.maxHp && /took \d+ damage/.test(msg)) {
    const pct = Math.round((ctx.dmg / ctx.maxHp) * 100);
    rich = msg.replace(/took (\d+) damage/, `took ${ctx.dmg} damage (${pct}% of max HP)`);
  }

  // "X was hurt by Y! (N)" / "X is wracked by the curse! (N)" — explain damage and % of max HP
  const statusDmgMatch = msg.match(/^(.+?) (was hurt by (the burn|poison)|is wracked by the curse)! \((\d+)\)$/);
  if (statusDmgMatch) {
    const name   = statusDmgMatch[1];
    const rawSrc = statusDmgMatch[2]; // "was hurt by the burn" | "was hurt by poison" | "is wracked by the curse"
    const dmgAmt = parseInt(statusDmgMatch[4]);
    const sourceKey = rawSrc.includes('burn') ? 'burn' : rawSrc.includes('curse') ? 'curse' : 'poison';
    const pctNote = ctx.maxHp ? ` — ${Math.round((dmgAmt / ctx.maxHp) * 100)}% of max HP` : '';
    rich = `${name} took ${dmgAmt} damage from ${STATUS_NAMES[sourceKey]}${pctNote}.`;
  }

  // "X was hurt by recoil (N)!" — explain recoil
  const recoilMatch = msg.match(/^(.+?) was hurt by recoil \((\d+)\)!$/);
  if (recoilMatch) {
    const pctNote = ctx.maxHp ? ` — ${Math.round((parseInt(recoilMatch[2]) / ctx.maxHp) * 100)}% of max HP` : '';
    rich = `${recoilMatch[1]} took ${recoilMatch[2]} recoil damage${pctNote}.`;
  }

  // "X is already affected!" — add what status they already have
  if (/is already affected!$/.test(msg) && ctx.existingStatus) {
    const sname = STATUS_NAMES[ctx.existingStatus] || ctx.existingStatus;
    const sdesc = STATUS_EFFECTS[ctx.existingStatus] || '';
    rich = msg.replace('is already affected!', `already has ${sname}${sdesc ? ` (${sdesc})` : ''}!`);
  }

  // "X's stat rose/fell!" — add current stage value
  if (ctx.stageStat != null && ctx.stageVal != null) {
    const sign = ctx.stageVal >= 0 ? '+' : '';
    rich = msg.replace(/(rose|fell)( sharply)?!/, `$1$2 (stage ${sign}${ctx.stageVal})!`);
  }

  // "X was burned/poisoned/frozen/..." — add brief effect note
  const inflictMatch = msg.match(/^(.+) was (burned|poisoned|frozen|paralyzed|put to sleep|cursed|soaked|trapped|sent into a frenzy|dazed)!$/);
  if (inflictMatch) {
    const statusWord = inflictMatch[2];
    const keyMap = {
      'burned': 'burn', 'poisoned': 'poison', 'frozen': 'freeze',
      'paralyzed': 'paralyze', 'put to sleep': 'sleep', 'cursed': 'curse',
      'soaked': 'soak', 'trapped': 'trapped', 'sent into a frenzy': 'frenzy', 'dazed': 'daze',
    };
    const key = keyMap[statusWord];
    if (key && STATUS_EFFECTS[key]) {
      rich = `${msg} (${STATUS_EFFECTS[key]})`;
    }
  }

  line.textContent = rich;
  log.appendChild(line);
  log.scrollTop = log.scrollHeight;
}
