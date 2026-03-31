import { signal } from '@preact/signals';
import { navigateTo } from './screens';
import { selectedCommander } from '../game/game-state';
import { FACTION_COLORS } from '../game/commander';
import { getCurrentTier, getCurrentPassive, getXpToNextTier, XP_TIER_2, XP_TIER_3 } from '../game/advisor';
import type { Advisor, AdvisorPassive } from '../game/advisor';
import type { NodeType } from '../game/spoke';
import {
  councilSlots,
  advisorPool,
  seatAdvisor,
  unseatAdvisor,
  startSpokeFromCouncil,
  generateSpokeFromCouncil,
} from '../game/council-store';

// ── One-time CSS injection ──
if (typeof document !== 'undefined' && !document.getElementById('council-screen-styles')) {
  const el = document.createElement('style');
  el.id = 'council-screen-styles';
  el.textContent = `
    .council-advisor-card {
      transition: all 0.2s ease;
      cursor: pointer;
    }
    .council-advisor-card:hover {
      border-color: rgba(180, 160, 100, 0.5) !important;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
      transform: translateY(-1px);
    }
    .council-advisor-card:active { transform: scale(0.97); }
    .council-slot-empty {
      transition: all 0.2s ease;
      cursor: pointer;
    }
    .council-slot-empty:hover {
      border-color: rgba(180, 160, 100, 0.4) !important;
      background: rgba(30, 26, 50, 0.6) !important;
    }
    .council-dismiss-btn {
      transition: all 0.15s ease;
      cursor: pointer;
    }
    .council-dismiss-btn:hover {
      background: rgba(180, 60, 60, 0.35) !important;
      border-color: rgba(220, 100, 100, 0.5) !important;
      color: #e8a0a0 !important;
    }
  `;
  document.head.appendChild(el);
}

/** Which slot (0-2) is currently awaiting an advisor pick, or null. */
const equipTargetSlot = signal<number | null>(null);

// ── Roman numerals ──
const ROMAN: Record<1 | 2 | 3, string> = { 1: 'I', 2: 'II', 3: 'III' };

// ── Node type colors/icons for spoke preview ──
const SPOKE_NODE_STYLES: Record<NodeType, { color: string; icon: string }> = {
  battle: { color: '#e06040', icon: '\u2694\uFE0F' },
  rest:   { color: '#40b868', icon: '\uD83C\uDFD5\uFE0F' },
  event:  { color: '#d4a843', icon: '\uD83D\uDCDC' },
  boss:   { color: '#c05050', icon: '\uD83D\uDC80' },
};

/** Human-readable description of an advisor passive. */
function describePassive(passive: AdvisorPassive): string {
  switch (passive.type) {
    case 'resource-per-spoke':
      return `+${passive.amount} ${passive.resource} per spoke`;
    case 'upkeep-reduction':
      return `Upkeep reduced by ${passive.percent}%`;
    case 'shop-discount':
      return `${passive.percent}% shop discount`;
    case 'extra-event-choices':
      return `+${passive.count} extra event choice${passive.count > 1 ? 's' : ''}`;
    case 'heal-between-nodes':
      return `Heal ${passive.amount} HP between nodes`;
    case 'threat-reduction':
      return `Threat reduced by ${passive.amount} per spoke`;
    case 'loot-bonus':
      return `+${passive.percent}% loot bonus`;
    default:
      return '';
  }
}

/** XP progress fraction [0,1] toward next tier. */
function xpProgress(advisor: Advisor): number {
  if (advisor.currentTier >= 3) return 1;
  const start = advisor.currentTier === 1 ? 0 : XP_TIER_2;
  const end = advisor.currentTier === 1 ? XP_TIER_2 : XP_TIER_3;
  return Math.min(1, (advisor.xp - start) / (end - start));
}

export function CouncilScreen() {
  const commander = selectedCommander.value;
  const faction = commander?.faction;
  const color = faction ? FACTION_COLORS[faction] : '#d4a843';

  const slots = councilSlots.value;
  const pool = advisorPool.value;
  const seatedCount = slots.filter(Boolean).length;
  const targetSlot = equipTargetSlot.value;

  // Spoke preview — only compute when at least 1 advisor is seated
  let spokePreview = seatedCount > 0 ? generateSpokeFromCouncil() : null;

  function handlePickAdvisor(advisor: Advisor) {
    if (targetSlot === null) return;
    seatAdvisor(targetSlot, advisor);
    equipTargetSlot.value = null;
  }

  function handleDismiss(slotIndex: number) {
    unseatAdvisor(slotIndex);
  }

  function handleEmbark() {
    startSpokeFromCouncil();
    navigateTo('node-map');
  }

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
        width: 'min(800px, 90vw)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
      }}>

        {/* Title */}
        <div style={{
          fontSize: '20px', fontWeight: 600, color,
          letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '4px',
          textShadow: `0 2px 8px ${color}30`,
        }}>
          Council
        </div>
        <div style={{
          width: '60px', height: '1px', marginBottom: '20px',
          background: `linear-gradient(90deg, transparent, ${color}60, transparent)`,
        }} />

        {/* Slot label */}
        <div style={{
          fontSize: '10px', color: 'rgba(180, 170, 150, 0.5)',
          letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px',
        }}>
          Advisors ({seatedCount}/3)
        </div>

        {/* ── 3 Advisor Slots ── */}
        <div style={{
          display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center',
          marginBottom: '24px',
        }}>
          {slots.map((advisor, i) => {
            if (!advisor) {
              // Empty slot
              return (
                <div
                  key={i}
                  class="council-slot-empty"
                  onClick={() => { equipTargetSlot.value = i; }}
                  style={{
                    width: '140px', height: '160px',
                    border: '2px dashed rgba(180, 160, 100, 0.2)',
                    borderRadius: '8px',
                    background: 'rgba(20, 18, 36, 0.4)',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    gap: '8px',
                  }}
                >
                  <div style={{
                    fontSize: '24px', color: 'rgba(180, 160, 100, 0.3)',
                    lineHeight: 1,
                  }}>+</div>
                  <div style={{
                    fontSize: '10px', color: 'rgba(180, 160, 100, 0.3)',
                    letterSpacing: '1px', textTransform: 'uppercase',
                  }}>
                    Empty Slot
                  </div>
                </div>
              );
            }

            // Filled slot
            const fColor = FACTION_COLORS[advisor.color];
            const tier = advisor.currentTier;
            const xpToNext = getXpToNextTier(advisor);
            const progress = xpProgress(advisor);
            const tierData = getCurrentTier(advisor);

            return (
              <div
                key={advisor.id}
                style={{
                  width: '140px', minHeight: '160px',
                  background: 'rgba(20, 18, 36, 0.85)',
                  border: '1px solid rgba(180, 160, 100, 0.2)',
                  borderTop: `4px solid ${fColor}`,
                  borderRadius: '8px',
                  padding: '10px',
                  display: 'flex', flexDirection: 'column',
                  position: 'relative',
                }}
              >
                {/* Dismiss button */}
                <button
                  class="council-dismiss-btn"
                  onClick={() => handleDismiss(i)}
                  title="Return to pool"
                  style={{
                    position: 'absolute', top: '6px', right: '6px',
                    width: '18px', height: '18px',
                    background: 'rgba(60, 30, 30, 0.5)',
                    border: '1px solid rgba(180, 100, 100, 0.2)',
                    borderRadius: '3px',
                    color: 'rgba(200, 160, 160, 0.6)',
                    fontSize: '10px', fontWeight: 700,
                    cursor: 'pointer', fontFamily: 'inherit',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    lineHeight: 1, padding: 0,
                  }}
                >
                  ×
                </button>

                {/* Advisor name */}
                <div style={{
                  fontSize: '10px', fontWeight: 700, color: fColor,
                  letterSpacing: '0.8px', textTransform: 'uppercase',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  marginBottom: '6px', paddingRight: '20px',
                }}>
                  {advisor.name}
                </div>

                {/* Tier badge */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  marginBottom: '6px',
                }}>
                  <div style={{
                    width: '22px', height: '22px',
                    borderRadius: '50%',
                    background: 'rgba(50, 42, 12, 0.8)',
                    border: '1px solid rgba(240, 208, 128, 0.4)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '10px', fontWeight: 700, color: '#f0d080',
                    flexShrink: 0,
                  }}>
                    {ROMAN[tier as 1 | 2 | 3]}
                  </div>
                  <div style={{
                    fontSize: '9px', color: 'rgba(180, 170, 150, 0.45)',
                    letterSpacing: '0.5px',
                  }}>
                    Tier {tier}
                  </div>
                </div>

                {/* Passive description */}
                <div style={{
                  fontSize: '9px', color: 'rgba(200, 190, 160, 0.6)',
                  lineHeight: '1.4', marginBottom: '8px', flexGrow: 1,
                }}>
                  {tierData.description}
                </div>

                {/* XP progress bar */}
                <div>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    fontSize: '8px', color: 'rgba(180, 170, 150, 0.4)',
                    marginBottom: '3px', letterSpacing: '0.5px',
                  }}>
                    <span>XP</span>
                    {xpToNext !== null
                      ? <span>{xpToNext} to Tier {tier + 1}</span>
                      : <span>Max</span>
                    }
                  </div>
                  <div style={{
                    height: '3px',
                    background: 'rgba(180, 160, 100, 0.12)',
                    borderRadius: '2px', overflow: 'hidden',
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${progress * 100}%`,
                      background: xpToNext === null
                        ? `linear-gradient(90deg, ${fColor}80, ${fColor})`
                        : `linear-gradient(90deg, rgba(240,208,128,0.4), rgba(240,208,128,0.8))`,
                      borderRadius: '2px',
                      transition: 'width 0.3s ease',
                    }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Advisor Picker ── */}
        {targetSlot !== null && (
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
                Choose for Slot #{targetSlot + 1}
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

            {pool.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: '16px',
                color: 'rgba(180, 170, 150, 0.35)', fontSize: '11px',
                letterSpacing: '1px',
              }}>
                No advisors available in pool
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                {pool.map(advisor => {
                  const fColor = FACTION_COLORS[advisor.color];
                  const tier = advisor.currentTier;
                  const passive = getCurrentPassive(advisor);
                  return (
                    <div
                      key={advisor.id}
                      class="council-advisor-card"
                      onClick={() => handlePickAdvisor(advisor)}
                      style={{
                        width: '120px', padding: '10px',
                        background: 'rgba(30, 28, 48, 0.9)',
                        border: '1px solid rgba(180, 160, 100, 0.2)',
                        borderTop: `3px solid ${fColor}`,
                        borderRadius: '5px',
                      }}
                    >
                      <div style={{
                        fontSize: '9px', fontWeight: 700, color: fColor,
                        letterSpacing: '0.8px', textTransform: 'uppercase',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        marginBottom: '4px',
                      }}>
                        {advisor.name}
                      </div>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: '4px',
                        marginBottom: '4px',
                      }}>
                        <div style={{
                          width: '16px', height: '16px', borderRadius: '50%',
                          background: 'rgba(50, 42, 12, 0.8)',
                          border: '1px solid rgba(240, 208, 128, 0.35)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '8px', fontWeight: 700, color: '#f0d080', flexShrink: 0,
                        }}>
                          {ROMAN[tier as 1 | 2 | 3]}
                        </div>
                        <div style={{ fontSize: '8px', color: 'rgba(180, 170, 150, 0.45)' }}>
                          Tier {tier}
                        </div>
                      </div>
                      <div style={{
                        fontSize: '9px', color: 'rgba(200, 190, 160, 0.5)', lineHeight: '1.4',
                      }}>
                        {describePassive(passive)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Spoke Preview ── */}
        <div style={{
          width: '100%',
          borderTop: '1px solid rgba(180, 160, 100, 0.1)',
          paddingTop: '16px',
          marginBottom: '20px',
        }}>
          <div style={{
            fontSize: '10px', color: 'rgba(180, 170, 150, 0.5)',
            letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '10px',
            textAlign: 'center',
          }}>
            Spoke Preview
          </div>

          {seatedCount === 0 ? (
            <div style={{
              textAlign: 'center', padding: '16px',
              color: 'rgba(180, 170, 150, 0.3)', fontSize: '12px',
              fontStyle: 'italic',
            }}>
              Seat at least 1 advisor to preview
            </div>
          ) : spokePreview ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap',
                justifyContent: 'center',
              }}>
                {spokePreview.nodes.map((node, idx) => {
                  const style = SPOKE_NODE_STYLES[node.type];
                  return (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                      <div
                        title={node.type}
                        style={{
                          width: '24px', height: '24px', borderRadius: '50%',
                          background: `${style.color}20`,
                          border: `1px solid ${style.color}60`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '11px',
                        }}
                      >
                        {style.icon}
                      </div>
                      {idx < spokePreview!.nodes.length - 1 && (
                        <div style={{
                          width: '6px', height: '1px',
                          background: 'rgba(180, 160, 100, 0.2)',
                        }} />
                      )}
                    </div>
                  );
                })}
              </div>
              <div style={{
                display: 'flex', gap: '16px', alignItems: 'center',
                fontSize: '10px', color: 'rgba(200, 190, 160, 0.5)',
                letterSpacing: '0.8px',
              }}>
                <span style={{ fontWeight: 600, color: 'rgba(240, 208, 128, 0.6)' }}>
                  {spokePreview.label}
                </span>
                <span style={{
                  fontWeight: 700, letterSpacing: '0.5px',
                  color: spokePreview.posture === 'attacking' ? '#e07050' : '#60a8d0',
                }}>
                  {spokePreview.posture === 'attacking' ? '⚔ Attacking' : '🛡 Defending'}
                </span>
                <span>~{spokePreview.nodes.length} nodes</span>
              </div>
            </div>
          ) : null}
        </div>

        {/* ── Embark Button ── */}
        <button
          class="hub-btn hub-btn-primary"
          disabled={seatedCount === 0}
          onClick={handleEmbark}
          style={{
            width: '240px', marginBottom: '12px',
            opacity: seatedCount === 0 ? 0.4 : 1,
            cursor: seatedCount === 0 ? 'not-allowed' : 'pointer',
          }}
        >
          Embark
        </button>

        {/* Back button */}
        <button
          onClick={() => { equipTargetSlot.value = null; navigateTo('hub'); }}
          style={{
            padding: '10px 28px',
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
