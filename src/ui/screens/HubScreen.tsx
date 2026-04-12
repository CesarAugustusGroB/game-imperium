import { signal } from '@preact/signals';
import { navigateTo } from '../screens';
import { completedSpokes, selectedCommander } from '../../game/core/game-state';
import { playSfx } from '../sound/sfx';
import { decretumHand, maxHandSize, sellDecretum } from '../../game/items/decretum-store';
import { isDecretumCastable, DECRETUM_SELL_PRICE } from '../../game/items/decretum';
import { doctrineCollection, equippedDoctrines, sellDoctrine } from '../../game/items/doctrine-store';
import { isDoctrineEquippable, getDoctrineSellPrice } from '../../game/items/doctrine';
import { FACTION_COLORS } from '../../game/core/commander';
import { getResource } from '../../game/core/resources';
import { DecretumCard } from '../components/DecretumRenderer';
import { councilSlots, startSpokeFromCouncil, plannedSpoke, tierUpNotices } from '../../game/council/council-store';
import { ResourceExchangeModal } from '../components/ResourceExchangeModal';
import { provinces } from '../../game/province/province-store';
import { PANEL, PANEL_TITLE } from '../ui-constants';
import { Portrait } from '../components/Portrait';
import { OrnateFrame, OrnateHeader } from '../components/OrnateFrame';
import type { NodeType } from '../../game/progression/spoke';
import { preparedArmy, preparedLegate } from '../../game/progression/strategic-store';
import type { UnitRole } from '../../battle/battle-types';

const SPOKE_NODE_STYLES: Record<NodeType, { color: string; icon: string }> = {
  battle: { color: '#e06040', icon: '\u2694\uFE0F' },
  rest:   { color: '#40b868', icon: '\uD83C\uDFD5\uFE0F' },
  event:  { color: '#d4a843', icon: '\uD83D\uDCDC' },
  boss:   { color: '#c05050', icon: '\uD83D\uDC80' },
};

// ── One-time CSS injection ──
if (typeof document !== 'undefined' && !document.getElementById('hub-styles')) {
  const el = document.createElement('style');
  el.id = 'hub-styles';
  el.textContent = `
    .merchant-sell-btn { transition: all var(--duration-fast) var(--ease-default); cursor: pointer; }
    .merchant-sell-btn:hover {
      background: rgba(180, 140, 40, 0.5) !important;
      border-color: rgba(240, 208, 128, 0.6) !important;
    }
    .merchant-sell-btn:active { transform: scale(0.96); }
    .merchant-sell-all { transition: all var(--duration-normal) var(--ease-default); cursor: pointer; }
    .merchant-sell-all:hover {
      background: rgba(180, 140, 40, 0.5) !important;
      border-color: rgba(240, 208, 128, 0.6) !important;
      color: #fff0c0 !important;
    }
    .merchant-sell-all:active { transform: scale(0.97); }
    .hub-panel-btn { transition: all var(--duration-fast) var(--ease-default); cursor: pointer; }
    .hub-panel-btn:hover {
      border-color: rgba(180, 160, 100, 0.45) !important;
      color: rgba(240, 220, 160, 0.9) !important;
    }
    .hub-panel-btn:active { transform: scale(0.97); }
    @keyframes gold-flash {
      from { opacity: 0; transform: translateX(-50%) translateY(4px); }
      to   { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
    @keyframes panel-slide-in {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @media (max-width: 600px) {
      .hub-container { padding: 16px !important; }
    }
  `;
  document.head.appendChild(el);
}

const goldFlash = signal<string | null>(null);
const exchangeOpen = signal(false);
let flashTimeout: ReturnType<typeof setTimeout> | null = null;

function showGoldFlash(amount: number) {
  goldFlash.value = `+${amount}g`;
  if (flashTimeout) clearTimeout(flashTimeout);
  flashTimeout = setTimeout(() => { goldFlash.value = null; }, 1200);
}

export function HubScreen() {
  const commander = selectedCommander.value;
  const faction = commander?.faction;
  const color = faction ? FACTION_COLORS[faction] : '#d4a843';

  const slots = councilSlots.value;
  const seatedCount = slots.filter(Boolean).length;
  const spokePreview = plannedSpoke.value;

  const equipped = equippedDoctrines.value;
  const equippedCount = equipped.filter(Boolean).length;

  const hand = decretumHand.value;
  const maxHand = maxHandSize.value;

  // Force signal reads for resource reactivity
  const gold = getResource('gold');
  const faith = getResource('faith');
  const influence = getResource('influence');
  const momentum = getResource('momentum');

  // ── S14-10: Army + Legate summary ──
  const army = preparedArmy.value;
  const armyCohorts = army?.cohorts ?? [];
  const cohortCount = armyCohorts.length;
  const legate = preparedLegate.value;

  // Group cohorts by type for the summary row
  const cohortGroups = new Map<string, { name: string; role: UnitRole; count: number }>();
  for (const c of armyCohorts) {
    const g = cohortGroups.get(c.id);
    if (g) g.count++;
    else cohortGroups.set(c.id, { name: c.name, role: c.role, count: 1 });
  }

  const offColorScrolls = faction ? hand.filter(d => !isDecretumCastable(d, faction)) : [];
  const offColorDoctrines = faction ? doctrineCollection.value.filter(d => !isDoctrineEquippable(d, faction)) : [];
  const totalScrollGold = offColorScrolls.reduce((sum, d) => sum + DECRETUM_SELL_PRICE[d.rarity], 0);
  const totalDoctrineGold = offColorDoctrines.reduce((sum, d) => sum + getDoctrineSellPrice(d), 0);
  const totalMerchantGold = totalScrollGold + totalDoctrineGold;
  const hasAnything = offColorScrolls.length > 0 || offColorDoctrines.length > 0;

  function handleSellScroll(id: string) { const g = sellDecretum(id); if (g > 0) showGoldFlash(g); }
  function handleSellDoctrine(id: string) { const g = sellDoctrine(id); if (g > 0) showGoldFlash(g); }
  function handleSellAll() {
    let total = 0;
    for (const d of offColorScrolls) total += sellDecretum(d.id);
    for (const d of offColorDoctrines) total += sellDoctrine(d.id);
    if (total > 0) showGoldFlash(total);
  }
  function handleEmbark() { playSfx('ui_click'); startSpokeFromCouncil(); navigateTo('node-map'); }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      minHeight: '100vh', fontFamily: 'var(--font-family)',
      background: 'var(--color-bg-primary)',
      paddingTop: '48px', paddingBottom: '32px',
    }}>
      {goldFlash.value && (
        <div style={{
          position: 'fixed', top: '52px', left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(50, 42, 12, 0.95)', border: '1px solid rgba(240, 208, 128, 0.6)',
          borderRadius: 'var(--radius-md)', padding: '6px 16px',
          color: 'var(--color-gold-primary)', fontSize: 'var(--font-size-lg)', fontWeight: 700,
          letterSpacing: '1px', zIndex: 300,
          boxShadow: 'var(--shadow-md)', animation: 'gold-flash var(--duration-normal) var(--ease-default)',
        }}>
          {goldFlash.value}
        </div>
      )}

      {tierUpNotices.value.length > 0 && (
        <div
          onClick={() => { tierUpNotices.value = []; }}
          style={{
            position: 'fixed', top: '92px', left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(20, 40, 60, 0.97)', border: '1px solid rgba(100, 160, 220, 0.6)',
            borderRadius: 'var(--radius-md)', padding: '8px 20px',
            color: '#80c8f0', fontSize: 'var(--font-size-md)', fontWeight: 700,
            letterSpacing: '1.5px', textTransform: 'uppercase',
            zIndex: 300, cursor: 'pointer',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          {tierUpNotices.value.map(n => `${n} leveled up!`).join(' · ')} &nbsp;✕
        </div>
      )}

      {/* ── Father panel ── */}
      <OrnateFrame width="min(1100px, 94vw)">
        <OrnateHeader
          eyebrow="Strategic Hub"
          title={(commander?.name ?? 'IMPERIUM').toUpperCase()}
          rightSlot={<>
            <span class="ornate-stat-chip" title="Gold">⚜ <strong>{gold}</strong></span>
            <span class="ornate-stat-chip" title="Faith">✦ <strong>{faith}</strong></span>
            <span class="ornate-stat-chip" title="Influence">◈ <strong>{influence}</strong></span>
            <span class="ornate-stat-chip" title="Momentum">⚡ <strong>{momentum}</strong></span>
            {completedSpokes.value > 0 && (
              <span class="ornate-stat-chip" title="Completed spokes">🗺 <strong>{completedSpokes.value}</strong></span>
            )}
          </>}
          accentColor={faction ? color : undefined}
        />

        {/* Two-column layout */}
        <div class="hub-container" style={{
          display: 'flex', flexDirection: 'row', flexWrap: 'wrap',
          alignItems: 'flex-start', gap: '12px',
        }}>

          {/* ── LEFT: Council + Embark + Provinces ── */}
          <div style={{ flex: '1 1 0', minWidth: '220px', display: 'flex', flexDirection: 'column', gap: '10px' }}>

            {/* Council panel */}
            <div style={{ ...PANEL, background: 'var(--color-bg-secondary)', animation: 'panel-slide-in var(--duration-slow) var(--ease-default) both' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div style={{ ...PANEL_TITLE, marginBottom: 0 }}>
                  Council <span style={{ color: 'var(--color-text-muted)' }}>{seatedCount}/3</span>
                </div>
                <button class="hub-panel-btn" onClick={() => navigateTo('council')} style={{ background: 'transparent', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-sm)', padding: '2px 8px', color: 'var(--color-text-secondary)', fontFamily: 'inherit', fontSize: '8px', letterSpacing: '1px', textTransform: 'uppercase' }}>
                  Manage →
                </button>
              </div>

              {/* Advisor portraits */}
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '10px' }}>
                {slots.map((advisor, i) => {
                  if (!advisor) {
                    return (
                      <Portrait key={i} alt="Empty slot" size="small" style={{ opacity: 0.35 }} />
                    );
                  }
                  const fColor = FACTION_COLORS[advisor.color];
                  return (
                    <Portrait
                      key={advisor.id}
                      alt={advisor.name}
                      size="small"
                      factionColor={fColor}
                      tier={advisor.currentTier as 1 | 2 | 3}
                    />
                  );
                })}
              </div>

              {/* Spoke preview chain */}
              {spokePreview ? (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '6px' }}>
                    {spokePreview.nodes.map((node, idx) => {
                      const ns = SPOKE_NODE_STYLES[node.type];
                      return (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                          <div title={node.type} style={{
                            width: '18px', height: '18px', borderRadius: '50%',
                            background: `${ns.color}20`, border: `1px solid ${ns.color}60`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '10px',
                          }}>
                            {ns.icon}
                          </div>
                          {idx < spokePreview!.nodes.length - 1 && (
                            <div style={{ width: '4px', height: '1px', background: 'var(--color-border-default)' }} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, letterSpacing: '0.8px', textAlign: 'center', color: spokePreview.posture === 'attacking' ? '#e07050' : '#60a8d0' }}>
                    {spokePreview.posture === 'attacking' ? '\u2694 Attacking' : '\uD83D\uDEE1 Defending'} \u00b7 {spokePreview.nodes.length} nodes
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', fontStyle: 'italic', textAlign: 'center' }}>
                  No advisors seated
                </div>
              )}
            </div>

            {/* Army */}
            <div style={{ ...PANEL, background: 'var(--color-bg-secondary)', animation: 'panel-slide-in var(--duration-slow) var(--ease-default) both', animationDelay: '0.05s' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div style={{ ...PANEL_TITLE, marginBottom: 0 }}>
                  Army {cohortCount > 0 && <span style={{ color: 'var(--color-text-muted)' }}>({cohortCount})</span>}
                </div>
                <button class="hub-panel-btn" onClick={() => navigateTo('army-recruitment')} style={{ background: 'transparent', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-sm)', padding: '2px 8px', color: 'var(--color-text-secondary)', fontFamily: 'inherit', fontSize: '8px', letterSpacing: '1px', textTransform: 'uppercase' }}>
                  Manage →
                </button>
              </div>
              {cohortCount === 0 ? (
                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>No cohorts recruited</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  {Array.from(cohortGroups.entries()).map(([id, g]) => (
                    <div key={id} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</div>
                      <div style={{ fontSize: '8px', color: 'var(--color-text-muted)', flexShrink: 0 }}>×{g.count}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Legate */}
            <div style={{ ...PANEL, background: 'var(--color-bg-secondary)', animation: 'panel-slide-in var(--duration-slow) var(--ease-default) both', animationDelay: '0.1s' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div style={{ ...PANEL_TITLE, marginBottom: 0 }}>Legate</div>
                <button class="hub-panel-btn" onClick={() => navigateTo('legate-hiring')} style={{ background: 'transparent', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-sm)', padding: '2px 8px', color: 'var(--color-text-secondary)', fontFamily: 'inherit', fontSize: '8px', letterSpacing: '1px', textTransform: 'uppercase' }}>
                  Manage →
                </button>
              </div>
              {legate ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Portrait alt={legate.name} size="small" style={{ opacity: 0.85 }} />
                  <div style={{ overflow: 'hidden' }}>
                    <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{legate.name}</div>
                    <div style={{ fontSize: '8px', color: 'var(--color-text-muted)' }}>{legate.traitIds.length} trait{legate.traitIds.length !== 1 ? 's' : ''}</div>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>No legate assigned</div>
              )}
            </div>

            {/* Embark */}
            <div style={{ ...PANEL, background: 'var(--color-bg-secondary)', animation: 'panel-slide-in var(--duration-slow) var(--ease-default) both', animationDelay: '0.15s' }}>
              <button class="ornate-btn" disabled={seatedCount === 0} onClick={handleEmbark} style={{ width: '100%', padding: '12px 24px', fontSize: 'var(--font-size-lg)', fontWeight: 600, letterSpacing: '1px' }}>
                Embark
              </button>
            </div>

            {/* Provinces */}
            <div style={{ ...PANEL, background: 'var(--color-bg-secondary)', animation: 'panel-slide-in var(--duration-slow) var(--ease-default) both', animationDelay: '0.2s' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div style={{ ...PANEL_TITLE, marginBottom: 0 }}>
                  Provinces <span style={{ color: 'var(--color-text-muted)' }}>({provinces.value.length})</span>
                </div>
                {provinces.value.length > 0 && (
                  <button class="hub-panel-btn" onClick={() => navigateTo('provinces')} style={{ background: 'transparent', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-sm)', padding: '2px 8px', color: 'var(--color-text-secondary)', fontFamily: 'inherit', fontSize: '8px', letterSpacing: '1px', textTransform: 'uppercase' }}>
                    Manage →
                  </button>
                )}
              </div>
              {provinces.value.length === 0 ? (
                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>No provinces — complete spokes to conquer</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {provinces.value.map(p => {
                    const unrestColor = p.unrest > 70 ? 'var(--color-danger)' : p.unrest > 40 ? 'var(--color-gold-secondary)' : 'var(--color-text-muted)';
                    return (
                      <div key={p.id} class="hub-panel-btn" onClick={() => navigateTo('provinces')} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '4px 6px', borderRadius: 'var(--radius-sm)',
                        background: 'transparent', border: '1px solid transparent',
                        fontFamily: 'inherit',
                      }}>
                        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{p.name}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, marginLeft: '8px' }}>
                          {p.unrest > 30 && (
                            <div style={{ width: '24px', height: '3px', background: 'rgba(40,35,60,0.8)', borderRadius: '2px', overflow: 'hidden' }}>
                              <div style={{ width: `${Math.min(100, p.unrest)}%`, height: '100%', background: unrestColor, borderRadius: '2px' }} />
                            </div>
                          )}
                          <div style={{ fontSize: '8px', color: 'var(--color-text-muted)' }}>{p.investments.length}/6</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── RIGHT: Sidebar panels ── */}
          <div style={{ flex: '1 1 0', minWidth: '220px', display: 'flex', flexDirection: 'column', gap: '10px' }}>

            {/* Doctrines Summary */}
            <div style={{ ...PANEL, background: 'var(--color-bg-secondary)', animation: 'panel-slide-in var(--duration-slow) var(--ease-default) both', animationDelay: '0s' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div style={{ ...PANEL_TITLE, marginBottom: 0 }}>
                  Doctrines <span style={{ color: 'var(--color-text-muted)' }}>{equippedCount}/4</span>
                </div>
                <button class="hub-panel-btn" onClick={() => navigateTo('doctrine')} style={{ background: 'transparent', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-sm)', padding: '2px 8px', color: 'var(--color-text-secondary)', fontFamily: 'inherit', fontSize: '8px', letterSpacing: '1px', textTransform: 'uppercase' }}>
                  Manage →
                </button>
              </div>
              {equippedCount === 0 ? (
                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>No doctrines equipped</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {equipped.map(d => {
                    if (!d) return null;
                    const fColor = FACTION_COLORS[d.color];
                    return (
                      <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: fColor, flexShrink: 0, boxShadow: `0 0 4px ${fColor}60` }} />
                        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{d.name}</div>
                        <div style={{ fontSize: '8px', color: 'var(--color-text-muted)', flexShrink: 0 }}>Lv{d.currentLevel}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Decretum Hand */}
            <div style={{ ...PANEL, background: 'var(--color-bg-secondary)', animation: 'panel-slide-in var(--duration-slow) var(--ease-default) both', animationDelay: '0.1s' }}>
              <div style={{ ...PANEL_TITLE, marginBottom: '8px' }}>
                Decretum Hand <span style={{ color: 'var(--color-text-muted)' }}>{hand.length}/{maxHand}</span>
              </div>
              {hand.length === 0 ? (
                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>No scrolls in hand</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {hand.map(d => {
                    const castable = faction ? isDecretumCastable(d, faction) : false;
                    const fColor = FACTION_COLORS[d.color] ?? 'rgba(180,160,100,0.6)';
                    return (
                      <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', opacity: castable ? 1 : 0.42 }}>
                        <div style={{ width: '6px', height: '6px', borderRadius: '2px', background: fColor, flexShrink: 0 }} />
                        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{d.name}</div>
                        <div style={{ fontSize: '8px', color: 'var(--color-text-muted)', flexShrink: 0, textTransform: 'capitalize' }}>{d.rarity}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Merchant */}
            <div style={{ ...PANEL, background: 'var(--color-bg-secondary)', animation: 'panel-slide-in var(--duration-slow) var(--ease-default) both', animationDelay: '0.2s' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div style={{ ...PANEL_TITLE, marginBottom: 0 }}>
                  Merchant {hasAnything && <span style={{ color: 'var(--color-text-muted)' }}>({totalMerchantGold}g)</span>}
                </div>
                {hasAnything && (
                  <button class="merchant-sell-all" onClick={handleSellAll} style={{ background: 'rgba(80,60,20,0.6)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-sm)', padding: '3px 10px', color: 'var(--color-gold-primary)', fontSize: 'var(--font-size-xs)', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', fontFamily: 'inherit' }}>
                    Sell All ({totalMerchantGold}g)
                  </button>
                )}
              </div>
              {!hasAnything ? (
                <div style={{ padding: '10px 0', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', fontStyle: 'italic' }}>
                  Nothing to sell — only off-color items appear here.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {offColorScrolls.length > 0 && (
                    <div>
                      <div style={{ fontSize: '8px', color: 'var(--color-text-muted)', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '6px' }}>Spoil Scrolls ({offColorScrolls.length})</div>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {offColorScrolls.map(d => <DecretumCard key={d.id} decretum={d} castable={false} onSell={() => handleSellScroll(d.id)} />)}
                      </div>
                    </div>
                  )}
                  {offColorDoctrines.length > 0 && (
                    <div>
                      <div style={{ fontSize: '8px', color: 'var(--color-text-muted)', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '6px' }}>Off-Color Doctrines ({offColorDoctrines.length})</div>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {offColorDoctrines.map(d => {
                          const price = getDoctrineSellPrice(d);
                          const fColor = FACTION_COLORS[d.color];
                          return (
                            <div key={d.id} style={{ width: '110px', padding: '8px', background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border-subtle)', borderTop: `3px solid ${fColor}`, borderRadius: 'var(--radius-sm)' }}>
                              <div style={{ fontSize: '8px', fontWeight: 700, color: `${fColor}88`, letterSpacing: '0.8px', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '4px' }}>{d.name}</div>
                              <div style={{ fontSize: '8px', color: 'var(--color-text-muted)', lineHeight: '1.4', marginBottom: '6px', opacity: 0.45 }}>{d.levels[d.currentLevel - 1].description}</div>
                              <button class="merchant-sell-btn" onClick={() => handleSellDoctrine(d.id)} style={{ width: '100%', padding: '3px 0', background: 'rgba(80,60,20,0.5)', border: '1px solid rgba(240,208,128,0.22)', borderRadius: 'var(--radius-sm)', color: 'var(--color-gold-primary)', fontSize: '8px', fontWeight: 600, letterSpacing: '0.8px', fontFamily: 'inherit' }}>
                                Sell ({price}g)
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Resource Exchange */}
            <div style={{ ...PANEL, background: 'var(--color-bg-secondary)' }}>
              <div style={{ ...PANEL_TITLE, marginBottom: '8px' }}>Resource Exchange</div>
              <button
                class="hub-panel-btn"
                onClick={() => { exchangeOpen.value = true; }}
                style={{
                  width: '100%', padding: '9px',
                  background: 'var(--color-bg-tertiary)',
                  border: '1px solid var(--color-border-default)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--color-text-secondary)',
                  fontFamily: 'inherit', fontSize: 'var(--font-size-sm)', fontWeight: 600,
                  letterSpacing: '1px', textTransform: 'uppercase',
                }}
              >
                ⇄ Exchange Resources
              </button>
            </div>

          </div>
        </div>
      </OrnateFrame>

      {/* Exchange modal */}
      {exchangeOpen.value && (
        <ResourceExchangeModal onClose={() => { exchangeOpen.value = false; }} />
      )}
    </div>
  );
}
