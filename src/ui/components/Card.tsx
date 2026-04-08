import type { ComponentChildren } from 'preact';
import type { JSX } from 'preact/jsx-runtime';

// Inject card styles once
if (typeof document !== 'undefined' && !document.getElementById('card-styles')) {
  const style = document.createElement('style');
  style.id = 'card-styles';
  style.textContent = `
.card-base:hover:not(.card-disabled) { transform: translateY(-2px); box-shadow: var(--shadow-lg); }
.card-base:active:not(.card-disabled) { transform: scale(0.98); }
.card-disabled { opacity: 0.5; filter: saturate(0.3); cursor: default !important; }
.card-selected { border-color: var(--color-gold-primary) !important; transform: scale(1.03); }
@keyframes card-legendary-pulse { 0%, 100% { box-shadow: 0 0 8px rgba(160, 90, 220, 0.3); } 50% { box-shadow: 0 0 16px rgba(160, 90, 220, 0.5); } }
.card-legendary { animation: card-legendary-pulse 2s ease-in-out infinite; }
  `.trim();
  document.head.appendChild(style);
}

type Variant = 'scroll' | 'tome' | 'blueprint';
type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary';

interface CardProps {
  variant: Variant;
  rarity?: Rarity;
  name: string;
  level?: string;
  cost?: ComponentChildren;
  effect?: string;
  children?: ComponentChildren;
  selected?: boolean;
  disabled?: boolean;
  onClick?: (e: MouseEvent) => void;
  className?: string;
  style?: JSX.CSSProperties;
}

const VARIANT_ART_BG: Record<Variant, string> = {
  scroll: 'linear-gradient(135deg, rgba(180, 155, 100, 0.3), rgba(140, 120, 80, 0.15))',
  tome: 'linear-gradient(135deg, rgba(100, 70, 50, 0.3), rgba(70, 50, 35, 0.15))',
  blueprint: 'linear-gradient(135deg, rgba(120, 120, 140, 0.3), rgba(80, 80, 100, 0.15))',
};

const RARITY_BORDER: Record<Rarity, string> = {
  common: 'var(--color-border-subtle)',
  uncommon: 'rgba(90, 180, 90, 0.4)',
  rare: 'var(--color-border-strong)',
  legendary: 'rgba(160, 90, 220, 0.5)',
};

const RARITY_SHADOW: Record<Rarity, string | undefined> = {
  common: undefined,
  uncommon: '0 0 8px rgba(90, 180, 90, 0.15)',
  rare: 'var(--shadow-glow)',
  legendary: undefined, // handled by CSS animation class
};

// Rarity dot definitions: [count, color]
const RARITY_DOTS: Record<Rarity, [number, string]> = {
  common: [1, '#888888'],
  uncommon: [2, 'rgba(90, 180, 90, 0.9)'],
  rare: [3, 'rgba(200, 160, 60, 0.9)'],
  legendary: [3, 'rgba(160, 90, 220, 0.9)'],
};

function RarityDots({ rarity }: { rarity: Rarity }) {
  const [count, color] = RARITY_DOTS[rarity];
  return (
    <span style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: color,
            display: 'inline-block',
          }}
        />
      ))}
    </span>
  );
}

export function Card({
  variant,
  rarity = 'common',
  name,
  level,
  cost,
  effect,
  children,
  selected = false,
  disabled = false,
  onClick,
  className = '',
  style,
}: CardProps) {
  const classes = [
    'card-base',
    `card-variant-${variant}`,
    `card-rarity-${rarity}`,
    rarity === 'legendary' ? 'card-legendary' : '',
    selected ? 'card-selected' : '',
    disabled ? 'card-disabled' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const borderColor = selected ? 'var(--color-gold-primary)' : RARITY_BORDER[rarity];
  const boxShadow = selected ? undefined : RARITY_SHADOW[rarity];

  const baseStyle: JSX.CSSProperties = {
    width: '180px',
    borderRadius: 'var(--radius-md)',
    background: 'var(--color-bg-primary)',
    border: `var(--border-width) solid ${borderColor}`,
    overflow: 'hidden',
    cursor: onClick && !disabled ? 'pointer' : disabled ? 'default' : undefined,
    fontFamily: 'var(--font-family)',
    transition: 'all var(--duration-normal) var(--ease-default)',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    ...(boxShadow ? { boxShadow } : {}),
    ...style,
  };

  const handleClick = (e: MouseEvent) => {
    if (!disabled && onClick) {
      onClick(e);
    }
  };

  return (
    <div
      class={classes}
      style={baseStyle}
      onClick={handleClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick && !disabled ? 0 : undefined}
      aria-disabled={disabled}
    >
      {/* Header row: cost (top-left) + level badge (top-right) */}
      {(cost != null || level != null) && (
        <div
          style={{
            position: 'relative',
            height: '24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            padding: '4px 6px 0',
            pointerEvents: 'none',
          }}
        >
          {/* Cost badge */}
          <span
            style={{
              display: 'flex',
              gap: '2px',
              alignItems: 'center',
              fontSize: '10px',
              fontWeight: 700,
              lineHeight: 1,
              color: 'var(--color-text-secondary)',
            }}
          >
            {cost}
          </span>

          {/* Level badge */}
          {level != null && (
            <span
              style={{
                fontSize: '10px',
                fontWeight: 700,
                lineHeight: 1,
                padding: '2px 5px',
                borderRadius: '3px',
                background: 'var(--color-bg-secondary)',
                border: '1px solid var(--color-border-subtle)',
                color: 'var(--color-text-primary)',
                whiteSpace: 'nowrap',
              }}
            >
              {level}
            </span>
          )}
        </div>
      )}

      {/* Art area */}
      <div
        style={{
          height: '100px',
          background: VARIANT_ART_BG[variant],
          flexShrink: 0,
        }}
      />

      {/* Footer */}
      <div
        style={{
          padding: '8px 8px 6px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}
      >
        {/* Name + rarity dots row */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <span
            style={{
              fontWeight: 700,
              fontSize: '13px',
              color: 'var(--color-text-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
              minWidth: 0,
            }}
          >
            {name}
          </span>
          <RarityDots rarity={rarity} />
        </div>

        {/* Effect text */}
        {effect && (
          <p
            style={{
              margin: 0,
              fontSize: '11px',
              lineHeight: 1.4,
              color: 'var(--color-text-secondary)',
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {effect}
          </p>
        )}

        {/* Additional children content */}
        {children}
      </div>
    </div>
  );
}
