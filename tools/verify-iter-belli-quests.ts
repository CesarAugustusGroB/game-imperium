/**
 * Verifies Consilium Fase 2 secondary quests: data defs, card factory, bridge,
 * and campaign-state integration.
 * Run: npx tsx tools/verify-iter-belli-quests.ts
 */
import { SECONDARY_QUESTS, makeQuestCard } from '../src/data/iter-belli-quests';
import type { SecondaryQuest, CardContext } from '../src/game/iterBelli/iter-belli-types';
import { computeSecondaryQuests } from '../src/data/iter-belli-consilium';
import type { Advisor } from '../src/game/council/advisor';
import { startIterBelliCampaign, resetIterBelli, iterBelliState, camp, playCard } from '../src/game/iterBelli/iter-belli-state';

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

// --- Campaign-state injection (quest bound to the START location 'frontera') ---
const seedBase = { soldiers: 4000, gold: 100, iuniores: 0, discipline: 4, archetype: null, spokeTerrain: 'plains', spokeDuration: 1 };
const fronteraQuest: SecondaryQuest = { id: 'quest_red_x', color: 'red', title: 'Asalto al fuerte', locationId: 'frontera', window: 2, status: 'pending' };

startIterBelliCampaign({ ...seedBase, quests: [fronteraQuest] });
let st = iterBelliState.value;
check('seed stores quests', st.quests.length === 1);
check('quest injected at start location → active', st.quests[0].status === 'active');
check('quest card present in pool', st.pool.filter((c) => c.def.questId === 'quest_red_x').length === 1);

// Idempotent: camping at frontera must not re-inject the (now active) quest.
camp();
st = iterBelliState.value;
check('quest card not duplicated after a turn', st.pool.filter((c) => c.def.questId === 'quest_red_x').length === 1);

// A quest bound to a not-yet-reached location stays pending and is not in the pool.
startIterBelliCampaign({ ...seedBase, quests: [{ ...fronteraQuest, id: 'quest_red_y', locationId: 'bosques' }] });
st = iterBelliState.value;
check('quest for far location stays pending', st.quests[0].status === 'pending');
check('quest for far location not in pool', st.pool.every((c) => c.def.questId !== 'quest_red_y'));

resetIterBelli();
check('reset clears quests', iterBelliState.value.quests.length === 0);

// --- Completion on play (red quest at frontera: reward +35 gold, +1 enemyWeaken) ---
startIterBelliCampaign({ ...seedBase, gold: 100, quests: [{ id: 'quest_red_p', color: 'red', title: 'Asalto al fuerte', locationId: 'frontera', window: 3, status: 'pending' }] });
let ps = iterBelliState.value;
const questCard = ps.pool.find((c) => c.def.questId === 'quest_red_p');
check('quest card available to play', !!questCard);
const goldBefore = ps.gold;
const weakenBefore = ps.enemyWeaken;
playCard(questCard!.instanceId);
ps = iterBelliState.value;
check('playing quest card → completed', ps.quests[0].status === 'completed');
check('reward applied: gold +35', ps.gold === goldBefore + 35);
check('reward applied: enemyWeaken +1', ps.enemyWeaken === weakenBefore + 1);
check('quest card removed from pool after play', ps.pool.every((c) => c.def.questId !== 'quest_red_p'));

// --- Failure on expiry (window 2 → fails after 2 camps; themed penalty +2 threat) ---
startIterBelliCampaign({ ...seedBase, quests: [{ id: 'quest_red_f', color: 'red', title: 'Asalto al fuerte', locationId: 'frontera', window: 2, status: 'pending' }] });
let fs = iterBelliState.value;
const threatBefore = fs.threat;
const brokenBefore = fs.brokenCommitments;
camp(); // window 2 → 1
camp(); // window 1 → 0 → expires this turn
fs = iterBelliState.value;
check('expired quest card → failed', fs.quests[0].status === 'failed');
check('themed penalty applied: threat +2', fs.threat === threatBefore + 2);
check('quest failure does NOT bump brokenCommitments', fs.brokenCommitments === brokenBefore);
check('expired quest card removed from pool', fs.pool.every((c) => c.def.questId !== 'quest_red_f'));

resetIterBelli();

if (failures > 0) { console.error(`\n${failures} check(s) failed.`); process.exit(1); }
console.log('\nAll checks passed.');
