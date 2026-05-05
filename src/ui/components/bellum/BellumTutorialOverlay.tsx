// S34-03: First-run Bellum tutorial overlay.
// 4 steps walk the player through marching, top-bar stats, encounters, and
// the win condition. Persisted dismissal lives in the meta-save so it
// survives Abandon Run. Keyboard: Esc = Skip, Enter = Next / Begin.

import { useEffect, useRef, useState } from 'preact/hooks';
import { setTutorialDismissed } from '../../../game/core/meta-save';
import { MAX_SEASONS } from '../../../game/core/game-state';
import { CAMPAIGN_MOVEMENT_POINTS_MAX } from '../../../game/campaign/campaign-balance';
import { Corners } from '../motifs/Corners';

// ── One-time style injection ──────────────────────────────────────────────────

if (typeof document !== 'undefined' && !document.getElementById('bellum-tutorial-styles')) {
  const el = document.createElement('style');
  el.id = 'bellum-tutorial-styles';
  el.textContent = `
    @keyframes bellum-tutorial-in {
      from { opacity: 0; transform: scale(0.96) translateY(6px); }
      to   { opacity: 1; transform: scale(1) translateY(0); }
    }
    .bto-backdrop {
      position: fixed;
      inset: 0;
      z-index: 9998;
      background: rgba(8, 6, 14, 0.55);
      display: flex;
      align-items: flex-end;
      justify-content: center;
      padding: 0 16px;
    }
    .bto-backdrop--top {
      align-items: flex-start;
    }
    .bto-card {
      position: relative;
      max-width: 480px;
      width: 100%;
      background: rgba(22, 16, 10, 0.96);
      border: 1px solid rgba(212, 168, 67, 0.55);
      border-radius: var(--radius-md);
      padding: 28px 32px 24px;
      box-sizing: border-box;
      color: var(--imp-text, var(--color-text-secondary));
      font-family: var(--imp-font-body);
      box-shadow: 0 8px 40px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(212, 168, 67, 0.08) inset;
    }
    @media (prefers-reduced-motion: no-preference) {
      .bto-card {
        animation: bellum-tutorial-in 0.28s var(--ease-default, cubic-bezier(0.4, 0, 0.2, 1));
      }
    }
    .bto-card--bottom {
      margin-bottom: 18%;
    }
    .bto-card--top {
      margin-top: 18%;
    }
    .bto-eyebrow {
      font-family: var(--imp-font-display, var(--font-display));
      font-size: var(--font-size-xs, 10px);
      letter-spacing: 3px;
      text-transform: uppercase;
      color: var(--color-gold-dim, rgba(212, 168, 67, 0.6));
      margin: 0 0 6px;
    }
    .bto-title {
      font-family: var(--imp-font-display, var(--font-display));
      font-size: var(--font-size-xl, 20px);
      color: var(--color-gold-primary, #d4a843);
      margin: 0 0 12px;
      line-height: 1.2;
    }
    .bto-body {
      font-size: var(--font-size-sm, 13px);
      color: var(--color-text-secondary, rgba(220, 210, 190, 0.82));
      line-height: 1.6;
      margin: 0 0 24px;
    }
    .bto-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }
    .bto-step-indicator {
      font-size: var(--font-size-xs, 10px);
      letter-spacing: 1.5px;
      text-transform: uppercase;
      color: var(--color-text-muted, rgba(180, 160, 120, 0.5));
      font-family: var(--imp-font-display, var(--font-display));
    }
    .bto-btn-group {
      display: flex;
      gap: 8px;
    }
    .bto-btn {
      padding: 8px 18px;
      border-radius: var(--radius-sm, 3px);
      font-family: var(--imp-font-display, var(--font-display));
      font-size: var(--font-size-xs, 10px);
      letter-spacing: 2px;
      text-transform: uppercase;
      cursor: pointer;
      transition: background 140ms, border-color 140ms, color 140ms;
    }
    .bto-btn--skip {
      background: transparent;
      border: 1px solid rgba(212, 168, 67, 0.25);
      color: rgba(212, 168, 67, 0.5);
    }
    .bto-btn--skip:hover {
      border-color: rgba(212, 168, 67, 0.5);
      color: rgba(212, 168, 67, 0.85);
      background: rgba(212, 168, 67, 0.05);
    }
    .bto-btn--next {
      background: rgba(212, 168, 67, 0.18);
      border: 1px solid rgba(212, 168, 67, 0.65);
      color: var(--color-gold-primary, #d4a843);
    }
    .bto-btn--next:hover {
      background: rgba(212, 168, 67, 0.3);
      border-color: rgba(212, 168, 67, 0.9);
    }
    .bto-btn--begin {
      background: linear-gradient(180deg, rgba(212, 168, 67, 0.32), rgba(212, 168, 67, 0.22));
      border: 1px solid rgba(212, 168, 67, 0.85);
      color: var(--color-gold-primary, #d4a843);
      font-weight: 700;
    }
    .bto-btn--begin:hover {
      background: linear-gradient(180deg, rgba(212, 168, 67, 0.48), rgba(212, 168, 67, 0.36));
      border-color: #d4a843;
    }
  `;
  document.head.appendChild(el);
}

// ── Step data ─────────────────────────────────────────────────────────────────

interface StepDef {
  title: string;
  body: string;
  position: 'top' | 'bottom';
}

const STEPS: StepDef[] = [
  {
    title: 'March your legion',
    body: `↑ Click any glowing hex to march toward it. Each move costs 1 march point — ${CAMPAIGN_MOVEMENT_POINTS_MAX} per season.`,
    position: 'bottom',
  },
  {
    title: 'Watch your stats',
    body: '↑ Track march points, supplies, morale, the season clock, and your objective up here. Hover any chip for details.',
    position: 'bottom',
  },
  {
    title: 'Encounters await',
    body: '↓ Some hexes hold encounters — click them to face the choice. Battles, supply rolls, ambushes, recruits, more.',
    position: 'top',
  },
  {
    // S35-07: surface the resource-decision loop introduced by S35-02/04/05.
    // Players need to know that gold, iuniores, and momentum are spendable
    // mid-campaign, otherwise they hoard them assuming they only matter for
    // the post-run summary (the pre-S35 reality).
    title: 'Spend to survive',
    body: 'Choices have a price. Trade gold for supplies at merchants, spend iuniores to tend the wounded at camps, and sometimes silver buys you out of a fight.',
    position: 'top',
  },
  {
    title: 'Survive to win',
    body: `Hold the frontier until Season ${MAX_SEASONS} to force the Final Invasion, then win the boss battle to complete the campaign. Doom rises each season.`,
    position: 'bottom',
  },
];

const TOTAL = STEPS.length;

// ── Component ─────────────────────────────────────────────────────────────────

export function BellumTutorialOverlay() {
  const [step, setStep] = useState(1);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const primaryBtnRef = useRef<HTMLButtonElement | null>(null);

  const stepDef = STEPS[step - 1];
  const isLast = step === TOTAL;
  const titleId = 'bto-title';
  const bodyId = 'bto-body';

  function dismiss() {
    setTutorialDismissed(true);
  }

  function advance() {
    if (isLast) {
      dismiss();
    } else {
      setStep(step + 1);
    }
  }

  // Auto-focus the primary action each step so Enter / Tab start inside the
  // overlay rather than landing on whatever was focused on the map below.
  useEffect(() => {
    primaryBtnRef.current?.focus();
  }, [step]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        dismiss();
        return;
      }
      if (e.key === 'Enter') {
        advance();
        return;
      }
      // Trap Tab inside the overlay so screen readers and keyboard users
      // can't step out into the map controls behind the modal backdrop.
      if (e.key === 'Tab' && cardRef.current) {
        const focusables = cardRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [step]);

  return (
    <div
      class={`bto-backdrop${stepDef.position === 'top' ? ' bto-backdrop--top' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={bodyId}
    >
      <div ref={cardRef} class={`bto-card bto-card--${stepDef.position}`}>
        <Corners color="rgba(212, 168, 67, 0.45)" size={14} inset={6} thickness={1} />

        <p class="bto-eyebrow">Tutorial · Step {step} of {TOTAL}</p>
        <h2 id={titleId} class="bto-title">{stepDef.title}</h2>
        <p id={bodyId} class="bto-body">{stepDef.body}</p>

        <div class="bto-footer">
          <span class="bto-step-indicator">Step {step} of {TOTAL}</span>
          <div class="bto-btn-group">
            <button
              class="bto-btn bto-btn--skip"
              onClick={dismiss}
              type="button"
            >
              Skip
            </button>
            {isLast ? (
              <button
                ref={primaryBtnRef}
                class="bto-btn bto-btn--begin"
                onClick={dismiss}
                type="button"
              >
                Begin
              </button>
            ) : (
              <button
                ref={primaryBtnRef}
                class="bto-btn bto-btn--next"
                onClick={() => setStep(step + 1)}
                type="button"
              >
                Next
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
