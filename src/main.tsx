import { render } from 'preact';
import { App } from './ui/App';
import { navigateTo } from './ui/screens';
import { BattleMode } from './battle/index';

// Mount Preact UI
const appRoot = document.getElementById('app-root');
if (appRoot) render(<App />, appRoot);

// Hide battle screen on startup (title screen shows first)
const battleScreen = document.getElementById('battle-screen');
if (battleScreen) battleScreen.style.display = 'none';

// Battle mode — on exit, return to node map
const battleMode = new BattleMode(() => {
  navigateTo('node-map');
});

// Enter battle when battle-screen becomes visible
let battleActive = false;
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
