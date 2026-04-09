import { useRef, useEffect, useState } from 'preact/hooks';
import type { Signal } from '@preact/signals';
import { gold, faith, influence, momentum } from '../../game/core/resources';
import { selectedCommander, globalSeason, MAX_SEASONS, getDoomLevel } from '../../game/core/game-state';
import { FACTION_PRIMARY_RESOURCE, RESOURCE_INFO } from '../../game/core/commander';
import type { ResourceType } from '../../game/core/commander';

// ── One-time CSS injection ──
if (typeof document !== 'undefined' && !document.getElementById('resource-bar-styles')) {
  const el = document.createElement('style');
  el.id = 'resource-bar-styles';
  el.textContent = `
    @keyframes resource-delta {
      from { opacity: 1; transform: translateY(0); }
      to { opacity: 0; transform: translateY(-12px); }
    }
    @keyframes doom-pulse {
      0%, 100% { box-shadow: none; }
      50% { box-shadow: 0 0 6px 1px rgba(194,74,58,0.5); }
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

const resourceSignals: Record<ResourceType, Signal<number>> = {
  gold, faith, influence, momentum,
};

function ResourceCounter({ type }: { type: ResourceType }) {
  const sig = resourceSignals[type];
  const info = RESOURCE_INFO[type];
  const commander = selectedCommander.value;
  const isPrimary = commander
    ? FACTION_PRIMARY_RESOURCE[commander.faction] === type
    : false;

  const ref = useRef<HTMLSpanElement>(null);
  const prevValue = useRef(sig.value);
  const [delta, setDelta] = useState<number | null>(null);

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
    <div
      class="resource-counter"
      title={info.label ?? type}
      aria-label={`${info.label ?? type}: ${sig.value}`}
      style={{
        display: 'flex', alignItems: 'center', gap: '4px',
        opacity: isPrimary ? 1 : 0.7,
        position: 'relative',
      }}
    >
      <span style={{ fontSize: 'var(--font-size-lg)' }}>{info.icon}</span>
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
  );
}

export function ResourceBar() {
  if (!selectedCommander.value) return null;

  const doom = getDoomLevel();
  const seasonColor = doom >= 75 ? 'var(--color-danger)' : doom >= 50 ? 'var(--color-gold-secondary)' : 'var(--color-text-secondary)';

  return (
    <div class="resource-bar" style={BAR_STYLE}>
      <ResourceCounter type="gold" />
      <ResourceCounter type="faith" />
      <ResourceCounter type="influence" />
      <ResourceCounter type="momentum" />
      <div
        title={`Season ${globalSeason.value} of ${MAX_SEASONS} — Doom ${doom}%`}
        aria-label={`Season ${globalSeason.value} of ${MAX_SEASONS}, doom level ${doom}%`}
        style={{ marginLeft: '12px', paddingLeft: '12px', borderLeft: '1px solid var(--color-border-subtle)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '3px' }}
      >
        <span style={{ fontSize: 'var(--font-size-sm)', color: seasonColor, fontWeight: doom >= 50 ? '700' : '400', transition: `color var(--duration-slow) var(--ease-default)`, lineHeight: '1' }}>
          S{globalSeason.value}/{MAX_SEASONS}
        </span>
        {/* Doom bar — 3px strip below the season text */}
        <div style={{
          width: '36px', height: '3px',
          background: 'rgba(60, 50, 70, 0.6)',
          borderRadius: 'var(--radius-sm)', overflow: 'hidden',
        }}>
          <div style={{
            width: `${doom}%`,
            height: '100%',
            background: doom >= 75 ? 'var(--color-danger)' : doom >= 50 ? 'var(--color-gold-secondary)' : 'rgba(160, 140, 100, 0.5)',
            borderRadius: 'var(--radius-sm)',
            transition: `width 0.4s var(--ease-default), background var(--duration-slow) var(--ease-default)`,
          }} />
        </div>
      </div>
    </div>
  );
}
