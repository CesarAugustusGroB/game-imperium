import { OrnateFrame, OrnateHeader } from './OrnateFrame';
import { Portrait } from './Portrait';
import { getLegateTraitById } from '../../game/army/legate-traits';
import type { ArmyData } from '../../types/index';
import type { Legate } from '../../game/army/legate';
import type { UnitRole } from '../../battle/battle-types';

// ── One-time CSS injection ──
if (typeof document !== 'undefined' && !document.getElementById('army-hud-styles')) {
  const el = document.createElement('style');
  el.id = 'army-hud-styles';
  el.textContent = `
    .army-hud-section {
      padding-top: 12px;
      margin-top: 12px;
      border-top: 1px solid var(--color-border-subtle);
    }
    .army-hud-section:first-child {
      padding-top: 0;
      margin-top: 0;
      border-top: none;
    }
  `;
  document.head.appendChild(el);
}

const ROLE_COLORS: Record<UnitRole, string> = {
  vanguard: '#e07050',
  reserve: '#60a8d0',
  guard: '#d4a843',
};

interface ArmyDetailHUDProps {
  army: ArmyData;
  legate: Legate | null;
  onClose: () => void;
}

export function ArmyDetailHUD({ army, legate, onClose }: ArmyDetailHUDProps) {
  // Group cohorts by id
  const cohortGroups = new Map<string, { name: string; role: UnitRole; count: number; hpEach: number }>();
  for (const c of army.cohorts) {
    const g = cohortGroups.get(c.id);
    if (g) g.count++;
    else cohortGroups.set(c.id, { name: c.name, role: c.role as UnitRole, count: 1, hpEach: c.stats.hp });
  }

  const totalHP = army.cohorts.reduce((sum, c) => sum + c.stats.hp, 0);
  const cohortCount = army.cohorts.length;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0, 0, 0, 0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 200,
        backdropFilter: 'blur(2px)',
      }}
    >
      <OrnateFrame
        width="min(480px, 92vw)"
        padding="compact"
        onClick={(e) => e.stopPropagation()}
      >
        <OrnateHeader
          eyebrow={army.owner}
          title={army.name}
          titleSize="md"
          rightSlot={<>
            <span class="ornate-stat-chip" title="Total HP">{totalHP} HP</span>
            <span class="ornate-stat-chip" title="Cohorts">{cohortCount} cohort{cohortCount !== 1 ? 's' : ''}</span>
          </>}
          onClose={onClose}
        />

        {/* ── Composition ── */}
        <div class="army-hud-section">
          <div style={{
            fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-muted)',
            letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px',
          }}>
            Composition
          </div>
          {cohortGroups.size === 0 ? (
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
              No cohorts
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {Array.from(cohortGroups.entries()).map(([id, g]) => (
                <div key={id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                    background: ROLE_COLORS[g.role] ?? 'var(--color-text-muted)',
                    boxShadow: `0 0 4px ${ROLE_COLORS[g.role] ?? 'transparent'}60`,
                  }} />
                  <div style={{
                    flex: 1, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {g.name}
                  </div>
                  <div style={{ fontSize: '8px', color: 'var(--color-text-muted)', flexShrink: 0 }}>×{g.count}</div>
                  <div style={{ fontSize: '8px', color: 'var(--color-text-muted)', flexShrink: 0, minWidth: '40px', textAlign: 'right' }}>
                    {g.count * g.hpEach} HP
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Legate ── */}
        <div class="army-hud-section">
          <div style={{
            fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-muted)',
            letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px',
          }}>
            Legate
          </div>
          {legate ? (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <Portrait alt={legate.name} size="small" />
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{
                  fontSize: 'var(--font-size-sm)', fontWeight: 700,
                  color: 'var(--color-text-primary)', fontFamily: 'var(--font-display)',
                  letterSpacing: '0.8px', marginBottom: '6px',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {legate.name}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {legate.traitIds.map(tid => {
                    const trait = getLegateTraitById(tid);
                    return trait ? (
                      <div key={tid} style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', lineHeight: '1.4' }}>
                        <span style={{ fontWeight: 700, color: 'var(--color-gold-secondary)' }}>{trait.name}</span>
                        {' — '}
                        {trait.description}
                      </div>
                    ) : null;
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
              No legate assigned
            </div>
          )}
        </div>

        {/* ── Status ── */}
        <div class="army-hud-section">
          <div style={{
            fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-muted)',
            letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px',
          }}>
            Status
          </div>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
              <span style={{ color: 'var(--color-text-muted)', fontSize: '8px', letterSpacing: '1px', textTransform: 'uppercase' }}>Combat</span>
              <br />
              {army.inCombat
                ? <span style={{ color: 'var(--color-danger)' }}>Engaged</span>
                : <span style={{ color: 'var(--color-success)' }}>At ease</span>
              }
            </div>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
              <span style={{ color: 'var(--color-text-muted)', fontSize: '8px', letterSpacing: '1px', textTransform: 'uppercase' }}>Owner</span>
              <br />
              <span style={{ textTransform: 'capitalize' }}>{army.owner}</span>
            </div>
            {army.legateId && (
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                <span style={{ color: 'var(--color-text-muted)', fontSize: '8px', letterSpacing: '1px', textTransform: 'uppercase' }}>Legate ID</span>
                <br />
                <span style={{ fontFamily: 'var(--font-family)', fontSize: '8px', opacity: 0.6 }}>{army.legateId}</span>
              </div>
            )}
          </div>
        </div>
      </OrnateFrame>
    </div>
  );
}
