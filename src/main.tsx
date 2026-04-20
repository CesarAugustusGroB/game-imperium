import './ui/design-tokens.css';
import './ui/globals.css';
import { render } from 'preact';
import { effect } from '@preact/signals';
import { App } from './ui/screens/App';
import { currentScreen, navigateTo } from './ui/screens';
import { BattleMode, isFinalBattle } from './battle/index';
import { currentSpoke, lastBattleResult } from './game/progression/spoke';
import { selectedCommander, veteranStacks, spokesSinceLastBattle, battlesWon } from './game/core/game-state';
import { syncBattleSignals, resetBattleSignals, battleActive, requestBattleExit } from './battle/battle-signals';

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

// Enter/exit battle when currentScreen signal changes
effect(() => {
  const screen = currentScreen.value;
  if (isBattleScreen(screen) && !isBattleActive) {
    isBattleActive = true;
    battleActive.value = true;
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
