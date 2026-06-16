import { signal } from '@preact/signals';

/**
 * Global difficulty — a player-chosen multiplier layer on top of the sim-tuned
 * baseline. `normal` is ×1 (the balanced default; the campaign ladder is tuned
 * for it), `relajada` eases and `dura` hardens. Persisted in localStorage like
 * the audio prefs (no meta-save schema change).
 *
 * First slice (DF1): only the decisive-battle enemy soldier count scales. Enemy
 * stats, march attrition and victory gold are follow-ups. Soldier deltas stay in
 * the hundreds (base 5000–6500 × 0.85/1.20 ⇒ ±~750–1300), per the balance rule.
 */
export type Difficulty = 'relajada' | 'normal' | 'dura';

export const DIFFICULTY_ORDER: Difficulty[] = ['relajada', 'normal', 'dura'];

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  relajada: 'Relajada',
  normal: 'Normal',
  dura: 'Dura',
};

export const DIFFICULTY_BLURB: Record<Difficulty, string> = {
  relajada: 'Enemigo más débil en la batalla decisiva.',
  normal: 'Equilibrio por defecto (recomendado).',
  dura: 'Enemigo reforzado en la batalla decisiva.',
};

/** Enemy soldier-count multiplier in the decisive battle, by difficulty. */
export const DIFFICULTY_ENEMY_SOLDIER_MULT: Record<Difficulty, number> = {
  relajada: 0.85,
  normal: 1.0,
  dura: 1.2,
};

/**
 * Victory-gold reward multiplier, by difficulty (same factors). Risk/reward:
 * the harder fight on `dura` pays a bigger purse; `relajada` pays less. This is
 * campaign gold (not soldiers/iuniores) so the hundreds rule does not apply.
 */
export const DIFFICULTY_VICTORY_GOLD_MULT: Record<Difficulty, number> = {
  relajada: 0.85,
  normal: 1.0,
  dura: 1.2,
};

function readStored(): Difficulty {
  try {
    const v = localStorage.getItem('imperium.difficulty');
    if (v === 'relajada' || v === 'normal' || v === 'dura') return v;
  } catch { /* storage unavailable */ }
  return 'normal';
}

export const difficulty = signal<Difficulty>(readStored());

/** Set the difficulty and persist it. */
export function setDifficulty(d: Difficulty): void {
  difficulty.value = d;
  try { localStorage.setItem('imperium.difficulty', d); } catch { /* session-only */ }
}

/** Enemy soldier multiplier for the current difficulty (1.0 on Normal). */
export function enemySoldierMult(): number {
  return DIFFICULTY_ENEMY_SOLDIER_MULT[difficulty.value];
}

/** Victory-gold reward multiplier for the current difficulty (1.0 on Normal). */
export function victoryGoldMult(): number {
  return DIFFICULTY_VICTORY_GOLD_MULT[difficulty.value];
}
