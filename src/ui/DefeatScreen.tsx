import { navigateTo } from './screens';
import { completedSpokes, globalSeason, resetRun } from '../game/game-state';
import { provinces } from '../game/province-store';

// ── One-time CSS injection ──
if (typeof document !== 'undefined' && !document.getElementById('defeat-screen-styles')) {
  const el = document.createElement('style');
  el.id = 'defeat-screen-styles';
  el.textContent = `
    @keyframes defeat-entrance {
      from { opacity: 0; transform: scale(0.96) translateY(-8px); }
      to   { opacity: 1; transform: scale(1) translateY(0); }
    }
    .defeat-panel {
      animation: defeat-entrance 0.4s ease-out;
    }
    .defeat-return-btn { transition: all 0.2s ease; cursor: pointer; }
    .defeat-return-btn:hover {
      border-color: rgba(194, 74, 58, 0.7) !important;
      color: #e07060 !important;
      box-shadow: 0 0 24px rgba(194, 74, 58, 0.2), inset 0 0 20px rgba(194, 74, 58, 0.06) !important;
    }
    .defeat-return-btn:active { transform: scale(0.97); }
  `;
  document.head.appendChild(el);
}

export function DefeatScreen() {
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
        class="defeat-panel"
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          background: 'rgba(12, 10, 24, 0.85)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderRadius: '12px',
          border: '1px solid rgba(180, 100, 80, 0.15)',
          padding: '48px 56px 40px',
          maxWidth: '90%',
          width: 'min(480px, 85vw)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
        }}
      >
        {/* Defeat banner image */}
        <img
          src="/asset/defeat_label.png"
          alt="Defeat"
          style={{
            width: '320px', height: 'auto',
            marginBottom: '16px',
            filter: 'drop-shadow(0 4px 16px rgba(120, 40, 30, 0.6))',
          }}
        />

        {/* Title */}
        <div style={{
          fontSize: '36px', fontWeight: 700, color: '#c24a3a',
          letterSpacing: '6px', textTransform: 'uppercase',
          textShadow: '0 2px 24px rgba(194, 74, 58, 0.5), 0 0 48px rgba(194, 74, 58, 0.2)',
          marginBottom: '8px',
        }}>
          DEFEAT
        </div>

        {/* Red divider */}
        <div style={{
          width: '80px', height: '2px', marginBottom: '12px',
          background: 'linear-gradient(90deg, transparent, rgba(194, 74, 58, 0.7), transparent)',
        }} />

        {/* Subtitle */}
        <div style={{
          fontSize: '13px', color: 'rgba(220, 180, 160, 0.6)',
          letterSpacing: '0.5px', textAlign: 'center',
          lineHeight: '1.6', marginBottom: '32px',
          maxWidth: '320px',
        }}>
          The empire has fallen. The barbarians rule the ashes.
        </div>

        {/* Summary stats */}
        <div style={{
          display: 'flex', flexDirection: 'column', gap: '8px',
          width: '100%', marginBottom: '32px',
        }}>
          <div style={{
            fontSize: '9px', fontWeight: 700, color: 'rgba(180, 120, 100, 0.45)',
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
                background: 'rgba(35, 28, 28, 0.6)',
                border: '1px solid rgba(180, 100, 80, 0.1)',
              }}
            >
              <span style={{ fontSize: '12px', color: 'rgba(200, 175, 165, 0.65)', letterSpacing: '0.5px' }}>
                {label}
              </span>
              <span style={{
                fontSize: '16px', fontWeight: 700, color: '#c24a3a',
                textShadow: '0 0 8px rgba(194, 74, 58, 0.35)',
              }}>
                {value}
              </span>
            </div>
          ))}
        </div>

        {/* Return button */}
        <button
          class="defeat-return-btn"
          onClick={handleReturn}
          style={{
            padding: '13px 32px', borderRadius: '4px',
            background: 'linear-gradient(135deg, rgba(60, 20, 20, 0.7), rgba(40, 18, 18, 0.9))',
            border: '1px solid rgba(194, 74, 58, 0.45)',
            color: '#c24a3a', fontFamily: 'inherit',
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
