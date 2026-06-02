/**
 * Iter Belli — campaign persistence (serialize / restore).
 *
 * Projects the live IterBelliState to a JSON-safe shape and back. The two
 * closure-bearing fields are NOT stored: card definitions are referenced by id
 * and re-resolved here; doctrine modifiers are recomputed by the caller and
 * passed into restore. This module imports only the campaign engine + its data
 * (cards, quests, scenario) — never the Hub stores — so it stays pure and
 * verifiable in isolation.
 */

import { iterBelliState, iterBelliLog, iterBelliActive, loadIterBelliState } from './iter-belli-state';
import { getActiveScenario, setActiveScenario } from './iter-belli-scenario';
import { SAGUNTUM } from '../../data/iter-belli-scenario-saguntum';
import { CARD_DEFS } from '../../data/iter-belli-cards';
import { makeQuestCard } from '../../data/iter-belli-quests';
import type {
  AnyCardDef, CampaignScenario, CardInstance, DoctrineCampaignModifier,
  IterBelliState, LogLine, SecondaryQuest,
} from './iter-belli-types';

/** Scenario registry for restore. Currently a single entry; grows with the roster. */
export const SCENARIOS_BY_ID: Record<string, CampaignScenario> = {
  [SAGUNTUM.id]: SAGUNTUM,
};

/** A pool card reduced to its persistable identity. */
export interface SavedCardInstance {
  instanceId: number;
  defId: string;
  timer: number;
}

/**
 * JSON-safe projection of a campaign: every IterBelliState field except the two
 * closure-bearing ones (`pool`, `doctrineModifiers`), plus the scenario id, the
 * id-reduced pool, and the log.
 */
export type IterBelliSave = Omit<IterBelliState, 'pool' | 'doctrineModifiers'> & {
  scenarioId: string;
  pool: SavedCardInstance[];
  log: LogLine[];
};

/**
 * Snapshot the live campaign, or null when none is active. Fields are listed
 * explicitly rather than spread-and-drop: the `IterBelliSave` type enforces
 * completeness (a missed field is a compile error), and explicit listing avoids
 * unused destructure bindings that `noUnusedLocals` would reject.
 */
export function serializeIterBelli(): IterBelliSave | null {
  if (!iterBelliActive.value) return null;
  const s = iterBelliState.value;
  return {
    scenarioId: getActiveScenario().id,
    soldiers: s.soldiers, morale: s.morale, discipline: s.discipline, supplies: s.supplies,
    gold: s.gold, iuniores: s.iuniores, threat: s.threat, timeRemaining: s.timeRemaining,
    turnNum: s.turnNum, locationIdx: s.locationIdx, cardIdCounter: s.cardIdCounter,
    ambushDetected: s.ambushDetected, fortified: s.fortified, truceTurns: s.truceTurns,
    finished: s.finished, enemyWeaken: s.enemyWeaken, brokenCommitments: s.brokenCommitments,
    phase: s.phase, outcome: s.outcome, archetype: s.archetype,
    initialSoldiers: s.initialSoldiers, spokeTerrain: s.spokeTerrain, spokeDuration: s.spokeDuration,
    missionId: s.missionId, quests: s.quests,
    pool: s.pool.map((c) => ({ instanceId: c.instanceId, defId: c.def.id, timer: c.timer })),
    log: iterBelliLog.value.slice(),
  };
}

/**
 * Re-resolve a saved card-def id to a live def. Quest cards are rebuilt from the
 * matching SecondaryQuest, crisis cards from the active scenario, everything else
 * from CARD_DEFS. Returns null for an unresolvable id (the card is then dropped).
 */
function resolveCardDef(defId: string, scenario: CampaignScenario, quests: SecondaryQuest[]): AnyCardDef | null {
  const quest = quests.find((q) => `card_${q.id}` === defId);
  if (quest) return makeQuestCard(quest);

  if (defId.startsWith('crisis_')) {
    const key = defId.slice('crisis_'.length) as keyof CampaignScenario['crises'];
    const crisis = scenario.crises[key];
    return crisis ? { ...crisis, id: defId } : null;
  }

  return CARD_DEFS.find((c) => c.id === defId) ?? null;
}

/**
 * Restore a saved campaign into the live engine. `doctrineModifiers` are supplied
 * by the caller (recomputed from the restored equipped doctrines) so this module
 * need not depend on the Hub doctrine store.
 */
export function restoreIterBelli(save: IterBelliSave, doctrineModifiers: DoctrineCampaignModifier[]): void {
  const scenario = SCENARIOS_BY_ID[save.scenarioId] ?? SAGUNTUM;
  setActiveScenario(scenario);

  const pool: CardInstance[] = save.pool
    .map((sc) => {
      const def = resolveCardDef(sc.defId, scenario, save.quests);
      return def ? { instanceId: sc.instanceId, def, timer: sc.timer } : null;
    })
    .filter((c): c is CardInstance => c !== null);

  const state: IterBelliState = {
    soldiers: save.soldiers, morale: save.morale, discipline: save.discipline, supplies: save.supplies,
    gold: save.gold, iuniores: save.iuniores, threat: save.threat, timeRemaining: save.timeRemaining,
    turnNum: save.turnNum, locationIdx: save.locationIdx, cardIdCounter: save.cardIdCounter,
    ambushDetected: save.ambushDetected, fortified: save.fortified, truceTurns: save.truceTurns,
    finished: save.finished, enemyWeaken: save.enemyWeaken, brokenCommitments: save.brokenCommitments,
    phase: save.phase, outcome: save.outcome, archetype: save.archetype,
    initialSoldiers: save.initialSoldiers, spokeTerrain: save.spokeTerrain, spokeDuration: save.spokeDuration,
    missionId: save.missionId, quests: save.quests,
    pool, doctrineModifiers,
  };
  loadIterBelliState(state, save.log.slice());
}
