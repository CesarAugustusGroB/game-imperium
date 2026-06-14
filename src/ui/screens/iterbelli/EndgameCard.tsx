import { OrnateFrame } from '../../components/OrnateFrame';
import { playSfx } from '../../sound/sfx';
import { navigateTo } from '../../screens';
import { iterBelliState } from '../../../game/iterBelli/iter-belli-state';
import { getScenarioById } from '../../../game/iterBelli/iter-belli-scenario';
import { returnFromCampaign } from '../../../game/iterBelli/return-to-hub';
import { addNotification } from '../../notifications/notification-store';
import { START } from '../../../game/iterBelli/iter-belli-balance';
import { getMissionById } from '../../../data/iter-belli-consilium';
import { ResourceAmount } from '../../components/ResourceIcon';

/**
 * Settle the finished campaign back into the run and return to the Hub. The game
 * side effects live in returnFromCampaign() (game/iterBelli/return-to-hub.ts) so
 * they can be unit-tested; the UI keeps only navigation + the unlock notification.
 */
function returnToHub(): void {
  const result = returnFromCampaign();
  if (result.alreadyReturned) return; // double-click guard: nothing left to settle

  if (result.unlockedScenarioId) {
    const next = getScenarioById(result.unlockedScenarioId);
    addNotification({
      kind: 'pinned',
      icon: '⚑',
      title: 'Nueva campaña disponible',
      message: `Has desbloqueado: ${next?.narrative.victoryTitle ?? result.unlockedScenarioId}. Elígela en el Foro al embarcar.`,
    });
  }

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
