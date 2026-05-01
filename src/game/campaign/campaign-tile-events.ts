import type { ResourceCost } from '../../types';
import type { Faction } from '../core/commander';
import type { EventChoice, EventEffect, EventRequirement } from '../events/event-types';
import { buildEventContext, meetsRequirements } from '../events/event-engine';
import type { SpokeEffect } from '../progression/spoke-effects';
import type { BattleTerrainModifier } from '../progression/battle-terrain-modifiers';
import { selectedCommander, threatLevel } from '../core/game-state';
import type { EventType, HexTile } from './campaign-types';

export type CampaignTileEventType = Exclude<EventType, 'none' | 'battle' | 'elite' | 'ambush' | 'boss'>;
export type TransformableEventType = CampaignTileEventType | 'none';

export type CampaignMapEffect =
  | { type: 'reveal'; radius: number; toLevel?: 1 | 2; label: string }
  | { type: 'transform-nearby-event'; radius: number; event: TransformableEventType; label: string }
  | { type: 'add-battle-modifier-nearby'; radius: number; modifierId: BattleTerrainModifier; label: string };

export interface CampaignTileChoice extends EventChoice {
  effects: EventEffect[];
  requiresResource?: ResourceCost;
  bellumEffects?: SpokeEffect[];
  mapEffects?: CampaignMapEffect[];
  refreshesMovement?: boolean;
  message?: string;
}

export interface CampaignTileEvent {
  id: string;
  title: string;
  description: string;
  color: Faction | 'neutral';
  tier: 1 | 2 | 3;
  tileTypes: readonly CampaignTileEventType[];
  requirements?: EventRequirement;
  choices: CampaignTileChoice[];
}

export function isCampaignTileEventType(event: EventType): event is CampaignTileEventType {
  return event !== 'none' && event !== 'battle' && event !== 'elite' && event !== 'ambush' && event !== 'boss';
}

function mapChoice(
  text: string,
  options: Omit<CampaignTileChoice, 'text' | 'effects'> & { effects?: EventEffect[] } = {},
): CampaignTileChoice {
  return { text, effects: options.effects ?? [], ...options };
}

export const CAMPAIGN_TILE_EVENTS: CampaignTileEvent[] = [
  {
    id: 'supply-hidden-granary',
    title: 'Hidden Granary',
    description: 'The column finds a sealed storehouse beneath a collapsed villa. The grain is dry, but the locals still watch the road.',
    color: 'neutral',
    tier: 1,
    tileTypes: ['supply'],
    choices: [
      mapChoice('Load the wagons', {
        bellumEffects: [{ type: 'supplies', delta: 12, label: 'Hidden granary' }],
        message: 'The wagons leave heavier than they arrived.',
      }),
      mapChoice('Share with the villages', {
        effects: [{ resource: 'influence', amount: 2 }],
        bellumEffects: [{ type: 'supplies', delta: 6, label: 'Shared stores' }],
        mapEffects: [{ type: 'reveal', radius: 1, toLevel: 1, label: 'Villagers point out safer paths' }],
        consequence: 'shared_hidden_granary',
        message: 'Gratitude buys better directions than coin.',
      }),
    ],
  },
  {
    id: 'supply-broken-convoy',
    title: 'Broken Convoy',
    description: 'A shattered supply train lies beside the road. Some crates are intact, and some tracks are fresh.',
    color: 'red',
    tier: 1,
    tileTypes: ['supply'],
    choices: [
      mapChoice('Recover what remains', {
        bellumEffects: [
          { type: 'supplies', delta: 8, label: 'Recovered convoy stores' },
          { type: 'morale', delta: -1, label: 'Signs of slaughter' },
        ],
        mapEffects: [{ type: 'add-battle-modifier-nearby', radius: 2, modifierId: 'mud', label: 'Broken axles churn the road' }],
        message: 'The men salvage grain from bloodied carts.',
      }),
      mapChoice('Track the raiders', {
        effects: [{ resource: 'momentum', amount: 2 }],
        mapEffects: [{ type: 'transform-nearby-event', radius: 2, event: 'hazard', label: 'Raider trail turns dangerous' }],
        message: 'The trail points toward rough country.',
      }),
    ],
  },
  {
    id: 'rest-eagle-bivouac',
    title: 'Eagle Bivouac',
    description: 'An old marching camp still has a dry ditch, a broken palisade, and enough order to make soldiers breathe easier.',
    color: 'white',
    tier: 1,
    tileTypes: ['rest'],
    choices: [
      mapChoice('Make proper camp', {
        bellumEffects: [{ type: 'morale', delta: 18, label: 'Proper bivouac' }],
        refreshesMovement: true,
        message: 'Discipline returns around the watchfires.',
      }),
      mapChoice('Send patrols before dawn', {
        bellumEffects: [{ type: 'morale', delta: 8, label: 'Short rest' }],
        mapEffects: [{ type: 'reveal', radius: 2, toLevel: 1, label: 'Dawn patrols' }],
        refreshesMovement: true,
        message: 'The legion rests lightly and wakes with better maps.',
      }),
    ],
  },
  {
    id: 'rest-sacred-spring',
    title: 'Sacred Spring',
    description: 'Clear water gathers below a shrine of worn stone. The officers call it a good place to stop; the priests call it a sign.',
    color: 'gold',
    tier: 1,
    tileTypes: ['rest'],
    choices: [
      mapChoice('Rest the wounded', {
        bellumEffects: [{ type: 'morale', delta: 14, label: 'Sacred spring' }],
        refreshesMovement: true,
        message: 'Cool water and clean bandages steady the ranks.',
      }),
      mapChoice('Hold a rite', {
        effects: [{ resource: 'faith', amount: 2 }],
        bellumEffects: [{ type: 'morale', delta: 6, label: 'Rite at the spring' }],
        mapEffects: [{ type: 'add-battle-modifier-nearby', radius: 2, modifierId: 'sacred_ground', label: 'Consecrated ground' }],
        refreshesMovement: true,
        message: 'The rite leaves the men quiet, watchful, and certain.',
      }),
    ],
  },
  {
    id: 'merchant-frontier-trader',
    title: 'Frontier Trader',
    description: 'A trader with mule bells and a Senate permit offers grain, rumors, and prices that change with every sentence.',
    color: 'purple',
    tier: 1,
    tileTypes: ['merchant'],
    choices: [
      mapChoice('Buy grain for 4 gold', {
        requiresResource: { gold: 4 },
        effects: [{ resource: 'gold', amount: -4 }],
        bellumEffects: [{ type: 'supplies', delta: 10, label: 'Bought grain' }],
        message: 'The merchant sells grain at a smile and a profit.',
      }),
      mapChoice('Buy road gossip for 2 gold', {
        requiresResource: { gold: 2 },
        effects: [{ resource: 'gold', amount: -2 }, { resource: 'influence', amount: 1 }],
        mapEffects: [{ type: 'reveal', radius: 2, toLevel: 1, label: 'Bought road gossip' }],
        message: 'His gossip is expensive, but accurate enough.',
      }),
      mapChoice('Move on', { message: 'The trader counts coins as the legion passes.' }),
    ],
  },
  {
    id: 'merchant-black-market',
    title: 'Black Market Camp',
    description: 'Smugglers have raised a canvas market in a dry ravine. Their goods are useful, their loyalties less so.',
    color: 'purple',
    tier: 2,
    tileTypes: ['merchant'],
    requirements: { minThreat: 3 },
    choices: [
      mapChoice('Hire guides for 3 gold', {
        requiresResource: { gold: 3 },
        effects: [{ resource: 'gold', amount: -3 }],
        mapEffects: [{ type: 'transform-nearby-event', radius: 2, event: 'scout', label: 'Guides mark a vantage route' }],
        message: 'The smugglers mark a route no taxman knows.',
      }),
      mapChoice('Seize contraband', {
        requiresResource: { influence: 1 },
        effects: [{ resource: 'gold', amount: 3 }, { resource: 'influence', amount: -1 }],
        mapEffects: [{ type: 'transform-nearby-event', radius: 2, event: 'hazard', label: 'Smugglers poison the road' }],
        consequence: 'angered_black_market',
        message: 'The goods are yours. So is their resentment.',
      }),
    ],
  },
  {
    id: 'story-old-marker',
    title: 'Old Roman Marker',
    description: 'A milestone leans beside the road. Beneath the moss, a warning names a pass that swallowed a legion.',
    color: 'blue',
    tier: 1,
    tileTypes: ['story'],
    choices: [
      mapChoice('Study the inscription', {
        effects: [{ resource: 'influence', amount: 1 }],
        mapEffects: [{ type: 'reveal', radius: 2, toLevel: 2, label: 'Ancient route marks' }],
        consequence: 'read_old_marker',
        message: 'The old road still remembers where it goes.',
      }),
      mapChoice('Mark it for the rear guard', {
        bellumEffects: [{ type: 'morale', delta: 2, label: 'Orderly march' }],
        mapEffects: [{ type: 'add-battle-modifier-nearby', radius: 2, modifierId: 'narrow_pass', label: 'Marked pass' }],
        message: 'The rear guard keeps the warning in mind.',
      }),
    ],
  },
  {
    id: 'story-refugee-column',
    title: 'Refugee Column',
    description: 'Families move under bundles and smoke-stained blankets. They know who burned their village, and which road the enemy took.',
    color: 'white',
    tier: 1,
    tileTypes: ['story'],
    choices: [
      mapChoice('Escort them to safety', {
        effects: [{ resource: 'influence', amount: 2 }, { resource: 'gold', amount: -2 }],
        requiresResource: { gold: 2 },
        mapEffects: [{ type: 'transform-nearby-event', radius: 2, event: 'recruit', label: 'Protected families send volunteers' }],
        consequence: 'escorted_refugees',
        message: 'Protection today becomes loyalty tomorrow.',
      }),
      mapChoice('Ask about the enemy road', {
        effects: [{ resource: 'momentum', amount: 1 }],
        mapEffects: [{ type: 'reveal', radius: 2, toLevel: 1, label: 'Refugee testimony' }],
        message: 'Fear makes witnesses precise.',
      }),
      mapChoice('Keep marching', { message: 'The column vanishes behind the dust.' }),
    ],
  },
  {
    id: 'scout-vantage-ridge',
    title: 'Vantage Ridge',
    description: 'A steep ridge overlooks the river bends and mule tracks ahead. A few hours here could save days later.',
    color: 'blue',
    tier: 1,
    tileTypes: ['scout'],
    choices: [
      mapChoice('Send outriders', {
        bellumEffects: [{ type: 'morale', delta: 1, label: 'Eyes on the road' }],
        mapEffects: [{ type: 'reveal', radius: 3, toLevel: 1, label: 'Outrider survey' }],
        message: 'Outriders return with dust on their cloaks and clarity in their reports.',
      }),
      mapChoice('Draw a full route map', {
        effects: [{ resource: 'influence', amount: -1 }, { resource: 'momentum', amount: 2 }],
        requiresResource: { influence: 1 },
        mapEffects: [{ type: 'reveal', radius: 2, toLevel: 2, label: 'Full route map' }],
        message: 'A proper map costs favors, but pays in speed.',
      }),
    ],
  },
  {
    id: 'scout-captured-charts',
    title: 'Captured Charts',
    description: 'A courier drops a waxed map tube before disappearing into the brush. The charts show enemy pickets in a nervous hand.',
    color: 'red',
    tier: 1,
    tileTypes: ['scout'],
    choices: [
      mapChoice('Decode the pickets', {
        mapEffects: [
          { type: 'reveal', radius: 2, toLevel: 1, label: 'Captured charts' },
          { type: 'add-battle-modifier-nearby', radius: 3, modifierId: 'high_ground', label: 'Picket positions exposed' },
        ],
        message: 'The next battlefield already has arrows on it.',
      }),
      mapChoice('Use the courier route', {
        mapEffects: [{ type: 'transform-nearby-event', radius: 2, event: 'supply', label: 'Courier cache located' }],
        message: 'The courier route leads to a hidden cache.',
      }),
    ],
  },
  {
    id: 'recruit-local-volunteers',
    title: 'Local Volunteers',
    description: 'Young locals gather with hunting spears and borrowed shields. They ask for standards, pay, and a reason to believe Rome will stay.',
    color: 'red',
    tier: 1,
    tileTypes: ['recruit'],
    choices: [
      mapChoice('Accept their oaths', {
        bellumEffects: [
          { type: 'iuniores', delta: 300, label: 'Local volunteers' },
          { type: 'morale', delta: 2, label: 'Fresh oaths' },
        ],
        consequence: 'accepted_local_volunteers',
        message: 'The standards gain new hands.',
      }),
      mapChoice('Send them as scouts', {
        bellumEffects: [{ type: 'iuniores', delta: 120, label: 'Chosen volunteers' }],
        mapEffects: [{ type: 'reveal', radius: 2, toLevel: 1, label: 'Local scouts' }],
        message: 'A smaller oath buys better eyes.',
      }),
    ],
  },
  {
    id: 'recruit-deserter-band',
    title: 'Deserter Band',
    description: 'Men in mismatched armor offer service. They know drill, they know fear, and they know how to run.',
    color: 'neutral',
    tier: 2,
    tileTypes: ['recruit'],
    requirements: { minThreat: 3 },
    choices: [
      mapChoice('Take the useful ones', {
        effects: [{ resource: 'gold', amount: -2 }],
        requiresResource: { gold: 2 },
        bellumEffects: [
          { type: 'iuniores', delta: 450, label: 'Screened deserters' },
          { type: 'morale', delta: -1, label: 'Uneasy company' },
        ],
        message: 'The useful men join under watchful centurions.',
      }),
      mapChoice('Drive them away', {
        effects: [{ resource: 'momentum', amount: 1 }],
        mapEffects: [{ type: 'transform-nearby-event', radius: 2, event: 'hazard', label: 'Deserters raid the road' }],
        message: 'They scatter. Some will remember the insult.',
      }),
    ],
  },
  {
    id: 'hazard-treacherous-ground',
    title: 'Treacherous Ground',
    description: 'Cracked stones and hidden sinkholes break the marching rhythm. Every mule seems to find a worse path than the last.',
    color: 'red',
    tier: 1,
    tileTypes: ['hazard'],
    choices: [
      mapChoice('Press through', {
        bellumEffects: [
          { type: 'morale', delta: -5, label: 'Treacherous ground' },
          { type: 'supplies', delta: -3, label: 'Lost mules' },
        ],
        mapEffects: [{ type: 'add-battle-modifier-nearby', radius: 2, modifierId: 'mud', label: 'Churned approach' }],
        message: 'The road takes its price in curses and broken straps.',
      }),
      mapChoice('Clear the worst of it', {
        effects: [{ resource: 'momentum', amount: -1 }],
        requiresResource: { momentum: 1 },
        mapEffects: [
          { type: 'transform-nearby-event', radius: 1, event: 'none', label: 'Cleared hazard' },
          { type: 'reveal', radius: 1, toLevel: 1, label: 'Surveyed detour' },
        ],
        message: 'Slow work leaves a safer road behind.',
      }),
    ],
  },
  {
    id: 'hazard-flooded-crossing',
    title: 'Flooded Crossing',
    description: 'The river has eaten its banks. The ford is still there, somewhere beneath brown water and floating branches.',
    color: 'blue',
    tier: 1,
    tileTypes: ['hazard'],
    choices: [
      mapChoice('Force the crossing', {
        bellumEffects: [
          { type: 'supplies', delta: -4, label: 'Spoiled packs' },
          { type: 'morale', delta: -3, label: 'Cold crossing' },
        ],
        mapEffects: [{ type: 'add-battle-modifier-nearby', radius: 2, modifierId: 'river_crossing', label: 'Flooded approaches' }],
        message: 'The river yields, but not kindly.',
      }),
      mapChoice('Search upstream', {
        mapEffects: [
          { type: 'reveal', radius: 2, toLevel: 1, label: 'Upstream search' },
          { type: 'transform-nearby-event', radius: 2, event: 'scout', label: 'Found overlook' },
        ],
        message: 'The search finds higher ground and a cleaner view.',
      }),
    ],
  },
];

function getColorWeight(eventColor: Faction | 'neutral', commanderFaction: Faction): number {
  if (eventColor === 'neutral') return 2;
  if (eventColor === commanderFaction) return 5;
  if (commanderFaction === 'white') return 3;
  return 1;
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function weightedDeterministicPick<T>(items: { item: T; weight: number }[], seed: string): T | null {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  if (total <= 0) return null;

  let roll = hashString(seed) % total;
  for (const { item, weight } of items) {
    if (roll < weight) return item;
    roll -= weight;
  }
  return items[items.length - 1]?.item ?? null;
}

export function getCampaignTileEventById(eventId: string | null): CampaignTileEvent | null {
  if (!eventId) return null;
  return CAMPAIGN_TILE_EVENTS.find((event) => event.id === eventId) ?? null;
}

export function pickCampaignTileEvent(tile: HexTile, preferredEventId: string | null = null): CampaignTileEvent | null {
  if (!isCampaignTileEventType(tile.event)) return null;

  const preferred = getCampaignTileEventById(preferredEventId);
  if (preferred && preferred.tileTypes.includes(tile.event)) return preferred;

  const commander = selectedCommander.value;
  if (!commander) return null;

  const context = buildEventContext(commander.faction);
  const eligible = CAMPAIGN_TILE_EVENTS.filter((event) =>
    event.tileTypes.includes(tile.event as CampaignTileEventType) &&
    meetsRequirements(event.requirements, context),
  );
  if (eligible.length === 0) return null;

  const weighted = eligible.map((event) => ({
    item: event,
    weight: getColorWeight(event.color, commander.faction),
  }));
  return weightedDeterministicPick(weighted, `${tile.id}:${tile.event}:${threatLevel.value}:${commander.id}`);
}
