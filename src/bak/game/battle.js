import { MOVES_DB, POKEDEX } from './data.js';
import { getEffectiveness, battleHP, battleStat, stageMultiplier, shuffle, effLabel } from '../shared/helpers.js';

// ── Flat move lookup (built once from MOVES_DB on first use) ─────────────────
let _movesByName = null;
function getMovesByName() {
  if (_movesByName) return _movesByName;
  _movesByName = {};
  for (const group of Object.values(MOVES_DB)) {
    for (const m of group) {
      if (m.name) _movesByName[m.name.toLowerCase()] = m;
    }
  }
  return _movesByName;
}

// ── Slot factory ──────────────────────────────────────────────────────────────
export function makeSlot(name) {
  const c = POKEDEX.find(x => x.name === name);
  const hp = battleHP(c.stats.hp || 10);
  const byName = getMovesByName();
  const primaryType = c.types[0];
  // c.moves is now a flat array of move names
  const resolvedMoves = (c.moves || [])
    .map(moveName => {
      const m = byName[moveName.toLowerCase()];
      if (!m) return null;
      return {
        ...m,
        resolvedType: m.type === 'Flex' ? primaryType : m.type.toLowerCase(),
        currentPP: Number(m.pp),
      };
    })
    .filter(Boolean);
  return {
    name,
    types:        c.types,
    stats:        c.stats,
    maxHp:        hp,
    currentHp:    hp,
    moves:        resolvedMoves,
    stages:       { atk: 0, def: 0, special: 0, spd: 0 },
    status:       null,
    sleepTurns:   0,
    frenzTurns:   0,
    trappedTurns: 0,
    fainted:      false,
  };
}

// ── Battle init ───────────────────────────────────────────────────────────────
export function initBattle(myTeam, oppTeam) {
  return {
    player: { team: myTeam.map(makeSlot), activeIdx: 0 },
    enemy:  { team: oppTeam.map(makeSlot), activeIdx: 0 },
    isOver: false,
    waitingForOpponent: false,
    pendingAction: null,
  };
}

// ── Damage calc ───────────────────────────────────────────────────────────────
// Physical: atk vs def. Special: special vs def (no sp.def — intentional).
export function calcDamage(attSlot, defSlot, move) {
  if (!move || move.category === 'Status' || !move.power) return 0;
  const isPhys = move.category === 'Physical';
  const atkBase = isPhys ? attSlot.stats.atk     : attSlot.stats.special;
  const defBase = defSlot.stats.def; // always def — no sp.def stat in this game
  let atk = battleStat(atkBase || 10) * stageMultiplier(attSlot.stages[isPhys ? 'atk' : 'special']);
  let def = battleStat(defBase || 10) * stageMultiplier(defSlot.stages.def);
  if (attSlot.status === 'burn' && isPhys) atk *= 0.5;
  const eff  = getEffectiveness(move.resolvedType || move.type.toLowerCase(), defSlot.types);
  const stab = attSlot.types.includes((move.resolvedType || move.type).toLowerCase()) ? 1.5 : 1;
  const crit = Math.random() < 0.0625 ? 1.5 : 1;
  const rand = 0.85 + Math.random() * 0.15;
  return Math.max(1, Math.floor(((2 * 50 / 5 + 2) * move.power * atk / def / 50 + 2) * stab * eff * crit * rand));
}

// ── Action ordering ───────────────────────────────────────────────────────────
// Returns true if player should act first given both chosen actions.
export function playerGoesFirst(playerAction, enemyAction, playerSlot, enemySlot) {
  // Switches always go before moves
  if (playerAction.type === 'switch' && enemyAction.type !== 'switch') return true;
  if (enemyAction.type === 'switch' && playerAction.type !== 'switch') return false;

  const pMove = playerAction.type === 'move'
    ? playerSlot.moves.find(m => m.name === playerAction.moveName)
    : null;
  const eMove = enemyAction.type === 'move'
    ? enemySlot.moves.find(m => m.name === enemyAction.moveName)
    : null;

  const pPriority = pMove?.priority ?? 0;
  const ePriority = eMove?.priority ?? 0;

  if (pPriority !== ePriority) return pPriority > ePriority;

  // Speed tiebreak — factor in paralysis
  const pSpd = battleStat(playerSlot.stats.spd || 10)
    * stageMultiplier(playerSlot.stages.spd)
    * (playerSlot.status === 'paralyze' || playerSlot.status === 'soak' ? 0.5 : 1);
  const eSpd = battleStat(enemySlot.stats.spd || 10)
    * stageMultiplier(enemySlot.stages.spd)
    * (enemySlot.status === 'paralyze' || enemySlot.status === 'soak' ? 0.5 : 1);

  if (pSpd !== eSpd) return pSpd > eSpd;
  return Math.random() < 0.5;
}

// ── AI ────────────────────────────────────────────────────────────────────────
export function getAIAction(battle) {
  const es = battle.enemy;
  const active = es.team[es.activeIdx];
  const target = battle.player.team[battle.player.activeIdx];

  // Switch if very low HP and a live bench exists
  if (active.currentHp / active.maxHp < 0.2) {
    const bench = es.team.filter((s, i) => i !== es.activeIdx && !s.fainted);
    if (bench.length) {
      const pick = bench[Math.floor(Math.random() * bench.length)];
      return { type: 'switch', idx: es.team.indexOf(pick) };
    }
  }

  // Filter moves with remaining PP
  const usable = active.moves.filter(m => (m.currentPP ?? 0) > 0);
  if (!usable.length) return { type: 'move', moveName: '__struggle__' };

  // Separate into status and damaging
  const statusMoves   = usable.filter(m => m.category === 'Status');
  const damagingMoves = usable.filter(m => m.category !== 'Status');

  // Score damaging moves
  let best = null;
  let bestScore = -1;

  damagingMoves.forEach(m => {
    const eff  = getEffectiveness(m.resolvedType || m.type.toLowerCase(), target.types);
    const stab = active.types.includes((m.resolvedType || m.type).toLowerCase()) ? 1.5 : 1;
    // Slight bonus for priority moves when target is faster
    const priorityBonus = (m.priority ?? 0) > 0 ? 1.15 : 1;
    const score = (m.power || 0) * eff * stab * priorityBonus;
    if (score > bestScore) { bestScore = score; best = m; }
  });

  // Consider a status move if target doesn't already have a status
  // and we haven't found a very strong attacking option
  if (statusMoves.length && !target.status && Math.random() < 0.25) {
    const pick = statusMoves[Math.floor(Math.random() * statusMoves.length)];
    return { type: 'move', moveName: pick.name };
  }

  // Use self-buff status if we're healthy and no good attacking play
  if (statusMoves.length && active.currentHp / active.maxHp > 0.6 && Math.random() < 0.2) {
    const selfBuffs = statusMoves.filter(m => m.effectTarget === 'self');
    if (selfBuffs.length) {
      return { type: 'move', moveName: selfBuffs[Math.floor(Math.random() * selfBuffs.length)].name };
    }
  }

  if (!best) {
    // Only status moves available and we chose not to use them above — just use one
    return { type: 'move', moveName: usable[0].name };
  }

  return { type: 'move', moveName: best.name };
}

// ── Effect application ────────────────────────────────────────────────────────
export function applyEffect(effect, target, attSlot, defSlot, chance, log) {
  if (Math.random() * 100 > chance) return;
  const tgt = target === 'self' ? attSlot : defSlot;

  // ── Stat stage effects ────────────────────────────────────────────────────
  const stageMap = {
    atk_up:       ['atk',     1,  true],
    atk_up2:      ['atk',     2,  true],
    def_up:       ['def',     1,  true],
    def_up2:      ['def',     2,  true],
    spd_up:       ['spd',     1,  true],
    spd_up2:      ['spd',     2,  true],
    spAtk_up:     ['special', 1,  true],
    spAtk_up2:    ['special', 2,  true],
    atk_down:     ['atk',     1,  false],
    atk_down2:    ['atk',     2,  false],
    def_down:     ['def',     1,  false],
    def_down2:    ['def',     2,  false],
    spd_down:     ['spd',     1,  false],
    spd_down2:    ['spd',     2,  false],
    spAtk_down:   ['special', 1,  false],
    spDef_down:   ['special', 1,  false],
    accuracy_down: [null,     1,  false],
  };

  if (effect in stageMap) {
    const [stat, delta, up] = stageMap[effect];
    if (!stat) {
      log(`${tgt.name}'s accuracy fell!`, 'log-status');
      return;
    }
    tgt.stages[stat] = Math.max(-6, Math.min(6, (tgt.stages[stat] || 0) + (up ? delta : -delta)));
    log(`${tgt.name}'s ${stat} ${up ? 'rose' : 'fell'}${delta === 2 ? ' sharply' : ''}!`, 'log-status',
      { stageStat: stat, stageVal: tgt.stages[stat] });
    return;
  }

  // ── Heal ──────────────────────────────────────────────────────────────────
  if (effect === 'heal50') {
    const h = Math.floor(tgt.maxHp * 0.5);
    tgt.currentHp = Math.min(tgt.maxHp, tgt.currentHp + h);
    log(`${tgt.name} restored HP!`, 'log-heal');
    return;
  }

  // ── Status conditions ─────────────────────────────────────────────────────
  const statusLabels = {
    burn:     'burned',
    sleep:    'put to sleep',
    poison:   'poisoned',
    paralyze: 'paralyzed',
    freeze:   'frozen',
    curse:    'cursed',
    soak:     'soaked',
    trapped:  'trapped',
    frenzy:   'sent into a frenzy',
    daze:     'dazed',
  };

  if (effect in statusLabels) {
    if (tgt.status) { log(`${tgt.name} is already affected!`, '', { existingStatus: tgt.status }); return; }
    tgt.status = effect;
    if (effect === 'sleep')   tgt.sleepTurns  = 2 + Math.floor(Math.random() * 2); // 2–3 turns
    if (effect === 'frenzy')  tgt.frenzTurns  = 2 + Math.floor(Math.random() * 2);
    if (effect === 'trapped') tgt.trappedTurns = 2 + Math.floor(Math.random() * 2);
    log(`${tgt.name} was ${statusLabels[effect]}!`, 'log-status');
  }
}

// ── Struggle ──────────────────────────────────────────────────────────────────
function useStruggle(attSlot, defSlot, attState, defState, side, battle, log) {
  log(`${attSlot.name} has no moves left and used Struggle!`, 'log-status');
  // Fixed 40 damage to foe, no type
  defSlot.currentHp = Math.max(0, defSlot.currentHp - 40);
  log(`${defSlot.name} took 40 damage!`, 'log-dmg');
  // Recoil: 1/4 max HP to self
  const recoil = Math.max(1, Math.floor(attSlot.maxHp / 4));
  attSlot.currentHp = Math.max(0, attSlot.currentHp - recoil);
  log(`${attSlot.name} was hurt by recoil (${recoil})!`, 'log-dmg');
  _checkFaints(attSlot, defSlot, attState, defState, side, battle, log);
}

// ── Faint + replacement logic ─────────────────────────────────────────────────
function _checkFaints(attSlot, defSlot, attState, defState, side, battle, log) {
  if (defSlot.currentHp <= 0 && !defSlot.fainted) {
    defSlot.fainted = true;
    log(`${defSlot.name} fainted!`, 'log-highlight');
    const next = defState.team.findIndex((s, i) => !s.fainted && i !== defState.activeIdx);
    if (next === -1) {
      endBattle(side === 'player' ? 'win' : 'lose', battle, log);
    } else {
      defState.activeIdx = next;
      log(`${defState.team[defState.activeIdx].name} was sent in!`);
    }
  }
  if (attSlot.currentHp <= 0 && !attSlot.fainted) {
    attSlot.fainted = true;
    log(`${attSlot.name} fainted!`, 'log-highlight');
    const next = attState.team.findIndex((s, i) => !s.fainted && i !== attState.activeIdx);
    if (next === -1) {
      endBattle(side === 'player' ? 'lose' : 'win', battle, log);
    } else {
      attState.activeIdx = next;
      log(`${attState.team[attState.activeIdx].name} was sent in!`);
    }
  }
}

// ── Execute one action ────────────────────────────────────────────────────────
// Mutates battle state in place.
export function executeAction(side, action, battle, log) {
  if (battle.isOver) return;
  const attState = side === 'player' ? battle.player : battle.enemy;
  const defState = side === 'player' ? battle.enemy  : battle.player;
  const label    = side === 'player' ? 'You' : 'Foe';
  const attSlot  = attState.team[attState.activeIdx];

  // ── Switch ────────────────────────────────────────────────────────────────
  if (action.type === 'switch') {
    // Trapped creatures cannot switch out (unless being forced by a faint replacement)
    if (attSlot.status === 'trapped') {
      log(`${attSlot.name} is trapped and can't switch out!`, 'log-status');
      return;
    }
    const newSlot = attState.team[action.idx];
    log(`${label} switched to ${newSlot.name}!`);
    attState.activeIdx = action.idx;
    return;
  }

  // ── Move ──────────────────────────────────────────────────────────────────
  if (action.type === 'move') {
    const defSlot = defState.team[defState.activeIdx];

    // Struggle if sentinel name used or all PP gone
    const allOut = attSlot.moves.every(m => (m.currentPP ?? 0) <= 0);
    if (action.moveName === '__struggle__' || allOut) {
      useStruggle(attSlot, defSlot, attState, defState, side, battle, log);
      _applyEndOfTurnStatus(attSlot, attState, defState, side, battle, log);
      return;
    }

    const move = attSlot.moves.find(m => m.name === action.moveName);
    if (!move) return;

    // PP guard
    if ((move.currentPP ?? 0) <= 0) {
      log(`${attSlot.name} has no PP left for ${move.name}!`, 'log-status');
      return;
    }

    // ── Pre-turn status checks ────────────────────────────────────────────
    if (attSlot.status === 'sleep') {
      attSlot.sleepTurns--;
      if (attSlot.sleepTurns <= 0) {
        attSlot.status = null;
        log(`${attSlot.name} woke up!`, 'log-status');
        // Still acts this turn after waking
      } else {
        log(`${attSlot.name} is fast asleep!`, 'log-status');
        return;
      }
    }

    if (attSlot.status === 'freeze') {
      if (Math.random() < 0.25) {
        attSlot.status = null;
        log(`${attSlot.name} thawed out!`, 'log-status');
        // Still acts this turn
      } else {
        log(`${attSlot.name} is frozen solid!`, 'log-status');
        return;
      }
    }

    if (attSlot.status === 'paralyze' && Math.random() < 0.25) {
      log(`${attSlot.name} is paralyzed and can't move!`, 'log-status');
      return;
    }

    // Frenzy: override move selection to a random available move
    let activeMove = move;
    if (attSlot.status === 'frenzy') {
      attSlot.frenzTurns--;
      if (attSlot.frenzTurns <= 0) {
        attSlot.status = null;
        log(`${attSlot.name} snapped out of its frenzy!`, 'log-status');
      } else {
        const available = attSlot.moves.filter(m => (m.currentPP ?? 0) > 0);
        if (available.length) {
          activeMove = available[Math.floor(Math.random() * available.length)];
          log(`${attSlot.name} is in a frenzy! It used ${activeMove.name}!`, 'log-status');
        }
        // Frenzy move still runs below; fall through
      }
    }

    // Deduct PP
    activeMove.currentPP = Math.max(0, (activeMove.currentPP ?? 0) - 1);

    log(`${attSlot.name} used ${activeMove.name}!`, 'log-hit');

    // Accuracy check (Status moves with null accuracy always hit)
    if (activeMove.accuracy != null && Math.random() > activeMove.accuracy) {
      // Daze reduces accuracy further — already baked in by having accuracy field,
      // but we apply an extra miss chance if the attacker is dazed
      log('But it missed!');
      return;
    }

    // Extra miss chance if attacker is dazed
    if (attSlot.status === 'daze' && Math.random() < 0.33) {
      log(`${attSlot.name} is dazed and fumbled the move!`, 'log-status');
      return;
    }

    // ── Status moves ──────────────────────────────────────────────────────
    if (activeMove.category === 'Status') {
      applyEffect(
        activeMove.effect,
        activeMove.effectTarget || 'foe',
        attSlot,
        defSlot,
        activeMove.effectChance ?? 100,
        log
      );
    } else {
      // ── Damaging moves ───────────────────────────────────────────────────
      const eff = getEffectiveness(activeMove.resolvedType || activeMove.type.toLowerCase(), defSlot.types);
      const el  = effLabel(eff);
      if (el) log(el, eff >= 2 ? 'log-hit' : 'log-dmg');
      const dmg = calcDamage(attSlot, defSlot, activeMove);
      defSlot.currentHp = Math.max(0, defSlot.currentHp - dmg);
      log(`${defSlot.name} took ${dmg} damage!`, 'log-dmg', { dmg, maxHp: defSlot.maxHp });

      // Secondary effect on hit
      if (activeMove.effect && (activeMove.effectChance ?? 0) > 0) {
        applyEffect(
          activeMove.effect,
          activeMove.effectTarget || 'foe',
          attSlot,
          defSlot,
          activeMove.effectChance,
          log
        );
      }

      _checkFaints(attSlot, defSlot, attState, defState, side, battle, log);
    }

    // ── End-of-turn status damage / effects ───────────────────────────────
    if (!battle.isOver) {
      _applyEndOfTurnStatus(attSlot, attState, defState, side, battle, log);
    }

    // ── Tick trapped turns ────────────────────────────────────────────────
    if (attSlot.status === 'trapped') {
      attSlot.trappedTurns--;
      if (attSlot.trappedTurns <= 0) {
        attSlot.status = null;
        log(`${attSlot.name} broke free!`, 'log-status');
      }
    }
  }
}

// ── End-of-turn status handler ────────────────────────────────────────────────
function _applyEndOfTurnStatus(attSlot, attState, defState, side, battle, log) {
  if (battle.isOver || attSlot.fainted) return;

  switch (attSlot.status) {
    case 'burn': {
      const d = Math.max(1, Math.floor(attSlot.maxHp / 16));
      attSlot.currentHp = Math.max(0, attSlot.currentHp - d);
      log(`${attSlot.name} was hurt by the burn! (${d})`, 'log-dmg', { maxHp: attSlot.maxHp });
      break;
    }
    case 'poison': {
      const d = Math.max(1, Math.floor(attSlot.maxHp / 8));
      attSlot.currentHp = Math.max(0, attSlot.currentHp - d);
      log(`${attSlot.name} was hurt by poison! (${d})`, 'log-dmg', { maxHp: attSlot.maxHp });
      break;
    }
    case 'curse': {
      const d = Math.max(1, Math.floor(attSlot.maxHp / 12));
      attSlot.currentHp = Math.max(0, attSlot.currentHp - d);
      log(`${attSlot.name} is wracked by the curse! (${d})`, 'log-dmg', { maxHp: attSlot.maxHp });
      break;
    }
    // soak, trapped, frenzy, daze, paralyze, sleep, freeze have no per-turn damage
    // (their effects are handled in pre-turn checks or stat modifications)
    default:
      break;
  }

  // Check for faint from status damage
  if (attSlot.currentHp <= 0 && !attSlot.fainted) {
    attSlot.fainted = true;
    log(`${attSlot.name} fainted!`, 'log-highlight');
    const next = attState.team.findIndex((s, i) => !s.fainted && i !== attState.activeIdx);
    if (next === -1) {
      endBattle(side === 'player' ? 'lose' : 'win', battle, log);
    } else {
      attState.activeIdx = next;
      log(`${attState.team[attState.activeIdx].name} was sent in!`);
    }
  }
}

// ── End battle ────────────────────────────────────────────────────────────────
export function endBattle(result, battle, log) {
  battle.isOver = true;
  log(result === 'win' ? 'You won!' : 'You were defeated.', 'log-highlight');
  return result;
}
