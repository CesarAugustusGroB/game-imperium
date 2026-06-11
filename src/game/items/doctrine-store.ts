import { signal } from '@preact/signals';
import type { Doctrine, DoctrineEffect } from './doctrine';
import type { ResourceCost } from '../../types/index';
import { isDoctrineEquippable, getCurrentEffects, getUpgradeCost, getDoctrineSellPrice } from './doctrine';
import { addResource, spendResource, canAfford } from '../core/resources';
import { selectedCommander } from '../core/game-state';
import { DOCTRINE_CATALOG } from '../../data/doctrine-data';
import type { ResourceType } from '../core/commander';

// ── Doctrine slot signals ──

/** 4 equip slots — null means empty. */
export const equippedDoctrines = signal<(Doctrine | null)[]>([null, null, null, null]);

/** All owned doctrines not currently equipped. */
export const doctrineCollection = signal<Doctrine[]>([]);

// ── Slot management ──

/**
 * Equip a doctrine from the collection into the given slot (0–3).
 * If the slot is occupied, the current doctrine is moved back to the collection.
 * Returns true on success, false if the slot index is invalid or the doctrine
 * cannot be equipped by the active commander's faction.
 */
export function equipDoctrine(slotIndex: number, doctrine: Doctrine): boolean {
  if (slotIndex < 0 || slotIndex > 3) return false;

  const commander = selectedCommander.value;
  if (!commander) return false;
  if (!isDoctrineEquippable(doctrine, commander.faction)) return false;

  const slots = equippedDoctrines.value.slice() as (Doctrine | null)[];
  const collection = doctrineCollection.value.slice();

  // Move displaced doctrine back to collection
  const displaced = slots[slotIndex];
  if (displaced !== null) {
    collection.push(displaced);
  }

  // Remove the doctrine being equipped from the collection
  const collectionIndex = collection.findIndex(d => d.id === doctrine.id);
  if (collectionIndex !== -1) {
    collection.splice(collectionIndex, 1);
  }

  slots[slotIndex] = doctrine;

  equippedDoctrines.value = slots;
  doctrineCollection.value = collection;

  return true;
}

/**
 * Swap the contents of two equipped slots (including empties).
 * No-op if either index is out of range or both indices are the same.
 * Does NOT touch the collection — the doctrines stay equipped, just in
 * different positions. Useful for UI reordering via drag-and-drop.
 */
export function swapEquippedDoctrines(a: number, b: number): void {
  if (a < 0 || a > 3 || b < 0 || b > 3 || a === b) return;
  const slots = equippedDoctrines.value.slice() as (Doctrine | null)[];
  const tmp = slots[a];
  slots[a] = slots[b];
  slots[b] = tmp;
  equippedDoctrines.value = slots;
}

/**
 * Unequip the doctrine in the given slot and return it to the collection.
 * No-op if the slot is empty or the index is out of range.
 */
export function unequipDoctrine(slotIndex: number): void {
  if (slotIndex < 0 || slotIndex > 3) return;

  const slots = equippedDoctrines.value.slice() as (Doctrine | null)[];
  const doctrine = slots[slotIndex];
  if (doctrine === null) return;

  const collection = doctrineCollection.value.slice();
  collection.push(doctrine);
  slots[slotIndex] = null;

  equippedDoctrines.value = slots;
  doctrineCollection.value = collection;
}

// ── Upgrading ──

/**
 * Upgrade the doctrine in the given slot to the next level.
 * Checks and spends the required resources.
 * Returns true on success, false if the slot is empty, doctrine is already
 * max level, or the player cannot afford the upgrade.
 */
export function upgradeDoctrine(slotIndex: number): boolean {
  if (slotIndex < 0 || slotIndex > 3) return false;

  const slots = equippedDoctrines.value.slice() as (Doctrine | null)[];
  const doctrine = slots[slotIndex];
  if (doctrine === null) return false;
  if (doctrine.currentLevel >= 3) return false;

  const cost: ResourceCost | null = getUpgradeCost(doctrine);
  if (cost === null) return false;

  // Check affordability before spending anything
  for (const [resource, amount] of Object.entries(cost) as [ResourceType, number][]) {
    if (!canAfford(resource, amount)) return false;
  }

  // Spend all resources
  for (const [resource, amount] of Object.entries(cost) as [ResourceType, number][]) {
    spendResource(resource, amount);
  }

  // Create a new Doctrine object with incremented level for signal reactivity
  const upgradedDoctrine: Doctrine = {
    ...doctrine,
    currentLevel: (doctrine.currentLevel + 1) as 2 | 3,
  };

  slots[slotIndex] = upgradedDoctrine;
  equippedDoctrines.value = slots;

  return true;
}

// ── Selling ──

/**
 * Sell a doctrine from the collection by its ID.
 * Equipped doctrines cannot be sold — unequip first.
 * Returns the gold gained, or 0 if the doctrine was not found in the collection.
 */
export function sellDoctrine(doctrineId: string): number {
  // Cannot sell equipped doctrines — unequip first
  if (equippedDoctrines.value.some(d => d?.id === doctrineId)) return 0;
  const collection = doctrineCollection.value.slice();
  const index = collection.findIndex(d => d.id === doctrineId);
  if (index === -1) return 0;

  const doctrine = collection[index];
  const price = getDoctrineSellPrice(doctrine);

  // No faction passed — selling bypasses the 2x primary resource multiplier
  addResource('gold', price);

  collection.splice(index, 1);
  doctrineCollection.value = collection;

  return price;
}

// ── Collection management ──

/** Add a doctrine to the collection (e.g. from a reward or shop purchase). */
export function addDoctrineToCollection(doctrine: Doctrine): void {
  doctrineCollection.value = [...doctrineCollection.value, doctrine];
}

// ── Victory draft ──

/**
 * Doctrines offered by the pending victory draft, or null when no draft is
 * pending. Set after a victorious Iter Belli campaign; cleared on pick.
 * Persists (via meta-save) until the player chooses.
 */
export const pendingDoctrineDraft = signal<Doctrine[] | null>(null);

/**
 * Roll a victory draft: up to `count` random doctrines the commander could
 * equip but does not own yet. Returns false (and clears the draft) when the
 * acquirable pool is exhausted or no commander is selected.
 */
export function rollDoctrineDraft(count = 3): boolean {
  const commander = selectedCommander.value;
  if (!commander) return false;

  const owned = new Set(
    [...equippedDoctrines.value, ...doctrineCollection.value]
      .filter((d): d is Doctrine => d !== null)
      .map((d) => d.id),
  );
  const pool = DOCTRINE_CATALOG.filter(
    (d) => !owned.has(d.id) && isDoctrineEquippable(d, commander.faction),
  );
  if (pool.length === 0) {
    pendingDoctrineDraft.value = null;
    return false;
  }

  const shuffled = pool.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  pendingDoctrineDraft.value = shuffled.slice(0, count).map((d) => ({ ...d, currentLevel: 1 as const }));
  return true;
}

/**
 * Pick one doctrine from the pending draft into the collection.
 * Returns false if there is no draft or the id is not among the offers.
 */
export function chooseDraftDoctrine(doctrineId: string): boolean {
  const draft = pendingDoctrineDraft.value;
  if (!draft) return false;
  const pick = draft.find((d) => d.id === doctrineId);
  if (!pick) return false;
  addDoctrineToCollection(pick);
  pendingDoctrineDraft.value = null;
  return true;
}

// ── Effect aggregation ──

/**
 * Collect and flatten the active effects from all equipped (non-null) doctrines.
 * Returns an empty array when no doctrines are equipped.
 */
export function getActiveEffects(): DoctrineEffect[] {
  const effects: DoctrineEffect[] = [];
  for (const doctrine of equippedDoctrines.value) {
    if (doctrine !== null) {
      effects.push(...getCurrentEffects(doctrine));
    }
  }
  return effects;
}

// ── Typed effect helpers ──

/** Aggregate income-modifier multiplier for a given resource (additive). Returns 0 if none. */
export function getIncomeModifier(resource: ResourceType): number {
  return getActiveEffects()
    .filter((e): e is Extract<DoctrineEffect, { type: 'income-modifier' }> => e.type === 'income-modifier' && e.resource === resource)
    .reduce((sum, e) => sum + e.multiplier, 0);
}

/** Sum of shop-discount percents from equipped doctrines, clamped 0–75. */
export function getShopDiscount(): number {
  const sum = getActiveEffects()
    .filter((e): e is Extract<DoctrineEffect, { type: 'shop-discount' }> => e.type === 'shop-discount')
    .reduce((s, e) => s + e.percent, 0);
  return Math.max(0, Math.min(75, sum));
}

/** Sum of upkeep-reduction percents from equipped doctrines (Infrastructure/Annona), clamped 0–75. */
export function getUpkeepReduction(): number {
  const sum = getActiveEffects()
    .filter((e): e is Extract<DoctrineEffect, { type: 'upkeep-reduction' }> => e.type === 'upkeep-reduction')
    .reduce((s, e) => s + e.percent, 0);
  return Math.max(0, Math.min(75, sum));
}

/** Aggregate embark-army bonus (per stat) from equipped doctrines. */
export function getEmbarkBonus(): { soldiers: number; morale: number; supplies: number; discipline: number; gold: number } {
  const out = { soldiers: 0, morale: 0, supplies: 0, discipline: 0, gold: 0 };
  for (const e of getActiveEffects()) {
    if (e.type === 'embark-bonus') out[e.stat] += e.amount;
  }
  return out;
}

// ── Reset ──

/** Reset all doctrine state (called on run end / title screen return). */
export function resetDoctrineStore(): void {
  equippedDoctrines.value = [null, null, null, null];
  doctrineCollection.value = [];
  pendingDoctrineDraft.value = null;
}
