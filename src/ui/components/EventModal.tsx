import type { GameEvent } from '../../game/events/event-types';
import type { Faction, ResourceType } from '../../game/core/commander';
import { FACTION_COLORS } from '../../game/core/commander';
import { ChoiceButton } from './ChoiceButton';

// ── One-time CSS injection ──
if (typeof document !== 'undefined' && !document.getElementById('event-modal-styles')) {
  const el = document.createElement('style');
  el.id = 'event-modal-styles';
  el.textContent = `
    @keyframes event-modal-in {
      from { opacity: 0; transform: scale(0.95) translateY(8px); }
      to   { opacity: 1; transform: scale(1) translateY(0); }
    }
    .event-modal-card {
      animation: event-modal-in 0.25s var(--ease-default);
    }
  `;
  document.head.appendChild(el);
}

// ── Faction symbol map ──
const FACTION_SYMBOLS: Record<string, string> = {
  gold:    '✝',
  red:     '⚔',
  blue:    '🕊',
  purple:  '💎',
  white:   '⚖',
  neutral: '📜',
};

// ── Banner gradient helpers ──
function getBannerGradient(event: GameEvent): string {
  if (event.color === 'neutral') {
    return 'linear-gradient(135deg, rgba(30,25,60,0.8), rgba(50,40,80,0.6))';
  }
  const hex = FACTION_COLORS[event.color];
  // Convert hex to rgba with low opacity
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `linear-gradient(135deg, rgba(${r},${g},${b},0.45), rgba(${r},${g},${b},0.2))`;
}

function getFactionColor(event: GameEvent): string {
  return event.color !== 'neutral'
    ? FACTION_COLORS[event.color as Faction]
    : 'var(--color-border-default)';
}

// ── Props ──

export interface EventModalProps {
  event: GameEvent;
  onChoice: (index: number) => void;
  currentResources?: Partial<Record<ResourceType, number>>;
  bonusChoiceIndex?: number;
}

// ── EventModal ──

export function EventModal({
  event,
  onChoice,
  currentResources,
  bonusChoiceIndex,
}: EventModalProps) {
  return (
    // Backdrop — fixed, non-clickable
    <div
      style={{
        position: 'fixed',
        inset: '0',
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: '200',
        padding: '16px',
      }}
    >
      {/* Modal card */}
      <div
        class="event-modal-card"
        style={{
          maxWidth: '520px',
          width: '100%',
          background: 'var(--color-bg-primary)',
          borderTop: `3px solid ${getFactionColor(event)}`,
          borderRight: '1px solid var(--color-border-default)',
          borderBottom: '1px solid var(--color-border-default)',
          borderLeft: '1px solid var(--color-border-default)',
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        {/* Illustration banner */}
        <div
          style={{
            height: '160px',
            width: '100%',
            background: getBannerGradient(event),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            {/* Faction symbol */}
            <span
              style={{
                fontSize: '36px',
                opacity: 0.55,
                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))',
                color: event.color !== 'neutral' ? FACTION_COLORS[event.color as Faction] : '#fff',
              }}
            >
              {FACTION_SYMBOLS[event.color] ?? FACTION_SYMBOLS['neutral']}
            </span>
            {/* Tier badge */}
            <span
              style={{
                padding: '6px 14px',
                border: '2px solid var(--color-gold-primary)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--color-gold-primary)',
                fontSize: 'var(--font-size-lg)',
                fontWeight: '700',
                letterSpacing: '0.08em',
                background: 'rgba(0,0,0,0.4)',
              }}
            >
              {`T${event.tier}`}
            </span>
          </div>
        </div>

        {/* Content area */}
        <div style={{ padding: '16px 20px 20px' }}>
          {/* Title row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '10px',
            }}
          >
            <h2
              style={{
                margin: '0',
                fontSize: 'var(--font-size-lg)',
                color: 'var(--color-gold-primary)',
                fontWeight: '600',
              }}
            >
              {event.title}
            </h2>
            <span
              style={{
                padding: '2px 8px',
                border: '1px solid var(--color-gold-primary)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 'var(--font-size-xs)',
                color: 'var(--color-text-muted)',
                background: 'rgba(240,208,128,0.08)',
                flexShrink: '0',
                marginLeft: '10px',
              }}
            >
              {`T${event.tier}`}
            </span>
          </div>

          {/* Description */}
          <p
            style={{
              margin: '0 0 var(--space-md) 0',
              fontSize: 'var(--font-size-md)',
              color: 'var(--color-text-secondary)',
              lineHeight: '1.5',
            }}
          >
            {event.description}
          </p>

          {/* Divider */}
          <div
            style={{
              height: '1px',
              background: 'var(--color-border-subtle)',
              marginBottom: 'var(--space-md)',
            }}
          />

          {/* Choices */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
            {event.choices.map((choice, i) => (
              <ChoiceButton
                key={i}
                choice={choice}
                index={i}
                onSelect={onChoice}
                currentResources={currentResources}
                isBonus={bonusChoiceIndex === i}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
