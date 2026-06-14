/**
 * Iter Belli — the Numantia / Celtiberian scenario (third campaign, plan S-F + balancer P1).
 *
 * Third rung of the geometric difficulty ladder (Saguntum → Gallia → Numantia).
 * Reuses the generic location IDs (frontera/tarraco/llanura/bosques) so the
 * existing operation cards stay eligible, re-flavoured for the Celtiberian
 * meseta, with its own objective (Numancia) and decisive card. The decisive
 * battle uses the `iberians` archetype — fast, relentless skirmishers with the
 * highest raw stats of any foe (charge AND harass AND movement) — a step up in
 * archetype power over Gaul's one-note charge. The geometric enemy step (vs
 * Gallia 6500) and victory reward (800, ×2 over Gallia) are sim-tuned so a
 * fully-prepared veteran lands in the 40–65% band; under-geared armies are meant
 * to lose and grind first (intended progression).
 */
import type { CampaignScenario, Location } from '../game/iterBelli/iter-belli-types';
import { CRISES } from './iter-belli-locations';

export const LOCATIONS_NUMANTIA: Location[] = [
  {
    id: 'frontera',
    name: 'Frontera celtíbera',
    desc: 'Linde de la meseta. Tribus arévacas al norte, aliados vacceos vacilantes. El altiplano se extiende, frío y hostil.',
    type: 'neutral',
    threatPerTurn: 0,
  },
  {
    id: 'tarraco',
    name: 'Toletum (plaza aliada)',
    desc: 'Ciudad carpetana sometida a Roma. Mercado, fragua y guías de la meseta. Último punto seguro para reabastecerse.',
    type: 'aliado',
    threatPerTurn: -0.5,
  },
  {
    id: 'llanura',
    name: 'Altiplano arévaco',
    desc: 'Páramo celtíbero hostil. Jinetes ligeros y honderos hostigan la columna sin descanso. La amenaza crece a diario.',
    type: 'enemigo',
    threatPerTurn: 1,
  },
  {
    id: 'bosques',
    name: 'Sierras de la meseta',
    desc: 'Barrancos y encinares, perfectos para la emboscada. Los caetrati conocen cada vaguada y cada vado.',
    type: 'enemigo',
    threatPerTurn: 1.5,
  },
  {
    id: 'numancia',
    name: 'Numancia',
    desc: 'La fortaleza celtíbera sobre el cerro de Garray. Veinte años de resistencia. Aquí se quiebra Hispania o se quiebra Roma.',
    type: 'objetivo',
    threatPerTurn: 0,
  },
];

/** Celtiberian / Hispania place-names for conquered provinces (pure flavor). */
export const CONQUEST_NAMES_NUMANTIA: string[] = [
  'Termantia', 'Segeda', 'Uxama', 'Clunia', 'Termes', 'Segontia',
  'Bilbilis', 'Segovia', 'Palantia', 'Cauca', 'Intercatia', 'Contrebia',
  'Nertobriga', 'Arekorata', 'Lutia', 'Complega', 'Pallantia', 'Tiermes',
];

export const NUMANTIA: CampaignScenario = {
  id: 'numantia',
  locations: LOCATIONS_NUMANTIA,
  objectiveLocationId: 'numancia',
  decisiveCardId: 'asalto_numancia',
  crises: CRISES,
  enemy: {
    name: 'Retógenes Caraunio',
    doctrine: 'Agresiva',
    // Rung 3 difficulty (sim-tuned, tools/sim-playthrough.ts): the iberians'
    // very high raw stats make each soldier hit far harder than Gaul/Carthage,
    // so the step over Gallia is in ARCHETYPE power, not headcount — a smaller
    // but elite host (historically Numantia held 20 years with few defenders).
    baseSoldiers: 5200,
    minSoldiers: 2000,
    archetypeKey: 'iberians',
  },
  narrative: {
    victoryTitle: 'Numancia ha caído',
    defeatTitle: 'Campaña fallida',
    victoryText: 'Has quebrado la última resistencia celtíbera. Numancia arde y Hispania entera es de Roma.',
    defeatText: 'Tu ejército se ha estrellado contra los muros de Numancia. La meseta sigue libre.',
    battleWonLog: (n) => `Has vencido en Numancia. Quedan ${n} soldados.`,
    battleLostLog: (n) => `Derrota en Numancia. Quedan ${n} soldados.`,
  },
  conquestNames: CONQUEST_NAMES_NUMANTIA,
  provinceTerrain: 'hills',
  victoryGold: 800, // geometric step ×2 over Gallia — the ladder keeps doubling
};
