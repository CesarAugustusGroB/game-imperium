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

/**
 * Compute viewport-fixed coordinates for the tooltip based on the trigger's
 * bounding rect. Uses `position: fixed` so the tooltip escapes every
 * `overflow: hidden`/`auto` ancestor — critical for the Forum shell where
 * tabs live inside stacked scroll containers that would otherwise clip
 * absolute-positioned children.
 */
function getFixedPositionStyle(
  rect: DOMRect,
  position: TooltipPosition,
  align: TooltipAlign,
): JSX.CSSProperties {
  const GAP = 8;
  switch (position) {
    case 'above':
      return align === 'start'
        ? { left: rect.left, top: rect.top - GAP, transform: 'translateY(-100%)' }
        : {
            left: rect.left + rect.width / 2,
            top: rect.top - GAP,
            transform: 'translate(-50%, -100%)',
          };
    case 'below':
      return align === 'start'
        ? { left: rect.left, top: rect.bottom + GAP }
        : {
            left: rect.left + rect.width / 2,
            top: rect.bottom + GAP,
            transform: 'translateX(-50%)',
          };
    case 'left':
      return {
        left: rect.left - GAP,
        top: rect.top + rect.height / 2,
        transform: 'translate(-100%, -50%)',
      };
    case 'right':
      return {
        left: rect.right + GAP,
        top: rect.top + rect.height / 2,
        transform: 'translateY(-50%)',
      };
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
  const [rect, setRect] = useState<DOMRect | null>(null);
  const triggerRef = useRef<HTMLSpanElement | null>(null);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const measure = useCallback(() => {
    if (triggerRef.current) setRect(triggerRef.current.getBoundingClientRect());
  }, []);

  // While visible, keep the tooltip pinned to the trigger. Any ancestor
  // scroll or window resize hides it (rather than risking a stale-position
  // flash) — the user is welcome to re-hover to bring it back.
  useEffect(() => {
    if (!visible) return;
    const hide = () => setVisible(false);
    // Capture phase catches nested scroll containers too.
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    return () => {
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
    };
  }, [visible]);

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
      measure();
      setVisible(true);
      showTimer.current = null;
    }, delay);
  }, [disabled, delay, cancelHide, measure]);

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

  const tooltipStyle: JSX.CSSProperties | null = rect ? {
    position: 'fixed',
    fontFamily: 'var(--font-family)',
    zIndex: 1000,
    pointerEvents: 'auto',
    ...getFixedPositionStyle(rect, position, align),
    ...variantStyle,
  } : null;

  return (
    <span
      ref={triggerRef}
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={handleTriggerMouseEnter}
      onMouseLeave={handleTriggerMouseLeave}
    >
      {children}
      {visible && !disabled && tooltipStyle && (
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
