interface MosaicBandProps {
  width?: number;
  height?: number;
  color?: string;
  opacity?: number;
}

export function MosaicBand({ width = 300, height = 10, color = '#d4a843', opacity = 0.5 }: MosaicBandProps) {
  const pattern = `M0 ${height} L0 0 L${height / 2} 0 L${height / 2} ${height - height / 3} L${height * 1.2} ${height - height / 3} L${height * 1.2} ${height / 3} L${height * 0.3} ${height / 3}`;
  const unit = height * 1.6;
  const count = Math.ceil(width / unit);
  return (
    <svg width={width} height={height} style={{ display: 'block', opacity }}>
      {Array.from({ length: count }).map((_, i) => (
        <g key={i} transform={`translate(${i * unit}, 0)`}>
          <path d={pattern} fill="none" stroke={color} stroke-width="0.8" />
        </g>
      ))}
    </svg>
  );
}
