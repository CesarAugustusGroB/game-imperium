import { useMemo, useState } from 'preact/hooks';
import { ArrowLeft, Clock3, Database, Route, ShieldAlert, Swords } from 'lucide-preact';
import { createBellumSystemCatalog } from '../../game/campaign/bellum-system-catalog';
import type { BellumEncounterRule, BellumTerrainRule } from '../../game/campaign/bellum-system-catalog';
import { navigateTo, navigateToBellum } from '../screens';

type SectionKey = 'overview' | 'movement' | 'encounters' | 'battle' | 'failure';

const SECTIONS: readonly { key: SectionKey; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'movement', label: 'Movement' },
  { key: 'encounters', label: 'Encounters' },
  { key: 'battle', label: 'Battle' },
  { key: 'failure', label: 'Failure' },
];

if (typeof document !== 'undefined' && !document.getElementById('bellum-systems-screen-styles')) {
  const el = document.createElement('style');
  el.id = 'bellum-systems-screen-styles';
  el.textContent = `
    .bss-root {
      min-height: 100vh;
      background:
        radial-gradient(circle at 16% 16%, rgba(90, 138, 122, 0.18), transparent 34%),
        radial-gradient(circle at 86% 10%, rgba(178, 58, 58, 0.14), transparent 30%),
        linear-gradient(180deg, #121019 0%, #09080d 100%);
      color: var(--imp-text);
      font-family: var(--imp-font-body);
      overflow-x: hidden;
    }
    .bss-shell {
      width: min(1320px, calc(100% - 32px));
      margin: 0 auto;
      padding: 22px 0 34px;
    }
    .bss-top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 18px;
      padding-bottom: 18px;
      border-bottom: 1px solid rgba(212, 168, 67, 0.20);
    }
    .bss-kicker {
      font-family: var(--imp-font-body);
      font-size: 10px;
      letter-spacing: 3px;
      text-transform: uppercase;
      color: var(--imp-gold);
      margin-bottom: 7px;
    }
    .bss-title {
      margin: 0;
      font-family: var(--imp-font-display);
      font-size: clamp(28px, 4vw, 48px);
      font-weight: 600;
      letter-spacing: 0;
      color: var(--imp-text-hi);
      text-transform: uppercase;
      line-height: 1;
    }
    .bss-subtitle {
      margin: 10px 0 0;
      max-width: 780px;
      color: var(--imp-text-mid);
      line-height: 1.55;
      font-size: 14px;
    }
    .bss-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }
    .bss-button {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-height: 34px;
      padding: 7px 11px;
      border: 1px solid rgba(212, 168, 67, 0.34);
      border-radius: 2px;
      background: rgba(20, 18, 32, 0.62);
      color: var(--imp-text);
      font-family: var(--imp-font-body);
      font-size: 11px;
      letter-spacing: 1.2px;
      text-transform: uppercase;
      cursor: pointer;
    }
    .bss-button:hover {
      border-color: rgba(240, 208, 128, 0.75);
      color: var(--imp-gold-hi);
      background: rgba(212, 168, 67, 0.10);
    }
    .bss-tabs {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      margin: 18px 0;
    }
    .bss-tab {
      min-height: 30px;
      padding: 6px 12px;
      border-radius: 2px;
      border: 1px solid rgba(212, 168, 67, 0.20);
      background: rgba(20, 18, 32, 0.46);
      color: var(--imp-text-mid);
      font-family: var(--imp-font-display);
      font-size: 11px;
      letter-spacing: 1.8px;
      text-transform: uppercase;
      cursor: pointer;
    }
    .bss-tab.is-active {
      border-color: rgba(212, 168, 67, 0.70);
      background: rgba(122, 36, 50, 0.42);
      color: var(--imp-gold-hi);
    }
    .bss-grid {
      display: grid;
      grid-template-columns: repeat(12, minmax(0, 1fr));
      gap: 12px;
    }
    .bss-panel {
      position: relative;
      border: 1px solid rgba(212, 168, 67, 0.26);
      border-radius: 2px;
      background:
        linear-gradient(180deg, rgba(26, 23, 38, 0.92), rgba(13, 11, 20, 0.96)),
        rgba(13, 11, 20, 0.94);
      padding: 16px;
      min-width: 0;
      box-shadow: inset 0 0 0 1px rgba(240, 208, 128, 0.04);
    }
    .bss-span-3 { grid-column: span 3; }
    .bss-span-4 { grid-column: span 4; }
    .bss-span-5 { grid-column: span 5; }
    .bss-span-6 { grid-column: span 6; }
    .bss-span-7 { grid-column: span 7; }
    .bss-span-8 { grid-column: span 8; }
    .bss-span-12 { grid-column: span 12; }
    .bss-panel-head {
      display: flex;
      align-items: center;
      gap: 9px;
      margin-bottom: 12px;
      color: var(--imp-gold);
      font-family: var(--imp-font-display);
      font-size: 13px;
      letter-spacing: 2px;
      text-transform: uppercase;
    }
    .bss-stat {
      display: grid;
      gap: 5px;
    }
    .bss-stat strong {
      font-family: var(--imp-font-mono);
      font-size: 28px;
      color: var(--imp-text-hi);
      line-height: 1;
    }
    .bss-stat span,
    .bss-copy {
      color: var(--imp-text-mid);
      font-size: 13px;
      line-height: 1.5;
    }
    .bss-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }
    .bss-table th {
      text-align: left;
      color: var(--imp-text-lo);
      font-size: 9px;
      letter-spacing: 1.4px;
      text-transform: uppercase;
      font-weight: 700;
      padding: 0 8px 8px 0;
      border-bottom: 1px solid rgba(212, 168, 67, 0.14);
    }
    .bss-table td {
      padding: 8px 8px 8px 0;
      border-bottom: 1px solid rgba(212, 168, 67, 0.08);
      color: var(--imp-text);
      vertical-align: top;
    }
    .bss-code {
      font-family: var(--imp-font-mono);
      color: var(--imp-gold-hi);
      font-size: 11px;
    }
    .bss-pill-row {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .bss-pill {
      display: inline-flex;
      align-items: center;
      border: 1px solid rgba(212, 168, 67, 0.18);
      border-radius: 2px;
      padding: 3px 6px;
      background: rgba(0, 0, 0, 0.18);
      color: var(--imp-text-mid);
      font-size: 10px;
      line-height: 1.3;
    }
    .bss-list {
      display: grid;
      gap: 8px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .bss-list li {
      padding: 8px 10px;
      border-left: 2px solid rgba(90, 122, 160, 0.72);
      background: rgba(90, 122, 160, 0.08);
      color: var(--imp-text);
      font-size: 12px;
      line-height: 1.45;
    }
    @media (max-width: 980px) {
      .bss-top { flex-direction: column; }
      .bss-actions { justify-content: flex-start; }
      .bss-span-3,
      .bss-span-4,
      .bss-span-5,
      .bss-span-6,
      .bss-span-7,
      .bss-span-8 { grid-column: span 12; }
    }
    @media (max-width: 640px) {
      .bss-shell { width: min(100% - 20px, 1320px); padding-top: 14px; }
      .bss-panel { padding: 12px; }
      .bss-table { font-size: 11px; }
      .bss-table th:nth-child(4),
      .bss-table td:nth-child(4) { display: none; }
    }
  `;
  document.head.appendChild(el);
}

function Panel({
  title,
  icon,
  span = 6,
  children,
}: {
  title: string;
  icon: preact.JSX.Element;
  span?: 3 | 4 | 5 | 6 | 7 | 8 | 12;
  children: preact.ComponentChildren;
}) {
  return (
    <section class={`bss-panel bss-span-${span}`}>
      <div class="bss-panel-head">
        {icon}
        <span>{title}</span>
      </div>
      {children}
    </section>
  );
}

function TerrainTable({ rows }: { rows: readonly BellumTerrainRule[] }) {
  return (
    <table class="bss-table">
      <thead>
        <tr>
          <th>Terrain</th>
          <th>MP</th>
          <th>Morale</th>
          <th>State</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.terrain}>
            <td class="bss-code">{row.terrain}</td>
            <td>{row.blocked ? 'Blocked' : row.movementCost}</td>
            <td>{row.moraleDelta >= 0 ? '+' : ''}{row.moraleDelta}</td>
            <td>{row.blocked ? 'Impassable pathfinding wall' : 'Walkable traversal'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function EncounterTable({ rows }: { rows: readonly BellumEncounterRule[] }) {
  return (
    <table class="bss-table">
      <thead>
        <tr>
          <th>Encounter</th>
          <th>Actions</th>
          <th>Battle</th>
          <th>Effects</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.encounter}>
            <td class="bss-code">{row.encounter}</td>
            <td>{row.actions}</td>
            <td>{row.launchesBattle ? 'Yes' : 'No'}</td>
            <td>
              <div class="bss-pill-row">
                {row.effects.map((effect) => (
                  <span class="bss-pill" key={`${row.encounter}-${effect}`}>{effect}</span>
                ))}
                {row.refreshesMovement && <span class="bss-pill">refresh MP</span>}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function BellumSystemsScreen() {
  const [active, setActive] = useState<SectionKey>('overview');
  const catalog = useMemo(() => createBellumSystemCatalog(), []);

  return (
    <main class="bss-root">
      <div class="bss-shell">
        <header class="bss-top">
          <div>
            <div class="bss-kicker">Campaign Systems Review</div>
            <h1 class="bss-title">Bellum Systems</h1>
            <p class="bss-subtitle">
              A single-screen audit of the Bellum campaign loop: clock, movement, terrain,
              encounters, battle routing, persistence surfaces, and defeat gates.
            </p>
          </div>
          <div class="bss-actions">
            <button class="bss-button" type="button" onClick={() => navigateTo('title')}>
              <ArrowLeft size={15} />
              Title
            </button>
            <button class="bss-button" type="button" onClick={() => navigateToBellum()}>
              <Route size={15} />
              Open Bellum
            </button>
          </div>
        </header>

        <nav class="bss-tabs" aria-label="Bellum systems sections">
          {SECTIONS.map((section) => (
            <button
              key={section.key}
              class={`bss-tab${active === section.key ? ' is-active' : ''}`}
              type="button"
              onClick={() => setActive(section.key)}
            >
              {section.label}
            </button>
          ))}
        </nav>

        {active === 'overview' && (
          <div class="bss-grid">
            <Panel title="Clock Contract" icon={<Clock3 size={16} />} span={4}>
              <div class="bss-stat">
                <strong>{catalog.clock.maxSeasons}</strong>
                <span>canonical seasons before the Final Invasion trigger.</span>
              </div>
            </Panel>
            <Panel title="March Budget" icon={<Route size={16} />} span={4}>
              <div class="bss-stat">
                <strong>{catalog.clock.movementPointsPerSeason}</strong>
                <span>movement points per Bellum season window.</span>
              </div>
            </Panel>
            <Panel title="Battle Gate" icon={<Swords size={16} />} span={4}>
              <p class="bss-copy">{catalog.clock.finalInvasion}</p>
            </Panel>
            <Panel title="State Surfaces" icon={<Database size={16} />} span={12}>
              <ul class="bss-list">
                {catalog.stateStores.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </Panel>
          </div>
        )}

        {active === 'movement' && (
          <div class="bss-grid">
            <Panel title="Season Trigger" icon={<Clock3 size={16} />} span={5}>
              <p class="bss-copy">{catalog.clock.seasonTrigger}</p>
            </Panel>
            <Panel title="Terrain Rules" icon={<Route size={16} />} span={7}>
              <TerrainTable rows={catalog.terrains} />
            </Panel>
          </div>
        )}

        {active === 'encounters' && (
          <div class="bss-grid">
            <Panel title="Encounter Dispatch Table" icon={<Database size={16} />} span={12}>
              <EncounterTable rows={catalog.encounters} />
            </Panel>
          </div>
        )}

        {active === 'battle' && (
          <div class="bss-grid">
            <Panel title="Battle Outcomes" icon={<Swords size={16} />} span={7}>
              <table class="bss-table">
                <thead>
                  <tr>
                    <th>Outcome</th>
                    <th>Strategic Fallout</th>
                  </tr>
                </thead>
                <tbody>
                  {catalog.battleOutcomes.map((row) => (
                    <tr key={row.outcome}>
                      <td class="bss-code">{row.outcome}</td>
                      <td>
                        <div class="bss-pill-row">
                          {row.effects.map((effect) => (
                            <span class="bss-pill" key={`${row.outcome}-${effect}`}>{effect}</span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
            <Panel title="Routing" icon={<Route size={16} />} span={5}>
              <ul class="bss-list">
                <li>Normal hex battles return through the post-battle reward screen, then back to Bellum.</li>
                <li>Final Invasion battles use the global final-battle flag and route to victory or defeat.</li>
                <li>Battle HP write-back updates the prepared army before Bellum evaluates run status.</li>
              </ul>
            </Panel>
          </div>
        )}

        {active === 'failure' && (
          <div class="bss-grid">
            <Panel title="Defeat Gates" icon={<ShieldAlert size={16} />} span={8}>
              <ul class="bss-list">
                {catalog.defeatChecks.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </Panel>
            <Panel title="Warnings" icon={<ShieldAlert size={16} />} span={4}>
              <p class="bss-copy">
                Bellum resolves one active HUD warning by priority: Final Invasion,
                army wipe, starvation, morale critical, then invasion imminent.
              </p>
            </Panel>
          </div>
        )}
      </div>
    </main>
  );
}
