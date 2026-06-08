import type { BattleArmy, BattleState, OrderDef, Side, RoundLogLine } from './types';
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
    const dry = att.ammo <= 0;
    att.ammo = Math.max(0, att.ammo - (o.ammo ?? 0));
    let dmg = mitigate(statVal * die * (o.mult ?? 0) * discBonus * ms * BAL.DMG_SCALE, def, o);
    if (dry) { dmg *= BAL.DRY_HARASS_MULT; eMoraleHit *= 0.3; }
    if (def.formation.antiMissile) { dmg *= 0.12; eMoraleHit *= 0.3; }
    def.hp = Math.max(0, def.hp - dmg);
    log.push({ text:`${who} harass ${tgt} for ${Math.round(dmg)} (ammo ${att.ammo}${dry ? ' — out of ammo!' : ''}).`, kind: cls });
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
  const { cls, who, log, discBonus, ms, attHasCenter, centerDmgBonus, statVal } = ctx;
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

function resolveMove(S: BattleState, att: BattleArmy, def: BattleArmy, o: OrderDef, die: number, ctx: any, eMoraleHit: number): OrderResult {
  if (o.sub !== 'move') return { eMoraleHit, log: ctx.log };
  const { cls, who, log, discBonus, ms, centerDmgBonus, statVal } = ctx;

  // Retreat: break off on a successful movement check.
  if (o.effect === 'retreat') {
    const need = (o.check ?? 11) + (att.encircled ? 6 : 0);
    const total = die + att.stats.movement;
    if (total >= need) { att.retreated = true; log.push({ text:`${who} disengage and pull back (${total}≥${need}).`, kind: cls }); }
    else log.push({ text:`${who} fail to break off (${total} < ${need}).`, kind: cls });
    return { eMoraleHit: 0, log };
  }

  const total = die + att.stats.movement;
  if (total < (o.check ?? 0)) { log.push({ text:`${who} fail ${o.name} (${total} < ${o.check}).`, kind: cls }); return { eMoraleHit: 0, log }; }

  let mult = o.mult ?? 0;
  let note = '';
  if (o.effect === 'flank' && controllerOf(S) === def.side) { mult *= 2.5; note = ' — flanking crit!'; }
  const dmg = mitigate(statVal * die * mult * discBonus * ms * (1 + centerDmgBonus) * BAL.DMG_SCALE, def, o);
  def.hp = Math.max(0, def.hp - dmg);
  if (o.effect === 'encircle') { def.encircled = true; def.encircleTurns = 2; eMoraleHit += 1.0; note += ' — enemy encircled.'; }
  if (o.effect === 'hitrun') { att.guardMult = 0.25; note += ' — strike and withdraw.'; }
  log.push({ text:`${who} execute ${o.name} for ${Math.round(dmg)}${note}`, kind: note.includes('crit') ? 'crit' : cls });
  return { eMoraleHit, log };
}

export function resolveCenter(S: BattleState, yO: OrderDef, eO: OrderDef, yDie: number, eDie: number): void {
  const yPush = yO.push ? (S.you.stats.push + yDie) * (yO.push / 14) : 0;
  const ePush = eO.push ? (S.enemy.stats.push + eDie) * (eO.push / 14) : 0;
  const delta = yPush - ePush;
  if (delta !== 0) S.control = clamp(S.control + delta * BAL.CENTER_MOVE, -100, 100);
}

export function applyMorale(S: BattleState, army: BattleArmy, hpBefore: number, ownO: OrderDef, incomingMoraleHit: number): void {
  const frac = (hpBefore - army.hp) / Math.max(hpBefore, 1);
  let casualty = frac * BAL.MORALE_K;
  if (ownO.defensive && ownO.protect) casualty *= (1 - ownO.protect);
  let loss = casualty + (incomingMoraleHit || 0);
  if (army.encircled) loss += 1.0;
  loss *= Math.max(0, 1 - army.discipline * BAL.MORALE_RESIST);
  loss = Math.max(0, loss);
  if (ownO.sMorale && ownO.sMorale < 0) loss += -ownO.sMorale;
  if (controllerOf(S) === army.side && S.center.moraleRegen) army.morale = clamp(army.morale + S.center.moraleRegen, 0, 10);
  army.morale = clamp(army.morale - loss, 0, 10);
}

export function checkEnd(S: BattleState): void {
  if (S.finished) return;
  const y = S.you, e = S.enemy;
  if (e.hp <= 0) { finish(S, true, `${e.name} is annihilated.`); return; }
  if (y.hp <= 0) { finish(S, false, 'Your legion is annihilated.'); return; }
  if (e.morale <= 0) {
    if (e.encircled) { e.hp = Math.round(e.hp * 0.05); finish(S, true, 'The enemy breaks while encircled — total annihilation.'); }
    else { e.hp = Math.round(e.hp * 0.4); finish(S, true, 'Enemy morale collapses — they flee.'); }
    return;
  }
  if (y.morale <= 0) {
    if (y.encircled) finish(S, false, 'Your line breaks while encircled — slaughter.');
    else finish(S, false, 'Your morale collapses — the legion routs.');
    return;
  }
  if (S.round >= BAL.MAX_ROUNDS) {
    const ys = y.hp / y.maxHp + y.morale / 10, es = e.hp / e.maxHp + e.morale / 10;
    finish(S, ys >= es, 'The battle grinds out — ' + (ys >= es ? 'you hold the field.' : 'the enemy holds the field.'));
  }
}

export function finish(S: BattleState, victory: boolean, msg: string): void {
  S.finished = true; S.victory = victory; S.endMsg = msg;
}
