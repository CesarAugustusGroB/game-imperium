import type { UnitRole, UnitStats, LieutenantOrder } from './unit-types';

/**
 * LegateEffect — discriminated union of every effect shape a Legate trait can
 * produce. Applied by the Legate trait pipeline in S14-05 via a single
 * dispatch on the `type` discriminant (NFR-2: no per-trait switch cases).
 */
export type LegateEffect =
  /**
   * Multiplicative stat bonus on matching units.
   * `target` — `'all'` or a specific UnitRole.
   * `multiplier` — fraction applied as `newStat = oldStat * (1 + multiplier)`
   * (e.g. `0.15` = +15%).
   */
  | {
      type: 'stat-bonus';
      target: 'all' | UnitRole;
      stat: keyof UnitStats;
      multiplier: number;
    }
  /**
   * INERT in the current battle (no lieutenant-order system — that was part of
   * the deprecated node-map battle). The `order` value is never read. The
   * aggressive/cautious traits carrying this effect do their real work —
   * unlocking the Cuneus/Testudo formation — via TRAIT_TO_FORMATION_TRAIT (keyed
   * by trait id), not this effect. Kept as the placeholder effect for those
   * formation-only traits; marked `latent` in tools/verify-effects.ts.
   */
  | {
      type: 'lieutenant-preset';
      order: LieutenantOrder;
    }
  /**
   * Pick one random friendly unit at battle start and buff all four stats
   * by the given multiplier.
   */
  | {
      type: 'random-rally';
      multiplier: number;
    }
  /**
   * Additive shift to the attached army's pre-battle morale (S24). Consumed
   * by the `legatusContributor` in `src/game/army/morale.ts`, NOT by the
   * in-battle effect pipeline — the in-battle handler is a no-op.
   * `amount` is a signed integer delta from `BASE_MORALE` (100).
   */
  | {
      type: 'morale-bonus';
      amount: number;
    };

/**
 * LegateTrait — a named, data-driven passive. Traits live in
 * `legate-traits.ts` and are referenced by id from Legate instances.
 */
export interface LegateTrait {
  id: string;
  name: string;
  description: string;
  effect: LegateEffect;
}

/**
 * Legate — a commander that can be attached to an army via
 * `ArmyData.legateId` (added in S14-03). Separate from the player `Commander`
 * (strategic layer) — Legates are purely army-level assets.
 */
export interface Legate {
  /** Unique instance id, e.g. `"legate_0001"`. */
  id: string;
  /** Display name, Roman tria nomina style (e.g. `"Marcus Aurelius Tullius"`). */
  name: string;
  /** Trait references into `LEGATE_TRAITS`. Typically 1–3 per Legate. */
  traitIds: string[];
}
