/**
 * Campaign-map tile for a single spoke node (S27-08).
 *
 * Replaces the round NodeCircle button. Visual goals:
 *   - Reads as a landmark on a map, not a button: rounded square tile,
 *     terrain-tinted gradient, named below the tile, encounter badge in
 *     the corner, primary effect hint as a chip.
 *   - Locked/unknown nodes show a dim tile with a lock and `???` so the
 *     fog-of-war state is visible at a glance.
 *   - Resolved nodes fade and stamp a gold check.
 *
 * Selection / activation behavior matches NodeCircle: clicks always call
 * onSelect; activation is gated by the parent (caller passes onActivate
 * which the parent makes a no-op for branch / non-current nodes).
 */

import { useState } from 'preact/hooks';
import type { SpokeNode } from '../../../game/progression/spoke';
import type { LandmarkType, EncounterType } from '../../../game/progression/landmark-types';

if (typeof document !== 'undefined' && !document.getElementById('landmark-node-styles')) {
  const el = document.createElement('style');
  el.id = 'landmark-node-styles';
  el.textContent = `
    @keyframes landmark-pulse {
      0%, 100% { box-shadow: 0 0 12px var(--lm-glow), 0 0 24px var(--lm-glow); }
      50%      { box-shadow: 0 0 20px var(--lm-glow), 0 0 40px var(--lm-glow); }
    }
    @keyframes landmark-checkmark-pop {
      0%   { transform: scale(0) rotate(-45deg); opacity: 0; }
      60%  { transform: scale(1.3) rotate(0deg); opacity: 1; }
      100% { transform: scale(1) rotate(0deg); opacity: 1; }
    }
    .landmark-tile {
      position: relative;
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: filter var(--duration-fast) var(--ease-default),
                  transform var(--duration-fast) var(--ease-default);
      cursor: pointer;
      outline: none;
    }
    .landmark-tile:hover {
      filter: brightness(1.15);
      transform: translateY(-2px);
    }
    .landmark-tile-current {
      animation: landmark-pulse 2.5s ease-in-out infinite;
    }
    .landmark-tile-locked {
      filter: brightness(0.55) saturate(0.4);
      cursor: default;
    }
    .landmark-tile-locked:hover { transform: none; }
    .landmark-tile-resolved { opacity: 0.65; }
    .landmark-tile-name {
      position: absolute;
      bottom: -22px;
      left: 50%;
      transform: translateX(-50%);
      font-family: var(--font-display);
      font-size: var(--font-size-xs);
      letter-spacing: 1px;
      text-transform: uppercase;
      max-width: 130px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      text-align: center;
    }
    .landmark-tile-hint {
      position: absolute;
      bottom: -40px;
      left: 50%;
      transform: translateX(-50%);
      font-size: var(--font-size-xs);
      color: var(--color-text-muted);
      letter-spacing: 0.5px;
      white-space: nowrap;
    }
    .landmark-encounter-badge {
      position: absolute;
      top: -6px;
      right: -6px;
      min-width: 22px;
      height: 22px;
      padding: 0 6px;
      border-radius: 11px;
      background: var(--color-bg-primary);
      border: 1px solid var(--color-border-default);
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.5px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--color-gold-secondary);
    }
    .landmark-lock-overlay {
      position: absolute;
      bottom: 4px;
      right: 4px;
      font-size: 14px;
      opacity: 0.7;
    }
  `;
  document.head.appendChild(el);
}

const LANDMARK_TILE_BG: Record<LandmarkType | 'default', string> = {
  start_camp:      'linear-gradient(135deg, rgba(80, 60, 30, 0.7), rgba(50, 38, 22, 0.85))',
  battlefield:     'linear-gradient(135deg, rgba(95, 40, 30, 0.7), rgba(60, 28, 22, 0.85))',
  forest:          'linear-gradient(135deg, rgba(40, 70, 45, 0.7), rgba(28, 50, 32, 0.85))',
  hill:            'linear-gradient(135deg, rgba(110, 85, 50, 0.65), rgba(70, 55, 35, 0.85))',
  village:         'linear-gradient(135deg, rgba(120, 100, 70, 0.65), rgba(80, 65, 45, 0.85))',
  farm:            'linear-gradient(135deg, rgba(140, 130, 70, 0.6), rgba(90, 80, 45, 0.85))',
  city:            'linear-gradient(135deg, rgba(180, 160, 110, 0.65), rgba(110, 95, 65, 0.85))',
  fort:            'linear-gradient(135deg, rgba(90, 90, 100, 0.7), rgba(55, 55, 65, 0.9))',
  camp:            'linear-gradient(135deg, rgba(95, 80, 50, 0.7), rgba(60, 50, 30, 0.85))',
  shrine:          'linear-gradient(135deg, rgba(180, 150, 90, 0.6), rgba(110, 92, 55, 0.85))',
  river_crossing:  'linear-gradient(135deg, rgba(60, 90, 130, 0.65), rgba(40, 60, 90, 0.85))',
  ruins:           'linear-gradient(135deg, rgba(100, 80, 70, 0.65), rgba(60, 48, 42, 0.9))',
  road:            'linear-gradient(135deg, rgba(110, 95, 75, 0.6), rgba(70, 60, 48, 0.85))',
  marsh:           'linear-gradient(135deg, rgba(70, 80, 55, 0.7), rgba(45, 55, 38, 0.9))',
  mountain_pass:   'linear-gradient(135deg, rgba(110, 100, 110, 0.65), rgba(60, 55, 65, 0.9))',
  watchtower:      'linear-gradient(135deg, rgba(80, 90, 110, 0.7), rgba(50, 58, 75, 0.9))',
  supply_depot:    'linear-gradient(135deg, rgba(130, 100, 60, 0.7), rgba(85, 65, 38, 0.85))',
  default:         'linear-gradient(135deg, rgba(60, 55, 80, 0.7), rgba(40, 36, 55, 0.9))',
};

const ENCOUNTER_ICON: Record<EncounterType, string> = {
  battle:       '⚔️',
  elite_battle: '🏹',
  boss:         '💀',
  rest:         '🏕',
  event:        '📜',
  scout:        '🔭',
  forage:       '🌾',
  recruit:      '🚩',
  ambush:       '🗡',
  merchant:     '🪙',
  siege:        '🏰',
  hazard:       '⚠',
  unknown:      '❓',
};

const ENCOUNTER_BADGE: Record<EncounterType, string> = {
  battle:       'B',
  elite_battle: 'E',
  boss:         'Bo',
  rest:         'R',
  event:        'Ev',
  scout:        'Sc',
  forage:       'Fo',
  recruit:      'Re',
  ambush:       'Am',
  merchant:     'M',
  siege:        'Si',
  hazard:       'Hz',
  unknown:      '?',
};

const ENCOUNTER_BADGE_COLOR: Record<EncounterType, string> = {
  battle:       '#c24a3a',
  elite_battle: '#c24a3a',
  boss:         '#8a4ac2',
  rest:         '#4a9a6a',
  event:        '#d4a843',
  scout:        '#60a8d0',
  forage:       '#9aa84a',
  recruit:      '#d48b3a',
  ambush:       '#c24a3a',
  merchant:     '#d4a843',
  siege:        '#8a4ac2',
  hazard:       '#c24a3a',
  unknown:      '#888',
};

const LANDMARK_LABEL: Record<LandmarkType, string> = {
  start_camp:      'Start Camp',
  battlefield:     'Battlefield',
  forest:          'Forest',
  hill:            'Hill',
  village:         'Village',
  farm:            'Farm',
  city:            'City',
  fort:            'Fort',
  camp:            'Camp',
  shrine:          'Shrine',
  river_crossing:  'River Crossing',
  ruins:           'Ruins',
  road:            'Road',
  marsh:           'Marsh',
  mountain_pass:   'Mountain Pass',
  watchtower:      'Watchtower',
  supply_depot:    'Supply Depot',
};

const LEGACY_TYPE_ICON: Record<string, string> = {
  battle: '⚔️',
  rest:   '🏕',
  event:  '📜',
  boss:   '💀',
};

const SIZE_REGULAR = 78;
const SIZE_BOSS = 92;

interface LandmarkNodeProps {
  node: SpokeNode;
  isCurrent: boolean;
  isSelected: boolean;
  isReachable: boolean;
  color: string;
  onActivate: () => void;
  onSelect: () => void;
}

export function LandmarkNode({ node, isCurrent, isSelected, isReachable, color, onActivate, onSelect }: LandmarkNodeProps) {
  const [hovered, setHovered] = useState(false);

  const enc = node.encounterType;
  const isBoss = enc === 'boss' || node.type === 'boss';
  const size = isBoss ? SIZE_BOSS : SIZE_REGULAR;
  const tileBg = LANDMARK_TILE_BG[node.landmarkType ?? 'default'];

  const isHidden =
    !node.resolved &&
    !isCurrent &&
    (node.revealed === false || node.scoutedLevel === 0);
  const isLocked = !isReachable && !node.resolved && !isCurrent;

  const icon = isHidden
    ? '❓'
    : enc
      ? ENCOUNTER_ICON[enc]
      : LEGACY_TYPE_ICON[node.type] ?? '⚔️';

  const badgeChar = enc ? ENCOUNTER_BADGE[enc] : null;
  const badgeColor = enc ? ENCOUNTER_BADGE_COLOR[enc] : '#888';

  const displayName = isHidden
    ? '???'
    : node.name
      ?? (node.landmarkType ? LANDMARK_LABEL[node.landmarkType] : null)
      ?? node.type;

  const borderColor = node.resolved
    ? 'rgba(212, 168, 67, 0.5)'
    : isCurrent
      ? color
      : isReachable
        ? `${color}55`
        : 'rgba(110, 100, 90, 0.35)';

  const borderStyle = isLocked && !node.resolved ? 'dashed' : 'solid';

  const stateClass = [
    'landmark-tile',
    isCurrent ? 'landmark-tile-current' : '',
    node.resolved ? 'landmark-tile-resolved' : '',
    isLocked && !node.resolved ? 'landmark-tile-locked' : '',
  ].filter(Boolean).join(' ');

  function handleClick() {
    if (isLocked && !node.resolved) return;
    onSelect();
    // Activation is strictly gated to the player's current unresolved
    // node — clicking the next reachable node only selects it for the
    // details panel, never starts its encounter ahead of currentNodeIndex.
    if (isCurrent && !node.resolved) onActivate();
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    handleClick();
  }

  const hint = !isHidden ? primaryEffectHint(node) : null;

  return (
    <div
      class={stateClass}
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      role="button"
      aria-label={[isHidden ? 'Unknown' : displayName, enc ? `— ${enc.replace('_', ' ')}` : ''].filter(Boolean).join(' ')}
      aria-pressed={isSelected}
      tabIndex={isLocked && !node.resolved ? -1 : 0}
      onKeyDown={handleKeyDown}
      style={{
        '--lm-glow': `${color}55`,
        width: `${size}px`,
        height: `${size}px`,
        background: tileBg,
        border: `${isCurrent ? 3 : 2}px ${borderStyle} ${borderColor}`,
        outline: isSelected ? '2px solid var(--color-gold-primary)' : 'none',
        outlineOffset: isSelected ? '4px' : '0',
      } as Record<string, string>}
    >
      <span style={{
        fontSize: isBoss ? '34px' : '28px',
        lineHeight: '1',
        filter: isCurrent ? `drop-shadow(0 0 6px ${color}80)` : 'none',
      }}>
        {icon}
      </span>

      {node.resolved && (
        <span style={{
          position: 'absolute',
          fontSize: '22px',
          color: 'var(--color-gold-primary)',
          textShadow: '0 0 8px rgba(212, 168, 67, 0.6)',
          animation: 'landmark-checkmark-pop 0.4s ease-out forwards',
        }}>
          {'✔'}
        </span>
      )}

      {!isHidden && badgeChar && !node.resolved && (
        <span class="landmark-encounter-badge" style={{ color: badgeColor, borderColor: `${badgeColor}80` }}>
          {badgeChar}
        </span>
      )}

      {isLocked && !node.resolved && (
        <span class="landmark-lock-overlay" aria-hidden="true">🔒</span>
      )}

      <div class="landmark-tile-name" style={{
        color: node.resolved
          ? 'var(--color-gold-secondary)'
          : isCurrent
            ? color
            : isLocked
              ? 'var(--color-text-muted)'
              : 'var(--color-text-secondary)',
      }}>
        {displayName}
      </div>

      {hint && !isLocked && (
        <div class="landmark-tile-hint">{hint}</div>
      )}

      {hovered && !isLocked && !node.resolved && (
        <div style={{
          position: 'absolute',
          bottom: 'calc(100% + 8px)',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--color-bg-primary)',
          border: '1px solid var(--color-border-default)',
          borderRadius: 'var(--radius-sm)',
          padding: '4px 10px',
          fontSize: 'var(--font-size-xs)',
          letterSpacing: '0.5px',
          whiteSpace: 'nowrap',
          color: isCurrent ? color : 'var(--color-text-secondary)',
          pointerEvents: 'none',
          zIndex: 50,
        }}>
          {isCurrent ? 'Activate' : 'Inspect'}
        </div>
      )}
    </div>
  );
}

function primaryEffectHint(node: SpokeNode): string | null {
  const effects = node.effects;
  if (!effects || effects.length === 0) {
    if (node.encounterType === 'battle' || node.encounterType === 'elite_battle' || node.encounterType === 'boss') {
      return 'Combat';
    }
    if (node.encounterType === 'rest') return 'Recovery';
    if (node.encounterType === 'scout') return 'Discovery';
    if (node.encounterType === 'ambush' || node.encounterType === 'hazard') return 'Risk';
    return null;
  }
  let best: { label: string; abs: number } | null = null;
  for (const e of effects) {
    if (e.type === 'morale' || e.type === 'supplies' || e.type === 'iuniores') {
      const abs = Math.abs(e.delta);
      if (!best || abs > best.abs) {
        const sign = e.delta >= 0 ? '+' : '';
        const icon = e.type === 'morale' ? '🔥' : e.type === 'supplies' ? '📦' : '🛡';
        best = { label: `${sign}${e.delta} ${icon}`, abs };
      }
    }
  }
  return best?.label ?? null;
}
