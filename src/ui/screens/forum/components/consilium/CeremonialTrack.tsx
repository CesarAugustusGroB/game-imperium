import type { JSX } from 'preact';
import type { TierLevel } from '../../../../../types';

const ROMAN: readonly string[] = ['I', 'II', 'III'];

interface CeremonialTrackProps {
  currentTier: TierLevel;
  xp: number;
  nextTierThreshold: number | null;
  accent?: string;
  factionColor?: string;
  style?: JSX.CSSProperties;
}

export function CeremonialTrack({
  currentTier,
  xp,
  nextTierThreshold,
  accent = 'var(--imp-gold)',
  factionColor = accent,
  style,
}: CeremonialTrackProps) {
  const xpPct = nextTierThreshold === null
    ? 100
    : Math.min(100, Math.max(0, (xp / nextTierThreshold) * 100));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7, ...style }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        gap: 7,
        alignItems: 'center',
      }}>
        {ROMAN.map((tier, index) => {
          const tierNumber = (index + 1) as TierLevel;
          const active = tierNumber === currentTier;
          const complete = tierNumber < currentTier;
          return (
            <div key={tier} style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
              <div style={{
                width: 30,
                height: 30,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: active || complete
                  ? `radial-gradient(circle, ${factionColor}44 0%, rgba(13, 11, 20, 0.96) 74%)`
                  : 'rgba(13, 11, 20, 0.72)',
                border: `1px solid ${active || complete ? accent : 'var(--imp-gold-faint)'}`,
                boxShadow: active ? `0 0 12px ${accent}55` : undefined,
                color: active || complete ? 'var(--imp-text-hi)' : 'var(--imp-text-lo)',
                fontFamily: 'var(--imp-font-display)',
                fontSize: 11,
                fontWeight: 700,
                flex: '0 0 auto',
              }}>
                {tier}
              </div>
              {index < ROMAN.length - 1 && (
                <div style={{
                  height: 1,
                  flex: 1,
                  minWidth: 0,
                  marginLeft: 7,
                  background: complete
                    ? `linear-gradient(90deg, ${accent}, ${factionColor})`
                    : 'var(--imp-gold-faint)',
                }} />
              )}
            </div>
          );
        })}
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        color: 'var(--imp-text-lo)',
        fontFamily: 'var(--imp-font-mono)',
        fontSize: 9,
        letterSpacing: 0.5,
      }}>
        <div style={{
          flex: 1,
          height: 5,
          overflow: 'hidden',
          borderRadius: 999,
          background: 'rgba(0, 0, 0, 0.54)',
          border: '1px solid rgba(212, 168, 67, 0.12)',
        }}>
          <div style={{
            width: `${xpPct}%`,
            height: '100%',
            background: `linear-gradient(90deg, ${factionColor} 0%, ${accent} 100%)`,
            boxShadow: `0 0 8px ${accent}66`,
            transition: 'width var(--duration-normal) var(--ease-default)',
          }} />
        </div>
        <span style={{ flex: '0 0 auto' }}>
          {nextTierThreshold === null ? 'MAX' : `${xp}/${nextTierThreshold}`}
        </span>
      </div>
    </div>
  );
}
