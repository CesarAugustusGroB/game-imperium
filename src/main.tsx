import { render } from 'preact';
import { App } from './ui/App';
import { currentScreen, navigateTo } from './ui/screens';
import { BattleMode } from './battle/index';

// Mount Preact UI
const appRoot = document.getElementById('app-root');
if (appRoot) render(<App />, appRoot);

const battleScreen = document.getElementById('battle-screen');

// Battle mode — on exit, return to node map
const battleMode = new BattleMode(() => {
  navigateTo('node-map');
});

// Apply initial screen state (handles #battle on page load)
let battleActive = false;
const initialScreen = currentScreen.value;
if (initialScreen === 'battle') {
  if (appRoot) appRoot.style.display = 'none';
  if (battleScreen) battleScreen.style.display = 'block';
  battleActive = true;
  battleMode.enter();
} else {
  if (battleScreen) battleScreen.style.display = 'none';
}

// Enter/exit battle when battle-screen visibility changes via navigateTo()
const observer = new MutationObserver(() => {
  const visible = battleScreen?.style.display !== 'none';
  if (visible && !battleActive) {
    battleActive = true;
    battleMode.enter();
  } else if (!visible && battleActive) {
    battleActive = false;
  }
});
if (battleScreen) {
  observer.observe(battleScreen, { attributes: true, attributeFilter: ['style'] });
}

// Resize
window.addEventListener('resize', () => {
  battleMode.resize(window.innerWidth, window.innerHeight);
});

// Render loop
let lastTime = performance.now();
function frame(now: number) {
  const dt = (now - lastTime) / 1000;
  lastTime = now;
  battleMode.update(dt);
  battleMode.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
