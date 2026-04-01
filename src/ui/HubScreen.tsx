import { signal } from '@preact/signals';
import { navigateTo } from './screens';
import { completedSpokes, selectedCommander } from '../game/game-state';
import { decretumHand, maxHandSize, sellDecretum } from '../game/decretum-store';
import { isDecretumCastable, DECRETUM_SELL_PRICE } from '../game/decretum';
import { doctrineCollection, equippedDoctrines, sellDoctrine } from '../game/doctrine-store';
import { isDoctrineEquippable, getDoctrineSellPrice } from '../game/doctrine';
import { FACTION_COLORS } from '../game/commander';
import { DecretumCard } from './DecretumRenderer';
import { councilSlots, startSpokeFromCouncil, plannedSpoke, tierUpNotices } from '../game/council-store';
import { getCurrentTier } from '../game/advisor';
import { ResourceExchangeModal } from './ResourceExchangeModal';
import { provinces } from '../game/province-store';
import { PANEL, PANEL_TITLE, ROMAN } from './ui-constants';

// ── One-time CSS injection ──
if (typeof document !== 'undefined' && !document.getElementById('hub-styles')) {
  const el = document.createElement('style');
  el.id = 'hub-styles';
  el.textContent = `
    .hub-btn {
      padding: 12px 24px;
      border-radius: 4px; cursor: pointer;
      font-family: inherit; font-size: 14px; font-weight: 600;
      letter-spacing: 1px; text-transform: uppercase;
      transition: all 0.2s ease;
    }
    .hub-btn:active { transform: scale(0.97); }
    .hub-btn-primary {
      background: linear-gradient(135deg, rgba(80, 60, 20, 0.7), rgba(50, 40, 18, 0.9));
      border: 1px solid rgba(220, 190, 100, 0.5); color: #f0d080;
    }
    .hub-btn-primary:hover {
      border-color: rgba(255, 220, 120, 0.8); color: #fff0c0;
      box-shadow: 0 0 24px rgba(180, 160, 100, 0.2), inset 0 0 20px rgba(180, 160, 100, 0.06);
    }
    .hub-btn-primary:disabled {
      opacity: 0.35; cursor: not-allowed;
    }
    .merchant-sell-btn { transition: all 0.15s ease; cursor: pointer; }
    .merchant-sell-btn:hover {
      background: rgba(180, 140, 40, 0.5) !important;
      border-color: rgba(240, 208, 128, 0.6) !important;
    }
    .merchant-sell-btn:active { transform: scale(0.96); }
    .merchant-sell-all { transition: all 0.2s ease; cursor: pointer; }
    .merchant-sell-all:hover {
      background: rgba(180, 140, 40, 0.5) !important;
      border-color: rgba(240, 208, 128, 0.6) !important;
      color: #fff0c0 !important;
    }
    .merchant-sell-all:active { transform: scale(0.97); }
    .hub-panel-btn { transition: all 0.15s ease; cursor: pointer; }
    .hub-panel-btn:hover {
      border-color: rgba(180, 160, 100, 0.45) !important;
      color: rgba(240, 220, 160, 0.9) !important;
    }
    .hub-panel-btn:active { transform: scale(0.97); }
    @keyframes gold-flash {
      from { opacity: 0; transform: translateX(-50%) translateY(4px); }
      to   { opacity: 1; transform: translateX(-50%) translateY(0); }
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
  function handleEmbark() { startSpokeFromCouncil(); navigateTo('node-map'); }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      minHeight: '100vh', fontFamily: "'Segoe UI', system-ui, sans-serif",
      background: '#d8d0c8 url(/asset/marbel_background.png) center / contain no-repeat',
      paddingTop: '48px', paddingBottom: '32px',
    }}>
      {goldFlash.value && (
        <div style={{
          position: 'fixed', top: '52px', left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(50, 42, 12, 0.95)', border: '1px solid rgba(240, 208, 128, 0.6)',
          borderRadius: '6px', padding: '6px 16px',
          color: '#f0d080', fontSize: '14px', fontWeight: 700,
          letterSpacing: '1px', zIndex: 300,
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)', animation: 'gold-flash 0.2s ease-out',
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
            borderRadius: '6px', padding: '8px 20px',
            color: '#80c8f0', fontSize: '12px', fontWeight: 700,
            letterSpacing: '1.5px', textTransform: 'uppercase',
            zIndex: 300, cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          }}
        >
          {tierUpNotices.value.map(n => `${n} leveled up!`).join(' · ')} &nbsp;✕
        </div>
      )}

      {/* Two-column layout */}
      <div style={{
        display: 'flex', flexDirection: 'row', flexWrap: 'wrap',
        alignItems: 'flex-start', gap: '16px',
        width: 'min(1000px, 92vw)',
      }}>

        {/* ── LEFT: Council command panel ── */}
        <div style={{
          flex: '1 1 340px',
          background: 'rgba(12, 10, 24, 0.85)',
          backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
          borderRadius: '12px', border: '1px solid rgba(180, 160, 100, 0.15)',
          padding: '24px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}>
          {/* Commander + spokes */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ fontSize: '11px', color: 'rgba(200,190,160,0.5)', letterSpacing: '2px', textTransform: 'uppercase' }}>
              {commander?.name ?? 'No Commander'}
            </div>
            {completedSpokes.value > 0 && (
              <div style={{ fontSize: '10px', color: 'rgba(180,170,150,0.35)', letterSpacing: '1px' }}>
                {completedSpokes.value} spoke{completedSpokes.value !== 1 ? 's' : ''} completed
              </div>
            )}
          </div>

          <div style={{ fontSize: '22px', fontWeight: 600, color, letterSpacing: '4px', textTransform: 'uppercase', marginBottom: '4px', textShadow: `0 2px 8px ${color}30` }}>
            Hub
          </div>
          <div style={{ width: '60px', height: '1px', marginBottom: '20px', background: `linear-gradient(90deg, transparent, ${color}60, transparent)` }} />

          <div style={PANEL_TITLE}>Council ({seatedCount}/3)</div>

          {/* Advisor slots */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
            {slots.map((advisor, i) => {
              if (!advisor) {
                return (
                  <div key={i} style={{
                    flex: '1 1 80px', minHeight: '52px',
                    border: '2px dashed rgba(180,160,100,0.14)', borderRadius: '6px',
                    background: 'rgba(20,18,36,0.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '18px', color: 'rgba(180,160,100,0.14)',
                  }}>+</div>
                );
              }
              const fColor = FACTION_COLORS[advisor.color];
              const tier = advisor.currentTier;
              const tierData = getCurrentTier(advisor);
              const shortDesc = tierData.description.split(' ').slice(0, 5).join(' ');
              return (
                <div key={advisor.id} style={{
                  flex: '1 1 80px',
                  background: 'rgba(20,18,36,0.7)',
                  border: '1px solid rgba(180,160,100,0.14)',
                  borderTop: `3px solid ${fColor}`,
                  borderRadius: '6px', padding: '8px',
                  display: 'flex', flexDirection: 'column', gap: '4px',
                }}>
                  <div style={{ fontSize: '9px', fontWeight: 700, color: fColor, letterSpacing: '0.8px', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {advisor.name}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: 'rgba(50,42,12,0.8)', border: '1px solid rgba(240,208,128,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '7px', fontWeight: 700, color: '#f0d080', flexShrink: 0 }}>
                      {ROMAN[tier as 1 | 2 | 3]}
                    </div>
                    <div style={{ fontSize: '8px', color: 'rgba(180,170,150,0.38)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {shortDesc}…
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Posture / hint */}
          {spokePreview ? (
            <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.8px', color: spokePreview.posture === 'attacking' ? '#e07050' : '#60a8d0', marginBottom: '16px' }}>
              {spokePreview.posture === 'attacking' ? '⚔ Attacking Campaign' : '🛡 Defending Campaign'}
            </div>
          ) : (
            <div style={{ fontSize: '10px', color: 'rgba(180,170,150,0.3)', fontStyle: 'italic', marginBottom: '16px' }}>
              No advisors seated — visit Council to assign.
            </div>
          )}

          {/* Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button class="hub-btn hub-btn-primary" disabled={seatedCount === 0} onClick={handleEmbark} style={{ width: '100%' }}>
              Embark
            </button>
            <button
              class="hub-panel-btn"
              onClick={() => navigateTo('council')}
              style={{ padding: '10px 16px', borderRadius: '4px', background: 'rgba(40,35,60,0.6)', border: '1px solid rgba(180,160,100,0.2)', color: 'rgba(220,200,160,0.65)', fontFamily: 'inherit', fontSize: '12px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }}
            >
              Manage Council
            </button>
          </div>
        </div>

        {/* ── RIGHT: Sidebar panels ── */}
        <div style={{ flex: '0 1 300px', minWidth: '220px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* Doctrines Summary */}
          <div style={PANEL}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div style={{ ...PANEL_TITLE, marginBottom: 0 }}>
                Doctrines <span style={{ color: 'rgba(200,190,160,0.32)' }}>{equippedCount}/4</span>
              </div>
              <button class="hub-panel-btn" onClick={() => navigateTo('doctrine')} style={{ background: 'transparent', border: '1px solid rgba(180,160,100,0.18)', borderRadius: '3px', padding: '2px 8px', color: 'rgba(200,190,160,0.42)', fontFamily: 'inherit', fontSize: '8px', letterSpacing: '1px', textTransform: 'uppercase' }}>
                Manage →
              </button>
            </div>
            {equippedCount === 0 ? (
              <div style={{ fontSize: '10px', color: 'rgba(180,170,150,0.28)', fontStyle: 'italic' }}>No doctrines equipped</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {equipped.map(d => {
                  if (!d) return null;
                  const fColor = FACTION_COLORS[d.color];
                  return (
                    <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: fColor, flexShrink: 0, boxShadow: `0 0 4px ${fColor}60` }} />
                      <div style={{ fontSize: '10px', color: 'rgba(220,210,185,0.7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{d.name}</div>
                      <div style={{ fontSize: '8px', color: 'rgba(180,170,150,0.32)', flexShrink: 0 }}>Lv{d.currentLevel}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Decretum Hand */}
          <div style={PANEL}>
            <div style={{ ...PANEL_TITLE, marginBottom: '8px' }}>
              Decretum Hand <span style={{ color: 'rgba(200,190,160,0.32)' }}>{hand.length}/{maxHand}</span>
            </div>
            {hand.length === 0 ? (
              <div style={{ fontSize: '10px', color: 'rgba(180,170,150,0.28)', fontStyle: 'italic' }}>No scrolls in hand</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {hand.map(d => {
                  const castable = faction ? isDecretumCastable(d, faction) : false;
                  const fColor = FACTION_COLORS[d.color] ?? 'rgba(180,160,100,0.6)';
                  return (
                    <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', opacity: castable ? 1 : 0.42 }}>
                      <div style={{ width: '6px', height: '6px', borderRadius: '2px', background: fColor, flexShrink: 0 }} />
                      <div style={{ fontSize: '10px', color: 'rgba(220,210,185,0.7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{d.name}</div>
                      <div style={{ fontSize: '8px', color: 'rgba(180,170,150,0.3)', flexShrink: 0, textTransform: 'capitalize' }}>{d.rarity}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Merchant */}
          <div style={PANEL}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div style={{ ...PANEL_TITLE, marginBottom: 0 }}>
                Merchant {hasAnything && <span style={{ color: 'rgba(240,208,128,0.32)' }}>({totalMerchantGold}g)</span>}
              </div>
              {hasAnything && (
                <button class="merchant-sell-all" onClick={handleSellAll} style={{ background: 'rgba(80,60,20,0.6)', border: '1px solid rgba(240,208,128,0.3)', borderRadius: '4px', padding: '3px 10px', color: '#f0d080', fontSize: '9px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', fontFamily: 'inherit' }}>
                  Sell All ({totalMerchantGold}g)
                </button>
              )}
            </div>
            {!hasAnything ? (
              <div style={{ padding: '10px 0', textAlign: 'center', color: 'rgba(180,170,150,0.28)', fontSize: '10px', fontStyle: 'italic' }}>
                Nothing to sell — only off-color items appear here.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {offColorScrolls.length > 0 && (
                  <div>
                    <div style={{ fontSize: '8px', color: 'rgba(180,170,150,0.38)', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '6px' }}>Spoil Scrolls ({offColorScrolls.length})</div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {offColorScrolls.map(d => <DecretumCard key={d.id} decretum={d} castable={false} onSell={() => handleSellScroll(d.id)} />)}
                    </div>
                  </div>
                )}
                {offColorDoctrines.length > 0 && (
                  <div>
                    <div style={{ fontSize: '8px', color: 'rgba(180,170,150,0.38)', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '6px' }}>Off-Color Doctrines ({offColorDoctrines.length})</div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {offColorDoctrines.map(d => {
                        const price = getDoctrineSellPrice(d);
                        const fColor = FACTION_COLORS[d.color];
                        return (
                          <div key={d.id} style={{ width: '110px', padding: '8px', background: 'rgba(30,28,48,0.45)', border: '1px solid rgba(180,160,100,0.06)', borderTop: `3px solid ${fColor}`, borderRadius: '5px' }}>
                            <div style={{ fontSize: '8px', fontWeight: 700, color: `${fColor}88`, letterSpacing: '0.8px', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '4px' }}>{d.name}</div>
                            <div style={{ fontSize: '8px', color: 'rgba(200,190,160,0.38)', lineHeight: '1.4', marginBottom: '6px', opacity: 0.45 }}>{d.levels[d.currentLevel - 1].description}</div>
                            <button class="merchant-sell-btn" onClick={() => handleSellDoctrine(d.id)} style={{ width: '100%', padding: '3px 0', background: 'rgba(80,60,20,0.5)', border: '1px solid rgba(240,208,128,0.22)', borderRadius: '3px', color: '#f0d080', fontSize: '8px', fontWeight: 600, letterSpacing: '0.8px', fontFamily: 'inherit' }}>
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

          {/* Provinces */}
          <div style={PANEL}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div style={{ ...PANEL_TITLE, marginBottom: 0 }}>
                Provinces <span style={{ color: 'rgba(200,190,160,0.32)' }}>({provinces.value.length})</span>
              </div>
              {provinces.value.length > 0 && (
                <button class="hub-panel-btn" onClick={() => navigateTo('provinces')} style={{ background: 'transparent', border: '1px solid rgba(180,160,100,0.18)', borderRadius: '3px', padding: '2px 8px', color: 'rgba(200,190,160,0.42)', fontFamily: 'inherit', fontSize: '8px', letterSpacing: '1px', textTransform: 'uppercase' }}>
                  Manage →
                </button>
              )}
            </div>
            {provinces.value.length === 0 ? (
              <div style={{ fontSize: '10px', color: 'rgba(180,170,150,0.28)', fontStyle: 'italic' }}>No provinces — complete spokes to conquer</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {provinces.value.map(p => {
                  const unrestColor = p.unrest > 70 ? '#c24a3a' : p.unrest > 40 ? '#d4a843' : 'rgba(180,170,150,0.32)';
                  return (
                    <div key={p.id} class="hub-panel-btn" onClick={() => navigateTo('provinces')} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '4px 6px', borderRadius: '4px',
                      background: 'transparent', border: '1px solid transparent',
                      fontFamily: 'inherit',
                    }}>
                      <div style={{ fontSize: '10px', color: 'rgba(220,210,185,0.7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{p.name}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, marginLeft: '8px' }}>
                        {p.unrest > 30 && (
                          <div style={{ width: '24px', height: '3px', background: 'rgba(40,35,60,0.8)', borderRadius: '2px', overflow: 'hidden' }}>
                            <div style={{ width: `${Math.min(100, p.unrest)}%`, height: '100%', background: unrestColor, borderRadius: '2px' }} />
                          </div>
                        )}
                        <div style={{ fontSize: '8px', color: 'rgba(180,170,150,0.32)' }}>{p.investments.length}/6</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Resource Exchange */}
          <div style={PANEL}>
            <div style={{ ...PANEL_TITLE, marginBottom: '8px' }}>Resource Exchange</div>
            <button
              class="hub-panel-btn"
              onClick={() => { exchangeOpen.value = true; }}
              style={{
                width: '100%', padding: '9px',
                background: 'rgba(30,28,48,0.7)',
                border: '1px solid rgba(180,160,100,0.2)',
                borderRadius: '4px',
                color: 'rgba(220,200,160,0.65)',
                fontFamily: 'inherit', fontSize: '11px', fontWeight: 600,
                letterSpacing: '1px', textTransform: 'uppercase',
              }}
            >
              ⇄ Exchange Resources
            </button>
          </div>

        </div>
      </div>

      {/* Exchange modal */}
      {exchangeOpen.value && (
        <ResourceExchangeModal onClose={() => { exchangeOpen.value = false; }} />
      )}
    </div>
  );
}
