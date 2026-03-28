import { navigateTo } from './screens';

const containerStyle: Record<string, string> = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  height: '100vh', fontFamily: "'Segoe UI', system-ui, sans-serif",
  background: 'radial-gradient(ellipse at 50% 40%, rgba(30, 28, 50, 0.92), rgba(8, 8, 18, 0.97))',
};

const shieldStyle: Record<string, string> = {
  width: '120px', height: '120px', marginBottom: '12px',
  filter: 'drop-shadow(0 0 24px rgba(180, 160, 100, 0.4))',
  animation: 'shield-float 3s ease-in-out infinite',
};

const titleStyle: Record<string, string> = {
  fontSize: '52px', fontWeight: '700', letterSpacing: '6px', textTransform: 'uppercase',
  color: '#f0d080',
  textShadow: '0 2px 16px rgba(180, 140, 60, 0.6), 0 0 60px rgba(180, 140, 60, 0.15)',
  marginBottom: '4px',
};

const subtitleStyle: Record<string, string> = {
  fontSize: '13px', letterSpacing: '8px', textTransform: 'uppercase',
  color: 'rgba(180, 170, 140, 0.5)', marginBottom: '52px',
};

const versionStyle: Record<string, string> = {
  position: 'fixed', bottom: '16px', right: '20px',
  fontSize: '11px', color: 'rgba(140, 130, 110, 0.35)', letterSpacing: '1px',
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
          border-radius: 4px; cursor: pointer; overflow: hidden;
          font-family: inherit; font-size: 16px; font-weight: 600; letter-spacing: 2px;
          text-transform: uppercase; transition: all 0.2s ease;
        }
        .title-btn:active { transform: scale(0.97); }
        .title-btn-primary {
          background: linear-gradient(135deg, rgba(80, 60, 20, 0.7), rgba(50, 40, 18, 0.9));
          border: 1px solid rgba(220, 190, 100, 0.5); color: #f0d080;
        }
        .title-btn-primary:hover {
          border-color: rgba(255, 220, 120, 0.8); color: #fff0c0;
          box-shadow: 0 0 24px rgba(180, 160, 100, 0.2), inset 0 0 20px rgba(180, 160, 100, 0.06);
        }
        .title-btn-secondary {
          background: linear-gradient(135deg, rgba(40, 36, 60, 0.9), rgba(28, 26, 48, 0.95));
          border: 1px solid rgba(180, 160, 100, 0.25); color: #d0c8a8;
        }
        .title-btn-secondary:hover {
          border-color: rgba(220, 190, 100, 0.5); color: #f0e0b0;
          box-shadow: 0 0 16px rgba(180, 160, 100, 0.12);
        }
        .title-btn-disabled {
          background: linear-gradient(135deg, rgba(40, 36, 60, 0.9), rgba(28, 26, 48, 0.95));
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

      <div style={versionStyle}>v0.2.0 — Sprint 2</div>
    </div>
  );
}
