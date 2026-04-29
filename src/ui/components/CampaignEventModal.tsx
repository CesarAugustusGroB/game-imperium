// S30-10: lightweight modal that fronts the campaign hex event flow.
// Reads activeEventTileId + hexTiles signals, derives the payload from
// getEventContent, and clears the event on any action so re-entry won't
// re-fire the modal. The full encounter dispatch (battle/forage/etc.)
// is deferred to S31's gameplay-systems sprint.

import { activeEventTileId, consumeEvent, hexTiles } from '../../game/campaign/campaign-state';
import { getEventColor, getEventContent, getEventIcon } from '../../game/campaign/events';
import { OrnateFrame, OrnateHeader, OrnateDivider } from './OrnateFrame';

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
  `;
  document.head.appendChild(el);
}

function colorToCss(hex: number): string {
  return '#' + hex.toString(16).padStart(6, '0');
}

export function CampaignEventModal() {
  const tileId = activeEventTileId.value;
  if (!tileId) return null;

  const tile = hexTiles.value.find((t) => t.id === tileId);
  if (!tile) return null;

  const content = getEventContent(tile);
  if (!content) return null;

  const accent = colorToCss(getEventColor(tile.event));
  const icon = getEventIcon(tile.event);

  const handleAction = (_index: number): void => {
    // S31 will dispatch the chosen action through the encounter pipeline.
    // For S30 the choice is purely narrative — clear the event and close.
    consumeEvent(tileId);
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
    >
      <OrnateFrame
        className="campaign-event-modal-card"
        width="min(520px, 92vw)"
        padding="compact"
        style={{ maxHeight: '85vh', overflow: 'hidden' }}
        onClick={(e: MouseEvent) => e.stopPropagation()}
      >
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
          {content.actions.map((action, i) => (
            <button
              key={i}
              type="button"
              class="campaign-event-action"
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
