import type { Hex, Point } from './hex';
import { hexKey, hexNeighbors, hexDistance, offsetToAxial } from './hex';
import type { Faction, BattlePhase, UnitRole, UnitStats, VictoryMode, BattleUnit, BattleConfig, FloatingText, LieutenantOrder } from './battle-types';
import {
  DEFAULT_CONFIG, CAPTURE_DURATION, MOVE_RANGE, MOVE_ANIM_SPEED,
  MORALE_BREAK_THRESHOLD, SHAKE_DURATION, FLASH_DURATION,
  LUNGE_DURATION, DEATH_DURATION, ACTION_COOLDOWN, ACTION_JITTER,
  DODGE_AGI_FACTOR, DODGE_MAX, DOUBLE_STRIKE_RATIO, ROLE_STATS,
  BLUE_VANGUARD_ROWS, BLUE_VANGUARD_COL, BLUE_RESERVE_ROWS, BLUE_RESERVE_COL,
  BLUE_GUARD_ROWS, BLUE_GUARD_COL,
  RED_VANGUARD_ROWS, RED_VANGUARD_COL, RED_RESERVE_ROWS, RED_RESERVE_COL,
  RED_GUARD_ROWS, RED_GUARD_COL,
} from './battle-config';
import type { DecretumEffect } from '../game/decretum';

// Re-export types for backward compatibility
export type { Faction, BattlePhase, UnitRole, UnitStats, VictoryMode, BattleUnit, BattleConfig, FloatingText, LieutenantOrder };

const FLOAT_TEXT_DURATION = 0.8; // seconds for floating text to live

function rollD6(): number {
  return Math.floor(Math.random() * 6) + 1;
}

export class BattleState {
  readonly config: BattleConfig;
  readonly grid = new Set<string>();
  readonly gridHexes: Hex[] = [];
  readonly units = new Map<number, BattleUnit>();
  selectedUnitId: number | null = null;
  private nextId = 1;

  // Combat state
  phase: BattlePhase = 'fighting';
  winner: Faction | null = null;
  roundCount = 0;
  lieutenantOrder: LieutenantOrder = 'auto';
  /** Additive damage multiplier from Boudicca's veteran stacks. Each stack adds 0.05 (VETERAN_BONUS_PER_STACK), so e.g. 3 stacks = 0.15 = +15% damage for all blue units. */
  veteranBonus: number = 0;
  private startingStrength = new Map<Faction, number>();

  // Ability targeting state (S3-03)
  targetingAbility: string | null = null;
  abilityCooldowns = new Set<string>(); // ability IDs used (for once-per-battle)
  onAbilityExecute: ((abilityId: string, targetHex: Hex) => void) | null = null;

  // Floating combat text (dodge, crit, etc.)
  readonly floatingTexts: FloatingText[] = [];

  // Capture-the-star state
  readonly stars = new Map<Faction, Hex>();          // each faction's star hex
  readonly captureProgress = new Map<Faction, number>(); // seconds enemy has stood on star

  constructor(config?: Partial<BattleConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ── Grid ──

  generateGrid(): void {
    this.grid.clear();
    this.gridHexes.length = 0;
    for (let col = 0; col < this.config.cols; col++) {
      for (let row = 0; row < this.config.rows; row++) {
        // Skip col 0 even rows (jagged left edge)
        if (col === 0 && row % 2 === 0) continue;
        const hex = offsetToAxial(col, row);
        const key = hexKey(hex.q, hex.r);
        if (!this.grid.has(key)) {
          this.grid.add(key);
          this.gridHexes.push(hex);
        }
      }
    }
  }

  isValidHex(hex: Hex): boolean {
    return this.grid.has(hexKey(hex.q, hex.r));
  }

  getGridOrigin(canvasW: number, canvasH: number): Point {
    const sqrt3 = Math.sqrt(3);
    const s = this.config.hexSize;
    // Pointy-top: width uses sqrt3, height uses 3/2
    const totalW = this.config.cols * s * sqrt3 + s * sqrt3 * 0.5;
    const totalH = (this.config.rows - 1) * s * 1.5 + s * 2;
    return {
      x: (canvasW - totalW) / 2 + s * sqrt3 / 2,
      y: (canvasH - totalH) / 2 + s,
    };
  }

  // ── Units ──

  addUnit(faction: Faction, hex: Hex, name: string, role: UnitRole = 'vanguard', stats?: UnitStats): BattleUnit {
    const id = this.nextId++;
    const unitStats = stats ?? ROLE_STATS[role];
    const unit: BattleUnit = {
      id, faction, role, hex, stats: unitStats, currentHp: unitStats.hp, name,
      prevHex: null, moveProgress: 1, path: [],
      shakeTimer: 0, flashTimer: 0,
      lungeTarget: null, lungeTimer: 0,
      isDying: false, deathProgress: 0,
      pinnedBy: null,
      actionCooldown: 0.1, // near-zero so all units move together from the start
      crackSeed: id * 7919, // prime for deterministic crack angles
    };
    this.units.set(unit.id, unit);
    return unit;
  }

  getUnitAt(hex: Hex): BattleUnit | null {
    for (const unit of this.units.values()) {
      if (unit.isDying) continue;
      if (unit.hex.q === hex.q && unit.hex.r === hex.r) return unit;
    }
    return null;
  }

  /** Direct single-hex move (used internally to advance one hop). */
  moveUnit(unitId: number, target: Hex): boolean {
    const unit = this.units.get(unitId);
    if (!unit) return false;
    if (!this.isValidHex(target)) return false;
    if (this.getUnitAt(target)) return false;
    unit.prevHex = { q: unit.hex.q, r: unit.hex.r };
    unit.hex = { q: target.q, r: target.r };
    unit.moveProgress = 0;
    return true;
  }

  /** Queue a multi-hex move toward target (like strategic army pathfinding). */
  moveUnitAlongPath(unitId: number, target: Hex): boolean {
    const unit = this.units.get(unitId);
    if (!unit) return false;
    if (unit.moveProgress < 1) return false; // still animating
    if (this.getUnitAt(target)) return false;

    const fullPath = this.findPath(unit.hex, target);
    if (!fullPath || fullPath.length < 2) return false;

    // Clamp to MOVE_RANGE
    const clamped = fullPath.slice(0, MOVE_RANGE + 1);

    // Start first hop immediately
    const firstTarget = clamped[1];
    unit.prevHex = { q: unit.hex.q, r: unit.hex.r };
    unit.hex = { q: firstTarget.q, r: firstTarget.r };
    unit.moveProgress = 0;
    unit.path = clamped.slice(2);
    return true;
  }

  /** True if the unit is currently walking a path. */
  isUnitMoving(unit: BattleUnit): boolean {
    return unit.moveProgress < 1 || unit.path.length > 0;
  }

  /** True if the unit can act (cooldown expired, not moving/dying/lunging). */
  canAct(unit: BattleUnit): boolean {
    return unit.actionCooldown <= 0
      && !unit.isDying
      && !this.isUnitMoving(unit)
      && unit.lungeTimer <= 0
      && unit.shakeTimer <= 0;
  }

  /** Reset a unit's action cooldown with random jitter. */
  resetCooldown(unit: BattleUnit): void {
    unit.actionCooldown = ACTION_COOLDOWN + (Math.random() - 0.5) * ACTION_JITTER * 2;
  }

  /** Set the player's lieutenant order (governs all blue-faction AI behaviour). */
  setLieutenantOrder(order: LieutenantOrder): void {
    this.lieutenantOrder = order;
  }

  /**
   * Enter or exit ability targeting mode.
   * Pass an ability name to highlight the cursor for targeting, or `null` to cancel.
   * While targeting, clicks on hexes are routed through `onAbilityExecute`.
   */
  setTargeting(abilityId: string | null): void {
    this.targetingAbility = abilityId;
  }

  /**
   * Mark an ability as used for this battle (once-per-battle tracking).
   * After calling this, `isAbilityOnCooldown(abilityId)` returns true
   * and the button is disabled for the remainder of the battle.
   */
  markAbilityUsed(abilityId: string): void {
    this.abilityCooldowns.add(abilityId);
  }

  isAbilityOnCooldown(abilityId: string): boolean {
    return this.abilityCooldowns.has(abilityId);
  }

  // ── Selection ──

  selectUnit(unitId: number | null): void {
    this.selectedUnitId = unitId;
  }

  getSelectedUnit(): BattleUnit | null {
    if (this.selectedUnitId === null) return null;
    return this.units.get(this.selectedUnitId) ?? null;
  }

  /** All hexes reachable within MOVE_RANGE (BFS flood-fill). */
  getMovementRange(hex: Hex): Hex[] {
    return this.getReachableHexes(hex, MOVE_RANGE);
  }

  /** BFS flood-fill: all empty hexes reachable within maxSteps. */
  getReachableHexes(from: Hex, maxSteps: number): Hex[] {
    const result: Hex[] = [];
    const visited = new Set<string>();
    const queue: { hex: Hex; dist: number }[] = [{ hex: from, dist: 0 }];
    visited.add(hexKey(from.q, from.r));

    while (queue.length > 0) {
      const { hex: current, dist } = queue.shift()!;
      if (dist > 0) result.push(current);
      if (dist >= maxSteps) continue;

      for (const nb of hexNeighbors(current)) {
        const key = hexKey(nb.q, nb.r);
        if (visited.has(key)) continue;
        if (!this.isValidHex(nb)) continue;
        if (this.getUnitAt(nb)) continue;
        visited.add(key);
        queue.push({ hex: nb, dist: dist + 1 });
      }
    }
    return result;
  }

  /** BFS shortest path from -> to, avoiding occupied hexes (except destination). */
  findPath(from: Hex, to: Hex): Hex[] | null {
    const fromKey = hexKey(from.q, from.r);
    const toKey = hexKey(to.q, to.r);
    if (fromKey === toKey) return [from];

    const visited = new Set<string>();
    const parent = new Map<string, string>();
    const hexMap = new Map<string, Hex>();
    const queue: Hex[] = [from];
    visited.add(fromKey);
    hexMap.set(fromKey, from);

    while (queue.length > 0) {
      const current = queue.shift()!;
      const curKey = hexKey(current.q, current.r);

      if (curKey === toKey) {
        // Reconstruct path
        const path: Hex[] = [];
        let key = toKey;
        while (key !== fromKey) {
          path.unshift(hexMap.get(key)!);
          key = parent.get(key)!;
        }
        path.unshift(from);
        return path;
      }

      for (const nb of hexNeighbors(current)) {
        const nbKey = hexKey(nb.q, nb.r);
        if (visited.has(nbKey)) continue;
        if (!this.isValidHex(nb)) continue;
        const occupant = this.getUnitAt(nb);
        if (occupant && nbKey !== toKey) continue;
        visited.add(nbKey);
        parent.set(nbKey, curKey);
        hexMap.set(nbKey, nb);
        queue.push(nb);
      }
    }
    return null;
  }

  // ── Combat ──

  getAdjacentEnemies(unit: BattleUnit): BattleUnit[] {
    const neighbors = hexNeighbors(unit.hex);
    const enemies: BattleUnit[] = [];
    for (const nh of neighbors) {
      const other = this.getUnitAt(nh); // already skips dying
      if (other && other.faction !== unit.faction) enemies.push(other);
    }
    return enemies;
  }

  getFactionUnits(faction: Faction): BattleUnit[] {
    const result: BattleUnit[] = [];
    for (const u of this.units.values()) {
      if (u.isDying) continue;
      if (u.faction === faction) result.push(u);
    }
    return result;
  }

  getFactionStrength(faction: Faction): number {
    let total = 0;
    for (const u of this.units.values()) {
      if (u.isDying) continue;
      if (u.faction === faction) total += u.currentHp;
    }
    return total;
  }

  findNearestEnemy(unit: BattleUnit): BattleUnit | null {
    let nearest: BattleUnit | null = null;
    let bestDist = Infinity;
    for (const other of this.units.values()) {
      if (other.isDying) continue;
      if (other.faction === unit.faction) continue;
      const d = hexDistance(unit.hex, other.hex);
      if (d < bestDist) {
        bestDist = d;
        nearest = other;
      }
    }
    return nearest;
  }

  /** Returns the first step on the shortest path (uses findPath internally). */
  findStepToward(from: Hex, to: Hex): Hex | null {
    const path = this.findPath(from, to);
    if (!path || path.length < 2) return null;
    return path[1];
  }

  resolveCombat(attacker: BattleUnit, defender: BattleUnit): void {
    // Pin the defender — can't move until attacker is dead
    if (defender.pinnedBy === null) {
      defender.pinnedBy = attacker.id;
    }

    // Lunge animation — attacker lunges toward defender
    attacker.lungeTarget = { q: defender.hex.q, r: defender.hex.r };
    attacker.lungeTimer = LUNGE_DURATION;

    // Perform strike (and possibly a double strike)
    this.performStrike(attacker, defender);

    if (attacker.stats.agi >= defender.stats.agi * DOUBLE_STRIKE_RATIO && !defender.isDying) {
      this.floatingTexts.push({
        text: 'CRIT!!', hex: { q: attacker.hex.q, r: attacker.hex.r },
        color: '#ffdd00', timer: FLOAT_TEXT_DURATION, duration: FLOAT_TEXT_DURATION,
      });
      this.performStrike(attacker, defender);
    }
  }

  private performStrike(attacker: BattleUnit, defender: BattleUnit): void {
    // Dodge check: defender's AGI advantage gives dodge chance
    const dodgeChance = Math.min(DODGE_MAX, Math.max(0,
      (defender.stats.agi - attacker.stats.agi) * DODGE_AGI_FACTOR,
    ));
    if (Math.random() * 100 < dodgeChance) {
      // Dodge — no damage, defender shakes briefly to show the miss
      defender.shakeTimer = SHAKE_DURATION * 0.3;
      this.floatingTexts.push({
        text: 'DODGE!', hex: { q: defender.hex.q, r: defender.hex.r },
        color: '#44ddff', timer: FLOAT_TEXT_DURATION, duration: FLOAT_TEXT_DURATION,
      });
      return;
    }

    // Damage: roll × ATK - DEF, minimum 1
    const roll = rollD6();
    let damage = Math.max(1, roll * attacker.stats.atk - defender.stats.def);
    // Boudicca veteran bonus: +5% damage per stack for blue units
    if (attacker.faction === 'blue' && this.veteranBonus > 0) {
      damage = Math.floor(damage * (1 + this.veteranBonus));
    }
    defender.currentHp -= damage;

    // Hit animations
    attacker.shakeTimer = SHAKE_DURATION;
    attacker.flashTimer = FLASH_DURATION;
    defender.shakeTimer = SHAKE_DURATION;
    defender.flashTimer = FLASH_DURATION;

    // Death check — defender only (no counter-attack)
    if (defender.currentHp <= 0) {
      defender.currentHp = 0;
      defender.isDying = true;
      defender.deathProgress = 0;
      if (this.selectedUnitId === defender.id) this.selectedUnitId = null;
    }
  }

  checkVictory(): void {
    switch (this.config.victoryMode) {
      case 'capture':
        this.checkCapture();
        break;
      case 'annihilation':
        this.checkAnnihilation();
        break;
      case 'morale':
        this.checkMorale();
        break;
    }
  }

  private checkAnnihilation(): void {
    for (const faction of ['blue', 'red'] as Faction[]) {
      const alive = this.getFactionUnits(faction);
      if (alive.length === 0) {
        this.phase = 'victory';
        this.winner = faction === 'blue' ? 'red' : 'blue';
        return;
      }
    }
  }

  private checkCapture(): void {
    // Also check annihilation — if all units of a faction are dead, the other wins
    for (const faction of ['blue', 'red'] as Faction[]) {
      if (this.getFactionUnits(faction).length === 0) {
        this.phase = 'victory';
        this.winner = faction === 'blue' ? 'red' : 'blue';
        return;
      }
    }
    // Check if any star has been fully captured
    for (const faction of ['blue', 'red'] as Faction[]) {
      if ((this.captureProgress.get(faction) ?? 0) >= CAPTURE_DURATION) {
        this.phase = 'victory';
        this.winner = faction === 'blue' ? 'red' : 'blue'; // enemy of the star's owner wins
        return;
      }
    }

    // Round timeout: prevent infinite stalemates
    if (this.roundCount > 200) {
      this.phase = 'draw';
      this.winner = null;
      return;
    }

    // Draw: if both sides only have Guards left, nobody can attack
    const blueUnits = this.getFactionUnits('blue');
    const redUnits = this.getFactionUnits('red');
    const blueOnlyGuards = blueUnits.length > 0 && blueUnits.every(u => u.role === 'guard');
    const redOnlyGuards = redUnits.length > 0 && redUnits.every(u => u.role === 'guard');
    if (blueOnlyGuards && redOnlyGuards) {
      this.phase = 'draw';
    }
  }

  /** Tick capture progress — call each frame from updateAnimations. */
  updateCapture(dt: number): void {
    if (this.config.victoryMode !== 'capture') return;
    for (const faction of ['blue', 'red'] as Faction[]) {
      const star = this.stars.get(faction);
      if (!star) continue;
      const occupant = this.getUnitAt(star);
      if (occupant && occupant.faction !== faction) {
        // Enemy is on this star — advance capture
        this.captureProgress.set(faction, (this.captureProgress.get(faction) ?? 0) + dt);
      } else {
        // No enemy — reset progress
        this.captureProgress.set(faction, 0);
      }
    }
  }

  /** Get the enemy faction's star hex (the star this faction wants to capture). */
  getEnemyStar(faction: Faction): Hex | null {
    const enemy: Faction = faction === 'blue' ? 'red' : 'blue';
    return this.stars.get(enemy) ?? null;
  }

  private checkMorale(): void {
    for (const faction of ['blue', 'red'] as Faction[]) {
      const current = this.getFactionStrength(faction);
      const starting = this.startingStrength.get(faction) ?? 1;
      if (current <= 0 || current / starting < MORALE_BREAK_THRESHOLD) {
        this.phase = 'victory';
        this.winner = faction === 'blue' ? 'red' : 'blue';
        return;
      }
    }
  }

  // ── Animation ──

  /** Advance all animations: movement, shake, flash, death. */
  updateAnimations(dt: number): void {
    const toRemove: number[] = [];

    for (const unit of this.units.values()) {
      // Movement animation
      if (unit.moveProgress < 1) {
        unit.moveProgress = Math.min(1, unit.moveProgress + MOVE_ANIM_SPEED * dt);
        if (unit.moveProgress >= 1) {
          unit.prevHex = null;
          if (unit.path.length > 0) {
            const next = unit.path.shift()!;
            if (!this.getUnitAt(next)) {
              unit.prevHex = { q: unit.hex.q, r: unit.hex.r };
              unit.hex = { q: next.q, r: next.r };
              unit.moveProgress = 0;
            } else {
              unit.path = [];
            }
          }
        }
      }

      // Combat effect timers
      if (unit.lungeTimer > 0) {
        unit.lungeTimer = Math.max(0, unit.lungeTimer - dt);
        if (unit.lungeTimer <= 0) unit.lungeTarget = null;
      }
      if (unit.shakeTimer > 0) unit.shakeTimer = Math.max(0, unit.shakeTimer - dt);
      if (unit.flashTimer > 0) unit.flashTimer = Math.max(0, unit.flashTimer - dt);

      // Action cooldown tick
      if (unit.actionCooldown > 0) unit.actionCooldown = Math.max(0, unit.actionCooldown - dt);

      // Death animation
      if (unit.isDying) {
        unit.deathProgress = Math.min(1, unit.deathProgress + dt / DEATH_DURATION);
        if (unit.deathProgress >= 1) toRemove.push(unit.id);
      }
    }

    for (const id of toRemove) {
      this.units.delete(id);
      // Unpin all units that were pinned by this dead unit
      for (const unit of this.units.values()) {
        if (unit.pinnedBy === id) unit.pinnedBy = null;
      }
    }

    // Floating text countdown
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      this.floatingTexts[i].timer -= dt;
      if (this.floatingTexts[i].timer <= 0) this.floatingTexts.splice(i, 1);
    }

    this.updateCapture(dt);
  }

  // ── Decretum Effects ──

  applyDecretumEffect(effect: DecretumEffect, targetHex?: Hex): void {
    switch (effect.type) {
      case 'heal': {
        if (effect.target === 'all') {
          for (const unit of this.getFactionUnits('blue')) {
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
        break;
      }
      case 'damage': {
        if (effect.target === 'area') {
          // Area damage hits ALL units (including friendly — the Riot)
          for (const unit of this.units.values()) {
            if (unit.isDying) continue;
            unit.currentHp -= effect.amount;
            unit.shakeTimer = SHAKE_DURATION;
            unit.flashTimer = FLASH_DURATION;
            if (unit.currentHp <= 0) { unit.currentHp = 0; unit.isDying = true; }
          }
        } else if (targetHex) {
          const unit = this.getUnitAt(targetHex);
          if (unit && unit.faction === 'red') {
            unit.currentHp -= effect.amount;
            unit.shakeTimer = SHAKE_DURATION;
            unit.flashTimer = FLASH_DURATION;
            if (unit.currentHp <= 0) { unit.currentHp = 0; unit.isDying = true; }
          }
        }
        break;
      }
      case 'buff': {
        for (const unit of this.getFactionUnits('blue')) {
          if (effect.stat === 'atk') unit.stats.atk = Math.floor(unit.stats.atk * (1 + effect.multiplier));
          else if (effect.stat === 'def') unit.stats.def = Math.floor(unit.stats.def * (1 + effect.multiplier));
          else if (effect.stat === 'hp') unit.stats.hp = Math.floor(unit.stats.hp * (1 + effect.multiplier));
          else if (effect.stat === 'agi') unit.stats.agi = Math.floor(unit.stats.agi * (1 + effect.multiplier));
        }
        this.floatingTexts.push({ text: 'BUFFED!', hex: { q: 5, r: 7 }, color: '#ffd700', timer: 0.8, duration: 0.8 });
        break;
      }
      case 'spawn': {
        // Spawn units at back row
        const rows = [3, 5, 7, 9, 11];
        let spawned = 0;
        for (const row of rows) {
          if (spawned >= effect.count) break;
          const hex = offsetToAxial(2, row);
          if (this.isValidHex(hex) && !this.getUnitAt(hex)) {
            const unit = this.addUnit('blue', hex, `Militia ${spawned + 1}`, effect.unitRole);
            unit.currentHp = Math.floor(unit.stats.hp * 0.6); // militia are weak
            spawned++;
          }
        }
        break;
      }
      case 'resource-gain': {
        // Handled by decretum-store before applyDecretumEffect is called
        break;
      }
      case 'prevent-death': {
        // TODO: implement death prevention tracking
        break;
      }
      case 'reveal':
      case 'event-modifier':
      case 'upkeep-reduction':
      case 'debuff':
        // These are non-battle effects or future implementations
        break;
    }
  }

  // ── Setup ──

  placeStartingUnits(): void {
    // ── Blue ──
    BLUE_VANGUARD_ROWS.forEach((row, i) => {
      this.addUnit('blue', offsetToAxial(BLUE_VANGUARD_COL, row), `${i + 1}st Blue Vanguard`, 'vanguard');
    });
    BLUE_RESERVE_ROWS.forEach((row, i) => {
      this.addUnit('blue', offsetToAxial(BLUE_RESERVE_COL, row), `${i + 1}st Blue Reserve`, 'reserve');
    });
    BLUE_GUARD_ROWS.forEach((row, i) => {
      this.addUnit('blue', offsetToAxial(BLUE_GUARD_COL, row), `${i + 1}st Blue Guard`, 'guard');
    });

    // ── Red ──
    RED_VANGUARD_ROWS.forEach((row, i) => {
      this.addUnit('red', offsetToAxial(RED_VANGUARD_COL, row), `${i + 1}st Red Vanguard`, 'vanguard');
    });
    RED_RESERVE_ROWS.forEach((row, i) => {
      this.addUnit('red', offsetToAxial(RED_RESERVE_COL, row), `${i + 1}st Red Reserve`, 'reserve');
    });
    RED_GUARD_ROWS.forEach((row, i) => {
      this.addUnit('red', offsetToAxial(RED_GUARD_COL, row), `${i + 1}st Red Guard`, 'guard');
    });

    // Record starting strengths for morale check
    this.startingStrength.set('blue', this.getFactionStrength('blue'));
    this.startingStrength.set('red', this.getFactionStrength('red'));

    // Place capture stars at the back-center of each side
    const midRow = Math.floor(this.config.rows / 2);
    this.stars.set('blue', offsetToAxial(0, midRow));
    this.stars.set('red', offsetToAxial(this.config.cols - 1, midRow));
    this.captureProgress.set('blue', 0);
    this.captureProgress.set('red', 0);
  }
}
