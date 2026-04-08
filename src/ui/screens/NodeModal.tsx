import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';

// ── One-time CSS injection ──
if (typeof document !== 'undefined' && !document.getElementById('node-modal-styles')) {
  const el = document.createElement('style');
  el.id = 'node-modal-styles';
  el.textContent = `
    @keyframes node-modal-fade {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    @keyframes node-modal-slide-up {
      from { opacity: 0; transform: translateY(12px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .node-modal-backdrop {
      animation: node-modal-fade var(--duration-normal) ease-out;
    }
    .node-modal-panel {
      animation: node-modal-slide-up 0.25s ease-out;
    }
  `;
  document.head.appendChild(el);
}

export function NodeModal({ title, children, onClose }: {
  title: string;
  children: ComponentChildren;
  onClose: () => void;
}) {
  const backdropRef = useRef<HTMLDivElement>(null);

  // Escape key handler
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Auto-focus backdrop for keyboard accessibility
  useEffect(() => {
    backdropRef.current?.focus();
  }, []);

  return (
    <div
      ref={backdropRef}
      class="node-modal-backdrop"
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        position: 'fixed', inset: '0', zIndex: '200',
        background: 'rgba(0, 0, 0, 0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-family)',
        outline: 'none',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div class="node-modal-panel" style={{
        background: 'linear-gradient(135deg, var(--color-bg-secondary), var(--color-bg-primary))',
        border: '1px solid var(--color-border-default)',
        borderRadius: 'var(--radius-md)', padding: '28px 32px',
        maxWidth: '400px', width: '90%', textAlign: 'center',
      }}>
        <div style={{
          fontSize: 'var(--font-size-lg)', fontWeight: 600, color: 'var(--color-gold-primary)',
          letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '16px',
        }}>
          {title}
        </div>
        {children}
      </div>
    </div>
  );
}
