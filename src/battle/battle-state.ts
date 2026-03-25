import type { Hex, Point } from './hex';
import { hexKey, hexNeighbors, hexDistance, offsetToAxial, HEX_SIZE } from './hex';

export type Faction = 'blue' | 'red';
export type BattlePhase = 'fighting' | 'victory';

export interface BattleUnit {
  id: number;
  faction: Faction;
  hex: Hex;
  strength: number;
  name: string;
  // Movement state (mirrors strategic ArmyData.path pattern)
  prevHex: Hex | null;
  moveProgress: number; // 0 = at prevHex, 1 = at hex
  path: Hex[];          // queued hexes to walk through
}

export interface BattleConfig {
  cols: number;
  rows: number;
  hexSize: number;
}

const DEFAULT_CONFIG: BattleConfig = { cols: 10, rows: 7, hexSize: HEX_SIZE };
const MOVE_RANGE = 3;           // max hexes per move action
const MOVE_ANIM_SPEED = 1.2;    // progress per second (~0.83s per hop, 3 hops ≈ 2.5s)
const DAMAGE_PER_ROLL = 300;
const MORALE_BREAK_THRESHOLD = 0.3;

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
  private startingStrength = new Map<Faction, number>();

  constructor(config?: Partial<BattleConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ── Grid ──

  generateGrid(): void {
    this.grid.clear();
    this.gridHexes.length = 0;
    for (let col = 0; col < this.config.cols; col++) {
      for (let row = 0; row < this.config.rows; row++) {
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
    const totalW = (this.config.cols - 1) * s * 1.5 + s * 2;
    const totalH = this.config.rows * s * sqrt3 + s * sqrt3 * 0.5;
    return {
      x: (canvasW - totalW) / 2 + s,
      y: (canvasH - totalH) / 2 + s * sqrt3 / 2,
    };
  }

  // ── Units ──

  addUnit(faction: Faction, hex: Hex, strength: number, name: string): BattleUnit {
    const unit: BattleUnit = {
      id: this.nextId++, faction, hex, strength, name,
      prevHex: null, moveProgress: 1, path: [],
    };
    this.units.set(unit.id, unit);
    return unit;
  }

  getUnitAt(hex: Hex): BattleUnit | null {
    for (const unit of this.units.values()) {
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
      const other = this.getUnitAt(nh);
      if (other && other.faction !== unit.faction) enemies.push(other);
    }
    return enemies;
  }

  getFactionUnits(faction: Faction): BattleUnit[] {
    const result: BattleUnit[] = [];
    for (const u of this.units.values()) {
      if (u.faction === faction) result.push(u);
    }
    return result;
  }

  getFactionStrength(faction: Faction): number {
    let total = 0;
    for (const u of this.units.values()) {
      if (u.faction === faction) total += u.strength;
    }
    return total;
  }

  findNearestEnemy(unit: BattleUnit): BattleUnit | null {
    let nearest: BattleUnit | null = null;
    let bestDist = Infinity;
    for (const other of this.units.values()) {
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
    const atkRoll = rollD6();
    const defRoll = rollD6() + 1; // defender advantage

    attacker.strength -= defRoll * DAMAGE_PER_ROLL;
    defender.strength -= atkRoll * DAMAGE_PER_ROLL;

    // Remove destroyed units + clear selection
    if (attacker.strength <= 0) {
      this.units.delete(attacker.id);
      if (this.selectedUnitId === attacker.id) this.selectedUnitId = null;
    }
    if (defender.strength <= 0) {
      this.units.delete(defender.id);
      if (this.selectedUnitId === defender.id) this.selectedUnitId = null;
    }
  }

  checkMorale(): void {
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

  /** Advance movement animations; consume path queue on hop completion. */
  updateAnimations(dt: number): void {
    for (const unit of this.units.values()) {
      if (unit.moveProgress >= 1) continue;

      unit.moveProgress = Math.min(1, unit.moveProgress + MOVE_ANIM_SPEED * dt);

      if (unit.moveProgress >= 1) {
        unit.prevHex = null;

        // Advance to next hop in path queue
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
  }

  // ── Setup ──

  placeStartingUnits(): void {
    const bluePositions = [
      offsetToAxial(0, 1), offsetToAxial(0, 3), offsetToAxial(0, 5),
      offsetToAxial(1, 2), offsetToAxial(1, 4),
    ];
    bluePositions.forEach((hex, i) => {
      this.addUnit('blue', hex, 2000 + i * 500, `${i + 1}st Blue Infantry`);
    });

    const redPositions = [
      offsetToAxial(9, 1), offsetToAxial(9, 3), offsetToAxial(9, 5),
      offsetToAxial(8, 2), offsetToAxial(8, 4),
    ];
    redPositions.forEach((hex, i) => {
      this.addUnit('red', hex, 2000 + i * 500, `${i + 1}st Red Infantry`);
    });

    // Record starting strengths for morale check
    this.startingStrength.set('blue', this.getFactionStrength('blue'));
    this.startingStrength.set('red', this.getFactionStrength('red'));
  }
}
