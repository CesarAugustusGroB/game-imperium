import { BattleState } from './battle-state';
import { BattleRenderer } from './battle-renderer';
import { BattleInput } from './battle-input';
import { tickAI } from './battle-ai';
import { initAbilityBar, updateAbilityBar, destroyAbilityBar } from './ability-ui';
import { selectedCommander, veteranStacks, allianceCount } from '../game/game-state';
import { offsetToAxial } from './hex';

export class BattleMode {
  private canvas: HTMLCanvasElement;
  private _state: BattleState;
  private renderer: BattleRenderer;
  private input: BattleInput;
  private onExitCallback: () => void;
  private _isVisible = false;
  private boundToggleCoords: () => void;

  constructor(onExitCallback: () => void) {
    this.onExitCallback = onExitCallback;
    this.canvas = document.getElementById('battle-canvas') as HTMLCanvasElement;

    this._state = new BattleState();
    this.renderer = new BattleRenderer(this.canvas, this._state);
    this.input = new BattleInput(this.canvas, this._state, this.renderer, () => this.exit());

    const btn = document.getElementById('btn-coords');
    this.boundToggleCoords = () => {
      this.renderer.showCoords = !this.renderer.showCoords;
      btn?.classList.toggle('active', this.renderer.showCoords);
    };
  }

  get isVisible(): boolean {
    return this._isVisible;
  }

  get state(): BattleState {
    return this._state;
  }

  enter(): void {
    this._isVisible = true;

    this._state = new BattleState();
    this._state.generateGrid();
    this._state.placeStartingUnits();

    if (selectedCommander.value?.id === 'boudicca') {
      this._state.veteranBonus = veteranStacks.value * 0.05;
    }

    // S3-10: Augustus — spawn extra allied units based on allianceCount
    if (selectedCommander.value?.id === 'augustus') {
      const extraUnits = allianceCount.value;
      for (let i = 0; i < extraUnits; i++) {
        // Spawn in blue reserve area (col 4, varied rows)
        const row = 3 + i * 4; // rows 3, 7
        const hex = offsetToAxial(4, row);
        if (this._state.isValidHex(hex) && !this._state.getUnitAt(hex)) {
          const unit = this._state.addUnit('blue', hex, `Allied ${i + 1}`, 'reserve');
          unit.currentHp = Math.floor(unit.stats.hp * 0.85); // slightly weaker allies
        }
      }
    }

    this.renderer.setState(this._state);
    this.input.setState(this._state);

    this.resize(window.innerWidth, window.innerHeight);
    this.input.attach();
    initAbilityBar(this._state);
    document.getElementById('btn-coords')?.addEventListener('click', this.boundToggleCoords);
  }

  exit(): void {
    this._isVisible = false;
    this.input.detach();
    destroyAbilityBar();
    document.getElementById('btn-coords')?.removeEventListener('click', this.boundToggleCoords);
    this.onExitCallback();
  }

  update(dt: number): void {
    if (!this._isVisible) return;

    // Tick all animations (movement, shake, flash, lunge, death, cooldowns)
    this._state.updateAnimations(dt);

    if (this._state.phase !== 'fighting') return;

    // Semi-real-time: each unit acts on its own cooldown
    tickAI(this._state, 'blue');
    tickAI(this._state, 'red');

    // Check victory
    this._state.checkVictory();

    updateAbilityBar();
  }

  render(): void {
    if (!this._isVisible) return;
    this.renderer.render();
  }

  resize(width: number, height: number): void {
    this.renderer.resize(width, height);
  }
}
