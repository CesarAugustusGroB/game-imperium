import { useState, useEffect } from 'preact/hooks';
import { navigateTo } from '../screens';
import { Button } from '../components/Button';
import { OrnateFrame, OrnateHeader } from '../components/OrnateFrame';
import { globalSeason, resetRun, selectedCommander, battlesWon } from '../../game/core/game-state';
import { provinces } from '../../game/province/province-store';
import { recordRunComplete, computeScore } from '../../game/core/meta-save';
import { playSfx } from '../sound/sfx';

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
    /* Responsive padding handled by OrnateFrame CSS classes */
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
  title: _title,   // kept in interface for wrapper compat; OrnateHeader generates title from outcome
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
        height: '100vh', fontFamily: 'var(--font-family)',
        background: backgroundTint,
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

        {/* Stats panel — ornate frame with header */}
        <OrnateFrame padding="hero" width="min(640px, 92vw)">
          {/* Header with end-title-enter entrance animation */}
          <div style={{ animation: 'end-title-enter 0.8s ease-out forwards' }}>
            <OrnateHeader
              eyebrow={`Season ${seasons}`}
              title={outcome === 'victory' ? 'CAMPAIGN COMPLETE' : 'CAMPAIGN ENDED'}
              accentColor={outcome === 'victory' ? 'var(--color-gold-primary)' : 'var(--color-danger)'}
            />
          </div>

          {stats.map((stat, i) => (
            <div
              key={stat.label}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 0',
                borderBottom: i < stats.length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
                opacity: revealIndex >= i ? 1 : 0,
                transform: `translateY(${revealIndex >= i ? 0 : 8}px)`,
                transition: 'opacity 0.4s ease-out, transform 0.4s ease-out',
              }}
            >
              <span style={{ fontSize: 'var(--font-size-md)', letterSpacing: '1px', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
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
          <Button
            variant="primary"
            onClick={handleReturn}
            style={{
              marginTop: '28px',
              transition: `opacity 0.4s ease-out, transform 0.4s ease-out`,
              opacity: showButton ? 1 : 0,
              transform: `translateY(${showButton ? 0 : 8}px)`,
              pointerEvents: showButton ? 'auto' : 'none',
            }}
          >
            Return to Title
          </Button>
        </OrnateFrame>
      </div>
    </div>
  );
}
