import { useState } from 'preact/hooks';
import { EndScreen } from './EndScreen';

// ── One-time CSS injection for gold particles ──
if (typeof document !== 'undefined' && !document.getElementById('victory-screen-styles')) {
  const el = document.createElement('style');
  el.id = 'victory-screen-styles';
  el.textContent = `
    @keyframes particle-rise {
      0%   { transform: translateY(0) translateX(0) scale(1); opacity: 0.8; }
      50%  { opacity: 0.6; }
      100% { transform: translateY(-100vh) translateX(var(--drift)) scale(0.3); opacity: 0; }
    }
    .gold-particle {
      position: fixed;
      bottom: -8px;
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: radial-gradient(circle, #f8e878, #d4a820);
      box-shadow: 0 0 6px #f0c830;
      pointer-events: none;
      animation: particle-rise var(--duration) ease-in var(--delay) infinite;
    }
  `;
  document.head.appendChild(el);
}

// ── Gold particle overlay ──
interface Particle {
  id: number;
  left: number;
  duration: number;
  delay: number;
  drift: number;
}

function GoldParticles() {
  const [particles] = useState<Particle[]>(() =>
    Array.from({ length: 24 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      duration: 3 + Math.random() * 4,
      delay: Math.random() * 6,
      drift: (Math.random() - 0.5) * 80,
    })),
  );

  return (
    <>
      {particles.map(p => (
        <div
          key={p.id}
          class="gold-particle"
          style={{
            left: `${p.left}%`,
            '--duration': `${p.duration}s`,
            '--delay': `${p.delay}s`,
            '--drift': `${p.drift}px`,
          } as preact.JSX.CSSProperties}
        />
      ))}
    </>
  );
}

export function VictoryScreen() {
  return (
    <EndScreen
      outcome="victory"
      title="Victory"
      titleColor="#f0d080"
      titleGlow="#f0c040"
      backgroundTint="#1a1608"
    >
      <GoldParticles />
    </EndScreen>
  );
}
