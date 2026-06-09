import type { JSX, ComponentChildren } from 'preact';
import { getPriorityStyle, priorityClass } from '../../../../components/card-priority';

interface BonusCardProps {
  icon: ComponentChildren;
  value: ComponentChildren;
  label: ComponentChildren;
  accent?: string;
  muted?: boolean;
  style?: JSX.CSSProperties;
}

export function BonusCard({
  icon,
  value,
  label,
  accent = 'var(--imp-gold)',
  muted = false,
  style,
}: BonusCardProps) {
  return (
    <div class={priorityClass(muted ? 'disabled' : 'actionable')} style={{
      position: 'relative',
      minWidth: 0,
      padding: '10px 11px',
      borderRadius: 2,
      border: `1px solid ${muted ? 'var(--imp-gold-faint)' : 'var(--imp-gold-dim)'}`,
      background: muted
        ? 'rgba(13, 11, 20, 0.58)'
        : 'linear-gradient(180deg, rgba(122, 36, 50, 0.18) 0%, rgba(13, 11, 20, 0.82) 100%)',
      boxShadow: muted ? undefined : `inset 0 0 18px ${accent}10`,
      overflow: 'hidden',
      ...getPriorityStyle(muted ? 'disabled' : 'actionable', accent),
      ...style,
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        minWidth: 0,
      }}>
        <div style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flex: '0 0 auto',
          border: `1px solid ${accent}`,
          background: `radial-gradient(circle, ${accent}28 0%, rgba(13, 11, 20, 0.9) 72%)`,
          color: accent,
          fontSize: 14,
        }}>
          {icon}
        </div>
        <div style={{ flex: 1, minWidth: 0, textAlign: 'right' }}>
          <div style={{
            color: muted ? 'var(--imp-text-mid)' : 'var(--imp-text-hi)',
            fontFamily: 'var(--imp-font-display)',
            fontSize: 18,
            fontWeight: 700,
            lineHeight: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {value}
          </div>
          <div style={{
            marginTop: 4,
            color: 'var(--imp-text-mid)',
            fontFamily: 'var(--imp-font-body)',
            fontSize: 'var(--imp-text-xs)',
            fontWeight: 700,
            letterSpacing: 'var(--imp-meta-letter)',
            lineHeight: 1.2,
            textTransform: 'uppercase',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {label}
          </div>
        </div>
      </div>
    </div>
  );
}
