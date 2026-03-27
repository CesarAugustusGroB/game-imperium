import { BattleState } from './battle-state';
import { BattleRenderer } from './battle-renderer';
import { BattleInput } from './battle-input';
import { tickAI } from './battle-ai';

export class BattleMode {
  private canvas: HTMLCanvasElement;
  private state: BattleState;
  private renderer: BattleRenderer;
  private input: BattleInput;
  private onExitCallback: () => void;
  private _isVisible = false;
  private boundToggleCoords: () => void;

  constructor(onExitCallback: () => void) {
    this.onExitCallback = onExitCallback;
    this.canvas = document.getElementById('battle-canvas') as HTMLCanvasElement;

    this.state = new BattleState();
    this.renderer = new BattleRenderer(this.canvas, this.state);
    this.input = new BattleInput(this.canvas, this.state, this.renderer, () => this.exit());

    const btn = document.getElementById('btn-coords');
    this.boundToggleCoords = () => {
      this.renderer.showCoords = !this.renderer.showCoords;
      btn?.classList.toggle('active', this.renderer.showCoords);
    };
  }

  get isVisible(): boolean {
    return this._isVisible;
  }

  enter(): void {
    this._isVisible = true;

    this.state = new BattleState();
    this.state.generateGrid();
    this.state.placeStartingUnits();

    this.renderer.setState(this.state);
    this.input.setState(this.state);

    this.resize(window.innerWidth, window.innerHeight);
    this.input.attach();
    document.getElementById('btn-coords')?.addEventListener('click', this.boundToggleCoords);
  }

  exit(): void {
    this._isVisible = false;
    this.input.detach();
    document.getElementById('btn-coords')?.removeEventListener('click', this.boundToggleCoords);
    this.onExitCallback();
  }

  update(dt: number): void {
    if (!this._isVisible) return;

    // Tick all animations (movement, shake, flash, lunge, death, cooldowns)
    this.state.updateAnimations(dt);

    if (this.state.phase !== 'fighting') return;

    // Semi-real-time: each unit acts on its own cooldown
    tickAI(this.state, 'blue');
    tickAI(this.state, 'red');

    // Check victory
    this.state.checkVictory();
  }

  render(): void {
    if (!this._isVisible) return;
    this.renderer.render();
  }

  resize(width: number, height: number): void {
    this.renderer.resize(width, height);
  }
}
