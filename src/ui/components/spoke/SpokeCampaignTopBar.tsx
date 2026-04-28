/**
 * SpokeCampaignTopBar (S29-03) — campaign-flavored header for the new
 * SpokeCampaignScreen.
 *
 * Distinct from `SpokeTopBar` (used by legacy NodeMapScreen). The campaign
 * variant leads with the spoke label, gives morale its own meter band so it
 * never reads like passive income, frames supplies as `have / need`, and
 * carries gold + influence as small secondary chips. Iuniores intentionally
 * stays out per the S29-03 spec — the legion campaign panel (S29-09) will
 * surface it where relevant.
 *
 * No props — reads `currentSpoke`, `gold`, `influence` signals plus
 * `computeArmyMorale` and `supplyCostForNodes` directly so the bar
 * recomputes whenever any of those change.
 */

import { currentSpoke, currentNodeIndex } from '../../../game/progression/spoke';
import { gold, influence } from '../../../game/core/resources';
import { computeArmyMorale, type MoraleTier } from '../../../game/army/morale';
import { supplyCostForNodes } from '../../../game/army/supplies';
import { RESOURCE_INFO } from '../../../game/core/commander';

if (typeof document !== 'undefined' && !document.getElementById('spoke-campaign-topbar-styles')) {
  const el = document.createElement('style');
  el.id = 'spoke-campaign-topbar-styles';
  el.textContent = `
    .spoke-campaign-topbar {
      display: flex;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
      width: 100%;
    }

    .sct-label {
      flex: 1 1 220px;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .sct-label-eyebrow {
      font-family: var(--font-display);
      font-size: var(--font-size-xs);
      letter-spacing: 2px;
      text-transform: uppercase;
      color: var(--color-gold-dim);
    }
    .sct-label-title {
      font-family: var(--font-display);
      font-size: var(--font-size-md);
      font-weight: 700;
      color: var(--color-gold-primary);
      letter-spacing: 1.5px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .sct-label-meta {
      font-size: var(--font-size-xs);
      color: var(--color-text-muted);
      letter-spacing: 1px;
    }

    /* Morale meter — wide pill with a tier band so it reads as
       "earned standing", not a stat-chip number. */
    .sct-morale {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 160px;
      padding: 6px 12px;
      background: rgba(14, 12, 28, 0.6);
      border: 1px solid var(--sct-morale-color, rgba(180, 160, 100, 0.4));
      border-radius: var(--radius-sm);
      box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.3);
    }
    .sct-morale-row {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 8px;
    }
    .sct-morale-tier {
      font-family: var(--font-display);
      font-size: var(--font-size-sm);
      letter-spacing: 1.5px;
      text-transform: uppercase;
      color: var(--sct-morale-color, var(--color-text-secondary));
      font-weight: 700;
    }
    .sct-morale-total {
      font-size: var(--font-size-xs);
      color: var(--color-text-muted);
      letter-spacing: 0.5px;
      font-variant-numeric: tabular-nums;
    }
    .sct-morale-band {
      height: 4px;
      border-radius: 2px;
      background: rgba(255, 255, 255, 0.08);
      overflow: hidden;
    }
    .sct-morale-band-fill {
      height: 100%;
      background: var(--sct-morale-color, var(--color-text-secondary));
      transition: width var(--duration-normal) var(--ease-default);
    }

    /* Primary military chip (supplies, cohorts) — solid, clearly readable. */
    .sct-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      background: rgba(14, 12, 28, 0.6);
      border: 1px solid rgba(180, 160, 100, 0.35);
      border-radius: var(--radius-sm);
      font-family: var(--font-family);
      font-size: var(--font-size-sm);
      color: var(--color-text-secondary);
      letter-spacing: 0.5px;
      font-variant-numeric: tabular-nums;
    }
    .sct-chip-icon { opacity: 0.85; }
    .sct-chip-value { color: var(--color-gold-primary); font-weight: 600; }
    .sct-chip-divider { color: var(--color-text-muted); margin: 0 2px; }

    /* Supply chip flips into a warning state when stockpile can't cover
       the rest of the spoke — non-blocking but visually distinct. */
    .sct-chip--warn {
      border-color: rgba(217, 106, 106, 0.55);
      color: var(--color-danger, #d96a6a);
    }
    .sct-chip--warn .sct-chip-value { color: var(--color-danger, #d96a6a); }

    /* Secondary resource chips (gold, influence) — dimmer so they don't
       compete with morale + supplies for attention. */
    .sct-resource-group {
      display: flex;
      gap: 6px;
      align-items: center;
    }
    .sct-resource {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 8px;
      font-size: var(--font-size-xs);
      color: var(--color-text-muted);
      border-radius: var(--radius-sm);
      letter-spacing: 0.5px;
      font-variant-numeric: tabular-nums;
    }
    .sct-resource-value { color: var(--color-text-secondary); font-weight: 600; }

    @media (max-width: 720px) {
      .spoke-campaign-topbar { gap: 8px; }
      .sct-morale { min-width: 0; flex: 1 1 140px; }
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

const MORALE_TIER_FILL: Record<MoraleTier, number> = {
  broken:   0.15,
  shaken:   0.35,
  steady:   0.55,
  resolute: 0.78,
  inspired: 1.0,
};

function tierLabel(tier: MoraleTier): string {
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

export function SpokeCampaignTopBar() {
  const spoke = currentSpoke.value;
  if (!spoke) return null;

  const nodeIdx = currentNodeIndex.value;
  const morale = spoke.boundArmy ? computeArmyMorale(spoke) : null;

  const cohortCount = spoke.boundArmy?.cohorts.length ?? 0;
  const armySize = spoke.boundArmy?.size ?? 0;

  // Supplies: have / need-for-rest-of-spoke. Preserves the bare-integer
  // codebase scale; the denominator is what supplyCostForNodes already
  // computes for the EmbarkCard warning, so it stays consistent across UI.
  const supplies = spoke.boundArmy?.supplies ?? null;
  const nodesRemaining = Math.max(0, spoke.nodes.length - nodeIdx);
  const supplyNeed = supplyCostForNodes(cohortCount, nodesRemaining);
  const supplyShort = supplies !== null && supplies < supplyNeed;

  const resolvedCount = spoke.nodes.filter(n => n.resolved).length;

  const moraleStyle = morale
    ? { '--sct-morale-color': MORALE_TIER_COLOR[morale.tier] } as preact.JSX.CSSProperties
    : undefined;

  const moraleTooltip = morale
    ? (morale.modifiers.length === 0
        ? `Morale — ${tierLabel(morale.tier)} (${morale.total}). No modifiers active.`
        : `Morale — ${tierLabel(morale.tier)} (${morale.total})\n` +
          morale.modifiers
            .slice()
            .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
            .map((m) => `  ${m.delta >= 0 ? '+' : ''}${m.delta}  ${m.label}`)
            .join('\n'))
    : undefined;

  return (
    <div class="spoke-campaign-topbar" role="region" aria-label="Campaign top bar">
      <div class="sct-label">
        <span class="sct-label-eyebrow">
          {spoke.posture === 'attacking' ? 'Offensive' : 'Defensive'} Campaign
        </span>
        <span class="sct-label-title" title={spoke.label}>{spoke.label}</span>
        <span class="sct-label-meta">
          {resolvedCount}/{spoke.nodes.length} landmarks
          {spoke.duration > 1 && <> · Season {spoke.currentSeason}/{spoke.duration}</>}
        </span>
      </div>

      {morale && (
        <div class="sct-morale" style={moraleStyle} title={moraleTooltip}>
          <div class="sct-morale-row">
            <span class="sct-morale-tier">{tierLabel(morale.tier)}</span>
            <span class="sct-morale-total">Morale {morale.total}</span>
          </div>
          <div class="sct-morale-band">
            <div
              class="sct-morale-band-fill"
              style={{ width: `${Math.round(MORALE_TIER_FILL[morale.tier] * 100)}%` }}
            />
          </div>
        </div>
      )}

      {supplies !== null && (
        <span
          class={`sct-chip${supplyShort ? ' sct-chip--warn' : ''}`}
          title={supplyShort
            ? `Supplies short — ${supplyNeed - supplies} below what the remaining march needs`
            : `Supplies — ${supplies} on hand, ${supplyNeed} needed for the remaining ${nodesRemaining} traversals`}
        >
          <span class="sct-chip-icon">📦</span>
          <span class="sct-chip-value">{supplies}</span>
          <span class="sct-chip-divider">/</span>
          <span>{supplyNeed}</span>
        </span>
      )}

      {cohortCount > 0 && (
        <span class="sct-chip" title={`${cohortCount} cohorts · ${armySize.toLocaleString()} men`}>
          <span class="sct-chip-icon">⚔</span>
          <span class="sct-chip-value">{cohortCount}</span>
          <span class="sct-chip-divider">·</span>
          <span>{armySize.toLocaleString()}</span>
        </span>
      )}

      <div class="sct-resource-group">
        <span class="sct-resource" title={`Gold — ${RESOURCE_INFO.gold.label}`}>
          <span class="sct-chip-icon">{RESOURCE_INFO.gold.icon}</span>
          <span class="sct-resource-value">{gold.value}</span>
        </span>
        <span class="sct-resource" title={`Influence — ${RESOURCE_INFO.influence.label}`}>
          <span class="sct-chip-icon">{RESOURCE_INFO.influence.icon}</span>
          <span class="sct-resource-value">{influence.value}</span>
        </span>
      </div>
    </div>
  );
}
