import { useRef, useEffect, useState } from 'preact/hooks';
import type { Signal } from '@preact/signals';
import { gold, iuniores } from '../../game/core/resources';
import { selectedCommander, globalSeason, MAX_SEASONS } from '../../game/core/game-state';
import { FACTION_PRIMARY_RESOURCE, RESOURCE_INFO } from '../../game/core/commander';

/** Only gold and iuniores are live; faith/influence/momentum are deprecated and never shown. */
type LiveResource = 'gold' | 'iuniores';
import { Tooltip } from './Tooltip';
import { InlineImageIcon, ResourceIcon } from './ResourceIcon';
import seasonIcon from '../../assets/ui/resources/season-icon-color.png';

// ── One-time CSS injection ──
if (typeof document !== 'undefined' && !document.getElementById('resource-bar-styles')) {
  const el = document.createElement('style');
  el.id = 'resource-bar-styles';
  el.textContent = `
    @keyframes resource-delta {
      from { opacity: 1; transform: translateY(0); }
      to { opacity: 0; transform: translateY(-12px); }
    }
    @media (max-width: 600px) {
      .resource-bar { gap: 12px !important; height: 34px !important; padding: 0 8px !important; }
      .resource-bar .resource-counter { font-size: 11px !important; }
    }
  `;
  document.head.appendChild(el);
}

const BAR_STYLE: Record<string, string> = {
  position: 'fixed', top: '0', left: '0', width: '100%', height: '38px',
  background: 'var(--color-bg-primary)',
  backdropFilter: 'blur(var(--blur-panel))',
  WebkitBackdropFilter: 'blur(var(--blur-panel))',
  borderBottom: '1px solid var(--color-border-default)',
  boxShadow: '0 2px 12px rgba(0, 0, 0, 0.4)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '24px',
  fontFamily: 'var(--font-family)', fontSize: 'var(--font-size-md)',
  zIndex: '100',
};

const resourceSignals: Record<LiveResource, Signal<number>> = {
  gold, iuniores,
};

const RESOURCE_TOOLTIP: Record<LiveResource, string> = {
  gold: 'Primary income for all factions. Used for upkeep and investments.',
  iuniores: 'Iuniores — citizen-soldiers drawn from your provinces. Spent to recruit cohorts (1000 each) and to replenish army HP at rest nodes.',
};

function ResourceCounter({ type }: { type: LiveResource }) {
  const sig = resourceSignals[type];
  const info = RESOURCE_INFO[type];
  const commander = selectedCommander.value;
  const isPrimary = commander
    ? FACTION_PRIMARY_RESOURCE[commander.faction] === type
    : false;

  const ref = useRef<HTMLSpanElement>(null);
  const prevValue = useRef(sig.value);
  const [delta, setDelta] = useState<number | null>(null);
  const renderIcon = () => <ResourceIcon type={type} size={22} />;

  // Flash on value change + capture delta
  useEffect(() => {
    const el = ref.current;
    if (!el || sig.value === prevValue.current) return;
    const gained = sig.value > prevValue.current;
    const diff = sig.value - prevValue.current;
    el.style.color = gained ? '#6c6' : '#c66';
    el.style.transform = 'scale(1.2)';
    setDelta(diff);
    prevValue.current = sig.value;
    const timer = setTimeout(() => {
      el.style.color = isPrimary ? info.color : 'var(--color-text-secondary)';
      el.style.transform = 'scale(1)';
    }, 400);
    // Remove delta after animation
    const deltaTimer = setTimeout(() => { setDelta(null); }, 800);
    return () => { clearTimeout(timer); clearTimeout(deltaTimer); };
  }, [sig.value]);

  return (
    <Tooltip
      content={
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ fontWeight: 700, color: info.color }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {renderIcon()}
              {info.label}
            </span>
          </div>
          <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
            {RESOURCE_TOOLTIP[type]}
          </div>
        </div>
      }
      variant="rich"
      position="below"
    >
      <div
        class="resource-counter"
        aria-label={`${info.label ?? type}: ${sig.value}`}
        style={{
          display: 'flex', alignItems: 'center', gap: '4px',
          opacity: isPrimary ? 1 : 0.7,
          position: 'relative',
        }}
      >
        {renderIcon()}
        <span
          ref={ref}
          style={{
            color: isPrimary ? info.color : 'var(--color-text-secondary)',
            fontWeight: isPrimary ? '700' : '400',
            transition: `color var(--duration-slow) var(--ease-default), transform var(--duration-normal) var(--ease-default)`,
            textShadow: isPrimary ? `0 0 8px ${info.color}40` : 'none',
          }}
        >
          {sig.value}
        </span>
        {delta !== null && delta !== 0 && (
          <span style={{
            position: 'absolute',
            top: '-14px',
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: 'var(--font-size-sm)',
            fontWeight: 700,
            color: delta > 0 ? '#6c6' : '#c66',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            animation: 'resource-delta 0.8s ease-out forwards',
          }}>
            {delta > 0 ? `+${delta}` : `${delta}`}
          </span>
        )}
      </div>
    </Tooltip>
  );
}

export function ResourceBar() {
  if (!selectedCommander.value) return null;

  return (
    <div class="resource-bar" style={BAR_STYLE}>
      <ResourceCounter type="gold" />
      <ResourceCounter type="iuniores" />
      <Tooltip
        content={<div>{`Season ${globalSeason.value} of ${MAX_SEASONS}.`}</div>}
        variant="rich"
        position="below"
      >
        <div
          aria-label={`Season ${globalSeason.value} of ${MAX_SEASONS}`}
          style={{ marginLeft: '12px', paddingLeft: '12px', borderLeft: '1px solid var(--color-border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
        >
          <InlineImageIcon src={seasonIcon} size={20} />
          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', fontWeight: 400, lineHeight: '1' }}>
            S{globalSeason.value}/{MAX_SEASONS}
          </span>
        </div>
      </Tooltip>
    </div>
  );
}
