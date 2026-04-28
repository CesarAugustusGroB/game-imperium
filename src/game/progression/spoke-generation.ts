import type { Posture } from '../council/advisor';
import type { Spoke, SpokeNode, SpokeBranch, SpokeTheme } from './spoke';
import type { LandmarkType, BattleTerrain } from './landmark-types';
import type { BattleTerrainModifier } from './battle-terrain-modifiers';

// ── Curated name pools ──

const FOREST_NAMES = ['Blackwood Forest', 'Pine Hollow', 'Wyrmwood', 'Old Oaks', 'Silverbough'];
const HILL_NAMES = ['Bald Hill', 'Crow Ridge', "Watcher's Mound", 'Three Stones', 'Iron Hill'];
const RIVER_NAMES = ['Crossing of the Rhenus', 'Eburonum Ford', 'Mossbridge', 'Old Ferry', 'Stone Crossing'];
const VILLAGE_NAMES = ['Nemausus', 'Aquinum', 'Ferraria', 'Vetera Vicus', 'Ostia Minor'];
const FARM_NAMES = ['Olive Grove', "Bishop's Field", 'Barley Stretch', 'The Granaries'];
const CAMP_NAMES = ['Castra Aurelia', 'Old Roman Camp', 'Eagle Bivouac', "Quartermaster's Halt"];
const SHRINE_NAMES = ['Shrine of Mars', 'Veiled Altar', 'Sanctum Lapidis'];
const WATCHTOWER_NAMES = ['Old Watchpost', 'Sentinel Pillar', "Eagle's Eye"];
const RUINS_NAMES = ['Forgotten Citadel', 'Empty Stones', 'Ash-Walled Ruin'];
const SUPPLY_DEPOT_NAMES = ['Imperial Depot', 'Fort Granary', 'The Magazine'];
const CITY_NAMES = ['Vetera', 'Carnuntum', 'Mogontiacum', 'Lugdunum'];
const FORT_NAMES = ['Castra Praesidium', 'The Black Bastion', 'Iron Hill Fort'];
const MOUNTAIN_PASS_NAMES = ['The Cleft', "Aurelius' Pass", 'Stonecut Defile', 'Eagle Gap'];
// Unknown node names come from the landmark pool; threat flavor is surfaced in the UI tooltip
const UNKNOWN_FOREST_NAMES = FOREST_NAMES;
const UNKNOWN_RUINS_NAMES = RUINS_NAMES;
const UNKNOWN_MARSH_NAMES = ['The Bone Marsh', 'Reed Flats', 'Grey Fen'];

const SPOKE_LABELS = [
  'The Frontier Push',
  'Border Operation',
  'The Long March',
  'Eastern Sweep',
  'Highland Foray',
];

// ── Helpers ──

function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

function randInt(min: number, max: number, rng: () => number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

// ── Node builders ──

function buildStartCamp(rng: () => number): SpokeNode {
  return {
    id: 'node-0',
    type: 'rest',
    position: 0,
    resolved: false,
    reward: null,
    landmarkType: 'start_camp',
    name: pick(CAMP_NAMES, rng),
    encounterType: 'rest',
    revealed: true,
    scoutedLevel: 1,
    effects: [],
    battleModifiers: [],
  };
}

interface BossVariant {
  landmarkType: LandmarkType;
  terrain: BattleTerrain;
  battleModifiers: BattleTerrainModifier[];
  namePool: string[];
}

const BOSS_VARIANTS: Record<SpokeTheme, BossVariant[]> = {
  woodland: [
    { landmarkType: 'fort', terrain: 'hills', battleModifiers: ['fortified_position', 'high_ground'], namePool: FORT_NAMES },
    { landmarkType: 'ruins', terrain: 'ruins', battleModifiers: ['narrow_pass', 'fortified_position'], namePool: RUINS_NAMES },
  ],
  highlands: [
    { landmarkType: 'fort', terrain: 'mountains', battleModifiers: ['fortified_position', 'narrow_pass'], namePool: FORT_NAMES },
    { landmarkType: 'mountain_pass', terrain: 'mountains', battleModifiers: ['narrow_pass', 'high_ground'], namePool: ['Saxa Rubra Pass', "Eagle's Defile", 'Stonecut Gate'] },
  ],
  marshland: [
    { landmarkType: 'ruins', terrain: 'marsh', battleModifiers: ['mud', 'narrow_pass'], namePool: RUINS_NAMES },
    { landmarkType: 'city', terrain: 'city', battleModifiers: ['urban_fighting', 'mud'], namePool: CITY_NAMES },
  ],
  coastal: [
    { landmarkType: 'city', terrain: 'city', battleModifiers: ['urban_fighting'], namePool: CITY_NAMES },
    { landmarkType: 'fort', terrain: 'plains', battleModifiers: ['fortified_position'], namePool: FORT_NAMES },
  ],
  mixed: [
    { landmarkType: 'city', terrain: 'city', battleModifiers: ['urban_fighting'], namePool: CITY_NAMES },
    { landmarkType: 'fort', terrain: 'hills', battleModifiers: ['fortified_position', 'high_ground'], namePool: FORT_NAMES },
  ],
};

function buildBossNode(index: number, threatLevel: number, theme: SpokeTheme, rng: () => number): SpokeNode {
  const variants = BOSS_VARIANTS[theme];
  const variant = pick(variants, rng);
  // Enemy strength scales with threat bias; base 150 + up to 100 from threat
  const enemyStrength = 150 + Math.floor(threatLevel * 10);

  return {
    id: `node-${index}`,
    type: 'boss',
    position: index,
    resolved: false,
    reward: null,
    landmarkType: variant.landmarkType,
    name: pick(variant.namePool, rng),
    terrain: variant.terrain,
    encounterType: 'boss',
    revealed: true,
    scoutedLevel: 1,
    effects: [],
    battleModifiers: variant.battleModifiers,
    threatHint: 'deadly',
    enemyStrength,
  };
}

function buildRestNode(index: number, rng: () => number): SpokeNode {
  return {
    id: `node-${index}`,
    type: 'rest',
    position: index,
    resolved: false,
    reward: null,
    landmarkType: 'camp',
    name: pick(CAMP_NAMES, rng),
    encounterType: 'rest',
    terrain: 'plains',
    revealed: true,
    scoutedLevel: 1,
    effects: [
      { type: 'morale', delta: 8, label: 'Rest at Camp' },
      { type: 'supplies', delta: 6, label: 'Rest at Camp' },
    ],
    battleModifiers: [],
    threatHint: 'low',
  };
}

function buildWatchtowerNode(index: number, rng: () => number): SpokeNode {
  return {
    id: `node-${index}`,
    type: 'event',
    position: index,
    resolved: false,
    reward: null,
    landmarkType: 'watchtower',
    name: pick(WATCHTOWER_NAMES, rng),
    encounterType: 'scout',
    terrain: 'hills',
    revealed: true,
    scoutedLevel: 1,
    effects: [
      { type: 'reveal', radius: 2, label: 'High vantage point' },
      { type: 'morale', delta: 4, label: 'High vantage point' },
    ],
    battleModifiers: ['high_ground'],
    threatHint: 'low',
  };
}

function buildSupplyNode(index: number, rng: () => number): SpokeNode {
  const roll = rng();
  if (roll < 0.33) {
    // Farm
    return {
      id: `node-${index}`,
      type: 'event',
      position: index,
      resolved: false,
      reward: null,
      landmarkType: 'farm',
      name: pick(FARM_NAMES, rng),
      encounterType: 'forage',
      terrain: 'farmland',
      revealed: true,
      scoutedLevel: 1,
      effects: [{ type: 'supplies', delta: randInt(10, 15, rng), label: 'Harvest the fields' }],
      battleModifiers: ['open_field'],
      threatHint: 'low',
    };
  } else if (roll < 0.66) {
    // Supply depot
    return {
      id: `node-${index}`,
      type: 'event',
      position: index,
      resolved: false,
      reward: null,
      landmarkType: 'supply_depot',
      name: pick(SUPPLY_DEPOT_NAMES, rng),
      encounterType: 'forage',
      terrain: 'road',
      revealed: true,
      scoutedLevel: 2,
      effects: [{ type: 'supplies', delta: randInt(15, 20, rng), label: 'Imperial supply stores' }],
      battleModifiers: [],
      threatHint: 'low',
    };
  } else {
    // Forest forage — unscouted by default. The risk is baked in but hidden
    // by the fog-of-war projection until a watchtower (or `scout` effect)
    // reveals it. Players who push through without scouting eat the loss
    // alongside the supply gain; scouting first lets them weigh the risk.
    return {
      id: `node-${index}`,
      type: 'event',
      position: index,
      resolved: false,
      reward: null,
      landmarkType: 'forest',
      name: pick(FOREST_NAMES, rng),
      encounterType: 'forage',
      terrain: 'forest',
      revealed: false,
      scoutedLevel: 0,
      effects: [
        { type: 'supplies', delta: randInt(10, 18, rng), label: 'Hunt and forage' },
        { type: 'iuniores', delta: -randInt(15, 30, rng), label: 'Foragers ambushed' },
      ],
      battleModifiers: ['forest_cover'],
      threatHint: 'medium',
    };
  }
}

function buildMoraleNode(index: number, rng: () => number): SpokeNode {
  const roll = rng();
  if (roll < 0.4) {
    // Shrine
    return {
      id: `node-${index}`,
      type: 'event',
      position: index,
      resolved: false,
      reward: null,
      landmarkType: 'shrine',
      name: pick(SHRINE_NAMES, rng),
      encounterType: 'event',
      terrain: 'plains',
      revealed: true,
      scoutedLevel: 1,
      effects: [{ type: 'morale', delta: randInt(8, 12, rng), label: 'Sacred rites performed' }],
      battleModifiers: ['sacred_ground'],
      threatHint: 'low',
    };
  } else if (roll < 0.7) {
    // Village with volunteers
    return {
      id: `node-${index}`,
      type: 'event',
      position: index,
      resolved: false,
      reward: null,
      landmarkType: 'village',
      name: pick(VILLAGE_NAMES, rng),
      encounterType: 'recruit',
      terrain: 'farmland',
      revealed: true,
      scoutedLevel: 1,
      effects: [
        { type: 'morale', delta: randInt(8, 10, rng), label: 'Village volunteers rally' },
        { type: 'iuniores', delta: randInt(50, 100, rng), label: 'Village volunteers rally' },
        { type: 'threat', delta: 1, label: 'Recruitment draws attention' },
      ],
      battleModifiers: [],
      threatHint: 'low',
    };
  } else {
    // Camp with morale rally
    return {
      id: `node-${index}`,
      type: 'rest',
      position: index,
      resolved: false,
      reward: null,
      landmarkType: 'camp',
      name: pick(CAMP_NAMES, rng),
      encounterType: 'rest',
      terrain: 'plains',
      revealed: true,
      scoutedLevel: 1,
      effects: [
        { type: 'morale', delta: randInt(10, 12, rng), label: 'Officers rally the cohorts' },
        { type: 'supplies', delta: 4, label: 'Officers rally the cohorts' },
      ],
      battleModifiers: [],
      threatHint: 'low',
    };
  }
}

function buildUnknownNode(index: number, rng: () => number): SpokeNode {
  // Unknown nodes use mysterious landmark types; threat flavor is surfaced by the UI
  const roll = rng();
  let landmarkType: LandmarkType;
  let name: string;
  let terrain: BattleTerrain;

  if (roll < 0.4) {
    landmarkType = 'forest';
    name = pick(UNKNOWN_FOREST_NAMES, rng);
    terrain = 'forest';
  } else if (roll < 0.7) {
    landmarkType = 'ruins';
    name = pick(UNKNOWN_RUINS_NAMES, rng);
    terrain = 'ruins';
  } else {
    landmarkType = 'marsh';
    name = pick(UNKNOWN_MARSH_NAMES, rng);
    terrain = 'marsh';
  }

  const threatHints: Array<'low' | 'medium' | 'high'> = ['low', 'medium', 'high'];
  const threatHint = pick(threatHints, rng);

  return {
    id: `node-${index}`,
    type: 'event',
    position: index,
    resolved: false,
    reward: null,
    landmarkType,
    name,
    encounterType: 'unknown',
    terrain,
    revealed: false,
    scoutedLevel: 0,
    effects: [],
    battleModifiers: [],
    threatHint,
  };
}

function buildEliteNode(index: number, rng: () => number): SpokeNode {
  const isFort = rng() < 0.5;
  const landmarkType: LandmarkType = isFort ? 'fort' : 'hill';
  const terrain: BattleTerrain = isFort ? 'hills' : 'hills';
  const battleModifiers: BattleTerrainModifier[] = isFort
    ? ['fortified_position', 'high_ground']
    : ['high_ground'];

  return {
    id: `node-${index}`,
    type: 'battle',
    position: index,
    resolved: false,
    reward: null,
    landmarkType,
    name: isFort ? pick(FORT_NAMES, rng) : pick(HILL_NAMES, rng),
    encounterType: 'elite_battle',
    terrain,
    revealed: true,
    scoutedLevel: 1,
    effects: [
      { type: 'morale', delta: 10, label: 'Elite victory' },
      { type: 'iuniores', delta: -100, label: 'Elite victory' },
    ],
    battleModifiers,
    threatHint: 'high',
    enemyStrength: 120,
  };
}

// Pool of mid-node factories (forest/hill/river/ruins/road/village/farm variants)
type MidNodeFactory = (index: number, rng: () => number) => SpokeNode;

function buildForestBattle(index: number, rng: () => number): SpokeNode {
  return {
    id: `node-${index}`,
    type: 'battle',
    position: index,
    resolved: false,
    reward: null,
    landmarkType: 'forest',
    name: pick(FOREST_NAMES, rng),
    encounterType: rng() < 0.5 ? 'ambush' : 'forage',
    terrain: 'forest',
    revealed: true,
    scoutedLevel: 1,
    effects: [{ type: 'supplies', delta: randInt(5, 12, rng), label: 'Forest provisions' }],
    battleModifiers: ['forest_cover', 'dense_trees'],
    threatHint: 'medium',
    enemyStrength: randInt(60, 90, rng),
  };
}

function buildHillBattle(index: number, rng: () => number): SpokeNode {
  return {
    id: `node-${index}`,
    type: 'battle',
    position: index,
    resolved: false,
    reward: null,
    landmarkType: 'hill',
    name: pick(HILL_NAMES, rng),
    encounterType: rng() < 0.5 ? 'battle' : 'scout',
    terrain: 'hills',
    revealed: true,
    scoutedLevel: 1,
    effects: [{ type: 'morale', delta: randInt(4, 8, rng), label: 'Ridge secured' }],
    battleModifiers: ['high_ground'],
    threatHint: 'medium',
    enemyStrength: randInt(50, 80, rng),
  };
}

function buildRiverNode(index: number, rng: () => number): SpokeNode {
  return {
    id: `node-${index}`,
    type: 'battle',
    position: index,
    resolved: false,
    reward: null,
    landmarkType: 'river_crossing',
    name: pick(RIVER_NAMES, rng),
    encounterType: rng() < 0.5 ? 'battle' : 'hazard',
    terrain: 'river',
    revealed: true,
    scoutedLevel: 1,
    effects: [{ type: 'threat', delta: 1, label: 'Treacherous crossing' }],
    battleModifiers: ['river_crossing', 'mud'],
    threatHint: 'medium',
    enemyStrength: randInt(40, 70, rng),
  };
}

function buildRuinsEvent(index: number, rng: () => number): SpokeNode {
  return {
    id: `node-${index}`,
    type: 'event',
    position: index,
    resolved: false,
    reward: null,
    landmarkType: 'ruins',
    name: pick(RUINS_NAMES, rng),
    encounterType: rng() < 0.5 ? 'event' : 'ambush',
    terrain: 'ruins',
    revealed: true,
    scoutedLevel: 1,
    effects: [{ type: 'morale', delta: randInt(-3, 4, rng), label: 'Haunted stones' }],
    battleModifiers: ['narrow_pass'],
    threatHint: 'medium',
  };
}

function buildRoadNode(index: number, _rng: () => number): SpokeNode {
  return {
    id: `node-${index}`,
    type: 'event',
    position: index,
    resolved: false,
    reward: null,
    landmarkType: 'road',
    name: 'Via Militaris',
    encounterType: 'event',
    terrain: 'road',
    revealed: true,
    scoutedLevel: 2,
    effects: [
      { type: 'morale', delta: 3, label: 'Good road lifts spirits' },
      { type: 'supplies', delta: 3, label: 'Resupply post' },
    ],
    battleModifiers: [],
    threatHint: 'low',
  };
}

function buildVillageNode(index: number, rng: () => number): SpokeNode {
  const isRecruit = rng() < 0.5;
  return {
    id: `node-${index}`,
    type: 'event',
    position: index,
    resolved: false,
    reward: null,
    landmarkType: 'village',
    name: pick(VILLAGE_NAMES, rng),
    encounterType: isRecruit ? 'recruit' : 'event',
    terrain: 'farmland',
    revealed: true,
    scoutedLevel: 1,
    effects: isRecruit
      ? [{ type: 'iuniores', delta: randInt(30, 80, rng), label: 'Local recruits join' }]
      : [{ type: 'morale', delta: randInt(2, 6, rng), label: 'Villagers offer hospitality' }],
    battleModifiers: [],
    threatHint: 'low',
  };
}

function buildFarmNode(index: number, rng: () => number): SpokeNode {
  return {
    id: `node-${index}`,
    type: 'event',
    position: index,
    resolved: false,
    reward: null,
    landmarkType: 'farm',
    name: pick(FARM_NAMES, rng),
    encounterType: 'forage',
    terrain: 'farmland',
    revealed: true,
    scoutedLevel: 1,
    effects: [{ type: 'supplies', delta: randInt(8, 14, rng), label: 'Provisions gathered' }],
    battleModifiers: ['open_field'],
    threatHint: 'low',
  };
}

function buildMountainPassNode(index: number, rng: () => number): SpokeNode {
  return {
    id: `node-${index}`,
    type: 'battle',
    position: index,
    resolved: false,
    reward: null,
    landmarkType: 'mountain_pass',
    name: pick(MOUNTAIN_PASS_NAMES, rng),
    encounterType: rng() < 0.5 ? 'battle' : 'hazard',
    terrain: 'mountains',
    revealed: true,
    scoutedLevel: 1,
    effects: [
      { type: 'supplies', delta: -randInt(3, 6, rng), label: 'Cold heights tax the column' },
    ],
    battleModifiers: ['narrow_pass', 'high_ground'],
    threatHint: 'medium',
    enemyStrength: randInt(50, 80, rng),
  };
}

// ── Theme-weighted mid-pool ──
// Each entry is a [factory, weight] tuple. Themes tilt the weights toward
// matching landmarks. `mixed` is the legacy uniform distribution.
type WeightedFactory = [MidNodeFactory, number];

const THEME_FILLER_POOLS: Record<SpokeTheme, WeightedFactory[]> = {
  woodland: [
    [buildForestBattle, 4],
    [buildRuinsEvent,   2],
    [buildVillageNode,  1],
    [buildHillBattle,   1],
    [buildRoadNode,     1],
  ],
  highlands: [
    [buildHillBattle,        4],
    [buildMountainPassNode,  3],
    [buildRiverNode,         1],
    [buildRuinsEvent,        1],
    [buildRoadNode,          1],
  ],
  marshland: [
    [buildRiverNode,    3],
    [buildRuinsEvent,   3],
    [buildForestBattle, 2],
    [buildVillageNode,  1],
    [buildFarmNode,     1],
  ],
  coastal: [
    [buildRiverNode,    3],
    [buildVillageNode,  3],
    [buildFarmNode,     2],
    [buildRoadNode,     2],
    [buildHillBattle,   1],
  ],
  mixed: [
    [buildForestBattle, 1],
    [buildHillBattle,   1],
    [buildRiverNode,    1],
    [buildRuinsEvent,   1],
    [buildRoadNode,     1],
    [buildVillageNode,  1],
    [buildFarmNode,     1],
  ],
};

function pickWeighted<T>(entries: ReadonlyArray<[T, number]>, rng: () => number): T {
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let roll = rng() * total;
  for (const [item, w] of entries) {
    roll -= w;
    if (roll <= 0) return item;
  }
  return entries[entries.length - 1][0];
}

const THEME_WEIGHTS: ReadonlyArray<[SpokeTheme, number]> = [
  ['woodland',  3],
  ['highlands', 3],
  ['marshland', 2],
  ['coastal',   2],
  ['mixed',     4],
];

// ── Public API ──

export interface LandmarkSpokeOptions {
  duration: number;
  posture: Posture;
  /** Bias for threatHint distribution and boss enemy scaling. Default 0. */
  threatLevel?: number;
  /** Injected RNG for deterministic testing. Defaults to Math.random. */
  rng?: () => number;
  /** S27-08: emit decorative side-routes off mid-chain nodes (0–3, weighted by duration). */
  includeBranch?: boolean;
  /** Optional explicit theme. When omitted, a theme is rolled per the THEME_WEIGHTS table. */
  theme?: SpokeTheme;
}

/**
 * Pure generator that produces a Spoke with full Itinerarium metadata.
 * Total nodes = duration * 3 + 1 + jitter, where jitter ∈ {-1, 0, +1}.
 *
 * Procedural variety pass adds: theme biasing (woodland / highlands /
 * marshland / coastal / mixed), node-count jitter, and 0–3 multi-node
 * branch chains weighted by duration. Two spokes of the same duration
 * never look identical anymore.
 *
 * Invariant checks run after assembly and throw on violation — loud failure
 * catches generator regressions immediately in dev rather than silently
 * shipping a broken spoke.
 */
export function generateLandmarkSpoke(opts: LandmarkSpokeOptions): Spoke {
  const { duration, posture, threatLevel: threat = 0, rng = Math.random } = opts;

  // Mid-chain invariants demand four distinct factory roles (rest, supply,
  // watchtower, morale). duration=1 yields midCount=2, which can't satisfy
  // them — fail loud at the boundary.
  if (duration < 2) {
    throw new Error(
      `generateLandmarkSpoke: duration must be >= 2 (got ${duration}); ` +
      `mid-chain invariants require 4 slots for rest/supply/watchtower/morale.`,
    );
  }

  // ── Theme & jitter ──
  const theme: SpokeTheme = opts.theme ?? pickWeighted(THEME_WEIGHTS, rng);
  const jitter = (Math.floor(rng() * 3) - 1) as -1 | 0 | 1; // {-1, 0, +1}
  const totalNodes = Math.max(6, duration * 3 + 1 + jitter); // floor at 6 (4 mid + start + boss)
  const midCount = totalNodes - 2;

  // ── Required mid-nodes (4 factories, one per invariant) ──
  const factories: Array<(idx: number) => SpokeNode> = [
    idx => buildRestNode(idx, rng),
    idx => buildWatchtowerNode(idx, rng),
    idx => buildSupplyNode(idx, rng),
    idx => buildMoraleNode(idx, rng),
  ];

  // ── Optional adds gated by remaining capacity ──
  // The unknown threshold rises in step with the invariant fix below: a
  // 4-slot mid-chain can't fit an unknown without dropping a required role,
  // so we only inject when there are 5+ slots.
  const desiredUnknowns = midCount >= 6 ? 2 : midCount >= 5 ? 1 : 0;
  for (let u = 0; u < desiredUnknowns && factories.length < midCount; u++) {
    factories.push(idx => buildUnknownNode(idx, rng));
  }

  // Optional elite — ~30% probability, gated by remaining capacity.
  if (factories.length < midCount && rng() < 0.3) {
    factories.push(idx => buildEliteNode(idx, rng));
  }

  // Theme-biased filler from the weighted pool.
  const fillerPool = THEME_FILLER_POOLS[theme];
  while (factories.length < midCount) {
    const factory = pickWeighted(fillerPool, rng);
    factories.push(idx => factory(idx, rng));
  }

  // Hard guard — keeps the length contract honest.
  if (factories.length !== midCount) {
    throw new Error(
      `generateLandmarkSpoke: internal — factories.length (${factories.length}) ` +
      `!== midCount (${midCount}) for duration ${duration}, jitter ${jitter}.`,
    );
  }

  // Shuffle mid-node factories (Fisher-Yates).
  for (let i = factories.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [factories[i], factories[j]] = [factories[j], factories[i]];
  }

  // ── Assemble node list ──
  const nodes: SpokeNode[] = [];
  nodes.push(buildStartCamp(rng));
  for (let i = 0; i < factories.length; i++) {
    nodes.push(factories[i](i + 1));
  }
  nodes.push(buildBossNode(totalNodes - 1, threat, theme, rng));

  // ── Invariant checks (throw loudly on violation) ──
  assertInvariants(nodes);

  // ── Bifurcations (0–3 multi-node chains, theme-biased) ──
  const branches = opts.includeBranch
    ? buildBranches(midCount, duration, theme, rng)
    : undefined;

  return {
    nodes,
    label: pick(SPOKE_LABELS, rng),
    completed: false,
    duration,
    currentSeason: 1,
    posture,
    boundArmy: null,
    boundLegate: null,
    branches,
    theme,
  };
}

// ── Branch assembly ──

/** Pool of factories safe for branch chains — excludes invariant carriers
 *  (rest / watchtower / supply / morale required-roles, boss, start_camp)
 *  so committing a branch never strips a required role from the spoke. */
const BRANCH_POOL_BY_THEME: Record<SpokeTheme, WeightedFactory[]> = {
  // Branches are flavor side-routes; reuse the same theme-tilted fillers.
  woodland:  THEME_FILLER_POOLS.woodland,
  highlands: THEME_FILLER_POOLS.highlands,
  marshland: THEME_FILLER_POOLS.marshland,
  coastal:   THEME_FILLER_POOLS.coastal,
  mixed:     THEME_FILLER_POOLS.mixed,
};

const BRANCH_COUNT_WEIGHTS: Record<2 | 3 | 4, ReadonlyArray<[number, number]>> = {
  2: [[0, 30], [1, 50], [2, 18], [3,  2]],
  3: [[0, 10], [1, 40], [2, 35], [3, 15]],
  4: [[0,  5], [1, 25], [2, 40], [3, 30]],
};

const BRANCH_LENGTH_WEIGHTS: ReadonlyArray<[number, number]> = [
  [1, 60], [2, 30], [3, 10],
];

function buildBranches(
  midCount: number,
  duration: number,
  theme: SpokeTheme,
  rng: () => number,
): SpokeBranch[] {
  const dKey = (Math.min(4, Math.max(2, duration)) as 2 | 3 | 4);
  const count = pickWeighted(BRANCH_COUNT_WEIGHTS[dKey], rng);
  if (count === 0) return [];

  // Mid-chain indices are [1 .. midCount]. Sample without replacement and
  // prefer non-adjacent attachments so branches don't visually overlap.
  const candidates: number[] = [];
  for (let i = 1; i <= midCount; i++) candidates.push(i);
  // Fisher-Yates shuffle to randomize sampling order.
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  const chosen: number[] = [];
  for (const idx of candidates) {
    if (chosen.length >= count) break;
    // Prefer indices at least 2 away from any already-chosen.
    if (chosen.every(c => Math.abs(c - idx) >= 2)) chosen.push(idx);
  }
  // If the spacing constraint left us short, fall back to allowing adjacency.
  for (const idx of candidates) {
    if (chosen.length >= count) break;
    if (!chosen.includes(idx)) chosen.push(idx);
  }
  chosen.sort((a, b) => a - b);

  const pool = BRANCH_POOL_BY_THEME[theme];
  return chosen.map((attachAfter, branchIdx) => {
    const chainLen = pickWeighted(BRANCH_LENGTH_WEIGHTS, rng);
    const chain: SpokeNode[] = [];
    for (let i = 0; i < chainLen; i++) {
      const factory = pickWeighted(pool, rng);
      const node = factory(0, rng);
      chain.push({
        ...node,
        id: `branch-${branchIdx}-${attachAfter}-${i}`,
        position: -1, // reindexed on commitment
      });
    }
    return { attachAfter, nodes: chain };
  });
}

// ── Invariant verification ──

function assertInvariants(nodes: SpokeNode[]): void {
  const mid = nodes.slice(1, nodes.length - 1);

  const hasRest = mid.some(n => n.encounterType === 'rest');
  if (!hasRest) {
    throw new Error('generateLandmarkSpoke: invariant violated — no rest node in mid-chain');
  }

  const hasWatchtower = mid.some(n => n.landmarkType === 'watchtower');
  if (!hasWatchtower) {
    throw new Error('generateLandmarkSpoke: invariant violated — no watchtower node in mid-chain');
  }

  const hasSupply = mid.some(n =>
    n.effects?.some(e => e.type === 'supplies' && e.delta > 0),
  );
  if (!hasSupply) {
    throw new Error('generateLandmarkSpoke: invariant violated — no supply-restoring node in mid-chain');
  }

  const hasMorale = mid.some(n =>
    n.effects?.some(e => e.type === 'morale' && e.delta > 0),
  );
  if (!hasMorale) {
    throw new Error('generateLandmarkSpoke: invariant violated — no morale-raising node in mid-chain');
  }

  // Only enforce ≥1 unknown when the chain has spare capacity beyond the
  // four required roles (rest / watchtower / supply / morale). With exactly
  // 4 mid slots there's no room — see desiredUnknowns gate above.
  if (mid.length >= 5) {
    const unknownCount = mid.filter(n => n.encounterType === 'unknown').length;
    if (unknownCount < 1) {
      throw new Error('generateLandmarkSpoke: invariant violated — no unknown node in mid-chain');
    }
  }

  const start = nodes[0];
  if (start?.landmarkType !== 'start_camp') {
    throw new Error('generateLandmarkSpoke: invariant violated — first node must be start_camp');
  }

  const boss = nodes[nodes.length - 1];
  if (boss?.encounterType !== 'boss') {
    throw new Error('generateLandmarkSpoke: invariant violated — last node must be boss');
  }

  if (boss?.threatHint !== 'deadly') {
    throw new Error('generateLandmarkSpoke: invariant violated — boss node must have threatHint deadly');
  }
}
