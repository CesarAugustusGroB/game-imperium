/**
 * Iter Belli — active-scenario holder.
 * Module-level singleton, matching the engine's singleton style. The campaign
 * and battle engines read the active scenario; default is SAGUNTUM.
 */
import type { CampaignScenario } from './iter-belli-types';
import { SAGUNTUM } from '../../data/iter-belli-scenario-saguntum';

let active: CampaignScenario = SAGUNTUM;

export function getActiveScenario(): CampaignScenario { return active; }
export function setActiveScenario(scenario: CampaignScenario): void { active = scenario; }
export function resetActiveScenario(): void { active = SAGUNTUM; }
