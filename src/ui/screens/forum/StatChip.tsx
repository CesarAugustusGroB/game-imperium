import { Tooltip } from '../../components/Tooltip';

export interface StatChipData {
  key: string;
  glyph: string;
  iconSrc?: string;
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
  const sign = (r.delta ?? 0) > 0 ? '+' : '';
  const valueLabel = typeof r.value === 'number' ? r.value.toLocaleString() : r.value;
  const chip = (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '6px 13px',
        background: 'linear-gradient(180deg, rgba(26, 23, 38, 0.9), rgba(7, 5, 12, 0.92))',
        border: `1px solid ${accent}59`,
        borderRadius: 6,
        boxShadow: 'inset 0 0 0 1px rgba(0, 0, 0, 0.5)',
        position: 'relative',
      }}
    >
      {r.iconSrc ? (
        <img
          src={r.iconSrc}
          alt=""
          style={{ width: 20, height: 20, objectFit: 'contain', display: 'block' }}
        />
      ) : (
        <span style={{ color: r.color, fontSize: 14, lineHeight: 1 }}>{r.glyph}</span>
      )}
      <span style={{
        fontFamily: 'var(--imp-font-mono)',
        fontSize: 'var(--imp-text-md)', fontWeight: 700,
        color: 'var(--imp-text-hi)',
      }}>
        {valueLabel}
      </span>
      {r.delta !== undefined && (
        <span style={{
          fontSize: 'var(--imp-text-xs)',
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
              {r.iconSrc ? (
                <img
                  src={r.iconSrc}
                  alt=""
                  style={{ width: 20, height: 20, objectFit: 'contain', display: 'block' }}
                />
              ) : (
                <span>{r.glyph}</span>
              )}
              <span>{r.label}</span>
              <span style={{ marginLeft: 'auto', fontFamily: 'var(--imp-font-mono)', color: 'var(--imp-text-hi)' }}>
                {valueLabel}
              </span>
            </div>
          )}
          {r.description && (
            <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--imp-text-sm)', lineHeight: 1.4 }}>
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
