import type { Hex, Point } from './hex';
import { hexKey, hexNeighbors, offsetToAxial, HEX_SIZE } from './hex';

export type Faction = 'blue' | 'red';

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

export class BattleState {
  readonly config: BattleConfig;
  readonly grid = new Set<string>();
  readonly gridHexes: Hex[] = [];
  readonly units = new Map<number, BattleUnit>();
  selectedUnitId: number | null = null;
  private nextId = 1;

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

  // ── Setup ──

  placeStartingUnits(): void {
    // Blue faction — left side
    const bluePositions = [
      offsetToAxial(0, 1), offsetToAxial(0, 3), offsetToAxial(0, 5),
      offsetToAxial(1, 2), offsetToAxial(1, 4),
    ];
    bluePositions.forEach((hex, i) => {
      this.addUnit('blue', hex, 2000 + i * 500, `${i + 1}st Blue Infantry`);
    });

    // Red faction — right side
    const redPositions = [
      offsetToAxial(9, 1), offsetToAxial(9, 3), offsetToAxial(9, 5),
      offsetToAxial(8, 2), offsetToAxial(8, 4),
    ];
    redPositions.forEach((hex, i) => {
      this.addUnit('red', hex, 2000 + i * 500, `${i + 1}st Red Infantry`);
    });
  }
}
