/**
 * ArmyCampaignPanel (S29-09) — bottom strip of the SpokeCampaignScreen.
 * Renders the active legion's identity + roster + status from the
 * existing army systems and exposes the deeper inspect / retreat
 * actions. Iuniores stays out per S29-09 AC4 — that's a hub-side pool,
 * not an army-side stat, and surfacing it twice would muddy the
 * resource grammar.
 *
 * Reads only the data passed via props (Spoke + MoraleResult) — no
 * direct signal access — so the parent screen owns the lifecycle.
 */

import type { Spoke } from '../../../game/progression/spoke';
import type { MoraleResult, MoraleTier } from '../../../game/army/morale';
import type { UnitRole } from '../../../battle/battle-types';

if (typeof document !== 'undefined' && !document.getElementById('army-campaign-panel-styles')) {
  const el = document.createElement('style');
  el.id = 'army-campaign-panel-styles';
  el.textContent = `
    .acp {
      display: flex;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
      width: 100%;
      font-family: var(--font-family);
      color: var(--color-text-secondary);
    }
    .acp-section {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    }
    .acp-section + .acp-section {
      padding-left: 16px;
      border-left: 1px solid rgba(180, 160, 100, 0.18);
    }
    .acp-eyebrow {
      font-family: var(--font-display);
      font-size: var(--font-size-xs);
      letter-spacing: 2px;
      text-transform: uppercase;
      color: var(--color-gold-dim);
    }
    .acp-name {
      font-family: var(--font-display);
      font-size: var(--font-size-md);
      letter-spacing: 1.5px;
      color: var(--color-gold-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 240px;
    }
    .acp-meta {
      font-size: var(--font-size-xs);
      color: var(--color-text-muted);
      letter-spacing: 0.5px;
    }
    .acp-stat-row {
      display: flex;
      align-items: baseline;
      gap: 6px;
      font-variant-numeric: tabular-nums;
    }
    .acp-stat-value {
      font-family: var(--font-display);
      font-size: var(--font-size-md);
      color: var(--color-gold-primary);
      font-weight: 700;
      letter-spacing: 0.5px;
    }
    .acp-stat-unit {
      font-size: var(--font-size-xs);
      color: var(--color-text-muted);
      letter-spacing: 1px;
      text-transform: uppercase;
    }

    .acp-roles {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .acp-role-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      border-radius: var(--radius-sm);
      font-size: var(--font-size-xs);
      letter-spacing: 0.5px;
      border: 1px solid var(--acp-role-color, rgba(180, 160, 100, 0.4));
      color: var(--acp-role-color, var(--color-text-secondary));
      background: rgba(14, 12, 28, 0.5);
      font-variant-numeric: tabular-nums;
    }

    .acp-actions {
      display: flex;
      gap: 8px;
      margin-left: auto;
    }
    .acp-btn {
      padding: 8px 16px;
      background: rgba(14, 12, 28, 0.85);
      border: 1px solid rgba(180, 160, 100, 0.4);
      border-radius: var(--radius-sm);
      color: var(--color-gold-dim);
      font-family: var(--font-family);
      font-size: var(--font-size-xs);
      letter-spacing: 1.5px;
      text-transform: uppercase;
      cursor: pointer;
      transition: all var(--duration-fast) var(--ease-default);
    }
    .acp-btn:hover {
      color: var(--color-gold-primary);
      border-color: rgba(212, 168, 67, 0.7);
    }
    .acp-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    .acp-btn--danger:hover {
      color: var(--color-danger, #d96a6a);
      border-color: rgba(217, 106, 106, 0.7);
    }

    .acp-empty {
      flex: 1;
      color: var(--color-text-muted);
      font-style: italic;
      letter-spacing: 0.5px;
    }
  `;
  document.head.appendChild(el);
}

const MORALE_TIER_COLOR: Record<MoraleTier, string> = {
  broken:   'var(--color-danger)',
  shaken:   '#d48b3a',
  steady:   'var(--color-text-secondary)',
  resolute: 'var(--color-gold-secondary)',
  inspired: 'var(--color-gold-primary)',
};

const ROLE_COLOR: Record<UnitRole, string> = {
  vanguard: '#e07050',
  reserve:  '#60a8d0',
  guard:    '#d4a843',
};

const ROLE_LABEL: Record<UnitRole, string> = {
  vanguard: 'Vanguard',
  reserve:  'Reserve',
  guard:    'Guard',
};

function tierLabel(tier: MoraleTier): string {
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

export interface ArmyCampaignPanelProps {
  spoke: Spoke;
  morale: MoraleResult | null;
  legateName: string | null;
  onOpenDetails: () => void;
  onRetreat: () => void;
}

export function ArmyCampaignPanel({
  spoke,
  morale,
  legateName,
  onOpenDetails,
  onRetreat,
}: ArmyCampaignPanelProps) {
  const army = spoke.boundArmy;

  if (!army) {
    return (
      <div class="acp" role="region" aria-label="Army campaign panel">
        <span class="acp-empty">No army bound to this campaign.</span>
        <div class="acp-actions">
          <button class="acp-btn acp-btn--danger" onClick={onRetreat}>Retreat</button>
        </div>
      </div>
    );
  }

  const cohorts = army.cohorts;
  const cohortCount = cohorts.length;
  const troopSize = army.size;
  const supplies = army.supplies;
  const supplyStreak = army.supplyDeficitStreak ?? 0;

  // Role breakdown — counts by UnitRole. Ordered vanguard → reserve → guard
  // for visual consistency with the roster's left→right reading order.
  const roleCounts: Record<UnitRole, number> = { vanguard: 0, reserve: 0, guard: 0 };
  for (const c of cohorts) {
    if (c.role in roleCounts) roleCounts[c.role as UnitRole]++;
  }

  return (
    <div class="acp" role="region" aria-label="Army campaign panel">
      <div class="acp-section">
        <span class="acp-eyebrow">Legion</span>
        <span class="acp-name" title={army.name}>{army.name}</span>
        {legateName && (
          <span class="acp-meta">Legate · {legateName}</span>
        )}
      </div>

      <div class="acp-section">
        <span class="acp-eyebrow">Roster</span>
        <div class="acp-stat-row">
          <span class="acp-stat-value">{cohortCount}</span>
          <span class="acp-stat-unit">cohorts</span>
          <span class="acp-stat-unit" style={{ opacity: 0.6 }}>·</span>
          <span class="acp-stat-value">{troopSize.toLocaleString()}</span>
          <span class="acp-stat-unit">men</span>
        </div>
        {cohortCount > 0 && (
          <div class="acp-roles">
            {(['vanguard', 'reserve', 'guard'] as const).map((r) =>
              roleCounts[r] > 0 ? (
                <span
                  key={r}
                  class="acp-role-chip"
                  style={{ '--acp-role-color': ROLE_COLOR[r] } as preact.JSX.CSSProperties}
                  title={`${roleCounts[r]} × ${ROLE_LABEL[r]}`}
                >
                  {ROLE_LABEL[r]} ×{roleCounts[r]}
                </span>
              ) : null,
            )}
          </div>
        )}
      </div>

      <div class="acp-section">
        <span class="acp-eyebrow">Status</span>
        {morale && (
          <div class="acp-stat-row">
            <span
              class="acp-stat-value"
              style={{ color: MORALE_TIER_COLOR[morale.tier] }}
              title={
                morale.modifiers.length === 0
                  ? `Morale ${morale.total} — no modifiers active`
                  : `Morale ${morale.total}\n` +
                    morale.modifiers
                      .slice()
                      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
                      .map((m) => `  ${m.delta >= 0 ? '+' : ''}${m.delta}  ${m.label}`)
                      .join('\n')
              }
            >
              {tierLabel(morale.tier)}
            </span>
            <span class="acp-stat-unit">({morale.total})</span>
          </div>
        )}
        <div class="acp-stat-row">
          <span class="acp-stat-value">{supplies}</span>
          <span class="acp-stat-unit">supplies</span>
          {supplyStreak > 0 && (
            <span
              class="acp-stat-unit"
              style={{ color: 'var(--color-danger)' }}
              title={`${supplyStreak} consecutive deficit traversal${supplyStreak === 1 ? '' : 's'}`}
            >
              · {supplyStreak} short
            </span>
          )}
        </div>
      </div>

      <div class="acp-actions">
        <button class="acp-btn" onClick={onOpenDetails}>
          Inspect Legion
        </button>
        <button class="acp-btn acp-btn--danger" onClick={onRetreat}>
          Retreat
        </button>
      </div>
    </div>
  );
}
