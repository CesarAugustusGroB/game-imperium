import { navigateTo } from '../screens';

const containerStyle: Record<string, string> = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  height: '100vh', fontFamily: 'var(--font-family)',
  background: '#d8d0c8 url(/asset/marbel_background.png) center / contain no-repeat',
};

const shieldStyle: Record<string, string> = {
  width: '120px', height: '120px', marginBottom: '12px',
  filter: 'drop-shadow(0 0 24px var(--color-border-strong))',
  animation: 'shield-float 3s ease-in-out infinite',
};

const titleStyle: Record<string, string> = {
  fontSize: 'var(--font-size-display)', fontWeight: '700', letterSpacing: '6px', textTransform: 'uppercase',
  color: '#5a3a1a',
  textShadow: '0 1px 2px rgba(0, 0, 0, 0.2)',
  marginBottom: '4px',
};

const subtitleStyle: Record<string, string> = {
  fontSize: 'var(--font-size-md)', letterSpacing: '8px', textTransform: 'uppercase',
  color: 'rgba(70, 55, 35, 0.6)', marginBottom: '52px',
};

const versionStyle: Record<string, string> = {
  position: 'fixed', bottom: '16px', right: '20px',
  fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', letterSpacing: '1px',
};

export function TitleScreen() {
  return (
    <div style={containerStyle}>
      <style>{`
        @keyframes shield-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .title-btn {
          position: relative; padding: 14px 24px; width: 100%;
          border-radius: var(--radius-sm); cursor: pointer; overflow: hidden;
          font-family: var(--font-family); font-size: var(--font-size-lg); font-weight: 600; letter-spacing: 2px;
          text-transform: uppercase; transition: all var(--duration-normal) var(--ease-default);
        }
        .title-btn:active { transform: scale(0.97); }
        .title-btn-primary {
          background: linear-gradient(135deg, rgba(80, 60, 20, 0.7), rgba(50, 40, 18, 0.9));
          border: 1px solid var(--color-border-strong); color: var(--color-gold-primary);
        }
        .title-btn-primary:hover {
          border-color: rgba(255, 220, 120, 0.8); color: #fff0c0;
          box-shadow: 0 0 24px var(--color-border-default), inset 0 0 20px var(--color-border-subtle);
        }
        .title-btn-secondary {
          background: linear-gradient(135deg, var(--color-bg-tertiary), var(--color-bg-secondary));
          border: 1px solid var(--color-border-default); color: #d0c8a8;
        }
        .title-btn-secondary:hover {
          border-color: var(--color-border-strong); color: #f0e0b0;
          box-shadow: 0 0 16px var(--color-border-subtle);
        }
        .title-btn-disabled {
          background: linear-gradient(135deg, var(--color-bg-tertiary), var(--color-bg-secondary));
          border: 1px solid rgba(100, 100, 100, 0.2); color: #d0c8a8;
          opacity: 0.35; cursor: default;
        }
        .title-btn-disabled:hover { border-color: rgba(100, 100, 100, 0.2); box-shadow: none; }
      `}</style>

      <img
        src="/asset/spartan_gold_round.png"
        alt="Shield"
        style={shieldStyle}
      />

      <div style={titleStyle}>IMPERIUM</div>
      <div style={subtitleStyle}>Roguelite Grand Strategy</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', maxWidth: '280px', padding: '0 16px' }}>
        <button
          class="title-btn title-btn-primary"
          onClick={() => navigateTo('commander-select')}
        >
          New Game
        </button>
        <button class="title-btn title-btn-disabled" disabled>
          Continue
        </button>
        <button
          class="title-btn title-btn-secondary"
          onClick={() => navigateTo('battle')}
        >
          Quick Battle
        </button>
      </div>

      <div style={versionStyle}>v0.5.0 — Sprint 5</div>
    </div>
  );
}
