/**
 * Itinerarium spoke effects — the army-side consequences a landmark applies
 * when the player resolves it. A discriminated union so the apply step can
 * switch on `type` exhaustively without runtime guards beyond TypeScript.
 *
 * Sources of truth (do not duplicate):
 *   - Morale  → `computeArmyMorale(spoke)` in `army/morale.ts`
 *   - Supplies → `ArmyData.supplies` mutated via `army/supplies.ts`
 *   - Iuniores → global `ResourceType = 'iuniores'` (resources.ts)
 *
 * Each variant carries a player-facing `label` so the UI can show "+8 Morale —
 * Rest at Camp" without translating the effect kind every time it renders.
 *
 * GDD reference: Itinerarium §7.2.
 */

import type { Spoke } from './spoke';
import { currentSpoke, currentNodeIndex, syncPreparedFromBoundArmy } from './spoke';
import { iuniores, addResource, spendResource } from '../core/resources';
import { threatLevel } from '../core/game-state';
import type { BattleTerrainModifier } from './battle-terrain-modifiers';

export type SpokeEffect =
  | { type: 'morale';           delta: number; label: string }
  | { type: 'supplies';         delta: number; label: string }
  | { type: 'iuniores';         delta: number; label: string }
  | { type: 'reveal';           radius: number; label: string }
  | { type: 'battle-modifier';  modifierId: BattleTerrainModifier; label: string }
  | { type: 'threat';           delta: number; label: string };

/**
 * Apply an ordered list of `SpokeEffect`s to the active spoke context.
 *
 * Spoke-bound mutations (morale, supplies, reveal, battle-modifier) are
 * accumulated into a single new `Spoke` object and committed with one
 * `currentSpoke.value =` assignment at the end — matches the signal-rewrite
 * contract enforced by `main.tsx`'s exit-handler effect.
 *
 * Global-state mutations (iuniores, threat) go through their existing public
 * APIs: `addResource` / `spendResource` for iuniores, `threatLevel.value`
 * for threat. No new resource or threat models are introduced.
 *
 * No-op when there is no active spoke. Each effect runs independently — a
 * morale effect does not depend on a preceding supplies effect, etc.
 */
export function applySpokeEffects(effects: readonly SpokeEffect[]): void {
  if (effects.length === 0) return;
  const initial = currentSpoke.value;
  if (!initial) return;

  let next: Spoke = initial;
  let dirty = false;
  const idx = currentNodeIndex.value;

  for (const effect of effects) {
    switch (effect.type) {
      case 'morale': {
        if (!next.boundArmy) break;
        const prev = next.boundArmy.campaignMoraleDelta ?? 0;
        next = {
          ...next,
          boundArmy: { ...next.boundArmy, campaignMoraleDelta: prev + effect.delta },
        };
        dirty = true;
        break;
      }

      case 'supplies': {
        if (!next.boundArmy) break;
        const supplies = Math.max(0, next.boundArmy.supplies + effect.delta);
        next = {
          ...next,
          boundArmy: { ...next.boundArmy, supplies },
        };
        dirty = true;
        break;
      }

      case 'iuniores': {
        if (effect.delta > 0) {
          addResource('iuniores', effect.delta);
        } else if (effect.delta < 0) {
          // Partial drain — campaign penalties take whatever the player has,
          // never going below zero. `spendResource` is all-or-nothing, so
          // clamp to the current balance first.
          const drain = Math.min(iuniores.value, -effect.delta);
          if (drain > 0) spendResource('iuniores', drain);
        }
        break;
      }

      case 'reveal': {
        const lo = Math.max(0, idx - effect.radius);
        const hi = Math.min(next.nodes.length - 1, idx + effect.radius);
        let touched = false;
        const nodes = next.nodes.map((n, i) => {
          if (i < lo || i > hi || n.revealed === true) return n;
          touched = true;
          return { ...n, revealed: true };
        });
        if (touched) {
          next = { ...next, nodes };
          dirty = true;
        }
        break;
      }

      case 'battle-modifier': {
        const node = next.nodes[idx];
        if (!node) break;
        const existing = node.battleModifiers ?? [];
        if (existing.includes(effect.modifierId)) break;
        const updatedNode = {
          ...node,
          battleModifiers: [...existing, effect.modifierId],
        };
        const nodes = next.nodes.map((n, i) => (i === idx ? updatedNode : n));
        next = { ...next, nodes };
        dirty = true;
        break;
      }

      case 'threat': {
        threatLevel.value += effect.delta;
        break;
      }
    }
  }

  if (dirty) {
    currentSpoke.value = next;
    if (next.boundArmy) syncPreparedFromBoundArmy(next.boundArmy);
  }
}
