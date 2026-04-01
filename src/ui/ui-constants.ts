import type { ResourceType } from '../game/commander';
import { RESOURCE_INFO } from '../game/commander';

// ── Shared panel style tokens ──
// Used by HubScreen, ProvinceScreen, and any future screens that use the
// standard dark-glass panel aesthetic.

export const PANEL = {
  background: 'rgba(20, 18, 36, 0.7)',
  border: '1px solid rgba(180, 160, 100, 0.12)',
  borderRadius: '8px',
  padding: '14px 16px',
} as const;

export const PANEL_TITLE = {
  fontSize: '9px', fontWeight: 700 as const,
  color: 'rgba(180, 170, 150, 0.5)',
  letterSpacing: '2px', textTransform: 'uppercase' as const,
  marginBottom: '10px',
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
