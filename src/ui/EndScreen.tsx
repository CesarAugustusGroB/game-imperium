import { navigateTo } from './screens';
import { completedSpokes, globalSeason, resetRun } from '../game/game-state';
import { provinces } from '../game/province-store';

// ── One-time CSS injection ──
if (typeof document !== 'undefined' && !document.getElementById('end-screen-styles')) {
  const el = document.createElement('style');
  el.id = 'end-screen-styles';
  el.textContent = `
    @keyframes endgame-fade-in {
      from { opacity: 0; transform: scale(0.96) translateY(-8px); }
      to   { opacity: 1; transform: scale(1) translateY(0); }
    }
    .end-screen-panel {
      animation: endgame-fade-in 0.4s ease-out;
    }
    .end-return-btn { transition: all 0.2s ease; cursor: pointer; }
    .end-return-btn:active { transform: scale(0.97); }
    /* Victory hover variant */
    .end-return-btn--victory:hover {
      border-color: rgba(240, 208, 128, 0.6) !important;
      color: #fff0c0 !important;
      box-shadow: 0 0 24px rgba(180, 160, 100, 0.2), inset 0 0 20px rgba(180, 160, 100, 0.06) !important;
    }
    /* Defeat hover variant */
    .end-return-btn--defeat:hover {
      border-color: rgba(194, 74, 58, 0.7) !important;
      color: #e07060 !important;
      box-shadow: 0 0 24px rgba(194, 74, 58, 0.2), inset 0 0 20px rgba(194, 74, 58, 0.06) !important;
    }
  `;
  document.head.appendChild(el);
}

interface EndScreenProps {
  title: string;
  titleColor: string;
  dividerColor: string;
  subtitle: string;
  image: string;
  imageFilter: string;
  panelBorder: string;
  statRowBg: string;
  statRowBorder: string;
  statValueColor: string;
  statLabelColor: string;
  summaryLabelColor: string;
  returnBtnStyle: {
    background: string;
    border: string;
    color: string;
    hoverClass: string;
  };
}

export function EndScreen({
  title,
  titleColor,
  dividerColor,
  subtitle,
  image,
  imageFilter,
  panelBorder,
  statRowBg,
  statRowBorder,
  statValueColor,
  statLabelColor,
  summaryLabelColor,
  returnBtnStyle,
}: EndScreenProps) {
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
      <div
        class="end-screen-panel"
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          background: 'rgba(12, 10, 24, 0.85)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderRadius: '12px',
          border: panelBorder,
          padding: '48px 56px 40px',
          maxWidth: '90%',
          width: 'min(480px, 85vw)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
        }}
      >
        {/* Banner image */}
        <img
          src={image}
          alt={title}
          style={{
            width: '320px', height: 'auto',
            marginBottom: '16px',
            filter: imageFilter,
          }}
        />

        {/* Title */}
        <div style={{
          fontSize: '36px', fontWeight: 700, color: titleColor,
          letterSpacing: '6px', textTransform: 'uppercase',
          textShadow: `0 2px 24px ${titleColor}80, 0 0 48px ${titleColor}33`,
          marginBottom: '8px',
        }}>
          {title}
        </div>

        {/* Divider */}
        <div style={{
          width: '80px', height: '2px', marginBottom: '12px',
          background: `linear-gradient(90deg, transparent, ${dividerColor}, transparent)`,
        }} />

        {/* Subtitle */}
        <div style={{
          fontSize: '13px', color: statLabelColor,
          letterSpacing: '0.5px', textAlign: 'center',
          lineHeight: '1.6', marginBottom: '32px',
          maxWidth: '320px',
        }}>
          {subtitle}
        </div>

        {/* Summary stats */}
        <div style={{
          display: 'flex', flexDirection: 'column', gap: '8px',
          width: '100%', marginBottom: '32px',
        }}>
          <div style={{
            fontSize: '9px', fontWeight: 700, color: summaryLabelColor,
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
                background: statRowBg,
                border: statRowBorder,
              }}
            >
              <span style={{ fontSize: '12px', color: statLabelColor, letterSpacing: '0.5px' }}>
                {label}
              </span>
              <span style={{
                fontSize: '16px', fontWeight: 700, color: statValueColor,
                textShadow: `0 0 8px ${statValueColor}59`,
              }}>
                {value}
              </span>
            </div>
          ))}
        </div>

        {/* Return button */}
        <button
          class={`end-return-btn ${returnBtnStyle.hoverClass}`}
          onClick={handleReturn}
          style={{
            padding: '13px 32px', borderRadius: '4px',
            background: returnBtnStyle.background,
            border: returnBtnStyle.border,
            color: returnBtnStyle.color, fontFamily: 'inherit',
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
