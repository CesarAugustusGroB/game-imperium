import { useEffect } from 'preact/hooks';
import { OrnateFrame, OrnateHeader } from '../components/OrnateFrame';
import {
  QUICK_BATTLE_SCENARIOS,
  selectedQuickBattleScenarioId,
} from '../../battle/quick-battle-scenarios';
import type { QuickBattleScenario } from '../../battle/quick-battle-scenarios';
import { navigateTo } from '../screens';

// One-time CSS injection
if (typeof document !== 'undefined' && !document.getElementById('quick-battle-styles')) {
  const el = document.createElement('style');
  el.id = 'quick-battle-styles';
  el.textContent = `
    @keyframes qb-fade-in {
      from { opacity: 0; transform: translateY(12px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .qb-screen {
      position: relative;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px 16px;
      background: var(--color-bg-primary);
      font-family: var(--font-family);
    }
    .qb-screen::before {
      content: '';
      position: fixed; inset: 0;
      background: radial-gradient(ellipse at center, rgba(240,208,128,0.04), transparent 70%);
      pointer-events: none;
    }
    .qb-screen::after {
      content: '';
      position: fixed; inset: 0;
      background: radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.7));
      pointer-events: none;
    }
    .qb-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 18px;
      width: 100%;
      margin-top: 22px;
      animation: qb-fade-in 0.45s ease-out both;
    }
    .qb-card {
      position: relative;
      padding: 18px 20px;
      background: linear-gradient(135deg, var(--color-bg-secondary), var(--color-bg-primary));
      border: 1px solid var(--color-border-default);
      border-radius: var(--radius-md);
      cursor: pointer;
      transition: border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .qb-card:hover {
      border-color: var(--color-gold-primary);
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(0,0,0,0.35), 0 0 16px rgba(240,208,128,0.18);
    }
    .qb-card-label {
      font-family: var(--font-display);
      font-size: 18px;
      font-weight: 700;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: var(--color-gold-primary);
      line-height: 1.1;
    }
    .qb-card-sides {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 12px;
      color: var(--color-text-secondary);
    }
    .qb-side {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .qb-side-dot {
      width: 8px; height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .qb-side-dot.blue { background: #4a7cc2; box-shadow: 0 0 6px rgba(74,124,194,0.5); }
    .qb-side-dot.red  { background: #c24a3a; box-shadow: 0 0 6px rgba(194,74,58,0.5); }
    .qb-vs {
      font-family: var(--font-display);
      color: var(--color-gold-secondary);
      opacity: 0.7;
      font-size: 10px;
      letter-spacing: 1px;
    }
    .qb-card-cta {
      margin-top: 4px;
      align-self: flex-start;
      font-family: var(--font-display);
      font-size: 11px;
      letter-spacing: 2px;
      color: var(--color-gold-secondary);
      text-transform: uppercase;
    }
    .qb-card:hover .qb-card-cta {
      color: var(--color-gold-primary);
    }
    .qb-footer {
      margin-top: 22px;
      display: flex;
      justify-content: flex-start;
    }
  `;
  document.head.appendChild(el);
}

function ScenarioCard({ scenario }: { scenario: QuickBattleScenario }) {
  const start = () => {
    selectedQuickBattleScenarioId.value = scenario.id;
    navigateTo('battleV2');
  };
  return (
    <div class="qb-card" onClick={start} role="button" tabIndex={0}
         onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') start(); }}>
      <div class="qb-card-label">{scenario.label}</div>
      <div class="qb-card-sides">
        <span class="qb-side"><span class="qb-side-dot blue" />{scenario.blueName}</span>
        <span class="qb-vs">VS</span>
        <span class="qb-side"><span class="qb-side-dot red" />{scenario.redName}</span>
      </div>
      <div class="qb-card-cta">Fight →</div>
    </div>
  );
}

export function QuickBattleScreen() {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') navigateTo('title');
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div class="qb-screen">
      <OrnateFrame width="min(760px, 94vw)" padding="default">
        <OrnateHeader
          eyebrow="Skirmish"
          title="QUICK BATTLE"
          onClose={() => navigateTo('title')}
        />

        <div style={{
          fontSize: 'var(--font-size-sm)',
          color: 'var(--color-text-muted)',
          letterSpacing: '1px',
          marginTop: -10,
        }}>
          Pick a matchup — no campaign required.
        </div>

        <div class="qb-grid">
          {QUICK_BATTLE_SCENARIOS.map(s => <ScenarioCard key={s.id} scenario={s} />)}
        </div>

        <div class="qb-footer">
          <button
            class="ornate-btn-ghost"
            onClick={() => navigateTo('title')}
            style={{ padding: '10px 18px', fontSize: 'var(--font-size-md)' }}
          >
            ← Back
          </button>
        </div>
      </OrnateFrame>
    </div>
  );
}
