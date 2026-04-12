import { signal } from '@preact/signals';
import { navigateTo } from '../screens';
import { Button } from '../components/Button';
import { OrnateFrame, OrnateHeader } from '../components/OrnateFrame';
import { FACTION_COLORS } from '../../game/core/commander';
import { getCurrentTier, getCurrentPassive, getXpToNextTier, XP_TIER_2, XP_TIER_3 } from '../../game/council/advisor';
import type { Advisor, AdvisorPassive } from '../../game/council/advisor';
import type { NodeType } from '../../game/progression/spoke';
import {
  councilSlots,
  advisorPool,
  seatAdvisor,
  unseatAdvisor,
  startSpokeFromCouncil,
  plannedSpoke,
} from '../../game/council/council-store';
import { ROMAN } from '../ui-constants';
import { Portrait } from '../components/Portrait';
import { Tooltip } from '../components/Tooltip';

// ── One-time CSS injection ──
if (typeof document !== 'undefined' && !document.getElementById('council-screen-styles')) {
  const el = document.createElement('style');
  el.id = 'council-screen-styles';
  el.textContent = `
    .council-advisor-card {
      transition: all var(--duration-normal) var(--ease-default);
      cursor: pointer;
    }
    .council-advisor-card:hover {
      border-color: var(--color-gold-primary) !important;
      box-shadow: var(--shadow-md);
      transform: translateY(-1px);
    }
    .council-advisor-card:active { transform: scale(0.97); }
    .council-slot-empty {
      transition: all var(--duration-normal) var(--ease-default);
      cursor: pointer;
    }
    .council-slot-empty:hover {
      border-color: var(--color-border-default) !important;
      background: rgba(30, 26, 50, 0.6) !important;
    }
    .council-dismiss-btn {
      transition: all var(--duration-fast) var(--ease-default);
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
  const slots = councilSlots.value;
  const pool = advisorPool.value;
  const seatedCount = slots.filter(Boolean).length;
  const targetSlot = equipTargetSlot.value;

  // Spoke preview — only compute when at least 1 advisor is seated
  let spokePreview = plannedSpoke.value;

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
      minHeight: '100vh', fontFamily: 'var(--font-family)',
      background: 'var(--color-bg-primary)',
      paddingTop: '48px', paddingBottom: '32px',
    }}>
      {/* Dark content panel */}
      <OrnateFrame width="min(1100px, 94vw)">
        <OrnateHeader
          eyebrow="The Council"
          title="ADVISORS"
          rightSlot={<>
            <span class="ornate-stat-chip" title="Seated">SEATED <strong>{seatedCount}/3</strong></span>
            <span class="ornate-stat-chip" title="Available">POOL <strong>{pool.length}</strong></span>
          </>}
          onClose={() => navigateTo('hub')}
        />

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

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
                    border: '2px dashed var(--color-border-default)',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--color-bg-primary)',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    gap: '8px',
                  }}
                >
                  <div style={{
                    fontSize: '24px', color: 'var(--color-border-default)',
                    lineHeight: 1,
                  }}>+</div>
                  <div style={{
                    fontSize: 'var(--font-size-sm)', color: 'var(--color-border-default)',
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
            const nextTierData = advisor.currentTier < 3 ? advisor.tiers[advisor.currentTier as 1 | 2] : null;

            const advisorTooltip = (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ fontWeight: 700, color: fColor, marginBottom: '2px' }}>
                  {advisor.name}
                  <span style={{ color: 'var(--color-text-muted)', fontWeight: 400, marginLeft: '6px' }}>
                    Tier {advisor.currentTier === 1 ? 'I' : advisor.currentTier === 2 ? 'II' : 'III'}
                  </span>
                </div>
                <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', lineHeight: '1.4' }}>
                  {tierData.description}
                </div>
                <div style={{ marginTop: '4px', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>
                  XP: {advisor.xp} / {advisor.currentTier === 1 ? XP_TIER_2 : XP_TIER_3}
                  {xpToNext !== null ? ` (${xpToNext} to Tier ${advisor.currentTier + 1})` : ' — Max Tier'}
                </div>
                {nextTierData && (
                  <div style={{ marginTop: '2px', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)', fontStyle: 'italic' }}>
                    Next: {nextTierData.description}
                  </div>
                )}
              </div>
            );

            return (
              <div
                key={advisor.id}
                style={{
                  width: '140px', height: 'var(--slot-height-council)',
                  background: 'var(--color-bg-primary)',
                  border: '1px solid var(--color-border-default)',
                  borderTop: `4px solid ${fColor}`,
                  borderRadius: 'var(--radius-md)',
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
                    fontSize: 'var(--font-size-sm)', fontWeight: 700,
                    cursor: 'pointer', fontFamily: 'inherit',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    lineHeight: 1, padding: 0,
                  }}
                >
                  ×
                </button>

                {/* Portrait */}
                <Tooltip content={advisorTooltip} variant="rich" position="right">
                  <Portrait
                    alt={advisor.name}
                    size="small"
                    factionColor={fColor}
                    tier={advisor.currentTier as 1 | 2 | 3}
                    tierUpAvailable={advisor.currentTier < 3 && advisor.xp >= (advisor.currentTier === 1 ? XP_TIER_2 : XP_TIER_3)}
                    style={{ margin: '0 auto var(--space-xs)' }}
                  />
                </Tooltip>

                {/* Advisor name */}
                <div style={{
                  fontSize: 'var(--font-size-sm)', fontWeight: 700, color: fColor,
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
                    border: '1px solid var(--color-border-strong)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-gold-primary)',
                    flexShrink: 0,
                  }}>
                    {ROMAN[tier as 1 | 2 | 3]}
                  </div>
                  <div style={{
                    fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)',
                    letterSpacing: '0.5px',
                  }}>
                    Tier {tier}
                  </div>
                </div>

                {/* Passive description */}
                <div style={{
                  fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)',
                  lineHeight: '1.4', marginBottom: '8px', flexGrow: 1,
                }}>
                  {tierData.description}
                </div>

                {/* XP progress bar */}
                <div>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    fontSize: '8px', color: 'var(--color-text-muted)',
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
                    background: 'var(--color-border-subtle)',
                    borderRadius: '2px', overflow: 'hidden',
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${progress * 100}%`,
                      background: xpToNext === null
                        ? `linear-gradient(90deg, ${fColor}80, ${fColor})`
                        : `linear-gradient(90deg, rgba(240,208,128,0.4), rgba(240,208,128,0.8))`,
                      borderRadius: '2px',
                      transition: `width var(--duration-slow) var(--ease-default)`,
                    }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Spoke Preview ── */}
        <div style={{
          width: '100%',
          borderTop: '1px solid var(--color-border-subtle)',
          paddingTop: '16px',
          marginBottom: '20px',
        }}>
          <div style={{
            fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)',
            letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '10px',
            textAlign: 'center',
          }}>
            Spoke Preview
          </div>

          <div style={{ minHeight: 'var(--slot-height-spoke-preview)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
            {seatedCount === 0 ? (
              <div style={{
                textAlign: 'center', padding: '16px',
                color: 'var(--color-text-muted)', fontSize: 'var(--font-size-md)',
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
                            fontSize: 'var(--font-size-sm)',
                          }}
                        >
                          {style.icon}
                        </div>
                        {idx < spokePreview!.nodes.length - 1 && (
                          <div style={{
                            width: '6px', height: '1px',
                            background: 'var(--color-border-default)',
                          }} />
                        )}
                      </div>
                    );
                  })}
                </div>
                <div style={{
                  display: 'flex', gap: '16px', alignItems: 'center',
                  fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)',
                  letterSpacing: '0.8px',
                }}>
                  <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
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
        </div>

        {/* ── Embark Button ── */}
        <button
          class="ornate-btn"
          disabled={seatedCount === 0}
          onClick={handleEmbark}
          style={{
            width: '240px', marginBottom: '12px',
            padding: '12px 24px',
            fontSize: 'var(--font-size-lg)',
            fontWeight: 600,
            letterSpacing: '1px',
            opacity: seatedCount === 0 ? 0.4 : 1,
            cursor: seatedCount === 0 ? 'not-allowed' : 'pointer',
          }}
        >
          Embark
        </button>

        {/* Back button */}
        <Button
          variant="primary"
          onClick={() => { equipTargetSlot.value = null; navigateTo('hub'); }}
        >
          Back to Hub
        </Button>
        </div>
      </OrnateFrame>

      {/* ── Advisor Picker Modal ── */}
      {targetSlot !== null && (
        <div
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.65)',
            zIndex: 200,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={() => { equipTargetSlot.value = null; }}
          onKeyDown={(e: KeyboardEvent) => { if (e.key === 'Escape') equipTargetSlot.value = null; }}
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
                Choose for Slot #{targetSlot + 1}
              </span>
              <Button
                variant="ghost"
                onClick={() => { equipTargetSlot.value = null; }}
                style={{ fontSize: 'var(--font-size-xs)', padding: '3px 8px' }}
              >
                Cancel
              </Button>
            </div>

            {pool.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: '16px',
                color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)',
                letterSpacing: '1px',
              }}>
                No advisors available in pool
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-start', paddingLeft: '4px' }}>
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
                        background: 'var(--color-bg-secondary)',
                        border: '1px solid var(--color-border-default)',
                        borderTop: `3px solid ${fColor}`,
                        borderRadius: '5px',
                      }}
                    >
                      <div style={{
                        fontSize: 'var(--font-size-xs)', fontWeight: 700, color: fColor,
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
                          border: '1px solid var(--color-border-strong)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '8px', fontWeight: 700, color: 'var(--color-gold-primary)', flexShrink: 0,
                        }}>
                          {ROMAN[tier as 1 | 2 | 3]}
                        </div>
                        <div style={{ fontSize: '8px', color: 'var(--color-text-muted)' }}>
                          Tier {tier}
                        </div>
                      </div>
                      <div style={{
                        fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: '1.4',
                      }}>
                        {describePassive(passive)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
