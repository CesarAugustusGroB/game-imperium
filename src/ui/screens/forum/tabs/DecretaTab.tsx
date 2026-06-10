import { useSignal } from '@preact/signals';
import { decretumHand, maxHandSize, sellDecretum } from '../../../../game/items/decretum-store';
import { isDecretumCastable, DECRETUM_SELL_PRICE } from '../../../../game/items/decretum';
import type { Decretum, DecretumRarity } from '../../../../game/items/decretum';
import { selectedCommander } from '../../../../game/core/game-state';
import { FACTION_COLORS } from '../../../../game/core/commander';
import type { ResourceType } from '../../../../game/core/commander';
import { playSfx } from '../../../sound/sfx';
import { castDecretumAtHub, isCastableAtHub, toHubEffect, describeHubEffect, describeExtraEffectsHub, activeDecretumEffects } from '../../../../game/items/decretum-hub';
import { BentoCard } from '../../../components/BentoCard';
import { LaurelWreath } from '../../../components/motifs/LaurelWreath';
import { Masthead } from '../Masthead';
import { SectionHeader } from '../components/SectionHeader';
import { CostInline, ResourceAmount } from '../../../components/ResourceIcon';
import { getPriorityStyle, priorityClass, type CardPriority } from '../../../components/card-priority';

// ── Card look ──
// Scrolls render as 3:4 cards, consistent with DoctrinaeTab (see wireframes.html → Decreta).
const CARD_W = 158;

const RARITY_COLORS: Record<DecretumRarity, string> = {
  common: '#8a857a',
  rare: '#4a7cc2',
  legendary: '#d4a843',
};

/** Rarity gem: ◆ + label, colored by tier. */
function RarityGem({ rarity }: { rarity: DecretumRarity }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontFamily: 'var(--imp-font-mono)', fontSize: 8.5,
      letterSpacing: 1, textTransform: 'uppercase',
      color: RARITY_COLORS[rarity],
    }}>
      <span style={{ fontSize: 10 }}>◆</span> {rarity}
    </span>
  );
}

/** First non-zero cast-cost entry, shown in the band corner. */
function castCostCorner(d: Decretum) {
  const entry = d.castCost
    ? (Object.entries(d.castCost) as [ResourceType, number][]).find(([, amt]) => amt > 0) ?? null
    : null;
  return entry
    ? <ResourceAmount type={entry[0]} amount={entry[1]} iconSize="inline" />
    : <span style={{ opacity: 0.8 }}>—</span>;
}

export function DecretaTab() {
  const selectedId = useSignal<string | null>(null);
  const hand = decretumHand.value;
  const max = maxHandSize.value;
  const commander = selectedCommander.value;
  const faction = commander?.faction ?? null;
  const accent = '#d4a843';

  // Default selection: first in hand
  const current = selectedId.value
    ? hand.find((d) => d.id === selectedId.value) ?? null
    : hand[0] ?? null;

  const subtitle = `${hand.length} of ${max} in hand`;
  const emptySockets = Math.max(0, max - hand.length);

  function handleSell(id: string) {
    sellDecretum(id);
    playSfx('ui_sell');
    if (selectedId.value === id) selectedId.value = null;
  }

  function handleCast(id: string) {
    if (castDecretumAtHub(id)) {
      playSfx('ui_equip');
      if (selectedId.value === id) selectedId.value = null;
    }
  }

  return (
    <>
      <Masthead title="Decreta" subtitle={subtitle} accent={accent} />

      <div style={{
        flex: 1, minHeight: 0, overflow: 'hidden',
        padding: '20px 32px 24px',
        display: 'grid', gridTemplateColumns: '1fr 360px', gap: 14,
      }}>

        {/* ── LEFT: Hand as scroll cards ── */}
        <BentoCard
          accent={accent}
          index={0}
          style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}
        >
          <SectionHeader
            title="Hand"
            accent={accent}
            right={<span style={{
              fontSize: 'var(--imp-text-xs)', color: 'var(--imp-text-mid)',
              letterSpacing: 'var(--imp-meta-letter)', textTransform: 'uppercase',
            }}>
              Cast at hub · or carry into battle
            </span>}
          />

          {/* Active effects: green chips with remaining seasons */}
          {activeDecretumEffects.value.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, margin: '0 0 12px' }}>
              {activeDecretumEffects.value.map((a) => (
                <span key={a.decretumId} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '3px 11px',
                  background: 'rgba(122, 168, 106, 0.12)',
                  border: '1px solid rgba(122, 168, 106, 0.45)',
                  borderRadius: 999,
                  fontFamily: 'var(--imp-font-mono)', fontSize: 'var(--imp-text-xs)',
                  color: '#8fbe7e', whiteSpace: 'nowrap',
                }}>
                  ◆ {a.name} · {describeHubEffect(a.effect)} · {a.remainingSeasons} {a.remainingSeasons === 1 ? 'temporada' : 'temporadas'}
                </span>
              ))}
            </div>
          )}

          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 12,
            overflow: 'auto', flex: 1, alignContent: 'flex-start',
            paddingRight: 4,
          }}>
            {hand.map((d) => (
              <ScrollCard
                key={d.id}
                d={d}
                colorOk={faction !== null && isDecretumCastable(d, faction)}
                hubCastable={isCastableAtHub(d, faction)}
                selected={d.id === current?.id}
                accent={accent}
                onSelect={() => { selectedId.value = d.id; }}
                onCast={() => handleCast(d.id)}
                onSell={() => handleSell(d.id)}
              />
            ))}
            {Array.from({ length: emptySockets }, (_, i) => (
              <div key={`socket-${i}`} style={{
                width: CARD_W, aspectRatio: '3/4', flex: '0 0 auto',
                border: '2px dashed rgba(212, 168, 67, 0.22)',
                borderRadius: 4,
                background: 'rgba(20, 18, 32, 0.3)',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 6,
                color: 'var(--imp-text-mid)',
              }}>
                {hand.length === 0 && i === 0 ? (
                  <LaurelWreath size={48} color={accent} opacity={0.3} />
                ) : (
                  <div style={{ fontSize: 24, opacity: 0.5 }}>＋</div>
                )}
                <div style={{
                  fontSize: 'var(--imp-text-xs)', letterSpacing: 'var(--imp-meta-letter)', textTransform: 'uppercase',
                  fontFamily: 'var(--imp-font-display)',
                }}>
                  Empty
                </div>
                {i === 0 && (
                  <div style={{
                    fontSize: 9, fontFamily: 'var(--imp-font-serif)', fontStyle: 'italic',
                    color: 'var(--imp-text-lo)', textAlign: 'center', padding: '0 10px',
                  }}>
                    Scrolls are dealt between campaigns
                  </div>
                )}
              </div>
            ))}
          </div>
        </BentoCard>

        {/* ── RIGHT: Detail ── */}
        <BentoCard
          accent={current ? FACTION_COLORS[current.color] : accent}
          index={1}
          style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'auto', position: 'relative' }}
        >
          <div style={{ position: 'absolute', top: 14, right: 14, opacity: 0.08, pointerEvents: 'none' }}>
            <LaurelWreath size={80} color={accent} opacity={1} />
          </div>

          {current ? (
            <DecretumDetail
              d={current}
              hubCastable={isCastableAtHub(current, faction)}
              accent={accent}
              onSell={() => handleSell(current.id)}
              onCast={() => handleCast(current.id)}
            />
          ) : (
            <div style={{
              textAlign: 'center', padding: 40, margin: 'auto',
              color: 'var(--imp-text-mid)',
              fontFamily: 'var(--imp-font-serif)', fontStyle: 'italic',
            }}>
              Pick a scroll to inspect.
            </div>
          )}
        </BentoCard>
      </div>
    </>
  );
}

// ── ScrollCard ───────────────────────────────────────────────────

interface ScrollCardProps {
  d: Decretum;
  /** Passes the faction color-lock (own color or white). */
  colorOk: boolean;
  /** Fully castable at the hub right now (color + hub effect + affordable). */
  hubCastable: boolean;
  selected: boolean;
  accent: string;
  onSelect: () => void;
  onCast: () => void;
  onSell: () => void;
}

function ScrollCard({ d, colorOk, hubCastable, selected, accent, onSelect, onCast, onSell }: ScrollCardProps) {
  const color = FACTION_COLORS[d.color];
  const sellPrice = DECRETUM_SELL_PRICE[d.rarity];
  const battleOnly = colorOk && toHubEffect(d) === null;
  const priority: CardPriority = selected ? 'selected' : hubCastable ? 'actionable' : colorOk ? 'neutral' : 'disabled';

  return (
    <div
      class={priorityClass(priority)}
      onClick={onSelect}
      title={!colorOk ? 'Faction color-lock — only your color or white can be cast' : d.description}
      style={{
        width: CARD_W, aspectRatio: '3/4', flex: '0 0 auto',
        background: 'rgba(20, 18, 32, 0.75)',
        border: `1px solid ${selected ? accent : `${color}44`}`,
        borderTop: `3px solid ${color}`,
        borderRadius: 4, overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        opacity: colorOk ? 1 : 0.55,
        filter: colorOk ? 'none' : 'saturate(0.4)',
        cursor: 'pointer',
        boxShadow: selected ? `0 0 0 1px ${accent}, 0 0 14px ${accent}45` : 'none',
        transition: 'all 140ms',
        ...getPriorityStyle(priority, color),
      }}
    >
      {/* School band: color + cast cost corner */}
      <div style={{
        height: 20, flexShrink: 0,
        background: color, color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 8px',
        fontFamily: 'var(--imp-font-display)', fontSize: 8.5, fontWeight: 700,
        letterSpacing: 1, textTransform: 'uppercase', whiteSpace: 'nowrap',
      }}>
        <span>{d.color}{d.color === 'white' ? ' · univ.' : ''}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 9 }}>
          {castCostCorner(d)}
        </span>
      </div>

      {/* Scroll emblem */}
      <div style={{
        flex: '0 0 30%', minHeight: 0,
        background: `radial-gradient(circle at 50% 58%, ${color}26 0%, rgba(14, 12, 24, 0.9) 78%)`,
        borderBottom: '1px solid rgba(212, 168, 67, 0.18)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 24, opacity: 0.9,
      }}>
        📜
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, padding: '8px 9px', flex: 1, minHeight: 0 }}>
        <div style={{
          fontFamily: 'var(--imp-font-display)',
          fontSize: 11.5, fontWeight: 600,
          color: 'var(--imp-text-hi)',
          letterSpacing: 'var(--imp-meta-letter)', textTransform: 'uppercase',
          lineHeight: 1.25,
        }}>
          {d.name}
        </div>
        <RarityGem rarity={d.rarity} />
        <div style={{
          fontSize: 10.5,
          color: 'var(--imp-text-mid)',
          fontStyle: 'italic',
          fontFamily: 'var(--imp-font-serif)',
          lineHeight: 1.4,
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {d.description}
        </div>
      </div>

      {/* Foot: cast state + sell */}
      <div style={{
        borderTop: '1px dashed rgba(212, 168, 67, 0.22)',
        padding: '5px 8px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 5,
      }}>
        {!colorOk ? (
          <span title="Only your color or white can be cast." style={{
            fontFamily: 'var(--imp-font-mono)', fontSize: 8.5,
            letterSpacing: 1, textTransform: 'uppercase', color: 'var(--imp-text-lo)',
            cursor: 'help',
          }}>
            🔒 color-lock
          </span>
        ) : battleOnly ? (
          <span title="No hub effect — carry it into battle." style={{
            fontFamily: 'var(--imp-font-mono)', fontSize: 8.5,
            letterSpacing: 1, textTransform: 'uppercase', color: 'var(--imp-text-mid)',
            cursor: 'help',
          }}>
            ⚔ battle only
          </span>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); onCast(); }}
            disabled={!hubCastable}
            title={hubCastable ? 'Cast at the hub (discards the scroll)' : 'Cannot afford the cast cost right now'}
            class={`imp-card-cta imp-card-cta-${hubCastable ? 'actionable' : 'disabled'}`}
            style={{
              padding: '4px 9px',
              background: hubCastable
                ? `linear-gradient(180deg, ${accent} 0%, #b8892a 100%)`
                : 'rgba(80, 70, 50, 0.3)',
              border: 'none',
              borderRadius: 2,
              color: hubCastable ? 'var(--imp-ink)' : 'var(--imp-text-lo)',
              fontSize: 'var(--imp-text-xs)', fontWeight: 700,
              letterSpacing: 'var(--imp-meta-letter)', textTransform: 'uppercase',
              fontFamily: 'var(--imp-font-display)',
              cursor: hubCastable ? 'pointer' : 'not-allowed',
              flexShrink: 0,
              ...getPriorityStyle(hubCastable ? 'actionable' : 'disabled', accent),
            }}
          >
            Cast
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onSell(); }}
          title={`Sell for ${sellPrice} gold`}
          style={{
            padding: '4px 8px',
            background: 'transparent',
            border: '1px solid rgba(194, 74, 58, 0.4)',
            borderRadius: 2,
            color: '#c24a3a',
            fontSize: 'var(--imp-text-xs)', fontWeight: 600,
            letterSpacing: 'var(--imp-meta-letter)', textTransform: 'uppercase',
            fontFamily: 'var(--imp-font-body)',
            cursor: 'pointer',
            flexShrink: 0,
            display: 'inline-flex', alignItems: 'center', gap: 3,
          }}
        >
          <ResourceAmount type="gold" amount={sellPrice} iconSize="inline" />
        </button>
      </div>
    </div>
  );
}

// ── DecretumDetail ───────────────────────────────────────────────

interface DecretumDetailProps {
  d: Decretum;
  hubCastable: boolean;
  accent: string;
  onSell: () => void;
  onCast: () => void;
}

function DecretumDetail({ d, hubCastable, accent, onSell, onCast }: DecretumDetailProps) {
  const color = FACTION_COLORS[d.color];
  const costEntries = d.castCost
    ? (Object.entries(d.castCost) as [ResourceType, number][]).filter(([, amt]) => amt > 0)
    : [];
  const sellPrice = DECRETUM_SELL_PRICE[d.rarity];
  const hubEffect = toHubEffect(d);
  const extras = describeExtraEffectsHub(d);
  const purple = FACTION_COLORS.purple;

  return (
    <>
      {/* Header: school tag + rarity gem */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        <span style={{
          padding: '2px 9px',
          background: color, color: '#fff',
          borderRadius: 2,
          fontFamily: 'var(--imp-font-display)', fontSize: 'var(--imp-text-xs)', fontWeight: 700,
          letterSpacing: 1, textTransform: 'uppercase',
        }}>
          {d.color}
        </span>
        <RarityGem rarity={d.rarity} />
      </div>

      <div style={{
        fontFamily: 'var(--imp-font-display)',
        fontSize: 22, fontWeight: 500,
        color: 'var(--imp-text-hi)',
        letterSpacing: 'var(--imp-title-letter)', textTransform: 'uppercase',
        marginBottom: 6, lineHeight: 1.15,
      }}>
        {d.name}
      </div>
      <div style={{
        fontFamily: 'var(--imp-font-serif)',
        fontStyle: 'italic', fontSize: 13,
        color: 'var(--imp-text-mid)',
        lineHeight: 1.5, marginBottom: 12,
      }}>
        "{d.description}"
      </div>

      {/* Effect breakdown */}
      <div style={{
        fontSize: 'var(--imp-text-xs)', letterSpacing: 'var(--imp-meta-letter)',
        color: 'var(--imp-text-mid)', textTransform: 'uppercase', marginBottom: 6,
      }}>
        Effects
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        <div style={{
          display: 'flex', gap: 10, alignItems: 'flex-start',
          padding: '9px 11px',
          background: `${color}14`,
          border: `1px solid ${color}88`,
          borderRadius: 2,
        }}>
          <span style={{
            width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--imp-font-mono)', fontSize: 10, fontWeight: 700,
            background: color, color: '#fff',
          }}>
            1
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 'var(--imp-text-sm)', color: 'var(--imp-text-hi)',
              fontFamily: 'var(--imp-font-serif)', fontStyle: 'italic', lineHeight: 1.45,
            }}>
              {hubEffect ? describeHubEffect(hubEffect) : d.description}
            </div>
            <div style={{
              fontFamily: 'var(--imp-font-mono)', fontSize: 9,
              letterSpacing: 1, textTransform: 'uppercase', color, marginTop: 3,
            }}>
              {hubEffect ? 'Hub effect' : 'Battle effect'}
            </div>
          </div>
        </div>
        {extras.map((ex) => (
          <div key={ex} style={{
            display: 'flex', gap: 10, alignItems: 'flex-start',
            padding: '9px 11px',
            background: 'rgba(20, 18, 32, 0.6)',
            border: '1px solid rgba(212, 168, 67, 0.15)',
            borderRadius: 2,
          }}>
            <span style={{
              width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--imp-font-mono)', fontSize: 11, fontWeight: 700,
              border: '1px solid rgba(212, 168, 67, 0.35)', color: 'var(--imp-text-mid)',
            }}>
              +
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 'var(--imp-text-sm)', color: 'var(--imp-text-mid)',
                fontFamily: 'var(--imp-font-serif)', fontStyle: 'italic', lineHeight: 1.45,
              }}>
                {ex}
              </div>
              <div style={{
                fontFamily: 'var(--imp-font-mono)', fontSize: 9,
                letterSpacing: 1, textTransform: 'uppercase', color: 'var(--imp-text-lo)', marginTop: 3,
              }}>
                Secondary effect
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Cost + where */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, margin: '12px 0' }}>
        <InfoBox
          label="Cast cost"
          value={costEntries.length > 0 ? <CostInline cost={d.castCost ?? {}} iconSize="inline" /> : 'Free'}
          color={accent}
        />
        <InfoBox
          label="Where"
          value={hubEffect ? '✓ Hub' : '⚔ Battle'}
          color={hubEffect ? '#7a9a6a' : '#c24a3a'}
        />
      </div>

      {/* Reminder note */}
      <div style={{
        padding: '9px 11px',
        background: 'rgba(20, 18, 32, 0.6)',
        border: '1px solid rgba(212, 168, 67, 0.15)',
        borderLeft: `3px solid ${purple}`,
        borderRadius: 2,
        fontFamily: 'var(--imp-font-serif)',
        fontStyle: 'italic', fontSize: 'var(--imp-text-sm)',
        color: 'var(--imp-text-mid)',
        lineHeight: 1.4,
      }}>
        Casting discards the scroll. Per-season effects show as green chips above the hand.
      </div>

      {/* Actions */}
      <div style={{ marginTop: 'auto', display: 'flex', gap: 8, paddingTop: 12 }}>
        <button
          onClick={onCast}
          disabled={!hubCastable}
          class={`imp-card-cta imp-card-cta-${hubCastable ? 'actionable' : 'disabled'}`}
          style={{
            flex: 1,
            padding: '10px 16px',
            background: hubCastable ? `linear-gradient(180deg, ${accent} 0%, #b8892a 100%)` : 'rgba(80, 70, 50, 0.4)',
            border: 'none', borderRadius: 2,
            color: hubCastable ? 'var(--imp-ink)' : 'var(--imp-text-lo)',
            fontSize: 'var(--imp-text-sm)', fontWeight: 700,
            letterSpacing: 'var(--imp-meta-letter)', textTransform: 'uppercase',
            fontFamily: 'var(--imp-font-display)',
            cursor: hubCastable ? 'pointer' : 'not-allowed',
            ...getPriorityStyle(hubCastable ? 'actionable' : 'disabled', accent),
          }}
        >
          Cast{costEntries.length > 0 && <> · <CostInline cost={d.castCost ?? {}} iconSize="inline" /></>}
        </button>
        <button
          onClick={onSell}
          style={{
            flex: 1,
            padding: '10px 16px',
            background: 'transparent',
            border: '1px solid rgba(194, 74, 58, 0.55)',
            borderRadius: 2,
            color: '#c24a3a',
            fontSize: 'var(--imp-text-sm)', fontWeight: 700,
            letterSpacing: 'var(--imp-meta-letter)', textTransform: 'uppercase',
            fontFamily: 'var(--imp-font-display)',
            cursor: 'pointer',
          }}
        >
          Sell · <ResourceAmount type="gold" amount={sellPrice} iconSize="inline" />
        </button>
      </div>
    </>
  );
}

function InfoBox({ label, value, color }: { label: string; value: preact.ComponentChildren; color: string }) {
  return (
    <div style={{
      padding: '10px 12px',
      background: 'rgba(20, 18, 32, 0.6)',
      border: '1px solid rgba(212, 168, 67, 0.15)',
      borderRadius: 2,
    }}>
      <div style={{
        fontSize: 'var(--imp-text-xs)', letterSpacing: 'var(--imp-meta-letter)',
        color: 'var(--imp-text-mid)',
        textTransform: 'uppercase', marginBottom: 3,
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: 'var(--imp-font-display)',
        fontSize: 14, color,
        letterSpacing: 1,
      }}>
        {value}
      </div>
    </div>
  );
}
