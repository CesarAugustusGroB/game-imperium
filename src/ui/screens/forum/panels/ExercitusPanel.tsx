import { preparedArmy, preparedLegate } from '../../../../game/progression/strategic-store';
import { getLegateTraitById } from '../../../../game/army/legate-traits';
import { BentoCard } from '../../../components/BentoCard';
import { GameIcon } from '../../../components/GameIcon';
import { SectionHeader, LinkButton, ROLE_COLORS } from '../components/SectionHeader';
import { setForumTab } from '../state';
import { SUPPLY_MAX_CARRY } from '../../../../config/game-config';
import type { Cohort } from '../../../../game/army/cohort';

interface ExercitusPanelProps {
  accent?: string;
  index?: number;
}

function getCohortCurrentHp(cohort: Cohort): number {
  return cohort.currentHp ?? (cohort.outOfAction ? 1 : cohort.stats.hp);
}

export function ExercitusPanel({ accent = '#d4a843', index = 0 }: ExercitusPanelProps) {
  const army = preparedArmy.value;
  const legate = preparedLegate.value;
  const cohorts = army?.cohorts ?? [];
  const supplies = army?.supplies ?? 0;
  const supplyLow = SUPPLY_MAX_CARRY > 0 && supplies < SUPPLY_MAX_CARRY * 0.25;
  const currentHpTotal = cohorts.reduce((sum, c) => sum + getCohortCurrentHp(c), 0);
  const maxHpTotal = cohorts.reduce((sum, c) => sum + c.stats.hp, 0);

  return (
    <BentoCard accent={accent} index={index}>
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
        {cohorts.length > 0 && (
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '2px 0 4px',
            fontSize: 10,
            color: 'var(--imp-text-lo)',
            fontFamily: 'var(--imp-font-mono)',
            letterSpacing: 0.5,
          }}>
            <span>{cohorts.length} unit{cohorts.length === 1 ? '' : 's'}</span>
            <span>{currentHpTotal}/{maxHpTotal} HP</span>
          </div>
        )}
        {cohorts.map((c) => {
          const currentHp = getCohortCurrentHp(c);
          const maxHp = c.stats.hp;
          const wounded = currentHp < maxHp || !!c.outOfAction;
          return (
            <div key={c.instanceId ?? c.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 6, height: 16,
                background: ROLE_COLORS[c.role] ?? accent,
              }} />
              <div style={{
                flex: 1,
                fontSize: 12,
                color: c.outOfAction ? 'var(--imp-danger)' : 'var(--imp-text)',
                fontFamily: 'var(--imp-font-serif)',
                fontStyle: 'italic',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {c.name}
              </div>
              <div style={{
                fontFamily: 'var(--imp-font-mono)',
                fontSize: 11,
                color: wounded ? '#d48b3a' : 'var(--imp-text-mid)',
                whiteSpace: 'nowrap',
              }}>
                {currentHp}/{maxHp} hp{c.outOfAction ? ' · OOA' : ''}
              </div>
            </div>
          );
        })}
      </div>
      {/* ── Supply chip ── */}
      <div style={{
        marginTop: 8, display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <div title={`Supplies: ${supplies} / ${SUPPLY_MAX_CARRY}`} style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '2px 7px',
          background: supplyLow ? 'rgba(194, 74, 58, 0.15)' : 'rgba(212, 168, 67, 0.1)',
          border: `1px solid ${supplyLow ? 'rgba(194, 74, 58, 0.45)' : 'rgba(212, 168, 67, 0.3)'}`,
          borderRadius: 10,
          fontSize: 9,
          color: supplyLow ? '#d48b3a' : 'var(--imp-text-mid)',
          fontFamily: 'var(--imp-font-mono)',
          letterSpacing: 0.5,
        }}>
          <GameIcon name="supplies-crate" size={12} />
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
    </BentoCard>
  );
}
