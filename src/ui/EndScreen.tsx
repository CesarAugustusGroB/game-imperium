import { useState, useEffect } from 'preact/hooks';
import { navigateTo } from './screens';
import { globalSeason, resetRun, selectedCommander, battlesWon } from '../game/game-state';
import { provinces } from '../game/province-store';
import { recordRunComplete, computeScore } from '../game/meta-save';
import { playSfx } from './sfx';

// ── One-time CSS injection ──
if (typeof document !== 'undefined' && !document.getElementById('end-screen-styles')) {
  const el = document.createElement('style');
  el.id = 'end-screen-styles';
  el.textContent = `
    @keyframes end-title-enter {
      0% { opacity: 0; transform: scale(0.8) translateY(-20px); letter-spacing: 12px; }
      60% { opacity: 1; transform: scale(1.02) translateY(0); letter-spacing: 7px; }
      100% { transform: scale(1); letter-spacing: 6px; }
    }
    @keyframes ken-burns {
      from { transform: scale(1); }
      to { transform: scale(1.04); }
    }
    @keyframes endgame-fade-in {
      from { opacity: 0; transform: scale(0.95); }
      to { opacity: 1; transform: scale(1); }
    }
    @media (max-width: 600px) {
      .end-screen-panel { padding: 32px 24px 28px !important; }
      .end-screen-panel img { width: 200px !important; }
    }
  `;
  document.head.appendChild(el);
}

// ── Animated counter hook ──
function useCountUp(target: number, active: boolean, duration = 800): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!active) { setValue(0); return; }
    let start: number | null = null;
    let frame: number;
    function tick(ts: number) {
      if (!start) start = ts;
      const t = Math.min(1, (ts - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setValue(Math.round(eased * target));
      if (t < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, active, duration]);
  return value;
}

// ── EndScreen props ──
export interface EndScreenProps {
  outcome: 'victory' | 'defeat';
  title: string;
  titleColor: string;
  titleGlow: string;
  backgroundTint: string;
  children?: preact.ComponentChildren;
}

export function EndScreen({
  outcome,
  title,
  titleColor,
  titleGlow,
  backgroundTint,
  children,
}: EndScreenProps) {
  // Read correct game state signals — NOT props from wrappers
  const commander = selectedCommander.value;
  const battles = battlesWon.value;
  const seasons = globalSeason.value;
  const provinceCount = provinces.value.length;
  const [revealIndex, setRevealIndex] = useState(-1);
  const [showButton, setShowButton] = useState(false);

  useEffect(() => {
    playSfx(outcome === 'victory' ? 'victory_fanfare' : 'defeat_sting');
  }, []);

  useEffect(() => {
    const timers: number[] = [];
    // Reveal stats one by one, 300ms apart, starting 500ms after mount
    for (let i = 0; i < 4; i++) {
      timers.push(window.setTimeout(() => setRevealIndex(i), 500 + i * 300));
    }
    // Show button 600ms after last stat
    timers.push(window.setTimeout(() => setShowButton(true), 500 + 4 * 300 + 600));
    return () => timers.forEach(clearTimeout);
  }, []);

  const score = computeScore(outcome, battles, seasons, provinceCount);

  const c0 = useCountUp(battles, revealIndex >= 0);
  const c1 = useCountUp(seasons, revealIndex >= 1);
  const c2 = useCountUp(provinceCount, revealIndex >= 2);
  const c3 = useCountUp(score, revealIndex >= 3);
  const counters = [c0, c1, c2, c3];

  const stats = [
    { label: 'Battles Won', value: battles },
    { label: 'Seasons', value: seasons },
    { label: 'Provinces', value: provinceCount },
    { label: 'Score', value: score },
  ];

  function handleReturn() {
    if (commander) {
      recordRunComplete(commander.id, commander.name, outcome, battles, seasons, provinceCount);
    }
    resetRun();
    navigateTo('title');
  }

  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: '100vh', fontFamily: "'Segoe UI', system-ui, sans-serif",
        background: `${backgroundTint} url(/asset/marbel_background.png) center / contain no-repeat`,
        overflow: 'hidden',
        animation: 'ken-burns 8s ease-in-out infinite alternate',
      }}
    >
      {/* Inner content panel — not animated with ken-burns, so we wrap */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        width: '100%', height: '100%',
        animation: 'endgame-fade-in 0.4s ease-out',
      }}>
        {/* Extra overlay slot (particles, etc.) */}
        {children}

        {/* Title */}
        <div style={{
          fontSize: '42px', fontWeight: 800, letterSpacing: '6px',
          textTransform: 'uppercase', color: titleColor,
          textShadow: `0 2px 24px ${titleGlow}, 0 0 60px ${titleGlow}50`,
          marginBottom: '8px',
          animation: 'end-title-enter 0.8s ease-out forwards',
        }}>
          {title}
        </div>

        {/* Divider */}
        <div style={{
          width: '120px', height: '2px', marginBottom: '32px',
          background: `linear-gradient(90deg, transparent, ${titleGlow}, transparent)`,
        }} />

        {/* Stats panel */}
        <div class="end-screen-panel" style={{
          background: 'rgba(12, 10, 24, 0.85)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderRadius: '12px',
          border: '1px solid rgba(180, 160, 100, 0.15)',
          padding: '32px 48px',
          minWidth: '320px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
          display: 'flex', flexDirection: 'column', gap: '0',
        }}>
          {stats.map((stat, i) => (
            <div
              key={stat.label}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 0',
                borderBottom: i < stats.length - 1 ? '1px solid rgba(180, 160, 100, 0.1)' : 'none',
                opacity: revealIndex >= i ? 1 : 0,
                transform: `translateY(${revealIndex >= i ? 0 : 8}px)`,
                transition: 'opacity 0.4s ease-out, transform 0.4s ease-out',
              }}
            >
              <span style={{ fontSize: '13px', letterSpacing: '1px', color: 'rgba(200, 190, 160, 0.65)', textTransform: 'uppercase' }}>
                {stat.label}
              </span>
              <span style={{
                fontSize: '22px', fontWeight: 700, letterSpacing: '1px',
                color: i === 3 ? titleColor : '#f0e8cc',
                textShadow: i === 3 ? `0 0 12px ${titleGlow}60` : 'none',
              }}>
                {counters[i]}
              </span>
            </div>
          ))}

          {/* Return button */}
          <button
            onClick={handleReturn}
            style={{
              marginTop: '28px', padding: '12px 32px', borderRadius: '6px',
              cursor: 'pointer', fontFamily: 'inherit', fontSize: '13px',
              fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase',
              background: `linear-gradient(135deg, ${titleColor}25, ${titleColor}10)`,
              border: `1px solid ${titleColor}60`,
              color: titleColor,
              textShadow: `0 0 8px ${titleGlow}40`,
              boxShadow: `0 0 16px ${titleGlow}20`,
              transition: 'opacity 0.4s ease-out, transform 0.4s ease-out, all 0.2s ease',
              opacity: showButton ? 1 : 0,
              transform: `translateY(${showButton ? 0 : 8}px)`,
              pointerEvents: showButton ? 'auto' : 'none',
            }}
          >
            Return to Title
          </button>
        </div>
      </div>
    </div>
  );
}
