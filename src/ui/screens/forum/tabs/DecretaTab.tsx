import { useSignal } from '@preact/signals';
import type { ComponentChildren } from 'preact';
import { decretumHand, maxHandSize, sellDecretum } from '../../../../game/items/decretum-store';
import { isDecretumCastable, DECRETUM_SELL_PRICE } from '../../../../game/items/decretum';
import type { Decretum } from '../../../../game/items/decretum';
import { selectedCommander } from '../../../../game/core/game-state';
import { FACTION_COLORS } from '../../../../game/core/commander';
import type { ResourceType } from '../../../../game/core/commander';
import { playSfx } from '../../../sound/sfx';
import { castDecretumAtHub, isCastableAtHub, toHubEffect, describeHubEffect, describeExtraEffectsHub, activeDecretumEffects } from '../../../../game/items/decretum-hub';
import { BentoCard } from '../../../components/BentoCard';
import { Corners } from '../../../components/motifs/Corners';
import { LaurelWreath } from '../../../components/motifs/LaurelWreath';
import { Masthead } from '../Masthead';
import { SectionHeader } from '../components/SectionHeader';
import { CostInline, ResourceAmount } from '../../../components/ResourceIcon';
import { getPriorityStyle, priorityClass, type CardPriority } from '../../../components/card-priority';


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

  const subtitle = hand.length === 0
    ? `0 of ${max} in hand`
    : `${hand.length} of ${max} in hand`;

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

        {/* ── LEFT: Hand grid ── */}
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
              Cast at hub
            </span>}
          />
          {activeDecretumEffects.value.length > 0 && (
            <div style={{
              margin: '0 0 10px', padding: '8px 12px',
              background: 'rgba(122, 168, 106, 0.10)',
              border: '1px solid rgba(122, 168, 106, 0.35)',
              borderRadius: 2,
              fontFamily: 'var(--imp-font-serif)', fontStyle: 'italic',
              fontSize: 'var(--imp-text-sm)', color: 'var(--imp-text-mid)',
            }}>
              {activeDecretumEffects.value.map((a) => (
                <div key={a.decretumId}>
                  ◆ {a.name} — {describeHubEffect(a.effect)} · {a.remainingSeasons} {a.remainingSeasons === 1 ? 'temporada' : 'temporadas'}
                </div>
              ))}
            </div>
          )}
          {hand.length === 0 ? (
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              padding: 40, gap: 12,
              color: 'var(--imp-text-mid)',
            }}>
              <LaurelWreath size={80} color={accent} opacity={0.3} />
              <div style={{
                fontFamily: 'var(--imp-font-display)',
                fontSize: 14, color: 'var(--imp-text-hi)',
                letterSpacing: 'var(--imp-title-letter)', textTransform: 'uppercase',
              }}>
                Empty hand
              </div>
              <div style={{
                fontFamily: 'var(--imp-font-serif)',
                fontStyle: 'italic', fontSize: 12,
                color: 'var(--imp-text-mid)',
                textAlign: 'center', maxWidth: 320,
              }}>
                Scrolls are dealt between campaigns and at run start.
              </div>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 10,
              overflow: 'auto',
              flex: 1,
              alignContent: 'start',
              paddingRight: 4,
            }}>
              {hand.map((d) => (
                <ScrollCard
                  key={d.id}
                  d={d}
                  castable={faction !== null && isDecretumCastable(d, faction)}
                  selected={d.id === current?.id}
                  accent={accent}
                  onSelect={() => { selectedId.value = d.id; }}
                />
              ))}
            </div>
          )}
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
  castable: boolean;
  selected: boolean;
  accent: string;
  onSelect: () => void;
}

function ScrollCard({ d, castable, selected, accent, onSelect }: ScrollCardProps) {
  const color = FACTION_COLORS[d.color];
  const costEntry = d.castCost
    ? (Object.entries(d.castCost) as [ResourceType, number][]).find(([, amt]) => amt > 0) ?? null
    : null;
  const costLabel = costEntry
    ? <ResourceAmount type={costEntry[0]} amount={costEntry[1]} iconSize="inline" />
    : '—';
  const priority: CardPriority = selected ? 'selected' : castable ? 'actionable' : 'disabled';

  return (
    <div
      class={priorityClass(priority)}
      onClick={onSelect}
      style={{
        padding: '14px 14px 12px',
        background: selected
          ? `linear-gradient(180deg, ${color}30 0%, rgba(20, 18, 32, 0.95) 100%)`
          : `linear-gradient(180deg, ${color}10 0%, rgba(20, 18, 32, 0.9) 100%)`,
        border: `1px solid ${selected ? accent : `${color}55`}`,
        borderTop: `3px solid ${color}`,
        borderRadius: 2,
        opacity: castable ? 1 : 0.5,
        cursor: 'pointer',
        transition: 'all 180ms',
        position: 'relative',
        boxShadow: selected ? `0 0 16px ${accent}50` : 'none',
        ...getPriorityStyle(priority, color),
      }}
    >
      <Corners color={color} size={8} inset={3} thickness={1} />
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 8,
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          border: `1.5px solid ${color}`,
          background: `${color}20`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--imp-font-display)',
          fontSize: 11, fontWeight: 700, color,
        }}>
          {costLabel}
        </div>
        <div style={{
          fontSize: 8, color: 'var(--imp-text-lo)',
          letterSpacing: 'var(--imp-meta-letter)', textTransform: 'uppercase',
        }}>
          {d.rarity}
        </div>
      </div>
      <div style={{
        fontFamily: 'var(--imp-font-display)',
        fontSize: 14, color: 'var(--imp-text-hi)',
        letterSpacing: 'var(--imp-meta-letter)', textTransform: 'uppercase',
        fontWeight: 600, marginBottom: 6, lineHeight: 1.2,
      }}>
        {d.name}
      </div>
      <div style={{
        fontFamily: 'var(--imp-font-serif)',
        fontStyle: 'italic', fontSize: 'var(--imp-text-sm)',
        color: 'var(--imp-text-mid)',
        lineHeight: 1.4,
      }}>
        {d.description}
      </div>
      {!castable && (
        <div style={{
          fontSize: 'var(--imp-text-xs)', color: '#c24a3a',
          letterSpacing: 'var(--imp-meta-letter)', textTransform: 'uppercase',
          marginTop: 6,
        }}>
          Faction-locked
        </div>
      )}
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
  const costLabel = costEntries.length > 0
    ? <CostInline cost={d.castCost ?? {}} iconSize="inline" />
    : 'Free';
  const sellPrice = DECRETUM_SELL_PRICE[d.rarity];
  const hubEffect = toHubEffect(d);

  return (
    <>
      <div style={{
        fontSize: 'var(--imp-text-xs)', letterSpacing: 'var(--imp-meta-letter)',
        color: 'var(--imp-text-mid)',
        textTransform: 'uppercase', marginBottom: 4,
      }}>
        Decretum
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
        lineHeight: 1.5, marginBottom: 14,
      }}>
        "{d.description}"
      </div>

      {/* Info grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr',
        gap: 8, marginBottom: 14,
      }}>
        <InfoBox label="Cost" value={costLabel} color={accent} />
        <InfoBox label="Rarity" value={d.rarity} color={color} capitalize />
        <InfoBox label="Castable" value={hubCastable ? 'Yes' : 'No'} color={hubCastable ? '#7a9a6a' : '#c24a3a'} />
        <InfoBox label="Color" value={d.color} color={color} capitalize />
      </div>

      {/* Cast hint + sell action */}
      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{
          padding: '10px 12px',
          background: 'rgba(20, 18, 32, 0.6)',
          border: '1px solid rgba(212, 168, 67, 0.15)',
          borderRadius: 2,
          fontFamily: 'var(--imp-font-serif)',
          fontStyle: 'italic', fontSize: 'var(--imp-text-sm)',
          color: 'var(--imp-text-mid)',
          lineHeight: 1.4,
        }}>
          {hubEffect
            ? `Al lanzar en el Hub: ${[describeHubEffect(hubEffect), ...describeExtraEffectsHub(d)].join(' · ')}.`
            : 'Sin efecto de Hub — este pergamino no puede lanzarse aquí.'}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
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
            Lanzar
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
      </div>
    </>
  );
}

function InfoBox({ label, value, color, capitalize }: { label: string; value: ComponentChildren; color: string; capitalize?: boolean }) {
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
        textTransform: capitalize ? 'capitalize' : 'none',
        letterSpacing: 1,
      }}>
        {value}
      </div>
    </div>
  );
}
