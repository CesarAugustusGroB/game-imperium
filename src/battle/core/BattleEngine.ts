/**
 * BattleEngine — public facade around a BattleWorld and its systems.
 *
 * This is the single entry point the rest of the app uses to interact with
 * a battle. It owns a `BattleWorld` (data) and delegates every operation to
 * a system function (`systems/*`). **No game logic lives here** — the class
 * body is almost entirely one-line delegations.
 *
 * Exception: `applyDecretumEffect`, `applyLegateTraits`, `applyLegateEffect`,
 * `placeStartingUnits`, `placeFactionUnits` still contain bodies that will
 * be migrated to the effect-registry pattern in PR 2. They stay here for now
 * so PR 1's diff stays focused on the extraction.
 *
 * `src/battle/battle-state.ts` re-exports this class as `BattleState` so
 * existing callers don't need to change their imports.
 */

import { BattleWorld } from './BattleWorld';
import type { Particle } from './BattleWorld';
import type { Hex, Point } from '../hex';
import type {
  BattleFaction, BattleConfig, BattleUnit, FloatingText, LieutenantOrder,
  UnitRole, UnitStats,
} from '../battle-types';
import type { DecretumEffect } from '../../game/items/decretum';
import type { ArmyData } from '../../types/index';
import type { Legate, LegateEffect } from '../../game/army/legate';

import * as grid from '../systems/grid-system';
import * as units from '../systems/unit-system';
import * as combat from '../systems/combat-system';
import * as anim from '../systems/animation-system';

import { FLASH_DURATION, SHAKE_DURATION } from '../battle-config';
import { findReinforcementHex } from '../deployment';
import { mapArmyToBattleUnits } from '../legacy/legacy-cohort-mapping';
import { getLegateTraitById } from '../../game/army/legate-traits';

// Re-export Particle so callers that `import { Particle } from './battle-state'` still work.
export type { Particle };

export class BattleEngine {
  /** The pure data model. Keep private to force callers through the facade. */
  private world: BattleWorld;

  constructor(config?: Partial<BattleConfig>) {
    this.world = new BattleWorld(config);
  }

  // ── Read-only accessors (mirror the old BattleState public fields) ──

  get config(): BattleConfig { return this.world.config; }
  get grid(): ReadonlySet<string> { return this.world.grid; }
  get gridHexes(): ReadonlyArray<Hex> { return this.world.gridHexes; }
  get units(): Map<number, BattleUnit> { return this.world.units; }
  get floatingTexts(): FloatingText[] { return this.world.floatingTexts; }
  get particles(): Particle[] { return this.world.particles; }
  get stars(): Map<BattleFaction, Hex> { return this.world.stars; }
  get captureProgress(): Map<BattleFaction, number> { return this.world.captureProgress; }
  get abilityCooldowns(): Set<string> { return this.world.abilityCooldowns; }

  get phase() { return this.world.phase; }
  set phase(v) { this.world.phase = v; }
  get paused() { return this.world.paused; }
  get winner() { return this.world.winner; }
  set winner(v) { this.world.winner = v; }
  get roundCount() { return this.world.roundCount; }
  set roundCount(v) { this.world.roundCount = v; }
  get lieutenantOrder() { return this.world.lieutenantOrder; }
  get veteranBonus() { return this.world.veteranBonus; }
  set veteranBonus(v) { this.world.veteranBonus = v; }
  get preventDeathCount() { return this.world.preventDeathCount; }
  set preventDeathCount(v) { this.world.preventDeathCount = v; }
  get screenShake() { return this.world.screenShake; }
  set screenShake(v) { this.world.screenShake = v; }
  get selectedUnitId() { return this.world.selectedUnitId; }
  set selectedUnitId(v) { this.world.selectedUnitId = v; }
  get targetingAbility() { return this.world.targetingAbility; }
  set targetingAbility(v) { this.world.targetingAbility = v; }
  get onAbilityExecute() { return this.world.onAbilityExecute; }
  set onAbilityExecute(v) { this.world.onAbilityExecute = v; }

  // ── Grid ──

  generateGrid(): void { grid.generateGrid(this.world); }
  isValidHex(hex: Hex): boolean { return grid.isValidHex(this.world, hex); }
  getGridOrigin(w: number, h: number): Point { return grid.getGridOrigin(this.world, w, h); }
  getMovementRange(hex: Hex): Hex[] { return grid.getMovementRange(this.world, hex); }
  getReachableHexes(from: Hex, max: number): Hex[] { return grid.getReachableHexes(this.world, from, max); }
  findPath(from: Hex, to: Hex): Hex[] | null { return grid.findPath(this.world, from, to); }
  findStepToward(from: Hex, to: Hex): Hex | null { return grid.findStepToward(this.world, from, to); }

  // ── Units ──

  addUnit(faction: BattleFaction, hex: Hex, name: string, role: UnitRole = 'vanguard', stats?: UnitStats): BattleUnit {
    return units.addUnit(this.world, faction, hex, name, role, stats);
  }
  getUnitAt(hex: Hex): BattleUnit | null { return units.getUnitAt(this.world, hex); }
  moveUnit(unitId: number, target: Hex): boolean { return units.moveUnit(this.world, unitId, target); }
  moveUnitAlongPath(unitId: number, target: Hex): boolean { return units.moveUnitAlongPath(this.world, unitId, target); }
  isUnitMoving(unit: BattleUnit): boolean { return units.isUnitMoving(unit); }
  canAct(unit: BattleUnit): boolean { return units.canAct(unit); }
  resetCooldown(unit: BattleUnit): void { units.resetCooldown(unit); }
  getAdjacentEnemies(unit: BattleUnit): BattleUnit[] { return units.getAdjacentEnemies(this.world, unit); }
  getBattleFactionUnits(faction: BattleFaction): BattleUnit[] { return units.getBattleFactionUnits(this.world, faction); }
  getBattleFactionStrength(faction: BattleFaction): number { return units.getBattleFactionStrength(this.world, faction); }
  findNearestEnemy(unit: BattleUnit): BattleUnit | null { return units.findNearestEnemy(this.world, unit); }
  selectUnit(unitId: number | null): void { units.selectUnit(this.world, unitId); }
  getSelectedUnit(): BattleUnit | null { return units.getSelectedUnit(this.world); }
  setLieutenantOrder(order: LieutenantOrder): void { units.setLieutenantOrder(this.world, order); }
  setTargeting(abilityId: string | null): void { units.setTargeting(this.world, abilityId); }
  markAbilityUsed(abilityId: string): void { units.markAbilityUsed(this.world, abilityId); }
  isAbilityOnCooldown(abilityId: string): boolean { return units.isAbilityOnCooldown(this.world, abilityId); }
  togglePause(): void { units.togglePause(this.world); }
  spawnParticles(hex: { q: number; r: number }, count: number, color: string, spread: number, speed: number, lifetime: number): void {
    units.spawnParticles(this.world, hex, count, color, spread, speed, lifetime);
  }

  // ── Combat ──

  resolveCombat(attacker: BattleUnit, defender: BattleUnit): void {
    combat.resolveCombat(this.world, attacker, defender);
  }
  applyDeathCheck(unit: BattleUnit): void { combat.applyDeathCheck(this.world, unit); }
  checkVictory(): void { combat.checkVictory(this.world); }
  updateCapture(dt: number): void { combat.updateCapture(this.world, dt); }
  getEnemyStar(faction: BattleFaction): Hex | null { return combat.getEnemyStar(this.world, faction); }
  placeStarsAndStrength(): void { combat.placeStarsAndStrength(this.world); }

  // ── Animation ──

  updateAnimations(dt: number): void { anim.updateAnimations(this.world, dt); }

  // ── Decretum effects (PR 2 will move these to an effect registry) ──

  applyDecretumEffect(effect: DecretumEffect, targetHex?: Hex): void {
    switch (effect.type) {
      case 'heal': {
        if (effect.target === 'all') {
          for (const unit of this.getBattleFactionUnits('blue')) {
            unit.currentHp = Math.min(unit.stats.hp, unit.currentHp + Math.floor(unit.stats.hp * effect.amount));
            unit.flashTimer = FLASH_DURATION;
          }
        } else if (targetHex) {
          const unit = this.getUnitAt(targetHex);
          if (unit && unit.faction === 'blue') {
            unit.currentHp = Math.min(unit.stats.hp, unit.currentHp + Math.floor(unit.stats.hp * effect.amount));
            unit.flashTimer = FLASH_DURATION;
          }
        }
        return;
      }
      case 'damage': {
        if (effect.target === 'area') {
          for (const unit of this.world.units.values()) {
            if (unit.isDying) continue;
            unit.currentHp -= effect.amount;
            unit.shakeTimer = SHAKE_DURATION;
            unit.flashTimer = FLASH_DURATION;
            this.applyDeathCheck(unit);
          }
        } else if (targetHex) {
          const unit = this.getUnitAt(targetHex);
          if (unit && unit.faction === 'red') {
            unit.currentHp -= effect.amount;
            unit.shakeTimer = SHAKE_DURATION;
            unit.flashTimer = FLASH_DURATION;
            this.applyDeathCheck(unit);
          }
        }
        return;
      }
      case 'buff': {
        const blueUnits = this.getBattleFactionUnits('blue');
        for (const unit of blueUnits) {
          if (effect.stat === 'atk') unit.stats.atk = Math.floor(unit.stats.atk * (1 + effect.multiplier));
          else if (effect.stat === 'def') unit.stats.def = Math.floor(unit.stats.def * (1 + effect.multiplier));
          else if (effect.stat === 'hp') unit.stats.hp = Math.floor(unit.stats.hp * (1 + effect.multiplier));
          else if (effect.stat === 'agi') unit.stats.agi = Math.floor(unit.stats.agi * (1 + effect.multiplier));
        }
        if (blueUnits.length > 0) {
          const anchor = blueUnits[0].hex;
          this.world.floatingTexts.push({
            text: 'BUFFED!',
            hex: { q: anchor.q, r: anchor.r },
            color: '#ffd700', timer: 0.8, duration: 0.8,
          });
        }
        return;
      }
      case 'spawn': {
        for (let i = 0; i < effect.count; i++) {
          const hex = findReinforcementHex(this, 'blue');
          if (!hex) break;
          const unit = this.addUnit('blue', hex, `Militia ${i + 1}`, effect.unitRole);
          unit.currentHp = Math.floor(unit.stats.hp * 0.6);
        }
        return;
      }
      case 'prevent-death':
        this.world.preventDeathCount += effect.count;
        return;
      case 'resource-gain':
      case 'reveal':
      case 'event-modifier':
      case 'upkeep-reduction':
      case 'debuff':
      case 'convert-enemy-next-battle':
      case 'investment-discount':
        return; // handled elsewhere
    }
  }

  // ── Setup ──

  /**
   * Populate the grid with starting units for both factions and apply any
   * Legate trait passes. V1 entry path — V2 uses `deployArmy` directly.
   */
  placeStartingUnits(
    blueArmy?: ArmyData,
    redArmy?: ArmyData,
    blueLegate?: Legate | null,
    redLegate?: Legate | null,
  ): void {
    this.placeFactionUnits('blue', blueArmy, blueLegate);
    this.placeFactionUnits('red', redArmy, redLegate);
    this.placeStarsAndStrength();
  }

  private placeFactionUnits(
    faction: BattleFaction,
    army: ArmyData | undefined,
    legate: Legate | null | undefined,
  ): void {
    if (army && army.cohorts.length > 0) {
      const specs = mapArmyToBattleUnits(army, faction);
      for (const spec of specs) {
        this.addUnit(spec.faction, spec.hex, spec.name, spec.role, spec.stats);
      }
    }
    if (legate) this.applyLegateTraits(faction, legate);
  }

  /** Apply every trait on a Legate to the faction's freshly-spawned units. */
  applyLegateTraits(faction: BattleFaction, legate: Legate): void {
    for (const traitId of legate.traitIds) {
      const trait = getLegateTraitById(traitId);
      if (!trait) continue;
      this.applyLegateEffect(faction, trait.effect);
    }
  }

  private applyLegateEffect(faction: BattleFaction, effect: LegateEffect): void {
    switch (effect.type) {
      case 'stat-bonus': {
        const list = this.getBattleFactionUnits(faction);
        for (const unit of list) {
          if (effect.target !== 'all' && unit.role !== effect.target) continue;
          const old = unit.stats[effect.stat];
          const next = Math.max(1, Math.floor(old * (1 + effect.multiplier)));
          unit.stats[effect.stat] = next;
          if (effect.stat === 'hp') unit.currentHp = next;
        }
        return;
      }
      case 'lieutenant-preset':
        if (faction === 'blue') this.setLieutenantOrder(effect.order);
        return;
      case 'random-rally': {
        const list = this.getBattleFactionUnits(faction);
        if (list.length === 0) return;
        const pick = list[Math.floor(Math.random() * list.length)];
        pick.stats.atk = Math.max(1, Math.floor(pick.stats.atk * (1 + effect.multiplier)));
        pick.stats.def = Math.max(0, Math.floor(pick.stats.def * (1 + effect.multiplier)));
        pick.stats.hp  = Math.max(1, Math.floor(pick.stats.hp  * (1 + effect.multiplier)));
        pick.stats.agi = Math.max(1, Math.floor(pick.stats.agi * (1 + effect.multiplier)));
        pick.currentHp = pick.stats.hp;
        return;
      }
    }
  }
}
