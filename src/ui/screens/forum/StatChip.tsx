import { Corners } from '../../components/motifs/Corners';
import { Tooltip } from '../../components/Tooltip';

export interface StatChipData {
  key: string;
  glyph: string;
  value: number | string;
  delta?: number;
  color: string;
  label?: string;
  description?: string;
}

interface StatChipProps {
  r: StatChipData;
  accent?: string;
}

export function StatChip({ r, accent = '#d4a843' }: StatChipProps) {
  const deltaColor = (r.delta ?? 0) >= 0 ? '#7a9a6a' : '#c24a3a';
  const sign = (r.delta ?? 0) >= 0 ? '+' : '';
  const valueLabel = typeof r.value === 'number' ? r.value.toLocaleString() : r.value;
  const chip = (
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
        {valueLabel}
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

  if (!r.label && !r.description) return chip;

  return (
    <Tooltip
      variant="rich"
      position="below"
      content={
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 180 }}>
          {r.label && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: r.color }}>
              <span>{r.glyph}</span>
              <span>{r.label}</span>
              <span style={{ marginLeft: 'auto', fontFamily: 'var(--imp-font-mono)', color: 'var(--imp-text-hi)' }}>
                {valueLabel}
              </span>
            </div>
          )}
          {r.description && (
            <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', lineHeight: 1.4 }}>
              {r.description}
            </div>
          )}
        </div>
      }
    >
      {chip}
    </Tooltip>
  );
}
