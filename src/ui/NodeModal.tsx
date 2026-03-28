import type { ComponentChildren } from 'preact';

// ── One-time CSS injection ──
if (typeof document !== 'undefined' && !document.getElementById('node-modal-styles')) {
  const el = document.createElement('style');
  el.id = 'node-modal-styles';
  el.textContent = `
    @keyframes node-modal-fade {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    .node-modal-backdrop {
      animation: node-modal-fade 0.2s ease-out;
    }
  `;
  document.head.appendChild(el);
}

export function NodeModal({ title, children, onClose }: {
  title: string;
  children: ComponentChildren;
  onClose: () => void;
}) {
  return (
    <div
      class="node-modal-backdrop"
      style={{
        position: 'fixed', inset: '0', zIndex: '200',
        background: 'rgba(0, 0, 0, 0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'Segoe UI', system-ui, sans-serif",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'linear-gradient(135deg, rgba(30, 28, 48, 0.98), rgba(20, 18, 36, 0.99))',
        border: '1px solid rgba(180, 160, 100, 0.25)',
        borderRadius: '8px', padding: '28px 32px',
        maxWidth: '400px', width: '90%', textAlign: 'center',
      }}>
        <div style={{
          fontSize: '16px', fontWeight: 600, color: '#f0d080',
          letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '16px',
        }}>
          {title}
        </div>
        {children}
      </div>
    </div>
  );
}
