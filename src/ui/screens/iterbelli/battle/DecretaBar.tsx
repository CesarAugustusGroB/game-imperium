import { battleSession, castBattleDecretum } from '../../../../game/iterBelli/battle/controller';
import { hasBattleEffect } from '../../../../game/iterBelli/battle/decreta';
import { ORDERS } from '../../../../game/iterBelli/battle/orders';
import { decretumHand } from '../../../../game/items/decretum-store';
import { isDecretumCastable } from '../../../../game/items/decretum';
import type { ResourceType } from '../../../../game/core/commander';
import { FACTION_COLORS } from '../../../../game/core/commander';
import { selectedCommander } from '../../../../game/core/game-state';
import { iterBelliState } from '../../../../game/iterBelli/iter-belli-state';
import { playSfx } from '../../../sound/sfx';
import { GameIcon } from '../../../components/GameIcon';

/** One decretum may be cast per battle; scrolls without a battle effect stay home. */
export function DecretaBar() {
  const s = battleSession.value;
  if (!s || s.phase !== 'fighting') return null;
  const faction = selectedCommander.value?.faction ?? null;
  const campaign = iterBelliState.value;
  const scrolls = decretumHand.value.filter(hasBattleEffect);

  const castId = s.decretumCastId;
  const revealed = s.state.nextEnemyOrder ? ORDERS[s.state.nextEnemyOrder] : null;

  if (scrolls.length === 0 && !castId && !revealed) return null;

  return (
    <div class="ib-bm-decreta">
      <div class="ib-bm-decreta-head">
        <span>Decreta · one cast per battle</span>
        {revealed && (
          <span class="ib-bm-decreta-intent" title="Revealed by decretum — the enemy's next order.">
            👁 Enemy intent: <b>{revealed.name}</b>
          </span>
        )}
      </div>
      {castId ? (
        <div class="ib-bm-decreta-cast">✓ Decretum cast — the scroll is spent.</div>
      ) : (
        <div class="ib-bm-decreta-row">
          {scrolls.map((d) => {
            const color = FACTION_COLORS[d.color];
            const colorOk = faction !== null && isDecretumCastable(d, faction);
            const costEntries = d.castCost
              ? (Object.entries(d.castCost) as [ResourceType, number][]).filter(([, amt]) => amt > 0)
              : [];
            const affordable = costEntries.every(([res, amt]) =>
              res === 'gold' ? campaign.gold >= amt : campaign.iuniores >= amt);
            const locked = !colorOk || !affordable;
            const costLabel = costEntries.map(([res, amt]) => `${amt} ${res}`).join(' + ');
            return (
              <button
                key={d.id}
                class="ib-bm-scroll"
                style={{ borderTopColor: color }}
                disabled={locked}
                title={!colorOk
                  ? 'Faction color-lock — only your color or white.'
                  : !affordable
                    ? `Cannot afford the cast cost (${costLabel}).`
                    : d.description}
                onClick={() => { if (castBattleDecretum(d.id)) playSfx('ui_equip'); }}
              >
                <div class="ib-bm-scroll-name"><GameIcon name="nav-decreta" size="micro" style={{ marginRight: 4 }} /> {d.name}</div>
                <div class="ib-bm-scroll-meta">{costLabel || 'free'} · {d.rarity}</div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
