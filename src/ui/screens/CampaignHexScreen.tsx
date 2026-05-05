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
import { campaignState, hexTiles, pendingPathConfirmation, bypassPathConfirmation, resolvePendingPath } from '../../game/campaign/campaign-state';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { globalSeason, MAX_SEASONS, selectedCommander } from '../../game/core/game-state';
import type { EventType, HexTile, TerrainType } from '../../game/campaign/campaign-types';
import { getTerrainColor } from '../../game/campaign/terrain';
import { getEventColor, getEventIcon, getEventContent } from '../../game/campaign/events';
import { PixiHexMap } from '../../game/pixi/PixiHexMap';
import { colorToCss } from '../../utils/color';
import { preparedArmy, preparedLegate } from '../../game/progression/strategic-store';
import { gold, momentum, iuniores } from '../../game/core/resources';
import { FACTION_PRIMARY_RESOURCE, RESOURCE_INFO } from '../../game/core/commander';
import { computeBellumMorale } from '../../game/campaign/bellum-army-view';
import { bellumWarningState } from '../../game/campaign/campaign-defeat';
import { CAMPAIGN_BOTTOM_PANEL_HEIGHT } from '../../game/campaign/campaign-layout';
import { SUPPLY_MAX_CARRY } from '../../config/game-config';
import { BellumWarningBanner } from '../components/bellum/BellumWarningBanner';
import { BellumTutorialOverlay } from '../components/bellum/BellumTutorialOverlay';
import { objectiveChipProps } from '../components/bellum/bellum-objective';
import { Tooltip } from '../components/Tooltip';
import { navigateTo } from '../screens';
import { setForumTab, sidebarCollapsed } from './forum/state';
import { tutorialDismissed } from '../../game/core/meta-save';
import { getLegateTraitById } from '../../game/army/legate-traits';
import type { Cohort } from '../../game/army/cohort';
import type { MoraleTier } from '../../game/army/morale';
import type { UnitRole } from '../../battle/battle-types';

if (typeof document !== 'undefined' && !document.getElementById('campaign-hex-screen-styles')) {
  const el = document.createElement('style');
  el.id = 'campaign-hex-screen-styles';
  el.textContent = `
    .chs-root {
      --chs-bottom-strip-height: ${CAMPAIGN_BOTTOM_PANEL_HEIGHT}px;
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
      width: clamp(240px, 24vw, 320px);
      max-height: calc(100% - var(--chs-bottom-strip-height) - 92px);
      overflow-y: auto;
      overflow-x: hidden;
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
      display: grid;
      grid-template-columns: 70px minmax(220px, 0.85fr) minmax(300px, 1.15fr) minmax(260px, 1fr);
      align-items: stretch;
      gap: 14px;
      padding: 10px 18px 12px;
      /* Height reservation lives on the SOLID inner strip, not the transparent
         outer — otherwise the gap between content and outer's min-height shows
         the host background and reads as a dead zone. */
      min-height: var(--chs-bottom-strip-height);
      box-sizing: border-box;
      background: linear-gradient(180deg,
        rgba(14, 12, 24, 0.90) 0%,
        rgba(30, 22, 18, 0.97) 100%);
      border-top: 1px solid rgba(212, 168, 67, 0.45);
      color: var(--color-text-secondary);
      font-family: var(--imp-font-body);
      pointer-events: auto; /* Re-enable on inner content (banner + stack) */
    }
    .chs-bottom-banner {
      min-height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
      border: 1px solid rgba(212, 168, 67, 0.55);
      border-radius: 2px;
      background: rgba(122, 36, 50, 0.55);
      color: var(--color-gold-primary);
      font-family: var(--font-display);
      font-size: 18px;
      letter-spacing: 1px;
      text-align: center;
    }
    .chs-bottom-banner small {
      display: block;
      font-family: var(--imp-font-body);
      font-size: 8px;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      color: var(--imp-text-mid);
    }
    .chs-bottom-stack {
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 7px;
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
    .chs-army-name {
      font-family: var(--imp-font-display);
      font-size: 16px;
      font-weight: 700;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: var(--color-gold-primary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .chs-army-meta,
    .chs-army-position,
    .chs-army-legate {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      font-size: var(--font-size-sm);
      color: var(--imp-text-mid);
    }
    .chs-army-position strong,
    .chs-army-legate strong,
    .chs-army-meta strong {
      color: var(--color-gold-secondary);
    }
    .chs-warning-chip {
      display: inline-flex;
      align-items: center;
      padding: 2px 7px;
      border: 1px solid rgba(194, 74, 58, 0.5);
      border-radius: 2px;
      background: rgba(194, 74, 58, 0.14);
      color: #d48b3a;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 1px;
      text-transform: uppercase;
    }
    .chs-army-section {
      min-width: 0;
      padding-left: 14px;
      border-left: 1px solid rgba(212, 168, 67, 0.18);
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 8px;
    }
    .chs-army-section-title {
      font-family: var(--imp-font-display);
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: var(--imp-gold);
    }
    .chs-vital-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
    }
    .chs-vital {
      min-width: 0;
      padding: 7px 9px;
      border: 1px solid rgba(212, 168, 67, 0.16);
      background: rgba(20, 18, 32, 0.52);
      border-radius: 2px;
    }
    .chs-vital-label {
      font-size: 8px;
      letter-spacing: 1.4px;
      text-transform: uppercase;
      color: var(--imp-text-lo);
      white-space: nowrap;
    }
    .chs-vital-value {
      margin-top: 3px;
      font-family: var(--imp-font-mono);
      font-size: 13px;
      font-weight: 700;
      color: var(--imp-text-hi);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .chs-vital-sub {
      margin-top: 2px;
      font-size: 9px;
      color: var(--imp-text-lo);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .chs-meter {
      height: 4px;
      margin-top: 6px;
      background: rgba(0, 0, 0, 0.35);
      border-radius: 99px;
      overflow: hidden;
    }
    .chs-meter-fill {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: var(--imp-gold);
    }
    .chs-meter-fill--danger { background: var(--imp-danger); }
    .chs-meter-fill--warning { background: #d48b3a; }
    .chs-meter-fill--success { background: var(--imp-verdigris); }
    .chs-modifier-row {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      min-height: 18px;
    }
    .chs-modifier-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 7px;
      border: 1px solid rgba(212, 168, 67, 0.18);
      border-radius: 2px;
      background: rgba(20, 18, 32, 0.45);
      font-size: 9px;
      color: var(--imp-text-mid);
      white-space: nowrap;
    }
    .chs-modifier-chip strong {
      font-family: var(--imp-font-mono);
      color: var(--imp-gold-hi);
    }
    .chs-modifier-chip--bad strong { color: var(--imp-danger); }
    .chs-roster-list {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      min-height: 28px;
      max-height: 64px;
      overflow: hidden;
    }
    .chs-roster-chip {
      display: inline-flex;
      align-items: center;
      max-width: 100%;
      gap: 6px;
      padding: 4px 7px;
      border: 1px solid rgba(212, 168, 67, 0.16);
      background: rgba(20, 18, 32, 0.48);
      border-radius: 2px;
      font-size: 10px;
      color: var(--imp-text);
      min-width: 0;
    }
    .chs-role-dot {
      width: 7px;
      height: 14px;
      flex: 0 0 auto;
    }
    .chs-roster-name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 124px;
    }
    .chs-roster-count,
    .chs-roster-hp {
      font-family: var(--imp-font-mono);
      font-size: 9px;
      color: var(--imp-text-lo);
      flex: 0 0 auto;
    }
    .chs-roster-more {
      color: var(--imp-text-lo);
      font-size: 10px;
      align-self: center;
    }
    @media (max-width: 1120px) {
      .chs-bottom-strip {
        grid-template-columns: 58px minmax(220px, 0.9fr) minmax(280px, 1.1fr);
      }
      .chs-army-section--roster {
        grid-column: 2 / 4;
        padding-left: 0;
        padding-top: 8px;
        border-left: 0;
        border-top: 1px solid rgba(212, 168, 67, 0.18);
      }
      .chs-roster-list {
        max-height: 34px;
      }
    }
    @media (max-width: 760px) {
      .chs-top-bar {
        top: 8px;
        justify-content: flex-start;
        padding: 0 10px;
      }
      .chs-left-panel {
        top: 74px;
        left: 10px;
        right: 10px;
        width: auto;
        max-height: 26vh;
      }
      .chs-bottom-strip {
        grid-template-columns: minmax(0, 1fr);
        gap: 8px;
        padding: 9px 10px;
      }
      .chs-bottom-banner,
      .chs-army-section--roster {
        display: none;
      }
      .chs-army-section {
        padding-left: 0;
        border-left: 0;
      }
      .chs-vital-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
      .chs-army-name {
        font-size: 13px;
      }
      .chs-modifier-row {
        display: none;
      }
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

    /* S34-05: Starvation pulse — fires only when army.supplies === 0 */
    .chs-resource-chip--starving,
    .ornate-stat-chip.chs-resource-chip--starving {
      color: rgba(220, 100, 90, 1);
    }
    @keyframes chs-supply-pulse {
      0%, 100% {
        color: rgba(220, 100, 90, 1);
        text-shadow: 0 0 4px rgba(220, 100, 90, 0.4);
      }
      50% {
        color: rgba(255, 150, 140, 1);
        text-shadow: 0 0 10px rgba(255, 100, 90, 0.85);
      }
    }
    @media (prefers-reduced-motion: no-preference) {
      .chs-resource-chip--starving,
      .ornate-stat-chip.chs-resource-chip--starving {
        animation: chs-supply-pulse 1.4s ease-in-out infinite;
      }
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

const ROLE_COLORS: Record<UnitRole, string> = {
  vanguard: '#b23a3a',
  reserve: '#d4a843',
  guard: '#5a7aa0',
};

const ROLE_LABELS: Record<UnitRole, string> = {
  vanguard: 'Vanguard',
  reserve: 'Reserve',
  guard: 'Guard',
};

const MORALE_TIER_COLOR: Record<MoraleTier, string> = {
  broken: 'var(--imp-danger)',
  shaken: '#d48b3a',
  steady: 'var(--imp-text)',
  resolute: 'var(--imp-gold)',
  inspired: 'var(--imp-gold-hi)',
};

type CohortGroup = {
  id: string;
  name: string;
  role: UnitRole;
  count: number;
  currentHp: number;
  maxHp: number;
};

function findTile(id: string | null): HexTile | undefined {
  if (!id) return undefined;
  return hexTiles.value.find((t) => t.id === id);
}

function getCohortCurrentHp(cohort: Cohort): number {
  return cohort.currentHp ?? (cohort.outOfAction ? 1 : cohort.stats.hp);
}

function getCohortGroups(cohorts: readonly Cohort[]): CohortGroup[] {
  const groups = new Map<string, CohortGroup>();
  for (const cohort of cohorts) {
    const currentHp = getCohortCurrentHp(cohort);
    const maxHp = cohort.stats.hp;
    const existing = groups.get(cohort.id);
    if (existing) {
      existing.count += 1;
      existing.currentHp += currentHp;
      existing.maxHp += maxHp;
    } else {
      groups.set(cohort.id, {
        id: cohort.id,
        name: cohort.name,
        role: cohort.role,
        count: 1,
        currentHp,
        maxHp,
      });
    }
  }
  return Array.from(groups.values()).sort((a, b) => {
    const roleOrder = a.role.localeCompare(b.role);
    return roleOrder !== 0 ? roleOrder : a.name.localeCompare(b.name);
  });
}

function percent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value * 100)));
}

function formatSigned(value: number): string {
  return `${value >= 0 ? '+' : ''}${value}`;
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
  function openArmyForum() {
    setForumTab('exercitus');
    sidebarCollapsed.value = false;
    navigateTo('forum');
  }

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
          onClick={openArmyForum}
        >
          Open Exercitus
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
  const season = globalSeason.value;
  const obj = objectiveChipProps(season, MAX_SEASONS);
  const tiles = hexTiles.value;
  const tilesVisited = tiles.filter((t) => t.visited).length;
  const tilesDiscovered = tiles.filter((t) => t.discovered).length;
  const seenProgress = tilesDiscovered > 0 ? `${tilesVisited}/${tilesDiscovered}` : '--';
  const mapProgress = tiles.length > 0 ? `${tilesDiscovered}/${tiles.length}` : '--';

  return (
    <div class="chs-top-bar" role="region" aria-label="Campaign stats">
      <CampaignResourceChips />
      <Tooltip
        placement="bottom"
        content="Hexes you can reach in one click. Resets each turn or when the pathfinding budget refreshes."
      >
        <span class="ornate-stat-chip">
          Move <strong>{state.movementPoints}</strong>
        </span>
      </Tooltip>
      <Tooltip
        placement="bottom"
        content="Visited hexes out of currently discovered hexes."
      >
        <span class="ornate-stat-chip">
          Seen <strong>{seenProgress}</strong>
        </span>
      </Tooltip>
      <Tooltip
        placement="bottom"
        content="Discovered hexes out of the campaign map."
      >
        <span class="ornate-stat-chip">
          Map <strong>{mapProgress}</strong>
        </span>
      </Tooltip>
      <Tooltip
        placement="bottom"
        content={`Survive to Season ${MAX_SEASONS} to trigger the Final Invasion battle.`}
      >
        <span class="ornate-stat-chip">
          Season <strong>{season}/{MAX_SEASONS}</strong>
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

  const morale = computeBellumMorale();
  const hasWarning = warnings.starvationWarning || warnings.moraleCritical;
  const legate = preparedLegate.value;

  if (!army) {
    return (
      <div class="chs-bottom-strip-outer">
        <div class="chs-bottom-strip" role="region" aria-label="Legion army details">
          <div class="chs-bottom-banner" title="Legio">
            <span>SPQR</span>
            <small>Legio</small>
          </div>
          <div class="chs-bottom-stack">
            <div class="chs-army-name">No legion prepared</div>
            <div class="chs-army-position">Embark from the Forum before marching.</div>
          </div>
        </div>
      </div>
    );
  }

  const cohorts = army.cohorts;
  const cohortCount = cohorts.length;
  const groups = getCohortGroups(cohorts);
  const visibleGroups = groups.slice(0, 5);
  const hiddenGroups = Math.max(0, groups.length - visibleGroups.length);
  const currentHpTotal = cohorts.reduce((sum, cohort) => sum + getCohortCurrentHp(cohort), 0);
  const maxHpTotal = cohorts.reduce((sum, cohort) => sum + cohort.stats.hp, 0);
  const woundedCount = cohorts.filter((cohort) =>
    getCohortCurrentHp(cohort) < cohort.stats.hp || cohort.outOfAction === true,
  ).length;
  const outOfActionCount = cohorts.filter((cohort) => cohort.outOfAction === true).length;
  const hpRatio = maxHpTotal > 0 ? currentHpTotal / maxHpTotal : 0;
  const supplyRatio = SUPPLY_MAX_CARRY > 0 ? army.supplies / SUPPLY_MAX_CARRY : 0;
  const supplyCoverage = cohortCount > 0 ? Math.floor(army.supplies / cohortCount) : 0;
  const supplyFillClass = army.supplies <= 0
    ? 'chs-meter-fill chs-meter-fill--danger'
    : supplyRatio < 0.25
      ? 'chs-meter-fill chs-meter-fill--warning'
      : 'chs-meter-fill chs-meter-fill--success';
  const hpFillClass = woundedCount > 0 ? 'chs-meter-fill chs-meter-fill--warning' : 'chs-meter-fill chs-meter-fill--success';
  const moraleFillClass = morale.tier === 'broken'
    ? 'chs-meter-fill chs-meter-fill--danger'
    : morale.tier === 'shaken'
      ? 'chs-meter-fill chs-meter-fill--warning'
      : 'chs-meter-fill';
  const moraleRatio = morale.total / 150;
  const moraleModifiers = [...morale.modifiers]
    .filter((modifier) => modifier.delta !== 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  const visibleModifiers = moraleModifiers.slice(0, 2);
  const hiddenModifiers = Math.max(0, moraleModifiers.length - visibleModifiers.length);
  const legateTraits = legate
    ? legate.traitIds
      .map((id) => getLegateTraitById(id)?.name)
      .filter((name): name is string => Boolean(name))
    : [];
  const woundedLabel = outOfActionCount > 0
    ? `${woundedCount} wounded / ${outOfActionCount} OOA`
    : woundedCount > 0
      ? `${woundedCount} wounded`
      : 'Ready';

  return (
    <div class="chs-bottom-strip-outer">
      <div class="chs-bottom-strip" role="region" aria-label="Legion army details">
        <div class="chs-bottom-banner" title="Legio">
          <span>SPQR</span>
          <small>Legio</small>
        </div>

        <div class="chs-bottom-stack">
          <div class="chs-army-meta">
            <span>{army.owner}</span>
            <span><strong>{cohortCount}</strong> cohorts</span>
            {hasWarning && <span class="chs-warning-chip">Warning</span>}
          </div>
          <div class="chs-army-name">{army.name}</div>
          <div class="chs-army-position">
            <span>Position <strong>{state.currentTileId}</strong></span>
            {current && <span>{TERRAIN_LABEL[current.terrain]}</span>}
          </div>
          <div class="chs-army-legate">
            <span>Legate</span>
            <strong>{legate ? legate.name : 'Unassigned'}</strong>
            {legateTraits.length > 0 && <span>{legateTraits.slice(0, 2).join(' / ')}</span>}
          </div>
        </div>

        <div class="chs-army-section">
          <div class="chs-army-section-title">Army Condition</div>
          <div class="chs-vital-grid">
            <div class="chs-vital">
              <div class="chs-vital-label">Supply</div>
              <div class={`chs-vital-value${army.supplies === 0 ? ' chs-resource-chip--starving' : ''}`}>
                {army.supplies}/{SUPPLY_MAX_CARRY}
              </div>
              <div class="chs-vital-sub">{cohortCount > 0 ? `${supplyCoverage} moves covered` : 'No cohorts'}</div>
              <div class="chs-meter">
                <span class={supplyFillClass} style={{ width: `${percent(supplyRatio)}%` }} />
              </div>
            </div>
            <div class="chs-vital">
              <div class="chs-vital-label">Morale</div>
              <div class="chs-vital-value" style={{ color: MORALE_TIER_COLOR[morale.tier] }}>
                {morale.total}
              </div>
              <div class="chs-vital-sub">{morale.tier}</div>
              <div class="chs-meter">
                <span class={moraleFillClass} style={{ width: `${percent(moraleRatio)}%` }} />
              </div>
            </div>
            <div class="chs-vital">
              <div class="chs-vital-label">Roster HP</div>
              <div class="chs-vital-value">
                {currentHpTotal}/{maxHpTotal}
              </div>
              <div class="chs-vital-sub">{woundedLabel}</div>
              <div class="chs-meter">
                <span class={hpFillClass} style={{ width: `${percent(hpRatio)}%` }} />
              </div>
            </div>
          </div>
          <div class="chs-modifier-row">
            {visibleModifiers.length === 0 ? (
              <span class="chs-modifier-chip">Steady baseline</span>
            ) : (
              visibleModifiers.map((modifier) => (
                <span
                  key={`${modifier.source}-${modifier.label}`}
                  class={`chs-modifier-chip${modifier.delta < 0 ? ' chs-modifier-chip--bad' : ''}`}
                  title={modifier.label}
                >
                  <strong>{formatSigned(modifier.delta)}</strong>
                  {modifier.label}
                </span>
              ))
            )}
            {hiddenModifiers > 0 && (
              <span class="chs-modifier-chip">+{hiddenModifiers} more</span>
            )}
          </div>
        </div>

        <div class="chs-army-section chs-army-section--roster">
          <div class="chs-army-section-title">Cohort Composition</div>
          <div class="chs-roster-list">
            {visibleGroups.length === 0 ? (
              <span class="chs-roster-more">No cohorts prepared.</span>
            ) : (
              visibleGroups.map((group) => (
                <span
                  key={group.id}
                  class="chs-roster-chip"
                  title={`${ROLE_LABELS[group.role]}: ${group.name}`}
                >
                  <span class="chs-role-dot" style={{ background: ROLE_COLORS[group.role] }} />
                  <span class="chs-roster-name">{group.name}</span>
                  <span class="chs-roster-count">x{group.count}</span>
                  <span class="chs-roster-hp">{group.currentHp}/{group.maxHp}</span>
                </span>
              ))
            )}
            {hiddenGroups > 0 && <span class="chs-roster-more">+{hiddenGroups} types</span>}
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

// ── S34-04: Path event confirmation dialog ────────────────────────────────────

// Reads the pendingPathConfirmation signal and renders a ConfirmDialog when
// HexMapView sets it during a multi-hop walk that crosses an event tile.
// Mounted only in the active-run branch (both commander and army present).
function PathEventConfirmDialog() {
  const pending = pendingPathConfirmation.value;
  if (!pending) return null;

  const eventTile = pending.eventTile;
  const eventTitle = getEventContent(eventTile)?.title ?? 'Encounter';
  const coords = `${eventTile.q}, ${eventTile.r}`;

  return (
    <ConfirmDialog
      open={true}
      title="Event in your path"
      body={
        <span>
          The legion will stop at{' '}
          <strong style={{ color: 'var(--imp-gold)' }}>{eventTitle}</strong>
          {' '}(hex {coords}). Continue marching?
        </span>
      }
      confirmLabel="March"
      cancelLabel="Hold"
      dontAskAgainLabel="Don't ask again this campaign"
      onConfirm={(dontAskAgain) => {
        if (dontAskAgain) bypassPathConfirmation.value = true;
        resolvePendingPath(true);
      }}
      onCancel={() => resolvePendingPath(false)}
    />
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
      {/* S34-03: first-run tutorial overlay — gated on map bootstrap so it
          doesn't flash over an empty viewport on a fresh run. */}
      {!tutorialDismissed.value && hexTiles.value.length > 0 && <BellumTutorialOverlay />}
      {/* S34-04: multi-hop path confirmation — only active during a run */}
      <PathEventConfirmDialog />
    </div>
  );
}
