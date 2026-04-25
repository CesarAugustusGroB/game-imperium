import type { ComponentChildren } from 'preact';
import type { JSX } from 'preact/jsx-runtime';
import { useRef, useState, useEffect, useCallback, useLayoutEffect } from 'preact/hooks';

type TooltipPosition = 'above' | 'below' | 'left' | 'right';
type TooltipVariant = 'simple' | 'rich';
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

interface TooltipSize {
  width: number;
  height: number;
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function getFixedPositionStyle(
  rect: DOMRect,
  position: TooltipPosition,
  align: TooltipAlign,
  size: TooltipSize | null,
): JSX.CSSProperties {
  const GAP = 8;
  const VIEWPORT_PADDING = 8;
  const width = size?.width ?? 0;
  const height = size?.height ?? 0;
  const maxLeft = Math.max(VIEWPORT_PADDING, window.innerWidth - VIEWPORT_PADDING - width);
  const maxTop = Math.max(VIEWPORT_PADDING, window.innerHeight - VIEWPORT_PADDING - height);

  switch (position) {
    case 'above': {
      const rawLeft = align === 'start' ? rect.left : rect.left + rect.width / 2 - width / 2;
      return {
        left: clamp(rawLeft, VIEWPORT_PADDING, maxLeft),
        top: clamp(rect.top - GAP - height, VIEWPORT_PADDING, maxTop),
      };
    }
    case 'below': {
      const rawLeft = align === 'start' ? rect.left : rect.left + rect.width / 2 - width / 2;
      return {
        left: clamp(rawLeft, VIEWPORT_PADDING, maxLeft),
        top: clamp(rect.bottom + GAP, VIEWPORT_PADDING, maxTop),
      };
    }
    case 'left':
      return {
        left: clamp(rect.left - GAP - width, VIEWPORT_PADDING, maxLeft),
        top: clamp(rect.top + rect.height / 2 - height / 2, VIEWPORT_PADDING, maxTop),
      };
    case 'right':
      return {
        left: clamp(rect.right + GAP, VIEWPORT_PADDING, maxLeft),
        top: clamp(rect.top + rect.height / 2 - height / 2, VIEWPORT_PADDING, maxTop),
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
  const [tooltipSize, setTooltipSize] = useState<TooltipSize | null>(null);
  const triggerRef = useRef<HTMLSpanElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const measure = useCallback(() => {
    if (triggerRef.current) setRect(triggerRef.current.getBoundingClientRect());
  }, []);

  useEffect(() => {
    if (!visible) return;
    const hide = () => setVisible(false);
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

  useLayoutEffect(() => {
    if (!visible || !tooltipRef.current) {
      setTooltipSize(null);
      return;
    }

    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const nextSize = {
      width: Math.ceil(tooltipRect.width),
      height: Math.ceil(tooltipRect.height),
    };

    if (
      tooltipSize?.width !== nextSize.width ||
      tooltipSize?.height !== nextSize.height
    ) {
      setTooltipSize(nextSize);
    }
  });

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

  const basePositionStyle = rect ? getFixedPositionStyle(rect, position, align, tooltipSize) : null;

  const tooltipStyle: JSX.CSSProperties | null = basePositionStyle ? {
    position: 'fixed',
    fontFamily: 'var(--font-family)',
    zIndex: 1000,
    pointerEvents: 'auto',
    ...basePositionStyle,
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
          ref={tooltipRef}
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
