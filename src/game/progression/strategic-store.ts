import { signal } from '@preact/signals';
import { selectedCommander, completedSpokes } from '../core/game-state';
import { spendResource, addResource, canAfford } from '../core/resources';
import type { ArmyData } from '../../types/index';
import type { Cohort } from '../army/cohort';
import type { Legate } from '../army/legate';
import { getCohortById } from '../army/cohort-data';
import { computeArmySize, createCohortInstance } from '../army/cohort';
import { rollHiringPool, rollLegateCandidate } from '../army/legate-pool';
import { SUPPLIES_PER_GOLD, SUPPLIES_STARTING_STOCK, SUPPLY_MAX_CARRY, IUNIORES } from '../../config/game-config';
import { AMMO_STARTING_STOCK, AMMO_MAX_CARRY, AMMO_PER_GOLD } from '../../config/game-config';
import { nextArmorTier, armorUpgradeCost } from './arsenal';
import { getShopDiscount } from '../items/doctrine-store';

// Advisor shop-discount is pushed in from game-state to avoid an import cycle
// (council-store imports strategic-store; the reverse would be circular).
let extraShopDiscountFn: () => number = () => 0;
export function setExtraShopDiscountFn(fn: () => number): void {
  extraShopDiscountFn = fn;
}

// ── Helpers ──

/** Gold cost after equipped-doctrine shop-discount, min 1. */
function discountedGold(base: number): number {
  const pct = Math.min(75, getShopDiscount() + extraShopDiscountFn());
  return Math.max(1, Math.round(base * (1 - pct / 100)));
}

// ── State signals ──

/** Call Crusade (Innocent): battles remaining with +30% damage. */
export const crusadeBattlesLeft = signal(0);

/** War Cry (Boudicca): available every 3 spokes. Tracks last spoke used. */
export const warCryLastUsedSpoke = signal(-99);

/**
 * War Cry active flag (Boudicca): set true when the ability is used at the Hub,
 * consumed (reset to false) at the start of the next battle.
 * The battle agent reads this to apply the War Cry damage bonus.
 */
export const warCryActive = signal(false);

/** Manipulate (Augustus): rerolls remaining this spoke. */
export const manipulateUsesLeft = signal(0);

/** Golden Opportunity (Crassus): rest nodes to inject into next spoke. */
export const goldenOpportunityPending = signal(0);

/** Mandatum Legati: enemies to convert to blue at the start of the next battle. */
export const pendingEnemyConversions = signal(0);

/** Cursus Honorum Aureus: one-time % investment cost discount applied to next build. */
export const nextInvestmentDiscount = signal(0);

// ── S14-06: Player army at the Hub ──

/**
 * The player's currently-prepared army at the Hub. Mutated by the
 * S14-07 Recruitment Screen as cohorts are added/removed. Snapshotted into
 * `Spoke.boundArmy` at embark time by `startSpokeFromCouncil`.
 *
 * `null` while no army has been composed yet.
 */
export const preparedArmy = signal<ArmyData | null>(null);

/**
 * The Legate currently attached to the prepared army. Set by the S14-08
 * Hiring Screen. Snapshotted into `Spoke.boundLegate` at embark time.
 */
export const preparedLegate = signal<Legate | null>(null);

/**
 * Monotonic counter that ticks every time a spoke is embarked with a
 * bound army. Acts as the `army.embark` observable in lieu of a proper
 * event bus — subscribers can react via:
 *   `effect(() => { armyEmbarkCount.value; ... })`
 */
export const armyEmbarkCount = signal(0);

/**
 * Pool of Legate candidates available for hire at the Hub. Initialized lazily
 * on first visit to the Legate Hiring Screen. Persists across Hub visits within
 * a run so candidates don't re-roll on every navigation.
 * Reset to [] by resetStrategicStore (new run).
 */
export const legateHiringPool = signal<Legate[]>([]);

export type RecruitCohortFailure = 'unknown-cohort' | 'insufficient-gold' | 'insufficient-iuniores';

// ── Derived checks ──

/**
 * Can the current commander use their strategic ability right now?
 * NOTE: The commander ID literals below ('innocent', 'boudicca', 'augustus', 'crassus')
 * MUST match the `id` field in the Commander objects defined in src/data/commanders.ts.
 */
export function canUseStrategic(): boolean {
  const commander = selectedCommander.value;
  if (!commander) return false;

  const ability = commander.strategicAbility;
  if (ability.cost && !canAfford(ability.cost.resource, ability.cost.amount)) return false;

  switch (commander.id) {
    case 'innocent':
      return crusadeBattlesLeft.value === 0; // can't stack
    case 'boudicca':
      return completedSpokes.value - warCryLastUsedSpoke.value >= 3;
    case 'augustus':
      return true; // always available if you can afford it (uses tracked per spoke)
    case 'crassus':
      return goldenOpportunityPending.value === 0; // can't stack
    default:
      return false;
  }
}

/**
 * Get a human-readable status for the ability (cooldown, active, etc).
 * NOTE: Commander ID literals MUST match src/data/commanders.ts.
 */
export function getStrategicStatus(): string | null {
  const commander = selectedCommander.value;
  if (!commander) return null;

  switch (commander.id) {
    case 'innocent':
      return crusadeBattlesLeft.value > 0
        ? `Active: ${crusadeBattlesLeft.value} battle${crusadeBattlesLeft.value !== 1 ? 's' : ''} left`
        : null;
    case 'boudicca': {
      const spokesUntil = 3 - (completedSpokes.value - warCryLastUsedSpoke.value);
      return spokesUntil > 0 ? `Cooldown: ${spokesUntil} spoke${spokesUntil !== 1 ? 's' : ''}` : null;
    }
    case 'augustus':
      return manipulateUsesLeft.value > 0
        ? `${manipulateUsesLeft.value} reroll${manipulateUsesLeft.value !== 1 ? 's' : ''} left`
        : null;
    case 'crassus':
      return goldenOpportunityPending.value > 0 ? 'Pending: next spoke' : null;
    default:
      return null;
  }
}

// ── Actions ──

/**
 * Activate the current commander's strategic ability. Returns true on success.
 * NOTE: Commander ID literals MUST match src/data/commanders.ts.
 */
export function useStrategic(): boolean {
  const commander = selectedCommander.value;
  if (!commander || !canUseStrategic()) return false;

  const ability = commander.strategicAbility;
  if (ability.cost) {
    if (!spendResource(ability.cost.resource, ability.cost.amount)) return false;
  }

  switch (commander.id) {
    case 'innocent':
      crusadeBattlesLeft.value = 3;
      break;
    case 'boudicca':
      warCryLastUsedSpoke.value = completedSpokes.value;
      warCryActive.value = true;
      break;
    case 'augustus':
      manipulateUsesLeft.value = 1; // 1 reroll per activation
      break;
    case 'crassus':
      goldenOpportunityPending.value = 2; // 2 extra rest nodes
      break;
  }

  return true;
}

/** Called when a battle starts — decrement crusade counter. Returns damage bonus. */
export function consumeCrusadeBattle(): number {
  if (crusadeBattlesLeft.value <= 0) return 0;
  crusadeBattlesLeft.value -= 1;
  return 0.3; // +30% damage
}

/**
 * Called when a battle starts — consume War Cry if active.
 * Returns true if War Cry was active (battle agent should apply the bonus), false otherwise.
 */
export function consumeWarCry(): boolean {
  if (!warCryActive.value) return false;
  warCryActive.value = false;
  return true;
}

/** Called when Manipulate reroll is used in an event. */
export function consumeManipulateUse(): boolean {
  if (manipulateUsesLeft.value <= 0) return false;
  manipulateUsesLeft.value -= 1;
  return true;
}

/** Called when a new spoke starts — apply Golden Opportunity rest nodes. Returns count to inject. */
export function consumeGoldenOpportunity(): number {
  const pending = goldenOpportunityPending.value;
  goldenOpportunityPending.value = 0;
  return pending;
}

// ── S14-07/08: Army preparation actions ──

/**
 * Lazy-initialize the prepared army if it is null. Should be called on mount
 * of the Recruitment Screen to ensure a shell army exists to append cohorts to.
 */
export function ensurePreparedArmy(): ArmyData {
  if (preparedArmy.value) return preparedArmy.value;
  const owner = selectedCommander.value?.faction ?? 'rome';
  const shell: ArmyData = {
    id: 0, owner, name: 'Legio I', size: 0, cohorts: [], legateId: null,
    supplies: SUPPLIES_STARTING_STOCK,
    armorMaterial: 'copper', ammunition: AMMO_STARTING_STOCK,
    provinceIndex: 0, targetProvinceIndex: null, progress: 0, path: [],
    inCombat: false, combatTarget: null, lastRoll: 0,
  };
  preparedArmy.value = shell;
  return shell;
}

/**
 * FT-SUP: buy `qty` supplies with gold. Clamps to remaining cap; spends
 * gold only for the clamped quantity. Returns false if nothing can be
 * bought (at cap, or not enough gold for even 1 unit).
 */
export function buySupplies(qty: number): boolean {
  if (qty <= 0) return false;
  const army = ensurePreparedArmy();
  const room = SUPPLY_MAX_CARRY - army.supplies;
  if (room <= 0) return false;
  const buyable = Math.min(qty, room);
  // Cost rounds UP — buying 1 supply still costs 1 gold (buying 2 is the
  // efficient increment). Multiples of SUPPLIES_PER_GOLD are fully efficient.
  const cost = discountedGold(Math.ceil(buyable / SUPPLIES_PER_GOLD));
  if (!canAfford('gold', cost)) return false;
  if (!spendResource('gold', cost)) return false;
  preparedArmy.value = { ...army, supplies: army.supplies + buyable };
  return true;
}

/** Upgrade the prepared army's armor one tier with gold. False if at top or unaffordable. */
export function upgradeArmor(): boolean {
  const army = ensurePreparedArmy();
  const current = army.armorMaterial ?? 'copper';
  const next = nextArmorTier(current);
  const base = armorUpgradeCost(current);
  if (!next || base == null) return false;
  const cost = discountedGold(base);
  if (!canAfford('gold', cost)) return false;
  if (!spendResource('gold', cost)) return false;
  preparedArmy.value = { ...army, armorMaterial: next };
  return true;
}

/** Buy `qty` ammunition with gold (clamped to the carry cap). */
export function buyAmmunition(qty: number): boolean {
  if (qty <= 0) return false;
  const army = ensurePreparedArmy();
  const current = army.ammunition ?? AMMO_STARTING_STOCK;
  const room = AMMO_MAX_CARRY - current;
  if (room <= 0) return false;
  const buyable = Math.min(qty, room);
  const cost = discountedGold(Math.ceil(buyable / AMMO_PER_GOLD));
  if (!canAfford('gold', cost)) return false;
  if (!spendResource('gold', cost)) return false;
  preparedArmy.value = { ...army, ammunition: current + buyable };
  return true;
}

/**
 * Result of a recruitment attempt. `ok: true` means both gold and iuniores
 * were deducted and the cohort was appended. `ok: false` carries a typed
 * reason that S25-07 will use to show a specific disabled tooltip.
 */
export type RecruitResult =
  | { ok: true }
  | { ok: false; reason: 'unknown-cohort' | 'insufficient-gold' | 'insufficient-iuniores' };

/**
 * Recruit one cohort by id into the prepared army.
 *
 * Two-resource gate: requires both `cohort.aurumCost` in gold AND
 * `IUNIORES.recruitCost` (1000) iuniores. Both resources are pre-checked
 * via `canAfford` before either is spent, so no partial-spend state is
 * possible — if the function reaches the `spendResource` calls, both
 * will succeed.
 *
 * Returns a typed `RecruitResult` discriminated union. S25-07 will consume
 * the `reason` field to show resource-specific disabled tooltips in the
 * Exercitus catalog.
 */
export function recruitCohort(cohortId: string): RecruitResult {
  const cohort = getCohortById(cohortId);
  if (!cohort) return { ok: false, reason: 'unknown-cohort' };
  const failure = getRecruitFailureForCohort(cohort);
  if (failure) return { ok: false, reason: failure };

  // Atomic spend — guarded by the canAfford pre-checks above, so both
  // spendResource calls are guaranteed to succeed.
  spendResource('gold', discountedGold(cohort.aurumCost));
  if (!cohort.mercenary) spendResource('iuniores', IUNIORES.recruitCost);

  const army = ensurePreparedArmy();
  const updated: ArmyData = {
    ...army,
    cohorts: [...army.cohorts, createCohortInstance(cohort)],
  };
  updated.size = computeArmySize(updated.cohorts);
  preparedArmy.value = updated;
  return { ok: true };
}

export function getRecruitCohortFailure(cohortId: string): RecruitCohortFailure | null {
  const cohort = getCohortById(cohortId);
  if (!cohort) return 'unknown-cohort';
  return getRecruitFailureForCohort(cohort);
}

function getRecruitFailureForCohort(cohort: Cohort): RecruitCohortFailure | null {
  if (!cohort.mercenary && !canAfford('iuniores', IUNIORES.recruitCost)) return 'insufficient-iuniores';
  if (!canAfford('gold', discountedGold(cohort.aurumCost))) return 'insufficient-gold';
  return null;
}

/**
 * Remove the last cohort of the given type from the prepared army.
 * Refunds the cohort's aurumCost to gold. Regular citizen cohorts also refund
 * their iuniores recruit cost while still in the Hub-prep roster.
 */
export function removeCohort(cohortId: string): void {
  const army = preparedArmy.value;
  if (!army) return;
  const cohorts = [...army.cohorts];
  const exactIdx = cohorts.findIndex(c => c.instanceId === cohortId);
  const lastTypeIdx = exactIdx === -1 ? cohorts.map(c => c.id).lastIndexOf(cohortId) : -1;
  const removeIdx = exactIdx !== -1 ? exactIdx : lastTypeIdx;
  if (removeIdx === -1) return;
  const [removed] = cohorts.splice(removeIdx, 1);
  addResource('gold', removed.aurumCost);
  if (!removed.mercenary) addResource('iuniores', IUNIORES.recruitCost);
  preparedArmy.value = { ...army, cohorts, size: computeArmySize(cohorts) };
}

// ── S14-08: Legate actions ──

/**
 * Assign a Legate to the prepared army. Sets `preparedLegate` and syncs
 * `legateId` on the army shell.
 */
export function assignLegate(legate: Legate): void {
  preparedLegate.value = legate;
  const army = preparedArmy.value;
  if (army) preparedArmy.value = { ...army, legateId: legate.id };
}

/**
 * Dismiss the current Legate (no refund). Clears `preparedLegate` and
 * `legateId` on the army shell.
 */
export function dismissLegate(): void {
  preparedLegate.value = null;
  const army = preparedArmy.value;
  if (army) preparedArmy.value = { ...army, legateId: null };
}

/**
 * Ensure the hiring pool has candidates. Call on screen mount.
 * Does nothing if pool already has entries (persists across Hub visits).
 */
export function ensureLegatePool(): void {
  if (legateHiringPool.value.length === 0) {
    legateHiringPool.value = rollHiringPool(4);
  }
}

/**
 * Hire a Legate from the pool by id. Deducts `cost` gold, assigns the Legate,
 * removes them from pool, and adds a fresh candidate. Returns true on success.
 */
export function hireLegate(legateId: string, cost: number): boolean {
  const pool = legateHiringPool.value;
  const idx = pool.findIndex(l => l.id === legateId);
  if (idx === -1) return false;
  if (!spendResource('gold', cost)) return false;
  assignLegate(pool[idx]);
  const newPool = [...pool];
  newPool.splice(idx, 1, rollLegateCandidate());
  legateHiringPool.value = newPool;
  return true;
}

// ── Lifecycle ──

/**
 * Reset per-spoke state. Called at spoke start.
 * NOTE: does NOT reset manipulateUsesLeft — Augustus can activate Manipulate at the Hub
 * before embarking and the uses must survive into the spoke. Only resetStrategicStore
 * (full run reset) clears manipulateUsesLeft.
 */
export function resetStrategicSpoke(): void {
  // Intentionally empty: no per-spoke state needs clearing here yet.
  // warCryActive is NOT reset here — it is consumed at battle start via consumeWarCry().
}

/** Reset all strategic state. Called on new run / run end. */
export function resetStrategicStore(): void {
  crusadeBattlesLeft.value = 0;
  warCryLastUsedSpoke.value = -99;
  warCryActive.value = false;
  manipulateUsesLeft.value = 0;
  goldenOpportunityPending.value = 0;
  pendingEnemyConversions.value = 0;
  nextInvestmentDiscount.value = 0;
  preparedArmy.value = null;
  preparedLegate.value = null;
  legateHiringPool.value = [];
}
