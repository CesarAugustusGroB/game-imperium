import { councilSlots, plannedSpoke } from '../../../../game/council/council-store';
import type { Advisor } from '../../../../game/council/advisor';
import { FACTION_COLORS } from '../../../../game/core/commander';
import { OrnatePanel } from '../../../components/OrnatePanel';
import { SectionHeader, LinkButton, NODE_ICONS } from '../components/SectionHeader';
import { setForumTab } from '../state';

/** Static slot labels — flavor, not state. */
const SLOT_LABELS = ['Consiliarius', 'Legatus', 'Augur'];

interface ConsiliumPanelProps {
  accent?: string;
}

export function ConsiliumPanel({ accent = '#d4a843' }: ConsiliumPanelProps) {
  const slots = councilSlots.value;
  const spoke = plannedSpoke.value;

  return (
    <OrnatePanel accent={accent}>
      <SectionHeader
        title="Consilium"
        accent={accent}
        right={<LinkButton label="Open →" onClick={() => setForumTab('consilium')} accent={accent} />}
      />
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        {slots.map((advisor, i) => (
          <AdvisorSlot key={i} advisor={advisor} label={SLOT_LABELS[i] ?? `Slot ${i + 1}`} accent={accent} />
        ))}
      </div>
      {spoke && (
        <div style={{
          padding: '10px 12px',
          background: 'rgba(15, 13, 22, 0.6)',
          border: '1px solid rgba(212, 168, 67, 0.15)',
          borderRadius: 2,
        }}>
          <div style={{
            fontSize: 9, letterSpacing: 1.5,
            color: 'var(--imp-text-lo)',
            textTransform: 'uppercase', marginBottom: 6,
          }}>
            Auspice — {spoke.posture}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            {spoke.nodes.map((n, i) => {
              const icon = NODE_ICONS[n.type];
              return (
                <>
                  <div
                    key={n.id}
                    title={icon?.label ?? n.type}
                    style={{
                      width: 22, height: 22, borderRadius: '50%',
                      background: `${icon?.color ?? accent}22`,
                      border: `1.5px solid ${icon?.color ?? accent}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, color: icon?.color ?? accent,
                      opacity: n.resolved ? 0.4 : 1,
                    }}
                  >
                    {icon?.icon ?? '•'}
                  </div>
                  {i < spoke.nodes.length - 1 && (
                    <div style={{
                      flex: 1, height: 1,
                      background: 'rgba(212, 168, 67, 0.15)',
                    }} />
                  )}
                </>
              );
            })}
          </div>
        </div>
      )}
    </OrnatePanel>
  );
}

interface AdvisorSlotProps {
  advisor: Advisor | null;
  label: string;
  accent: string;
}

function AdvisorSlot({ advisor, label, accent }: AdvisorSlotProps) {
  const color = advisor ? FACTION_COLORS[advisor.color] : 'rgba(212, 168, 67, 0.15)';
  const tierRoman = advisor ? (['I', 'II', 'III'][advisor.currentTier - 1] ?? '·') : null;

  return (
    <div
      onClick={() => setForumTab('consilium')}
      style={{
        flex: 1, aspectRatio: '3/4',
        position: 'relative',
        cursor: 'pointer',
        background: advisor ? 'rgba(30, 26, 45, 0.7)' : 'rgba(30, 26, 45, 0.35)',
        border: advisor ? `1px solid ${color}` : `1px dashed rgba(212, 168, 67, 0.15)`,
        borderRadius: 2,
        overflow: 'hidden',
        transition: 'all 200ms',
      }}
    >
      {!advisor && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--imp-text-lo)', fontSize: 22,
        }}>
          ⚔
        </div>
      )}
      {advisor && tierRoman && (
        <div style={{
          position: 'absolute', top: 4, right: 4,
          width: 18, height: 18, borderRadius: '50%',
          background: 'var(--imp-ink)',
          border: `1px solid ${accent}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--imp-font-display)',
          fontSize: 9, color: accent, fontWeight: 700,
        }}>
          {tierRoman}
        </div>
      )}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: 'linear-gradient(180deg, transparent 0%, rgba(0, 0, 0, 0.85) 60%)',
        padding: '16px 6px 4px',
        fontFamily: 'var(--imp-font-display)',
        fontSize: 9, fontWeight: 600,
        letterSpacing: 0.5,
        color: 'var(--imp-text-hi)',
        textAlign: 'center', textTransform: 'uppercase',
      }}>
        {advisor?.name ?? label}
      </div>
    </div>
  );
}
