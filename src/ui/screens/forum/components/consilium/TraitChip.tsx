import type { JSX } from 'preact';
import type { AdvisorTrait } from '../../../../../game/council/advisor';
import { TraitGlyph } from './TraitGlyph';
import { getTraitVisual } from './trait-system';

interface TraitChipProps {
  trait: AdvisorTrait;
  compact?: boolean;
  style?: JSX.CSSProperties;
}

export function TraitChip({ trait, compact = false, style }: TraitChipProps) {
  const visual = getTraitVisual(trait);

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: compact ? 4 : 6,
        minWidth: 0,
        maxWidth: '100%',
        padding: compact ? '2px 6px 2px 3px' : '3px 8px 3px 4px',
        borderRadius: 999,
        border: `1px solid ${visual.color}`,
        background: `linear-gradient(180deg, ${visual.glow} 0%, rgba(13, 11, 20, 0.76) 100%)`,
        color: 'var(--imp-text)',
        fontFamily: 'var(--imp-font-body)',
        fontSize: compact ? 9 : 10,
        fontWeight: 700,
        letterSpacing: 0.8,
        lineHeight: 1.2,
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        ...style,
      }}
    >
      <TraitGlyph trait={trait} size={compact ? 16 : 18} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{visual.label}</span>
    </span>
  );
}
