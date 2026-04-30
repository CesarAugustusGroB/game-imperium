// S30-11: Preact shell for the Bellum hex campaign map. Hosts the Pixi
// canvas and arranges three HUD layers around it (top stats bar, left
// selected-hex info card, bottom legion strip). All data flows through
// the campaignState + hexTiles signals from src/game/campaign/campaign-state.
//
// The legacy spoke HUD components (SpokeTopBar, LandmarkDetailsPanel,
// ArmyCampaignPanel) are coupled to currentSpoke.value — a different
// data shape — so we build slimmed equivalents here that match the
// existing visual idiom (ornate-stat-chip, gold-bordered cards, design
// tokens) without dragging in spoke state.

import { useEffect, useState } from 'preact/hooks';
import { campaignState, hexTiles } from '../../game/campaign/campaign-state';
import { globalSeason, MAX_SEASONS, threatLevel } from '../../game/core/game-state';
import type { EventType, HexTile, TerrainType } from '../../game/campaign/campaign-types';
import { getTerrainColor } from '../../game/campaign/terrain';
import { getEventColor, getEventIcon } from '../../game/campaign/events';
import { PixiHexMap } from '../../game/pixi/PixiHexMap';
import { colorToCss } from '../../utils/color';

if (typeof document !== 'undefined' && !document.getElementById('campaign-hex-screen-styles')) {
  const el = document.createElement('style');
  el.id = 'campaign-hex-screen-styles';
  el.textContent = `
    .chs-root {
      position: relative;
      flex: 1;
      min-width: 0;
      min-height: 0;
      overflow: hidden;
    }
    .chs-top-bar {
      position: absolute;
      top: 12px;
      left: 0;
      right: 0;
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      justify-content: center;
      padding: 0 16px;
      z-index: 10;
      pointer-events: none; /* Allow drag-pan through the bar's empty space */
    }
    .chs-top-bar > * { pointer-events: auto; } /* Re-enable on chip children */

    /* The left panel is a real info card — keep it interactive so the user
       can read and potentially click tile info in future. This means drag-pan
       is blocked in the panel area, which is acceptable. */
    .chs-left-panel {
      position: absolute;
      top: 70px;
      left: 16px;
      width: min(320px, 32vw);
      z-index: 10;
      background: rgba(14, 12, 28, 0.92);
      border: 1px solid rgba(180, 160, 100, 0.32);
      border-radius: var(--radius-md);
      padding: 14px 16px;
      box-sizing: border-box;
      color: var(--imp-text);
      font-family: var(--imp-font-body);
      backdrop-filter: blur(2px);
      pointer-events: auto; /* Panel IS interactive — intentionally blocks map drag here */
    }
    .chs-left-panel::before {
      content: '';
      display: block;
      position: absolute;
      inset: 4px;
      border: 1px solid rgba(180, 160, 100, 0.12);
      border-radius: calc(var(--radius-md) - 2px);
      pointer-events: none;
    }
    .chs-panel-eyebrow {
      font-family: var(--font-display);
      font-size: var(--font-size-xs);
      letter-spacing: 2px;
      text-transform: uppercase;
      color: var(--color-gold-dim);
      margin: 0 0 4px 0;
    }
    .chs-panel-title {
      font-family: var(--font-display);
      font-size: var(--font-size-lg);
      color: var(--color-gold-primary);
      margin: 0 0 10px 0;
    }
    .chs-panel-row {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      padding: 4px 0;
      font-size: var(--font-size-sm);
    }
    .chs-panel-row + .chs-panel-row {
      border-top: 1px solid rgba(180, 160, 100, 0.14);
    }
    .chs-panel-key {
      color: var(--color-text-muted, var(--color-text-secondary));
    }
    .chs-panel-value {
      color: var(--color-text-secondary);
      font-weight: 600;
    }

    /* Bottom strip outer container: pointer-events none so the player can
       drag-pan the map across the lower edge. The strip has no interactive
       controls today, so this is safe. Inner content (banner + stack) gets
       auto so text remains selectable if needed. */
    .chs-bottom-strip-outer {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 10;
      pointer-events: none; /* Allow drag-pan under the strip's full footprint */
    }
    .chs-bottom-strip {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 10px 22px;
      background: linear-gradient(180deg,
        rgba(22, 16, 10, 0.92) 0%,
        rgba(38, 26, 14, 0.95) 100%);
      border-top: 1px solid rgba(212, 168, 67, 0.45);
      color: var(--color-text-secondary);
      font-family: var(--imp-font-body);
      pointer-events: auto; /* Re-enable on inner content (banner + stack) */
    }
    .chs-bottom-banner {
      width: 44px;
      height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid rgba(212, 168, 67, 0.55);
      border-radius: var(--radius-sm);
      background: rgba(122, 36, 50, 0.55);
      color: var(--color-gold-primary);
      font-family: var(--font-display);
      font-size: 18px;
    }
    .chs-bottom-stack {
      display: flex;
      flex-direction: column;
      gap: 2px;
      flex: 1;
      min-width: 0;
    }
    .chs-bottom-line {
      display: flex;
      gap: 14px;
      flex-wrap: wrap;
      font-size: var(--font-size-sm);
    }
    .chs-bottom-line strong {
      color: var(--color-gold-secondary);
    }
    /* Visually hidden — readable by screen-readers and aria-live regions */
    .chs-visually-hidden {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
    }
  `;
  document.head.appendChild(el);
}

const TERRAIN_LABEL: Record<TerrainType, string> = {
  plains: 'Plains',
  forest: 'Forest',
  hills: 'Hills',
  mountains: 'Mountains',
  river: 'River',
  road: 'Roman Road',
  camp: 'Encampment',
  ruins: 'Ruins',
};

const EVENT_LABEL: Record<EventType, string> = {
  none: 'No event',
  battle: 'Enemy Patrol',
  ambush: 'Ambush',
  supply: 'Supplies',
  rest: 'Bivouac',
  merchant: 'Merchant',
  story: 'Marker',
  elite: 'Elite force',
};

function findTile(id: string | null): HexTile | undefined {
  if (!id) return undefined;
  return hexTiles.value.find((t) => t.id === id);
}

// ── Top stats bar ────────────────────────────────────────────────

function CampaignTopBar() {
  const state = campaignState.value;
  return (
    <div class="chs-top-bar" role="region" aria-label="Campaign stats">
      <span class="ornate-stat-chip" title="March points remaining. Terrain spends points; bivouac encounters refresh them until the shared season tick lands.">
        🚩 <strong>{state.movementPoints}</strong>
      </span>
      <span class="ornate-stat-chip" title="Supplies remaining">
        📦 <strong>{state.supplies}</strong>
      </span>
      <span class="ornate-stat-chip" title="Legion morale">
        🔥 <strong>{state.morale}</strong>
      </span>
      <span class="ornate-stat-chip" title={`Season ${globalSeason.value} of ${MAX_SEASONS}. Doom threat ${threatLevel.value}.`}>
        🌿 <strong>{globalSeason.value}/{MAX_SEASONS}</strong>
      </span>
    </div>
  );
}

// ── Left selected-hex info ───────────────────────────────────────

function CampaignHexInfoPanel() {
  const state = campaignState.value;
  const tile = findTile(state.selectedTileId) ?? findTile(state.currentTileId);
  if (!tile) return null;

  const isCurrent = tile.id === state.currentTileId;
  const isSelectedNotCurrent = state.selectedTileId !== null && tile.id !== state.currentTileId;

  const eyebrow = !tile.discovered
    ? 'Unscouted'
    : isCurrent
      ? 'Current Position'
      : isSelectedNotCurrent
        ? 'Selected Hex'
        : 'Hex';

  const title = !tile.discovered
    ? 'Beyond the Frontier'
    : TERRAIN_LABEL[tile.terrain];

  const eventStyle = tile.event !== 'none' && tile.discovered
    ? { color: colorToCss(getEventColor(tile.event)) }
    : undefined;

  return (
    <aside class="chs-left-panel">
      <p class="chs-panel-eyebrow">{eyebrow}</p>
      <h2 class="chs-panel-title" style={{ color: colorToCss(getTerrainColor(tile.terrain)) }}>
        {title}
      </h2>
      <div class="chs-panel-row">
        <span class="chs-panel-key">Coordinates</span>
        <span class="chs-panel-value">{tile.q}, {tile.r}</span>
      </div>
      {tile.discovered && (
        <>
          <div class="chs-panel-row">
            <span class="chs-panel-key">Movement Cost</span>
            <span class="chs-panel-value">
              {tile.movementCost >= 999 ? 'Impassable' : tile.movementCost}
            </span>
          </div>
          <div class="chs-panel-row">
            <span class="chs-panel-key">Status</span>
            <span class="chs-panel-value">
              {tile.visited ? 'Visited' : tile.reachable ? 'Reachable' : 'Out of range'}
            </span>
          </div>
          <div class="chs-panel-row">
            <span class="chs-panel-key">Event</span>
            <span class="chs-panel-value" style={eventStyle}>
              {tile.event !== 'none' && (
                <span style={{ marginRight: '6px' }}>{getEventIcon(tile.event)}</span>
              )}
              {EVENT_LABEL[tile.event]}
            </span>
          </div>
        </>
      )}
    </aside>
  );
}

// ── Bottom legion strip ──────────────────────────────────────────

function CampaignArmyStrip() {
  const state = campaignState.value;
  const current = findTile(state.currentTileId);
  const tilesVisited = hexTiles.value.filter((t) => t.visited).length;
  const tilesDiscovered = hexTiles.value.filter((t) => t.discovered).length;

  return (
    // 3c: outer container is pointer-events:none so drag-pan works across the
    // lower edge. Inner .chs-bottom-strip re-enables pointer-events for content.
    <div class="chs-bottom-strip-outer">
      <div class="chs-bottom-strip" role="region" aria-label="Legion status">
        <div class="chs-bottom-banner" title="Legio">SPQR</div>
        <div class="chs-bottom-stack">
          <div class="chs-bottom-line">
            <span>
              Position <strong>{state.currentTileId}</strong>
              {current && (
                <span style={{ color: 'var(--color-text-muted, var(--color-text-secondary))' }}>
                  {' '}· {TERRAIN_LABEL[current.terrain]}
                </span>
              )}
            </span>
          </div>
          <div class="chs-bottom-line">
            <span>Discovered <strong>{tilesDiscovered}</strong></span>
            <span>Visited <strong>{tilesVisited}</strong></span>
            <span>March pts <strong>{state.movementPoints}</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── A11y live region for legion position ─────────────────────────

// 3d: Announces current tile id and terrain whenever the legion moves.
// Uses useEffect + useState watching campaignState.value.currentTileId via
// signal subscription (components re-render when signals change).
function LegionPositionAnnouncer() {
  const state = campaignState.value;
  const currentTileId = state.currentTileId;
  const current = findTile(currentTileId);

  // We only want to announce on *changes*, so track the last announced value.
  const [announced, setAnnounced] = useState('');

  useEffect(() => {
    const terrain = current ? TERRAIN_LABEL[current.terrain] : 'Unknown';
    const coords = current ? `${current.q},${current.r}` : currentTileId;
    const msg = `Legion at hex ${coords} — ${terrain}`;
    if (msg !== announced) {
      setAnnounced(msg);
    }
  }, [currentTileId]);

  return (
    <div
      class="chs-visually-hidden"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {announced}
    </div>
  );
}

// ── Screen ────────────────────────────────────────────────────────

export function CampaignHexScreen() {
  return (
    <div class="chs-root">
      <PixiHexMap />
      <CampaignTopBar />
      <CampaignHexInfoPanel />
      <CampaignArmyStrip />
      {/* 3d: visually hidden aria-live region announces legion position changes */}
      <LegionPositionAnnouncer />
    </div>
  );
}
