import { useState } from 'preact/hooks';
import type { Province } from '../../../../game/province/province';
import { getAssignedGovernor } from '../../../../game/province/governor-store';

interface ProvinceRowProps {
  p: Province;
  accent?: string;
  onClick?: () => void;
  selected?: boolean;
}

/**
 * Render a single province row — used in the Forum Overview and the full
 * Provinciae tab ledger. Only reads fields that exist on Province today
 * (name, unrest, investments, baseIncome, governorId). Design fields we
 * don't have (tier "Core/Heartland/...", build-max) are derived or
 * omitted rather than invented.
 */
export function ProvinceRow({ p, accent = '#d4a843', onClick, selected = false }: ProvinceRowProps) {
  const [hover, setHover] = useState(false);

  const unrestColor =
    p.unrest > 60 ? '#c24a3a' :
    p.unrest > 35 ? accent :
    '#7a9a6a';

  const totalIncome = Object.values(p.baseIncome)
    .reduce<number>((sum, v) => sum + (v ?? 0), 0);
  const assigned = getAssignedGovernor(p.id);
  const governorName = assigned?.governor.name ?? null;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: '9px 11px',
        background:
          selected ? 'rgba(80, 60, 20, 0.25)' :
          hover ? 'rgba(40, 36, 60, 0.7)' :
          'rgba(20, 18, 32, 0.4)',
        border: `1px solid ${selected || hover ? 'rgba(212, 168, 67, 0.35)' : 'rgba(212, 168, 67, 0.15)'}`,
        borderLeft: `3px solid ${accent}`,
        borderRadius: 2,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 150ms',
        display: 'flex', alignItems: 'center', gap: 10,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: 'var(--imp-font-serif)',
          fontSize: 13,
          color: 'var(--imp-text-hi)',
          fontStyle: 'italic',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {p.name}
        </div>
        <div style={{
          fontSize: 9, letterSpacing: 1,
          color: 'var(--imp-text-lo)',
          textTransform: 'uppercase',
        }}>
          {p.terrain} · {governorName ?? 'ungoverned'}
        </div>
      </div>
      <div style={{ width: 56 }}>
        <div style={{
          fontSize: 8, letterSpacing: 1,
          color: 'var(--imp-text-lo)',
          textTransform: 'uppercase',
          marginBottom: 2,
        }}>
          Unrest
        </div>
        <div style={{
          width: '100%', height: 3,
          background: 'rgba(0, 0, 0, 0.5)',
          borderRadius: 2, overflow: 'hidden',
        }}>
          <div style={{
            width: `${Math.max(0, Math.min(100, p.unrest))}%`,
            height: '100%',
            background: unrestColor,
            boxShadow: `0 0 4px ${unrestColor}`,
          }} />
        </div>
      </div>
      <div style={{ textAlign: 'right', minWidth: 50 }}>
        <div style={{
          fontFamily: 'var(--imp-font-mono)',
          fontSize: 11,
          color: totalIncome >= 0 ? '#7a9a6a' : '#c24a3a',
          fontWeight: 600,
        }}>
          {totalIncome >= 0 ? '+' : ''}{totalIncome}⚜
        </div>
        <div style={{
          fontSize: 8,
          color: 'var(--imp-text-lo)',
          letterSpacing: 0.5,
        }}>
          {p.investments.length} built
        </div>
      </div>
    </div>
  );
}
