import { describe, it, expect, beforeEach } from 'vitest';
import {
  forgedAllies, allyCount, addAlly, collectAllyIncome, resetAllies,
  ALLY_TRIBE_IUNIORES, ALLY_KINGDOM_GOLD,
} from '../ally-store';
import { gold, iuniores, initResources } from '../../core/resources';

beforeEach(() => {
  resetAllies();
  initResources({ gold: 0, iuniores: 0 });
});

describe('ally-store (plan S-L)', () => {
  it('starts empty', () => {
    expect(allyCount.value).toBe(0);
    expect(forgedAllies.value).toEqual([]);
  });

  it('addAlly appends an ally of the requested kind and bumps allyCount', () => {
    const tribe = addAlly('tribe');
    const kingdom = addAlly('kingdom');
    expect(tribe.kind).toBe('tribe');
    expect(kingdom.kind).toBe('kingdom');
    expect(allyCount.value).toBe(2);
  });

  it('gives each ally a unique id', () => {
    addAlly('tribe'); addAlly('tribe'); addAlly('kingdom');
    const ids = forgedAllies.value.map((a) => a.id);
    expect(new Set(ids).size).toBe(3);
  });

  it('collectAllyIncome pays iuniores per tribe and gold per kingdom', () => {
    addAlly('tribe');           // → iuniores
    addAlly('kingdom');         // → gold
    addAlly('kingdom');         // → gold
    const r = collectAllyIncome();
    expect(r.iuniores).toBe(ALLY_TRIBE_IUNIORES);
    expect(r.gold).toBe(2 * ALLY_KINGDOM_GOLD);
    expect(iuniores.value).toBe(ALLY_TRIBE_IUNIORES);
    expect(gold.value).toBe(2 * ALLY_KINGDOM_GOLD);
  });

  it('no allies → no income', () => {
    const r = collectAllyIncome();
    expect(r).toEqual({ gold: 0, iuniores: 0 });
  });

  it('resetAllies clears the roster', () => {
    addAlly('tribe');
    resetAllies();
    expect(allyCount.value).toBe(0);
  });
});
