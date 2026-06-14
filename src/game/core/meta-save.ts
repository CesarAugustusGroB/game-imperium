import { computed, effect, signal } from '@preact/signals';
import type { ArmyData } from '../../types';
import { IUNIORES } from '../../config/game-config';
import { COMMANDERS } from '../../data/commanders';
import { STARTER_ADVISORS } from '../../data/advisor-data';
import type { Advisor } from '../council/advisor';
import { advisorMarket, councilSlots, tierUpNotices } from '../council/council-store';
import type { Decretum } from '../items/decretum';
import { decretumHand, maxHandSize } from '../items/decretum-store';
import type { ActiveDecretumEffect } from '../items/decretum-hub';
import { activeDecretumEffects } from '../items/decretum-hub';
import type { Doctrine } from '../items/doctrine';
import { doctrineCollection, equippedDoctrines, pendingDoctrineDraft } from '../items/doctrine-store';
import {
  consequenceFlags, seenEventsThisSpoke, campaignConflicts,
  campaignEventFiredThisSpoke, pendingHubConsequences,
} from '../events/event-store';
import type { CampaignConflict, HubConsequence } from '../events/campaign-events-types';
import type { NPCFaction } from '../progression/npc-faction-store';
import { npcFactions } from '../progression/npc-faction-store';
import { forgedAllies, setForgedAllies, type ForgedAlly } from '../progression/ally-store';
import {
  legateHiringPool,
  nextInvestmentDiscount,
  preparedArmy,
  preparedLegate,
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
  startNewRun,
  syncFactionSignals,
  threatLevel,
  veteranStacks,
} from './game-state';
import { unlockedScenarios, setUnlockedScenarios } from '../iterBelli/iter-belli-scenario';
import { gold, initResources, iuniores, type Resources } from './resources';
import type { Legate } from '../army/legate';
import { normalizeCohortRoster } from '../army/cohort';
import { SUPPLY_MAX_CARRY, SUPPLY_MORALE_PENALTY_CAP, AMMO_MAX_CARRY } from '../../config/game-config';
import { ARMOR_LADDER } from '../progression/arsenal';
import { serializeIterBelli, restoreIterBelli, type IterBelliSave } from '../iterBelli/iter-belli-save';
import { computeDoctrineModifiers } from '../../data/iter-belli-doctrines';

// —— Types ——

/** Per-campaign telemetry entry (plan S-J). Local-only; exported as JSON for balance analysis. */
export interface CampaignLogEntry {
  /** ISO timestamp of campaign completion. */
  date: string;
  commanderId: string;
  commanderName: string;
  scenarioId: string;
  outcome: 'victory' | 'defeat';
  /** Human-readable end cause (victory title or defeat reason). */
  cause: string;
  /** Global season clock at campaign end. */
  seasonsAtEnd: number;
  /** Campaign days elapsed (turnNum). */
  daysUsed: number;
  /** Final run resources after the campaign settled back to the hub. */
  finalGold: number;
  finalIuniores: number;
  /** Surviving soldiers at campaign end. */
  survivors: number;
  /** Cards resolved during the campaign. */
  cardsPlayed: number;
  /** Battle orders issued, keyed by order id (e.g. 'siege', 'charge'). */
  ordersUsed: Record<string, number>;
}

type SavedResources = Omit<Resources, 'iuniores'> & { iuniores?: number };

export interface ActiveRunSave {
  commanderId: string;
  resources: SavedResources;
  iunioresSeeded?: boolean;
  /** Iter Belli scenarios unlocked this run (S-F). Optional for backwards compat. */
  unlockedScenarios?: string[];
  completedSpokes: number;
  threatLevel: number;
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
  advisorMarket: Advisor[];
  tierUpNotices: string[];
  consequenceFlags: string[];
  seenEventsThisSpoke: string[];
  /** Campaign-event state (D10). Optional for backwards compat with pre-D10 saves. */
  campaignConflicts?: CampaignConflict[];
  campaignEventFired?: boolean;
  pendingHubConsequences?: HubConsequence[];
  npcFactions: NPCFaction[];
  /** Forged alliances (plan S-L). Optional for backwards compat. */
  forgedAllies?: ForgedAlly[];
  nextInvestmentDiscount: number;
  preparedArmy: ArmyData | null;
  preparedLegate: Legate | null;
  legateHiringPool: Legate[];
  doctrineCollection: Doctrine[];
  equippedDoctrines: (Doctrine | null)[];
  /** Unresolved victory draft offers. Optional for backwards compat. */
  pendingDoctrineDraft?: Doctrine[] | null;
  decretumHand: Decretum[];
  maxHandSize: number;
  /** Continuous Hub effects in flight (e.g. upkeep waivers). Optional for backwards compat. */
  activeDecretumEffects?: ActiveDecretumEffect[];
  /** In-flight Iter Belli campaign snapshot. Absent/null = no campaign in flight. */
  iterBelli?: IterBelliSave | null;
}

export interface MetaSave {
  /** Version for migration support. */
  version: 3;
  /** Per-campaign telemetry log (most recent first), capped. Plan S-J. */
  campaignLogs: CampaignLogEntry[];
  /** Total runs started (includes incomplete). */
  totalRunsStarted: number;
  /** Total victories. */
  victories: number;
  /** Current in-progress run snapshot for Continue. */
  activeRun: ActiveRunSave | null;
  /** S34-03: whether the first-run Bellum tutorial overlay has been dismissed.
   *  False for new players and existing players upgrading from v1/v2 so they
   *  see the tutorial once after the upgrade. */
  tutorialDismissed: boolean;
}

// —— Constants ——

const STORAGE_KEY = 'imperium-meta-save';
const SAVE_DEBOUNCE_MS = 500;
const ADVISOR_TEMPLATE_BY_ID = new Map(STARTER_ADVISORS.map(advisor => [advisor.id, advisor] as const));

// —— Default state ——

function createDefaultSave(): MetaSave {
  return {
    version: 3,
    campaignLogs: [],
    totalRunsStarted: 0,
    victories: 0,
    activeRun: null,
    tutorialDismissed: false,
  };
}

// —— Signals ——

export const metaSave = signal<MetaSave>(createDefaultSave());

// —— Serialization helpers ——

function normalizeResources(resources: Partial<SavedResources> | null | undefined): Resources {
  const normalized: Resources = {
    gold: typeof resources?.gold === 'number' ? resources.gold : 0,
    iuniores: typeof resources?.iuniores === 'number' ? resources.iuniores : 0,
  };
  return normalized;
}

function asFiniteNumber(v: unknown, fallback: number): number {
  return typeof v === 'number' && isFinite(v) ? v : fallback;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function normalizeArmySnapshot(army: ArmyData | null | undefined): ArmyData | null {
  if (!army) return null;
  return {
    ...army,
    cohorts: normalizeCohortRoster(army.cohorts),
    supplies: clamp(asFiniteNumber(army.supplies, 0), 0, SUPPLY_MAX_CARRY),
    armorMaterial: ARMOR_LADDER.includes(army.armorMaterial as never)
      ? army.armorMaterial
      : 'copper',
    ammunition: army.ammunition === undefined
      ? undefined
      : clamp(asFiniteNumber(army.ammunition, 0), 0, AMMO_MAX_CARRY),
    supplyMoralePenalty: army.supplyMoralePenalty === undefined
      ? undefined
      : clamp(asFiniteNumber(army.supplyMoralePenalty, 0), 0, SUPPLY_MORALE_PENALTY_CAP),
    supplyDeficitStreak: army.supplyDeficitStreak === undefined
      ? undefined
      : Math.max(0, Math.floor(asFiniteNumber(army.supplyDeficitStreak, 0))),
    campaignMoraleDelta: army.campaignMoraleDelta === undefined
      ? undefined
      : asFiniteNumber(army.campaignMoraleDelta, 0),
  };
}

function normalizeSavedAdvisor(rawAdvisor: unknown): Advisor | null {
  if (!rawAdvisor || typeof rawAdvisor !== 'object') return null;

  const advisor = rawAdvisor as Partial<Advisor> & Record<string, unknown>;
  if (typeof advisor.id !== 'string') return null;

  const template = ADVISOR_TEMPLATE_BY_ID.get(advisor.id);
  if (!template) {
    if (
      typeof advisor.name !== 'string'
      || typeof advisor.color !== 'string'
      || !Array.isArray(advisor.tiers)
      || typeof advisor.currentTier !== 'number'
      || typeof advisor.xp !== 'number'
    ) {
      return null;
    }

    return {
      ...advisor,
      id: advisor.id,
      name: advisor.name,
      color: advisor.color as Advisor['color'],
      currentTier: advisor.currentTier as Advisor['currentTier'],
      xp: advisor.xp,
      traits: Array.isArray(advisor.traits) ? advisor.traits as Advisor['traits'] : [],
      cost: typeof advisor.cost === 'number' ? advisor.cost : 0,
      tiers: advisor.tiers as Advisor['tiers'],
      ...(typeof advisor.portrait === 'string' ? { portrait: advisor.portrait } : {}),
    };
  }

  const normalized: Advisor = {
    ...template,
    ...advisor,
    currentTier: typeof advisor.currentTier === 'number' ? advisor.currentTier as Advisor['currentTier'] : template.currentTier,
    xp: typeof advisor.xp === 'number' ? advisor.xp : template.xp,
    traits: Array.isArray(advisor.traits) ? advisor.traits as Advisor['traits'] : template.traits,
    cost: typeof advisor.cost === 'number' ? advisor.cost : template.cost,
    tiers: Array.isArray(advisor.tiers) ? advisor.tiers as Advisor['tiers'] : template.tiers,
  };

  // Template portrait wins so saved games pick up the current councilor art
  // (codex's intent). Fall back to a saved portrait only when the template has none.
  if (template.portrait) {
    normalized.portrait = template.portrait;
  } else if (typeof advisor.portrait === 'string') {
    normalized.portrait = advisor.portrait;
  } else {
    delete normalized.portrait;
  }

  return normalized;
}

function normalizeSavedAdvisorArray(rawAdvisors: unknown): Advisor[] {
  if (!Array.isArray(rawAdvisors)) return [];
  return rawAdvisors
    .map(normalizeSavedAdvisor)
    .filter((advisor): advisor is Advisor => advisor !== null);
}

function normalizeSavedAdvisorMarket(run: Partial<ActiveRunSave> & Record<string, unknown>): Advisor[] {
  if (Array.isArray(run.advisorMarket)) return normalizeSavedAdvisorArray(run.advisorMarket);
  if (Array.isArray(run.advisorPool)) return normalizeSavedAdvisorArray(run.advisorPool);
  return [];
}

function normalizeSavedCouncilSlots(rawSlots: unknown): (Advisor | null)[] {
  if (!Array.isArray(rawSlots)) return [null, null, null];
  const normalized = rawSlots
    .slice(0, 3)
    .map(slot => (slot === null ? null : normalizeSavedAdvisor(slot)));
  while (normalized.length < 3) normalized.push(null);
  return normalized;
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

  const preparedArmySnapshot = normalizeArmySnapshot(run.preparedArmy ?? null);

  return {
    commanderId: run.commanderId,
    resources,
    iunioresSeeded,
    unlockedScenarios: Array.isArray(run.unlockedScenarios) ? run.unlockedScenarios.filter((s): s is string => typeof s === 'string') : undefined,
    completedSpokes: typeof run.completedSpokes === 'number' ? run.completedSpokes : 0,
    threatLevel: typeof run.threatLevel === 'number' ? run.threatLevel : 0,
    globalSeason: typeof run.globalSeason === 'number' ? run.globalSeason : 0,
    veteranStacks: typeof run.veteranStacks === 'number' ? run.veteranStacks : 0,
    battlesWon: typeof run.battlesWon === 'number' ? run.battlesWon : 0,
    provinces: Array.isArray(run.provinces) ? run.provinces : [],
    governorPool: Array.isArray(run.governorPool) ? run.governorPool : [],
    governorAssignments: run.governorAssignments && typeof run.governorAssignments === 'object' ? run.governorAssignments : {},
    territoryEntries: Array.isArray(run.territoryEntries) ? run.territoryEntries : [],
    claimedIndices: Array.isArray(run.claimedIndices) ? run.claimedIndices : [],
    featurePool: Array.isArray(run.featurePool) ? run.featurePool : [],
    councilSlots: normalizeSavedCouncilSlots(run.councilSlots),
    advisorMarket: normalizeSavedAdvisorMarket(run as Partial<ActiveRunSave> & Record<string, unknown>),
    tierUpNotices: Array.isArray(run.tierUpNotices) ? run.tierUpNotices : [],
    consequenceFlags: Array.isArray(run.consequenceFlags) ? run.consequenceFlags : [],
    seenEventsThisSpoke: Array.isArray(run.seenEventsThisSpoke) ? run.seenEventsThisSpoke : [],
    campaignConflicts: Array.isArray(run.campaignConflicts) ? run.campaignConflicts : [],
    campaignEventFired: run.campaignEventFired === true,
    pendingHubConsequences: Array.isArray(run.pendingHubConsequences) ? run.pendingHubConsequences : [],
    npcFactions: Array.isArray(run.npcFactions) ? run.npcFactions : [],
    forgedAllies: Array.isArray(run.forgedAllies) ? run.forgedAllies : [],
    nextInvestmentDiscount: typeof run.nextInvestmentDiscount === 'number' ? run.nextInvestmentDiscount : 0,
    preparedArmy: preparedArmySnapshot,
    preparedLegate: run.preparedLegate ?? null,
    legateHiringPool: Array.isArray(run.legateHiringPool) ? run.legateHiringPool : [],
    doctrineCollection: Array.isArray(run.doctrineCollection) ? run.doctrineCollection : [],
    equippedDoctrines: Array.isArray(run.equippedDoctrines) ? run.equippedDoctrines : [null, null, null, null],
    pendingDoctrineDraft: Array.isArray(run.pendingDoctrineDraft) ? run.pendingDoctrineDraft : null,
    decretumHand: Array.isArray(run.decretumHand) ? run.decretumHand : [],
    maxHandSize: typeof run.maxHandSize === 'number' ? run.maxHandSize : 5,
    activeDecretumEffects: Array.isArray(run.activeDecretumEffects) ? run.activeDecretumEffects : [],
    iterBelli: (run.iterBelli && typeof run.iterBelli === 'object') ? run.iterBelli as IterBelliSave : null,
  };
}

function migrateMetaSave(rawSave: unknown): MetaSave {
  if (!rawSave || typeof rawSave !== 'object') return createDefaultSave();

  const parsed = rawSave as Record<string, unknown>;
  // Accept v1 and v2 (upgrade) as well as v3 (passthrough).
  if (parsed.version !== 1 && parsed.version !== 2 && parsed.version !== 3) return createDefaultSave();

  return {
    version: 3,
    campaignLogs: Array.isArray(parsed.campaignLogs) ? parsed.campaignLogs as CampaignLogEntry[] : [],
    totalRunsStarted: typeof parsed.totalRunsStarted === 'number' ? parsed.totalRunsStarted : 0,
    victories: typeof parsed.victories === 'number' ? parsed.victories : 0,
    activeRun: migrateActiveRun(parsed.activeRun),
    // S34-03: default to false on v1/v2 upgrades so existing players see the
    // tutorial once; preserve the stored value for v3 round-trips.
    tutorialDismissed: typeof parsed.tutorialDismissed === 'boolean' ? parsed.tutorialDismissed : false,
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
      iuniores: iuniores.value,
    },
    iunioresSeeded: true,
    unlockedScenarios: unlockedScenarios.value,
    completedSpokes: completedSpokes.value,
    threatLevel: threatLevel.value,
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
    advisorMarket: advisorMarket.value,
    tierUpNotices: tierUpNotices.value,
    consequenceFlags: Array.from(consequenceFlags.value),
    seenEventsThisSpoke: Array.from(seenEventsThisSpoke.value),
    campaignConflicts: campaignConflicts.value,
    campaignEventFired: campaignEventFiredThisSpoke.value,
    pendingHubConsequences: pendingHubConsequences.value,
    npcFactions: npcFactions.value,
    forgedAllies: forgedAllies.value,
    nextInvestmentDiscount: nextInvestmentDiscount.value,
    preparedArmy: normalizeArmySnapshot(preparedArmy.value),
    preparedLegate: preparedLegate.value,
    legateHiringPool: legateHiringPool.value,
    doctrineCollection: doctrineCollection.value,
    equippedDoctrines: equippedDoctrines.value,
    pendingDoctrineDraft: pendingDoctrineDraft.value,
    decretumHand: decretumHand.value,
    maxHandSize: maxHandSize.value,
    activeDecretumEffects: activeDecretumEffects.value,
    iterBelli: serializeIterBelli(),
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
 * **Persistence scope**: this effect builds a full run snapshot on every run,
 * which *reads* every signal that gets serialized. Because signal effects
 * subscribe to whatever they read, ANY mutation to the Hub state — resources,
 * provinces, councilSlots, advisorMarket, decretumHand, doctrineCollection,
 * governorAssignments, npcFactions, strategic state, the campaign, … — re-runs
 * this effect and debounces a save. This keeps the on-reload state identical to
 * the live state; reusing `buildActiveRunSnapshot` guarantees the tracked set
 * never drifts from the saved set.
 */
export function startActiveRunPersistence(): () => void {
  if (persistenceDisposer) return persistenceDisposer;

  const stop = effect(() => {
    // Building the snapshot reads (and thus subscribes to) the entire run state.
    // Returns null when no run is active — nothing to persist yet.
    const snapshot = buildActiveRunSnapshot();
    if (!snapshot) return;

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
    setUnlockedScenarios(snapshot.unlockedScenarios ?? []);
    completedSpokes.value = snapshot.completedSpokes;
    threatLevel.value = snapshot.threatLevel;
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
    advisorMarket.value = snapshot.advisorMarket;
    tierUpNotices.value = snapshot.tierUpNotices;

    consequenceFlags.value = new Set(snapshot.consequenceFlags);
    seenEventsThisSpoke.value = new Set(snapshot.seenEventsThisSpoke);
    campaignConflicts.value = snapshot.campaignConflicts ?? [];
    campaignEventFiredThisSpoke.value = snapshot.campaignEventFired === true;
    pendingHubConsequences.value = snapshot.pendingHubConsequences ?? [];
    npcFactions.value = snapshot.npcFactions;
    setForgedAllies(snapshot.forgedAllies ?? []);
    syncFactionSignals();
    allianceCount.value = snapshot.npcFactions.filter(f => f.relation === 'friendly').length;
    enemies.value = snapshot.npcFactions.filter(f => f.relation === 'hostile').map(f => f.id);
    allies.value = snapshot.npcFactions.filter(f => f.relation === 'friendly').map(f => f.id);

    nextInvestmentDiscount.value = snapshot.nextInvestmentDiscount;
    preparedArmy.value = normalizeArmySnapshot(snapshot.preparedArmy);
    preparedLegate.value = snapshot.preparedLegate;
    legateHiringPool.value = snapshot.legateHiringPool;

    doctrineCollection.value = snapshot.doctrineCollection;
    equippedDoctrines.value = snapshot.equippedDoctrines;
    pendingDoctrineDraft.value = snapshot.pendingDoctrineDraft ?? null;
    decretumHand.value = snapshot.decretumHand;
    maxHandSize.value = snapshot.maxHandSize;
    activeDecretumEffects.value = snapshot.activeDecretumEffects ?? [];

    if (snapshot.iterBelli) {
      restoreIterBelli(snapshot.iterBelli, computeDoctrineModifiers(equippedDoctrines.value));
    }

    metaSave.value = {
      ...metaSave.value,
      activeRun: {
        ...snapshot,
        resources: {
          gold: gold.value,
          iuniores: iuniores.value,
        },
        iunioresSeeded: true,
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

/** Max campaign-telemetry entries kept locally (most recent first). */
const CAMPAIGN_LOG_CAP = 100;

/** Append a campaign telemetry entry (plan S-J). Caps the log and persists. */
export function recordCampaignLog(entry: CampaignLogEntry): void {
  const next = [entry, ...metaSave.value.campaignLogs].slice(0, CAMPAIGN_LOG_CAP);
  metaSave.value = { ...metaSave.value, campaignLogs: next };
  persist();
}

/** All campaign telemetry as a pretty JSON string, for manual download/analysis. */
export function exportCampaignLogsJson(): string {
  return JSON.stringify(metaSave.value.campaignLogs, null, 2);
}

// —— S34-03: Tutorial dismissed flag ——

/** Reactive accessor — true once the player has dismissed the Bellum tutorial.
 *  Lives in the meta-save so it survives Abandon Run (per-run resets do not
 *  touch the meta-save). */
export const tutorialDismissed = computed(() => metaSave.value.tutorialDismissed);

/** Flip the tutorial-dismissed flag and persist immediately. */
export function setTutorialDismissed(dismissed: boolean): void {
  if (metaSave.value.tutorialDismissed === dismissed) return;
  metaSave.value = { ...metaSave.value, tutorialDismissed: dismissed };
  persist();
}

/** Clear all save data. */
export function clearMetaSave(): void {
  metaSave.value = createDefaultSave();
  persist();
}
