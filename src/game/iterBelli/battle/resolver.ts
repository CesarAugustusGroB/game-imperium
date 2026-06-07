import type { BattleArmy, BattleState, OrderDef, OrderKey, Side, RoundLogLine } from './types';
import { ORDERS } from './orders';
import { BAL } from './balance';

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function centerTier(control: number, side: Side): number {
  const c = side === 'you' ? control : -control;
  if (c < 25) return 0;
  if (c < 50) return 1;
  if (c < 75) return 2;
  return 3;
}

export function mitigate(raw: number, def: BattleArmy, o: Partial<OrderDef>): number {
  let m = raw;
  if (!(o && o.pierce)) {
    m *= (1 - def.armorPct / 100);
    if (def.fortPct > 0) m *= (1 - def.fortPct / 100);
  }
  m *= (def.guardMult ?? 1);
  return m;
}

export function moraleMult(m: number): number {
  if (m <= 0) return 0;
  if (m < 3) return 0.6;
  if (m < 6) return 0.8;
  return 1.0;
}

export interface OrderResult { eMoraleHit: number; log: RoundLogLine[]; }

export function resolveOrder(
  S: BattleState, att: BattleArmy, def: BattleArmy, o: OrderDef, die: number, defO: OrderDef,
): OrderResult {
  const cls: RoundLogLine['kind'] = att.side === 'you' ? 'you' : 'en';
  const who = att.side === 'you' ? 'You' : 'Enemy';
  const tgt = att.side === 'you' ? 'the enemy' : 'your legion';
  const log: RoundLogLine[] = [];
  let eMoraleHit = o.eMorale ?? 0;
  const discBonus = 1 + att.discipline * BAL.DISC_DMG;
  const ms = moraleMult(att.morale);
  const attHasCenter = controllerOf(S) === att.side;
  const centerDmgBonus = (attHasCenter && S.center.dmg) ? S.center.dmg : 0;
  const statVal = o.stat ? att.stats[o.stat] : 0;

  // pure morale orders (drums / rally / line relief / taunt)
  if (o.sub === 'moral' && !o.mult) {
    if (o.drums) { att.drums = 3; log.push({ text:`${who} sound the war drums.`, kind:'mor' }); }
    else if (o.refresh) { att.morale = clamp(att.morale + (o.sMorale ?? 0), 0, 10); att.guardMult = 0.5; log.push({ text:`${who} relieve the line — fresh troops forward.`, kind:'mor' }); }
    else if (o.sMorale) { att.morale = clamp(att.morale + o.sMorale, 0, 10); log.push({ text:`${who} rally the line.`, kind:'mor' }); }
    if (eMoraleHit) log.push({ text:`${who} taunt the enemy.`, kind:'mor' });
    return { eMoraleHit, log };
  }

  if (o.sub === 'harass') {
    att.ammo = Math.max(0, att.ammo - (o.ammo ?? 0));
    let dmg = mitigate(statVal * die * (o.mult ?? 0) * discBonus * ms * BAL.DMG_SCALE, def, o);
    if (def.formation.antiMissile) { dmg *= 0.12; eMoraleHit *= 0.3; }
    def.hp = Math.max(0, def.hp - dmg);
    log.push({ text:`${who} harass ${tgt} for ${Math.round(dmg)} (ammo ${att.ammo}).`, kind: cls });
    return { eMoraleHit, log };
  }

  if (o.sub === 'siege') {
    let dmg = statVal * die * (o.mult ?? 0) * discBonus * ms * (1 + centerDmgBonus) * BAL.DMG_SCALE;
    dmg *= (def.guardMult ?? 1);
    def.hp = Math.max(0, def.hp - dmg);
    log.push({ text:`${who} storm with siege for ${Math.round(dmg)} (pierces armor & fort).`, kind: cls });
    return { eMoraleHit, log };
  }

  if (o.sub === 'push') {
    const dmg = mitigate(statVal * die * (o.mult ?? 0) * discBonus * ms * (1 + centerDmgBonus) * BAL.DMG_SCALE, def, o);
    def.hp = Math.max(0, def.hp - dmg);
    if (o.sMorale) att.morale = clamp(att.morale + o.sMorale, 0, 10);
    log.push({ text:`${who} ${o.defensive ? 'hold the line' : 'advance'} for ${Math.round(dmg)}.`, kind: cls });
    return { eMoraleHit, log };
  }

  // charge + move handled in later tasks
  return chargeAndMove(S, att, def, o, die, defO, { cls, who, tgt, log, eMoraleHit, discBonus, ms, attHasCenter, centerDmgBonus, statVal });
}

export function controllerOf(S: BattleState): Side | null {
  if (S.control >= 25) return 'you';
  if (S.control <= -25) return 'enemy';
  return null;
}

function chargeAndMove(
  S: BattleState, att: BattleArmy, def: BattleArmy, o: OrderDef, die: number, defO: OrderDef, ctx: any,
): OrderResult {
  const { cls, who, tgt, log, discBonus, ms, attHasCenter, centerDmgBonus, statVal } = ctx;
  let eMoraleHit = ctx.eMoraleHit as number;

  if (o.sub === 'charge') {
    let impactMult = o.mult ?? 0;
    let recoilMult = 0.55;
    const defBraced = defO && defO.defensive;
    if (defBraced && !o.pierceBrace) { impactMult *= 0.6; recoilMult = 1.8; }
    if (o.allIn) recoilMult *= 1.5;
    if (S.center.chargeBonus && attHasCenter) impactMult *= (1 + S.center.chargeBonus);
    if (S.center.enemyChargePenalty && controllerOf(S) === def.side) impactMult *= (1 - S.center.enemyChargePenalty);
    const impact = mitigate(statVal * die * impactMult * discBonus * ms * (1 + centerDmgBonus) * BAL.DMG_SCALE, def, o);
    def.hp = Math.max(0, def.hp - impact);
    const exposure = 1 + Math.max(0, 7 - die) / 10;
    const recoil = mitigate(def.stats.push * recoilMult * exposure * BAL.RECOIL_SCALE, att, {});
    att.hp = Math.max(0, att.hp - recoil);
    eMoraleHit += impact > recoil ? 0.6 : -0.2;
    if (o.sMorale) att.morale = clamp(att.morale + o.sMorale, 0, 10);
    if (o.breakCenter && impact > recoil) S.control = clamp(S.control + (att.side === 'you' ? 1 : -1) * 32, -100, 100);
    const verdict = impact > recoil ? 'the charge lands' : (defBraced && !o.pierceBrace ? 'the defense halts it' : 'even exchange');
    log.push({ text:`${who} ${o.wedge ? 'drive the wedge' : 'charge'} → impact ${Math.round(impact)} / recoil ${Math.round(recoil)} — ${verdict}.`, kind: cls });
    return { eMoraleHit: Math.max(0, eMoraleHit), log };
  }

  // move handled in Task 8
  return resolveMove(S, att, def, o, die, ctx, eMoraleHit);
}

function resolveMove(_S: BattleState, _att: BattleArmy, _def: BattleArmy, _o: OrderDef, _die: number, ctx: any, eMoraleHit: number): OrderResult {
  return { eMoraleHit, log: ctx.log };
}
