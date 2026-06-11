import type { OrderDef, OrderKey, FormationDef, FormationKey, CenterDef, EnemyArchetype } from './types';
import { ARMORS } from './balance';

export const ORDERS: Record<OrderKey, OrderDef> = {
  advance:    { name:'Advance', sub:'push', stat:'push', mult:0.55, disc:2, push:22,
                desc:'Steady push. Gains ground toward the center; low, safe damage.' },
  holdLine:   { name:'Hold the Line', sub:'push', stat:'push', mult:0.30, disc:2, push:14, defensive:true, protect:0.38,
                desc:'Defensive brace. Halts the enemy charge and protects your morale.' },
  charge:     { name:'Charge', sub:'charge', stat:'charge', mult:1.05, disc:2, eMorale:1,
                desc:'Impact + recoil. Big burst but you take a return blow; breaks morale.' },
  skirmish:   { name:'Skirmish', sub:'harass', stat:'harass', mult:0.85, disc:2, ammo:9, eMorale:0.4,
                desc:'Safe ranged damage. Costs ammo, blunted by armor, does not push the center.' },
  siege:      { name:'Siege Assault', sub:'siege', stat:'siege', mult:1.45, disc:4, pierce:true, eMorale:0.7,
                desc:'Pierces armor and fortification. The answer to an armored/entrenched foe.' },
  envelop:    { name:'Envelopment', sub:'move', stat:'movement', mult:1.1, disc:6, check:12, eMorale:1.0, effect:'encircle',
                desc:'Check (die+movement ≥ 12). Success: encircles the enemy (~2 rounds) + high damage.' },
  flank:      { name:'Flank', sub:'move', stat:'movement', mult:0.7, disc:5, check:9, effect:'flank',
                desc:'Check (die+movement ≥ 9). Crit (×2.5) if the enemy holds the center.' },
  drums:      { name:'War Drums', sub:'moral', disc:3, sMorale:1.6, drums:true,
                desc:'Raises your morale steadily (scales with discipline), no damage.' },
  // No mult/stat: with a mult set, the resolver's pure-moral branch is skipped
  // and the order resolves silently (the 0.05 damage path never existed).
  taunt:      { name:'Taunt', sub:'moral', disc:3, eMorale:1.0,
                desc:'Hits enemy morale directly, no physical damage.' },
  rally:      { name:'Rally', sub:'moral', disc:2, sMorale:2.6,
                desc:'Recovers strong morale; you forgo the offensive round.' },
  warCry:     { name:'War Cry', sub:'push', stat:'push', mult:0.35, disc:3, push:16, eMorale:0.85, sMorale:0.5,
                desc:'Push with a roar. Gains some ground and hits enemy morale.' },
  fireMissiles:{ name:'Fire Missiles', sub:'harass', stat:'harass', mult:0.8, disc:4, ammo:14, eMorale:1.4,
                desc:'Incendiary volleys. Safe damage + terror. Burns more ammo.' },
  hitRun:     { name:'Hit and Run', sub:'move', stat:'movement', mult:0.65, disc:4, check:9, effect:'hitrun', eMorale:0.5,
                desc:'Check. Strike and withdraw: damage and you avoid nearly all incoming damage. Cedes center.' },
  wedge:      { name:'Wedge (Caput Porci)', sub:'charge', stat:'charge', mult:1.35, disc:5, eMorale:1.5, pierceBrace:true, breakCenter:true, wedge:true,
                desc:'Pierces the shield wall (ignores the brace) and, on a hit, seizes the center.' },
  allOut:     { name:'All-Out Charge', sub:'charge', stat:'charge', mult:2.2, disc:6, eMorale:2.5, sMorale:-3, reckless:true, allIn:true,
                desc:'The total gamble. Devastating impact and shock; if braced or you roll low, the recoil wrecks you.' },
  lineRelief: { name:'Line Relief', sub:'moral', disc:6, sMorale:1.5, refresh:true,
                desc:'Fresh troops to the front: +morale and you take less damage this round.' },
  retreat:    { name:'Retreat', sub:'move', stat:'movement', disc:1, check:11, effect:'retreat',
                desc:'Movement check (+6 if encircled). Break off: a fast army escapes; slow/ringed ones get caught.' },
};

export const FORMATIONS: Record<FormationKey, FormationDef> = {
  battleLine: { name:'Battle Line', kind:'common', disc:2, trait:null,
    desc:'Balanced. The reliable default.', orders:['advance','charge','skirmish','holdLine','rally'] },
  openOrder:  { name:'Open Order', kind:'common', disc:2, trait:null,
    desc:'Light, mobile skirmish. Cedes the center.', orders:['skirmish','fireMissiles','hitRun','flank','charge','rally'] },
  shieldWall: { name:'Shield Wall', kind:'common', disc:3, trait:null,
    desc:'Defensive and morale-driven.', orders:['holdLine','warCry','drums','taunt','advance','rally'] },
  duplex:     { name:'Acies Duplex', kind:'common', disc:4, trait:null,
    desc:'Two-line drill. A disciplined all-rounder bridging the gap to the elite formations.',
    orders:['advance','charge','holdLine','warCry','skirmish','rally'] },
  triplex:    { name:'Triplex Acies', kind:'unique', disc:6, trait:'Roman Veteran',
    desc:'The full manipular machine.', orders:['advance','charge','holdLine','lineRelief','envelop','rally'] },
  testudo:    { name:'Testudo', kind:'unique', disc:5, trait:'Engineer', antiMissile:true,
    desc:'Tortoise fortress. Immune to skirmishing.', orders:['holdLine','advance','siege','rally'] },
  cuneus:     { name:'Cuneus (Wedge)', kind:'unique', disc:5, trait:'Shock',
    desc:'Heavy shock breakthrough.', orders:['charge','wedge','allOut','flank','advance','rally'] },
};

export const CENTERS: Record<string, CenterDef> = {
  hill:   { name:'Hill', terrain:'hills', desc:'+15% damage to whoever holds it', dmg:0.15 },
  ford:   { name:'River Ford', terrain:'river', desc:'−25% enemy charge', enemyChargePenalty:0.25 },
  camp:   { name:'Camp', terrain:'settlement', desc:'+0.8 morale/round to the holder', moraleRegen:0.8 },
  plain:  { name:'Open Plain', terrain:'plains', desc:'+25% charge to the holder', chargeBonus:0.25 },
  forest: { name:'Dense Woods', terrain:'forest', desc:'−25% charge impact for both sides — broken ground favours the steady line', chargeDamp:0.25 },
  marsh:  { name:'Boggy Ground', terrain:'marsh', desc:'−20% charge impact for both sides; +0.4 morale/round to the holder dug in', chargeDamp:0.20, moraleRegen:0.4 },
};
export const TERRAIN_CENTER: Record<string, string> = {
  plains:'plain', hills:'hill', river:'ford', settlement:'camp', forest:'forest', marsh:'marsh',
};

export const ENEMY_ARCHETYPES: Record<string, EnemyArchetype> = {
  carthage:  { name:'Carthaginian Host', formation:'battleLine', hp:10000, morale:10, disc:6,
    stats:{charge:11,harass:9,push:13,siege:5,movement:11}, armorPct:ARMORS.iron, armorName:'Iron', ammo:26, fortPct:15, fortName:'Camp',
    desc:'Hannibal’s combined-arms host — disciplined, mobile, well-supplied, dug in.' },
  gauls:     { name:'Gallic Warband', formation:'openOrder', hp:11000, morale:10, disc:3,
    stats:{charge:20,harass:4,push:8,siege:2,movement:9}, armorPct:ARMORS.copper, armorName:'Copper', ammo:14, fortPct:0,
    desc:'Furious chargers, no discipline, no armor.' },
  iberians:  { name:'Iberian Caetrati', formation:'openOrder', hp:10000, morale:10, disc:6,
    stats:{charge:14,harass:16,push:12,siege:3,movement:16}, armorPct:ARMORS.bronze, armorName:'Bronze', ammo:42, fortPct:0,
    desc:'Fierce chargers and tireless skirmishers — fast, relentless, lightly armored.' },
  garrison:  { name:'Fortified Garrison', formation:'shieldWall', hp:9000, morale:10, disc:6,
    stats:{charge:4,harass:8,push:18,siege:6,movement:5}, armorPct:ARMORS.steel, armorName:'Steel', ammo:30, fortPct:35, fortName:'Wall',
    desc:'Steel wall behind ramparts. Bring siege.' },
};
