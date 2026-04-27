import type { Posture } from '../council/advisor';
import type { Spoke, SpokeNode } from './spoke';
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

function buildBossNode(index: number, threatLevel: number, rng: () => number): SpokeNode {
  const isCity = rng() < 0.5;
  const landmarkType: LandmarkType = isCity ? 'city' : 'fort';
  const terrain: BattleTerrain = isCity ? 'city' : 'hills';
  const battleModifiers: BattleTerrainModifier[] = isCity
    ? ['urban_fighting']
    : ['fortified_position', 'high_ground'];
  const name = isCity ? pick(CITY_NAMES, rng) : pick(FORT_NAMES, rng);
  // Enemy strength scales with threat bias; base 150 + up to 100 from threat
  const enemyStrength = 150 + Math.floor(threatLevel * 10);

  return {
    id: `node-${index}`,
    type: 'boss',
    position: index,
    resolved: false,
    reward: null,
    landmarkType,
    name,
    terrain,
    encounterType: 'boss',
    revealed: true,
    scoutedLevel: 1,
    effects: [],
    battleModifiers,
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
    // Forest forage
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
      revealed: true,
      scoutedLevel: 1,
      effects: [{ type: 'supplies', delta: randInt(10, 18, rng), label: 'Hunt and forage' }],
      battleModifiers: ['forest_cover'],
      threatHint: 'low',
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

const MID_POOL: MidNodeFactory[] = [
  buildForestBattle,
  buildHillBattle,
  buildRiverNode,
  buildRuinsEvent,
  buildRoadNode,
  buildVillageNode,
  buildFarmNode,
];

// ── Public API ──

export interface LandmarkSpokeOptions {
  duration: number;
  posture: Posture;
  /** Bias for threatHint distribution and boss enemy scaling. Default 0. */
  threatLevel?: number;
  /** Injected RNG for deterministic testing. Defaults to Math.random. */
  rng?: () => number;
  /** S27-08: emit one decorative side-route off a mid-chain node. */
  includeBranch?: boolean;
}

/**
 * Pure generator that produces a Spoke with full Itinerarium metadata.
 * Total nodes = duration * 3 + 1 (matches legacy generateSpokeFromCouncil).
 *
 * Invariant checks run after assembly and throw on violation — loud failure
 * catches generator regressions immediately in dev rather than silently
 * shipping a broken spoke.
 */
export function generateLandmarkSpoke(opts: LandmarkSpokeOptions): Spoke {
  const { duration, posture, threatLevel: threat = 0, rng = Math.random } = opts;

  // Mid-chain invariants demand four distinct factory roles (rest, supply,
  // watchtower, morale). duration=1 yields midCount=2, which can't satisfy
  // them — fail loud at the boundary instead of silently overflowing midCount
  // and producing a spoke whose length and boss.position don't match the
  // documented `duration * 3 + 1` contract.
  if (duration < 2) {
    throw new Error(
      `generateLandmarkSpoke: duration must be >= 2 (got ${duration}); ` +
      `mid-chain invariants require 4 slots for rest/supply/watchtower/morale.`,
    );
  }

  const totalNodes = duration * 3 + 1;
  const midCount = totalNodes - 2; // excludes start (0) and boss (last)

  // ── Required mid-nodes (4 factories, one per invariant) ──
  const factories: Array<(idx: number) => SpokeNode> = [
    idx => buildRestNode(idx, rng),
    idx => buildWatchtowerNode(idx, rng),
    idx => buildSupplyNode(idx, rng),
    idx => buildMoraleNode(idx, rng),
  ];

  // ── Optional adds gated by remaining capacity ──
  // Every push from here on checks `factories.length < midCount` before adding
  // so we can never overflow midCount and de-sync boss.position from its
  // array index. Priority order: unknowns → elite → filler.
  const desiredUnknowns = midCount >= 6 ? 2 : midCount >= 3 ? 1 : 0;
  for (let u = 0; u < desiredUnknowns && factories.length < midCount; u++) {
    factories.push(idx => buildUnknownNode(idx, rng));
  }

  // Optional elite — ~30% probability, but only when there's still a slot.
  // At duration=2 the four required + one unknown already fill midCount=5,
  // so elite is suppressed to preserve the length contract.
  if (factories.length < midCount && rng() < 0.3) {
    factories.push(idx => buildEliteNode(idx, rng));
  }

  // Filler from the pool until we hit midCount exactly.
  while (factories.length < midCount) {
    const factory = pick(MID_POOL, rng);
    factories.push(idx => factory(idx, rng));
  }

  // Hard guard — would only fire if a future edit pushed past `midCount`
  // outside the gated paths above. Keeps the public length contract honest.
  if (factories.length !== midCount) {
    throw new Error(
      `generateLandmarkSpoke: internal — factories.length (${factories.length}) ` +
      `!== midCount (${midCount}) for duration ${duration}.`,
    );
  }

  // Shuffle mid-node factories (Fisher-Yates) so required nodes aren't always in same order
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
  nodes.push(buildBossNode(totalNodes - 1, threat, rng));

  // ── Invariant checks (throw loudly on violation) ──
  assertInvariants(nodes);

  // ── Optional decorative bifurcation (S27-08) ──
  // Attaches one side-route off a random mid-chain index. Branch nodes
  // are inspectable but never advance progression.
  const branches = opts.includeBranch
    ? buildSingleBranch(midCount, rng)
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
  };
}

function buildSingleBranch(midCount: number, rng: () => number): { attachAfter: number; node: SpokeNode }[] {
  // Attach to a random mid-chain index (skip start_camp and boss).
  const attachAfter = 1 + Math.floor(rng() * midCount);
  const node = buildSupplyNode(0, rng);
  return [{
    attachAfter,
    node: { ...node, id: `branch-${attachAfter}`, position: -1 },
  }];
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

  // Only enforce ≥1 unknown when the chain has enough room for it (see unknownCount logic above)
  if (mid.length >= 3) {
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
