import type { Faction, ResourceType } from './commander';
import type { GameEvent, EventChoice, EventRequirement } from './event-types';
import type { InvestmentType } from './province';
import { EVENTS, FALLBACK_EVENT } from '../data/events';
import { getResource } from './resources';
import { provinces } from './province-store';
import { threatLevel } from './game-state';
import {
  consequenceFlags, seenEventsThisSpoke,
  setConsequenceFlag, markEventSeen,
} from './event-store';

// ── Tier gating thresholds ──

/** Minimum threat required for each event tier to appear. */
const TIER_THREAT_GATE: Record<1 | 2 | 3, number> = {
  1: 0,
  2: 3,
  3: 6,
};

// ── Faction color weights ──

/** Weight multiplier based on event color vs commander faction. */
function getColorWeight(eventColor: Faction | 'neutral', commanderFaction: Faction): number {
  if (eventColor === 'neutral') return 1;
  if (eventColor === commanderFaction) return 3;
  if (commanderFaction === 'white') return 2; // White gets moderate affinity to all
  return 0.5; // off-color
}

// ── Requirement checking ──

/** Check whether all requirements for an event are satisfied. */
export function meetsRequirements(
  req: EventRequirement | undefined,
  context: EventContext,
): boolean {
  if (!req) return true;

  if (req.minThreat != null && context.threatLevel < req.minThreat) return false;
  if (req.minProvinces != null && context.provinceCount < req.minProvinces) return false;

  if (req.minResource) {
    for (const [res, min] of Object.entries(req.minResource) as [ResourceType, number][]) {
      if (context.resources[res] < min) return false;
    }
  }

  if (req.hasInvestment) {
    if (!context.investments.includes(req.hasInvestment)) return false;
  }

  if (req.factionOnly && context.faction !== req.factionOnly) return false;

  if (req.requiresFlag && !context.flags.has(req.requiresFlag)) return false;
  if (req.blockedByFlag && context.flags.has(req.blockedByFlag)) return false;

  return true;
}

// ── Context builder ──

export interface EventContext {
  faction: Faction;
  threatLevel: number;
  provinceCount: number;
  resources: Record<ResourceType, number>;
  investments: InvestmentType[];
  flags: Set<string>;
  seenThisSpoke: Set<string>;
}

/** Build the event context from current game state. */
export function buildEventContext(faction: Faction): EventContext {
  const allProvinces = provinces.value;
  const investmentSet = new Set<InvestmentType>();
  for (const p of allProvinces) {
    for (const inv of p.investments) {
      investmentSet.add(inv.type);
    }
  }

  return {
    faction,
    threatLevel: threatLevel.value,
    provinceCount: allProvinces.length,
    resources: {
      gold: getResource('gold'),
      faith: getResource('faith'),
      influence: getResource('influence'),
      momentum: getResource('momentum'),
    },
    investments: Array.from(investmentSet),
    flags: consequenceFlags.value,
    seenThisSpoke: seenEventsThisSpoke.value,
  };
}

// ── Weighted random pick ──

function weightedRandomPick<T>(items: { item: T; weight: number }[]): T | null {
  const totalWeight = items.reduce((sum, i) => sum + i.weight, 0);
  if (totalWeight <= 0 || items.length === 0) return null;

  let roll = Math.random() * totalWeight;
  for (const { item, weight } of items) {
    roll -= weight;
    if (roll <= 0) return item;
  }
  return items[items.length - 1].item;
}

// ── Public API ──

/**
 * Pick an event from the pool, filtered by requirements, weighted by
 * faction color affinity, deduplicated within the current spoke.
 * Falls back to a generic "Uneventful March" if no events qualify.
 */
export function pickEvent(context: EventContext): GameEvent {
  const eligible = EVENTS.filter(ev => {
    // Tier gating
    if (context.threatLevel < TIER_THREAT_GATE[ev.tier]) return false;
    // Already seen this spoke
    if (context.seenThisSpoke.has(ev.id)) return false;
    // Requirement checking
    if (!meetsRequirements(ev.requirements, context)) return false;
    return true;
  });

  if (eligible.length === 0) return FALLBACK_EVENT;

  // Weight by faction color affinity
  const weighted = eligible.map(ev => ({
    item: ev,
    weight: getColorWeight(ev.color, context.faction),
  }));

  const picked = weightedRandomPick(weighted);
  if (!picked) return FALLBACK_EVENT;

  // Only persist the "seen" mark when the caller is using the real store set.
  // If pickEvent was called with a fresh ephemeral Set (e.g. for bonus choice
  // generation), we must NOT pollute the real store.
  if (context.seenThisSpoke === seenEventsThisSpoke.value) {
    markEventSeen(picked.id);
  }

  return picked;
}

/**
 * Apply an event choice: execute resource effects and set consequence flag.
 * Returns the effects that were applied (for UI display).
 */
export function applyEventChoice(
  choice: EventChoice,
  grantResource: (type: ResourceType, amount: number, faction?: Faction) => number,
  spendResource: (type: ResourceType, amount: number) => boolean,
  faction?: Faction,
): void {
  for (const effect of choice.effects) {
    if (effect.amount > 0) {
      grantResource(effect.resource, effect.amount, faction);
    } else if (effect.amount < 0) {
      spendResource(effect.resource, Math.abs(effect.amount));
    }
  }

  if (choice.consequence) {
    setConsequenceFlag(choice.consequence);
  }
}

/**
 * Check if a choice's explicit requiresResource gate is met.
 * Falls back to checking negative effects (legacy affordability).
 */
export function canAffordEventChoice(choice: EventChoice): boolean {
  // New: explicit resource gate
  if (choice.requiresResource) {
    for (const [res, min] of Object.entries(choice.requiresResource) as [ResourceType, number][]) {
      if (getResource(res) < min) return false;
    }
  }

  // Legacy: negative effects must be affordable
  return choice.effects.every(e =>
    e.amount >= 0 || getResource(e.resource) >= Math.abs(e.amount),
  );
}
