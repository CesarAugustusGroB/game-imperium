import { navigateTo } from '../screens';
import { OrnateFrame, OrnateHeader } from '../components/OrnateFrame';
import { Portrait } from '../components/Portrait';
import { FACTION_COLORS } from '../../game/core/commander';
import { selectedCommander } from '../../game/core/game-state';
import { gold } from '../../game/core/resources';
import { canAfford } from '../../game/core/resources';
import {
  preparedLegate,
  legateHiringPool,
  ensureLegatePool,
  hireLegate,
  dismissLegate,
} from '../../game/progression/strategic-store';
import { getLegateTraitById } from '../../game/army/legate-traits';
import { PANEL, PANEL_TITLE } from '../ui-constants';
import { playSfx } from '../sound/sfx';

// ── One-time CSS injection ──
if (typeof document !== 'undefined' && !document.getElementById('legate-screen-styles')) {
  const el = document.createElement('style');
  el.id = 'legate-screen-styles';
  el.textContent = `
    .legate-card {
      transition: all var(--duration-normal) var(--ease-default);
      cursor: pointer;
    }
    .legate-card:hover {
      border-color: var(--color-gold-primary) !important;
      box-shadow: var(--shadow-md);
      transform: translateY(-1px);
    }
    .legate-dismiss-btn {
      transition: all var(--duration-fast) var(--ease-default);
      cursor: pointer;
    }
    .legate-dismiss-btn:hover {
      background: rgba(180, 60, 60, 0.35) !important;
      border-color: rgba(220, 100, 100, 0.5) !important;
      color: #e8a0a0 !important;
    }
    .legate-dismiss-btn:active { transform: scale(0.96); }
    .legate-trait-tag {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 9px;
      letter-spacing: 0.5px;
      background: rgba(240, 208, 128, 0.08);
      border: 1px solid rgba(240, 208, 128, 0.2);
      color: var(--color-text-secondary);
    }
  `;
  document.head.appendChild(el);
}

const LEGATE_HIRE_COST = 80;

export function LegateHiringScreen() {
  // Ensure pool has candidates on mount
  ensureLegatePool();

  const commander = selectedCommander.value;
  const faction = commander?.faction ?? null;
  const accentColor = faction ? FACTION_COLORS[faction] : undefined;

  const currentGold = gold.value;
  const currentLegate = preparedLegate.value;
  const pool = legateHiringPool.value;
  const canHire = canAfford('gold', LEGATE_HIRE_COST);

  function handleHire(legateId: string) {
    if (hireLegate(legateId, LEGATE_HIRE_COST)) {
      playSfx('ui_equip');
    }
  }

  function handleDismiss() {
    dismissLegate();
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
          title="LEGATES"
          rightSlot={<>
            <span class="ornate-stat-chip" title="Gold">⚜ <strong>{currentGold}</strong></span>
            {currentLegate ? (
              <span class="ornate-stat-chip" title="Assigned Legate">{currentLegate.name.split(' ')[0]}</span>
            ) : (
              <span class="ornate-stat-chip" style={{ color: 'var(--color-text-muted)' }}>No Legate</span>
            )}
          </>}
          onClose={() => navigateTo('hub')}
          accentColor={accentColor}
        />

        {/* ── Current Legate section ── */}
        {currentLegate && (
          <div style={{
            ...PANEL,
            background: 'var(--color-bg-secondary)',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '14px',
            flexWrap: 'wrap',
          }}>
            <Portrait alt={currentLegate.name} size="medium" />

            <div style={{ flex: 1 }}>
              <div style={{ ...PANEL_TITLE, marginBottom: '4px' }}>Assigned Legate</div>
              <div style={{
                fontSize: 'var(--font-size-md)', fontWeight: 700,
                color: 'var(--color-text-primary)', fontFamily: 'var(--font-display)',
                letterSpacing: '1px', marginBottom: '8px',
              }}>
                {currentLegate.name}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {currentLegate.traitIds.map(tid => {
                  const trait = getLegateTraitById(tid);
                  return trait ? (
                    <span key={tid} class="legate-trait-tag" title={trait.description}>
                      {trait.name}
                    </span>
                  ) : null;
                })}
              </div>
            </div>

            <button
              class="legate-dismiss-btn"
              onClick={handleDismiss}
              title="Dismiss Legate (no refund)"
              style={{
                padding: '5px 12px', flexShrink: 0,
                background: 'transparent',
                border: '1px solid var(--color-border-subtle)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--color-text-muted)',
                fontSize: 'var(--font-size-xs)', letterSpacing: '1px',
                textTransform: 'uppercase', fontFamily: 'inherit',
              }}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* ── Hire cost header ── */}
        <div style={{ ...PANEL_TITLE, marginBottom: '12px' }}>
          Hire a Legate — {LEGATE_HIRE_COST}g each
        </div>

        {/* ── Candidate grid ── */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          justifyContent: 'center',
          marginBottom: '24px',
        }}>
          {pool.map(candidate => {
            const traits = candidate.traitIds
              .map(tid => getLegateTraitById(tid))
              .filter(Boolean);

            return (
              <div
                key={candidate.id}
                class="legate-card"
                style={{
                  flex: '1 1 200px',
                  maxWidth: '280px',
                  background: 'var(--color-bg-secondary)',
                  border: '1px solid var(--color-border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                {/* Portrait + name */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Portrait alt={candidate.name} size="small" />
                  <div style={{
                    fontSize: 'var(--font-size-sm)', fontWeight: 700,
                    color: 'var(--color-text-primary)', fontFamily: 'var(--font-display)',
                    letterSpacing: '0.8px', lineHeight: '1.3',
                  }}>
                    {candidate.name}
                  </div>
                </div>

                {/* Traits */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                  {traits.map(trait => trait && (
                    <div key={trait.id} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-gold-secondary)', letterSpacing: '0.5px' }}>
                        {trait.name}
                      </div>
                      <div style={{ fontSize: '8px', color: 'var(--color-text-muted)', lineHeight: '1.4' }}>
                        {trait.description}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Hire button */}
                <button
                  class="ornate-btn"
                  disabled={!canHire}
                  onClick={() => handleHire(candidate.id)}
                  style={{
                    width: '100%', fontSize: 'var(--font-size-xs)', padding: '7px',
                    opacity: canHire ? 1 : 0.35,
                    cursor: canHire ? 'pointer' : 'not-allowed',
                  }}
                >
                  Hire — {LEGATE_HIRE_COST}g
                </button>

                {!canHire && (
                  <div style={{ fontSize: '8px', color: 'var(--color-text-muted)', textAlign: 'center', marginTop: '-6px' }}>
                    Need {LEGATE_HIRE_COST - currentGold}g more
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Back ── */}
        <div style={{ textAlign: 'center' }}>
          <button
            class="ornate-btn-ghost"
            onClick={() => navigateTo('hub')}
            style={{ padding: '9px 28px', fontSize: 'var(--font-size-xs)' }}
          >
            ← Back to Hub
          </button>
        </div>
      </OrnateFrame>
    </div>
  );
}
