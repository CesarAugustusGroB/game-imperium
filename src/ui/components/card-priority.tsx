import type { ComponentChildren, JSX } from 'preact';

export type CardPriority = 'critical' | 'urgent' | 'actionable' | 'selected' | 'neutral' | 'disabled';

interface PriorityTone {
  color: string;
  bg: string;
  glow: string;
  border: string;
  opacity: number;
}

const PRIORITY_TONES: Record<CardPriority, PriorityTone> = {
  critical: {
    color: 'var(--imp-crimson)',
    bg: 'rgba(125, 20, 20, 0.22)',
    glow: 'rgba(194, 74, 58, 0.32)',
    border: 'rgba(194, 74, 58, 0.72)',
    opacity: 1,
  },
  urgent: {
    color: '#d48b3a',
    bg: 'rgba(212, 139, 58, 0.16)',
    glow: 'rgba(212, 139, 58, 0.26)',
    border: 'rgba(212, 139, 58, 0.62)',
    opacity: 1,
  },
  actionable: {
    color: 'var(--imp-gold)',
    bg: 'rgba(212, 168, 67, 0.13)',
    glow: 'rgba(212, 168, 67, 0.24)',
    border: 'rgba(212, 168, 67, 0.58)',
    opacity: 1,
  },
  selected: {
    color: 'var(--imp-gold-hi)',
    bg: 'rgba(240, 208, 128, 0.16)',
    glow: 'rgba(240, 208, 128, 0.30)',
    border: 'rgba(240, 208, 128, 0.74)',
    opacity: 1,
  },
  neutral: {
    color: 'var(--imp-panel-accent, var(--imp-gold))',
    bg: 'rgba(212, 168, 67, 0.04)',
    glow: 'rgba(0, 0, 0, 0)',
    border: 'rgba(212, 168, 67, 0.24)',
    opacity: 1,
  },
  disabled: {
    color: 'var(--imp-text-mid)',
    bg: 'rgba(80, 70, 50, 0.08)',
    glow: 'rgba(0, 0, 0, 0)',
    border: 'rgba(180, 170, 150, 0.18)',
    opacity: 0.62,
  },
};

const PRIORITY_LABELS: Record<CardPriority, string> = {
  critical: 'Critical',
  urgent: 'Urgent',
  actionable: 'Ready',
  selected: 'Selected',
  neutral: 'Status',
  disabled: 'Blocked',
};

export function priorityClass(priority: CardPriority): string {
  return `imp-card-priority imp-card-priority-${priority}`;
}

export function getPriorityStyle(priority: CardPriority, accent?: string): JSX.CSSProperties {
  const tone = PRIORITY_TONES[priority];
  const color = priority === 'actionable' || priority === 'selected' || priority === 'neutral'
    ? (accent ?? tone.color)
    : tone.color;

  return {
    '--imp-card-priority-color': color,
    '--imp-card-priority-bg': tone.bg,
    '--imp-card-priority-glow': tone.glow,
    '--imp-card-priority-border': tone.border,
    '--imp-card-priority-opacity': tone.opacity,
  } as JSX.CSSProperties;
}

export function PriorityBadge({
  priority,
  label,
  accent,
  style,
}: {
  priority: CardPriority;
  label?: ComponentChildren;
  accent?: string;
  style?: JSX.CSSProperties;
}) {
  return (
    <span
      class={`imp-priority-badge imp-priority-badge-${priority}`}
      style={{
        ...getPriorityStyle(priority, accent),
        ...style,
      }}
    >
      {label ?? PRIORITY_LABELS[priority]}
    </span>
  );
}
