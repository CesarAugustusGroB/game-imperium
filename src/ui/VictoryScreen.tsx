import { navigateTo } from './screens';
import { completedSpokes, globalSeason, resetRun } from '../game/game-state';
import { provinces } from '../game/province-store';

// ── One-time CSS injection ──
if (typeof document !== 'undefined' && !document.getElementById('victory-screen-styles')) {
  const el = document.createElement('style');
  el.id = 'victory-screen-styles';
  el.textContent = `
    @keyframes victory-entrance {
      from { opacity: 0; transform: scale(0.96) translateY(-8px); }
      to   { opacity: 1; transform: scale(1) translateY(0); }
    }
    .victory-panel {
      animation: victory-entrance 0.4s ease-out;
    }
    .victory-return-btn { transition: all 0.2s ease; cursor: pointer; }
    .victory-return-btn:hover {
      border-color: rgba(240, 208, 128, 0.6) !important;
      color: #fff0c0 !important;
      box-shadow: 0 0 24px rgba(180, 160, 100, 0.2), inset 0 0 20px rgba(180, 160, 100, 0.06) !important;
    }
    .victory-return-btn:active { transform: scale(0.97); }
  `;
  document.head.appendChild(el);
}

export function VictoryScreen() {
  const spokes = completedSpokes.value;
  const seasons = globalSeason.value;
  const provinceCount = provinces.value.length;

  function handleReturn() {
    resetRun();
    navigateTo('title');
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', fontFamily: "'Segoe UI', system-ui, sans-serif",
      background: '#d8d0c8 url(/asset/marbel_background.png) center / contain no-repeat',
      padding: '32px 16px',
    }}>
      {/* Dark content panel */}
      <div
        class="victory-panel"
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          background: 'rgba(12, 10, 24, 0.85)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderRadius: '12px',
          border: '1px solid rgba(180, 160, 100, 0.15)',
          padding: '48px 56px 40px',
          maxWidth: '90%',
          width: 'min(480px, 85vw)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
        }}
      >
        {/* Victory banner image */}
        <img
          src="/asset/victory_banner.png"
          alt="Victory"
          style={{
            width: '320px', height: 'auto',
            marginBottom: '16px',
            filter: 'drop-shadow(0 4px 16px rgba(180, 140, 40, 0.5))',
          }}
        />

        {/* Title */}
        <div style={{
          fontSize: '36px', fontWeight: 700, color: '#f0d080',
          letterSpacing: '6px', textTransform: 'uppercase',
          textShadow: '0 2px 24px rgba(240, 208, 128, 0.5), 0 0 48px rgba(240, 208, 128, 0.2)',
          marginBottom: '8px',
        }}>
          VICTORY
        </div>

        {/* Gold divider */}
        <div style={{
          width: '80px', height: '2px', marginBottom: '12px',
          background: 'linear-gradient(90deg, transparent, rgba(240, 208, 128, 0.7), transparent)',
        }} />

        {/* Subtitle */}
        <div style={{
          fontSize: '13px', color: 'rgba(220, 200, 160, 0.65)',
          letterSpacing: '0.5px', textAlign: 'center',
          lineHeight: '1.6', marginBottom: '32px',
          maxWidth: '320px',
        }}>
          The barbarian horde is defeated. Rome endures.
        </div>

        {/* Summary stats */}
        <div style={{
          display: 'flex', flexDirection: 'column', gap: '8px',
          width: '100%', marginBottom: '32px',
        }}>
          <div style={{
            fontSize: '9px', fontWeight: 700, color: 'rgba(180, 160, 100, 0.45)',
            letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px',
          }}>
            Run Summary
          </div>

          {([
            { label: 'Spokes Completed', value: spokes },
            { label: 'Seasons Survived', value: seasons },
            { label: 'Provinces Conquered', value: provinceCount },
          ] as const).map(({ label, value }) => (
            <div
              key={label}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '9px 14px', borderRadius: '6px',
                background: 'rgba(35, 32, 55, 0.6)',
                border: '1px solid rgba(180, 160, 100, 0.1)',
              }}
            >
              <span style={{ fontSize: '12px', color: 'rgba(200, 190, 165, 0.65)', letterSpacing: '0.5px' }}>
                {label}
              </span>
              <span style={{
                fontSize: '16px', fontWeight: 700, color: '#f0d080',
                textShadow: '0 0 8px rgba(240, 208, 128, 0.35)',
              }}>
                {value}
              </span>
            </div>
          ))}
        </div>

        {/* Return button */}
        <button
          class="victory-return-btn"
          onClick={handleReturn}
          style={{
            padding: '13px 32px', borderRadius: '4px',
            background: 'linear-gradient(135deg, rgba(80, 60, 20, 0.7), rgba(50, 40, 18, 0.9))',
            border: '1px solid rgba(220, 190, 100, 0.5)',
            color: '#f0d080', fontFamily: 'inherit',
            fontSize: '13px', fontWeight: 600,
            letterSpacing: '1.5px', textTransform: 'uppercase',
            width: '100%',
          }}
        >
          Return to Title
        </button>
      </div>
    </div>
  );
}
