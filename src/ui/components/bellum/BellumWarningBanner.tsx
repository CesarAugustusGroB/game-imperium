// S33-10: Warning banner for the Bellum HUD.
// Surfaces the highest-priority active warning from bellumWarningState,
// globalSeason, and MAX_SEASONS. Single banner at any time; auto-dismisses
// when conditions clear.

import { bellumWarningState } from '../../../game/campaign/campaign-defeat';
import { BELLUM_MORALE_WARNING_THRESHOLD } from '../../../game/campaign/campaign-defeat';
import type { BellumWarningState } from '../../../game/campaign/campaign-defeat';
import { globalSeason, MAX_SEASONS } from '../../../game/core/game-state';

// ── One-time style injection ──────────────────────────────────────────────────
if (typeof document !== 'undefined' && !document.getElementById('bellum-warning-banner-styles')) {
  const el = document.createElement('style');
  el.id = 'bellum-warning-banner-styles';
  el.textContent = `
    .bwb-outer {
      position: absolute;
      top: 64px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 20;
      pointer-events: none;
      display: flex;
      justify-content: center;
      max-width: min(540px, 92vw);
    }
    .bwb-inner {
      pointer-events: auto;
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 10px 18px;
      border: 1px solid;
      border-radius: var(--radius-md);
      backdrop-filter: blur(4px);
      box-shadow: 0 4px 20px rgba(0,0,0,0.5);
      width: 100%;
    }
    .bwb-inner.bwb-danger {
      border-color: var(--color-danger);
      background: rgba(122, 36, 50, 0.85);
    }
    .bwb-inner.bwb-warning {
      border-color: var(--color-gold-primary);
      background: rgba(40, 28, 12, 0.92);
    }
    .bwb-icon {
      font-size: 28px;
      line-height: 1;
      flex-shrink: 0;
    }
    .bwb-text {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    .bwb-title {
      font-family: var(--imp-font-display);
      font-size: var(--font-size-md);
      color: var(--color-gold-primary);
      font-weight: 700;
      letter-spacing: 1px;
      text-transform: uppercase;
      line-height: 1.2;
    }
    .bwb-message {
      font-family: var(--imp-font-body);
      font-size: var(--font-size-sm);
      color: var(--color-text-secondary);
      line-height: 1.4;
    }
    @media (max-width: 720px) {
      .bwb-outer {
        top: 80px;
        max-width: min(90vw, 380px);
      }
      .bwb-icon {
        font-size: 22px;
      }
      .bwb-title {
        font-size: var(--font-size-sm);
      }
      .bwb-message {
        font-size: var(--font-size-xs);
      }
    }
  `;
  document.head.appendChild(el);
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type BellumWarningKind =
  | 'final-invasion-ready'
  | 'army-wiped'
  | 'starvation'
  | 'morale-critical'
  | 'final-invasion-imminent'
  | null;

export type BellumWarningResolved = {
  kind: BellumWarningKind;
  icon: string;
  title: string;
  message: string;
  tone: 'danger' | 'warning';
};

// ── Pure resolver ─────────────────────────────────────────────────────────────

/**
 * Pick the highest-priority Bellum warning to display.
 * Priority: final-invasion-ready > army-wiped > starvation >
 *           morale-critical > final-invasion-imminent > none.
 * Returns kind=null when no warning applies.
 */
export function selectActiveWarning(
  warnings: BellumWarningState,
  season: number,
  maxSeasons: number,
): BellumWarningResolved {
  if (season >= maxSeasons) {
    return {
      kind: 'final-invasion-ready',
      icon: '⚔',
      title: 'FINAL INVASION',
      message: 'The enemy host descends. Engage or fall.',
      tone: 'danger',
    };
  }
  if (warnings.armyWiped) {
    return {
      kind: 'army-wiped',
      icon: '💀',
      title: 'Army Wiped',
      message: 'No cohorts remain in fighting condition.',
      tone: 'danger',
    };
  }
  if (warnings.starvationWarning) {
    return {
      kind: 'starvation',
      icon: '📦',
      title: 'Out of Supplies',
      message: 'Each starved march costs HP and morale. Defeat at 3 streak.',
      tone: 'danger',
    };
  }
  if (warnings.moraleCritical) {
    return {
      kind: 'morale-critical',
      icon: '🔥',
      title: 'Morale Failing',
      message: `Morale at or below ${BELLUM_MORALE_WARNING_THRESHOLD}. Defeat triggers at 0.`,
      tone: 'warning',
    };
  }
  if (season === maxSeasons - 1) {
    return {
      kind: 'final-invasion-imminent',
      icon: '⏳',
      title: 'Final Invasion Approaches',
      message: 'One season remains before the host arrives.',
      tone: 'warning',
    };
  }
  return {
    kind: null,
    icon: '',
    title: '',
    message: '',
    tone: 'warning',
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

/** Displays the highest-priority Bellum warning, or nothing when clear. */
export function BellumWarningBanner() {
  const warnings = bellumWarningState.value;
  const season = globalSeason.value;
  const resolved = selectActiveWarning(warnings, season, MAX_SEASONS);

  if (resolved.kind === null) return null;

  return (
    <div class="bwb-outer" role="alert">
      <div class={`bwb-inner bwb-${resolved.tone}`}>
        <span class="bwb-icon" aria-hidden="true">{resolved.icon}</span>
        <div class="bwb-text">
          <div class="bwb-title">{resolved.title}</div>
          <div class="bwb-message">{resolved.message}</div>
        </div>
      </div>
    </div>
  );
}
