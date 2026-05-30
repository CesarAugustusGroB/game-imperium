/**
 * Verifies Doctrinae Fase 1: per-color modifier factories, the bridge, and the
 * engine hooks (weight/costDelta/onPlay/onTurn).
 * Run: npx tsx tools/verify-iter-belli-doctrines.ts
 */
import { DOCTRINE_MODIFIERS, computeDoctrineModifiers } from '../src/data/iter-belli-doctrines';
import type { OperationCard, CardContext } from '../src/game/iterBelli/iter-belli-types';
import type { Doctrine } from '../src/game/items/doctrine';

let failures = 0;
function check(label: string, cond: boolean): void {
  if (cond) console.log(`  ✓ ${label}`);
  else { console.error(`  ✗ ${label}`); failures++; }
}

const coercion = { category: 'Coerción' } as OperationCard;
const logistica = { category: 'Logística' } as OperationCard;
const diplomacia = { category: 'Diplomacia' } as OperationCard;
const noCtx = {} as CardContext;

// --- Per-color modifier factories ---
check('red onPlay Coerción → enemyWeaken +t (t=2)', DOCTRINE_MODIFIERS.red(2).onPlay!(coercion, noCtx).enemyWeaken === 2);
check('red onPlay non-Coerción → no enemyWeaken', DOCTRINE_MODIFIERS.red(2).onPlay!(logistica, noCtx).enemyWeaken === undefined);
check('blue costDelta Diplomacia → gold -5t (t=3)', DOCTRINE_MODIFIERS.blue(3).costDelta!(diplomacia, noCtx).gold === -15);
check('blue onPlay Diplomacia → threat -t (t=2)', DOCTRINE_MODIFIERS.blue(2).onPlay!(diplomacia, noCtx).threat === -2);
check('blue costDelta non-Diplomacia → no gold', DOCTRINE_MODIFIERS.blue(2).costDelta!(logistica, noCtx).gold === undefined);
check('purple onPlay Logística → supplies +2t (t=2)', DOCTRINE_MODIFIERS.purple(2).onPlay!(logistica, noCtx).supplies === 4);
check('gold onTurn → morale +0.3t (t=3)', Math.abs((DOCTRINE_MODIFIERS.gold(3).onTurn!({} as never).morale ?? 0) - 0.9) < 1e-9);
check('white onTurn → supplies +t (t=2)', DOCTRINE_MODIFIERS.white(2).onTurn!({} as never).supplies === 2);

// --- Bridge ---
const mk = (color: string, level: 1 | 2 | 3): Doctrine => ({ color, currentLevel: level } as unknown as Doctrine);
check('empty slots → no modifiers', computeDoctrineModifiers([null, null, null, null]).length === 0);
const mods = computeDoctrineModifiers([mk('red', 1), null, mk('red', 2), mk('blue', 1)]);
check('one modifier per equipped doctrine', mods.length === 3);
check('stacking same color → two red modifiers', mods.filter((m) => m.label.includes('Marcial')).length === 2);
check('bridge red level scales (first red is t=1 → +1)', mods.find((m) => m.label.includes('Marcial'))!.onPlay!(coercion, noCtx).enemyWeaken === 1);

if (failures > 0) { console.error(`\n${failures} check(s) failed.`); process.exit(1); }
console.log('\nAll checks passed.');
