/**
 * Verifies Doctrinae Fase 1: per-color modifier factories, the bridge, and the
 * engine hooks (weight/costDelta/onPlay/onTurn).
 * Run: npx tsx tools/verify-iter-belli-doctrines.ts
 */
import { DOCTRINE_MODIFIERS, computeDoctrineModifiers } from '../src/data/iter-belli-doctrines';
import type { OperationCard, CardContext } from '../src/game/iterBelli/iter-belli-types';
import type { Doctrine } from '../src/game/items/doctrine';
import { startIterBelliCampaign, resetIterBelli, iterBelliState, playCard, camp } from '../src/game/iterBelli/iter-belli-state';
import type { DoctrineCampaignModifier, SecondaryQuest } from '../src/game/iterBelli/iter-belli-types';

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

// --- Seed round-trip ---
const seedBase = { soldiers: 4000, gold: 100, iuniores: 0, discipline: 4, archetype: null, spokeTerrain: 'plains', spokeDuration: 1 };
const synthMod: DoctrineCampaignModifier = { id: 'synth', label: 'Synth' };
startIterBelliCampaign({ ...seedBase, doctrineModifiers: [synthMod] });
check('seed stores doctrineModifiers', iterBelliState.value.doctrineModifiers.length === 1);
startIterBelliCampaign({ ...seedBase });
check('omitted doctrineModifiers → empty', iterBelliState.value.doctrineModifiers.length === 0);
resetIterBelli();
check('reset clears doctrineModifiers', iterBelliState.value.doctrineModifiers.length === 0);

// --- onPlay + costDelta plumbing (deterministic via a seeded quest card) ---
// The quest card "Asalto al fuerte" is category 'Operaciones', effects { gold:35, enemyWeaken:1 }, cost { time:1, supplies:4 }.
const fronteraQuest: SecondaryQuest = { id: 'dq', color: 'red', title: 'Asalto al fuerte', locationId: 'frontera', window: 5, status: 'pending' };
const synthPlay: DoctrineCampaignModifier = {
  id: 'synthPlay', label: 'SynthPlay',
  onPlay: (card) => (card.category === 'Operaciones' ? { gold: 10 } : {}),
  costDelta: (card) => (card.category === 'Operaciones' ? { supplies: -2 } : {}),
};
startIterBelliCampaign({ ...seedBase, gold: 100, quests: [fronteraQuest], doctrineModifiers: [synthPlay] });
let s = iterBelliState.value;
const qc = s.pool.find((c) => c.def.questId === 'dq');
check('quest card present in pool', !!qc);
const goldBefore = s.gold;
const supBefore = s.supplies;
const weakBefore = s.enemyWeaken;
playCard(qc!.instanceId);
s = iterBelliState.value;
check('onPlay bonus applied (gold +45 = 35 reward + 10 doctrine)', s.gold === goldBefore + 45);
check('base quest reward intact (enemyWeaken +1)', s.enemyWeaken === weakBefore + 1);
check('costDelta discount applied (supplies -4: cost 2 + upkeep 2, not 6)', s.supplies === supBefore - 4);

// --- onTurn plumbing ---
const synthTurn: DoctrineCampaignModifier = { id: 'synthTurn', label: 'SynthTurn', onTurn: () => ({ supplies: 10 }) };
startIterBelliCampaign({ ...seedBase, doctrineModifiers: [synthTurn] });
let t = iterBelliState.value;
const supB = t.supplies;
camp(); // camp -4 supplies, endTurn upkeep -2, doctrine onTurn +10 → net +4
t = iterBelliState.value;
check('onTurn passive applied each turn (supplies net +4)', t.supplies === supB + 4);

// --- non-matching category untouched ---
const synthGate: DoctrineCampaignModifier = {
  id: 'synthGate', label: 'SynthGate',
  onPlay: (card) => (card.category === 'Coerción' ? { gold: 999 } : {}),
};
startIterBelliCampaign({ ...seedBase, gold: 100, quests: [{ ...fronteraQuest, id: 'dq2' }], doctrineModifiers: [synthGate] });
let g = iterBelliState.value;
const qc2 = g.pool.find((c) => c.def.questId === 'dq2');
const goldB2 = g.gold;
playCard(qc2!.instanceId);
g = iterBelliState.value;
check('category-gated onPlay does not fire on non-matching card (gold +35 only)', g.gold === goldB2 + 35);

resetIterBelli();

if (failures > 0) { console.error(`\n${failures} check(s) failed.`); process.exit(1); }
console.log('\nAll checks passed.');
