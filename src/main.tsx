import { render } from 'preact';
import { effect } from '@preact/signals';
import { App } from './ui/App';
import { currentScreen, navigateTo } from './ui/screens';
import { BattleMode } from './battle/index';

// Mount Preact UI
const appRoot = document.getElementById('app-root');
if (appRoot) render(<App />, appRoot);

// Battle mode — on exit, return to title
const battleMode = new BattleMode(() => {
  navigateTo('title');
});

// Apply initial screen state (handles #battle on page load)
let battleActive = false;
const initialScreen = currentScreen.value;
if (initialScreen === 'battle') {
  if (appRoot) appRoot.style.display = 'none';
  const battleScreen = document.getElementById('battle-screen');
  if (battleScreen) battleScreen.style.display = 'block';
  battleActive = true;
  battleMode.enter();
} else {
  const battleScreen = document.getElementById('battle-screen');
  if (battleScreen) battleScreen.style.display = 'none';
}

// Enter/exit battle when currentScreen signal changes
effect(() => {
  if (currentScreen.value === 'battle' && !battleActive) {
    battleActive = true;
    battleMode.enter();
  } else if (currentScreen.value !== 'battle' && battleActive) {
    battleActive = false;
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
  if (battleActive) {
    battleMode.update(dt);
    battleMode.render();
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
