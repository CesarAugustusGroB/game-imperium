import type { ArmyData, BattleEvent, TopologyData } from '../../types/index';
import type { GameState } from '../core/state';
import type { ProvinceRegistry } from '../province/provinces';
import type { Cohort } from '../army/cohort';
import { computeArmySize } from '../army/cohort';
import { lerp } from '../../utils/math';
import { rgbToKey } from '../../utils/color';

const MOVE_SPEED = 0.4;
const COMBAT_INTERVAL = 1.5; // seconds between combat rounds
const DAMAGE_PER_ROLL = 500; // troops killed per dice pip
const AI_MOVE_CHANCE = 0.3;  // chance per second for idle AI to move

function rollD6(): number {
  return Math.floor(Math.random() * 6) + 1;
}

export class ArmyManager {
  armies: Map<number, ArmyData> = new Map();
  topology: TopologyData;
  battleEvents: BattleEvent[] = [];
  private gameState: GameState;
  private registry: ProvinceRegistry;
  private nextId = 1;
  private combatTimer = 0;
  private aiTimer = 0;

  constructor(topology: TopologyData, gameState: GameState, registry: ProvinceRegistry) {
    this.topology = topology;
    this.gameState = gameState;
    this.registry = registry;
  }

  /**
   * Create a new army. Size is derived from the cohort roster's total HP
   * (see `computeArmySize`). S14-03 breaking change: the old signature
   * took a `size: number` arg; the new shape makes cohorts the source of
   * truth. No existing call sites consumed the old signature.
   */
  createArmy(
    owner: string,
    name: string,
    provinceIndex: number,
    cohorts: Cohort[] = [],
    legateId: string | null = null,
  ): ArmyData {
    const army: ArmyData = {
      id: this.nextId++,
      owner,
      name,
      size: computeArmySize(cohorts),
      cohorts,
      legateId,
      provinceIndex,
      targetProvinceIndex: null,
      progress: 0,
      path: [],
      inCombat: false,
      combatTarget: null,
      lastRoll: 0,
    };
    this.armies.set(army.id, army);
    return army;
  }

  moveArmy(armyId: number, targetProvinceIndex: number): boolean {
    const army = this.armies.get(armyId);
    if (!army || army.inCombat) return false;

    const startProvince = army.targetProvinceIndex !== null && army.progress > 0.5
      ? army.targetProvinceIndex
      : army.provinceIndex;

    const path = this.findPath(startProvince, targetProvinceIndex);
    if (!path || path.length < 2) return false;

    if (army.targetProvinceIndex === null) {
      army.provinceIndex = path[0];
      army.targetProvinceIndex = path[1];
      army.progress = 0;
      army.path = path.slice(2);
    } else {
      const arrivalProvince = army.targetProvinceIndex;
      const newPath = this.findPath(arrivalProvince, targetProvinceIndex);
      if (!newPath || newPath.length < 2) return false;
      army.path = newPath.slice(1);
    }

    return true;
  }

  update(dt: number): void {
    // 1. Move armies
    for (const [, army] of this.armies) {
      if (army.targetProvinceIndex === null || army.inCombat) continue;

      army.progress += MOVE_SPEED * dt;

      if (army.progress >= 1.0) {
        army.provinceIndex = army.targetProvinceIndex;
        army.progress = 0;

        if (army.path.length > 0) {
          army.targetProvinceIndex = army.path.shift()!;
        } else {
          army.targetProvinceIndex = null;
        }
      }
    }

    // 2. Detect combat collisions
    this.detectCombat();

    // 3. Resolve combat on timer
    this.combatTimer += dt;
    if (this.combatTimer >= COMBAT_INTERVAL) {
      this.combatTimer = 0;
      this.resolveCombat();
    }

    // 4. AI movement
    this.aiTimer += dt;
    if (this.aiTimer >= 1.0) {
      this.aiTimer = 0;
      this.updateAI();
    }
  }

  private detectCombat(): void {
    // Group stationary armies by province
    const byProvince = new Map<number, ArmyData[]>();

    for (const [, army] of this.armies) {
      if (army.targetProvinceIndex !== null) continue; // skip moving armies
      const list = byProvince.get(army.provinceIndex) || [];
      list.push(army);
      byProvince.set(army.provinceIndex, list);
    }

    // Check for enemy collisions
    for (const [, armiesInProvince] of byProvince) {
      if (armiesInProvince.length < 2) continue;

      for (let i = 0; i < armiesInProvince.length; i++) {
        for (let j = i + 1; j < armiesInProvince.length; j++) {
          const a = armiesInProvince[i];
          const b = armiesInProvince[j];

          if (a.owner === b.owner) continue; // Same nation, no fight

          // Start combat
          a.inCombat = true;
          a.combatTarget = b.id;
          a.path = [];
          a.targetProvinceIndex = null;

          b.inCombat = true;
          b.combatTarget = a.id;
          b.path = [];
          b.targetProvinceIndex = null;
        }
      }
    }
  }

  private resolveCombat(): void {
    const toDestroy: number[] = [];

    // Find all active combat pairs (process each pair once)
    const processed = new Set<string>();

    for (const [, army] of this.armies) {
      if (!army.inCombat || army.combatTarget === null) continue;

      const pairKey = [Math.min(army.id, army.combatTarget), Math.max(army.id, army.combatTarget)].join('-');
      if (processed.has(pairKey)) continue;
      processed.add(pairKey);

      const enemy = this.armies.get(army.combatTarget);
      if (!enemy || !enemy.inCombat) {
        // Enemy gone, end combat
        army.inCombat = false;
        army.combatTarget = null;
        continue;
      }

      // Defender = lower ID (was there first)
      const defender = army.id < enemy.id ? army : enemy;
      const attacker = army.id < enemy.id ? enemy : army;

      // Roll dice
      const attackerRoll = rollD6();
      const defenderRoll = rollD6() + 1; // Defender advantage: +1

      attacker.lastRoll = attackerRoll;
      defender.lastRoll = defenderRoll;

      // Apply damage
      const attackerDamage = defenderRoll * DAMAGE_PER_ROLL;
      const defenderDamage = attackerRoll * DAMAGE_PER_ROLL;

      attacker.size -= attackerDamage;
      defender.size -= defenderDamage;

      // Log battle event
      this.battleEvents.push({
        attackerId: attacker.id,
        attackerName: attacker.name,
        defenderId: defender.id,
        defenderName: defender.name,
        attackerRoll,
        defenderRoll,
        attackerDamage,
        defenderDamage,
        provinceIndex: defender.provinceIndex,
        timestamp: Date.now(),
      });

      // Keep only last 10 events
      if (this.battleEvents.length > 10) {
        this.battleEvents.shift();
      }

      // Check for destruction
      if (attacker.size <= 0) {
        toDestroy.push(attacker.id);
        defender.inCombat = false;
        defender.combatTarget = null;
      }
      if (defender.size <= 0) {
        toDestroy.push(defender.id);
        attacker.inCombat = false;
        attacker.combatTarget = null;
      }
    }

    // Remove destroyed armies and transfer provinces to the victor
    for (const id of toDestroy) {
      const destroyed = this.armies.get(id);
      if (destroyed) {
        // Find a surviving enemy in the same province to claim it
        const victor = this.getSurvivingEnemyInProvince(destroyed.provinceIndex, destroyed.owner);
        if (victor) {
          this.conquerProvince(destroyed.provinceIndex, victor.owner);
        }
      }
      this.armies.delete(id);
    }
  }

  private getSurvivingEnemyInProvince(provinceIndex: number, excludeOwner: string): ArmyData | null {
    for (const army of this.armies.values()) {
      if (army.provinceIndex === provinceIndex && army.owner !== excludeOwner && army.size > 0) {
        return army;
      }
    }
    return null;
  }

  private conquerProvince(provinceIndex: number, newOwner: string): void {
    const province = this.gameState.provinceByIndex.get(provinceIndex);
    if (!province || province.owner === newOwner) return;

    const key = rgbToKey(province.color[0], province.color[1], province.color[2]);
    this.gameState.transferProvince(key, newOwner);
    this.registry.updateProvince(key);
  }

  private updateAI(): void {
    for (const [, army] of this.armies) {
      // Skip if moving or fighting
      if (army.targetProvinceIndex !== null || army.inCombat) continue;

      // Random chance to move
      if (Math.random() > AI_MOVE_CHANCE) continue;

      const neighbors = this.topology.adjacency[String(army.provinceIndex)] || [];
      if (neighbors.length === 0) continue;

      // Prefer provinces with enemy armies or owned by other nations
      const enemyNeighbors = neighbors.filter(n => {
        const enemiesHere = this.getEnemyArmiesInProvince(n, army.owner);
        return enemiesHere.length > 0;
      });

      let target: number;
      if (enemyNeighbors.length > 0) {
        // Move toward an enemy
        target = enemyNeighbors[Math.floor(Math.random() * enemyNeighbors.length)];
      } else {
        // Random wander
        target = neighbors[Math.floor(Math.random() * neighbors.length)];
      }

      this.moveArmy(army.id, target);
    }
  }

  private getEnemyArmiesInProvince(provinceIndex: number, myOwner: string): ArmyData[] {
    const result: ArmyData[] = [];
    for (const [, army] of this.armies) {
      if (army.owner !== myOwner && army.provinceIndex === provinceIndex && army.targetProvinceIndex === null) {
        result.push(army);
      }
    }
    return result;
  }

  getArmyPosition(army: ArmyData): [number, number] {
    const fromCenter = this.topology.centers[String(army.provinceIndex)];
    if (!fromCenter) return [0.5, 0.5];

    if (army.targetProvinceIndex === null) {
      return [fromCenter[0], fromCenter[1]];
    }

    const toCenter = this.topology.centers[String(army.targetProvinceIndex)];
    if (!toCenter) return [fromCenter[0], fromCenter[1]];

    return [
      lerp(fromCenter[0], toCenter[0], army.progress),
      lerp(fromCenter[1], toCenter[1], army.progress),
    ];
  }

  getArmiesInProvince(provinceIndex: number): ArmyData[] {
    const result: ArmyData[] = [];
    for (const [, army] of this.armies) {
      if (army.provinceIndex === provinceIndex && army.targetProvinceIndex === null) {
        result.push(army);
      }
    }
    return result;
  }

  findPath(from: number, to: number): number[] | null {
    if (from === to) return [from];

    const adj = this.topology.adjacency;
    const visited = new Set<number>();
    const parent = new Map<number, number>();
    const queue: number[] = [from];
    visited.add(from);

    while (queue.length > 0) {
      const current = queue.shift()!;
      const neighbors = adj[String(current)] || [];

      for (const neighbor of neighbors) {
        if (visited.has(neighbor)) continue;
        visited.add(neighbor);
        parent.set(neighbor, current);

        if (neighbor === to) {
          const path: number[] = [];
          let node = to;
          while (node !== from) {
            path.unshift(node);
            node = parent.get(node)!;
          }
          path.unshift(from);
          return path;
        }

        queue.push(neighbor);
      }
    }

    return null;
  }
}
