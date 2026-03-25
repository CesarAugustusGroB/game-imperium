import { BattleMode } from './battle/index';

const battleMode = new BattleMode(() => {
  // On exit, restart a new battle
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
