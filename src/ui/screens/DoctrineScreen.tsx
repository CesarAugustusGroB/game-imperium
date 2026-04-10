import { signal } from '@preact/signals';
import { navigateTo } from '../screens';
import { selectedCommander } from '../../game/core/game-state';
import { playSfx } from '../sound/sfx';
import { equippedDoctrines, doctrineCollection, equipDoctrine, unequipDoctrine, upgradeDoctrine, sellDoctrine } from '../../game/items/doctrine-store';
import { isDoctrineEquippable, getDoctrineSellPrice } from '../../game/items/doctrine';
import type { Doctrine } from '../../game/items/doctrine';
import { DoctrineSlot } from '../components/DoctrineRenderer';
import { FACTION_COLORS } from '../../game/core/commander';
import { OrnateFrame, OrnateHeader } from '../components/OrnateFrame';

// ── One-time CSS injection ──
if (typeof document !== 'undefined' && !document.getElementById('doctrine-screen-styles')) {
  const el = document.createElement('style');
  el.id = 'doctrine-screen-styles';
  el.textContent = `
    .doctrine-coll-card {
      transition: all var(--duration-normal) var(--ease-default);
      cursor: grab;
    }
    .doctrine-coll-card:hover {
      border-color: var(--color-gold-primary) !important;
      box-shadow: var(--shadow-md);
    }
    .doctrine-coll-card:active { cursor: grabbing; }
    .doctrine-coll-card.dragging {
      opacity: 0.35;
      transform: scale(0.95);
    }
    .doctrine-sell-btn {
      transition: all var(--duration-fast) var(--ease-default);
      cursor: pointer;
    }
    .doctrine-sell-btn:hover {
      background: rgba(180, 60, 60, 0.4) !important;
      border-color: rgba(220, 100, 100, 0.5) !important;
      color: #e8a0a0 !important;
    }
    .doctrine-slot-drop {
      border-radius: var(--radius-md);
      border: 1px solid var(--color-gold-secondary);
      transition: box-shadow var(--duration-fast) var(--ease-default);
    }
    .doctrine-slot-drop.drag-over {
      box-shadow: 0 0 0 2px rgba(240, 208, 128, 0.7), 0 0 16px rgba(240, 208, 128, 0.2);
    }
    @keyframes equip-flash {
      0% { box-shadow: 0 0 0 0 rgba(240,208,128,0); }
      30% { box-shadow: 0 0 20px 6px rgba(240,208,128,0.5); }
      100% { box-shadow: 0 0 0 0 rgba(240,208,128,0); }
    }
    .doctrine-slot-equipped { animation: equip-flash 0.4s ease-out; }
  `;
  document.head.appendChild(el);
}

/** Which slot (0-3) is currently selected for equipping via click, or null. */
const equipTargetSlot = signal<number | null>(null);

/** ID of the doctrine currently being dragged from the collection. */
const draggedId = signal<string | null>(null);

/** Which equipped slot the drag is currently hovering over. */
const dragOverSlot = signal<number | null>(null);

/** Index of the slot that was most recently equipped (for flash animation). */
const lastEquippedSlot = signal<number | null>(null);

export function DoctrineScreen() {
  const commander = selectedCommander.value;
  const faction = commander?.faction;
  const slots = equippedDoctrines.value;
  const collection = doctrineCollection.value;

  function handleEquipToSlot(slotIndex: number, doctrine: Doctrine) {
    playSfx('ui_equip');
    equipDoctrine(slotIndex, doctrine);
    equipTargetSlot.value = null;
    lastEquippedSlot.value = slotIndex;
    setTimeout(() => { lastEquippedSlot.value = null; }, 500);
  }

  function handleUnequip(slotIndex: number) {
    unequipDoctrine(slotIndex);
  }

  function handleUpgrade(slotIndex: number) {
    upgradeDoctrine(slotIndex);
  }

  function handleSell(doctrineId: string) {
    sellDoctrine(doctrineId);
  }

  // ── Drag handlers ──
  function handleDragStart(e: DragEvent, doctrineId: string) {
    draggedId.value = doctrineId;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', doctrineId);
    }
  }

  function handleDragEnd() {
    draggedId.value = null;
    dragOverSlot.value = null;
  }

  function handleSlotDragOver(e: DragEvent, slotIndex: number) {
    if (!draggedId.value) return;
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
    const id = draggedId.value ?? e.dataTransfer?.getData('text/plain') ?? null;
    if (!id) return;
    const doctrine = collection.find(d => d.id === id);
    if (!doctrine) return;
    if (faction && !isDoctrineEquippable(doctrine, faction)) return;
    equipDoctrine(slotIndex, doctrine);
    draggedId.value = null;
    lastEquippedSlot.value = slotIndex;
    setTimeout(() => { lastEquippedSlot.value = null; }, 500);
  }

  // Filter collection to equippable only (for the click-equip picker)
  const equippable = collection.filter(d => faction && isDoctrineEquippable(d, faction));

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      minHeight: '100vh', fontFamily: 'var(--font-family)',
      background: '#d8d0c8 url(/asset/marbel_background.png) center / contain no-repeat',
      paddingTop: '48px', paddingBottom: '32px',
    }}>
      {/* Ornate content panel */}
      <OrnateFrame width="min(720px, 94vw)" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <OrnateHeader
          eyebrow="Doctrines"
          title="STRATAGEMS"
          rightSlot={
            <span class="ornate-stat-chip" title="Equipped">EQUIPPED <strong>{slots.filter(Boolean).length}/4</strong></span>
          }
          onClose={() => { equipTargetSlot.value = null; navigateTo('hub'); }}
        />

        {/* ── Equipped Slots ── */}
        <div style={{
          display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center',
          marginBottom: '24px',
        }}>
          {slots.map((doctrine, i) => (
            <div
              key={i}
              class={`doctrine-slot-drop${dragOverSlot.value === i ? ' drag-over' : ''}${lastEquippedSlot.value === i ? ' doctrine-slot-equipped' : ''}`}
              onDragOver={(e) => handleSlotDragOver(e as unknown as DragEvent, i)}
              onDragLeave={handleSlotDragLeave}
              onDrop={(e) => handleSlotDrop(e as unknown as DragEvent, i)}
            >
              <DoctrineSlot
                doctrine={doctrine}
                slot={i}
                equippable={true}
                onUpgrade={doctrine ? () => handleUpgrade(i) : undefined}
                onUnequip={doctrine ? () => handleUnequip(i) : undefined}
                onEquip={!doctrine ? () => { equipTargetSlot.value = i; } : undefined}
              />
            </div>
          ))}
        </div>

        {/* ── Collection ── */}
        <div style={{
          width: '100%',
          borderTop: '1px solid var(--color-border-subtle)',
          paddingTop: '16px',
        }}>
          <div style={{
            fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)',
            letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px',
            textAlign: 'center',
          }}>
            Collection ({collection.length})
          </div>
          <div style={{
            fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)',
            textAlign: 'center', marginBottom: '10px', fontStyle: 'italic',
          }}>
            Drag a doctrine onto a slot to equip it
          </div>

          {collection.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '20px',
              color: 'var(--color-text-muted)', fontSize: 'var(--font-size-md)',
              fontStyle: 'italic',
            }}>
              No doctrines in collection. Acquire them from events or rewards.
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
              {collection.map(d => {
                const canEquip = faction ? isDoctrineEquippable(d, faction) : false;
                const isDragging = draggedId.value === d.id;
                return (
                  <div
                    key={d.id}
                    class={`doctrine-coll-card${isDragging ? ' dragging' : ''}`}
                    draggable={canEquip}
                    onDragStart={canEquip ? (e) => handleDragStart(e as unknown as DragEvent, d.id) : undefined}
                    onDragEnd={handleDragEnd}
                    style={{
                      width: '130px', padding: '10px',
                      background: `rgba(30, 28, 48, ${canEquip ? '0.8' : '0.45'})`,
                      border: `1px solid rgba(180, 160, 100, ${canEquip ? '0.2' : '0.06'})`,
                      borderTop: `3px solid ${FACTION_COLORS[d.color]}`,
                      borderRadius: '5px',
                      cursor: canEquip ? 'grab' : 'default',
                    }}
                  >
                    <div style={{
                      fontSize: 'var(--font-size-xs)', fontWeight: 700, color: canEquip ? FACTION_COLORS[d.color] : `${FACTION_COLORS[d.color]}88`,
                      letterSpacing: '0.8px', textTransform: 'uppercase',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      marginBottom: '4px',
                    }}>
                      {d.name}
                    </div>
                    <div style={{
                      fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: '1.4',
                      marginBottom: '8px',
                      opacity: canEquip ? 1 : 0.45,
                    }}>
                      {d.levels[d.currentLevel - 1].description}
                    </div>
                    <button
                      class="doctrine-sell-btn"
                      onClick={() => handleSell(d.id)}
                      style={{
                        width: '100%', padding: '3px 0',
                        background: 'rgba(60, 30, 30, 0.4)',
                        border: '1px solid rgba(180, 100, 100, 0.2)',
                        borderRadius: '3px',
                        color: 'rgba(200, 160, 160, 0.6)',
                        fontSize: 'var(--font-size-xs)', fontWeight: 600,
                        letterSpacing: '0.8px', fontFamily: 'inherit',
                      }}
                    >
                      Sell ({getDoctrineSellPrice(d)}g)
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Back button */}
        <button
          class="ornate-btn"
          onClick={() => { equipTargetSlot.value = null; navigateTo('hub'); }}
          style={{ marginTop: '20px', padding: '10px 28px', fontSize: 'var(--font-size-md)' }}
        >
          Back to Hub
        </button>
      </OrnateFrame>

      {/* ── Doctrine Picker Modal ── */}
      {equipTargetSlot.value !== null && (
        <div
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.65)',
            zIndex: 200,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={() => { equipTargetSlot.value = null; }}
        >
          <div
            style={{
              background: 'var(--color-bg-primary)',
              border: '1px solid var(--color-border-default)',
              borderRadius: 'var(--radius-lg)',
              padding: '20px',
              width: 'min(560px, 92vw)',
              maxHeight: '80vh',
              overflowY: 'auto',
              boxShadow: 'var(--shadow-lg)',
            }}
            onClick={(e: MouseEvent) => e.stopPropagation()}
          >
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: '14px',
            }}>
              <span style={{
                fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)',
                letterSpacing: '1.5px', textTransform: 'uppercase',
              }}>
                Choose for Slot #{(equipTargetSlot.value ?? 0) + 1}
              </span>
              <button
                onClick={() => { equipTargetSlot.value = null; }}
                style={{
                  background: 'transparent', border: '1px solid var(--color-border-default)',
                  borderRadius: '3px', color: 'var(--color-text-secondary)',
                  fontSize: 'var(--font-size-xs)', letterSpacing: '1px', padding: '3px 8px',
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Cancel
              </button>
            </div>

            {equippable.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: '16px',
                color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)',
                letterSpacing: '1px',
              }}>
                No equippable doctrines in collection
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                {equippable.map(d => (
                  <div
                    key={d.id}
                    class="doctrine-coll-card"
                    onClick={() => handleEquipToSlot(equipTargetSlot.value!, d)}
                    style={{
                      width: '120px', padding: '10px',
                      background: 'var(--color-bg-secondary)',
                      border: '1px solid var(--color-border-default)',
                      borderTop: `3px solid ${FACTION_COLORS[d.color]}`,
                      borderRadius: '5px',
                    }}
                  >
                    <div style={{
                      fontSize: 'var(--font-size-xs)', fontWeight: 700, color: FACTION_COLORS[d.color],
                      letterSpacing: '0.8px', textTransform: 'uppercase',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      marginBottom: '4px',
                    }}>
                      {d.name}
                    </div>
                    <div style={{
                      fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: '1.4',
                    }}>
                      {d.levels[d.currentLevel - 1].description}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
