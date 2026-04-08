import { signal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { selectedCommander } from '../../game/core/game-state';
import { FACTION_PRIMARY_RESOURCE, RESOURCE_INFO } from '../../game/core/commander';
import type { ResourceType } from '../../game/core/commander';
import { exchangeResources, getExchangePreview } from '../../game/core/resources';
import { gold, faith, influence, momentum } from '../../game/core/resources';

// ── One-time CSS injection ──
if (typeof document !== 'undefined' && !document.getElementById('exchange-modal-styles')) {
  const el = document.createElement('style');
  el.id = 'exchange-modal-styles';
  el.textContent = `
    .exchange-res-btn {
      transition: all 0.15s ease;
      cursor: pointer;
    }
    .exchange-res-btn:not(:disabled):hover {
      border-color: rgba(220, 190, 100, 0.5) !important;
      background: rgba(50, 45, 70, 0.9) !important;
    }
    .exchange-res-btn:disabled { cursor: not-allowed; opacity: 0.3; }
    .exchange-res-btn.selected {
      border-color: rgba(240, 208, 128, 0.7) !important;
      background: rgba(60, 50, 20, 0.7) !important;
    }
    /* Range input styling */
    .exchange-slider {
      -webkit-appearance: none;
      appearance: none;
      width: 100%;
      height: 4px;
      border-radius: 2px;
      background: rgba(60, 56, 80, 0.8);
      outline: none;
    }
    .exchange-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 16px; height: 16px;
      border-radius: 50%;
      background: #f0d080;
      cursor: pointer;
      box-shadow: 0 0 6px rgba(240, 208, 128, 0.4);
    }
    .exchange-slider::-moz-range-thumb {
      width: 16px; height: 16px;
      border-radius: 50%;
      background: #f0d080;
      cursor: pointer;
      border: none;
      box-shadow: 0 0 6px rgba(240, 208, 128, 0.4);
    }
    .exchange-slider::-webkit-slider-runnable-track {
      background: rgba(60, 56, 80, 0.8);
      border-radius: 2px;
    }
  `;
  document.head.appendChild(el);
}

const ALL_RESOURCES: ResourceType[] = ['gold', 'faith', 'influence', 'momentum'];

const selectedFrom = signal<ResourceType | null>(null);
const selectedTo   = signal<ResourceType | null>(null);
const exchangeAmt  = signal(1);

function resetModal() {
  selectedFrom.value = null;
  selectedTo.value   = null;
  exchangeAmt.value  = 1;
}

interface Props {
  onClose: () => void;
}

export function ResourceExchangeModal({ onClose }: Props) {
  const commander = selectedCommander.value;
  const faction = commander?.faction ?? 'gold';
  const primaryRes = FACTION_PRIMARY_RESOURCE[faction];

  // Subscribe to resource signals so balances stay live
  const balances: Record<ResourceType, number> = {
    gold:      gold.value,
    faith:     faith.value,
    influence: influence.value,
    momentum:  momentum.value,
  };

  const from    = selectedFrom.value;
  const to      = selectedTo.value;
  const amount  = exchangeAmt.value;
  const fromBal = from ? balances[from] : 0;

  // Clamp amount if balance changes
  if (from && amount > fromBal && fromBal > 0) exchangeAmt.value = fromBal;
  if (from && fromBal === 0 && amount !== 1)   exchangeAmt.value = 1;

  const preview = (from && to && from !== to && amount > 0)
    ? getExchangePreview(from, amount, faction)
    : null;

  const isPrimary = from !== null && primaryRes === from;
  const rateLabel = from === null ? '' : (isPrimary ? '1:1 (Primary)' : '3:2');
  const gainIsZero = preview !== null && preview.gain === 0;
  const canExchange = from !== null && to !== null && from !== to
    && amount > 0 && fromBal >= amount && !gainIsZero;

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') { resetModal(); onClose(); } };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  function handleConfirm() {
    if (!canExchange || !from || !to) return;
    exchangeResources(from, to, amount, faction);
    resetModal();
    onClose();
  }

  function handleClose() { resetModal(); onClose(); }

  return (
    <div
      onClick={handleClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 500,
        fontFamily: "'Segoe UI', system-ui, sans-serif",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'rgba(14, 12, 26, 0.96)',
          border: '1px solid rgba(180, 160, 100, 0.2)',
          borderRadius: '12px',
          padding: '28px 24px 24px',
          width: 'min(440px, 92vw)',
          boxShadow: '0 12px 48px rgba(0, 0, 0, 0.6)',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: '20px',
        }}>
          <div style={{
            fontSize: '14px', fontWeight: 700, color: '#f0d080',
            letterSpacing: '3px', textTransform: 'uppercase',
          }}>
            Resource Exchange
          </div>
          <button
            onClick={handleClose}
            style={{
              background: 'transparent', border: '1px solid rgba(180, 160, 100, 0.2)',
              borderRadius: '4px', color: 'rgba(200, 190, 160, 0.5)',
              fontSize: '13px', padding: '3px 8px', cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            ✕
          </button>
        </div>

        {/* FROM selector */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{
            fontSize: '9px', fontWeight: 700, color: 'rgba(180, 170, 150, 0.5)',
            letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px',
          }}>
            From
            {from && <span style={{ color: 'rgba(200, 190, 160, 0.35)', marginLeft: '6px', letterSpacing: '1px' }}>
              {rateLabel}
            </span>}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {ALL_RESOURCES.map(res => {
              const info = RESOURCE_INFO[res];
              const bal  = balances[res];
              const isSel = from === res;
              return (
                <button
                  key={res}
                  class={`exchange-res-btn${isSel ? ' selected' : ''}`}
                  disabled={bal === 0}
                  onClick={() => {
                    selectedFrom.value = res;
                    if (selectedTo.value === res) selectedTo.value = null;
                    exchangeAmt.value = Math.max(1, Math.min(exchangeAmt.value, bal));
                  }}
                  style={{
                    flex: 1, padding: '8px 4px',
                    background: isSel ? 'rgba(60, 50, 20, 0.7)' : 'rgba(30, 28, 48, 0.8)',
                    border: `1px solid ${isSel ? 'rgba(240, 208, 128, 0.7)' : 'rgba(180, 160, 100, 0.2)'}`,
                    borderRadius: '6px',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
                    fontFamily: 'inherit',
                  }}
                >
                  <span style={{ fontSize: '16px' }}>{info.icon}</span>
                  <span style={{ fontSize: '8px', color: info.color, fontWeight: 700, letterSpacing: '0.5px' }}>{info.label}</span>
                  <span style={{ fontSize: '9px', color: 'rgba(200, 190, 160, 0.6)' }}>{bal}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* TO selector */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{
            fontSize: '9px', fontWeight: 700, color: 'rgba(180, 170, 150, 0.5)',
            letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px',
          }}>
            To
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {ALL_RESOURCES.map(res => {
              const info = RESOURCE_INFO[res];
              const bal  = balances[res];
              const isSel = to === res;
              const isFrom = from === res;
              return (
                <button
                  key={res}
                  class={`exchange-res-btn${isSel ? ' selected' : ''}`}
                  disabled={isFrom}
                  onClick={() => { selectedTo.value = res; }}
                  style={{
                    flex: 1, padding: '8px 4px',
                    background: isSel ? 'rgba(20, 50, 30, 0.7)' : 'rgba(30, 28, 48, 0.8)',
                    border: `1px solid ${isSel ? 'rgba(100, 200, 128, 0.6)' : 'rgba(180, 160, 100, 0.2)'}`,
                    borderRadius: '6px',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
                    fontFamily: 'inherit',
                  }}
                >
                  <span style={{ fontSize: '16px' }}>{info.icon}</span>
                  <span style={{ fontSize: '8px', color: info.color, fontWeight: 700, letterSpacing: '0.5px' }}>{info.label}</span>
                  <span style={{ fontSize: '9px', color: 'rgba(200, 190, 160, 0.6)' }}>{bal}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Amount slider (only shown when from is selected and has balance) */}
        {from && fromBal > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: '8px',
            }}>
              <div style={{
                fontSize: '9px', fontWeight: 700, color: 'rgba(180, 170, 150, 0.5)',
                letterSpacing: '2px', textTransform: 'uppercase',
              }}>
                Amount
              </div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#f0d080' }}>
                {amount}
              </div>
            </div>
            <input
              type="range"
              class="exchange-slider"
              min={1}
              max={Math.max(1, fromBal)}
              value={amount}
              onInput={(e) => { exchangeAmt.value = parseInt((e.target as HTMLInputElement).value, 10); }}
            />
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              fontSize: '8px', color: 'rgba(180, 170, 150, 0.3)',
              marginTop: '4px', letterSpacing: '0.5px',
            }}>
              <span>1</span>
              <span>{fromBal}</span>
            </div>
          </div>
        )}

        {/* Preview */}
        <div style={{
          minHeight: '36px', marginBottom: '20px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(20, 18, 36, 0.6)',
          border: '1px solid rgba(180, 160, 100, 0.1)',
          borderRadius: '6px', padding: '10px 16px',
        }}>
          {!from || !to ? (
            <span style={{ fontSize: '11px', color: 'rgba(180, 170, 150, 0.3)', fontStyle: 'italic' }}>
              Select source and target resources
            </span>
          ) : gainIsZero ? (
            <span style={{ fontSize: '11px', color: 'rgba(200, 100, 100, 0.7)', fontStyle: 'italic' }}>
              Amount too small — minimum {isPrimary ? 1 : 2} to gain 1
            </span>
          ) : preview ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}>
              <span style={{ color: '#e07060', fontWeight: 700 }}>
                {RESOURCE_INFO[from].icon} -{preview.spend}
              </span>
              <span style={{ color: 'rgba(180, 170, 150, 0.4)', fontSize: '16px' }}>→</span>
              <span style={{ color: '#60c880', fontWeight: 700 }}>
                {RESOURCE_INFO[to].icon} +{preview.gain}
              </span>
            </div>
          ) : null}
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handleConfirm}
            disabled={!canExchange}
            style={{
              flex: 2, padding: '12px',
              background: canExchange
                ? 'linear-gradient(135deg, rgba(80, 60, 20, 0.8), rgba(50, 40, 18, 0.95))'
                : 'rgba(40, 36, 60, 0.5)',
              border: `1px solid ${canExchange ? 'rgba(220, 190, 100, 0.5)' : 'rgba(180, 160, 100, 0.15)'}`,
              borderRadius: '4px',
              color: canExchange ? '#f0d080' : 'rgba(180, 170, 150, 0.3)',
              fontFamily: 'inherit', fontSize: '13px', fontWeight: 600,
              letterSpacing: '1px', textTransform: 'uppercase',
              cursor: canExchange ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s ease',
            }}
          >
            Exchange
          </button>
          <button
            onClick={handleClose}
            style={{
              flex: 1, padding: '12px',
              background: 'rgba(30, 28, 48, 0.7)',
              border: '1px solid rgba(180, 160, 100, 0.15)',
              borderRadius: '4px',
              color: 'rgba(200, 190, 160, 0.5)',
              fontFamily: 'inherit', fontSize: '12px', fontWeight: 600,
              letterSpacing: '1px', textTransform: 'uppercase',
              cursor: 'pointer', transition: 'all 0.2s ease',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
