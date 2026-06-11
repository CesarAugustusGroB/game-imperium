import type { Doctrine, DoctrineEffect } from '../../game/items/doctrine';
import { getCurrentEffects, getUpgradeCost, getDoctrineSellPrice } from '../../game/items/doctrine';
import { FACTION_COLORS } from '../../game/core/commander';
import type { ResourceType } from '../../game/core/commander';
import { Tooltip } from './Tooltip';
import { CostInline, ResourceAmount } from './ResourceIcon';
import { getPriorityStyle, priorityClass, type CardPriority } from './card-priority';

// ── One-time CSS injection ──
if (typeof document !== 'undefined' && !document.getElementById('doctrine-slot-styles')) {
  const el = document.createElement('style');
  el.id = 'doctrine-slot-styles';
  el.textContent = `
    .doctrine-slot-card {
      transition: box-shadow var(--duration-normal) var(--ease-default), transform var(--duration-fast) var(--ease-default);
    }
    .doctrine-slot-card:hover {
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
    }
    .doctrine-slot-empty {
      transition: background var(--duration-normal) var(--ease-default), border-color var(--duration-normal) var(--ease-default);
      cursor: default;
    }
    .doctrine-slot-empty.doctrine-slot-clickable {
      cursor: pointer;
    }
    .doctrine-slot-empty.doctrine-slot-clickable:hover {
      background: rgba(40, 36, 60, 0.9) !important;
      border-color: var(--color-border-strong) !important;
    }
    .doctrine-upgrade-btn {
      transition: all var(--duration-normal) var(--ease-default);
      cursor: pointer;
    }
    .doctrine-upgrade-btn:hover {
      filter: brightness(1.25);
      box-shadow: 0 0 10px var(--color-border-default);
    }
    .doctrine-upgrade-btn:active {
      transform: scale(0.96);
    }
    .doctrine-unequip-btn {
      transition: color var(--duration-normal) var(--ease-default), border-color var(--duration-normal) var(--ease-default);
      cursor: pointer;
    }
    .doctrine-unequip-btn:hover {
      color: #e0d8b8 !important;
      border-color: var(--color-border-strong) !important;
    }
    .doctrine-unequip-btn:active {
      transform: scale(0.96);
    }
  `;
  document.head.appendChild(el);
}

// ── Constants ──

const LEVEL_NUMERALS = ['I', 'II', 'III'] as const;

const RESOURCE_LABELS: Record<ResourceType, string> = {
  gold: 'Gold',
  iuniores: 'Iuniores',
};

// ── Props ──

interface DoctrineSlotProps {
  doctrine: Doctrine | null;
  slot: number;
  equippable?: boolean;
  onUpgrade?: () => void;
  onUnequip?: () => void;
  onEquip?: () => void;
}

// ── Helpers ──

function formatEffectDescription(doctrine: Doctrine): string {
  const effects = getCurrentEffects(doctrine);
  if (effects.length === 0) return '—';
  const effect = effects[0];
  switch (effect.type) {
    case 'shop-discount':
      return `${effect.percent}% shop discount`;
    case 'income-modifier':
      return `${RESOURCE_LABELS[effect.resource]} income ×${effect.multiplier.toFixed(2)}`;
    case 'upkeep-reduction':
      return `${effect.percent}% upkeep reduction`;
    case 'embark-bonus':
      return `+${effect.amount} ${effect.stat} on campaign start`;
    default:
      return '—';
  }
}

function formatDoctrineEffect(effect: DoctrineEffect): string {
  switch (effect.type) {
    case 'shop-discount':
      return `${effect.percent}% shop discount`;
    case 'income-modifier': {
      const pct = Math.round((effect.multiplier - 1) * 100);
      return `${pct >= 0 ? '+' : ''}${pct}% ${RESOURCE_LABELS[effect.resource]} income`;
    }
    case 'upkeep-reduction':
      return `${effect.percent}% upkeep reduction`;
    case 'embark-bonus':
      return `+${effect.amount} ${effect.stat} on campaign start`;
    default:
      return '—';
  }
}

// ── Component ──

export function DoctrineSlot({
  doctrine,
  slot,
  equippable = true,
  onUpgrade,
  onUnequip,
  onEquip,
}: DoctrineSlotProps) {
  // ── Empty slot ──
  if (doctrine === null) {
    return (
      <div
        class={`doctrine-slot-empty ${priorityClass(onEquip ? 'urgent' : 'neutral')}${onEquip ? ' doctrine-slot-clickable' : ''}`}
        onClick={onEquip}
        style={{
          width: 'min(140px, calc(25vw - 8px))',
          height: '180px',
          background: 'var(--color-bg-secondary)',
          border: '2px dashed var(--color-border-subtle)',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          userSelect: 'none',
          ...getPriorityStyle(onEquip ? 'urgent' : 'neutral'),
        }}
      >
        <span style={{
          fontSize: '28px',
          color: 'var(--color-text-muted)',
          lineHeight: 1,
          fontWeight: 300,
        }}>+</span>
        <span style={{
          fontSize: 'var(--font-size-sm)',
          letterSpacing: '1.5px',
          textTransform: 'uppercase',
          color: 'var(--color-text-muted)',
        }}>
          Empty Slot
        </span>
        <span style={{
          fontSize: 'var(--font-size-xs)',
          color: 'var(--color-border-subtle)',
          letterSpacing: '0.8px',
        }}>
          #{slot + 1}
        </span>
      </div>
    );
  }

  // ── Filled slot ──
  const factionColor = FACTION_COLORS[doctrine.color];
  const levelNumeral = LEVEL_NUMERALS[doctrine.currentLevel - 1];
  const upgradeCost = getUpgradeCost(doctrine);
  const isMaxLevel = doctrine.currentLevel >= 3;
  const isOffColor = !equippable;
  const sellPrice = getDoctrineSellPrice(doctrine);
  const effectDesc = formatEffectDescription(doctrine);
  const priority: CardPriority = isOffColor ? 'disabled' : upgradeCost ? 'actionable' : 'neutral';

  const doctrineTooltip = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <div style={{ fontWeight: 700, color: 'var(--color-gold-primary)', marginBottom: '2px' }}>
        {doctrine.name} — Tier {doctrine.currentLevel}
      </div>
      {getCurrentEffects(doctrine).map((eff, i) => (
        <div key={i} style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
          {formatDoctrineEffect(eff)}
        </div>
      ))}
      {getUpgradeCost(doctrine) && (
        <div style={{ marginTop: '4px', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>
          Upgrade: <CostInline cost={getUpgradeCost(doctrine)!} iconSize="inline" />
        </div>
      )}
    </div>
  );

  return (
    <Tooltip content={doctrineTooltip} variant="rich" position="above">
    <div
      class={`doctrine-slot-card ${priorityClass(priority)}`}
      style={{
        width: 'min(140px, calc(25vw - 8px))',
        height: '180px',
        background: 'var(--color-bg-secondary)',
        borderRadius: 'var(--radius-md)',
        border: `1px solid ${isOffColor ? 'var(--color-border-subtle)' : 'var(--color-border-default)'}`,
        borderTop: `4px solid ${factionColor}`,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
        opacity: isOffColor ? 0.55 : 1,
        fontFamily: 'var(--font-family)',
        ...getPriorityStyle(priority, factionColor),
      }}
    >
      {/* Off-color sell price badge */}
      {isOffColor && (
        <div style={{
          position: 'absolute',
          top: '8px',
          right: '6px',
          background: 'var(--color-gold-secondary)',
          color: '#1a1600',
          fontSize: 'var(--font-size-xs)',
          fontWeight: 700,
          letterSpacing: '0.5px',
          padding: '2px 5px',
          borderRadius: '3px',
          zIndex: 2,
        }}>
          <ResourceAmount type="gold" amount={sellPrice} iconSize="micro" />
        </div>
      )}

      {/* Header row: name + level badge */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 8px 4px 8px',
        gap: '4px',
      }}>
        <span style={{
          fontSize: 'var(--font-size-sm)',
          fontWeight: 700,
          letterSpacing: '1px',
          textTransform: 'uppercase',
          color: factionColor,
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {doctrine.name.replace(/^Doctrine of (?:the )?/i, '')}
        </span>

        {/* Roman numeral level badge */}
        <div style={{
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          background: 'var(--color-gold-secondary)',
          color: '#1a1600',
          fontSize: 'var(--font-size-xs)',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          {levelNumeral}
        </div>
      </div>

      {/* Divider */}
      <div style={{
        height: '1px',
        margin: '0 8px',
        background: `linear-gradient(90deg, transparent, ${factionColor}40, transparent)`,
      }} />

      {/* Effect description */}
      <div style={{
        flex: 1,
        padding: '8px',
        display: 'flex',
        alignItems: 'flex-start',
      }}>
        <span style={{
          fontSize: 'var(--font-size-sm)',
          lineHeight: '1.5',
          color: 'var(--color-text-secondary)',
          letterSpacing: '0.3px',
        }}>
          {effectDesc}
        </span>
      </div>

      {/* Bottom action row */}
      <div style={{
        padding: '6px 8px 8px 8px',
        display: 'flex',
        flexDirection: 'column',
        gap: '5px',
      }}>
        {/* Upgrade or max badge */}
        {isMaxLevel ? (
          <div style={{
            textAlign: 'center',
            fontSize: 'var(--font-size-xs)',
            fontWeight: 700,
            letterSpacing: '1.5px',
            color: 'var(--color-gold-primary)',
            background: 'var(--color-border-subtle)',
            border: '1px solid var(--color-border-default)',
            borderRadius: '3px',
            padding: '3px 0',
          }}>
            MAX
          </div>
        ) : upgradeCost && onUpgrade ? (
          <button
            class="doctrine-upgrade-btn"
            onClick={onUpgrade}
            style={{
              background: 'rgba(50, 42, 20, 0.8)',
              border: '1px solid var(--color-border-strong)',
              borderRadius: '3px',
              color: 'var(--color-gold-primary)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 700,
              letterSpacing: '1px',
              textTransform: 'uppercase',
              padding: '3px 4px',
              width: '100%',
              fontFamily: 'inherit',
              textAlign: 'center',
            }}
          >
            Upgrade · <CostInline cost={upgradeCost} iconSize="inline" />
          </button>
        ) : (
          <div style={{
            textAlign: 'center',
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-border-default)',
            letterSpacing: '1px',
          }}>
            LVL {levelNumeral}
          </div>
        )}

        {/* Unequip button */}
        {onUnequip && (
          <button
            class="doctrine-unequip-btn"
            onClick={onUnequip}
            style={{
              background: 'transparent',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: '3px',
              color: 'var(--color-text-muted)',
              fontSize: 'var(--font-size-xs)',
              letterSpacing: '1px',
              textTransform: 'uppercase',
              padding: '2px 4px',
              width: '100%',
              fontFamily: 'inherit',
              textAlign: 'center',
            }}
          >
            Unequip
          </button>
        )}
      </div>
    </div>
    </Tooltip>
  );
}
