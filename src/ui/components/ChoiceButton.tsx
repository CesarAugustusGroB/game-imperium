import type { EventChoice } from '../../game/events/event-types';
import type { ResourceType } from '../../game/core/commander';
import { RESOURCE_INFO } from '../../game/core/commander';

// ── One-time CSS injection ──
if (typeof document !== 'undefined' && !document.getElementById('choice-btn-styles')) {
  const el = document.createElement('style');
  el.id = 'choice-btn-styles';
  el.textContent = `
    .choice-btn { transition: all var(--duration-normal) var(--ease-default); }
    .choice-btn:not(:disabled):hover { border-color: var(--color-border-strong) !important; background: var(--color-bg-tertiary) !important; }
    .choice-btn:not(:disabled):active { transform: scale(0.99); }
    @keyframes bonus-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.6; }
    }
    .choice-btn-bonus { animation: bonus-pulse 1.5s ease-in-out infinite; }
  `;
  document.head.appendChild(el);
}

// ── Props ──

export interface ChoiceButtonProps {
  choice: EventChoice;
  index: number;
  onSelect: (index: number) => void;
  currentResources?: Partial<Record<ResourceType, number>>;
  isBonus?: boolean;
  disabled?: boolean;
}

// ── Affordability helper ──
// requiresResource is Partial<Record<ResourceType, number>> — ALL entries must be met
function checkAffordable(
  requiresResource: EventChoice['requiresResource'],
  currentResources: Partial<Record<ResourceType, number>> | undefined,
): boolean {
  if (!requiresResource) return true;
  for (const key of Object.keys(requiresResource) as ResourceType[]) {
    const required = requiresResource[key];
    if (required === undefined) continue;
    const available = currentResources?.[key] ?? 0;
    if (available < required) return false;
  }
  return true;
}

// ── EffectPill ──
function EffectPill({ resource, amount }: { resource: ResourceType; amount: number }) {
  const positive = amount > 0;
  const pillStyle: Record<string, string> = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '3px',
    padding: '2px 7px',
    borderRadius: 'var(--radius-sm)',
    fontSize: 'var(--font-size-xs)',
    fontWeight: '600',
    background: positive ? 'rgba(90,138,74,0.2)' : 'rgba(194,74,58,0.2)',
    border: `1px solid ${positive ? 'var(--color-success)' : 'var(--color-danger)'}`,
    color: positive ? 'var(--color-success)' : 'var(--color-danger)',
  };

  return (
    <span style={pillStyle}>
      <span>{RESOURCE_INFO[resource].icon}</span>
      <span>{positive ? `+${amount}` : `${amount}`}</span>
    </span>
  );
}

// ── ChoiceButton ──

export function ChoiceButton({
  choice,
  index,
  onSelect,
  currentResources,
  isBonus = false,
  disabled = false,
}: ChoiceButtonProps) {
  const canAfford = checkAffordable(choice.requiresResource, currentResources);
  const isDisabled = disabled || !canAfford;

  const buttonStyle: Record<string, string> = {
    position: 'relative',
    display: 'block',
    width: '100%',
    padding: '10px 14px',
    background: 'var(--color-bg-secondary)',
    border: '1px solid var(--color-border-default)',
    borderRadius: 'var(--radius-sm)',
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    opacity: isDisabled ? '0.5' : '1',
    textAlign: 'left',
    fontFamily: 'inherit',
  };

  return (
    <button
      class={`choice-btn${isBonus ? ' choice-btn-bonus' : ''}`}
      style={buttonStyle}
      disabled={isDisabled}
      onClick={() => !isDisabled && onSelect(index)}
    >
      {/* BONUS badge */}
      {isBonus && (
        <span
          style={{
            position: 'absolute',
            top: '6px',
            right: '8px',
            padding: '1px 6px',
            borderRadius: 'var(--radius-sm)',
            fontSize: 'var(--font-size-xs)',
            fontWeight: '700',
            color: 'var(--color-gold-primary)',
            border: '1px solid var(--color-gold-primary)',
            background: 'rgba(240,208,128,0.12)',
            letterSpacing: '0.04em',
          }}
        >
          BONUS
        </span>
      )}

      {/* Choice text */}
      <div
        style={{
          fontSize: 'var(--font-size-md)',
          color: 'var(--color-text-primary)',
          lineHeight: '1.4',
          marginBottom: choice.effects.length > 0 || !canAfford ? '8px' : '0',
          paddingRight: isBonus ? '56px' : '0',
        }}
      >
        {choice.text}
      </div>

      {/* Effects row */}
      {choice.effects.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: !canAfford ? '6px' : '0' }}>
          {choice.effects.map((effect, i) => (
            <EffectPill key={i} resource={effect.resource} amount={effect.amount} />
          ))}
        </div>
      )}

      {/* Cost indicator */}
      {!canAfford && choice.requiresResource && (
        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-danger)', marginTop: '2px' }}>
          {(Object.keys(choice.requiresResource) as ResourceType[])
            .filter(r => (choice.requiresResource![r] ?? 0) > (currentResources?.[r] ?? 0))
            .map(r => `Requires ${choice.requiresResource![r]} ${RESOURCE_INFO[r].icon}`)
            .join('  ')}
        </div>
      )}
    </button>
  );
}
