import type { JSX } from 'preact';
import type { TierLevel } from '../../../../../types';
import tierArrow from '../../../../../assets/ui/tier-bar/tier-arrow.svg';
import tierGlow from '../../../../../assets/ui/tier-bar/tier-progress-glow.svg';
import tierSegment from '../../../../../assets/ui/tier-bar/tier-progress-active-segment.svg';
import tierTrack from '../../../../../assets/ui/tier-bar/tier-progress-track.svg';

const ROMAN: readonly string[] = ['I', 'II', 'III'];
const SEGMENTS = [
  { left: '1.5%', width: '33.3%', center: '17.8%' },
  { left: '33.6%', width: '33.7%', center: '50%' },
  { left: '65.9%', width: '32.6%', center: '82.5%' },
] as const;

interface CeremonialTrackProps {
  currentTier: TierLevel;
  /** Total cumulative XP on the advisor. */
  xp: number;
  /** Cumulative XP that reaches the next tier, or null at max tier. */
  nextTierThreshold: number | null;
  /** Cumulative XP at the start of the current tier's band (0 for Tier I). */
  prevTierThreshold?: number;
  accent?: string;
  factionColor?: string;
  style?: JSX.CSSProperties;
}

export function CeremonialTrack({
  currentTier,
  xp,
  nextTierThreshold,
  prevTierThreshold = 0,
  accent = 'var(--imp-gold)',
  factionColor = accent,
  style,
}: CeremonialTrackProps) {
  // Progress is measured WITHIN the current tier's band, not against the
  // cumulative total: a freshly-promoted Tier II advisor sits at 0%, not
  // prevThreshold/nextThreshold of the bar.
  const bandSpan = nextTierThreshold === null ? 0 : Math.max(1, nextTierThreshold - prevTierThreshold);
  const xpInBand = nextTierThreshold === null ? 0 : Math.max(0, xp - prevTierThreshold);
  const xpPct = nextTierThreshold === null
    ? 100
    : Math.min(100, Math.max(0, (xpInBand / bandSpan) * 100));
  const nextTier = nextTierThreshold === null ? null : ((currentTier + 1) as TierLevel);
  const progressStep = nextTierThreshold === null
    ? 1
    : xpPct / 100;
  const glowLeft = nextTierThreshold === null
    ? 92
    : Math.min(94, Math.max(8, (((currentTier - 1) + progressStep) / 3) * 100));

  function segmentFill(index: number): number {
    const tier = index + 1;
    if (nextTierThreshold === null) return 1;
    if (tier < currentTier) return 1;
    if (tier === currentTier) return progressStep;
    return 0;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 430, ...style }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 10,
        minWidth: 0,
      }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          minWidth: 0,
          color: 'var(--imp-text-mid)',
          fontFamily: 'var(--imp-font-display)',
          fontSize: 'clamp(15px, 1.35vw, 21px)',
          fontWeight: 700,
          letterSpacing: 0,
          textTransform: 'uppercase',
          textShadow: '0 2px 7px rgba(0, 0, 0, 0.76)',
          whiteSpace: 'nowrap',
        }}>
          <span>Tier {ROMAN[currentTier - 1] ?? 'I'}</span>
          {nextTier ? (
            <>
              <img src={tierArrow} alt="" aria-hidden="true" width={28} height={18} style={{ width: 24, height: 15, objectFit: 'contain', flex: '0 0 auto' }} />
              <span>{ROMAN[nextTier - 1]}</span>
            </>
          ) : (
            <span style={{ color: accent }}>Max</span>
          )}
        </div>
        <div style={{
          flex: '0 0 auto',
          color: 'var(--imp-text-lo)',
          fontFamily: 'var(--imp-font-mono)',
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: 0.7,
          textTransform: 'uppercase',
        }}>
          {nextTierThreshold === null ? 'MAX' : `${xpInBand} / ${bandSpan}`}
        </div>
      </div>

      <div style={{
        position: 'relative',
        width: '100%',
        height: 31,
        overflow: 'visible',
        filter: `drop-shadow(0 4px 10px rgba(0, 0, 0, 0.62)) drop-shadow(0 0 8px ${factionColor}22)`,
      }}>
        <img
          src={tierTrack}
          alt=""
          aria-hidden="true"
          width={260}
          height={28}
          style={{
            position: 'absolute',
            inset: '1px 0 auto',
            width: '100%',
            height: 28,
            objectFit: 'fill',
            pointerEvents: 'none',
          }}
        />
        {SEGMENTS.map((segment, index) => {
          const fill = segmentFill(index);
          if (fill <= 0) return null;

          return (
            <div
              key={`segment-${index}`}
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: 3,
                left: segment.left,
                width: segment.width,
                height: 24,
                overflow: 'hidden',
                pointerEvents: 'none',
              }}
            >
              <div
                style={{
                  width: `${fill * 100}%`,
                  height: '100%',
                  overflow: 'hidden',
                  transition: 'width var(--duration-normal) var(--ease-default)',
                }}
              >
                <img
                  src={tierSegment}
                  alt=""
                  width={88}
                  height={24}
                  style={{
                    width: `${100 / fill}%`,
                    minWidth: '100%',
                    height: 24,
                    objectFit: 'fill',
                    display: 'block',
                  }}
                />
              </div>
            </div>
          );
        })}
        <img
          src={tierGlow}
          alt=""
          aria-hidden="true"
          width={76}
          height={42}
          style={{
            position: 'absolute',
            top: -6,
            left: `${glowLeft}%`,
            width: 76,
            height: 42,
            objectFit: 'contain',
            transform: 'translateX(-44%)',
            opacity: nextTierThreshold === null || xpPct > 0 ? 0.9 : 0,
            pointerEvents: 'none',
            transition: 'left var(--duration-normal) var(--ease-default), opacity var(--duration-normal) var(--ease-default)',
          }}
        />
        {SEGMENTS.map((segment, index) => (
          <span
            key={`label-${index}`}
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: 8,
              left: segment.center,
              transform: 'translateX(-50%)',
              color: segmentFill(index) > 0.08 ? 'var(--imp-text-hi)' : 'var(--imp-text-lo)',
              fontFamily: 'var(--imp-font-display)',
              fontSize: 13,
              fontWeight: 700,
              lineHeight: 1,
              textShadow: '0 1px 4px rgba(0, 0, 0, 0.86)',
              pointerEvents: 'none',
            }}
          >
            {index + 1}
          </span>
        ))}
      </div>
    </div>
  );
}
