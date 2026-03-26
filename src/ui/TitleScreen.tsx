import { navigateTo } from './screens';

export function TitleScreen() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100vh', fontFamily: "'Segoe UI', system-ui, sans-serif",
    }}>
      <div style={{
        fontSize: '48px', fontWeight: 700, letterSpacing: '4px', textTransform: 'uppercase',
        color: '#f0d080',
        textShadow: '0 2px 12px rgba(180, 140, 60, 0.5), 0 0 40px rgba(180, 140, 60, 0.15)',
        marginBottom: '4px',
      }}>
        IMPERIUM
      </div>
      <div style={{
        fontSize: '14px', letterSpacing: '6px', textTransform: 'uppercase',
        color: 'rgba(180, 170, 140, 0.6)', marginBottom: '48px',
      }}>
        Roguelite Grand Strategy
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '280px' }}>
        <button
          onClick={() => navigateTo('commander-select')}
          style={{
            padding: '14px 24px',
            background: 'linear-gradient(135deg, rgba(80, 60, 20, 0.7), rgba(50, 40, 18, 0.9))',
            border: '1px solid rgba(220, 190, 100, 0.5)',
            borderRadius: '4px', cursor: 'pointer',
            fontFamily: 'inherit', fontSize: '16px', fontWeight: 600, letterSpacing: '2px',
            textTransform: 'uppercase', color: '#f0d080',
          }}
        >
          New Game
        </button>
        <button
          disabled
          style={{
            padding: '14px 24px',
            background: 'linear-gradient(135deg, rgba(40, 36, 60, 0.9), rgba(28, 26, 48, 0.95))',
            border: '1px solid rgba(100, 100, 100, 0.2)',
            borderRadius: '4px', cursor: 'default',
            fontFamily: 'inherit', fontSize: '16px', fontWeight: 600, letterSpacing: '2px',
            textTransform: 'uppercase', color: '#d0c8a8', opacity: 0.35,
          }}
        >
          Continue
        </button>
      </div>
    </div>
  );
}
