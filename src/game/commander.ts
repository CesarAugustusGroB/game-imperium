export type Faction = 'gold' | 'red' | 'blue' | 'purple' | 'white';
export type ResourceType = 'gold' | 'faith' | 'influence' | 'momentum';

export interface CommanderAbility {
  name: string;
  description: string;
  type: 'strategic' | 'tactical';
  cost: { resource: ResourceType; amount: number } | null; // null = free
  cooldown?: 'once-per-battle' | 'unlimited';
}

export interface Commander {
  id: string;
  name: string;
  faction: Faction;
  culture: string;
  portrait: string;
  quote: string;
  passive: { name: string; description: string };
  strategicAbility: CommanderAbility;
  tacticalAbility: CommanderAbility;
  startingResources: Record<ResourceType, number>;
}

/** Faction display colors for UI theming. */
export const FACTION_COLORS: Record<Faction, string> = {
  gold: '#d4a843',
  red: '#c24a3a',
  blue: '#4a7cc2',
  purple: '#8a5cc2',
  white: '#c0b8a8',
};

/** Map each faction to its primary resource (earns 2x). White has no primary — universal access instead. */
export const FACTION_PRIMARY_RESOURCE: Record<Faction, ResourceType | null> = {
  gold: 'faith',
  red: 'momentum',
  blue: 'influence',
  purple: 'gold',
  white: null,
};

/** Resource display info. */
export const RESOURCE_INFO: Record<ResourceType, { icon: string; label: string; color: string }> = {
  gold: { icon: '\uD83D\uDCB0', label: 'Gold', color: '#d4a843' },
  faith: { icon: '\u2B50', label: 'Faith', color: '#e8c84a' },
  influence: { icon: '\uD83D\uDC51', label: 'Influence', color: '#4a7cc2' },
  momentum: { icon: '\uD83D\uDD25', label: 'Momentum', color: '#c24a3a' },
};
