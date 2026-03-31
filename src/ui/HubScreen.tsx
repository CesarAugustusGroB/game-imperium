import { signal } from '@preact/signals';
import { navigateTo } from './screens';
import { completedSpokes, selectedCommander } from '../game/game-state';
import { decretumHand } from '../game/decretum-store';
import { sellDecretum } from '../game/decretum-store';
import { isDecretumCastable, DECRETUM_SELL_PRICE } from '../game/decretum';
import { doctrineCollection, sellDoctrine } from '../game/doctrine-store';
import { isDoctrineEquippable, getDoctrineSellPrice } from '../game/doctrine';
import { FACTION_COLORS } from '../game/commander';
import { DecretumCard } from './DecretumRenderer';


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
    .merchant-sell-btn {
      transition: all 0.15s ease;
      cursor: pointer;
    }
    .merchant-sell-btn:hover {
      background: rgba(180, 140, 40, 0.5) !important;
      border-color: rgba(240, 208, 128, 0.6) !important;
    }
    .merchant-sell-btn:active { transform: scale(0.96); }
    .merchant-sell-all {
      transition: all 0.2s ease;
      cursor: pointer;
    }
    .merchant-sell-all:hover {
      background: rgba(180, 140, 40, 0.5) !important;
      border-color: rgba(240, 208, 128, 0.6) !important;
      color: #fff0c0 !important;
    }
    .merchant-sell-all:active { transform: scale(0.97); }
    @keyframes gold-flash {
      from { opacity: 0; transform: translateX(-50%) translateY(4px); }
      to { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
  `;
  document.head.appendChild(el);
}

/** Brief gold flash notification. */
const goldFlash = signal<string | null>(null);
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

  // ── Off-color items ──
  const offColorScrolls = faction
    ? decretumHand.value.filter(d => !isDecretumCastable(d, faction))
    : [];
  const offColorDoctrines = faction
    ? doctrineCollection.value.filter(d => !isDoctrineEquippable(d, faction))
    : [];

  const totalScrollGold = offColorScrolls.reduce((sum, d) => sum + DECRETUM_SELL_PRICE[d.rarity], 0);
  const totalDoctrineGold = offColorDoctrines.reduce((sum, d) => sum + getDoctrineSellPrice(d), 0);
  const totalMerchantGold = totalScrollGold + totalDoctrineGold;
  const hasAnything = offColorScrolls.length > 0 || offColorDoctrines.length > 0;

  function handleSellScroll(id: string) {
    const gained = sellDecretum(id);
    if (gained > 0) showGoldFlash(gained);
  }

  function handleSellDoctrine(id: string) {
    const gained = sellDoctrine(id);
    if (gained > 0) showGoldFlash(gained);
  }

  function handleSellAll() {
    let total = 0;
    for (const d of offColorScrolls) {
      total += sellDecretum(d.id);
    }
    for (const d of offColorDoctrines) {
      total += sellDoctrine(d.id);
    }
    if (total > 0) showGoldFlash(total);
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', fontFamily: "'Segoe UI', system-ui, sans-serif",
      background: '#d8d0c8 url(/asset/marbel_background.png) center / contain no-repeat',
      paddingTop: '48px', paddingBottom: '32px',
    }}>
      {/* Gold flash notification */}
      {goldFlash.value && (
        <div style={{
          position: 'fixed', top: '52px', left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(50, 42, 12, 0.95)',
          border: '1px solid rgba(240, 208, 128, 0.6)',
          borderRadius: '6px', padding: '6px 16px',
          color: '#f0d080', fontSize: '14px', fontWeight: 700,
          letterSpacing: '1px', zIndex: 300,
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
          animation: 'gold-flash 0.2s ease-out',
        }}>
          {goldFlash.value}
        </div>
      )}

      {/* Dark content panel */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        background: 'rgba(12, 10, 24, 0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderRadius: '12px',
        border: '1px solid rgba(180, 160, 100, 0.15)',
        padding: '28px 24px 24px',
        maxWidth: '90%',
        width: 'min(600px, 90vw)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
      }}>
        {/* Commander indicator */}
        {commander && (
          <div style={{
            fontSize: '11px', color: 'rgba(200, 190, 160, 0.5)',
            letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px',
          }}>
            {commander.name}
          </div>
        )}

        <div style={{
          fontSize: '20px', fontWeight: 600, color,
          letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '8px',
          textShadow: `0 2px 8px ${color}30`,
        }}>
          Hub
        </div>

        {/* Decorative divider */}
        <div style={{
          width: '60px', height: '1px', marginBottom: '16px',
          background: `linear-gradient(90deg, transparent, ${color}60, transparent)`,
        }} />

        {completedSpokes.value > 0 && (
          <div style={{
            fontSize: '12px', color: 'rgba(200, 190, 160, 0.45)',
            letterSpacing: '1px', marginBottom: '16px',
          }}>
            Spokes completed: {completedSpokes.value}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '240px', marginBottom: '24px' }}>
          <button class="hub-btn hub-btn-primary" onClick={() => navigateTo('council')}>
            Council
          </button>
          <button
            class="hub-btn"
            onClick={() => navigateTo('doctrine')}
            style={{
              background: 'linear-gradient(135deg, rgba(40, 35, 60, 0.7), rgba(30, 25, 45, 0.9))',
              border: '1px solid rgba(180, 160, 100, 0.25)', color: 'rgba(220, 200, 160, 0.8)',
            }}
          >
            Doctrines
          </button>
        </div>

        {/* ── Merchant Section ── */}
        <div style={{
          width: '100%',
          borderTop: '1px solid rgba(180, 160, 100, 0.12)',
          paddingTop: '16px',
        }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: '12px',
          }}>
            <div style={{
              fontSize: '12px', fontWeight: 600, color: 'rgba(240, 208, 128, 0.7)',
              letterSpacing: '2px', textTransform: 'uppercase',
            }}>
              Merchant
              {hasAnything && (
                <span style={{
                  fontSize: '10px', fontWeight: 400, color: 'rgba(240, 208, 128, 0.45)',
                  marginLeft: '8px', letterSpacing: '1px',
                }}>
                  ({totalMerchantGold}g available)
                </span>
              )}
            </div>

            {hasAnything && (
              <button
                class="merchant-sell-all"
                onClick={handleSellAll}
                style={{
                  background: 'rgba(80, 60, 20, 0.6)',
                  border: '1px solid rgba(240, 208, 128, 0.35)',
                  borderRadius: '4px', padding: '5px 12px',
                  color: '#f0d080', fontSize: '10px', fontWeight: 600,
                  letterSpacing: '1px', textTransform: 'uppercase',
                  fontFamily: 'inherit',
                }}
              >
                Sell All ({totalMerchantGold}g)
              </button>
            )}
          </div>

          {!hasAnything ? (
            <div style={{
              textAlign: 'center', padding: '20px',
              color: 'rgba(180, 170, 150, 0.3)', fontSize: '12px',
              fontStyle: 'italic',
            }}>
              Nothing to sell — only off-color items appear here.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Off-color Scrolls */}
              {offColorScrolls.length > 0 && (
                <div>
                  <div style={{
                    fontSize: '9px', color: 'rgba(180, 170, 150, 0.45)',
                    letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '8px',
                  }}>
                    Spoil Scrolls ({offColorScrolls.length})
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {offColorScrolls.map(d => (
                      <DecretumCard
                        key={d.id}
                        decretum={d}
                        castable={false}
                        onSell={() => handleSellScroll(d.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Off-color Doctrines */}
              {offColorDoctrines.length > 0 && (
                <div>
                  <div style={{
                    fontSize: '9px', color: 'rgba(180, 170, 150, 0.45)',
                    letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '8px',
                  }}>
                    Off-Color Doctrines ({offColorDoctrines.length})
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {offColorDoctrines.map(d => {
                      const price = getDoctrineSellPrice(d);
                      const fColor = FACTION_COLORS[d.color];
                      return (
                        <div key={d.id} style={{
                          width: '120px', padding: '10px',
                          background: 'rgba(30, 28, 48, 0.8)',
                          border: '1px solid rgba(180, 160, 100, 0.15)',
                          borderTop: `3px solid ${fColor}`,
                          borderRadius: '5px', opacity: 0.55,
                        }}>
                          <div style={{
                            fontSize: '9px', fontWeight: 700, color: fColor,
                            letterSpacing: '0.8px', textTransform: 'uppercase',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            marginBottom: '4px',
                          }}>
                            {d.name}
                          </div>
                          <div style={{
                            fontSize: '9px', color: 'rgba(200, 190, 160, 0.45)', lineHeight: '1.4',
                            marginBottom: '8px',
                          }}>
                            {d.levels[d.currentLevel - 1].description}
                          </div>
                          <button
                            class="merchant-sell-btn"
                            onClick={() => handleSellDoctrine(d.id)}
                            style={{
                              width: '100%', padding: '4px 0',
                              background: 'rgba(80, 60, 20, 0.5)',
                              border: '1px solid rgba(240, 208, 128, 0.3)',
                              borderRadius: '3px',
                              color: '#f0d080',
                              fontSize: '9px', fontWeight: 600,
                              letterSpacing: '0.8px', fontFamily: 'inherit',
                            }}
                          >
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
      </div>
    </div>
  );
}
