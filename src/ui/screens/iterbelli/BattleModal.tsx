import { useEffect, useRef, useLayoutEffect } from 'preact/hooks';
import { OrnateFrame } from '../../components/OrnateFrame';
import { playSfx } from '../../sound/sfx';
import { ROMAN } from '../../../game/iterBelli/iter-belli-balance';
import {
  iterBelliBattle, beginBattle, playerChoosesStance, concludeBattle, availableStancesFor, STANCES,
} from '../../../game/iterBelli/iter-belli-combat';
import type { BattleArmy, DieData, StanceName } from '../../../game/iterBelli/iter-belli-types';

function Flags({ army }: { army: BattleArmy }) {
  const flags: { text: string; danger?: boolean }[] = [];
  if (army.encircled) flags.push({ text: 'Envuelto', danger: true });
  if (army.false_retreat_combo) flags.push({ text: 'Combo listo' });
  if (army.obstinate_used) flags.push({ text: 'Resist. usada' });
  if (flags.length === 0) return <div class="ib-bm-flags">&nbsp;</div>;
  return (
    <div class="ib-bm-flags">
      {flags.map((f) => <span key={f.text} class={`ib-bm-flag${f.danger ? ' danger' : ''}`}>{f.text}</span>)}
    </div>
  );
}

function Die({ data, faces }: { data: DieData | null; faces: number }) {
  return (
    <div class={`ib-bm-die${data ? '' : ' empty'}`}>
      <span class="ib-bm-die-corner">d{faces}</span>
      {data ? data.total : '—'}
    </div>
  );
}

function ArmyPanel({ army, side, die }: { army: BattleArmy; side: 'atk' | 'dfn'; die: DieData | null }) {
  const sPct = (army.soldiers / Math.max(1, army.initial_soldiers)) * 100;
  const mPct = (army.morale / 10) * 100;
  const meta = side === 'atk'
    ? `Tu mando · Disciplina ${ROMAN[army.discipline]}`
    : `${army.doctrine} · Disciplina ${ROMAN[army.discipline]}`;
  return (
    <div class="ib-bm-army">
      <div class="ib-bm-army-name">{army.name}</div>
      <div class="ib-bm-army-meta">{meta}</div>
      <Flags army={army} />
      <div class="ib-bm-stat">
        <div class="ib-bm-stat-row"><span>Soldados</span><span>{army.soldiers.toLocaleString('es')} / {army.initial_soldiers.toLocaleString('es')}</span></div>
        <div class="ib-bm-bar"><div class="ib-bm-bar-fill" style={{ width: `${sPct}%` }} /></div>
      </div>
      <div class="ib-bm-stat">
        <div class="ib-bm-stat-row"><span>Moral</span><span>{army.morale.toFixed(1)} / 10</span></div>
        <div class="ib-bm-bar"><div class="ib-bm-bar-fill morale" style={{ width: `${mPct}%` }} /></div>
      </div>
      {army.last_stance && <div class="ib-bm-stance-active">{army.last_stance}</div>}
      <Die data={die} faces={side === 'atk' ? 6 : 8} />
    </div>
  );
}

export function BattleModal() {
  const battle = iterBelliBattle.value;
  const logRef = useRef<HTMLDivElement>(null);
  const soundedEnd = useRef(false);

  // Build the battle the first time this modal mounts for the current phase.
  useEffect(() => {
    if (!iterBelliBattle.value) beginBattle();
  }, []);

  useLayoutEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [battle?.log.length]);

  // One-shot victory/defeat cue.
  useEffect(() => {
    if (battle?.finished && !soundedEnd.current) {
      soundedEnd.current = true;
      playSfx(battle.victory ? 'victory_fanfare' : 'defeat_sting');
    }
  }, [battle?.finished, battle?.victory]);

  if (!battle) return null;

  const stances = availableStancesFor(battle.atk);

  function choose(name: StanceName) {
    playSfx('hit');
    playerChoosesStance(name);
  }

  return (
    <div class="ib-overlay">
      <OrnateFrame width="min(920px, 96vw)" padding="compact" style={{ maxHeight: '92vh', overflow: 'auto' }}>
        <div class="ib-bm-arena">
          <ArmyPanel army={battle.atk} side="atk" die={battle.lastDice.atk} />
          <div class="ib-bm-round">
            <div class="ib-bm-round-label">Ronda</div>
            <div class="ib-bm-round-num">{battle.round}</div>
          </div>
          <ArmyPanel army={battle.dfn} side="dfn" die={battle.lastDice.dfn} />
        </div>

        {!battle.finished ? (
          <div class="ib-bm-stances-section">
            <div class="ib-section-title">Elige tu postura</div>
            {battle.atk.encircled && (
              <div class="ib-bm-warn">Estás envuelto. Solo Resistencia obstinada o Reserva táctica pueden romper el cerco.</div>
            )}
            <div class="ib-bm-stances">
              {stances.map((name) => {
                const blocked = name === 'Resistencia obstinada' && battle.atk.obstinate_used;
                return (
                  <button
                    key={name}
                    class="ib-bm-stance-btn"
                    disabled={blocked}
                    onClick={() => choose(name)}
                  >
                    <div class="ib-bm-stance-name">{name}</div>
                    <div class="ib-bm-stance-desc">{STANCES[name].desc}</div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div class="ib-bm-stances-section" style={{ textAlign: 'center' }}>
            <div class="ib-section-title">{battle.victory ? 'Victoria en el campo' : 'Derrota en el campo'}</div>
            <button class="ornate-btn" style={{ marginTop: 8 }} onClick={() => concludeBattle()}>
              Continuar
            </button>
          </div>
        )}

        <div class="ib-bm-log" ref={logRef}>
          {battle.log.map((l, i) => <div key={i} class={`ib-bm-log-line ${l.kind}`}>{l.text}</div>)}
        </div>
      </OrnateFrame>
    </div>
  );
}
