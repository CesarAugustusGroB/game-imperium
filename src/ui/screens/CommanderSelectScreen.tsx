import { signal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { OrnateFrame, OrnateDivider } from '../components/OrnateFrame';
import { COMMANDERS } from '../../data/commanders';
import { ARCHETYPE_COLORS } from '../../game/core/commander';
import type { Commander } from '../../game/core/commander';
import { startNewRun } from '../../game/core/game-state';
import { navigateTo } from '../screens';

// ── Module-level signals (reset on mount) ──────────────────────────────────
const selectedIndex = signal(0);
const selecting = signal(false);

// ── One-time CSS injection ──────────────────────────────────────────────────
if (typeof document !== 'undefined' && !document.getElementById('cmdr-select-styles')) {
  const el = document.createElement('style');
  el.id = 'cmdr-select-styles';
  el.textContent = `
    @keyframes cmdr-fade-in {
      from { opacity: 0; transform: translateY(14px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes cmdr-glow-pulse {
      0%, 100% { box-shadow: 0 0 24px rgba(240,208,128,0.4), 0 0 48px rgba(240,208,128,0.15); }
      50%       { box-shadow: 0 0 32px rgba(240,208,128,0.55), 0 0 64px rgba(240,208,128,0.25); }
    }

    .cmdr-screen-bg {
      position: fixed; inset: 0; z-index: 0; pointer-events: none;
    }
    .cmdr-screen-bg::before {
      content: '';
      position: fixed; inset: 0;
      background: radial-gradient(ellipse at center, rgba(240,208,128,0.04), transparent 70%);
      pointer-events: none;
    }
    .cmdr-screen-bg::after {
      content: '';
      position: fixed; inset: 0;
      background: radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.7));
      pointer-events: none;
    }

    .cmdr-main-enter { animation: cmdr-fade-in 0.45s ease-out both; }
    .cmdr-carousel-enter { animation: cmdr-fade-in 0.5s 0.1s ease-out both; }
    .cmdr-panel-enter { animation: cmdr-fade-in 0.5s 0.2s ease-out both; }

    .cmdr-card-selected {
      border-color: var(--color-gold-primary) !important;
      animation: cmdr-glow-pulse 2.5s ease-in-out infinite;
    }

    .cmdr-card-wrap {
      position: relative;
      flex-shrink: 0;
    }
    .cmdr-card-wrap .cmdr-selected-gem {
      position: absolute;
      bottom: -12px;
      left: 50%;
      transform: translateX(-50%);
      font-size: 14px;
      color: var(--color-gold-primary);
      text-shadow: 0 0 8px rgba(240,208,128,0.8);
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.2s ease;
    }
    .cmdr-card-wrap.is-selected .cmdr-selected-gem {
      opacity: 1;
    }

    .cmdr-card {
      position: relative;
      overflow: hidden;
      border-radius: var(--radius-md);
      cursor: pointer;
      transition: border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
      width: clamp(150px, 16vw, 200px);
      height: clamp(250px, 28vw, 350px);
    }
    .cmdr-card:hover {
      transform: scale(1.02);
    }

    .cmdr-carousel-arrow {
      width: 40px; height: 40px;
      border-radius: 50%;
      background: rgba(20,16,32,0.6);
      border: 1px solid var(--color-border-default);
      color: var(--color-gold-secondary);
      display: flex; align-items: center; justify-content: center;
      cursor: pointer;
      transition: border-color 0.2s ease, box-shadow 0.2s ease, color 0.2s ease;
      flex-shrink: 0;
    }
    .cmdr-carousel-arrow:hover {
      border-color: var(--color-gold-primary);
      color: var(--color-gold-primary);
      box-shadow: 0 0 12px rgba(240,208,128,0.3);
    }

    .cmdr-esc-btn {
      position: fixed; top: 24px; right: 24px;
      width: 44px; height: 44px;
      background: rgba(20,16,32,0.75);
      border: 1px solid var(--color-border-default);
      border-radius: var(--radius-sm);
      color: var(--color-gold-secondary);
      cursor: pointer;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      gap: 2px;
      transition: border-color 0.2s ease, color 0.2s ease;
      z-index: 100;
      font-family: var(--font-family);
    }
    .cmdr-esc-btn:hover {
      border-color: var(--color-gold-primary);
      color: var(--color-gold-primary);
    }
    .cmdr-esc-btn .esc-label {
      font-size: 9px; letter-spacing: 1px; font-weight: 700; text-transform: uppercase;
      line-height: 1;
    }
    .cmdr-esc-btn .esc-x {
      font-size: 15px; line-height: 1;
    }

    .cmdr-header-divider {
      display: flex; align-items: center; gap: 10px;
      width: 360px; max-width: 90vw;
      margin: 4px auto 0;
    }
    .cmdr-header-divider .div-line {
      flex: 1; height: 1px;
      background: linear-gradient(90deg, transparent, var(--color-gold-secondary));
    }
    .cmdr-header-divider .div-line.right {
      background: linear-gradient(270deg, transparent, var(--color-gold-secondary));
    }
    .cmdr-header-divider .div-gem {
      color: var(--color-gold-secondary);
      font-size: 12px;
      flex-shrink: 0;
    }

    .cmdr-col-heading {
      font-family: var(--font-display);
      font-size: var(--font-size-xs);
      font-weight: 700;
      letter-spacing: 3px;
      text-transform: uppercase;
      color: var(--color-gold-secondary);
      margin-bottom: 6px;
    }

    .cmdr-ability-card {
      display: flex; align-items: flex-start; gap: 10px;
      padding: 10px;
      background: rgba(0,0,0,0.25);
      border-radius: var(--radius-sm);
      border: 1px solid rgba(255,255,255,0.05);
    }

    .cmdr-ability-icon {
      width: 34px; height: 34px; flex-shrink: 0;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
    }

    .cmdr-unit-item {
      display: flex; align-items: flex-start; gap: 10px;
    }

    .cmdr-unit-tile {
      width: 34px; height: 34px; flex-shrink: 0;
      border-radius: var(--radius-sm);
      display: flex; align-items: center; justify-content: center;
      font-size: 18px;
    }

    .cmdr-victory-row {
      display: flex; align-items: center; gap: 6px;
    }
    .cmdr-victory-dots {
      display: flex; gap: 3px; margin-left: auto; flex-shrink: 0;
    }

    .cmdr-focus-pill {
      display: inline-flex; align-items: center;
      padding: 3px 10px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.5px;
    }

    .cmdr-bonus-list {
      list-style: none; padding: 0; margin: 0;
      display: flex; flex-direction: column; gap: 4px;
    }
    .cmdr-bonus-list li {
      display: flex; align-items: flex-start; gap: 6px;
      font-size: 12px;
      color: var(--color-text-secondary);
      line-height: 1.4;
    }
    .cmdr-bonus-list li::before {
      content: '•';
      color: var(--color-gold-secondary);
      flex-shrink: 0;
      margin-top: 1px;
    }

    .cmdr-details-grid {
      display: grid;
      grid-template-columns: 1.3fr 1fr 1fr 1fr;
      gap: 20px;
    }

    .cmdr-cta-btn {
      padding: 12px 26px;
      font-family: var(--font-display);
      font-weight: 700;
      font-size: 13px;
      letter-spacing: 2px;
      color: #2a1f0a;
      background: linear-gradient(180deg, #f0d080, #d4a843);
      border: 1px solid #f0d080;
      border-radius: var(--radius-sm);
      cursor: pointer;
      box-shadow: 0 0 24px rgba(240,208,128,0.4), inset 0 1px 0 rgba(255,255,255,0.3);
      text-transform: uppercase;
      transition: box-shadow 0.2s ease, filter 0.2s ease;
      white-space: nowrap;
    }
    .cmdr-cta-btn:hover {
      filter: brightness(1.08);
      box-shadow: 0 0 36px rgba(240,208,128,0.55), inset 0 1px 0 rgba(255,255,255,0.35);
    }

    @media (max-width: 1024px) {
      .cmdr-details-grid {
        grid-template-columns: 1fr 1fr;
        gap: 24px;
      }
      .cmdr-card {
        width: clamp(140px, 22vw, 200px);
        height: clamp(220px, 26vw, 300px);
      }
      .cmdr-card-archetype {
        font-size: 22px !important;
      }
    }
    @media (max-width: 720px) {
      .cmdr-details-grid {
        grid-template-columns: 1fr 1fr;
        gap: 16px;
      }
      .cmdr-card {
        width: clamp(120px, 42vw, 180px);
        height: clamp(180px, 45vw, 260px);
      }
      .cmdr-header-divider { width: 260px; }
      .cmdr-card-archetype {
        font-size: 18px !important;
      }
    }
    @media (max-width: 480px) {
      .cmdr-details-grid { grid-template-columns: 1fr; }
    }
  `;
  document.head.appendChild(el);
}

// ── Archetype SVG icons ────────────────────────────────────────────────────
function ArchetypeIcon({ archetype, size = 16, color = 'currentColor' }: {
  archetype: Commander['archetype'];
  size?: number;
  color?: string;
}) {
  const s = size;
  switch (archetype) {
    case 'Religious':
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" fill={color}>
          {/* Latin cross */}
          <rect x="6.5" y="1" width="3" height="14" rx="0.5" />
          <rect x="2"   y="5" width="12" height="3"  rx="0.5" />
        </svg>
      );
    case 'Warlord':
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" fill={color}>
          {/* Axe */}
          <path d="M5 2 C5 2 3 3 3 6 C3 8 5 9 7 8 L10 14 C10.5 15 11.5 15 12 14.5 C12.5 14 12.5 13 12 12.5 L9 6.5 C10.5 5.5 11 3.5 9.5 2.5 C8 1.5 6 1 5 2Z" />
        </svg>
      );
    case 'Diplomat':
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.2">
          {/* Laurel wreath — simplified oval with leaf marks */}
          <ellipse cx="8" cy="8" rx="6" ry="6" />
          <path d="M4 5 C3 3.5 2 4 2.5 5.5" />
          <path d="M3.5 8 C2 7.5 1.5 8.5 2.5 9.5" />
          <path d="M4.5 11 C3.5 12 4 13 5.5 12.5" />
          <path d="M12 5 C13 3.5 14 4 13.5 5.5" />
          <path d="M12.5 8 C14 7.5 14.5 8.5 13.5 9.5" />
          <path d="M11.5 11 C12.5 12 12 13 10.5 12.5" />
        </svg>
      );
    case 'Merchant':
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.3">
          {/* Balance scale */}
          <line x1="8" y1="1" x2="8" y2="14" />
          <line x1="3" y1="4" x2="13" y2="4" />
          <circle cx="3"  cy="8" r="2.2" />
          <circle cx="13" cy="8" r="2.2" />
          <line x1="6" y1="14" x2="10" y2="14" />
        </svg>
      );
  }
}

// ── EscButton ──────────────────────────────────────────────────────────────
function EscButton() {
  return (
    <button class="cmdr-esc-btn" onClick={() => navigateTo('title')} title="Back to title">
      <span class="esc-label">ESC</span>
      <span class="esc-x">×</span>
    </button>
  );
}

// ── CarouselArrow ──────────────────────────────────────────────────────────
function CarouselArrow({ dir, onClick }: { dir: 'left' | 'right'; onClick: () => void }) {
  return (
    <button class="cmdr-carousel-arrow" onClick={onClick} aria-label={dir === 'left' ? 'Previous' : 'Next'}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        {dir === 'left'
          ? <path d="M10 3 L5 8 L10 13" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          : <path d="M6 3 L11 8 L6 13"  stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        }
      </svg>
    </button>
  );
}

// ── CommanderCard ──────────────────────────────────────────────────────────
function CommanderCard({ commander, isSelected, onClick }: {
  commander: Commander;
  isSelected: boolean;
  onClick: () => void;
}) {
  const color = ARCHETYPE_COLORS[commander.archetype];

  return (
    <div class={`cmdr-card-wrap${isSelected ? ' is-selected' : ''}`}>
      <div
        class={`cmdr-card${isSelected ? ' cmdr-card-selected' : ''}`}
        onClick={onClick}
        style={{
          border: `2px solid ${isSelected ? 'var(--color-gold-primary)' : color + '40'}`,
          boxShadow: isSelected ? undefined : `0 4px 16px rgba(0,0,0,0.4)`,
        }}
      >
        {/* Portrait image */}
        <img
          src={commander.portrait}
          alt={commander.name}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: commander.portraitPosition ?? 'center top',
            zIndex: 0,
          }}
        />

        {/* Top gradient scrim for badge readability */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          height: '38%',
          background: 'linear-gradient(to bottom, rgba(8,6,14,0.82) 0%, rgba(8,6,14,0.55) 45%, rgba(8,6,14,0.2) 75%, transparent 100%)',
          zIndex: 1,
          pointerEvents: 'none',
        }} />

        {/* Bottom gradient scrim */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          height: '45%',
          background: 'linear-gradient(to top, rgba(10,8,14,0.95) 20%, rgba(10,8,14,0.5) 60%, transparent)',
          zIndex: 1,
          pointerEvents: 'none',
        }} />

        {/* Top-left badge: icon chip anchored at corner, text block beside it */}
        {/* Icon chip */}
        <div style={{
          position: 'absolute', top: 10, left: 10, zIndex: 2,
          width: 26, height: 26,
          borderRadius: '50%',
          background: 'rgba(0,0,0,0.55)',
          border: `1px solid ${color}66`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <ArchetypeIcon archetype={commander.archetype} size={12} color={color} />
        </div>

        {/* Text block: faction + archetype name, starting after icon chip */}
        <div style={{
          position: 'absolute', top: 12, left: 46, right: 12, zIndex: 2,
        }}>
          <div style={{
            fontSize: 10, letterSpacing: '2px',
            color: 'var(--color-gold-secondary)', textTransform: 'uppercase',
            opacity: 0.9, lineHeight: 1.2,
            textShadow: '0 1px 3px rgba(0,0,0,0.9)',
          }}>
            {commander.culture}
          </div>
          <div
            class="cmdr-card-archetype"
            style={{
              fontSize: 'clamp(16px, 1.6vw, 22px)',
              letterSpacing: '3px',
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              color: color,
              lineHeight: 1,
              marginTop: 2,
              textShadow: `0 2px 8px rgba(0,0,0,0.95), 0 0 14px ${color}40, 0 0 3px rgba(0,0,0,0.9)`,
            }}
          >
            {commander.archetype.toUpperCase()}
          </div>
        </div>

        {/* Quote */}
        <div style={{
          position: 'absolute', bottom: 12, left: 0, right: 0,
          padding: '0 12px', textAlign: 'center',
          fontStyle: 'italic',
          color: 'var(--color-text-secondary)',
          fontSize: 12, lineHeight: 1.4,
          zIndex: 3,
          textShadow: '0 1px 3px rgba(0,0,0,0.95), 0 0 10px rgba(0,0,0,0.6)',
        }}>
          "{commander.quote}"
        </div>
      </div>

      {/* Selected gem indicator below card */}
      <div class="cmdr-selected-gem">◆</div>
    </div>
  );
}

// ── ArchetypeSummary (details column A) ───────────────────────────────────
function ArchetypeSummary({ commander }: { commander: Commander }) {
  const color = ARCHETYPE_COLORS[commander.archetype];
  return (
    <div>
      {/* Archetype heading */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <div style={{
          width: 34, height: 34,
          borderRadius: '50%',
          background: `${color}22`,
          border: `1px solid ${color}55`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <ArchetypeIcon archetype={commander.archetype} size={20} color={color} />
        </div>
        <div style={{
          fontSize: 18, letterSpacing: '3px',
          fontFamily: 'var(--font-display)',
          color: color,
          textTransform: 'uppercase',
          lineHeight: 1,
        }}>
          {commander.archetype}
        </div>
      </div>

      <div style={{
        fontSize: 12, color: 'var(--color-text-secondary)',
        lineHeight: 1.45, marginBottom: 12,
      }}>
        {commander.archetypeDescription}
      </div>

      {/* Starting bonuses */}
      <div class="cmdr-col-heading" style={{ marginTop: 2 }}>Starting Bonuses</div>
      <ul class="cmdr-bonus-list">
        {commander.startingBonuses.map(b => <li key={b}>{b}</li>)}
      </ul>

      {/* Playstyle focus */}
      <div class="cmdr-col-heading" style={{ marginTop: 10 }}>Playstyle Focus</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {commander.playstyleFocus.map(tag => (
          <span
            key={tag}
            class="cmdr-focus-pill"
            style={{
              background: `${color}18`,
              border: `1px solid ${color}55`,
              color: color,
            }}
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── AbilityListItem ────────────────────────────────────────────────────────
function AbilityListItem({ ability, color }: {
  ability: { name: string; description: string; stars: number };
  color: string;
}) {
  return (
    <div class="cmdr-ability-card">
      <div
        class="cmdr-ability-icon"
        style={{ background: `${color}22`, border: `1px solid ${color}44` }}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round">
          <path d="M9 2 L11 7 L16 7 L12 10.5 L13.5 16 L9 13 L4.5 16 L6 10.5 L2 7 L7 7 Z" />
        </svg>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
          <div style={{
            fontSize: 14, fontWeight: 700,
            color: color, lineHeight: 1.2,
          }}>
            {ability.name}
          </div>
          <div style={{
            fontSize: 13, color: color, fontWeight: 700,
            whiteSpace: 'nowrap', flexShrink: 0,
          }}>
            {'★ ' + ability.stars}
          </div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 3, lineHeight: 1.4 }}>
          {ability.description}
        </div>
      </div>
    </div>
  );
}

// ── StrategicAbilitiesColumn (col B) ──────────────────────────────────────
function StrategicAbilitiesColumn({ commander }: { commander: Commander }) {
  const color = ARCHETYPE_COLORS[commander.archetype];
  return (
    <div>
      <div class="cmdr-col-heading">Strategic Abilities</div>
      <div style={{ height: 1, background: 'var(--color-border-default)', marginBottom: 14, opacity: 0.5 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {commander.strategicAbilities.map(a => (
          <AbilityListItem key={a.name} ability={a} color={color} />
        ))}
      </div>
    </div>
  );
}

// ── UnitListItem ───────────────────────────────────────────────────────────
function UnitListItem({ unit, color, emoji }: {
  unit: { name: string; description: string };
  color: string;
  emoji: string;
}) {
  return (
    <div class="cmdr-unit-item">
      <div
        class="cmdr-unit-tile"
        style={{ background: `${color}18`, border: `1px solid ${color}44` }}
      >
        {emoji}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-gold-primary)', lineHeight: 1.2 }}>
          {unit.name}
        </div>
        <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 3, lineHeight: 1.4 }}>
          {unit.description}
        </div>
      </div>
    </div>
  );
}

const UNIT_EMOJIS: Record<Commander['archetype'], [string, string]> = {
  Religious: ['⚔️', '🏛️'],
  Warlord:   ['🪓', '🏯'],
  Diplomat:  ['🛡️', '🏛️'],
  Merchant:  ['⚔️', '🏡'],
};

// ── UniqueUnitsColumn (col C) ──────────────────────────────────────────────
function UniqueUnitsColumn({ commander }: { commander: Commander }) {
  const color = ARCHETYPE_COLORS[commander.archetype];
  const emojis = UNIT_EMOJIS[commander.archetype];
  return (
    <div>
      <div class="cmdr-col-heading">Unique Units & Improvements</div>
      <div style={{ height: 1, background: 'var(--color-border-default)', marginBottom: 14, opacity: 0.5 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {commander.uniqueUnits.map((u, i) => (
          <UnitListItem key={u.name} unit={u} color={color} emoji={emojis[i] ?? '⚔️'} />
        ))}
      </div>
    </div>
  );
}

// ── VictoryPathRow ─────────────────────────────────────────────────────────
function VictoryPathRow({ path }: {
  path: { name: string; description: string; progress: number };
}) {
  const total = 5;
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-gold-primary)' }}>
          {path.name}
        </div>
        <div class="cmdr-victory-dots">
          {Array.from({ length: total }, (_, i) => (
            <span
              key={i}
              style={{
                fontSize: 10,
                color: i < path.progress
                  ? 'var(--color-gold-secondary)'
                  : 'var(--color-text-muted)',
                opacity: i < path.progress ? 1 : 0.35,
              }}
            >
              {i < path.progress ? '●' : '○'}
            </span>
          ))}
        </div>
      </div>
      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2, lineHeight: 1.3 }}>
        {path.description}
      </div>
    </div>
  );
}

// ── VictoryPathsColumn (col D) ─────────────────────────────────────────────
function VictoryPathsColumn({ commander }: { commander: Commander }) {
  return (
    <div>
      <div class="cmdr-col-heading">Victory Paths</div>
      <div style={{ height: 1, background: 'var(--color-border-default)', marginBottom: 14, opacity: 0.5 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {commander.victoryPaths.map(p => (
          <VictoryPathRow key={p.name} path={p} />
        ))}
      </div>
    </div>
  );
}

// ── DifficultyPlaceholder ──────────────────────────────────────────────────
// Difficulty selection is not yet wired into runs. Kept as a titled placeholder
// (no effect) until the feature is designed.
function DifficultyPlaceholder() {
  return (
    <div title="Coming soon" style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: 0.5 }}>
      <span style={{
        fontSize: 11, letterSpacing: '2px', fontVariant: 'small-caps',
        color: 'var(--color-text-muted)', textTransform: 'uppercase',
        fontFamily: 'var(--font-display)',
      }}>
        Difficulty
      </span>
      <span style={{ fontFamily: 'var(--font-display)', letterSpacing: '1.5px', fontSize: 12, color: 'var(--color-text-muted)' }}>
        SOON
      </span>
    </div>
  );
}

// ── beginRun helper ────────────────────────────────────────────────────────
function beginRun() {
  if (selecting.value) return;
  const commander = COMMANDERS[selectedIndex.value];
  selecting.value = true;
  startNewRun(commander);
  setTimeout(() => navigateTo('hub'), 300);
}

// ── Main screen component ──────────────────────────────────────────────────
export function CommanderSelectScreen() {
  useEffect(() => {
    // Reset stale signals from previous visit
    selectedIndex.value = 0;
    selecting.value = false;

    function handleKey(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft')  { selectedIndex.value = (selectedIndex.value + 3) % 4; }
      if (e.key === 'ArrowRight') { selectedIndex.value = (selectedIndex.value + 1) % 4; }
      if (e.key === 'Enter')      { beginRun(); }
      if (e.key === 'Escape')     { navigateTo('title'); }
    }
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('keydown', handleKey);
      selectedIndex.value = 0;
      selecting.value = false;
    };
  }, []);

  const commander = COMMANDERS[selectedIndex.value];
  const color = ARCHETYPE_COLORS[commander.archetype];

  return (
    <div style={{
      position: 'relative',
      minHeight: '100vh',
      background: 'var(--color-bg-primary)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '12px 16px 18px',
      gap: 12,
      fontFamily: 'var(--font-family)',
      overflowX: 'hidden',
    }}>
      {/* Background glow + vignette layers */}
      <div class="cmdr-screen-bg" />

      {/* ESC button top-right */}
      <EscButton />

      {/* Header */}
      <header class="cmdr-main-enter" style={{ textAlign: 'center', maxWidth: 800, zIndex: 1 }}>
        <div class="ornate-eyebrow" style={{ letterSpacing: '6px' }}>CHOOSE YOUR</div>

        <div style={{
          fontSize: 'clamp(36px, 6vw, 60px)',
          letterSpacing: '8px',
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          color: 'var(--color-gold-primary)',
          textShadow: '0 2px 14px rgba(240,208,128,0.3), 0 0 30px rgba(0,0,0,0.5)',
          lineHeight: 1,
          textTransform: 'uppercase',
          marginTop: 4,
        }}>
          COMMANDER
        </div>

        {/* Divider with gem */}
        <div class="cmdr-header-divider">
          <div class="div-line" />
          <span class="div-gem">◆</span>
          <div class="div-line right" />
        </div>

        <div style={{
          fontStyle: 'italic',
          color: 'var(--color-text-secondary)',
          fontSize: 'var(--font-size-md)',
          marginTop: 6,
        }}>
          Lead your civilization. Shape history.
        </div>
      </header>

      {/* Carousel */}
      <div
        class="cmdr-carousel-enter"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          zIndex: 1,
          width: '100%',
          maxWidth: 1100,
          justifyContent: 'center',
        }}
      >
        <CarouselArrow dir="left" onClick={() => { selectedIndex.value = (selectedIndex.value + 3) % 4; }} />

        <div style={{
          display: 'flex',
          gap: 20,
          justifyContent: 'center',
          flexWrap: 'nowrap',
          flex: 1,
          maxWidth: 1020,
          padding: '0 4px 16px',
        }}>
          {COMMANDERS.map((c, i) => (
            <CommanderCard
              key={c.id}
              commander={c}
              isSelected={selectedIndex.value === i}
              onClick={() => { selectedIndex.value = i; }}
            />
          ))}
        </div>

        <CarouselArrow dir="right" onClick={() => { selectedIndex.value = (selectedIndex.value + 1) % 4; }} />
      </div>

      {/* Details panel */}
      <div class="cmdr-panel-enter" style={{ width: 'min(1280px, 96vw)', zIndex: 1 }}>
        <OrnateFrame width="100%" padding="compact">
          <div class="cmdr-details-grid">
            <ArchetypeSummary commander={commander} />
            <StrategicAbilitiesColumn commander={commander} />
            <UniqueUnitsColumn commander={commander} />
            <VictoryPathsColumn commander={commander} />
          </div>

          <div style={{ marginTop: -4, marginBottom: -8 }}>
            <OrnateDivider color={color} />
          </div>

          {/* Bottom bar */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 16,
            flexWrap: 'wrap',
          }}>
            {/* Left: View civilization (stub) */}
            <button
              class="ornate-btn-ghost"
              disabled
              title="Coming soon"
              style={{ fontSize: 12, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              📖 VIEW CIVILIZATION DETAILS
            </button>

            {/* Center: Difficulty placeholder (not yet wired) */}
            <DifficultyPlaceholder />

            {/* Right: CTA */}
            <button class="cmdr-cta-btn" onClick={beginRun}>
              BEGIN YOUR LEGACY 👑
            </button>
          </div>
        </OrnateFrame>
      </div>
    </div>
  );
}
