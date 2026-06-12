import { battleSession, issueOrder } from '../../../../game/iterBelli/battle/controller';
import { ORDERS } from '../../../../game/iterBelli/battle/orders';
import { moraleMult } from '../../../../game/iterBelli/battle/resolver';
import type { OrderDef, OrderKey, BattleArmy } from '../../../../game/iterBelli/battle/types';

const SUB_LABEL: Record<string, string> = {
  push: 'Línea', charge: 'Carga', harass: 'Proyectiles', moral: 'Moral', move: 'Maniobra', siege: 'Asedio',
};

/** Build the info chips for one order, given the army that would execute it. */
function orderChips(o: OrderDef, you: BattleArmy): { text: string; tone?: 'good' | 'bad' | 'warn' }[] {
  const chips: { text: string; tone?: 'good' | 'bad' | 'warn' }[] = [];
  if (o.stat && o.mult) {
    const statVal = you.stats[o.stat];
    chips.push({ text: `${o.stat} ${statVal} ×${o.mult}`, tone: statVal === 0 ? 'bad' : undefined });
  }
  if (o.check) chips.push({ text: `prueba: dado + mov ${you.stats.movement} ≥ ${o.check}` });
  if (o.ammo) chips.push({ text: `−${o.ammo} munición`, tone: you.ammo < o.ammo ? 'bad' : 'warn' });
  if (o.sMorale) chips.push({ text: `${o.sMorale > 0 ? '+' : ''}${o.sMorale} moral propia`, tone: o.sMorale > 0 ? 'good' : 'bad' });
  if (o.drums) chips.push({ text: '+moral sostenida', tone: 'good' });
  if (o.refresh) chips.push({ text: '−50% daño recibido', tone: 'good' });
  if (o.eMorale) chips.push({ text: `−${o.eMorale} moral enemiga` });
  if (o.defensive) chips.push({ text: o.protect ? `defensa · −${Math.round(o.protect * 100)}% pánico` : 'defensa', tone: 'good' });
  if (o.pierce) chips.push({ text: 'ignora armadura y fortín' });
  if (o.pierceBrace) chips.push({ text: 'atraviesa la defensa' });
  if (o.breakCenter) chips.push({ text: 'roba el centro si impacta' });
  if (o.reckless) chips.push({ text: 'temeraria', tone: 'warn' });
  chips.push({ text: `disc ${o.disc}`, tone: you.discipline < o.disc ? 'bad' : undefined });
  return chips;
}

/** Why this order cannot be issued right now, or null if it can. */
function lockReason(o: OrderDef, you: BattleArmy, ms: number): string | null {
  if (you.discipline < o.disc) return `Requiere disciplina ${o.disc} (tienes ${you.discipline})`;
  if (o.ammo && you.ammo < o.ammo) return `Munición insuficiente (${you.ammo}/${o.ammo})`;
  if (ms < 1 && (o.reckless || o.disc >= 6) && !(o.sMorale && o.sMorale > 0)) return 'La moral es demasiado baja para esta orden';
  return null;
}

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
        const reason = lockReason(o, you, ms);
        const chips = orderChips(o, you);
        return (
          <button
            key={key}
            class={`ib-bm-order sub-${o.sub}`}
            disabled={reason !== null}
            title={reason ?? o.desc}
            onClick={() => issueOrder(key)}
          >
            <div class="ib-bm-order-head">
              <span class="ib-bm-order-name">{o.name}</span>
              <span class={`ib-bm-order-sub sub-${o.sub}`}>{SUB_LABEL[o.sub] ?? o.sub}</span>
            </div>
            <div class="ib-bm-order-desc">{o.desc}</div>
            <div class="ib-bm-order-chips">
              {chips.map((c, i) => (
                <span key={i} class={`ib-bm-chip${c.tone ? ` ${c.tone}` : ''}`}>{c.text}</span>
              ))}
            </div>
            {reason && <div class="ib-bm-order-lock">🔒 {reason}</div>}
          </button>
        );
      })}
    </div>
  );
}
