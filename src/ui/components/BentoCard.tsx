import type { JSX, ComponentChildren } from 'preact';

interface BentoCardProps {
  children: ComponentChildren;
  /** Accent color — drives the hairline + hover glow. Defaults to Forum gold. */
  accent?: string;
  /** Stagger order for the entrance animation (0-based). */
  index?: number;
  /** Gold hairline along the top edge. */
  hairline?: boolean;
  /** Lift + glow on hover. Disable for non-interactive surfaces. */
  interactive?: boolean;
  onClick?: () => void;
  style?: JSX.CSSProperties;
  className?: string;
}

/**
 * The unified glass-and-gold panel of the Forum overview. Replaces the older
 * flat OrnatePanel look with a frosted surface, a gold hairline, a hover lift,
 * and a staggered entrance keyed off `index`. School/faction color-coding flows
 * through `accent`.
 */
export function BentoCard({
  children,
  accent = '#d4a843',
  index = 0,
  hairline = true,
  interactive = true,
  onClick,
  style,
  className,
}: BentoCardProps) {
  return (
    <div
      class={`imp-bento${interactive ? ' imp-bento--interactive' : ''}${className ? ` ${className}` : ''}`}
      onClick={onClick}
      style={{
        // Consumed by the :hover glow and the staggered entrance in globals.css.
        '--imp-panel-accent': accent,
        '--bento-i': index,
        ...style,
      }}
    >
      {hairline && (
        <span
          class="imp-bento__hairline"
          aria-hidden="true"
          style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }}
        />
      )}
      {children}
    </div>
  );
}
