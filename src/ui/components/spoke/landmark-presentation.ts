/**
 * landmark-presentation.ts — shared visual-data tables for the S29
 * SpokeCampaignScreen component family.
 *
 * Previously duplicated across LandmarkMapNode, LandmarkDetailsPanel,
 * and SpokeLegendPanel; centralised here by T4.1.
 *
 * Deliberately excludes tile-background gradients (TILE_BG /
 * LANDMARK_TILE_BG) — those are visually expressive and may diverge
 * between the row layout and map layout, so keeping them per-file is fine.
 *
 */

import type { LandmarkType, EncounterType } from '../../../game/progression/landmark-types';

export const LANDMARK_LABEL: Record<LandmarkType, string> = {
  start_camp:      'Start Camp',
  battlefield:     'Battlefield',
  forest:          'Forest',
  hill:            'Hill',
  village:         'Village',
  farm:            'Farm',
  city:            'City',
  fort:            'Fort',
  camp:            'Camp',
  shrine:          'Shrine',
  river_crossing:  'River Crossing',
  ruins:           'Ruins',
  road:            'Road',
  marsh:           'Marsh',
  mountain_pass:   'Mountain Pass',
  watchtower:      'Watchtower',
  supply_depot:    'Supply Depot',
};

export const ENCOUNTER_LABEL: Record<EncounterType, string> = {
  battle:       'Battle',
  elite_battle: 'Elite Battle',
  boss:         'Boss',
  rest:         'Rest',
  event:        'Event',
  scout:        'Scout',
  forage:       'Forage',
  recruit:      'Recruit',
  ambush:       'Ambush',
  merchant:     'Merchant',
  siege:        'Siege',
  hazard:       'Hazard',
  unknown:      'Unknown',
};

export const ENCOUNTER_ICON: Record<EncounterType, string> = {
  battle:       '⚔️',
  elite_battle: '🏹',
  boss:         '💀',
  rest:         '🏕',
  event:        '📜',
  scout:        '🔭',
  forage:       '🌾',
  recruit:      '🚩',
  ambush:       '🗡',
  merchant:     '🪙',
  siege:        '🏰',
  hazard:       '⚠',
  unknown:      '❓',
};

/** Short badge codes shown on map tiles. Partial — not all types get a badge. */
export const ENCOUNTER_BADGE: Partial<Record<EncounterType, string>> = {
  battle:       'B',
  elite_battle: 'E',
  boss:         'Bo',
  rest:         'R',
  event:        'Ev',
  scout:        'Sc',
  forage:       'Fo',
  recruit:      'Re',
  ambush:       'Am',
  siege:        'Si',
  hazard:       'Hz',
};

/** Badge accent colors by encounter type. Partial — matches ENCOUNTER_BADGE keys. */
export const ENCOUNTER_BADGE_COLOR: Partial<Record<EncounterType, string>> = {
  battle:       '#c24a3a',
  elite_battle: '#c24a3a',
  boss:         '#8a4ac2',
  rest:         '#4a9a6a',
  event:        '#d4a843',
  scout:        '#60a8d0',
  forage:       '#9aa84a',
  recruit:      '#d48b3a',
  ambush:       '#c24a3a',
  siege:        '#8a4ac2',
  hazard:       '#c24a3a',
};
