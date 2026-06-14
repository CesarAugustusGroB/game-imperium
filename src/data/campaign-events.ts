/**
 * campaign-events.ts — the v1 catalog of campaign events (D10 step 3).
 *
 * Narrative interludes (NOT cards) that dramatize a HUB conflict — a restless
 * province or a divided Consilium — at most once per Iter Belli march. Each
 * choice applies immediate campaign effects (CardEffects) and may enqueue a
 * deferred HubConsequence, applied on return to the Forum.
 *
 * Authoring rules (kept honest + balanced):
 *  - `{source}` in title/body is replaced with the conflict's source name at render.
 *  - A province-unrest / advisor-xp consequence targets the triggering conflict, so
 *    its id is SOURCE_REF (the controller, step 4, rewrites it to the real id).
 *  - SCALE: every soldiers (immediate) and iuniores (resource) delta is in HUNDREDS
 *    (capped ~2000). advisor-xp deltas stay on the xp scale (±1–3; tiers at 5/12).
 *    Campaign gold/morale/supplies follow the card scale (tens / ±1–3 / single digits).
 *  - `premium` choices appear only when the run holds the `extra-event-choice` feature.
 *
 * See docs/superpowers/specs/2026-06-14-campaign-events-design.md.
 */
import type { CampaignEvent } from '../game/events/campaign-events-types';
import { SOURCE_REF } from '../game/events/campaign-events-types';

export const CAMPAIGN_EVENTS: CampaignEvent[] = [
  // ── Province conflicts ──────────────────────────────────────────────────
  {
    id: 'province_unrest_riot',
    sourceType: 'province',
    title: 'Ecos de revuelta',
    body: 'Un jinete llega desde {source}: las calles hierven y el gobernador implora soldados antes de que arda la ciudad.',
    choices: [
      {
        label: 'Desviar una cohorte a sofocarla',
        immediate: { soldiers: -300 },
        consequence: [{ type: 'province-unrest', provinceId: SOURCE_REF, delta: -25 }],
      },
      {
        label: 'El frente es la prioridad',
        consequence: [{ type: 'province-unrest', provinceId: SOURCE_REF, delta: 12 }],
      },
      {
        label: 'Enviar un emisario con oro del botín',
        immediate: { gold: -30 },
        consequence: [{ type: 'province-unrest', provinceId: SOURCE_REF, delta: -30 }],
        premium: true,
      },
    ],
  },
  {
    id: 'province_forced_levy',
    sourceType: 'province',
    title: 'Leva en tierra revuelta',
    body: 'Los reclutadores podrían arrancar hombres de {source} para rellenar las filas. La provincia ya está al límite.',
    choices: [
      {
        label: 'Leva forzosa',
        immediate: { soldiers: 400 },
        consequence: [{ type: 'province-unrest', provinceId: SOURCE_REF, delta: 20 }],
      },
      {
        label: 'Leva moderada',
        immediate: { soldiers: 200 },
        consequence: [{ type: 'province-unrest', provinceId: SOURCE_REF, delta: 8 }],
      },
      {
        label: 'Respetar a la provincia',
        immediate: { morale: 2 },
        consequence: [{ type: 'province-unrest', provinceId: SOURCE_REF, delta: -10 }],
      },
    ],
  },
  {
    id: 'province_frontier_tribute',
    sourceType: 'province',
    title: 'Tributo de la frontera',
    body: 'Ancianos leales de {source}, ansiosos por probar su valía, ofrecen reclutas y monedas a tu causa.',
    choices: [
      {
        label: 'Aceptar reclutas',
        consequence: [
          { type: 'resource', resource: 'iuniores', delta: 500 },
          { type: 'province-unrest', provinceId: SOURCE_REF, delta: 5 },
        ],
      },
      {
        label: 'Aceptar oro para la campaña',
        immediate: { gold: 30 },
        consequence: [{ type: 'resource', resource: 'gold', delta: 150 }],
      },
      {
        label: 'Rechazar con cortesía',
        immediate: { morale: 1 },
        consequence: [{ type: 'province-unrest', provinceId: SOURCE_REF, delta: -8 }],
      },
    ],
  },
  {
    id: 'province_bitter_harvest',
    sourceType: 'province',
    title: 'Cosecha amarga',
    body: 'El hambre asola {source}; sus enviados suplican el grano de tu ejército.',
    choices: [
      {
        label: 'Compartir suministros',
        immediate: { supplies: -8 },
        consequence: [{ type: 'province-unrest', provinceId: SOURCE_REF, delta: -18 }],
      },
      {
        label: 'El ejército come primero',
        consequence: [{ type: 'province-unrest', provinceId: SOURCE_REF, delta: 10 }],
      },
    ],
  },

  // ── Advisor (divided-council) conflicts ─────────────────────────────────
  {
    id: 'advisor_rivalry',
    sourceType: 'advisor',
    title: 'Rivalidad en el Consilium',
    body: '{source} envía órdenes que socavan en silencio a un rival del Consejo. La grieta amenaza con abrirse.',
    choices: [
      {
        label: 'Respaldar a {source}',
        immediate: { discipline: 1 },
        consequence: [{ type: 'advisor-xp', advisorId: SOURCE_REF, delta: 2 }],
        setsFlag: 'backed_rival',
      },
      {
        label: 'Frenar su ambición',
        immediate: { morale: -1 },
        consequence: [{ type: 'advisor-xp', advisorId: SOURCE_REF, delta: -2 }],
      },
      {
        label: 'Mediar con mano firme',
        immediate: { gold: -25, morale: 2 },
        consequence: [{ type: 'advisor-xp', advisorId: SOURCE_REF, delta: 1 }],
        premium: true,
      },
    ],
  },
  {
    id: 'advisor_ambition',
    sourceType: 'advisor',
    title: 'El legado ambicioso',
    body: '{source} exige una mayor cuota de mando, o amenaza con retirarse a su tienda en pleno avance.',
    choices: [
      {
        label: 'Concederle el mando',
        immediate: { morale: 2 },
        consequence: [{ type: 'advisor-xp', advisorId: SOURCE_REF, delta: 3 }],
      },
      {
        label: 'Recordarle su lugar',
        immediate: { discipline: 1, morale: -2 },
        consequence: [{ type: 'advisor-xp', advisorId: SOURCE_REF, delta: -1 }],
      },
    ],
  },
  {
    id: 'advisor_divided_council',
    sourceType: 'advisor',
    // Chains off advisor_rivalry: if you already sided with the rival, the council
    // no longer splits this way — this event is suppressed.
    blockedByFlag: 'backed_rival',
    title: 'Consejo dividido',
    body: 'El Consilium se parte en dos sobre arriesgar una marcha forzada. {source} encabeza una de las facciones.',
    choices: [
      {
        label: 'Imponer consenso',
        immediate: { discipline: 1, supplies: -4 },
        consequence: [{ type: 'advisor-xp', advisorId: SOURCE_REF, delta: 1 }],
      },
      {
        label: 'Dejar que se enfrenten',
        immediate: { morale: -3 },
        consequence: [{ type: 'advisor-xp', advisorId: SOURCE_REF, delta: -2 }],
      },
    ],
  },
];
