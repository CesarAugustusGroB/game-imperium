/**
 * Decretum Hub-cast (Fase 2). Maps a Decretum's (battle-era) effect to a small
 * live set of Hub effects, gates casting, and tracks continuous effects that
 * tick on the season clock. Hub-only — the Iter Belli campaign module never
 * imports this. Types + the active-effects signal live here (the store imports
 * nothing from this module, so there is no import cycle).
 */
import { signal } from '@preact/signals';
import type { Faction, ResourceType } from '../core/commander';
import { canAfford, addResource, spendResource } from '../core/resources';
import { selectedCommander } from '../core/game-state';
import { preparedArmy } from '../progression/strategic-store';
import type { Cohort } from '../army/cohort';
import type { Decretum } from './decretum';
import { isDecretumCastable } from './decretum';
import { decretumHand, removeDecretum } from './decretum-store';

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

/** Heal the prepared army's cohorts by `fraction` of max HP (all, or the most-damaged one). */
function healPreparedArmy(fraction: number, target: 'all' | 'single'): void {
  const army = preparedArmy.value;
  if (!army || army.cohorts.length === 0) return;
  const heal = (c: Cohort): Cohort => {
    const max = c.stats.hp;
    const cur = c.currentHp ?? max;
    return { ...c, currentHp: Math.min(max, cur + Math.round(fraction * max)) };
  };
  let cohorts: Cohort[];
  if (target === 'all') {
    cohorts = army.cohorts.map(heal);
  } else {
    let idx = -1;
    let worstGap = -1;
    army.cohorts.forEach((c, i) => {
      const gap = c.stats.hp - (c.currentHp ?? c.stats.hp);
      if (gap > worstGap) { worstGap = gap; idx = i; }
    });
    cohorts = army.cohorts.map((c, i) => (i === idx ? heal(c) : c));
  }
  preparedArmy.value = { ...army, cohorts };
}

/** Apply a resolved Hub effect (instant directly; continuous pushed to actives). */
function applyHubEffect(effect: HubDecretumEffect, scroll: Decretum): void {
  switch (effect.kind) {
    case 'grant':
      addResource(effect.resource, effect.amount);
      break;
    case 'recruit':
      addResource('iuniores', effect.iuniores);
      break;
    case 'heal-army':
      healPreparedArmy(effect.fraction, effect.target);
      break;
    case 'waive-upkeep':
      activeDecretumEffects.value = [
        ...activeDecretumEffects.value,
        { decretumId: scroll.id, name: scroll.name, effect, remainingSeasons: effect.seasons },
      ];
      break;
  }
}

/**
 * Cast a Decretum from the Hub: validates castability, pays castCost, applies the
 * Hub effect, and removes the scroll from hand. Returns false if not castable.
 */
export function castDecretumAtHub(id: string): boolean {
  const scroll = decretumHand.value.find((d) => d.id === id);
  if (!scroll) return false;
  const faction = selectedCommander.value?.faction ?? null;
  if (!isCastableAtHub(scroll, faction)) return false;
  const effect = toHubEffect(scroll);
  if (!effect) return false;
  if (scroll.castCost) {
    for (const [res, amt] of Object.entries(scroll.castCost) as [ResourceType, number][]) {
      if (amt > 0) spendResource(res, amt);
    }
  }
  applyHubEffect(effect, scroll);
  removeDecretum(id);
  return true;
}
