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

// ── Morale deltas (terrain only — events live in encounter-bridge) ──
assert(getMoraleDelta('camp') === 5, 'camp = +5');
assert(getMoraleDelta('ruins') === -2, 'ruins = -2');
assert(getMoraleDelta('mountains') === -3, 'mountains = -3');
assert(getMoraleDelta('road') === 1, 'road = +1');
assert(getMoraleDelta('plains') === 0, 'plains = 0');
assert(getMoraleDelta('forest') === 0, 'forest = 0');
assert(getMoraleDelta('hills') === 0, 'hills = 0');
assert(getMoraleDelta('river') === 0, 'river = 0');
console.log('PASS: terrain morale deltas (event deltas owned by encounter-bridge)');

// ── Clamps ──────────────────────────────────────────────────────────
{
  // Supplies floor at 0
  const out = applyMoveDeltas({ supplies: 0, morale: 50 }, 'plains');
  assert(out.supplies === 0, 'supplies floor at 0');
}
{
  // Morale ceiling at MORALE_MAX (camp +5 from 100 stays at 100)
  const out = applyMoveDeltas({ supplies: 50, morale: MORALE_MAX }, 'camp');
  assert(out.morale === MORALE_MAX, 'morale ceiling at MORALE_MAX');
}
{
  // Morale floor at 0 — mountains -3 from 1 plus starvation -10 → 0
  const out = applyMoveDeltas({ supplies: 1, morale: 1 }, 'mountains');
  assert(out.morale === 0, 'morale floor at 0');
}
{
  // Supplies don't exceed SUPPLIES_MAX (sanity — no helper grows them, but clamp guards future tuning)
  const out = applyMoveDeltas({ supplies: SUPPLIES_MAX, morale: 50 }, 'road');
  assert(out.supplies === SUPPLIES_MAX, 'road keeps supplies at max');
}
console.log('PASS: clamps');

// ── Starvation transition ───────────────────────────────────────────
{
  // 1 supply, plains step → supplies=0, morale 50 + 0 (plains) - 10 (starvation) = 40.
  const out = applyMoveDeltas({ supplies: 1, morale: 50 }, 'plains');
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
  const out = applyMoveDeltas({ supplies: 0, morale: 50 }, 'plains');
  assert(out.supplies === 0, 'starvation one-shot: supplies stay 0');
  assert(out.starvationTriggered === false, 'starvation one-shot: flag not re-set');
  assert(out.morale === 50, 'starvation one-shot: no extra morale penalty');
}
console.log('PASS: starvation does not re-fire at supplies=0');

// ── River costs more ────────────────────────────────────────────────
{
  const out = applyMoveDeltas({ supplies: 5, morale: 50 }, 'river');
  assert(out.supplies === 3, `river step: 5 - 2 = 3, got ${out.supplies}`);
}
console.log('PASS: river step costs 2 supplies');

// ── Camp tile boosts morale on entry ────────────────────────────────
{
  const out = applyMoveDeltas({ supplies: 50, morale: 60 }, 'camp');
  assert(out.morale === 65, `camp +5 morale: expected 65, got ${out.morale}`);
}
console.log('PASS: camp tile boosts morale on entry');

console.log('\nAll campaign-balance checks passed');
