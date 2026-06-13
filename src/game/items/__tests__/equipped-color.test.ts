import { describe, it, expect, afterEach } from 'vitest';
import { equippedDoctrines, getEquippedColorCount } from '../doctrine-store';
import type { Doctrine } from '../doctrine';
import type { Faction } from '../../core/commander';

const mk = (color: Faction): Doctrine =>
  ({ id: 'd_' + color + Math.random(), name: 'D', color, currentLevel: 1,
     levels: [{ description: '', effects: [], upgradeCost: {} }, { description: '', effects: [], upgradeCost: {} }, { description: '', effects: [], upgradeCost: {} }] } as unknown as Doctrine);

afterEach(() => { equippedDoctrines.value = [null, null, null, null]; });

describe('getEquippedColorCount (Deus Vult support)', () => {
  it('counts only equipped doctrines of the given color, ignoring nulls', () => {
    equippedDoctrines.value = [mk('gold'), mk('gold'), mk('white'), null];
    expect(getEquippedColorCount('gold')).toBe(2);
    expect(getEquippedColorCount('white')).toBe(1);
    expect(getEquippedColorCount('red')).toBe(0);
  });

  it('is 0 with no doctrines equipped', () => {
    equippedDoctrines.value = [null, null, null, null];
    expect(getEquippedColorCount('gold')).toBe(0);
  });
});
