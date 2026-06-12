/**
 * Iter Belli — the Alesia / Vercingetorix scenario (second campaign, plan S-F).
 *
 * Reuses the generic location IDs (frontera/tarraco/llanura/bosques) so the
 * existing operation cards remain eligible, but re-flavours their names/descs
 * for Gaul and swaps the objective to Alesia with its own decisive card. The
 * decisive battle uses the `gauls` archetype (furious chargers, low discipline,
 * no armour) — a very different fight from Carthage's combined-arms host.
 */
import type { CampaignScenario, Location } from '../game/iterBelli/iter-belli-types';
import { CRISES } from './iter-belli-locations';

export const LOCATIONS_GALLIA: Location[] = [
  {
    id: 'frontera',
    name: 'Frontera de la Galia',
    desc: 'Linde de la Provincia. Aliados eduos al norte, tribus arvernas al sur. Calma tensa antes de la tormenta.',
    type: 'neutral',
    threatPerTurn: 0,
  },
  {
    id: 'tarraco',
    name: 'Massilia (ciudad aliada)',
    desc: 'Colonia griega aliada de Roma. Mercado, arsenal y espías. El último punto seguro para reabastecerse.',
    type: 'aliado',
    threatPerTurn: -0.5,
  },
  {
    id: 'llanura',
    name: 'Tierras arvernas',
    desc: 'Campos galos hostiles. Caballería tribal y jinetes nobles hostigan la columna. La amenaza crece a diario.',
    type: 'enemigo',
    threatPerTurn: 1,
  },
  {
    id: 'bosques',
    name: 'Bosques de la Galia',
    desc: 'Espesura druídica, perfecta para emboscadas. Los guerreros galos conocen cada sendero.',
    type: 'enemigo',
    threatPerTurn: 1.5,
  },
  {
    id: 'alesia',
    name: 'Alesia',
    desc: 'La fortaleza de Vercingétorix sobre la colina. Toda la Galia se ha alzado. Aquí se decide la guerra.',
    type: 'objetivo',
    threatPerTurn: 0,
  },
];

/** Gallic place-names for conquered provinces (pure flavor). */
export const CONQUEST_NAMES_GALLIA: string[] = [
  'Lutetia', 'Gergovia', 'Bibracte', 'Avaricum', 'Cenabum', 'Agedincum',
  'Vienna', 'Lugdunum', 'Narbo', 'Tolosa', 'Burdigala', 'Durocortorum',
  'Nemausus', 'Augustodunum', 'Genava', 'Vesontio', 'Samarobriva', 'Noviodunum',
];

export const GALLIA: CampaignScenario = {
  id: 'gallia',
  locations: LOCATIONS_GALLIA,
  objectiveLocationId: 'alesia',
  decisiveCardId: 'asalto_alesia',
  crises: CRISES,
  enemy: {
    name: 'Vercingétorix',
    doctrine: 'Tribal',
    baseSoldiers: 9000,
    minSoldiers: 2500,
    archetypeKey: 'gauls',
  },
  narrative: {
    victoryTitle: 'Triunfo en Alesia',
    defeatTitle: 'Campaña fallida',
    victoryText: 'Has roto la gran alianza gala. Vercingétorix se rinde a tus pies. La Galia es de Roma.',
    defeatText: 'Tu ejército ha caído ante los muros de Alesia. La revuelta gala se extiende.',
    battleWonLog: (n) => `Has vencido en Alesia. Quedan ${n} soldados.`,
    battleLostLog: (n) => `Derrota en Alesia. Quedan ${n} soldados.`,
  },
  conquestNames: CONQUEST_NAMES_GALLIA,
  provinceTerrain: 'forest',
};
