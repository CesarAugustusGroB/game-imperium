import { signal } from '@preact/signals';
import type { Decretum, DecretumEffect } from './decretum';
import { isDecretumCastable, DECRETUM_SELL_PRICE } from './decretum';
import { addResource } from '../core/resources';
import { selectedCommander } from '../core/game-state';
import type { Faction } from '../core/commander';

// ── Signals ──

/** The player's current decretum hand. */
export const decretumHand = signal<Decretum[]>([]);

/** Maximum number of scrolls the player can hold. */
export const maxHandSize = signal<number>(5);

// ── Mutations ──

/**
 * Add a decretum to the hand if space is available.
 * Returns false if the hand is already at maxHandSize.
 */
export function addDecretum(d: Decretum): boolean {
  if (decretumHand.value.length >= maxHandSize.value) return false;
  decretumHand.value = [...decretumHand.value, d];
  return true;
}

/**
 * Remove a decretum from the hand by id.
 * No-op if the id is not found.
 */
export function removeDecretum(id: string): void {
  decretumHand.value = decretumHand.value.filter((d) => d.id !== id);
}

/**
 * Attempt to cast a decretum by id.
 * Checks that a commander is selected and the scroll is castable by their faction.
 * If castable, removes the scroll from hand and returns true.
 * Effect application is delegated to the battle UI (S4-10).
 */
export function castDecretum(id: string): boolean {
  const scroll = decretumHand.value.find((d) => d.id === id);
  if (!scroll) return false;

  const commander = selectedCommander.value;
  if (!commander) return false;

  if (!isDecretumCastable(scroll, commander.faction)) return false;

  removeDecretum(id);
  return true;
}

/**
 * Sell a decretum for gold.
 * Selling bypasses the faction 2x multiplier.
 * Returns the gold gained, or 0 if the scroll was not found.
 */
export function sellDecretum(id: string): number {
  const scroll = decretumHand.value.find((d) => d.id === id);
  if (!scroll) return 0;

  const price = DECRETUM_SELL_PRICE[scroll.rarity];
  addResource('gold', price); // no faction param — selling bypasses 2x
  removeDecretum(id);
  return price;
}

/**
 * Return the current hand enriched with castability for the active commander.
 * Castability is false for all scrolls when no commander is selected.
 */
export function getHandWithCastability(): Array<{ decretum: Decretum; castable: boolean }> {
  const faction = selectedCommander.value?.faction ?? null;
  return decretumHand.value.map((d) => ({
    decretum: d,
    castable: faction !== null ? isDecretumCastable(d, faction) : false,
  }));
}

/**
 * Clear the decretum hand entirely.
 * Called on run reset.
 */
export function resetDecretumHand(): void {
  decretumHand.value = [];
}

// Re-export types consumed by callers that import from this module
export type { Decretum, DecretumEffect, Faction };
