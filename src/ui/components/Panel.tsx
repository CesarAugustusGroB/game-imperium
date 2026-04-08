import type { ComponentChildren } from 'preact';
import type { JSX } from 'preact/jsx-runtime';
import { useEffect } from 'preact/hooks';

type PanelVariant = 'info' | 'action' | 'modal';
type PanelSize = 'sm' | 'md' | 'lg' | 'wide' | 'full';

interface PanelProps {
  variant?: PanelVariant;
  size?: PanelSize;
  title?: string;
  children: ComponentChildren;
  onClose?: () => void;
  className?: string;
  style?: JSX.CSSProperties;
}

const SIZE_MAP: Record<PanelSize, string> = {
  sm: '320px',
  md: '480px',
  lg: '520px',
  wide: '640px',
  full: '100%',
};

if (typeof document !== 'undefined' && !document.getElementById('panel-styles')) {
  const el = document.createElement('style');
  el.id = 'panel-styles';
  el.textContent = `
    @keyframes panel-fade { from { opacity: 0; } to { opacity: 1; } }
    @keyframes panel-slide { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
    .panel-backdrop { animation: panel-fade 0.2s ease-out; }
    .panel-content { animation: panel-slide 0.25s ease-out; }
    .panel-close:hover { color: var(--color-gold-primary); }
  `;
  document.head.appendChild(el);
}

export function Panel({
  variant = 'info',
  size,
  title,
  children,
  onClose,
  className,
  style,
}: PanelProps) {
  useEffect(() => {
    if (variant !== 'modal' || !onClose) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [variant, onClose]);

  const panelStyle: JSX.CSSProperties = {
    background: 'var(--color-bg-primary)',
    border: 'var(--border-width) solid var(--color-border-subtle)',
    borderRadius: 'var(--radius-md)',
    backdropFilter: 'blur(var(--blur-panel))',
    WebkitBackdropFilter: 'blur(var(--blur-panel))',
    boxShadow: 'var(--shadow-md)',
    padding: 'var(--space-lg)',
    position: 'relative',
    fontFamily: 'var(--font-family)',
    ...(size ? { maxWidth: SIZE_MAP[size] } : {}),
    ...style,
  };

  const titleStyle: JSX.CSSProperties = {
    fontSize: 'var(--font-size-xs)',
    fontWeight: 700,
    color: 'var(--color-text-muted)',
    letterSpacing: '2px',
    textTransform: 'uppercase',
    margin: '0 0 var(--space-md) 0',
  };

  const closeButtonStyle: JSX.CSSProperties = {
    position: 'absolute',
    top: 'var(--space-lg)',
    right: 'var(--space-lg)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--color-text-muted)',
    fontSize: '1rem',
    lineHeight: 1,
    padding: '2px 4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'color 0.15s ease',
  };

  const panelContent = (
    <div
      class={['panel-content', className].filter(Boolean).join(' ')}
      style={panelStyle}
    >
      {title && <p style={titleStyle}>{title}</p>}
      {onClose && (
        <button
          class="panel-close"
          style={closeButtonStyle}
          onClick={onClose}
          aria-label="Close"
        >
          ✕
        </button>
      )}
      {children}
    </div>
  );

  if (variant === 'modal') {
    const backdropStyle: JSX.CSSProperties = {
      position: 'fixed',
      inset: 0,
      zIndex: 200,
      background: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    };

    const handleBackdropClick = (e: MouseEvent) => {
      if (e.target === e.currentTarget && onClose) onClose();
    };

    return (
      <div
        class="panel-backdrop"
        role="dialog"
        aria-modal="true"
        aria-label={title ?? 'Dialog'}
        style={backdropStyle}
        onClick={handleBackdropClick}
      >
        {panelContent}
      </div>
    );
  }

  return panelContent;
}
