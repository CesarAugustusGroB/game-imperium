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
  // Port — stone quay with mooring posts and waves
  port: (
    <svg viewBox="0 0 64 64" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 56h56v4H4z" />
      <rect x="8" y="30" width="6" height="26" />
      <rect x="50" y="30" width="6" height="26" />
      <path d="M8 30h48v6H8z" />
      <path d="M20 10h24v20H20z" opacity="0.85" />
      <rect x="28" y="16" width="8" height="14" fill="#0a0a14" opacity="0.6" />
      <path d="M14 46c4-3 8-3 12 0s8 3 12 0 8-3 12 0" stroke="currentColor" strokeWidth="2" fill="none" />
    </svg>
  ),
  // Fishery — curved net frame over water
  fishery: (
    <svg viewBox="0 0 64 64" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 56h56v4H4z" />
      <rect x="10" y="20" width="4" height="36" />
      <rect x="50" y="20" width="4" height="36" />
      <path d="M14 22c8-12 28-12 36 0" stroke="currentColor" strokeWidth="3" fill="none" />
      <path d="M14 30c8-8 28-8 36 0" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.7" />
      <path d="M14 38c8-6 28-6 36 0" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.5" />
      <ellipse cx="32" cy="50" rx="10" ry="3" opacity="0.4" />
    </svg>
  ),
  // Villa — colonnaded estate with garden wall
  villa: (
    <svg viewBox="0 0 64 64" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 56h56v4H4z" />
      <path d="M12 30h40v26H12z" opacity="0.85" />
      <path d="M32 10 10 26h44z" />
      <rect x="14" y="26" width="3" height="4" />
      <rect x="22" y="26" width="3" height="4" />
      <rect x="30" y="26" width="3" height="4" />
      <rect x="38" y="26" width="3" height="4" />
      <rect x="46" y="26" width="3" height="4" />
      <rect x="28" y="38" width="8" height="18" fill="#0a0a14" opacity="0.65" />
      <rect x="14" y="34" width="8" height="8" fill="#0a0a14" opacity="0.5" />
      <rect x="42" y="34" width="8" height="8" fill="#0a0a14" opacity="0.5" />
    </svg>
  ),
  // Stables — long low building with arched stalls
  stables: (
    <svg viewBox="0 0 64 64" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 56h56v4H4z" />
      <path d="M8 28h48v28H8z" opacity="0.85" />
      <path d="M8 20h48v8H8z" />
      <path d="M14 28a5 10 0 0 1 10 0v28H14zm14 0a5 10 0 0 1 10 0v28H28zm14 0a5 10 0 0 1 10 0v28H42z" fill="#0a0a14" opacity="0.65" />
      <rect x="10" y="10" width="4" height="10" />
      <rect x="50" y="10" width="4" height="10" />
    </svg>
  ),
  // Lumber Camp — stacked log pile with axe
  lumber_camp: (
    <svg viewBox="0 0 64 64" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 56h56v4H4z" />
      <ellipse cx="20" cy="48" rx="12" ry="5" />
      <ellipse cx="20" cy="40" rx="12" ry="5" />
      <ellipse cx="20" cy="32" rx="12" ry="5" />
      <circle cx="20" cy="32" r="4" fill="#0a0a14" opacity="0.5" />
      <path d="M36 20l16-14 4 4-14 16z" />
      <path d="M36 20l4-4-4-4-4 4z" opacity="0.7" />
      <rect x="32" y="30" width="4" height="22" />
    </svg>
  ),
  // Mountain Pass — archway cut through rocky peaks
  mountain_pass: (
    <svg viewBox="0 0 64 64" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 56h56v4H4z" />
      <path d="M4 56 18 24l14 20 14-28 14 28z" opacity="0.85" />
      <path d="M22 56h20V40a10 10 0 0 0-20 0z" fill="#0a0a14" opacity="0.7" />
      <rect x="22" y="56" width="20" height="4" fill="currentColor" opacity="0" />
    </svg>
  ),
  // Oasis Market — palm tree beside market stall
  oasis_market: (
    <svg viewBox="0 0 64 64" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 56h56v4H4z" />
      <rect x="14" y="28" width="4" height="28" />
      <path d="M16 28c-8-4-10-16-2-20 2 8 10 12 10 20z" />
      <path d="M16 28c4-8 14-10 16-2-8 2-14 8-16 18z" />
      <path d="M16 28c0-10 8-16 14-12-6 6-8 14-12 20z" opacity="0.7" />
      <path d="M34 34h24v22H34z" opacity="0.85" />
      <path d="M32 30h28v4H32z" />
      <rect x="38" y="38" width="6" height="8" fill="#0a0a14" opacity="0.6" />
      <rect x="48" y="38" width="6" height="8" fill="#0a0a14" opacity="0.6" />
    </svg>
  ),
  // Caravan Post — tent with road posts
  caravan_post: (
    <svg viewBox="0 0 64 64" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 56h56v4H4z" />
      <path d="M32 10 8 50h48z" opacity="0.85" />
      <path d="M32 10 8 50h48z" fill="#0a0a14" opacity="0.15" />
      <rect x="28" y="36" width="8" height="20" fill="#0a0a14" opacity="0.65" />
      <rect x="6" y="44" width="4" height="12" />
      <rect x="54" y="44" width="4" height="12" />
      <path d="M8 44h48" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.6" />
    </svg>
  ),
  // Oracle Shrine — circular altar with rising smoke
  oracle_shrine: (
    <svg viewBox="0 0 64 64" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 56h56v4H4z" />
      <ellipse cx="32" cy="52" rx="22" ry="5" />
      <rect x="24" y="36" width="16" height="16" />
      <ellipse cx="32" cy="36" rx="8" ry="4" />
      <path d="M28 36V22c0-4 8-4 8 0v14" opacity="0.8" />
      <path d="M30 20c-2-6 0-14 2-16 2 2 4 10 2 16z" opacity="0.7" />
      <path d="M34 18c2-4 6-8 6-12-4 0-8 4-8 10z" opacity="0.5" />
    </svg>
  ),
  // Reed Harvest — bundle of reeds with basket
  reed_harvest: (
    <svg viewBox="0 0 64 64" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 56h56v4H4z" />
      <rect x="14" y="24" width="3" height="32" />
      <rect x="22" y="18" width="3" height="38" />
      <rect x="30" y="22" width="3" height="34" />
      <rect x="38" y="16" width="3" height="40" />
      <rect x="46" y="20" width="3" height="36" />
      <ellipse cx="15" cy="22" rx="3" ry="5" />
      <ellipse cx="23" cy="16" rx="3" ry="5" />
      <ellipse cx="31" cy="20" rx="3" ry="5" />
      <ellipse cx="39" cy="14" rx="3" ry="5" />
      <ellipse cx="47" cy="18" rx="3" ry="5" />
      <path d="M10 52c6-4 38-4 44 0" stroke="currentColor" strokeWidth="3" fill="none" />
    </svg>
  ),
  // Granary — raised storehouse with peaked roof
  granary: (
    <svg viewBox="0 0 64 64" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 56h56v4H4z" />
      <rect x="12" y="32" width="40" height="24" opacity="0.85" />
      <path d="M32 12 8 32h48z" />
      <rect x="10" y="50" width="4" height="6" fill="#0a0a14" opacity="0.5" />
      <rect x="50" y="50" width="4" height="6" fill="#0a0a14" opacity="0.5" />
      <rect x="18" y="38" width="8" height="8" fill="#0a0a14" opacity="0.55" />
      <rect x="38" y="38" width="8" height="8" fill="#0a0a14" opacity="0.55" />
      <rect x="28" y="42" width="8" height="14" fill="#0a0a14" opacity="0.65" />
    </svg>
  ),
  // Gardens — fountain with flanking hedges
  gardens: (
    <svg viewBox="0 0 64 64" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 56h56v4H4z" />
      <rect x="30" y="34" width="4" height="22" />
      <ellipse cx="32" cy="34" rx="4" ry="6" />
      <path d="M28 30c-4-8 0-16 4-20 4 4 8 12 4 20z" opacity="0.8" />
      <path d="M22 28c-2-6 2-12 6-14 2 4 2 10-2 14z" opacity="0.6" />
      <path d="M42 28c2-6-2-12-6-14-2 4-2 10 2 14z" opacity="0.6" />
      <ellipse cx="14" cy="48" rx="10" ry="8" opacity="0.7" />
      <ellipse cx="50" cy="48" rx="10" ry="8" opacity="0.7" />
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
 * Building hero icon. Tries to load /asset/buildings/building_<type>.png first;
 * if that 404s, falls back to a hand-drawn inline SVG glyph that takes
 * its color from `color` (defaults to gold).
 */
export function BuildingIcon({ type, size = 56, color, style }: BuildingIconProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  // Reset state if the type changes (e.g. swapping between cards)
  useEffect(() => { setFailed(false); setLoaded(false); }, [type]);

  const svgFallback = (
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

  if (failed) return svgFallback;

  return (
    <>
      <img
        src={`/asset/buildings/building_${type}.png`}
        width={size}
        height={size}
        alt=""
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          objectFit: 'contain',
          filter: 'drop-shadow(0 2px 6px rgba(0, 0, 0, 0.55))',
          display: loaded ? 'block' : 'none',
          ...style,
        }}
      />
      {!loaded && svgFallback}
    </>
  );
}
