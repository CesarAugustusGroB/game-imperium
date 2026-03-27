import { useRef, useEffect } from 'preact/hooks';
import type { Signal } from '@preact/signals';
import { gold, faith, influence, momentum } from '../game/resources';
import { selectedCommander } from '../game/game-state';
import { FACTION_PRIMARY_RESOURCE, RESOURCE_INFO } from '../game/commander';
import type { ResourceType } from '../game/commander';

const BAR_STYLE: Record<string, string> = {
  position: 'fixed', top: '0', left: '0', width: '100%', height: '38px',
  background: 'rgba(8, 8, 18, 0.85)',
  borderBottom: '1px solid rgba(180, 160, 100, 0.15)',
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

  return (
    <div style={BAR_STYLE}>
      <ResourceCounter type="gold" />
      <ResourceCounter type="faith" />
      <ResourceCounter type="influence" />
      <ResourceCounter type="momentum" />
    </div>
  );
}
