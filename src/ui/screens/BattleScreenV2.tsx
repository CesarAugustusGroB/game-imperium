/**
 * BattleScreenV2 — Preact-rendered battle UI overlay.
 *
 * Sits on top of the canvas-based battle renderer, providing rich reactive
 * panels for army info, selected unit stats, phase announcements, and
 * capture progress. The hex-grid canvas continues to run underneath.
 */
import { useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import {
  battlePhase, battleWinner, battleRound, selectedUnit,
  blueSummary, redSummary, blueCohesion, redCohesion,
  captureBlueProgress, captureRedProgress,
  requestBattleExit,
} from '../../battle/battle-signals';
import type { BattleFactionSummary, BattleUnitSummary } from '../../battle/battle-signals';
import type { UnitRole } from '../../battle/battle-types';
import { CAPTURE_DURATION } from '../../battle/battle-config';
import { gfxShadows, gfxCracks, gfxParticles, gfxHighRes, gfxPerfHud, spriteReloadTrigger } from '../../battle/battle-settings';
import { BattleContextBanner } from '../components/spoke/BattleContextBanner';

// ── One-time CSS injection ──
if (typeof document !== 'undefined' && !document.getElementById('battle-v2-styles')) {
  const el = document.createElement('style');
  el.id = 'battle-v2-styles';
  el.textContent = `
    /* Phase announcement */
    @keyframes phase-pulse {
      0%   { opacity: 0; transform: translate(-50%, -50%) scale(0.7); }
      20%  { opacity: 1; transform: translate(-50%, -50%) scale(1.05); }
      30%  { transform: translate(-50%, -50%) scale(1); }
      80%  { opacity: 1; }
      100% { opacity: 0; transform: translate(-50%, -50%) scale(1.1); }
    }
    .phase-announce {
      animation: phase-pulse 2.5s ease-out forwards;
      pointer-events: none;
    }

    /* Army panel hover */
    .bv2-army-panel {
      transition: border-color var(--duration-normal) var(--ease-default);
    }
    .bv2-army-panel:hover {
      border-color: var(--color-border-strong) !important;
    }

    /* Unit info slide-in */
    @keyframes unit-info-in {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .bv2-unit-info {
      animation: unit-info-in 0.2s ease-out;
    }

    /* Capture bar glow */
    @keyframes capture-glow {
      0%, 100% { box-shadow: 0 0 4px rgba(240, 208, 128, 0.2); }
      50%      { box-shadow: 0 0 12px rgba(240, 208, 128, 0.5); }
    }
    .bv2-capture-active {
      animation: capture-glow 1s ease-in-out infinite;
    }

    /* Phase banner persistent */
    @keyframes banner-in {
      from { opacity: 0; transform: translate(-50%, -50%) scale(0.85); }
      to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    }
    .bv2-end-banner {
      animation: banner-in 0.5s ease-out forwards;
    }

    /* Stat row hover */
    .bv2-stat-row {
      transition: background var(--duration-fast) var(--ease-default);
      border-radius: var(--radius-sm);
      padding: 2px 6px;
      margin: 0 -6px;
    }
    .bv2-stat-row:hover {
      background: rgba(240, 208, 128, 0.06);
    }
  `;
  document.head.appendChild(el);
}

// ── Constants ──

const ROLE_COLORS: Record<UnitRole, string> = {
  vanguard: '#e07050',
  reserve:  '#60a8d0',
  guard:    '#d4a843',
};

const ROLE_ICONS: Record<UnitRole, string> = {
  vanguard: '\u2694',  // crossed swords
  reserve:  '\u2726',  // four-pointed star
  guard:    '\u26E8',  // shield
};

const ROLE_LABELS: Record<UnitRole, string> = {
  vanguard: 'Vanguard',
  reserve:  'Reserve',
  guard:    'Guard',
};

const FACTION_LABEL: Record<'blue' | 'red', string> = {
  blue: 'Your Army',
  red:  'Enemy Force',
};

const FACTION_COLOR: Record<'blue' | 'red', string> = {
  blue: '#5090d0',
  red:  '#c05040',
};

// ── Sub-components ──

function ArmyPanel({ faction, summary, cohesion, captureProgress }: {
  faction: 'blue' | 'red';
  summary: BattleFactionSummary;
  cohesion: number;
  captureProgress: number;
}) {
  const color = FACTION_COLOR[faction];
  const isLeft = faction === 'blue';
  const capturePct = Math.min(100, (captureProgress / CAPTURE_DURATION) * 100);
  const isCapturing = captureProgress > 0;

  return (
    <div
      class="bv2-army-panel"
      style={{
        position: 'fixed',
        top: '16px',
        [isLeft ? 'left' : 'right']: '16px',
        width: '200px',
        background: 'rgba(10, 10, 20, 0.85)',
        backdropFilter: 'blur(8px)',
        border: `1px solid ${color}40`,
        borderRadius: 'var(--radius-md)',
        padding: '12px 14px',
        fontFamily: 'var(--font-family)',
        zIndex: 20,
        pointerEvents: 'auto',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '8px',
      }}>
        <span style={{
          fontSize: 'var(--font-size-xs)', fontWeight: 700,
          color, letterSpacing: '2px', textTransform: 'uppercase',
        }}>
          {FACTION_LABEL[faction]}
        </span>
        <span style={{
          fontSize: 'var(--font-size-xs)',
          color: 'var(--color-text-muted)',
        }}>
          {summary.aliveUnits}/{summary.totalUnits}
        </span>
      </div>

      {/* Cohesion bar (faction strength as HP %) */}
      <div style={{ marginBottom: '10px' }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', marginBottom: '3px',
        }}>
          <span style={{
            fontSize: '8px', color: 'var(--color-text-muted)',
            letterSpacing: '1px', textTransform: 'uppercase',
          }}>
            Strength
          </span>
          <span style={{
            fontSize: '8px', color: color, fontWeight: 700,
          }}>
            {cohesion}%
          </span>
        </div>
        <div style={{
          height: '6px',
          background: 'rgba(20, 18, 36, 0.9)',
          borderRadius: 'var(--radius-sm)',
          overflow: 'hidden',
          border: '1px solid rgba(80, 80, 80, 0.2)',
        }}>
          <div style={{
            width: `${cohesion}%`,
            height: '100%',
            background: `linear-gradient(90deg, ${color}90, ${color})`,
            borderRadius: 'var(--radius-sm)',
            transition: 'width 0.3s ease',
          }} />
        </div>
      </div>

      {/* Role breakdown */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {(['vanguard', 'reserve', 'guard'] as UnitRole[]).map(role => {
          const tally = summary.byRole[role];
          if (tally.total === 0) return null;
          return (
            <div key={role} style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)',
            }}>
              <span style={{ color: ROLE_COLORS[role], fontSize: '10px', width: '12px', textAlign: 'center' }}>
                {ROLE_ICONS[role]}
              </span>
              <span style={{ flex: 1 }}>{ROLE_LABELS[role]}</span>
              <span style={{
                fontWeight: 600,
                color: tally.alive === 0 ? 'var(--color-danger)' : 'var(--color-text-secondary)',
              }}>
                {tally.alive}/{tally.total}
              </span>
            </div>
          );
        })}
      </div>

      {/* Capture progress (only show when active) */}
      {isCapturing && (
        <div class={capturePct > 50 ? 'bv2-capture-active' : undefined} style={{
          marginTop: '10px',
          padding: '6px 8px',
          background: 'rgba(240, 208, 128, 0.08)',
          border: '1px solid rgba(240, 208, 128, 0.2)',
          borderRadius: 'var(--radius-sm)',
        }}>
          <div style={{
            fontSize: '8px', color: 'var(--color-gold-secondary)',
            letterSpacing: '1px', textTransform: 'uppercase',
            marginBottom: '3px',
          }}>
            {faction === 'blue' ? 'Enemy capturing!' : 'Capturing star!'}
          </div>
          <div style={{
            height: '4px',
            background: 'rgba(20, 18, 36, 0.9)',
            borderRadius: '2px',
            overflow: 'hidden',
          }}>
            <div style={{
              width: `${capturePct}%`,
              height: '100%',
              background: 'var(--color-gold-primary)',
              transition: 'width 0.2s linear',
            }} />
          </div>
        </div>
      )}
    </div>
  );
}

function UnitInfoPanel({ unit }: { unit: BattleUnitSummary }) {
  const hpPct = unit.maxHp > 0 ? Math.round((unit.currentHp / unit.maxHp) * 100) : 0;
  const hpColor = hpPct > 60 ? 'var(--color-success)' : hpPct > 30 ? 'var(--color-warning)' : 'var(--color-danger)';
  const factionColor = FACTION_COLOR[unit.faction];

  return (
    <div class="bv2-unit-info" style={{
      position: 'fixed',
      bottom: '60px',
      left: '16px',
      width: '220px',
      background: 'rgba(10, 10, 20, 0.88)',
      backdropFilter: 'blur(8px)',
      border: `1px solid ${factionColor}40`,
      borderRadius: 'var(--radius-md)',
      padding: '12px 14px',
      fontFamily: 'var(--font-family)',
      zIndex: 20,
      pointerEvents: 'auto',
    }}>
      {/* Name & role */}
      <div style={{ marginBottom: '8px' }}>
        <div style={{
          fontSize: 'var(--font-size-md)', fontWeight: 700,
          color: factionColor, letterSpacing: '0.5px',
        }}>
          {unit.name}
        </div>
        <div style={{
          fontSize: 'var(--font-size-xs)',
          color: ROLE_COLORS[unit.role],
          letterSpacing: '1px', textTransform: 'uppercase',
          marginTop: '2px',
        }}>
          {ROLE_ICONS[unit.role]} {ROLE_LABELS[unit.role]}
        </div>
      </div>

      {/* HP bar */}
      <div style={{ marginBottom: '10px' }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', marginBottom: '3px',
        }}>
          <span style={{ fontSize: '8px', color: 'var(--color-text-muted)', letterSpacing: '1px' }}>
            HP
          </span>
          <span style={{ fontSize: '8px', color: hpColor, fontWeight: 700 }}>
            {unit.currentHp} / {unit.maxHp}
          </span>
        </div>
        <div style={{
          height: '6px',
          background: 'rgba(20, 18, 36, 0.9)',
          borderRadius: 'var(--radius-sm)',
          overflow: 'hidden',
          border: '1px solid rgba(80, 80, 80, 0.2)',
        }}>
          <div style={{
            width: `${hpPct}%`,
            height: '100%',
            background: hpColor,
            borderRadius: 'var(--radius-sm)',
            transition: 'width 0.2s ease',
          }} />
        </div>
      </div>

      {/* Stats grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
        <StatRow label="ATK" value={unit.atk} color="#e07050" />
        <StatRow label="DEF" value={unit.def} color="#60a8d0" />
        <StatRow label="AGI" value={unit.agi} color="#a0d060" />
      </div>
    </div>
  );
}

function StatRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div class="bv2-stat-row" style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      fontSize: 'var(--font-size-xs)',
    }}>
      <span style={{ color: 'var(--color-text-muted)', letterSpacing: '1px' }}>{label}</span>
      <span style={{ color, fontWeight: 700 }}>{value}</span>
    </div>
  );
}

function TopBar() {
  const phase = battlePhase.value;
  const round = battleRound.value;

  return (
    <div style={{
      position: 'fixed',
      top: '12px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 20,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '4px',
      fontFamily: 'var(--font-family)',
      pointerEvents: 'none',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '16px',
      }}>
        <span style={{
          fontFamily: 'var(--font-display)',
          fontSize: '18px', fontWeight: 700,
          color: 'var(--color-gold-primary)',
          textShadow: '0 2px 8px rgba(0, 0, 0, 0.7), 0 0 16px rgba(240, 208, 128, 0.3)',
          letterSpacing: '4px', textTransform: 'uppercase',
        }}>
          Tactical Battle
        </span>
        {phase === 'fighting' && (
          <span style={{
            fontSize: '10px',
            color: 'var(--color-text-muted)',
            background: 'rgba(10, 10, 20, 0.7)',
            padding: '3px 8px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-border-subtle)',
            letterSpacing: '1px',
          }}>
            Round {round}
          </span>
        )}
      </div>
      <span style={{
        fontSize: '11px',
        color: 'rgba(200, 190, 160, 0.45)',
        letterSpacing: '1px',
      }}>
        Click unit to select &bull; Right-click to move &bull; ESC to exit
      </span>
    </div>
  );
}

function PhaseOverlay() {
  const phase = battlePhase.value;
  const winner = battleWinner.value;
  const showOverlay = useSignal(false);

  // Show persistent end-battle banner
  useEffect(() => {
    if (phase !== 'fighting') {
      showOverlay.value = true;
    } else {
      showOverlay.value = false;
    }
  }, [phase]);

  if (!showOverlay.value) return null;

  const isVictory = winner === 'blue';
  const isDraw = phase === 'draw';
  const text = isDraw ? 'DRAW' : isVictory ? 'VICTORY' : 'DEFEAT';
  const color = isDraw ? '#888' : isVictory ? 'var(--color-gold-primary)' : 'var(--color-danger)';
  const glow = isDraw ? 'rgba(128,128,128,0.3)' : isVictory ? 'rgba(240, 208, 128, 0.4)' : 'rgba(200, 60, 50, 0.4)';

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      zIndex: 50,
      pointerEvents: 'auto',
    }}>
      <div class="bv2-end-banner" style={{
        position: 'absolute',
        top: '40%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px',
      }}>
        <div style={{
          fontFamily: 'var(--font-display)',
          fontSize: '56px', fontWeight: 700,
          color,
          letterSpacing: '12px', textTransform: 'uppercase',
          textShadow: `0 4px 20px ${glow}, 0 0 40px ${glow}`,
        }}>
          {text}
        </div>
        <div style={{
          fontSize: 'var(--font-size-md)',
          color: 'var(--color-text-secondary)',
          letterSpacing: '2px',
        }}>
          {isDraw ? 'Neither side prevailed' : isVictory ? 'The enemy has been routed!' : 'Your forces were overwhelmed'}
        </div>
        <button
          onClick={() => { requestBattleExit.value = true; }}
          style={{
            marginTop: '12px',
            padding: '10px 28px',
            borderRadius: 'var(--radius-sm)',
            background: 'linear-gradient(180deg, rgba(80, 60, 20, 0.7), rgba(50, 40, 18, 0.85))',
            border: `1px solid ${color}80`,
            color,
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--font-size-md)',
            fontWeight: 700,
            letterSpacing: '3px',
            textTransform: 'uppercase',
            cursor: 'pointer',
            transition: 'all var(--duration-normal) var(--ease-default)',
          }}
        >
          Continue
        </button>
      </div>
    </div>
  );
}

function StrengthComparison() {
  const bCohesion = blueCohesion.value;
  const rCohesion = redCohesion.value;
  const total = bCohesion + rCohesion;
  const bluePct = total > 0 ? (bCohesion / total) * 100 : 50;

  return (
    <div style={{
      position: 'fixed',
      top: '62px',
      left: '50%',
      transform: 'translateX(-50%)',
      width: '300px',
      zIndex: 20,
      pointerEvents: 'none',
    }}>
      {/* Labels */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        fontSize: '8px', letterSpacing: '1px',
        marginBottom: '3px',
      }}>
        <span style={{ color: FACTION_COLOR.blue, fontWeight: 700 }}>
          {bCohesion}%
        </span>
        <span style={{
          color: 'var(--color-text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '2px',
        }}>
          Strength
        </span>
        <span style={{ color: FACTION_COLOR.red, fontWeight: 700 }}>
          {rCohesion}%
        </span>
      </div>

      {/* Dual bar */}
      <div style={{
        height: '5px',
        background: 'rgba(20, 18, 36, 0.9)',
        borderRadius: '3px',
        overflow: 'hidden',
        display: 'flex',
        border: '1px solid rgba(80, 80, 80, 0.2)',
      }}>
        <div style={{
          width: `${bluePct}%`,
          height: '100%',
          background: `linear-gradient(90deg, ${FACTION_COLOR.blue}90, ${FACTION_COLOR.blue})`,
          transition: 'width 0.3s ease',
        }} />
        <div style={{
          width: `${100 - bluePct}%`,
          height: '100%',
          background: `linear-gradient(90deg, ${FACTION_COLOR.red}, ${FACTION_COLOR.red}90)`,
          transition: 'width 0.3s ease',
        }} />
      </div>
    </div>
  );
}

// ── Settings ──

/** Inline Feather-style eye icon. `open` shows an open eye; `!open` adds a slash. */
function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function ToggleRow({ label, description, value, onChange }: {
  label: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 0',
        cursor: 'pointer',
      }}
      onClick={() => onChange(!value)}
    >
      <div>
        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', fontWeight: 600 }}>
          {label}
        </div>
        <div style={{ fontSize: '9px', color: 'var(--color-text-muted)', marginTop: '1px' }}>
          {description}
        </div>
      </div>
      <div style={{
        width: '36px', height: '20px',
        borderRadius: '10px',
        background: value ? 'var(--color-gold-primary)' : 'rgba(60, 60, 80, 0.8)',
        border: '1px solid rgba(120, 120, 140, 0.3)',
        position: 'relative',
        flexShrink: 0,
        marginLeft: '12px',
        transition: 'background 0.15s ease',
      }}>
        <div style={{
          width: '16px', height: '16px',
          borderRadius: '50%',
          background: '#fff',
          position: 'absolute',
          top: '1px',
          left: value ? '17px' : '1px',
          transition: 'left 0.15s ease',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        }} />
      </div>
    </div>
  );
}

function SettingsPanel({ open }: { open: { value: boolean } }) {
  if (!open.value) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '56px',
      right: '16px',
      width: '230px',
      background: 'rgba(10, 10, 20, 0.92)',
      backdropFilter: 'blur(8px)',
      border: '1px solid rgba(240, 208, 128, 0.15)',
      borderRadius: 'var(--radius-md)',
      padding: '14px 16px',
      fontFamily: 'var(--font-family)',
      zIndex: 30,
      pointerEvents: 'auto',
    }}>
      <div style={{
        fontSize: 'var(--font-size-xs)', fontWeight: 700,
        color: 'var(--color-gold-primary)',
        letterSpacing: '2px', textTransform: 'uppercase',
        marginBottom: '10px',
        paddingBottom: '6px',
        borderBottom: '1px solid rgba(240, 208, 128, 0.1)',
      }}>
        Graphics
      </div>

      <ToggleRow
        label="Shadows"
        description="Drop shadows on all units"
        value={gfxShadows.value}
        onChange={(v) => { gfxShadows.value = v; }}
      />
      <ToggleRow
        label="Damage Cracks"
        description="Crack overlay on hurt units"
        value={gfxCracks.value}
        onChange={(v) => { gfxCracks.value = v; }}
      />
      <ToggleRow
        label="Particles"
        description="Hit and death particle effects"
        value={gfxParticles.value}
        onChange={(v) => { gfxParticles.value = v; }}
      />
      <ToggleRow
        label="High-Res Sprites"
        description="2x resolution (uses more VRAM)"
        value={gfxHighRes.value}
        onChange={(v) => {
          gfxHighRes.value = v;
          spriteReloadTrigger.value++;
        }}
      />
      <ToggleRow
        label="Perf HUD"
        description="Frame ms + per-layer render cost"
        value={gfxPerfHud.value}
        onChange={(v) => { gfxPerfHud.value = v; }}
      />
    </div>
  );
}

// ── Main Screen ──

export function BattleScreenV2() {
  const phase = battlePhase.value;
  const unit = selectedUnit.value;
  const blue = blueSummary.value;
  const red = redSummary.value;
  const bCohesion = blueCohesion.value;
  const rCohesion = redCohesion.value;
  const capBlue = captureBlueProgress.value;
  const capRed = captureRedProgress.value;
  const settingsOpen = useSignal(false);
  const hudHidden    = useSignal(false);

  // Hide the old HTML battle HUD — this overlay replaces the top title/round
  // block and the coords dev button. The bottom bar stays visible: it carries
  // the commander-ability button ("leader effect") and the decretum grid,
  // which V2 does not yet re-implement in Preact.
  useEffect(() => {
    const oldHud = document.getElementById('battle-hud');
    const oldCoords = document.getElementById('btn-coords');
    if (oldHud) oldHud.style.display = 'none';
    if (oldCoords) oldCoords.style.display = 'none';
    return () => {
      if (oldHud) oldHud.style.display = '';
      if (oldCoords) oldCoords.style.display = '';
    };
  }, []);

  return (
    <div style={{
      position: 'fixed', inset: 0,
      pointerEvents: 'none',
      zIndex: 15,
      fontFamily: 'var(--font-family)',
    }}>
      {/* Hide-able UI — wrapped so the eye toggle removes every overlay and
          lets the raw battle canvas (sprites + map) show in full glory. */}
      {!hudHidden.value && (
        <>
          {/* S27-10: campaign context banner — landmark name, terrain,
              modifiers. Renders nothing in quick battles (context is null). */}
          <BattleContextBanner />

          {/* Top bar: title + round */}
          <TopBar />

          {/* Strength comparison bar */}
          <StrengthComparison />

          {/* Army panels */}
          <ArmyPanel
            faction="blue"
            summary={blue}
            cohesion={bCohesion}
            captureProgress={capRed}
          />
          <ArmyPanel
            faction="red"
            summary={red}
            cohesion={rCohesion}
            captureProgress={capBlue}
          />

          {/* Selected unit info */}
          {unit && !unit.isDying && (
            <UnitInfoPanel unit={unit} />
          )}
        </>
      )}

      {/* Bottom-right controls — eye (hide UI) + gear (settings). Always
          visible so the user can toggle the UI back on. */}
      <div style={{
        position: 'fixed',
        bottom: '16px',
        right: '16px',
        zIndex: 30,
        pointerEvents: 'auto',
        display: 'flex',
        gap: '8px',
      }}>
        <button
          onClick={() => { hudHidden.value = !hudHidden.value; }}
          style={{
            width: '36px', height: '36px',
            borderRadius: 'var(--radius-sm)',
            background: hudHidden.value
              ? 'rgba(240, 208, 128, 0.15)'
              : 'rgba(10, 10, 20, 0.7)',
            border: `1px solid ${hudHidden.value ? 'rgba(240, 208, 128, 0.4)' : 'rgba(80, 80, 80, 0.3)'}`,
            color: hudHidden.value ? 'var(--color-gold-primary)' : 'var(--color-text-muted)',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s ease',
          }}
          title={hudHidden.value ? 'Show UI' : 'Hide UI'}
          aria-label={hudHidden.value ? 'Show UI' : 'Hide UI'}
        >
          <EyeIcon open={!hudHidden.value} />
        </button>
        <button
          onClick={() => { settingsOpen.value = !settingsOpen.value; }}
          style={{
            width: '36px', height: '36px',
            borderRadius: 'var(--radius-sm)',
            background: settingsOpen.value
              ? 'rgba(240, 208, 128, 0.15)'
              : 'rgba(10, 10, 20, 0.7)',
            border: `1px solid ${settingsOpen.value ? 'rgba(240, 208, 128, 0.4)' : 'rgba(80, 80, 80, 0.3)'}`,
            color: settingsOpen.value ? 'var(--color-gold-primary)' : 'var(--color-text-muted)',
            fontSize: '18px',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s ease',
          }}
          title="Graphics Settings"
        >
          {'\u2699'}
        </button>
      </div>
      {!hudHidden.value && <SettingsPanel open={settingsOpen} />}

      {/* Phase overlay (victory/defeat/draw) */}
      {phase !== 'fighting' && <PhaseOverlay />}
    </div>
  );
}
