import { useSignal } from '@preact/signals';
import {
  advisorMarket,
  councilSlots,
  hireAndSeatAdvisor,
  unseatAdvisor,
} from '../../../../game/council/council-store';
import {
  type Advisor,
  type AdvisorPassive,
  type AdvisorTrait,
  getCurrentPassive,
  getCurrentTier,
  XP_TIER_2,
  XP_TIER_3,
} from '../../../../game/council/advisor';
import { FACTION_COLORS } from '../../../../game/core/commander';
import { gold } from '../../../../game/core/resources';
import { OrnatePanel } from '../../../components/OrnatePanel';
import { LaurelWreath } from '../../../components/motifs/LaurelWreath';
import { Masthead } from '../Masthead';
import { SectionHeader } from '../components/SectionHeader';
import {
  BonusCard,
  CeremonialTrack,
  getTraitVisual,
  SPQREmblem,
  TraitChip,
  TraitGlyph,
} from '../components/consilium';

/** Static slot-position labels - flavor, not state. */
const SLOT_LABELS = ['Consiliarius', 'Legatus', 'Augur'];
const ROMAN: readonly string[] = ['I', 'II', 'III'];
const CONSILIUM_ACCENT = '#d4a843';

type AdvisorSource = 'seat' | 'market';
type MarketView = 'market' | 'available';
type MarketFilter = 'all' | 'diplomatic' | 'economic' | 'intrigue' | 'military';
type MarketSort = 'cost' | 'name' | 'tier';

interface AdvisorSelection {
  advisor: Advisor;
  source: AdvisorSource;
  slotIndex: number | null;
}

if (typeof document !== 'undefined' && !document.getElementById('consilium-3col-styles')) {
  const el = document.createElement('style');
  el.id = 'consilium-3col-styles';
  el.textContent = `
    .consilium-command-grid {
      flex: 1 1 auto;
      min-height: 0;
      overflow: hidden;
      padding: 20px 32px 24px;
      display: grid;
      grid-template-columns: minmax(210px, 240px) minmax(360px, 1fr) minmax(210px, 240px);
      gap: 14px;
    }
    .consilium-scroll {
      min-height: 0;
      overflow-y: auto;
      overflow-x: hidden;
    }
    .consilium-selectable {
      transition: border-color var(--duration-fast) var(--ease-default), background var(--duration-fast) var(--ease-default), transform var(--duration-fast) var(--ease-default);
    }
    .consilium-selectable:hover {
      transform: translateY(-1px);
      border-color: var(--imp-gold);
      background: rgba(80, 60, 20, 0.25);
    }
    .consilium-danger-btn:focus-visible,
    .consilium-selectable:focus-visible {
      outline: 1px solid var(--imp-gold-hi);
      outline-offset: 2px;
    }
    .consilium-danger-btn:hover:not(:disabled) {
      border-color: var(--imp-danger);
      background: rgba(194, 74, 58, 0.12);
    }
    .consilium-danger-btn:active:not(:disabled),
    .consilium-selectable:active,
    .consilium-filter-chip:active {
      transform: translateY(0);
    }
    .consilium-filter-chip {
      transition: border-color var(--duration-fast) var(--ease-default), background var(--duration-fast) var(--ease-default), color var(--duration-fast) var(--ease-default);
    }
    .consilium-filter-chip:hover {
      border-color: var(--imp-gold);
      color: var(--imp-text-hi);
      background: rgba(80, 60, 20, 0.22);
    }
    .consilium-filter-chip:focus-visible {
      outline: 1px solid var(--imp-gold-hi);
      outline-offset: 2px;
    }
    @media (max-width: 1180px) {
      .consilium-command-grid {
        grid-template-columns: minmax(190px, 220px) minmax(340px, 1fr);
      }
      .consilium-reserve-column {
        display: none;
      }
    }
    @media (max-width: 860px) {
      .consilium-command-grid {
        grid-template-columns: 1fr;
        overflow-y: auto;
      }
      .consilium-scroll {
        overflow: visible;
      }
    }
  `;
  document.head.appendChild(el);
}

export function ConsiliumTab() {
  const selectedId = useSignal<string | null>(null);
  const marketView = useSignal<MarketView>('market');
  const marketFilter = useSignal<MarketFilter>('all');
  const marketSort = useSignal<MarketSort>('cost');
  const slots = councilSlots.value;
  const market = advisorMarket.value;
  const currentGold = gold.value;
  const seatedCount = slots.filter((s) => s !== null).length;

  const seatedSelections: AdvisorSelection[] = slots.flatMap((advisor, index) => (
    advisor ? [{ advisor, source: 'seat', slotIndex: index }] : []
  ));
  const marketSelections: AdvisorSelection[] = market.map((advisor) => ({
    advisor,
    source: 'market',
    slotIndex: null,
  }));
  const allAdvisors = [...seatedSelections, ...marketSelections];

  const currentSelection = selectedId.value
    ? allAdvisors.find((item) => item.advisor.id === selectedId.value) ?? null
    : allAdvisors[0] ?? null;

  const subtitle = `${seatedCount} of ${slots.length} seated · ${market.length} market offers`;

  function selectAdvisor(advisor: Advisor) {
    selectedId.value = advisor.id;
  }

  function dismissAdvisor(slotIndex: number) {
    unseatAdvisor(slotIndex);
    selectedId.value = null;
  }

  function hireFromMarket(advisor: Advisor) {
    const slotIndex = slots.findIndex((slot) => slot === null);
    if (slotIndex === -1) return;

    const hired = hireAndSeatAdvisor(advisor, slotIndex);
    if (hired) selectedId.value = advisor.id;
  }

  const filteredMarket = sortMarket(
    market.filter((advisor) => marketFilter.value === 'all' || getAdvisorSchool(advisor) === marketFilter.value),
    marketSort.value,
  );

  return (
    <>
      <Masthead title="Consilium" subtitle={subtitle} accent={CONSILIUM_ACCENT} />

      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div class="consilium-command-grid">
          <aside class="consilium-scroll" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <SeatsPanel
              slots={slots}
              selectedId={currentSelection?.advisor.id ?? null}
              onSelect={selectAdvisor}
            />
          </aside>

          <OrnatePanel
            accent={CONSILIUM_ACCENT}
            padding="0"
            style={{
              minHeight: 0,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {currentSelection ? (
              <AdvisorHero
                selection={currentSelection}
                onDismiss={dismissAdvisor}
              />
            ) : (
              <EmptyHero />
            )}
          </OrnatePanel>

          <aside class="consilium-reserve-column consilium-scroll">
            <ReservedColumn slots={slots} />
          </aside>
        </div>

        <PoliticalMarketPanel
          market={filteredMarket}
          availableMarket={market}
          totalOffers={market.length}
          currentGold={currentGold}
          emptySlotIndex={slots.findIndex((slot) => slot === null)}
          selectedId={currentSelection?.advisor.id ?? null}
          view={marketView.value}
          filter={marketFilter.value}
          sort={marketSort.value}
          onViewChange={(view) => { marketView.value = view; }}
          onFilterChange={(filter) => { marketFilter.value = filter; }}
          onSortChange={(sort) => { marketSort.value = sort; }}
          onSelect={selectAdvisor}
          onHire={hireFromMarket}
        />
      </div>
    </>
  );
}

interface SeatsPanelProps {
  slots: (Advisor | null)[];
  selectedId: string | null;
  onSelect: (advisor: Advisor) => void;
}

function SeatsPanel({ slots, selectedId, onSelect }: SeatsPanelProps) {
  return (
    <OrnatePanel accent={CONSILIUM_ACCENT}>
      <SectionHeader title="The Three Seats" accent={CONSILIUM_ACCENT} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {slots.map((advisor, index) => (
          <SeatRow
            key={`seat-${index}`}
            advisor={advisor}
            label={SLOT_LABELS[index] ?? `Slot ${index + 1}`}
            selected={advisor?.id === selectedId}
            onSelect={onSelect}
          />
        ))}
      </div>
    </OrnatePanel>
  );
}

interface SeatRowProps {
  advisor: Advisor | null;
  label: string;
  selected: boolean;
  onSelect: (advisor: Advisor) => void;
}

function SeatRow({ advisor, label, selected, onSelect }: SeatRowProps) {
  if (!advisor) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        padding: '9px 10px',
        border: '1px dashed var(--imp-gold-faint)',
        borderRadius: 2,
        background: 'rgba(13, 11, 20, 0.36)',
      }}>
        <div style={emptySealStyle}>+</div>
        <div style={{ minWidth: 0 }}>
          <div style={smallCapsStyle}>{label}</div>
          <div style={mutedItalicStyle}>Empty seat</div>
        </div>
      </div>
    );
  }

  const color = FACTION_COLORS[advisor.color];

  return (
    <button
      type="button"
      class="consilium-selectable"
      onClick={() => onSelect(advisor)}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        padding: '9px 10px',
        border: `1px solid ${selected ? CONSILIUM_ACCENT : 'var(--imp-gold-faint)'}`,
        borderLeft: `3px solid ${color}`,
        borderRadius: 2,
        background: selected ? 'rgba(80, 60, 20, 0.25)' : 'rgba(13, 11, 20, 0.46)',
        color: 'inherit',
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      <MiniPortrait advisor={advisor} size={42} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={rowNameStyle}>{advisor.name}</div>
        <div style={mutedItalicStyle}>{label}</div>
      </div>
      <TierBadge tier={advisor.currentTier} />
    </button>
  );
}

interface AdvisorHeroProps {
  selection: AdvisorSelection;
  onDismiss: (slotIndex: number) => void;
}

function AdvisorHero({ selection, onDismiss }: AdvisorHeroProps) {
  const { advisor, source, slotIndex } = selection;
  const color = FACTION_COLORS[advisor.color];
  const currentTierData = getCurrentTier(advisor);
  const nextTierThreshold =
    advisor.currentTier === 1 ? XP_TIER_2 :
    advisor.currentTier === 2 ? XP_TIER_3 :
    null;
  const role = source === 'seat'
    ? SLOT_LABELS[slotIndex ?? 0] ?? 'Seated Advisor'
    : 'Political Candidate';

  return (
    <div style={{
      flex: 1,
      minHeight: 0,
      display: 'grid',
      gridTemplateRows: 'minmax(300px, 1fr) auto',
      background: `
        radial-gradient(circle at 50% 8%, ${color}24 0%, transparent 42%),
        linear-gradient(140deg, rgba(240, 208, 128, 0.08) 0%, transparent 22%),
        linear-gradient(180deg, rgba(34, 30, 48, 0.96) 0%, rgba(13, 11, 20, 0.98) 100%)
      `,
    }}>
      <div style={{
        position: 'relative',
        minHeight: 0,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'stretch',
        justifyContent: 'center',
      }}>
        <SPQREmblem
          size={180}
          color={CONSILIUM_ACCENT}
          opacity={0.1}
          style={{ position: 'absolute', top: 28, right: 28 }}
        />
        {advisor.portrait ? (
          <img
            src={advisor.portrait}
            alt={advisor.name}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center 18%',
              filter: 'saturate(0.9) contrast(1.06)',
            }}
          />
        ) : (
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color,
            fontFamily: 'var(--imp-font-display)',
            fontSize: 'clamp(120px, 18vw, 240px)',
            fontWeight: 600,
            opacity: 0.68,
            textShadow: '0 8px 28px rgba(0, 0, 0, 0.7)',
          }}>
            {advisor.name.charAt(0).toUpperCase()}
          </div>
        )}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: `
            linear-gradient(90deg, rgba(13, 11, 20, 0.94) 0%, transparent 24%, transparent 72%, rgba(13, 11, 20, 0.88) 100%),
            linear-gradient(180deg, transparent 34%, rgba(13, 11, 20, 0.98) 100%)
          `,
        }} />
        <div style={{
          position: 'absolute',
          left: 22,
          right: 22,
          bottom: 18,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 16,
        }}>
          <div style={{ minWidth: 0 }}>
            <div style={{
              color: 'var(--imp-text-lo)',
              fontFamily: 'var(--imp-font-body)',
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: 2.4,
              textTransform: 'uppercase',
            }}>
              Tier {ROMAN[advisor.currentTier - 1] ?? 'I'} · {role}
            </div>
            <div style={{
              marginTop: 4,
              color: 'var(--imp-text-hi)',
              fontFamily: 'var(--imp-font-display)',
              fontSize: 'clamp(28px, 4vw, 48px)',
              fontWeight: 600,
              letterSpacing: 2,
              lineHeight: 0.96,
              textTransform: 'uppercase',
              textShadow: '0 4px 18px rgba(0, 0, 0, 0.7)',
            }}>
              {advisor.name}
            </div>
            <div style={{
              marginTop: 7,
              color: 'var(--imp-text-mid)',
              fontFamily: 'var(--imp-font-serif)',
              fontSize: 16,
              fontStyle: 'italic',
              lineHeight: 1.25,
            }}>
              {heroLine(currentTierData.passive, source)}
            </div>
          </div>
          <div style={{
            flex: '0 0 auto',
            color: CONSILIUM_ACCENT,
            fontFamily: 'var(--imp-font-mono)',
            fontSize: 18,
            fontWeight: 900,
            padding: '7px 10px',
            border: '1px solid var(--imp-gold-dim)',
            background: 'rgba(13, 11, 20, 0.72)',
          }}>
            {source === 'market' ? `${advisor.cost}g` : 'SEATED'}
          </div>
        </div>
      </div>

      <div style={{
        padding: '18px 22px 20px',
        borderTop: '1px solid var(--imp-gold-faint)',
        background: 'rgba(13, 11, 20, 0.72)',
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 14 }}>
          {advisor.traits.map((trait) => (
            <TraitChip key={trait} trait={trait} />
          ))}
        </div>

        <CeremonialTrack
          currentTier={advisor.currentTier}
          xp={advisor.xp}
          nextTierThreshold={nextTierThreshold}
          accent={CONSILIUM_ACCENT}
          factionColor={color}
          style={{ marginBottom: 14 }}
        />

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) auto',
          gap: 12,
          alignItems: 'end',
        }}>
          <div style={{
            padding: '10px 12px',
            border: '1px solid var(--imp-gold-faint)',
            borderRadius: 2,
            background: 'rgba(20, 18, 32, 0.62)',
            color: 'var(--imp-text)',
            fontFamily: 'var(--imp-font-serif)',
            fontSize: 13,
            fontStyle: 'italic',
            lineHeight: 1.35,
          }}>
            {describePassive(currentTierData.passive)}
          </div>

          {source === 'seat' && slotIndex !== null && (
            <button
              type="button"
              class="consilium-danger-btn"
              onClick={() => onDismiss(slotIndex)}
              style={{
                padding: '8px 12px',
                border: '1px solid var(--imp-gold-dim)',
                borderRadius: 2,
                background: 'transparent',
                color: 'var(--imp-danger)',
                cursor: 'pointer',
                fontFamily: 'var(--imp-font-body)',
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: 1.4,
                textTransform: 'uppercase',
              }}
            >
              Dismiss
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyHero() {
  return (
    <div style={{
      flex: 1,
      minHeight: 420,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--imp-text-mid)',
      background: 'radial-gradient(circle at 50% 26%, rgba(212, 168, 67, 0.12) 0%, transparent 38%)',
      textAlign: 'center',
      padding: 44,
    }}>
      <LaurelWreath size={128} color={CONSILIUM_ACCENT} opacity={0.28} />
      <div style={{
        marginTop: 16,
        color: 'var(--imp-text-hi)',
        fontFamily: 'var(--imp-font-display)',
        fontSize: 20,
        letterSpacing: 2.4,
        textTransform: 'uppercase',
      }}>
        No advisor selected
      </div>
      <div style={{
        marginTop: 6,
        maxWidth: 360,
        fontFamily: 'var(--imp-font-serif)',
        fontStyle: 'italic',
        lineHeight: 1.4,
      }}>
        Select a seated councilor or political market offer to review their mandate.
      </div>
    </div>
  );
}

function ReservedColumn({ slots }: { slots: (Advisor | null)[] }) {
  const seatedAdvisors = slots.filter((advisor): advisor is Advisor => advisor !== null);

  return (
    <OrnatePanel accent={CONSILIUM_ACCENT} style={{ minHeight: '100%' }}>
      <SectionHeader title="Seated Bonuses" accent={CONSILIUM_ACCENT} />
      <div style={{
        minHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}>
        {seatedAdvisors.length === 0 ? (
          <div style={{
            flex: 1,
            minHeight: 220,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            color: 'var(--imp-text-mid)',
            padding: '18px 8px 10px',
          }}>
            <LaurelWreath size={94} color={CONSILIUM_ACCENT} opacity={0.24} />
            <div style={{
              marginTop: 12,
              color: 'var(--imp-text-hi)',
              fontFamily: 'var(--imp-font-display)',
              fontSize: 15,
              letterSpacing: 2,
              textTransform: 'uppercase',
            }}>
              No seated bonuses
            </div>
            <div style={{
              marginTop: 5,
              maxWidth: 180,
              fontFamily: 'var(--imp-font-serif)',
              fontSize: 12,
              fontStyle: 'italic',
              lineHeight: 1.35,
              color: 'var(--imp-text-lo)',
            }}>
              Seat a councilor to surface the passive gains shaping your next campaign.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {seatedAdvisors.map((advisor) => {
              const visual = getPrimaryTraitVisual(advisor);
              const passive = getCurrentPassive(advisor);
              const passiveText = describePassive(passive);
              const bonusCopy = splitPassiveDescription(passive, passiveText);

              return (
                <BonusCard
                  key={advisor.id}
                  icon={visual.glyph}
                  value={bonusCopy.value}
                  label={bonusCopy.label}
                  accent={visual.color}
                />
              );
            })}
          </div>
        )}

        <div style={{
          marginTop: 'auto',
          display: 'flex',
          justifyContent: 'center',
          paddingTop: seatedAdvisors.length === 0 ? 4 : 12,
        }}>
          <SPQREmblem
            size={130}
            color={CONSILIUM_ACCENT}
            opacity={0.1}
          />
        </div>
      </div>
    </OrnatePanel>
  );
}

interface PoliticalMarketPanelProps {
  market: Advisor[];
  availableMarket: Advisor[];
  totalOffers: number;
  currentGold: number;
  emptySlotIndex: number;
  selectedId: string | null;
  view: MarketView;
  filter: MarketFilter;
  sort: MarketSort;
  onViewChange: (view: MarketView) => void;
  onFilterChange: (filter: MarketFilter) => void;
  onSortChange: (sort: MarketSort) => void;
  onSelect: (advisor: Advisor) => void;
  onHire: (advisor: Advisor) => void;
}

function PoliticalMarketPanel({
  market,
  availableMarket,
  totalOffers,
  currentGold,
  emptySlotIndex,
  selectedId,
  view,
  filter,
  sort,
  onViewChange,
  onFilterChange,
  onSortChange,
  onSelect,
  onHire,
}: PoliticalMarketPanelProps) {
  return (
    <div style={{ flex: '0 0 auto', padding: '0 32px 24px' }}>
      <OrnatePanel accent={CONSILIUM_ACCENT} padding="14px 16px">
        <SectionHeader
          title="Political Market"
          accent={CONSILIUM_ACCENT}
          right={<span style={countPillStyle}>{totalOffers} offers · {currentGold}g</span>}
        />

        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 12,
        }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {MARKET_VIEWS.map((item) => (
              <button
                key={item.value}
                type="button"
                class="consilium-filter-chip"
                onClick={() => onViewChange(item.value)}
                style={chipButtonStyle(view === item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>

          {view === 'market' && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {MARKET_FILTERS.map((item) => (
              <button
                key={item.value}
                type="button"
                class="consilium-filter-chip"
                onClick={() => onFilterChange(item.value)}
                style={chipButtonStyle(filter === item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>
          )}

          {view === 'market' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{
              color: 'var(--imp-text-lo)',
              fontFamily: 'var(--imp-font-body)',
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: 1.2,
              textTransform: 'uppercase',
            }}>
              Sort
            </span>
            {MARKET_SORTS.map((item) => (
              <button
                key={item.value}
                type="button"
                class="consilium-filter-chip"
                onClick={() => onSortChange(item.value)}
                style={chipButtonStyle(sort === item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>
          )}
        </div>

        {view === 'available' ? (
          <AvailableAdvisorList
            market={availableMarket}
            selectedId={selectedId}
            onSelect={onSelect}
          />
        ) : market.length === 0 ? (
          <div style={{
            minHeight: 118,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px dashed var(--imp-gold-faint)',
            background: 'rgba(13, 11, 20, 0.44)',
            color: 'var(--imp-text-lo)',
            fontFamily: 'var(--imp-font-serif)',
            fontSize: 13,
            fontStyle: 'italic',
          }}>
            No political offers match this school.
          </div>
        ) : (
          <MarketAdvisorList
            market={market}
            selectedId={selectedId}
            currentGold={currentGold}
            emptySlotIndex={emptySlotIndex}
            onSelect={onSelect}
            onHire={onHire}
          />
        )}
      </OrnatePanel>
    </div>
  );
}

interface MarketAdvisorListProps {
  market: Advisor[];
  selectedId: string | null;
  currentGold: number;
  emptySlotIndex: number;
  onSelect: (advisor: Advisor) => void;
  onHire: (advisor: Advisor) => void;
}

function MarketAdvisorList({
  market,
  selectedId,
  currentGold,
  emptySlotIndex,
  onSelect,
  onHire,
}: MarketAdvisorListProps) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
      gap: 8,
    }}>
      {market.map((advisor) => {
        const reason = getHireBlockReason(advisor, currentGold, emptySlotIndex);
        return (
          <AdvisorMarketRow
            key={advisor.id}
            advisor={advisor}
            selected={advisor.id === selectedId}
            actionLabel={reason ?? 'Hire & Seat'}
            disabled={reason !== null}
            unavailableReason={reason ?? undefined}
            onSelect={onSelect}
            onHire={onHire}
          />
        );
      })}
    </div>
  );
}

interface AvailableAdvisorListProps {
  market: Advisor[];
  selectedId: string | null;
  onSelect: (advisor: Advisor) => void;
}

function AvailableAdvisorList({ market, selectedId, onSelect }: AvailableAdvisorListProps) {
  if (market.length === 0) {
    return (
      <div style={{
        minHeight: 118,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1px dashed var(--imp-gold-faint)',
        background: 'rgba(13, 11, 20, 0.44)',
        color: 'var(--imp-text-lo)',
        fontFamily: 'var(--imp-font-serif)',
        fontSize: 13,
        fontStyle: 'italic',
      }}>
        The political market is quiet.
      </div>
    );
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
      gap: 8,
    }}>
      {market.map((advisor) => (
        <AdvisorMarketRow
          key={advisor.id}
          advisor={advisor}
          selected={advisor.id === selectedId}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

interface AdvisorMarketRowProps {
  advisor: Advisor;
  selected: boolean;
  actionLabel?: string;
  disabled?: boolean;
  unavailableReason?: string;
  onSelect: (advisor: Advisor) => void;
  onHire?: (advisor: Advisor) => void;
}

function AdvisorMarketRow({
  advisor,
  selected,
  actionLabel,
  disabled = false,
  unavailableReason,
  onSelect,
  onHire,
}: AdvisorMarketRowProps) {
  function handleHire(event: MouseEvent) {
    event.stopPropagation();
    if (!disabled) onHire?.(advisor);
  }

  function handleRowKeyDown(event: KeyboardEvent) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onSelect(advisor);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      class="consilium-selectable"
      onClick={() => onSelect(advisor)}
      onKeyDown={handleRowKeyDown}
      style={{
        width: '100%',
        minHeight: 64,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 10px',
        border: `1px solid ${selected ? CONSILIUM_ACCENT : 'var(--imp-gold-faint)'}`,
        borderRadius: 2,
        background: selected ? 'rgba(80, 60, 20, 0.25)' : 'rgba(13, 11, 20, 0.46)',
        color: 'inherit',
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      <MiniPortrait advisor={advisor} size={38} />
      <div style={{ flex: '1 1 auto', minWidth: 0 }}>
        <div style={rowNameStyle}>{advisor.name}</div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          marginTop: 4,
          minWidth: 0,
        }}>
          {advisor.traits.slice(0, 3).map((trait) => (
            <TraitGlyph key={trait} trait={trait} size={17} />
          ))}
        </div>
      </div>
      <div style={{
        color: CONSILIUM_ACCENT,
        fontFamily: 'var(--imp-font-mono)',
        fontSize: 11,
        fontWeight: 800,
        whiteSpace: 'nowrap',
      }}>
        {advisor.cost}g
      </div>
      {actionLabel && (
        <button
          type="button"
          disabled={disabled}
          title={disabled ? unavailableReason : actionLabel}
          onClick={handleHire}
          style={{
            flex: '0 0 auto',
            maxWidth: 104,
            padding: '7px 10px',
            borderRadius: 2,
            border: disabled ? '1px solid var(--imp-gold-faint)' : 'none',
            background: disabled
              ? 'rgba(80, 70, 50, 0.26)'
              : `linear-gradient(180deg, ${CONSILIUM_ACCENT} 0%, var(--imp-gold-mid) 100%)`,
            color: disabled ? 'var(--imp-text-lo)' : 'var(--imp-ink)',
            cursor: disabled ? 'not-allowed' : 'pointer',
            fontFamily: 'var(--imp-font-display)',
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: 1.1,
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            textAlign: 'center',
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

function MiniPortrait({ advisor, size }: { advisor: Advisor; size: number }) {
  const color = FACTION_COLORS[advisor.color];
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: '50%',
      overflow: 'hidden',
      border: `1px solid ${color}`,
      background: `radial-gradient(circle, ${color}44 0%, var(--imp-panel) 100%)`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flex: '0 0 auto',
      color,
      fontFamily: 'var(--imp-font-display)',
      fontSize: Math.round(size * 0.42),
      fontWeight: 800,
    }}>
      {advisor.portrait ? (
        <img
          src={advisor.portrait}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 20%' }}
        />
      ) : (
        advisor.name.charAt(0).toUpperCase()
      )}
    </div>
  );
}

function TierBadge({ tier }: { tier: Advisor['currentTier'] }) {
  return (
    <div style={{
      width: 24,
      height: 24,
      borderRadius: '50%',
      border: `1px solid ${CONSILIUM_ACCENT}`,
      color: CONSILIUM_ACCENT,
      background: 'rgba(13, 11, 20, 0.82)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flex: '0 0 auto',
      fontFamily: 'var(--imp-font-display)',
      fontSize: 10,
      fontWeight: 800,
    }}>
      {ROMAN[tier - 1] ?? 'I'}
    </div>
  );
}

function describePassive(p: AdvisorPassive): string {
  switch (p.type) {
    case 'resource-per-spoke': return `+${p.amount} ${p.resource} each spoke.`;
    case 'upkeep-reduction': return `${p.percent}% off upkeep costs.`;
    case 'shop-discount': return `${p.percent}% shop discount.`;
    case 'extra-event-choices': return `+${p.count} extra event choice(s).`;
    case 'heal-between-nodes': return `Restore ${p.amount} HP between nodes.`;
    case 'threat-reduction': return `Enemy threat reduced by ${p.amount}.`;
    case 'loot-bonus': return `+${p.percent}% loot from battles.`;
  }
}

function splitPassiveDescription(
  passive: AdvisorPassive,
  description: string,
): { value: string; label: string } {
  switch (passive.type) {
    case 'resource-per-spoke':
      return { value: `+${passive.amount}`, label: `${capitalizeResource(passive.resource)} Each Spoke` };
    case 'upkeep-reduction':
      return { value: `${passive.percent}%`, label: 'Upkeep Relief' };
    case 'shop-discount':
      return { value: `${passive.percent}%`, label: 'Market Discount' };
    case 'extra-event-choices':
      return { value: `+${passive.count}`, label: 'Event Choices' };
    case 'heal-between-nodes':
      return { value: `${passive.amount} HP`, label: 'Field Recovery' };
    case 'threat-reduction':
      return { value: `-${passive.amount}`, label: 'Enemy Threat' };
    case 'loot-bonus':
      return { value: `+${passive.percent}%`, label: 'Battle Loot' };
    default: {
      const [value = description, ...rest] = description.split(' ');
      return { value, label: rest.join(' ').replace(/\.$/, '') || 'Passive Bonus' };
    }
  }
}

function capitalizeResource(resource: string): string {
  return resource.charAt(0).toUpperCase() + resource.slice(1);
}

function heroLine(p: AdvisorPassive, source: AdvisorSource): string {
  const prefix = source === 'market'
    ? 'A power broker awaits invitation:'
    : 'A seated voice shapes the next campaign:';
  return `${prefix} ${describePassive(p)}`;
}

function getHireBlockReason(advisor: Advisor, currentGold: number, emptySlotIndex: number): string | null {
  if (emptySlotIndex === -1) return 'All seats filled';
  if (currentGold < advisor.cost) return `Need ${advisor.cost - currentGold} gold`;
  return null;
}

function getAdvisorSchool(advisor: Advisor): MarketFilter {
  if (hasAnyTrait(advisor.traits, ['Strategist', 'Veteran', 'Zealot'])) return 'military';
  if (hasAnyTrait(advisor.traits, ['Schemer', 'Mastermind'])) return 'intrigue';
  if (hasAnyTrait(advisor.traits, ['Coin-Keeper', 'Financier', 'Logistician'])) return 'economic';
  return 'diplomatic';
}

function hasAnyTrait(traits: AdvisorTrait[], matches: AdvisorTrait[]): boolean {
  return traits.some((trait) => matches.includes(trait));
}

function getPrimaryTraitVisual(advisor: Advisor) {
  return getTraitVisual(advisor.traits[0] ?? 'Administrator');
}

function sortMarket(market: Advisor[], sort: MarketSort): Advisor[] {
  const sorted = market.slice();
  sorted.sort((a, b) => {
    if (sort === 'name') return a.name.localeCompare(b.name);
    if (sort === 'tier') return b.currentTier - a.currentTier || a.cost - b.cost || a.name.localeCompare(b.name);
    return a.cost - b.cost || a.name.localeCompare(b.name);
  });
  return sorted;
}

function chipButtonStyle(active: boolean): preact.JSX.CSSProperties {
  return {
    padding: '5px 9px',
    border: `1px solid ${active ? CONSILIUM_ACCENT : 'var(--imp-gold-faint)'}`,
    borderRadius: 999,
    background: active ? 'rgba(80, 60, 20, 0.34)' : 'rgba(13, 11, 20, 0.52)',
    color: active ? 'var(--imp-text-hi)' : 'var(--imp-text-mid)',
    cursor: 'pointer',
    fontFamily: 'var(--imp-font-body)',
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: 1,
    textTransform: 'uppercase',
  };
}

const MARKET_FILTERS: Array<{ value: MarketFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'diplomatic', label: 'Diplomatic' },
  { value: 'economic', label: 'Economic' },
  { value: 'intrigue', label: 'Intrigue' },
  { value: 'military', label: 'Military' },
];

const MARKET_SORTS: Array<{ value: MarketSort; label: string }> = [
  { value: 'cost', label: 'Cost' },
  { value: 'name', label: 'Name' },
  { value: 'tier', label: 'Tier' },
];

const MARKET_VIEWS: Array<{ value: MarketView; label: string }> = [
  { value: 'market', label: 'Political Market' },
  { value: 'available', label: 'Available Advisors' },
];

const smallCapsStyle: preact.JSX.CSSProperties = {
  color: 'var(--imp-text-mid)',
  fontFamily: 'var(--imp-font-display)',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 1.8,
  textTransform: 'uppercase',
};

const rowNameStyle: preact.JSX.CSSProperties = {
  color: 'var(--imp-text-hi)',
  fontFamily: 'var(--imp-font-display)',
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: 1,
  textTransform: 'uppercase',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const mutedItalicStyle: preact.JSX.CSSProperties = {
  color: 'var(--imp-text-lo)',
  fontFamily: 'var(--imp-font-serif)',
  fontSize: 10,
  fontStyle: 'italic',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const emptySealStyle: preact.JSX.CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: '50%',
  border: '1px dashed var(--imp-gold-faint)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--imp-text-lo)',
  fontSize: 18,
  flex: '0 0 auto',
};

const countPillStyle: preact.JSX.CSSProperties = {
  color: 'var(--imp-text-lo)',
  fontFamily: 'var(--imp-font-mono)',
  fontSize: 9,
  fontWeight: 800,
  letterSpacing: 1,
  textTransform: 'uppercase',
};
