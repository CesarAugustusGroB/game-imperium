import './ui/design-tokens.css';
import './ui/globals.css';
import './ui/sound/music';
import { render } from 'preact';
import { effect, untracked } from '@preact/signals';
import { App } from './ui/screens/App';
import { currentScreen, navigateTo } from './ui/screens';
import { BattleMode, isFinalBattle } from './battle/index';
import { currentSpoke, lastBattleResult, syncPreparedFromBoundArmy } from './game/progression/spoke';
import { selectedCommander, veteranStacks, spokesSinceLastBattle, battlesWon } from './game/core/game-state';
import { syncBattleSignals, resetBattleSignals, battleActive, requestBattleExit } from './battle/battle-signals';
import { extractCohortHpSnapshot, applyVictoryCap, lastVictoryCapSummary } from './battle/casualties';
import { applyHexBattleOutcome, isHexEncounterSpoke, setHexBattleNavigation } from './game/campaign/hex-battle';
import { setBellumDefeatNavigation } from './game/campaign/campaign-defeat';

// S31-05b: register navigateTo with hex-battle so launchHexBattle can switch
// screens. Kept as an injected hook (not a direct import inside hex-battle)
// so the module stays node-runnable for verify scripts.
setHexBattleNavigation((screen) => navigateTo(screen as Parameters<typeof navigateTo>[0]));
setBellumDefeatNavigation(() => navigateTo('defeat'));

// Mount Preact UI
const appRoot = document.getElementById('app-root');
if (appRoot) render(<App />, appRoot);

// Battle mode — on exit, capture result and route accordingly
const battleMode = new BattleMode(() => {
  const { phase, winner } = battleMode.state;

  if (phase === 'victory' || phase === 'draw') {
    lastBattleResult.value = winner === 'blue' ? 'victory'
      : winner === 'red' ? 'defeat'
      : 'draw';
  } else {
    // ESC exit mid-battle — treat as defeat
    lastBattleResult.value = 'defeat';
  }

  if (lastBattleResult.value === 'victory') {
    battlesWon.value += 1;
    if (selectedCommander.value?.id === 'boudicca') {
      veteranStacks.value += 1;
      spokesSinceLastBattle.value = 0;
    }
  }

  // S26-03 / FT-HEAL: project per-unit battle HP back onto the bound army's
  // cohort roster so damage carries into the next battle and surfaces in the
  // Hub heal panel between spokes. Runs on all 3 outcomes (victory / defeat /
  // retreat). On victory, S26-04's cap layer reduces HP loss further per
  // unitsKilled / unitsDeployed.
  const spoke = currentSpoke.value;
  if (spoke?.boundArmy) {
    const playerUnits = battleMode.state.getBattleFactionUnits('blue');
    const preBattleCohorts = spoke.boundArmy.cohorts;
    let nextCohorts = extractCohortHpSnapshot(playerUnits, preBattleCohorts, {
      missingUnit: lastBattleResult.value === 'defeat' ? 'out-of-action' : 'preserve',
    });

    // S26-04 / FT-HEAL FR-11: victory damage cap. Defeats and retreats bypass.
    if (lastBattleResult.value === 'victory') {
      // L1: use the deployment-time snapshot as the denominator so fully-
      // despawned units (removed from the array during death animation) are
      // not silently excluded, which would bias the ratio low and over-absorb.
      const totalUnits = battleMode.state.initialBlueDeployedCount > 0
        ? battleMode.state.initialBlueDeployedCount
        : playerUnits.length;
      const killedUnits = playerUnits.filter(u => u.isDying || u.currentHp <= 0).length;
      const unitLossRatio = totalUnits > 0 ? killedUnits / totalUnits : 0;
      const capResult = applyVictoryCap(preBattleCohorts, nextCohorts, unitLossRatio);
      nextCohorts = capResult.cohorts;
      lastVictoryCapSummary.value = capResult;
    } else {
      lastVictoryCapSummary.value = null;
    }

    const nextBoundArmy = { ...spoke.boundArmy, cohorts: nextCohorts };
    currentSpoke.value = {
      ...spoke,
      boundArmy: nextBoundArmy,
    };
    syncPreparedFromBoundArmy(nextBoundArmy);
  } else {
    lastVictoryCapSummary.value = null;
  }

  // S7-11: Final invasion — route to victory/defeat screens instead of post-battle
  if (isFinalBattle.value) {
    isFinalBattle.value = false;
    if (lastBattleResult.value === 'victory') {
      navigateTo('victory');
    } else {
      navigateTo('defeat');
    }
    return;
  }

  // S31-05b: campaign hex battles synthesize a 1-node spoke labeled
  // `__hex_encounter__`. Detect that here and return the player to the
  // Bellum tab instead of the post-battle screen, after applying
  // strategic-layer fallout (morale/supplies). The HP write-back above
  // already projected cohort losses onto preparedArmy via the bound army.
  if (isHexEncounterSpoke(currentSpoke.value)) {
    const defeat = applyHexBattleOutcome(lastBattleResult.value);
    currentSpoke.value = null;
    lastBattleResult.value = null;
    if (defeat.defeated) return;
    navigateTo('forum');
    return;
  }

  if (currentSpoke.value) {
    navigateTo('post-battle');
  } else {
    // Quick Battle or no spoke — clear stale result and return to title
    lastBattleResult.value = null;
    navigateTo('title');
  }
});

// Apply initial screen state (handles #battle / #battleV2 on page load)
let isBattleActive = false;
const initialScreen = currentScreen.value;
const isBattleScreen = (s: string) => s === 'battle' || s === 'battleV2';

if (isBattleScreen(initialScreen)) {
  if (appRoot && initialScreen === 'battle') appRoot.style.display = 'none';
  const battleScreen = document.getElementById('battle-screen');
  if (battleScreen) battleScreen.style.display = 'block';
  isBattleActive = true;
  battleActive.value = true;
  // L2: clear stale victory-cap summary from any prior battle before entry.
  lastVictoryCapSummary.value = null;
  // Entry point is picked by whether a spoke is active, not by screen name —
  // NodeMapScreen now routes spoke battles through 'battleV2' so the Preact
  // overlay (settings, unit-info, army panels, strength bar) mounts on top.
  if (currentSpoke.value) {
    battleMode.enterFromSpoke();
  } else {
    battleMode.enterQuickBattle();
  }
} else {
  const battleScreen = document.getElementById('battle-screen');
  if (battleScreen) battleScreen.style.display = 'none';
}

// Enter/exit battle when currentScreen signal changes.
// Only `currentScreen` is tracked — the body runs inside `untracked()` so the
// many signals read by `enterFromSpoke()` (currentSpoke, threatLevel, …) and
// the writes performed by the post-battle HP write-back don't re-trigger this
// effect mid-exit. Without this guard, writing `currentSpoke.value` from the
// exit callback re-fires the effect, calls `enterFromSpoke()` again with a
// fresh BattleState (phase='fighting'), and the next screen change runs the
// exit branch a second time — clobbering `lastBattleResult` with 'defeat'.
effect(() => {
  const screen = currentScreen.value;
  untracked(() => {
    if (isBattleScreen(screen) && !isBattleActive) {
      isBattleActive = true;
      battleActive.value = true;
      lastVictoryCapSummary.value = null;
      if (currentSpoke.value) {
        battleMode.enterFromSpoke();
      } else {
        battleMode.enterQuickBattle();
      }
    } else if (!isBattleScreen(screen) && isBattleActive) {
      isBattleActive = false;
      battleActive.value = false;
      resetBattleSignals();
      battleMode.exit();
    }
  });
});

// Resize
window.addEventListener('resize', () => {
  battleMode.resize(window.innerWidth, window.innerHeight);
});

// Render loop
let lastTime = performance.now();
function frame(now: number) {
  const dt = (now - lastTime) / 1000;
  lastTime = now;
  if (isBattleActive) {
    // Handle exit request from Preact overlay (e.g. Continue button)
    if (requestBattleExit.value) {
      requestBattleExit.value = false;
      // Set flags before exit to prevent the effect from double-exiting
      isBattleActive = false;
      battleActive.value = false;
      resetBattleSignals();
      battleMode.exit();
      return requestAnimationFrame(frame);
    }
    battleMode.update(dt);
    battleMode.render();
    // Sync battle state → Preact signals for BattleScreenV2 overlay
    syncBattleSignals(battleMode.state);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
