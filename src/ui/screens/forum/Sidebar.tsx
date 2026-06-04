import { useState } from 'preact/hooks';
import { selectedCommander, completedSpokes, resetRun } from '../../../game/core/game-state';
import { decretumHand } from '../../../game/items/decretum-store';
import { preparedArmy } from '../../../game/progression/strategic-store';
import { provinces } from '../../../game/province/province-store';
import { councilSlots } from '../../../game/council/council-store';
import { equippedDoctrines } from '../../../game/items/doctrine-store';
import { Corners } from '../../components/motifs/Corners';
import { GameIcon } from '../../components/GameIcon';
import type { GameIconName } from '../../components/GameIcon';
import { MosaicBand } from '../../components/motifs/MosaicBand';
import { NOISE_SVG } from '../../components/motifs/textures';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { InlineImageIcon } from '../../components/ResourceIcon';
import { navigateTo } from '../../screens';
import {
  activeForumTab, sidebarCollapsed, setForumTab, romanCalendar,
} from './state';
import type { ForumTab } from './state';
import { tutorialDismissed, setTutorialDismissed } from '../../../game/core/meta-save';
import improvedSeal from '../../../assets/ui/icons/improved-seal.png';
import seasonIcon from '../../../assets/ui/resources/season-icon-color.png';

interface NavItem {
  k: ForumTab;
  l: string;
  icon: GameIconName;
  badge?: string | number;
}

function useNavItems(): NavItem[] {
  const seatedCount = councilSlots.value.filter((s) => s !== null).length;
  const seatedTotal = councilSlots.value.length;
  const cohortCount = preparedArmy.value?.cohorts.length ?? 0;
  const equippedCount = equippedDoctrines.value.filter((d) => d !== null).length;
  const equippedTotal = equippedDoctrines.value.length;

  return [
    { k: 'overview',   l: 'Forum',      icon: 'nav-forum' },
    { k: 'provinciae', l: 'Provinciae', icon: 'nav-provinciae', badge: provinces.value.length },
    { k: 'consilium',  l: 'Consilium',  icon: 'nav-consilium', badge: `${seatedCount}/${seatedTotal}` },
    { k: 'exercitus',  l: 'Exercitus',  icon: 'nav-exercitus', badge: cohortCount },
    { k: 'doctrinae',  l: 'Doctrinae',  icon: 'nav-doctrinae', badge: `${equippedCount}/${equippedTotal}` },
    { k: 'decreta',    l: 'Decreta',    icon: 'nav-decreta', badge: decretumHand.value.length },
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
  const [confirmOpen, setConfirmOpen] = useState(false);

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
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          filter: `drop-shadow(0 0 10px ${accent}55)`,
        }}>
          <img
            src={improvedSeal}
            alt=""
            aria-hidden="true"
            style={{
              width: 48,
              height: 48,
              objectFit: 'contain',
              display: 'block',
            }}
          />
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
              <GameIcon
                name={n.icon}
                size={22}
                style={{ opacity: active ? 1 : 0.78, transition: 'opacity 140ms' }}
              />
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
            display: 'flex', alignItems: 'center', gap: 6,
            fontFamily: 'var(--imp-font-display)',
            fontSize: 10, color: accent,
            letterSpacing: 2, textTransform: 'uppercase',
          }}>
            <InlineImageIcon src={seasonIcon} size={15} />
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

      {/* S34-03: Tutorial re-trigger — only shown after the player has dismissed
          the tutorial at least once. Non-destructive so styled in dim gold, not red. */}
      {tutorialDismissed.value && (
        <button
          onClick={() => setTutorialDismissed(false)}
          title="Show Tutorial"
          style={{
            display: 'flex', alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            gap: 8, padding: '6px 10px',
            background: 'transparent',
            border: '1px solid rgba(212, 168, 67, 0.20)',
            borderRadius: 2,
            color: 'rgba(212, 168, 67, 0.65)',
            fontSize: 10, cursor: 'pointer',
            transition: 'all 120ms',
            fontFamily: 'var(--imp-font-body)',
            marginBottom: 6,
          }}
          onMouseEnter={(e) => {
            const t = e.currentTarget as HTMLButtonElement;
            t.style.color = 'rgba(240, 208, 128, 0.95)';
            t.style.borderColor = 'rgba(212, 168, 67, 0.45)';
            t.style.background = 'rgba(212, 168, 67, 0.06)';
          }}
          onMouseLeave={(e) => {
            const t = e.currentTarget as HTMLButtonElement;
            t.style.color = 'rgba(212, 168, 67, 0.65)';
            t.style.borderColor = 'rgba(212, 168, 67, 0.20)';
            t.style.background = 'transparent';
          }}
        >
          <GameIcon name="nav-tutorial" size={16} />
          {!collapsed && (
            <span style={{
              letterSpacing: 2, textTransform: 'uppercase',
              fontSize: 9,
              fontFamily: 'var(--imp-font-display)',
            }}>
              Tutorial
            </span>
          )}
        </button>
      )}

      {/* Abandon Run button — only when a run is active */}
      {commander && (
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          title="Abandon this campaign run"
          style={{
            display: 'flex', alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            gap: 0, padding: '6px 10px',
            background: 'transparent',
            border: '1px solid rgba(150, 60, 70, 0.25)',
            borderRadius: 2,
            color: 'rgba(200, 110, 100, 0.78)',
            fontFamily: 'var(--imp-font-display)',
            fontSize: 10, letterSpacing: 2,
            textTransform: 'uppercase',
            cursor: 'pointer',
            transition: 'background 120ms, border-color 120ms, color 120ms',
            marginBottom: 8, width: '100%',
          }}
          onMouseEnter={(e) => {
            const t = e.currentTarget as HTMLButtonElement;
            t.style.color = 'rgba(220, 130, 120, 1)';
            t.style.borderColor = 'rgba(180, 80, 80, 0.5)';
            t.style.background = 'rgba(150, 38, 50, 0.08)';
          }}
          onMouseLeave={(e) => {
            const t = e.currentTarget as HTMLButtonElement;
            t.style.color = 'rgba(200, 110, 100, 0.78)';
            t.style.borderColor = 'rgba(150, 60, 70, 0.25)';
            t.style.background = 'transparent';
          }}
        >
          <GameIcon name="nav-abandon" size={16} />
          {!collapsed && (
            <span style={{ marginLeft: 10 }}>Abandon Run</span>
          )}
        </button>
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
        <GameIcon name={collapsed ? 'nav-next' : 'nav-prev'} size={16} />
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

      <ConfirmDialog
        open={confirmOpen}
        title="Abandon this campaign?"
        body="Forfeits the run. All progress this session will be lost."
        confirmLabel="Abandon"
        cancelLabel="Continue Run"
        destructive={true}
        onConfirm={() => {
          resetRun();
          navigateTo('title');
          setConfirmOpen(false);
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
