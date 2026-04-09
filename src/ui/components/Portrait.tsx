import { useState, useEffect } from 'preact/hooks';
import type { JSX } from 'preact/jsx-runtime';

// ── CSS injection (once) ──
if (typeof document !== 'undefined' && !document.getElementById('portrait-styles')) {
  const el = document.createElement('style');
  el.id = 'portrait-styles';
  el.textContent = `
    .portrait-img {
      transition: filter var(--duration-fast) var(--ease-default);
    }
    .portrait-container:hover .portrait-img {
      filter: brightness(1.08);
    }
    @keyframes portrait-sparkle {
      0%, 100% { box-shadow: 0 0 0 0 rgba(240, 208, 128, 0); transform: scale(1); }
      50% { box-shadow: 0 0 6px 3px rgba(240, 208, 128, 0.6); transform: scale(1.1); }
    }
    .portrait-tier-sparkle {
      animation: portrait-sparkle 1.2s ease-in-out infinite;
    }
  `;
  document.head.appendChild(el);
}

interface PortraitProps {
  src?: string;
  alt: string;
  size: 'large' | 'medium' | 'small';
  factionColor?: string;
  name?: string;
  tier?: 1 | 2 | 3;
  tierUpAvailable?: boolean;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
  style?: JSX.CSSProperties;
}

const SIZE_MAP: Record<'large' | 'medium' | 'small', { width: string; height: string }> = {
  large:  { width: '188px', height: '210px' },
  medium: { width: '96px',  height: '112px' },
  small:  { width: '60px',  height: '72px'  },
};

const TIER_LABELS: Record<1 | 2 | 3, string> = { 1: 'I', 2: 'II', 3: 'III' };

export function Portrait({
  src,
  alt,
  size,
  factionColor,
  name,
  tier,
  tierUpAvailable = false,
  selected = false,
  onClick,
  className,
  style,
}: PortraitProps) {
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [src]);

  const { width, height } = SIZE_MAP[size];
  const showPlaceholder = !src || imgFailed;
  const borderColor = factionColor ?? 'var(--color-border-default)';
  const iconFontSize = `${Math.min(Math.round(parseInt(height) * 0.4), 48)}px`;

  const containerStyle: JSX.CSSProperties = {
    // Layout (caller may override via style prop)
    position: 'relative',
    width,
    height,
    overflow: 'hidden',
    flexShrink: 0,
    cursor: onClick ? 'pointer' : 'default',
    ...style,
    // Visual (always enforced — not overridable by callers)
    border: showPlaceholder
      ? `2px dashed var(--color-border-subtle)`
      : `2px solid ${borderColor}`,
    borderRadius: 'var(--radius-sm)',
    boxShadow: selected
      ? `0 0 0 3px var(--color-gold-primary), 0 0 16px rgba(240, 208, 128, 0.3)`
      : undefined,
    transition: `box-shadow var(--duration-normal) var(--ease-default), border-color var(--duration-normal) var(--ease-default)`,
  };

  const placeholderStyle: JSX.CSSProperties = {
    width: '100%',
    height: '100%',
    background: `linear-gradient(135deg, ${factionColor ?? '#555'}22, ${factionColor ?? '#333'}11), var(--color-bg-secondary)`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const iconStyle: JSX.CSSProperties = {
    fontSize: iconFontSize,
    opacity: 0.4,
    color: factionColor ?? 'var(--color-text-muted)',
    lineHeight: 1,
  };

  const namePlateStyle: JSX.CSSProperties = {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '28px',
    background: 'linear-gradient(to bottom, transparent, rgba(0,0,0,0.75))',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: '4px',
    paddingRight: '4px',
  };

  const namePlateTextStyle: JSX.CSSProperties = {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-text-primary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    textAlign: 'center',
    maxWidth: '100%',
  };

  const tierBadgeStyle: JSX.CSSProperties = {
    position: 'absolute',
    top: '-4px',
    right: '-4px',
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    background: `${factionColor ?? 'var(--color-gold-secondary)'}e6`,
    border: '1px solid rgba(255,255,255,0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 'var(--font-size-xs)',
    fontWeight: 700,
    color: 'white',
    lineHeight: 1,
  };

  return (
    <div
      class={`portrait-container${className ? ` ${className}` : ''}`}
      style={containerStyle}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      aria-label={alt}
    >
      {showPlaceholder ? (
        <div style={placeholderStyle}>
          <span style={iconStyle}>⚔</span>
        </div>
      ) : (
        <img
          class="portrait-img"
          src={src}
          alt={alt}
          onError={() => { setImgFailed(true); }}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center top',
            display: 'block',
            filter: `drop-shadow(0 0 8px ${(factionColor ?? 'transparent') + '40'})`,
          }}
        />
      )}

      {size === 'large' && name && (
        <div style={namePlateStyle}>
          <span style={namePlateTextStyle}>{name}</span>
        </div>
      )}

      {(size === 'medium' || size === 'small') && tier != null && (
        <div
          class={tierUpAvailable ? 'portrait-tier-sparkle' : undefined}
          style={tierBadgeStyle}
        >
          {TIER_LABELS[tier]}
        </div>
      )}
    </div>
  );
}
