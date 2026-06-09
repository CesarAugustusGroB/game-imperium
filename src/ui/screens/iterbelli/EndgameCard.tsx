import { OrnateFrame } from '../../components/OrnateFrame';
import { playSfx } from '../../sound/sfx';
import { navigateTo } from '../../screens';
import { gold, iuniores } from '../../../game/core/resources';
import { completedSpokes, battlesWon, globalSeason, MAX_SEASONS, spokesSinceLastBattle } from '../../../game/core/game-state';
import { preparedArmy } from '../../../game/progression/strategic-store';
import { computeArmySize } from '../../../game/army/cohort';
import { iterBelliState, resetIterBelli } from '../../../game/iterBelli/iter-belli-state';
import { getActiveScenario } from '../../../game/iterBelli/iter-belli-scenario';
import { START } from '../../../game/iterBelli/iter-belli-balance';
import { conquerProvince, provinces, collectProvinceIncome } from '../../../game/province/province-store';
import { councilSlots, grantAdvisorXp } from '../../../game/council/council-store';
import { pickConquestName, PROVINCE_REWARD } from '../../../data/iter-belli-conquest';
import { getMissionById } from '../../../data/iter-belli-consilium';
import type { TerrainType } from '../../../data/terrain-data';
import type { ResourceType } from '../../../game/core/commander';
import { SUPPLY_MAX_CARRY } from '../../../config/game-config';
import { ResourceAmount } from '../../components/ResourceIcon';

/**
 * Apply the campaign result back to the run, then return to the Hub:
 *  • campaign gold (incl. victory bonus) flows back to run gold,
 *  • victory bumps completedSpokes,
 *  • surviving soldiers scale each cohort's HP (dead cohorts drop out),
 *  • leftover campaign supplies flow back to the Hub army (capped at the carry cap).
 */
function returnToHub(): void {
  const s = iterBelliState.value;
  const outcome = s.outcome;

  // Consilium mission: on victory, a met condition grants a gold bonus.
  const mission = getMissionById(s.missionId);
  const missionAccomplished = !!(outcome?.victory && mission && mission.condition(s));
  gold.value = s.gold + (mission && missionAccomplished ? mission.bonusGold : 0);
  iuniores.value = s.iuniores;

  // Season clock advances regardless of outcome — campaign time elapsed.
  globalSeason.value = Math.min(MAX_SEASONS, globalSeason.value + s.spokeDuration);
  // Provinces accrue income/ticks for each season spent on campaign.
  for (let i = 0; i < s.spokeDuration; i++) collectProvinceIncome();

  if (outcome?.victory) {
    completedSpokes.value++;
    battlesWon.value++;             // the decisive battle was won
    spokesSinceLastBattle.value = 0;

    // Conquer a province: terrain from the spoke theme, random unused name, fixed income.
    const taken = new Set(provinces.value.map((p) => p.name));
    const name = pickConquestName(taken, getActiveScenario().conquestNames);
    conquerProvince(name, PROVINCE_REWARD as Record<ResourceType, number>, 1, {
      terrain: s.spokeTerrain as TerrainType,
    });
  }

  const army = preparedArmy.value;
  if (army) {
    // Surviving soldiers scale each cohort's HP (dead cohorts drop out).
    // When initialSoldiers is 0 (degenerate launch), cohorts pass through unmodified.
    let cohorts = army.cohorts;
    if (s.initialSoldiers > 0) {
      const ratio = Math.max(0, Math.min(1, s.soldiers / s.initialSoldiers));
      cohorts = army.cohorts
        .map((c) => {
          const cur = c.currentHp ?? c.stats.hp;
          const scaled = Math.round(cur * ratio);
          return { ...c, currentHp: scaled, outOfAction: scaled <= 0 };
        })
        .filter((c) => (c.currentHp ?? 0) > 0);
    }
    // Unified supplies: leftover campaign supplies flow back, capped at the Hub carry cap.
    preparedArmy.value = {
      ...army,
      cohorts,
      size: computeArmySize(cohorts),
      supplies: Math.max(0, Math.min(SUPPLY_MAX_CARRY, s.supplies)),
    };
  }

  // Seated advisors earn XP for serving the campaign: +1 for completing it,
  // +1 more on victory. grantAdvisorXp auto-tiers-up and fires the promotion
  // toast; the new tier persists with the council in the next autosave.
  const xpPerAdvisor = 1 + (outcome?.victory ? 1 : 0);
  const seatedIds = councilSlots.value.flatMap((a) => (a ? [a.id] : []));
  for (const id of seatedIds) grantAdvisorXp(id, xpPerAdvisor);

  resetIterBelli();
  navigateTo('hub');
}

export function EndgameCard() {
  const s = iterBelliState.value;
  const outcome = s.outcome;
  if (!outcome) return null;
  const { victory } = outcome;
  const mission = getMissionById(s.missionId);
  const missionMet = !!(victory && mission && mission.condition(s));

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
          <div><span>Oro final</span><strong>{s.gold + (mission && missionMet ? mission.bonusGold : 0)}</strong></div>
          <div><span>Compromisos rotos</span><strong>{outcome.brokenCommitments}</strong></div>
          <div><span>Amenaza final</span><strong>{s.threat.toFixed(1)} / 10</strong></div>
          {mission && (
            <div>
              <span>Misión · {mission.title}</span>
              <strong style={{ color: missionMet ? 'var(--imp-gold-hi)' : 'var(--imp-text-lo)' }}>
                {missionMet ? <>cumplida <ResourceAmount type="gold" amount={mission.bonusGold} sign="+" iconSize="inline" /></> : 'no cumplida'}
              </strong>
            </div>
          )}
          {s.quests.map((q) => (
            <div key={q.id}>
              <span>Objetivo · {q.title}</span>
              <strong style={{ color: q.status === 'completed' ? 'var(--imp-gold-hi)' : q.status === 'failed' ? 'var(--imp-crimson)' : 'var(--imp-text-lo)' }}>
                {q.status === 'completed' ? 'cumplido' : q.status === 'failed' ? 'fallido' : 'no activado'}
              </strong>
            </div>
          ))}
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
