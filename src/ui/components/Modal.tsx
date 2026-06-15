import { useEffect, useRef } from 'preact/hooks';
import type { ComponentChildren, JSX } from 'preact';

// Inject the shared backdrop animation once.
if (typeof document !== 'undefined' && !document.getElementById('modal-styles')) {
  const el = document.createElement('style');
  el.id = 'modal-styles';
  el.textContent = `
    @keyframes modal-backdrop-in { from { opacity: 0; } to { opacity: 1; } }
    @media (prefers-reduced-motion: no-preference) {
      .imp-modal-backdrop { animation: modal-backdrop-in 140ms var(--ease-default, ease-out) both; }
    }
  `;
  document.head.appendChild(el);
}

const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled])',
  'select:not([disabled])', 'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])',
].join(',');

export interface ModalProps {
  /** When false the modal renders nothing. */
  open: boolean;
  /** Called on Escape and (when dismissable) backdrop click. */
  onClose: () => void;
  children: ComponentChildren;
  /** Esc + backdrop-click dismissal. Default true. Set false for forced-choice modals. */
  dismissable?: boolean;
  /** Stacking layer. Default the standard modal token; pass a higher one for confirms. */
  zIndex?: number | string;
  /** id of the element labelling the dialog (aria-labelledby). */
  labelledBy?: string;
  /** Fallback accessible name when there is no visible title to reference. */
  label?: string;
  /** Backdrop background. */
  backdrop?: string;
  /** Extra style on the centering wrapper. */
  style?: JSX.CSSProperties;
}

/**
 * Shared modal shell: fixed full-screen backdrop, centred content, and the
 * behaviours every modal needs — Escape-to-close, click-outside-to-close (opt
 * out via `dismissable`), body scroll-lock while open, focus trap with focus
 * restore on close, and dialog ARIA. Pass the styled card as children; this
 * owns only the backdrop and behaviour, not the card's look.
 */
export function Modal({
  open,
  onClose,
  children,
  dismissable = true,
  zIndex = 'var(--imp-z-modal)',
  labelledBy,
  label,
  backdrop = 'rgba(8, 6, 14, 0.78)',
  style,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const prevFocus = useRef<Element | null>(null);

  // Escape closes (when dismissable).
  useEffect(() => {
    if (!open || !dismissable) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, dismissable, onClose]);

  // Body scroll-lock while open (restore prior value on close/unmount).
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Focus management: move focus into the dialog on open, restore it on close.
  useEffect(() => {
    if (!open) return;
    prevFocus.current = document.activeElement;
    const node = dialogRef.current;
    if (node) {
      const first = node.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? node).focus();
    }
    return () => {
      const target = prevFocus.current;
      if (target instanceof HTMLElement) target.focus();
    };
  }, [open]);

  if (!open) return null;

  // Trap Tab within the dialog.
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    const node = dialogRef.current;
    if (!node) return;
    const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (items.length === 0) { e.preventDefault(); return; }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
  };

  return (
    <div
      class="imp-modal-backdrop"
      style={{
        position: 'fixed', inset: 0, zIndex,
        background: backdrop, backdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16, ...style,
      }}
      onClick={dismissable ? onClose : undefined}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-label={labelledBy ? undefined : label}
        tabIndex={-1}
        style={{ outline: 'none', maxWidth: '100%', maxHeight: '100%' }}
        onClick={(e: MouseEvent) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        {children}
      </div>
    </div>
  );
}
