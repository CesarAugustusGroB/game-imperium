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
}

export interface BattleConfig {
  cols: number;
  rows: number;
  hexSize: number;
}

const DEFAULT_CONFIG: BattleConfig = { cols: 10, rows: 7, hexSize: HEX_SIZE };
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
  roundTimer = 0;
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
    const unit: BattleUnit = { id: this.nextId++, faction, hex, strength, name };
    this.units.set(unit.id, unit);
    return unit;
  }

  getUnitAt(hex: Hex): BattleUnit | null {
    for (const unit of this.units.values()) {
      if (unit.hex.q === hex.q && unit.hex.r === hex.r) return unit;
    }
    return null;
  }

  moveUnit(unitId: number, target: Hex): boolean {
    const unit = this.units.get(unitId);
    if (!unit) return false;
    if (!this.isValidHex(target)) return false;
    if (this.getUnitAt(target)) return false;
    unit.hex = { q: target.q, r: target.r };
    return true;
  }

  // ── Selection ──

  selectUnit(unitId: number | null): void {
    this.selectedUnitId = unitId;
  }

  getSelectedUnit(): BattleUnit | null {
    if (this.selectedUnitId === null) return null;
    return this.units.get(this.selectedUnitId) ?? null;
  }

  getMovementRange(hex: Hex): Hex[] {
    return hexNeighbors(hex).filter(n => this.isValidHex(n) && !this.getUnitAt(n));
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

  findStepToward(from: Hex, to: Hex): Hex | null {
    // BFS to find first step on shortest path
    const visited = new Set<string>();
    const parent = new Map<string, string>();
    const queue: Hex[] = [from];
    const fromKey = hexKey(from.q, from.r);
    const toKey = hexKey(to.q, to.r);
    visited.add(fromKey);

    while (queue.length > 0) {
      const current = queue.shift()!;
      const curKey = hexKey(current.q, current.r);

      if (curKey === toKey) {
        // Trace back to find first step
        let step = toKey;
        while (parent.get(step) !== fromKey) {
          const p = parent.get(step);
          if (!p) return null;
          step = p;
        }
        const [q, r] = step.split(',').map(Number);
        return { q, r };
      }

      for (const nb of hexNeighbors(current)) {
        const nbKey = hexKey(nb.q, nb.r);
        if (visited.has(nbKey)) continue;
        if (!this.isValidHex(nb)) continue;
        // Can pass through empty hexes or the target hex
        const occupant = this.getUnitAt(nb);
        if (occupant && nbKey !== toKey) continue;
        visited.add(nbKey);
        parent.set(nbKey, curKey);
        queue.push(nb);
      }
    }
    return null;
  }

  resolveCombat(attacker: BattleUnit, defender: BattleUnit): void {
    const atkRoll = rollD6();
    const defRoll = rollD6() + 1; // defender advantage

    attacker.strength -= defRoll * DAMAGE_PER_ROLL;
    defender.strength -= atkRoll * DAMAGE_PER_ROLL;

    // Remove destroyed units
    if (attacker.strength <= 0) this.units.delete(attacker.id);
    if (defender.strength <= 0) this.units.delete(defender.id);
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
