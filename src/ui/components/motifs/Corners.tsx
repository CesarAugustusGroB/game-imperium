type CornerPosition = 'tl' | 'tr' | 'bl' | 'br';

interface CornerBracketProps {
  size?: number;
  color?: string;
  corner: CornerPosition;
  thickness?: number;
}

interface CornersProps {
  color?: string;
  size?: number;
  inset?: number;
  thickness?: number;
}

export function CornerBracket({ size = 20, color = '#d4a843', corner, thickness = 1.5 }: CornerBracketProps) {
  const half = thickness / 2;
  const paths: Record<CornerPosition, string> = {
    tl: `M${size} ${half} L${half} ${half} L${half} ${size}`,
    tr: `M0 ${half} L${size - half} ${half} L${size - half} ${size}`,
    bl: `M${size} ${size - half} L${half} ${size - half} L${half} 0`,
    br: `M0 ${size - half} L${size - half} ${size - half} L${size - half} 0`,
  };
  const pos: Record<CornerPosition, Record<string, number>> = {
    tl: { top: 0, left: 0 },
    tr: { top: 0, right: 0 },
    bl: { bottom: 0, left: 0 },
    br: { bottom: 0, right: 0 },
  };
  return (
    <svg
      width={size}
      height={size}
      style={{ position: 'absolute', pointerEvents: 'none', ...pos[corner] }}
    >
      <path d={paths[corner]} fill="none" stroke={color} stroke-width={thickness} />
    </svg>
  );
}

export function Corners({ color = '#d4a843', size = 16, inset = 4, thickness = 1.5 }: CornersProps) {
  return (
    <div style={{ position: 'absolute', inset, pointerEvents: 'none' }}>
      <CornerBracket size={size} color={color} corner="tl" thickness={thickness} />
      <CornerBracket size={size} color={color} corner="tr" thickness={thickness} />
      <CornerBracket size={size} color={color} corner="bl" thickness={thickness} />
      <CornerBracket size={size} color={color} corner="br" thickness={thickness} />
    </div>
  );
}
