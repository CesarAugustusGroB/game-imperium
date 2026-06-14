/**
 * Iter Belli — the Sagunto / Aníbal Barca scenario.
 * First concrete CampaignScenario. Composes the existing itinerary, crises and
 * conquest names, and references the balance enemy constants so the values match
 * the previously-hardcoded battle exactly.
 */
import { LOCATIONS, CRISES } from './iter-belli-locations';
import { CONQUEST_NAMES } from './iter-belli-conquest';
import * as B from '../game/iterBelli/iter-belli-balance';
import type { CampaignScenario } from '../game/iterBelli/iter-belli-types';

export const SAGUNTUM: CampaignScenario = {
  id: 'saguntum',
  locations: LOCATIONS,
  objectiveLocationId: 'sagunto',
  decisiveCardId: 'asalto_decisivo',
  crises: CRISES,
  enemy: {
    name: 'Aníbal Barca',
    doctrine: 'Maniobrera',
    baseSoldiers: B.ENEMY_BASE_SOLDIERS,
    minSoldiers: B.ENEMY_MIN_SOLDIERS,
    archetypeKey: 'carthage',
  },
  narrative: {
    victoryTitle: 'Triunfo en Hispania',
    defeatTitle: 'Campaña fallida',
    victoryText: 'Has derrotado al ejército púnico. Sagunto se rinde. La campaña es un éxito.',
    defeatText: 'Tu ejército ha sido derrotado en Sagunto. La campaña ha fracasado.',
    battleWonLog: (n) => `Has vencido en Sagunto. Quedan ${n} soldados.`,
    battleLostLog: (n) => `Derrota en Sagunto. Quedan ${n} soldados.`,
  },
  conquestNames: CONQUEST_NAMES,
  provinceTerrain: 'plains',
  victoryGold: 200, // ladder base (= flat VICTORY_GOLD_BONUS); Gallia doubles it
};
