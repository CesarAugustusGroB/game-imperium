import { signal } from '@preact/signals';
import type { TopologyData } from '../../types/index';

// ── Signals ──

/** Raw topology data loaded from /data/topology.json. */
export const topologyData = signal<TopologyData | null>(null);

/**
 * Maps roguelike province ID → map province index (1-48).
 * Populated as provinces are conquered via claimTerritory().
 */
export const territoryMap = signal<Map<string, number>>(new Map());

/** Set of map province indices that are currently claimed. */
export const claimedIndices = signal<Set<number>>(new Set());

// ── Internal constants ──

/** The first map province to claim — Latium (Rome). */
const STARTING_INDEX = 27;

/** Total number of map provinces available. */
const TOTAL_PROVINCES = 48;

// ── Helpers ──

/**
 * Build a flat array of all province indices (1..TOTAL_PROVINCES).
 */
function allProvinceIndices(): number[] {
  return Array.from({ length: TOTAL_PROVINCES }, (_, i) => i + 1);
}

/**
 * Pick a random element from an array. Returns undefined for empty arrays.
 */
function pickRandom<T>(arr: T[]): T | undefined {
  if (arr.length === 0) return undefined;
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Return all unclaimed province indices that are adjacent to any claimed province.
 * Requires topology to be loaded.
 */
function getAdjacentUnclaimed(
  topology: TopologyData,
  claimed: Set<number>,
): number[] {
  const candidates = new Set<number>();

  for (const claimedIndex of claimed) {
    const neighbors = topology.adjacency[String(claimedIndex)] ?? [];
    for (const neighbor of neighbors) {
      if (!claimed.has(neighbor)) {
        candidates.add(neighbor);
      }
    }
  }

  return Array.from(candidates);
}

// ── Public API ──

/**
 * Fetch /data/topology.json and store in the topologyData signal.
 * Safe to call multiple times — re-fetches each time (idempotent signal write).
 */
export async function loadTopology(): Promise<void> {
  const response = await fetch('/data/topology.json');
  if (!response.ok) {
    throw new Error(`Failed to load topology.json: ${response.status} ${response.statusText}`);
  }
  const data: TopologyData = await response.json();
  topologyData.value = data;
}

/**
 * Assign the next available map province to a roguelike province.
 *
 * - First call: always claims index 27 (Latium / Rome).
 * - Subsequent calls: picks a random unclaimed province adjacent to any
 *   already-claimed province (adjacency-first expansion).
 * - Fallback: if no adjacent unclaimed province exists, picks any unclaimed
 *   province at random.
 *
 * No-ops if the topology is not yet loaded or all provinces are claimed.
 */
export function claimTerritory(roguelikeProvinceId: string): void {
  const topology = topologyData.value;
  if (!topology) {
    console.warn('[province-map-store] claimTerritory called before topology loaded');
    return;
  }

  const currentClaimed = claimedIndices.value;
  const currentMap = territoryMap.value;

  // Already claimed for this roguelike province — nothing to do.
  if (currentMap.has(roguelikeProvinceId)) return;

  let chosenIndex: number | undefined;

  if (currentClaimed.size === 0) {
    // First province always starts at Latium.
    chosenIndex = STARTING_INDEX;
  } else {
    // Try adjacency-first expansion.
    const adjacentUnclaimed = getAdjacentUnclaimed(topology, currentClaimed);
    chosenIndex = pickRandom(adjacentUnclaimed);

    if (chosenIndex === undefined) {
      // Fallback: pick any unclaimed province.
      const allUnclaimed = allProvinceIndices().filter(i => !currentClaimed.has(i));
      chosenIndex = pickRandom(allUnclaimed);
    }
  }

  if (chosenIndex === undefined) {
    console.warn('[province-map-store] No unclaimed map provinces remain.');
    return;
  }

  // Immutable updates.
  territoryMap.value = new Map(currentMap).set(roguelikeProvinceId, chosenIndex);
  claimedIndices.value = new Set(currentClaimed).add(chosenIndex);
}

/**
 * Return the UV coordinates [u, v] for a roguelike province's assigned map
 * territory, or null if the province has not been claimed or topology is absent.
 */
export function getMapPosition(roguelikeProvinceId: string): [number, number] | null {
  const topology = topologyData.value;
  if (!topology) return null;

  const mapIndex = territoryMap.value.get(roguelikeProvinceId);
  if (mapIndex === undefined) return null;

  const uv = topology.centers[String(mapIndex)];
  return uv ?? null;
}

/**
 * Return all claimed territories with their roguelike ID, map index, and UV
 * position. Useful for rendering territory overlays.
 */
export function getAllTerritoryPositions(): Array<{
  roguelikeId: string;
  mapIndex: number;
  uv: [number, number];
}> {
  const topology = topologyData.value;
  if (!topology) return [];

  const results: Array<{ roguelikeId: string; mapIndex: number; uv: [number, number] }> = [];

  for (const [roguelikeId, mapIndex] of territoryMap.value) {
    const uv = topology.centers[String(mapIndex)];
    if (uv) {
      results.push({ roguelikeId, mapIndex, uv });
    }
  }

  return results;
}

// ── Conquest helpers ──

/** Static lookup: map province index → historical name (from provinces.json). */
export const PROVINCE_NAMES: Record<number, string> = {
  1: 'Ile-de-France', 2: 'Champagne', 3: 'Normandie', 4: 'Aquitaine',
  5: 'Provence', 6: 'Burgundy', 7: 'Brittany', 8: 'Languedoc',
  9: 'Kent', 10: 'London', 11: 'East Anglia', 12: 'Wessex',
  13: 'York', 14: 'Wales', 15: 'Cornwall', 16: 'Lothian',
  17: 'Highlands', 18: 'Castilla', 19: 'Aragon', 20: 'Portugal',
  21: 'Granada', 22: 'Bavaria', 23: 'Saxony', 24: 'Rhineland',
  25: 'Lombardy', 26: 'Tuscany', 27: 'Latium', 28: 'Naples',
  29: 'Sicily', 30: 'Venezia', 31: 'Flanders', 32: 'Holland',
  33: 'Denmark', 34: 'Sweden', 35: 'Norway', 36: 'Poland',
  37: 'Lithuania', 38: 'Muscovy', 39: 'Novgorod', 40: 'Constantinople',
  41: 'Anatolia', 42: 'Balkans', 43: 'Hungary', 44: 'Bohemia',
  45: 'Austria', 46: 'Switzerland', 47: 'Ireland', 48: 'Sardinia',
};

/**
 * Return `count` unclaimed map indices to use as conquest candidates.
 * Prefers adjacency-first expansion; falls back to any unclaimed.
 * Returns fewer than `count` if not enough unclaimed provinces remain.
 */
export function getCandidateIndices(count: number): number[] {
  const topology = topologyData.value;
  if (!topology) return [];
  const claimed = claimedIndices.value;
  const adjacent = getAdjacentUnclaimed(topology, claimed);
  const pool = adjacent.length >= count
    ? adjacent
    : allProvinceIndices().filter(i => !claimed.has(i));
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/**
 * Claim a specific map province index for a roguelike province.
 * Use after the player has chosen a candidate — bypasses the auto-pick logic.
 */
export function claimTerritoryAt(roguelikeProvinceId: string, mapIndex: number): void {
  const currentClaimed = claimedIndices.value;
  const currentMap = territoryMap.value;
  if (currentMap.has(roguelikeProvinceId)) return;
  territoryMap.value = new Map(currentMap).set(roguelikeProvinceId, mapIndex);
  claimedIndices.value = new Set(currentClaimed).add(mapIndex);
}

/**
 * Load topology and reset all territory mappings.
 * Call once at the start of a new run.
 */
export async function initProvinceMapStore(): Promise<void> {
  resetProvinceMapStore();
  await loadTopology();
}

/**
 * Clear all territory mappings (but leave topology in place).
 * Call when a run ends or resets.
 */
export function resetProvinceMapStore(): void {
  territoryMap.value = new Map();
  claimedIndices.value = new Set();
}
