import { useEffect, useRef } from 'preact/hooks';
import { Modal } from '../../components/Modal';
import { OrnateFrame } from '../../components/OrnateFrame';
import { playSfx } from '../../sound/sfx';
import { iterBelliState, applyBattleOutcome } from '../../../game/iterBelli/iter-belli-state';
import { veteranStacks } from '../../../game/core/game-state';
import { getActiveScenario } from '../../../game/iterBelli/iter-belli-scenario';
import { preparedArmy, preparedLegate } from '../../../game/progression/strategic-store';
import { getEquippedColorCount } from '../../../game/items/doctrine-store';
import { allyCount } from '../../../game/progression/ally-store';
import { pickAllyCohort } from '../../../game/army/cohort-data';
import {
  battleSession, beginBattleSession, concludeBattleSession,
} from '../../../game/iterBelli/battle/controller';
import {
  availableFormations, buildPlayerSeed, buildEnemyArchetype, terrainToCenterKey,
} from '../../../game/iterBelli/battle/adapter';
import { CENTERS, FORMATIONS } from '../../../game/iterBelli/battle/orders';
import { ENEMY_THREAT_DIVISOR, ENEMY_WEAKEN_PER_POINT } from '../../../game/iterBelli/iter-belli-balance';
import type { FormationKey } from '../../../game/iterBelli/battle/types';
import { DeploymentPanel } from './battle/DeploymentPanel';
import { ArmyStatus } from './battle/ArmyStatus';
import { CenterTrack } from './battle/CenterTrack';
import { OrderBar } from './battle/OrderBar';
import { DecretaBar } from './battle/DecretaBar';
import { BattleCanvas } from './battle/BattleCanvas';

export function BattleModal() {
  const started = useRef(false);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (started.current || battleSession.value) return;
    started.current = true;
    const cs = iterBelliState.value;
    const baseRoster = preparedArmy.value?.cohorts ?? [];
    const legate = preparedLegate.value;
    const scenario = getActiveScenario();
    // Web of Alliances (Diplomat passive): each forged ally fields one allied
    // contingent — HP + combat stats — alongside the legion. ALLY_UNIT_HP mirrors
    // the 500-soldier levy ratio used by spawn effects.
    const ALLY_UNIT_HP = 500;
    const allyUnits = cs.archetype === 'Diplomat' ? allyCount.value : 0;
    const alliedCohorts = Array.from({ length: allyUnits }, () => pickAllyCohort()).filter(Boolean) as NonNullable<ReturnType<typeof pickAllyCohort>>[];
    const roster = [...baseRoster, ...alliedCohorts];
    const allyHp = alliedCohorts.length * ALLY_UNIT_HP;
    const snap = { soldiers: cs.soldiers + allyHp, initialSoldiers: cs.initialSoldiers + allyHp, morale: cs.morale, discipline: cs.discipline, ammunition: cs.ammunition };
    const armor = { material: preparedArmy.value?.armorMaterial ?? 'copper' } as const;
    const fortified = cs.fortified === true;
    // Veteran Stacks (Warlord passive): +5% attack power per stacked victory (cap 5).
    const statMult = cs.archetype === 'Warlord' ? 1 + 0.05 * veteranStacks.value : 1;
    // Deus Vult (Religious passive): +1 pre-battle morale per equipped faith (gold)
    // doctrine, capped at +3. Leo (the pope) fields gold doctrines — color-lock blocks red —
    // so this rewards stacking the faith school.
    const DEUS_VULT_PER_DOCTRINE = 1;
    const DEUS_VULT_CAP = 3;
    const passiveMorale = cs.archetype === 'Religious'
      ? Math.min(DEUS_VULT_CAP, DEUS_VULT_PER_DOCTRINE * getEquippedColorCount('gold'))
      : 0;
    const seed0 = buildPlayerSeed(snap, roster, legate, undefined, armor, undefined, fortified, statMult, passiveMorale);
    const options = availableFormations(legate, seed0.discipline);
    const formationOptions: FormationKey[] = options.length ? options : ['battleLine'];
    // enemyMult = (1 + threat/THREAT_DIVISOR) * (1 - enemyWeaken*WEAKEN_PER_POINT) — see iter-belli-balance.
    const enemyMult = (1 + cs.threat / ENEMY_THREAT_DIVISOR) * (1 - cs.enemyWeaken * ENEMY_WEAKEN_PER_POINT);
    const enemySoldiers = Math.max(scenario.enemy.minSoldiers, Math.round(scenario.enemy.baseSoldiers * enemyMult));
    const enemyKey = scenario.enemy.archetypeKey;
    const enemy = buildEnemyArchetype(enemyKey, cs.enemyWeaken, enemySoldiers);
    beginBattleSession({
      playerSeedFor: (f) => buildPlayerSeed(snap, roster, legate, FORMATIONS[f], armor, undefined, fortified, statMult, passiveMorale),
      formationOptions,
      enemy,
      center: CENTERS[terrainToCenterKey(cs.spokeTerrain)],
      onConclude: (r) => {
        // Veteran Stacks (Warlord passive): each decisive victory stacks +5%
        // attack power for future battles (cap 5); a defeat shatters the streak.
        if (cs.archetype === 'Warlord') {
          veteranStacks.value = r.victory ? Math.min(5, veteranStacks.value + 1) : 0;
        }
        applyBattleOutcome(r.victory, r.survivors, r.finalMorale);
      },
    });
  }, []);

  useEffect(() => {
    const el = logRef.current; if (el) el.scrollTop = el.scrollHeight;
  }, [battleSession.value?.log.length]);

  const s = battleSession.value;
  if (!s) return null;

  return (
    // The decisive battle is a forced flow (resolve it, then Continue) — no
    // Escape / backdrop dismiss. Modal adds scroll-lock, focus-trap and dialog
    // ARIA; the dark battle backdrop is preserved.
    <Modal open onClose={() => {}} dismissable={false} label="Decisive battle" backdrop="rgba(0,0,0,0.62)">
      <OrnateFrame width="min(960px, 96vw)" padding="compact" style={{ maxHeight: '94vh', overflow: 'auto' }}>
        {s.phase === 'deployment' ? (
          <DeploymentPanel />
        ) : (
          <>
            <BattleCanvas state={s.state} round={s.state.round} lastOrders={s.lastOrders} lastLosses={s.lastLosses} />
            <div class="ib-bm-arena">
              <ArmyStatus army={s.state.you} />
              <CenterTrack state={s.state} lastOrders={s.lastOrders} />
              <ArmyStatus army={s.state.enemy} />
            </div>
            {s.phase === 'fighting' ? (
              <>
                <DecretaBar />
                <OrderBar />
              </>
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
    </Modal>
  );
}
