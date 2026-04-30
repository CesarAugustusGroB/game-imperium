// S31-01: Pixi Assets bundle for the campaign hex map. Foundation for the
// art-upgrade tasks that follow (S31-06 terrain textures, S31-08 event icons,
// future decoration work). Render code never awaits individual textures —
// PixiHexMap awaits loadHexAssets() once after app.init() and HexTileView
// reads from HEX_ASSETS synchronously thereafter.

import { Assets, type Texture } from 'pixi.js';
import type { EventType, TerrainType } from '../campaign/campaign-types';

export type EventAssetKey = Exclude<EventType, 'none'>;
export type DecorationKey =
  | 'tree-cluster'
  | 'peak'
  | 'ripple'
  | 'milestone'
  | 'ridge'
  | 'tent';

export type HexAssetSet = {
  terrain: Record<TerrainType, Texture>;
  events: Record<EventAssetKey, Texture>;
  decoration: Record<DecorationKey, Texture>;
};

const BUNDLE_NAME = 'hex';

const TERRAIN_KEYS: TerrainType[] = [
  'plains',
  'forest',
  'hills',
  'mountains',
  'river',
  'road',
  'camp',
  'ruins',
];

const EVENT_KEYS: EventAssetKey[] = [
  'battle',
  'supply',
  'ambush',
  'rest',
  'merchant',
  'story',
  'elite',
];

const DECORATION_KEYS: DecorationKey[] = [
  'tree-cluster',
  'peak',
  'ripple',
  'milestone',
  'ridge',
  'tent',
];

function buildBundleManifest(): Record<string, string> {
  const manifest: Record<string, string> = {};
  for (const key of TERRAIN_KEYS) {
    manifest[`terrain-${key}`] = `/asset/campaign/terrain/${key}.png`;
  }
  for (const key of EVENT_KEYS) {
    manifest[`event-${key}`] = `/asset/campaign/events/${key}.png`;
  }
  for (const key of DECORATION_KEYS) {
    manifest[`decoration-${key}`] = `/asset/campaign/decoration/${key}.png`;
  }
  return manifest;
}

let registered = false;
let loaded: HexAssetSet | null = null;
let pending: Promise<HexAssetSet> | null = null;

function registerBundleOnce(): void {
  if (registered) return;
  Assets.addBundle(BUNDLE_NAME, buildBundleManifest());
  registered = true;
}

/**
 * Load every campaign hex texture into the Pixi Assets cache and return a
 * typed accessor object. Idempotent: a second call returns the same resolved
 * value (or the in-flight promise) without re-registering or re-fetching.
 * Pixi's Assets cache also dedupes by URL across re-mounts.
 */
export function loadHexAssets(): Promise<HexAssetSet> {
  if (loaded) return Promise.resolve(loaded);
  if (pending) return pending;

  registerBundleOnce();

  pending = Assets.loadBundle(BUNDLE_NAME)
    .then((bundle: Record<string, Texture>) => {
      const terrain = {} as Record<TerrainType, Texture>;
      for (const key of TERRAIN_KEYS) {
        terrain[key] = bundle[`terrain-${key}`];
      }
      const events = {} as Record<EventAssetKey, Texture>;
      for (const key of EVENT_KEYS) {
        events[key] = bundle[`event-${key}`];
      }
      const decoration = {} as Record<DecorationKey, Texture>;
      for (const key of DECORATION_KEYS) {
        decoration[key] = bundle[`decoration-${key}`];
      }
      loaded = { terrain, events, decoration };
      pending = null;
      return loaded;
    })
    .catch((err) => {
      // Reset the cache so a transient failure (network blip, missing PNG)
      // doesn't permanently break the bundle for the session — the next
      // loadHexAssets() call will retry the bundle load fresh.
      pending = null;
      throw err;
    });

  return pending;
}

/**
 * Synchronous accessor for code paths that run after loadHexAssets() has
 * resolved (i.e. anything inside HexMapView). Throws if the bundle hasn't
 * loaded yet — callers must await loadHexAssets() at PixiJS init time.
 */
export const HEX_ASSETS = {
  get current(): HexAssetSet {
    if (!loaded) {
      throw new Error(
        'HEX_ASSETS accessed before loadHexAssets() resolved. ' +
          'PixiHexMap must await loadHexAssets() between app.init() and HexMapView construction.',
      );
    }
    return loaded;
  },
};
