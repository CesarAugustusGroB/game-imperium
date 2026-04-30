// S30-10: lightweight modal that fronts the campaign hex event flow.
// Reads activeEventTileId + hexTiles signals, derives the payload from
// getEventContent, and clears the event on any action so re-entry won't
// re-fire the modal. The full encounter dispatch (battle/forage/etc.)
// is deferred to S31's gameplay-systems sprint.

import { useEffect } from 'preact/hooks';
import { activeEventTileId, hexTiles, setActiveEvent } from '../../game/campaign/campaign-state';
import { getEventColor, getEventContent, getEventIcon } from '../../game/campaign/events';
import { resolveEncounter } from '../../game/campaign/encounter-bridge';
import { addNotification } from '../notifications/notification-store';
import { OrnateFrame, OrnateHeader, OrnateDivider } from './OrnateFrame';
import { colorToCss } from '../../utils/color';

// Shared CSS injection (mirrors EventModal pattern).
if (typeof document !== 'undefined' && !document.getElementById('campaign-event-modal-styles')) {
  const el = document.createElement('style');
  el.id = 'campaign-event-modal-styles';
  el.textContent = `
    @keyframes campaign-event-modal-in {
      from { opacity: 0; transform: scale(0.95) translateY(8px); }
      to   { opacity: 1; transform: scale(1) translateY(0); }
    }
    .campaign-event-modal-card {
      animation: campaign-event-modal-in 0.25s var(--ease-default);
      position: relative;
    }
    .campaign-event-close-btn {
      position: absolute;
      top: 12px;
      right: 12px;
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: transparent;
      border: 1px solid rgba(212, 168, 67, 0.3);
      border-radius: var(--radius-sm);
      color: var(--color-gold-dim);
      font-size: 16px;
      line-height: 1;
      cursor: pointer;
      transition: color 0.15s, border-color 0.15s, background 0.15s;
      z-index: 1;
    }
    .campaign-event-close-btn:hover {
      color: var(--color-gold-primary);
      border-color: rgba(212, 168, 67, 0.7);
      background: rgba(212, 168, 67, 0.08);
    }
    .campaign-event-action {
      display: block;
      width: 100%;
      padding: 10px 16px;
      background: rgba(212, 168, 67, 0.08);
      border: 1px solid rgba(212, 168, 67, 0.45);
      border-radius: var(--radius-sm);
      color: var(--imp-text);
      font-family: var(--imp-font-body);
      font-size: var(--font-size-md);
      letter-spacing: 0.04em;
      text-align: left;
      cursor: pointer;
      transition: background 0.15s, border-color 0.15s;
    }
    .campaign-event-action:hover {
      background: rgba(212, 168, 67, 0.18);
      border-color: rgba(212, 168, 67, 0.75);
    }
    /* Primary action (first choice) — filled gold-tinted, slightly bolder */
    .campaign-event-action--primary {
      background: linear-gradient(180deg, rgba(212, 168, 67, 0.28), rgba(212, 168, 67, 0.18));
      border-color: rgba(212, 168, 67, 0.85);
      color: var(--color-gold-primary);
      font-weight: 700;
    }
    .campaign-event-action--primary:hover {
      background: linear-gradient(180deg, rgba(212, 168, 67, 0.40), rgba(212, 168, 67, 0.28));
      border-color: rgba(212, 168, 67, 1);
    }
  `;
  document.head.appendChild(el);
}

export function CampaignEventModal() {
  const tileId = activeEventTileId.value;

  // 3a-3: Escape key dismisses without consuming the event.
  useEffect(() => {
    if (!tileId) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveEvent(null);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [tileId]);

  if (!tileId) return null;

  const tile = hexTiles.value.find((t) => t.id === tileId);
  if (!tile) return null;

  const content = getEventContent(tile);
  if (!content) return null;

  const accent = colorToCss(getEventColor(tile.event));
  const icon = getEventIcon(tile.event);

  const handleAction = (index: number): void => {
    // S31-05a: dispatch the chosen action through the encounter bridge.
    // Battle/elite/ambush apply placeholder casualty deltas — full BattleScreenV2
    // launch lands in S31-05b.
    const outcome = resolveEncounter(tile, index);
    if (outcome.message) {
      addNotification({
        kind: 'toast',
        message: outcome.message,
        icon,
        color: accent,
      });
    }
  };

  // 3a-2: backdrop click dismisses without consuming the event.
  const handleBackdropClick = (): void => {
    setActiveEvent(null);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
        padding: '16px',
      }}
      onClick={handleBackdropClick}
    >
      <OrnateFrame
        className="campaign-event-modal-card"
        width="min(520px, 92vw)"
        padding="compact"
        style={{ maxHeight: '85vh', overflow: 'hidden' }}
        onClick={(e: MouseEvent) => e.stopPropagation()}
      >
        {/* 3a-1: Close button — top-right of OrnateFrame. Does not consume the event. */}
        <button
          type="button"
          class="campaign-event-close-btn"
          onClick={() => setActiveEvent(null)}
          aria-label="Close encounter"
        >
          ×
        </button>

        <div
          style={{
            height: '120px',
            width: 'calc(100% + 48px)',
            marginLeft: '-24px',
            marginTop: '-20px',
            marginBottom: '0',
            background: `linear-gradient(135deg, ${accent}55, ${accent}1a)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span
            style={{
              fontSize: '48px',
              color: accent,
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
              fontWeight: 'bold',
            }}
          >
            {icon}
          </span>
        </div>

        <div style={{ marginTop: '16px' }}>
          <OrnateHeader
            titleSize="md"
            eyebrow="Encounter"
            title={content.title}
            accentColor={accent}
          />
        </div>

        <p
          style={{
            margin: '0 0 var(--space-md) 0',
            fontSize: 'var(--font-size-md)',
            color: 'var(--color-text-secondary)',
            lineHeight: 1.5,
          }}
        >
          {content.description}
        </p>

        <OrnateDivider />

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-sm)',
          }}
        >
          {/* 3b: first action is primary (filled gold-tinted); subsequent are secondary (outline). */}
          {content.actions.map((action, i) => (
            <button
              key={i}
              type="button"
              class={i === 0 ? 'campaign-event-action campaign-event-action--primary' : 'campaign-event-action'}
              onClick={() => handleAction(i)}
            >
              {action}
            </button>
          ))}
        </div>
      </OrnateFrame>
    </div>
  );
}
