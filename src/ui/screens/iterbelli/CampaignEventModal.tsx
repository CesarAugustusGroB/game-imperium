import { playSfx } from '../../sound/sfx';
import { provinces } from '../../../game/province/province-store';
import { pendingCampaignEvent, resolveCampaignEventChoice } from '../../../game/events/campaign-events-controller';
import type { EventChoice, HubConsequence } from '../../../game/events/campaign-events-types';
import type { CardEffects } from '../../../game/iterBelli/iter-belli-types';

// ── CSS injection (idempotent; mirrors the operation-card visual language) ──
if (typeof document !== 'undefined') {
  const el = document.getElementById('ib-event-styles') ?? document.createElement('style');
  el.id = 'ib-event-styles';
  el.textContent = `
  .ib-ev-card {
    --ev-accent: var(--imp-gold);
    width: min(560px, 94vw); max-height: 88vh; overflow-y: auto;
    padding: 22px 24px 20px; border-radius: 4px;
    background: linear-gradient(180deg, color-mix(in srgb, var(--ev-accent) 13%, transparent), rgba(22,19,34,0.97) 64%);
    border: 1px solid var(--imp-gold-faint); border-top: 4px solid var(--ev-accent);
    box-shadow: 0 22px 60px rgba(0,0,0,0.6);
  }
  .ib-ev-card.province { --ev-accent: var(--imp-crimson); }
  .ib-ev-card.advisor  { --ev-accent: var(--imp-lapis); }
  .ib-ev-eyebrow { font-size: var(--imp-text-xs); letter-spacing: var(--imp-meta-letter); text-transform: uppercase; color: var(--ev-accent); font-weight: 700; }
  .ib-ev-title { font-family: var(--imp-font-display); font-size: 23px; font-weight: 600; color: var(--imp-text-hi); line-height: 1.15; margin: 4px 0 8px; }
  .ib-ev-body { font-size: 14px; color: var(--imp-text-mid); line-height: 1.55; margin-bottom: 16px; }
  .ib-ev-choices { display: flex; flex-direction: column; gap: 8px; }
  .ib-ev-choice {
    text-align: left; padding: 11px 14px; border-radius: 3px; cursor: pointer;
    background: var(--imp-panel-soft); border: 1px solid var(--imp-gold-dim); border-left: 3px solid var(--ev-accent);
    color: var(--imp-text); font-family: var(--imp-font-body);
    transition: border-color var(--duration-fast) var(--ease-default), background var(--duration-fast) var(--ease-default), transform var(--duration-fast) var(--ease-default);
  }
  .ib-ev-choice:hover { border-color: var(--imp-gold); background: var(--imp-panel-hover); transform: translateY(-1px); }
  .ib-ev-choice.premium { border-left-style: double; border-left-width: 5px; }
  .ib-ev-choice-label { font-size: 14px; font-weight: 600; color: var(--imp-gold-hi); display: flex; align-items: center; gap: 7px; }
  .ib-ev-premium-tag { font-size: 9px; letter-spacing: .08em; text-transform: uppercase; padding: 1px 6px; border-radius: 7px; background: rgba(212,168,67,0.16); color: var(--imp-gold-hi); border: 1px solid var(--imp-gold-faint); }
  .ib-ev-chips { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
  .ib-ev-chip { font-family: var(--imp-font-mono); font-size: 10.5px; padding: 1px 6px; border-radius: 7px; background: rgba(0,0,0,0.3); border: 1px solid var(--imp-gold-faint); color: var(--imp-text-mid); white-space: nowrap; }
  .ib-ev-chip.good { color: #9ed3b4; border-color: rgba(143,190,126,0.45); }
  .ib-ev-chip.bad  { color: var(--imp-crimson); border-color: rgba(212,96,74,0.5); }
  `;
  document.head.appendChild(el);
}

interface Chip { text: string; tone: 'good' | 'bad' | 'neutral'; }

const IMMEDIATE_LABELS: Partial<Record<keyof CardEffects, string>> = {
  soldiers: 'soldados', morale: 'moral', discipline: 'disciplina',
  supplies: 'suministros', ammunition: 'munición', gold: 'oro', threat: 'amenaza',
};

/** A signed chip; `lowerIsBetter` flips the good/bad tone (unrest, threat). */
const chip = (n: number, label: string, lowerIsBetter = false): Chip => {
  const good = lowerIsBetter ? n < 0 : n > 0;
  return { text: `${n > 0 ? '+' : ''}${n} ${label}`, tone: good ? 'good' : 'bad' };
};

function consequenceChip(h: HubConsequence): Chip {
  if (h.type === 'province-unrest') return chip(h.delta, 'malestar (prov.)', true);
  if (h.type === 'advisor-xp') return chip(h.delta, 'XP consejero');
  return chip(h.delta, h.resource === 'gold' ? 'oro (Imperio)' : 'iuniores (Imperio)');
}

function choiceChips(choice: EventChoice): Chip[] {
  const chips: Chip[] = [];
  for (const [k, v] of Object.entries(choice.immediate ?? {})) {
    const label = IMMEDIATE_LABELS[k as keyof CardEffects];
    if (label && typeof v === 'number' && v !== 0) chips.push(chip(v, label, k === 'threat'));
  }
  for (const h of choice.consequence ?? []) chips.push(consequenceChip(h));
  return chips;
}

export function CampaignEventModal() {
  const fired = pendingCampaignEvent.value;
  if (!fired) return null;
  const { event, conflict } = fired;
  const fill = (t: string) => t.replaceAll('{source}', conflict.sourceName);

  // Premium choices appear only when the run holds an `extra-event-choice` feature.
  const hasExtraChoice = provinces.value.some((p) => p.uniqueFeature?.special?.type === 'extra-event-choice');
  const choices = event.choices.filter((c) => !c.premium || hasExtraChoice);

  const eyebrow = event.sourceType === 'province'
    ? `Conflicto en la provincia · ${conflict.sourceName}`
    : `Intriga en el Consilium · ${conflict.sourceName}`;

  return (
    <div class="ib-overlay">
      <div class={`ib-ev-card ${event.sourceType}`} role="dialog" aria-modal="true">
        <div class="ib-ev-eyebrow">{eyebrow}</div>
        <div class="ib-ev-title">{fill(event.title)}</div>
        <div class="ib-ev-body">{fill(event.body)}</div>
        <div class="ib-ev-choices">
          {choices.map((choice, i) => (
            <button
              key={i}
              class={`ib-ev-choice ${choice.premium ? 'premium' : ''}`}
              onClick={() => { playSfx('ui_equip'); resolveCampaignEventChoice(fired, choice); }}
            >
              <span class="ib-ev-choice-label">
                {fill(choice.label)}
                {choice.premium && <span class="ib-ev-premium-tag">Oráculo</span>}
              </span>
              <div class="ib-ev-chips">
                {choiceChips(choice).map((c, j) => (
                  <span key={j} class={`ib-ev-chip ${c.tone === 'neutral' ? '' : c.tone}`}>{c.text}</span>
                ))}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
