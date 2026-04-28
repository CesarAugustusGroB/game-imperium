import type { JSX } from 'preact';
import type { AdvisorTrait } from '../../../../../game/council/advisor';
import { getTraitVisual } from './trait-system';

interface TraitGlyphProps {
  trait: AdvisorTrait;
  size?: number;
  title?: string;
  style?: JSX.CSSProperties;
}

export function TraitGlyph({ trait, size = 22, title, style }: TraitGlyphProps) {
  const visual = getTraitVisual(trait);

  return (
    <span
      title={title ?? visual.label}
      aria-label={visual.label}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flex: '0 0 auto',
        background: `radial-gradient(circle at 35% 25%, ${visual.glow} 0%, rgba(13, 11, 20, 0.94) 72%)`,
        border: `1px solid ${visual.color}`,
        boxShadow: `0 0 ${Math.max(6, size / 2)}px ${visual.glow}`,
        color: visual.color,
        fontFamily: 'var(--imp-font-display)',
        fontSize: Math.max(9, Math.round(size * 0.46)),
        fontWeight: 700,
        lineHeight: 1,
        textTransform: 'uppercase',
        ...style,
      }}
    >
      {visual.glyph}
    </span>
  );
}
