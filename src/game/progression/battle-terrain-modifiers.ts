/**
 * Tactical battle modifiers applied to BattleV2 when the spoke node carries a
 * specific terrain. The campaign layer (Itinerarium) attaches these to nodes;
 * BattleV2 reads them on entry to bias movement, ranged accuracy, charge
 * effectiveness, etc.
 *
 * Pure type module — no runtime, no balance numbers. The actual effect each
 * id maps to is wired in S27-03 (campaign effect application) and consumed
 * by the battle layer in a later sprint task.
 *
 * GDD reference: Itinerarium §7.3 + §10.1.
 */

export type BattleTerrainModifier =
  | 'forest_cover'
  | 'dense_trees'
  | 'high_ground'
  | 'open_field'
  | 'river_crossing'
  | 'urban_fighting'
  | 'mud'
  | 'narrow_pass'
  | 'sacred_ground'
  | 'fortified_position';
