import { signal } from '@preact/signals';
import { BattleState } from './battle-state';
import { BattleRenderer } from './battle-renderer';
import { BattleInput } from './battle-input';
import { tickAI } from './battle-ai';
import { initAbilityBar, updateAbilityBar, destroyAbilityBar, initDecretumBar, updateDecretumBar, destroyDecretumBar } from './ability-ui';
import { threatLevel, globalSeason, completedSpokes } from '../game/core/game-state';
import { currentSpoke, currentNodeIndex } from '../game/progression/spoke';
import { generateEnemyArmy } from '../game/army/enemy-army-generator';
import { COHORT_CATALOG } from '../game/army/cohort-data';
import { ENEMY_COHORTS } from '../game/army/enemy-cohort-data';
import { pauseMusic, resumeMusic } from '../ui/sound/music';
import { applyProgressionEffects, computeIsFinalBattle } from './progression-bridge';
import { CAVALRY_FLANKED_SPAWN, CENTRAL_SPAWN, deployArmy } from './deployment';
import { resetReserveAIState } from './movements';
import type { ArmyData, Cohort } from '../types/index';

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

  /**
   * @deprecated V1 battle entry — 20×14 horizontal grid, legacy spawn rows.
   * The V2 migration lands in `enterFromSpoke()`; this method is retained
   * temporarily so tests and fallback routes still work.
   */
  enter(): void {
    this._isVisible = true;
    pauseMusic();
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
    pauseMusic();
    resetReserveAIState();

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

    // Apply Legate traits (V1 used to do this inside placeFactionUnits)
    if (blueLegate) this._state.applyLegateTraits('blue', blueLegate);

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
    pauseMusic();
    resetReserveAIState();

    this._state = new BattleState({
      cols: 50,
      rows: 30,
      hexSize: 31,
      victoryMode: 'annihilation',
      vertical: true,
    });
    this._state.generateGrid();

    // ── Roman army (Blue) — Polybian manipular formation ──────────────────────
    // Velites screen → Hastati 1st line → Principes 2nd line → Triarii last resort
    // Equites on both cavalry wings.
    const hastati   = COHORT_CATALOG.find(c => c.id === 'hastati')!;
    const velites   = COHORT_CATALOG.find(c => c.id === 'velites')!;
    const principes = COHORT_CATALOG.find(c => c.id === 'principes')!;
    const triarii   = COHORT_CATALOG.find(c => c.id === 'triarii')!;
    const equites   = COHORT_CATALOG.find(c => c.id === 'equites')!;

    const romanCohorts: Cohort[] = [
      ...Array(8).fill(velites),    // ranged skirmish screen
      ...Array(12).fill(hastati),   // 1st heavy line
      ...Array(10).fill(principes), // 2nd heavy line
      ...Array(6).fill(triarii),    // last-resort reserve
      ...Array(4).fill(equites),    // equites — 2 per cavalry wing
    ]; // 40 total

    const blueArmy: ArmyData = {
      id: -1, owner: 'quick-battle', name: 'Legio Romana',
      size: romanCohorts.length, cohorts: romanCohorts, legateId: null,
      provinceIndex: -1, targetProvinceIndex: null, progress: 0, path: [],
      inCombat: false, combatTarget: null, lastRoll: 0,
    };

    // ── Athenian–Macedonian army (Red) ─────────────────────────────────────────
    // Cretan archer screen → Athenian phalanx (two depth ranks) → Hetairoi wings.
    const cretan = COHORT_CATALOG.find(c => c.id === 'cretan_archer')!;

    const hetairoi: Cohort = {
      ...ENEMY_COHORTS.find(c => c.id === 'makedon-hetairoi')!,
      movementProfile: 'flanker',
    };

    const athenianHoplite: Cohort = {
      id: 'athenian-hoplite',
      name: 'Athenian Hoplite',
      role: 'vanguard',
      stats: { atk: 125, def: 72, hp: 1050, agi: 38 },
      aurumCost: 0,
      description: 'Citizen hoplite of Athens. Heavy spear and aspis, close phalanx.',
      spriteId: 'athens_hoplite_uncommon',
      movementProfile: 'vanguard-march',
    };

    const athenianEpilektos: Cohort = {
      id: 'athenian-epilektos',
      name: 'Athenian Epilektos',
      role: 'guard',
      stats: { atk: 145, def: 85, hp: 1200, agi: 30 },
      aurumCost: 0,
      description: 'Select corps of Athens. The heavy rear rank who anchor the phalanx wall.',
      spriteId: 'athens_hoplite_uncommon',
      movementProfile: 'guard-stand',
    };

    const greekCohorts: Cohort[] = [
      ...Array(8).fill(cretan),              // Cretan archer screen
      ...Array(12).fill(athenianHoplite),    // phalanx front rank
      ...Array(12).fill(athenianEpilektos),  // phalanx depth / anchor
      ...Array(8).fill(hetairoi),            // Hetairoi — 4 per cavalry wing
    ]; // 40 total

    const redArmy: ArmyData = {
      id: -1, owner: 'quick-battle', name: 'Polemos Hellenos',
      size: greekCohorts.length, cohorts: greekCohorts, legateId: null,
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
    resumeMusic();
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
