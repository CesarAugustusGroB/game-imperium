import { OrnateFrame } from '../../components/OrnateFrame';
import { playSfx } from '../../sound/sfx';
import { navigateTo } from '../../screens';
import { gold, iuniores } from '../../../game/core/resources';
import { completedSpokes } from '../../../game/core/game-state';
import { preparedArmy } from '../../../game/progression/strategic-store';
import { computeArmySize } from '../../../game/army/cohort';
import { iterBelliState, resetIterBelli } from '../../../game/iterBelli/iter-belli-state';
import { resetIterBelliBattle } from '../../../game/iterBelli/iter-belli-combat';
import { START } from '../../../game/iterBelli/iter-belli-balance';

/**
 * Apply the campaign result back to the run, then return to the Hub:
 *  • campaign gold (incl. victory bonus) flows back to run gold,
 *  • victory bumps completedSpokes,
 *  • surviving soldiers scale each cohort's HP (dead cohorts drop out).
 */
function returnToHub(): void {
  const s = iterBelliState.value;
  const outcome = s.outcome;

  gold.value = s.gold;
  iuniores.value = s.iuniores;
  if (outcome?.victory) completedSpokes.value++;

  const army = preparedArmy.value;
  if (army && s.initialSoldiers > 0) {
    const ratio = Math.max(0, Math.min(1, s.soldiers / s.initialSoldiers));
    const cohorts = army.cohorts
      .map((c) => {
        const cur = c.currentHp ?? c.stats.hp;
        const scaled = Math.round(cur * ratio);
        return { ...c, currentHp: scaled, outOfAction: scaled <= 0 };
      })
      .filter((c) => (c.currentHp ?? 0) > 0);
    preparedArmy.value = { ...army, cohorts, size: computeArmySize(cohorts) };
  }

  resetIterBelliBattle();
  resetIterBelli();
  navigateTo('hub');
}

export function EndgameCard() {
  const s = iterBelliState.value;
  const outcome = s.outcome;
  if (!outcome) return null;
  const { victory } = outcome;

  return (
    <div class="ib-overlay">
      <OrnateFrame width="min(620px, 94vw)" padding="hero" style={{ textAlign: 'center' }}>
        <div class={`ib-end-mark ${victory ? 'victory' : 'defeat'}`}>
          {victory ? '✦ VICTORIA ✦' : '✖ DERROTA ✖'}
        </div>
        <h2 class="ib-end-title">{outcome.title}</h2>
        <p class="ib-end-text">{outcome.text}</p>
        <div class="ib-end-stats">
          <div><span>Soldados restantes</span><strong>{outcome.soldiers.toLocaleString('es')} / {s.initialSoldiers.toLocaleString('es')}</strong></div>
          <div><span>Días empleados</span><strong>{outcome.turnNum} (de {START.timeRemaining})</strong></div>
          <div><span>Oro final</span><strong>{s.gold}</strong></div>
          <div><span>Compromisos rotos</span><strong>{outcome.brokenCommitments}</strong></div>
          <div><span>Amenaza final</span><strong>{s.threat.toFixed(1)} / 10</strong></div>
        </div>
        <button
          class="ornate-btn"
          style={{ marginTop: 16 }}
          onClick={() => { playSfx('ui_click'); returnToHub(); }}
        >
          Volver al Hub
        </button>
      </OrnateFrame>
    </div>
  );
}
