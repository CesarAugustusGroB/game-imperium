import { preparedArmy, preparedLegate } from '../../../../game/progression/strategic-store';
import { Masthead } from '../Masthead';
import { ExercitusRosterBody } from '../../ArmyRecruitmentScreen';
import { ExercitusLegateBody } from '../../LegateHiringScreen';
import { activeExercitusSubTab } from '../state';
import type { ExercitusSubTab } from '../state';

const SUB_TABS: Array<{ k: ExercitusSubTab; l: string }> = [
  { k: 'roster', l: 'Roster' },
  { k: 'legate', l: 'Legate' },
];

export function ExercitusTab() {
  const sub = activeExercitusSubTab.value;
  const army = preparedArmy.value;
  const legate = preparedLegate.value;

  const cohortCount = army?.cohorts.length ?? 0;
  const totalSize = army?.size ?? 0;
  const sizeLabel = totalSize >= 1000 ? `${(totalSize / 1000).toFixed(1)}K` : `${totalSize}`;
  const subtitle = sub === 'roster'
    ? `${cohortCount} cohort${cohortCount === 1 ? '' : 's'} · ${sizeLabel} HP`
    : legate ? `Legate: ${legate.name}` : 'No legate hired';

  return (
    <>
      <Masthead title="Exercitus" subtitle={subtitle} />

      <div style={{
        padding: '16px 32px 0',
        display: 'flex', gap: 6,
        borderBottom: '1px solid rgba(212, 168, 67, 0.15)',
      }}>
        {SUB_TABS.map((t) => {
          const active = sub === t.k;
          return (
            <button
              key={t.k}
              onClick={() => { activeExercitusSubTab.value = t.k; }}
              style={{
                padding: '8px 20px',
                background: active
                  ? 'linear-gradient(180deg, rgba(212, 168, 67, 0.18), transparent)'
                  : 'transparent',
                border: 'none',
                borderBottom: active ? '2px solid #d4a843' : '2px solid transparent',
                color: active ? 'var(--imp-text-hi)' : 'var(--imp-text-mid)',
                fontFamily: 'var(--imp-font-display)',
                fontSize: 12, letterSpacing: 3,
                textTransform: 'uppercase', fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 140ms',
              }}
            >
              {t.l}
            </button>
          );
        })}
      </div>

      <div style={{
        flex: 1, minHeight: 0, overflow: 'auto',
        padding: '20px 32px 32px',
      }}>
        {sub === 'roster' ? <ExercitusRosterBody /> : <ExercitusLegateBody />}
      </div>
    </>
  );
}
