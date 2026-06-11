import type { Cohort } from '../../army/cohort';
import type { PowerStats, EnemyArchetype, FormationDef } from './types';
import type { Legate } from '../../army/legate';
import type { FormationKey } from './types';
import { FORMATIONS, TERRAIN_CENTER, ENEMY_ARCHETYPES } from './orders';
import { ARMORS, FORTS } from './balance';
import { getLegateTraitById } from '../../army/legate-traits';

export function sumRosterStats(cohorts: readonly Cohort[]): PowerStats {
  const t: PowerStats = { charge: 0, harass: 0, push: 0, siege: 0, movement: 0 };
  for (const c of cohorts) {
    t.charge += c.stats.charge; t.harass += c.stats.harass; t.push += c.stats.push;
    t.siege += c.stats.siege; t.movement += c.stats.movement;
  }
  return t;
}

// ── Legate trait application (plan S-B) ──
// stat-bonus traits scale the matching role's contribution; stoic scales the
// army HP; charismatic/inspiring add pre-battle morale (legacy 0–100 amounts
// ÷10 onto the 0–15 engine scale); rallying boosts the strongest cohort.

const BATTLE_STAT_KEYS = ['charge', 'harass', 'push', 'siege', 'movement'] as const;

export interface LegateSeedMods { stats: PowerStats; hpMult: number; moraleBonus: number; }

export function legateSeedMods(roster: readonly Cohort[], legate: Legate | null): LegateSeedMods {
  const traits = (legate?.traitIds ?? []).map(getLegateTraitById).filter(Boolean) as ReturnType<typeof getLegateTraitById>[];
  const stats: PowerStats = { charge: 0, harass: 0, push: 0, siege: 0, movement: 0 };
  let hpMult = 1;
  let moraleBonus = 0;

  // Rallying targets the single strongest cohort (deterministic — no RNG in seeding).
  let rallyMult = 0;
  let strongestKey: PowerStats | null = null;
  let strongestSum = -1;
  for (const t of traits) {
    if (!t) continue;
    if (t.effect.type === 'random-rally') rallyMult = t.effect.multiplier;
    if (t.effect.type === 'morale-bonus') moraleBonus += t.effect.amount / 10;
    if (t.effect.type === 'stat-bonus' && t.effect.stat === 'hp') hpMult *= 1 + t.effect.multiplier;
  }

  for (const c of roster) {
    const sum = c.stats.charge + c.stats.harass + c.stats.push + c.stats.siege + c.stats.movement;
    if (sum > strongestSum) { strongestSum = sum; strongestKey = c.stats as unknown as PowerStats; }
  }

  for (const c of roster) {
    const isStrongest = rallyMult > 0 && (c.stats as unknown as PowerStats) === strongestKey;
    for (const key of BATTLE_STAT_KEYS) {
      let v = c.stats[key];
      for (const t of traits) {
        if (!t || t.effect.type !== 'stat-bonus') continue;
        const e = t.effect;
        if (e.stat !== key) continue;
        if (e.target === 'all' || e.target === c.role) v *= 1 + e.multiplier;
      }
      if (isStrongest) v *= 1 + rallyMult;
      stats[key] += v;
    }
  }
  return { stats, hpMult, moraleBonus };
}

export function strengthFrac(soldiers: number, initialSoldiers: number): number {
  if (initialSoldiers <= 0) return 0;
  return Math.max(0, Math.min(1, soldiers / initialSoldiers));
}

/** Campaign discipline is now native 0–10 (Thread B); just clamp into the engine range. */
export function clampEngineDiscipline(campaignDiscipline: number): number {
  return Math.max(0, Math.min(10, Math.round(campaignDiscipline)));
}

/**
 * Legate trait id → the FORMATIONS trait label that unlocks a unique formation.
 * Real trait ids from `src/game/army/legate-traits.ts`. Disciplined commanders unlock
 * the manipular Triplex; defensive/enduring ones the Testudo; aggressive/mobile ones the
 * Cuneus. The morale traits (rallying/charismatic/inspiring) gate no formation.
 */
const TRAIT_TO_FORMATION_TRAIT: Record<string, string> = {
  veteran: 'Roman Veteran',
  disciplined: 'Roman Veteran',
  tactician: 'Roman Veteran',
  cautious: 'Engineer',
  stoic: 'Engineer',
  aggressive: 'Shock',
  swift: 'Shock',
};

export function legateFormationKeys(legate: Legate | null): FormationKey[] {
  const unlockedTraits = new Set(
    (legate?.traitIds ?? []).map((id) => TRAIT_TO_FORMATION_TRAIT[id]).filter(Boolean) as string[],
  );
  return (Object.keys(FORMATIONS) as FormationKey[]).filter((k) => {
    const f = FORMATIONS[k];
    return f.kind === 'common' || (f.trait != null && unlockedTraits.has(f.trait));
  });
}

export function terrainToCenterKey(terrain: string): string {
  return TERRAIN_CENTER[terrain] ?? 'plain';
}

/** Formations the player can field now: from the legate AND within engine discipline. */
export function availableFormations(legate: Legate | null, engineDiscipline: number): FormationKey[] {
  return legateFormationKeys(legate).filter((k) => engineDiscipline >= FORMATIONS[k].disc);
}

/** Minimal shape this adapter reads from the campaign — keeps it decoupled from the full state type. */
export interface CampaignSnapshot { soldiers: number; initialSoldiers: number; morale: number; discipline: number; ammunition?: number; }

export interface PlayerSeed {
  hp: number; morale: number; discipline: number;
  stats: PowerStats; armorPct: number; armorName: string; ammo: number;
  fortPct?: number; fortName?: string | null;
  formation: FormationDef;
}

const ENEMY_WEAKEN_PER_POINT = 0.07; // mirrors iter-belli-balance

export function buildPlayerSeed(
  snap: CampaignSnapshot, roster: readonly Cohort[], legate: Legate | null,
  formation: FormationDef = FORMATIONS.battleLine,
  armor: { material: keyof typeof ARMORS } | null = null,
  ammunition = 32,
  fortified = false,
  /** Extra multiplier on the attack stats (commander passives, e.g. Veteran Stacks). */
  statMult = 1,
): PlayerSeed {
  const frac = strengthFrac(snap.soldiers, snap.initialSoldiers);
  const mods = legateSeedMods(roster, legate);
  const raw = mods.stats;
  const material = armor?.material ?? 'iron';
  const clampMorale = (m: number) => Math.max(0, Math.min(15, m));
  return {
    hp: Math.max(1, Math.round(snap.soldiers * mods.hpMult)),
    morale: clampMorale(snap.morale + mods.moraleBonus),
    discipline: clampEngineDiscipline(snap.discipline),
    stats: {
      charge: Math.round(raw.charge * frac * statMult),
      harass: Math.round(raw.harass * frac * statMult),
      push: Math.round(raw.push * frac * statMult),
      siege: Math.round(raw.siege * frac * statMult),
      movement: Math.round(raw.movement), // maneuver not scaled by attrition
    },
    armorPct: ARMORS[material],
    armorName: material.charAt(0).toUpperCase() + material.slice(1),
    ammo: snap.ammunition ?? ammunition,
    fortPct: fortified ? FORTS.camp : 0,
    fortName: fortified ? 'Camp' : null,
    formation,
  };
}

export function buildEnemyArchetype(key: string, enemyWeaken: number, soldiers: number): EnemyArchetype {
  const base = ENEMY_ARCHETYPES[key] ?? ENEMY_ARCHETYPES.carthage;
  const frac = Math.max(0.2, 1 - enemyWeaken * ENEMY_WEAKEN_PER_POINT);
  return {
    ...base,
    hp: Math.max(1, Math.round(soldiers)),
    stats: {
      charge: Math.round(base.stats.charge * frac),
      harass: Math.round(base.stats.harass * frac),
      push: Math.round(base.stats.push * frac),
      siege: Math.round(base.stats.siege * frac),
      movement: base.stats.movement,
    },
  };
}
