import { useEffect, useRef } from 'preact/hooks';
import { Application } from 'pixi.js';
import {
  campaignState,
  hexTiles,
  setCurrent,
  setSelected,
  setTiles,
} from '../campaign/campaign-state';
import { generateCampaignMap } from '../campaign/campaign-map-generator';
import { revealNeighbors, updateReachableTiles } from '../campaign/movement';
import { HexMapView } from './HexMapView';

export function PixiHexMap() {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const app = new Application();
    let initialised = false;
    let cancelled = false;
    let view: HexMapView | null = null;

    void app
      .init({
        resizeTo: host,
        backgroundAlpha: 0,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      })
      .then(() => {
        initialised = true;
        if (cancelled) {
          app.destroy(true);
          return;
        }
        host.appendChild(app.canvas);

        // Bootstrap the campaign signals if this is the first mount.
        // Mirror moveToTile: reveal the origin's neighbors first so the
        // reachable-calc has discovered tiles to consider — without this,
        // the legion is locked on the starting hex and the fog never lifts.
        if (hexTiles.value.length === 0) {
          const generated = generateCampaignMap(6);
          const origin = generated.find(
            (tile) => tile.id === campaignState.value.currentTileId,
          );
          const revealed = origin ? revealNeighbors(generated, origin) : generated;
          const seeded = updateReachableTiles(
            revealed,
            campaignState.value.currentTileId,
            campaignState.value.movementPoints,
          );
          setTiles(seeded);
        }

        view = new HexMapView({
          app,
          tiles: hexTiles.value,
          state: { ...campaignState.value },
          onTileSelected: (tile) => setSelected(tile.id),
          onPlayerMoved: (tile) => setCurrent(tile.id),
          onTilesChanged: (tiles) => setTiles(tiles),
        });

        app.stage.addChild(view.root);
      });

    return () => {
      cancelled = true;
      view?.destroy();
      view = null;
      if (initialised) app.destroy(true);
    };
  }, []);

  return (
    <div
      ref={hostRef}
      style={{ position: 'absolute', inset: 0, background: '#070509' }}
    />
  );
}
