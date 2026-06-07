export const BAL = {
  DMG_SCALE:     17,
  RECOIL_SCALE:  26,
  CENTER_MOVE:   0.55,
  START_MORALE:  10,
  MORALE_K:      10,
  MORALE_RESIST: 0.05,
  DISC_DMG:      0.05,
  MAX_ROUNDS:    14,
} as const;

/** Armor material → physical mitigation %. */
export const ARMORS = { copper: 5, bronze: 12, iron: 20, steel: 30 } as const;
/** Fortification tier → non-siege mitigation % (defender). */
export const FORTS = { camp: 10, palisade: 20, wall: 35, fortress: 50 } as const;
