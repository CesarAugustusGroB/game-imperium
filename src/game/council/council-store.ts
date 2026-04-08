import { signal } from '@preact/signals';
import type { Advisor } from './advisor';
import { getCurrentSpokeTemplate, getTierForXp } from './advisor';
import type { Spoke, SpokeNode, NodeType } from '../progression/spoke';
import { currentSpoke, currentNodeIndex, spokeGains, grantSpokeResource, ZERO_GAINS } from '../progression/spoke';
import { selectedCommander, veteranStacks, spokesSinceLastBattle, threatLevel } from '../core/game-state';
import { getActiveEffects } from '../items/doctrine-store';
import { addResource } from '../core/resources';
import type { ResourceType } from '../core/commander';
import { resetSpokeEvents } from '../events/event-store';
import { consumeGoldenOpportunity, resetStrategicSpoke } from '../progression/strategic-store';

// ── Council signals ──

/** The 3 advisor slots. null = empty seat. */
export const councilSlots = signal<(Advisor | null)[]>([null, null, null]);

/** Advisors owned but not currently seated. */
export const advisorPool = signal<Advisor[]>([]);

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

  return tieredUp;
}

// ── Spoke generation ──

const DEFAULT_WEIGHTS: Partial<Record<NodeType, number>> = {
  battle: 3,
  rest: 2,
  event: 3,
  boss: 1,
};

const ATTACKING_LABELS = ['Border War', 'Raid', 'Conquest', 'March', 'Campaign'];
const DEFENDING_LABELS = ['Trade Route', 'Pilgrimage', 'Diplomatic Mission', 'Patrol', 'Vigil'];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Weighted random selection from a weight map (excludes 'boss'). */
function weightedPick(weights: Partial<Record<NodeType, number>>): NodeType {
  const entries = (Object.entries(weights) as [NodeType, number][]).filter(
    ([type, w]) => type !== 'boss' && w > 0,
  );
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let roll = Math.random() * total;
  for (const [type, w] of entries) {
    roll -= w;
    if (roll <= 0) return type;
  }
  return entries[entries.length - 1][0];
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
 * Merge spoke templates from all seated advisors and generate a new Spoke.
 * Falls back to equal weights when no advisors are seated.
 */
export function generateSpokeFromCouncil(): Spoke {
  const seated = councilSlots.value.filter((a): a is Advisor => a !== null);

  // ── Weights ──
  const summedWeights: Partial<Record<NodeType, number>> = {};
  if (seated.length === 0) {
    Object.assign(summedWeights, DEFAULT_WEIGHTS);
  } else {
    for (const advisor of seated) {
      const template = getCurrentSpokeTemplate(advisor);
      for (const [type, w] of Object.entries(template.nodeWeights) as [NodeType, number][]) {
        summedWeights[type] = (summedWeights[type] ?? 0) + w;
      }
    }
  }

  // ── Duration ──
  let duration = 1;
  if (seated.length > 0) {
    const avgMidpoint =
      seated.reduce((sum, a) => {
        const [min, max] = getCurrentSpokeTemplate(a).durationRange;
        return sum + (min + max) / 2;
      }, 0) / seated.length;
    duration = Math.round(Math.min(4, Math.max(1, avgMidpoint)));
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

  // ── Posture node bias ──
  // Apply after weight summation so advisors' intent is preserved, then nudged by posture.
  // Floor all weights at 1 to keep weightedPick() safe.
  if (posture === 'attacking') {
    summedWeights.battle = (summedWeights.battle ?? 0) + 2;
    summedWeights.rest   = Math.max(1, (summedWeights.rest ?? 0) - 1);
  } else {
    summedWeights.rest   = (summedWeights.rest  ?? 0) + 2;
    summedWeights.event  = (summedWeights.event ?? 0) + 1;
    summedWeights.battle = Math.max(1, (summedWeights.battle ?? 0) - 1);
  }

  // ── Label ──
  const labelPool = posture === 'attacking' ? ATTACKING_LABELS : DEFENDING_LABELS;
  const label = pickRandom(labelPool);

  // ── Node sequence ──
  const totalNodes = duration * 3 + 1; // 1 season = 4 nodes, 4 seasons = 13
  const nodes: SpokeNode[] = [];

  // Generate all non-boss nodes first
  const nonBossCount = totalNodes - 1;
  for (let i = 0; i < nonBossCount; i++) {
    // Pacing rule: every 3rd node should be 'rest' if none in the last 3
    let type: NodeType;
    if (i > 0 && i % 3 === 2) {
      const last3 = nodes.slice(Math.max(0, i - 2));
      const hasRecentRest = last3.some(n => n.type === 'rest');
      if (!hasRecentRest) {
        type = 'rest';
      } else {
        type = weightedPick(summedWeights);
      }
    } else {
      type = weightedPick(summedWeights);
    }
    nodes.push({
      id: `node-${i}`,
      type,
      position: i,
      resolved: false,
      reward: rewardForType(type),
    });
  }

  // Last node is always 'boss'
  nodes.push({
    id: `node-${nonBossCount}`,
    type: 'boss',
    position: nonBossCount,
    resolved: false,
    reward: rewardForType('boss'),
  });

  return { nodes, label, completed: false, duration, currentSeason: 1, posture };
}

/**
 * Recompute the planned spoke from current council composition.
 * Called after every advisor seat/unseat. Produces a stable preview.
 */
export function regeneratePlannedSpoke(): void {
  const seated = councilSlots.value.filter(Boolean).length;
  plannedSpoke.value = seated > 0 ? generateSpokeFromCouncil() : null;
}

// ── Chaos mutation tuning ──

/** Maximum percentage of non-boss nodes that chaos can mutate. */
const MAX_CHAOS_PERCENT = 50;
/** Chaos scales linearly: chaosPercent = min(MAX_CHAOS_PERCENT, threat * this). */
const CHAOS_THREAT_MULTIPLIER = 5;
/** Threat level above which spoke duration may shift by ±1. */
const HIGH_THREAT_THRESHOLD = 6;

/**
 * Apply threat-based chaos to a spoke.
 * Preserves boss node and posture. Mutates a % of non-boss nodes based on threatLevel.
 */
function mutateSpoke(spoke: Spoke): Spoke {
  const threat = threatLevel.value;
  const chaosPercent = Math.min(MAX_CHAOS_PERCENT, threat * CHAOS_THREAT_MULTIPLIER);

  // Clone nodes (skip last = boss)
  const nodes: SpokeNode[] = spoke.nodes.map((n, i) => {
    // Never mutate boss (last node)
    if (i === spoke.nodes.length - 1) return { ...n };

    // Roll for mutation
    if (Math.random() * 100 < chaosPercent) {
      const newType = weightedPick(DEFAULT_WEIGHTS);
      return { ...n, type: newType, reward: rewardForType(newType) };
    }
    return { ...n };
  });

  // Duration shift at high threat
  let duration = spoke.duration;
  if (threat > HIGH_THREAT_THRESHOLD) {
    const shift = Math.random() < 0.5 ? -1 : 1;
    duration = Math.max(1, Math.min(4, duration + shift));
  }

  return { ...spoke, nodes, duration, completed: false, currentSeason: 1 };
}

/**
 * Start a spoke from the planned spoke. Applies threat-based chaos mutation.
 * Falls back to fresh generation if no planned spoke is cached.
 */
export function startSpokeFromCouncil(): void {
  spokesSinceLastBattle.value += 1;

  if (selectedCommander.value?.id === 'boudicca' && spokesSinceLastBattle.value >= 3) {
    veteranStacks.value = 0;
  }

  // Use planned spoke (stable preview) or generate fresh as fallback
  const base = plannedSpoke.value ?? generateSpokeFromCouncil();
  let spoke = mutateSpoke(base);

  // S7-12: Golden Opportunity — inject extra rest nodes
  const extraRest = consumeGoldenOpportunity();
  if (extraRest > 0) {
    // Deep-clone each existing node so the splice result shares no references with plannedSpoke.
    const nonBoss = spoke.nodes.slice(0, -1).map(n => ({ ...n }));
    const boss = { ...spoke.nodes[spoke.nodes.length - 1] };
    for (let i = 0; i < extraRest; i++) {
      const insertAt = Math.floor(Math.random() * nonBoss.length) + 1;
      nonBoss.splice(insertAt, 0, {
        id: `node-golden-${i}`,
        type: 'rest',
        position: insertAt,
        resolved: false,
        reward: rewardForType('rest'),
      });
    }
    // Reindex positions
    const allNodes = [...nonBoss, boss];
    allNodes.forEach((n, idx) => { n.position = idx; });
    spoke = { ...spoke, nodes: allNodes };
  }

  currentSpoke.value = spoke;
  currentNodeIndex.value = 0;
  spokeGains.value = { ...ZERO_GAINS };
  resetSpokeEvents();
  resetStrategicSpoke();

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
  tierUpNotices.value = [];
  plannedSpoke.value = null;
}
