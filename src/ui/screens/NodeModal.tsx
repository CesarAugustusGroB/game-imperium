import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { OrnateFrame, OrnateHeader } from '../components/OrnateFrame';

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
      animation: node-modal-fade var(--duration-normal) ease-out;
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
        padding: '20px',
        fontFamily: 'var(--font-family)',
        outline: 'none',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <OrnateFrame
        width="min(520px, 92vw)"
        padding="compact"
        style={{ maxHeight: '85vh', overflow: 'hidden' }}
        onClick={(e: MouseEvent) => e.stopPropagation()}
      >
        <OrnateHeader
          titleSize="md"
          title={title}
          onClose={onClose}
        />
        {children}
      </OrnateFrame>
    </div>
  );
}
