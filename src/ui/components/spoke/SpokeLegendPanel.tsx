/**
 * SpokeLegendPanel (S29-08) — static legend for the SpokeCampaignScreen
 * right column. Mirrors the icon + color language used by LandmarkMapNode
 * and the halo styles used by the intel system, so the player can decode
 * the map without hovering tiles.
 *
 * No game state — the legend is purely declarative. Icons and colors are
 * inlined here (kept in sync with LandmarkMapNode) rather than refactored
 * into a shared module: two short tables on either side of one boundary
 * is cheaper than the cross-file coupling a shared module would force.
 */

import { ENCOUNTER_ICON, ENCOUNTER_BADGE_COLOR } from './landmark-presentation';

if (typeof document !== 'undefined' && !document.getElementById('spoke-legend-styles')) {
  const el = document.createElement('style');
  el.id = 'spoke-legend-styles';
  el.textContent = `
    .spoke-legend {
      display: flex;
      flex-direction: column;
      gap: 16px;
      font-family: var(--font-family);
      color: var(--color-text-secondary);
    }
    .spoke-legend-section-title {
      font-family: var(--font-display);
      font-size: var(--font-size-xs);
      letter-spacing: 2px;
      text-transform: uppercase;
      color: var(--color-gold-dim);
      margin-bottom: 6px;
    }
    .spoke-legend-row {
      display: grid;
      grid-template-columns: 28px 1fr;
      align-items: center;
      gap: 10px;
      padding: 4px 0;
      font-size: var(--font-size-sm);
    }
    .spoke-legend-icon {
      width: 26px;
      height: 26px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      line-height: 1;
      border: 1px solid var(--lg-icon-border, rgba(180, 160, 100, 0.4));
      background: var(--lg-icon-bg, rgba(14, 12, 28, 0.55));
      color: var(--lg-icon-color, var(--color-text-secondary));
    }
    .spoke-legend-label {
      letter-spacing: 0.5px;
    }

    /* Intel halo demo squares — reuse LandmarkMapNode halo styles. */
    .spoke-legend-halo {
      position: relative;
      width: 26px;
      height: 26px;
      border-radius: 6px;
      background: linear-gradient(135deg, rgba(60, 55, 80, 0.7), rgba(40, 36, 55, 0.9));
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      color: var(--color-text-muted);
    }
    .spoke-legend-halo::after {
      content: '';
      position: absolute;
      inset: -4px;
      border-radius: 9px;
      pointer-events: none;
    }
    .spoke-legend-halo-hidden::after  { border: 1px dashed rgba(180, 160, 100, 0.45); }
    .spoke-legend-halo-revealed::after { border: 1px solid rgba(212, 168, 67, 0.55); }
    .spoke-legend-halo-recon::after    { border: 1.5px solid rgba(212, 168, 67, 0.9); box-shadow: 0 0 6px rgba(212, 168, 67, 0.3); }
  `;
  document.head.appendChild(el);
}

interface EncounterEntry {
  icon: string;
  color: string;
  label: string;
  hint?: string;
}

// Icons and badge colors sourced from landmark-presentation (T4.1) so the
// legend stays automatically consistent with the map-node renderings.
// Roman fort vs enemy fort: same `fort` landmark tile — the framing
// difference (player-held vs hostile) lives in the tooltip + the dynamic
// border color the map applies; the legend surfaces both for clarity.
const ENCOUNTER_ENTRIES: readonly EncounterEntry[] = [
  { icon: ENCOUNTER_ICON.battle,       color: ENCOUNTER_BADGE_COLOR.battle       ?? '#c24a3a', label: 'Battle' },
  { icon: ENCOUNTER_ICON.elite_battle, color: ENCOUNTER_BADGE_COLOR.elite_battle ?? '#c24a3a', label: 'Elite Battle' },
  { icon: ENCOUNTER_ICON.boss,         color: ENCOUNTER_BADGE_COLOR.boss         ?? '#8a4ac2', label: 'Boss' },
  { icon: ENCOUNTER_ICON.ambush,       color: ENCOUNTER_BADGE_COLOR.ambush       ?? '#c24a3a', label: 'Ambush', hint: 'Penalty applied before combat' },
  { icon: ENCOUNTER_ICON.rest,         color: ENCOUNTER_BADGE_COLOR.rest         ?? '#4a9a6a', label: 'Rest / Camp' },
  { icon: ENCOUNTER_ICON.forage,       color: ENCOUNTER_BADGE_COLOR.forage       ?? '#9aa84a', label: 'Forage / Supplies' },
  { icon: ENCOUNTER_ICON.scout,        color: ENCOUNTER_BADGE_COLOR.scout        ?? '#60a8d0', label: 'Scout', hint: 'Reveals fog around the node' },
  { icon: ENCOUNTER_ICON.event,        color: ENCOUNTER_BADGE_COLOR.event        ?? '#d4a843', label: 'Event' },
  { icon: ENCOUNTER_ICON.hazard,       color: ENCOUNTER_BADGE_COLOR.hazard       ?? '#c24a3a', label: 'Hazard' },
  // Siege icon reused for both Roman and enemy fort entries; colour distinguishes them.
  { icon: ENCOUNTER_ICON.siege,        color: '#d4a843',                                       label: 'Roman Fort', hint: 'Friendly garrison — bonus on defense' },
  { icon: ENCOUNTER_ICON.siege,        color: '#a83a3a',                                       label: 'Enemy Fort', hint: 'Hostile stronghold — heavy assault' },
];

interface IntelEntry {
  haloClass: string;
  marker: string;
  label: string;
  hint: string;
}

const INTEL_ENTRIES: readonly IntelEntry[] = [
  {
    haloClass: 'spoke-legend-halo-hidden',
    marker: '?',
    label: 'Unknown',
    hint: 'Encounter hidden — scout to reveal',
  },
  {
    haloClass: 'spoke-legend-halo-revealed',
    marker: '·',
    label: 'Partial Intel',
    hint: 'Encounter type known, no numbers',
  },
  {
    haloClass: 'spoke-legend-halo-recon',
    marker: '✓',
    label: 'Full Recon',
    hint: 'Effects, rewards, and enemy strength',
  },
];

export function SpokeLegendPanel() {
  return (
    <div class="spoke-legend" role="region" aria-label="Map legend">
      <section>
        <div class="spoke-legend-section-title">Encounters</div>
        {ENCOUNTER_ENTRIES.map((e) => (
          <div class="spoke-legend-row" key={e.label} title={e.hint ?? e.label}>
            <span
              class="spoke-legend-icon"
              style={{
                '--lg-icon-color': e.color,
                '--lg-icon-border': `${e.color}66`,
              } as preact.JSX.CSSProperties}
            >
              {e.icon}
            </span>
            <span class="spoke-legend-label">{e.label}</span>
          </div>
        ))}
      </section>

      <section>
        <div class="spoke-legend-section-title">Intel</div>
        {INTEL_ENTRIES.map((i) => (
          <div class="spoke-legend-row" key={i.label} title={i.hint}>
            <span class={`spoke-legend-halo ${i.haloClass}`}>{i.marker}</span>
            <span class="spoke-legend-label">
              {i.label}
              <span style={{ display: 'block', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', letterSpacing: '0.3px', marginTop: '1px' }}>
                {i.hint}
              </span>
            </span>
          </div>
        ))}
      </section>
    </div>
  );
}
