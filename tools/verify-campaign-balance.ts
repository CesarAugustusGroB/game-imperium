// S31-03: pure-math checks for the campaign-balance helpers.
// Run with: npx tsx tools/verify-campaign-balance.ts

import {
  applyMoveDeltas,
  getMoraleDelta,
  getSupplyCost,
  MORALE_MAX,
  STARVATION_MORALE_PENALTY,
  SUPPLIES_MAX,
} from '../src/game/campaign/campaign-balance';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

// ── Supply costs ─────────────────────────────────────────────────────
assert(getSupplyCost('road') === 0, 'road costs 0 supplies');
assert(getSupplyCost('plains') === 1, 'plains costs 1 supply');
assert(getSupplyCost('forest') === 1, 'forest costs 1 supply');
assert(getSupplyCost('river') === 2, 'river costs 2 supplies');
assert(getSupplyCost('mountains') === 1, 'mountains costs 1 supply (default)');
console.log('PASS: supply costs by terrain');

// ── Morale deltas (terrain × event combinations) ────────────────────
assert(getMoraleDelta('camp', 'rest') === 10, 'camp + rest = +10');
assert(getMoraleDelta('ruins', 'ambush') === -10, 'ruins + ambush = -10');
assert(getMoraleDelta('mountains', 'none') === -3, 'mountains + none = -3');
assert(getMoraleDelta('road', 'story') === 3, 'road + story = +3');
assert(getMoraleDelta('plains', 'none') === 0, 'plains + none = 0');
console.log('PASS: morale deltas');

// ── Clamps ──────────────────────────────────────────────────────────
{
  // Supplies floor at 0
  const out = applyMoveDeltas({ supplies: 0, morale: 50 }, 'plains', 'none');
  assert(out.supplies === 0, 'supplies floor at 0');
}
{
  // Morale ceiling at MORALE_MAX
  const out = applyMoveDeltas({ supplies: 50, morale: MORALE_MAX }, 'camp', 'rest');
  assert(out.morale === MORALE_MAX, 'morale ceiling at MORALE_MAX');
}
{
  // Morale floor at 0
  const out = applyMoveDeltas({ supplies: 50, morale: 5 }, 'ruins', 'ambush');
  assert(out.morale === 0, 'morale floor at 0');
}
{
  // Supplies don't exceed SUPPLIES_MAX (sanity — no helper grows them, but clamp guards future tuning)
  const out = applyMoveDeltas({ supplies: SUPPLIES_MAX, morale: 50 }, 'road', 'none');
  assert(out.supplies === SUPPLIES_MAX, 'road keeps supplies at max');
}
console.log('PASS: clamps');

// ── Starvation transition ───────────────────────────────────────────
{
  // 1 supply, plains step → supplies=0, morale -1 (no terrain delta) -10 (starvation) = -10... wait, plains has no morale delta
  // So morale 50 -> 50 + 0 - 10 = 40. starvationTriggered: true.
  const out = applyMoveDeltas({ supplies: 1, morale: 50 }, 'plains', 'none');
  assert(out.supplies === 0, 'starvation: supplies hit 0');
  assert(out.starvationTriggered === true, 'starvation transition flag set');
  assert(
    out.morale === 50 - STARVATION_MORALE_PENALTY,
    `starvation morale penalty applied: expected ${50 - STARVATION_MORALE_PENALTY}, got ${out.morale}`,
  );
}
console.log('PASS: starvation transition triggers penalty');

// ── Starvation one-shot ─────────────────────────────────────────────
{
  // Already at 0 — no extra penalty, no flag.
  const out = applyMoveDeltas({ supplies: 0, morale: 50 }, 'plains', 'none');
  assert(out.supplies === 0, 'starvation one-shot: supplies stay 0');
  assert(out.starvationTriggered === false, 'starvation one-shot: flag not re-set');
  assert(out.morale === 50, 'starvation one-shot: no extra morale penalty');
}
console.log('PASS: starvation does not re-fire at supplies=0');

// ── River costs more ────────────────────────────────────────────────
{
  const out = applyMoveDeltas({ supplies: 5, morale: 50 }, 'river', 'none');
  assert(out.supplies === 3, `river step: 5 - 2 = 3, got ${out.supplies}`);
}
console.log('PASS: river step costs 2 supplies');

console.log('\nAll campaign-balance checks passed');
