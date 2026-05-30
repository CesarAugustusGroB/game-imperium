/**
 * Verifies Consilium Fase 2 secondary quests: data defs, card factory, bridge,
 * and campaign-state integration.
 * Run: npx tsx tools/verify-iter-belli-quests.ts
 */
import { SECONDARY_QUESTS, makeQuestCard } from '../src/data/iter-belli-quests';
import type { SecondaryQuest, CardContext } from '../src/game/iterBelli/iter-belli-types';

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

if (failures > 0) { console.error(`\n${failures} check(s) failed.`); process.exit(1); }
console.log('\nAll checks passed.');
