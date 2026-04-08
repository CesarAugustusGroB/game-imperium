import type { ResourceType } from '../game/core/commander';
import { RESOURCE_INFO } from '../game/core/commander';

// ── Shared panel style tokens ──
// Used by HubScreen, ProvinceScreen, and any future screens that use the
// standard dark-glass panel aesthetic.

export const PANEL = {
  background: 'var(--color-bg-primary)',
  border: 'var(--border-width) solid var(--color-border-subtle)',
  borderRadius: 'var(--radius-md)',
  padding: '14px 16px',
} as const;

export const PANEL_TITLE = {
  fontSize: 'var(--font-size-xs)', fontWeight: 700 as const,
  color: 'var(--color-text-muted)',
  letterSpacing: '2px', textTransform: 'uppercase' as const,
  marginBottom: 'var(--space-md)',
} as const;

// ── Roman numeral map (1-3 tier display) ──

export const ROMAN: Record<number, string> = { 1: 'I', 2: 'II', 3: 'III' };

// ── Resource cost formatting ──

/**
 * Format a ResourceCost as a compact "5 icon + 3 icon" string (emoji labels).
 * Used by investment build buttons, governor hire buttons, etc.
 */
export function formatCost(cost: Partial<Record<ResourceType, number>>): string {
  return (Object.entries(cost) as [ResourceType, number][])
    .filter(([, amt]) => amt > 0)
    .map(([res, amt]) => `${amt} ${RESOURCE_INFO[res].icon}`)
    .join(' + ');
}
