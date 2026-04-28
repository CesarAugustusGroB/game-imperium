/**
 * LandmarkMapNode (S29-05) — compact tile for the SpokeCampaignScreen
 * map. Sibling to the legacy `LandmarkNode` (which keeps driving the
 * row-layout NodeMapScreen). Map-anchored tiles need a smaller footprint,
 * hover-only labels (so dense placements don't collide), and a clear
 * intel-halo language for the fog-of-war system.
 *
 * State matrix:
 *   locked    — out of reach + unresolved → dim, dashed border, no hover tip
 *   reachable — next-step main-chain candidate (not current) → faint accent
 *   current   — player's current node → animated pulse + faction accent
 *   resolved  — already played → muted gold check stamp
 *   hidden    — scoutedLevel 0 (or revealed === false) → ❓ icon, dashed
 *               misty halo, encounter type / numbers all hidden
 *   revealed  — scoutedLevel 1 (partial intel) → thin gold halo, encounter
 *               icon visible, no numeric detail
 *   recon     — scoutedLevel 2 (full recon) → solid gold halo, full icon
 *
 * Selection only — clicking emits `onSelect(node)`. Activation lives on the
 * details panel's action button (S29-07); the map never starts encounters
 * directly.
 */

import { useState } from 'preact/hooks';
import type { SpokeNode } from '../../../game/progression/spoke';
import type { LandmarkType, EncounterType } from '../../../game/progression/landmark-types';

if (typeof document !== 'undefined' && !document.getElementById('landmark-map-node-styles')) {
  const el = document.createElement('style');
  el.id = 'landmark-map-node-styles';
  el.textContent = `
    @keyframes lmn-pulse {
      0%, 100% { box-shadow: 0 0 10px var(--lmn-glow), 0 0 20px var(--lmn-glow); }
      50%      { box-shadow: 0 0 18px var(--lmn-glow), 0 0 36px var(--lmn-glow); }
    }
    @keyframes lmn-check-pop {
      0%   { transform: scale(0) rotate(-30deg); opacity: 0; }
      60%  { transform: scale(1.25) rotate(0deg); opacity: 1; }
      100% { transform: scale(1) rotate(0deg); opacity: 1; }
    }

    .lmn {
      position: relative;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      cursor: pointer;
      outline: none;
      transition: filter var(--duration-fast) var(--ease-default),
                  transform var(--duration-fast) var(--ease-default);
    }
    .lmn:hover { filter: brightness(1.18); transform: translateY(-2px); }
    .lmn-locked { filter: brightness(0.5) saturate(0.35); cursor: default; }
    .lmn-locked:hover { transform: none; filter: brightness(0.5) saturate(0.35); }
    .lmn-resolved { opacity: 0.65; }

    /* Intel halos — outer ring around the tile. */
    .lmn-halo {
      position: absolute;
      inset: -6px;
      border-radius: 16px;
      pointer-events: none;
      transition: opacity var(--duration-fast) var(--ease-default);
    }
    .lmn-halo-hidden  { border: 1px dashed rgba(180, 160, 100, 0.3); opacity: 0.85; }
    .lmn-halo-partial { border: 1px solid rgba(212, 168, 67, 0.45); }
    .lmn-halo-recon   { border: 1.5px solid rgba(212, 168, 67, 0.85); box-shadow: 0 0 8px rgba(212, 168, 67, 0.25); }

    .lmn-icon { line-height: 1; }

    .lmn-badge {
      position: absolute;
      top: -5px;
      right: -5px;
      min-width: 18px;
      height: 18px;
      padding: 0 4px;
      border-radius: 9px;
      background: var(--color-bg-primary);
      border: 1px solid var(--color-border-default);
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.5px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .lmn-tooltip {
      position: absolute;
      bottom: calc(100% + 8px);
      left: 50%;
      transform: translateX(-50%);
      background: rgba(14, 12, 28, 0.95);
      border: 1px solid rgba(180, 160, 100, 0.45);
      border-radius: var(--radius-sm);
      padding: 6px 10px;
      white-space: nowrap;
      font-family: var(--font-display);
      font-size: var(--font-size-xs);
      letter-spacing: 1.5px;
      text-transform: uppercase;
      pointer-events: none;
      z-index: 50;
      box-shadow: 0 4px 18px rgba(0, 0, 0, 0.6);
    }
    .lmn-tooltip-sub {
      display: block;
      margin-top: 2px;
      font-family: var(--font-family);
      font-size: 10px;
      letter-spacing: 0.5px;
      text-transform: none;
      color: var(--color-text-muted);
    }
  `;
  document.head.appendChild(el);
}

// Reuse the same color language as the row-layout LandmarkNode so the
// design-system stays coherent. Lightweight inline tables — duplicating
// is cheaper than an awkward shared module since these are pure data.
const TILE_BG: Record<LandmarkType | 'default', string> = {
  start_camp:      'linear-gradient(135deg, rgba(80, 60, 30, 0.75), rgba(50, 38, 22, 0.9))',
  battlefield:     'linear-gradient(135deg, rgba(95, 40, 30, 0.75), rgba(60, 28, 22, 0.9))',
  forest:          'linear-gradient(135deg, rgba(40, 70, 45, 0.75), rgba(28, 50, 32, 0.9))',
  hill:            'linear-gradient(135deg, rgba(110, 85, 50, 0.7), rgba(70, 55, 35, 0.9))',
  village:         'linear-gradient(135deg, rgba(120, 100, 70, 0.7), rgba(80, 65, 45, 0.9))',
  farm:            'linear-gradient(135deg, rgba(140, 130, 70, 0.65), rgba(90, 80, 45, 0.9))',
  city:            'linear-gradient(135deg, rgba(180, 160, 110, 0.7), rgba(110, 95, 65, 0.9))',
  fort:            'linear-gradient(135deg, rgba(90, 90, 100, 0.75), rgba(55, 55, 65, 0.92))',
  camp:            'linear-gradient(135deg, rgba(95, 80, 50, 0.75), rgba(60, 50, 30, 0.9))',
  shrine:          'linear-gradient(135deg, rgba(180, 150, 90, 0.65), rgba(110, 92, 55, 0.9))',
  river_crossing:  'linear-gradient(135deg, rgba(60, 90, 130, 0.7), rgba(40, 60, 90, 0.9))',
  ruins:           'linear-gradient(135deg, rgba(100, 80, 70, 0.7), rgba(60, 48, 42, 0.92))',
  road:            'linear-gradient(135deg, rgba(110, 95, 75, 0.65), rgba(70, 60, 48, 0.9))',
  marsh:           'linear-gradient(135deg, rgba(70, 80, 55, 0.75), rgba(45, 55, 38, 0.92))',
  mountain_pass:   'linear-gradient(135deg, rgba(110, 100, 110, 0.7), rgba(60, 55, 65, 0.92))',
  watchtower:      'linear-gradient(135deg, rgba(80, 90, 110, 0.75), rgba(50, 58, 75, 0.92))',
  supply_depot:    'linear-gradient(135deg, rgba(130, 100, 60, 0.75), rgba(85, 65, 38, 0.9))',
  default:         'linear-gradient(135deg, rgba(60, 55, 80, 0.75), rgba(40, 36, 55, 0.92))',
};

const ENCOUNTER_ICON: Record<EncounterType, string> = {
  battle: '⚔️', elite_battle: '🏹', boss: '💀',
  rest: '🏕', event: '📜', scout: '🔭',
  forage: '🌾', recruit: '🚩', ambush: '🗡',
  merchant: '🪙', siege: '🏰', hazard: '⚠', unknown: '❓',
};

const ENCOUNTER_BADGE: Partial<Record<EncounterType, string>> = {
  battle: 'B', elite_battle: 'E', boss: 'Bo',
  rest: 'R', event: 'Ev', scout: 'Sc', forage: 'Fo',
  recruit: 'Re', ambush: 'Am', siege: 'Si', hazard: 'Hz',
};

const ENCOUNTER_BADGE_COLOR: Partial<Record<EncounterType, string>> = {
  battle: '#c24a3a', elite_battle: '#c24a3a', boss: '#8a4ac2',
  rest: '#4a9a6a', event: '#d4a843', scout: '#60a8d0',
  forage: '#9aa84a', recruit: '#d48b3a', ambush: '#c24a3a',
  siege: '#8a4ac2', hazard: '#c24a3a',
};

const LANDMARK_LABEL: Record<LandmarkType, string> = {
  start_camp: 'Start Camp', battlefield: 'Battlefield', forest: 'Forest',
  hill: 'Hill', village: 'Village', farm: 'Farm', city: 'City',
  fort: 'Fort', camp: 'Camp', shrine: 'Shrine', river_crossing: 'River Crossing',
  ruins: 'Ruins', road: 'Road', marsh: 'Marsh', mountain_pass: 'Mountain Pass',
  watchtower: 'Watchtower', supply_depot: 'Supply Depot',
};

const SIZE_REGULAR = 52;
const SIZE_BOSS = 64;

export type LandmarkMapNodeState =
  | 'locked'
  | 'reachable'
  | 'current'
  | 'resolved'
  | 'hidden'
  | 'revealed'
  | 'recon';

export interface LandmarkMapNodeProps {
  node: SpokeNode;
  isCurrent: boolean;
  isReachable: boolean;
  isSelected: boolean;
  /** Faction accent color from the active commander. */
  accent: string;
  onSelect: (node: SpokeNode) => void;
}

/**
 * Map a node + neighborhood flags to its visual state. Pure helper —
 * exported for unit-test parity (the legacy NodeMapScreen has its own
 * derivation; this is the map-screen variant).
 */
export function deriveNodeState(
  node: SpokeNode,
  isCurrent: boolean,
  isReachable: boolean,
): LandmarkMapNodeState {
  if (node.resolved) return 'resolved';
  if (isCurrent) return 'current';
  if (!isReachable) return 'locked';
  // Reachable + unresolved + not current — let intel level decide whether
  // we surface encounter detail or keep it under fog.
  const intel = node.scoutedLevel ?? (node.revealed === false ? 0 : 2);
  if (intel <= 0) return 'hidden';
  if (intel === 1) return 'revealed';
  return 'recon';
}

export function LandmarkMapNode({
  node,
  isCurrent,
  isReachable,
  isSelected,
  accent,
  onSelect,
}: LandmarkMapNodeProps) {
  const [hovered, setHovered] = useState(false);
  const state = deriveNodeState(node, isCurrent, isReachable);

  const enc = node.encounterType;
  const isBoss = enc === 'boss' || node.type === 'boss';
  const size = isBoss ? SIZE_BOSS : SIZE_REGULAR;

  // Hidden state suppresses encounter info — show the misty placeholder so
  // the player only sees a landmark exists at this position.
  const isHidden = state === 'hidden';

  const icon = isHidden
    ? '❓'
    : enc
      ? ENCOUNTER_ICON[enc]
      : '⚔️';

  const badgeChar = !isHidden && enc ? ENCOUNTER_BADGE[enc] : null;
  const badgeColor = enc ? ENCOUNTER_BADGE_COLOR[enc] : '#888';

  const tileBg = TILE_BG[node.landmarkType ?? 'default'];

  const displayName = isHidden
    ? '???'
    : node.name
      ?? (node.landmarkType ? LANDMARK_LABEL[node.landmarkType] : null)
      ?? node.type;

  const borderColor = state === 'resolved'
    ? 'rgba(212, 168, 67, 0.55)'
    : state === 'current'
      ? accent
      : state === 'reachable' || state === 'revealed' || state === 'recon'
        ? `${accent}66`
        : 'rgba(110, 100, 90, 0.4)';

  const borderStyle = state === 'locked' ? 'dashed' : 'solid';

  const haloClass =
    state === 'hidden'  ? 'lmn-halo lmn-halo-hidden' :
    state === 'revealed' ? 'lmn-halo lmn-halo-partial' :
    state === 'recon'    ? 'lmn-halo lmn-halo-recon' :
    null;

  const subhint = !isHidden
    ? (enc ? capitalize(enc.replace(/_/g, ' ')) : null)
    : (node.threatHint ? `${capitalize(node.threatHint)} threat` : null);

  function handleClick() {
    if (state === 'locked') return;
    onSelect(node);
  }
  function handleKey(e: KeyboardEvent) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    handleClick();
  }

  const cls = [
    'lmn',
    state === 'current'  ? 'lmn-current'  : '',
    state === 'resolved' ? 'lmn-resolved' : '',
    state === 'locked'   ? 'lmn-locked'   : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      class={cls}
      role="button"
      aria-label={isHidden
        ? 'Unknown landmark — selectable for partial intel'
        : `${displayName}${enc ? ` — ${enc.replace(/_/g, ' ')}` : ''}`}
      aria-pressed={isSelected}
      tabIndex={state === 'locked' ? -1 : 0}
      onClick={handleClick}
      onKeyDown={handleKey}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        '--lmn-glow': `${accent}55`,
        width: `${size}px`,
        height: `${size}px`,
        background: tileBg,
        border: `${state === 'current' ? 2.5 : 2}px ${borderStyle} ${borderColor}`,
        outline: isSelected ? '2px solid var(--color-gold-primary)' : 'none',
        outlineOffset: isSelected ? '3px' : '0',
        animation: state === 'current' ? 'lmn-pulse 2.5s ease-in-out infinite' : 'none',
      } as Record<string, string>}
    >
      {haloClass && <span class={haloClass} aria-hidden="true" />}

      <span
        class="lmn-icon"
        style={{
          fontSize: isBoss ? '26px' : '22px',
          filter: state === 'current' ? `drop-shadow(0 0 5px ${accent}80)` : 'none',
        }}
      >
        {icon}
      </span>

      {state === 'resolved' && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            fontSize: '20px',
            color: 'var(--color-gold-primary)',
            textShadow: '0 0 6px rgba(212, 168, 67, 0.55)',
            animation: 'lmn-check-pop 0.4s ease-out forwards',
          }}
        >
          ✔
        </span>
      )}

      {badgeChar && state !== 'resolved' && (
        <span
          class="lmn-badge"
          style={{ color: badgeColor, borderColor: `${badgeColor}80` }}
        >
          {badgeChar}
        </span>
      )}

      {hovered && state !== 'locked' && (
        <div class="lmn-tooltip" role="tooltip">
          {displayName}
          {subhint && <span class="lmn-tooltip-sub">{subhint}</span>}
        </div>
      )}
    </div>
  );
}

function capitalize(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}
