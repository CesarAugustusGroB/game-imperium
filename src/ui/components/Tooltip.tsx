import type { ComponentChildren } from 'preact';
import type { JSX } from 'preact/jsx-runtime';
import { useRef, useState, useEffect, useCallback } from 'preact/hooks';

type TooltipPosition = 'above' | 'below' | 'left' | 'right';
type TooltipVariant = 'simple' | 'rich';
/** Horizontal alignment for above/below positions. 'start' = left-edge of trigger. */
type TooltipAlign = 'center' | 'start';

interface TooltipProps {
  content: ComponentChildren;
  children: ComponentChildren;
  position?: TooltipPosition;
  align?: TooltipAlign;
  delay?: number;
  variant?: TooltipVariant;
  disabled?: boolean;
}

if (typeof document !== 'undefined' && !document.getElementById('tooltip-styles')) {
  const el = document.createElement('style');
  el.id = 'tooltip-styles';
  el.textContent = `
    @keyframes tooltip-enter { from { opacity: 0; } to { opacity: 1; } }
    .tooltip-box { animation: tooltip-enter var(--duration-fast) var(--ease-default) forwards; }
  `;
  document.head.appendChild(el);
}

function getPositionStyle(position: TooltipPosition, align: TooltipAlign): JSX.CSSProperties {
  switch (position) {
    case 'above':
      return align === 'start'
        ? { bottom: '100%', left: '0', marginBottom: '8px' }
        : { bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: '8px' };
    case 'below':
      return align === 'start'
        ? { top: '100%', left: '0', marginTop: '8px' }
        : { top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: '8px' };
    case 'left':
      return { right: '100%', top: '50%', transform: 'translateY(-50%)', marginRight: '8px' };
    case 'right':
      return { left: '100%', top: '50%', transform: 'translateY(-50%)', marginLeft: '8px' };
  }
}

export function Tooltip({
  content,
  children,
  position = 'above',
  align = 'center',
  delay = 300,
  variant = 'simple',
  disabled = false,
}: TooltipProps): JSX.Element {
  const [visible, setVisible] = useState(false);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (showTimer.current !== null) clearTimeout(showTimer.current);
      if (hideTimer.current !== null) clearTimeout(hideTimer.current);
    };
  }, []);

  const cancelHide = useCallback(() => {
    if (hideTimer.current !== null) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    cancelHide();
    hideTimer.current = setTimeout(() => {
      setVisible(false);
      hideTimer.current = null;
    }, 100);
  }, [cancelHide]);

  const handleTriggerMouseEnter = useCallback(() => {
    if (disabled) return;
    cancelHide();
    if (showTimer.current !== null) clearTimeout(showTimer.current);
    showTimer.current = setTimeout(() => {
      setVisible(true);
      showTimer.current = null;
    }, delay);
  }, [disabled, delay, cancelHide]);

  const handleTriggerMouseLeave = useCallback(() => {
    if (showTimer.current !== null) {
      clearTimeout(showTimer.current);
      showTimer.current = null;
    }
    scheduleHide();
  }, [scheduleHide]);

  const handleTooltipMouseEnter = useCallback(() => {
    cancelHide();
  }, [cancelHide]);

  const handleTooltipMouseLeave = useCallback(() => {
    scheduleHide();
  }, [scheduleHide]);

  const positionStyle = getPositionStyle(position, align);

  const variantStyle: JSX.CSSProperties =
    variant === 'simple'
      ? {
          padding: 'var(--space-xs) var(--space-sm)',
          fontSize: 'var(--font-size-sm)',
          color: 'var(--color-text-secondary)',
          whiteSpace: 'nowrap',
          background: 'var(--color-bg-primary)',
          border: '1px solid var(--color-border-default)',
          borderRadius: 'var(--radius-sm)',
          boxShadow: 'var(--shadow-md)',
        }
      : {
          padding: '10px 14px',
          fontSize: 'var(--font-size-sm)',
          color: 'var(--color-text-secondary)',
          minWidth: '180px',
          maxWidth: '280px',
          whiteSpace: 'normal',
          background: 'var(--color-marble-dark)',
          border: '1px solid var(--color-border-strong)',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-lg), 0 0 0 1px rgba(240,208,128,0.06) inset',
          borderTop: '2px solid var(--color-gold-secondary)',
        };

  const tooltipStyle: JSX.CSSProperties = {
    position: 'absolute',
    fontFamily: 'var(--font-family)',
    zIndex: 100,
    pointerEvents: 'auto',
    ...positionStyle,
    ...variantStyle,
  };

  return (
    <span
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={handleTriggerMouseEnter}
      onMouseLeave={handleTriggerMouseLeave}
    >
      {children}
      {visible && !disabled && (
        <div
          class="tooltip-box"
          style={tooltipStyle}
          onMouseEnter={handleTooltipMouseEnter}
          onMouseLeave={handleTooltipMouseLeave}
        >
          {content}
        </div>
      )}
    </span>
  );
}
