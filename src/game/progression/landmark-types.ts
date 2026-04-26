/**
 * Itinerarium core type vocabulary — the "where / what / how" of a campaign
 * landmark. These types replace the old abstract `NodeType` chain with a
 * physical-place model: a landmark (where), an encounter (what), and a
 * battle terrain (how the battle is biased).
 *
 * `NodeType` ('battle' | 'rest' | 'event' | 'boss') in `spoke.ts` stays
 * untouched — Itinerarium extends `SpokeNode` with optional landmark fields
 * in S27-02 so legacy spokes keep working during migration.
 *
 * Pure type module — no runtime.
 *
 * GDD reference: Itinerarium §6 + §7.4.
 */

/** The physical place a node represents on the campaign map. */
export type LandmarkType =
  | 'start_camp'
  | 'battlefield'
  | 'forest'
  | 'hill'
  | 'village'
  | 'farm'
  | 'city'
  | 'fort'
  | 'camp'
  | 'shrine'
  | 'river_crossing'
  | 'ruins'
  | 'road'
  | 'marsh'
  | 'mountain_pass'
  | 'watchtower'
  | 'supply_depot';

/** What happens at the landmark when the player resolves the node. */
export type EncounterType =
  | 'battle'
  | 'elite_battle'
  | 'boss'
  | 'rest'
  | 'event'
  | 'scout'
  | 'forage'
  | 'recruit'
  | 'ambush'
  | 'merchant'
  | 'siege'
  | 'hazard'
  | 'unknown';

/** Battle-arena terrain. Drives `BattleTerrainModifier` selection on entry. */
export type BattleTerrain =
  | 'forest'
  | 'hills'
  | 'plains'
  | 'city'
  | 'river'
  | 'marsh'
  | 'mountains'
  | 'farmland'
  | 'road'
  | 'ruins';

/** The kind of path connecting two landmarks. Drives traversal cost. */
export type RouteType =
  | 'road'
  | 'forest_path'
  | 'mountain_pass'
  | 'river_crossing'
  | 'marsh_track'
  | 'open_field';

/**
 * A directed edge between two spoke nodes. The `from`/`to` ids match
 * `SpokeNode.id`. Cost modifiers stack with the route's base type — used in
 * S27-04+ for branching map generation.
 */
export interface SpokeRoute {
  from: string;
  to: string;
  routeType: RouteType;
  /** Multiplier applied to the route's base supply consumption. 1 = neutral. */
  supplyCostModifier?: number;
  /** Flat morale delta paid on traversal. Negative = costly route. */
  moraleCost?: number;
  /** True if the route hides ambush/hazard risk until scouted. */
  hiddenRisk?: boolean;
  /** True if the route is locked behind a successful scout encounter. */
  requiresScout?: boolean;
}
