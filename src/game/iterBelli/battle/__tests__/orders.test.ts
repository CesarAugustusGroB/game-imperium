import { describe, it, expect } from 'vitest';
import { ORDERS, FORMATIONS, CENTERS, TERRAIN_CENTER, ENEMY_ARCHETYPES } from '../orders';

describe('battle data', () => {
  it('every formation references real orders', () => {
    for (const f of Object.values(FORMATIONS))
      for (const k of f.orders) expect(ORDERS[k], `missing order ${k}`).toBeDefined();
  });
  it('maps terrains to real centers', () => {
    for (const c of Object.values(TERRAIN_CENTER)) expect(CENTERS[c]).toBeDefined();
  });
  it('every enemy archetype names a real formation', () => {
    for (const e of Object.values(ENEMY_ARCHETYPES)) expect(FORMATIONS[e.formation]).toBeDefined();
  });
  it('tuned values match the prototype', () => {
    expect(ORDERS.siege.mult).toBe(1.45);
    expect(ORDERS.holdLine.protect).toBeCloseTo(0.38);
    expect(ORDERS.envelop.check).toBe(12);
    expect(FORMATIONS.triplex.disc).toBe(6);
  });
});
