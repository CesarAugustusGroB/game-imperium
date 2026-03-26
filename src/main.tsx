import { render } from 'preact';
import { TestPreact } from './ui/TestPreact';
import { BattleMode } from './battle/index';

// Mount Preact UI into #app-root
const appRoot = document.getElementById('app-root');
if (appRoot) render(<TestPreact />, appRoot);

const battleMode = new BattleMode(() => {
  battleMode.enter();
});

// Boot directly into tactical battle
battleMode.enter();

window.addEventListener('resize', () => {
  battleMode.resize(window.innerWidth, window.innerHeight);
});

let lastTime = performance.now();
function frame(now: number) {
  const dt = (now - lastTime) / 1000;
  lastTime = now;
  battleMode.update(dt);
  battleMode.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
