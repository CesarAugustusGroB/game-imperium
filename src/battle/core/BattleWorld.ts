/**
 * BattleWorld — pure data container for a single battle.
 *
 * Holds everything that changes over the course of a battle: grid cells,
 * units, combat flags, animation/particle state, victory bookkeeping, player
 * UI state (selection, targeting, abilities). **No behavior beyond its
 * constructor** — all mutation happens in the `systems/` modules which take
 * a `BattleWorld` as their first argument.
 *
 * This separation lets us:
 *   - test systems in isolation with a hand-built world
 *   - swap systems (e.g. an alternative combat resolver) without touching state
 *   - render / serialize / inspect the world without invoking any game logic
 */

import type { Hex } from '../hex';
import type {
  BattleFaction, BattlePhase, BattleUnit, BattleConfig, FloatingText, LieutenantOrder,
} from '../battle-types';
import { DEFAULT_CONFIG } from '../battle-config';

export interface Particle {
  hex: { q: number; r: number };
  offsetX: number;  // pixel offset from hex center
  offsetY: number;
  vx: number;       // velocity pixels/sec
  vy: number;
  life: number;     // remaining seconds
  maxLife: number;
  color: string;
  size: number;
}

export class BattleWorld {
  readonly config: BattleConfig;

  // ── Grid ──
  readonly grid = new Set<string>();
  readonly gridHexes: Hex[] = [];

  // ── Units ──
  readonly units = new Map<number, BattleUnit>();
  selectedUnitId: number | null = null;
  /** Next unit id (auto-increment). Owned by unit-system. */
  nextId = 1;

  // ── Combat state ──
  phase: BattlePhase = 'fighting';
  paused = false;
  winner: BattleFaction | null = null;
  roundCount = 0;
  lieutenantOrder: LieutenantOrder = 'auto';
  /** Additive damage multiplier from Boudicca's veteran stacks (0.05 per stack). */
  veteranBonus: number = 0;
  /** Remaining prevent-death charges from Decretum Oracle — blue units survive at 1 HP. */
  preventDeathCount = 0;
  /** Starting strength per faction — captured at setup for morale victory checks. */
  readonly startingStrength = new Map<BattleFaction, number>();

  // ── Player abilities ──
  targetingAbility: string | null = null;
  readonly abilityCooldowns = new Set<string>();
  /** Callback fired when a hex is clicked while targeting an ability. */
  onAbilityExecute: ((abilityId: string, targetHex: Hex) => void) | null = null;

  // ── Floating combat text (DODGE, CRIT, REVIVED, etc.) ──
  readonly floatingTexts: FloatingText[] = [];

  // ── Particles + screen shake ──
  readonly particles: Particle[] = [];
  screenShake: number = 0;

  // ── Capture-the-star state ──
  readonly stars = new Map<BattleFaction, Hex>();
  readonly captureProgress = new Map<BattleFaction, number>();

  constructor(config?: Partial<BattleConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
}
