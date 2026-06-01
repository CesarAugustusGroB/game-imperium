/**
 * Iter Belli — decisive stance battle engine.
 *
 * Faithful port of the prototype's v2 battle: you attack (d6), the enemy defends
 * (d8); stances are gated by discipline; the AI follows a doctrine; encirclement
 * and morale collapse decide the field. Instant-resolution, one round per player
 * stance choice. Imports campaign state read/write from iter-belli-state.ts
 * (which never imports back), so there is no dependency cycle.
 */

import { signal } from '@preact/signals';
import * as B from './iter-belli-balance';
import { applyBattleOutcome, iterBelliState } from './iter-belli-state';
import { getActiveScenario } from './iter-belli-scenario';
import type {
  BattleArmy, BattleState, DoctrineName, RoundResult, StanceDef, StanceName,
} from './iter-belli-types';

// ── Dice ──
function rollDie(faces: number): number {
  return Math.floor(Math.random() * faces) + 1;
}

// ── Stances ──
export const STANCES: Record<StanceName, StanceDef> = {
  'Frontal':               { discipline_req: 1, aggressivity: 3,  offensive_mult: 1.40, morale_factor: 1.30, ends_battle: false, soldier_loss_pct: 0,    desc: 'Carga sangrienta. Daño alto, gasta moral.' },
  'Retirada desordenada':  { discipline_req: 1, aggressivity: -3, offensive_mult: 0.0,  morale_factor: 0.0,  ends_battle: true,  soldier_loss_pct: 0.30, desc: 'Huida en pánico. −30% soldados, fin de batalla.' },
  'Línea pesada':          { discipline_req: 2, aggressivity: 0,  offensive_mult: 1.00, morale_factor: 0.70, ends_battle: false, soldier_loss_pct: 0,    desc: 'Defensa cerrada. Resiste mejor el desgaste moral.' },
  'Hostigamiento':         { discipline_req: 2, aggressivity: -1, offensive_mult: 0.60, morale_factor: 0.80, ends_battle: false, soldier_loss_pct: 0,    desc: 'Desgaste a distancia. Daño bajo pero alarga el choque.' },
  'Retirada ordenada':     { discipline_req: 3, aggressivity: -2, offensive_mult: 0.0,  morale_factor: 0.0,  ends_battle: true,  soldier_loss_pct: 0.15, desc: 'Repliegue profesional. −15% soldados, sin secuelas.' },
  'Reserva táctica':       { discipline_req: 3, aggressivity: 1,  offensive_mult: 0.70, morale_factor: 0.90, ends_battle: false, soldier_loss_pct: 0,    desc: 'Solo 60% comprometido. Permite romper cerco.' },
  'Envolvimiento':         { discipline_req: 4, aggressivity: 2,  offensive_mult: 1.50, morale_factor: 1.40, ends_battle: false, soldier_loss_pct: 0,    desc: 'Maniobra envolvente. Devastador con ventaja numérica.' },
  'Resistencia obstinada': { discipline_req: 4, aggressivity: -1, offensive_mult: 0.80, morale_factor: 0.0,  ends_battle: false, soldier_loss_pct: 0,    desc: 'Aguantar el sitio. Convierte daño moral en bajas. Una vez por batalla.' },
  'Falsa retirada':        { discipline_req: 5, aggressivity: 2,  offensive_mult: 0.40, morale_factor: 1.00, ends_battle: false, soldier_loss_pct: 0,    desc: 'Engaño táctico. Si sobrevive, próximo turno con bonus.' },
  'Doble línea':           { discipline_req: 5, aggressivity: 0,  offensive_mult: 1.10, morale_factor: 0.50, ends_battle: false, soldier_loss_pct: 0,    desc: 'Líneas alternantes. Anula desgaste de moral.' },
};

export function availableStancesFor(army: BattleArmy): StanceName[] {
  return (Object.entries(STANCES) as [StanceName, StanceDef][])
    .filter(([, s]) => s.discipline_req <= army.discipline)
    .map(([n]) => n);
}

function dSafeRetreat(army: BattleArmy): StanceName {
  return availableStancesFor(army).includes('Retirada ordenada') ? 'Retirada ordenada' : 'Retirada desordenada';
}

function dLastStand(army: BattleArmy): StanceName | null {
  if (availableStancesFor(army).includes('Resistencia obstinada') && !army.obstinate_used) return 'Resistencia obstinada';
  return null;
}

// ── AI doctrines (enemy) ──
type AIDoctrineName = Exclude<DoctrineName, 'PLAYER'>;
type DoctrineFn = (a: BattleArmy, e: BattleArmy, r: number) => StanceName;

const DOCTRINES: Record<AIDoctrineName, DoctrineFn> = {
  'Tribal': (a) => {
    if (a.encircled) return 'Frontal';
    if (a.morale < 1) return 'Retirada desordenada';
    return 'Frontal';
  },
  'Cauta': (a, e, r) => {
    if (a.encircled) return dLastStand(a) || 'Línea pesada';
    if (a.morale < 3) return dSafeRetreat(a);
    if (e.last_stance === 'Falsa retirada') return 'Línea pesada';
    if (r <= 4) return 'Hostigamiento';
    return 'Línea pesada';
  },
  'Maniobrera': (a, e, r) => {
    const av = availableStancesFor(a);
    if (a.encircled) return dLastStand(a) || 'Línea pesada';
    if (a.morale < 2 && !(e.encircled && e.morale < 4)) return dSafeRetreat(a);
    if (e.encircled) return 'Hostigamiento';
    if (a.false_retreat_combo && av.includes('Envolvimiento')) return 'Envolvimiento';
    if (r === 1 && av.includes('Falsa retirada') && a.discipline >= 5) return 'Falsa retirada';
    if (av.includes('Envolvimiento') && a.soldiers >= e.soldiers * 0.85) return 'Envolvimiento';
    return 'Hostigamiento';
  },
  'Disciplinada': (a, e, r) => {
    const av = availableStancesFor(a);
    if (a.encircled) return dLastStand(a) || 'Línea pesada';
    if (a.morale < 2) return dSafeRetreat(a);
    if (e.last_stance === 'Falsa retirada') return 'Línea pesada';
    if (av.includes('Doble línea') && r <= 4) return 'Doble línea';
    if (av.includes('Envolvimiento') && a.soldiers >= e.soldiers) return 'Envolvimiento';
    return 'Línea pesada';
  },
  'Agresiva': (a, e) => {
    const av = availableStancesFor(a);
    if (a.encircled) return dLastStand(a) || 'Frontal';
    if (a.morale < 1) return 'Retirada desordenada';
    if (av.includes('Envolvimiento') && a.morale > 5 && a.soldiers >= e.soldiers * 0.9) return 'Envolvimiento';
    return 'Frontal';
  },
};

function makeArmy(name: string, soldiers: number, morale: number, discipline: number, doctrine: DoctrineName): BattleArmy {
  return {
    name, soldiers, morale, discipline, doctrine,
    initial_soldiers: soldiers,
    false_retreat_combo: false, encircled: false, encirclement_strength: 0,
    obstinate_used: false, last_stance: null,
  };
}

// ── Round resolution (port of the prototype v2 engine) ──
function resolveBattleRound(
  atk: BattleArmy, dfn: BattleArmy,
  atkStanceName: StanceName, dfnStanceName: StanceName,
  terrainAtkMult: number, terrainDfnMult: number, defDieBonus: number,
): RoundResult {
  const log: string[] = [];
  const atkStance = STANCES[atkStanceName];
  const dfnStance = STANCES[dfnStanceName];
  const dice: RoundResult['dice'] = { atk: null, dfn: null };

  const order: [('atk' | 'dfn'), BattleArmy, StanceDef, StanceName][] =
    atkStance.aggressivity > dfnStance.aggressivity
      ? [['atk', atk, atkStance, atkStanceName], ['dfn', dfn, dfnStance, dfnStanceName]]
      : [['dfn', dfn, dfnStance, dfnStanceName], ['atk', atk, atkStance, atkStanceName]];

  const damageDealt: { atk: number; dfn: number } = { atk: 0, dfn: 0 };
  const envSucceeded: { atk: boolean; dfn: boolean } = { atk: false, dfn: false };

  for (const [role, actor, stance, sn] of order) {
    const target = role === 'atk' ? dfn : atk;
    if (actor.soldiers <= 0 || target.soldiers <= 0 || stance.ends_battle) continue;
    let dieRaw: number; let terrainMult: number; let dieBonus: number; let faces: number;
    if (role === 'atk') { dieRaw = rollDie(6); faces = 6; dieBonus = 0; terrainMult = terrainAtkMult; }
    else { dieRaw = rollDie(8); faces = 8; dieBonus = defDieBonus; terrainMult = terrainDfnMult; }
    const dado = dieRaw + dieBonus;
    dice[role] = { raw: dieRaw, bonus: dieBonus, total: dado, faces };

    let mult = stance.offensive_mult;
    let envFailed = false; let envTotal = false; let note = '';
    if (actor.false_retreat_combo) {
      if (sn === 'Envolvimiento') { mult = 1.7; envTotal = true; note = ' [combo: cerco férreo]'; }
      else { mult *= 1.4; note = ' [bonus combo]'; }
    } else if (sn === 'Envolvimiento') {
      if (actor.soldiers < target.soldiers * 0.8) { mult = 0.5; envFailed = true; note = ' [sin ventaja numérica]'; }
      else if (dado >= 3) envTotal = true;
    }
    const damage = Math.floor((actor.soldiers / 2000) * dado * mult * terrainMult * 25);
    target.soldiers = Math.max(0, target.soldiers - damage);
    damageDealt[role] = damage;
    if (envTotal && !envFailed) envSucceeded[role] = true;
    log.push(`${actor.name} con ${sn} (d${dado}) → ${damage.toLocaleString('es')} bajas${note}`);
  }

  // Retreats.
  for (const [, army, stance] of [['atk', atk, atkStance] as const, ['dfn', dfn, dfnStance] as const]) {
    if (stance.ends_battle && !army.encircled) {
      const losses = Math.floor(army.soldiers * stance.soldier_loss_pct);
      army.soldiers = Math.max(0, army.soldiers - losses);
    }
  }

  if (atkStanceName === 'Resistencia obstinada') atk.obstinate_used = true;
  if (dfnStanceName === 'Resistencia obstinada') dfn.obstinate_used = true;

  // Apply encirclement.
  if (envSucceeded.atk) { dfn.encircled = true; if (atk.false_retreat_combo) dfn.encirclement_strength = 4; }
  if (envSucceeded.dfn) { atk.encircled = true; if (dfn.false_retreat_combo) atk.encirclement_strength = 4; }

  // Round winner (holding a ring counts).
  let winner: 'atk' | 'dfn' | null = null;
  if (dfn.encircled && !atk.encircled) winner = damageDealt.atk > 0 ? 'atk' : (damageDealt.dfn > 0 ? 'dfn' : null);
  else if (atk.encircled && !dfn.encircled) winner = damageDealt.dfn > 0 ? 'dfn' : (damageDealt.atk > 0 ? 'atk' : null);
  else if (damageDealt.atk > damageDealt.dfn) winner = 'atk';
  else if (damageDealt.dfn > damageDealt.atk) winner = 'dfn';

  // Morale damage.
  for (const [role, army, stance, sn] of [['atk', atk, atkStance, atkStanceName] as const, ['dfn', dfn, dfnStance, dfnStanceName] as const]) {
    if (army.soldiers <= 0 || stance.ends_battle) continue;
    const dmgTaken = role === 'atk' ? damageDealt.dfn : damageDealt.atk;
    const lossPct = dmgTaken / Math.max(army.soldiers + dmgTaken, 1);
    if (sn === 'Resistencia obstinada') {
      const moraleRaw = Math.max(0, lossPct * 10 * 1.0 - army.discipline / 2);
      const extraPhys = Math.floor(moraleRaw * 250);
      army.soldiers = Math.max(0, army.soldiers - extraPhys);
      if (extraPhys > 0) log.push(`${army.name} (Resist. obstinada) absorbe −${extraPhys.toLocaleString('es')} bajas`);
      continue;
    }
    let mDmg = Math.max(0, lossPct * 10 * stance.morale_factor - army.discipline / 2);
    if (winner && role !== winner) {
      mDmg += 1.5;
      if (sn === 'Línea pesada' || sn === 'Hostigamiento') mDmg += 1.0;
      if (sn === 'Doble línea') mDmg = Math.max(0, mDmg - 2.5);
    }
    if (army.encircled) mDmg += 1.0;
    army.morale = Math.max(0, army.morale - mDmg);
  }

  // Seal annihilation if morale 0 while encircled.
  const atkDieEnc = atk.morale <= 0 && atk.encircled && atk.soldiers > 0;
  const dfnDieEnc = dfn.morale <= 0 && dfn.encircled && dfn.soldiers > 0;

  // Decrement encirclement.
  if (atk.encircled && atk.encirclement_strength > 0 && !atkDieEnc) {
    atk.encirclement_strength--;
    if (atk.encirclement_strength === 0) { atk.encircled = false; log.push(`${atk.name} sale del cerco (debilitado)`); }
  }
  if (dfn.encircled && dfn.encirclement_strength > 0 && !dfnDieEnc) {
    dfn.encirclement_strength--;
    if (dfn.encirclement_strength === 0) { dfn.encircled = false; log.push(`${dfn.name} sale del cerco (debilitado)`); }
  }

  // Normal ring breaks with Resist./Reserve.
  if (atk.encircled && atk.encirclement_strength === 0 && (atkStanceName === 'Resistencia obstinada' || atkStanceName === 'Reserva táctica')) {
    if (damageDealt.atk >= damageDealt.dfn * 0.5) { atk.encircled = false; log.push(`${atk.name} rompe el cerco con ${atkStanceName}`); }
  }
  if (dfn.encircled && dfn.encirclement_strength === 0 && (dfnStanceName === 'Resistencia obstinada' || dfnStanceName === 'Reserva táctica')) {
    if (damageDealt.dfn >= damageDealt.atk * 0.5) { dfn.encircled = false; log.push(`${dfn.name} rompe el cerco con ${dfnStanceName}`); }
  }

  // False-retreat combo flag.
  for (const [army, sn] of [[atk, atkStanceName] as const, [dfn, dfnStanceName] as const]) {
    if (sn === 'Falsa retirada' && army.soldiers > army.initial_soldiers * 0.6) army.false_retreat_combo = true;
    else if (sn !== 'Falsa retirada' && army.false_retreat_combo) army.false_retreat_combo = false;
  }

  atk.last_stance = atkStanceName;
  dfn.last_stance = dfnStanceName;

  return { log, dice, winner };
}

function checkBattleOutcome(atk: BattleArmy, dfn: BattleArmy, atkStanceName: StanceName, dfnStanceName: StanceName): { finished: boolean; atkOk?: boolean; msg?: string } {
  if (STANCES[atkStanceName].ends_battle && !atk.encircled) return { finished: true, atkOk: false, msg: `Atacante ejecuta ${atkStanceName.toLowerCase()}` };
  if (STANCES[dfnStanceName].ends_battle && !dfn.encircled) return { finished: true, atkOk: true, msg: `Defensor ejecuta ${dfnStanceName.toLowerCase()}` };
  if (atk.soldiers <= 0) return { finished: true, atkOk: false, msg: 'Atacante aniquilado físicamente' };
  if (dfn.soldiers <= 0) return { finished: true, atkOk: true, msg: 'Defensor aniquilado físicamente' };
  if (atk.morale <= 0) {
    if (atk.encircled) { const losses = Math.floor(atk.soldiers * 0.95); atk.soldiers -= losses; return { finished: true, atkOk: false, msg: `Atacante ANIQUILADO en envolvimiento (−${losses.toLocaleString('es')})` }; }
    const losses = Math.floor(atk.soldiers * 0.6); atk.soldiers -= losses;
    return { finished: true, atkOk: false, msg: `Atacante rompe (M=0) — ${losses.toLocaleString('es')} bajas en huida` };
  }
  if (dfn.morale <= 0) {
    if (dfn.encircled) { const losses = Math.floor(dfn.soldiers * 0.95); dfn.soldiers -= losses; return { finished: true, atkOk: true, msg: `Defensor ANIQUILADO en envolvimiento (−${losses.toLocaleString('es')})` }; }
    const losses = Math.floor(dfn.soldiers * 0.6); dfn.soldiers -= losses;
    return { finished: true, atkOk: true, msg: `Defensor rompe (M=0) — ${losses.toLocaleString('es')} bajas en huida` };
  }
  return { finished: false };
}

// ── Battle signal & flow ──
export const iterBelliBattle = signal<BattleState | null>(null);
let BS: BattleState | null = null;

function commitBattle(): void {
  iterBelliBattle.value = BS
    ? { ...BS, atk: { ...BS.atk }, dfn: { ...BS.dfn }, log: BS.log.slice(), lastDice: { ...BS.lastDice } }
    : null;
}

function bmLog(text: string, kind: BattleState['log'][number]['kind'] = ''): void {
  if (BS) BS.log.push({ text, kind });
}

/** Build the decisive battle from the current campaign state. Idempotent per phase. */
export function beginBattle(): void {
  const s = iterBelliState.value;
  const enemy = getActiveScenario().enemy;
  const enemyMult = (1 + s.threat / B.ENEMY_THREAT_DIVISOR) * (1 - s.enemyWeaken * B.ENEMY_WEAKEN_PER_POINT);
  const enemySoldiers = Math.max(enemy.minSoldiers, Math.floor(enemy.baseSoldiers * enemyMult));

  BS = {
    atk: makeArmy('Tu ejército', s.soldiers, s.morale, s.discipline, 'PLAYER'),
    dfn: makeArmy(enemy.name, enemySoldiers, enemy.morale, enemy.discipline, enemy.doctrine),
    terrainAtkMult: s.fortified ? B.FORTIFIED_TERRAIN_MULT : 1.0,
    terrainDfnMult: 1.0,
    defDieBonus: 0,
    round: 0,
    finished: false,
    playerDoctrine: 'Disciplinada',
    log: [],
    lastDice: { atk: null, dfn: null },
    victory: null,
  };

  bmLog('INICIO DE BATALLA', 'head');
  bmLog(`Tu ejército: ${BS.atk.soldiers.toLocaleString('es')} sold · M${BS.atk.morale.toFixed(1)} · Disciplina ${B.ROMAN[BS.atk.discipline]}`);
  bmLog(`${enemy.name}: ${BS.dfn.soldiers.toLocaleString('es')} sold · M${BS.dfn.morale.toFixed(1)} · Disciplina ${B.ROMAN[enemy.discipline]} · ${enemy.doctrine}`);
  if (s.fortified) bmLog('Tu campamento fortificado da +15% al daño inicial.');
  if (s.enemyWeaken > 0) bmLog(`El enemigo llega erosionado por tus operaciones (−${s.enemyWeaken * 7}% efectivos).`);
  bmLog('Eres el atacante. Tiras d6, el enemigo d8.');
  commitBattle();
}

export function playerChoosesStance(stanceName: StanceName): void {
  if (!BS || BS.finished) return;
  BS.round++;
  const { atk, dfn, terrainAtkMult, terrainDfnMult, defDieBonus } = BS;
  const enemyStance = DOCTRINES[dfn.doctrine as AIDoctrineName](dfn, atk, BS.round);

  bmLog(`Ronda ${BS.round} — Tú: ${stanceName} · Enemigo: ${enemyStance}`, 'head');

  const result = resolveBattleRound(atk, dfn, stanceName, enemyStance, terrainAtkMult, terrainDfnMult, defDieBonus);
  BS.lastDice = result.dice;
  for (const line of result.log) bmLog(line);

  const oc = checkBattleOutcome(atk, dfn, stanceName, enemyStance);

  if (oc.finished || BS.round >= B.BATTLE_MAX_ROUNDS) {
    BS.finished = true;
    BS.victory = oc.atkOk === true;
    bmLog(oc.msg || 'Batalla agotada por rondas', 'outcome');
  }
  commitBattle();
}

/** Called by the modal's "return" button once the battle has resolved. */
export function concludeBattle(): void {
  if (!BS || !BS.finished || BS.victory === null) return;
  const victory = BS.victory;
  const survivors = BS.atk.soldiers;
  const finalMorale = BS.atk.morale;
  BS = null;
  iterBelliBattle.value = null;
  applyBattleOutcome(victory, survivors, finalMorale);
}

export function resetIterBelliBattle(): void {
  BS = null;
  iterBelliBattle.value = null;
}
