import { useRef, useEffect } from 'preact/hooks';
import type { Signal } from '@preact/signals';
import { gold, faith, influence, momentum } from '../game/resources';
import { selectedCommander, globalSeason, MAX_SEASONS, getDoomLevel } from '../game/game-state';
import { FACTION_PRIMARY_RESOURCE, RESOURCE_INFO } from '../game/commander';
import type { ResourceType } from '../game/commander';

const BAR_STYLE: Record<string, string> = {
  position: 'fixed', top: '0', left: '0', width: '100%', height: '38px',
  background: 'rgba(12, 10, 24, 0.92)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  borderBottom: '1px solid rgba(180, 160, 100, 0.2)',
  boxShadow: '0 2px 12px rgba(0, 0, 0, 0.4)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '24px',
  fontFamily: "'Segoe UI', system-ui, sans-serif", fontSize: '13px',
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

  // Flash on value change
  useEffect(() => {
    const el = ref.current;
    if (!el || sig.value === prevValue.current) return;
    const gained = sig.value > prevValue.current;
    el.style.color = gained ? '#6c6' : '#c66';
    el.style.transform = 'scale(1.2)';
    prevValue.current = sig.value;
    const timer = setTimeout(() => {
      el.style.color = isPrimary ? info.color : 'rgba(200, 190, 160, 0.7)';
      el.style.transform = 'scale(1)';
    }, 400);
    return () => clearTimeout(timer);
  }, [sig.value]);

  return (
    <div
      title={info.label ?? type}
      aria-label={`${info.label ?? type}: ${sig.value}`}
      style={{
        display: 'flex', alignItems: 'center', gap: '4px',
        opacity: isPrimary ? 1 : 0.7,
      }}
    >
      <span style={{ fontSize: '14px' }}>{info.icon}</span>
      <span
        ref={ref}
        style={{
          color: isPrimary ? info.color : 'rgba(200, 190, 160, 0.7)',
          fontWeight: isPrimary ? '700' : '400',
          transition: 'color 0.3s, transform 0.2s',
          textShadow: isPrimary ? `0 0 8px ${info.color}40` : 'none',
        }}
      >
        {sig.value}
      </span>
    </div>
  );
}

export function ResourceBar() {
  if (!selectedCommander.value) return null;

  const doom = getDoomLevel();
  const seasonColor = doom >= 75 ? '#c24a3a' : doom >= 50 ? '#d4a843' : 'rgba(200, 190, 160, 0.5)';

  return (
    <div style={BAR_STYLE}>
      <ResourceCounter type="gold" />
      <ResourceCounter type="faith" />
      <ResourceCounter type="influence" />
      <ResourceCounter type="momentum" />
      <div
        title={`Season ${globalSeason.value} of ${MAX_SEASONS} — Doom ${doom}%`}
        aria-label={`Season ${globalSeason.value} of ${MAX_SEASONS}, doom level ${doom}%`}
        style={{ marginLeft: '12px', paddingLeft: '12px', borderLeft: '1px solid rgba(180, 160, 100, 0.15)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '3px' }}
      >
        <span style={{ fontSize: '11px', color: seasonColor, fontWeight: doom >= 50 ? '700' : '400', transition: 'color 0.3s', lineHeight: '1' }}>
          S{globalSeason.value}/{MAX_SEASONS}
        </span>
        {/* Doom bar — 3px strip below the season text */}
        <div style={{
          width: '36px', height: '3px',
          background: 'rgba(60, 50, 70, 0.6)',
          borderRadius: '2px', overflow: 'hidden',
        }}>
          <div style={{
            width: `${doom}%`,
            height: '100%',
            background: doom >= 75 ? '#c24a3a' : doom >= 50 ? '#d4a843' : 'rgba(160, 140, 100, 0.5)',
            borderRadius: '2px',
            transition: 'width 0.4s ease-out, background 0.3s',
          }} />
        </div>
      </div>
    </div>
  );
}
