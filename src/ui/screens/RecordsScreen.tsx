import { navigateTo } from '../screens';
import { playSfx } from '../sound/sfx';
import { metaSave } from '../../game/core/meta-save';
import type { CampaignLogEntry } from '../../game/core/meta-save';

// ── CSS injection (idempotent; Imperium tokens, mirrors the campaign aesthetic) ──
if (typeof document !== 'undefined') {
  const el = document.getElementById('records-styles') ?? document.createElement('style');
  el.id = 'records-styles';
  el.textContent = `
  .rec-screen {
    min-height: 100vh; box-sizing: border-box; padding: 32px clamp(16px, 5vw, 64px) 48px;
    background:
      radial-gradient(ellipse 1200px 600px at 50% 0%, rgba(122, 36, 50, 0.10), transparent 60%),
      linear-gradient(180deg, var(--imp-ink-soft) 0%, var(--imp-ink) 100%);
    color: var(--imp-text); font-family: var(--imp-font-body);
  }
  .rec-head { text-align: center; margin-bottom: 22px; }
  .rec-head .eyebrow { font-size: var(--imp-text-xs); letter-spacing: var(--imp-title-letter); text-transform: uppercase; color: var(--imp-gold-mid); }
  .rec-head h1 { font-family: var(--imp-font-display); font-weight: 600; font-size: clamp(26px, 4vw, 40px); letter-spacing: 4px; color: var(--imp-gold-hi); margin: 2px 0 0; text-shadow: 0 2px 12px rgba(0,0,0,0.6); }
  .rec-head .sub { font-style: italic; color: var(--imp-text-mid); font-size: 13px; margin-top: 4px; }
  .rec-wrap { max-width: 920px; margin: 0 auto; }

  .rec-stats { display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; margin-bottom: 26px; }
  .rec-stat { min-width: 124px; padding: 12px 18px; text-align: center; background: var(--imp-panel); border: 1px solid var(--imp-gold-faint); border-radius: var(--radius-sm); }
  .rec-stat-value { font-family: var(--imp-font-mono); font-size: 26px; font-weight: 700; color: var(--imp-gold-hi); }
  .rec-stat-label { font-size: var(--imp-text-xs); letter-spacing: var(--imp-meta-letter); text-transform: uppercase; color: var(--imp-text-mid); margin-top: 2px; }

  .rec-list { display: flex; flex-direction: column; gap: 8px; }
  .rec-row {
    display: grid; grid-template-columns: 88px 1fr auto; gap: 14px; align-items: center;
    padding: 12px 16px; background: var(--imp-panel); border: 1px solid var(--imp-gold-faint);
    border-left: 3px solid var(--imp-gold-dim); border-radius: var(--radius-sm);
  }
  .rec-row.victory { border-left-color: var(--imp-gold); }
  .rec-row.defeat { border-left-color: var(--imp-crimson); }
  .rec-badge { font-family: var(--imp-font-display); font-size: 12px; letter-spacing: 2px; text-transform: uppercase; text-align: center; }
  .rec-badge.victory { color: var(--imp-gold-hi); }
  .rec-badge.defeat { color: var(--imp-crimson); }
  .rec-mid { min-width: 0; }
  .rec-cmd { font-family: var(--imp-font-display); font-size: 16px; color: var(--imp-text-hi); }
  .rec-scenario { font-size: var(--imp-text-xs); text-transform: uppercase; letter-spacing: var(--imp-meta-letter); color: var(--imp-gold-mid); }
  .rec-cause { font-size: 12px; color: var(--imp-text-mid); font-style: italic; margin-top: 2px; }
  .rec-meta { text-align: right; font-family: var(--imp-font-mono); font-size: 11px; color: var(--imp-text-mid); line-height: 1.5; white-space: nowrap; }
  .rec-meta .hi { color: var(--imp-text-hi); }

  .rec-empty { text-align: center; padding: 60px 20px; color: var(--imp-text-mid); font-style: italic; }
  .rec-actions { text-align: center; margin-top: 28px; }
  .rec-back {
    padding: 10px 26px; border-radius: var(--radius-sm); cursor: pointer;
    background: var(--imp-panel-soft); border: 1px solid var(--imp-gold-dim); color: var(--imp-text);
    font-family: var(--imp-font-body); font-size: 13px; letter-spacing: 1px;
    transition: border-color var(--duration-fast) var(--ease-default), background var(--duration-fast) var(--ease-default);
  }
  .rec-back:hover { border-color: var(--imp-gold); background: var(--imp-panel-hover); }
  `;
  document.head.appendChild(el);
}

const fmtDate = (iso: string): string => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
};

function Row({ e }: { e: CampaignLogEntry }) {
  return (
    <div class={`rec-row ${e.outcome}`}>
      <div class={`rec-badge ${e.outcome}`}>{e.outcome === 'victory' ? 'Victoria' : 'Derrota'}</div>
      <div class="rec-mid">
        <div class="rec-cmd">{e.commanderName}</div>
        <div class="rec-scenario">{e.scenarioId}</div>
        <div class="rec-cause">{e.cause}</div>
      </div>
      <div class="rec-meta">
        <div><span class="hi">{e.survivors}</span> superv. · <span class="hi">{e.daysUsed}</span> días</div>
        <div>Estación {e.seasonsAtEnd} · {fmtDate(e.date)}</div>
      </div>
    </div>
  );
}

export function RecordsScreen() {
  const logs = metaSave.value.campaignLogs;
  const total = logs.length;
  const victories = logs.filter((l) => l.outcome === 'victory').length;
  const winRate = total ? Math.round((victories / total) * 100) : 0;
  // Best campaign: fastest victory (fewest days); falls back to none.
  const fastest = logs
    .filter((l) => l.outcome === 'victory')
    .reduce<CampaignLogEntry | null>((best, l) => (!best || l.daysUsed < best.daysUsed ? l : best), null);

  return (
    <div class="rec-screen">
      <header class="rec-head">
        <div class="eyebrow">Annales Imperii</div>
        <h1>ANALES DE CAMPAÑA</h1>
        <div class="sub">El registro de tus marchas de guerra, victoria y derrota.</div>
      </header>

      <div class="rec-wrap">
        {total > 0 && (
          <div class="rec-stats">
            <div class="rec-stat"><div class="rec-stat-value">{total}</div><div class="rec-stat-label">Campañas</div></div>
            <div class="rec-stat"><div class="rec-stat-value">{victories}</div><div class="rec-stat-label">Victorias</div></div>
            <div class="rec-stat"><div class="rec-stat-value">{winRate}%</div><div class="rec-stat-label">Tasa de éxito</div></div>
            {fastest && (
              <div class="rec-stat"><div class="rec-stat-value">{fastest.daysUsed}</div><div class="rec-stat-label">Victoria más rápida</div></div>
            )}
          </div>
        )}

        {total === 0 ? (
          <div class="rec-empty">Aún no hay campañas registradas. Embárcate en una marcha y vuelve victorioso (o no) para llenar estos anales.</div>
        ) : (
          <div class="rec-list">
            {logs.map((e, i) => <Row key={`${e.date}-${i}`} e={e} />)}
          </div>
        )}

        <div class="rec-actions">
          <button class="rec-back" onClick={() => { playSfx('ui_click'); navigateTo('title'); }}>
            ◄ Volver al título
          </button>
        </div>
      </div>
    </div>
  );
}
