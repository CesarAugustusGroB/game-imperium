import { navigateTo } from './screens';
import { startSpoke } from '../game/spoke';
import { completedSpokes } from '../game/game-state';

export function HubScreen() {
  function handleStartSpoke() {
    startSpoke();
    navigateTo('node-map');
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100vh', fontFamily: "'Segoe UI', system-ui, sans-serif",
    }}>
      <div style={{
        fontSize: '20px', fontWeight: 600, color: '#f0d080',
        letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '24px',
      }}>
        Hub
      </div>

      {completedSpokes.value > 0 && (
        <div style={{
          fontSize: '12px', color: 'rgba(180, 170, 150, 0.5)',
          letterSpacing: '1px', marginBottom: '16px',
        }}>
          Spokes completed: {completedSpokes.value}
        </div>
      )}

      <div style={{ display: 'flex', gap: '12px' }}>
        <button
          onClick={handleStartSpoke}
          style={{
            padding: '10px 20px',
            background: 'rgba(60, 60, 80, 0.8)', border: '1px solid rgba(180, 160, 100, 0.3)',
            borderRadius: '4px', cursor: 'pointer',
            color: '#d0c8a8', fontFamily: 'inherit', fontSize: '14px',
          }}
        >
          Start Spoke →
        </button>
      </div>
    </div>
  );
}
