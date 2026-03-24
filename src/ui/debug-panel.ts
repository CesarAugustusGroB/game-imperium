import type { MapRenderer } from '../renderer/renderer';

const MAP_MODES = [
  { key: '1', label: 'Full', mode: 0 },
  { key: '2', label: 'Terrain', mode: 1 },
  { key: '3', label: 'ID Map', mode: 2 },
  { key: '4', label: 'Normals', mode: 3 },
  { key: '5', label: 'Height', mode: 4 },
  { key: '6', label: 'Borders', mode: 5 },
];

export class DebugPanel {
  private panel: HTMLDivElement;
  private renderer: MapRenderer;
  private buttons: HTMLButtonElement[] = [];
  constructor(renderer: MapRenderer, onScreenshot: () => void) {
    this.renderer = renderer;

    this.panel = document.createElement('div');
    this.panel.id = 'debug-panel';
    this.panel.innerHTML = `<div class="dp-title">Map Debug</div>`;

    // Mode buttons
    const modeRow = document.createElement('div');
    modeRow.className = 'dp-row';
    for (const m of MAP_MODES) {
      const btn = document.createElement('button');
      btn.textContent = `${m.key}: ${m.label}`;
      btn.className = 'dp-btn';
      if (m.mode === 0) btn.classList.add('dp-active');
      btn.addEventListener('click', () => this.setMode(m.mode));
      modeRow.appendChild(btn);
      this.buttons.push(btn);
    }
    this.panel.appendChild(modeRow);

    // Screenshot button
    const screenshotBtn = document.createElement('button');
    screenshotBtn.textContent = 'F2: Screenshot';
    screenshotBtn.className = 'dp-btn dp-screenshot';
    screenshotBtn.addEventListener('click', onScreenshot);
    this.panel.appendChild(screenshotBtn);

    document.body.appendChild(this.panel);

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'F2') {
        e.preventDefault();
        onScreenshot();
        return;
      }
      const mode = MAP_MODES.find(m => m.key === e.key);
      if (mode) this.setMode(mode.mode);
    });
  }

  private setMode(mode: number): void {
    this.renderer.mapMode = mode;
    this.buttons.forEach((btn, i) => {
      btn.classList.toggle('dp-active', MAP_MODES[i].mode === mode);
    });
  }
}
