import { preparedArmy, preparedLegate } from '../../../../game/progression/strategic-store';
import { getLegateTraitById } from '../../../../game/army/legate-traits';
import { OrnatePanel } from '../../../components/OrnatePanel';
import { SectionHeader, LinkButton, ROLE_COLORS } from '../components/SectionHeader';
import { setForumTab } from '../state';
import { SUPPLY_MAX_CARRY } from '../../../../config/game-config';

interface ExercitusPanelProps {
  accent?: string;
}

export function ExercitusPanel({ accent = '#d4a843' }: ExercitusPanelProps) {
  const army = preparedArmy.value;
  const legate = preparedLegate.value;
  const cohorts = army?.cohorts ?? [];
  const supplies = army?.supplies ?? 0;
  const supplyLow = SUPPLY_MAX_CARRY > 0 && supplies < SUPPLY_MAX_CARRY * 0.25;

  return (
    <OrnatePanel accent={accent}>
      <SectionHeader
        title="Exercitus"
        accent={accent}
        right={<LinkButton label="Open →" onClick={() => setForumTab('exercitus')} accent={accent} />}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {cohorts.length === 0 && (
          <div style={{
            padding: '10px 4px',
            fontFamily: 'var(--imp-font-serif)',
            fontStyle: 'italic', fontSize: 11,
            color: 'var(--imp-text-lo)',
          }}>
            No cohorts prepared.
          </div>
        )}
        {cohorts.map((c) => (
          <div key={c.instanceId ?? c.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 6, height: 16,
              background: ROLE_COLORS[c.role] ?? accent,
            }} />
            <div style={{
              flex: 1,
              fontSize: 12,
              color: 'var(--imp-text)',
              fontFamily: 'var(--imp-font-serif)',
              fontStyle: 'italic',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {c.name}
            </div>
            <div style={{
              fontFamily: 'var(--imp-font-mono)',
              fontSize: 11,
              color: 'var(--imp-text-mid)',
            }}>
              hp {c.stats.hp}
            </div>
          </div>
        ))}
      </div>
      {/* ── Supply chip ── */}
      <div style={{
        marginTop: 8, display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '2px 7px',
          background: supplyLow ? 'rgba(194, 74, 58, 0.15)' : 'rgba(212, 168, 67, 0.1)',
          border: `1px solid ${supplyLow ? 'rgba(194, 74, 58, 0.45)' : 'rgba(212, 168, 67, 0.3)'}`,
          borderRadius: 10,
          fontSize: 9,
          color: supplyLow ? '#d48b3a' : 'var(--imp-text-mid)',
          fontFamily: 'var(--imp-font-mono)',
          letterSpacing: 0.5,
          title: `Supplies: ${supplies} / ${SUPPLY_MAX_CARRY}`,
        }}>
          <span>📦</span>
          <span>{supplies}/{SUPPLY_MAX_CARRY}</span>
        </div>
      </div>

      {legate && (
        <div style={{
          marginTop: 10, paddingTop: 10,
          borderTop: '1px solid rgba(212, 168, 67, 0.15)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{
            width: 30, height: 30, borderRadius: '50%',
            border: `1px solid ${accent}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--imp-font-display)',
            color: accent, fontSize: 11, fontWeight: 700,
            flexShrink: 0,
          }}>
            {legate.name.charAt(0)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: 'var(--imp-font-display)',
              fontSize: 11, fontWeight: 600,
              color: 'var(--imp-text-hi)',
              letterSpacing: 1,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {legate.name}
            </div>
            <div style={{
              fontSize: 9,
              color: 'var(--imp-text-lo)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {legate.traitIds.map((id) => getLegateTraitById(id)?.name).filter(Boolean).join(' · ') || '—'}
            </div>
          </div>
        </div>
      )}
    </OrnatePanel>
  );
}
