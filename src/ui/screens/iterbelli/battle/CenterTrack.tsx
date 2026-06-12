import type { BattleState, OrderKey } from '../../../../game/iterBelli/battle/types';
import { ORDERS } from '../../../../game/iterBelli/battle/orders';
import { centerTier } from '../../../../game/iterBelli/battle/resolver';

/**
 * Center column of the battle arena: round counter, the two dice of the last
 * round (value, die size, center bonus, order played), and the center-control
 * track (−100..+100) showing who holds the battlefield center and the die
 * upgrade each side earns from it.
 */
export function CenterTrack({ state, lastOrders }: {
  state: BattleState;
  lastOrders: { you: OrderKey; enemy: OrderKey } | null;
}) {
  const yTier = centerTier(state.control, 'you');
  const eTier = centerTier(state.control, 'enemy');
  const holder = state.control >= 25 ? 'you' : state.control <= -25 ? 'enemy' : null;
  // Track renders you-side on the left: +100 (you) ←→ −100 (enemy).
  const markerPct = ((100 - state.control) / 200) * 100;

  return (
    <div class="ib-bm-center">
      <div class="ib-bm-round">
        <div class="ib-bm-round-label">Round</div>
        <div class="ib-bm-round-num">{state.round}</div>
      </div>

      <div class="ib-bm-dice">
        <Die label="You" data={state.lastDice.you} order={lastOrders?.you} kind="you" />
        <Die label="Enemy" data={state.lastDice.enemy} order={lastOrders?.enemy} kind="en" />
      </div>

      <div class="ib-bm-centerbox" title={state.center.desc}>
        <div class="ib-bm-center-name">⚑ {state.center.name}</div>
        <div class="ib-bm-center-desc">{state.center.desc}</div>
        <div class="ib-bm-track">
          <div class="ib-bm-track-zone you" />
          <div class="ib-bm-track-zone en" />
          <div class="ib-bm-track-marker" style={{ left: `${markerPct}%` }} />
        </div>
        <div class="ib-bm-track-ends">
          <span class={holder === 'you' ? 'hold you' : ''}>You&nbsp;·&nbsp;d{6 + yTier}</span>
          <span class={holder === 'enemy' ? 'hold en' : ''}>d{6 + eTier}&nbsp;·&nbsp;Enemy</span>
        </div>
        <div class={`ib-bm-track-holder${holder ? ` ${holder === 'you' ? 'you' : 'en'}` : ''}`}>
          {holder === 'you' ? '◈ You hold the center'
            : holder === 'enemy' ? '◈ Enemy holds the center'
            : '◈ Center contested'}
        </div>
      </div>
    </div>
  );
}

function Die({ label, data, order, kind }: {
  label: string;
  data: { raw: number; faces: number; bonus: number } | null;
  order: OrderKey | undefined;
  kind: 'you' | 'en';
}) {
  return (
    <div class={`ib-bm-die ${kind}`} title={data ? `d${data.faces}${data.bonus > 0 ? ` (d6 +${data.bonus} center bonus)` : ''}` : 'No roll yet'}>
      <div class="ib-bm-die-label">{label}</div>
      <div class="ib-bm-die-face">{data ? data.raw : '–'}</div>
      <div class="ib-bm-die-meta">
        {data ? <>d{data.faces}{data.bonus > 0 ? <span class="bonus"> +{data.bonus}</span> : null}</> : 'd6'}
      </div>
      <div class="ib-bm-die-order">{order ? ORDERS[order].name : '—'}</div>
    </div>
  );
}
