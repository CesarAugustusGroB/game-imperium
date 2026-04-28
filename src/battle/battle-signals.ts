/**
 * battle-signals.ts — Reactive bridge from canvas BattleState to Preact UI.
 *
 * BattleMode.update() calls `syncBattleSignals(state)` each frame.
 * Preact components subscribe to these signals and re-render automatically.
 */
import { signal, computed } from '@preact/signals';
import type { BattlePhase, BattleFaction, UnitRole } from './battle-types';
import type { BattleState } from './battle-state';
import type { BattleContext } from '../game/progression/battle-terrain-modifiers';

/**
 * S27-10: campaign battle context — populated by `enterFromSpoke` from the
 * active landmark node, cleared by `enterQuickBattle`. UI reads it via the
 * `BattleContextBanner` to surface terrain/modifier flavor on entry without
 * reaching into game state directly.
 */
export const currentBattleContext = signal<BattleContext | null>(null);

// ── Unit summary (for selected-unit panel) ──

export interface BattleUnitSummary {
  id: number;
  name: string;
  faction: BattleFaction;
  role: UnitRole;
  currentHp: number;
  maxHp: number;
  atk: number;
  def: number;
  agi: number;
  isDying: boolean;
}

// ── Faction summary (for army panels) ──

export interface RoleTally { alive: number; total: number; }

export interface BattleFactionSummary {
  totalUnits: number;
  aliveUnits: number;
  maxHp: number;
  currentHp: number;
  byRole: Record<UnitRole, RoleTally>;
}

function emptyFactionSummary(): BattleFactionSummary {
  return {
    totalUnits: 0,
    aliveUnits: 0,
    maxHp: 0,
    currentHp: 0,
    byRole: {
      vanguard: { alive: 0, total: 0 },
      reserve:  { alive: 0, total: 0 },
      guard:    { alive: 0, total: 0 },
    },
  };
}

// ── Signals ──

export const battleActive       = signal(false);
/** Set to true from UI to request battle exit (processed in game loop). */
export const requestBattleExit  = signal(false);
export const battlePhase     = signal<BattlePhase>('fighting');
export const battleWinner    = signal<BattleFaction | null>(null);
export const battleRound     = signal(0);
export const selectedUnit    = signal<BattleUnitSummary | null>(null);
export const blueSummary     = signal<BattleFactionSummary>(emptyFactionSummary());
export const redSummary      = signal<BattleFactionSummary>(emptyFactionSummary());
export const captureBlueProgress = signal(0);
export const captureRedProgress  = signal(0);
export const allUnits        = signal<BattleUnitSummary[]>([]);

// Derived: cohesion percentages (0-100) — faction remaining-strength as a share
// of starting strength. Used for the army-strength comparison bar and the
// cohesion-break victory check. Distinct from the per-army `morale` stat in
// `src/game/army/morale.ts`, which modifies combat effectiveness.
export const blueCohesion = computed(() => {
  const s = blueSummary.value;
  return s.maxHp > 0 ? Math.round((s.currentHp / s.maxHp) * 100) : 0;
});

export const redCohesion = computed(() => {
  const s = redSummary.value;
  return s.maxHp > 0 ? Math.round((s.currentHp / s.maxHp) * 100) : 0;
});

// ── Sync function (called each frame from BattleMode.update) ──

function buildFactionSummary(state: BattleState, faction: BattleFaction): BattleFactionSummary {
  const summary = emptyFactionSummary();
  for (const unit of state.units.values()) {
    if (unit.faction !== faction) continue;
    summary.totalUnits++;
    summary.maxHp += unit.stats.hp;
    const role = unit.role;
    summary.byRole[role].total++;
    if (!unit.isDying) {
      summary.aliveUnits++;
      summary.currentHp += Math.max(0, unit.currentHp);
      summary.byRole[role].alive++;
    }
  }
  return summary;
}

export function syncBattleSignals(state: BattleState): void {
  battlePhase.value = state.phase;
  battleWinner.value = state.winner;
  battleRound.value = state.roundCount;

  // Faction summaries
  blueSummary.value = buildFactionSummary(state, 'blue');
  redSummary.value  = buildFactionSummary(state, 'red');

  // Capture progress
  captureBlueProgress.value = state.captureProgress.get('blue') ?? 0;
  captureRedProgress.value  = state.captureProgress.get('red') ?? 0;

  // Selected unit
  if (state.selectedUnitId != null) {
    const unit = state.units.get(state.selectedUnitId);
    if (unit) {
      selectedUnit.value = {
        id: unit.id,
        name: unit.name,
        faction: unit.faction,
        role: unit.role,
        currentHp: Math.max(0, unit.currentHp),
        maxHp: unit.stats.hp,
        atk: unit.stats.atk,
        def: unit.stats.def,
        agi: unit.stats.agi,
        isDying: unit.isDying,
      };
    } else {
      selectedUnit.value = null;
    }
  } else {
    selectedUnit.value = null;
  }

  // All alive units (for list views)
  const units: BattleUnitSummary[] = [];
  for (const unit of state.units.values()) {
    units.push({
      id: unit.id,
      name: unit.name,
      faction: unit.faction,
      role: unit.role,
      currentHp: Math.max(0, unit.currentHp),
      maxHp: unit.stats.hp,
      atk: unit.stats.atk,
      def: unit.stats.def,
      agi: unit.stats.agi,
      isDying: unit.isDying,
    });
  }
  allUnits.value = units;
}

/** Reset all signals when battle exits. */
export function resetBattleSignals(): void {
  battleActive.value = false;
  requestBattleExit.value = false;
  battlePhase.value = 'fighting';
  battleWinner.value = null;
  battleRound.value = 0;
  selectedUnit.value = null;
  blueSummary.value = emptyFactionSummary();
  redSummary.value  = emptyFactionSummary();
  captureBlueProgress.value = 0;
  captureRedProgress.value  = 0;
  allUnits.value = [];
}
