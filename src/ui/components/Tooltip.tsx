// Reusable Preact tooltip powered by @floating-ui/dom.
//
// S34-06: Establishes the project's first floating-ui tooltip pattern.
// Uses strategy:'fixed' so the card escapes ancestor overflow:hidden
// containers (e.g. .chs-root on CampaignHexScreen).
//
// Backward-compat note: existing callers use `position` ('above'|'below'|
// 'left'|'right') and `align` ('center'|'start'). New callers should prefer
// `placement` (floating-ui Placement union e.g. 'top'|'bottom-start').
// When `placement` is provided it wins; otherwise position+align are mapped.
//
// Child must be a single Preact element — the wrapper span holds the trigger
// ref, so composites that render multiple roots won't attach correctly.

import { useRef, useState, useEffect } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import type { JSX } from 'preact/jsx-runtime';
import {
  computePosition,
  autoUpdate,
  offset,
  flip,
  shift,
  type Placement,
} from '@floating-ui/dom';

// ── Old positional API (kept for backward compat) ────────────────────────────
type LegacyPosition = 'above' | 'below' | 'left' | 'right';
type LegacyAlign = 'center' | 'start';
type TooltipVariant = 'simple' | 'rich';

function legacyToPlacement(
  position: LegacyPosition,
  align: LegacyAlign,
): Placement {
  const base = position === 'above' ? 'top' : position === 'below' ? 'bottom' : position;
  if (align === 'start') return `${base}-start` as Placement;
  return base as Placement;
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface TooltipProps {
  content: string | ComponentChildren;
  children: ComponentChildren;
  /** floating-ui Placement. Takes priority over `position`+`align`. */
  placement?: Placement;
  /** Legacy positional alias — prefer `placement` for new callers. */
  position?: LegacyPosition;
  /** Legacy alignment alias — combine with `position`. */
  align?: LegacyAlign;
  /** Visual style preset. Default 'simple'. */
  variant?: TooltipVariant;
  /** Hover-to-show delay in ms. Default 200. */
  delay?: number;
  /** Max width of tooltip card in px. Default 280. */
  maxWidth?: number;
  /** Suppress the tooltip entirely. */
  disabled?: boolean;
}

// ── Style injection ───────────────────────────────────────────────────────────
if (typeof document !== 'undefined' && !document.getElementById('tooltip-styles')) {
  const el = document.createElement('style');
  el.id = 'tooltip-styles';
  el.textContent = `
    @media (prefers-reduced-motion: no-preference) {
      @keyframes tooltip-fade-in {
        from { opacity: 0; transform: translateY(2px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      .tooltip-card { animation: tooltip-fade-in 120ms ease-out; }
    }
  `;
  document.head.appendChild(el);
}

// ── Variant styles ─────────────────────────────────────────────────────────
function getVariantStyle(variant: TooltipVariant): JSX.CSSProperties {
  if (variant === 'rich') {
    return {
      padding: '10px 14px',
      fontSize: 'var(--font-size-sm)',
      color: 'var(--color-text-secondary)',
      minWidth: '180px',
      whiteSpace: 'normal',
      background: 'var(--color-marble-dark)',
      border: '1px solid var(--color-border-strong)',
      borderRadius: 'var(--radius-md)',
      boxShadow: 'var(--shadow-lg), 0 0 0 1px rgba(240,208,128,0.06) inset',
      borderTop: '2px solid var(--color-gold-secondary)',
    };
  }
  // simple (default) — restored to the pre-S34-06 token-based palette
  // so existing 'simple' callers (ResourceBar, ProvinceScreen, Doctrine/Decretum
  // renderers) render identically. New rich-text callers like the Bellum chips
  // still get pre-line whitespace because S34-06 needs multi-line content.
  return {
    padding: 'var(--space-xs) var(--space-sm)',
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-text-secondary)',
    background: 'var(--color-bg-primary)',
    border: '1px solid var(--color-border-default)',
    borderRadius: 'var(--radius-sm)',
    boxShadow: 'var(--shadow-md)',
    whiteSpace: 'pre-line',
  };
}

// ── Component ──────────────────────────────────────────────────────────────
export function Tooltip({
  content,
  children,
  placement,
  position = 'above',
  align = 'center',
  variant = 'simple',
  delay = 200,
  maxWidth = 280,
  disabled = false,
}: TooltipProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ x: number; y: number } | null>(null);

  const triggerRef = useRef<HTMLSpanElement | null>(null);
  const floatingRef = useRef<HTMLDivElement | null>(null);
  const showTimer = useRef<number | null>(null);

  // Resolve floating-ui Placement from props
  const resolvedPlacement: Placement =
    placement ?? legacyToPlacement(position, align);

  // Clear pending show timer on unmount
  useEffect(() => {
    return () => {
      if (showTimer.current !== null) window.clearTimeout(showTimer.current);
    };
  }, []);

  // Position the card whenever open flips to true. autoUpdate re-positions on
  // scroll, resize, and ancestor layout changes — without it the tooltip stays
  // at the stale coords if the user scrolls a Forum panel after hover-in.
  useEffect(() => {
    if (!open || !triggerRef.current || !floatingRef.current) return;

    let cancelled = false;
    const trigger = triggerRef.current;
    const floating = floatingRef.current;

    const update = () => {
      computePosition(trigger, floating, {
        placement: resolvedPlacement,
        strategy: 'fixed',
        middleware: [offset(8), flip(), shift({ padding: 8 })],
      }).then(({ x, y }) => {
        if (!cancelled) setCoords({ x, y });
      });
    };

    const stopAutoUpdate = autoUpdate(trigger, floating, update);

    // Escape key closes
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      cancelled = true;
      stopAutoUpdate();
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, resolvedPlacement]);

  const handleMouseEnter = () => {
    if (disabled) return;
    if (showTimer.current !== null) window.clearTimeout(showTimer.current);
    showTimer.current = window.setTimeout(() => {
      showTimer.current = null;
      setOpen(true);
    }, delay);
  };

  const handleMouseLeave = () => {
    if (showTimer.current !== null) {
      window.clearTimeout(showTimer.current);
      showTimer.current = null;
    }
    setOpen(false);
  };

  const handleFocus = () => {
    if (disabled) return;
    setOpen(true);
  };

  const handleBlur = () => {
    setOpen(false);
  };

  const variantStyle = getVariantStyle(variant);

  const floatingStyle: JSX.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    zIndex: 10000,
    maxWidth: `${maxWidth}px`,
    fontFamily: 'var(--imp-font-body)',
    pointerEvents: 'none',
    transform: coords ? `translate(${coords.x}px, ${coords.y}px)` : 'translate(0, -9999px)',
    ...variantStyle,
  };

  return (
    <span
      ref={triggerRef}
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
    >
      {children}
      {!disabled && (
        <div
          ref={floatingRef}
          class="tooltip-card"
          role="tooltip"
          style={floatingStyle}
        >
          {open ? content : null}
        </div>
      )}
    </span>
  );
}
