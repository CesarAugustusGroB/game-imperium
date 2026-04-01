import { signal, computed } from '@preact/signals';
import type { Faction } from './commander';

// ── Types ──

export type FactionRelation = 'hostile' | 'neutral' | 'friendly';

export interface NPCFaction {
  id: string;
  name: string;
  /** Thematic color — affects which events reference this faction. */
  color: Faction;
  relation: FactionRelation;
  /** 1–10. Affects battle difficulty and event stakes. */
  strength: number;
  /** How many map territories this faction controls (narrative flavor). */
  territories: number;
}

// ── Starter factions ──

const STARTER_FACTIONS: NPCFaction[] = [
  {
    id: 'gauls',
    name: 'Gallic Confederation',
    color: 'red',
    relation: 'hostile',
    strength: 4,
    territories: 6,
  },
  {
    id: 'carthage',
    name: 'Carthaginian Remnants',
    color: 'purple',
    relation: 'neutral',
    strength: 5,
    territories: 4,
  },
  {
    id: 'parthia',
    name: 'Parthian Empire',
    color: 'gold',
    relation: 'neutral',
    strength: 6,
    territories: 8,
  },
  {
    id: 'senate',
    name: 'The Senate',
    color: 'blue',
    relation: 'friendly',
    strength: 3,
    territories: 2,
  },
];

// ── Signals ──

export const npcFactions = signal<NPCFaction[]>([]);

/** Derived: count of friendly factions (replaces raw allianceCount). */
export const friendlyCount = computed(() =>
  npcFactions.value.filter(f => f.relation === 'friendly').length,
);

/** Derived: IDs of hostile factions. */
export const hostileIds = computed(() =>
  npcFactions.value.filter(f => f.relation === 'hostile').map(f => f.id),
);

/** Derived: IDs of friendly factions. */
export const friendlyIds = computed(() =>
  npcFactions.value.filter(f => f.relation === 'friendly').map(f => f.id),
);

// ── Queries ──

/** Get a faction by ID. */
export function getFaction(factionId: string): NPCFaction | undefined {
  return npcFactions.value.find(f => f.id === factionId);
}

/** Get the relation with a faction. */
export function getFactionRelation(factionId: string): FactionRelation | undefined {
  return getFaction(factionId)?.relation;
}

// ── Actions ──

/**
 * Change a faction's relation. Immutable signal update.
 */
export function setFactionRelation(factionId: string, relation: FactionRelation): void {
  const idx = npcFactions.value.findIndex(f => f.id === factionId);
  if (idx === -1) return;

  const arr = npcFactions.value.map((f, i) =>
    i === idx ? { ...f, relation } : f,
  );
  npcFactions.value = arr;
}

/**
 * Adjust a faction's strength (clamped 1–10).
 */
export function adjustFactionStrength(factionId: string, delta: number): void {
  const idx = npcFactions.value.findIndex(f => f.id === factionId);
  if (idx === -1) return;

  const arr = npcFactions.value.map((f, i) =>
    i === idx ? { ...f, strength: Math.max(1, Math.min(10, f.strength + delta)) } : f,
  );
  npcFactions.value = arr;
}

// ── Lifecycle ──

/** Initialize NPC factions for a new run. Augustus starts with Senate friendly (default). */
export function initNPCFactions(): void {
  npcFactions.value = STARTER_FACTIONS.map(f => ({ ...f }));
}

/** Reset NPC factions. */
export function resetNPCFactions(): void {
  npcFactions.value = [];
}
