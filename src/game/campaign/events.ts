// S30-06: pure event-rules module — text glyph icon, color, and modal content.
// Icons stay text glyphs in S30 (sprite swap deferred to S31 polish sprint).
// getEventContent is consumed by S30-10's encounter-modal bridge.

import type { EventType, HexTile } from './campaign-types';

/**
 * S31-08: public asset URL for the event icon, or null for 'none'. HTML
 * callers (e.g. CampaignEventModal banner) use this for an `<img>` source so
 * the same placeholder/painterly art that ships in the HEX_ASSETS Pixi bundle
 * is reused outside the canvas without a second registry.
 */
// These four types ship without PNG assets in this PR. The modal renders a
// text-glyph fallback when iconUrl is null, so we return null rather than
// produce a broken <img> tag (CampaignEventModal has no onError handler).
const EVENTS_WITHOUT_PNG: ReadonlySet<EventType> = new Set([
  'scout',
  'recruit',
  'hazard',
  'boss',
]);

export function getEventIconUrl(event: EventType): string | null {
  if (event === 'none') return null;
  if (EVENTS_WITHOUT_PNG.has(event)) return null;
  return `/asset/campaign/events/${event}.png`;
}

export function getEventIcon(event: EventType): string {
  switch (event) {
    case 'battle':
      return '⚔';
    case 'supply':
      return '▣';
    case 'ambush':
      return '☠';
    case 'rest':
      return '⛺';
    case 'merchant':
      return '◆';
    case 'story':
      return '✉';
    case 'elite':
      return '♛';
    case 'scout':
      return '👁';
    case 'recruit':
      return '🛡';
    case 'hazard':
      return '⚠';
    case 'boss':
      return '🦅';
    default:
      return '';
  }
}

export function getEventColor(event: EventType): number {
  switch (event) {
    case 'battle':
      return 0xc7503a;
    case 'supply':
      return 0xd8aa55;
    case 'ambush':
      return 0xb03030;
    case 'rest':
      return 0x55c783;
    case 'merchant':
      return 0xb48cff;
    case 'story':
      return 0xe0d2a0;
    case 'elite':
      return 0xffcc55;
    case 'scout':
      return 0x6cb1e0;
    case 'recruit':
      return 0x88b06a;
    case 'hazard':
      return 0xc77a3a;
    case 'boss':
      return 0xc24a3a;
    default:
      return 0xffffff;
  }
}

export type EventContent = {
  title: string;
  description: string;
  actions: string[];
};

export function getEventContent(tile: HexTile): EventContent | null {
  switch (tile.event) {
    case 'battle':
      return {
        title: 'Enemy Patrol',
        description: 'A hostile force blocks the road ahead.',
        actions: ['Fight', 'Retreat'],
      };

    case 'supply':
      return {
        title: 'Abandoned Granary',
        description: 'Your scouts discover preserved supplies.',
        actions: ['Take Supplies'],
      };

    case 'ambush':
      return {
        title: 'Forest Ambush',
        description: 'Arrows strike from the trees before the legion can form ranks.',
        actions: ['Hold Formation', 'Counterattack'],
      };

    case 'rest':
      return {
        title: 'Eagle Bivouac',
        description: 'A defensible camp gives the army a chance to recover before the march continues. Surgeons can tend the wounded if iuniores are spent on the rolls.',
        actions: ['Make Camp', 'Tend the Wounded'],
      };

    case 'story':
      return {
        title: 'Old Roman Marker',
        description: 'A forgotten milestone bears a warning carved in broken Latin.',
        actions: ['Inspect'],
      };

    case 'merchant':
      return {
        title: 'Travelling Merchant',
        description: 'A trader offers supplies, maps, and suspiciously expensive advice.',
        actions: ['Trade', 'Ignore'],
      };

    case 'elite':
      return {
        title: 'Elite Enemy Force',
        description: 'Veteran enemies occupy a strong position.',
        actions: ['Engage', 'Avoid'],
      };

    case 'scout':
      return {
        title: 'Vantage Hill',
        description: 'A ridge offers a clear line of sight over the marching paths beyond.',
        actions: ['Send Outriders'],
      };

    case 'recruit':
      return {
        title: 'Local Volunteers',
        description: 'A village offers its young men to the eagles in exchange for protection.',
        actions: ['Hire', 'Decline'],
      };

    case 'hazard':
      return {
        title: 'Treacherous Ground',
        description: 'Cracked stones and unstable footing slow the column to a crawl.',
        actions: ['Press On'],
      };

    case 'boss':
      return {
        title: 'Final Invasion',
        description: 'A great enemy host has reached the frontier. The road will be decided here.',
        actions: ['Engage'],
      };

    default:
      return null;
  }
}
