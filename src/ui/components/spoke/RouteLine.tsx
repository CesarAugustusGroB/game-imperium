/**
 * Route segment between two landmarks (S27-08).
 *
 * Replaces the old 3px ConnectingLine with a state-aware path that supports
 * angled directions for branch attachments. The four states map to a
 * player's progression view:
 *   - resolved   → gold, slightly glowing, the past
 *   - current    → animated sweep, the live edge
 *   - reachable  → solid colored, the next options
 *   - locked     → dashed gray, can't path here yet
 */

if (typeof document !== 'undefined' && !document.getElementById('route-line-styles')) {
  const el = document.createElement('style');
  el.id = 'route-line-styles';
  el.textContent = `
    @keyframes route-line-sweep {
      0%   { background-position: -64px 0; }
      100% { background-position: 64px 0; }
    }
    .route-line {
      flex-shrink: 0;
      align-self: center;
      position: relative;
      transition: background var(--duration-normal) var(--ease-default);
    }
    .route-line-current {
      overflow: hidden;
    }
    .route-line-current::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(90deg, transparent 30%, var(--rl-color) 50%, transparent 70%);
      background-size: 64px 100%;
      animation: route-line-sweep 1.8s linear infinite;
      opacity: 0.6;
    }
  `;
  document.head.appendChild(el);
}

export type RouteLineState = 'resolved' | 'current' | 'reachable' | 'locked';

interface RouteLineProps {
  state: RouteLineState;
  color: string;
  direction?: 'horizontal' | 'down-right' | 'up-right';
  length?: number;
}

export function RouteLine({ state, color, direction = 'horizontal', length = 64 }: RouteLineProps) {
  const background =
    state === 'resolved'
      ? `linear-gradient(90deg, ${color}90, ${color}55)`
      : state === 'reachable' || state === 'current'
        ? `linear-gradient(90deg, ${color}80, ${color}50)`
        : 'repeating-linear-gradient(90deg, rgba(120,120,120,0.22) 0 6px, transparent 6px 12px)';

  const boxShadow =
    state === 'resolved' ? `0 0 6px ${color}40` :
    state === 'current'  ? `0 0 8px ${color}55` :
    'none';

  const rotate =
    direction === 'down-right' ? 'rotate(18deg)' :
    direction === 'up-right'   ? 'rotate(-18deg)' :
    'none';

  return (
    <div
      class={`route-line${state === 'current' ? ' route-line-current' : ''}`}
      aria-hidden="true"
      style={{
        '--rl-color': color,
        width: `${length}px`,
        height: '3px',
        borderRadius: '1.5px',
        background,
        boxShadow,
        transform: rotate,
        transformOrigin: 'left center',
      } as Record<string, string>}
    />
  );
}
