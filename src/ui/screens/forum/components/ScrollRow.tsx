import { useState } from 'preact/hooks';
import type { Decretum } from '../../../../game/items/decretum';
import type { Commander } from '../../../../game/core/commander';
import { FACTION_COLORS } from '../../../../game/core/commander';
import { isDecretumCastable } from '../../../../game/items/decretum';
import { getPriorityStyle, priorityClass } from '../../../components/card-priority';

interface ScrollRowProps {
  s: Decretum;
  commander: Commander | null;
}

/**
 * Decretum scroll row — used in the Forum Overview summary and the full
 * Decreta tab. Informational only; cast actions still live in the battle UI.
 */
export function ScrollRow({ s, commander }: ScrollRowProps) {
  const [hover, setHover] = useState(false);
  const color = FACTION_COLORS[s.color];
  const castable = commander ? isDecretumCastable(s, commander.faction) : false;
  const costGlyph = s.castCost ? Object.values(s.castCost)[0] ?? 0 : 0;

  return (
    <div
      class={priorityClass(castable ? 'actionable' : 'disabled')}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: '8px 10px',
        background: hover ? 'rgba(40, 36, 60, 0.7)' : 'rgba(20, 18, 32, 0.4)',
        border: `1px solid ${hover ? color : 'rgba(212, 168, 67, 0.15)'}`,
        borderLeft: `3px solid ${color}`,
        borderRadius: 2,
        opacity: castable ? 1 : 0.45,
        transition: 'all 150ms',
        ...getPriorityStyle(castable ? 'actionable' : 'disabled', color),
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
          border: `1px solid ${color}`, background: `${color}20`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--imp-font-display)',
          fontSize: 10, fontWeight: 700, color,
        }}>
          {costGlyph}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: 'var(--imp-font-serif)',
            fontSize: 12,
            color: 'var(--imp-text-hi)',
            fontStyle: 'italic',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {s.name}
          </div>
          {hover ? (
            <div style={{ fontSize: 'var(--imp-text-xs)', color: 'var(--imp-text-mid)', marginTop: 2 }}>
              {s.description}
            </div>
          ) : (
            <div style={{
              fontSize: 'var(--imp-text-xs)', color: 'var(--imp-text-mid)',
              letterSpacing: 'var(--imp-meta-letter)', textTransform: 'uppercase', marginTop: 1,
            }}>
              {s.rarity}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
