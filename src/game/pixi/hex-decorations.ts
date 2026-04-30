// S31-07: per-tile decoration sprites layered on top of the terrain texture.
// Pure helper — given a tile + hex size, returns a positioned Container of
// sprites or null when the terrain has no decoration art. Placement is
// deterministic from (q, r) so the same hex always renders the same details.
//
// S32-10: hills (ridge) and camp (tent) decoration art added to the bundle;
// LAYOUTS now covers all terrains except plains and ruins (intentionally bare).

import { Container, Sprite } from 'pixi.js';
import type { HexTile } from '../campaign/campaign-types';
import { HEX_ASSETS, type DecorationKey } from './hex-assets';

export function drawDecorationsForTile(tile: HexTile, hexSize: number): Container | null {
  const layout = LAYOUTS[tile.terrain];
  if (!layout) return null;

  const rng = makeRng(tile.q, tile.r);
  const container = new Container();
  // Inscribed circle radius for a pointy-top hex of size N is N * sqrt(3)/2.
  // Clamp positioning to ~50% of that so sprites don't graze the polygon edge.
  const safeRadius = hexSize * 0.5;

  const count = layout.minCount + Math.floor(rng() * (layout.maxCount - layout.minCount + 1));
  const decorations = HEX_ASSETS.current.decoration;
  const texture = decorations[layout.key];

  for (let i = 0; i < count; i++) {
    const sprite = new Sprite(texture);
    sprite.anchor.set(0.5);
    const targetSize = hexSize * layout.scale;
    sprite.width = targetSize;
    sprite.height = targetSize;

    if (layout.placement === 'center') {
      sprite.x = 0;
      sprite.y = 0;
    } else if (layout.placement === 'horizontal-band') {
      // River ripples spread along an east-west band.
      sprite.x = (rng() - 0.5) * 2 * safeRadius;
      sprite.y = (rng() - 0.5) * safeRadius * 0.4;
    } else {
      // 'scatter': uniform-ish disk inside safeRadius.
      const angle = rng() * Math.PI * 2;
      const r = Math.sqrt(rng()) * safeRadius;
      sprite.x = Math.cos(angle) * r;
      sprite.y = Math.sin(angle) * r;
    }

    container.addChild(sprite);
  }

  return container;
}

type Layout = {
  key: DecorationKey;
  minCount: number;
  maxCount: number;
  scale: number; // multiplied by hexSize
  placement: 'scatter' | 'center' | 'horizontal-band';
};

const LAYOUTS: Partial<Record<HexTile['terrain'], Layout>> = {
  forest: { key: 'tree-cluster', minCount: 3, maxCount: 5, scale: 0.3, placement: 'scatter' },
  mountains: { key: 'peak', minCount: 1, maxCount: 1, scale: 0.55, placement: 'center' },
  river: { key: 'ripple', minCount: 2, maxCount: 3, scale: 0.32, placement: 'horizontal-band' },
  road: { key: 'milestone', minCount: 1, maxCount: 1, scale: 0.35, placement: 'center' },
  // S32-10: ridge crests scatter across the hex; tent silhouette centered.
  hills: { key: 'ridge', minCount: 2, maxCount: 3, scale: 0.34, placement: 'horizontal-band' },
  camp: { key: 'tent', minCount: 1, maxCount: 1, scale: 0.5, placement: 'center' },
  // plains, ruins: intentionally bare
};

/**
 * Tiny LCG seeded from tile coords. Returns successive 0..1 values.
 * The same (q, r) always produces the same sequence so a tile's decoration
 * layout never shuffles between renders.
 */
function makeRng(q: number, r: number): () => number {
  let state = ((q * 17 + r * 31) >>> 0) || 1;
  return () => {
    // Numerical Recipes LCG constants — good enough for visual jitter.
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}
