import { COHORT_CATALOG } from '../../../../game/army/cohort-data';
import { gold, canAfford } from '../../../../game/core/resources';
import {
  preparedArmy, preparedLegate, legateHiringPool,
  ensurePreparedArmy, recruitCohort, removeCohort,
  ensureLegatePool, hireLegate, dismissLegate,
  buySupplies,
} from '../../../../game/progression/strategic-store';
import { getLegateTraitById } from '../../../../game/army/legate-traits';
import { playSfx } from '../../../sound/sfx';
import type { UnitRole } from '../../../../battle/battle-types';
import { OrnatePanel } from '../../../components/OrnatePanel';
import { Masthead } from '../Masthead';
import { SectionHeader } from '../components/SectionHeader';
import {
  SUPPLIES_PER_GOLD,
  SUPPLY_MAX_CARRY,
} from '../../../../config/game-config';

const LEGATE_HIRE_COST = 80;

const ROLE_COLORS: Record<UnitRole, string> = {
  vanguard: '#b23a3a',  // crimson — frontline
  reserve:  '#d4a843',  // gold — elite
  guard:    '#5a7aa0',  // lapis — specialist
};

const ROLE_LABELS: Record<UnitRole, string> = {
  vanguard: 'Vanguard',
  reserve:  'Reserve',
  guard:    'Guard',
};

const ROLE_ICONS: Record<UnitRole, string> = {
  vanguard: '⚔',
  reserve:  '★',
  guard:    '➶',
};

export function ExercitusTab() {
  ensurePreparedArmy();
  ensureLegatePool();

  const currentGold = gold.value;
  const army = preparedArmy.value;
  const cohorts = army?.cohorts ?? [];
  const legate = preparedLegate.value;
  const pool = legateHiringPool.value;
  const accent = '#d4a843';

  // Grouped composition (same cohort id folded into one row with count)
  const groupMap = new Map<string, { name: string; role: UnitRole; count: number; hp: number }>();
  for (const c of cohorts) {
    const g = groupMap.get(c.id);
    if (g) {
      g.count++;
      g.hp += c.stats.hp;
    } else {
      groupMap.set(c.id, { name: c.name, role: c.role, count: 1, hp: c.stats.hp });
    }
  }
  const groups = Array.from(groupMap.entries());
  const totalSize = army?.size ?? 0;
  const sizeLabel = totalSize >= 1000 ? `${(totalSize / 1000).toFixed(1)}K` : `${totalSize}`;
  const subtitle = `${cohorts.length} cohort${cohorts.length === 1 ? '' : 's'} · ${sizeLabel} HP · ${legate ? `Legate ${legate.name.split(' ').slice(-1)[0]}` : 'No legate'}`;

  // ── Supplies ──
  const currentSupplies = army?.supplies ?? 0;
  const supplyRatio = SUPPLY_MAX_CARRY > 0 ? currentSupplies / SUPPLY_MAX_CARRY : 0;
  const coversNodes = cohorts.length > 0 ? Math.floor(currentSupplies / cohorts.length) : 0;
  const maxBuyable = Math.min(
    currentGold * SUPPLIES_PER_GOLD,
    SUPPLY_MAX_CARRY - currentSupplies,
  );
  const atCap = currentSupplies >= SUPPLY_MAX_CARRY;

  function handleRecruit(id: string) { if (recruitCohort(id).ok) playSfx('ui_equip'); }
  function handleRemove(id: string)  { removeCohort(id); playSfx('ui_sell'); }
  function handleHire(id: string)    { if (hireLegate(id, LEGATE_HIRE_COST)) playSfx('ui_equip'); }
  function handleDismiss()           { dismissLegate(); playSfx('ui_sell'); }

  function handleBuySupplies(qty: number) {
    if (buySupplies(qty)) playSfx('ui_equip');
  }
  function handleBuyMax() {
    if (maxBuyable > 0) handleBuySupplies(maxBuyable);
  }

  return (
    <>
      <Masthead title="Exercitus" subtitle={subtitle} accent={accent} />

      <div style={{
        flex: 1, minHeight: 0, overflow: 'hidden',
        padding: '20px 32px 24px',
        display: 'grid', gridTemplateColumns: '1fr 340px', gap: 14,
      }}>

        {/* ── LEFT: Cohorts + Catalog ── */}
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 12,
          minHeight: 0, overflow: 'auto',
        }}>
          <OrnatePanel accent={accent}>
            <SectionHeader
              title="Cohorts"
              accent={accent}
              right={<span style={{
                fontFamily: 'var(--imp-font-mono)',
                fontSize: 11, color: 'var(--imp-text-mid)',
              }}>
                {cohorts.length} · {sizeLabel} HP
              </span>}
            />
            {groups.length === 0 ? (
              <div style={{
                padding: '10px 4px',
                fontFamily: 'var(--imp-font-serif)',
                fontStyle: 'italic', fontSize: 11,
                color: 'var(--imp-text-lo)',
              }}>
                No cohorts recruited yet. Pick from the catalog below.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {groups.map(([id, g]) => {
                  const color = ROLE_COLORS[g.role];
                  const icon = ROLE_ICONS[g.role];
                  return (
                    <div key={id} style={{
                      padding: '12px 14px',
                      background: 'rgba(20, 18, 32, 0.6)',
                      border: '1px solid rgba(212, 168, 67, 0.15)',
                      borderLeft: `3px solid ${color}`,
                      borderRadius: 2,
                      display: 'flex', alignItems: 'center', gap: 14,
                    }}>
                      <div style={{
                        width: 38, height: 38, borderRadius: 2,
                        background: `${color}22`,
                        border: `1px solid ${color}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color, fontSize: 18,
                        flexShrink: 0,
                      }}>
                        {icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontFamily: 'var(--imp-font-display)',
                          fontSize: 13, color: 'var(--imp-text-hi)',
                          letterSpacing: 1.5, textTransform: 'uppercase',
                        }}>
                          {g.name}
                        </div>
                        <div style={{
                          fontSize: 10, color: 'var(--imp-text-lo)',
                          letterSpacing: 1, textTransform: 'uppercase',
                          fontStyle: 'italic',
                        }}>
                          {ROLE_LABELS[g.role]} · {g.hp} HP
                        </div>
                      </div>
                      <div style={{
                        fontFamily: 'var(--imp-font-mono)',
                        fontSize: 18, fontWeight: 600,
                        color: 'var(--imp-text-hi)',
                      }}>
                        ×{g.count}
                      </div>
                      <button
                        onClick={() => handleRemove(id)}
                        title={`Disband one ${g.name}`}
                        style={{
                          width: 22, height: 22, padding: 0,
                          background: 'transparent',
                          border: '1px solid rgba(212, 168, 67, 0.35)',
                          borderRadius: 2,
                          color: 'var(--imp-text-mid)',
                          fontSize: 12, lineHeight: 1,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer',
                          fontFamily: 'var(--imp-font-body)',
                          flexShrink: 0,
                        }}
                      >
                        −
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </OrnatePanel>

          {/* ── Supplies ── */}
          <OrnatePanel accent={accent}>
            <SectionHeader
              title="Supplies"
              accent={accent}
              right={<span style={{
                fontFamily: 'var(--imp-font-mono)',
                fontSize: 11, color: 'var(--imp-text-mid)',
              }}>
                {currentSupplies} / {SUPPLY_MAX_CARRY}
              </span>}
            />

            {/* Progress bar */}
            <div style={{
              position: 'relative',
              height: 8,
              background: 'rgba(20, 18, 32, 0.7)',
              border: '1px solid rgba(212, 168, 67, 0.25)',
              borderRadius: 2,
              overflow: 'hidden',
              marginBottom: 10,
            }}>
              <div style={{
                position: 'absolute', top: 0, left: 0, bottom: 0,
                width: `${Math.min(supplyRatio * 100, 100)}%`,
                background: supplyRatio > 0.5
                  ? `linear-gradient(90deg, ${accent} 0%, #f0d080 100%)`
                  : supplyRatio > 0.2
                    ? 'linear-gradient(90deg, #d48b3a 0%, #e8a848 100%)'
                    : 'linear-gradient(90deg, #c24a3a 0%, #d4604a 100%)',
                transition: 'width 300ms ease',
                borderRadius: 2,
              }} />
            </div>

            {/* Quick-buy buttons */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              {([2, 10] as const).map((qty) => {
                const goldCost = Math.ceil(qty / SUPPLIES_PER_GOLD);
                const canBuy = !atCap && currentGold >= goldCost && currentSupplies + qty <= SUPPLY_MAX_CARRY;
                return (
                  <button
                    key={qty}
                    onClick={() => handleBuySupplies(qty)}
                    disabled={!canBuy}
                    style={{
                      flex: 1, padding: '6px 0',
                      background: canBuy
                        ? `linear-gradient(180deg, ${accent} 0%, #b8892a 100%)`
                        : 'rgba(80, 70, 50, 0.3)',
                      border: 'none', borderRadius: 2,
                      color: canBuy ? 'var(--imp-ink)' : 'var(--imp-text-lo)',
                      fontFamily: 'var(--imp-font-display)',
                      fontSize: 11, fontWeight: 700, letterSpacing: 1,
                      cursor: canBuy ? 'pointer' : 'not-allowed',
                      transition: 'all 160ms',
                    }}
                  >
                    +{qty}
                  </button>
                );
              })}
              <button
                onClick={handleBuyMax}
                disabled={maxBuyable <= 0}
                style={{
                  flex: 1.5, padding: '6px 0',
                  background: maxBuyable > 0
                    ? `linear-gradient(180deg, ${accent} 0%, #b8892a 100%)`
                    : 'rgba(80, 70, 50, 0.3)',
                  border: 'none', borderRadius: 2,
                  color: maxBuyable > 0 ? 'var(--imp-ink)' : 'var(--imp-text-lo)',
                  fontFamily: 'var(--imp-font-display)',
                  fontSize: 11, fontWeight: 700, letterSpacing: 1,
                  cursor: maxBuyable > 0 ? 'pointer' : 'not-allowed',
                  transition: 'all 160ms',
                }}
              >
                Max{maxBuyable > 0 ? ` (+${maxBuyable})` : ''}
              </button>
            </div>

            {/* Cost info + estimate */}
            <div style={{
              fontSize: 9, color: 'var(--imp-text-lo)',
              fontFamily: 'var(--imp-font-serif)',
              letterSpacing: 0.5,
            }}>
              1⚜ = {SUPPLIES_PER_GOLD} supplies · 1 supply per cohort per node
            </div>
            {cohorts.length > 0 && (
              <div style={{
                marginTop: 4, fontSize: 10,
                color: coversNodes > 2 ? 'var(--imp-text-mid)' : '#d48b3a',
                fontFamily: 'var(--imp-font-serif)', fontStyle: 'italic',
              }}>
                Covers ≈ {coversNodes} node{coversNodes !== 1 ? 's' : ''}
              </div>
            )}
          </OrnatePanel>

          <OrnatePanel accent={accent}>
            <SectionHeader
              title="Recruit"
              accent={accent}
              right={<span style={{
                fontSize: 9, color: 'var(--imp-text-lo)',
                letterSpacing: 1, textTransform: 'uppercase',
              }}>
                ⚜ {currentGold}
              </span>}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {COHORT_CATALOG.map((c) => {
                const canBuy = currentGold >= c.aurumCost;
                const color = ROLE_COLORS[c.role];
                return (
                  <div key={c.id} style={{
                    padding: '10px 12px',
                    background: 'rgba(20, 18, 32, 0.5)',
                    border: '1px solid rgba(212, 168, 67, 0.15)',
                    borderLeft: `3px solid ${color}`,
                    borderRadius: 2,
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                          fontFamily: 'var(--imp-font-display)',
                          fontSize: 12, color: 'var(--imp-text-hi)',
                          letterSpacing: 1.5, textTransform: 'uppercase',
                          fontWeight: 600,
                        }}>
                          {c.name}
                        </div>
                        <div style={{
                          fontSize: 8, padding: '1px 6px',
                          border: `1px solid ${color}66`,
                          background: `${color}18`,
                          color,
                          borderRadius: 2,
                          letterSpacing: 1, textTransform: 'uppercase',
                          fontFamily: 'var(--imp-font-display)', fontWeight: 600,
                        }}>
                          {ROLE_LABELS[c.role]}
                        </div>
                      </div>
                      <div style={{
                        fontSize: 10, color: 'var(--imp-text-mid)',
                        fontStyle: 'italic', fontFamily: 'var(--imp-font-serif)',
                        marginTop: 2,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {c.description}
                      </div>
                      <div style={{
                        display: 'flex', gap: 10,
                        marginTop: 4,
                        fontFamily: 'var(--imp-font-mono)', fontSize: 9,
                        color: 'var(--imp-text-lo)',
                      }}>
                        <span>ATK {c.stats.atk}</span>
                        <span>DEF {c.stats.def}</span>
                        <span>HP {c.stats.hp}</span>
                        <span>AGI {c.stats.agi}</span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{
                        fontFamily: 'var(--imp-font-display)',
                        fontSize: 13, fontWeight: 700,
                        color: canBuy ? accent : 'var(--imp-text-lo)',
                      }}>
                        {c.aurumCost}⚜
                      </div>
                      <button
                        onClick={() => handleRecruit(c.id)}
                        disabled={!canBuy}
                        style={{
                          marginTop: 4,
                          padding: '5px 10px',
                          background: canBuy
                            ? `linear-gradient(180deg, ${accent} 0%, #b8892a 100%)`
                            : 'rgba(80, 70, 50, 0.3)',
                          border: 'none',
                          borderRadius: 2,
                          color: canBuy ? 'var(--imp-ink)' : 'var(--imp-text-lo)',
                          fontSize: 9, fontWeight: 700,
                          letterSpacing: 1.5, textTransform: 'uppercase',
                          fontFamily: 'var(--imp-font-display)',
                          cursor: canBuy ? 'pointer' : 'not-allowed',
                          transition: 'all 160ms',
                        }}
                      >
                        Recruit
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </OrnatePanel>
        </div>

        {/* ── RIGHT: Legatus ── */}
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 12,
          minHeight: 0, overflow: 'auto',
        }}>
          <OrnatePanel accent={accent}>
            <SectionHeader title="Legatus" accent={accent} />
            {legate ? (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
              }}>
                {/* Portrait placeholder — large circle with initial */}
                <div style={{
                  width: 120, height: 120, borderRadius: '50%',
                  border: `2px solid ${accent}`,
                  background: `radial-gradient(circle, ${accent}33 0%, var(--imp-ink) 70%)`,
                  boxShadow: `0 0 20px ${accent}40`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--imp-font-display)',
                  fontSize: 56, fontWeight: 500,
                  color: accent, opacity: 0.8,
                }}>
                  {legate.name.charAt(0).toUpperCase()}
                </div>
                <div style={{
                  fontFamily: 'var(--imp-font-display)',
                  fontSize: 16, color: 'var(--imp-text-hi)',
                  letterSpacing: 2, textTransform: 'uppercase',
                  fontWeight: 600, textAlign: 'center',
                }}>
                  {legate.name}
                </div>
                <div style={{
                  fontSize: 10, letterSpacing: 1.5,
                  color: accent, textTransform: 'uppercase',
                }}>
                  Legatus
                </div>
                <div style={{
                  display: 'flex', gap: 6, flexWrap: 'wrap',
                  justifyContent: 'center', marginTop: 4,
                }}>
                  {legate.traitIds.map((tid) => {
                    const trait = getLegateTraitById(tid);
                    if (!trait) return null;
                    return (
                      <div
                        key={tid}
                        title={trait.description}
                        style={{
                          padding: '3px 9px',
                          background: `${accent}18`,
                          border: `1px solid ${accent}66`,
                          borderRadius: 2,
                          fontSize: 9, color: accent,
                          fontFamily: 'var(--imp-font-display)',
                          letterSpacing: 1.5, textTransform: 'uppercase',
                          fontWeight: 600,
                        }}
                      >
                        {trait.name}
                      </div>
                    );
                  })}
                </div>
                <button
                  onClick={handleDismiss}
                  style={{
                    marginTop: 10,
                    padding: '6px 14px',
                    background: 'transparent',
                    border: '1px solid rgba(194, 74, 58, 0.55)',
                    borderRadius: 2,
                    color: '#c24a3a',
                    fontSize: 10, fontWeight: 600,
                    letterSpacing: 1.5, textTransform: 'uppercase',
                    fontFamily: 'var(--imp-font-body)',
                    cursor: 'pointer',
                  }}
                >
                  Dismiss
                </button>
              </div>
            ) : (
              <div style={{
                padding: '20px 8px', textAlign: 'center',
                fontFamily: 'var(--imp-font-serif)',
                fontStyle: 'italic', fontSize: 12,
                color: 'var(--imp-text-lo)',
              }}>
                No legate hired. Pick a candidate below.
              </div>
            )}
          </OrnatePanel>

          {/* Hiring pool — shown whenever legate is empty, also collapsed/expanded when one is hired.
              Kept visible so players can swap legates (dismiss + hire). */}
          {!legate && (
            <OrnatePanel accent={accent}>
              <SectionHeader
                title="Hiring Pool"
                accent={accent}
                right={<span style={{
                  fontSize: 9, color: 'var(--imp-text-lo)',
                  letterSpacing: 1, textTransform: 'uppercase',
                }}>
                  {LEGATE_HIRE_COST}⚜ each
                </span>}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {pool.length === 0 && (
                  <div style={{
                    padding: '10px 4px',
                    fontFamily: 'var(--imp-font-serif)',
                    fontStyle: 'italic', fontSize: 11,
                    color: 'var(--imp-text-lo)',
                  }}>
                    The hiring pool is empty.
                  </div>
                )}
                {pool.map((candidate) => {
                  const affordable = canAfford('gold', LEGATE_HIRE_COST);
                  return (
                    <div key={candidate.id} style={{
                      padding: '10px 12px',
                      background: 'rgba(20, 18, 32, 0.5)',
                      border: '1px solid rgba(212, 168, 67, 0.15)',
                      borderRadius: 2,
                      display: 'flex', flexDirection: 'column', gap: 8,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 34, height: 34, borderRadius: '50%',
                          border: `1px solid ${accent}55`,
                          background: `radial-gradient(circle, ${accent}22 0%, var(--imp-panel) 100%)`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontFamily: 'var(--imp-font-display)',
                          fontSize: 15, fontWeight: 700, color: accent,
                          flexShrink: 0,
                        }}>
                          {candidate.name.charAt(0).toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontFamily: 'var(--imp-font-display)',
                            fontSize: 11, color: 'var(--imp-text-hi)',
                            letterSpacing: 1, textTransform: 'uppercase',
                            fontWeight: 600,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {candidate.name}
                          </div>
                          <div style={{
                            fontSize: 9, color: 'var(--imp-text-lo)',
                            fontStyle: 'italic',
                            fontFamily: 'var(--imp-font-serif)',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {candidate.traitIds
                              .map((t) => getLegateTraitById(t)?.name)
                              .filter(Boolean)
                              .join(' · ') || '—'}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleHire(candidate.id)}
                        disabled={!affordable}
                        style={{
                          padding: '6px 10px',
                          background: affordable
                            ? `linear-gradient(180deg, ${accent} 0%, #b8892a 100%)`
                            : 'rgba(80, 70, 50, 0.3)',
                          border: 'none',
                          borderRadius: 2,
                          color: affordable ? 'var(--imp-ink)' : 'var(--imp-text-lo)',
                          fontSize: 10, fontWeight: 700,
                          letterSpacing: 1.5, textTransform: 'uppercase',
                          fontFamily: 'var(--imp-font-display)',
                          cursor: affordable ? 'pointer' : 'not-allowed',
                        }}
                      >
                        Hire — {LEGATE_HIRE_COST}⚜
                      </button>
                    </div>
                  );
                })}
              </div>
            </OrnatePanel>
          )}
        </div>
      </div>
    </>
  );
}
