import { navigateTo } from './screens';

export function CommanderSelectScreen() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100vh', fontFamily: "'Segoe UI', system-ui, sans-serif",
    }}>
      <div style={{
        fontSize: '20px', fontWeight: 600, color: '#f0d080',
        letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '24px',
      }}>
        Choose Your Commander
      </div>
      <div style={{ color: 'rgba(200, 190, 160, 0.5)', marginBottom: '24px' }}>
        Commander cards coming in S1-06
      </div>
      <button
        onClick={() => navigateTo('hub')}
        style={{
          padding: '10px 20px',
          background: 'rgba(60, 60, 80, 0.8)', border: '1px solid rgba(180, 160, 100, 0.3)',
          borderRadius: '4px', cursor: 'pointer',
          color: '#d0c8a8', fontFamily: 'inherit', fontSize: '14px',
        }}
      >
        Select (placeholder) → Hub
      </button>
    </div>
  );
}
