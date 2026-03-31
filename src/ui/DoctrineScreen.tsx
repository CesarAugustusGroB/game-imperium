import { signal } from '@preact/signals';
import { navigateTo } from './screens';
import { selectedCommander } from '../game/game-state';
import { equippedDoctrines, doctrineCollection, equipDoctrine, unequipDoctrine, upgradeDoctrine, sellDoctrine } from '../game/doctrine-store';
import { isDoctrineEquippable, getDoctrineSellPrice } from '../game/doctrine';
import type { Doctrine } from '../game/doctrine';
import { DoctrineSlot } from './DoctrineRenderer';
import { FACTION_COLORS } from '../game/commander';

// ── One-time CSS injection ──
if (typeof document !== 'undefined' && !document.getElementById('doctrine-screen-styles')) {
  const el = document.createElement('style');
  el.id = 'doctrine-screen-styles';
  el.textContent = `
    .doctrine-coll-card {
      transition: all 0.2s ease;
      cursor: grab;
    }
    .doctrine-coll-card:hover {
      border-color: rgba(180, 160, 100, 0.5) !important;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
    }
    .doctrine-coll-card:active { cursor: grabbing; }
    .doctrine-coll-card.dragging {
      opacity: 0.35;
      transform: scale(0.95);
    }
    .doctrine-sell-btn {
      transition: all 0.15s ease;
      cursor: pointer;
    }
    .doctrine-sell-btn:hover {
      background: rgba(180, 60, 60, 0.4) !important;
      border-color: rgba(220, 100, 100, 0.5) !important;
      color: #e8a0a0 !important;
    }
    .doctrine-slot-drop {
      border-radius: 8px;
      transition: box-shadow 0.15s ease;
    }
    .doctrine-slot-drop.drag-over {
      box-shadow: 0 0 0 2px rgba(240, 208, 128, 0.7), 0 0 16px rgba(240, 208, 128, 0.2);
    }
  `;
  document.head.appendChild(el);
}

/** Which slot (0-3) is currently selected for equipping via click, or null. */
const equipTargetSlot = signal<number | null>(null);

/** ID of the doctrine currently being dragged from the collection. */
const draggedId = signal<string | null>(null);

/** Which equipped slot the drag is currently hovering over. */
const dragOverSlot = signal<number | null>(null);

export function DoctrineScreen() {
  const commander = selectedCommander.value;
  const faction = commander?.faction;
  const color = faction ? FACTION_COLORS[faction] : '#d4a843';
  const slots = equippedDoctrines.value;
  const collection = doctrineCollection.value;

  function handleEquipToSlot(slotIndex: number, doctrine: Doctrine) {
    equipDoctrine(slotIndex, doctrine);
    equipTargetSlot.value = null;
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
  }

  // Filter collection to equippable only (for the click-equip picker)
  const equippable = collection.filter(d => faction && isDoctrineEquippable(d, faction));

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      minHeight: '100vh', fontFamily: "'Segoe UI', system-ui, sans-serif",
      background: '#d8d0c8 url(/asset/marbel_background.png) center / contain no-repeat',
      paddingTop: '48px', paddingBottom: '32px',
    }}>
      {/* Dark content panel */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        background: 'rgba(12, 10, 24, 0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderRadius: '12px',
        border: '1px solid rgba(180, 160, 100, 0.15)',
        padding: '24px',
        maxWidth: '90%',
        width: 'min(680px, 90vw)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
      }}>
        {/* Title */}
        <div style={{
          fontSize: '20px', fontWeight: 600, color,
          letterSpacing: '4px', textTransform: 'uppercase', marginBottom: '4px',
        }}>
          Doctrines
        </div>
        <div style={{
          width: '60px', height: '1px', marginBottom: '20px',
          background: `linear-gradient(90deg, transparent, ${color}60, transparent)`,
        }} />

        {/* ── Equipped Slots ── */}
        <div style={{
          fontSize: '10px', color: 'rgba(180, 170, 150, 0.5)',
          letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '10px',
        }}>
          Equipped ({slots.filter(Boolean).length}/4)
        </div>

        <div style={{
          display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center',
          marginBottom: '24px',
        }}>
          {slots.map((doctrine, i) => (
            <div
              key={i}
              class={`doctrine-slot-drop${dragOverSlot.value === i ? ' drag-over' : ''}`}
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

        {/* ── Equip picker (shown when a slot is selected via click) ── */}
        {equipTargetSlot.value !== null && (
          <div style={{
            width: '100%', marginBottom: '20px',
            background: 'rgba(40, 36, 60, 0.6)',
            border: '1px solid rgba(180, 160, 100, 0.2)',
            borderRadius: '8px',
            padding: '14px',
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: '10px',
            }}>
              <span style={{
                fontSize: '10px', color: 'rgba(240, 208, 128, 0.7)',
                letterSpacing: '1.5px', textTransform: 'uppercase',
              }}>
                Choose for Slot #{(equipTargetSlot.value ?? 0) + 1}
              </span>
              <button
                onClick={() => { equipTargetSlot.value = null; }}
                style={{
                  background: 'transparent', border: '1px solid rgba(180, 160, 100, 0.2)',
                  borderRadius: '3px', color: 'rgba(200, 190, 160, 0.5)',
                  fontSize: '9px', letterSpacing: '1px', padding: '3px 8px',
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Cancel
              </button>
            </div>

            {equippable.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: '16px',
                color: 'rgba(180, 170, 150, 0.35)', fontSize: '11px',
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
                      background: 'rgba(30, 28, 48, 0.9)',
                      border: '1px solid rgba(180, 160, 100, 0.2)',
                      borderTop: `3px solid ${FACTION_COLORS[d.color]}`,
                      borderRadius: '5px',
                    }}
                  >
                    <div style={{
                      fontSize: '9px', fontWeight: 700, color: FACTION_COLORS[d.color],
                      letterSpacing: '0.8px', textTransform: 'uppercase',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      marginBottom: '4px',
                    }}>
                      {d.name}
                    </div>
                    <div style={{
                      fontSize: '9px', color: 'rgba(200, 190, 160, 0.5)', lineHeight: '1.4',
                    }}>
                      {d.levels[d.currentLevel - 1].description}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Collection ── */}
        <div style={{
          width: '100%',
          borderTop: '1px solid rgba(180, 160, 100, 0.1)',
          paddingTop: '16px',
        }}>
          <div style={{
            fontSize: '10px', color: 'rgba(180, 170, 150, 0.5)',
            letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px',
            textAlign: 'center',
          }}>
            Collection ({collection.length})
          </div>
          <div style={{
            fontSize: '9px', color: 'rgba(180, 170, 150, 0.3)',
            textAlign: 'center', marginBottom: '10px', fontStyle: 'italic',
          }}>
            Drag a doctrine onto a slot to equip it
          </div>

          {collection.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '20px',
              color: 'rgba(180, 170, 150, 0.3)', fontSize: '12px',
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
                      background: 'rgba(30, 28, 48, 0.8)',
                      border: `1px solid rgba(180, 160, 100, ${canEquip ? '0.2' : '0.1'})`,
                      borderTop: `3px solid ${FACTION_COLORS[d.color]}`,
                      borderRadius: '5px',
                      opacity: canEquip ? 1 : 0.55,
                      cursor: canEquip ? 'grab' : 'default',
                    }}
                  >
                    <div style={{
                      fontSize: '9px', fontWeight: 700, color: FACTION_COLORS[d.color],
                      letterSpacing: '0.8px', textTransform: 'uppercase',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      marginBottom: '4px',
                    }}>
                      {d.name}
                    </div>
                    <div style={{
                      fontSize: '9px', color: 'rgba(200, 190, 160, 0.5)', lineHeight: '1.4',
                      marginBottom: '8px',
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
                        fontSize: '9px', fontWeight: 600,
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
          onClick={() => { equipTargetSlot.value = null; navigateTo('hub'); }}
          style={{
            marginTop: '20px', padding: '10px 28px',
            background: 'rgba(50, 42, 20, 0.7)',
            border: '1px solid rgba(220, 190, 100, 0.4)',
            borderRadius: '4px',
            color: '#f0d080', fontFamily: 'inherit',
            fontSize: '12px', fontWeight: 600,
            letterSpacing: '1.5px', textTransform: 'uppercase',
            cursor: 'pointer', transition: 'all 0.2s ease',
          }}
        >
          Back to Hub
        </button>
      </div>
    </div>
  );
}
