import { battleSession, issueOrder } from '../../../../game/iterBelli/battle/controller';
import { ORDERS } from '../../../../game/iterBelli/battle/orders';
import { moraleMult } from '../../../../game/iterBelli/battle/resolver';
import type { OrderKey } from '../../../../game/iterBelli/battle/types';

export function OrderBar() {
  const s = battleSession.value;
  if (!s || s.phase !== 'fighting') return null;
  const you = s.state.you;
  const ms = moraleMult(you.morale);
  const keys = [...you.formation.orders, 'retreat' as OrderKey];
  return (
    <div class="ib-bm-orders">
      {keys.map((key) => {
        const o = ORDERS[key];
        const lockDisc = you.discipline < o.disc;
        const lockAmmo = !!o.ammo && you.ammo < o.ammo;
        const lockMorale = ms < 1 && (o.reckless || o.disc >= 6) && !(o.sMorale && o.sMorale > 0);
        const locked = lockDisc || lockAmmo || lockMorale;
        return (
          <button key={key} class={`ib-bm-order sub-${o.sub}`} disabled={locked} onClick={() => issueOrder(key)}>
            <div class="ib-bm-order-name">{o.name}</div>
            <div class="ib-bm-order-desc">{o.desc}</div>
          </button>
        );
      })}
    </div>
  );
}
