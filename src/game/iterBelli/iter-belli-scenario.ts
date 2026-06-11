/**
 * Iter Belli — scenario registry + active-scenario holder.
 *
 * `SCENARIOS` is the ordered campaign progression; winning one unlocks the next.
 * The active scenario is a module-level singleton (the campaign/battle engines
 * read it); `unlockedScenarios` is a persisted signal driving the EmbarkCard
 * scenario picker. Default unlocked set is just the first scenario.
 */
import { signal } from '@preact/signals';
import type { CampaignScenario } from './iter-belli-types';
import { SAGUNTUM } from '../../data/iter-belli-scenario-saguntum';
import { GALLIA } from '../../data/iter-belli-scenario-gallia';

/** Ordered campaign progression — index N+1 unlocks when index N is won. */
export const SCENARIOS: readonly CampaignScenario[] = [SAGUNTUM, GALLIA];

export function getScenarioById(id: string): CampaignScenario | undefined {
  return SCENARIOS.find((s) => s.id === id);
}

let active: CampaignScenario = SAGUNTUM;

export function getActiveScenario(): CampaignScenario { return active; }
export function setActiveScenario(scenario: CampaignScenario): void { active = scenario; }
export function setActiveScenarioById(id: string): void {
  const s = getScenarioById(id);
  if (s) active = s;
}
export function resetActiveScenario(): void { active = SAGUNTUM; }

// ── Unlock progression ──

/** Ids of scenarios the player may embark on. Persisted via meta-save. */
export const unlockedScenarios = signal<string[]>([SCENARIOS[0].id]);

export function isScenarioUnlocked(id: string): boolean {
  return unlockedScenarios.value.includes(id);
}

/** Unlock a scenario by id (no-op if already unlocked or unknown). */
export function unlockScenario(id: string): void {
  if (!getScenarioById(id) || unlockedScenarios.value.includes(id)) return;
  unlockedScenarios.value = [...unlockedScenarios.value, id];
}

/**
 * Unlock the scenario that follows `wonId` in the progression. Returns the
 * newly-unlocked scenario id, or null if there is no next one / already unlocked.
 */
export function unlockNextScenario(wonId: string): string | null {
  const idx = SCENARIOS.findIndex((s) => s.id === wonId);
  if (idx < 0 || idx + 1 >= SCENARIOS.length) return null;
  const next = SCENARIOS[idx + 1].id;
  if (unlockedScenarios.value.includes(next)) return null;
  unlockScenario(next);
  return next;
}

/** Restore the unlocked set from a save (defaults to the first scenario). */
export function setUnlockedScenarios(ids: string[]): void {
  const valid = ids.filter((id) => getScenarioById(id));
  unlockedScenarios.value = valid.length > 0 ? valid : [SCENARIOS[0].id];
}

/** Reset the unlocked set to the default (first scenario only). New run / meta wipe. */
export function resetUnlockedScenarios(): void {
  unlockedScenarios.value = [SCENARIOS[0].id];
}
