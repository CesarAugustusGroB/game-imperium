// S33-10: Bellum HUD and warning UX verification.
// Run with: npx tsx tools/verify-bellum-hud.ts
//
// Covers:
//  1. selectActiveWarning priority — each warning kind in isolation.
//  2. Final Invasion ready dominates army-wiped (both true → final-invasion-ready).
//  3. Army wiped dominates starvation (both true → army-wiped).
//  4. Starvation dominates morale-critical (both true → starvation).
//  5. Morale-critical dominates imminent (moraleCritical true + season imminent → morale-critical).
//  6. Imminent fires only when season === maxSeasons - 1 AND no other warning.
//  7. Final Invasion when season === maxSeasons (boundary).
//  8. Default kind=null with empty warning state and mid-run season.
//  9. objectiveChipProps resolver — all three branches (default, imminent, ready).

import {
  selectActiveWarning,
} from '../src/ui/components/bellum/BellumWarningBanner';
import type { BellumWarningState } from '../src/game/campaign/campaign-defeat';
import { objectiveChipProps } from '../src/ui/components/bellum/bellum-objective';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

const MAX = 12; // test maxSeasons value

function emptyWarnings(): BellumWarningState {
  return {
    zeroSupplyMoveStreak: 0,
    starvationWarning: false,
    moraleCritical: false,
    armyWiped: false,
  };
}

// ── 1. Each warning kind in isolation ────────────────────────────────────────

// final-invasion-ready (via season cap)
{
  const w = emptyWarnings();
  const result = selectActiveWarning(w, MAX, MAX);
  assert(result.kind === 'final-invasion-ready', `1a: season >= max should be final-invasion-ready, got ${result.kind}`);
  assert(result.tone === 'danger', `1a: final-invasion-ready tone should be danger`);
  assert(result.icon === '⚔', `1a: final-invasion-ready icon should be ⚔, got ${result.icon}`);
}
console.log('PASS 1a: final-invasion-ready fires when season >= maxSeasons');

// army-wiped
{
  const w = emptyWarnings();
  w.armyWiped = true;
  const result = selectActiveWarning(w, 5, MAX);
  assert(result.kind === 'army-wiped', `1b: armyWiped should be army-wiped, got ${result.kind}`);
  assert(result.tone === 'danger', `1b: army-wiped tone should be danger`);
}
console.log('PASS 1b: army-wiped fires when armyWiped is true');

// starvation
{
  const w = emptyWarnings();
  w.starvationWarning = true;
  const result = selectActiveWarning(w, 5, MAX);
  assert(result.kind === 'starvation', `1c: starvationWarning should be starvation, got ${result.kind}`);
  assert(result.tone === 'danger', `1c: starvation tone should be danger`);
  assert(result.icon === '📦', `1c: starvation icon should be 📦, got ${result.icon}`);
}
console.log('PASS 1c: starvation fires when starvationWarning is true');

// morale-critical
{
  const w = emptyWarnings();
  w.moraleCritical = true;
  const result = selectActiveWarning(w, 5, MAX);
  assert(result.kind === 'morale-critical', `1d: moraleCritical should be morale-critical, got ${result.kind}`);
  assert(result.tone === 'warning', `1d: morale-critical tone should be warning`);
  assert(result.icon === '🔥', `1d: morale-critical icon should be 🔥, got ${result.icon}`);
}
console.log('PASS 1d: morale-critical fires when moraleCritical is true');

// final-invasion-imminent
{
  const w = emptyWarnings();
  const result = selectActiveWarning(w, MAX - 1, MAX);
  assert(result.kind === 'final-invasion-imminent', `1e: season === maxSeasons-1 should be final-invasion-imminent, got ${result.kind}`);
  assert(result.tone === 'warning', `1e: final-invasion-imminent tone should be warning`);
  assert(result.icon === '⏳', `1e: final-invasion-imminent icon should be ⏳, got ${result.icon}`);
}
console.log('PASS 1e: final-invasion-imminent fires when season === maxSeasons - 1');

// ── 2. Final Invasion ready dominates army-wiped ──────────────────────────────
{
  const w = emptyWarnings();
  w.armyWiped = true;
  const result = selectActiveWarning(w, MAX, MAX);
  assert(result.kind === 'final-invasion-ready', `2: final-invasion-ready should dominate army-wiped, got ${result.kind}`);
}
console.log('PASS 2: final-invasion-ready dominates army-wiped');

// ── 3. Army wiped dominates starvation ───────────────────────────────────────
{
  const w = emptyWarnings();
  w.armyWiped = true;
  w.starvationWarning = true;
  const result = selectActiveWarning(w, 5, MAX);
  assert(result.kind === 'army-wiped', `3: army-wiped should dominate starvation, got ${result.kind}`);
}
console.log('PASS 3: army-wiped dominates starvation');

// ── 4. Starvation dominates morale-critical ───────────────────────────────────
{
  const w = emptyWarnings();
  w.starvationWarning = true;
  w.moraleCritical = true;
  const result = selectActiveWarning(w, 5, MAX);
  assert(result.kind === 'starvation', `4: starvation should dominate morale-critical, got ${result.kind}`);
}
console.log('PASS 4: starvation dominates morale-critical');

// ── 5. Morale-critical dominates imminent ────────────────────────────────────
{
  const w = emptyWarnings();
  w.moraleCritical = true;
  const result = selectActiveWarning(w, MAX - 1, MAX);
  assert(result.kind === 'morale-critical', `5: morale-critical should dominate final-invasion-imminent, got ${result.kind}`);
}
console.log('PASS 5: morale-critical dominates final-invasion-imminent');

// ── 6. Imminent fires only when season === maxSeasons - 1 AND no other warning ──
{
  // Exact boundary: season === maxSeasons - 1, no warnings → imminent
  const w = emptyWarnings();
  const result = selectActiveWarning(w, MAX - 1, MAX);
  assert(result.kind === 'final-invasion-imminent', `6a: imminent fires at maxSeasons-1 with no other warnings`);

  // Season === maxSeasons - 2 → no warning
  const result2 = selectActiveWarning(w, MAX - 2, MAX);
  assert(result2.kind === null, `6b: no warning at maxSeasons-2 with clean state, got ${result2.kind}`);
}
console.log('PASS 6: imminent fires only at maxSeasons-1 with no higher-priority warnings');

// ── 7. Final Invasion when season === maxSeasons (boundary) ──────────────────
{
  const w = emptyWarnings();
  // Exactly at the cap
  const result = selectActiveWarning(w, MAX, MAX);
  assert(result.kind === 'final-invasion-ready', `7a: at cap fires final-invasion-ready`);

  // Over the cap
  const result2 = selectActiveWarning(w, MAX + 1, MAX);
  assert(result2.kind === 'final-invasion-ready', `7b: over cap also fires final-invasion-ready`);
}
console.log('PASS 7: final-invasion-ready fires at and above maxSeasons');

// ── 8. Default kind=null with empty warnings + mid-run season ────────────────
{
  const w = emptyWarnings();
  const result = selectActiveWarning(w, 6, MAX);
  assert(result.kind === null, `8: clean mid-run state should produce null, got ${result.kind}`);
  assert(result.icon === '', `8: null warning icon should be empty string`);
  assert(result.title === '', `8: null warning title should be empty string`);
  assert(result.message === '', `8: null warning message should be empty string`);
}
console.log('PASS 8: null warning returned for clean mid-run state');

// ── 9. objectiveChipProps — all three branches ────────────────────────────────

// Default branch
{
  const props = objectiveChipProps(5, MAX);
  assert(props.icon === '🏛', `9a: default icon should be 🏛, got ${props.icon}`);
  assert(props.label.includes(`${MAX}`), `9a: default label should mention maxSeasons`);
  assert(props.style === undefined, `9a: default props should have no style`);
}
console.log('PASS 9a: objectiveChipProps default branch');

// Imminent branch (season === maxSeasons - 1)
{
  const props = objectiveChipProps(MAX - 1, MAX);
  assert(props.icon === '⏳', `9b: imminent icon should be ⏳, got ${props.icon}`);
  assert(props.label.includes('next season'), `9b: imminent label should mention "next season"`);
  assert(props.style !== undefined, `9b: imminent props should have a style`);
  assert(props.style!.color === 'var(--color-gold-primary)', `9b: imminent color should be gold-primary`);
}
console.log('PASS 9b: objectiveChipProps imminent branch');

// Ready branch (season >= maxSeasons)
{
  const props = objectiveChipProps(MAX, MAX);
  assert(props.icon === '⚔', `9c: ready icon should be ⚔, got ${props.icon}`);
  assert(props.label === 'FINAL INVASION', `9c: ready label should be FINAL INVASION, got ${props.label}`);
  assert(props.style !== undefined, `9c: ready props should have a style`);
  assert(props.style!.color === 'var(--color-danger)', `9c: ready color should be danger`);
  assert(props.style!.borderColor === 'var(--color-danger)', `9c: ready borderColor should be danger`);

  // Also over the cap
  const props2 = objectiveChipProps(MAX + 2, MAX);
  assert(props2.icon === '⚔', `9c2: over-cap icon should be ⚔`);
}
console.log('PASS 9c: objectiveChipProps ready branch');

console.log('\nAll bellum-hud checks passed.');
