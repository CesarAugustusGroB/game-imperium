import type { BattleState, OrderKey } from './types';
import { ORDERS } from './orders';
import { controllerOf, moraleMult } from './resolver';

export function enemyChoose(S: BattleState): OrderKey {
  const e = S.enemy, y = S.you;
  const ms = moraleMult(e.morale);
  const av = e.formation.orders.filter((k) => {
    const o = ORDERS[k];
    if (e.discipline < o.disc) return false;
    if (o.ammo && e.ammo < o.ammo) return false;
    if (ms < 1 && (o.reckless || o.disc >= 6) && !o.sMorale) return false;
    return true;
  });
  const has = (k: OrderKey) => av.includes(k);
  if (e.morale < 3 && has('lineRelief')) return 'lineRelief';
  if (e.morale < 2.5 && has('rally')) return 'rally';
  if ((y.encircled || y.morale < 3) && has('allOut')) return 'allOut';
  if ((y.encircled || y.morale < 3) && has('charge')) return 'charge';
  if (controllerOf(S) === 'you' && y.defendedLast && has('wedge')) return 'wedge';
  if (controllerOf(S) === 'you' && has('flank')) return 'flank';
  if (y.armorPct >= 20 && has('siege')) return 'siege';
  if (has('envelop') && !y.encircled && e.stats.movement + 4 >= (ORDERS.envelop.check ?? 99)) return 'envelop';
  if (S.control > 20 && has('advance')) return 'advance';
  if (S.control > 20 && has('holdLine')) return 'holdLine';
  const pref: OrderKey[] = ['charge','wedge','allOut','fireMissiles','skirmish','warCry','advance','holdLine','hitRun','drums','taunt','flank','rally'];
  for (const p of pref) if (has(p)) return p;
  return av[0] ?? 'rally';
}
