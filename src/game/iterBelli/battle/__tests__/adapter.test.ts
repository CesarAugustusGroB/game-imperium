import { describe, it, expect } from 'vitest';
import { sumRosterStats, strengthFrac, clampEngineDiscipline } from '../adapter';
import { legateFormationKeys, terrainToCenterKey, availableFormations } from '../adapter';
import { CENTERS } from '../orders';

const cohort = (o: Partial<{charge:number;harass:number;push:number;siege:number;movement:number}>) =>
  ({ id:'c', name:'c', role:'vanguard', aurumCost:0, description:'',
     stats: { hp:1000, charge:0, harass:0, push:0, siege:0, movement:0, ...o } } as any);

describe('adapter stat summation', () => {
  it('sums each power stat across the roster', () => {
    const r = sumRosterStats([cohort({push:3,charge:1}), cohort({push:2,movement:2})]);
    expect(r).toEqual({ charge:1, harass:0, push:5, siege:0, movement:2 });
  });
  it('strengthFrac clamps soldiers/initial to 0..1', () => {
    expect(strengthFrac(6000, 10000)).toBeCloseTo(0.6);
    expect(strengthFrac(12000, 10000)).toBe(1);
    expect(strengthFrac(0, 0)).toBe(0);
  });
  it('clampEngineDiscipline passes campaign 0..10 through, clamped', () => {
    expect(clampEngineDiscipline(2)).toBe(2);
    expect(clampEngineDiscipline(6)).toBe(6);
    expect(clampEngineDiscipline(13)).toBe(10);
    expect(clampEngineDiscipline(-1)).toBe(0);
  });
});

describe('adapter formations + terrain', () => {
  it('commons always available; null legate → commons only', () => {
    const keys = legateFormationKeys(null);
    expect(keys).toEqual(['battleLine','openOrder','shieldWall','duplex']);
  });
  it('a veteran legate unlocks triplex', () => {
    const keys = legateFormationKeys({ traitIds:['veteran'] } as any);
    expect(keys).toContain('triplex');
  });
  it('real traits map to the right unique formation', () => {
    expect(legateFormationKeys({ traitIds:['disciplined'] } as any)).toContain('triplex');
    expect(legateFormationKeys({ traitIds:['cautious'] } as any)).toContain('testudo');
    expect(legateFormationKeys({ traitIds:['aggressive'] } as any)).toContain('cuneus');
    expect(legateFormationKeys({ traitIds:['swift','stoic'] } as any)).toEqual(
      expect.arrayContaining(['cuneus','testudo']),
    );
  });
  it('morale-only traits gate no unique formation (commons only)', () => {
    expect(legateFormationKeys({ traitIds:['charismatic','inspiring','rallying'] } as any))
      .toEqual(['battleLine','openOrder','shieldWall','duplex']);
  });
  it('terrain maps to a real center; unknown falls back to plain', () => {
    expect(CENTERS[terrainToCenterKey('hills')].name).toBe('Hill');
    expect(CENTERS[terrainToCenterKey('marsh')]).toBeDefined();
  });
  it('availableFormations filters by discipline req', () => {
    const keys = availableFormations({ traitIds:['veteran'] } as any, 4); // engine disc 4
    expect(keys).toContain('battleLine');     // disc 2
    expect(keys).not.toContain('triplex');    // disc 6 > 4, locked
  });
});

import { buildPlayerSeed, buildEnemyArchetype } from '../adapter';
import { ENEMY_ARCHETYPES } from '../orders';

describe('adapter army builders', () => {
  const roster = [cohort({push:3}), cohort({push:3}), cohort({charge:2,movement:2})];
  it('player seed scales mass stats by strength, keeps movement, scales discipline', () => {
    const seed = buildPlayerSeed(
      { soldiers: 5000, initialSoldiers: 10000, morale: 7, discipline: 3 } as any,
      roster, null,
    );
    expect(seed.hp).toBe(5000);
    expect(seed.morale).toBe(7);
    expect(seed.discipline).toBe(3);          // pass-through (no ×2)
    expect(seed.stats.push).toBe(3);          // 6 × 0.5 strength
    expect(seed.stats.movement).toBe(2);      // movement NOT scaled
  });
  it('player seed maps the armor material to mitigation %', () => {
    const seed = buildPlayerSeed(
      { soldiers: 5000, initialSoldiers: 10000, morale: 7, discipline: 3 } as any,
      roster, null, undefined, { material: 'steel' },
    );
    expect(seed.armorPct).toBe(30);
    expect(seed.armorName).toBe('Steel');
  });
  it('entrenchment grants a Camp-tier fort bonus', () => {
    const plain = buildPlayerSeed({ soldiers: 1, initialSoldiers: 1, morale: 5, discipline: 0 } as any, roster, null);
    expect(plain.fortPct).toBe(0);
    const dug = buildPlayerSeed({ soldiers: 1, initialSoldiers: 1, morale: 5, discipline: 0 } as any, roster, null, undefined, null, undefined, true);
    expect(dug.fortPct).toBe(10);
    expect(dug.fortName).toBe('Camp');
  });
  it('player seed takes ammunition from the snapshot when present', () => {
    const seed = buildPlayerSeed(
      { soldiers: 5000, initialSoldiers: 10000, morale: 7, discipline: 3, ammunition: 21 } as any,
      roster, null,
    );
    expect(seed.ammo).toBe(21);
  });
  it('passive morale bonus (Deus Vult) adds to pre-battle morale, clamped to 15', () => {
    const base = buildPlayerSeed({ soldiers: 100, initialSoldiers: 100, morale: 7, discipline: 3 } as any, roster, null);
    expect(base.morale).toBe(7);
    const blessed = buildPlayerSeed({ soldiers: 100, initialSoldiers: 100, morale: 7, discipline: 3 } as any, roster, null, undefined, null, undefined, false, 1, 3);
    expect(blessed.morale).toBe(10);          // 7 + 3
    const capped = buildPlayerSeed({ soldiers: 100, initialSoldiers: 100, morale: 14, discipline: 3 } as any, roster, null, undefined, null, undefined, false, 1, 5);
    expect(capped.morale).toBe(15);           // 14 + 5 → clamped to 15
  });
  it('enemy archetype scales mass stats by enemyWeaken', () => {
    const e = buildEnemyArchetype('carthage', 0, 10000); // no weaken
    expect(e.stats.charge).toBe(ENEMY_ARCHETYPES.carthage.stats.charge);
    const w = buildEnemyArchetype('carthage', 5, 10000); // 5 × 7% = 35% weaker
    expect(w.stats.charge).toBeLessThan(ENEMY_ARCHETYPES.carthage.stats.charge);
    expect(w.stats.movement).toBe(ENEMY_ARCHETYPES.carthage.stats.movement); // movement unscaled
  });
});

describe('legate trait bonuses in the seed (plan S-B)', () => {
  const full = { soldiers: 100, initialSoldiers: 100, morale: 8, discipline: 5 } as any;

  it('veteran (+15% charge to vanguard) scales only vanguard charge', () => {
    const roster = [
      cohort({ charge: 100 }), // vanguard (default role in helper)
      { ...cohort({ charge: 100 }), role: 'reserve' } as any,
    ];
    const seed = buildPlayerSeed(full, roster, { traitIds: ['veteran'] } as any);
    expect(seed.stats.charge).toBe(Math.round(100 * 1.15) + 100); // 115 + 100
  });

  it('swift (+20% movement to all) scales every cohort movement', () => {
    const roster = [cohort({ movement: 50 }), { ...cohort({ movement: 50 }), role: 'guard' } as any];
    const seed = buildPlayerSeed(full, roster, { traitIds: ['swift'] } as any);
    expect(seed.stats.movement).toBe(120); // (50+50) × 1.2
  });

  it('stoic (+15% hp) inflates seed hp', () => {
    const roster = [cohort({ push: 10 })];
    const seed = buildPlayerSeed(full, roster, { traitIds: ['stoic'] } as any);
    expect(seed.hp).toBe(Math.round(100 * 1.15));
  });

  it('inspiring (+25 legacy morale → +2.5 engine) lifts pre-battle morale, clamped 0..15', () => {
    const roster = [cohort({ push: 10 })];
    const seed = buildPlayerSeed({ ...full, morale: 8 }, roster, { traitIds: ['inspiring'] } as any);
    expect(seed.morale).toBeCloseTo(10.5);
    const high = buildPlayerSeed({ ...full, morale: 14 }, roster, { traitIds: ['inspiring'] } as any);
    expect(high.morale).toBe(15); // clamped
  });

  it('rallying (+25% all stats) boosts the single strongest cohort only', () => {
    const strong = cohort({ charge: 100 });
    const weak = cohort({ charge: 10 });
    const seed = buildPlayerSeed(full, [strong, weak], { traitIds: ['rallying'] } as any);
    expect(seed.stats.charge).toBe(Math.round(100 * 1.25) + 10); // 125 + 10
  });

  it('null legate applies no mods (regression)', () => {
    const roster = [cohort({ charge: 100 })];
    const seed = buildPlayerSeed(full, roster, null);
    expect(seed.stats.charge).toBe(100);
    expect(seed.hp).toBe(100);
    expect(seed.morale).toBe(8);
  });

  it('statMult (Veteran Stacks passive) scales attack stats', () => {
    const roster = [cohort({ charge: 100 })];
    const seed = buildPlayerSeed(full, roster, null, undefined, null, undefined, false, 1.25);
    expect(seed.stats.charge).toBe(125);
  });
});
