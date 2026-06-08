import { useEffect, useRef } from 'preact/hooks';
import { OrnateFrame } from '../../components/OrnateFrame';
import { playSfx } from '../../sound/sfx';
import { iterBelliState, applyBattleOutcome } from '../../../game/iterBelli/iter-belli-state';
import { getActiveScenario } from '../../../game/iterBelli/iter-belli-scenario';
import { preparedArmy, preparedLegate } from '../../../game/progression/strategic-store';
import {
  battleSession, beginBattleSession, concludeBattleSession,
} from '../../../game/iterBelli/battle/controller';
import {
  availableFormations, buildPlayerSeed, buildEnemyArchetype, terrainToCenterKey,
} from '../../../game/iterBelli/battle/adapter';
import { CENTERS, FORMATIONS } from '../../../game/iterBelli/battle/orders';
import type { FormationKey } from '../../../game/iterBelli/battle/types';
import { DeploymentPanel } from './battle/DeploymentPanel';
import { ArmyStatus } from './battle/ArmyStatus';
import { OrderBar } from './battle/OrderBar';
import { BattleCanvas } from './battle/BattleCanvas';

export function BattleModal() {
  const started = useRef(false);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (started.current || battleSession.value) return;
    started.current = true;
    const cs = iterBelliState.value;
    const roster = preparedArmy.value?.cohorts ?? [];
    const legate = preparedLegate.value;
    const scenario = getActiveScenario();
    const snap = { soldiers: cs.soldiers, initialSoldiers: cs.initialSoldiers, morale: cs.morale, discipline: cs.discipline, ammunition: cs.ammunition };
    const armor = { material: preparedArmy.value?.armorMaterial ?? 'copper' } as const;
    const fortified = cs.fortified === true;
    const seed0 = buildPlayerSeed(snap, roster, legate, undefined, armor, undefined, fortified);
    const options = availableFormations(legate, seed0.discipline);
    const formationOptions: FormationKey[] = options.length ? options : ['battleLine'];
    const enemySoldiers = Math.max(scenario.enemy.minSoldiers, Math.round(scenario.enemy.baseSoldiers * (1 - cs.enemyWeaken * 0.07)));
    const enemyKey = (scenario.enemy as { archetypeKey?: string }).archetypeKey ?? 'carthage';
    const enemy = buildEnemyArchetype(enemyKey, cs.enemyWeaken, enemySoldiers);
    beginBattleSession({
      playerSeedFor: (f) => buildPlayerSeed(snap, roster, legate, FORMATIONS[f], armor, undefined, fortified),
      formationOptions,
      enemy,
      center: CENTERS[terrainToCenterKey(cs.spokeTerrain)],
      onConclude: (r) => applyBattleOutcome(r.victory, r.survivors, r.finalMorale),
    });
  }, []);

  useEffect(() => {
    const el = logRef.current; if (el) el.scrollTop = el.scrollHeight;
  }, [battleSession.value?.log.length]);

  const s = battleSession.value;
  if (!s) return null;

  return (
    <div class="ib-overlay">
      <OrnateFrame width="min(960px, 96vw)" padding="compact" style={{ maxHeight: '94vh', overflow: 'auto' }}>
        {s.phase === 'deployment' ? (
          <DeploymentPanel />
        ) : (
          <>
            <BattleCanvas state={s.state} round={s.state.round} lastOrders={s.lastOrders} lastLosses={s.lastLosses} />
            <div class="ib-bm-arena">
              <ArmyStatus army={s.state.you} />
              <div class="ib-bm-round"><div class="ib-bm-round-label">Round</div><div class="ib-bm-round-num">{s.state.round}</div></div>
              <ArmyStatus army={s.state.enemy} />
            </div>
            {s.phase === 'fighting' ? (
              <OrderBar />
            ) : (
              <div class="ib-bm-stances-section" style={{ textAlign: 'center' }}>
                <div class="ib-section-title">{s.state.victory ? 'Victory in the field' : 'Defeat in the field'}</div>
                <button class="ornate-btn" style={{ marginTop: 8 }} onClick={() => { playSfx(s.state.victory ? 'victory_fanfare' : 'defeat_sting'); concludeBattleSession(); }}>Continue</button>
              </div>
            )}
            <div class="ib-bm-log" ref={logRef}>
              {s.log.map((l, i) => <div key={i} class={`ib-bm-log-line ${l.kind}`}>{l.text}</div>)}
            </div>
          </>
        )}
      </OrnateFrame>
    </div>
  );
}
