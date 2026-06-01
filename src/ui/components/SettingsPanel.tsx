import type { JSX } from 'preact';
import { useEffect } from 'preact/hooks';
import { OrnateFrame, OrnateHeader } from './OrnateFrame';

if (typeof document !== 'undefined' && !document.getElementById('settings-panel-styles')) {
  const el = document.createElement('style');
  el.id = 'settings-panel-styles';
  el.textContent = `
    @keyframes options-modal-in {
      from { opacity: 0; transform: translateY(12px) scale(0.98); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
    .settings-toggle-row {
      transition: background var(--duration-fast) var(--ease-default), border-color var(--duration-fast) var(--ease-default);
    }
    .settings-toggle-row:hover {
      background: rgba(240, 208, 128, 0.06) !important;
      border-color: var(--color-border-default) !important;
    }
    .settings-toggle-row:focus-visible {
      outline: 2px solid var(--color-gold-primary);
      outline-offset: 2px;
    }
    .options-modal-card {
      animation: options-modal-in var(--duration-normal) var(--ease-default) both;
    }
    @media (prefers-reduced-motion: reduce) {
      .settings-toggle-row,
      .options-modal-card {
        animation: none !important;
        transition: none !important;
      }
    }
  `;
  document.head.appendChild(el);
}

export function SettingsPanel({ style }: { style?: JSX.CSSProperties }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        fontFamily: 'var(--font-family)',
        ...style,
      }}
    >
      <p style={{
        fontSize: 'var(--font-size-sm)',
        color: 'var(--color-text-muted)',
        lineHeight: 1.5,
        margin: 0,
        textAlign: 'center',
        padding: '12px 0',
      }}>
        No options available.
      </p>
    </div>
  );
}

export function OptionsModal({ open, onClose }: {
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Options"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 20,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        background: 'rgba(8, 6, 14, 0.72)',
        backdropFilter: 'blur(3px)',
      }}
    >
      <OrnateFrame
        width="min(520px, 94vw)"
        padding="compact"
        className="options-modal-card"
        style={{ maxHeight: 'min(760px, 92vh)', overflowY: 'auto' }}
        onClick={(e: MouseEvent) => e.stopPropagation()}
      >
        <OrnateHeader
          eyebrow="Main Menu"
          title="Options"
          titleSize="md"
          onClose={onClose}
        />
        <SettingsPanel />
      </OrnateFrame>
    </div>
  );
}
