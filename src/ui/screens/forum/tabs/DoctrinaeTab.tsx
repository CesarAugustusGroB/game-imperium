import { useSignal } from '@preact/signals';
import type { JSX } from 'preact';
import { selectedCommander } from '../../../../game/core/game-state';
import {
  equippedDoctrines, doctrineCollection,
  equipDoctrine, unequipDoctrine, upgradeDoctrine, sellDoctrine,
  swapEquippedDoctrines,
} from '../../../../game/items/doctrine-store';
import {
  isDoctrineEquippable, getDoctrineSellPrice, getUpgradeCost,
} from '../../../../game/items/doctrine';
import type { Doctrine } from '../../../../game/items/doctrine';
import { FACTION_COLORS } from '../../../../game/core/commander';
import type { ResourceType } from '../../../../game/core/commander';
import { gold, iuniores } from '../../../../game/core/resources';
import { playSfx } from '../../../sound/sfx';
import { BentoCard } from '../../../components/BentoCard';
import { Masthead } from '../Masthead';
import { SectionHeader } from '../components/SectionHeader';
import { CostInline, ResourceAmount } from '../../../components/ResourceIcon';
import { getPriorityStyle, priorityClass, type CardPriority } from '../../../components/card-priority';

const CAMPAIGN_EFFECT_BY_COLOR: Record<string, string> = {
  red: 'Campaña: las cartas de Coerción erosionan más al enemigo.',
  blue: 'Campaña: las cartas de Diplomacia cuestan menos oro y bajan más la amenaza.',
  gold: 'Campaña: +moral cada turno.',
  purple: 'Campaña: las cartas de Logística dan más suministros.',
  white: 'Campaña: +suministros cada turno.',
};

const ROMAN: readonly string[] = ['I', 'II', 'III'];

// ── Card look ──
// Doctrines render as 3:4 "school cards" (see wireframes.html → Doctrinae).
const CARD_W = 158;

/** Latin school name per faction color, shown in the card band. */
const SCHOOL_NAMES: Record<string, string> = {
  gold: 'Fides',
  red: 'Ferrum',
  blue: 'Foedus',
  purple: 'Mercatura',
  white: 'Universa',
};

/** Emblem glyph per school (doctrines carry no icon asset yet). */
const SCHOOL_ICONS: Record<string, string> = {
  gold: '☩',
  red: '⚔',
  blue: '◈',
  purple: '⚖',
  white: '❂',
};

/** Level progress pips (filled up to the current level). */
function LevelPips({ level, color }: { level: number; color: string }) {
  return (
    <div style={{ display: 'flex', gap: 3 }}>
      {[1, 2, 3].map((n) => (
        <span key={n} style={{
          width: 14, height: 5, borderRadius: 3,
          background: n <= level ? color : 'rgba(212, 168, 67, 0.18)',
        }} />
      ))}
    </div>
  );
}

/** School color band at the top of a doctrine card. */
function CardBand({ doctrine }: { doctrine: Doctrine }) {
  const color = FACTION_COLORS[doctrine.color];
  return (
    <div style={{
      height: 20, flexShrink: 0,
      background: color, color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 8px',
      fontFamily: 'var(--imp-font-display)', fontSize: 8.5, fontWeight: 700,
      letterSpacing: 1, textTransform: 'uppercase', whiteSpace: 'nowrap',
    }}>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {doctrine.color} · {SCHOOL_NAMES[doctrine.color] ?? ''}
      </span>
      <span style={{ fontSize: 10 }}>{ROMAN[doctrine.currentLevel - 1] ?? '·'}</span>
    </div>
  );
}

/** Emblem zone under the band. */
function CardEmblem({ doctrine }: { doctrine: Doctrine }) {
  const color = FACTION_COLORS[doctrine.color];
  return (
    <div style={{
      flex: '0 0 30%', minHeight: 0,
      background: `radial-gradient(circle at 50% 58%, ${color}26 0%, rgba(14, 12, 24, 0.9) 78%)`,
      borderBottom: '1px solid rgba(212, 168, 67, 0.18)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color, fontSize: 26, opacity: 0.9,
    }}>
      {SCHOOL_ICONS[doctrine.color] ?? '✦'}
    </div>
  );
}
export function DoctrinaeTab() {
  const selectedId = useSignal<string | null>(null);
  const draggedId = useSignal<string | null>(null);          // dragging FROM collection
  const draggedFromSlot = useSignal<number | null>(null);    // dragging FROM equipped slot
  const dragOverSlot = useSignal<number | null>(null);
  const commander = selectedCommander.value;
  const faction = commander?.faction ?? null;
  const slots = equippedDoctrines.value;
  const collection = doctrineCollection.value;
  const accent = '#d4a843';

  // Resolve selection — may be equipped or in the collection
  const allDoctrines: Array<{ doctrine: Doctrine; slotIndex: number | null }> = [
    ...slots.map((d, i) => (d ? { doctrine: d, slotIndex: i } : null)),
    ...collection.map((d) => ({ doctrine: d, slotIndex: null })),
  ].filter((x): x is { doctrine: Doctrine; slotIndex: number | null } => x !== null);

  // Default: first equipped, else first in collection
  const current = selectedId.value
    ? allDoctrines.find((x) => x.doctrine.id === selectedId.value) ?? null
    : allDoctrines[0] ?? null;

  const equippedCount = slots.filter((d) => d !== null).length;
  const subtitle = `${equippedCount} of ${slots.length} equipped · ${collection.length} in collection`;

  // Detail panel takes on the active doctrine's school color so its hairline +
  // hover glow match the inspected doctrine; falls back to Forum gold.
  const detailAccent = current ? FACTION_COLORS[current.doctrine.color] : accent;

  function handleSelect(id: string) { selectedId.value = id; }

  function handleEquip(doctrine: Doctrine) {
    const emptyIdx = slots.findIndex((s) => s === null);
    if (emptyIdx === -1 || !faction || !isDoctrineEquippable(doctrine, faction)) return;
    equipDoctrine(emptyIdx, doctrine);
    playSfx('ui_equip');
  }

  function handleUnequip(slotIndex: number) {
    unequipDoctrine(slotIndex);
    playSfx('ui_sell');
  }

  function handleUpgrade(slotIndex: number) {
    if (upgradeDoctrine(slotIndex)) playSfx('ui_equip');
  }

  function handleSell(id: string) {
    sellDoctrine(id);
    playSfx('ui_sell');
    if (selectedId.value === id) selectedId.value = null;
  }

  // ── Drag-and-drop ──
  // Two paths: (1) collection row → equipped slot (equip, with swap if
  // target filled); (2) equipped slot → equipped slot (reorder, pure swap
  // without touching the collection).

  function handleCollectionDragStart(e: DragEvent, id: string) {
    draggedId.value = id;
    draggedFromSlot.value = null;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', id);
    }
  }
  function handleSlotDragStart(e: DragEvent, slotIndex: number) {
    draggedFromSlot.value = slotIndex;
    draggedId.value = null;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', `slot:${slotIndex}`);
    }
  }
  function handleDragEnd() {
    draggedId.value = null;
    draggedFromSlot.value = null;
    dragOverSlot.value = null;
  }
  function handleSlotDragOver(e: DragEvent, slotIndex: number) {
    const dragging = draggedId.value !== null || draggedFromSlot.value !== null;
    if (!dragging) return;
    if (draggedFromSlot.value === slotIndex) return; // can't drop onto self
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    dragOverSlot.value = slotIndex;
  }
  function handleSlotDragLeave() {
    dragOverSlot.value = null;
  }
  function handleSlotDrop(e: DragEvent, slotIndex: number) {
    e.preventDefault();
    dragOverSlot.value = null;

    // Slot-to-slot swap
    if (draggedFromSlot.value !== null) {
      const from = draggedFromSlot.value;
      draggedFromSlot.value = null;
      if (from === slotIndex) return;
      swapEquippedDoctrines(from, slotIndex);
      playSfx('ui_equip');
      return;
    }

    // Collection-to-slot equip. Guard the dataTransfer fallback against
    // "slot:N" payloads from a slot-drag whose signal state was already reset.
    const id = draggedId.value ?? e.dataTransfer?.getData('text/plain') ?? null;
    if (!id || id.startsWith('slot:')) return;
    const d = collection.find((x) => x.id === id);
    if (!d || !faction || !isDoctrineEquippable(d, faction)) return;
    equipDoctrine(slotIndex, d);
    playSfx('ui_equip');
    draggedId.value = null;
  }

  return (
    <>
      <Masthead title="Doctrinae" subtitle={subtitle} accent={accent} />

      <div style={{
        flex: 1, minHeight: 0, overflow: 'hidden',
        padding: '20px 32px 24px',
        display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 14,
      }}>

        {/* ── LEFT: Equipped grid + Collection list ── */}
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 12,
          minHeight: 0, overflow: 'auto',
        }}>
          <BentoCard accent={accent} index={0}>
            <SectionHeader
              title="Equipped"
              accent={accent}
              right={<span style={{
                fontSize: 'var(--imp-text-xs)', color: 'var(--imp-text-mid)',
                letterSpacing: 'var(--imp-meta-letter)', textTransform: 'uppercase',
              }}>
                Click to inspect
              </span>}
            />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {slots.map((d, i) => (
                <EquippedSlotCard
                  key={i}
                  doctrine={d}
                  slotIndex={i}
                  selected={d?.id === current?.doctrine.id}
                  dragOver={dragOverSlot.value === i}
                  dragging={draggedFromSlot.value === i}
                  accent={accent}
                  onSelect={() => d && handleSelect(d.id)}
                  onUnequip={() => handleUnequip(i)}
                  onDragStart={(e) => handleSlotDragStart(e, i)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => handleSlotDragOver(e, i)}
                  onDragLeave={handleSlotDragLeave}
                  onDrop={(e) => handleSlotDrop(e, i)}
                />
              ))}
            </div>
          </BentoCard>

          <BentoCard accent={accent} index={1}>
            <SectionHeader
              title="Collection"
              accent={accent}
              right={<span style={{
                fontSize: 'var(--imp-text-xs)', color: 'var(--imp-text-mid)',
                letterSpacing: 'var(--imp-meta-letter)', textTransform: 'uppercase',
              }}>
                {collection.length} available{faction ? <> · your color: <span style={{ color: FACTION_COLORS[faction], fontWeight: 700 }}>{faction}</span></> : null}
              </span>}
            />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {collection.length === 0 && (
                <div style={{
                  padding: '10px 4px',
                  fontFamily: 'var(--imp-font-serif)',
                  fontStyle: 'italic', fontSize: 'var(--imp-text-sm)',
                  color: 'var(--imp-text-mid)',
                }}>
                  No unequipped doctrines. Acquire them from events or rewards.
                </div>
              )}
              {collection.map((d) => (
                <CollectionCard
                  key={d.id}
                  doctrine={d}
                  canEquip={!!faction && isDoctrineEquippable(d, faction)}
                  hasEmptySlot={slots.some((s) => s === null)}
                  selected={d.id === current?.doctrine.id}
                  dragging={draggedId.value === d.id}
                  accent={accent}
                  onSelect={() => handleSelect(d.id)}
                  onEquip={() => handleEquip(d)}
                  onSell={() => handleSell(d.id)}
                  onDragStart={(e) => handleCollectionDragStart(e, d.id)}
                  onDragEnd={handleDragEnd}
                />
              ))}
            </div>
          </BentoCard>
        </div>

        {/* ── RIGHT: Detail ── */}
        <BentoCard
          accent={detailAccent}
          index={2}
          style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'auto' }}
        >
          {current ? (
            <DoctrineDetail
              doctrine={current.doctrine}
              slotIndex={current.slotIndex}
              accent={accent}
              onUnequip={current.slotIndex !== null ? () => handleUnequip(current.slotIndex!) : undefined}
              onUpgrade={current.slotIndex !== null ? () => handleUpgrade(current.slotIndex!) : undefined}
              onSell={current.slotIndex === null ? () => handleSell(current.doctrine.id) : undefined}
            />
          ) : (
            <div style={{
              textAlign: 'center', padding: 40,
              color: 'var(--imp-text-mid)',
              fontFamily: 'var(--imp-font-serif)',
              fontStyle: 'italic',
              margin: 'auto',
            }}>
              Pick a doctrine to inspect.
            </div>
          )}
        </BentoCard>
      </div>
    </>
  );
}

// ── EquippedSlotCard ─────────────────────────────────────────────

interface EquippedSlotCardProps {
  doctrine: Doctrine | null;
  slotIndex: number;
  selected: boolean;
  dragOver: boolean;
  dragging: boolean;
  accent: string;
  onSelect: () => void;
  onUnequip: () => void;
  onDragStart: (e: DragEvent) => void;
  onDragEnd: () => void;
  onDragOver: (e: DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: DragEvent) => void;
}

function EquippedSlotCard({
  doctrine, slotIndex, selected, dragOver, dragging, accent, onSelect, onUnequip,
  onDragStart, onDragEnd, onDragOver, onDragLeave, onDrop,
}: EquippedSlotCardProps) {
  // Shared drop-target handlers — wrapping Preact's DragEvent so the
  // inline handlers stay type-safe when the slot is empty or filled.
  const dropHandlers = {
    onDragOver: (e: JSX.TargetedDragEvent<HTMLDivElement>) => onDragOver(e as unknown as DragEvent),
    onDragLeave,
    onDrop: (e: JSX.TargetedDragEvent<HTMLDivElement>) => onDrop(e as unknown as DragEvent),
  };

  // Empty socket: dashed card silhouette, drop target.
  if (!doctrine) {
    return (
      <div
        {...dropHandlers}
        class={priorityClass('urgent')}
        style={{
          width: CARD_W, aspectRatio: '3/4', flex: '0 0 auto',
          background: dragOver
            ? 'rgba(80, 60, 20, 0.35)'
            : 'rgba(20, 18, 32, 0.3)',
          border: dragOver
            ? `2px dashed ${accent}`
            : '2px dashed rgba(212, 168, 67, 0.22)',
          borderRadius: 4,
          boxShadow: dragOver ? `0 0 16px ${accent}50` : 'none',
          transition: 'all 140ms',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          color: 'var(--imp-text-mid)', gap: 6,
          ...getPriorityStyle('urgent', accent),
        }}
      >
        <div style={{ fontSize: 26, opacity: 0.7 }}>+</div>
        <div style={{
          fontSize: 'var(--imp-text-xs)', letterSpacing: 'var(--imp-meta-letter)', textTransform: 'uppercase',
          fontFamily: 'var(--imp-font-display)',
        }}>
          Slot {slotIndex + 1} · empty
        </div>
        <div style={{
          fontSize: 9, fontFamily: 'var(--imp-font-serif)', fontStyle: 'italic',
          color: 'var(--imp-text-lo)',
        }}>
          drag a card here
        </div>
      </div>
    );
  }

  const color = FACTION_COLORS[doctrine.color];
  const desc = doctrine.levels[doctrine.currentLevel - 1]?.description ?? '';
  const priority: CardPriority = selected ? 'selected' : 'actionable';

  return (
    <div
      class={priorityClass(priority)}
      onClick={onSelect}
      draggable={true}
      onDragStart={(e: JSX.TargetedDragEvent<HTMLDivElement>) => onDragStart(e as unknown as DragEvent)}
      onDragEnd={onDragEnd}
      {...dropHandlers}
      title="Drag to reorder or swap with another slot"
      style={{
        width: CARD_W, aspectRatio: '3/4', flex: '0 0 auto',
        position: 'relative',
        background: 'rgba(20, 18, 32, 0.85)',
        border: `1px solid ${dragOver ? accent : selected ? accent : `${color}55`}`,
        borderTop: `3px solid ${color}`,
        borderRadius: 4, overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        cursor: 'grab',
        opacity: dragging ? 0.4 : 1,
        transform: dragging ? 'scale(0.97)' : 'none',
        boxShadow:
          dragOver ? `0 0 0 2px ${accent}, 0 0 20px ${accent}60` :
          selected ? `0 0 0 1px ${accent}, 0 0 16px ${accent}50` :
          'none',
        transition: 'all 200ms',
        ...getPriorityStyle(priority, color),
      }}
    >
      <CardBand doctrine={doctrine} />
      <CardEmblem doctrine={doctrine} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, padding: '8px 9px', flex: 1, minHeight: 0 }}>
        <div style={{
          fontFamily: 'var(--imp-font-display)',
          fontSize: 11.5, fontWeight: 600,
          color: 'var(--imp-text-hi)',
          letterSpacing: 'var(--imp-meta-letter)', textTransform: 'uppercase',
          lineHeight: 1.25,
        }}>
          {doctrine.name}
        </div>
        <LevelPips level={doctrine.currentLevel} color={color} />
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
          {desc}
        </div>
      </div>
      <div style={{
        borderTop: '1px dashed rgba(212, 168, 67, 0.22)',
        padding: '5px 9px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        fontFamily: 'var(--imp-font-mono)', fontSize: 8.5,
        letterSpacing: 1, textTransform: 'uppercase', color: 'var(--imp-text-lo)',
      }}>
        <span>Slot {slotIndex + 1}</span>
        <button
          onClick={(e) => { e.stopPropagation(); onUnequip(); }}
          disabled={dragging}
          title="Unequip"
          style={{
            width: 20, height: 20, padding: 0,
            background: 'transparent', border: '1px solid rgba(212, 168, 67, 0.3)',
            borderRadius: 2, color: 'var(--imp-text-mid)', fontSize: 10, lineHeight: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', fontFamily: 'var(--imp-font-body)',
          }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

// ── CollectionCard ───────────────────────────────────────────────

interface CollectionCardProps {
  doctrine: Doctrine;
  canEquip: boolean;
  hasEmptySlot: boolean;
  selected: boolean;
  dragging: boolean;
  accent: string;
  onSelect: () => void;
  onEquip: () => void;
  onSell: () => void;
  onDragStart: (e: DragEvent) => void;
  onDragEnd: () => void;
}

function CollectionCard({
  doctrine, canEquip, hasEmptySlot, selected, dragging,
  accent, onSelect, onEquip, onSell, onDragStart, onDragEnd,
}: CollectionCardProps) {
  const color = FACTION_COLORS[doctrine.color];
  const desc = doctrine.levels[doctrine.currentLevel - 1]?.description ?? '';
  const canAdopt = canEquip && hasEmptySlot;
  const sellPrice = getDoctrineSellPrice(doctrine);
  const priority: CardPriority = selected ? 'selected' : canAdopt ? 'actionable' : canEquip ? 'urgent' : 'disabled';

  return (
    <div
      class={priorityClass(priority)}
      onClick={onSelect}
      draggable={canEquip}
      onDragStart={canEquip
        ? ((e: JSX.TargetedDragEvent<HTMLDivElement>) => onDragStart(e as unknown as DragEvent))
        : undefined}
      onDragEnd={canEquip ? onDragEnd : undefined}
      title={canEquip ? 'Drag onto a slot to equip, or click to inspect' : 'Faction color-lock — only your color or white can be equipped'}
      style={{
        width: CARD_W, aspectRatio: '3/4', flex: '0 0 auto',
        background: 'rgba(20, 18, 32, 0.7)',
        border: `1px solid ${selected ? accent : 'rgba(212, 168, 67, 0.15)'}`,
        borderTop: `3px solid ${color}`,
        borderRadius: 4, overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        cursor: canEquip ? 'grab' : 'pointer',
        opacity: dragging ? 0.4 : canEquip ? 1 : 0.55,
        filter: canEquip ? 'none' : 'saturate(0.4)',
        transform: dragging ? 'scale(0.97)' : 'none',
        boxShadow: selected ? `0 0 0 1px ${accent}, 0 0 14px ${accent}45` : 'none',
        transition: 'all 140ms',
        ...getPriorityStyle(priority, color),
      }}
    >
      <CardBand doctrine={doctrine} />
      <CardEmblem doctrine={doctrine} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, padding: '8px 9px', flex: 1, minHeight: 0 }}>
        <div style={{
          fontFamily: 'var(--imp-font-display)',
          fontSize: 11.5, fontWeight: 600,
          color: 'var(--imp-text-hi)',
          letterSpacing: 'var(--imp-meta-letter)', textTransform: 'uppercase',
          lineHeight: 1.25,
        }}>
          {doctrine.name}
        </div>
        <LevelPips level={doctrine.currentLevel} color={color} />
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
          {desc}
        </div>
      </div>
      <div style={{
        borderTop: '1px dashed rgba(212, 168, 67, 0.22)',
        padding: '5px 8px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 5,
      }}>
        {canEquip ? (
          <button
            onClick={(e) => { e.stopPropagation(); onEquip(); }}
            disabled={!canAdopt}
            title={!hasEmptySlot ? 'All slots are full' : 'Adopt into the first empty slot'}
            class={`imp-card-cta imp-card-cta-${canAdopt ? 'actionable' : 'disabled'}`}
            style={{
              padding: '4px 9px',
              background: canAdopt
                ? `linear-gradient(180deg, ${accent} 0%, #b8892a 100%)`
                : 'rgba(80, 70, 50, 0.3)',
              border: 'none',
              borderRadius: 2,
              color: canAdopt ? 'var(--imp-ink)' : 'var(--imp-text-lo)',
              fontSize: 'var(--imp-text-xs)', fontWeight: 700,
              letterSpacing: 'var(--imp-meta-letter)', textTransform: 'uppercase',
              fontFamily: 'var(--imp-font-display)',
              cursor: canAdopt ? 'pointer' : 'not-allowed',
              flexShrink: 0,
              ...getPriorityStyle(canAdopt ? 'actionable' : 'disabled', accent),
            }}
          >
            Equip
          </button>
        ) : (
          <span title="Only your color or white can be equipped." style={{
            fontFamily: 'var(--imp-font-mono)', fontSize: 8.5,
            letterSpacing: 1, textTransform: 'uppercase', color: 'var(--imp-text-lo)',
            cursor: 'help',
          }}>
            🔒 color-lock
          </span>
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

// ── DoctrineDetail ───────────────────────────────────────────────

interface DoctrineDetailProps {
  doctrine: Doctrine;
  slotIndex: number | null;
  accent: string;
  onUnequip?: () => void;
  onUpgrade?: () => void;
  onSell?: () => void;
}

function DoctrineDetail({ doctrine, slotIndex, accent, onUnequip, onUpgrade, onSell }: DoctrineDetailProps) {
  const color = FACTION_COLORS[doctrine.color];
  const level = doctrine.currentLevel;
  const upgradeCost = getUpgradeCost(doctrine);
  const upgradeCostEntries = upgradeCost
    ? (Object.entries(upgradeCost) as [ResourceType, number][]).filter(([, amt]) => amt > 0)
    : [];
  const canAffordUpgrade = upgradeCostEntries.every(
    ([res, amt]) => resourceValue(res) >= amt,
  );
  const isEquipped = slotIndex !== null;
  const purple = FACTION_COLORS.purple;

  return (
    <>
      {/* Header: school tag + slot/collection chip */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        <span style={{
          padding: '2px 9px',
          background: color, color: '#fff',
          borderRadius: 2,
          fontFamily: 'var(--imp-font-display)', fontSize: 'var(--imp-text-xs)', fontWeight: 700,
          letterSpacing: 1, textTransform: 'uppercase',
        }}>
          {doctrine.color} · {SCHOOL_NAMES[doctrine.color] ?? ''}
        </span>
        <span style={{
          fontSize: 'var(--imp-text-xs)', letterSpacing: 'var(--imp-meta-letter)',
          color: 'var(--imp-text-mid)', textTransform: 'uppercase',
          fontFamily: 'var(--imp-font-mono)',
        }}>
          {isEquipped ? `Slot ${slotIndex! + 1}` : 'In collection'}
        </span>
      </div>

      <div style={{
        fontFamily: 'var(--imp-font-display)',
        fontSize: 24, fontWeight: 500,
        color: 'var(--imp-text-hi)',
        letterSpacing: 'var(--imp-title-letter)', textTransform: 'uppercase',
        marginBottom: 12, lineHeight: 1.15,
      }}>
        {doctrine.name}
      </div>

      {/* Level track I → III */}
      <div style={{
        fontSize: 'var(--imp-text-xs)', letterSpacing: 'var(--imp-meta-letter)',
        color: 'var(--imp-text-mid)', textTransform: 'uppercase', marginBottom: 6,
      }}>
        Levels
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {doctrine.levels.map((tier, idx) => {
          const n = idx + 1;
          const state: 'done' | 'active' | 'next' | 'locked' =
            n < level ? 'done' : n === level ? 'active' : n === level + 1 ? 'next' : 'locked';
          const isNextUpgradable = state === 'next' && upgradeCost != null;
          return (
            <div key={n} style={{
              display: 'flex', gap: 10, alignItems: 'flex-start',
              padding: '9px 11px',
              background: state === 'active' ? `${color}14` : 'rgba(20, 18, 32, 0.6)',
              border: `1px solid ${state === 'active' ? `${color}88` : 'rgba(212, 168, 67, 0.15)'}`,
              borderRadius: 2,
              opacity: state === 'locked' || state === 'next' ? 0.75 : 1,
            }}>
              <span style={{
                width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--imp-font-mono)', fontSize: 10, fontWeight: 700,
                background: state === 'active' ? color : 'transparent',
                color: state === 'active' ? '#fff' : 'var(--imp-text-mid)',
                border: `1px solid ${state === 'active' ? color : 'rgba(212, 168, 67, 0.35)'}`,
              }}>
                {ROMAN[idx]}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 'var(--imp-text-sm)',
                  color: state === 'active' ? 'var(--imp-text-hi)' : 'var(--imp-text-mid)',
                  fontFamily: 'var(--imp-font-serif)', fontStyle: 'italic', lineHeight: 1.45,
                }}>
                  {tier.description}
                </div>
                {state === 'active' && (
                  <div style={{
                    fontFamily: 'var(--imp-font-mono)', fontSize: 9,
                    letterSpacing: 1, textTransform: 'uppercase', color, marginTop: 3,
                  }}>
                    Current level
                  </div>
                )}
                {isNextUpgradable && isEquipped && onUpgrade && (
                  <button
                    onClick={onUpgrade}
                    disabled={!canAffordUpgrade}
                    style={{ ...btnPrimary(accent, !canAffordUpgrade), marginTop: 7, padding: '5px 11px', fontSize: 'var(--imp-text-xs)' }}
                    title={!canAffordUpgrade ? 'Not enough resources' : 'Upgrade to next tier'}
                  >
                    Upgrade · <CostInline cost={upgradeCost!} iconSize="inline" />
                  </button>
                )}
                {isNextUpgradable && !isEquipped && (
                  <div style={{
                    fontFamily: 'var(--imp-font-mono)', fontSize: 9,
                    letterSpacing: 1, textTransform: 'uppercase', color: 'var(--imp-text-lo)', marginTop: 5,
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                  }}>
                    Equip to upgrade · <CostInline cost={upgradeCost!} iconSize="inline" />
                  </div>
                )}
              </div>
              {state === 'done' && (
                <span title="Level achieved" style={{ color, fontSize: 13, flexShrink: 0 }}>✓</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Campaign effect */}
      {CAMPAIGN_EFFECT_BY_COLOR[doctrine.color] && (
        <>
          <div style={{
            fontSize: 'var(--imp-text-xs)', letterSpacing: 'var(--imp-meta-letter)',
            color: 'var(--imp-text-mid)', textTransform: 'uppercase', margin: '12px 0 6px',
          }}>
            Campaign effect
          </div>
          <div style={{
            padding: '9px 11px',
            background: 'rgba(20, 18, 32, 0.6)',
            border: '1px solid rgba(212, 168, 67, 0.15)',
            borderLeft: `3px solid ${purple}`,
            borderRadius: 2,
            fontSize: 'var(--imp-text-sm)', color: 'var(--imp-text-mid)',
            fontFamily: 'var(--imp-font-serif)', fontStyle: 'italic', lineHeight: 1.5,
          }}>
            {CAMPAIGN_EFFECT_BY_COLOR[doctrine.color]}
          </div>
        </>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 'auto', paddingTop: 12 }}>
        {isEquipped && onUnequip && (
          <button onClick={onUnequip} style={btnOutline('var(--imp-text-mid)')}>
            Unequip
          </button>
        )}
        {!isEquipped && onSell && (
          <button onClick={onSell} style={btnOutline('#c24a3a')}>
            Sell · <ResourceAmount type="gold" amount={getDoctrineSellPrice(doctrine)} iconSize="inline" />
          </button>
        )}
      </div>
    </>
  );
}

// ── Helpers ──────────────────────────────────────────────────────

function resourceValue(type: ResourceType): number {
  switch (type) {
    case 'gold':      return gold.value;
    case 'iuniores':  return iuniores.value;
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
    fontSize: 'var(--imp-text-sm)', fontWeight: 700,
    letterSpacing: 'var(--imp-meta-letter)', textTransform: 'uppercase',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'var(--imp-font-display)',
  };
}

function btnOutline(color: string): preact.JSX.CSSProperties {
  return {
    padding: '6px 12px',
    background: 'transparent',
    border: '1px solid rgba(212, 168, 67, 0.35)',
    borderRadius: 2,
    color,
    fontSize: 'var(--imp-text-xs)',
    letterSpacing: 'var(--imp-meta-letter)', textTransform: 'uppercase',
    cursor: 'pointer',
    fontFamily: 'var(--imp-font-body)',
    fontWeight: 600,
  };
}
