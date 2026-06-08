import { describe, it, expect } from 'vitest';
import { SAGUNTUM } from '../iter-belli-scenario-saguntum';
import { ENEMY_ARCHETYPES } from '../../game/iterBelli/battle/orders';

describe('scenario enemy archetype', () => {
  it('Saguntum points at the Carthage archetype', () => {
    expect(SAGUNTUM.enemy.archetypeKey).toBe('carthage');
    expect(ENEMY_ARCHETYPES[SAGUNTUM.enemy.archetypeKey]).toBeDefined();
  });
});
