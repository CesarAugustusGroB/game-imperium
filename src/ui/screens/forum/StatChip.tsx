import { Corners } from '../../components/motifs/Corners';

export interface StatChipData {
  key: string;
  glyph: string;
  value: number;
  delta?: number;
  color: string;
}

interface StatChipProps {
  r: StatChipData;
  accent?: string;
}

export function StatChip({ r, accent = '#d4a843' }: StatChipProps) {
  const deltaColor = (r.delta ?? 0) >= 0 ? '#7a9a6a' : '#c24a3a';
  const sign = (r.delta ?? 0) >= 0 ? '+' : '';
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '6px 12px',
        background: 'rgba(20, 18, 32, 0.7)',
        border: '1px solid rgba(212, 168, 67, 0.15)',
        borderRadius: 2,
        position: 'relative',
      }}
    >
      <Corners color={accent} size={6} inset={0} thickness={1} />
      <span style={{ color: r.color, fontSize: 14, lineHeight: 1 }}>{r.glyph}</span>
      <span style={{
        fontFamily: 'var(--imp-font-mono)',
        fontSize: 13, fontWeight: 600,
        color: 'var(--imp-text-hi)',
      }}>
        {r.value.toLocaleString()}
      </span>
      {r.delta !== undefined && (
        <span style={{
          fontSize: 9,
          color: deltaColor,
          fontFamily: 'var(--imp-font-mono)',
        }}>
          {sign}{r.delta}
        </span>
      )}
    </div>
  );
}
