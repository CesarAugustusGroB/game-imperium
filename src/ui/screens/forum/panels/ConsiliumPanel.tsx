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

interface AdvisorWithPortrait extends Advisor {
  portrait?: string;
}

function AdvisorSlot({ advisor, label, accent }: AdvisorSlotProps) {
  const color = advisor ? FACTION_COLORS[advisor.color] : null;
  const tierRoman = advisor ? (['I', 'II', 'III'][advisor.currentTier - 1] ?? '·') : null;
  // Advisor doesn't currently carry a portrait field, but we read it defensively
  // so the day one is added the card renders it automatically — no code change
  // needed in this slot.
  const portrait = (advisor as AdvisorWithPortrait | null)?.portrait ?? null;

  // Porphyry-tinted placeholder used when a seat IS filled but the advisor
  // has no portrait asset yet. Matches the design reference card.
  const placeholderBg = `
    radial-gradient(ellipse at center, rgba(122, 36, 50, 0.32) 0%, rgba(13, 11, 20, 0.98) 75%),
    linear-gradient(180deg, rgba(40, 18, 24, 0.6) 0%, rgba(13, 11, 20, 1) 100%)
  `;

  return (
    <div
      onClick={() => setForumTab('consilium')}
      style={{
        flex: 1, aspectRatio: '3/4',
        position: 'relative',
        cursor: 'pointer',
        background: advisor ? placeholderBg : 'rgba(30, 26, 45, 0.35)',
        border: advisor
          ? `1px solid ${color ?? 'rgba(212, 168, 67, 0.15)'}`
          : '1px dashed rgba(212, 168, 67, 0.15)',
        borderRadius: 2,
        overflow: 'hidden',
        transition: 'all 200ms',
      }}
    >
      {/* Empty seat — simple + affordance, no advisor yet. */}
      {!advisor && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--imp-text-lo)', fontSize: 28, fontWeight: 300,
        }}>
          +
        </div>
      )}

      {/* Seated advisor with a portrait asset — render the image. */}
      {advisor && portrait && (
        <img
          src={portrait}
          alt={advisor.name}
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'cover', objectPosition: 'center 25%',
            filter: 'saturate(0.85) contrast(1.05)',
          }}
        />
      )}

      {/* Seated advisor without a portrait — large initial over the porphyry card. */}
      {advisor && !portrait && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--imp-font-display)',
          fontSize: 'clamp(40px, 8vw, 84px)',
          fontWeight: 500,
          color: 'rgba(178, 58, 58, 0.85)',
          lineHeight: 1,
          textShadow: '0 2px 10px rgba(0, 0, 0, 0.6)',
          paddingBottom: 24,
        }}>
          {advisor.name.charAt(0).toUpperCase()}
        </div>
      )}

      {/* Tier badge — only when seated. */}
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

      {/* Name / role caption pinned to bottom. */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: 'linear-gradient(180deg, transparent 0%, rgba(0, 0, 0, 0.85) 60%)',
        padding: '16px 6px 6px',
        fontFamily: 'var(--imp-font-display)',
        fontSize: 9, fontWeight: 600,
        letterSpacing: 2,
        color: advisor ? 'var(--imp-text-hi)' : 'var(--imp-text-lo)',
        textAlign: 'center', textTransform: 'uppercase',
      }}>
        {advisor?.name ?? label}
      </div>
    </div>
  );
}
