/**
 * Campaign-flavored stats bar shown below the spoke header (S27-07).
 *
 * Reads `currentSpoke` directly — no props, matches the existing screen
 * pattern. Renders **military** stats only (morale + tier, supplies,
 * iuniores, cohorts, progress, posture, optional season). Hub resources
 * (gold/faith/influence/momentum) intentionally do not appear here — those
 * belong on the Hub's resource bar (AC2).
 *
 * The `.ornate-stat-chip` style class is provided globally by
 * `OrnateFrame.tsx` so this file only injects layout for `.spoke-top-bar`.
 */

import { currentSpoke } from '../../../game/progression/spoke';
import { iuniores } from '../../../game/core/resources';
import { computeArmyMorale, type MoraleTier } from '../../../game/army/morale';

if (typeof document !== 'undefined' && !document.getElementById('spoke-topbar-styles')) {
  const el = document.createElement('style');
  el.id = 'spoke-topbar-styles';
  el.textContent = `
    .spoke-top-bar {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      justify-content: center;
      padding: 12px 0 4px;
    }
    @media (max-width: 640px) {
      .spoke-top-bar { gap: 6px; padding: 10px 0 2px; }
    }
  `;
  document.head.appendChild(el);
}

const MORALE_TIER_COLOR: Record<MoraleTier, string> = {
  broken:   'var(--color-danger)',
  shaken:   '#d48b3a',
  steady:   'var(--color-text-secondary)',
  resolute: 'var(--color-gold-secondary)',
  inspired: 'var(--color-gold-primary)',
};

function tierLabel(tier: MoraleTier): string {
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

export function SpokeTopBar() {
  const spoke = currentSpoke.value;
  if (!spoke) return null;

  const resolvedCount = spoke.nodes.filter(n => n.resolved).length;

  const morale = spoke.boundArmy ? computeArmyMorale(spoke) : null;
  const moraleTooltip = morale
    ? (morale.modifiers.length === 0
        ? `Morale — ${tierLabel(morale.tier)} (${morale.total}). No modifiers active.`
        : `Morale — ${tierLabel(morale.tier)} (${morale.total})\n` +
          morale.modifiers
            .slice()
            .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
            .map((m) => `  ${m.delta >= 0 ? '+' : ''}${m.delta}  ${m.label}`)
            .join('\n'))
    : undefined;

  const supplies = spoke.boundArmy?.supplies ?? null;
  const cohortCount = spoke.boundArmy?.cohorts?.length ?? 0;

  return (
    <div class="spoke-top-bar" role="region" aria-label="Campaign stats">
      {morale && (
        <span
          class="ornate-stat-chip"
          title={moraleTooltip}
          style={{ color: MORALE_TIER_COLOR[morale.tier] }}
        >
          🔥 <strong>{tierLabel(morale.tier)} {morale.total}</strong>
        </span>
      )}

      {supplies !== null && (
        <span class="ornate-stat-chip" title="Supplies">
          📦 <strong>{supplies}</strong>
        </span>
      )}

      <span class="ornate-stat-chip" title="Iuniores — manpower pool">
        🛡 <strong>{iuniores.value}</strong>
      </span>

      {cohortCount > 0 && (
        <span class="ornate-stat-chip" title="Cohorts">
          ⚔ <strong>{cohortCount}</strong>
        </span>
      )}

      <span class="ornate-stat-chip" title="Progress">
        🚩 <strong>{resolvedCount}/{spoke.nodes.length}</strong>
      </span>

      <span
        class="ornate-stat-chip"
        title="Posture"
        style={{ color: spoke.posture === 'attacking' ? '#e07050' : '#60a8d0' }}
      >
        {spoke.posture === 'attacking' ? '⚔' : '🛡'}{' '}
        <strong>{spoke.posture === 'attacking' ? 'Attacking' : 'Defending'}</strong>
      </span>

      {spoke.duration > 1 && (
        <span class="ornate-stat-chip" title="Season">
          🌿 <strong>S{spoke.currentSeason}/{spoke.duration}</strong>
        </span>
      )}
    </div>
  );
}
