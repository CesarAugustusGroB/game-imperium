/**
 * Decretum Hub-cast (Fase 2). Maps a Decretum's (battle-era) effect to a small
 * live set of Hub effects, gates casting, and tracks continuous effects that
 * tick on the season clock. Hub-only — the Iter Belli campaign module never
 * imports this. Types + the active-effects signal live here (the store imports
 * nothing from this module, so there is no import cycle).
 */
import { signal } from '@preact/signals';
import type { Faction, ResourceType } from '../core/commander';
import { canAfford } from '../core/resources';
import type { Decretum } from './decretum';
import { isDecretumCastable } from './decretum';

/** Iuniores granted per spawned unit when a `spawn` decretum is cast at the Hub. Tunable. */
export const RECRUIT_IUNIORES_PER_UNIT = 250;

/** A Hub effect derived from a Decretum. Only these kinds are "live" at the Hub. */
export type HubDecretumEffect =
  | { kind: 'grant'; resource: 'gold' | 'iuniores'; amount: number }   // instant — only live resources
  | { kind: 'heal-army'; fraction: number; target: 'all' | 'single' }  // instant
  | { kind: 'recruit'; iuniores: number }                              // instant
  | { kind: 'waive-upkeep'; seasons: number };                         // continuous

/** A continuous Hub effect currently active, with seasons remaining. */
export interface ActiveDecretumEffect {
  decretumId: string;
  name: string;
  effect: HubDecretumEffect;
  remainingSeasons: number;
}

/** Continuous Hub effects in flight (e.g. upkeep waivers). */
export const activeDecretumEffects = signal<ActiveDecretumEffect[]>([]);

/**
 * Translate a Decretum's effect into its Hub effect, or null if the scroll has
 * no Hub meaning (deprecated-resource grants, battle-only effects) → inert.
 */
export function toHubEffect(d: Decretum): HubDecretumEffect | null {
  const e = d.effect;
  switch (e.type) {
    case 'resource-gain':
      return e.resource === 'gold' || e.resource === 'iuniores'
        ? { kind: 'grant', resource: e.resource, amount: e.amount }
        : null;
    case 'heal':
      return { kind: 'heal-army', fraction: e.amount, target: e.target };
    case 'spawn':
      return { kind: 'recruit', iuniores: e.count * RECRUIT_IUNIORES_PER_UNIT };
    case 'upkeep-reduction':
      return { kind: 'waive-upkeep', seasons: e.seasons };
    default:
      // Exhaustiveness intentionally open: any unmapped effect type (battle-only
      // or deprecated-resource) is inert at the Hub by design ("set chico vivo").
      return null;
  }
}

/** Castable at the Hub: a commander of a matching faction, a live Hub effect, and affordable castCost. */
export function isCastableAtHub(d: Decretum, faction: Faction | null): boolean {
  if (faction === null) return false;
  if (!isDecretumCastable(d, faction)) return false;
  if (toHubEffect(d) === null) return false;
  if (d.castCost) {
    for (const [res, amt] of Object.entries(d.castCost) as [ResourceType, number][]) {
      if (amt > 0 && !canAfford(res, amt)) return false;
    }
  }
  return true;
}

/** Human-readable summary of a Hub effect (Spanish, for the Decreta tab). */
export function describeHubEffect(effect: HubDecretumEffect): string {
  switch (effect.kind) {
    case 'grant':
      return `+${effect.amount} ${effect.resource === 'gold' ? 'oro' : 'iuniores'}`;
    case 'heal-army':
      return effect.target === 'single'
        ? `Sana la cohorte más dañada un ${Math.round(effect.fraction * 100)}%`
        : `Sana al ejército un ${Math.round(effect.fraction * 100)}%`;
    case 'recruit':
      return `Recluta +${effect.iuniores} iuniores`;
    case 'waive-upkeep':
      return `Sin upkeep por ${effect.seasons} ${effect.seasons === 1 ? 'temporada' : 'temporadas'}`;
  }
}

/** True while any continuous waive-upkeep effect is active. */
export function isUpkeepWaived(): boolean {
  return activeDecretumEffects.value.some((a) => a.effect.kind === 'waive-upkeep');
}

/** Advance active continuous effects one season; drop those that hit zero. */
export function tickActiveDecretumEffects(): void {
  activeDecretumEffects.value = activeDecretumEffects.value
    .map((a) => ({ ...a, remainingSeasons: a.remainingSeasons - 1 }))
    .filter((a) => a.remainingSeasons > 0);
}
