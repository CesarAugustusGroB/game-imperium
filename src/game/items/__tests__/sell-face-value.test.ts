import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { gold, initResources, addResource, refundResource, setWarProfiler } from '../../core/resources';
import { sellDoctrine, addDoctrineToCollection, doctrineCollection } from '../doctrine-store';
import { sellDecretum, decretumHand } from '../decretum-store';
import type { Doctrine } from '../doctrine';
import type { Decretum } from '../decretum';

const mkDoctrine = (id: string): Doctrine =>
  ({ id, name: 'D', color: 'white', currentLevel: 1,
     levels: [{ description: '', effects: [], upgradeCost: {} }, { description: '', effects: [], upgradeCost: {} }, { description: '', effects: [], upgradeCost: {} }] } as unknown as Doctrine);
const mkDecretum = (id: string): Decretum =>
  ({ id, name: 'S', color: 'white', description: '', rarity: 'common', effect: { type: 'resource-gain', resource: 'gold', amount: 1 } } as unknown as Decretum);

beforeEach(() => {
  initResources({ gold: 0, iuniores: 0 });
  doctrineCollection.value = [];
  decretumHand.value = [];
});
afterEach(() => { setWarProfiler(false); });

describe('sells/refunds return face value, not income-inflated (D19)', () => {
  it('refundResource ignores War Profiteer; addResource applies it (sanity)', () => {
    setWarProfiler(true);
    addResource('gold', 10);
    expect(gold.value).toBe(15);          // +50% profiteer leaks through addResource
    gold.value = 0;
    refundResource('gold', 10);
    expect(gold.value).toBe(10);          // face value — no modifier
  });

  it('sellDoctrine pays exactly the sell price even with War Profiteer active', () => {
    setWarProfiler(true);
    addDoctrineToCollection(mkDoctrine('d_test'));
    const got = sellDoctrine('d_test');
    expect(got).toBe(8);                  // level-1 doctrine sell price
    expect(gold.value).toBe(8);           // received == returned, NOT 12
  });

  it('sellDecretum pays exactly the rarity sell price even with War Profiteer active', () => {
    setWarProfiler(true);
    decretumHand.value = [mkDecretum('s_test')];
    const got = sellDecretum('s_test');
    expect(gold.value).toBe(got);         // common = 2; received == returned, not ×1.5
  });
});
