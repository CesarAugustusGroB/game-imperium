import { signal } from '@preact/signals';
import { BattleState } from './battle-state';
import { BattleRenderer } from './battle-renderer';
import { BattleInput } from './battle-input';
import { tickAI } from './battle-ai';
import { initAbilityBar, updateAbilityBar, destroyAbilityBar, initDecretumBar, updateDecretumBar, destroyDecretumBar } from './ability-ui';
import { threatLevel, globalSeason, completedSpokes } from '../game/core/game-state';
import { currentSpoke, currentNodeIndex, deriveBattleContextFromCurrentSpoke } from '../game/progression/spoke';
import { currentBattleContext } from './battle-signals';
import { generateEnemyArmy } from '../game/army/enemy-army-generator';
import { getQuickBattleScenario, selectedQuickBattleScenarioId } from './quick-battle-scenarios';
import { applyProgressionEffects, computeIsFinalBattle } from './progression-bridge';
import { CAVALRY_FLANKED_SPAWN, CENTRAL_SPAWN, deployArmy } from './deployment';
import { resetReserveAIState } from './movements';
import type { ArmyData } from '../types/index';
import {
  computeArmyMorale, getTierMultipliers, NEUTRAL_MORALE,
} from '../game/army/morale';
import type { TierMultipliers } from '../game/army/morale';
import type { BattleFaction } from './battle-types';

/** S7-11: True when the current battle is the final invasion (season >= MAX_SEASONS). */
export const isFinalBattle = signal(false);

/** S15-05: Snapshot of the generated enemy army for PostBattleScreen display. */
export const lastEnemyArmy = signal<ArmyData | null>(null);

/**
 * S24-03: Stash the army's pre-battle morale multipliers onto every spawned
 * unit of the given faction. Called once per faction after deployment —
 * values are frozen for the whole battle (FR-5).
 */
function applyMoraleMultipliers(
  state: BattleState,
  faction: BattleFaction,
  multipliers: TierMultipliers,
): void {
  for (const unit of state.getBattleFactionUnits(faction)) {
    unit.moraleDamageMult = multipliers.damage;
    unit.moraleDefenseMult = multipliers.defense;
  }
}


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

  /**
   * @deprecated V1 battle entry — 20×14 horizontal grid, legacy spawn rows.
   * The V2 migration lands in `enterFromSpoke()`; this method is retained
   * temporarily so tests and fallback routes still work.
   */
  enter(): void {
    this._isVisible = true;
    resetReserveAIState();

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
    computeIsFinalBattle();

    const redArmy = generateEnemyArmy(
      threatLevel.value, completedSpokes.value, globalSeason.value,
      isBoss, isFinalBattle.value,
    );
    lastEnemyArmy.value = redArmy;
    this._state.placeStartingUnits(blueArmy, redArmy, blueLegate, null);

    // L1: snapshot blue deployment count right after placement.
    this._state.recordInitialDeployment();

    // S24-03: snapshot blue army morale from the spoke and stash multipliers
    // onto every blue unit. Red stays at neutral (no enemy-side contributors
    // in the MVP). No-op spoke → neutral too.
    const blueMorale = spoke ? computeArmyMorale(spoke) : NEUTRAL_MORALE;
    applyMoraleMultipliers(this._state, 'blue', getTierMultipliers(blueMorale.tier));
    applyMoraleMultipliers(this._state, 'red',  getTierMultipliers(NEUTRAL_MORALE.tier));

    // Progression integration — all threat scaling, commander perks,
    // doctrines, crusade, war cry, mandatum conversions live here.
    applyProgressionEffects(this._state);

    this.renderer.setState(this._state);
    this.input.setState(this._state);

    this.resize(window.innerWidth, window.innerHeight);
    this.input.attach();
    initAbilityBar(this._state);
    initDecretumBar(this._state);
    document.getElementById('btn-coords')?.addEventListener('click', this.boundToggleCoords);
  }

  /**
   * BattleV2 entry path — fights on the 50×30 vertical battlefield with the
   * spoke's bound army + generated enemy, central-spawn deployment, and
   * all progression integrations from `applyProgressionEffects`.
   *
   * This is the production replacement for `enter()`.
   */
  enterFromSpoke(): void {
    this._isVisible = true;
    resetReserveAIState();

    // S27-10: derive campaign context once on entry. UI reads it via
    // BattleContextBanner to surface terrain/modifier flavor.
    currentBattleContext.value = deriveBattleContextFromCurrentSpoke();

    // V2 grid: 50×30 vertical, annihilation mode
    this._state = new BattleState({
      cols: 50,
      rows: 30,
      hexSize: 31,
      victoryMode: 'annihilation',
      vertical: true,
    });
    this._state.generateGrid();

    // Pull spoke inputs (same source as the legacy `enter()`)
    const spoke = currentSpoke.value;
    const blueArmy = spoke?.boundArmy ?? undefined;
    const blueLegate = spoke?.boundLegate ?? null;

    const nodeType = spoke?.nodes[currentNodeIndex.value]?.type ?? 'battle';
    const isBoss = nodeType === 'boss';
    computeIsFinalBattle();

    const redArmy = generateEnemyArmy(
      threatLevel.value, completedSpokes.value, globalSeason.value,
      isBoss, isFinalBattle.value,
    );
    lastEnemyArmy.value = redArmy;

    // V2 deployment (central spawn) — replaces V1 placeStartingUnits
    deployArmy(this._state, 'blue', blueArmy, CENTRAL_SPAWN);
    deployArmy(this._state, 'red', redArmy, CENTRAL_SPAWN);
    this._state.placeStarsAndStrength();

    // L1: snapshot blue deployment count AFTER all blue units are placed so
    // main.tsx can use it as the unitLossRatio denominator instead of the
    // (smaller) end-of-battle count that excludes fully-despawned units.
    this._state.recordInitialDeployment();

    // Apply Legate traits (V1 used to do this inside placeFactionUnits)
    if (blueLegate) this._state.applyLegateTraits('blue', blueLegate);

    // S24-03: snapshot blue army morale from the spoke and stash multipliers
    // onto every blue unit. Red stays at neutral (no enemy-side contributors
    // in the MVP). No-op spoke → neutral too.
    const blueMoraleV2 = spoke ? computeArmyMorale(spoke) : NEUTRAL_MORALE;
    applyMoraleMultipliers(this._state, 'blue', getTierMultipliers(blueMoraleV2.tier));
    applyMoraleMultipliers(this._state, 'red',  getTierMultipliers(NEUTRAL_MORALE.tier));

    // All progression effects — threat scaling, doctrines, crusade, etc.
    applyProgressionEffects(this._state);

    this.renderer.setState(this._state);
    this.input.setState(this._state);
    this.resize(window.innerWidth, window.innerHeight);
    this.input.attach();
    initAbilityBar(this._state);
    initDecretumBar(this._state);
    document.getElementById('btn-coords')?.addEventListener('click', this.boundToggleCoords);
  }

  /**
   * Quick-battle entry for BattleScreenV2 — movement-profile demo on a
   * vertical 50×30 battlefield. No spoke / commander state required.
   *
   * Blue: 10 Velites (ranged-skirmisher) throwing javelins at range.
   * Red: 10 Makedon Hetairoi — Alexander's royal heavy cavalry, charging in.
   */
  enterQuickBattle(): void {
    this._isVisible = true;
    resetReserveAIState();
    // S27-10: quick battles stay neutral — no campaign context.
    currentBattleContext.value = null;

    this._state = new BattleState({
      cols: 50,
      rows: 30,
      hexSize: 31,
      victoryMode: 'annihilation',
      vertical: true,
    });
    this._state.generateGrid();

    const scenario = getQuickBattleScenario(selectedQuickBattleScenarioId.value);
    const blueCohorts = scenario.buildBlueCohorts();
    const redCohorts = scenario.buildRedCohorts();

    const blueArmy: ArmyData = {
      id: -1, owner: 'quick-battle', name: scenario.blueName,
      size: blueCohorts.length, cohorts: blueCohorts, legateId: null,
      supplies: 0,
      provinceIndex: -1, targetProvinceIndex: null, progress: 0, path: [],
      inCombat: false, combatTarget: null, lastRoll: 0,
    };

    const redArmy: ArmyData = {
      id: -1, owner: 'quick-battle', name: scenario.redName,
      size: redCohorts.length, cohorts: redCohorts, legateId: null,
      supplies: 0,
      provinceIndex: -1, targetProvinceIndex: null, progress: 0, path: [],
      inCombat: false, combatTarget: null, lastRoll: 0,
    };

    deployArmy(this._state, 'blue', blueArmy, CAVALRY_FLANKED_SPAWN);
    deployArmy(this._state, 'red',  redArmy,  CAVALRY_FLANKED_SPAWN);

    this._state.placeStarsAndStrength();

    isFinalBattle.value = false;
    lastEnemyArmy.value = null;

    this.renderer.suppressVictoryOverlay = true;
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
    this.renderer.suppressVictoryOverlay = false;
    this.input.detach();
    destroyAbilityBar();
    destroyDecretumBar();
    document.getElementById('btn-coords')?.removeEventListener('click', this.boundToggleCoords);
    this.onExitCallback();
  }

  update(dt: number): void {
    if (!this._isVisible) return;

    // Update camera pan from WASD keys
    this.input.updateCamera(dt);

    // When paused, only allow camera pan — skip simulation
    if (this._state.paused) return;

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
    // Sprite-reload polling lives inside BattleRenderer now (it owns the SpriteManager).
    this.renderer.render();
  }

  resize(width: number, height: number): void {
    this.renderer.resize(width, height);
  }
}
