// S30-11: Preact shell for the Bellum hex campaign map. Hosts the Pixi
// canvas and arranges three HUD layers around it (top stats bar, left
// selected-hex info card, bottom legion strip). All data flows through
// the campaignState + hexTiles signals from src/game/campaign/campaign-state.
//
// S33-05: CampaignTopBar and CampaignArmyStrip now read supplies/morale from
// `preparedArmy.value` + `computeBellumMorale()` instead of `campaignState`.
//
// S33-10: Added BellumWarningBanner, empty-state guard, objective chip, and
// rich tooltips on top-bar chips.

import { useEffect, useState } from 'preact/hooks';
import { campaignState, hexTiles } from '../../game/campaign/campaign-state';
import { globalSeason, MAX_SEASONS, selectedCommander } from '../../game/core/game-state';
import type { EventType, HexTile, TerrainType } from '../../game/campaign/campaign-types';
import { getTerrainColor } from '../../game/campaign/terrain';
import { getEventColor, getEventIcon, getEventContent } from '../../game/campaign/events';
import { PixiHexMap } from '../../game/pixi/PixiHexMap';
import { colorToCss } from '../../utils/color';
import { preparedArmy } from '../../game/progression/strategic-store';
import { gold, momentum, iuniores } from '../../game/core/resources';
import { FACTION_PRIMARY_RESOURCE, RESOURCE_INFO } from '../../game/core/commander';
import { computeBellumMorale } from '../../game/campaign/bellum-army-view';
import { bellumWarningState } from '../../game/campaign/campaign-defeat';
import { SUPPLY_MAX_CARRY } from '../../config/game-config';
import { BellumWarningBanner } from '../components/bellum/BellumWarningBanner';
import { objectiveChipProps } from '../components/bellum/bellum-objective';
import { Tooltip } from '../components/Tooltip';
import { navigateTo, navigateToBellum } from '../screens';

if (typeof document !== 'undefined' && !document.getElementById('campaign-hex-screen-styles')) {
  const el = document.createElement('style');
  el.id = 'campaign-hex-screen-styles';
  el.textContent = `
    .chs-root {
      --chs-bottom-strip-height: 72px;
      position: relative;
      flex: 1;
      min-width: 0;
      min-height: 0;
      overflow: hidden;
    }
    .chs-map-host {
      /* Fill the whole root — the bottom strip overlays the bottom 72px
         with a 92-95% opaque gradient, hiding any canvas area below the
         hex grid's overflow. */
      position: absolute;
      inset: 0;
      background: #070509;
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
    .chs-resource-chip {
      min-width: 58px;
      justify-content: center;
    }
    .chs-resource-chip strong {
      color: inherit;
    }

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
      /* Height reservation lives on the SOLID inner strip, not the transparent
         outer — otherwise the gap between content and outer's min-height shows
         the host background and reads as a dead zone. */
      min-height: var(--chs-bottom-strip-height);
      box-sizing: border-box;
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
    /* Empty-state */
    .chs-empty-state {
      position: absolute; inset: 0;
      display: flex; align-items: center; justify-content: center;
      padding: 24px;
      background: linear-gradient(180deg, rgba(14, 12, 28, 0.95) 0%, rgba(22, 16, 10, 0.95) 100%);
    }
    .chs-empty-card {
      max-width: 480px; width: 100%;
      padding: 32px;
      background: rgba(22, 16, 10, 0.85);
      border: 1px solid rgba(212, 168, 67, 0.45);
      border-radius: var(--radius-md);
      text-align: center;
    }
    .chs-empty-body {
      font-family: var(--imp-font-body);
      font-size: var(--font-size-sm);
      color: var(--color-text-secondary);
      line-height: 1.5;
      margin: 8px 0 20px;
    }
    .chs-empty-cta {
      display: inline-block;
      padding: 10px 20px;
      background: rgba(212, 168, 67, 0.2);
      border: 1px solid rgba(212, 168, 67, 0.6);
      border-radius: var(--radius-sm);
      color: var(--color-gold-primary);
      font-family: var(--imp-font-display);
      font-size: var(--font-size-sm);
      letter-spacing: 1.5px;
      text-transform: uppercase;
      cursor: pointer;
      transition: background 150ms;
    }
    .chs-empty-cta:hover { background: rgba(212, 168, 67, 0.3); }
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

function eventLabel(event: EventType): string {
  if (event === 'none') return 'No event';
  // Synthesize a tile shape just enough for getEventContent's switch.
  return getEventContent({ event } as HexTile)?.title ?? 'Encounter';
}

// Faith and Influence are intentionally omitted from the campaign HUD —
// they're not earned or spent on the hex map; surfacing them adds noise.
const RESOURCE_ORDER = ['gold', 'momentum', 'iuniores'] as const;

const RESOURCE_VALUES: Record<typeof RESOURCE_ORDER[number], () => number> = {
  gold: () => gold.value,
  momentum: () => momentum.value,
  iuniores: () => iuniores.value,
};

function findTile(id: string | null): HexTile | undefined {
  if (!id) return undefined;
  return hexTiles.value.find((t) => t.id === id);
}

// ── Empty state ───────────────────────────────────────────────────────────────

function BellumEmptyStateNoCommander() {
  return (
    <div class="chs-empty-state" role="region" aria-label="No legion prepared">
      <div class="chs-empty-card">
        <p class="chs-panel-eyebrow">Bellum</p>
        <h2 class="chs-panel-title">No legion prepared</h2>
        <p class="chs-empty-body">
          Select a commander to begin a campaign. The legion's roster, supplies, and
          morale must be set before you march into the frontier.
        </p>
        <button
          class="chs-empty-cta"
          onClick={() => navigateTo('commander-select')}
        >
          Select Commander
        </button>
      </div>
    </div>
  );
}

function BellumEmptyStateNoArmy() {
  return (
    <div class="chs-empty-state" role="region" aria-label="Embark the legion">
      <div class="chs-empty-card">
        <p class="chs-panel-eyebrow">Bellum</p>
        <h2 class="chs-panel-title">Embark the legion</h2>
        <p class="chs-empty-body">
          A commander has been chosen, but the legion still needs cohorts and a legate
          before the campaign begins. Embark from the Forum.
        </p>
        <button
          class="chs-empty-cta"
          onClick={() => navigateToBellum()}
        >
          Open Forum
        </button>
      </div>
    </div>
  );
}

// ── Top stats bar ─────────────────────────────────────────────────────────────

function CampaignResourceChips() {
  const commander = selectedCommander.value;
  const primary = commander ? FACTION_PRIMARY_RESOURCE[commander.faction] : null;

  return (
    <>
      {RESOURCE_ORDER.map((type) => {
        const info = RESOURCE_INFO[type];
        const value = RESOURCE_VALUES[type]();
        const isPrimary = primary === type;

        return (
          <span
            key={type}
            class="ornate-stat-chip chs-resource-chip"
            title={`${info.label}: ${value}${isPrimary ? '\nPrimary resource: gains are doubled.' : ''}`}
            style={{
              color: isPrimary ? info.color : 'var(--color-text-secondary)',
              opacity: isPrimary ? 1 : 0.78,
            }}
          >
            {info.icon} <strong>{value}</strong>
          </span>
        );
      })}
    </>
  );
}

function CampaignTopBar() {
  const state = campaignState.value;
  const army = preparedArmy.value;
  const morale = computeBellumMorale();
  const season = globalSeason.value;
  const obj = objectiveChipProps(season, MAX_SEASONS);

  if (!army) {
    return (
      <div class="chs-top-bar" role="region" aria-label="Campaign stats">
        <CampaignResourceChips />
        <Tooltip
          placement="bottom"
          content="Hexes you can reach in one click. Resets each turn / on pathfinding budget."
        >
          <span class="ornate-stat-chip">
            🚩 <strong>{state.movementPoints}</strong>
          </span>
        </Tooltip>
        <Tooltip placement="bottom" content="No legion prepared">
          <span class="ornate-stat-chip" style={{ opacity: 0.5 }}>
            📦 <strong>—</strong>
          </span>
        </Tooltip>
        <Tooltip placement="bottom" content="No legion prepared">
          <span class="ornate-stat-chip" style={{ opacity: 0.5 }}>
            🔥 <strong>—</strong>
          </span>
        </Tooltip>
        <Tooltip
          placement="bottom"
          content={`Survive to Season ${MAX_SEASONS} to win the campaign.`}
        >
          <span class="ornate-stat-chip">
            🌿 <strong>{season}/{MAX_SEASONS}</strong>
          </span>
        </Tooltip>
        <Tooltip placement="bottom" content={obj.title}>
          <span class="ornate-stat-chip" style={obj.style as any}>
            {obj.icon} <strong>{obj.label}</strong>
          </span>
        </Tooltip>
      </div>
    );
  }

  return (
    <div class="chs-top-bar" role="region" aria-label="Campaign stats">
      <CampaignResourceChips />
      <Tooltip
        placement="bottom"
        content="Hexes you can reach in one click. Resets each turn / on pathfinding budget."
      >
        <span class="ornate-stat-chip">
          🚩 <strong>{state.movementPoints}</strong>
        </span>
      </Tooltip>
      <Tooltip
        placement="bottom"
        content={`How many moves your legion can make before running short.\n\nRoad = 0, plains = 1, river = 2.\n\nAt 0, morale plummets and the legion may starve out.`}
      >
        <span class="ornate-stat-chip">
          📦 <strong>{army.supplies}</strong>
        </span>
      </Tooltip>
      <Tooltip
        placement="bottom"
        content="Below 15 your legion is wavering; at 0 it breaks (defeat). Camp or rest hexes restore it."
      >
        <span class="ornate-stat-chip">
          🔥 <strong>{morale.total}</strong>
        </span>
      </Tooltip>
      <Tooltip
        placement="bottom"
        content={`Survive to Season ${MAX_SEASONS} to win the campaign.`}
      >
        <span class="ornate-stat-chip">
          🌿 <strong>{season}/{MAX_SEASONS}</strong>
        </span>
      </Tooltip>
      <Tooltip placement="bottom" content={obj.title}>
        <span class="ornate-stat-chip" style={obj.style as any}>
          {obj.icon} <strong>{obj.label}</strong>
        </span>
      </Tooltip>
    </div>
  );
}

// ── Left selected-hex info ────────────────────────────────────────────────────

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
              {eventLabel(tile.event)}
            </span>
          </div>
        </>
      )}
    </aside>
  );
}

// ── Bottom legion strip ───────────────────────────────────────────────────────

function CampaignArmyStrip() {
  const state = campaignState.value;
  const army = preparedArmy.value;
  const warnings = bellumWarningState.value;
  const current = findTile(state.currentTileId);
  const tilesVisited = hexTiles.value.filter((t) => t.visited).length;
  const tilesDiscovered = hexTiles.value.filter((t) => t.discovered).length;

  const morale = computeBellumMorale();
  const hasWarning = warnings.starvationWarning || warnings.moraleCritical;

  const noArmy = !army;

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
            {hasWarning && <span title="Active warning">⚠️</span>}
          </div>
          <div class="chs-bottom-line">
            <span>Discovered <strong>{tilesDiscovered}</strong></span>
            <span>Visited <strong>{tilesVisited}</strong></span>
            <span>March pts <strong>{state.movementPoints}</strong></span>
            {noArmy ? (
              <span style={{ opacity: 0.5 }}>No legion prepared</span>
            ) : (
              <>
                <span>Cohorts <strong>{army.cohorts.length}</strong></span>
                <span>Supplies <strong>{army.supplies}/{SUPPLY_MAX_CARRY}</strong></span>
                <span>Morale <strong>{morale.total}</strong> ({morale.tier})</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── A11y live region for legion position ──────────────────────────────────────

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

// ── Screen ────────────────────────────────────────────────────────────────────

export function CampaignHexScreen() {
  const commander = selectedCommander.value;
  const army = preparedArmy.value;
  if (!commander) {
    return (
      <div class="chs-root">
        <BellumEmptyStateNoCommander />
      </div>
    );
  }
  if (!army) {
    return (
      <div class="chs-root">
        <BellumEmptyStateNoArmy />
      </div>
    );
  }
  return (
    <div class="chs-root">
      <PixiHexMap />
      <CampaignTopBar />
      <CampaignHexInfoPanel />
      <BellumWarningBanner />
      <CampaignArmyStrip />
      {/* 3d: visually hidden aria-live region announces legion position changes */}
      <LegionPositionAnnouncer />
    </div>
  );
}
