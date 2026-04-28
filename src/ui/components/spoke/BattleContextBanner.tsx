/**
 * Campaign-context banner shown at the top of BattleScreenV2 (S27-10).
 *
 * Reads `currentBattleContext` and renders the landmark name, terrain pill,
 * encounter type, and modifier chips with `title` tooltips so the player
 * knows where they are and what's biasing this battle. Hidden when the
 * context is null (quick battle) per AC6.
 */

import { currentBattleContext } from '../../../battle/battle-signals';
import { BATTLE_MODIFIER_LABELS } from '../../../game/progression/battle-terrain-modifiers';

if (typeof document !== 'undefined' && !document.getElementById('battle-context-banner-styles')) {
  const el = document.createElement('style');
  el.id = 'battle-context-banner-styles';
  el.textContent = `
    .battle-context-banner {
      /* Anchored on the left, below the YOUR ARMY panel (which sits at
         top:12px and runs ~110px tall). Same z-index as the rest of the
         battle HUD so it stays in-layer. */
      position: fixed;
      top: 140px;
      left: 12px;
      z-index: 20;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 6px;
      padding: 10px 14px;
      background: rgba(14, 12, 28, 0.85);
      border: 1px solid rgba(180, 160, 100, 0.32);
      border-radius: var(--radius-md);
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
      pointer-events: auto;
      max-width: 320px;
      box-sizing: border-box;
    }
    @media (max-width: 720px) {
      /* On narrow viewports the army panel may stack taller; push the
         banner a bit further down so it never visually crowds it. */
      .battle-context-banner { top: 168px; max-width: 280px; }
    }
    .battle-context-eyebrow {
      font-family: var(--font-display);
      font-size: var(--font-size-xs);
      letter-spacing: 2px;
      text-transform: uppercase;
      color: var(--color-gold-dim);
    }
    .battle-context-title {
      font-family: var(--font-display);
      font-size: var(--font-size-md);
      font-weight: 700;
      color: var(--color-gold-primary);
      letter-spacing: 2px;
      text-transform: uppercase;
      line-height: 1.1;
      text-align: left;
    }
    .battle-context-row {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
      justify-content: flex-start;
    }
    .battle-context-pill {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 8px;
      border-radius: var(--radius-sm);
      font-size: var(--font-size-xs);
      font-weight: 600;
      letter-spacing: 0.5px;
      background: rgba(40, 60, 80, 0.55);
      border: 1px solid rgba(100, 140, 180, 0.32);
      color: rgba(150, 190, 220, 0.85);
    }
    .battle-context-modifier {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 5px 10px;
      background: rgba(60, 50, 30, 0.55);
      border: 1px solid var(--color-border-strong);
      border-radius: var(--radius-sm);
      font-size: var(--font-size-sm);
      font-weight: 600;
      color: var(--color-text-primary);
      cursor: help;
    }
    @media (max-width: 520px) {
      .battle-context-banner { padding: 8px 12px; max-width: 96vw; }
      .battle-context-title  { font-size: var(--font-size-sm); letter-spacing: 1.5px; }
    }
  `;
  document.head.appendChild(el);
}

const ENCOUNTER_LABEL: Record<string, string> = {
  battle:       'Pitched Battle',
  elite_battle: 'Elite Engagement',
  boss:         'Boss Encounter',
  ambush:       'Ambush',
  siege:        'Siege',
};

function capitalize(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}

export function BattleContextBanner() {
  const ctx = currentBattleContext.value;
  if (!ctx) return null;

  // Suppress for legacy spokes that carry no Itinerarium metadata — the
  // banner would be a near-empty frame with just an encounter label.
  if (!ctx.landmarkName && !ctx.terrain && ctx.modifiers.length === 0 && ctx.enemyStrength === null) return null;

  const encounterLabel = ENCOUNTER_LABEL[ctx.encounterType] ?? capitalize(ctx.encounterType.replace(/_/g, ' '));

  return (
    <div class="battle-context-banner" role="region" aria-label="Battle context">
      <div class="battle-context-eyebrow">{encounterLabel}</div>
      {ctx.landmarkName && (
        <div class="battle-context-title">{ctx.landmarkName}</div>
      )}
      <div class="battle-context-row">
        {ctx.terrain && (
          <span class="battle-context-pill" title="Battle terrain">
            Terrain: {capitalize(ctx.terrain)}
          </span>
        )}
        {ctx.enemyStrength !== null && (
          <span class="battle-context-pill" title="Enemy strength rating" style={{
            background: 'rgba(120, 50, 40, 0.4)',
            borderColor: 'rgba(200, 100, 80, 0.35)',
            color: '#e0a090',
          }}>
            Enemy: {ctx.enemyStrength}
          </span>
        )}
      </div>
      {ctx.modifiers.length > 0 && (
        <div class="battle-context-row">
          {ctx.modifiers.map((mod) => {
            const info = BATTLE_MODIFIER_LABELS[mod];
            return (
              <span
                key={mod}
                class="battle-context-modifier"
                title={info ? `${info.label} — ${info.description}` : mod}
              >
                {info?.icon ?? '⚔'} {info?.label ?? mod}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
