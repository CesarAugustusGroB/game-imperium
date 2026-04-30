import { useEffect, useRef } from 'preact/hooks';
import { effect } from '@preact/signals';
import { Application } from 'pixi.js';
import {
  activeEventTileId,
  applyMove,
  campaignState,
  hexTiles,
  setActiveEvent,
  setSelected,
  setTiles,
} from '../campaign/campaign-state';
import { generateCampaignMap } from '../campaign/campaign-map-generator';
import { revealNeighbors, updateReachableTiles } from '../campaign/movement';
import { CampaignEventModal } from '../../ui/components/CampaignEventModal';
import { addNotification } from '../../ui/notifications/notification-store';
import { HexMapView } from './HexMapView';
import { loadHexAssets } from './hex-assets';
import { evaluateBellumDefeat } from '../campaign/campaign-defeat';

export function PixiHexMap() {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const app = new Application();
    let initialised = false;
    let cancelled = false;
    let view: HexMapView | null = null;
    let disposeMirror: (() => void) | null = null;

    void app
      .init({
        resizeTo: host,
        backgroundAlpha: 0,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      })
      .then(() => {
        // Mark init done BEFORE awaiting assets so that an unmount-during-load
        // path still triggers app.destroy(true) via the cleanup below.
        initialised = true;
        if (cancelled) {
          app.destroy(true);
          return null;
        }
        return loadHexAssets();
      })
      .then((assets) => {
        // Either cancelled before assets arrived (null), or the unmount cleanup
        // already destroyed the app — either way, don't mount a view.
        if (cancelled || !assets) return;
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
          onPlayerMoved: (tile) => {
            const move = applyMove(tile);
            if (!move.moved) return move;
            const defeat = evaluateBellumDefeat(campaignState.value, { countZeroSupplyMove: true });
            if (move.starvationTriggered) {
              addNotification({
                kind: 'alert',
                title: 'Out of Supplies',
                message: 'The legion is starving — morale plummets.',
                icon: '⚠️',
              });
            }
            if (defeat.defeated) return move;
            // Fire the encounter modal only when the legion enters a hex
            // with an unresolved event AND no other modal is already open.
            if (tile.event !== 'none' && activeEventTileId.value === null) {
              setActiveEvent(tile.id);
            }
            return move;
          },
          onTilesChanged: (tiles) => setTiles(tiles),
        });

        app.stage.addChild(view.root);

        // Mirror hexTiles signal into the view so external mutations
        // (e.g. consumeEvent after the modal closes) re-render the map.
        // The first run is redundant — view was just initialised with the
        // same tiles — but harmless. Subsequent fires are how the modal
        // close path clears event icons from a tile.
        // The cancelled flag guards against zombie firings after Vite HMR
        // or React-style remounts, where dispose() may not have happened
        // before a stale signal write triggers this body.
        const localView = view;
        const disposeTilesMirror = effect(() => {
          const tiles = hexTiles.value;
          if (cancelled || !localView) return;
          localView.setTiles(tiles);
        });

        // Mirror campaignState signal into the view so external mutations
        // (S31 save/load, supplies/morale decrements) keep HexMapView.state
        // in sync. Without this, moveToTile would read a stale movementPoints
        // from the constructor snapshot and compute wrong reachable sets.
        const disposeStateMirror = effect(() => {
          const state = campaignState.value;
          if (cancelled || !localView) return;
          localView.setState(state);
        });

        disposeMirror = () => {
          disposeTilesMirror();
          disposeStateMirror();
        };
      });

    return () => {
      cancelled = true;
      disposeMirror?.();
      disposeMirror = null;
      view?.destroy();
      view = null;
      if (initialised) app.destroy(true);
    };
  }, []);

  return (
    <>
      <div
        ref={hostRef}
        style={{ position: 'absolute', inset: 0, background: '#070509' }}
      />
      <CampaignEventModal />
    </>
  );
}
