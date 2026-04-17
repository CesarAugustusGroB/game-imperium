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
import { spriteReloadTrigger } from './battle-settings';
import { applyProgressionEffects, computeIsFinalBattle } from './progression-bridge';
import { CENTRAL_SPAWN, FLANK_LEFT, FLANK_RIGHT, deployArmy } from './deployment';
import type { ArmyData, Cohort } from '../types/index';

/** S7-11: True when the current battle is the final invasion (season >= MAX_SEASONS). */
export const isFinalBattle = signal(false);

/** S15-05: Snapshot of the generated enemy army for PostBattleScreen display. */
export const lastEnemyArmy = signal<ArmyData | null>(null);

/**
 * Build a minimal in-memory `ArmyData` by cycling a cohort template list to
 * the target size. Used by `enterQuickBattle` so its rosters flow through the
 * same `deployArmy` pipeline as real spoke armies.
 */
function syntheticArmy(name: string, cycle: readonly Cohort[], size: number): ArmyData {
  const cohorts: Cohort[] = [];
  for (let i = 0; i < size; i++) cohorts.push(cycle[i % cycle.length]);
  return {
    id: -1, owner: 'quick-battle', name, size: cohorts.length,
    cohorts, legateId: null,
    provinceIndex: -1, targetProvinceIndex: null, progress: 0, path: [],
    inCombat: false, combatTarget: null, lastRoll: 0,
  };
}

export class BattleMode {
  private canvas: HTMLCanvasElement;
  private _state: BattleState;
  private renderer: BattleRenderer;
  private input: BattleInput;
  private onExitCallback: () => void;
  private _isVisible = false;
  private boundToggleCoords: () => void;
  private lastSpriteReload = 0;

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
   * Quick-battle entry for BattleScreenV2 — Spartans vs Persians in a
   * vertical 50×30 battlefield. No spoke / commander state required.
   *
   * Uses the same `deployArmy` pipeline as `enterFromSpoke` — proving the
   * deployment system is fully data-driven.
   */
  enterQuickBattle(): void {
    this._isVisible = true;
    pauseMusic();

    this._state = new BattleState({
      cols: 50,
      rows: 30,
      hexSize: 31,
      victoryMode: 'annihilation',
      vertical: true,
    });
    this._state.generateGrid();

    // ── Cohort stat templates ──
    const hastati   = COHORT_CATALOG.find(c => c.id === 'hastati')!;
    const principes = COHORT_CATALOG.find(c => c.id === 'principes')!;
    const triarii   = COHORT_CATALOG.find(c => c.id === 'triarii')!;
    const equites   = COHORT_CATALOG.find(c => c.id === 'equites')!;
    const velites   = COHORT_CATALOG.find(c => c.id === 'velites')!;

    const warrior      = ENEMY_COHORTS.find(c => c.id === 'barbarian-warrior')!;
    const champion     = ENEMY_COHORTS.find(c => c.id === 'barbarian-champion')!;
    const raider       = ENEMY_COHORTS.find(c => c.id === 'barbarian-raider')!;
    const shieldbearer = ENEMY_COHORTS.find(c => c.id === 'barbarian-shieldbearer')!;

    // Spartan & Persian rosters — same visual themes, stats doubled for a longer prototype fight.
    const spartanCycle: Cohort[] = [
      { ...hastati,   name: 'Hoplite',    stats: { ...hastati.stats,   hp: hastati.stats.hp   * 2 } },
      { ...principes, name: 'Spartiate',  stats: { ...principes.stats, hp: principes.stats.hp * 2 } },
      { ...velites,   name: 'Psiloi',     stats: { ...velites.stats,   hp: velites.stats.hp   * 2 } },
      { ...triarii,   name: 'Perioikoi',  stats: { ...triarii.stats,   hp: triarii.stats.hp   * 2 } },
      { ...equites,   name: 'Hippeis',    stats: { ...equites.stats,   hp: equites.stats.hp   * 2 } },
    ];
    const persianCycle: Cohort[] = [
      { ...warrior,      name: 'Sparabara',  stats: { ...warrior.stats,      hp: warrior.stats.hp      * 2 } },
      { ...champion,     name: 'Immortal',   stats: { ...champion.stats,     hp: champion.stats.hp     * 2 } },
      { ...raider,       name: 'Takabara',   stats: { ...raider.stats,       hp: raider.stats.hp       * 2 } },
      { ...shieldbearer, name: 'Gerrophora', stats: { ...shieldbearer.stats, hp: shieldbearer.stats.hp * 2 } },
    ];

    // Build armies by cycling the rosters to the target sizes.
    const spartanMain = syntheticArmy('spartan-main', spartanCycle, 50);
    const spartanFlank = syntheticArmy('spartan-flank', spartanCycle, 10);
    const persianMain = syntheticArmy('persian-main', persianCycle, 50);
    const persianFlank = syntheticArmy('persian-flank', persianCycle, 20);

    // Deploy — same pipeline the spoke entry uses.
    deployArmy(this._state, 'blue', spartanMain, CENTRAL_SPAWN);
    deployArmy(this._state, 'blue', spartanFlank, FLANK_RIGHT);
    deployArmy(this._state, 'red', persianMain, CENTRAL_SPAWN);
    deployArmy(this._state, 'red', persianFlank, FLANK_LEFT);

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
    // Reload sprites when settings change
    if (spriteReloadTrigger.value !== this.lastSpriteReload) {
      this.lastSpriteReload = spriteReloadTrigger.value;
      this.renderer.reloadSprites();
    }
    this.renderer.render();
  }

  resize(width: number, height: number): void {
    this.renderer.resize(width, height);
  }
}
