import { useEffect } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { Corners } from './motifs/Corners';

// Inject animation styles once (same guard pattern as CampaignEventModal.tsx).
if (typeof document !== 'undefined' && !document.getElementById('confirm-dialog-styles')) {
  const el = document.createElement('style');
  el.id = 'confirm-dialog-styles';
  el.textContent = `
    @keyframes confirm-dialog-in {
      from { opacity: 0; transform: scale(0.96); }
      to   { opacity: 1; transform: scale(1); }
    }
    @media (prefers-reduced-motion: no-preference) {
      .confirm-dialog-card {
        animation: confirm-dialog-in 180ms var(--ease-default) both;
      }
    }
    .confirm-dialog-btn-cancel {
      padding: 7px 16px;
      background: transparent;
      border: 1px solid rgba(212, 168, 67, 0.45);
      border-radius: 2px;
      color: rgba(212, 168, 67, 0.85);
      font-family: var(--imp-font-display);
      font-size: 10px;
      letter-spacing: 2px;
      text-transform: uppercase;
      cursor: pointer;
      transition: background 120ms, border-color 120ms, color 120ms;
    }
    .confirm-dialog-btn-cancel:hover {
      background: rgba(212, 168, 67, 0.08);
      border-color: rgba(212, 168, 67, 0.75);
      color: rgba(240, 208, 128, 1);
    }
    .confirm-dialog-btn-confirm {
      padding: 7px 16px;
      background: rgba(212, 168, 67, 0.15);
      border: 1px solid rgba(212, 168, 67, 0.6);
      border-radius: 2px;
      color: rgba(240, 208, 128, 0.9);
      font-family: var(--imp-font-display);
      font-size: 10px;
      letter-spacing: 2px;
      text-transform: uppercase;
      cursor: pointer;
      transition: background 120ms, border-color 120ms, color 120ms;
    }
    .confirm-dialog-btn-confirm:hover {
      background: rgba(212, 168, 67, 0.28);
      border-color: rgba(212, 168, 67, 0.9);
      color: rgba(240, 208, 128, 1);
    }
    .confirm-dialog-btn-confirm--destructive {
      background: rgba(150, 38, 50, 0.45);
      border: 1px solid rgba(180, 60, 70, 0.85);
      color: rgba(240, 200, 200, 0.9);
    }
    .confirm-dialog-btn-confirm--destructive:hover {
      background: rgba(170, 50, 60, 0.65);
      border-color: rgba(210, 80, 90, 1);
      color: rgba(255, 220, 220, 1);
    }
  `;
  document.head.appendChild(el);
}

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body: string | ComponentChildren;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  // Esc key cancels.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onCancel]);

  if (!open) return null;

  const confirmClass = destructive
    ? 'confirm-dialog-btn-confirm confirm-dialog-btn-confirm--destructive'
    : 'confirm-dialog-btn-confirm';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(8, 6, 14, 0.78)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={onCancel}
    >
      <div
        class="confirm-dialog-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-body"
        style={{
          maxWidth: 420,
          width: '100%',
          background: 'rgba(22, 16, 10, 0.96)',
          border: '1px solid rgba(212, 168, 67, 0.55)',
          borderRadius: 2,
          padding: '28px 28px 22px',
          position: 'relative',
          boxShadow: '0 16px 48px rgba(0, 0, 0, 0.7)',
        }}
        onClick={(e: MouseEvent) => e.stopPropagation()}
      >
        <Corners color="rgba(212, 168, 67, 0.55)" size={12} inset={3} thickness={1} />

        <div
          id="confirm-dialog-title"
          style={{
            fontFamily: 'var(--imp-font-display)',
            fontSize: 16,
            fontWeight: 600,
            color: 'var(--imp-gold)',
            letterSpacing: 2,
            textTransform: 'uppercase',
            marginBottom: 14,
          }}
        >
          {title}
        </div>

        <div
          id="confirm-dialog-body"
          style={{
            fontFamily: 'var(--imp-font-body)',
            fontSize: 13,
            color: 'var(--imp-text-mid)',
            lineHeight: 1.5,
            marginBottom: 24,
          }}
        >
          {body}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
          }}
        >
          <button type="button" class="confirm-dialog-btn-cancel" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" class={confirmClass} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
