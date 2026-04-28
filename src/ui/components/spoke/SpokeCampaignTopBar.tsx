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
    /* Bronze hammered strip — full-width header band. */
    .spoke-campaign-topbar {
      display: flex;
      align-items: center;
      gap: 22px;
      width: 100%;
      padding: 10px 22px 10px 18px;
      background:
        linear-gradient(180deg,
          rgba(58, 42, 22, 0.95) 0%,
          rgba(38, 26, 14, 0.97) 50%,
          rgba(22, 16, 10, 0.97) 100%);
      border-bottom: 1px solid rgba(212, 168, 67, 0.55);
      box-shadow:
        inset 0 1px 0 rgba(212, 168, 67, 0.25),
        inset 0 -1px 0 rgba(0, 0, 0, 0.6),
        0 4px 14px rgba(0, 0, 0, 0.5);
      box-sizing: border-box;
    }

    /* Eagle / laurel motif anchoring the left edge. */
    .sct-eagle {
      width: 40px;
      height: 40px;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 26px;
      color: var(--color-gold-primary);
      filter: drop-shadow(0 0 4px rgba(212, 168, 67, 0.4));
    }

    .sct-label {
      flex: 0 1 280px;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 1px;
      padding-right: 18px;
      border-right: 1px solid rgba(212, 168, 67, 0.18);
    }
    .sct-label-eyebrow {
      font-family: var(--font-display);
      font-size: 10px;
      letter-spacing: 2.5px;
      text-transform: uppercase;
      color: rgba(212, 168, 67, 0.7);
    }
    .sct-label-title {
      font-family: var(--font-display);
      font-size: var(--font-size-md);
      font-weight: 700;
      color: var(--color-gold-primary);
      letter-spacing: 1.8px;
      text-transform: uppercase;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      line-height: 1.15;
    }
    .sct-label-meta {
      font-size: 10px;
      color: rgba(212, 168, 67, 0.55);
      letter-spacing: 1.5px;
      text-transform: uppercase;
    }

    /* Center stat strip — chips evenly distributed. */
    .sct-stats {
      display: flex;
      align-items: center;
      gap: 18px;
      flex: 1 1 auto;
      flex-wrap: wrap;
    }

    /* Morale meter — wide pill with a tier band so it reads as
       "earned standing", not a stat-chip number. */
    .sct-morale {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 130px;
      padding: 5px 10px;
      background: rgba(14, 8, 4, 0.55);
      border: 1px solid var(--sct-morale-color, rgba(180, 160, 100, 0.4));
      border-radius: 3px;
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

    /* Inline stat — eyebrow label above value, wheat-leaf separator vibe.
       No box, just a tabular column so the row reads like a parchment ledger. */
    .sct-stat {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 1px;
      min-width: 70px;
      padding: 0 4px;
      font-variant-numeric: tabular-nums;
    }
    .sct-stat-row {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .sct-stat-icon {
      font-size: 18px;
      filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.6));
    }
    .sct-stat-eyebrow {
      font-family: var(--font-display);
      font-size: 10px;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: rgba(212, 168, 67, 0.55);
    }
    .sct-stat-value {
      font-family: var(--font-display);
      font-size: var(--font-size-sm);
      font-weight: 700;
      color: var(--color-gold-primary);
      letter-spacing: 0.5px;
    }
    .sct-stat-delta {
      font-size: 10px;
      color: #6ab87a;
      letter-spacing: 0.5px;
      margin-left: 4px;
    }
    .sct-stat-sub {
      font-size: 10px;
      color: rgba(212, 168, 67, 0.55);
      letter-spacing: 0.5px;
    }
    .sct-stat--warn .sct-stat-value { color: var(--color-danger, #d96a6a); }

    /* Right-edge action icons (3 buttons in target). */
    .sct-actions {
      display: flex;
      gap: 6px;
      flex-shrink: 0;
      margin-left: auto;
      padding-left: 18px;
      border-left: 1px solid rgba(212, 168, 67, 0.18);
    }
    .sct-icon-btn {
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(14, 8, 4, 0.5);
      border: 1px solid rgba(212, 168, 67, 0.35);
      border-radius: 3px;
      color: rgba(212, 168, 67, 0.7);
      font-size: 16px;
      cursor: pointer;
      transition: all var(--duration-fast) var(--ease-default);
    }
    .sct-icon-btn:hover {
      color: var(--color-gold-primary);
      border-color: rgba(212, 168, 67, 0.7);
      background: rgba(28, 18, 8, 0.7);
    }

    @media (max-width: 1100px) {
      .spoke-campaign-topbar { gap: 12px; padding: 10px 14px; flex-wrap: wrap; }
      .sct-stats { gap: 12px; }
      .sct-label { flex: 1 1 200px; border-right: none; padding-right: 0; }
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
      <span class="sct-eagle" aria-hidden="true">𓅂</span>

      <div class="sct-label">
        <span class="sct-label-eyebrow">
          {spoke.posture === 'attacking' ? 'Offensive Campaign' : 'Defensive Campaign'}
        </span>
        <span class="sct-label-title" title={spoke.label}>{spoke.label}</span>
        <span class="sct-label-meta">
          {resolvedCount}/{spoke.nodes.length} Landmarks
          {spoke.duration > 1 && <> · Season {spoke.currentSeason}/{spoke.duration}</>}
        </span>
      </div>

      <div class="sct-stats">
        {supplies !== null && (
          <div
            class={`sct-stat${supplyShort ? ' sct-stat--warn' : ''}`}
            title={supplyShort
              ? `Supplies short — ${supplyNeed - supplies} below what the remaining march needs`
              : `Supplies — ${supplies} on hand, ${supplyNeed} needed for the remaining ${nodesRemaining} traversals`}
          >
            <span class="sct-stat-eyebrow">Supplies</span>
            <div class="sct-stat-row">
              <span class="sct-stat-icon" aria-hidden="true">🌾</span>
              <span class="sct-stat-value">{supplies}</span>
              <span class="sct-stat-sub">/{supplyNeed}</span>
            </div>
          </div>
        )}

        {morale && (
          <div class="sct-stat" style={moraleStyle} title={moraleTooltip}>
            <span class="sct-stat-eyebrow">Morale</span>
            <div class="sct-stat-row">
              <span class="sct-stat-icon" aria-hidden="true">🏛</span>
              <span class="sct-stat-value" style={{ color: MORALE_TIER_COLOR[morale.tier] }}>
                {tierLabel(morale.tier)}
              </span>
              <span class="sct-stat-sub">({morale.total})</span>
            </div>
          </div>
        )}

        <div class="sct-stat" title={`Gold — ${RESOURCE_INFO.gold.label}`}>
          <span class="sct-stat-eyebrow">Gold</span>
          <div class="sct-stat-row">
            <span class="sct-stat-icon" aria-hidden="true">{RESOURCE_INFO.gold.icon}</span>
            <span class="sct-stat-value">{gold.value}</span>
          </div>
        </div>

        <div class="sct-stat" title={`Influence — ${RESOURCE_INFO.influence.label}`}>
          <span class="sct-stat-eyebrow">Influence</span>
          <div class="sct-stat-row">
            <span class="sct-stat-icon" aria-hidden="true">{RESOURCE_INFO.influence.icon}</span>
            <span class="sct-stat-value">{influence.value}</span>
          </div>
        </div>

        {cohortCount > 0 && (
          <div class="sct-stat" title={`${cohortCount} cohorts · ${armySize.toLocaleString()} men`}>
            <span class="sct-stat-eyebrow">Army</span>
            <div class="sct-stat-row">
              <span class="sct-stat-icon" aria-hidden="true">⚔</span>
              <span class="sct-stat-value">{armySize.toLocaleString()}</span>
              <span class="sct-stat-sub">({cohortCount} cohorts)</span>
            </div>
          </div>
        )}
      </div>

      <div class="sct-actions">
        <button class="sct-icon-btn" title="Decretum" aria-label="Decretum">⚜</button>
        <button class="sct-icon-btn" title="Doctrines" aria-label="Doctrines">📜</button>
        <button class="sct-icon-btn" title="Settings" aria-label="Settings">⚙</button>
      </div>
    </div>
  );
}
