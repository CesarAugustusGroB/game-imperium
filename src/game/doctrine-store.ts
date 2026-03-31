import { signal } from '@preact/signals';
import type { Doctrine, DoctrineEffect, ResourceCost } from './doctrine';
import { isDoctrineEquippable, getCurrentEffects, getUpgradeCost, getDoctrineSellPrice } from './doctrine';
import { addResource, spendResource, canAfford } from './resources';
import { selectedCommander } from './game-state';
import type { ResourceType } from './commander';

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

/** Sum of all revive hpPercent values from equipped doctrines. Returns 0 if none. */
export function getReviveThreshold(): number {
  return getActiveEffects()
    .filter((e): e is Extract<DoctrineEffect, { type: 'revive' }> => e.type === 'revive')
    .reduce((max, e) => Math.max(max, e.hpPercent), 0);
}

/** Total extra event choices granted by equipped doctrines. */
export function getExtraEventChoices(): number {
  return getActiveEffects()
    .filter((e): e is Extract<DoctrineEffect, { type: 'extra-event-choices' }> => e.type === 'extra-event-choices')
    .reduce((sum, e) => sum + e.count, 0);
}

/** Aggregate income-modifier multiplier for a given resource (additive). Returns 0 if none. */
export function getIncomeModifier(resource: string): number {
  return getActiveEffects()
    .filter((e): e is Extract<DoctrineEffect, { type: 'income-modifier' }> => e.type === 'income-modifier' && e.resource === resource)
    .reduce((sum, e) => sum + e.multiplier, 0);
}

// ── Reset ──

/** Reset all doctrine state (called on run end / title screen return). */
export function resetDoctrineStore(): void {
  equippedDoctrines.value = [null, null, null, null];
  doctrineCollection.value = [];
}
