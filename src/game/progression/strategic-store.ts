import { signal } from '@preact/signals';
import { selectedCommander, completedSpokes } from '../core/game-state';
import { spendResource, canAfford } from '../core/resources';
import type { ArmyData } from '../../types/index';
import type { Legate } from '../army/legate';

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
}
