import type { JSX } from 'preact';
import { LaurelWreath } from '../../../../components/motifs/LaurelWreath';

interface SPQREmblemProps {
  size?: number;
  color?: string;
  opacity?: number;
  style?: JSX.CSSProperties;
}

export function SPQREmblem({
  size = 112,
  color = 'var(--imp-gold)',
  opacity = 0.14,
  style,
}: SPQREmblemProps) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'relative',
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        opacity,
        ...style,
      }}
    >
      <LaurelWreath size={size} color={color} opacity={1} />
      <div style={{
        position: 'absolute',
        inset: '22%',
        borderRadius: '50%',
        border: `1px solid ${color}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color,
        fontFamily: 'var(--imp-font-display)',
        fontSize: Math.max(12, Math.round(size * 0.14)),
        fontWeight: 800,
        letterSpacing: 1.4,
      }}>
        SPQR
      </div>
    </div>
  );
}
