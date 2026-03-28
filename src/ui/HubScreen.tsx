import { navigateTo } from './screens';
import { startSpoke } from '../game/spoke';
import { completedSpokes, selectedCommander } from '../game/game-state';
import { FACTION_COLORS } from '../game/commander';

// ── One-time CSS injection ──
if (typeof document !== 'undefined' && !document.getElementById('hub-styles')) {
  const el = document.createElement('style');
  el.id = 'hub-styles';
  el.textContent = `
    .hub-btn {
      padding: 12px 24px;
      border-radius: 4px; cursor: pointer;
      font-family: inherit; font-size: 14px; font-weight: 600;
      letter-spacing: 1px; text-transform: uppercase;
      transition: all 0.2s ease;
    }
    .hub-btn:active { transform: scale(0.97); }
    .hub-btn-primary {
      background: linear-gradient(135deg, rgba(80, 60, 20, 0.7), rgba(50, 40, 18, 0.9));
      border: 1px solid rgba(220, 190, 100, 0.5); color: #f0d080;
    }
    .hub-btn-primary:hover {
      border-color: rgba(255, 220, 120, 0.8); color: #fff0c0;
      box-shadow: 0 0 24px rgba(180, 160, 100, 0.2), inset 0 0 20px rgba(180, 160, 100, 0.06);
    }
  `;
  document.head.appendChild(el);
}

export function HubScreen() {
  const commander = selectedCommander.value;
  const color = commander ? FACTION_COLORS[commander.faction] : '#f0d080';

  function handleStartSpoke() {
    startSpoke();
    navigateTo('node-map');
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100vh', fontFamily: "'Segoe UI', system-ui, sans-serif",
      background: 'radial-gradient(ellipse at 50% 40%, rgba(30, 28, 50, 0.92), rgba(8, 8, 18, 0.97))',
      paddingTop: '38px',
    }}>
      {/* Commander indicator */}
      {commander && (
        <div style={{
          fontSize: '11px', color: 'rgba(180, 170, 150, 0.4)',
          letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px',
        }}>
          {commander.name}
        </div>
      )}

      <div style={{
        fontSize: '20px', fontWeight: 600, color: '#f0d080',
        letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '8px',
        textShadow: '0 2px 8px rgba(180, 140, 60, 0.3)',
      }}>
        Hub
      </div>

      {/* Decorative divider */}
      <div style={{
        width: '60px', height: '1px', marginBottom: '24px',
        background: `linear-gradient(90deg, transparent, ${color}40, transparent)`,
      }} />

      {completedSpokes.value > 0 && (
        <div style={{
          fontSize: '12px', color: 'rgba(180, 170, 150, 0.5)',
          letterSpacing: '1px', marginBottom: '16px',
        }}>
          Spokes completed: {completedSpokes.value}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '240px' }}>
        <button
          class="hub-btn hub-btn-primary"
          onClick={handleStartSpoke}
        >
          Start Spoke
        </button>
      </div>
    </div>
  );
}
