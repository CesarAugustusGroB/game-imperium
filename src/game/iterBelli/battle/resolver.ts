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
