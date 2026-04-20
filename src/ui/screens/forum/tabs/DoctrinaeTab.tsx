import { useSignal } from '@preact/signals';
import { selectedCommander } from '../../../../game/core/game-state';
import {
  equippedDoctrines, doctrineCollection,
  equipDoctrine, unequipDoctrine, upgradeDoctrine, sellDoctrine,
} from '../../../../game/items/doctrine-store';
import {
  isDoctrineEquippable, getDoctrineSellPrice, getUpgradeCost,
} from '../../../../game/items/doctrine';
import type { Doctrine } from '../../../../game/items/doctrine';
import { FACTION_COLORS } from '../../../../game/core/commander';
import type { ResourceType } from '../../../../game/core/commander';
import { gold, faith, influence, momentum } from '../../../../game/core/resources';
import { playSfx } from '../../../sound/sfx';
import { OrnatePanel } from '../../../components/OrnatePanel';
import { Corners } from '../../../components/motifs/Corners';
import { Masthead } from '../Masthead';
import { SectionHeader } from '../components/SectionHeader';

const ROMAN: readonly string[] = ['I', 'II', 'III'];
const RESOURCE_GLYPH: Record<ResourceType, string> = {
  gold: '⚜', faith: '✦', influence: '◈', momentum: '⚡',
};

export function DoctrinaeTab() {
  const selectedId = useSignal<string | null>(null);
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
          <OrnatePanel accent={accent}>
            <SectionHeader
              title="Equipped"
              accent={accent}
              right={<span style={{
                fontSize: 9, color: 'var(--imp-text-lo)',
                letterSpacing: 1, textTransform: 'uppercase',
              }}>
                Click to inspect
              </span>}
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {slots.map((d, i) => (
                <EquippedSlotCard
                  key={i}
                  doctrine={d}
                  slotIndex={i}
                  selected={d?.id === current?.doctrine.id}
                  accent={accent}
                  onSelect={() => d && handleSelect(d.id)}
                />
              ))}
            </div>
          </OrnatePanel>

          <OrnatePanel accent={accent}>
            <SectionHeader
              title="Collection"
              accent={accent}
              right={<span style={{
                fontSize: 9, color: 'var(--imp-text-lo)',
                letterSpacing: 1, textTransform: 'uppercase',
              }}>
                {collection.length} available
              </span>}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {collection.length === 0 && (
                <div style={{
                  padding: '10px 4px',
                  fontFamily: 'var(--imp-font-serif)',
                  fontStyle: 'italic', fontSize: 11,
                  color: 'var(--imp-text-lo)',
                }}>
                  No unequipped doctrines. Acquire them from events or rewards.
                </div>
              )}
              {collection.map((d) => (
                <CollectionRow
                  key={d.id}
                  doctrine={d}
                  canEquip={!!faction && isDoctrineEquippable(d, faction)}
                  hasEmptySlot={slots.some((s) => s === null)}
                  selected={d.id === current?.doctrine.id}
                  accent={accent}
                  onSelect={() => handleSelect(d.id)}
                  onEquip={() => handleEquip(d)}
                  onSell={() => handleSell(d.id)}
                />
              ))}
            </div>
          </OrnatePanel>
        </div>

        {/* ── RIGHT: Detail ── */}
        <OrnatePanel
          accent={accent}
          cornersSize={14}
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
        </OrnatePanel>
      </div>
    </>
  );
}

// ── EquippedSlotCard ─────────────────────────────────────────────

interface EquippedSlotCardProps {
  doctrine: Doctrine | null;
  slotIndex: number;
  selected: boolean;
  accent: string;
  onSelect: () => void;
}

function EquippedSlotCard({ doctrine, selected, accent, onSelect }: EquippedSlotCardProps) {
  if (!doctrine) {
    return (
      <div style={{
        aspectRatio: '3/2', position: 'relative',
        background: 'rgba(20, 18, 32, 0.3)',
        border: '1px dashed rgba(212, 168, 67, 0.15)',
        borderRadius: 2, padding: '12px 14px',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          color: 'var(--imp-text-lo)', gap: 4,
        }}>
          <div style={{ fontSize: 24 }}>+</div>
          <div style={{
            fontSize: 9, letterSpacing: 2, textTransform: 'uppercase',
            fontFamily: 'var(--imp-font-display)',
          }}>
            Empty slot
          </div>
        </div>
      </div>
    );
  }

  const color = FACTION_COLORS[doctrine.color];
  const romanLevel = ROMAN[doctrine.currentLevel - 1] ?? '·';
  const desc = doctrine.levels[doctrine.currentLevel - 1]?.description ?? '';

  return (
    <div
      onClick={onSelect}
      style={{
        aspectRatio: '3/2', position: 'relative',
        background: `linear-gradient(135deg, ${color}22 0%, rgba(20, 18, 32, 0.9) 100%)`,
        border: `1px solid ${selected ? accent : `${color}66`}`,
        borderRadius: 2, padding: '12px 14px',
        cursor: 'pointer',
        boxShadow: selected ? `0 0 0 1px ${accent}, 0 0 16px ${accent}50` : 'none',
        transition: 'all 200ms',
      }}
    >
      <Corners color={color} size={8} inset={3} thickness={1} />
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'flex-start', marginBottom: 8,
      }}>
        <div style={{
          fontFamily: 'var(--imp-font-display)',
          fontSize: 13, fontWeight: 600,
          color: 'var(--imp-text-hi)',
          letterSpacing: 1.5, textTransform: 'uppercase',
          lineHeight: 1.2,
        }}>
          {doctrine.name}
        </div>
        <div style={{
          fontFamily: 'var(--imp-font-display)',
          fontSize: 14, color, fontWeight: 700,
        }}>
          {romanLevel}
        </div>
      </div>
      <div style={{
        fontSize: 11,
        color: 'var(--imp-text-mid)',
        fontStyle: 'italic',
        fontFamily: 'var(--imp-font-serif)',
        lineHeight: 1.4,
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      }}>
        {desc}
      </div>
    </div>
  );
}

// ── CollectionRow ────────────────────────────────────────────────

interface CollectionRowProps {
  doctrine: Doctrine;
  canEquip: boolean;
  hasEmptySlot: boolean;
  selected: boolean;
  accent: string;
  onSelect: () => void;
  onEquip: () => void;
  onSell: () => void;
}

function CollectionRow({
  doctrine, canEquip, hasEmptySlot, selected,
  accent, onSelect, onEquip, onSell,
}: CollectionRowProps) {
  const color = FACTION_COLORS[doctrine.color];
  const desc = doctrine.levels[doctrine.currentLevel - 1]?.description ?? '';
  const canAdopt = canEquip && hasEmptySlot;
  const sellPrice = getDoctrineSellPrice(doctrine);

  return (
    <div
      onClick={onSelect}
      style={{
        padding: '10px 12px',
        background: selected
          ? 'rgba(80, 60, 20, 0.25)'
          : 'rgba(20, 18, 32, 0.5)',
        border: `1px solid ${selected ? accent : 'rgba(212, 168, 67, 0.15)'}`,
        borderLeft: `3px solid ${color}`,
        borderRadius: 2,
        display: 'flex', alignItems: 'center', gap: 10,
        cursor: 'pointer',
        transition: 'all 140ms',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: 'var(--imp-font-display)',
          fontSize: 12, color: 'var(--imp-text-hi)',
          letterSpacing: 1.5, textTransform: 'uppercase',
          fontWeight: 600,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {doctrine.name}
        </div>
        <div style={{
          fontSize: 10, color: 'var(--imp-text-mid)',
          fontStyle: 'italic',
          fontFamily: 'var(--imp-font-serif)',
          marginTop: 2,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {desc}
        </div>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onEquip(); }}
        disabled={!canAdopt}
        title={!canEquip ? 'Faction lock' : !hasEmptySlot ? 'All 4 slots are full' : 'Adopt into the first empty slot'}
        style={{
          padding: '5px 10px',
          background: canAdopt
            ? `linear-gradient(180deg, ${accent} 0%, #b8892a 100%)`
            : 'rgba(80, 70, 50, 0.3)',
          border: 'none',
          borderRadius: 2,
          color: canAdopt ? 'var(--imp-ink)' : 'var(--imp-text-lo)',
          fontSize: 9, fontWeight: 700,
          letterSpacing: 1.5, textTransform: 'uppercase',
          fontFamily: 'var(--imp-font-display)',
          cursor: canAdopt ? 'pointer' : 'not-allowed',
          flexShrink: 0,
        }}
      >
        Adopt
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onSell(); }}
        title={`Sell for ${sellPrice}⚜`}
        style={{
          padding: '5px 10px',
          background: 'transparent',
          border: '1px solid rgba(194, 74, 58, 0.4)',
          borderRadius: 2,
          color: '#c24a3a',
          fontSize: 9, fontWeight: 600,
          letterSpacing: 1.5, textTransform: 'uppercase',
          fontFamily: 'var(--imp-font-body)',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        Sell · {sellPrice}⚜
      </button>
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
  const romanLevel = ROMAN[level - 1] ?? '·';
  const currentTier = doctrine.levels[level - 1];
  const nextTier = level < 3 ? (doctrine.levels as readonly Doctrine['levels'][number][])[level] : null;
  const upgradeCost = getUpgradeCost(doctrine);
  const upgradeCostEntries = upgradeCost
    ? (Object.entries(upgradeCost) as [ResourceType, number][]).filter(([, amt]) => amt > 0)
    : [];
  const canAffordUpgrade = upgradeCostEntries.every(
    ([res, amt]) => resourceValue(res) >= amt,
  );
  const isEquipped = slotIndex !== null;

  return (
    <>
      <div style={{
        fontSize: 9, letterSpacing: 2.5,
        color: 'var(--imp-text-lo)',
        textTransform: 'uppercase', marginBottom: 4,
      }}>
        Tier {romanLevel} · {isEquipped ? 'Equipped' : 'In collection'}
      </div>
      <div style={{
        fontFamily: 'var(--imp-font-display)',
        fontSize: 26, fontWeight: 500,
        color: 'var(--imp-text-hi)',
        letterSpacing: 2, textTransform: 'uppercase',
        marginBottom: 6, lineHeight: 1.15,
      }}>
        {doctrine.name}
      </div>
      <div style={{
        fontFamily: 'var(--imp-font-serif)',
        fontStyle: 'italic', fontSize: 13,
        color: 'var(--imp-text-mid)',
        lineHeight: 1.5, marginBottom: 14,
      }}>
        "{currentTier?.description ?? ''}"
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr',
        gap: 8, marginBottom: 14,
      }}>
        <InfoBox label="Current effect" value={currentTier?.description ?? '—'} serif color={color} />
        <InfoBox
          label="Next tier"
          value={nextTier?.description ?? 'Max level reached'}
          serif
          color={nextTier ? accent : 'var(--imp-text-lo)'}
        />
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 'auto' }}>
        {isEquipped && onUpgrade && upgradeCost && (
          <button
            onClick={onUpgrade}
            disabled={!canAffordUpgrade}
            style={btnPrimary(accent, !canAffordUpgrade)}
            title={!canAffordUpgrade ? 'Not enough resources' : 'Upgrade to next tier'}
          >
            Upgrade · {upgradeCostEntries.map(([r, a]) => `${a}${RESOURCE_GLYPH[r]}`).join(' ')}
          </button>
        )}
        {isEquipped && !upgradeCost && (
          <button disabled style={btnPrimary(accent, true)}>
            Max tier
          </button>
        )}
        {isEquipped && onUnequip && (
          <button onClick={onUnequip} style={btnOutline('var(--imp-text-mid)')}>
            Unequip
          </button>
        )}
        {!isEquipped && onSell && (
          <button onClick={onSell} style={btnOutline('#c24a3a')}>
            Sell · {getDoctrineSellPrice(doctrine)}⚜
          </button>
        )}
      </div>
    </>
  );
}

function InfoBox({ label, value, color, serif }: { label: string; value: string; color: string; serif?: boolean }) {
  return (
    <div style={{
      padding: '10px 12px',
      background: 'rgba(20, 18, 32, 0.6)',
      border: '1px solid rgba(212, 168, 67, 0.15)',
      borderRadius: 2,
    }}>
      <div style={{
        fontSize: 9, letterSpacing: 1.5,
        color: 'var(--imp-text-lo)',
        textTransform: 'uppercase', marginBottom: 4,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 11,
        color,
        fontStyle: serif ? 'italic' : 'normal',
        fontFamily: serif ? 'var(--imp-font-serif)' : 'var(--imp-font-body)',
        lineHeight: 1.4,
      }}>
        {value}
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────

function resourceValue(type: ResourceType): number {
  switch (type) {
    case 'gold':      return gold.value;
    case 'faith':     return faith.value;
    case 'influence': return influence.value;
    case 'momentum':  return momentum.value;
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

function btnOutline(color: string): preact.JSX.CSSProperties {
  return {
    padding: '6px 12px',
    background: 'transparent',
    border: '1px solid rgba(212, 168, 67, 0.35)',
    borderRadius: 2,
    color,
    fontSize: 10,
    letterSpacing: 1.5, textTransform: 'uppercase',
    cursor: 'pointer',
    fontFamily: 'var(--imp-font-body)',
    fontWeight: 600,
  };
}
