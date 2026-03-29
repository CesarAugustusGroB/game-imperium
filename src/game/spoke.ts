import { signal } from '@preact/signals';
import type { Faction, ResourceType } from './commander';
import { addResource } from './resources';
import { veteranStacks, spokesSinceLastBattle, selectedCommander } from './game-state';

// ── Node types (S2-01) ──

/** The type of encounter at a spoke node. */
export type NodeType = 'battle' | 'rest' | 'event' | 'boss';

/** A resource reward granted by completing a node. */
export type NodeReward = { resource: ResourceType; amount: number }[];

/** A single node in a spoke — the player resolves these in order. */
export interface SpokeNode {
  id: string;
  type: NodeType;
  /** 0-based index within the spoke. */
  position: number;
  /** Flipped to true after the player completes this node. */
  resolved: boolean;
  /** Pre-set reward, or null when reward depends on player choice (events). */
  reward: NodeReward | null;
}

// ── Spoke container (S2-02) ──

/** A linear sequence of nodes the player walks through. */
export interface Spoke {
  nodes: SpokeNode[];
  label: string;
  completed: boolean;
}

/** The active spoke, or null when the player is at the hub. */
export const currentSpoke = signal<Spoke | null>(null);

/** Result of the last battle (S2-05). Read by PostBattleScreen to show outcome. */
export type BattleResult = 'victory' | 'defeat' | 'draw';
export const lastBattleResult = signal<BattleResult | null>(null);

/** Index of the node the player is currently at (0-based). */
export const currentNodeIndex = signal(0);

// ── Spoke gains tracking (S2-09) ──

const ZERO_GAINS: Record<ResourceType, number> = { gold: 0, faith: 0, influence: 0, momentum: 0 };

/** Cumulative resource gains during the current spoke. Read by spoke completion summary. */
export const spokeGains = signal<Record<ResourceType, number>>({ ...ZERO_GAINS });

/**
 * Grant a resource during a spoke, tracking the gain.
 * Wraps addResource — passes through the actual amount added (after 2x multiplier).
 */
export function grantSpokeResource(type: ResourceType, amount: number, faction?: Faction): number {
  const actual = addResource(type, amount, faction);
  spokeGains.value = { ...spokeGains.value, [type]: spokeGains.value[type] + actual };
  return actual;
}

/** Get the current node, or null if no spoke is active. */
export function getCurrentNode(): SpokeNode | null {
  const spoke = currentSpoke.value;
  if (!spoke) return null;
  return spoke.nodes[currentNodeIndex.value] ?? null;
}

/** Clear spoke state (called on retreat or spoke completion). */
export function resetSpoke(): void {
  currentSpoke.value = null;
  currentNodeIndex.value = 0;
  spokeGains.value = { ...ZERO_GAINS };
}

/** Mark the current node as resolved and advance to the next one.
 *  Returns true if the spoke is now complete.
 *  Safe to call multiple times — resolved nodes are skipped. */
export function advanceNode(): boolean {
  const spoke = currentSpoke.value;
  if (!spoke) return false;
  const idx = currentNodeIndex.value;
  const node = spoke.nodes[idx];
  if (!node) return true;

  // Guard: already resolved — don't double-advance
  if (node.resolved) return idx + 1 >= spoke.nodes.length;

  // Create new node object to avoid in-place mutation
  const updatedNodes = spoke.nodes.map((n, i) =>
    i === idx ? { ...n, resolved: true } : n,
  );
  currentSpoke.value = { ...spoke, nodes: updatedNodes };
  const next = idx + 1;
  currentNodeIndex.value = next;
  return next >= spoke.nodes.length;
}

/** Mark the spoke as completed and reset. */
export function completeSpoke(): void {
  const spoke = currentSpoke.value;
  if (spoke) {
    // Trigger reactivity with a new object instead of in-place mutation
    currentSpoke.value = { ...spoke, completed: true };
  }
  resetSpoke();
}

// ── Spoke generator (S2-03) ──

/** Fixed introductory spoke for the MVP. Replaced by procedural gen in Sprint 6. */
export function generateFixedSpoke(): Spoke {
  const nodes: SpokeNode[] = [
    { id: 'node-0', type: 'event',  position: 0, resolved: false, reward: null },
    { id: 'node-1', type: 'battle', position: 1, resolved: false, reward: [{ resource: 'gold', amount: 2 }, { resource: 'momentum', amount: 3 }] },
    { id: 'node-2', type: 'rest',   position: 2, resolved: false, reward: [{ resource: 'gold', amount: 1 }, { resource: 'faith', amount: 1 }, { resource: 'influence', amount: 1 }, { resource: 'momentum', amount: 1 }] },
    { id: 'node-3', type: 'battle', position: 3, resolved: false, reward: [{ resource: 'gold', amount: 2 }, { resource: 'momentum', amount: 3 }] },
    { id: 'node-4', type: 'event',  position: 4, resolved: false, reward: null },
    { id: 'node-5', type: 'boss',   position: 5, resolved: false, reward: [{ resource: 'gold', amount: 4 }, { resource: 'faith', amount: 2 }, { resource: 'momentum', amount: 4 }] },
  ];
  return { nodes, label: 'The First March', completed: false };
}

/** Create a new spoke and set it as active. */
export function startSpoke(): void {
  spokesSinceLastBattle.value += 1;
  if (selectedCommander.value?.id === 'boudicca' && spokesSinceLastBattle.value >= 3) {
    veteranStacks.value = 0;
  }

  currentSpoke.value = generateFixedSpoke();
  currentNodeIndex.value = 0;
  spokeGains.value = { ...ZERO_GAINS };

  // S3-09: Deus Vult — Pope Innocent gains Faith at spoke start
  if (selectedCommander.value?.id === 'innocent') {
    grantSpokeResource('faith', 1, selectedCommander.value.faction);
  }
}
