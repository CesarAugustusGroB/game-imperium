import { selectedCommander, completedSpokes } from '../../../game/core/game-state';
import { decretumHand } from '../../../game/items/decretum-store';
import { preparedArmy } from '../../../game/progression/strategic-store';
import { provinces } from '../../../game/province/province-store';
import { councilSlots } from '../../../game/council/council-store';
import { equippedDoctrines } from '../../../game/items/doctrine-store';
import { Corners } from '../../components/motifs/Corners';
import { MosaicBand } from '../../components/motifs/MosaicBand';
import { NOISE_SVG } from '../../components/motifs/textures';
import {
  activeForumTab, sidebarCollapsed, setForumTab, romanCalendar,
} from './state';
import type { ForumTab } from './state';

interface NavItem {
  k: ForumTab;
  l: string;
  g: string;
  badge?: string | number;
}

function useNavItems(): NavItem[] {
  const seatedCount = councilSlots.value.filter((s) => s !== null).length;
  const seatedTotal = councilSlots.value.length;
  const cohortCount = preparedArmy.value?.cohorts.length ?? 0;
  const equippedCount = equippedDoctrines.value.filter((d) => d !== null).length;
  const equippedTotal = equippedDoctrines.value.length;

  return [
    { k: 'overview',   l: 'Forum',      g: '◉' },
    { k: 'provinciae', l: 'Provinciae', g: '⬢', badge: provinces.value.length },
    { k: 'consilium',  l: 'Consilium',  g: '◎', badge: `${seatedCount}/${seatedTotal}` },
    { k: 'exercitus',  l: 'Exercitus',  g: '⚔', badge: cohortCount },
    { k: 'doctrinae',  l: 'Doctrinae',  g: '◈', badge: `${equippedCount}/${equippedTotal}` },
    { k: 'decreta',    l: 'Decreta',    g: '❖', badge: decretumHand.value.length },
  ];
}

interface SidebarProps {
  accent?: string;
}

export function Sidebar({ accent = '#d4a843' }: SidebarProps) {
  const collapsed = sidebarCollapsed.value;
  const W = collapsed ? 64 : 212;
  const commander = selectedCommander.value;
  const turn = completedSpokes.value;
  const cal = romanCalendar(turn);
  const items = useNavItems();

  return (
    <div style={{
      width: W, flexShrink: 0,
      background: 'linear-gradient(180deg, rgba(20, 18, 32, 0.96) 0%, rgba(13, 11, 20, 0.98) 100%)',
      borderRight: '1px solid rgba(212, 168, 67, 0.35)',
      display: 'flex', flexDirection: 'column',
      padding: '14px 10px 10px',
      transition: 'width 240ms cubic-bezier(0.4, 0, 0.2, 1)',
      overflow: 'hidden',
      position: 'relative',
    }}>
      {/* Noise overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: NOISE_SVG,
        opacity: 0.35,
        mixBlendMode: 'overlay',
        pointerEvents: 'none',
      }} />

      {/* Seal + IMPERIVM */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        marginBottom: 18, padding: '0 4px', minHeight: 46,
        position: 'relative',
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
          background: `radial-gradient(circle, var(--imp-panel-soft) 60%, var(--imp-ink) 100%)`,
          border: `2px solid ${accent}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--imp-font-display)',
          fontSize: 11, fontWeight: 700,
          color: accent, letterSpacing: 1,
          boxShadow: `0 0 14px ${accent}44, inset 0 0 8px rgba(0, 0, 0, 0.5)`,
        }}>
          SPQR
        </div>
        {!collapsed && (
          <div class="fade-in" style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 8, letterSpacing: 2,
              color: 'var(--imp-text-lo)',
              textTransform: 'uppercase',
            }}>
              Turn {turn}
            </div>
            <div style={{
              fontFamily: 'var(--imp-font-display)',
              fontSize: 14, fontWeight: 500,
              color: 'var(--imp-text-hi)',
              letterSpacing: 3, textTransform: 'uppercase',
            }}>
              Imperivm
            </div>
          </div>
        )}
      </div>

      {/* Princeps portrait */}
      {commander && !collapsed && (
        <div class="fade-in" style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: 8, marginBottom: 16,
          background: 'rgba(30, 26, 45, 0.5)',
          border: '1px solid rgba(212, 168, 67, 0.15)',
          borderRadius: 2, position: 'relative',
        }}>
          <Corners color={accent} size={5} inset={2} thickness={1} />
          <div style={{
            width: 36, height: 36, borderRadius: '50%', overflow: 'hidden',
            border: `1px solid ${accent}`, flexShrink: 0,
          }}>
            <img
              src={commander.portrait}
              style={{
                width: '100%', height: '100%', objectFit: 'cover',
                objectPosition: 'center 25%',
                filter: 'saturate(0.85) contrast(1.05)',
              }}
            />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{
              fontSize: 8, color: 'var(--imp-text-lo)',
              letterSpacing: 1, textTransform: 'uppercase',
            }}>
              Princeps
            </div>
            <div style={{
              fontFamily: 'var(--imp-font-display)',
              fontSize: 11, fontWeight: 600,
              color: 'var(--imp-text-hi)',
              letterSpacing: 1, textTransform: 'uppercase',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {commander.name}
            </div>
          </div>
        </div>
      )}
      {commander && collapsed && (
        <div style={{
          width: 36, height: 36, borderRadius: '50%', overflow: 'hidden',
          border: `1px solid ${accent}`, alignSelf: 'center', marginBottom: 16,
        }}>
          <img
            src={commander.portrait}
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 25%' }}
          />
        </div>
      )}

      {/* Nav */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, position: 'relative' }}>
        {items.map((n) => {
          const active = activeForumTab.value === n.k;
          return (
            <button
              key={n.k}
              onClick={() => setForumTab(n.k)}
              title={collapsed ? n.l : undefined}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 10px',
                background: active ? `linear-gradient(90deg, ${accent}22 0%, transparent 100%)` : 'transparent',
                border: 'none',
                borderLeft: active ? `2px solid ${accent}` : '2px solid transparent',
                borderRadius: 2,
                color: active ? 'var(--imp-text-hi)' : 'var(--imp-text-mid)',
                fontFamily: 'var(--imp-font-body)',
                fontSize: 12,
                cursor: 'pointer', textAlign: 'left', width: '100%',
                transition: 'all 140ms',
                whiteSpace: 'nowrap', overflow: 'hidden',
                justifyContent: collapsed ? 'center' : 'flex-start',
                letterSpacing: 1, textTransform: 'uppercase',
                position: 'relative',
              }}
            >
              <span style={{
                width: 14, textAlign: 'center', fontSize: 13,
                color: active ? accent : 'var(--imp-text-lo)',
                flexShrink: 0,
              }}>
                {n.g}
              </span>
              {!collapsed && (
                <>
                  <span style={{
                    flex: 1,
                    fontFamily: 'var(--imp-font-display)',
                    fontSize: 12, letterSpacing: 2,
                  }}>
                    {n.l}
                  </span>
                  {n.badge !== undefined && (
                    <span style={{
                      fontSize: 9, padding: '1px 5px',
                      background: active ? `${accent}33` : 'rgba(0, 0, 0, 0.3)',
                      color: active ? accent : 'var(--imp-text-lo)',
                      border: `1px solid ${active ? accent : 'rgba(212, 168, 67, 0.15)'}`,
                      borderRadius: 2,
                      fontFamily: 'var(--imp-font-mono)',
                    }}>
                      {n.badge}
                    </span>
                  )}
                </>
              )}
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1 }} />

      {/* Mosaic divider */}
      {!collapsed && (
        <div style={{ padding: '0 4px', marginBottom: 10, opacity: 0.5 }}>
          <MosaicBand width={180} height={6} color={accent} opacity={0.6} />
        </div>
      )}

      {/* Season chip */}
      {!collapsed && (
        <div class="fade-in" style={{
          padding: '8px 10px',
          background: 'rgba(20, 18, 32, 0.6)',
          border: '1px solid rgba(212, 168, 67, 0.15)',
          borderRadius: 2,
          marginBottom: 8, position: 'relative',
        }}>
          <Corners color={accent} size={5} inset={2} thickness={1} />
          <div style={{
            fontFamily: 'var(--imp-font-display)',
            fontSize: 10, color: accent,
            letterSpacing: 2, textTransform: 'uppercase',
          }}>
            {cal.season}
          </div>
          <div style={{
            fontSize: 9, color: 'var(--imp-text-lo)',
            fontStyle: 'italic',
            fontFamily: 'var(--imp-font-serif)',
          }}>
            {cal.year}
          </div>
        </div>
      )}

      {/* Collapse toggle */}
      <button
        onClick={() => { sidebarCollapsed.value = !collapsed; }}
        title={collapsed ? 'Expand' : 'Collapse'}
        style={{
          display: 'flex', alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          gap: 8, padding: '6px 10px',
          background: 'transparent',
          border: '1px solid rgba(212, 168, 67, 0.15)',
          borderRadius: 2,
          color: 'var(--imp-text-mid)',
          fontSize: 10, cursor: 'pointer',
          transition: 'all 120ms',
          fontFamily: 'var(--imp-font-body)',
        }}
      >
        <span style={{ fontSize: 14, color: accent, width: 14, textAlign: 'center' }}>
          {collapsed ? '›' : '‹'}
        </span>
        {!collapsed && (
          <span style={{
            letterSpacing: 2, textTransform: 'uppercase',
            fontSize: 9,
            fontFamily: 'var(--imp-font-display)',
          }}>
            Collapse
          </span>
        )}
      </button>
    </div>
  );
}
