import type { AdvisorTrait } from '../../../../../game/council/advisor';

export interface TraitVisual {
  label: AdvisorTrait;
  glyph: string;
  color: string;
  glow: string;
}

export const TRAIT_SYSTEM: Record<AdvisorTrait, TraitVisual> = {
  Diplomat: { label: 'Diplomat', glyph: 'D', color: 'var(--imp-lapis)', glow: 'rgba(90, 122, 160, 0.26)' },
  Negotiator: { label: 'Negotiator', glyph: 'N', color: 'var(--imp-verdigris)', glow: 'rgba(90, 138, 122, 0.24)' },
  Strategist: { label: 'Strategist', glyph: 'S', color: 'var(--imp-crimson)', glow: 'rgba(178, 58, 58, 0.25)' },
  Veteran: { label: 'Veteran', glyph: 'V', color: 'var(--imp-gold)', glow: 'rgba(212, 168, 67, 0.24)' },
  Logistician: { label: 'Logistician', glyph: 'L', color: 'var(--imp-bronze)', glow: 'rgba(138, 106, 42, 0.28)' },
  Schemer: { label: 'Schemer', glyph: 'X', color: 'var(--imp-porphyry)', glow: 'rgba(122, 36, 50, 0.28)' },
  Mastermind: { label: 'Mastermind', glyph: 'M', color: 'var(--imp-gold-hi)', glow: 'rgba(240, 208, 128, 0.24)' },
  'Coin-Keeper': { label: 'Coin-Keeper', glyph: 'C', color: 'var(--imp-gold)', glow: 'rgba(212, 168, 67, 0.24)' },
  Administrator: { label: 'Administrator', glyph: 'A', color: 'var(--imp-marble-shadow)', glow: 'rgba(184, 169, 133, 0.2)' },
  Financier: { label: 'Financier', glyph: 'F', color: 'var(--imp-gold-hi)', glow: 'rgba(240, 208, 128, 0.24)' },
  Healer: { label: 'Healer', glyph: 'H', color: 'var(--imp-oxidize)', glow: 'rgba(122, 154, 106, 0.24)' },
  Zealot: { label: 'Zealot', glyph: 'Z', color: 'var(--imp-danger)', glow: 'rgba(194, 74, 58, 0.25)' },
  Pontifex: { label: 'Pontifex', glyph: 'P', color: 'var(--imp-gold-hi)', glow: 'rgba(240, 208, 128, 0.24)' },
  Tribune: { label: 'Tribune', glyph: 'T', color: 'var(--imp-marble)', glow: 'rgba(237, 228, 211, 0.18)' },
};

export function getTraitVisual(trait: AdvisorTrait): TraitVisual {
  return TRAIT_SYSTEM[trait];
}
