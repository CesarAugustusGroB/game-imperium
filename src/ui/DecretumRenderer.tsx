import type { Decretum } from '../game/decretum';
import { FACTION_COLORS } from '../game/commander';

// ── One-time CSS injection ──
if (typeof document !== 'undefined' && !document.getElementById('decretum-card-styles')) {
  const el = document.createElement('style');
  el.id = 'decretum-card-styles';
  el.textContent = `
    .decretum-card {
      transition: transform 0.15s ease, box-shadow 0.15s ease, filter 0.15s ease;
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
  switch (e.type) {
    case 'heal':
      return `Heal ${e.amount}${e.target === 'all' ? ' (all)' : ''}`;
    case 'damage':
      return `Deal ${e.amount} dmg${e.target === 'area' ? ' (area)' : ''}`;
    case 'buff':
      return `+${Math.round((e.multiplier - 1) * 100)}% ${e.stat.toUpperCase()}`;
    case 'debuff':
      return `-${Math.round((1 - e.multiplier) * 100)}% ${e.stat.toUpperCase()} (foe)`;
    case 'resource-gain':
      return `+${e.amount} ${e.resource}`;
    case 'spawn':
      return `Spawn ${e.count} ${e.unitRole}`;
    case 'reveal':
      return `Reveal ${e.count} ${e.target}`;
    case 'prevent-death':
      return `Prevent death ×${e.count}`;
    case 'event-modifier':
      return `Favorable outcome`;
    case 'upkeep-reduction':
      return `–upkeep ${e.seasons}s`;
  }
}

// ── Props ──

interface DecretumCardProps {
  decretum: Decretum;
  castable: boolean;
  selected?: boolean;
  onCast?: () => void;
  onSell?: () => void;
}

// ── Component ──

export function DecretumCard({ decretum, castable, selected, onCast, onSell }: DecretumCardProps) {
  const factionColor = FACTION_COLORS[decretum.color];
  const dots = RARITY_DOTS[decretum.rarity];

  // Box-shadow: selected = bright gold, castable = faction glow, otherwise none
  const boxShadow = selected
    ? `0 0 0 2px #f0d080, 0 0 12px rgba(240, 208, 128, 0.6)`
    : castable
    ? `0 0 8px ${factionColor}66, inset 0 0 4px ${factionColor}22`
    : 'none';

  // Use outline for selected gold ring; keep left border as faction color regardless
  const containerStyle: preact.JSX.CSSProperties = {
    position: 'relative' as const,
    width: '80px',
    height: '120px',
    background: 'rgba(30, 28, 48, 0.97)',
    borderRadius: '4px',
    borderLeft: `4px solid ${factionColor}`,
    outline: selected ? '2px solid #f0d080' : '1px solid rgba(180,160,100,0.18)',
    outlineOffset: selected ? '0px' : '-1px',
    boxShadow,
    opacity: castable ? 1 : 0.5,
    display: 'flex' as const,
    flexDirection: 'column' as const,
    padding: '6px 6px 6px 8px',
    boxSizing: 'border-box' as const,
    userSelect: 'none' as const,
    flexShrink: 0,
    transform: selected ? 'scale(1.05)' : undefined,
    transition: 'transform 0.15s ease, box-shadow 0.15s ease, filter 0.15s ease',
    cursor: castable ? 'pointer' : 'default',
  };

  const handleClick = () => {
    if (castable) {
      onCast?.();
    } else {
      onSell?.();
    }
  };

  return (
    <div
      style={containerStyle}
      class={`decretum-card${castable ? ' decretum-castable' : ''}${selected ? ' decretum-selected' : ''}`}
      onClick={handleClick}
      title={castable ? `Cast: ${decretum.name}` : `Sell: ${decretum.name}`}
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
                background: '#f0d080',
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
              color: '#f0d080',
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
          fontSize: '11px',
          fontFamily: 'serif',
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
          fontSize: '9px',
          fontFamily: 'sans-serif',
          color: 'rgba(180,170,160,0.8)',
          lineHeight: 1.3,
          overflowWrap: 'break-word',
          wordBreak: 'break-word',
        }}
      >
        {effectSummary(decretum)}
      </div>
    </div>
  );
}
