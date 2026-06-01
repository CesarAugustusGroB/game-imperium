import { useEffect, useRef, useState } from 'preact/hooks';
import { gold, iuniores } from '../../../../game/core/resources';
import { globalSeason, MAX_SEASONS } from '../../../../game/core/game-state';
import { BentoCard } from '../../../components/BentoCard';
import { GameIcon } from '../../../components/GameIcon';
import { SectionHeader } from '../components/SectionHeader';
import goldStackIcon from '../../../../assets/ui/resources/gold-stack-icon.png';
import iunioresIcon from '../../../../assets/ui/resources/iuniores-icon-color.png';
import seasonIcon from '../../../../assets/ui/resources/season-icon-color.png';

interface TreasuryPanelProps {
  accent?: string;
  index?: number;
}

/**
 * Aerarium — the treasury readout. Only the resources actually live in this
 * worktree are shown (Aurum/gold, Iuniores, Season); faith/influence/momentum
 * are deprecated and intentionally omitted. Each meter shows value, the last
 * observed delta, and a fill bar toward a soft reference cap.
 */
export function TreasuryPanel({ accent = '#d4a843', index = 0 }: TreasuryPanelProps) {
  return (
    <BentoCard accent={accent} index={index} interactive>
      <SectionHeader title="Aerarium · Treasury" accent={accent} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 18px' }}>
        <Meter label="Aurum" value={gold.value} cap={2000} color="#f0d080" iconSrc={goldStackIcon} />
        <Meter label="Iuniores" value={iuniores.value} cap={50} color="#a88b5c" iconSrc={iunioresIcon} />
        <Meter
          label="Season"
          value={globalSeason.value}
          cap={MAX_SEASONS}
          color="#d4a843"
          iconSrc={seasonIcon}
          display={`${globalSeason.value}/${MAX_SEASONS}`}
        />
      </div>
    </BentoCard>
  );
}

interface MeterProps {
  label: string;
  value: number;
  cap: number;
  color: string;
  iconSrc: string;
  display?: string;
}

function Meter({ label, value, cap, color, iconSrc, display }: MeterProps) {
  const prev = useRef(value);
  const [delta, setDelta] = useState(0);

  useEffect(() => {
    if (value !== prev.current) {
      setDelta(value - prev.current);
      prev.current = value;
    }
  }, [value]);

  const pct = Math.max(0, Math.min(1, value / cap));

  return (
    <div style={{ minWidth: 0 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4,
      }}>
        <img src={iconSrc} alt="" style={{ width: 16, height: 16, objectFit: 'contain', flexShrink: 0 }} />
        <span style={{
          fontFamily: 'var(--imp-font-body)',
          fontSize: 9, letterSpacing: 2,
          color: 'var(--imp-text-lo)',
          textTransform: 'uppercase',
        }}>
          {label}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{
          fontFamily: 'var(--imp-font-display)',
          fontSize: 22, fontWeight: 600,
          color: 'var(--imp-text-hi)',
          lineHeight: 1,
        }}>
          {display ?? value}
        </span>
        {delta !== 0 && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 2,
            fontFamily: 'var(--imp-font-mono)',
            fontSize: 10,
            color: delta > 0 ? 'var(--imp-oxidize)' : 'var(--imp-danger)',
          }}>
            <GameIcon name={delta > 0 ? 'delta-up' : 'delta-down'} size={9} />
            {Math.abs(delta)}
          </span>
        )}
      </div>
      <div style={{
        marginTop: 7,
        height: 3,
        borderRadius: 2,
        background: 'rgba(0, 0, 0, 0.45)',
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${pct * 100}%`,
          height: '100%',
          background: `linear-gradient(90deg, ${color}99, ${color})`,
          boxShadow: `0 0 8px ${color}66`,
          transition: 'width var(--duration-slow) var(--ease-default)',
        }} />
      </div>
    </div>
  );
}
