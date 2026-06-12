/**
 * Iter Belli — Consilium Fase 2 secondary-quest defs + card factory.
 * Pure data: maps each advisor color to a themed mini-quest (reward on play,
 * penalty on expiry). `makeQuestCard` turns a seeded assignment into a playable
 * OperationCard. No advisor/run-state imports — the campaign engine imports this.
 */
import type {
  CardContext, CardCost, CardEffects, OperationCard, PenaltyResult, SecondaryQuest,
} from '../game/iterBelli/iter-belli-types';

export type QuestColor = 'red' | 'blue' | 'gold' | 'purple' | 'white';

export interface SecondaryQuestDef {
  title: string;
  desc: string;
  cost: CardCost;
  /** Reward applied when the quest card is played. */
  effects: (ctx: CardContext) => CardEffects;
  /** Themed penalty applied when the quest card expires unplayed. */
  penalty: (ctx: CardContext) => PenaltyResult;
}

/** One mini-quest per advisor color. Themes + values are tunable. */
export const SECONDARY_QUESTS: Record<QuestColor, SecondaryQuestDef> = {
  red: {
    title: 'Asalto al fuerte',
    desc: 'Tomas por asalto el fuerte local; el botín llena la caja y el golpe debilita al enemigo.',
    cost: { time: 1, supplies: 4 },
    effects: () => ({ gold: 35, enemyWeaken: 1 }),
    penalty: () => ({ effects: { threat: 2 }, msg: 'El fuerte sigue en pie y hostiga tu retaguardia (+2 amenaza).' }),
  },
  blue: {
    title: 'Pacifica la tribu',
    desc: 'Repartes regalos y promesas a la tribu local; la región se calma.',
    cost: { time: 1, gold: 20 },
    effects: () => ({ threat: -3 }),
    penalty: () => ({ effects: { threat: 2 }, msg: 'La tribu desairada se vuelve hostil (+2 amenaza).' }),
  },
  gold: {
    title: 'Rito de campaña',
    desc: 'Ofician un rito ante las legiones; el ánimo se enardece.',
    cost: { time: 1 },
    effects: () => ({ morale: 2 }),
    penalty: () => ({ effects: { morale: -2 }, msg: 'Los dioses fueron desatendidos; cunde el desánimo (−2 moral).' }),
  },
  purple: {
    title: 'Saquea la caravana',
    desc: 'Interceptas una caravana mercante; el botín llena la caja.',
    cost: { time: 1 },
    effects: () => ({ gold: 50 }),
    penalty: () => ({ effects: { morale: -1, threat: 1 }, msg: 'La caravana escapó; los hombres rezongan y el camino se enturbia (−1 moral, +1 amenaza).' }),
  },
  white: {
    title: 'Recluta auxiliares',
    desc: 'Levantas auxiliares locales que engrosan las filas.',
    cost: { time: 1, gold: 25 },
    effects: () => ({ soldiers: 800 }),
    penalty: () => ({ effects: { morale: -2 }, msg: 'Los auxiliares prometidos nunca llegaron; cae el ánimo (−2 moral).' }),
  },
};

/** Build the playable card for a seeded quest assignment. */
export function makeQuestCard(quest: SecondaryQuest): OperationCard {
  const def = SECONDARY_QUESTS[quest.color as QuestColor];
  if (!def) throw new Error(`makeQuestCard: unknown quest color "${quest.color}"`);
  return {
    id: `card_${quest.id}`,
    questId: quest.id,
    name: def.title,
    category: 'Operaciones',
    desc: def.desc,
    cost: def.cost,
    effects: def.effects,
    penalty: def.penalty,
    locations: [quest.locationId],
    expiry: quest.window,
    weight: 0,
  };
}
