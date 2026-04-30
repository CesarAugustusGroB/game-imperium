import { effect, signal } from '@preact/signals';
import type { ArmyData } from '../../types';
import { IUNIORES } from '../../config/game-config';
import { COMMANDERS } from '../../data/commanders';
import type { ResourceType } from '../core/commander';
import type { Advisor } from '../council/advisor';
import { advisorMarket, advisorPool, councilSlots, plannedSpoke, tierUpNotices } from '../council/council-store';
import type { Decretum } from '../items/decretum';
import { decretumHand, maxHandSize } from '../items/decretum-store';
import type { Doctrine } from '../items/doctrine';
import { doctrineCollection, equippedDoctrines } from '../items/doctrine-store';
import { consequenceFlags, seenEventsThisSpoke } from '../events/event-store';
import type { NPCFaction } from '../progression/npc-faction-store';
import { npcFactions } from '../progression/npc-faction-store';
import { currentNodeIndex, currentSpoke, spokeGains, type Spoke, type SpokeNode, ZERO_GAINS } from '../progression/spoke';
import {
  crusadeBattlesLeft,
  goldenOpportunityPending,
  legateHiringPool,
  manipulateUsesLeft,
  nextInvestmentDiscount,
  pendingEnemyConversions,
  preparedArmy,
  preparedLegate,
  warCryActive,
  warCryLastUsedSpoke,
} from '../progression/strategic-store';
import type { Governor } from '../province/governor';
import type { ProvinceFeature } from '../../data/province-features';
import { featurePool } from '../province/feature-store';
import type { Province } from '../province/province';
import { governorAssignments, governorPool, type GovernorAssignment } from '../province/governor-store';
import { provinces } from '../province/province-store';
import { claimedIndices, loadTopology, territoryMap, topologyData } from '../province/province-map-store';
import {
  allianceCount,
  allies,
  battlesWon,
  completedSpokes,
  enemies,
  globalSeason,
  selectedCommander,
  spokesSinceLastBattle,
  startNewRun,
  syncFactionSignals,
  threatLevel,
  veteranStacks,
} from './game-state';
import { faith, gold, influence, initResources, iuniores, momentum, type Resources } from './resources';
import type { Legate } from '../army/legate';
import { normalizeCohortRoster } from '../army/cohort';
import {
  activeEventTileId,
  campaignState,
  hexTiles,
  setActiveEvent,
  setTiles,
  setVisitHistory,
  visitHistory,
} from '../campaign/campaign-state';
import { CAMPAIGN_MOVEMENT_POINTS_MAX } from '../campaign/campaign-balance';
import type { CampaignState, HexTile } from '../campaign/campaign-types';

// —— Types ——

export interface RunRecord {
  /** ISO timestamp of run completion. */
  date: string;
  /** Commander ID used. */
  commanderId: string;
  /** Commander display name. */
  commanderName: string;
  /** 'victory' or 'defeat'. */
  outcome: 'victory' | 'defeat';
  /** Total battles won this run. */
  battlesWon: number;
  /** Total seasons elapsed. */
  seasons: number;
  /** Provinces conquered. */
  provinces: number;
  /** Computed score. */
  score: number;
}

type SavedResources = Omit<Resources, 'iuniores'> & { iuniores?: number };

export interface CampaignSnapshot {
  hexTiles: HexTile[];
  campaignState: CampaignState;
  activeEventTileId: string | null;
  /** S32-05: ordered list of tile ids the legion has occupied this run. */
  visitHistory: string[];
}

export interface ActiveRunSave {
  commanderId: string;
  resources: SavedResources;
  iunioresSeeded?: boolean;
  completedSpokes: number;
  threatLevel: number;
  spokesSinceLastBattle: number;
  globalSeason: number;
  veteranStacks: number;
  battlesWon: number;
  provinces: Province[];
  governorPool: Governor[];
  governorAssignments: Record<string, GovernorAssignment>;
  territoryEntries: Array<[string, number]>;
  claimedIndices: number[];
  featurePool: ProvinceFeature[];
  councilSlots: (Advisor | null)[];
  advisorPool: Advisor[];
  advisorMarket: Advisor[];
  tierUpNotices: string[];
  plannedSpoke: Spoke | null;
  currentSpoke: Spoke | null;
  currentNodeIndex: number;
  spokeGains: Record<ResourceType, number>;
  consequenceFlags: string[];
  seenEventsThisSpoke: string[];
  npcFactions: NPCFaction[];
  crusadeBattlesLeft: number;
  warCryLastUsedSpoke: number;
  warCryActive: boolean;
  manipulateUsesLeft: number;
  goldenOpportunityPending: number;
  pendingEnemyConversions: number;
  nextInvestmentDiscount: number;
  preparedArmy: ArmyData | null;
  preparedLegate: Legate | null;
  legateHiringPool: Legate[];
  doctrineCollection: Doctrine[];
  equippedDoctrines: (Doctrine | null)[];
  decretumHand: Decretum[];
  maxHandSize: number;
  /** S31-04: campaign hex map state. Optional for backwards compat with pre-S31-04 saves. */
  campaign?: CampaignSnapshot | null;
}

export interface MetaSave {
  /** Version for migration support. */
  version: 2;
  /** Completed run history (most recent first). */
  runs: RunRecord[];
  /** Total runs started (includes incomplete). */
  totalRunsStarted: number;
  /** Total victories. */
  victories: number;
  /** Best score ever achieved. */
  highScore: number;
  /** Commander IDs that have won at least once. */
  commanderWins: string[];
  /** Current in-progress run snapshot for Continue. */
  activeRun: ActiveRunSave | null;
}

// —— Constants ——

const STORAGE_KEY = 'imperium-meta-save';
const MAX_RUN_HISTORY = 50;
const SAVE_DEBOUNCE_MS = 500;

// —— Default state ——

function createDefaultSave(): MetaSave {
  return {
    version: 2,
    runs: [],
    totalRunsStarted: 0,
    victories: 0,
    highScore: 0,
    commanderWins: [],
    activeRun: null,
  };
}

// —— Signals ——

export const metaSave = signal<MetaSave>(createDefaultSave());

// —— Serialization helpers ——

function normalizeResources(resources: Partial<SavedResources> | null | undefined): Resources {
  const normalized: Resources = {
    gold: typeof resources?.gold === 'number' ? resources.gold : 0,
    faith: typeof resources?.faith === 'number' ? resources.faith : 0,
    influence: typeof resources?.influence === 'number' ? resources.influence : 0,
    momentum: typeof resources?.momentum === 'number' ? resources.momentum : 0,
    iuniores: typeof resources?.iuniores === 'number' ? resources.iuniores : 0,
  };
  return normalized;
}

function normalizeArmySnapshot(army: ArmyData | null | undefined): ArmyData | null {
  if (!army) return null;
  return {
    ...army,
    cohorts: normalizeCohortRoster(army.cohorts),
  };
}

function normalizeSpokeSnapshot(spoke: Spoke | null | undefined): Spoke | null {
  if (!spoke) return null;
  // S27-02: SpokeNode gained optional Itinerarium fields (landmarkType,
  // encounterType, revealed, effects, …). The spread copy preserves whatever
  // is on each node — undefined for legacy saves, set for Itinerarium spokes —
  // so older saves load without migration code. Readers must tolerate absence.
  return {
    ...spoke,
    boundArmy: normalizeArmySnapshot(spoke.boundArmy ?? null),
    branches: normalizeBranches(spoke.branches),
  };
}

/**
 * S27 variety pass: branches changed shape from `{attachAfter, node}` to
 * `{attachAfter, nodes: SpokeNode[]}`. Older saves carry the singular form;
 * normalize them into single-node chains so reads never crash.
 */
function normalizeBranches(branches: Spoke['branches']): Spoke['branches'] {
  if (!branches || branches.length === 0) return branches;
  return branches.map(b => {
    // New shape — passthrough.
    if (Array.isArray((b as { nodes?: unknown }).nodes)) return b;
    // Old shape — promote `node` into `nodes: [node]`. Cast through `unknown`
    // because the legacy interface no longer exists in the type system.
    const legacy = b as unknown as { attachAfter: number; node: SpokeNode };
    if (legacy.node) {
      return { attachAfter: legacy.attachAfter, nodes: [legacy.node] };
    }
    // Defensive: drop malformed entries.
    return { attachAfter: 0, nodes: [] };
  }).filter(b => b.nodes.length > 0);
}

/**
 * S31-04: parse a saved campaign blob back into a CampaignSnapshot.
 * Returns null on missing, non-object, or shape-mismatched data so legacy saves
 * (and any corruption) load cleanly with a fresh map.
 *
 * Spot-checks the first hexTiles element's shape so a non-empty array of
 * non-HexTile garbage (e.g. a corrupted save with `hexTiles: [1, 2, 3]`) is
 * rejected before HexTileView reads `tile.q` and crashes. The check assumes
 * uniform corruption — one bad element implies the rest are too — which is
 * how localStorage corruption realistically manifests.
 */
export function migrateCampaignSnapshot(raw: unknown): CampaignSnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Partial<CampaignSnapshot>;
  if (!Array.isArray(obj.hexTiles)) return null;
  if (!obj.campaignState || typeof obj.campaignState !== 'object') return null;

  const cs = obj.campaignState as Partial<CampaignState>;
  if (typeof cs.currentTileId !== 'string') return null;
  if (typeof cs.supplies !== 'number') return null;
  if (typeof cs.morale !== 'number') return null;
  const movementPoints = typeof cs.movementPoints === 'number'
    ? cs.movementPoints
    : CAMPAIGN_MOVEMENT_POINTS_MAX;

  if (obj.hexTiles.length > 0 && !isLikelyHexTile(obj.hexTiles[0])) return null;

  const activeId =
    typeof obj.activeEventTileId === 'string' ? obj.activeEventTileId : null;

  // S32-05: visit history is decorative (drives the polyline). On any
  // malformation, default to [] rather than rejecting the whole snapshot —
  // the campaign state itself is more important to preserve.
  const rawHistory = (obj as { visitHistory?: unknown }).visitHistory;
  const safeHistory: string[] = Array.isArray(rawHistory) && rawHistory.every((id) => typeof id === 'string')
    ? (rawHistory as string[])
    : [];

  return {
    hexTiles: obj.hexTiles as HexTile[],
    campaignState: {
      currentTileId: cs.currentTileId,
      selectedTileId:
        typeof cs.selectedTileId === 'string' ? cs.selectedTileId : null,
      movementPoints,
      supplies: cs.supplies,
      morale: cs.morale,
    },
    activeEventTileId: activeId,
    visitHistory: safeHistory,
  };
}

function isLikelyHexTile(value: unknown): value is HexTile {
  if (!value || typeof value !== 'object') return false;
  const t = value as Partial<HexTile>;
  return (
    typeof t.id === 'string' &&
    typeof t.q === 'number' &&
    typeof t.r === 'number' &&
    typeof t.terrain === 'string' &&
    typeof t.event === 'string'
  );
}

function migrateActiveRun(rawRun: unknown): ActiveRunSave | null {
  if (!rawRun || typeof rawRun !== 'object') return null;

  const run = rawRun as Partial<ActiveRunSave> & { resources?: Partial<SavedResources> | null };
  if (typeof run.commanderId !== 'string' || run.commanderId.length === 0) return null;

  const resources = normalizeResources(run.resources);
  let iunioresSeeded = run.iunioresSeeded === true;
  const hasSavedIuniores = typeof run.resources?.iuniores === 'number';
  if (!hasSavedIuniores && !iunioresSeeded) {
    resources.iuniores = IUNIORES.startingSeed;
    iunioresSeeded = true;
  }

  const plannedSpoke = normalizeSpokeSnapshot(run.plannedSpoke ?? null);
  const currentSpokeSnapshot = normalizeSpokeSnapshot(run.currentSpoke ?? null);
  const preparedArmySnapshot = normalizeArmySnapshot(run.preparedArmy ?? null);

  return {
    commanderId: run.commanderId,
    resources,
    iunioresSeeded,
    completedSpokes: typeof run.completedSpokes === 'number' ? run.completedSpokes : 0,
    threatLevel: typeof run.threatLevel === 'number' ? run.threatLevel : 0,
    spokesSinceLastBattle: typeof run.spokesSinceLastBattle === 'number' ? run.spokesSinceLastBattle : 0,
    globalSeason: typeof run.globalSeason === 'number' ? run.globalSeason : 0,
    veteranStacks: typeof run.veteranStacks === 'number' ? run.veteranStacks : 0,
    battlesWon: typeof run.battlesWon === 'number' ? run.battlesWon : 0,
    provinces: Array.isArray(run.provinces) ? run.provinces : [],
    governorPool: Array.isArray(run.governorPool) ? run.governorPool : [],
    governorAssignments: run.governorAssignments && typeof run.governorAssignments === 'object' ? run.governorAssignments : {},
    territoryEntries: Array.isArray(run.territoryEntries) ? run.territoryEntries : [],
    claimedIndices: Array.isArray(run.claimedIndices) ? run.claimedIndices : [],
    featurePool: Array.isArray(run.featurePool) ? run.featurePool : [],
    councilSlots: Array.isArray(run.councilSlots) ? run.councilSlots : [null, null, null],
    advisorPool: Array.isArray(run.advisorPool) ? run.advisorPool : [],
    advisorMarket: Array.isArray(run.advisorMarket) ? run.advisorMarket : [],
    tierUpNotices: Array.isArray(run.tierUpNotices) ? run.tierUpNotices : [],
    plannedSpoke,
    currentSpoke: currentSpokeSnapshot,
    currentNodeIndex: typeof run.currentNodeIndex === 'number' ? run.currentNodeIndex : 0,
    spokeGains: { ...ZERO_GAINS, ...(run.spokeGains ?? {}) },
    consequenceFlags: Array.isArray(run.consequenceFlags) ? run.consequenceFlags : [],
    seenEventsThisSpoke: Array.isArray(run.seenEventsThisSpoke) ? run.seenEventsThisSpoke : [],
    npcFactions: Array.isArray(run.npcFactions) ? run.npcFactions : [],
    crusadeBattlesLeft: typeof run.crusadeBattlesLeft === 'number' ? run.crusadeBattlesLeft : 0,
    warCryLastUsedSpoke: typeof run.warCryLastUsedSpoke === 'number' ? run.warCryLastUsedSpoke : -99,
    warCryActive: run.warCryActive === true,
    manipulateUsesLeft: typeof run.manipulateUsesLeft === 'number' ? run.manipulateUsesLeft : 0,
    goldenOpportunityPending: typeof run.goldenOpportunityPending === 'number' ? run.goldenOpportunityPending : 0,
    pendingEnemyConversions: typeof run.pendingEnemyConversions === 'number' ? run.pendingEnemyConversions : 0,
    nextInvestmentDiscount: typeof run.nextInvestmentDiscount === 'number' ? run.nextInvestmentDiscount : 0,
    preparedArmy: preparedArmySnapshot,
    preparedLegate: run.preparedLegate ?? null,
    legateHiringPool: Array.isArray(run.legateHiringPool) ? run.legateHiringPool : [],
    doctrineCollection: Array.isArray(run.doctrineCollection) ? run.doctrineCollection : [],
    equippedDoctrines: Array.isArray(run.equippedDoctrines) ? run.equippedDoctrines : [null, null, null, null],
    decretumHand: Array.isArray(run.decretumHand) ? run.decretumHand : [],
    maxHandSize: typeof run.maxHandSize === 'number' ? run.maxHandSize : 5,
    campaign: migrateCampaignSnapshot(run.campaign),
  };
}

function migrateMetaSave(rawSave: unknown): MetaSave {
  if (!rawSave || typeof rawSave !== 'object') return createDefaultSave();

  const parsed = rawSave as Record<string, unknown>;
  if (parsed.version !== 1 && parsed.version !== 2) return createDefaultSave();

  return {
    version: 2,
    runs: Array.isArray(parsed.runs) ? parsed.runs as RunRecord[] : [],
    totalRunsStarted: typeof parsed.totalRunsStarted === 'number' ? parsed.totalRunsStarted : 0,
    victories: typeof parsed.victories === 'number' ? parsed.victories : 0,
    highScore: typeof parsed.highScore === 'number' ? parsed.highScore : 0,
    commanderWins: Array.isArray(parsed.commanderWins) ? parsed.commanderWins as string[] : [],
    activeRun: migrateActiveRun(parsed.activeRun),
  };
}

export function parseMetaSave(raw: string | null | undefined): MetaSave {
  if (!raw) return createDefaultSave();
  try {
    return migrateMetaSave(JSON.parse(raw));
  } catch {
    return createDefaultSave();
  }
}

// —— Persistence ——

/** Load meta-save from localStorage. Safe — returns defaults on any error. */
export function loadMetaSave(): void {
  metaSave.value = parseMetaSave(localStorage.getItem(STORAGE_KEY));
}

/** Persist current meta-save to localStorage. */
function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(metaSave.value));
  } catch {
    // Storage full or unavailable — silently fail
  }
}

function buildActiveRunSnapshot(): ActiveRunSave | null {
  const commander = selectedCommander.value;
  if (!commander) return null;

  return {
    commanderId: commander.id,
    resources: {
      gold: gold.value,
      faith: faith.value,
      influence: influence.value,
      momentum: momentum.value,
      iuniores: iuniores.value,
    },
    iunioresSeeded: true,
    completedSpokes: completedSpokes.value,
    threatLevel: threatLevel.value,
    spokesSinceLastBattle: spokesSinceLastBattle.value,
    globalSeason: globalSeason.value,
    veteranStacks: veteranStacks.value,
    battlesWon: battlesWon.value,
    provinces: provinces.value,
    governorPool: governorPool.value,
    governorAssignments: governorAssignments.value,
    territoryEntries: Array.from(territoryMap.value.entries()),
    claimedIndices: Array.from(claimedIndices.value),
    featurePool: featurePool.value,
    councilSlots: councilSlots.value,
    advisorPool: advisorPool.value,
    advisorMarket: advisorMarket.value,
    tierUpNotices: tierUpNotices.value,
    plannedSpoke: normalizeSpokeSnapshot(plannedSpoke.value),
    currentSpoke: normalizeSpokeSnapshot(currentSpoke.value),
    currentNodeIndex: currentNodeIndex.value,
    spokeGains: spokeGains.value,
    consequenceFlags: Array.from(consequenceFlags.value),
    seenEventsThisSpoke: Array.from(seenEventsThisSpoke.value),
    npcFactions: npcFactions.value,
    crusadeBattlesLeft: crusadeBattlesLeft.value,
    warCryLastUsedSpoke: warCryLastUsedSpoke.value,
    warCryActive: warCryActive.value,
    manipulateUsesLeft: manipulateUsesLeft.value,
    goldenOpportunityPending: goldenOpportunityPending.value,
    pendingEnemyConversions: pendingEnemyConversions.value,
    nextInvestmentDiscount: nextInvestmentDiscount.value,
    preparedArmy: normalizeArmySnapshot(preparedArmy.value),
    preparedLegate: preparedLegate.value,
    legateHiringPool: legateHiringPool.value,
    doctrineCollection: doctrineCollection.value,
    equippedDoctrines: equippedDoctrines.value,
    decretumHand: decretumHand.value,
    maxHandSize: maxHandSize.value,
    campaign: {
      hexTiles: hexTiles.value,
      campaignState: campaignState.value,
      activeEventTileId: activeEventTileId.value,
      visitHistory: visitHistory.value,
    },
  };
}

export function hasActiveRunSave(): boolean {
  return metaSave.value.activeRun !== null;
}

export function saveActiveRunSnapshot(): void {
  if (isRestoringActiveRun) return;
  const snapshot = buildActiveRunSnapshot();
  if (!snapshot) return;
  metaSave.value = {
    ...metaSave.value,
    activeRun: snapshot,
  };
  persist();
}

export function clearActiveRunSave(): void {
  if (metaSave.value.activeRun === null) return;
  metaSave.value = {
    ...metaSave.value,
    activeRun: null,
  };
  persist();
}

let persistenceDisposer: (() => void) | null = null;
let isRestoringActiveRun = false;
let pendingPersistTimer: ReturnType<typeof setTimeout> | null = null;

function flushPendingPersist(): void {
  if (pendingPersistTimer !== null) {
    clearTimeout(pendingPersistTimer);
    pendingPersistTimer = null;
  }
}

/**
 * Set up the autosave effect for the active run.
 *
 * **Persistence scope**: this effect tracks `selectedCommander` and the three
 * campaign signals (hexTiles, campaignState, activeEventTileId). Mutations to
 * any of those debounce a save through `saveActiveRunSnapshot`.
 *
 * **Known gap**: the broader run state — provinces, councilSlots, advisorPool,
 * decretumHand, doctrineCollection, governorAssignments, npcFactions, …
 * — is NOT tracked here. Mutations to those signals do not trigger autosave;
 * they only persist the next time the campaign signals or commander change
 * (effectively whenever the player moves on the hex map).
 *
 * Widening the effect to track all run signals risks save loops (a save
 * write that touches a tracked signal re-fires the effect). S32-09 will
 * decide whether to widen with explicit re-entrancy guards or accept the
 * current scope as the contract.
 */
export function startActiveRunPersistence(): () => void {
  if (persistenceDisposer) return persistenceDisposer;

  const stop = effect(() => {
    if (!selectedCommander.value) return;
    // S31-04: subscribe to campaign signals so setTiles/setCurrent/setSelected/
    // consumeEvent all debounce a save. Reads are purely for tracking — the
    // values themselves are read again inside saveActiveRunSnapshot.
    void hexTiles.value;
    void campaignState.value;
    void activeEventTileId.value;

    flushPendingPersist();
    pendingPersistTimer = setTimeout(() => {
      pendingPersistTimer = null;
      saveActiveRunSnapshot();
    }, SAVE_DEBOUNCE_MS);
  });

  persistenceDisposer = () => {
    stop();
    flushPendingPersist();
    persistenceDisposer = null;
  };

  return persistenceDisposer;
}

export async function restoreActiveRun(): Promise<boolean> {
  const snapshot = metaSave.value.activeRun;
  if (!snapshot) return false;

  const commander = COMMANDERS.find(c => c.id === snapshot.commanderId);
  if (!commander) {
    clearActiveRunSave();
    return false;
  }

  isRestoringActiveRun = true;
  try {
    startNewRun(commander, { recordRunStart: false, seedHomeProvince: false });

    if (!topologyData.value) {
      await loadTopology();
    }

    initResources(normalizeResources(snapshot.resources));
    completedSpokes.value = snapshot.completedSpokes;
    threatLevel.value = snapshot.threatLevel;
    spokesSinceLastBattle.value = snapshot.spokesSinceLastBattle;
    globalSeason.value = snapshot.globalSeason;
    veteranStacks.value = snapshot.veteranStacks;
    battlesWon.value = snapshot.battlesWon;

    provinces.value = snapshot.provinces;
    governorPool.value = snapshot.governorPool;
    governorAssignments.value = snapshot.governorAssignments;
    territoryMap.value = new Map(snapshot.territoryEntries);
    claimedIndices.value = new Set(snapshot.claimedIndices);
    featurePool.value = snapshot.featurePool;

    councilSlots.value = snapshot.councilSlots;
    advisorPool.value = snapshot.advisorPool;
    advisorMarket.value = snapshot.advisorMarket;
    tierUpNotices.value = snapshot.tierUpNotices;
    plannedSpoke.value = normalizeSpokeSnapshot(snapshot.plannedSpoke);

    currentSpoke.value = normalizeSpokeSnapshot(snapshot.currentSpoke);
    currentNodeIndex.value = snapshot.currentNodeIndex;
    spokeGains.value = { ...ZERO_GAINS, ...snapshot.spokeGains };

    consequenceFlags.value = new Set(snapshot.consequenceFlags);
    seenEventsThisSpoke.value = new Set(snapshot.seenEventsThisSpoke);
    npcFactions.value = snapshot.npcFactions;
    syncFactionSignals();
    allianceCount.value = snapshot.npcFactions.filter(f => f.relation === 'friendly').length;
    enemies.value = snapshot.npcFactions.filter(f => f.relation === 'hostile').map(f => f.id);
    allies.value = snapshot.npcFactions.filter(f => f.relation === 'friendly').map(f => f.id);

    crusadeBattlesLeft.value = snapshot.crusadeBattlesLeft;
    warCryLastUsedSpoke.value = snapshot.warCryLastUsedSpoke;
    warCryActive.value = snapshot.warCryActive;
    manipulateUsesLeft.value = snapshot.manipulateUsesLeft;
    goldenOpportunityPending.value = snapshot.goldenOpportunityPending;
    pendingEnemyConversions.value = snapshot.pendingEnemyConversions;
    nextInvestmentDiscount.value = snapshot.nextInvestmentDiscount;
    preparedArmy.value = normalizeArmySnapshot(snapshot.preparedArmy);
    preparedLegate.value = snapshot.preparedLegate;
    legateHiringPool.value = snapshot.legateHiringPool;

    doctrineCollection.value = snapshot.doctrineCollection;
    equippedDoctrines.value = snapshot.equippedDoctrines;
    decretumHand.value = snapshot.decretumHand;
    maxHandSize.value = snapshot.maxHandSize;

    if (snapshot.campaign) {
      setTiles(snapshot.campaign.hexTiles);
      campaignState.value = snapshot.campaign.campaignState;
      setActiveEvent(snapshot.campaign.activeEventTileId);
      setVisitHistory(snapshot.campaign.visitHistory);
    }

    metaSave.value = {
      ...metaSave.value,
      activeRun: {
        ...snapshot,
        resources: {
          gold: gold.value,
          faith: faith.value,
          influence: influence.value,
          momentum: momentum.value,
          iuniores: iuniores.value,
        },
        iunioresSeeded: true,
        plannedSpoke: normalizeSpokeSnapshot(plannedSpoke.value),
        currentSpoke: normalizeSpokeSnapshot(currentSpoke.value),
        preparedArmy: normalizeArmySnapshot(preparedArmy.value),
      },
    };
    persist();
    return true;
  } catch (error) {
    console.warn('[meta-save] Failed to restore active run', error);
    return false;
  } finally {
    isRestoringActiveRun = false;
  }
}

// —— Actions ——

/** Record a new run start (increments totalRunsStarted). */
export function recordRunStart(): void {
  metaSave.value = {
    ...metaSave.value,
    totalRunsStarted: metaSave.value.totalRunsStarted + 1,
  };
  persist();
}

/** Compute score from run stats. */
export function computeScore(
  outcome: 'victory' | 'defeat',
  battlesWon: number,
  seasons: number,
  provinces: number,
): number {
  const basePoints = outcome === 'victory' ? 1000 : 0;
  const battlePoints = battlesWon * 75;
  const provincePoints = provinces * 200;
  // Bonus for finishing faster (fewer seasons used) — doubled in S9-06
  const speedBonus = outcome === 'victory' ? Math.max(0, (24 - seasons) * 100) : 0;
  return basePoints + battlePoints + provincePoints + speedBonus;
}

/**
 * Record a completed run. Call from Victory/Defeat screens before resetRun().
 */
export function recordRunComplete(
  commanderId: string,
  commanderName: string,
  outcome: 'victory' | 'defeat',
  battlesWon: number,
  seasons: number,
  provinces: number,
): void {
  const score = computeScore(outcome, battlesWon, seasons, provinces);

  const record: RunRecord = {
    date: new Date().toISOString(),
    commanderId,
    commanderName,
    outcome,
    battlesWon,
    seasons,
    provinces,
    score,
  };

  const prev = metaSave.value;
  const runs = [record, ...prev.runs].slice(0, MAX_RUN_HISTORY);
  const victories = prev.victories + (outcome === 'victory' ? 1 : 0);
  const highScore = Math.max(prev.highScore, score);
  const commanderWins = outcome === 'victory' && !prev.commanderWins.includes(commanderId)
    ? [...prev.commanderWins, commanderId]
    : prev.commanderWins;

  metaSave.value = {
    ...prev,
    runs,
    victories,
    highScore,
    commanderWins,
    activeRun: null,
  };

  persist();
}

/** Get the best run record, or null if no runs. */
export function getBestRun(): RunRecord | null {
  const runs = metaSave.value.runs;
  if (runs.length === 0) return null;
  return runs.reduce((best, r) => r.score > best.score ? r : best);
}

/** Check if a commander has won before. */
export function hasCommanderWon(commanderId: string): boolean {
  return metaSave.value.commanderWins.includes(commanderId);
}

/** Clear all save data. */
export function clearMetaSave(): void {
  metaSave.value = createDefaultSave();
  persist();
}
