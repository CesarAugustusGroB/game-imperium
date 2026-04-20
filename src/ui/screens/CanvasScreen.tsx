import { useSignal } from '@preact/signals';
import type { TaxLevel } from '../../types/index';
import { getTaxLabel, getTaxRate, formatTaxRate } from '../../game/province/province';
import { OrnateFrame } from '../components/OrnateFrame';

// ── One-time CSS injection ──
if (typeof document !== 'undefined' && !document.getElementById('canvas-styles')) {
  const el = document.createElement('style');
  el.id = 'canvas-styles';
  el.textContent = `
    .canvas-root {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 32px;
      font-family: var(--font-family);
      background: radial-gradient(ellipse at center, rgba(30, 26, 48, 1), rgba(12, 10, 20, 1));
    }

    /* ── Province Administration Panel ── */
    .pa-panel {
      display: flex;
      flex-direction: column;
      gap: 0;
    }

    /* Title bar */
    .pa-title-bar {
      text-align: center;
      padding-bottom: 14px;
    }
    .pa-title {
      font-family: var(--font-display);
      font-size: 15px;
      font-weight: 700;
      color: var(--color-gold-primary);
      letter-spacing: 6px;
      text-transform: uppercase;
      text-shadow: 0 1px 8px rgba(240, 208, 128, 0.2);
    }
    .pa-divider {
      height: 1px;
      margin-top: 10px;
      background: linear-gradient(90deg, transparent, var(--color-gold-secondary), transparent);
    }

    /* Column labels */
    .pa-col-label {
      font-family: var(--font-family);
      font-size: 8px;
      font-weight: 700;
      color: var(--color-text-muted);
      letter-spacing: 2px;
      text-transform: uppercase;
    }

    /* Main content row */
    .pa-content {
      display: flex;
      gap: 24px;
      padding-top: 8px;
    }

    /* ── Governor Office ── */
    .pa-gov {
      display: flex;
      align-items: center;
      gap: 14px;
      flex: 0 0 auto;
    }
    .pa-gov-portrait {
      width: 72px;
      height: 72px;
      border-radius: var(--radius-sm);
      background: linear-gradient(135deg, rgba(20, 18, 32, 0.9), rgba(35, 30, 50, 0.9));
      border: 1px solid var(--color-border-default);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .pa-gov-portrait svg {
      width: 28px;
      height: 28px;
      opacity: 0.25;
    }
    .pa-gov-info {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .pa-gov-title {
      font-family: var(--font-display);
      font-size: 13px;
      font-weight: 700;
      color: var(--color-text-primary);
      letter-spacing: 2px;
      text-transform: uppercase;
    }
    .pa-gov-desc {
      font-size: 9px;
      color: var(--color-text-muted);
      line-height: 1.4;
      max-width: 160px;
    }
    .pa-hire-btn {
      margin-top: 4px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 14px;
      border-radius: var(--radius-sm);
      background: linear-gradient(180deg, rgba(120, 85, 25, 0.85), rgba(70, 50, 15, 0.95));
      border: 1px solid var(--color-border-strong);
      color: var(--color-gold-primary);
      font-family: var(--font-family);
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      cursor: pointer;
      transition: all var(--duration-fast) var(--ease-default);
      align-self: flex-start;
    }
    .pa-hire-btn:hover {
      background: linear-gradient(180deg, rgba(150, 110, 30, 0.95), rgba(100, 75, 20, 1));
      color: #fff0c0;
      box-shadow: 0 0 12px rgba(240, 208, 128, 0.3);
    }
    .pa-hire-btn:active { transform: scale(0.97); }

    /* ── Vertical separator ── */
    .pa-vsep {
      width: 1px;
      align-self: stretch;
      background: linear-gradient(180deg, transparent, var(--color-border-default), transparent);
    }

    /* ── Tax Policy & Rate ── */
    .pa-tax {
      display: flex;
      flex-direction: column;
      gap: 10px;
      flex: 1;
      min-width: 0;
    }
    .pa-tax-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    /* Circular rate badge */
    .pa-rate-badge {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: linear-gradient(135deg, rgba(60, 45, 15, 0.9), rgba(40, 30, 10, 0.95));
      border: 2px solid var(--color-gold-secondary);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      box-shadow: 0 0 12px rgba(240, 208, 128, 0.15), inset 0 1px 4px rgba(240, 208, 128, 0.1);
    }
    .pa-rate-value {
      font-family: var(--font-display);
      font-size: 13px;
      font-weight: 700;
      color: var(--color-gold-primary);
      letter-spacing: 0.5px;
    }

    /* Tax class rows */
    .pa-tax-row {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    .pa-tax-row-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .pa-tax-class-label {
      font-size: 10px;
      font-weight: 700;
      color: var(--color-text-secondary);
      text-transform: uppercase;
      letter-spacing: 1.5px;
    }
    .pa-tax-active-label {
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 1.2px;
      text-transform: uppercase;
      padding: 2px 8px;
      border-radius: 3px;
    }

    /* Step indicator row */
    .pa-tax-steps {
      display: flex;
      justify-content: space-between;
      align-items: center;
      position: relative;
      padding: 0 2px;
    }
    .pa-tax-step {
      font-size: 8px;
      color: var(--color-text-muted);
      cursor: pointer;
      padding: 3px 0;
      transition: all var(--duration-fast) var(--ease-default);
      position: relative;
      text-align: center;
      user-select: none;
    }
    .pa-tax-step:hover {
      color: var(--color-text-secondary);
    }
    .pa-tax-step.active {
      font-weight: 700;
    }
    /* Track line behind steps */
    .pa-tax-track {
      position: relative;
      height: 3px;
      border-radius: 2px;
      background: rgba(180, 160, 100, 0.1);
      margin: 2px 4px;
    }
    .pa-tax-fill {
      position: absolute;
      top: 0; left: 0;
      height: 100%;
      border-radius: 2px;
      transition: width var(--duration-fast) var(--ease-default);
    }
    /* Clickable step dots on track */
    .pa-tax-dots {
      position: absolute;
      top: 50%;
      left: 0;
      right: 0;
      display: flex;
      justify-content: space-between;
      transform: translateY(-50%);
      padding: 0 1px;
    }
    .pa-tax-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: rgba(180, 160, 100, 0.2);
      border: 1px solid rgba(180, 160, 100, 0.3);
      cursor: pointer;
      transition: all var(--duration-fast) var(--ease-default);
      position: relative;
      z-index: 1;
    }
    .pa-tax-dot.active {
      border-color: var(--color-gold-primary);
      box-shadow: 0 0 6px rgba(240, 208, 128, 0.4);
    }
    .pa-tax-dot:hover {
      transform: scale(1.3);
    }

    /* ── Footer summary ── */
    .pa-footer {
      text-align: center;
      padding-top: 12px;
      margin-top: 4px;
      border-top: 1px solid var(--color-border-subtle);
      font-size: 9px;
      color: var(--color-text-muted);
      letter-spacing: 0.5px;
    }
    .pa-footer-dot {
      display: inline-block;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      vertical-align: middle;
      margin-right: 3px;
    }
    .pa-footer-tri {
      display: inline-block;
      width: 0;
      height: 0;
      border-left: 4px solid transparent;
      border-right: 4px solid transparent;
      border-bottom: 7px solid;
      vertical-align: middle;
      margin-right: 3px;
    }

    @media (max-width: 640px) {
      .pa-content { flex-direction: column; gap: 16px; }
      .pa-vsep { width: auto; height: 1px; align-self: auto;
        background: linear-gradient(90deg, transparent, var(--color-border-default), transparent);
      }
      .canvas-root { padding: 16px; }
    }
  `;
  document.head.appendChild(el);
}

// ── Color per tax level ──
const TAX_COLORS: Record<TaxLevel, string> = {
  1: '#5a8a4a',
  2: '#68a860',
  3: 'rgba(200, 190, 160, 0.7)',
  4: '#d4a843',
  5: '#c24a3a',
};

const TAX_LEVELS: TaxLevel[] = [1, 2, 3, 4, 5];

// ── Tax Step Control ──
function TaxStepControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: TaxLevel;
  onChange: (v: TaxLevel) => void;
}) {
  const color = TAX_COLORS[value];
  const fillPct = ((value - 1) / 4) * 100;

  return (
    <div class="pa-tax-row">
      <div class="pa-tax-row-header">
        <span class="pa-tax-class-label">{label}</span>
        <span
          class="pa-tax-active-label"
          style={{
            color,
            background: `${color}18`,
            border: `1px solid ${color}40`,
          }}
        >
          {getTaxLabel(value)}
        </span>
      </div>

      {/* Track with fill and dots */}
      <div class="pa-tax-track">
        <div class="pa-tax-fill" style={{ width: `${fillPct}%`, background: color }} />
        <div class="pa-tax-dots">
          {TAX_LEVELS.map(l => (
            <div
              key={l}
              class={`pa-tax-dot${l <= value ? ' active' : ''}`}
              style={l <= value ? { background: color, borderColor: color } : undefined}
              onClick={() => onChange(l)}
              title={getTaxLabel(l)}
            />
          ))}
        </div>
      </div>

      {/* Step labels */}
      <div class="pa-tax-steps">
        {TAX_LEVELS.map(l => (
          <span
            key={l}
            class={`pa-tax-step${l === value ? ' active' : ''}`}
            style={l === value ? { color } : undefined}
            onClick={() => onChange(l)}
          >
            {getTaxLabel(l)}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Shield placeholder SVG ──
function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <path
        d="M12 2L3 7v5c0 5.25 3.83 10.15 9 11.25C17.17 22.15 21 17.25 21 12V7L12 2z"
        stroke="rgba(180,160,100,0.3)"
        fill="rgba(180,160,100,0.05)"
      />
      <path d="M12 6v7M9 10h6" stroke="rgba(180,160,100,0.2)" stroke-width="1" />
    </svg>
  );
}

// ── Main Screen ──
export function CanvasScreen() {
  const lowerTax = useSignal<TaxLevel>(1);
  const upperTax = useSignal<TaxLevel>(5);

  const rate = getTaxRate(lowerTax.value, upperTax.value);
  const rateStr = formatTaxRate(rate);

  return (
    <div class="canvas-root">
      <OrnateFrame width="min(720px, 94vw)" padding="compact">
        <div class="pa-panel">
          {/* Title */}
          <div class="pa-title-bar">
            <div class="pa-title">Province Administration</div>
            <div class="pa-divider" />
          </div>

          {/* Column labels */}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 4px 6px' }}>
            <span class="pa-col-label">Governor Office</span>
            <span class="pa-col-label">Tax Policy & Rate</span>
          </div>

          {/* Content */}
          <div class="pa-content">
            {/* Governor Office */}
            <div class="pa-gov">
              <div class="pa-gov-portrait">
                <ShieldIcon />
              </div>
              <div class="pa-gov-info">
                <span class="pa-gov-title">No Governor</span>
                <span class="pa-gov-desc">
                  Appoint a governor to gain specific bonuses for this province
                </span>
                <button class="pa-hire-btn">
                  Hire <span style={{ fontSize: '11px' }}>&rarr;</span>
                </button>
              </div>
            </div>

            {/* Separator */}
            <div class="pa-vsep" />

            {/* Tax Policy & Rate */}
            <div class="pa-tax">
              <div class="pa-tax-header">
                <div style={{ flex: 1 }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div class="pa-rate-badge">
                    <span class="pa-rate-value">{rateStr}</span>
                  </div>
                  <span style={{
                    fontSize: '8px',
                    color: 'var(--color-text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '2px',
                    fontWeight: 700,
                  }}>
                    Rate
                  </span>
                </div>
              </div>

              <TaxStepControl
                label="Lower Class"
                value={lowerTax.value}
                onChange={(v) => { lowerTax.value = v; }}
              />
              <TaxStepControl
                label="Upper Class"
                value={upperTax.value}
                onChange={(v) => { upperTax.value = v; }}
              />
            </div>
          </div>

          {/* Footer summary */}
          <div class="pa-footer">
            <span
              class="pa-footer-dot"
              style={{ background: TAX_COLORS[lowerTax.value] }}
            />
            <span style={{ color: TAX_COLORS[lowerTax.value], fontWeight: 600 }}>
              Lower {getTaxLabel(lowerTax.value)}
            </span>
            {' '}/{' '}
            <span
              class="pa-footer-tri"
              style={{ borderBottomColor: TAX_COLORS[upperTax.value] }}
            />
            <span style={{ color: TAX_COLORS[upperTax.value], fontWeight: 600 }}>
              Upper {getTaxLabel(upperTax.value)}
            </span>
            <span style={{ margin: '0 8px', opacity: 0.4 }}>|</span>
            <span>
              Overall Rate:{' '}
              <strong style={{ color: 'var(--color-text-secondary)' }}>{rateStr}</strong>
            </span>
          </div>
        </div>
      </OrnateFrame>
    </div>
  );
}
