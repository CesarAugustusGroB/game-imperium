import { useSignal } from '@preact/signals';
import { gold, faith, influence, momentum, spendResource } from '../../../../game/core/resources';
import type { ResourceType } from '../../../../game/core/commander';
import { RESOURCE_INFO } from '../../../../game/core/commander';
import { playSfx } from '../../../sound/sfx';
import { OrnatePanel } from '../../../components/OrnatePanel';
import { Masthead } from '../Masthead';
import { SectionHeader } from '../components/SectionHeader';
import { ResourceAmount, ResourceIcon } from '../../../components/ResourceIcon';

type SellableResource = Extract<ResourceType, 'faith' | 'influence' | 'momentum'>;

const SELLABLE_RESOURCES: SellableResource[] = ['faith', 'influence', 'momentum'];

const RESOURCE_SIGNALS = {
  faith,
  influence,
  momentum,
} satisfies Record<SellableResource, typeof faith>;

function balanceOf(resource: SellableResource): number {
  return RESOURCE_SIGNALS[resource].value;
}

export function MercatorTab() {
  const selected = useSignal<SellableResource>('faith');
  const amount = useSignal(1);
  const accent = '#d4a843';

  const selectedBalance = balanceOf(selected.value);
  const clampedAmount = Math.max(1, Math.min(Math.floor(amount.value), Math.max(1, selectedBalance)));
  if (amount.value !== clampedAmount) amount.value = clampedAmount;

  const canSell = selectedBalance > 0 && clampedAmount > 0;

  function setAmount(next: number): void {
    amount.value = Math.max(1, Math.min(Math.floor(next), Math.max(1, selectedBalance)));
  }

  function selectResource(resource: SellableResource): void {
    const balance = balanceOf(resource);
    selected.value = resource;
    amount.value = Math.max(1, Math.min(Math.floor(amount.value), Math.max(1, balance)));
  }

  function sell(resource: SellableResource, requestedAmount = clampedAmount): void {
    const available = balanceOf(resource);
    const quantity = Math.max(0, Math.min(Math.floor(requestedAmount), available));
    if (quantity <= 0) return;
    if (!spendResource(resource, quantity)) return;
    gold.value += quantity;
    playSfx('ui_sell');
  }

  return (
    <>
      <Masthead title="Mercator" subtitle="Sell stores for gold" accent={accent} />

      <div style={{
        flex: 1,
        minHeight: 0,
        overflow: 'auto',
        padding: '20px 32px 24px',
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) 320px',
        gap: 14,
      }}>
        <OrnatePanel accent={accent} style={{ minHeight: 0, overflow: 'auto' }}>
          <SectionHeader
            title="Exchange Stalls"
            accent={accent}
            right={<span style={{
              fontSize: 9,
              color: 'var(--imp-text-lo)',
              letterSpacing: 1,
              textTransform: 'uppercase',
            }}>
              1 resource = 1 gold
            </span>}
          />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            {SELLABLE_RESOURCES.map((resource) => {
              const info = RESOURCE_INFO[resource];
              const balance = balanceOf(resource);
              const active = selected.value === resource;
              return (
                <div
                  key={resource}
                  style={{
                    padding: '14px 16px',
                    border: `1px solid ${active ? accent : 'rgba(212, 168, 67, 0.18)'}`,
                    borderRadius: 2,
                    background: active
                      ? 'linear-gradient(180deg, rgba(212, 168, 67, 0.14), rgba(20, 18, 32, 0.82))'
                      : 'rgba(20, 18, 32, 0.58)',
                    color: 'var(--imp-text)',
                    fontFamily: 'var(--imp-font-body)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <button
                    onClick={() => selectResource(resource)}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      border: 'none',
                      background: 'transparent',
                      color: 'inherit',
                      padding: 0,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      textAlign: 'left',
                      fontFamily: 'var(--imp-font-body)',
                    }}
                  >
                    <span style={{ width: 22, textAlign: 'center', flexShrink: 0 }}>
                      <ResourceIcon type={resource} size={22} />
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{
                        display: 'block',
                        fontFamily: 'var(--imp-font-display)',
                        fontSize: 13,
                        letterSpacing: 2,
                        color: active ? accent : 'var(--imp-text-hi)',
                        textTransform: 'uppercase',
                      }}>
                        {info.label}
                      </span>
                      <span style={{ display: 'block', fontSize: 10, color: 'var(--imp-text-lo)', marginTop: 3 }}>
                        Available {balance}
                      </span>
                    </span>
                  </button>
                  <button
                    onClick={() => sell(resource, balance)}
                    disabled={balance <= 0}
                    style={{
                      padding: '6px 8px',
                      border: `1px solid ${balance > 0 ? 'rgba(212, 168, 67, 0.35)' : 'rgba(212, 168, 67, 0.1)'}`,
                      borderRadius: 2,
                      background: balance > 0 ? 'rgba(212, 168, 67, 0.12)' : 'rgba(20, 18, 32, 0.35)',
                      color: balance > 0 ? accent : 'var(--imp-text-lo)',
                      cursor: balance > 0 ? 'pointer' : 'not-allowed',
                      fontFamily: 'var(--imp-font-display)',
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: 1,
                      textTransform: 'uppercase',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Sell all
                  </button>
                </div>
              );
            })}
          </div>
        </OrnatePanel>

        <OrnatePanel accent={accent} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <SectionHeader title="Transaction" accent={accent} />

          <div style={{
            padding: '12px 14px',
            background: 'rgba(20, 18, 32, 0.65)',
            border: '1px solid rgba(212, 168, 67, 0.14)',
            borderRadius: 2,
          }}>
            <div style={{ fontSize: 9, letterSpacing: 2, color: 'var(--imp-text-lo)', textTransform: 'uppercase', marginBottom: 8 }}>
              Amount to sell
            </div>
            <input
              type="number"
              min={1}
              max={Math.max(1, selectedBalance)}
              value={clampedAmount}
              onInput={(event) => setAmount(Number((event.currentTarget as HTMLInputElement).value))}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '8px 10px',
                background: 'rgba(13, 11, 20, 0.85)',
                border: '1px solid rgba(212, 168, 67, 0.28)',
                borderRadius: 2,
                color: 'var(--imp-text-hi)',
                fontFamily: 'var(--imp-font-mono)',
                fontSize: 16,
              }}
            />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginTop: 10 }}>
              {[1, 5, 10].map((step) => (
                <button
                  key={step}
                  onClick={() => setAmount(step)}
                  disabled={selectedBalance < step}
                  style={quickButtonStyle(selectedBalance >= step, accent)}
                >
                  {step}
                </button>
              ))}
              <button
                onClick={() => setAmount(selectedBalance)}
                disabled={selectedBalance <= 0}
                style={quickButtonStyle(selectedBalance > 0, accent)}
              >
                All
              </button>
            </div>
          </div>

          <div style={{
            padding: '14px',
            background: 'rgba(30, 24, 18, 0.72)',
            border: '1px solid rgba(212, 168, 67, 0.2)',
            borderRadius: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}>
            <span style={{ color: 'var(--imp-text-mid)', fontSize: 12 }}>
              <ResourceAmount type={selected.value} amount={canSell ? clampedAmount : 0} sign="-" iconSize={16} />
            </span>
            <span style={{ color: 'var(--imp-text-lo)' }}>to</span>
            <span style={{ color: accent, fontSize: 12, fontWeight: 700 }}>
              <ResourceAmount type="gold" amount={canSell ? clampedAmount : 0} sign="+" iconSize={16} />
            </span>
          </div>

          <button
            onClick={() => sell(selected.value)}
            disabled={!canSell}
            style={{
              padding: '11px 14px',
              border: `1px solid ${canSell ? accent : 'rgba(212, 168, 67, 0.14)'}`,
              borderRadius: 2,
              background: canSell ? accent : 'rgba(20, 18, 32, 0.5)',
              color: canSell ? 'var(--imp-ink)' : 'var(--imp-text-lo)',
              cursor: canSell ? 'pointer' : 'not-allowed',
              fontFamily: 'var(--imp-font-display)',
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 2,
              textTransform: 'uppercase',
            }}
          >
            Sell for Gold
          </button>
        </OrnatePanel>
      </div>
    </>
  );
}

function quickButtonStyle(enabled: boolean, accent: string): preact.JSX.CSSProperties {
  return {
    padding: '6px 8px',
    border: `1px solid ${enabled ? 'rgba(212, 168, 67, 0.32)' : 'rgba(212, 168, 67, 0.1)'}`,
    borderRadius: 2,
    background: enabled ? 'rgba(212, 168, 67, 0.1)' : 'rgba(20, 18, 32, 0.4)',
    color: enabled ? accent : 'var(--imp-text-lo)',
    cursor: enabled ? 'pointer' : 'not-allowed',
    fontFamily: 'var(--imp-font-mono)',
    fontSize: 10,
  };
}
