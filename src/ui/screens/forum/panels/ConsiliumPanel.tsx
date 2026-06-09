import { councilSlots } from '../../../../game/council/council-store';
import type { Advisor } from '../../../../game/council/advisor';
import { FACTION_COLORS } from '../../../../game/core/commander';
import { BentoCard } from '../../../components/BentoCard';
import { getPriorityStyle, priorityClass } from '../../../components/card-priority';
import { SectionHeader, LinkButton } from '../components/SectionHeader';
import { setForumTab } from '../state';

/** Static slot labels — flavor, not state. */
const SLOT_LABELS = ['Consiliarius', 'Legatus', 'Augur'];

interface ConsiliumPanelProps {
  accent?: string;
  index?: number;
}

export function ConsiliumPanel({ accent = '#d4a843', index = 0 }: ConsiliumPanelProps) {
  const slots = councilSlots.value;
  const emptySeats = slots.filter((advisor) => advisor === null).length;

  return (
    <BentoCard accent={accent} index={index} priority={emptySeats > 0 ? 'urgent' : 'actionable'}>
      <SectionHeader
        title="Consilium"
        accent={accent}
        right={<LinkButton label="Open →" onClick={() => setForumTab('consilium')} accent={accent} />}
      />
      <div style={{ display: 'flex', gap: 8 }}>
        {slots.map((advisor, i) => (
          <AdvisorSlot key={i} advisor={advisor} label={SLOT_LABELS[i] ?? `Slot ${i + 1}`} accent={accent} />
        ))}
      </div>
    </BentoCard>
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
      class={priorityClass(advisor ? 'actionable' : 'urgent')}
      onClick={() => setForumTab('consilium')}
      style={{
        flex: 1, aspectRatio: '2/3',
        position: 'relative',
        cursor: 'pointer',
        background: advisor ? placeholderBg : 'rgba(30, 26, 45, 0.35)',
        border: advisor
          ? `1px solid ${color ?? 'rgba(212, 168, 67, 0.15)'}`
          : '1px dashed rgba(212, 168, 67, 0.15)',
        borderRadius: 2,
        overflow: 'hidden',
        transition: 'all 200ms',
        ...getPriorityStyle(advisor ? 'actionable' : 'urgent', color ?? accent),
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
            objectFit: 'cover', objectPosition: 'center 18%',
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
        fontSize: 'var(--imp-text-xs)', fontWeight: 600,
        letterSpacing: 'var(--imp-meta-letter)',
        color: advisor ? 'var(--imp-text-hi)' : 'var(--imp-text-mid)',
        textAlign: 'center', textTransform: 'uppercase',
      }}>
        {advisor?.name ?? label}
      </div>
    </div>
  );
}
