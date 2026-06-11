import { describe, it, expect, beforeEach } from 'vitest';
import type { Commander } from '../../core/commander';
import { selectedCommander } from '../../core/game-state';
import { DOCTRINE_CATALOG } from '../../../data/doctrine-data';
import { isDoctrineEquippable } from '../doctrine';
import {
  doctrineCollection,
  equippedDoctrines,
  pendingDoctrineDraft,
  resetDoctrineStore,
  rollDoctrineDraft,
  chooseDraftDoctrine,
  addDoctrineToCollection,
} from '../doctrine-store';

function grantStarters(faction: Commander['faction']): void {
  for (const d of DOCTRINE_CATALOG) {
    if (d.starter && isDoctrineEquippable(d, faction)) {
      addDoctrineToCollection({ ...d, currentLevel: 1 });
    }
  }
}

describe('doctrine victory draft', () => {
  beforeEach(() => {
    resetDoctrineStore();
    selectedCommander.value = { faction: 'red' } as unknown as Commander;
    grantStarters('red');
  });

  it('starter core covers the 4 equip slots for every faction', () => {
    for (const faction of ['red', 'blue', 'gold', 'purple', 'white'] as const) {
      const starters = DOCTRINE_CATALOG.filter(
        (d) => d.starter && isDoctrineEquippable(d, faction),
      );
      expect(starters.length).toBeGreaterThanOrEqual(4);
    }
  });

  it('starter core is a proper subset — something is left to draft', () => {
    for (const faction of ['red', 'blue', 'gold', 'purple', 'white'] as const) {
      const eligible = DOCTRINE_CATALOG.filter((d) => isDoctrineEquippable(d, faction));
      const starters = eligible.filter((d) => d.starter);
      expect(starters.length).toBeLessThan(eligible.length);
    }
  });

  it('rolls 3 unowned, equippable doctrines at level 1', () => {
    expect(rollDoctrineDraft()).toBe(true);
    const draft = pendingDoctrineDraft.value!;
    expect(draft).toHaveLength(3);
    const ownedIds = new Set(doctrineCollection.value.map((d) => d.id));
    for (const d of draft) {
      expect(ownedIds.has(d.id)).toBe(false);
      expect(isDoctrineEquippable(d, 'red')).toBe(true);
      expect(d.currentLevel).toBe(1);
    }
  });

  it('choosing one adds it to the collection and clears the draft', () => {
    rollDoctrineDraft();
    const picked = pendingDoctrineDraft.value![0];
    const before = doctrineCollection.value.length;
    expect(chooseDraftDoctrine(picked.id)).toBe(true);
    expect(doctrineCollection.value.length).toBe(before + 1);
    expect(doctrineCollection.value.some((d) => d.id === picked.id)).toBe(true);
    expect(pendingDoctrineDraft.value).toBeNull();
  });

  it('rejects ids that are not among the offers', () => {
    rollDoctrineDraft();
    expect(chooseDraftDoctrine('doctrine_nonexistent')).toBe(false);
    expect(pendingDoctrineDraft.value).not.toBeNull();
  });

  it('returns false when the pool is exhausted', () => {
    // Own everything eligible for red
    for (const d of DOCTRINE_CATALOG) {
      if (!d.starter && isDoctrineEquippable(d, 'red')) {
        addDoctrineToCollection({ ...d, currentLevel: 1 });
      }
    }
    expect(rollDoctrineDraft()).toBe(false);
    expect(pendingDoctrineDraft.value).toBeNull();
  });

  it('offers fewer than 3 when little remains, never duplicates', () => {
    const acquirable = DOCTRINE_CATALOG.filter(
      (d) => !d.starter && isDoctrineEquippable(d, 'red'),
    );
    // Own all but one acquirable
    for (const d of acquirable.slice(1)) {
      addDoctrineToCollection({ ...d, currentLevel: 1 });
    }
    expect(rollDoctrineDraft()).toBe(true);
    expect(pendingDoctrineDraft.value).toHaveLength(1);
    expect(pendingDoctrineDraft.value![0].id).toBe(acquirable[0].id);
  });

  it('counts equipped doctrines as owned', () => {
    const acquirable = DOCTRINE_CATALOG.filter(
      (d) => !d.starter && isDoctrineEquippable(d, 'red'),
    );
    equippedDoctrines.value = [
      { ...acquirable[0], currentLevel: 1 }, null, null, null,
    ];
    rollDoctrineDraft();
    const draft = pendingDoctrineDraft.value ?? [];
    expect(draft.some((d) => d.id === acquirable[0].id)).toBe(false);
  });

  it('no commander → no draft', () => {
    selectedCommander.value = null;
    expect(rollDoctrineDraft()).toBe(false);
  });
});
