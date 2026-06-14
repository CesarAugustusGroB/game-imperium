/**
 * verify-effects.ts — the effect-contract guard (plan S-D, FASE 1 blindaje).
 *
 * All 9 tabulated effect-bearing unions (DoctrineEffect, DecretumEffect, the
 * province TradeGoodSpecial / FeatureSpecial / GovernorTrait / SynergyBonus,
 * LegateEffect, AdvisorPassive, and the campaign-event HubConsequence) are
 * consumed by switches with permissive
 * `default` branches (decretum-hub `default: return null`, battle/decreta
 * `default: return false`, the special checks just `if (… === 'x')`). That means
 * adding a NEW member to a union compiles fine and silently becomes INERT — the
 * exact "texto promete / código no aplica" gap the consolidation plan is closing
 * (e.g. the `enables-building` lie fixed in it.28).
 *
 * This script parses the union member literals straight from the type-source
 * and FAILS if any declared type is neither registered with an application site
 * nor explicitly marked `{ latent: true }`, if a registered site no longer
 * handles its type, if a registry entry is stale, or if the game data uses a
 * type outside the union. It also checks the economic clamp/refund invariants.
 *
 * Run: npx tsx tools/verify-effects.ts   (also runs under `npm run verify`)
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DOCTRINE_CATALOG } from '../src/data/doctrine-data';
import { STARTER_DECRETUM } from '../src/data/decretum-data';
import { TRADE_GOOD_DATA } from '../src/data/trade-goods';
import { ALL_FEATURES } from '../src/data/province-features';
import { ALL_GOVERNORS } from '../src/data/governor-data';
import { LEGATE_TRAITS } from '../src/game/army/legate-traits';
import { STARTER_ADVISORS } from '../src/data/advisor-data';
import {
  getShopDiscount, getUpkeepReduction, equippedDoctrines,
} from '../src/game/items/doctrine-store';
import type { Doctrine, DoctrineEffect } from '../src/game/items/doctrine';
import { applyInvestmentDiscount, getInvestmentDiscount, SYNERGY_DATA } from '../src/game/province/province';
import { getDiscountedGold } from '../src/game/progression/strategic-store';
import { ECONOMY } from '../src/config/game-config';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

let failures = 0;
function check(label: string, cond: boolean, detail = ''): void {
  if (cond) console.log(`  ✓ ${label}`);
  else { console.error(`  ✗ ${label}${detail ? ' — ' + detail : ''}`); failures++; }
}

// ──────────────────────────────────────────────────────────────────────────
// Parse the union member literals from the type source (single source of truth).
// ──────────────────────────────────────────────────────────────────────────
function readUnionTypes(relFile: string, alias: string): string[] {
  // Strip block/line comments first — a `;`, `{`, `}` or `type: '…'` inside a
  // JSDoc comment between union members would otherwise fool the brace scanner
  // and the type-literal regex.
  const text = readFileSync(join(repoRoot, relFile), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
  const start = text.indexOf(`export type ${alias} =`);
  if (start === -1) throw new Error(`union ${alias} not found in ${relFile}`);
  // The alias ends at the first ';' that sits at brace-depth 0 — inner ';'
  // belong to the object-literal members (`{ type: 'x'; percent: number }`).
  let depth = 0;
  let end = start;
  for (let i = text.indexOf('=', start) + 1; i < text.length; i++) {
    const ch = text[i];
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    else if (ch === ';' && depth === 0) { end = i; break; }
  }
  const block = text.slice(start, end);
  const types = [...block.matchAll(/\btype:\s*'([^']+)'/g)].map((m) => m[1]);
  return [...new Set(types)];
}

/** A type is "handled" in a file if it appears as `case 'X'` or `=== 'X'`. */
function fileHandles(relFile: string, type: string): boolean {
  const text = readFileSync(join(repoRoot, relFile), 'utf8');
  const re = new RegExp(`(case|===)\\s*'${type.replace(/[-]/g, '\\-')}'`);
  return re.test(text);
}

// ── Registries: every effect type → the module(s) that actually apply it ──
// Adding a union member without adding it here makes this script FAIL.
//
// An entry is either APPLIED (`files` = the module(s) that handle it) or LATENT
// (`latent: true` = intentionally inert data with no live consumer, documented
// with a reason). A new type that is neither applied nor explicitly marked latent
// fails the guard — catching silent "texto promete / código no aplica" gaps.
type AppEntry = { files: string[]; note: string } | { latent: true; note: string };

const DOCTRINE_APPLICATION: Record<string, AppEntry> = {
  'shop-discount':    { files: ['src/game/items/doctrine-store.ts'], note: 'getShopDiscount → discountedGold' },
  'income-modifier':  { files: ['src/game/items/doctrine-store.ts'], note: 'getIncomeModifier → province income' },
  'upkeep-reduction': { files: ['src/game/items/doctrine-store.ts'], note: 'getUpkeepReduction → province expenses' },
  'embark-bonus':     { files: ['src/game/items/doctrine-store.ts'], note: 'getEmbarkBonus → buildPlayerSeed at embark' },
};

const BATTLE = 'src/game/iterBelli/battle/decreta.ts';
const HUB = 'src/game/items/decretum-hub.ts';
const DECRETUM_APPLICATION: Record<string, AppEntry> = {
  'heal':                     { files: [BATTLE, HUB], note: 'battle heal + hub heal-army' },
  'damage':                   { files: [BATTLE], note: 'battle direct damage (+area splash)' },
  'buff':                     { files: [BATTLE], note: 'battle stat buff' },
  'debuff':                   { files: [BATTLE], note: 'battle stat debuff' },
  'resource-gain':            { files: [HUB], note: 'hub grant (gold/iuniores)' },
  'spawn':                    { files: [BATTLE, HUB], note: 'battle line reinforce + hub recruit' },
  'reveal':                   { files: [BATTLE], note: 'battle enemy-intent reveal' },
  'prevent-death':            { files: [BATTLE], note: 'battle salvation counter' },
  'event-modifier':           { files: [BATTLE], note: 'battle die advantage' },
  'upkeep-reduction':         { files: [HUB], note: 'hub waive-upkeep (continuous)' },
  'convert-enemy-next-battle':{ files: [BATTLE], note: 'battle convert (HP steal)' },
  'investment-discount':      { files: [HUB], note: 'hub applyExtraEffects → next-build discount' },
  'threat-reduction':         { files: [HUB], note: 'hub campaign-threat bribe' },
  'supplies-gain':            { files: [HUB], note: 'hub campaign-supplies grant' },
  'gain-ally':                { files: [HUB], note: 'hub forge alliance → addAlly (plan S-L)' },
};

// ──────────────────────────────────────────────────────────────────────────
// Generic contract checker for one effect union.
// ──────────────────────────────────────────────────────────────────────────
function checkUnion(
  label: string,
  typeFile: string,
  alias: string,
  registry: Record<string, AppEntry>,
  dataTypes: string[],
): void {
  const union = readUnionTypes(typeFile, alias);
  console.log(`\n${label} — ${union.length} declared effect types`);

  // 1. Every declared type is registered (applied OR explicitly latent).
  for (const t of union) {
    const entry = registry[t];
    check(`'${t}' is registered (applied or latent)`, !!entry,
      `add '${t}' to the registry in verify-effects.ts — wire it (files) or mark it { latent: true }`);
    // 2. Applied entries: the registered site must still handle the type.
    if (entry && 'files' in entry) {
      const handled = entry.files.some((f) => fileHandles(f, t));
      check(`'${t}' is handled in ${entry.files.map((f) => f.split('/').pop()).join(' | ')}`,
        handled, `no \`case '${t}'\`/\`=== '${t}'\` found — ${entry.note}`);
    } else if (entry) {
      console.log(`  · '${t}' is latent (not applied): ${entry.note}`);
    }
  }

  // 3. No stale registry entry pointing at a removed union member.
  for (const t of Object.keys(registry)) {
    check(`registry entry '${t}' still exists in the ${alias} union`, union.includes(t),
      `'${t}' was removed from the union — drop it from the registry`);
  }

  // 4. The game data only uses declared types (catches `as`-casted typos).
  const unknown = [...new Set(dataTypes)].filter((t) => !union.includes(t));
  check(`game data uses only declared ${alias} types`, unknown.length === 0,
    `unknown types in data: ${unknown.join(', ')}`);
}

// Collect effect types actually used in the catalogs.
const doctrineDataTypes = DOCTRINE_CATALOG.flatMap((d) => d.levels.flatMap((l) => l.effects)).map((e) => e.type);
const decretumDataTypes = STARTER_DECRETUM.flatMap((d) => [d.effect, ...(d.extraEffects ?? [])]).map((e) => e.type);

checkUnion('DoctrineEffect', 'src/game/items/doctrine.ts', 'DoctrineEffect', DOCTRINE_APPLICATION, doctrineDataTypes);
checkUnion('DecretumEffect', 'src/game/items/decretum.ts', 'DecretumEffect', DECRETUM_APPLICATION, decretumDataTypes);

// ── Province specials: trade-good and unique-feature `special` unions (plan D20) ──
const PROVINCE = 'src/game/province/province.ts';
const TRADE_GOOD_APPLICATION: Record<string, AppEntry> = {
  'build-cost-discount': { files: [PROVINCE], note: 'getInvestmentDiscount → build cost' },
  'unrest-reduction':    { files: [PROVINCE], note: 'getUnrestModifier → unrest' },
  'enables-building':    { files: [PROVINCE], note: 'getAvailableBuildings → unlocks the building (it.28)' },
};
const FEATURE_APPLICATION: Record<string, AppEntry> = {
  'famine-immunity':    { files: [PROVINCE], note: 'famine timer kept at 0' },
  'extra-event-choice': { latent: true, note: 'inert — needs the (dead) event system D10; not shown in UI' },
  'cavalry-bonus':      { latent: true, note: 'inert — no cavalry system; not shown in UI' },
  'unit-discount':      { latent: true, note: 'inert — no feature-driven recruit discount; not shown in UI' },
};

const tradeGoodSpecialTypes = Object.values(TRADE_GOOD_DATA).map((g) => g.special?.type).filter(Boolean) as string[];
const featureSpecialTypes = ALL_FEATURES.map((f) => f.special?.type).filter(Boolean) as string[];

checkUnion('TradeGoodSpecial', 'src/data/trade-goods.ts', 'TradeGoodSpecial', TRADE_GOOD_APPLICATION, tradeGoodSpecialTypes);
checkUnion('FeatureSpecial', 'src/data/province-features.ts', 'FeatureSpecial', FEATURE_APPLICATION, featureSpecialTypes);

// ── Governor traits (all applied in province income/unrest/expense/food logic) ──
const GOVERNOR_APPLICATION: Record<string, AppEntry> = {
  'income-bonus':        { files: [PROVINCE], note: 'province income (calculateProvinceIncome)' },
  'expense-reduction':   { files: [PROVINCE], note: 'getProvinceExpenses' },
  'unrest-reduction':    { files: [PROVINCE], note: 'getUnrestModifier (flat)' },
  'population-growth':    { files: [PROVINCE], note: 'calculateFoodProduction' },
  'investment-discount': { files: [PROVINCE], note: 'getInvestmentDiscount' },
  'garrison-strength':   { files: [PROVINCE], note: 'getUnrestModifier (multiplies Castrum unrest cut)' },
};
const governorTraitTypes = ALL_GOVERNORS.flatMap((g) => g.tiers.flatMap((t) => t.traits)).map((tr) => tr.type);
checkUnion('GovernorTrait', 'src/game/province/governor.ts', 'GovernorTrait', GOVERNOR_APPLICATION, governorTraitTypes);

// ── Legate trait effects (applied in legateSeedMods / adapter.ts) ──
const ADAPTER = 'src/game/iterBelli/battle/adapter.ts';
const LEGATE_APPLICATION: Record<string, AppEntry> = {
  'stat-bonus':       { files: [ADAPTER], note: 'legateSeedMods → per-role stat / hp scaling' },
  'random-rally':     { files: [ADAPTER], note: 'legateSeedMods → strongest-cohort buff' },
  'morale-bonus':     { files: [ADAPTER], note: 'legateSeedMods → pre-battle morale' },
  'lieutenant-preset':{ latent: true, note: 'inert — no lieutenant-order system (deprecated node-map); formation gating is keyed by trait id, not this effect' },
};
const legateEffectTypes = LEGATE_TRAITS.map((t) => t.effect.type);
checkUnion('LegateEffect', 'src/game/army/legate.ts', 'LegateEffect', LEGATE_APPLICATION, legateEffectTypes);

// ── Building-synergy bonuses (applied across province income/unrest/food/PWG/recruit) ──
const STORE = 'src/game/province/province-store.ts';
const SYNERGY_APPLICATION: Record<string, AppEntry> = {
  'pwg':                { files: [PROVINCE], note: 'PWG/wealth growth' },
  'food':               { files: [PROVINCE], note: 'calculateFoodProduction' },
  'gold':               { files: [PROVINCE], note: 'building gold income' },
  'unrest':             { files: [PROVINCE], note: 'getUnrestModifier' },
  'unit-cost-discount': { files: [STORE], note: 'cohort recruit gold discount' },
};
const synergyBonusTypes = SYNERGY_DATA.map((s) => s.bonus.type);
checkUnion('SynergyBonus', 'src/game/province/province.ts', 'SynergyBonus', SYNERGY_APPLICATION, synergyBonusTypes);

// ── Advisor passives — the passiveModifier switch has a permissive `default`,
//    so a new type would silently become inert (the exact gap this guards). ──
const CONSILIUM = 'src/data/iter-belli-consilium.ts';   // passiveModifier → campaign seed deltas
const COUNCIL = 'src/game/council/council-store.ts';    // live hub aggregation (shop-discount)
const ADVISOR_APPLICATION: Record<string, AppEntry> = {
  'resource-per-spoke':  { files: [CONSILIUM], note: 'passiveModifier → seed gold' },
  'upkeep-reduction':    { files: [CONSILIUM], note: 'passiveModifier → seed supplies' },
  'shop-discount':       { files: [COUNCIL], note: 'seated shop-discount → hub discount (passiveModifier default by design)' },
  'extra-event-choices': { files: [CONSILIUM], note: 'passiveModifier → seed gold (no event system)' },
  'heal-between-nodes':  { files: [CONSILIUM], note: 'passiveModifier → seed morale' },
  'threat-reduction':    { files: [CONSILIUM], note: 'passiveModifier → seed threat' },
  'loot-bonus':          { files: [CONSILIUM], note: 'passiveModifier → seed gold (+ council-store loot bonus)' },
  'enemy-weaken':        { files: [CONSILIUM], note: 'passiveModifier → seed enemyWeaken' },
  'campaign-time':       { files: [CONSILIUM], note: 'passiveModifier → seed extraDays' },
  'morale-bonus':        { files: [CONSILIUM], note: 'passiveModifier → seed morale' },
  'soldiers-bonus':      { files: [CONSILIUM], note: 'passiveModifier → seed soldiers' },
};
const advisorPassiveTypes = STARTER_ADVISORS.flatMap((a) => a.tiers.map((t) => t.passive.type));
checkUnion('AdvisorPassive', 'src/game/council/advisor.ts', 'AdvisorPassive', ADVISOR_APPLICATION, advisorPassiveTypes);

// ── Campaign-event hub write-back (the 9th union; plan D10, 2026-06-14) ──
// Latent until applyCampaignEventOutcomes (D10 step 6) wires the live site; the
// catalog (campaign-events.ts, step 3) is what will populate hubConsequenceDataTypes.
const HUB_CONSEQUENCE_APPLICATION: Record<string, AppEntry> = {
  'province-unrest': { latent: true, note: 'inert until applyCampaignEventOutcomes lands (D10 step 6) → province.unrest' },
  'advisor-xp':      { latent: true, note: 'inert until applyCampaignEventOutcomes lands (D10 step 6) → advisor.xp' },
  'resource':        { latent: true, note: 'inert until applyCampaignEventOutcomes lands (D10 step 6) → hub gold/iuniores' },
};
const hubConsequenceDataTypes: string[] = []; // catalog arrives in D10 step 3
checkUnion('HubConsequence', 'src/game/events/campaign-events-types.ts', 'HubConsequence', HUB_CONSEQUENCE_APPLICATION, hubConsequenceDataTypes);

// ──────────────────────────────────────────────────────────────────────────
// Economic invariants — refund ≤ paid, discounts clamped, never free.
// ──────────────────────────────────────────────────────────────────────────
console.log('\nEconomic invariants');

const mkDoctrine = (effects: DoctrineEffect[]): Doctrine =>
  ({ id: 'd', name: 'D', color: 'white', currentLevel: 1,
     levels: [{ description: '', effects, upgradeCost: {} }, { description: '', effects, upgradeCost: {} }, { description: '', effects, upgradeCost: {} }] } as unknown as Doctrine);

// shop-discount clamp (4×50 = 200 → must clamp to 75)
equippedDoctrines.value = [
  mkDoctrine([{ type: 'shop-discount', percent: 50 }]),
  mkDoctrine([{ type: 'shop-discount', percent: 50 }]),
  mkDoctrine([{ type: 'shop-discount', percent: 50 }]),
  mkDoctrine([{ type: 'shop-discount', percent: 50 }]),
];
check('getShopDiscount clamps stacked discounts to ≤75', getShopDiscount() <= 75);
// discounted gold never goes below 1 and never above base
check('getDiscountedGold(100) stays in [1, 100] even at max discount',
  getDiscountedGold(100) >= 1 && getDiscountedGold(100) <= 100);
check('getDiscountedGold(1) never reaches 0 (purchases are never free)', getDiscountedGold(1) >= 1);

// upkeep-reduction clamp
equippedDoctrines.value = [
  mkDoctrine([{ type: 'upkeep-reduction', percent: 60 }]),
  mkDoctrine([{ type: 'upkeep-reduction', percent: 60 }]),
  null, null,
];
check('getUpkeepReduction clamps stacked reductions to ≤75', getUpkeepReduction() <= 75);
equippedDoctrines.value = [null, null, null, null];

// applyInvestmentDiscount: refund ≤ paid AND never below 1 per resource
const cost = { gold: 20, iuniores: 10 };
const discounted = applyInvestmentDiscount(cost, 90);
check('applyInvestmentDiscount: every resource ≤ original (refund ≤ paid)',
  (Object.entries(discounted) as [string, number][]).every(([r, v]) => v <= (cost as Record<string, number>)[r]));
check('applyInvestmentDiscount: every resource ≥ 1 (never free even at 90%)',
  (Object.values(discounted) as number[]).every((v) => v >= 1));
check('applyInvestmentDiscount: 0% discount returns the cost unchanged',
  JSON.stringify(applyInvestmentDiscount(cost, 0)) === JSON.stringify(cost));

// ECONOMY.maxInvestmentDiscount is a sane ceiling, and the floor protects refund.
check('ECONOMY.maxInvestmentDiscount is within (0, 100)',
  ECONOMY.maxInvestmentDiscount > 0 && ECONOMY.maxInvestmentDiscount < 100);
check('even at maxInvestmentDiscount a build still costs ≥1 per resource',
  (Object.values(applyInvestmentDiscount(cost, ECONOMY.maxInvestmentDiscount)) as number[]).every((v) => v >= 1));

// getInvestmentDiscount with no traits/province is 0 (no phantom discount)
check('getInvestmentDiscount([]) is 0 with no traits or province', getInvestmentDiscount([]) === 0);

// ──────────────────────────────────────────────────────────────────────────
if (failures > 0) { console.error(`\n${failures} check(s) failed.`); process.exit(1); }
console.log('\nAll effect-contract and economic-invariant checks passed.');
