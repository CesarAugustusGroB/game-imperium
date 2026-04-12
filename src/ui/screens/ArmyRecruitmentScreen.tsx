import { navigateTo } from '../screens';
import { OrnateFrame, OrnateHeader } from '../components/OrnateFrame';
import { COHORT_CATALOG } from '../../game/army/cohort-data';
import { FACTION_COLORS } from '../../game/core/commander';
import { selectedCommander } from '../../game/core/game-state';
import { gold } from '../../game/core/resources';
import { preparedArmy, ensurePreparedArmy, recruitCohort, removeCohort } from '../../game/progression/strategic-store';
import { PANEL, PANEL_TITLE } from '../ui-constants';
import { playSfx } from '../sound/sfx';
import type { UnitRole } from '../../battle/battle-types';

// ── One-time CSS injection ──
if (typeof document !== 'undefined' && !document.getElementById('recruitment-screen-styles')) {
  const el = document.createElement('style');
  el.id = 'recruitment-screen-styles';
  el.textContent = `
    .recruitment-card {
      transition: all var(--duration-normal) var(--ease-default);
      cursor: pointer;
    }
    .recruitment-card:hover {
      border-color: var(--color-gold-primary) !important;
      box-shadow: var(--shadow-md);
      transform: translateY(-1px);
    }
    .recruitment-card.selected {
      border-color: var(--color-gold-secondary) !important;
      background: rgba(30, 28, 48, 0.96) !important;
    }
    .recruitment-remove-btn {
      transition: all var(--duration-fast) var(--ease-default);
      cursor: pointer;
    }
    .recruitment-remove-btn:hover {
      background: rgba(180, 60, 60, 0.35) !important;
      border-color: rgba(220, 100, 100, 0.5) !important;
      color: #e8a0a0 !important;
    }
    .recruitment-remove-btn:active { transform: scale(0.96); }
  `;
  document.head.appendChild(el);
}

// ── Constants ──

const ROLE_COLORS: Record<UnitRole, string> = {
  vanguard: '#e07050',
  reserve:  '#60a8d0',
  guard:    '#d4a843',
};

const ROLE_LABELS: Record<UnitRole, string> = {
  vanguard: 'Vanguard',
  reserve:  'Reserve',
  guard:    'Guard',
};

// Stat bar normalization — max across catalog per stat
const STAT_MAX = {
  atk: Math.max(...COHORT_CATALOG.map(c => c.stats.atk)),
  def: Math.max(...COHORT_CATALOG.map(c => c.stats.def)),
  hp:  Math.max(...COHORT_CATALOG.map(c => c.stats.hp)),
  agi: Math.max(...COHORT_CATALOG.map(c => c.stats.agi)),
};

const STAT_COLORS = {
  atk: '#e07050',
  def: '#60a8d0',
  hp:  '#5a8a4a',
  agi: '#d4a843',
};

function StatBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
      <div style={{ width: '24px', fontSize: '8px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', flexShrink: 0 }}>
        {label}
      </div>
      <div style={{ flex: 1, height: '5px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '3px', transition: 'width var(--duration-slow) var(--ease-default)' }} />
      </div>
      <div style={{ width: '28px', fontSize: '8px', color: 'var(--color-text-muted)', textAlign: 'right', flexShrink: 0 }}>
        {value}
      </div>
    </div>
  );
}

export function ArmyRecruitmentScreen() {
  // Ensure prepared army exists when the screen mounts
  ensurePreparedArmy();

  const commander = selectedCommander.value;
  const faction = commander?.faction ?? null;
  const accentColor = faction ? FACTION_COLORS[faction] : undefined;

  // Force reactivity on gold + prepared army
  const currentGold = gold.value;
  const army = preparedArmy.value;
  const cohorts = army?.cohorts ?? [];

  // Grouped composition for right panel
  const groupMap = new Map<string, { name: string; role: UnitRole; count: number; aurumCost: number }>();
  for (const c of cohorts) {
    const g = groupMap.get(c.id);
    if (g) {
      g.count++;
    } else {
      groupMap.set(c.id, { name: c.name, role: c.role, count: 1, aurumCost: c.aurumCost });
    }
  }
  const groups = Array.from(groupMap.entries());
  const totalSize = army?.size ?? 0;

  function handleRecruit(cohortId: string) {
    if (recruitCohort(cohortId)) {
      playSfx('ui_equip');
    }
  }

  function handleRemove(cohortId: string) {
    removeCohort(cohortId);
    playSfx('ui_sell');
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      minHeight: '100vh', fontFamily: 'var(--font-family)',
      background: 'var(--color-bg-primary)',
      paddingTop: '48px', paddingBottom: '40px',
    }}>
      <OrnateFrame width="min(1100px, 94vw)">
        <OrnateHeader
          eyebrow="Army Management"
          title="RECRUITMENT"
          rightSlot={<>
            <span class="ornate-stat-chip" title="Gold">⚜ <strong>{currentGold}</strong></span>
            <span class="ornate-stat-chip" title="Cohorts">{cohorts.length} cohort{cohorts.length !== 1 ? 's' : ''}</span>
            {totalSize > 0 && (
              <span class="ornate-stat-chip" title="Army size">{totalSize >= 1000 ? `${(totalSize / 1000).toFixed(1)}K` : totalSize} HP</span>
            )}
          </>}
          onClose={() => navigateTo('hub')}
          accentColor={accentColor}
        />

        {/* Two-column layout */}
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-start' }}>

          {/* ── LEFT: Cohort browser ── */}
          <div style={{ flex: '2 1 400px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ ...PANEL_TITLE, marginBottom: 0 }}>Available Cohorts</div>

            {COHORT_CATALOG.map(cohort => {
              const canBuy = currentGold >= cohort.aurumCost;
              const roleColor = ROLE_COLORS[cohort.role];
              return (
                <div
                  key={cohort.id}
                  class="recruitment-card"
                  style={{
                    background: 'var(--color-bg-secondary)',
                    border: '1px solid var(--color-border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '14px 16px',
                    display: 'flex',
                    gap: '16px',
                    alignItems: 'flex-start',
                  }}
                >
                  {/* Info block */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <div style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: 'var(--font-display)', letterSpacing: '1px' }}>
                        {cohort.name}
                      </div>
                      <div style={{
                        fontSize: 'var(--font-size-xs)', fontWeight: 600, letterSpacing: '1px',
                        padding: '1px 7px', borderRadius: '10px',
                        background: `${roleColor}20`, border: `1px solid ${roleColor}60`,
                        color: roleColor, textTransform: 'uppercase',
                      }}>
                        {ROLE_LABELS[cohort.role]}
                      </div>
                    </div>

                    <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginBottom: '10px', lineHeight: '1.4' }}>
                      {cohort.description}
                    </div>

                    {/* Stat bars */}
                    <div style={{ maxWidth: '260px' }}>
                      <StatBar label="ATK" value={cohort.stats.atk} max={STAT_MAX.atk} color={STAT_COLORS.atk} />
                      <StatBar label="DEF" value={cohort.stats.def} max={STAT_MAX.def} color={STAT_COLORS.def} />
                      <StatBar label="HP"  value={cohort.stats.hp}  max={STAT_MAX.hp}  color={STAT_COLORS.hp} />
                      <StatBar label="AGI" value={cohort.stats.agi} max={STAT_MAX.agi} color={STAT_COLORS.agi} />
                    </div>
                  </div>

                  {/* Recruit block */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', flexShrink: 0 }}>
                    <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: canBuy ? 'var(--color-gold-primary)' : 'var(--color-text-muted)' }}>
                      {cohort.aurumCost}g
                    </div>
                    <button
                      class="ornate-btn"
                      disabled={!canBuy}
                      onClick={() => handleRecruit(cohort.id)}
                      style={{ fontSize: 'var(--font-size-xs)', padding: '6px 14px', opacity: canBuy ? 1 : 0.35, cursor: canBuy ? 'pointer' : 'not-allowed' }}
                    >
                      Recruit
                    </button>
                    {!canBuy && (
                      <div style={{ fontSize: '8px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                        Need {cohort.aurumCost - currentGold}g more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── RIGHT: Army composition ── */}
          <div style={{ flex: '1 1 220px', minWidth: '220px' }}>
            <div style={{
              ...PANEL,
              background: 'var(--color-bg-secondary)',
              position: 'sticky',
              top: '56px',
            }}>
              <div style={{ ...PANEL_TITLE, marginBottom: '10px' }}>
                Army Composition
              </div>

              {groups.length === 0 ? (
                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', fontStyle: 'italic', padding: '8px 0' }}>
                  No cohorts recruited yet
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
                  {groups.map(([id, g]) => (
                    <div key={id} style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      padding: '5px 8px', borderRadius: 'var(--radius-sm)',
                      background: 'var(--color-bg-tertiary)',
                      border: '1px solid var(--color-border-subtle)',
                    }}>
                      <div style={{
                        width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                        background: ROLE_COLORS[g.role],
                      }} />
                      <div style={{ flex: 1, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {g.name}
                      </div>
                      <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-text-primary)', flexShrink: 0, marginRight: '4px' }}>
                        ×{g.count}
                      </div>
                      <button
                        class="recruitment-remove-btn"
                        onClick={() => handleRemove(id)}
                        title={`Remove one ${g.name}`}
                        style={{
                          width: '18px', height: '18px', padding: 0,
                          background: 'transparent',
                          border: '1px solid var(--color-border-subtle)',
                          borderRadius: 'var(--radius-sm)',
                          color: 'var(--color-text-muted)',
                          fontSize: '10px', lineHeight: 1,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontFamily: 'inherit', flexShrink: 0,
                        }}
                      >
                        −
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Totals */}
              {groups.length > 0 && (
                <div style={{
                  borderTop: '1px solid var(--color-border-subtle)',
                  paddingTop: '10px',
                  display: 'flex', flexDirection: 'column', gap: '4px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                    <span>Units</span>
                    <span style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>{cohorts.length}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                    <span>Total HP</span>
                    <span style={{ fontWeight: 700, color: 'var(--color-success)' }}>{totalSize >= 1000 ? `${(totalSize / 1000).toFixed(1)}K` : totalSize}</span>
                  </div>
                </div>
              )}

              {/* Back button */}
              <div style={{ marginTop: '16px' }}>
                <button
                  class="ornate-btn-ghost"
                  onClick={() => navigateTo('hub')}
                  style={{ width: '100%', padding: '8px', fontSize: 'var(--font-size-xs)' }}
                >
                  ← Back to Hub
                </button>
              </div>
            </div>
          </div>

        </div>
      </OrnateFrame>
    </div>
  );
}
