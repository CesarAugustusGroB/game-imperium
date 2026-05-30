/**
 * Verifies Consilium Fase 2 secondary quests: data defs, card factory, bridge,
 * and campaign-state integration.
 * Run: npx tsx tools/verify-iter-belli-quests.ts
 */
import { SECONDARY_QUESTS, makeQuestCard } from '../src/data/iter-belli-quests';
import type { SecondaryQuest, CardContext } from '../src/game/iterBelli/iter-belli-types';
import { computeSecondaryQuests } from '../src/data/iter-belli-consilium';
import type { Advisor } from '../src/game/council/advisor';

let failures = 0;
function check(label: string, cond: boolean): void {
  if (cond) console.log(`  ✓ ${label}`);
  else { console.error(`  ✗ ${label}`); failures++; }
}

const noCtx = {} as CardContext;

// --- SECONDARY_QUESTS defs ---
check('5 quest colors', Object.keys(SECONDARY_QUESTS).length === 5);
check('red is "Asalto al fuerte"', SECONDARY_QUESTS.red.title === 'Asalto al fuerte');
check('white reward soldiers +800', SECONDARY_QUESTS.white.effects(noCtx).soldiers === 800);
check('blue reward threat -3', SECONDARY_QUESTS.blue.effects(noCtx).threat === -3);
check('red penalty threat +2', SECONDARY_QUESTS.red.penalty(noCtx).effects?.threat === 2);
check('purple penalty morale -1 & threat +1',
  SECONDARY_QUESTS.purple.penalty(noCtx).effects?.morale === -1 &&
  SECONDARY_QUESTS.purple.penalty(noCtx).effects?.threat === 1);

// --- makeQuestCard ---
const q: SecondaryQuest = { id: 'quest_red_1', color: 'red', title: 'Asalto al fuerte', locationId: 'llanura', window: 4, status: 'pending' };
const card = makeQuestCard(q);
check('card carries questId', card.questId === 'quest_red_1');
check('card location = quest location', card.locations.length === 1 && card.locations[0] === 'llanura');
check('card expiry = window', card.expiry === 4);
check('card weight 0 (never drawn)', card.weight === 0);
check('card name = quest title', card.name === 'Asalto al fuerte');
check('card effects = quest reward', card.effects(noCtx).gold === 35 && card.effects(noCtx).enemyWeaken === 1);

// --- computeSecondaryQuests bridge ---
const mkA = (color: string, tier: 1 | 2 | 3): Advisor =>
  ({ color, currentTier: tier, tiers: [{}, {}, {}] } as unknown as Advisor);

const MID = ['tarraco', 'llanura', 'bosques'];

const emptyQ = computeSecondaryQuests([null, null, null]);
check('no seats → no quests', emptyQ.length === 0);

// First occupied seat is the mission seat (no quest); the rest seed quests.
const qs = computeSecondaryQuests([mkA('red', 1), mkA('blue', 2), mkA('white', 3)]);
check('first seat = mission, 2 quests seeded', qs.length === 2);
check('quest colors are the non-first seats', qs[0].color === 'blue' && qs[1].color === 'white');
check('window by tier (blue tier2 → 4)', qs.find((q) => q.color === 'blue')?.window === 4);
check('window by tier (white tier3 → 5)', qs.find((q) => q.color === 'white')?.window === 5);
check('quest locations are mid-3', qs.every((q) => MID.includes(q.locationId)));
check('quest locations distinct', new Set(qs.map((q) => q.locationId)).size === qs.length);
check('quest ids distinct', new Set(qs.map((q) => q.id)).size === qs.length);
check('quests start pending', qs.every((q) => q.status === 'pending'));

// Gaps: a null first slot is skipped; the first NON-null seat is the mission seat.
const qs2 = computeSecondaryQuests([null, mkA('gold', 1), mkA('purple', 1)]);
check('null-first skipped, gold = mission, purple = quest', qs2.length === 1 && qs2[0].color === 'purple');

if (failures > 0) { console.error(`\n${failures} check(s) failed.`); process.exit(1); }
console.log('\nAll checks passed.');
