import { signal } from '@preact/signals';
import { selectedCommander } from '../core/game-state';
import { spendResource, refundResource, canAfford } from '../core/resources';
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

// Empire-wide recruit discount from province synergies (Castrum+Forge =
// Military-Industrial), pushed in from game-state to avoid an import cycle.
let recruitDiscountFn: () => number = () => 0;
export function setRecruitDiscountFn(fn: () => number): void {
  recruitDiscountFn = fn;
}

// ── Helpers ──

/** Gold cost after equipped-doctrine + advisor shop-discount and province recruit synergies, min 1. */
function discountedGold(base: number): number {
  const pct = Math.min(75, getShopDiscount() + extraShopDiscountFn() + recruitDiscountFn());
  return Math.max(1, Math.round(base * (1 - pct / 100)));
}

// ── State signals ──
// NOTE (plan S-B): the old per-commander "strategic ability" signals
// (crusadeBattlesLeft, warCryActive, manipulateUsesLeft, goldenOpportunityPending,
// pendingEnemyConversions) were removed — that identity now lives in the Iter
// Belli signature ability cards (firma_grito_guerra / firma_cruzada /
// firma_manipular / firma_oportunidad) and the Veteran Stacks passive.

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
 * Refunds what recruiting it costs today: the DISCOUNTED gold price (the same
 * one recruitCohort charges) plus the iuniores recruit cost for citizens —
 * at face value, with no income modifiers, so recruit→remove can't print gold.
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
  refundResource('gold', discountedGold(removed.aurumCost));
  if (!removed.mercenary) refundResource('iuniores', IUNIORES.recruitCost);
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
 * before embarking. Per-spoke strategic state no longer exists (the ability
 * signals moved into Iter Belli signature cards).
 */
export function resetStrategicSpoke(): void {
  // Intentionally empty: no per-spoke state needs clearing here.
}

/** Reset all strategic state. Called on new run / run end. */
export function resetStrategicStore(): void {
  nextInvestmentDiscount.value = 0;
  preparedArmy.value = null;
  preparedLegate.value = null;
  legateHiringPool.value = [];
}
