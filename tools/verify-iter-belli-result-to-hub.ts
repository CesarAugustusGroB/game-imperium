/**
 * Verifies Result → Hub: conquest data/helper (Task 1) + seed round-trip (Task 2).
 * Run: npx tsx tools/verify-iter-belli-result-to-hub.ts
 */
import {
  THEME_TERRAIN, themeToTerrain, CONQUEST_NAMES, pickConquestName, PROVINCE_REWARD,
} from '../src/data/iter-belli-conquest';
import { startIterBelliCampaign, resetIterBelli, iterBelliState } from '../src/game/iterBelli/iter-belli-state';

let failures = 0;
function check(label: string, cond: boolean): void {
  if (cond) console.log(`  ✓ ${label}`);
  else { console.error(`  ✗ ${label}`); failures++; }
}

// --- THEME_TERRAIN / themeToTerrain ---
check('woodland → forest', THEME_TERRAIN.woodland === 'forest');
check('highlands → mountains', THEME_TERRAIN.highlands === 'mountains');
check('marshland → marsh', THEME_TERRAIN.marshland === 'marsh');
check('coastal → coast', THEME_TERRAIN.coastal === 'coast');
check('mixed → plains', THEME_TERRAIN.mixed === 'plains');
check('themeToTerrain known', themeToTerrain('coastal') === 'coast');
check('themeToTerrain unknown → plains', themeToTerrain('zzz') === 'plains');
check('themeToTerrain undefined → plains', themeToTerrain(undefined) === 'plains');
check('themeToTerrain null → plains', themeToTerrain(null) === 'plains');

// --- pickConquestName ---
check('pool is non-empty', CONQUEST_NAMES.length > 0);
check('picks a pool name when none taken', CONQUEST_NAMES.includes(pickConquestName(new Set())));
const allButFirst = new Set(CONQUEST_NAMES.slice(1));
check('picks the only free name', pickConquestName(allButFirst) === CONQUEST_NAMES[0]);
const all = new Set(CONQUEST_NAMES);
const suffixed = pickConquestName(all);
check('all taken → unused suffixed name', !all.has(suffixed) && / (II|III|IV|V|VI|VII|VIII|IX|X)$/.test(suffixed));

// --- PROVINCE_REWARD (gold + iuniores only; deprecated resources omitted ⇒ 0 income) ---
check('reward gold > 0', (PROVINCE_REWARD.gold ?? 0) > 0);
check('reward iuniores > 0', (PROVINCE_REWARD.iuniores ?? 0) > 0);
check('reward has no faith', PROVINCE_REWARD.faith === undefined);
check('reward has no influence', PROVINCE_REWARD.influence === undefined);
check('reward has no momentum', PROVINCE_REWARD.momentum === undefined);

// --- Seed round-trip (filled in by Task 2) ---
startIterBelliCampaign({
  soldiers: 1000, gold: 0, iuniores: 0, discipline: 4, archetype: null,
  spokeTerrain: 'coast', spokeDuration: 3,
});
check('seed applies spokeTerrain', iterBelliState.value.spokeTerrain === 'coast');
check('seed applies spokeDuration', iterBelliState.value.spokeDuration === 3);
resetIterBelli();
check('reset restores spokeTerrain → plains', iterBelliState.value.spokeTerrain === 'plains');
check('reset restores spokeDuration → 1', iterBelliState.value.spokeDuration === 1);

if (failures > 0) { console.error(`\n${failures} check(s) failed`); process.exit(1); }
console.log('\nAll checks passed');
