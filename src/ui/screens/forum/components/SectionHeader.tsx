import type { ComponentChildren } from 'preact';
import { GameIcon } from '../../../components/GameIcon';
import type { GameIconName } from '../../../components/GameIcon';

interface SectionHeaderProps {
  title: string;
  right?: ComponentChildren;
  accent?: string;
}

export function SectionHeader({ title, right, accent = '#d4a843' }: SectionHeaderProps) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      marginBottom: 12,
    }}>
      <div style={{
        fontFamily: 'var(--imp-font-display)',
        fontSize: 14, fontWeight: 600,
        letterSpacing: 2.5,
        color: accent,
        textTransform: 'uppercase',
      }}>
        {title}
      </div>
      {right}
    </div>
  );
}

export interface LinkButtonProps {
  label: string;
  onClick: () => void;
  accent?: string;
}

export function LinkButton({ label, onClick, accent = '#d4a843' }: LinkButtonProps) {
  const hasArrow = /(->|→|â†’)\s*$/.test(label);
  const text = label.replace(/\s*(->|→|â†’)\s*$/, '');
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 9,
        letterSpacing: 1.5,
        color: accent,
        textTransform: 'uppercase',
        background: 'transparent',
        border: `1px solid ${accent}`,
        borderRadius: 2,
        padding: '3px 8px',
        cursor: 'pointer',
        fontFamily: 'var(--imp-font-body)',
        fontWeight: 600,
      }}
    >
      {text}
      {hasArrow && <GameIcon name="arrow-right" size={10} />}
    </button>
  );
}

export const NODE_ICONS: Record<string, { icon: string; iconName: GameIconName; color: string; label: string }> = {
  battle: { icon: '⚔', iconName: 'node-battle', color: '#c25040', label: 'Battle' },
  event:  { icon: '⚑', iconName: 'node-event', color: '#d4a843', label: 'Event' },
  rest:   { icon: '⚕', iconName: 'node-rest', color: '#5a8a7a', label: 'Rest' },
  boss:   { icon: '✠', iconName: 'node-boss', color: '#7a2432', label: 'Boss' },
};

export const ROLE_COLORS: Record<string, string> = {
  vanguard: '#b23a3a',
  reserve: '#d4a843',
  guard: '#5a7aa0',
};
