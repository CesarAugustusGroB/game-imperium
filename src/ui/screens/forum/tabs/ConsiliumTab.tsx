import { useSignal } from '@preact/signals';
import {
  councilSlots, advisorPool,
  seatAdvisor, unseatAdvisor,
} from '../../../../game/council/council-store';
import {
  type Advisor, type AdvisorPassive,
  getCurrentTier, getXpToNextTier, XP_TIER_2, XP_TIER_3,
} from '../../../../game/council/advisor';
import { FACTION_COLORS } from '../../../../game/core/commander';
import { OrnatePanel } from '../../../components/OrnatePanel';
import { LaurelWreath } from '../../../components/motifs/LaurelWreath';
import { Masthead } from '../Masthead';
import { SectionHeader } from '../components/SectionHeader';

/** Static slot-position labels — flavor, not state. */
const SLOT_LABELS = ['Consiliarius', 'Legatus', 'Augur'];
const ROMAN: readonly string[] = ['I', 'II', 'III'];

export function ConsiliumTab() {
  const selectedId = useSignal<string | null>(null);
  const slots = councilSlots.value;
  const pool = advisorPool.value;
  const seatedCount = slots.filter((s) => s !== null).length;
  const accent = '#d4a843';

  // Resolve currently-selected advisor (may be seated or in pool)
  const allAdvisors: Array<{ advisor: Advisor; slotIndex: number | null }> = [
    ...slots.map((a, i) => (a ? { advisor: a, slotIndex: i } : null)),
    ...pool.map((a) => ({ advisor: a, slotIndex: null })),
  ].filter((x): x is { advisor: Advisor; slotIndex: number | null } => x !== null);

  // Default selection: first seated advisor, else first pool advisor
  const currentSelection = selectedId.value
    ? allAdvisors.find((x) => x.advisor.id === selectedId.value) ?? null
    : allAdvisors[0] ?? null;

  const subtitle = `${seatedCount} of ${slots.length} seated · ${pool.length} in the pool`;

  function handleOfferSeat(advisor: Advisor) {
    const emptyIdx = slots.findIndex((s) => s === null);
    if (emptyIdx === -1) return;
    seatAdvisor(emptyIdx, advisor);
    selectedId.value = advisor.id;
  }

  function handleDismiss(slotIndex: number) {
    unseatAdvisor(slotIndex);
  }

  return (
    <>
      <Masthead title="Consilium" subtitle={subtitle} accent={accent} />

      <div style={{
        flex: 1, minHeight: 0, overflow: 'hidden',
        padding: '20px 32px 24px',
        display: 'grid', gridTemplateColumns: '340px 1fr', gap: 14,
      }}>

        {/* ── LEFT: seats + pool ── */}
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 12,
          minHeight: 0, overflow: 'auto',
        }}>
          <OrnatePanel accent={accent}>
            <SectionHeader title="The Three Seats" accent={accent} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {slots.map((advisor, i) => (
                <AdvisorRow
                  key={`seat-${i}`}
                  advisor={advisor}
                  role={SLOT_LABELS[i] ?? `Slot ${i + 1}`}
                  accent={accent}
                  selected={advisor?.id === currentSelection?.advisor.id}
                  onClick={() => { if (advisor) selectedId.value = advisor.id; }}
                  seated
                />
              ))}
            </div>
          </OrnatePanel>

          <OrnatePanel accent={accent}>
            <SectionHeader
              title="Advisor Pool"
              accent={accent}
              right={<span style={{
                fontSize: 9, color: 'var(--imp-text-lo)',
                letterSpacing: 1, textTransform: 'uppercase',
              }}>
                {pool.length} available
              </span>}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {pool.length === 0 && (
                <div style={{
                  padding: '10px 4px',
                  fontFamily: 'var(--imp-font-serif)',
                  fontStyle: 'italic', fontSize: 11,
                  color: 'var(--imp-text-lo)',
                }}>
                  The pool is empty.
                </div>
              )}
              {pool.map((advisor) => (
                <AdvisorRow
                  key={advisor.id}
                  advisor={advisor}
                  role={null}
                  accent={accent}
                  selected={advisor.id === currentSelection?.advisor.id}
                  onClick={() => { selectedId.value = advisor.id; }}
                  seated={false}
                />
              ))}
            </div>
          </OrnatePanel>
        </div>

        {/* ── RIGHT: detail ── */}
        <OrnatePanel
          accent={accent}
          style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'auto' }}
        >
          {currentSelection ? (
            <AdvisorDetail
              advisor={currentSelection.advisor}
              slotIndex={currentSelection.slotIndex}
              anyEmptySeat={slots.some((s) => s === null)}
              onOfferSeat={() => handleOfferSeat(currentSelection.advisor)}
              onDismiss={() => {
                if (currentSelection.slotIndex !== null) {
                  handleDismiss(currentSelection.slotIndex);
                }
              }}
              accent={accent}
            />
          ) : (
            <EmptyDetail accent={accent} />
          )}
        </OrnatePanel>
      </div>
    </>
  );
}

// ── AdvisorRow ───────────────────────────────────────────────────

interface AdvisorRowProps {
  advisor: Advisor | null;
  role: string | null;
  accent: string;
  selected: boolean;
  onClick: () => void;
  seated: boolean;
}

function AdvisorRow({ advisor, role, accent, selected, onClick, seated }: AdvisorRowProps) {
  if (!advisor) {
    // Empty seat placeholder
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 12px',
        background: 'rgba(20, 18, 32, 0.3)',
        border: '1px dashed rgba(212, 168, 67, 0.15)',
        borderRadius: 2,
      }}>
        <div style={{
          width: 42, height: 42, borderRadius: '50%',
          border: '1px dashed rgba(212, 168, 67, 0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--imp-text-lo)', fontSize: 18,
        }}>
          +
        </div>
        <div style={{ flex: 1 }}>
          <div style={{
            fontFamily: 'var(--imp-font-display)',
            fontSize: 11, color: 'var(--imp-text-mid)',
            letterSpacing: 2, textTransform: 'uppercase',
          }}>
            {role}
          </div>
          <div style={{ fontSize: 10, color: 'var(--imp-text-lo)', fontStyle: 'italic' }}>
            Empty seat
          </div>
        </div>
      </div>
    );
  }

  const color = FACTION_COLORS[advisor.color];
  const initial = advisor.name.charAt(0).toUpperCase();

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 12px',
        background: selected
          ? 'rgba(80, 60, 20, 0.25)'
          : 'rgba(20, 18, 32, 0.4)',
        border: `1px solid ${selected ? accent : 'rgba(212, 168, 67, 0.15)'}`,
        borderLeft: `3px solid ${color}`,
        borderRadius: 2, cursor: 'pointer',
        transition: 'all 150ms',
      }}
    >
      <div style={{
        width: 42, height: 42, borderRadius: '50%',
        background: `radial-gradient(circle, ${color}44 0%, var(--imp-panel) 100%)`,
        border: `1px solid ${color}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
        fontFamily: 'var(--imp-font-display)',
        fontSize: 16, fontWeight: 700, color,
      }}>
        {initial}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: 'var(--imp-font-display)',
          fontSize: 12, color: 'var(--imp-text-hi)',
          letterSpacing: 1, textTransform: 'uppercase', fontWeight: 600,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {advisor.name}
        </div>
        <div style={{ fontSize: 10, color: 'var(--imp-text-lo)', fontStyle: 'italic' }}>
          {seated ? role ?? 'Seated' : 'Free agent'}
        </div>
      </div>
      <div style={{
        fontFamily: 'var(--imp-font-display)',
        fontSize: 10, color: accent,
        border: `1px solid ${accent}`,
        borderRadius: 2, padding: '2px 6px',
      }}>
        {ROMAN[advisor.currentTier - 1] ?? '—'}
      </div>
    </div>
  );
}

// ── AdvisorDetail ────────────────────────────────────────────────

interface AdvisorDetailProps {
  advisor: Advisor;
  slotIndex: number | null;
  anyEmptySeat: boolean;
  onOfferSeat: () => void;
  onDismiss: () => void;
  accent: string;
}

function AdvisorDetail({ advisor, slotIndex, anyEmptySeat, onOfferSeat, onDismiss, accent }: AdvisorDetailProps) {
  const isSeated = slotIndex !== null;
  const color = FACTION_COLORS[advisor.color];
  const currentTierData = getCurrentTier(advisor);
  const nextTierThreshold =
    advisor.currentTier === 1 ? XP_TIER_2 :
    advisor.currentTier === 2 ? XP_TIER_3 :
    null;
  const xpToNext = getXpToNextTier(advisor);
  const xpPct = nextTierThreshold ? Math.min(100, (advisor.xp / nextTierThreshold) * 100) : 100;
  const initial = advisor.name.charAt(0).toUpperCase();

  return (
    <>
      <div style={{ display: 'flex', gap: 18, marginBottom: 18 }}>
        {/* Portrait placeholder (circle with initial on a faction-tint radial) */}
        <div style={{
          width: 140, aspectRatio: '3/4',
          border: `1.5px solid ${color}`,
          borderRadius: 2,
          position: 'relative',
          flexShrink: 0,
          overflow: 'hidden',
          background: `radial-gradient(ellipse at center top, ${color}44 0%, rgba(13, 11, 20, 0.95) 65%)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            fontFamily: 'var(--imp-font-display)',
            fontSize: 68, fontWeight: 500,
            color, opacity: 0.6,
          }}>
            {initial}
          </div>
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(180deg, transparent 50%, rgba(0, 0, 0, 0.85) 100%)',
          }} />
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            padding: '24px 8px 6px',
            fontFamily: 'var(--imp-font-display)',
            fontSize: 10, color: 'var(--imp-text-hi)',
            textAlign: 'center', textTransform: 'uppercase',
            letterSpacing: 1, fontWeight: 600,
          }}>
            {isSeated ? SLOT_LABELS[slotIndex] ?? 'Seated' : 'Free Agent'}
          </div>
        </div>

        {/* Name + meta + actions */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 9, letterSpacing: 2.5,
            color: 'var(--imp-text-lo)',
            textTransform: 'uppercase', marginBottom: 4,
          }}>
            Tier {ROMAN[advisor.currentTier - 1] ?? '—'} · {isSeated ? 'Seated' : 'Available'}
          </div>
          <div style={{
            fontFamily: 'var(--imp-font-display)',
            fontSize: 26, fontWeight: 500,
            color: 'var(--imp-text-hi)',
            letterSpacing: 2, textTransform: 'uppercase',
            lineHeight: 1.1, marginBottom: 6,
          }}>
            {advisor.name}
          </div>
          <div style={{
            fontFamily: 'var(--imp-font-serif)',
            fontStyle: 'italic', fontSize: 13,
            color: 'var(--imp-text-mid)',
            lineHeight: 1.5, marginBottom: 14,
          }}>
            {currentTierData.description}
          </div>

          {/* XP bar — only if not max tier */}
          {nextTierThreshold !== null && xpToNext !== null && (
            <div style={{ marginBottom: 14 }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                fontSize: 9, color: 'var(--imp-text-lo)',
                letterSpacing: 1.5, textTransform: 'uppercase',
                marginBottom: 4,
              }}>
                <span>XP to Tier {ROMAN[advisor.currentTier] ?? ''}</span>
                <span style={{ fontFamily: 'var(--imp-font-mono)', color: 'var(--imp-text)' }}>
                  {advisor.xp} / {nextTierThreshold}
                </span>
              </div>
              <div style={{
                height: 4, background: 'rgba(0, 0, 0, 0.5)',
                borderRadius: 2, overflow: 'hidden',
              }}>
                <div style={{
                  width: `${xpPct}%`, height: '100%',
                  background: `linear-gradient(90deg, ${color} 0%, ${accent} 100%)`,
                  boxShadow: `0 0 6px ${accent}60`,
                }} />
              </div>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8 }}>
            {isSeated ? (
              <button
                onClick={onDismiss}
                style={btnOutline(accent, '#c24a3a')}
              >
                Dismiss
              </button>
            ) : (
              <button
                onClick={onOfferSeat}
                disabled={!anyEmptySeat}
                style={btnPrimary(accent, !anyEmptySeat)}
              >
                {anyEmptySeat ? 'Offer a Seat' : 'All seats filled'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Seated bonuses summary (reads real advisor data, no mocks) */}
      <div style={{
        borderTop: '1px solid rgba(212, 168, 67, 0.15)',
        paddingTop: 14,
      }}>
        <div style={{
          fontFamily: 'var(--imp-font-display)',
          fontSize: 11, fontWeight: 600,
          letterSpacing: 2.5,
          color: accent,
          textTransform: 'uppercase', marginBottom: 10,
        }}>
          Passive bonus
        </div>
        <div style={{
          padding: '10px 12px',
          background: 'rgba(20, 18, 32, 0.6)',
          border: '1px solid rgba(212, 168, 67, 0.15)',
          borderRadius: 2,
          fontFamily: 'var(--imp-font-serif)',
          fontStyle: 'italic', fontSize: 12,
          color: 'var(--imp-text)',
        }}>
          {describePassive(currentTierData.passive)}
        </div>
      </div>
    </>
  );
}

function EmptyDetail({ accent }: { accent: string }) {
  return (
    <div style={{
      textAlign: 'center', padding: 60,
      color: 'var(--imp-text-mid)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
    }}>
      <LaurelWreath size={100} color={accent} opacity={0.3} />
      <div style={{
        fontFamily: 'var(--imp-font-display)',
        fontSize: 16, color: 'var(--imp-text-hi)',
        letterSpacing: 2, textTransform: 'uppercase',
        marginTop: 14, marginBottom: 4,
      }}>
        No advisors
      </div>
      <div style={{ fontFamily: 'var(--imp-font-serif)', fontStyle: 'italic' }}>
        The pool will repopulate as you progress.
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────

function describePassive(p: AdvisorPassive): string {
  switch (p.type) {
    case 'resource-per-spoke':  return `+${p.amount} ${p.resource} each spoke.`;
    case 'upkeep-reduction':    return `${p.percent}% off upkeep costs.`;
    case 'shop-discount':       return `${p.percent}% shop discount.`;
    case 'extra-event-choices': return `+${p.count} extra event choice(s).`;
    case 'heal-between-nodes':  return `Restore ${p.amount} HP between nodes.`;
    case 'threat-reduction':    return `Enemy threat reduced by ${p.amount}.`;
    case 'loot-bonus':          return `+${p.percent}% loot from battles.`;
  }
}

function btnPrimary(accent: string, disabled: boolean): preact.JSX.CSSProperties {
  return {
    padding: '8px 16px',
    background: disabled
      ? 'rgba(80, 70, 50, 0.4)'
      : `linear-gradient(180deg, ${accent} 0%, #b8892a 100%)`,
    border: 'none', borderRadius: 2,
    color: disabled ? 'var(--imp-text-lo)' : 'var(--imp-ink)',
    fontSize: 11, fontWeight: 700,
    letterSpacing: 2, textTransform: 'uppercase',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'var(--imp-font-display)',
  };
}

function btnOutline(accent: string, color: string): preact.JSX.CSSProperties {
  return {
    padding: '6px 12px',
    background: 'transparent',
    border: `1px solid ${accent}55`,
    borderRadius: 2,
    color,
    fontSize: 10,
    letterSpacing: 1.5, textTransform: 'uppercase',
    cursor: 'pointer',
    fontFamily: 'var(--imp-font-body)',
    fontWeight: 600,
  };
}
