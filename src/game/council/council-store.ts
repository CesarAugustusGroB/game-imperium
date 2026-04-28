import { signal } from '@preact/signals';
import type { Advisor } from './advisor';
import { getCurrentSpokeTemplate, getTierForXp } from './advisor';
import type { Spoke, SpokeNode, NodeType, SpokeTheme } from '../progression/spoke';
import { currentSpoke, currentNodeIndex, spokeGains, grantSpokeResource, ZERO_GAINS, reindexSpokeNodesAndBranches } from '../progression/spoke';
import { generateLandmarkSpoke } from '../progression/spoke-generation';
import { selectedCommander, veteranStacks, spokesSinceLastBattle, threatLevel } from '../core/game-state';
import { getActiveEffects } from '../items/doctrine-store';
import { addResource, spendResource } from '../core/resources';
import type { ResourceType } from '../core/commander';
import { resetSpokeEvents } from '../events/event-store';
import {
  consumeGoldenOpportunity,
  resetStrategicSpoke,
  preparedArmy,
  preparedLegate,
  armyEmbarkCount,
} from '../progression/strategic-store';
import { normalizeCohortRoster } from '../army/cohort';
import { addNotification } from '../../ui/notifications/notification-store';

// ── Council signals ──

/** The 3 advisor slots. null = empty seat. */
export const councilSlots = signal<(Advisor | null)[]>([null, null, null]);

/** Advisors owned but not currently seated. */
export const advisorPool = signal<Advisor[]>([]);

/** Purchasable advisor offers. These are not owned until hired. */
export const advisorMarket = signal<Advisor[]>([]);

/** Names of advisors who tiered up at last spoke completion. Cleared when hub is shown. */
export const tierUpNotices = signal<string[]>([]);

/** Cached planned spoke — stable preview, recomputed only on advisor changes. */
export const plannedSpoke = signal<Spoke | null>(null);

// ── Slot management ──

/**
 * Seat an advisor from the pool into the given slot (0–2).
 * If the slot is occupied, the displaced advisor returns to the pool.
 * Removes the advisor from the pool.
 * Returns false if slotIndex is out of range.
 */
export function seatAdvisor(slotIndex: number, advisor: Advisor): boolean {
  if (slotIndex < 0 || slotIndex > 2) return false;

  const slots = councilSlots.value.slice() as (Advisor | null)[];
  const pool = advisorPool.value.slice();

  // Displace currently seated advisor back to pool
  const displaced = slots[slotIndex];
  if (displaced !== null) {
    pool.push(displaced);
  }

  // Remove the incoming advisor from the pool
  const poolIndex = pool.findIndex(a => a.id === advisor.id);
  if (poolIndex !== -1) {
    pool.splice(poolIndex, 1);
  }

  slots[slotIndex] = advisor;

  councilSlots.value = slots;
  advisorPool.value = pool;

  regeneratePlannedSpoke();
  return true;
}

/**
 * Move the advisor in the given slot back to the pool.
 * No-op if slot is empty or index is invalid.
 */
export function unseatAdvisor(slotIndex: number): void {
  if (slotIndex < 0 || slotIndex > 2) return;

  const slots = councilSlots.value.slice() as (Advisor | null)[];
  const advisor = slots[slotIndex];
  if (advisor === null) return;

  const pool = advisorPool.value.slice();
  pool.push(advisor);
  slots[slotIndex] = null;

  councilSlots.value = slots;
  advisorPool.value = pool;

  regeneratePlannedSpoke();
}

/** Add an advisor to the pool (e.g. from hire/reward). */
export function hireAdvisor(advisor: Advisor): void {
  advisorPool.value = [...advisorPool.value, advisor];
}

/** Replace the current political market offers. */
export function setAdvisorMarket(advisors: Advisor[]): void {
  advisorMarket.value = advisors.slice();
}

/** Add one purchasable advisor offer if it is not already present. */
export function addAdvisorMarketOffer(advisor: Advisor): void {
  if (advisorMarket.value.some(a => a.id === advisor.id)) return;
  advisorMarket.value = [...advisorMarket.value, advisor];
}

function getAdvisorCost(advisor: Advisor): { resource: ResourceType; amount: number } {
  return advisor.cost ?? { resource: 'gold', amount: 0 };
}

/**
 * Buy an advisor from the political market and add them to the owned pool.
 * Returns the hired advisor, or null if the offer is missing/ unaffordable.
 */
export function hireAdvisorFromMarket(advisorId: string): Advisor | null {
  const market = advisorMarket.value.slice();
  const offerIndex = market.findIndex(a => a.id === advisorId);
  if (offerIndex === -1) return null;

  const offer = market[offerIndex];
  const cost = getAdvisorCost(offer);
  if (cost.amount > 0 && !spendResource(cost.resource, cost.amount)) return null;

  market.splice(offerIndex, 1);
  advisorMarket.value = market;

  const hired = { ...offer };
  hireAdvisor(hired);
  return hired;
}

/**
 * Buy an advisor from the political market and seat them immediately.
 * If the target seat is occupied, the displaced advisor returns to the pool.
 */
export function hireAndSeatAdvisor(advisorId: string, slotIndex: number): boolean {
  if (slotIndex < 0 || slotIndex > 2) return false;

  const market = advisorMarket.value.slice();
  const offerIndex = market.findIndex(a => a.id === advisorId);
  if (offerIndex === -1) return false;

  const offer = market[offerIndex];
  const cost = getAdvisorCost(offer);
  if (cost.amount > 0 && !spendResource(cost.resource, cost.amount)) return false;

  const slots = councilSlots.value.slice() as (Advisor | null)[];
  const pool = advisorPool.value.slice();
  const displaced = slots[slotIndex];
  if (displaced !== null) {
    pool.push(displaced);
  }

  slots[slotIndex] = { ...offer };
  market.splice(offerIndex, 1);

  councilSlots.value = slots;
  advisorPool.value = pool;
  advisorMarket.value = market;

  regeneratePlannedSpoke();
  return true;
}

/**
 * Remove an advisor from the pool (NOT from a seated slot) and sell for gold.
 * Sell price = 4 + (currentTier - 1) * 2.
 * Returns gold gained, or 0 if not found in pool or if the advisor is seated.
 */
export function fireAdvisor(advisorId: string): number {
  // Refuse to fire a seated advisor
  if (councilSlots.value.some(a => a?.id === advisorId)) return 0;

  const pool = advisorPool.value.slice();
  const index = pool.findIndex(a => a.id === advisorId);
  if (index === -1) return 0;

  const advisor = pool[index];
  const goldGained = 4 + (advisor.currentTier - 1) * 2;

  pool.splice(index, 1);
  advisorPool.value = pool;

  // Selling bypasses spoke-gain tracking — use addResource directly
  addResource('gold', goldGained);

  return goldGained;
}

/**
 * Grant XP to an advisor (in slots or pool), auto-tier-up if threshold reached.
 * Creates new objects for signal reactivity.
 * Returns true if the advisor tiered up.
 */
export function grantAdvisorXp(advisorId: string, amount: number): boolean {
  if (amount <= 0) return false;
  const slots = councilSlots.value.slice() as (Advisor | null)[];
  const pool = advisorPool.value.slice();

  let found = false;
  let tieredUp = false;

  for (let i = 0; i < slots.length; i++) {
    const a = slots[i];
    if (a && a.id === advisorId) {
      const newXp = a.xp + amount;
      const newTier = getTierForXp(newXp);
      tieredUp = newTier > a.currentTier;
      slots[i] = { ...a, xp: newXp, currentTier: newTier };
      found = true;
      break;
    }
  }

  if (!found) {
    for (let i = 0; i < pool.length; i++) {
      const a = pool[i];
      if (a.id === advisorId) {
        const newXp = a.xp + amount;
        const newTier = getTierForXp(newXp);
        tieredUp = newTier > a.currentTier;
        pool[i] = { ...a, xp: newXp, currentTier: newTier };
        found = true;
        break;
      }
    }
  }

  if (!found) return false;

  councilSlots.value = slots;
  advisorPool.value = pool;

  if (tieredUp) {
    // Find the advisor's updated tier from slots or pool
    const updated =
      slots.find(a => a?.id === advisorId) ??
      pool.find(a => a.id === advisorId);
    if (updated) {
      const newTierRoman = (['I', 'II', 'III'] as const)[updated.currentTier - 1] ?? 'III';
      addNotification({
        kind: 'toast',
        icon: '⭐',
        title: 'Advisor Promoted',
        message: `${updated.name} advanced to Tier ${newTierRoman}`,
        color: '#d4a843',
      });
    }
  }

  return tieredUp;
}

// ── Spoke generation ──

const ATTACKING_LABELS = ['Border War', 'Raid', 'Conquest', 'March', 'Campaign'];
const DEFENDING_LABELS = ['Trade Route', 'Pilgrimage', 'Diplomatic Mission', 'Patrol', 'Vigil'];

const THEME_LABEL_SUFFIX: Record<SpokeTheme, string | null> = {
  woodland:  'Woodland Foray',
  highlands: 'Highland Foray',
  marshland: 'Fen March',
  coastal:   'Coastal Sweep',
  mixed:     null,
};

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function rewardForType(type: NodeType): SpokeNode['reward'] {
  switch (type) {
    case 'battle':
      return [
        { resource: 'gold' as ResourceType, amount: 2 },
        { resource: 'momentum' as ResourceType, amount: 2 },
      ];
    case 'rest':
      return [
        { resource: 'gold' as ResourceType, amount: 1 },
        { resource: 'faith' as ResourceType, amount: 1 },
        { resource: 'influence' as ResourceType, amount: 1 },
        { resource: 'momentum' as ResourceType, amount: 1 },
      ];
    case 'event':
      return null;
    case 'boss':
      return [
        { resource: 'gold' as ResourceType, amount: 4 },
        { resource: 'faith' as ResourceType, amount: 2 },
        { resource: 'momentum' as ResourceType, amount: 4 },
      ];
  }
}

/**
 * Merge spoke posture from all seated advisors and generate a landmark spoke
 * via `generateLandmarkSpoke`. Itinerarium is now the production code path —
 * spokes carry landmark metadata, encounter types, fog of war, battle terrain
 * modifiers, and one optional bifurcation. Advisor `nodeWeights` and
 * `durationRange` still drive duration + posture; per-node-type weights are
 * subsumed by the new generator's role-based mid-chain factories
 * (rest / watchtower / supply / morale + filler).
 */
export function generateSpokeFromCouncil(): Spoke {
  const seated = councilSlots.value.filter((a): a is Advisor => a !== null);

  // ── Duration ──
  // Landmark generator requires duration >= 2 (mid-chain invariants need 4
  // role slots). Clamp accordingly; legacy duration=1 advisors still get a
  // valid 2-season spoke.
  let duration = 2;
  if (seated.length > 0) {
    const avgMidpoint =
      seated.reduce((sum, a) => {
        const [min, max] = getCurrentSpokeTemplate(a).durationRange;
        return sum + (min + max) / 2;
      }, 0) / seated.length;
    duration = Math.round(Math.min(4, Math.max(2, avgMidpoint)));
  }

  // ── Posture (majority vote, tie → 'attacking') ──
  let attackingVotes = 0;
  let defendingVotes = 0;
  for (const advisor of seated) {
    const p = getCurrentSpokeTemplate(advisor).posture;
    if (p === 'attacking') attackingVotes++;
    else defendingVotes++;
  }
  const posture = defendingVotes > attackingVotes ? 'defending' : 'attacking';

  // ── Label ──
  const labelPool = posture === 'attacking' ? ATTACKING_LABELS : DEFENDING_LABELS;
  const label = pickRandom(labelPool);

  // ── Generate landmark spoke ──
  const spoke = generateLandmarkSpoke({
    duration,
    posture,
    threatLevel: threatLevel.value,
    includeBranch: true,
  });

  // Theme-driven label suffix. Applied AFTER label pick so the council's
  // posture-flavored label stays the prefix and the theme tags the spoke
  // with its biome (e.g. "Border War — Highland Foray").
  const suffix = spoke.theme ? THEME_LABEL_SUFFIX[spoke.theme] : null;
  const finalLabel = suffix ? `${label} — ${suffix}` : label;

  return { ...spoke, label: finalLabel };
}

/**
 * Recompute the planned spoke from current council composition.
 * Called after every advisor seat/unseat. Produces a stable preview.
 */
export function regeneratePlannedSpoke(): void {
  const seated = councilSlots.value.filter(Boolean).length;
  plannedSpoke.value = seated > 0 ? generateSpokeFromCouncil() : null;
}

/**
 * Start a spoke from the planned spoke. Threat-driven variation now lives
 * inside `generateLandmarkSpoke` (boss enemy strength + threatHint
 * distribution) rather than a post-hoc node-type swap.
 */
export function startSpokeFromCouncil(): void {
  spokesSinceLastBattle.value += 1;

  if (selectedCommander.value?.id === 'boudicca' && spokesSinceLastBattle.value >= 3) {
    veteranStacks.value = 0;
  }

  // Use planned spoke (stable preview) or generate fresh as fallback.
  // mutateSpoke (legacy threat-chaos type swap) is intentionally NOT
  // applied to landmark spokes — it would overwrite landmarkType,
  // encounterType, terrain, effects, and battleModifiers with bare types.
  // Threat now drives boss enemy strength and threatHint distribution
  // inside generateLandmarkSpoke instead.
  let spoke = plannedSpoke.value ?? generateSpokeFromCouncil();

  // S7-12: Golden Opportunity — inject extra rest nodes (landmark-aware).
  // Each insertion goes through `reindexSpokeNodesAndBranches` so that any
  // bifurcations carried by the spoke have their `attachAfter` correctly
  // shifted by the insertion. Without this, branches at indices ≥ insertAt
  // would point at the wrong landmark after Golden Opportunity fires.
  const extraRest = consumeGoldenOpportunity();
  if (extraRest > 0) {
    let workingNodes: SpokeNode[] = spoke.nodes.slice();
    let workingBranches = spoke.branches;
    for (let i = 0; i < extraRest; i++) {
      // Insert anywhere between index 1 and (length - 1) so we never push
      // before start_camp or after the boss.
      const insertAt = 1 + Math.floor(Math.random() * (workingNodes.length - 1));
      const goldenRest: SpokeNode = {
        id: `node-golden-${i}`,
        type: 'rest',
        position: insertAt,
        resolved: false,
        reward: rewardForType('rest'),
        landmarkType: 'camp',
        name: 'Reinforcement Camp',
        encounterType: 'rest',
        terrain: 'plains',
        revealed: true,
        scoutedLevel: 1,
        effects: [
          { type: 'morale', delta: 6, label: 'Reinforcement camp' },
          { type: 'supplies', delta: 4, label: 'Reinforcement camp' },
        ],
        battleModifiers: [],
        threatHint: 'low',
      };
      const result = reindexSpokeNodesAndBranches(
        workingNodes,
        workingBranches,
        insertAt,
        [goldenRest],
        false, // insert (don't replace)
      );
      workingNodes = result.nodes;
      workingBranches = result.branches;
    }
    spoke = { ...spoke, nodes: workingNodes, branches: workingBranches };
  }

  // S14-06: snapshot the player's prepared army + Legate into the spoke.
  // The shallow clone freezes the cohort list at embark time so subsequent
  // mutations to `preparedArmy` (e.g. between runs) don't leak into this run.
  // S26-01 / FT-HEAL prerequisite: preserve carried-over HP verbatim and make
  // sure every roster entry has a stable instanceId before tactical deploy.
  const armyForRun = preparedArmy.value;
  const legateForRun = preparedLegate.value;
  spoke = {
    ...spoke,
    boundArmy: armyForRun
      ? {
          ...armyForRun,
          cohorts: normalizeCohortRoster(armyForRun.cohorts),
          supplyMoralePenalty: undefined,
          supplyDeficitStreak: 0,
        }
      : null,
    boundLegate: legateForRun,
  };

  currentSpoke.value = spoke;
  currentNodeIndex.value = 0;
  spokeGains.value = { ...ZERO_GAINS };
  resetSpokeEvents();
  resetStrategicSpoke();

  // S14-06: tick the army.embark observable when an army is bound to this run
  if (armyForRun) {
    armyEmbarkCount.value++;
  }

  // S3-09: Pope Innocent gains Faith at spoke start
  if (selectedCommander.value?.id === 'innocent') {
    grantSpokeResource('faith', 1, selectedCommander.value.faction);
  }

  // S4-11: Apply Doctrine spoke-start effects
  const faction = selectedCommander.value?.faction;
  for (const effect of getActiveEffects()) {
    if (effect.type === 'resource-per-spoke') {
      grantSpokeResource(effect.resource, effect.amount, faction);
    }
  }
}

/** Reset all council state (called on run end / title screen return). */
export function resetCouncilStore(): void {
  councilSlots.value = [null, null, null];
  advisorPool.value = [];
  advisorMarket.value = [];
  tierUpNotices.value = [];
  plannedSpoke.value = null;
}
