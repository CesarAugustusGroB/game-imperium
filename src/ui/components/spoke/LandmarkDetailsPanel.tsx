/**
 * Selected-landmark details panel (S27-07).
 *
 * Reads the active intel projection from `getNodeIntel(node)` and renders a
 * Unknown / Scouted / Full Recon variant accordingly. The three layouts are
 * visibly distinct so the player can tell at a glance how much they know:
 *   - **Unknown**: locked appearance, hidden encounter copy, only landmark
 *     + terrain + threat hint visible.
 *   - **Scouted**: encounter type, approximate (rounded) reward, one-line
 *     main risk.
 *   - **Full Recon**: exact reward, full effects breakdown, battle modifier
 *     chips with mechanics behind a tooltip (AC5).
 *
 * The action button only fires when the rendered node is the player's
 * current node — non-current selections show the same info but the button
 * is disabled with an explanatory tooltip.
 */

import type { SpokeNode } from '../../../game/progression/spoke';
import type { EncounterType, LandmarkType } from '../../../game/progression/landmark-types';
import { BATTLE_MODIFIER_LABELS } from '../../../game/progression/battle-terrain-modifiers';
import { getNodeIntel, type NodeIntel } from '../../../game/progression/spoke-scouting';
import { RESOURCE_INFO } from '../../../game/core/commander';

if (typeof document !== 'undefined' && !document.getElementById('landmark-details-styles')) {
  const el = document.createElement('style');
  el.id = 'landmark-details-styles';
  el.textContent = `
    .landmark-details-panel {
      max-width: 480px;
      width: 100%;
      margin: 16px auto 0;
      background: rgba(14, 12, 28, 0.88);
      border: 1px solid rgba(180, 160, 100, 0.3);
      border-radius: var(--radius-md);
      padding: 16px 20px;
      box-sizing: border-box;
      position: relative;
    }
    .landmark-details-panel::before {
      content: '';
      display: block;
      position: absolute;
      inset: 4px;
      border: 1px solid rgba(180, 160, 100, 0.12);
      border-radius: calc(var(--radius-md) - 2px);
      pointer-events: none;
    }
    .landmark-panel-eyebrow {
      font-family: var(--font-display);
      font-size: var(--font-size-xs);
      letter-spacing: 2px;
      text-transform: uppercase;
      color: var(--color-gold-dim);
      margin-bottom: 4px;
    }
    .landmark-panel-title {
      font-family: var(--font-display);
      font-size: var(--font-size-lg);
      font-weight: 700;
      color: var(--color-gold-primary);
      letter-spacing: 2px;
      text-transform: uppercase;
      margin-bottom: 10px;
      line-height: 1.2;
    }
    .landmark-effect-row {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: var(--font-size-sm);
      color: var(--color-text-secondary);
      margin-bottom: 4px;
    }
    .landmark-pill {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 8px;
      border-radius: var(--radius-sm);
      font-size: var(--font-size-xs);
      font-weight: 600;
      letter-spacing: 0.5px;
    }
    .landmark-battle-chip {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 6px 10px;
      background: rgba(60, 50, 30, 0.5);
      border: 1px solid var(--color-border-strong);
      border-radius: var(--radius-sm);
      font-size: var(--font-size-sm);
      font-weight: 600;
      color: var(--color-text-primary);
      cursor: default;
    }
    .landmark-action-btn {
      margin-top: 14px;
      padding: 9px 22px;
      border-radius: var(--radius-sm);
      cursor: pointer;
      background: linear-gradient(135deg, rgba(80, 60, 20, 0.7), rgba(50, 40, 18, 0.9));
      border: 1px solid rgba(220, 190, 100, 0.4);
      color: var(--color-gold-primary);
      font-family: inherit;
      font-size: var(--font-size-xs);
      font-weight: 700;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      transition: all var(--duration-fast) var(--ease-default);
    }
    .landmark-action-btn:hover:not(:disabled) {
      filter: brightness(1.15);
      box-shadow: 0 0 10px rgba(240, 208, 128, 0.2);
    }
    .landmark-action-btn:active:not(:disabled) { transform: scale(0.97); }
    .landmark-action-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    .landmark-unknown-body {
      font-style: italic;
      color: var(--color-text-muted);
      font-size: var(--font-size-sm);
      margin: 0 0 10px;
    }
    @media (max-width: 520px) {
      .landmark-details-panel {
        max-width: 100%;
        margin: 12px 8px 0;
        padding: 14px 14px;
      }
      .landmark-panel-title { font-size: var(--font-size-md); letter-spacing: 1.5px; }
    }
  `;
  document.head.appendChild(el);
}

const ENCOUNTER_LABEL: Record<EncounterType, string> = {
  battle:       'Battle',
  elite_battle: 'Elite Battle',
  boss:         'Boss',
  rest:         'Rest',
  event:        'Event',
  scout:        'Scout',
  forage:       'Forage',
  recruit:      'Recruit',
  ambush:       'Ambush',
  merchant:     'Merchant',
  siege:        'Siege',
  hazard:       'Hazard',
  unknown:      'Unknown',
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

const THREAT_COLOR: Record<NonNullable<SpokeNode['threatHint']>, string> = {
  low:    '#4a9a6a',
  medium: '#d4a843',
  high:   '#d47a3a',
  deadly: '#c24a3a',
};

// S27-10: BATTLE_MODIFIER_LABELS now lives in battle-terrain-modifiers so the
// BattleContextBanner can share the same source of truth.

function ThreatTerrainPills({ threatHint, terrain }: { threatHint?: NonNullable<SpokeNode['threatHint']>; terrain?: string }) {
  return (
    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
      {threatHint && (
        <span class="landmark-pill" style={{
          background: `${THREAT_COLOR[threatHint]}20`,
          border: `1px solid ${THREAT_COLOR[threatHint]}60`,
          color: THREAT_COLOR[threatHint],
        }}>
          Threat: {threatHint}
        </span>
      )}
      {terrain && (
        <span class="landmark-pill" style={{
          background: 'rgba(40, 60, 80, 0.5)',
          border: '1px solid rgba(100, 140, 180, 0.3)',
          color: 'rgba(140, 180, 220, 0.8)',
        }}>
          Terrain: {capitalize(terrain)}
        </span>
      )}
    </div>
  );
}

function actionLabel(intel: NodeIntel): string {
  if (intel.level === 0) return 'Approach';
  const enc = intel.encounterType;
  if (enc === 'battle' || enc === 'elite_battle' || enc === 'boss') return 'Engage';
  if (enc === 'rest') return 'Rest';
  return 'Resolve';
}

function capitalize(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}

interface LandmarkDetailsPanelProps {
  node: SpokeNode | null;
  isCurrent: boolean;
  onAction?: () => void;
  accentColor?: string;
  /** Override the auto-derived action button label (S29-07). */
  actionLabel?: string;
  /** Tooltip shown when the action button is disabled (S29-07). */
  actionDisabledReason?: string;
}

export function LandmarkDetailsPanel({
  node,
  isCurrent,
  onAction,
  accentColor = 'var(--color-gold-primary)',
  actionLabel: actionLabelOverride,
  actionDisabledReason,
}: LandmarkDetailsPanelProps) {
  if (!node) return null;

  const intel = getNodeIntel(node);

  const eyebrow = intel.landmarkType
    ? LANDMARK_LABEL[intel.landmarkType] ?? capitalize(intel.landmarkType.replace(/_/g, ' '))
    : 'Unknown';
  const title = intel.name ?? '???';
  const btnLabel = actionLabelOverride ?? actionLabel(intel);

  return (
    <div class="landmark-details-panel">
      <div class="landmark-panel-eyebrow">{eyebrow}</div>
      <div class="landmark-panel-title" style={{ color: accentColor }}>{title}</div>

      {intel.level === 0 && (
        <>
          <p class="landmark-unknown-body">❓ Hidden encounter — scout for details</p>
          <ThreatTerrainPills threatHint={intel.threatHint} terrain={intel.terrain} />
        </>
      )}

      {intel.level === 1 && (
        <>
          {intel.encounterType && (
            <div class="landmark-effect-row" style={{ marginBottom: '8px' }}>
              <span style={{ color: 'var(--color-gold-secondary)', fontWeight: 700 }}>
                {ENCOUNTER_LABEL[intel.encounterType]}
              </span>
            </div>
          )}
          <ThreatTerrainPills threatHint={intel.threatHint} terrain={intel.terrain} />
          {intel.approximateReward && intel.approximateReward.length > 0 && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
              {intel.approximateReward.map((r, i) => (
                <span key={i} class="ornate-stat-chip">
                  {RESOURCE_INFO[r.resource].icon} ~{r.amount} {RESOURCE_INFO[r.resource].label}
                </span>
              ))}
            </div>
          )}
          {intel.mainRisk && (
            <div class="landmark-effect-row" style={{ color: 'var(--color-danger)' }}>
              <span>⚠</span>
              <span>{intel.mainRisk}</span>
            </div>
          )}
        </>
      )}

      {intel.level === 2 && (
        <>
          {intel.encounterType && (
            <div class="landmark-effect-row" style={{ marginBottom: '8px' }}>
              <span style={{ color: 'var(--color-gold-secondary)', fontWeight: 700 }}>
                {ENCOUNTER_LABEL[intel.encounterType]}
              </span>
            </div>
          )}
          <ThreatTerrainPills threatHint={intel.threatHint} terrain={intel.terrain} />
          {intel.reward && intel.reward.length > 0 && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
              {intel.reward.map((r, i) => (
                <span key={i} class="ornate-stat-chip" style={{ color: RESOURCE_INFO[r.resource].color }}>
                  {RESOURCE_INFO[r.resource].icon} +{r.amount} {RESOURCE_INFO[r.resource].label}
                </span>
              ))}
            </div>
          )}
          {intel.effects.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginBottom: '8px' }}>
              {intel.effects.map((e, i) => {
                if (e.type === 'reveal' || e.type === 'scout') {
                  return (
                    <div key={i} class="landmark-effect-row">
                      <span>🔭</span>
                      <span>{e.label}</span>
                    </div>
                  );
                }
                if (e.type === 'battle-modifier') {
                  const info = BATTLE_MODIFIER_LABELS[e.modifierId];
                  return (
                    <div key={i} class="landmark-effect-row">
                      <span>{info?.icon ?? '⚔'}</span>
                      <span>{e.label}</span>
                    </div>
                  );
                }
                const delta = e.delta;
                const isNeg = delta < 0;
                const signed = delta > 0 ? `+${delta}` : `${delta}`;
                return (
                  <div key={i} class="landmark-effect-row" style={{ color: isNeg ? 'var(--color-danger)' : '#6ab87a' }}>
                    <span>{e.label}: {signed}</span>
                  </div>
                );
              })}
            </div>
          )}
          {intel.battleModifiers.length > 0 && (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
              {intel.battleModifiers.map((mod, i) => {
                const info = BATTLE_MODIFIER_LABELS[mod];
                return (
                  <span
                    key={i}
                    class="landmark-battle-chip"
                    title={info ? `${info.label} — ${info.description}` : mod}
                  >
                    {info?.icon ?? '⚔'} {info?.label ?? mod}
                  </span>
                );
              })}
            </div>
          )}
          {intel.enemyStrength !== undefined && (
            <div class="landmark-effect-row" style={{ marginBottom: '6px' }}>
              <span style={{ color: 'rgba(200, 140, 100, 0.8)' }}>
                Enemy strength: {intel.enemyStrength}
              </span>
            </div>
          )}
        </>
      )}

      <div>
        <button
          class="landmark-action-btn"
          onClick={isCurrent && onAction ? onAction : undefined}
          disabled={!isCurrent}
          title={!isCurrent ? (actionDisabledReason ?? 'Not current node') : undefined}
        >
          {btnLabel}
        </button>
      </div>
    </div>
  );
}
