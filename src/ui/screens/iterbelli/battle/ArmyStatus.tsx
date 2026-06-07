import type { BattleArmy } from '../../../../game/iterBelli/battle/types';

function moraleLabel(m: number) { return m <= 0 ? 'Broken' : m < 3 ? 'Wavering' : m < 6 ? 'Shaken' : 'Steady'; }

export function ArmyStatus({ army }: { army: BattleArmy }) {
  const hpPct = Math.max(0, Math.min(100, (army.hp / army.maxHp) * 100));
  const morPct = Math.max(0, Math.min(100, (army.morale / 10) * 100));
  return (
    <div class="ib-bm-army">
      <div class="ib-bm-army-name">{army.name}</div>
      <div class="ib-bm-army-meta">{army.formation.name} · Disc {army.discipline} · Armor {army.armorName} {army.armorPct}%{army.fortPct > 0 ? ` · Fort ${army.fortPct}%` : ''}</div>
      <div class="ib-bm-stat-row"><span>Soldiers</span><span>{Math.round(army.hp).toLocaleString('en-US')} / {army.maxHp.toLocaleString('en-US')}</span></div>
      <div class="ib-bm-bar"><div class="ib-bm-bar-fill" style={{ width: `${hpPct}%` }} /></div>
      <div class="ib-bm-stat-row"><span>Morale · {moraleLabel(army.morale)}</span><span>{army.morale.toFixed(1)} / 10</span></div>
      <div class="ib-bm-bar"><div class="ib-bm-bar-fill morale" style={{ width: `${morPct}%` }} /></div>
      {army.side === 'you' && <div class="ib-bm-stat-row"><span>Ammunition</span><span>{army.ammo} / {army.maxAmmo}</span></div>}
    </div>
  );
}
