import { CATEGORIES } from '../../../data/iter-belli-locations';
import { currentLocation } from '../../../game/iterBelli/iter-belli-state';
import type { CardEffects, CardInstance, IterBelliState, OperationCard as Card } from '../../../game/iterBelli/iter-belli-types';
import { isCrisisDef } from '../../../game/iterBelli/iter-belli-types';

const EFFECT_LABELS: Record<string, string> = {
  soldiers: 'Soldados', morale: 'Moral', discipline: 'Disciplina', supplies: 'Suministros',
  gold: 'Oro', threat: 'Amenaza', iuniores: 'Iuniores', enemyWeaken: 'Erosión enem.', advance: 'Avance', time_bonus: 'Plazo',
};

/** A signed numeric effect is "good" unless it's threat (where less is better). */
function signClass(key: string, v: number): string {
  if (key === 'threat') return v < 0 ? 'pos' : 'neg';
  return v > 0 ? 'pos' : 'neg';
}

function EffectLines({ eff }: { eff: CardEffects }) {
  const entries = Object.entries(eff).filter(([, v]) => v !== undefined && v !== 0 && v !== false);
  if (entries.length === 0) {
    return <div class="ib-effect"><span style={{ color: 'var(--imp-text-lo)', fontStyle: 'italic' }}>sin efecto</span></div>;
  }
  return (
    <>
      {entries.map(([k, v]) => {
        if (k === 'advance') return <div class="ib-effect" key={k}><span class="label">Avance</span><span class="pos">→ siguiente</span></div>;
        if (k === 'ambushDetected') return <div class="ib-effect" key={k}><span class="label">Anti-emboscada</span><span class="pos">activo</span></div>;
        if (k === 'fortified') return <div class="ib-effect" key={k}><span class="label">Fortificación</span><span class="pos">activa</span></div>;
        if (k === 'triggerFinalBattle') return <div class="ib-effect" key={k} style={{ justifyContent: 'center' }}><span style={{ color: 'var(--imp-crimson)', fontWeight: 700, letterSpacing: 1 }}>★ BATALLA DECISIVA</span></div>;
        if (typeof v === 'number') {
          const sign = v > 0 ? '+' : '';
          return <div class="ib-effect" key={k}><span class="label">{EFFECT_LABELS[k] ?? k}</span><span class={signClass(k, v)}>{sign}{v}</span></div>;
        }
        return null;
      })}
    </>
  );
}

interface Props {
  card: CardInstance;
  state: IterBelliState;
  onPlay: (instanceId: number) => void;
}

export function OperationCard({ card, state, onPlay }: Props) {
  const def = card.def;
  const cat = CATEGORIES[def.category] ?? CATEGORIES['Logística'];

  // ── Crisis card (not playable) ──
  if (isCrisisDef(def)) {
    let note = '';
    if (def.id === 'crisis_hambre') note = '−1 moral, −2% soldados/turno';
    else if (def.id === 'crisis_motin') note = 'Riesgo de deserción 30%';
    else if (def.id === 'crisis_encuentro') note = 'Decide: jugar o sufrir';
    return (
      <div class="ib-card crisis" style={{ '--card-color': cat.color } as preact.JSX.CSSProperties}>
        <div class="ib-card-header"><span><span class="ib-card-icon">{cat.icon}</span> Crisis</span></div>
        <div class="ib-card-name">{def.name}</div>
        <div class="ib-card-desc">{def.desc}</div>
        <div class="ib-card-effects" style={{ textAlign: 'center', color: 'var(--imp-crimson)', fontWeight: 700 }}>{note}</div>
      </div>
    );
  }

  const opCard = def as Card;
  const isCommitment = opCard.cardType === 'compromiso';
  const isGamble = opCard.cardType === 'arriesgada';
  const isQuest = !!opCard.questId;
  const cost = opCard.cost ?? {};

  let canPlay = true;
  if (cost.gold && state.gold < cost.gold) canPlay = false;
  if (cost.supplies && state.supplies < cost.supplies) canPlay = false;
  if (cost.iuniores && state.iuniores < cost.iuniores) canPlay = false;

  const cardCtx = { state, loc: currentLocation() };
  const typeLabel = isQuest ? 'Objetivo' : isCommitment ? 'Compromiso' : isGamble ? 'Arriesgada' : def.category;
  const cls = ['ib-card', isQuest ? 'quest' : '', isCommitment ? 'commitment' : '', isGamble ? 'arriesgada' : '', canPlay ? '' : 'disabled']
    .filter(Boolean).join(' ');

  return (
    <div
      class={cls}
      style={{ '--card-color': isQuest ? 'var(--imp-gold-hi)' : cat.color } as preact.JSX.CSSProperties}
      onClick={canPlay ? () => onPlay(card.instanceId) : undefined}
      role={canPlay ? 'button' : undefined}
    >
      {card.timer < 99 && (
        <div class={`ib-card-timer${card.timer <= 1 ? ' urgent' : ''}`}>⧗ {card.timer}d</div>
      )}
      <div class="ib-card-header"><span><span class="ib-card-icon">{isQuest ? '◆' : cat.icon}</span> {typeLabel}</span></div>
      <div class="ib-card-name">{opCard.name}</div>
      <div class="ib-card-desc">{opCard.desc}</div>

      <div class="ib-card-effects">
        {cost.time ? <div class="ib-effect"><span class="label">Tiempo</span><span class="neg">−{cost.time}d</span></div> : null}
        {cost.supplies ? <div class="ib-effect"><span class="label">Suministros</span><span class="neg">−{cost.supplies}</span></div> : null}
        {cost.gold ? <div class="ib-effect"><span class="label">Oro</span><span class="neg">−{cost.gold}</span></div> : null}
        {cost.iuniores ? <div class="ib-effect"><span class="label">Iuniores</span><span class="neg">−{cost.iuniores}</span></div> : null}
        {!isGamble && <EffectLines eff={opCard.effects(cardCtx)} />}
      </div>

      {isGamble && (
        <>
          <div class="ib-gamble-chance">{opCard.successChance}% éxito</div>
          <div class="ib-gamble-cols">
            <div class="ib-gamble-col success">
              <div class="ib-gamble-col-title">Si éxito</div>
              <EffectLines eff={opCard.effects(cardCtx)} />
            </div>
            <div class="ib-gamble-col failure">
              <div class="ib-gamble-col-title">Si falla</div>
              <EffectLines eff={opCard.failureEffects ? opCard.failureEffects(cardCtx) : {}} />
            </div>
          </div>
        </>
      )}

      {isCommitment && opCard.penaltyDesc && (
        <div class="ib-commit-penalty">{opCard.penaltyDesc}</div>
      )}
    </div>
  );
}
