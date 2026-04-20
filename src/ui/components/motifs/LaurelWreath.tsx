import { Laurel } from './Laurel';

interface LaurelWreathProps {
  size?: number;
  color?: string;
  opacity?: number;
}

export function LaurelWreath({ size = 80, color = '#d4a843', opacity = 0.5 }: LaurelWreathProps) {
  return (
    <div style={{ position: 'relative', width: size, height: size, opacity }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: size / 2, height: size }}>
        <Laurel size={size * 0.9} color={color} opacity={1} />
      </div>
      <div style={{ position: 'absolute', right: 0, top: 0, width: size / 2, height: size }}>
        <Laurel size={size * 0.9} color={color} opacity={1} flip />
      </div>
    </div>
  );
}
