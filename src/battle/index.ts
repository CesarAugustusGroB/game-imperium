import { BattleState } from './battle-state';
import { BattleRenderer } from './battle-renderer';
import { BattleInput } from './battle-input';
import { tickAI } from './battle-ai';
import { initAbilityBar, updateAbilityBar, destroyAbilityBar, initDecretumBar, updateDecretumBar, destroyDecretumBar } from './ability-ui';
import { selectedCommander, veteranStacks, allianceCount } from '../game/game-state';
import { VETERAN_BONUS_PER_STACK } from './battle-config';
import { offsetToAxial } from './hex';
import { getActiveEffects } from '../game/doctrine-store';
import type { DoctrineEffect } from '../game/doctrine';
import { getProvinceEffects } from '../game/province-store';
import { pauseMusic, resumeMusic } from '../ui/music';

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
    pauseMusic();

    this._state = new BattleState();
    this._state.generateGrid();
    this._state.placeStartingUnits();

    if (selectedCommander.value?.id === 'boudicca') {
      this._state.veteranBonus = veteranStacks.value * VETERAN_BONUS_PER_STACK;
    }

    // S3-10: Augustus — spawn extra allied units based on allianceCount
    if (selectedCommander.value?.id === 'augustus') {
      const ALLY_HP_RATIO = 0.85;
      const extraUnits = Math.min(allianceCount.value, 4);
      for (let i = 0; i < extraUnits; i++) {
        // Spawn in blue reserve area (col 4, varied rows)
        const row = 3 + i * 4; // rows 3, 7
        const hex = offsetToAxial(4, row);
        if (this._state.isValidHex(hex) && !this._state.getUnitAt(hex)) {
          const unit = this._state.addUnit('blue', hex, `Allied ${i + 1}`, 'reserve');
          unit.currentHp = Math.floor(unit.stats.hp * ALLY_HP_RATIO);
        }
      }
    }

    // Apply Doctrine + Province passive effects at battle start
    const doctrineEffects: DoctrineEffect[] = [...getActiveEffects(), ...getProvinceEffects()];
    for (const effect of doctrineEffects) {
      switch (effect.type) {
        case 'stat-modifier': {
          for (const unit of this._state.getFactionUnits('blue')) {
            if (effect.stat === 'damage') unit.stats.atk = Math.floor(unit.stats.atk * (1 + effect.multiplier));
            else if (effect.stat === 'armor') unit.stats.def = Math.floor(unit.stats.def * (1 + effect.multiplier));
            else if (effect.stat === 'maxHp') {
              unit.stats.hp = Math.floor(unit.stats.hp * (1 + effect.multiplier));
              unit.currentHp = Math.min(unit.currentHp, unit.stats.hp);
            }
          }
          break;
        }
        case 'heal-battle-start': {
          for (const unit of this._state.getFactionUnits('blue')) {
            if (effect.amount === 'full') {
              unit.currentHp = unit.stats.hp;
            } else {
              unit.currentHp = Math.min(unit.stats.hp, unit.currentHp + effect.amount);
            }
          }
          break;
        }
        case 'free-units': {
          const freeRows = [2, 4, 6, 8, 10, 12];
          let spawned = 0;
          for (const row of freeRows) {
            if (spawned >= effect.count) break;
            const hex = offsetToAxial(3, row);
            if (this._state.isValidHex(hex) && !this._state.getUnitAt(hex)) {
              const u = this._state.addUnit('blue', hex, `Militia ${spawned + 1}`, effect.unitRole);
              u.currentHp = Math.floor(u.stats.hp * 0.7);
              spawned++;
            }
          }
          break;
        }
        case 'ally-units': {
          const allyRows = [3, 7, 11];
          let spawned = 0;
          for (const row of allyRows) {
            if (spawned >= effect.count) break;
            const hex = offsetToAxial(4, row);
            if (this._state.isValidHex(hex) && !this._state.getUnitAt(hex)) {
              const u = this._state.addUnit('blue', hex, `Allied ${spawned + 1}`, 'reserve');
              u.currentHp = Math.floor(u.stats.hp * 0.85);
              spawned++;
            }
          }
          break;
        }
        case 'revive': {
          // Set revive threshold on all blue units — highest threshold wins via max()
          for (const unit of this._state.getFactionUnits('blue')) {
            unit.reviveThreshold = Math.max(unit.reviveThreshold, effect.hpPercent);
            unit.hasRevived = false;
          }
          break;
        }
        // Other effect types do not apply at battle-start
        default:
          break;
      }
    }

    this.renderer.setState(this._state);
    this.input.setState(this._state);

    this.resize(window.innerWidth, window.innerHeight);
    this.input.attach();
    initAbilityBar(this._state);
    initDecretumBar(this._state);
    document.getElementById('btn-coords')?.addEventListener('click', this.boundToggleCoords);
  }

  exit(): void {
    this._isVisible = false;
    resumeMusic();
    this.input.detach();
    destroyAbilityBar();
    destroyDecretumBar();
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
    updateDecretumBar();
  }

  render(): void {
    if (!this._isVisible) return;
    this.renderer.render();
  }

  resize(width: number, height: number): void {
    this.renderer.resize(width, height);
  }
}
