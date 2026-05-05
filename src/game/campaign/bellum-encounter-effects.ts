// S33-06: data-driven effect application for Bellum encounters.
// Mirrors `applySpokeEffects` semantics but routes through Bellum surfaces
// (preparedArmy, hexTiles) instead of the spoke pipeline.

import type { SpokeEffect } from '../progression/spoke-effects';
import type { HexTile } from './campaign-types';
import { addCampaignMorale, addArmySupplies } from './bellum-army-view';
import { preparedArmy } from '../progression/strategic-store';
import { gold, iuniores, momentum, spendResource } from '../core/resources';
import { grantBellumResource } from './bellum-run-gains';
import { threatLevel } from '../core/game-state';
import { hexTiles, setTiles } from './campaign-state';
import { revealWithinRadius } from './hex-scouting';

export type AppliedLine = {
  kind: SpokeEffect['type'];
  label: string;
  delta?: number;
};

/**
 * Apply an ordered SpokeEffect list against Bellum surfaces. Returns one
 * AppliedLine per effect that mutated state (no-op effects are skipped).
 *
 * `tile` is required when any effect targets a tile (reveal/scout origin,
 * battle-modifier tile). Pass null for non-tile contexts (e.g. legacy
 * encounter resolutions that don't touch the map). When tile is null,
 * tile-targeting effects are silently skipped.
 */
export function applyBellumEffects(
  effects: readonly SpokeEffect[],
  tile: HexTile | null,
): AppliedLine[] {
  const lines: AppliedLine[] = [];

  for (const effect of effects) {
    switch (effect.type) {
      case 'morale': {
        if (preparedArmy.value === null) break;
        addCampaignMorale(effect.delta);
        lines.push({ kind: 'morale', label: effect.label, delta: effect.delta });
        break;
      }

      case 'supplies': {
        if (preparedArmy.value === null) break;
        addArmySupplies(effect.delta);
        lines.push({ kind: 'supplies', label: effect.label, delta: effect.delta });
        break;
      }

      case 'iuniores': {
        if (effect.delta > 0) {
          grantBellumResource('iuniores', effect.delta);
          lines.push({ kind: 'iuniores', label: effect.label, delta: effect.delta });
        } else if (effect.delta < 0) {
          const drain = Math.min(iuniores.value, -effect.delta);
          if (drain > 0) {
            spendResource('iuniores', drain);
            lines.push({ kind: 'iuniores', label: effect.label, delta: -drain });
          }
          // drain === 0: player broke — skip the line (match applySpokeEffects no-op semantics)
        }
        break;
      }

      case 'gold': {
        if (effect.delta > 0) {
          grantBellumResource('gold', effect.delta);
          lines.push({ kind: 'gold', label: effect.label, delta: effect.delta });
        } else if (effect.delta < 0) {
          const drain = Math.min(gold.value, -effect.delta);
          if (drain > 0) {
            spendResource('gold', drain);
            lines.push({ kind: 'gold', label: effect.label, delta: -drain });
          }
        }
        break;
      }

      case 'momentum': {
        if (effect.delta > 0) {
          grantBellumResource('momentum', effect.delta);
          lines.push({ kind: 'momentum', label: effect.label, delta: effect.delta });
        } else if (effect.delta < 0) {
          const drain = Math.min(momentum.value, -effect.delta);
          if (drain > 0) {
            spendResource('momentum', drain);
            lines.push({ kind: 'momentum', label: effect.label, delta: -drain });
          }
        }
        break;
      }

      case 'reveal': {
        if (tile === null) break;
        const toLevel = effect.toLevel ?? 1;
        const before = hexTiles.value;
        const after = revealWithinRadius(before, tile.id, effect.radius, toLevel);
        if (after !== before) {
          setTiles(after);
          lines.push({ kind: 'reveal', label: effect.label });
        }
        break;
      }

      case 'scout': {
        if (tile === null) break;
        const before = hexTiles.value;
        const after = revealWithinRadius(before, tile.id, effect.radius, effect.toLevel);
        if (after !== before) {
          setTiles(after);
          lines.push({ kind: 'scout', label: effect.label });
        }
        break;
      }

      case 'battle-modifier': {
        if (tile === null) break;
        const currentTiles = hexTiles.value;
        const target = currentTiles.find((t) => t.id === tile.id);
        if (!target) break;
        const existing = target.battleModifiers ?? [];
        if (existing.includes(effect.modifierId)) break;
        const updated: HexTile = {
          ...target,
          battleModifiers: [...existing, effect.modifierId],
        };
        setTiles(currentTiles.map((t) => (t.id === tile.id ? updated : t)));
        lines.push({ kind: 'battle-modifier', label: effect.label });
        break;
      }

      case 'threat': {
        threatLevel.value += effect.delta;
        lines.push({ kind: 'threat', label: effect.label, delta: effect.delta });
        break;
      }
    }
  }

  return lines;
}
