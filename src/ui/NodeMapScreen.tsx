import { Fragment } from 'preact';
import { signal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { navigateTo } from './screens';
import { currentSpoke, currentNodeIndex, resetSpoke, advanceNode, completeSpoke, grantSpokeResource, spokeGains } from '../game/spoke';
import type { SpokeNode, NodeType } from '../game/spoke';
import { selectedCommander, completedSpokes } from '../game/game-state';
import { FACTION_COLORS, RESOURCE_INFO } from '../game/commander';
import type { ResourceType } from '../game/commander';
import { spendResource, canAfford } from '../game/resources';
import { NodeModal } from './NodeModal';
import { EVENTS } from '../data/events';
import type { GameEvent, EventChoice } from '../data/events';

// ── One-time CSS injection ──
if (typeof document !== 'undefined' && !document.getElementById('node-map-styles')) {
  const el = document.createElement('style');
  el.id = 'node-map-styles';
  el.textContent = `
    @keyframes node-pulse {
      0%, 100% { box-shadow: 0 0 12px var(--glow), 0 0 24px var(--glow); transform: scale(1); }
      50% { box-shadow: 0 0 20px var(--glow), 0 0 40px var(--glow); transform: scale(1.08); }
    }
    .node-circle { transition: all 0.25s ease; }
    .node-circle:hover { filter: brightness(1.15); }
    .node-current { animation: node-pulse 2s ease-in-out infinite; cursor: pointer; }
    .node-current:hover { transform: scale(1.12); }
    .node-resolved { opacity: 0.45; }
    .node-future { opacity: 0.35; cursor: default; }

    /* Retreat button hover */
    .retreat-btn { transition: all 0.2s ease; }
    .retreat-btn:hover {
      border-color: rgba(200, 80, 80, 0.4) !important;
      color: rgba(220, 180, 140, 0.7) !important;
      background: rgba(60, 36, 40, 0.9) !important;
    }
    .retreat-btn:active { transform: scale(0.97); }

    /* Event choice hover */
    .event-choice-btn { transition: all 0.2s ease; }
    .event-choice-btn:not(:disabled):hover {
      border-color: rgba(220, 190, 100, 0.5) !important;
      background: rgba(70, 70, 95, 0.7) !important;
    }
    .event-choice-btn:not(:disabled):active { transform: scale(0.98); }

    /* Modal action buttons */
    .modal-action-btn { transition: all 0.2s ease; }
    .modal-action-btn:hover {
      filter: brightness(1.2);
      box-shadow: 0 0 12px rgba(180, 160, 100, 0.15);
    }
    .modal-action-btn:active { transform: scale(0.97); }

    /* Retreat confirm buttons */
    .retreat-confirm-btn { transition: all 0.2s ease; }
    .retreat-confirm-btn:hover {
      border-color: rgba(220, 100, 100, 0.7) !important;
      background: rgba(200, 60, 60, 0.4) !important;
    }
    .retreat-confirm-btn:active { transform: scale(0.97); }

    .retreat-cancel-btn { transition: all 0.2s ease; }
    .retreat-cancel-btn:hover {
      border-color: rgba(220, 190, 100, 0.4) !important;
      color: #e0d8b8 !important;
    }
    .retreat-cancel-btn:active { transform: scale(0.97); }

    /* Thin scrollbar for node chain */
    .node-chain-scroll::-webkit-scrollbar {
      height: 4px;
    }
    .node-chain-scroll::-webkit-scrollbar-track {
      background: rgba(20, 18, 36, 0.5);
      border-radius: 2px;
    }
    .node-chain-scroll::-webkit-scrollbar-thumb {
      background: rgba(180, 160, 100, 0.2);
      border-radius: 2px;
    }
    .node-chain-scroll::-webkit-scrollbar-thumb:hover {
      background: rgba(180, 160, 100, 0.35);
    }

    /* Empty state link */
    .empty-state-btn { transition: all 0.2s ease; }
    .empty-state-btn:hover {
      border-color: rgba(220, 190, 100, 0.5) !important;
      color: #f0d080 !important;
    }
    .empty-state-btn:active { transform: scale(0.97); }
  `;
  document.head.appendChild(el);
}

// ── Icons per node type ──
const NODE_ICONS: Record<NodeType, string> = {
  battle: '\u2694\uFE0F',  // crossed swords
  rest:   '\uD83C\uDFD5\uFE0F',  // camping
  event:  '\uD83D\uDCDC',  // scroll
  boss:   '\uD83D\uDC80',  // skull
};

const NODE_LABELS: Record<NodeType, string> = {
  battle: 'Battle',
  rest: 'Rest',
  event: 'Event',
  boss: 'Boss',
};

// ── Modal state ──
const showRetreatConfirm = signal(false);
const showRestModal = signal(false);
const restGains = signal<{ type: ResourceType; actual: number }[]>([]);
const showEventModal = signal(false);
const activeEvent = signal<GameEvent | null>(null);
const showSpokeCompleteModal = signal(false);
const spokeBonusApplied = signal(false);

function NodeCircle({ node, isCurrent, color, onActivate }: {
  node: SpokeNode;
  isCurrent: boolean;
  color: string;
  onActivate: () => void;
}) {
  const stateClass = node.resolved ? 'node-resolved' : isCurrent ? 'node-current' : 'node-future';

  function handleClick() {
    if (!isCurrent || node.resolved) return;
    onActivate();
  }

  return (
    <div
      class={`node-circle ${stateClass}`}
      onClick={handleClick}
      role={isCurrent && !node.resolved ? 'button' : undefined}
      aria-label={isCurrent && !node.resolved ? `Activate ${NODE_LABELS[node.type]} node` : undefined}
      tabIndex={isCurrent && !node.resolved ? 0 : undefined}
      onKeyDown={isCurrent && !node.resolved ? (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onActivate(); } } : undefined}
      style={{
        '--glow': color + '60',
        width: '56px',
        height: '56px',
        borderRadius: '50%',
        background: node.resolved
          ? 'rgba(40, 38, 55, 0.9)'
          : isCurrent
            ? `linear-gradient(135deg, ${color}25, ${color}10)`
            : 'rgba(30, 28, 48, 0.9)',
        border: `2px solid ${isCurrent ? color : node.resolved ? 'rgba(100, 100, 100, 0.3)' : 'rgba(180, 160, 100, 0.15)'}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        flexShrink: '0',
        outline: 'none',
      } as Record<string, string>}
    >
      {/* Icon */}
      <span style={{ fontSize: '20px', lineHeight: '1' }}>
        {node.resolved ? '\u2714' : NODE_ICONS[node.type]}
      </span>

      {/* Label below circle */}
      <div style={{
        position: 'absolute',
        bottom: '-20px',
        fontSize: '9px',
        letterSpacing: '1px',
        textTransform: 'uppercase',
        color: isCurrent ? color : 'rgba(180, 170, 150, 0.4)',
        whiteSpace: 'nowrap',
        fontWeight: isCurrent ? '600' : '400',
      }}>
        {NODE_LABELS[node.type]}
      </div>
    </div>
  );
}

function ConnectingLine({ resolved, color }: { resolved: boolean; color: string }) {
  return (
    <div style={{
      width: '48px',
      height: '2px',
      background: resolved
        ? 'rgba(100, 100, 100, 0.25)'
        : `linear-gradient(90deg, ${color}50, ${color}25)`,
      flexShrink: 0,
      alignSelf: 'center',
    }} />
  );
}

function RetreatConfirmModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  // Escape key handler
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Retreat confirmation"
      style={{
        position: 'fixed', inset: '0', zIndex: '200',
        background: 'rgba(0, 0, 0, 0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        animation: 'node-modal-fade 0.2s ease-out',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div style={{
        background: 'linear-gradient(135deg, rgba(30, 28, 48, 0.98), rgba(20, 18, 36, 0.99))',
        border: '1px solid rgba(180, 160, 100, 0.25)',
        borderRadius: '8px', padding: '28px 32px',
        maxWidth: '360px', width: '90%', textAlign: 'center',
      }}>
        <div style={{
          fontSize: '16px', fontWeight: 600, color: '#f0d080',
          letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px',
        }}>
          Retreat?
        </div>
        <div style={{
          fontSize: '13px', color: 'rgba(200, 190, 160, 0.6)',
          lineHeight: '1.5', marginBottom: '20px',
        }}>
          You'll keep your army and resources, but forfeit all remaining spoke rewards.
        </div>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <button
            class="retreat-confirm-btn"
            onClick={onConfirm}
            style={{
              padding: '10px 20px', borderRadius: '4px', cursor: 'pointer',
              background: 'rgba(180, 60, 60, 0.3)', border: '1px solid rgba(200, 80, 80, 0.5)',
              color: '#e0a0a0', fontFamily: 'inherit', fontSize: '13px', fontWeight: 600,
              letterSpacing: '1px',
            }}
          >
            Confirm Retreat
          </button>
          <button
            class="retreat-cancel-btn"
            onClick={onCancel}
            style={{
              padding: '10px 20px', borderRadius: '4px', cursor: 'pointer',
              background: 'rgba(60, 60, 80, 0.6)', border: '1px solid rgba(180, 160, 100, 0.25)',
              color: '#d0c8a8', fontFamily: 'inherit', fontSize: '13px',
              letterSpacing: '1px',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export function NodeMapScreen() {
  const spoke = currentSpoke.value;
  const nodeIdx = currentNodeIndex.value;
  const commander = selectedCommander.value;
  const color = commander ? FACTION_COLORS[commander.faction] : '#f0d080';
  const spokeComplete = spoke ? nodeIdx >= spoke.nodes.length : false;

  // Empty state with navigation fallback
  if (!spoke) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: '100vh', fontFamily: "'Segoe UI', system-ui, sans-serif",
        background: 'radial-gradient(ellipse at 50% 40%, rgba(30, 28, 50, 0.92), rgba(8, 8, 18, 0.97))',
        gap: '16px',
      }}>
        <div style={{
          color: 'rgba(200, 190, 160, 0.5)', fontSize: '14px',
          letterSpacing: '1px',
        }}>
          No active spoke
        </div>
        <button
          class="empty-state-btn"
          onClick={() => navigateTo('hub')}
          style={{
            padding: '10px 24px', borderRadius: '4px', cursor: 'pointer',
            background: 'rgba(60, 60, 80, 0.6)',
            border: '1px solid rgba(180, 160, 100, 0.25)',
            color: '#d0c8a8', fontFamily: 'inherit', fontSize: '13px',
            fontWeight: 600, letterSpacing: '1px',
          }}
        >
          Return to Hub
        </button>
      </div>
    );
  }

  function handleRetreat() {
    showRetreatConfirm.value = false;
    // TODO S6: threatLevel.value += 1 — retreating should have consequences
    resetSpoke();
    navigateTo('hub');
  }

  function handleNodeActivate(node: SpokeNode) {
    if (node.type === 'battle' || node.type === 'boss') {
      navigateTo('battle');
    } else if (node.type === 'rest') {
      openRestModal();
    } else if (node.type === 'event') {
      openEventModal();
    }
  }

  function openRestModal() {
    const faction = commander?.faction;
    const types: ResourceType[] = ['gold', 'faith', 'influence', 'momentum'];
    const gains = types.map((type) => ({
      type,
      actual: grantSpokeResource(type, 1, faction),
    }));
    restGains.value = gains;
    showRestModal.value = true;
  }

  function handleRestContinue() {
    showRestModal.value = false;
    advanceNode();
  }

  function openEventModal() {
    // Deterministic pick by node position
    const event = EVENTS[nodeIdx % EVENTS.length];
    activeEvent.value = event;
    showEventModal.value = true;
  }

  function handleEventChoice(choice: EventChoice) {
    const faction = commander?.faction;
    for (const effect of choice.effects) {
      if (effect.amount > 0) {
        grantSpokeResource(effect.resource, effect.amount, faction);
      } else if (effect.amount < 0) {
        spendResource(effect.resource, Math.abs(effect.amount));
      }
    }
    showEventModal.value = false;
    activeEvent.value = null;
    advanceNode();
  }

  function canAffordChoice(choice: EventChoice): boolean {
    return choice.effects.every((e) =>
      e.amount >= 0 || canAfford(e.resource, Math.abs(e.amount))
    );
  }

  // Apply completion bonus once when spoke finishes
  if (spokeComplete && !spokeBonusApplied.value) {
    const faction = commander?.faction;
    grantSpokeResource('gold', 3, faction);
    grantSpokeResource('faith', 2, faction);
    grantSpokeResource('influence', 2, faction);
    grantSpokeResource('momentum', 2, faction);
    spokeBonusApplied.value = true;
    showSpokeCompleteModal.value = true;
  }

  function handleReturnToHub() {
    showSpokeCompleteModal.value = false;
    spokeBonusApplied.value = false;
    completedSpokes.value += 1;
    completeSpoke();
    navigateTo('hub');
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100vh', fontFamily: "'Segoe UI', system-ui, sans-serif",
      background: 'radial-gradient(ellipse at 50% 40%, rgba(30, 28, 50, 0.92), rgba(8, 8, 18, 0.97))',
      paddingTop: '38px', // leave room for ResourceBar
    }}>
      {/* Spoke label */}
      <div style={{
        fontSize: '14px', fontWeight: 600, color,
        letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '8px',
        textShadow: `0 2px 8px ${color}30`,
      }}>
        {spoke.label}
      </div>

      {/* Progress text */}
      <div style={{
        fontSize: '11px', color: 'rgba(180, 170, 150, 0.4)',
        letterSpacing: '1px', marginBottom: '40px',
      }}>
        Node {Math.min(nodeIdx + 1, spoke.nodes.length)} of {spoke.nodes.length}
      </div>

      {/* Node chain */}
      <div
        class="node-chain-scroll"
        style={{
          display: 'flex', alignItems: 'center', gap: '0',
          padding: '0 24px 8px', maxWidth: '100%', overflowX: 'auto',
        }}
      >
        {spoke.nodes.map((node, i) => (
          <Fragment key={node.id}>
            {i > 0 && (
              <ConnectingLine
                resolved={spoke.nodes[i - 1].resolved}
                color={color}
              />
            )}
            <NodeCircle
              node={node}
              isCurrent={i === nodeIdx}
              color={color}
              onActivate={() => handleNodeActivate(node)}
            />
          </Fragment>
        ))}
      </div>

      {/* Current node hint */}
      {!spokeComplete && (
        <div style={{
          marginTop: '40px', fontSize: '12px',
          color: 'rgba(180, 170, 150, 0.4)', letterSpacing: '1px',
        }}>
          Click the active node to proceed
        </div>
      )}

      {/* Retreat button */}
      <button
        class="retreat-btn"
        onClick={() => { showRetreatConfirm.value = true; }}
        style={{
          position: 'fixed', bottom: '20px', left: '20px',
          padding: '10px 18px', borderRadius: '4px', cursor: 'pointer',
          background: 'rgba(40, 36, 60, 0.9)',
          border: '1px solid rgba(180, 160, 100, 0.2)',
          color: 'rgba(200, 180, 140, 0.5)',
          fontFamily: 'inherit', fontSize: '12px', letterSpacing: '1px',
        }}
      >
        Retreat
      </button>

      {/* Rest modal */}
      {showRestModal.value && (
        <NodeModal title="Your Army Rests" onClose={handleRestContinue}>
          <div style={{
            fontSize: '13px', color: 'rgba(200, 190, 160, 0.6)',
            lineHeight: '1.5', marginBottom: '16px',
          }}>
            Your forces recover their strength.
          </div>
          <div style={{
            display: 'flex', gap: '12px', justifyContent: 'center',
            flexWrap: 'wrap', marginBottom: '20px',
          }}>
            {restGains.value.map((g) => (
              <span key={g.type} style={{
                fontSize: '13px', fontWeight: 600,
                color: RESOURCE_INFO[g.type].color,
              }}>
                {RESOURCE_INFO[g.type].icon} +{g.actual} {RESOURCE_INFO[g.type].label}
              </span>
            ))}
          </div>
          <button
            class="modal-action-btn"
            onClick={handleRestContinue}
            style={{
              padding: '10px 24px', borderRadius: '4px', cursor: 'pointer',
              background: `linear-gradient(135deg, ${color}30, ${color}15)`,
              border: `1px solid ${color}60`,
              color, fontFamily: 'inherit', fontSize: '13px', fontWeight: 600,
              letterSpacing: '1px',
            }}
          >
            Continue
          </button>
        </NodeModal>
      )}

      {/* Event modal — backdrop click does NOT advance; player must choose */}
      {showEventModal.value && activeEvent.value && (
        <NodeModal title={activeEvent.value.title} onClose={() => { /* no-op: force a choice */ }}>
          <div style={{
            fontSize: '13px', color: 'rgba(200, 190, 160, 0.6)',
            lineHeight: '1.5', marginBottom: '20px',
          }}>
            {activeEvent.value.description}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {activeEvent.value.choices.map((choice, i) => {
              const affordable = canAffordChoice(choice);
              return (
                <button
                  class="event-choice-btn"
                  key={i}
                  onClick={() => affordable && handleEventChoice(choice)}
                  disabled={!affordable}
                  style={{
                    padding: '10px 16px', borderRadius: '4px',
                    cursor: affordable ? 'pointer' : 'default',
                    background: affordable ? 'rgba(60, 60, 80, 0.6)' : 'rgba(30, 30, 40, 0.4)',
                    border: `1px solid ${affordable ? 'rgba(180, 160, 100, 0.3)' : 'rgba(80, 80, 80, 0.2)'}`,
                    color: affordable ? '#d0c8a8' : 'rgba(120, 110, 100, 0.4)',
                    fontFamily: 'inherit', fontSize: '13px',
                    textAlign: 'left',
                    opacity: affordable ? 1 : 0.5,
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: choice.effects.length ? '4px' : '0' }}>
                    {choice.text}
                  </div>
                  {choice.effects.length > 0 && (
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', fontSize: '11px' }}>
                      {choice.effects.map((e, j) => (
                        <span key={j} style={{
                          color: e.amount > 0 ? RESOURCE_INFO[e.resource].color : '#c66',
                          fontWeight: 600,
                        }}>
                          {RESOURCE_INFO[e.resource].icon} {e.amount > 0 ? '+' : ''}{e.amount} {RESOURCE_INFO[e.resource].label}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </NodeModal>
      )}

      {/* Spoke completion summary modal */}
      {showSpokeCompleteModal.value && (
        <NodeModal title={`${spoke.label} \u2014 Complete!`} onClose={handleReturnToHub}>
          {(() => {
            const battlesWon = spoke.nodes.filter((n) => (n.type === 'battle' || n.type === 'boss') && n.resolved).length;
            const gains = spokeGains.value;
            const allTypes: ResourceType[] = ['gold', 'faith', 'influence', 'momentum'];
            return (
              <>
                <div style={{
                  display: 'flex', gap: '16px', justifyContent: 'center',
                  marginBottom: '16px', fontSize: '12px', color: 'rgba(180, 170, 150, 0.5)',
                }}>
                  <span>{spoke.nodes.length} nodes resolved</span>
                  <span>{battlesWon} battles won</span>
                </div>
                <div style={{
                  fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase',
                  color: 'rgba(180, 170, 150, 0.35)', marginBottom: '8px',
                }}>
                  Total Gains
                </div>
                <div style={{
                  display: 'flex', gap: '12px', justifyContent: 'center',
                  flexWrap: 'wrap', marginBottom: '20px',
                }}>
                  {allTypes.map((t) => gains[t] > 0 && (
                    <span key={t} style={{
                      fontSize: '13px', fontWeight: 600,
                      color: RESOURCE_INFO[t].color,
                    }}>
                      {RESOURCE_INFO[t].icon} +{gains[t]} {RESOURCE_INFO[t].label}
                    </span>
                  ))}
                </div>
                <button
                  class="modal-action-btn"
                  onClick={handleReturnToHub}
                  style={{
                    padding: '10px 24px', borderRadius: '4px', cursor: 'pointer',
                    background: `linear-gradient(135deg, ${color}30, ${color}15)`,
                    border: `1px solid ${color}60`,
                    color, fontFamily: 'inherit', fontSize: '13px', fontWeight: 600,
                    letterSpacing: '1px',
                  }}
                >
                  Return to Hub
                </button>
              </>
            );
          })()}
        </NodeModal>
      )}

      {/* Retreat confirmation modal */}
      {showRetreatConfirm.value && (
        <RetreatConfirmModal
          onConfirm={handleRetreat}
          onCancel={() => { showRetreatConfirm.value = false; }}
        />
      )}
    </div>
  );
}
