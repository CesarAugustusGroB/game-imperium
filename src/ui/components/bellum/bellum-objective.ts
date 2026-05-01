// S33-10: Pure helper for the Bellum objective chip.
// Extracted from CampaignHexScreen so it can be imported by the verify script.

export type ObjectiveChipProps = {
  icon: string;
  label: string;
  title: string;
  style?: Record<string, string>;
};

/**
 * Compute the display props for the Bellum objective chip at the top bar.
 * Three branches:
 *  - season >= maxSeasons  → Final Invasion engaged (danger colour)
 *  - season === maxSeasons - 1 → Final Invasion next season (warning colour)
 *  - otherwise             → default "Survive to Season N" chip
 */
export function objectiveChipProps(season: number, maxSeasons: number): ObjectiveChipProps {
  if (season >= maxSeasons) {
    return {
      icon: '⚔',
      label: 'FINAL INVASION',
      title: 'The season cap has been reached. The enemy host is engaged.',
      style: { color: 'var(--color-danger)', borderColor: 'var(--color-danger)' },
    };
  }
  if (season === maxSeasons - 1) {
    return {
      icon: '⏳',
      label: 'Final Invasion next season',
      title: 'One season remains before the enemy host arrives. Prepare or retreat.',
      style: { color: 'var(--color-gold-primary)' },
    };
  }
  return {
    icon: '🏛',
    label: `Survive to Season ${maxSeasons}`,
    title: `Hold the frontier until Season ${maxSeasons}, when the Final Invasion fires. Doom rises each season tick.`,
  };
}
