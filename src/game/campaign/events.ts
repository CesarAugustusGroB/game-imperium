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
export function getEventIconUrl(event: EventType): string | null {
  if (event === 'none') return null;
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
        description: 'A defensible camp gives the army a chance to recover before the march continues.',
        actions: ['Make Camp'],
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

    default:
      return null;
  }
}
