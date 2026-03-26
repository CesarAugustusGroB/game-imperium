import { signal } from '@preact/signals';

const count = signal(0);

export function TestPreact() {
  return (
    <div style={{
      position: 'fixed',
      top: '10px',
      left: '10px',
      zIndex: 999,
      background: 'rgba(10, 10, 30, 0.9)',
      border: '1px solid rgba(180, 160, 100, 0.4)',
      borderRadius: '6px',
      padding: '12px 16px',
      color: '#f0d080',
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      fontSize: '13px',
    }}>
      <div style={{ fontWeight: 600, marginBottom: '4px' }}>Preact + Signals</div>
      <div>Count: {count}</div>
      <button
        onClick={() => { count.value++; }}
        style={{
          marginTop: '6px',
          background: 'rgba(60, 60, 80, 0.8)',
          border: '1px solid rgba(100, 100, 120, 0.5)',
          color: '#b0b0b0',
          padding: '4px 10px',
          borderRadius: '3px',
          cursor: 'pointer',
          fontSize: '12px',
        }}
      >
        Increment
      </button>
    </div>
  );
}
