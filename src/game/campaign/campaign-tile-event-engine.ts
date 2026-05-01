import type { ResourceType } from '../core/commander';
import { addResource, getResource, spendResource } from '../core/resources';
import { selectedCommander } from '../core/game-state';
import { applyEventChoice, canAffordEventChoice } from '../events/event-engine';
import type { HexTile, EventType } from './campaign-types';
import { campaignState, hexTiles, consumeEvent, refreshMovementPoints, setTiles } from './campaign-state';
import { hexDistance } from './hex-pathfinding';
import { revealWithinRadius } from './hex-scouting';
import { applyBellumEffects, type AppliedLine } from './bellum-encounter-effects';
import { evaluateBellumDefeat, type BellumDefeatEvaluation } from './campaign-defeat';
import type { BattleTerrainModifier } from '../progression/battle-terrain-modifiers';
import type { CampaignMapEffect, CampaignTileEvent } from './campaign-tile-events';

export type CampaignTileEventOutcome = {
  consumed: boolean;
  message?: string;
  defeat?: BellumDefeatEvaluation;
  appliedLines?: AppliedLine[];
};

const TRANSFORM_BLOCKED_EVENTS: ReadonlySet<EventType> = new Set(['battle', 'elite', 'ambush', 'boss']);
const BATTLE_MODIFIER_TARGETS: ReadonlySet<EventType> = new Set(['battle', 'elite', 'ambush']);

function applyResourceDelta(type: ResourceType, amount: number): number {
  const commander = selectedCommander.value;
  if (amount > 0) return addResource(type, amount, commander?.faction);
  if (amount < 0) return spendResource(type, Math.abs(amount)) ? amount : 0;
  return 0;
}

function getDistance(origin: HexTile, tile: HexTile): number {
  return hexDistance(origin, tile);
}

function sortMapTargets(origin: HexTile, tiles: HexTile[]): HexTile[] {
  return [...tiles].sort((a, b) => {
    const da = getDistance(origin, a);
    const db = getDistance(origin, b);
    if (da !== db) return da - db;

    const pa = targetPriority(a);
    const pb = targetPriority(b);
    if (pa !== pb) return pa - pb;

    return a.id.localeCompare(b.id);
  });
}

function targetPriority(tile: HexTile): number {
  if (!tile.visited && tile.discovered && tile.reachable) return 0;
  if (!tile.visited && tile.discovered) return 1;
  if (!tile.visited && !tile.discovered) return 2;
  return 3;
}

function findTransformTarget(origin: HexTile, radius: number): HexTile | null {
  const candidates = sortMapTargets(origin, hexTiles.value).filter((tile) =>
    tile.id !== origin.id &&
    getDistance(origin, tile) <= radius &&
    !tile.visited &&
    !TRANSFORM_BLOCKED_EVENTS.has(tile.event),
  );
  return candidates[0] ?? null;
}

function findBattleModifierTarget(origin: HexTile, radius: number, modifierId: BattleTerrainModifier): HexTile | null {
  const candidates = sortMapTargets(origin, hexTiles.value).filter((tile) => {
    if (tile.id === origin.id) return false;
    if (getDistance(origin, tile) > radius) return false;
    if (!BATTLE_MODIFIER_TARGETS.has(tile.event)) return false;
    return !(tile.battleModifiers ?? []).includes(modifierId);
  });
  return candidates[0] ?? null;
}

function applyMapEffect(effect: CampaignMapEffect, origin: HexTile): boolean {
  switch (effect.type) {
    case 'reveal': {
      const before = hexTiles.value;
      const after = revealWithinRadius(before, origin.id, effect.radius, effect.toLevel ?? 1);
      if (after === before) return false;
      setTiles(after);
      return true;
    }

    case 'transform-nearby-event': {
      const target = findTransformTarget(origin, effect.radius);
      if (!target || target.event === effect.event) return false;
      setTiles(hexTiles.value.map((tile) =>
        tile.id === target.id ? { ...tile, event: effect.event } : tile,
      ));
      return true;
    }

    case 'add-battle-modifier-nearby': {
      const target = findBattleModifierTarget(origin, effect.radius, effect.modifierId);
      if (!target) return false;
      const existing = target.battleModifiers ?? [];
      setTiles(hexTiles.value.map((tile) =>
        tile.id === target.id
          ? { ...tile, battleModifiers: [...existing, effect.modifierId] }
          : tile,
      ));
      return true;
    }
  }
}

function applyMapEffects(effects: readonly CampaignMapEffect[] | undefined, origin: HexTile): void {
  if (!effects) return;
  for (const effect of effects) {
    applyMapEffect(effect, origin);
  }
}

export function getCurrentResources(): Record<ResourceType, number> {
  return {
    gold: getResource('gold'),
    faith: getResource('faith'),
    influence: getResource('influence'),
    momentum: getResource('momentum'),
    iuniores: getResource('iuniores'),
  };
}

export function resolveCampaignTileEvent(
  tile: HexTile,
  event: CampaignTileEvent,
  choiceIndex: number,
): CampaignTileEventOutcome {
  const choice = event.choices[choiceIndex];
  if (!choice) return { consumed: false };

  if (!canAffordEventChoice(choice)) {
    return {
      consumed: false,
      message: 'The legion lacks the resources for that choice.',
    };
  }

  consumeEvent(tile.id);
  applyEventChoice(choice, applyResourceDelta, spendResource, selectedCommander.value?.faction);

  const appliedLines = applyBellumEffects(choice.bellumEffects ?? [], tile);
  applyMapEffects(choice.mapEffects, tile);

  if (choice.refreshesMovement) refreshMovementPoints();

  return {
    consumed: true,
    message: choice.message,
    defeat: evaluateBellumDefeat(campaignState.value),
    appliedLines,
  };
}
