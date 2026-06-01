import type { Decretum } from '../../game/items/decretum';
import { DECRETUM_SELL_PRICE } from '../../game/items/decretum';
import { FACTION_COLORS } from '../../game/core/commander';
import { Tooltip } from './Tooltip';
import { CostInline, ResourceAmount } from './ResourceIcon';

// ── One-time CSS injection ──
if (typeof document !== 'undefined' && !document.getElementById('decretum-card-styles')) {
  const el = document.createElement('style');
  el.id = 'decretum-card-styles';
  el.textContent = `
    .decretum-card {
      transition: transform var(--duration-fast) var(--ease-default), box-shadow var(--duration-fast) var(--ease-default), filter var(--duration-fast) var(--ease-default);
      cursor: default;
    }
    .decretum-card.decretum-castable {
      cursor: pointer;
    }
    .decretum-card.decretum-castable:hover {
      filter: brightness(1.18);
    }
    .decretum-card.decretum-selected {
      transform: scale(1.05);
    }
    @keyframes card-draw {
      from { opacity: 0; transform: translateY(20px) scale(0.9); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    .decretum-card-new { animation: card-draw 0.35s ease-out; }
  `;
  document.head.appendChild(el);
}

// ── Helpers ──

const RARITY_DOTS: Record<Decretum['rarity'], number> = {
  common: 1,
  rare: 2,
  legendary: 3,
};

function effectSummary(decretum: Decretum): string {
  const e = decretum.effect;
  let primary: string;
  switch (e.type) {
    case 'heal':
      primary = `Heal ${e.amount}${e.target === 'all' ? ' (all)' : ''}`;
      break;
    case 'damage':
      primary = `Deal ${e.amount} dmg${e.target === 'area' ? ' (area)' : ''}`;
      break;
    case 'buff':
      primary = `+${Math.round(e.multiplier * 100)}% ${e.stat.toUpperCase()}`;
      break;
    case 'debuff':
      primary = `-${Math.round(e.multiplier * 100)}% ${e.stat.toUpperCase()} (foe)`;
      break;
    case 'resource-gain':
      primary = `+${e.amount} ${e.resource}`;
      break;
    case 'spawn':
      primary = `Spawn ${e.count} ${e.unitRole}`;
      break;
    case 'reveal':
      primary = `Reveal ${e.count} ${e.target}`;
      break;
    case 'prevent-death':
      primary = `Prevent death ×${e.count}`;
      break;
    case 'event-modifier':
      primary = `Favorable outcome`;
      break;
    case 'upkeep-reduction':
      primary = `–upkeep ${e.seasons}s`;
      break;
    case 'convert-enemy-next-battle':
      primary = `Convert ${e.count} enemy next battle`;
      break;
    case 'investment-discount':
      primary = `–${e.percent}% next investment`;
      break;
    default:
      primary = '—';
  }
  // Append cast cost so players know legendary scrolls require extra resources
  if (decretum.castCost) {
    const costParts = (Object.entries(decretum.castCost) as [string, number][])
      .map(([res, amt]) => `${amt} ${res.charAt(0).toUpperCase() + res.slice(1)}`);
    if (costParts.length > 0) primary += ` · ${costParts.join('+')}`;
  }
  return primary;
}

// ── Props ──

interface DecretumCardProps {
  decretum: Decretum;
  castable: boolean;
  selected?: boolean;
  isNew?: boolean;
  onCast?: () => void;
  onSell?: () => void;
}

// ── Component ──

export function DecretumCard({ decretum, castable, selected, isNew, onCast, onSell }: DecretumCardProps) {
  const factionColor = FACTION_COLORS[decretum.color];
  const dots = RARITY_DOTS[decretum.rarity];

  // Box-shadow: selected = bright gold, castable = faction glow, otherwise none
  const boxShadow = selected
    ? `0 0 0 2px var(--color-gold-primary), 0 0 12px rgba(240, 208, 128, 0.6)`
    : castable
    ? `0 0 8px ${factionColor}66, inset 0 0 4px ${factionColor}22`
    : 'none';

  // Use outline for selected gold ring; keep left border as faction color regardless
  const containerStyle: preact.JSX.CSSProperties = {
    position: 'relative' as const,
    width: '80px',
    height: '120px',
    background: 'var(--color-bg-secondary)',
    borderRadius: 'var(--radius-sm)',
    borderLeft: `4px solid ${factionColor}`,
    outline: selected ? `2px solid var(--color-gold-primary)` : `1px solid var(--color-border-subtle)`,
    outlineOffset: selected ? '0px' : '-1px',
    boxShadow,
    opacity: castable ? 1 : 0.55,
    display: 'flex' as const,
    flexDirection: 'column' as const,
    padding: '6px 6px 6px 8px',
    boxSizing: 'border-box' as const,
    userSelect: 'none' as const,
    flexShrink: 0,
    transition: 'transform var(--duration-fast) var(--ease-default), box-shadow var(--duration-fast) var(--ease-default), filter var(--duration-fast) var(--ease-default)',
    cursor: castable ? 'pointer' : 'default',
  };

  const handleClick = () => {
    if (castable) {
      onCast?.();
    } else {
      onSell?.();
    }
  };

  const decretumTooltip = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <div style={{ fontWeight: 700, color: 'var(--color-gold-primary)', marginBottom: '2px' }}>
        {decretum.name}
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginLeft: '6px' }}>
          [{decretum.rarity}]
        </span>
      </div>
      <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', lineHeight: '1.4' }}>
        {decretum.description}
      </div>
      {decretum.castCost && Object.keys(decretum.castCost).length > 0 && (
        <div style={{ marginTop: '4px', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>
          Cast cost: <CostInline cost={decretum.castCost} iconSize={14} />
        </div>
      )}
      <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>
        Sell: <ResourceAmount type="gold" amount={DECRETUM_SELL_PRICE[decretum.rarity]} iconSize={14} />
      </div>
    </div>
  );

  return (
    <Tooltip content={decretumTooltip} variant="rich" position="above">
    <div
      style={containerStyle}
      class={`decretum-card${castable ? ' decretum-castable' : ''}${selected ? ' decretum-selected' : ''}${isNew ? ' decretum-card-new' : ''}`}
      onClick={handleClick}
    >
      {/* Top row: rarity dots + optional SELL tag */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
        {/* Rarity dots */}
        <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
          {Array.from({ length: dots }).map((_, i) => (
            <div
              key={i}
              style={{
                width: '5px',
                height: '5px',
                borderRadius: '50%',
                background: 'var(--color-gold-primary)',
                boxShadow: '0 0 3px rgba(240,208,128,0.7)',
              }}
            />
          ))}
        </div>

        {/* SELL tag — shown only when not castable (spoils) */}
        {!castable && (
          <div
            style={{
              fontSize: '7px',
              fontFamily: 'serif',
              letterSpacing: '0.5px',
              color: 'var(--color-gold-primary)',
              border: '1px solid rgba(240,208,128,0.5)',
              borderRadius: '2px',
              padding: '1px 3px',
              lineHeight: 1,
            }}
          >
            SELL
          </div>
        )}
      </div>

      {/* Scroll name */}
      <div
        style={{
          fontSize: 'var(--font-size-sm)',
          fontFamily: 'var(--font-family)',
          letterSpacing: '0.8px',
          textTransform: 'uppercase',
          color: factionColor,
          lineHeight: 1.2,
          marginBottom: '6px',
          flexGrow: 1,
          overflowWrap: 'break-word',
          wordBreak: 'break-word',
        }}
      >
        {decretum.name}
      </div>

      {/* Effect description */}
      <div
        style={{
          fontSize: 'var(--font-size-xs)',
          fontFamily: 'var(--font-family)',
          color: 'var(--color-text-secondary)',
          lineHeight: 1.3,
          overflowWrap: 'break-word',
          wordBreak: 'break-word',
        }}
      >
        {effectSummary(decretum)}
      </div>
    </div>
    </Tooltip>
  );
}
