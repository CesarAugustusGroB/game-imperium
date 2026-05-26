/**
 * Iter Belli — campaign state & turn engine.
 *
 * Ported from the prototype's mutable `state` + procedural turn logic, exposed
 * through @preact/signals. A module-local mutable draft (`S`) is mutated by the
 * ported helpers, then `commit()` publishes a fresh snapshot to the signal so
 * Preact re-renders. The battle engine (iter-belli-combat.ts) imports from here;
 * this module imports nothing from combat or from the wider run state, so it is
 * free of circular dependencies. Hub side-effects (gold writeback, cohort
 * scaling) live in the UI's "Return to Hub" handler, not here.
 */

import { signal } from '@preact/signals';
import { CARD_DEFS } from '../../data/iter-belli-cards';
import { CRISES, LOCATIONS } from '../../data/iter-belli-locations';
import * as B from './iter-belli-balance';
import type {
  Archetype, CardContext, CardEffects, CardInstance, IterBelliState, Location, LogKind, LogLine,
} from './iter-belli-types';
import { isCrisisDef } from './iter-belli-types';

// ── Signals ─────────────────────────────────────────────────────────────────

function freshState(): IterBelliState {
  return {
    soldiers: B.START.fallbackSoldiers,
    morale: B.START.morale,
    discipline: B.START.discipline,
    supplies: B.START.supplies,
    gold: B.START.fallbackGold,
    iuniores: 0,
    threat: B.START.threat,
    timeRemaining: B.START.timeRemaining,
    turnNum: 0,
    locationIdx: 0,
    pool: [],
    cardIdCounter: 0,
    ambushDetected: false,
    fortified: false,
    truceTurns: 0,
    finished: false,
    enemyWeaken: 0,
    brokenCommitments: 0,
    phase: 'campaign',
    outcome: null,
    archetype: null,
    initialSoldiers: B.START.fallbackSoldiers,
  };
}

let S: IterBelliState = freshState();
let logLines: LogLine[] = [];

export const iterBelliState = signal<IterBelliState>(S);
export const iterBelliLog = signal<LogLine[]>(logLines);

/** Publish the current draft to the signals so subscribers re-render. */
function commit(): void {
  iterBelliState.value = { ...S, pool: S.pool.map((c) => ({ ...c })) };
  iterBelliLog.value = logLines.slice();
}

function logTurn(text: string): void { logLines.push({ text, kind: 'turn' }); }
function logEvent(text: string, kind: LogKind = ''): void { logLines.push({ text, kind }); }

// ── Helpers ─────────────────────────────────────────────────────────────────

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function currentLocation(): Location {
  return LOCATIONS[S.locationIdx];
}

function ctx(): CardContext {
  return { state: S, loc: currentLocation(), archetype: S.archetype };
}

/** Mutate one resource on the draft, applying the prototype's clamps. */
function applyChange(key: keyof IterBelliState, delta: number): void {
  if (delta === 0) return;
  switch (key) {
    case 'soldiers':   S.soldiers = Math.max(0, S.soldiers + delta); break;
    case 'morale':     S.morale = clamp(S.morale + delta, B.MORALE_MIN, B.MORALE_MAX); break;
    case 'discipline': S.discipline = clamp(S.discipline + delta, B.DISCIPLINE_MIN, B.DISCIPLINE_MAX); break;
    case 'supplies':   S.supplies = Math.max(0, S.supplies + delta); break;
    case 'gold':       S.gold = Math.max(0, S.gold + delta); break;
    case 'iuniores':   S.iuniores = Math.max(0, S.iuniores + delta); break;
    case 'threat':     S.threat = clamp(S.threat + delta, B.THREAT_MIN, B.THREAT_MAX); break;
    default: break;
  }
}

// ── Pool generation ──────────────────────────────────────────────────────────

function eligibleCards() {
  const c = ctx();
  return CARD_DEFS.filter((card) => {
    if (!card.locations.includes('*') && !card.locations.includes(c.loc.id)) return false;
    if (card.requires && !card.requires(c)) return false;
    return true;
  });
}

function drawCard(): CardInstance | null {
  const eligible = eligibleCards();
  if (eligible.length === 0) return null;
  const totalWeight = eligible.reduce((s, c) => s + c.weight, 0);
  let r = Math.random() * totalWeight;
  for (const c of eligible) {
    r -= c.weight;
    if (r <= 0) {
      return { instanceId: S.cardIdCounter++, def: c, timer: c.expiry };
    }
  }
  return null;
}

function refillPool(): void {
  // At Sagunto, force the decisive assault to be the only option.
  if (currentLocation().id === 'sagunto' && !S.pool.find((c) => c.def.id === 'asalto_decisivo')) {
    const assault = CARD_DEFS.find((c) => c.id === 'asalto_decisivo');
    if (assault) {
      S.pool = [{ instanceId: S.cardIdCounter++, def: assault, timer: 99 }];
    }
  }
  let attempts = B.POOL_REFILL_ATTEMPTS;
  while (S.pool.filter((c) => c.def.category !== 'Crisis').length < B.POOL_TARGET_SIZE && attempts-- > 0) {
    const c = drawCard();
    if (c && !S.pool.find((p) => p.def.id === c.def.id)) {
      S.pool.push(c);
    }
  }
}

function injectCrises(): void {
  S.pool = S.pool.filter((c) => c.def.category !== 'Crisis');
  if (S.supplies <= 0) {
    S.pool.unshift({ instanceId: S.cardIdCounter++, def: { ...CRISES.hambre, id: 'crisis_hambre' }, timer: 99 });
  }
  if (S.morale < B.MUTINY_MORALE_THRESHOLD) {
    S.pool.unshift({ instanceId: S.cardIdCounter++, def: { ...CRISES.motin, id: 'crisis_motin' }, timer: 99 });
  }
}

// ── Effect application ───────────────────────────────────────────────────────

/** Apply a resolved {@link CardEffects} bag. Returns true if it opened the battle. */
function applyEffects(eff: CardEffects): boolean {
  let goingToBattle = false;
  for (const [k, v] of Object.entries(eff)) {
    if (v === undefined) continue;
    switch (k) {
      case 'soldiers':   applyChange('soldiers', v as number); break;
      case 'morale':     applyChange('morale', v as number); break;
      case 'discipline': applyChange('discipline', v as number); break;
      case 'supplies':   applyChange('supplies', v as number); break;
      case 'gold':       applyChange('gold', v as number); break;
      case 'threat':     applyChange('threat', v as number); break;
      case 'enemyWeaken':
        S.enemyWeaken += v as number;
        logEvent(`Has erosionado al ejército enemigo (+${v}). En la batalla final lo notará.`);
        break;
      case 'time_bonus':
        S.timeRemaining += v as number;
        logEvent(`El Senado concede ${v} días adicionales al plazo de campaña.`, 'event');
        break;
      case 'advance':
        if (S.locationIdx < LOCATIONS.length - 1) {
          S.locationIdx++;
          logEvent(`Avanzas a ${currentLocation().name}.`, 'event');
        }
        break;
      case 'ambushDetected': S.ambushDetected = true; break;
      case 'fortified':      S.fortified = true; break;
      case 'triggerFinalBattle': goingToBattle = true; break;
      default: break;
    }
  }
  return goingToBattle;
}

// ── Public actions ───────────────────────────────────────────────────────────

export function playCard(instanceId: number): void {
  if (S.finished || S.phase !== 'campaign') return;
  const card = S.pool.find((c) => c.instanceId === instanceId);
  if (!card || isCrisisDef(card.def)) return;
  const def = card.def;

  const cost = def.cost ?? {};
  // Costs apply regardless of gamble outcome.
  applyChange('supplies', -(cost.supplies ?? 0));
  applyChange('gold', -(cost.gold ?? 0));
  applyChange('iuniores', -(cost.iuniores ?? 0));

  const isGamble = def.cardType === 'arriesgada';
  let eff: CardEffects;
  let success = true;
  if (isGamble) {
    success = Math.random() * 100 < (def.successChance ?? 0);
    eff = success ? def.effects(ctx()) : (def.failureEffects ? def.failureEffects(ctx()) : {});
  } else {
    eff = def.effects(ctx());
  }

  if (isGamble) {
    if (success) {
      logTurn(`Día ${S.turnNum + 1}: ${def.name}  ✓ ÉXITO (${def.successChance}%)`);
      logEvent(def.desc.split('.')[0] + '.');
    } else {
      logTurn(`Día ${S.turnNum + 1}: ${def.name}  ✗ FRACASO (${100 - (def.successChance ?? 0)}%)`);
      logEvent(def.failureMsg || 'La jugada salió mal.', 'event');
    }
  } else {
    logTurn(`Día ${S.turnNum + 1}: ${def.name}`);
    logEvent(def.desc.split('.')[0] + '.');
  }

  const goingToBattle = applyEffects(eff);

  // Remove the played card.
  S.pool = S.pool.filter((c) => c.instanceId !== instanceId);

  if (goingToBattle) {
    S.phase = 'battle';
    commit();
    return;
  }

  endTurn(cost.time || 1);
}

export function camp(): void {
  if (S.finished || S.phase !== 'campaign') return;
  logTurn(`Día ${S.turnNum + 1}: Acampar y reorganizar`);
  logEvent('El ejército descansa. Suministros consumidos, ánimo recobrado.');
  applyChange('supplies', -B.CAMP_SUPPLY_COST);
  applyChange('morale', B.CAMP_MORALE_GAIN);
  endTurn(1);
}

// ── Turn resolution ──────────────────────────────────────────────────────────

function endTurn(timeCost: number): void {
  S.turnNum++;
  S.timeRemaining -= timeCost;

  // Passive upkeep.
  if (S.supplies > 0) applyChange('supplies', -B.SUPPLY_UPKEEP_PER_TURN);

  // Hunger.
  if (S.supplies <= 0) {
    applyChange('morale', -B.HUNGER_MORALE_LOSS);
    const losses = Math.floor(S.soldiers * B.HUNGER_DESERTION_PCT);
    applyChange('soldiers', -losses);
    logEvent(`Hambre: −${losses} desertores, moral −1`, 'event');
  }

  // Mutiny.
  if (S.morale < B.MUTINY_MORALE_THRESHOLD && Math.random() < B.MUTINY_CHANCE) {
    const losses = Math.floor(S.soldiers * B.MUTINY_DESERTION_PCT);
    applyChange('soldiers', -losses);
    logEvent(`Deserciones por moral baja: −${losses} soldados`, 'event');
  }

  // Truce countdown.
  if (S.truceTurns > 0) S.truceTurns--;

  // Passive threat from the current location.
  if (S.truceTurns === 0) {
    const dt = currentLocation().threatPerTurn || 0;
    if (dt !== 0) applyChange('threat', dt);
  }

  // Card timers + expiry handling.
  S.pool.forEach((c) => { if (c.def.category !== 'Crisis' && c.timer < 99) c.timer -= timeCost; });
  const expired = S.pool.filter((c) => c.timer <= 0 && c.def.category !== 'Crisis');
  for (const c of expired) {
    if (!isCrisisDef(c.def) && c.def.cardType === 'compromiso') {
      logEvent(`Compromiso roto: ${c.def.name}`, 'event');
      if (c.def.penalty) {
        const result = c.def.penalty(ctx());
        if (result.effects) applyEffects(result.effects);
        logEvent(result.msg, 'event');
      }
      S.brokenCommitments++;
    } else {
      logEvent(`Oportunidad perdida: ${c.def.name} expiró`);
    }
  }
  S.pool = S.pool.filter((c) => c.timer > 0 || c.def.category === 'Crisis' || c.timer === 99);

  // Threat-driven partial combats.
  if (S.threat >= B.SKIRMISH_THREAT_THRESHOLD && S.truceTurns === 0 && currentLocation().type === 'enemigo') {
    if (Math.random() < B.SKIRMISH_CHANCE) handleSkirmish();
  }
  if (currentLocation().id === 'bosques' && S.threat >= B.AMBUSH_THREAT_THRESHOLD && Math.random() < B.AMBUSH_CHANCE) {
    handleAmbush();
  }

  injectCrises();
  refillPool();
  checkEndConditions();
  commit();
}

function handleSkirmish(): void {
  const intensity = Math.min(S.threat / 10, 1);
  const losses = Math.floor(S.soldiers * B.SKIRMISH_DESERTION_PCT * intensity);
  applyChange('soldiers', -losses);
  applyChange('morale', -B.SKIRMISH_MORALE_LOSS);
  logEvent(`Escaramuza enemiga: −${losses} soldados, moral −0.5`, 'event');
}

function handleAmbush(): void {
  if (S.ambushDetected) {
    logEvent('Emboscada enemiga DETECTADA — tus exploradores la previenen', 'event');
    S.ambushDetected = false;
    return;
  }
  const losses = Math.floor(S.soldiers * B.AMBUSH_DESERTION_PCT);
  applyChange('soldiers', -losses);
  applyChange('morale', -B.AMBUSH_MORALE_LOSS);
  logEvent(`EMBOSCADA en bosques: −${losses} soldados, moral −1.5`, 'event');
}

// ── End conditions & lifecycle ─────────────────────────────────────────────────

function checkEndConditions(): void {
  if (S.finished) return;
  if (S.timeRemaining <= 0 && currentLocation().id !== 'sagunto') {
    finishCampaign(false, 'Se ha agotado el plazo. El Senado te releva del mando.');
    return;
  }
  if (S.soldiers < 1000) {
    finishCampaign(false, 'Tu ejército es demasiado pequeño para continuar la campaña.');
    return;
  }
  if (S.morale <= 0) {
    finishCampaign(false, 'El ejército ha desertado en masa. La moral colapsó.');
  }
}

function finishCampaign(victory: boolean, message: string): void {
  S.finished = true;
  S.phase = 'endgame';
  S.outcome = {
    victory,
    title: victory ? 'Triunfo en Hispania' : 'Campaña fallida',
    text: message,
    soldiers: S.soldiers,
    turnNum: S.turnNum,
    brokenCommitments: S.brokenCommitments,
  };
}

/**
 * Called by the battle engine when the decisive battle resolves. Writes the
 * surviving army back to the campaign, awards the victory bonus, and ends the run.
 */
export function applyBattleOutcome(victory: boolean, survivors: number, finalMorale: number): void {
  S.soldiers = Math.max(0, Math.floor(survivors));
  S.morale = clamp(finalMorale, B.MORALE_MIN, B.MORALE_MAX);
  if (victory) {
    applyChange('gold', B.VICTORY_GOLD_BONUS);
    logEvent(`Has vencido en Sagunto. Quedan ${S.soldiers} soldados.`, 'battle');
    finishCampaign(true, 'Has derrotado al ejército púnico. Sagunto se rinde. La campaña es un éxito.');
  } else {
    logEvent(`Derrota en Sagunto. Quedan ${S.soldiers} soldados.`, 'battle');
    finishCampaign(false, 'Tu ejército ha sido derrotado en Sagunto. La campaña ha fracasado.');
  }
  commit();
}

/**
 * Starting campaign discipline = archetype base + legate modifier (net ±1), clamped 1–5.
 * Reads legate trait ids as plain strings; does not touch the legate/battle system.
 */
export function computeStartingDiscipline(
  archetype: Archetype | null,
  legateTraitIds: readonly string[],
): number {
  const base = archetype ? B.DISCIPLINE_BY_ARCHETYPE[archetype] : B.START.discipline;
  const rawMod = legateTraitIds.reduce((sum, id) => sum + (B.LEGATE_DISCIPLINE_TRAIT_MOD[id] ?? 0), 0);
  const legateMod = clamp(rawMod, -1, 1);
  return clamp(base + legateMod, B.DISCIPLINE_MIN, B.DISCIPLINE_MAX);
}

export interface CampaignSeed {
  soldiers: number;
  gold: number;
  iuniores: number;
  discipline: number;
  archetype: Archetype | null;
}

/** Begin a fresh campaign, seeded from the run's army size and gold. */
export function startIterBelliCampaign(seed: CampaignSeed): void {
  S = freshState();
  logLines = [];
  const soldiers = seed.soldiers > 0 ? Math.floor(seed.soldiers) : B.START.fallbackSoldiers;
  S.soldiers = soldiers;
  S.initialSoldiers = soldiers;
  S.gold = Math.max(seed.gold, 0);
  S.iuniores = Math.max(seed.iuniores, 0);
  S.discipline = clamp(seed.discipline, B.DISCIPLINE_MIN, B.DISCIPLINE_MAX);
  S.archetype = seed.archetype;

  logTurn('Día 1: Inicio de la campaña');
  logEvent(`El ejército parte de la frontera. ${S.soldiers} soldados, moral ${S.morale.toFixed(1)}, disciplina ${B.ROMAN[S.discipline]}.`);
  logEvent('El Senado espera resultados antes del invierno.');
  refillPool();
  injectCrises();
  commit();
}

/** Reset to a clean slate (called from resetRun). */
export function resetIterBelli(): void {
  S = freshState();
  logLines = [];
  commit();
}
