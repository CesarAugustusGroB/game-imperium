import { signal } from '@preact/signals';
import { BattleState } from './battle-state';
import { BattleRenderer } from './battle-renderer';
import { BattleInput } from './battle-input';
import { tickAI } from './battle-ai';
import { initAbilityBar, updateAbilityBar, destroyAbilityBar, initDecretumBar, updateDecretumBar, destroyDecretumBar } from './ability-ui';
import { selectedCommander, veteranStacks, allianceCount, threatLevel, globalSeason, MAX_SEASONS, battlesWon, completedSpokes } from '../game/core/game-state';
import { currentSpoke, currentNodeIndex } from '../game/progression/spoke';
import { generateEnemyArmy } from '../game/army/enemy-army-generator';
import { VETERAN_BONUS_PER_STACK, VETERAN_SOFT_CAP_STACKS, VETERAN_BONUS_ABOVE_CAP, ALLY_SPAWN_HP_RATIO, MILITIA_SPAWN_HP_RATIO, WAR_CRY_DAMAGE_BONUS } from './battle-config';
import { offsetToAxial } from './hex';
import { getActiveEffects } from '../game/items/doctrine-store';
import type { DoctrineEffect } from '../game/items/doctrine';
import { getProvinceEffects, provinces } from '../game/province/province-store';
import { consumeCrusadeBattle, warCryActive, pendingEnemyConversions } from '../game/progression/strategic-store';
import { pauseMusic, resumeMusic } from '../ui/sound/music';

import type { ArmyData } from '../types/index';

/** S7-11: True when the current battle is the final invasion (season >= MAX_SEASONS). */
export const isFinalBattle = signal(false);

/** S15-05: Snapshot of the generated enemy army for PostBattleScreen display. */
export const lastEnemyArmy = signal<ArmyData | null>(null);

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

    // S14-06 / S15-04: pull the player army + Legate from the spoke; generate
    // an enemy army scaled by threat. Blue with no cohorts spawns nothing
    // (embark gate in S15-01 prevents this). Red always gets a generated army.
    const spoke = currentSpoke.value;
    const blueArmy = spoke?.boundArmy ?? undefined;
    const blueLegate = spoke?.boundLegate ?? undefined;

    const nodeType = spoke?.nodes[currentNodeIndex.value]?.type ?? 'battle';
    const isBoss = nodeType === 'boss';
    isFinalBattle.value = globalSeason.value >= MAX_SEASONS;

    const redArmy = generateEnemyArmy(
      threatLevel.value, completedSpokes.value, isBoss, isFinalBattle.value,
    );
    lastEnemyArmy.value = redArmy;
    this._state.placeStartingUnits(blueArmy, redArmy, blueLegate, null);

    // S15-04: stat scaling only — composition is handled by the generator
    this.applyThreatScaling();

    if (selectedCommander.value?.id === 'boudicca') {
      const stacks = veteranStacks.value;
      const capped = Math.min(stacks, VETERAN_SOFT_CAP_STACKS);
      const excess = Math.max(0, stacks - VETERAN_SOFT_CAP_STACKS);
      this._state.veteranBonus = capped * VETERAN_BONUS_PER_STACK + excess * VETERAN_BONUS_ABOVE_CAP;
    }

    // S3-10: Augustus — spawn extra allied units based on allianceCount
    if (selectedCommander.value?.id === 'augustus') {
      const extraUnits = Math.min(allianceCount.value, 4);
      for (let i = 0; i < extraUnits; i++) {
        // Spawn in blue reserve area (col 4, varied rows)
        const row = 3 + i * 4; // rows 3, 7
        const hex = offsetToAxial(4, row);
        if (this._state.isValidHex(hex) && !this._state.getUnitAt(hex)) {
          const unit = this._state.addUnit('blue', hex, `Allied ${i + 1}`, 'reserve');
          unit.currentHp = Math.floor(unit.stats.hp * ALLY_SPAWN_HP_RATIO);
        }
      }
    }

    // Apply Doctrine + Province passive effects at battle start
    const doctrineEffects: DoctrineEffect[] = [...getActiveEffects(), ...getProvinceEffects()];
    for (const effect of doctrineEffects) {
      switch (effect.type) {
        case 'stat-modifier': {
          for (const unit of this._state.getBattleFactionUnits('blue')) {
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
          for (const unit of this._state.getBattleFactionUnits('blue')) {
            if (effect.amount === 'full') {
              unit.currentHp = unit.stats.hp;
            } else if (typeof effect.amount === 'object') {
              unit.currentHp = Math.min(unit.stats.hp, Math.floor(unit.stats.hp * effect.amount.percent));
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
              u.currentHp = Math.floor(u.stats.hp * MILITIA_SPAWN_HP_RATIO);
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
              u.currentHp = Math.floor(u.stats.hp * ALLY_SPAWN_HP_RATIO);
              spawned++;
            }
          }
          break;
        }
        case 'revive': {
          // Set revive threshold on all blue units — highest threshold wins via max()
          for (const unit of this._state.getBattleFactionUnits('blue')) {
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

    // S7-12: Call Crusade — +30% damage for N battles
    const crusadeBonus = consumeCrusadeBattle();
    if (crusadeBonus > 0) {
      for (const unit of this._state.getBattleFactionUnits('blue')) {
        unit.stats.atk = Math.floor(unit.stats.atk * (1 + crusadeBonus));
      }
    }

    // S7-13: Boudicca's War Cry — +25% ATK to all blue units (first-strike advantage)
    if (warCryActive.value) {
      warCryActive.value = false;
      for (const unit of this._state.getBattleFactionUnits('blue')) {
        unit.stats.atk = Math.floor(unit.stats.atk * (1 + WAR_CRY_DAMAGE_BONUS));
      }
    }

    // S9-03: Mandatum Legati — convert weakest red unit(s) to blue at 50% HP
    const conversions = pendingEnemyConversions.value;
    if (conversions > 0) {
      pendingEnemyConversions.value = 0;
      const redUnits = this._state.getBattleFactionUnits('red').filter(u => !u.isDying);
      for (let i = 0; i < Math.min(conversions, redUnits.length); i++) {
        const weakest = redUnits.reduce((a, b) => a.stats.hp <= b.stats.hp ? a : b);
        Object.assign(weakest, { faction: 'blue' as const });
        weakest.currentHp = Math.floor(weakest.stats.hp * 0.5);
        redUnits.splice(redUnits.indexOf(weakest), 1);
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

  /**
   * S15-04: Post-spawn stat scaling only. Enemy army composition is now
   * handled by `generateEnemyArmy()` — this method only applies:
   *   1. +5%/threatLevel HP+ATK to all red units
   *   2. Final-invasion boss multiplier (provinces/allies/battlesWon formula)
   */
  private applyThreatScaling(): void {
    const threat = threatLevel.value;

    // Scale enemy stats: +5% per threat level
    const statMultiplier = 1 + (threat * 0.05);
    if (statMultiplier > 1) {
      for (const unit of this._state.getBattleFactionUnits('red')) {
        unit.stats = { ...unit.stats };
        unit.stats.hp = Math.floor(unit.stats.hp * statMultiplier);
        unit.stats.atk = Math.floor(unit.stats.atk * statMultiplier);
        unit.currentHp = unit.stats.hp;
      }
    }

    // Final invasion boss multiplier (provinces/allies/battlesWon scaling)
    if (isFinalBattle.value) {
      const provinceCount = provinces.value.length;
      const allies = allianceCount.value;
      const bossMultiplier = Math.max(1.3, Math.min(2.5,
        1.5
        + (provinceCount * 0.05)
        - (allies * 0.05)
        - (battlesWon.value * 0.03)
        + (Math.max(0, threat - 15) * 0.02),
      ));
      for (const unit of this._state.getBattleFactionUnits('red')) {
        unit.stats.hp = Math.floor(unit.stats.hp * bossMultiplier);
        unit.stats.atk = Math.floor(unit.stats.atk * bossMultiplier);
        unit.currentHp = unit.stats.hp;
      }
    }
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
