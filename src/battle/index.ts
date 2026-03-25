import { BattleState } from './battle-state';
import { BattleRenderer } from './battle-renderer';
import { BattleInput } from './battle-input';

export class BattleMode {
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private state: BattleState;
  private renderer: BattleRenderer;
  private input: BattleInput;
  private onExitCallback: () => void;
  private _isVisible = false;

  constructor(onExitCallback: () => void) {
    this.onExitCallback = onExitCallback;
    this.container = document.getElementById('battle-screen')!;
    this.canvas = document.getElementById('battle-canvas') as HTMLCanvasElement;

    this.state = new BattleState();
    this.renderer = new BattleRenderer(this.canvas, this.state);
    this.input = new BattleInput(this.canvas, this.state, this.renderer, () => this.exit());
  }

  get isVisible(): boolean {
    return this._isVisible;
  }

  enter(): void {
    this._isVisible = true;
    this.container.classList.remove('hidden');

    // Fresh battle state each time
    this.state = new BattleState();
    this.state.generateGrid();
    this.state.placeStartingUnits();
    this.renderer.setState(this.state);
    this.input.setState(this.state);

    this.resize(window.innerWidth, window.innerHeight);
    this.input.attach();
  }

  exit(): void {
    this._isVisible = false;
    this.container.classList.add('hidden');
    this.input.detach();
    this.onExitCallback();
  }

  render(): void {
    if (!this._isVisible) return;
    this.renderer.render();
  }

  resize(width: number, height: number): void {
    this.renderer.resize(width, height);
  }
}
