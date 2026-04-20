import type { JSX, ComponentChildren } from 'preact';
import { Corners } from './motifs/Corners';

interface OrnatePanelProps {
  children: ComponentChildren;
  accent?: string;
  cornersSize?: number;
  noCorners?: boolean;
  padding?: string;
  style?: JSX.CSSProperties;
}

export function OrnatePanel({
  children,
  accent = '#d4a843',
  cornersSize = 10,
  noCorners = false,
  padding = '16px 18px',
  style,
}: OrnatePanelProps) {
  return (
    <div
      style={{
        border: `1px solid rgba(212, 168, 67, 0.35)`,
        borderRadius: 2,
        position: 'relative',
        padding,
        ...style,
        background: 'linear-gradient(rgba(122, 36, 50, 0.18) 0%, rgba(22, 19, 34, 0.98) 70%) 0% 0% / cover',
      }}
    >
      {!noCorners && <Corners color={accent} size={cornersSize} inset={4} thickness={1} />}
      {children}
    </div>
  );
}
