import { equippedDoctrines } from '../../../../game/items/doctrine-store';
import { FACTION_COLORS } from '../../../../game/core/commander';
import { BentoCard } from '../../../components/BentoCard';
import { SectionHeader, LinkButton } from '../components/SectionHeader';
import { setForumTab } from '../state';

interface DoctrinaePanelProps {
  accent?: string;
  index?: number;
}

export function DoctrinaePanel({ accent = '#d4a843', index = 0 }: DoctrinaePanelProps) {
  const slots = equippedDoctrines.value;

  return (
    <BentoCard accent={accent} index={index}>
      <SectionHeader
        title="Doctrinae"
        accent={accent}
        right={<LinkButton label="Open →" onClick={() => setForumTab('doctrinae')} accent={accent} />}
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        {slots.map((d, i) => {
          if (!d) {
            return (
              <div key={i} style={{
                aspectRatio: '3/2',
                background: 'rgba(20, 18, 32, 0.3)',
                border: '1px dashed rgba(212, 168, 67, 0.15)',
                borderRadius: 2, padding: '8px 10px',
                position: 'relative',
              }}>
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--imp-text-lo)', fontSize: 18,
                }}>
                  +
                </div>
              </div>
            );
          }
          const color = FACTION_COLORS[d.color];
          const level = d.currentLevel;
          const romanLevel = (['I', 'II', 'III'][level - 1]) ?? '·';
          const currentTierData = d.levels[level - 1];
          const desc = currentTierData?.description ?? '';

          return (
            <div key={d.id} style={{
              aspectRatio: '3/2',
              background: `linear-gradient(135deg, ${color}22 0%, rgba(20, 18, 32, 0.9) 100%)`,
              border: `1px solid ${color}66`,
              borderRadius: 2,
              padding: '8px 10px',
              position: 'relative',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{
                  fontFamily: 'var(--imp-font-display)',
                  fontSize: 10, fontWeight: 600,
                  color: 'var(--imp-text-hi)',
                  letterSpacing: 1, textTransform: 'uppercase',
                  lineHeight: 1.2,
                }}>
                  {d.name}
                </div>
                <div style={{
                  fontFamily: 'var(--imp-font-display)',
                  fontSize: 10,
                  color,
                  fontWeight: 700,
                }}>
                  {romanLevel}
                </div>
              </div>
              <div style={{
                fontSize: 9,
                color: 'var(--imp-text-mid)',
                fontStyle: 'italic',
                marginTop: 4,
                lineHeight: 1.3,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}>
                {desc}
              </div>
            </div>
          );
        })}
      </div>
    </BentoCard>
  );
}
