import { useSignal } from '@preact/signals';
import { OrnateFrame } from '../../components/OrnateFrame';
import { playSfx } from '../../sound/sfx';
import { pendingDoctrineDraft, chooseDraftDoctrine } from '../../../game/items/doctrine-store';
import { FACTION_COLORS } from '../../../game/core/commander';
import type { Doctrine } from '../../../game/items/doctrine';

/**
 * Victory draft: after a won Iter Belli campaign the Senate offers up to 3
 * unowned doctrines — the player picks exactly one into the collection.
 * Rendered by ForumShell whenever a draft is pending; blocks the Forum
 * until a choice is made (the draft persists across save/load).
 */
export function DoctrineDraftModal() {
  const draft = pendingDoctrineDraft.value;
  const hovered = useSignal<string | null>(null);
  if (!draft || draft.length === 0) return null;

  const pick = (d: Doctrine) => {
    playSfx('ui_click');
    chooseDraftDoctrine(d.id);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 90,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(10, 8, 16, 0.78)', backdropFilter: 'blur(3px)',
    }}>
      <OrnateFrame width="min(760px, 94vw)" padding="hero" style={{ textAlign: 'center' }}>
        <div style={{
          fontFamily: 'var(--imp-font-display)', fontSize: 'var(--imp-text-xs)',
          letterSpacing: 4, textTransform: 'uppercase', color: 'var(--imp-text-mid)',
        }}>
          Senatus Populusque Romanus
        </div>
        <h2 style={{
          fontFamily: 'var(--imp-font-display)', color: 'var(--imp-gold-hi)',
          margin: '6px 0 4px', fontSize: 'var(--imp-text-xl)', letterSpacing: 1,
        }}>
          El Senado premia tu triunfo
        </h2>
        <p style={{
          fontFamily: 'var(--imp-font-serif)', fontStyle: 'italic',
          color: 'var(--imp-text-mid)', margin: '0 0 18px', fontSize: 'var(--imp-text-sm)',
        }}>
          Elige una nueva doctrina para tu colección.
        </p>

        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
          {draft.map((d) => {
            const color = FACTION_COLORS[d.color] ?? 'var(--imp-gold)';
            const isHover = hovered.value === d.id;
            return (
              <button
                key={d.id}
                onClick={() => pick(d)}
                onMouseEnter={() => { hovered.value = d.id; }}
                onMouseLeave={() => { hovered.value = null; }}
                style={{
                  width: 200, padding: '16px 14px', cursor: 'pointer',
                  textAlign: 'left',
                  background: isHover ? 'rgba(212, 168, 67, 0.10)' : 'rgba(255, 255, 255, 0.03)',
                  border: `1px solid ${isHover ? 'var(--imp-gold)' : 'rgba(212, 168, 67, 0.25)'}`,
                  borderTop: `3px solid ${color}`,
                  borderRadius: 8,
                  transform: isHover ? 'translateY(-3px)' : 'none',
                  transition: 'transform .12s ease, border-color .12s ease, background .12s ease',
                  color: 'var(--imp-text)',
                }}
              >
                <div style={{
                  fontFamily: 'var(--imp-font-display)', fontSize: 'var(--imp-text-md)',
                  color: 'var(--imp-gold-hi)', marginBottom: 2,
                }}>
                  {d.name}
                </div>
                <div style={{
                  fontSize: 'var(--imp-text-xs)', textTransform: 'uppercase',
                  letterSpacing: 2, color, marginBottom: 8,
                }}>
                  {d.color} · Nivel I
                </div>
                <div style={{
                  fontFamily: 'var(--imp-font-serif)', fontSize: 'var(--imp-text-sm)',
                  color: 'var(--imp-text-mid)', lineHeight: 1.45,
                }}>
                  {d.levels[0].description}
                </div>
              </button>
            );
          })}
        </div>
      </OrnateFrame>
    </div>
  );
}
