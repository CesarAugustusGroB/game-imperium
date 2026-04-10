import { useState, useEffect } from 'preact/hooks';
import type { JSX } from 'preact/jsx-runtime';
import type { InvestmentType } from '../../game/province/province';

// ── Inline SVG fallbacks ──
// All glyphs use currentColor so they inherit gold from the parent.
// 64×64 viewbox, ornamental Roman building silhouettes.

const BUILDING_SVG: Record<InvestmentType, JSX.Element> = {
  // Castrum — crenellated military camp tower
  castrum: (
    <svg viewBox="0 0 64 64" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 56h48v4H8z" />
      <path d="M12 24h40v32H12z" opacity="0.85" />
      <path d="M16 16h4v8h-4zm8 0h4v8h-4zm8 0h4v8h-4zm8 0h4v8h-4zm8 0h4v8h-4z" />
      <rect x="28" y="36" width="8" height="20" fill="#0a0a14" opacity="0.65" />
      <rect x="18" y="30" width="6" height="6" fill="#0a0a14" opacity="0.55" />
      <rect x="40" y="30" width="6" height="6" fill="#0a0a14" opacity="0.55" />
    </svg>
  ),
  // Basilica — columned facade with pediment
  basilica: (
    <svg viewBox="0 0 64 64" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 56h52v4H6z" />
      <path d="M8 50h48v6H8z" opacity="0.9" />
      <path d="M32 8 6 22h52z" />
      <rect x="12" y="22" width="40" height="3" />
      <rect x="14" y="25" width="4" height="25" />
      <rect x="22" y="25" width="4" height="25" />
      <rect x="30" y="25" width="4" height="25" />
      <rect x="38" y="25" width="4" height="25" />
      <rect x="46" y="25" width="4" height="25" />
      <circle cx="32" cy="16" r="2" fill="#0a0a14" opacity="0.5" />
    </svg>
  ),
  // Pantheon — domed temple with portico
  pantheon: (
    <svg viewBox="0 0 64 64" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 56h52v4H6z" />
      <path d="M10 38h44v18H10z" opacity="0.85" />
      <path d="M32 6a18 14 0 0 0-18 14h36a18 14 0 0 0-18-14z" />
      <rect x="12" y="20" width="40" height="3" />
      <path d="M30 8h4v12h-4z" fill="#0a0a14" opacity="0.45" />
      <rect x="14" y="23" width="4" height="15" />
      <rect x="22" y="23" width="4" height="15" />
      <rect x="30" y="23" width="4" height="15" />
      <rect x="38" y="23" width="4" height="15" />
      <rect x="46" y="23" width="4" height="15" />
      <rect x="28" y="42" width="8" height="14" fill="#0a0a14" opacity="0.6" />
    </svg>
  ),
  // Market — amphora flanked by coins
  market: (
    <svg viewBox="0 0 64 64" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 56h52v4H6z" />
      <path d="M24 14h16v4H24z" />
      <path d="M22 18h20l-2 6h-16z" />
      <path d="M22 24c-4 4-4 14 0 20s16 6 20 0 4-16 0-20z" />
      <path d="M20 22c-2 0-4 2-4 4s2 4 4 4M44 22c2 0 4 2 4 4s-2 4-4 4" stroke="currentColor" strokeWidth="2" fill="none" />
      <circle cx="10" cy="46" r="5" />
      <circle cx="54" cy="46" r="5" />
      <circle cx="10" cy="46" r="2" fill="#0a0a14" opacity="0.5" />
      <circle cx="54" cy="46" r="2" fill="#0a0a14" opacity="0.5" />
    </svg>
  ),
  // Aqueduct — triple arches
  aqueduct: (
    <svg viewBox="0 0 64 64" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 56h56v4H4z" />
      <path d="M6 14h52v6H6z" />
      <path d="M6 20h52v4H6z" opacity="0.7" />
      <path d="M8 24h12v32H8zm18 0h12v32H26zm18 0h12v32H44z" />
      <path d="M10 34a4 6 0 0 1 8 0v22h-8zm18 0a4 6 0 0 1 8 0v22h-8zm18 0a4 6 0 0 1 8 0v22h-8z" fill="#0a0a14" opacity="0.7" />
    </svg>
  ),
  // Insula — tall windowed apartment block
  insula: (
    <svg viewBox="0 0 64 64" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 56h52v4H6z" />
      <path d="M14 8h36v48H14z" />
      <path d="M14 8h36v4H14z" opacity="0.7" />
      <rect x="18" y="16" width="6" height="6" fill="#0a0a14" opacity="0.6" />
      <rect x="29" y="16" width="6" height="6" fill="#0a0a14" opacity="0.6" />
      <rect x="40" y="16" width="6" height="6" fill="#0a0a14" opacity="0.6" />
      <rect x="18" y="26" width="6" height="6" fill="#0a0a14" opacity="0.6" />
      <rect x="29" y="26" width="6" height="6" fill="#0a0a14" opacity="0.6" />
      <rect x="40" y="26" width="6" height="6" fill="#0a0a14" opacity="0.6" />
      <rect x="18" y="36" width="6" height="6" fill="#0a0a14" opacity="0.6" />
      <rect x="29" y="36" width="6" height="6" fill="#0a0a14" opacity="0.6" />
      <rect x="40" y="36" width="6" height="6" fill="#0a0a14" opacity="0.6" />
      <rect x="28" y="46" width="8" height="10" fill="#0a0a14" opacity="0.7" />
    </svg>
  ),
};

interface BuildingIconProps {
  type: InvestmentType;
  size?: number;
  color?: string;
  style?: JSX.CSSProperties;
}

/**
 * Building hero icon. Tries to load /asset/building_<type>.png first;
 * if that 404s, falls back to a hand-drawn inline SVG glyph that takes
 * its color from `color` (defaults to gold).
 */
export function BuildingIcon({ type, size = 56, color, style }: BuildingIconProps) {
  const [failed, setFailed] = useState(false);

  // Reset failure state if the type changes (e.g. swapping between cards)
  useEffect(() => { setFailed(false); }, [type]);

  if (failed) {
    return (
      <div
        style={{
          width: `${size}px`,
          height: `${size}px`,
          color: color ?? 'var(--color-gold-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          filter: 'drop-shadow(0 2px 6px rgba(0, 0, 0, 0.55))',
          ...style,
        }}
      >
        {BUILDING_SVG[type]}
      </div>
    );
  }

  return (
    <img
      src={`/asset/building_${type}.png`}
      width={size}
      height={size}
      alt=""
      onError={() => setFailed(true)}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        objectFit: 'contain',
        filter: 'drop-shadow(0 2px 6px rgba(0, 0, 0, 0.55))',
        ...style,
      }}
    />
  );
}
