import type { JSX } from 'preact/jsx-runtime';

type BarVariant = 'progress' | 'unrest' | 'xp';

interface BarProps {
  value: number;
  max: number;
  variant?: BarVariant;
  label?: string;
  showText?: boolean;
  className?: string;
  style?: JSX.CSSProperties;
  height?: number;
}

function getDefaultHeight(variant: BarVariant): number {
  return variant === 'xp' ? 6 : 8;
}

function getFillColor(variant: BarVariant, pct: number): string {
  switch (variant) {
    case 'progress':
      return 'var(--color-gold-secondary)';
    case 'unrest':
      if (pct < 40) return 'var(--color-success)';
      if (pct < 70) return 'var(--color-warning)';
      return 'var(--color-danger)';
    case 'xp':
      return 'rgba(100, 160, 220, 0.7)';
  }
}

export function Bar({
  value,
  max,
  variant = 'progress',
  label,
  showText,
  className,
  style,
  height,
}: BarProps) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const resolvedHeight = height ?? getDefaultHeight(variant);
  const fillColor = getFillColor(variant, pct);

  const containerStyle: JSX.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: label ? '6px' : undefined,
    width: '100%',
    ...style,
  };

  const trackStyle: JSX.CSSProperties = {
    flex: 1,
    height: `${resolvedHeight}px`,
    background: 'var(--color-bg-primary)',
    borderRadius: 'var(--radius-sm)',
    overflow: 'hidden',
    position: 'relative',
    border: 'var(--border-width) solid var(--color-border-subtle)',
  };

  const fillStyle: JSX.CSSProperties = {
    width: `${pct}%`,
    height: '100%',
    background: fillColor,
    borderRadius: 'var(--radius-sm)',
    transition: 'width var(--duration-normal) var(--ease-default)',
    position: 'relative',
  };

  const labelStyle: JSX.CSSProperties = {
    fontSize: 'var(--font-size-xs)',
    color: 'var(--color-text-muted)',
    letterSpacing: '1px',
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  };

  const textStyle: JSX.CSSProperties = {
    position: 'absolute',
    right: '4px',
    top: '50%',
    transform: 'translateY(-50%)',
    fontSize: 'var(--font-size-xs)',
    color: 'var(--color-text-secondary)',
    lineHeight: 1,
    pointerEvents: 'none',
    zIndex: 1,
    userSelect: 'none',
  };

  return (
    <div class={className} style={containerStyle}>
      {label && <span style={labelStyle}>{label}</span>}
      <div style={trackStyle}>
        <div style={fillStyle} />
        {showText && (
          <span style={textStyle}>
            {value}/{max}
          </span>
        )}
      </div>
    </div>
  );
}
