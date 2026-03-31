import type { Doctrine } from '../game/doctrine';
import { getCurrentEffects, getUpgradeCost, getDoctrineSellPrice } from '../game/doctrine';
import { FACTION_COLORS } from '../game/commander';
import type { ResourceType } from '../game/commander';

// ── One-time CSS injection ──
if (typeof document !== 'undefined' && !document.getElementById('doctrine-slot-styles')) {
  const el = document.createElement('style');
  el.id = 'doctrine-slot-styles';
  el.textContent = `
    .doctrine-slot-card {
      transition: box-shadow 0.2s ease, transform 0.15s ease;
    }
    .doctrine-slot-card:hover {
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
    }
    .doctrine-slot-empty {
      transition: background 0.2s ease, border-color 0.2s ease;
      cursor: default;
    }
    .doctrine-slot-empty.doctrine-slot-clickable {
      cursor: pointer;
    }
    .doctrine-slot-empty.doctrine-slot-clickable:hover {
      background: rgba(40, 36, 60, 0.9) !important;
      border-color: rgba(180, 160, 100, 0.4) !important;
    }
    .doctrine-upgrade-btn {
      transition: all 0.2s ease;
      cursor: pointer;
    }
    .doctrine-upgrade-btn:hover {
      filter: brightness(1.25);
      box-shadow: 0 0 10px rgba(180, 160, 100, 0.2);
    }
    .doctrine-upgrade-btn:active {
      transform: scale(0.96);
    }
    .doctrine-unequip-btn {
      transition: color 0.2s ease, border-color 0.2s ease;
      cursor: pointer;
    }
    .doctrine-unequip-btn:hover {
      color: #e0d8b8 !important;
      border-color: rgba(180, 160, 100, 0.4) !important;
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
  faith: 'Faith',
  influence: 'Influence',
  momentum: 'Momentum',
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
    case 'stat-modifier':
      return `${effect.stat} ×${effect.multiplier.toFixed(2)}`;
    case 'resource-per-spoke':
      return `+${effect.amount} ${RESOURCE_LABELS[effect.resource]} / spoke`;
    case 'heal-on-kill':
      return `Heal ${effect.amount} HP on kill`;
    case 'revive':
      return `Revive at ${Math.round(effect.hpPercent * 100)}% HP`;
    case 'heal-battle-start':
      return effect.amount === 'full'
        ? 'Full heal at battle start'
        : `Heal ${effect.amount} HP at start`;
    case 'free-units':
      return `${effect.count} free ${effect.unitRole} unit${effect.count > 1 ? 's' : ''}`;
    case 'extra-event-choices':
      return `+${effect.count} event choice${effect.count > 1 ? 's' : ''}`;
    case 'shop-discount':
      return `${effect.percent}% shop discount`;
    case 'income-modifier':
      return `${RESOURCE_LABELS[effect.resource]} income ×${effect.multiplier.toFixed(2)}`;
    case 'ally-units':
      return `+${effect.count} ally unit${effect.count > 1 ? 's' : ''}`;
    case 'upkeep-reduction':
      return `${effect.percent}% upkeep reduction`;
    default:
      return '—';
  }
}

function formatCost(cost: Partial<Record<ResourceType, number>>): string {
  return Object.entries(cost)
    .map(([res, amount]) => `${amount} ${RESOURCE_LABELS[res as ResourceType]}`)
    .join(', ');
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
        class={`doctrine-slot-empty${onEquip ? ' doctrine-slot-clickable' : ''}`}
        onClick={onEquip}
        style={{
          width: '140px',
          height: '180px',
          background: 'rgba(30, 28, 48, 0.7)',
          border: '2px dashed rgba(180, 160, 100, 0.2)',
          borderRadius: '6px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          userSelect: 'none',
        }}
      >
        <span style={{
          fontSize: '28px',
          color: 'rgba(180, 160, 100, 0.3)',
          lineHeight: 1,
          fontWeight: 300,
        }}>+</span>
        <span style={{
          fontSize: '10px',
          letterSpacing: '1.5px',
          textTransform: 'uppercase',
          color: 'rgba(180, 160, 100, 0.35)',
        }}>
          Empty Slot
        </span>
        <span style={{
          fontSize: '9px',
          color: 'rgba(180, 160, 100, 0.2)',
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

  return (
    <div
      class="doctrine-slot-card"
      style={{
        width: '140px',
        height: '180px',
        background: 'rgba(30, 28, 48, 0.95)',
        borderRadius: '6px',
        border: `1px solid ${isOffColor ? 'rgba(180,160,100,0.15)' : 'rgba(180,160,100,0.25)'}`,
        borderTop: `4px solid ${factionColor}`,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
        opacity: isOffColor ? 0.65 : 1,
        fontFamily: "'Segoe UI', system-ui, sans-serif",
      }}
    >
      {/* Off-color sell price badge */}
      {isOffColor && (
        <div style={{
          position: 'absolute',
          top: '8px',
          right: '6px',
          background: 'rgba(212, 168, 67, 0.85)',
          color: '#1a1600',
          fontSize: '9px',
          fontWeight: 700,
          letterSpacing: '0.5px',
          padding: '2px 5px',
          borderRadius: '3px',
          zIndex: 2,
        }}>
          {sellPrice}g
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
          fontSize: '10px',
          fontWeight: 700,
          letterSpacing: '1px',
          textTransform: 'uppercase',
          color: factionColor,
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {doctrine.name}
        </span>

        {/* Roman numeral level badge */}
        <div style={{
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          background: 'rgba(212, 168, 67, 0.9)',
          color: '#1a1600',
          fontSize: '9px',
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
          fontSize: '10px',
          lineHeight: '1.5',
          color: 'rgba(200, 190, 160, 0.65)',
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
            fontSize: '9px',
            fontWeight: 700,
            letterSpacing: '1.5px',
            color: '#f0d080',
            background: 'rgba(212, 168, 67, 0.12)',
            border: '1px solid rgba(212, 168, 67, 0.3)',
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
              border: '1px solid rgba(212, 168, 67, 0.4)',
              borderRadius: '3px',
              color: '#f0d080',
              fontSize: '9px',
              fontWeight: 700,
              letterSpacing: '1px',
              textTransform: 'uppercase',
              padding: '3px 4px',
              width: '100%',
              fontFamily: 'inherit',
              textAlign: 'center',
            }}
          >
            Upgrade · {formatCost(upgradeCost)}
          </button>
        ) : (
          <div style={{
            textAlign: 'center',
            fontSize: '9px',
            color: 'rgba(180,160,100,0.25)',
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
              border: '1px solid rgba(180, 160, 100, 0.18)',
              borderRadius: '3px',
              color: 'rgba(200, 190, 160, 0.45)',
              fontSize: '9px',
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
  );
}
