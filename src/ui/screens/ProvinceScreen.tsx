import { signal, useSignal } from '@preact/signals';
import type { ComponentChildren } from 'preact';
import { selectedCommander } from '../../game/core/game-state';
import { playSfx } from '../sound/sfx';
import { provinces, buildInvestment, canAffordCost, getNextInvestmentLevel, setProvinceTax } from '../../game/province/province-store';
import {
  INVESTMENT_DATA, getProvinceIncome, getProvinceExpenses, getUnrestModifier,
  getInvestmentDiscount, applyInvestmentDiscount,
  getTaxLabel, getTaxRate, formatTaxRate, getLowerTaxUnrest,
  getUpperTaxUnrest, calculateNetWealthChange,
  getActiveSynergies,
  getSettlementLabel, getBuildingSlots, calculateGrowthThreshold,
  calculateUnrestDelta, getRebelThreshold, getAvailableBuildings, SYNERGY_DATA,
  calculateFoodProduction, calculateEffectiveFoodProduction, calculateFoodConsumption,
  calculateFoodSurplus, calculateBeautiness,
  type InvestmentType, type Province,
} from '../../game/province/province';
import type { TaxLevel } from '../../types/index';
import { FACTION_COLORS, RESOURCE_INFO, type ResourceType } from '../../game/core/commander';
import { getResource } from '../../game/core/resources';
import { getHireCost, type GovernorTrait } from '../../game/province/governor';
import {
  governorPool, governorAssignments,
  getAssignedGovernor, getGovernorTraits,
  hireGovernor, dismissGovernor, getGovernorSalary,
} from '../../game/province/governor-store';
import { TRADE_GOOD_DATA } from '../../data/trade-goods';
import { TERRAIN_DATA, TERRAIN_AVAILABLE_BUILDINGS } from '../../data/terrain-data';
import { nextInvestmentDiscount } from '../../game/progression/strategic-store';
import { FOOD, IUNIORES } from '../../config/game-config';
import { ROMAN } from '../ui-constants';
import { Portrait } from '../components/Portrait';
import { Tooltip } from '../components/Tooltip';
import { BuildingIcon } from '../components/BuildingIcon';
import { OrnateFrame, OrnateHeader } from '../components/OrnateFrame';
import { BentoCard } from '../components/BentoCard';
import { Masthead } from './forum/Masthead';
import { CostInline, ResourceAmount, ResourceIcon } from '../components/ResourceIcon';

// ── One-time CSS injection ──
if (typeof document !== 'undefined' && !document.getElementById('province-styles')) {
  const el = document.createElement('style');
  el.id = 'province-styles';
  el.textContent = `
    /* ── Province ledger rows ── */
    .prov-row { transition: all var(--duration-fast) var(--ease-default); cursor: pointer; }
    .prov-row:hover { border-color: var(--color-border-strong) !important; background: rgba(40, 35, 60, 0.55) !important; }
    .prov-row:active { transform: scale(0.99); }
    .prov-row-selected {
      border-color: var(--color-gold-primary) !important;
      background: rgba(80, 60, 20, 0.35) !important;
      box-shadow: inset 3px 0 0 var(--color-gold-primary);
    }
    /* ── Governor card ── */
    .gov-strip {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 14px 16px;
      background: linear-gradient(90deg, rgba(40, 30, 60, 0.55), rgba(20, 16, 32, 0.4));
      border: 1px solid var(--color-border-default);
      border-radius: var(--radius-md);
      position: relative;
      overflow: hidden;
    }
    .gov-strip::before {
      content: '';
      position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
      background: var(--color-gold-secondary);
    }
    .gov-name {
      font-family: var(--font-display);
      font-size: var(--font-size-lg);
      font-weight: 600;
      letter-spacing: 2px;
      text-transform: uppercase;
    }
    .gov-tier-pill {
      display: inline-flex; align-items: center; justify-content: center;
      min-width: 22px; height: 18px; padding: 0 6px;
      border-radius: 9px;
      background: rgba(50, 42, 12, 0.85);
      border: 1px solid var(--color-gold-primary);
      color: var(--color-gold-primary);
      font-size: var(--font-size-xs); font-weight: 700;
      letter-spacing: 1px;
    }
    .gov-dismiss-btn { transition: all var(--duration-fast) var(--ease-default); cursor: pointer; }
    .gov-dismiss-btn:hover { background: rgba(180, 60, 40, 0.4) !important; border-color: rgba(200, 80, 60, 0.6) !important; color: #e8a0a0 !important; }
    .gov-hire-btn { transition: all var(--duration-fast) var(--ease-default); cursor: pointer; }
    .gov-hire-btn:hover { border-color: var(--color-gold-primary) !important; color: var(--color-gold-primary) !important; background: rgba(80, 60, 20, 0.5) !important; }
    .gov-hire-btn:active { transform: scale(0.97); }

    /* ── Governor traits panel (S18-08) ── */
    .gov-traits {
      display: flex; flex-direction: column; gap: 3px;
      padding-top: 7px;
      border-top: 1px solid rgba(180, 160, 100, 0.12);
      margin-top: 5px;
    }
    .gov-trait-row {
      display: flex; align-items: center; gap: 5px;
      font-size: var(--font-size-xs);
      color: var(--color-text-secondary);
    }
    .gov-salary-row {
      font-size: var(--font-size-xs);
      color: rgba(230, 130, 80, 0.9);
      font-weight: 700; letter-spacing: 0.5px;
    }
    .gov-net-row {
      display: flex; align-items: center; gap: 5px;
      font-size: var(--font-size-xs); font-weight: 700;
      padding-top: 4px;
      border-top: 1px solid rgba(180, 160, 100, 0.1);
      margin-top: 3px;
    }
    .gov-net-positive { color: var(--color-success); }
    .gov-net-negative { color: var(--color-danger); }
    .gov-net-neutral  { color: var(--color-text-secondary); }

    /* ── Investment hero cards ── */
    .inv-card {
      position: relative;
      display: flex; flex-direction: column;
      background: linear-gradient(180deg, rgba(40, 32, 60, 0.5) 0%, rgba(18, 14, 32, 0.85) 100%);
      border: 1px solid var(--color-border-default);
      border-radius: var(--radius-md);
      overflow: hidden;
      transition: all var(--duration-fast) var(--ease-default);
    }
    .inv-card:hover {
      border-color: var(--color-gold-primary);
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4), 0 0 16px rgba(240, 208, 128, 0.15);
    }
    .inv-card.inv-locked { opacity: 0.78; }
    .inv-hero {
      position: relative;
      height: 96px;
      display: flex; align-items: center; justify-content: center;
      border-bottom: 1px solid var(--color-border-default);
    }
    .inv-hero::before {
      content: '';
      position: absolute; inset: 0;
      background: radial-gradient(ellipse at center, rgba(240, 208, 128, 0.08) 0%, transparent 70%);
      pointer-events: none;
    }
    .inv-level {
      position: absolute;
      top: 6px; right: 6px;
      min-width: 22px; height: 22px;
      padding: 0 6px;
      display: flex; align-items: center; justify-content: center;
      background: rgba(20, 16, 32, 0.85);
      border: 1px solid var(--color-gold-primary);
      border-radius: 11px;
      font-family: var(--font-display);
      font-size: var(--font-size-xs);
      font-weight: 700;
      color: var(--color-gold-primary);
      letter-spacing: 0.5px;
    }
    .inv-nameplate {
      padding: 8px 12px 4px;
      font-family: var(--font-display);
      font-size: var(--font-size-md);
      font-weight: 700;
      color: var(--color-gold-primary);
      letter-spacing: 2px;
      text-transform: uppercase;
      text-align: center;
      text-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
    }
    .inv-desc {
      padding: 0 12px 10px;
      font-size: var(--font-size-xs);
      color: var(--color-text-secondary);
      text-align: center;
      line-height: 1.45;
      flex: 1;
      min-height: 32px;
    }
    /* Position override for ornate-btn inside investment cards */
    .inv-card .ornate-btn { margin: 0 10px 10px; }
    .inv-maxed {
      margin: 0 10px 10px;
      padding: 7px 8px;
      font-size: var(--font-size-xs);
      font-weight: 700;
      letter-spacing: 1px;
      color: rgba(90, 138, 74, 0.85);
      text-transform: uppercase;
      text-align: center;
      border: 1px solid rgba(90, 138, 74, 0.3);
      border-radius: var(--radius-sm);
      background: rgba(30, 50, 30, 0.3);
    }

    /* ── Animations ── */
    @keyframes prov-fade-in {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes inv-build-success {
      0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(240,208,128,0); }
      40% { transform: scale(1.05); box-shadow: 0 0 20px 6px rgba(240,208,128,0.5); }
      100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(240,208,128,0); }
    }
    .inv-slot-building { animation: inv-build-success 0.5s ease-out; }

    /* ── Governor picker modal ── */
    .gov-picker-card { transition: all var(--duration-fast) var(--ease-default); }
    .gov-tier-btn { transition: all var(--duration-fast) var(--ease-default); cursor: pointer; }
    .gov-tier-btn:hover:not(:disabled) {
      border-color: var(--color-gold-primary) !important;
      background: rgba(80, 60, 20, 0.6) !important;
      color: #fff0c0 !important;
    }
    .gov-tier-btn:disabled { opacity: 0.35; cursor: not-allowed; }
    .gov-tier-btn:active:not(:disabled) { transform: scale(0.96); }

    /* ── Responsive ── */
    @media (max-width: 720px) {
      .prov-layout { flex-direction: column !important; }
      .prov-ledger { flex: 1 1 auto !important; min-width: 0 !important; }
      .prov-detail { max-height: none !important; }
      .inv-grid { grid-template-columns: repeat(2, 1fr) !important; }
    }
    @media (max-width: 400px) {
      .inv-grid { grid-template-columns: 1fr !important; }
    }

    /* ── Tax sliders ── */
    .tax-section {
      display: flex; flex-direction: column; gap: 12px;
      padding: 14px 0;
      border-top: 1px solid var(--color-border-subtle);
      border-bottom: 1px solid var(--color-border-subtle);
    }
    input[type=range].tax-slider {
      -webkit-appearance: none;
      appearance: none;
      width: 100%; height: 4px;
      background: rgba(180, 160, 100, 0.18);
      border-radius: 2px;
      outline: none;
      cursor: pointer;
    }
    input[type=range].tax-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 16px; height: 16px;
      border-radius: 50%;
      background: var(--color-gold-primary);
      border: 2px solid rgba(20, 18, 36, 0.9);
      box-shadow: 0 0 6px rgba(240, 208, 128, 0.4);
      cursor: pointer;
      transition: transform var(--duration-fast) var(--ease-default),
                  box-shadow var(--duration-fast) var(--ease-default);
    }
    input[type=range].tax-slider::-webkit-slider-thumb:hover {
      transform: scale(1.2);
      box-shadow: 0 0 10px rgba(240, 208, 128, 0.6);
    }
    input[type=range].tax-slider::-moz-range-thumb {
      width: 16px; height: 16px;
      border-radius: 50%;
      background: var(--color-gold-primary);
      border: 2px solid rgba(20, 18, 36, 0.9);
      cursor: pointer;
    }
    input[type=range].tax-slider:focus-visible {
      outline: 2px solid var(--color-gold-primary);
      outline-offset: 4px;
      border-radius: 2px;
    }
    .tax-preview { animation: prov-fade-in var(--duration-fast) var(--ease-default); }
    .tax-apply-btn {
      transition: all var(--duration-fast) var(--ease-default); cursor: pointer;
    }
    .tax-apply-btn:hover {
      border-color: var(--color-gold-primary) !important;
      background: rgba(80, 60, 20, 0.55) !important;
      color: var(--color-gold-primary) !important;
    }
    .tax-apply-btn:active { transform: scale(0.97); }
    .tax-reset-btn {
      transition: color var(--duration-fast) var(--ease-default); cursor: pointer;
      background: none; border: none; padding: 0;
    }
    .tax-reset-btn:hover { color: var(--color-text-primary) !important; }

    /* ── Province Administration panel ── */
    .pa-admin { border: 1px solid var(--color-border-default); border-radius: var(--radius-md); background: linear-gradient(90deg, rgba(40,30,60,0.45), rgba(20,16,32,0.35)); overflow: hidden; }
    .pa-admin-title-bar { text-align: center; padding: 14px 16px 0; }
    .pa-admin-title { font-family: var(--font-display); font-size: 12px; font-weight: 700; color: var(--color-gold-primary); letter-spacing: 5px; text-transform: uppercase; text-shadow: 0 1px 6px rgba(240,208,128,0.15); }
    .pa-admin-divider { height: 1px; margin-top: 10px; background: linear-gradient(90deg, transparent, var(--color-gold-secondary), transparent); }
    .pa-admin-col-labels { display: flex; justify-content: space-between; padding: 8px 16px 4px; }
    .pa-admin-col-label { font-size: 8px; font-weight: 700; color: var(--color-text-muted); letter-spacing: 2px; text-transform: uppercase; }
    .pa-admin-content { display: flex; gap: 16px; padding: 4px 16px 14px; }
    .pa-admin-vsep { width: 1px; align-self: stretch; background: linear-gradient(180deg, transparent, var(--color-border-default), transparent); }
    .pa-admin-gov { display: flex; align-items: center; gap: 12px; flex: 0 0 auto; min-width: 0; }
    .pa-admin-gov-portrait { width: 64px; height: 64px; border-radius: var(--radius-sm); background: linear-gradient(135deg, rgba(20,18,32,0.9), rgba(35,30,50,0.9)); border: 1px solid var(--color-border-default); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .pa-admin-gov-portrait-dashed { border: 1.5px dashed var(--color-border-default); background: transparent; }
    .pa-admin-gov-info { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
    .pa-admin-gov-name { font-family: var(--font-display); font-size: 12px; font-weight: 700; color: var(--color-text-primary); letter-spacing: 2px; text-transform: uppercase; }
    .pa-admin-gov-desc { font-size: 9px; color: var(--color-text-muted); line-height: 1.35; font-style: italic; }
    .pa-admin-tax { display: flex; flex-direction: column; gap: 8px; flex: 1; min-width: 0; }
    .pa-admin-rate-badge { width: 38px; height: 38px; border-radius: 50%; background: linear-gradient(135deg, rgba(60,45,15,0.9), rgba(40,30,10,0.95)); border: 2px solid var(--color-gold-secondary); display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 0 10px rgba(240,208,128,0.12); }
    .pa-admin-rate-value { font-family: var(--font-display); font-size: 11px; font-weight: 700; color: var(--color-gold-primary); }
    .pa-admin-tax-row { display: flex; flex-direction: column; gap: 2px; }
    .pa-admin-tax-row-header { display: flex; justify-content: space-between; align-items: center; }
    .pa-admin-tax-label { font-size: 9px; font-weight: 700; color: var(--color-text-secondary); text-transform: uppercase; letter-spacing: 1.2px; }
    .pa-admin-tax-badge { font-size: 8px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; padding: 1px 6px; border-radius: 3px; }
    .pa-admin-tax-track { position: relative; height: 3px; border-radius: 2px; background: rgba(180,160,100,0.1); margin: 1px 2px; }
    .pa-admin-tax-fill { position: absolute; top: 0; left: 0; height: 100%; border-radius: 2px; transition: width var(--duration-fast) var(--ease-default); }
    .pa-admin-tax-dots { position: absolute; top: 50%; left: 0; right: 0; display: flex; justify-content: space-between; transform: translateY(-50%); padding: 0 1px; }
    .pa-admin-tax-dot { width: 7px; height: 7px; border-radius: 50%; background: rgba(180,160,100,0.2); border: 1px solid rgba(180,160,100,0.3); cursor: pointer; transition: all var(--duration-fast) var(--ease-default); position: relative; z-index: 1; }
    .pa-admin-tax-dot.active { border-color: var(--color-gold-primary); box-shadow: 0 0 5px rgba(240,208,128,0.35); }
    .pa-admin-tax-dot:hover { transform: scale(1.3); }
    .pa-admin-tax-steps { display: flex; justify-content: space-between; padding: 0 1px; }
    .pa-admin-tax-step { font-size: 7px; color: var(--color-text-muted); cursor: pointer; user-select: none; transition: color var(--duration-fast); }
    .pa-admin-tax-step:hover { color: var(--color-text-secondary); }
    .pa-admin-tax-step.active { font-weight: 700; }
    .pa-admin-footer { text-align: center; padding: 8px 16px 10px; border-top: 1px solid var(--color-border-subtle); font-size: 8px; color: var(--color-text-muted); letter-spacing: 0.4px; }
    .pa-admin-footer-dot { display: inline-block; width: 5px; height: 5px; border-radius: 50%; vertical-align: middle; margin-right: 2px; }
    .pa-admin-footer-tri { display: inline-block; width: 0; height: 0; border-left: 3px solid transparent; border-right: 3px solid transparent; border-bottom: 6px solid; vertical-align: middle; margin-right: 2px; }
    .pa-admin-gov-traits { display: flex; flex-direction: column; gap: 2px; padding-top: 4px; border-top: 1px solid rgba(180,160,100,0.1); margin-top: 3px; }
    .pa-admin-gov-trait-row { display: flex; align-items: center; gap: 4px; font-size: 8px; color: var(--color-text-secondary); }
    @media (max-width: 720px) {
      .pa-admin-content { flex-direction: column; gap: 10px; }
      .pa-admin-vsep { width: auto; height: 1px; align-self: auto; background: linear-gradient(90deg, transparent, var(--color-border-default), transparent); }
    }

    /* ── Wealth tier bar ── */
    .wealth-section {
      display: flex; flex-direction: column; gap: 8px;
      padding-bottom: 14px;
    }
    /* ── Population bar ── */
    .pop-section {
      display: flex; flex-direction: column; gap: 8px;
      padding-bottom: 14px;
    }
    .pop-bar {
      position: relative; height: 10px;
      background: rgba(40, 35, 60, 0.8);
      border-radius: var(--radius-sm);
      overflow: hidden;
    }
    .pop-fill {
      height: 100%;
      border-radius: var(--radius-sm);
      transition: width var(--duration-slow) var(--ease-default);
    }
    .pop-accumulator {
      position: absolute; top: 0; height: 100%;
      background: rgba(255, 255, 255, 0.2);
      pointer-events: none;
      transition: left var(--duration-slow) var(--ease-default),
                  width var(--duration-slow) var(--ease-default);
    }

    /* ── Province identity strip ── */
    .identity-strip {
      display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
      padding: 10px 14px;
      background: linear-gradient(90deg, rgba(24, 18, 42, 0.65), rgba(14, 10, 26, 0.5));
      border: 1px solid var(--color-border-default);
      border-left: 3px solid var(--color-border-strong);
      border-radius: var(--radius-md);
    }
    .identity-chip {
      display: flex; align-items: center; gap: 5px;
      padding: 3px 8px;
      border-radius: var(--radius-sm);
      cursor: default;
      transition: background var(--duration-fast) var(--ease-default);
    }
    .identity-chip:not(.identity-chip-empty):hover {
      background: rgba(180, 160, 100, 0.08);
    }
    .identity-chip-empty { opacity: 0.38; }
    .identity-icon { font-size: 14px; line-height: 1; }
    .identity-label {
      font-family: var(--font-display);
      font-size: var(--font-size-xs);
      font-weight: 600;
      color: var(--color-text-primary);
      letter-spacing: 1.5px;
      text-transform: uppercase;
    }
    .identity-sep {
      color: var(--color-text-muted); font-size: var(--font-size-xs);
      opacity: 0.45; user-select: none; padding: 0 2px;
    }

    /* ── Unrest section ── */
    .unrest-section {
      display: flex; flex-direction: column; gap: 8px;
      padding-bottom: 14px;
    }
    .unrest-bar {
      position: relative; height: 10px;
    }
    .unrest-bar-track {
      position: absolute; inset: 0;
      background: rgba(40, 35, 60, 0.8);
      border-radius: var(--radius-sm);
      overflow: hidden;
    }
    .unrest-fill {
      height: 100%;
      border-radius: var(--radius-sm);
      transition: width var(--duration-slow) var(--ease-default),
                  background var(--duration-normal) var(--ease-default);
    }
    .unrest-threshold-marker {
      position: absolute; top: -3px; bottom: -3px; width: 2px;
      background: rgba(255, 200, 80, 0.8);
      border-radius: 1px;
      box-shadow: 0 0 5px rgba(255, 180, 40, 0.6);
      transform: translateX(-50%);
      pointer-events: none;
    }
    @keyframes unrest-flash {
      0%, 100% { opacity: 1; }
      50%       { opacity: 0.35; }
    }
    .unrest-fill-critical {
      animation: unrest-flash 1.1s ease-in-out infinite;
    }

    /* ── Income ledger ── */
    .ledger-section {
      display: flex; flex-direction: column; gap: 5px;
      padding-bottom: 14px;
      border-bottom: 1px solid var(--color-border-subtle);
    }
    .ledger-header {
      display: flex; justify-content: space-between; align-items: center;
      cursor: pointer; user-select: none; padding: 2px 0;
    }
    .ledger-header:hover .ledger-toggle { color: var(--color-text-primary) !important; }
    .ledger-body {
      display: flex; flex-direction: column; gap: 3px;
      padding: 6px 10px 4px;
      background: rgba(16, 12, 28, 0.45);
      border: 1px solid var(--color-border-subtle);
      border-radius: var(--radius-sm);
      animation: prov-fade-in var(--duration-fast) var(--ease-default);
    }
    .ledger-divider {
      height: 1px; background: var(--color-border-subtle); margin: 3px 0;
    }
    .ledger-divider-strong {
      height: 1px; background: rgba(180, 160, 100, 0.25); margin: 4px 0;
    }

    /* ── Building grid header ── */
    .inv-grid-header {
      display: flex; justify-content: space-between; align-items: center;
    }
    .inv-slots-label {
      font-family: var(--font-display);
      font-size: var(--font-size-xs);
      color: var(--color-text-secondary);
      letter-spacing: 1px; text-transform: uppercase;
    }
    .inv-slots-value { color: var(--color-text-primary); font-weight: 700; }
    .inv-slots-full { color: var(--color-warning) !important; }

    /* ── Rubble banner ── */
    .inv-rubble-banner {
      display: flex; align-items: center; gap: 8px;
      padding: 10px 14px;
      background: rgba(140, 60, 20, 0.18);
      border: 1px solid rgba(200, 80, 40, 0.3);
      border-radius: var(--radius-sm);
      font-size: var(--font-size-sm);
      color: rgba(230, 140, 90, 0.9);
    }

    /* ── Synergy badges ── */
    .inv-synergies {
      display: flex; flex-wrap: wrap; gap: 4px;
      padding: 0 10px 8px;
    }
    .inv-syn-badge {
      display: inline-flex; align-items: center; gap: 3px;
      padding: 2px 6px; border-radius: var(--radius-sm);
      font-size: 9px; font-weight: 700;
      letter-spacing: 0.5px; text-transform: uppercase;
    }
    .inv-syn-active {
      background: rgba(80, 160, 70, 0.22);
      border: 1px solid rgba(100, 180, 80, 0.4);
      color: rgba(140, 220, 110, 0.9);
    }
    .inv-syn-potential {
      background: rgba(140, 120, 40, 0.1);
      border: 1px solid rgba(160, 140, 60, 0.2);
      color: rgba(160, 140, 80, 0.48);
    }

    /* ── Terrain-locked cards ── */
    .inv-terrain-locked {
      opacity: 0.37; filter: grayscale(0.75); cursor: default;
    }
    .inv-terrain-locked:hover {
      transform: none !important;
      border-color: var(--color-border-default) !important;
      box-shadow: none !important;
    }
    .inv-lock-reason {
      padding: 0 10px 8px;
      font-size: 9px;
      color: rgba(160, 140, 80, 0.5);
      text-align: center;
      letter-spacing: 0.5px; text-transform: uppercase;
    }

    /* ── Slot-capped cards ── */
    .inv-slot-capped .ornate-btn {
      opacity: 0.35; pointer-events: none; cursor: not-allowed;
    }
  `;
  document.head.appendChild(el);
}

// ── Synergy badge helpers (S18-07) ──

interface SynergyBadge {
  label: string;
  active: boolean;
  partnerName: string;
}

function _toTitle(slug: string): string {
  return slug.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
}

/**
 * Returns synergy badges relevant to a building card:
 * - Active badges (both buildings built) — shown bright
 * - Potential badges (this building is built, partner is not) — shown dim
 */
function getBuildingSynergies(type: string, province: Province): SynergyBadge[] {
  const builtTypes = new Set(province.investments.map(i => i.type as string));
  const isBuilt = builtTypes.has(type);
  return SYNERGY_DATA
    .filter(s => s.buildingA === type || s.buildingB === type)
    .flatMap(s => {
      const partnerSlug = s.buildingA === type ? s.buildingB : s.buildingA;
      const partnerData = INVESTMENT_DATA[partnerSlug as InvestmentType];
      const partnerName = partnerData ? partnerData.name : _toTitle(partnerSlug);
      const active = builtTypes.has(s.buildingA) && builtTypes.has(s.buildingB);
      const partnerBuilt = builtTypes.has(partnerSlug);
      if (active || (isBuilt && !partnerBuilt)) {
        return [{ label: s.label, active, partnerName }];
      }
      return [];
    });
}

/** Returns terrain names that offer a given building slug. */
function getTerrainsForBuilding(building: string): string[] {
  return (Object.entries(TERRAIN_AVAILABLE_BUILDINGS) as [string, string[]][])
    .filter(([, buildings]) => buildings.includes(building))
    .map(([terrain]) => TERRAIN_DATA[terrain as keyof typeof TERRAIN_DATA]?.name ?? _toTitle(terrain));
}



const selectedProvinceId = signal<string | null>(null);
const showGovernorPicker = signal(false);
const buildingSlotType = signal<string | null>(null);

// ── Helpers ──


function UnrestBar({ unrest, modifier, width = 60 }: { unrest: number; modifier: number; width?: number }) {
  const pct = Math.min(100, Math.max(0, unrest));
  const barColor = pct > 70 ? 'var(--color-danger)' : pct > 40 ? 'var(--color-gold-secondary)' : 'var(--color-success)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <div style={{ width: `${width}px`, height: '5px', background: 'rgba(40, 35, 60, 0.8)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: barColor, borderRadius: 'var(--radius-sm)', transition: 'width var(--duration-slow) var(--ease-default)' }} />
      </div>
      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', minWidth: '20px' }}>{unrest}</span>
      {modifier !== 0 && (
        <span style={{ fontSize: '8px', color: modifier < 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
          {modifier > 0 ? '+' : ''}{modifier}/s
        </span>
      )}
    </div>
  );
}

// ── Investment hero card ──

function InvestmentSlot({ province, type, isSlotLocked, synergyBadges }: {
  province: Province;
  type: InvestmentType;
  isSlotLocked?: boolean;
  synergyBadges?: SynergyBadge[];
}) {
  const data = INVESTMENT_DATA[type];
  const existing = province.investments.find(i => i.type === type);
  const currentLevel = existing?.level ?? 0;
  const nextLevel = getNextInvestmentLevel(province, type);
  const maxed = nextLevel === 0;
  const fColor = FACTION_COLORS[data.color];

  const nextEffect = nextLevel > 0 ? data.levels[nextLevel - 1] : null;
  const currentEffect = currentLevel > 0 ? data.levels[currentLevel - 1] : null;
  const baseCost = nextEffect?.buildCost;

  // Apply governor + scroll investment discounts for display
  const traits = getGovernorTraits(province.id);
  const governorDiscount = getInvestmentDiscount(traits, province);
  const scrollDiscount = nextInvestmentDiscount.value;
  const effectiveDiscount = Math.min(90, governorDiscount + scrollDiscount);
  const cost = baseCost && effectiveDiscount > 0 ? applyInvestmentDiscount(baseCost, effectiveDiscount) : baseCost;
  // Rubble blocks construction; slot-lock blocks new builds (not upgrades)
  const rubbleBlocked = province.rubbleTimer > 0 && currentLevel === 0;
  const affordable = cost ? canAffordCost(cost) && !rubbleBlocked && !isSlotLocked : false;

  // Force signal reads for reactivity on resource changes
  getResource('gold');
  getResource('faith');
  getResource('influence');
  getResource('momentum');

  function handleBuild() {
    if (nextLevel > 0) {
      playSfx('ui_click');
      buildInvestment(province.id, type);
      buildingSlotType.value = type;
      setTimeout(() => { buildingSlotType.value = null; }, 600);
    }
  }

  const incomeBonus = currentEffect?.incomeBonus ?? {};
  const unrestChange = currentEffect?.unrestChange ?? 0;

  // Gold formula: only for built buildings that produce gold (flat, no multipliers)
  const rawGold = (incomeBonus as Record<string, number>).gold ?? 0;
  const showGoldFormula = currentLevel > 0 && rawGold > 0;

  const investmentTooltip = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <div style={{ fontWeight: 700, color: 'var(--color-gold-primary)' }}>
        {data.name}{currentLevel > 0 ? ` Lv.${currentLevel}` : ''}
      </div>
      {currentLevel === 0 ? (
        <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
          {data.flavour}
        </div>
      ) : (
        <div>
          <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
            {currentEffect?.description ?? ''}
          </div>
          {(Object.entries(incomeBonus) as [ResourceType, number][]).map(([res, amt]) => (
            amt > 0 ? (
              <div key={res} style={{ color: 'var(--color-success)', fontSize: 'var(--font-size-xs)' }}>
                <ResourceAmount type={res} amount={amt} sign="+" iconSize={14} /> per season
              </div>
            ) : null
          ))}
          {unrestChange < 0 && (
            <div style={{ color: 'var(--color-success)', fontSize: 'var(--font-size-xs)' }}>
              {unrestChange} unrest per season
            </div>
          )}
          {showGoldFormula && (
            <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)', marginTop: '2px', fontFamily: 'var(--font-mono, monospace)' }}>
              {data.name} {ROMAN[currentLevel]}: +{rawGold}g/season
            </div>
          )}
        </div>
      )}
      {nextLevel > 0 && cost && (
        <div style={{ marginTop: '4px', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>
          {currentLevel === 0 ? 'Build' : `Upgrade to Lv.${nextLevel}`}: <CostInline cost={cost} iconSize={14} />
        </div>
      )}
      {isSlotLocked && (
        <div style={{ marginTop: '4px', color: 'var(--color-warning)', fontSize: 'var(--font-size-xs)' }}>
          ⚠ Building slots full — grow population to unlock more
        </div>
      )}
    </div>
  );

  const heroBg = currentLevel > 0
    ? `radial-gradient(ellipse at center, ${fColor}28 0%, transparent 70%), linear-gradient(180deg, rgba(40, 32, 60, 0.7), rgba(18, 14, 32, 0.95))`
    : `linear-gradient(180deg, rgba(40, 32, 60, 0.5), rgba(18, 14, 32, 0.85))`;

  const slotCapped = isSlotLocked && currentLevel === 0;

  return (
    <Tooltip content={investmentTooltip} variant="rich" position="above">
      <div
        class={`inv-card${currentLevel === 0 ? ' inv-locked' : ''}${buildingSlotType.value === type ? ' inv-slot-building' : ''}${slotCapped ? ' inv-slot-capped' : ''}`}
        style={{ borderTop: `2px solid ${currentLevel > 0 ? fColor : 'rgba(180, 160, 100, 0.18)'}` }}
      >
        <div class="inv-hero" style={{ background: heroBg }}>
          <BuildingIcon type={type} size={64} color={currentLevel > 0 ? fColor : 'var(--color-gold-secondary)'} />
          {currentLevel > 0 && <span class="inv-level">{ROMAN[currentLevel]}</span>}
        </div>
        <div class="inv-nameplate" style={currentLevel > 0 ? { color: fColor } : undefined}>
          {data.name}
        </div>
        <div class="inv-desc">
          {currentEffect ? currentEffect.description : <em style={{ opacity: 0.7 }}>{data.flavour}</em>}
        </div>
        {synergyBadges && synergyBadges.length > 0 && (
          <div class="inv-synergies">
            {synergyBadges.map(b => (
              <span key={b.label} class={`inv-syn-badge ${b.active ? 'inv-syn-active' : 'inv-syn-potential'}`}>
                {b.active ? '⚡' : '○'} {b.label}{!b.active ? ` (+${b.partnerName})` : ''}
              </span>
            ))}
          </div>
        )}
        {!maxed && cost && (
          <button class="ornate-btn" disabled={!affordable} onClick={handleBuild}>
            {currentLevel === 0 ? 'Build' : `${ROMAN[currentLevel]} → ${ROMAN[nextLevel]}`} · <CostInline cost={cost} iconSize={14} />
          </button>
        )}
        {maxed && <div class="inv-maxed">Max Level</div>}
      </div>
    </Tooltip>
  );
}

// ── Terrain-locked building card (S18-07) ──

function LockedBuildingCard({ building }: { building: InvestmentType }) {
  const data = INVESTMENT_DATA[building];
  const fColor = FACTION_COLORS[data.color];
  const terrainNames = getTerrainsForBuilding(building).join(' / ') || '—';

  const tooltip = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <div style={{ fontWeight: 700, color: 'var(--color-gold-primary)' }}>{data.name}</div>
      <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
        {data.flavour}
      </div>
      <div style={{ color: 'rgba(200, 160, 80, 0.7)', fontSize: 'var(--font-size-xs)', marginTop: '4px' }}>
        🔒 Requires {terrainNames} terrain
      </div>
    </div>
  );

  return (
    <Tooltip content={tooltip} variant="rich" position="above">
      <div
        class="inv-card inv-locked inv-terrain-locked"
        style={{ borderTop: `2px solid rgba(180, 160, 100, 0.08)` }}
      >
        <div class="inv-hero" style={{ background: 'linear-gradient(180deg, rgba(30, 24, 48, 0.35), rgba(14, 10, 24, 0.65))' }}>
          <BuildingIcon type={building} size={64} color={`${fColor}40`} />
        </div>
        <div class="inv-nameplate" style={{ color: 'rgba(180, 160, 100, 0.4)' }}>
          {data.name}
        </div>
        <div class="inv-lock-reason">🔒 {terrainNames}</div>
      </div>
    </Tooltip>
  );
}

// ── Building grid with terrain gates + synergies (S18-07) ──

function BuildingGrid({ province }: { province: Province }) {
  const available = getAvailableBuildings(province);
  const slotMax = getBuildingSlots(province.population);
  const slotsUsed = province.investments.length;
  const slotsFull = slotsUsed >= slotMax;

  // Terrain-locked: all INVESTMENT_DATA buildings not in available
  const allBuildings = Object.keys(INVESTMENT_DATA) as InvestmentType[];
  const lockedBuildings = allBuildings.filter(b => !available.includes(b));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Rubble banner */}
      {province.rubbleTimer > 0 && (
        <div class="inv-rubble-banner">
          🔥 Construction blocked — rubble clearing ({province.rubbleTimer} season{province.rubbleTimer !== 1 ? 's' : ''} remaining)
        </div>
      )}

      {/* Slot count header */}
      <div class="inv-grid-header">
        <span class="inv-slots-label">
          Building Slots:&nbsp;
          <span class={`inv-slots-value${slotsFull ? ' inv-slots-full' : ''}`}>
            {slotsUsed}/{slotMax}
          </span>
          {slotsFull && slotsUsed < 6 && (
            <span style={{ color: 'var(--color-text-muted)', marginLeft: '6px', fontSize: 'var(--font-size-xs)', textTransform: 'none', letterSpacing: 0 }}>
              — grow to unlock more
            </span>
          )}
        </span>
      </div>

      {/* Available buildings */}
      <div class="inv-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
        {available.map(type => (
          <InvestmentSlot
            key={type}
            province={province}
            type={type}
            isSlotLocked={slotsFull && !province.investments.find(i => i.type === type)}
            synergyBadges={getBuildingSynergies(type, province)}
          />
        ))}
      </div>

      {/* Terrain-locked section */}
      {lockedBuildings.length > 0 && (
        <>
          <div style={{ height: '1px', background: 'var(--color-border-subtle)' }} />
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', letterSpacing: '1px', textTransform: 'uppercase' }}>
            🔒 Terrain-Locked
          </div>
          <div class="inv-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
            {lockedBuildings.map(type => (
              <LockedBuildingCard key={type} building={type} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Net gold income (single source of truth — matches IncomeLedger) ──

function getNetGoldIncome(province: Province): number {
  const traits = getGovernorTraits(province.id);
  const taxRate = getTaxRate(province.lowerTax, province.upperTax);
  const taxRevenue = Math.floor(province.wealth * taxRate);

  let buildingGold = 0;
  for (const inv of province.investments) {
    buildingGold += INVESTMENT_DATA[inv.type].levels[inv.level - 1].incomeBonus.gold ?? 0;
  }
  for (const syn of getActiveSynergies(province)) {
    if (syn.bonus.type === 'gold') buildingGold += (syn.bonus as { type: 'gold'; amount: number }).amount;
  }

  const subsistence = 1;
  const tradeGoodGold = province.tradeGood ? TRADE_GOOD_DATA[province.tradeGood].flatGold : 0;

  let goldTotal = taxRevenue + buildingGold + subsistence + tradeGoodGold;
  for (const trait of traits) {
    if (trait.type === 'income-bonus' && trait.resource === 'gold') {
      goldTotal = Math.floor(goldTotal * (1 + trait.percent / 100));
    }
  }

  const expenses = getProvinceExpenses(province, traits) + getGovernorSalary(province.id);
  return goldTotal - expenses;
}

// ── Province ledger row ──

function ProvinceRow({ province, selected }: { province: Province; selected: boolean }) {
  const traits = getGovernorTraits(province.id);
  const unrestMod = getUnrestModifier(province, traits);
  const invCount = province.investments.length;
  const slotMax = getBuildingSlots(province.population);

  const netGold = getNetGoldIncome(province);
  const netWealthChange = calculateNetWealthChange(province, province.terrain);

  const settlementLabel = getSettlementLabel(province.population);
  const terrainIcon = TERRAIN_ICONS[province.terrain] ?? '?';
  const tradeIcon = province.tradeGood ? (TRADE_GOOD_ICONS[province.tradeGood] ?? '') : '';
  const governor = getAssignedGovernor(province.id);

  const unrestColor =
    province.unrest < 40 ? 'var(--color-success)'
    : province.unrest < 70 ? 'var(--color-warning)'
    : 'var(--color-danger)';
  const wealthTrendColor = netWealthChange > 0.3 ? 'var(--color-success)' : netWealthChange < -0.3 ? 'var(--color-danger)' : 'var(--color-text-muted)';
  const netGoldColor = netGold > 0 ? 'var(--color-success)' : netGold < 0 ? 'var(--color-danger)' : 'var(--color-text-muted)';

  const rowTooltip = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <div style={{ fontWeight: 700, color: 'var(--color-gold-primary)', marginBottom: '2px' }}>
        {province.name}
      </div>
      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
        {terrainIcon} {province.terrain}{tradeIcon ? ` · ${tradeIcon} ${province.tradeGood}` : ''}
      </div>
      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
        Wealth: {province.wealth} ({netWealthChange >= 0 ? '+' : ''}{netWealthChange.toFixed(1)}/s)
      </div>
      <div style={{ fontSize: 'var(--font-size-xs)', color: unrestColor }}>
        Unrest: {province.unrest}/100
      </div>
      {invCount > 0 && (
        <div style={{ marginTop: '3px', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>
          {province.investments.map(inv => `${INVESTMENT_DATA[inv.type].name} ${ROMAN[inv.level]}`).join(' · ')}
        </div>
      )}
    </div>
  );

  return (
    <div style={{ display: 'contents' }}>
      <Tooltip content={rowTooltip} variant="rich" position="right">
        <div
          class={`prov-row${selected ? ' prov-row-selected' : ''}`}
          onClick={() => { selectedProvinceId.value = province.id; }}
          style={{
            padding: '10px 12px',
            borderRadius: 'var(--radius-md)',
            background: selected ? 'rgba(80, 60, 20, 0.35)' : 'rgba(20, 16, 32, 0.5)',
            border: `1px solid ${selected ? 'var(--color-gold-primary)' : 'var(--color-border-default)'}`,
            display: 'flex', flexDirection: 'column', gap: '5px',
            cursor: 'pointer',
          }}
        >
          {/* Row 1: name + terrain+trade icons */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{
              fontFamily: 'var(--font-display)', fontSize: 'var(--font-size-md)', fontWeight: 600,
              color: selected ? 'var(--color-gold-primary)' : 'var(--color-text-primary)',
              letterSpacing: '2px', textTransform: 'uppercase',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
            }}>
              {province.name}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0, marginLeft: '6px' }}>
              <span style={{ fontSize: '12px' }} title={province.terrain}>{terrainIcon}</span>
              {tradeIcon && <span style={{ fontSize: '12px' }} title={province.tradeGood ?? ''}>{tradeIcon}</span>}
              {governor && <span style={{ fontSize: '10px', marginLeft: '2px' }} title={governor.governor.name}>⚔️</span>}
            </div>
          </div>

          {/* Row 2: wealth + wealth trend + pop */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: 'var(--font-size-xs)', color: 'var(--color-gold-primary)', fontWeight: 700 }}>
              🪙 {Math.round(province.wealth)}
            </span>
            <span style={{ fontSize: '9px', color: wealthTrendColor }}>
              {netWealthChange >= 0 ? '+' : ''}{netWealthChange.toFixed(1)}/s
            </span>
            <span style={{ fontSize: '9px', color: 'var(--color-border-default)' }}>·</span>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
              👥 {province.population} <span style={{ color: 'var(--color-text-muted)', fontSize: '9px' }}>{settlementLabel}</span>
            </span>
            <span style={{ marginLeft: 'auto', fontSize: '9px', color: 'var(--color-text-muted)' }}>
              {invCount}/{slotMax} □
            </span>
          </div>

          {/* Row 3: unrest bar + net gold */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ flex: 1 }}>
              <UnrestBar unrest={province.unrest} modifier={unrestMod} width={80} />
            </div>
            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: netGoldColor, whiteSpace: 'nowrap', flexShrink: 0 }}>
              {netGold >= 0 ? '+' : ''}{netGold}g
            </span>
          </div>
        </div>
      </Tooltip>
    </div>
  );
}

// ── Governor picker (modal content) ──

function GovernorPicker({ provinceId }: { provinceId: string }) {
  const pool = governorPool.value;

  // Force signal reads for reactivity
  getResource('gold');
  getResource('faith');
  getResource('influence');
  getResource('momentum');

  if (pool.length === 0) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
        All governors assigned to other provinces
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingBottom: '8px', animation: 'prov-fade-in var(--duration-fast) var(--ease-default)' }}>
      {pool.map(gov => {
        const fColor = FACTION_COLORS[gov.color];
        return (
          <div
            key={gov.id}
            class="gov-picker-card"
            style={{
              background: 'linear-gradient(90deg, rgba(30, 24, 50, 0.7), rgba(18, 14, 32, 0.85))',
              border: '1px solid var(--color-border-default)',
              borderLeft: `3px solid ${fColor}`,
              borderRadius: 'var(--radius-md)',
              padding: '12px 14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <div style={{
                width: '28px', height: '28px', borderRadius: '50%',
                background: `${fColor}22`, border: `2px solid ${fColor}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-display)', fontSize: 'var(--font-size-md)', fontWeight: 700, color: fColor,
              }}>
                {gov.name[0]}
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'var(--font-size-md)',
                  fontWeight: 600,
                  color: fColor,
                  letterSpacing: '2px',
                  textTransform: 'uppercase',
                }}
              >
                {gov.name}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {([1, 2, 3] as const).map(tier => {
                const cost = getHireCost(gov, tier);
                const affordable = canAffordCost(cost);
                const tierData = gov.tiers[tier - 1];
                return (
                  <button
                    key={tier}
                    class="gov-tier-btn"
                    disabled={!affordable}
                    onClick={() => {
                      hireGovernor(gov.id, provinceId, tier);
                      showGovernorPicker.value = false;
                    }}
                    title={tierData.description}
                    style={{
                      flex: '1 1 0', minWidth: '100px',
                      padding: '8px 8px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'rgba(50, 42, 12, 0.5)',
                      border: '1px solid var(--color-border-strong)',
                      color: 'var(--color-gold-primary)',
                      fontFamily: 'inherit',
                      fontSize: 'var(--font-size-xs)', fontWeight: 600,
                      letterSpacing: '0.5px', textTransform: 'uppercase',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <span class="gov-tier-pill">{ROMAN[tier]}</span>
                      Tier {ROMAN[tier]}
                    </span>
                    <span style={{ fontSize: '8px', opacity: 0.6, fontWeight: 400, textTransform: 'none', lineHeight: '1.3', textAlign: 'center' }}>
                      {tierData.description.split(' ').slice(0, 6).join(' ')}
                    </span>
                    <span style={{ fontSize: '9px', color: 'var(--color-gold-secondary)', fontWeight: 700 }}><CostInline cost={cost} iconSize={13} /></span>
                    <span style={{ fontSize: '8px', color: 'rgba(230, 130, 80, 0.75)', fontWeight: 600, textTransform: 'none', letterSpacing: 0 }}>then {tier}g/season</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Governor panel helpers (S18-08) ──

/**
 * Format a governor trait as a concrete, province-specific human-readable string.
 * For garrison-strength, shows the Castrum's actual unrest values if built.
 */
function formatTraitEffect(trait: GovernorTrait, province: Province): string {
  switch (trait.type) {
    case 'population-growth':
      return `Growth: +${trait.amount}/season`;
    case 'unrest-reduction':
      return `Unrest: -${trait.flat}/season`;
    case 'income-bonus': {
      const icon = RESOURCE_INFO[trait.resource]?.icon ?? trait.resource;
      return `+${trait.percent}% ${icon} ${trait.resource} income`;
    }
    case 'expense-reduction':
      return `-${trait.percent}% upkeep`;
    case 'investment-discount':
      return `-${trait.percent}% building costs`;
    case 'garrison-strength': {
      const castrumInv = province.investments.find(i => i.type === 'castrum');
      if (castrumInv) {
        const base = INVESTMENT_DATA.castrum.levels[castrumInv.level - 1].unrestChange;
        const mult = 1 + trait.percent / 100;
        const boosted = Math.round(base * mult * 10) / 10;
        return `Castrum: ${base} → ${boosted} unrest/s (×${mult.toFixed(2)})`;
      }
      return `+${trait.percent}% garrison strength`;
    }
  }
}


// ── Settlement color by pop ──

function getSettlementColor(pop: number): string {
  if (pop <= 2)  return 'var(--color-text-secondary)';
  if (pop <= 4)  return '#68a860';
  if (pop <= 6)  return 'var(--color-success)';
  if (pop <= 8)  return 'var(--color-gold-secondary)';
  if (pop <= 10) return 'var(--color-gold-primary)';
  return 'var(--color-warning)'; // Metropolis
}

// ── Population bar ──

// ── Stat panel SVG icons ──

function CoinSVG() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6.5" fill="rgba(180,130,10,0.25)" stroke="#d4a843" strokeWidth="1"/>
      <circle cx="8" cy="8" r="4" fill="rgba(180,130,10,0.15)" stroke="rgba(240,208,128,0.4)" strokeWidth="0.5"/>
      {/* Two pillars + top/bottom beams (Roman column motif) */}
      <rect x="5.5" y="4.2" width="5" height="0.9" rx="0.3" fill="#f0d080"/>
      <rect x="5.5" y="10.9" width="5" height="0.9" rx="0.3" fill="#f0d080"/>
      <rect x="6.3" y="5.1" width="0.9" height="5.8" fill="#f0d080"/>
      <rect x="8.8" y="5.1" width="0.9" height="5.8" fill="#f0d080"/>
    </svg>
  );
}

function PeopleSVG() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      {/* Back person (slightly right + darker) */}
      <circle cx="9.5" cy="5.2" r="2.1" fill="#7070b8"/>
      <path d="M5.8 14.5 Q5.8 10 9.5 10 Q13.2 10 13.2 14.5" fill="#7070b8"/>
      {/* Front person (slightly left + lighter) */}
      <circle cx="6.5" cy="5.8" r="2.1" fill="#a0a0d8"/>
      <path d="M2.8 14.5 Q2.8 10 6.5 10 Q10.2 10 10.2 14.5" fill="#a0a0d8"/>
    </svg>
  );
}

function ScalesSVG() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      {/* Pole */}
      <rect x="7.6" y="3" width="0.9" height="9.5" rx="0.3" fill="#a0a0d8"/>
      {/* Base */}
      <rect x="5" y="12" width="6" height="0.9" rx="0.4" fill="#a0a0d8"/>
      {/* Beam */}
      <rect x="2.5" y="5.8" width="11" height="0.9" rx="0.4" fill="#a0a0d8"/>
      {/* Left strings */}
      <line x1="3.2" y1="6.7" x2="2.4" y2="9.5" stroke="#a0a0d8" strokeWidth="0.7"/>
      <line x1="5.5" y1="6.7" x2="6.3" y2="9.5" stroke="#a0a0d8" strokeWidth="0.7"/>
      {/* Left pan */}
      <path d="M2 9.5 Q4.3 11 6.7 9.5" stroke="#a0a0d8" strokeWidth="0.9" fill="none"/>
      {/* Right strings */}
      <line x1="10.5" y1="6.7" x2="9.7" y2="9.5" stroke="#a0a0d8" strokeWidth="0.7"/>
      <line x1="12.8" y1="6.7" x2="13.6" y2="9.5" stroke="#a0a0d8" strokeWidth="0.7"/>
      {/* Right pan */}
      <path d="M9.3 9.5 Q11.6 11 14 9.5" stroke="#a0a0d8" strokeWidth="0.9" fill="none"/>
    </svg>
  );
}

// ── Shared stat panel header: [BADGE] ─── TITLE ─── [BADGE] ──
function StatPanelHeader({ title, icon }: { title: string; icon?: ComponentChildren }) {
  const badgeStyle = {
    width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0,
    background: 'linear-gradient(145deg, rgba(44,38,64,0.96), rgba(18,14,30,0.98))',
    border: '1.5px solid var(--color-gold-secondary)',
    boxShadow: '0 0 5px rgba(212,168,67,0.18), inset 0 1px 0 rgba(240,208,128,0.08)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  } as const;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '9px' }}>
      {icon ? <div style={badgeStyle}>{icon}</div> : <div style={{ flex: 0, width: '4px' }} />}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '5px' }}>
        <div style={{ flex: 1, height: '1px', background: 'var(--color-border-default)' }} />
        <span style={{
          fontFamily: 'var(--font-display)', fontSize: '7px', fontWeight: 700,
          letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--color-text-muted)',
          whiteSpace: 'nowrap',
        }}>
          {title}
        </span>
        <div style={{ flex: 1, height: '1px', background: 'var(--color-border-default)' }} />
      </div>
      {icon ? <div style={badgeStyle}>{icon}</div> : <div style={{ flex: 0, width: '4px' }} />}
    </div>
  );
}

function PopBar({ province }: { province: Province }) {
  const traits = getGovernorTraits(province.id);
  const settlementLabel = getSettlementLabel(province.population);
  const slotMax = getBuildingSlots(province.population);
  const builtCount = province.investments.length;

  const foodProd = calculateFoodProduction(province, traits);
  const foodEffective = calculateEffectiveFoodProduction(province, traits);
  const foodCons = calculateFoodConsumption(province);
  const foodSurplus = calculateFoodSurplus(province, traits);
  const beautiness = calculateBeautiness(province);

  const threshold = calculateGrowthThreshold(province.population);
  const accum = Math.min(province.growthAccumulator, threshold);
  const accumPct = threshold > 0 ? accum / threshold : 0;

  // Seasons until next pop point (only if surplus > 0)
  const remaining = threshold - accum;
  const seasonsToNext = foodSurplus > 0
    ? Math.ceil(remaining / foodSurplus)
    : null;

  // Bar geometry — scale relative to a visual reference (10 pops = full bar)
  const barRef = Math.max(10, province.population);
  const popFillPct = Math.min(province.population / barRef, 1) * 100;
  const accumWidthPct = (accumPct / barRef) * 100;

  const settlementColor = getSettlementColor(province.population);

  const surplusColor = foodSurplus > 0 ? 'var(--color-success)' : foodSurplus < 0 ? 'var(--color-danger)' : 'var(--color-text-muted)';

  const tooltipContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <div style={{ fontWeight: 700, color: settlementColor }}>
        {settlementLabel} — Pop {province.population}
      </div>
      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
        Food: {foodProd.toFixed(0)} produced{foodEffective < foodProd ? ` (${foodEffective.toFixed(1)} after tax)` : ''} — {foodCons} consumed
      </div>
      <div style={{ fontSize: 'var(--font-size-xs)', color: surplusColor }}>
        Surplus: {foodSurplus >= 0 ? '+' : ''}{foodSurplus.toFixed(1)} {foodSurplus > 0 ? '(growing)' : foodSurplus < 0 ? '(starving!)' : '(equilibrium)'}
      </div>
      {beautiness > 0 && (
        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-gold-secondary)' }}>
          Beautiness: {beautiness}% — immigration chance
        </div>
      )}
      {province.famineTimer > 0 && (
        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-danger)', fontWeight: 700 }}>
          {province.famineTimer >= FOOD.famineHardThreshold ? 'FAMINE — losing population!' : `Food shortage: ${province.famineTimer} season${province.famineTimer > 1 ? 's' : ''}`}
        </div>
      )}
      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: '2px' }}>
        Growth threshold: {threshold} ({accum.toFixed(1)} accumulated) — Slots: {builtCount}/{slotMax}
      </div>
    </div>
  );

  const growthColor = surplusColor;
  const growthArrow = foodSurplus > 0 ? '↑' : foodSurplus < 0 ? '↓' : '→';

  return (
    <Tooltip content={tooltipContent} variant="rich" position="above" align="start">
      <div class="pop-section">
        <StatPanelHeader title="Settlement Population" icon={<PeopleSVG />} />

        {/* Hero + breakdown rows */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '6px' }}>
          {/* Left: icon + pop number */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px', flexShrink: 0 }}>
            <span style={{ fontSize: '22px', lineHeight: 1 }}>👥</span>
            <span style={{
              fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 700,
              color: settlementColor, lineHeight: 1,
            }}>
              {province.population}
            </span>
          </div>

          {/* Right: stacked rows */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', paddingTop: '2px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '8px', letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Settlement</span>
              <span style={{ fontSize: 'var(--font-size-xs)', color: settlementColor, fontWeight: 700 }}>
                {settlementLabel}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '8px', letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Slots</span>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                {builtCount} / {slotMax}
              </span>
            </div>
            {beautiness > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '8px', letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Beauty</span>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-gold-secondary)', fontWeight: 600 }}>
                  {beautiness}%
                </span>
              </div>
            )}
            {province.famineTimer > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '8px', letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--color-danger)' }}>Famine</span>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-danger)', fontWeight: 700 }}>
                  {province.famineTimer >= FOOD.famineHardThreshold ? 'CRITICAL' : `${province.famineTimer}s`}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Fill bar */}
        <div class="pop-bar" style={{ marginBottom: '5px' }}>
          <div class="pop-fill" style={{ width: `${popFillPct}%`, background: settlementColor }} />
          {accumWidthPct > 0 && (
            <div class="pop-accumulator" style={{ left: `${popFillPct}%`, width: `${accumWidthPct}%` }} />
          )}
        </div>

        {/* Footer rate line */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderTop: '1px solid var(--color-border-subtle)', paddingTop: '5px',
          fontSize: '9px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase',
        }}>
          <span style={{ color: growthColor }}>
            Food: {foodSurplus >= 0 ? '+' : ''}{foodSurplus.toFixed(1)} {growthArrow}
          </span>
          <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>
            {seasonsToNext !== null ? `Next in ${seasonsToNext}s` : 'No growth'}
          </span>
        </div>
      </div>
    </Tooltip>
  );
}

// ── Wealth display (ETW-style accumulative) ──

function WealthDisplay({ province }: { province: Province }) {
  const netChange = calculateNetWealthChange(province, province.terrain);
  const taxRate = getTaxRate(province.lowerTax, province.upperTax);
  const taxRevenue = Math.floor(province.wealth * taxRate);

  const isGrowing  = netChange >  0.5;
  const isShrinking = netChange < -0.5;
  const trendArrow = isGrowing ? '↑' : isShrinking ? '↓' : '→';
  const trendColor = isGrowing
    ? 'var(--color-success)'
    : isShrinking
    ? 'var(--color-danger)'
    : 'var(--color-text-muted)';

  const tooltipContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <div style={{ fontWeight: 700, color: 'var(--color-gold-primary)' }}>
        Provincial Wealth
      </div>
      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
        Tax revenue: {Math.round(province.wealth)} x {formatTaxRate(taxRate)} ={' '}
        <strong style={{ color: 'var(--color-gold-primary)' }}>+{taxRevenue}g</strong>
      </div>
      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
        Growth: {netChange >= 0 ? '+' : ''}{netChange.toFixed(1)}/season
      </div>
      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
        Higher taxes extract more gold but drain wealth faster
      </div>
    </div>
  );

  return (
    <Tooltip content={tooltipContent} variant="rich" position="above" align="start">
      <div class="wealth-section">
        <StatPanelHeader title="Wealth Economy" icon={<CoinSVG />} />

        {/* Hero + breakdown rows */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '6px' }}>
          {/* Left: coin + number */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px', flexShrink: 0 }}>
            <span style={{ fontSize: '22px', lineHeight: 1 }}>🪙</span>
            <span style={{
              fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 700,
              color: 'var(--color-gold-primary)', lineHeight: 1,
            }}>
              {Math.round(province.wealth)}
            </span>
          </div>

          {/* Right: stacked rows */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', paddingTop: '2px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '8px', letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
                Seasonal
              </span>
              <span style={{ fontSize: 'var(--font-size-xs)', color: trendColor, fontWeight: 600 }}>
                {netChange >= 0 ? '+' : ''}{netChange.toFixed(1)}/s {trendArrow}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '8px', letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
                Taxes
              </span>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                x{formatTaxRate(taxRate)}
              </span>
            </div>
          </div>
        </div>

        {/* Footer: net income */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          borderTop: '1px solid var(--color-border-subtle)', paddingTop: '5px',
          fontSize: '9px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase',
        }}>
          <span style={{ color: 'var(--color-text-muted)' }}>Net Income</span>
          <span style={{ color: 'var(--color-success)', fontSize: 'var(--font-size-xs)' }}>
            +{taxRevenue}g/season
          </span>
        </div>
      </div>
    </Tooltip>
  );
}


// ── Province identity strip ──

export const TERRAIN_ICONS: Record<string, string> = {
  farmland:  '🌾',
  hills:     '⛰️',
  coast:     '🌊',
  forest:    '🌲',
  plains:    '🏕️',
  mountains: '🏔️',
  marsh:     '🌿',
  desert:    '🏜️',
};

export const TRADE_GOOD_ICONS: Record<string, string> = {
  grain:    '🌾',
  iron:     '⚙️',
  silk:     '🧵',
  marble:   '🏛️',
  wine:     '🍷',
  timber:   '🪵',
  fish:     '🐟',
  horses:   '🐴',
  gold_ore: '⛏️',
  incense:  '🕯️',
  salt:     '🧂',
  olives:   '🫒',
};

function formatSlug(slug: string): string {
  return slug.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
}

function IdentityStrip({ province }: { province: Province }) {
  const terrain   = TERRAIN_DATA[province.terrain];
  const tradeGood = province.tradeGood ? TRADE_GOOD_DATA[province.tradeGood] : null;

  // ── Terrain tooltip ──
  const mods = terrain.baseModifiers;
  interface ModRow { icon: string; label: string; value: string; positive: boolean }
  const modRows: ModRow[] = [];
  if (mods.growthModifier !== 0) modRows.push({ icon: '👥', label: 'Pop Growth',    value: `${mods.growthModifier > 0 ? '+' : ''}${mods.growthModifier}/s`, positive: mods.growthModifier > 0 });
  if (mods.pwgModifier    !== 0) modRows.push({ icon: '💰', label: 'Wealth Growth',  value: `${mods.pwgModifier > 0 ? '+' : ''}${mods.pwgModifier}/s`,    positive: mods.pwgModifier > 0 });
  if (mods.faithBonus     !== 0) modRows.push({ icon: '✦',  label: 'Faith',         value: `+${mods.faithBonus}/s`,                                         positive: true });
  if (mods.momentumBonus  !== 0) modRows.push({ icon: '⚡', label: 'Momentum',      value: `+${mods.momentumBonus}/s`,                                      positive: true });
  if (mods.garrisonBonus  !== 0) modRows.push({ icon: '🛡', label: 'Garrison',      value: `+${mods.garrisonBonus}`,                                        positive: true });

  const terrainTooltip = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', paddingBottom: '8px', borderBottom: '1px solid var(--color-border-subtle)', marginBottom: '8px' }}>
        <span style={{ fontSize: '22px', lineHeight: '1', flexShrink: 0, marginTop: '1px' }}>
          {TERRAIN_ICONS[province.terrain]}
        </span>
        <div>
          <div style={{
            fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 700,
            color: 'var(--color-gold-primary)', letterSpacing: '2px', textTransform: 'uppercase',
          }}>
            {terrain.name}
          </div>
          <div style={{
            fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)',
            fontStyle: 'italic', lineHeight: '1.45', marginTop: '3px',
          }}>
            {terrain.flavour}
          </div>
        </div>
      </div>

      {/* Modifiers */}
      {modRows.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: terrain.exclusiveBuildings.length > 0 ? '8px' : '0' }}>
          {modRows.map(row => (
            <div key={row.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                <span style={{ fontSize: '11px', opacity: 0.75 }}>{row.icon}</span>
                {row.label}
              </span>
              <span style={{
                fontSize: 'var(--font-size-xs)', fontWeight: 700,
                color: row.positive ? 'var(--color-success)' : 'var(--color-danger)',
                background: row.positive ? 'rgba(90,138,74,0.15)' : 'rgba(194,74,58,0.15)',
                border: `1px solid ${row.positive ? 'rgba(90,138,74,0.3)' : 'rgba(194,74,58,0.3)'}`,
                borderRadius: '3px', padding: '1px 5px', whiteSpace: 'nowrap', flexShrink: 0,
              }}>
                {row.value}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Unlocks */}
      {terrain.exclusiveBuildings.length > 0 && (
        <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: '7px' }}>
          <div style={{
            fontSize: '8px', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase',
            color: 'var(--color-text-muted)', marginBottom: '5px',
          }}>
            Unlocks
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {terrain.exclusiveBuildings.map(b => (
              <span key={b} style={{
                fontSize: 'var(--font-size-xs)', padding: '2px 7px',
                background: 'rgba(180,160,100,0.08)',
                border: '1px solid var(--color-border-default)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--color-text-secondary)',
              }}>
                {formatSlug(b)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // ── Trade good tooltip ──
  const tradeGoodTooltip = tradeGood ? (() => {
    interface TGRow { icon: string; label: string; value: string }
    const rows: TGRow[] = [];
    if (tradeGood.flatGold          > 0) rows.push({ icon: '🪙', label: 'Gold',         value: `+${tradeGood.flatGold}g/s` });
    if (tradeGood.flatGrowth        > 0) rows.push({ icon: '👥', label: 'Pop Growth',   value: `+${tradeGood.flatGrowth}/s` });
    if (tradeGood.flatFaith         > 0) rows.push({ icon: '✦',  label: 'Faith',        value: `+${tradeGood.flatFaith}/s` });
    if (tradeGood.flatMomentum      > 0) rows.push({ icon: '⚡', label: 'Momentum',     value: `+${tradeGood.flatMomentum}/s` });
    if (tradeGood.wealthGrowthBonus > 0) rows.push({ icon: '💰', label: 'Wealth Growth',value: `+${tradeGood.wealthGrowthBonus}/s` });

    const specialLine = (() => {
      const s = tradeGood.special;
      if (!s) return null;
      switch (s.type) {
        case 'pop-cap-bonus':       return `+${s.amount} max population`;
        case 'build-cost-discount': return `-${s.percent}% building costs`;
        case 'unrest-reduction':    return `-${s.amount} unrest/season`;
        case 'enables-building':    return `Enables ${formatSlug(s.building)}`;
        case 'cavalry-bonus':       return 'Cavalry bonus in battle';
      }
    })();

    const hasContent = rows.length > 0 || specialLine;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', paddingBottom: hasContent ? '8px' : '0', borderBottom: hasContent ? '1px solid var(--color-border-subtle)' : 'none', marginBottom: hasContent ? '8px' : '0' }}>
          <span style={{ fontSize: '22px', lineHeight: '1', flexShrink: 0, marginTop: '1px' }}>
            {TRADE_GOOD_ICONS[province.tradeGood!] ?? '📦'}
          </span>
          <div>
            <div style={{
              fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 700,
              color: 'var(--color-gold-primary)', letterSpacing: '2px', textTransform: 'uppercase',
            }}>
              {tradeGood.name}
            </div>
            <span style={{
              display: 'inline-block', marginTop: '4px',
              fontSize: '8px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase',
              padding: '1px 5px', borderRadius: '3px',
              background: 'rgba(100, 70, 150, 0.35)', color: '#c0a0f0',
              border: '1px solid rgba(150,100,220,0.3)',
            }}>
              Flat Income
            </span>
          </div>
        </div>

        {/* Bonus rows */}
        {rows.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: specialLine ? '8px' : '0' }}>
            {rows.map(row => (
              <div key={row.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                  <span style={{ fontSize: '11px', opacity: 0.75 }}>{row.icon}</span>
                  {row.label}
                </span>
                <span style={{
                  fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-success)',
                  background: 'rgba(90,138,74,0.15)', border: '1px solid rgba(90,138,74,0.3)',
                  borderRadius: '3px', padding: '1px 5px', whiteSpace: 'nowrap', flexShrink: 0,
                }}>
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Special ability */}
        {specialLine && (
          <div style={{
            borderTop: rows.length > 0 ? '1px solid var(--color-border-subtle)' : 'none',
            paddingTop: rows.length > 0 ? '7px' : '0',
            display: 'flex', alignItems: 'center', gap: '6px',
          }}>
            <span style={{
              fontSize: '8px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase',
              padding: '2px 5px', borderRadius: '3px',
              background: 'rgba(240,208,128,0.12)', color: 'var(--color-gold-secondary)',
              border: '1px solid rgba(240,208,128,0.25)', flexShrink: 0,
            }}>
              Special
            </span>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-gold-secondary)' }}>
              {specialLine}
            </span>
          </div>
        )}
      </div>
    );
  })() : null;

  return (
    <div class="identity-strip">
      {/* Terrain */}
      <Tooltip content={terrainTooltip} variant="rich" position="below" align="start">
        <div class="identity-chip">
          <span class="identity-icon">{TERRAIN_ICONS[province.terrain] ?? '?'}</span>
          <span class="identity-label">{terrain.name}</span>
        </div>
      </Tooltip>

      <span class="identity-sep">·</span>

      {/* Trade good */}
      {tradeGood && tradeGoodTooltip ? (
        <Tooltip content={tradeGoodTooltip} variant="rich" position="below" align="start">
          <div class="identity-chip">
            <span class="identity-icon">{TRADE_GOOD_ICONS[province.tradeGood!] ?? '?'}</span>
            <span class="identity-label">{tradeGood.name}</span>
          </div>
        </Tooltip>
      ) : (
        <div class="identity-chip identity-chip-empty">
          <span class="identity-icon">—</span>
          <span class="identity-label" style={{ color: 'var(--color-text-muted)' }}>No Trade Good</span>
        </div>
      )}

      <span class="identity-sep">·</span>

      {/* Unique feature (S19) */}
      {province.uniqueFeature ? (
        <Tooltip
          content={(() => {
            const f = province.uniqueFeature!;
            const rows: string[] = [];
            if (f.goldPerSeason) rows.push(`${f.goldPerSeason > 0 ? '+' : ''}${f.goldPerSeason} Gold/season`);
            if (f.foodPerSeason) rows.push(`+${f.foodPerSeason} Food/season`);
            if (f.faithPerSeason) rows.push(`+${f.faithPerSeason} Faith/season`);
            if (f.influencePerSeason) rows.push(`+${f.influencePerSeason} Influence/season`);
            if (f.momentumPerSeason) rows.push(`+${f.momentumPerSeason} Momentum/season`);
            if (f.unrestPerSeason) rows.push(`${f.unrestPerSeason} Unrest/season`);
            if (f.beautinessBonus) rows.push(`+${f.beautinessBonus}% Beautiness`);
            if (f.buildCostDiscount) rows.push(`-${f.buildCostDiscount}% Build Cost`);
            if (f.wealthGrowthBonus) rows.push(`+${f.wealthGrowthBonus} Wealth Growth`);
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ fontWeight: 700, color: 'var(--color-gold-primary)' }}>{f.name}</div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>{f.flavour}</div>
                {rows.length > 0 && (
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)', marginTop: '2px' }}>
                    {rows.join(' · ')}
                  </div>
                )}
              </div>
            );
          })()}
          variant="rich"
          position="below"
        >
          <div class="identity-chip">
            <span class="identity-icon">🏛️</span>
            <span class="identity-label">{province.uniqueFeature.name}</span>
          </div>
        </Tooltip>
      ) : (
        <div class="identity-chip identity-chip-empty">
          <span class="identity-icon">🏛️</span>
          <span class="identity-label" style={{ color: 'var(--color-text-muted)' }}>No Feature</span>
        </div>
      )}
    </div>
  );
}

// ── Unrest section ──

function UnrestSection({ province }: { province: Province }) {
  const traits = getGovernorTraits(province.id);
  const delta         = calculateUnrestDelta(province, traits);
  const rebelThreshold = getRebelThreshold(province);

  // Zone states
  const isCritical = province.unrest >= 70;


  // Bar fill color by zone
  const barColor = province.unrest > 60
    ? 'var(--color-danger)'
    : province.unrest > 30
    ? 'var(--color-warning)'
    : 'var(--color-success)';

  // Geometry — bar spans 0–100
  const fillPct      = Math.min(province.unrest / 100, 1) * 100;
  const thresholdPct = Math.min(rebelThreshold / 100, 1) * 100;
  const showMarker   = rebelThreshold <= 100;

  // Trend
  const isRising  = delta > 0.3;
  const isFalling = delta < -0.3;
  const trendArrow = isRising ? '↑' : isFalling ? '↓' : '→';
  const trendColor = isRising
    ? 'var(--color-danger)'
    : isFalling
    ? 'var(--color-success)'
    : 'var(--color-text-muted)';

  // Seasons projection
  const remaining = rebelThreshold - province.unrest;
  const seasonsToRebel = showMarker && delta > 0.1 && remaining > 0
    ? Math.ceil(remaining / delta)
    : null;

  // Tooltip: unrest source breakdown
  const taxUnrest   = getLowerTaxUnrest(province.lowerTax) + getUpperTaxUnrest(province.upperTax);
  const bldGovMod   = getUnrestModifier(province, traits); // negative = suppresses
  const naturalDecay = -2;
  const accel        = province.unrest > 60 ? (province.unrest - 60) * 0.25 : 0;

  function fmtSrc(n: number): string {
    return (n >= 0 ? '+' : '') + n.toFixed(n % 1 === 0 ? 0 : 1) + '/s';
  }
  function srcColor(n: number): string {
    return n > 0 ? 'var(--color-danger)' : n < 0 ? 'var(--color-success)' : 'var(--color-text-muted)';
  }

  const tooltipContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <div style={{ fontWeight: 700, color: barColor, marginBottom: '2px' }}>
        Unrest {province.unrest} / {rebelThreshold >= 101 ? '—' : rebelThreshold}
      </div>
      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
        <strong>Sources</strong>
      </div>
      {taxUnrest !== 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', fontSize: 'var(--font-size-xs)' }}>
          <span style={{ color: 'var(--color-text-muted)' }}>Tax pressure</span>
          <span style={{ color: srcColor(taxUnrest) }}>{fmtSrc(taxUnrest)}</span>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', fontSize: 'var(--font-size-xs)' }}>
        <span style={{ color: 'var(--color-text-muted)' }}>Natural decay</span>
        <span style={{ color: srcColor(naturalDecay) }}>{fmtSrc(naturalDecay)}</span>
      </div>
      {bldGovMod !== 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', fontSize: 'var(--font-size-xs)' }}>
          <span style={{ color: 'var(--color-text-muted)' }}>Buildings / Governor</span>
          <span style={{ color: srcColor(bldGovMod) }}>{fmtSrc(bldGovMod)}</span>
        </div>
      )}
      {accel > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', fontSize: 'var(--font-size-xs)' }}>
          <span style={{ color: 'var(--color-danger)' }}>⚡ Acceleration</span>
          <span style={{ color: 'var(--color-danger)' }}>+{accel.toFixed(1)}/s</span>
        </div>
      )}
      <div style={{ height: '1px', background: 'var(--color-border-subtle)', margin: '2px 0' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', fontSize: 'var(--font-size-xs)' }}>
        <span style={{ color: 'var(--color-text-secondary)', fontWeight: 700 }}>Net Δ/season</span>
        <span style={{ color: trendColor, fontWeight: 700 }}>{fmtSrc(delta)}</span>
      </div>
      {rebelThreshold >= 101 && (
        <div style={{ marginTop: '2px', fontSize: 'var(--font-size-xs)', color: 'var(--color-success)' }}>
          Insula III: rebellion impossible
        </div>
      )}
    </div>
  );

  // Order status label
  const orderStatus = rebelThreshold >= 101
    ? 'Suppressed'
    : province.unrest < 30
    ? 'Calm'
    : province.unrest < 60
    ? 'Troubled'
    : isCritical
    ? 'Critical'
    : 'Volatile';
  const orderStatusColor = rebelThreshold >= 101 || province.unrest < 30
    ? 'var(--color-success)'
    : province.unrest < 60
    ? 'var(--color-warning)'
    : 'var(--color-danger)';

  const unrestStatusLabel = isRising ? 'Unrest Rising' : isFalling ? 'Unrest Falling' : 'Stabilizing';

  return (
    <Tooltip content={tooltipContent} variant="rich" position="above" align="start">
      <div class="unrest-section">
        <StatPanelHeader title="Regional Order" icon={<ScalesSVG />} />

        {/* Hero icon + number + change rows */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '5px' }}>
          {/* Left: icon + unrest number */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px', flexShrink: 0 }}>
            <span style={{ fontSize: '22px', lineHeight: 1 }}>
              {isCritical ? '🔥' : province.unrest > 60 ? '⚔️' : province.unrest > 30 ? '😤' : '🛡️'}
            </span>
            <span style={{
              fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 700,
              color: barColor, lineHeight: 1,
            }}>
              {province.unrest}
              {isCritical && <span style={{ fontSize: '10px', marginLeft: '2px', animation: 'unrest-flash 0.8s ease-in-out infinite' }}>🔴</span>}
            </span>
          </div>  {/* end left icon col */}

          {/* Right: change + stabilizing */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '3px', paddingTop: '2px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '8px', letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Change</span>
              <span style={{ fontSize: 'var(--font-size-xs)', color: trendColor, fontWeight: 600 }}>
                {delta >= 0 ? '+' : ''}{delta.toFixed(1)}/s {trendArrow}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '8px', letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Rebel At</span>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-warning)' }}>
                {rebelThreshold >= 101 ? '—' : rebelThreshold}
              </span>
            </div>
          </div>
        </div>

        {/* Bar 0–100 with threshold marker */}
        <div class="unrest-bar" style={{ marginBottom: '4px' }}>
          <div class="unrest-bar-track">
            <div
              class={`unrest-fill${isCritical ? ' unrest-fill-critical' : ''}`}
              style={{ width: `${fillPct}%`, background: barColor }}
            />
          </div>
          {showMarker && (
            <div class="unrest-threshold-marker" style={{ left: `${thresholdPct}%` }} />
          )}
        </div>

        {/* 0 / 100 scale */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', color: 'var(--color-text-muted)', marginBottom: '5px' }}>
          <span>0</span>
          <span style={{ color: trendColor, fontWeight: 600 }}>{unrestStatusLabel}</span>
          <span>100</span>
        </div>

        {/* Footer: order status */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '5px',
          borderTop: '1px solid var(--color-border-subtle)', paddingTop: '5px',
          fontSize: '9px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase',
          color: orderStatusColor,
        }}>
          ✦ Order Status: {orderStatus}
          {seasonsToRebel !== null && (
            <span style={{ marginLeft: 'auto', fontWeight: 400, fontSize: '8px', color: 'var(--color-danger)', letterSpacing: 0 }}>
              Rebels in {seasonsToRebel}s
            </span>
          )}
        </div>
      </div>
    </Tooltip>
  );
}

// ── Income ledger ──

function LedgerRow({
  label, value, detail, badge, positive = false, negative = false, bold = false,
}: {
  label: string; value: ComponentChildren; detail?: string; badge?: 'trade' | 'gov';
  positive?: boolean; negative?: boolean; bold?: boolean;
}) {
  const valueColor = positive
    ? 'var(--color-success)'
    : negative
    ? 'var(--color-text-secondary)'
    : 'var(--color-text-secondary)';

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--font-size-xs)', minHeight: '17px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flex: 1, minWidth: 0 }}>
        {badge === 'trade' && (
          <span style={{
            fontSize: '7px', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase',
            padding: '1px 4px', borderRadius: '3px',
            background: 'rgba(100, 70, 150, 0.4)', color: '#c0a0f0',
            border: '1px solid rgba(150, 100, 220, 0.3)',
          }}>
            trade
          </span>
        )}
        {badge === 'gov' && (
          <span style={{
            fontSize: '7px', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase',
            padding: '1px 4px', borderRadius: '3px',
            background: 'rgba(60, 80, 140, 0.4)', color: '#90a8e0',
            border: '1px solid rgba(80, 110, 200, 0.3)',
          }}>
            gov
          </span>
        )}
        <span style={{
          color: bold ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
          fontWeight: bold ? 700 : 400,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {label}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, marginLeft: '8px' }}>
        {detail && (
          <span style={{ fontSize: '8px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
            {detail}
          </span>
        )}
        <span style={{
          fontWeight: bold ? 700 : 500,
          color: bold ? (positive ? 'var(--color-success)' : negative ? 'var(--color-text-secondary)' : 'var(--color-text-primary)') : valueColor,
          whiteSpace: 'nowrap',
        }}>
          {value}
        </span>
      </div>
    </div>
  );
}

function IncomeLedger({ province, accent = '#d4a843', index = 0 }: { province: Province; accent?: string; index?: number }) {
  const isExpanded = useSignal(false);
  const traits = getGovernorTraits(province.id);

  const taxRate = getTaxRate(province.lowerTax, province.upperTax);
  const taxRevenue = Math.floor(province.wealth * taxRate);

  // ── Building income breakdown ──
  interface BldLine { name: string; tier: number; rawGold: number; isSynergy: boolean }
  const bldLines: BldLine[] = [];
  let rawBuildingGold = 0;
  const nonGoldRaw: Partial<Record<ResourceType, number>> = {};

  for (const inv of province.investments) {
    const data   = INVESTMENT_DATA[inv.type];
    const effect = data.levels[inv.level - 1];
    for (const [res, amt] of Object.entries(effect.incomeBonus) as [ResourceType, number][]) {
      if (res === 'gold') {
        bldLines.push({ name: data.name, tier: inv.level, rawGold: amt, isSynergy: false });
        rawBuildingGold += amt;
      } else {
        nonGoldRaw[res] = (nonGoldRaw[res] ?? 0) + amt;
      }
    }
  }

  for (const syn of getActiveSynergies(province)) {
    if (syn.bonus.type === 'gold') {
      const amt = (syn.bonus as { type: 'gold'; amount: number }).amount;
      bldLines.push({ name: syn.label, tier: 0, rawGold: amt, isSynergy: true });
      rawBuildingGold += amt;
    }
  }

  const subsistence = 1;
  const tradeGoodGold     = province.tradeGood ? TRADE_GOOD_DATA[province.tradeGood].flatGold     : 0;
  const tradeGoodFaith    = province.tradeGood ? TRADE_GOOD_DATA[province.tradeGood].flatFaith    : 0;
  const tradeGoodMomentum = province.tradeGood ? TRADE_GOOD_DATA[province.tradeGood].flatMomentum : 0;

  // Non-gold income (flat building output, no wealth/tax scaling)
  const nonGoldIncome: Partial<Record<ResourceType, number>> = {};
  for (const [res, amt] of Object.entries(nonGoldRaw) as [ResourceType, number][]) {
    nonGoldIncome[res] = amt;
  }
  if (tradeGoodFaith    > 0) nonGoldIncome.faith    = (nonGoldIncome.faith    ?? 0) + tradeGoodFaith;
  if (tradeGoodMomentum > 0) nonGoldIncome.momentum = (nonGoldIncome.momentum ?? 0) + tradeGoodMomentum;

  // Governor bonus on non-gold
  for (const trait of traits) {
    if (trait.type === 'income-bonus' && trait.resource !== 'gold') {
      const base = nonGoldIncome[trait.resource] ?? 0;
      if (base > 0) nonGoldIncome[trait.resource] = Math.floor(base * (1 + trait.percent / 100));
    }
  }
  const iunioresYield = Math.floor(province.population * IUNIORES.perPop);

  // Gold total: tax revenue + building gold + subsistence + trade
  let goldTotal = taxRevenue + rawBuildingGold + subsistence + tradeGoodGold;
  const goldPreGov = goldTotal;
  for (const trait of traits) {
    if (trait.type === 'income-bonus' && trait.resource === 'gold') {
      goldTotal = Math.floor(goldTotal * (1 + trait.percent / 100));
    }
  }
  const govGoldBonus = goldTotal - goldPreGov;

  // ── Expenses breakdown ──
  let buildingUpkeep = 0;
  for (const inv of province.investments) {
    buildingUpkeep += INVESTMENT_DATA[inv.type].levels[inv.level - 1].expensesBonus;
  }
  const rawUpkeep     = province.baseExpenses + buildingUpkeep;
  const reducedUpkeep = getProvinceExpenses(province, traits);
  const govExpSaving  = rawUpkeep - reducedUpkeep; // positive = amount saved
  const govSalary     = getGovernorSalary(province.id);
  const totalExpenses = reducedUpkeep + govSalary;

  const net      = goldTotal - totalExpenses;
  const netColor = net >= 0 ? 'var(--color-success)' : 'var(--color-danger)';

  const nonGoldEntries = (Object.entries(nonGoldIncome) as [ResourceType, number][]).filter(([, v]) => v > 0);

  return (
    <BentoCard accent={accent} index={index} style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      {/* Summary header — always visible */}
      <div class="ledger-header" onClick={() => { isExpanded.value = !isExpanded.value; }}>
        <span style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--font-size-xs)',
          fontWeight: 600,
          color: 'var(--color-gold-secondary)',
          letterSpacing: '3px',
          textTransform: 'uppercase',
        }}>
          Income
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: netColor }}>
            NET {net >= 0 ? '+' : ''}{net}g/season
          </span>
          {nonGoldEntries.map(([res, amt]) => (
            <span key={res} style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
              <ResourceAmount type={res} amount={amt} sign="+" iconSize={14} />
            </span>
          ))}
          <span class="ledger-toggle" style={{ fontSize: '10px', color: 'var(--color-text-muted)', transition: 'color var(--duration-fast)' }}>
            {isExpanded.value ? '▲' : '▼'}
          </span>
        </div>
      </div>

      {/* Expanded breakdown */}
      {isExpanded.value && (
        <div class="ledger-body">
          {/* Tax revenue (ETW-style: wealth × rate) */}
          <LedgerRow
            label="Tax Revenue"
            detail={`${province.wealth} x ${formatTaxRate(taxRate)}`}
            value={`+${taxRevenue}g`}
            positive
          />

          {/* Building gold lines (flat, no multipliers) */}
          {bldLines.map((l, i) => (
            <LedgerRow
              key={i}
              label={l.isSynergy ? `${l.name} (synergy)` : `${l.name} ${ROMAN[l.tier]}`}
              value={`+${l.rawGold}g`}
              positive
            />
          ))}
          {bldLines.length === 0 && rawBuildingGold === 0 && (
            <LedgerRow label="No buildings" value="" />
          )}

          {/* Subsistence */}
          <LedgerRow label="Subsistence" value="+1g" positive />

          {/* Trade good gold */}
          {tradeGoodGold > 0 && province.tradeGood && (
            <LedgerRow
              label={TRADE_GOOD_DATA[province.tradeGood].name}
              badge="trade"
              value={`+${tradeGoodGold}g`}
              positive
            />
          )}

          {/* Governor gold bonus */}
          {govGoldBonus > 0 && (
            <LedgerRow label="Governor (income bonus)" badge="gov" value={`+${govGoldBonus}g`} positive />
          )}

          {/* Non-gold resources */}
          {nonGoldEntries.map(([res, amt]) => (
            <LedgerRow key={res} label={RESOURCE_INFO[res].label} value={<ResourceAmount type={res} amount={amt} sign="+" iconSize={14} />} positive />
          ))}
          <LedgerRow
            label="Iuniores / season"
            value={<ResourceAmount type="iuniores" amount={iunioresYield} sign="+" iconSize={14} />}
            positive={iunioresYield > 0}
            detail={`${province.population} pop × ${IUNIORES.perPop}/pop = ${iunioresYield}`}
          />

          {/* Total income */}
          <div class="ledger-divider" />
          <LedgerRow label="Total Income" value={`+${goldTotal}g`} positive bold />

          {/* Expense lines */}
          <LedgerRow label="Pop upkeep" value={`-${province.baseExpenses}g`} negative />
          {buildingUpkeep > 0 && (
            <LedgerRow label="Building upkeep" value={`-${buildingUpkeep}g`} negative />
          )}
          {govExpSaving > 0 && (
            <LedgerRow label="Gov. discount" badge="gov" value={`+${govExpSaving}g`} positive />
          )}
          {govSalary > 0 && (
            <LedgerRow label="Governor salary" value={`-${govSalary}g`} negative />
          )}

          {/* Total expenses */}
          <div class="ledger-divider" />
          <LedgerRow label="Total Expenses" value={`-${totalExpenses}g`} negative bold />

          {/* NET */}
          <div class="ledger-divider-strong" />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 0' }}>
            <span style={{
              fontSize: 'var(--font-size-xs)', fontWeight: 700,
              color: 'var(--color-text-primary)', letterSpacing: '2px', textTransform: 'uppercase',
            }}>
              Net
            </span>
            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: netColor }}>
              {net >= 0 ? '+' : ''}{net}g/season
            </span>
          </div>
        </div>
      )}
    </BentoCard>
  );
}

// ── Province Administration panel (canvas design: governor + tax side-by-side) ──

const PA_TAX_COLORS: Record<TaxLevel, string> = {
  1: 'var(--color-success)', 2: '#68a860', 3: 'var(--color-text-secondary)',
  4: 'var(--color-warning)', 5: 'var(--color-danger)',
};
const PA_TAX_LEVELS: TaxLevel[] = [1, 2, 3, 4, 5];

function PATaxStep({ label, value, onChange }: { label: string; value: TaxLevel; onChange: (v: TaxLevel) => void }) {
  const color = PA_TAX_COLORS[value];
  const fillPct = ((value - 1) / 4) * 100;
  return (
    <div class="pa-admin-tax-row">
      <div class="pa-admin-tax-row-header">
        <span class="pa-admin-tax-label">{label}</span>
        <span class="pa-admin-tax-badge" style={{ color, background: `${color}18`, border: `1px solid ${color}40` }}>{getTaxLabel(value)}</span>
      </div>
      <div class="pa-admin-tax-track">
        <div class="pa-admin-tax-fill" style={{ width: `${fillPct}%`, background: color }} />
        <div class="pa-admin-tax-dots">
          {PA_TAX_LEVELS.map(l => (
            <div key={l} class={`pa-admin-tax-dot${l <= value ? ' active' : ''}`}
              style={l <= value ? { background: color, borderColor: color } : undefined}
              onClick={() => onChange(l)} title={getTaxLabel(l)} />
          ))}
        </div>
      </div>
      <div class="pa-admin-tax-steps">
        {PA_TAX_LEVELS.map(l => (
          <span key={l} class={`pa-admin-tax-step${l === value ? ' active' : ''}`}
            style={l === value ? { color } : undefined} onClick={() => onChange(l)}>{getTaxLabel(l)}</span>
        ))}
      </div>
    </div>
  );
}

function ProvinceAdminPanel({ province }: { province: Province }) {
  void governorAssignments.value;
  void governorPool.value;

  const assigned = getAssignedGovernor(province.id);
  const salary = getGovernorSalary(province.id);
  const traits = assigned ? assigned.governor.tiers[assigned.tier - 1].traits : [];

  const baseIncomeGold = getProvinceIncome(province, []).gold ?? 0;
  const traitIncomeGold = getProvinceIncome(province, traits).gold ?? 0;
  const baseExpenses = getProvinceExpenses(province, []);
  const traitExpenses = getProvinceExpenses(province, traits);
  const netGold = (traitIncomeGold - baseIncomeGold) + (baseExpenses - traitExpenses) - salary;

  const currentRate = getTaxRate(province.lowerTax, province.upperTax);
  const rateStr = formatTaxRate(currentRate);
  const netIncome = getNetGoldIncome(province);

  function setLower(v: TaxLevel) { playSfx('ui_click'); setProvinceTax(province.id, v, province.upperTax); }
  function setUpper(v: TaxLevel) { playSfx('ui_click'); setProvinceTax(province.id, province.lowerTax, v); }

  const accent = getSettlementColor(province.population);

  return (
    <BentoCard accent={accent} index={1} style={{ overflow: 'hidden', padding: 0 }}>
      <div class="pa-admin-title-bar">
        <div class="pa-admin-title">Province Administration</div>
        <div class="pa-admin-divider" />
      </div>
      <div class="pa-admin-col-labels">
        <span class="pa-admin-col-label">Governor Office</span>
        <span class="pa-admin-col-label">Tax Policy & Rate</span>
      </div>
      <div class="pa-admin-content">
        {/* Governor */}
        <div class="pa-admin-gov">
          {!assigned ? (
            <>
              <div class="pa-admin-gov-portrait pa-admin-gov-portrait-dashed">
                <span style={{ fontSize: '24px', color: 'var(--color-text-muted)', opacity: 0.5 }}>⚔</span>
              </div>
              <div class="pa-admin-gov-info">
                <span class="pa-admin-gov-name" style={{ color: 'var(--color-text-muted)' }}>No Governor</span>
                <span class="pa-admin-gov-desc">Appoint a governor to gain specific bonuses for this province</span>
                <button class="gov-hire-btn" onClick={() => { showGovernorPicker.value = true; }}
                  style={{ marginTop: '3px', padding: '4px 12px', borderRadius: 'var(--radius-sm)', background: 'linear-gradient(180deg, rgba(100,70,20,0.8), rgba(60,45,12,0.9))', border: '1px solid var(--color-border-strong)', color: 'var(--color-gold-primary)', fontFamily: 'inherit', fontSize: '9px', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', cursor: 'pointer', alignSelf: 'flex-start' }}>
                  Hire →
                </button>
              </div>
            </>
          ) : (
            <>
              <Portrait alt={assigned.governor.name} size="small" factionColor={FACTION_COLORS[assigned.governor.color]} tier={assigned.tier as 1 | 2 | 3} />
              <div class="pa-admin-gov-info">
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <span class="pa-admin-gov-name" style={{ color: FACTION_COLORS[assigned.governor.color] }}>{assigned.governor.name}</span>
                  <span class="gov-tier-pill" style={{ fontSize: '8px', height: '14px', minWidth: '16px', padding: '0 4px' }}>{ROMAN[assigned.tier]}</span>
                </div>
                <span style={{ fontSize: '8px', color: 'rgba(230,130,80,0.9)', fontWeight: 700 }}>Salary: {salary}g/season</span>
                <div class="pa-admin-gov-traits">
                  {traits.map((trait, i) => (
                    <div key={i} class="pa-admin-gov-trait-row">
                      <span style={{ color: 'var(--color-success)', fontSize: '7px' }}>✦</span>
                      <span>{formatTraitEffect(trait, province)}</span>
                    </div>
                  ))}
                  <div style={{ fontSize: '8px', fontWeight: 700, paddingTop: '2px', borderTop: '1px solid rgba(180,160,100,0.08)', marginTop: '2px', color: netGold > 0 ? 'var(--color-success)' : netGold < 0 ? 'var(--color-danger)' : 'var(--color-text-secondary)' }}>
                    Net: {netGold > 0 ? '+' : ''}{netGold}g/s
                  </div>
                </div>
                <button class="gov-dismiss-btn" onClick={() => { dismissGovernor(province.id); showGovernorPicker.value = false; }}
                  title={`Dismiss (saves ${salary}g/season)`}
                  style={{ marginTop: '3px', padding: '3px 8px', borderRadius: 'var(--radius-sm)', background: 'rgba(120,40,30,0.25)', border: '1px solid rgba(180,80,60,0.35)', color: 'rgba(220,120,100,0.75)', fontFamily: 'inherit', fontSize: '8px', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', cursor: 'pointer', alignSelf: 'flex-start' }}>
                  Dismiss
                </button>
              </div>
            </>
          )}
        </div>
        <div class="pa-admin-vsep" />
        {/* Tax */}
        <div class="pa-admin-tax">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
            <div class="pa-admin-rate-badge"><span class="pa-admin-rate-value">{rateStr}</span></div>
            <span style={{ fontSize: '7px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 700 }}>Rate</span>
          </div>
          <PATaxStep label="Lower Class" value={province.lowerTax} onChange={setLower} />
          <PATaxStep label="Upper Class" value={province.upperTax} onChange={setUpper} />
        </div>
      </div>
      <div class="pa-admin-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700 }}>Net Income</span>
        <span style={{ color: netIncome >= 0 ? 'var(--color-success)' : 'var(--color-danger)', fontWeight: 700, fontSize: '9px' }}>
          {netIncome >= 0 ? '+' : ''}{netIncome}g / season
        </span>
      </div>
    </BentoCard>
  );
}

// ── Province detail (right panel: governor strip + building grid) ──

function ProvinceDetail({ province }: { province: Province }) {
  // Read assignment signal for reactivity
  void governorAssignments.value;
  void governorPool.value;

  // Per-province tier tint (settlement size) drives each card's hairline + glow.
  const accent = getSettlementColor(province.population);

  return (
    <div style={{ animation: 'prov-fade-in var(--duration-normal) var(--ease-default)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Province Identity (S18-06) */}
      <IdentityStrip province={province} />

      {/* Province Administration (governor + tax side-by-side) */}
      <ProvinceAdminPanel key={province.id} province={province} />

      {/* Wealth · Population · Unrest — same row */}
      <BentoCard accent={accent} index={2} style={{
        display: 'flex', alignItems: 'stretch',
      }}>
        <div style={{ flex: '1 1 0', minWidth: 0, paddingRight: '12px' }}><WealthDisplay province={province} /></div>
        <div style={{ width: '1px', background: 'var(--color-border-subtle)', flexShrink: 0 }} />
        <div style={{ flex: '1 1 0', minWidth: 0, padding: '0 12px' }}><PopBar province={province} /></div>
        <div style={{ width: '1px', background: 'var(--color-border-subtle)', flexShrink: 0 }} />
        <div style={{ flex: '1 1 0', minWidth: 0, paddingLeft: '12px' }}><UnrestSection province={province} /></div>
      </BentoCard>

      {/* Income Ledger (S18-04) */}
      <IncomeLedger province={province} accent={accent} index={3} />

      {/* Building grid — terrain gates + synergies (S18-07) */}
      <BuildingGrid province={province} />
    </div>
  );
}

// ── Main screen ──

/**
 * Province management screen body — mounted as the Provinciae tab inside
 * the Forum shell. Legacy route `#provinces` redirects here via
 * `resolveScreen()` in src/ui/screens.ts.
 *
 * Exported under two names for clarity: `ProvinciaeTab` is the canonical
 * Forum-tab name, `ProvinceScreen` is kept as an alias for any lingering
 * direct importers.
 */
export function ProvinciaeTab() {
  const commander = selectedCommander.value;
  const faction = commander?.faction;
  const accent = faction ? FACTION_COLORS[faction] : 'var(--color-gold-primary)';
  const allProvinces = provinces.value;

  // Auto-select first province if none selected or selected doesn't exist
  const selectedId = selectedProvinceId.value;
  const selected = allProvinces.find(p => p.id === selectedId) ?? allProvinces[0] ?? null;
  if (selected && selectedId !== selected.id) {
    selectedProvinceId.value = selected.id;
  }

  // Empire-wide aggregates for header
  const totalPop = allProvinces.reduce((s, p) => s + p.population, 0);
  const totalIncome: Partial<Record<ResourceType, number>> = {};
  let totalExpenses = 0;
  let totalUnrest = 0;
  let totalWealth = 0;
  for (const p of allProvinces) {
    const t = getGovernorTraits(p.id);
    const inc = getProvinceIncome(p, t);
    for (const [res, amt] of Object.entries(inc) as [ResourceType, number][]) {
      totalIncome[res] = (totalIncome[res] ?? 0) + amt;
    }
    totalExpenses += getProvinceExpenses(p, t);
    totalUnrest += p.unrest;
    totalWealth += p.wealth;
  }
  const n = allProvinces.length || 1;
  const avgUnrest = Math.round(totalUnrest / n);
  const avgWealth = Math.round(totalWealth / n);

  const netGold = (totalIncome.gold ?? 0) - totalExpenses;
  const subtitle = allProvinces.length === 0
    ? 'No holdings'
    : (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        {allProvinces.length} Holding{allProvinces.length === 1 ? '' : 's'} ·
        <ResourceAmount type="gold" amount={netGold} sign={netGold >= 0 ? '+' : ''} iconSize={14} />
        · Avg unrest {avgUnrest}%
      </span>
    );

  return (
    <>
      <Masthead
        title="Provinciae"
        subtitle={subtitle}
        accent={accent}
      />

      <div style={{ flex: 1, padding: '20px 32px 24px', minHeight: 0, overflow: 'auto', fontFamily: 'var(--font-family)' }}>
        {allProvinces.length === 0 ? (
          /* Empty state */
          <div style={{
            padding: '60px 20px', textAlign: 'center',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
          }}>
            <div style={{ fontSize: '48px', opacity: 0.3 }}>🏛</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--font-size-lg)', color: 'var(--color-text-secondary)', letterSpacing: '3px', textTransform: 'uppercase' }}>
              No provinces conquered yet
            </div>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', maxWidth: '320px', lineHeight: '1.5' }}>
              Complete campaigns to conquer provinces. Each province generates income and can be improved with investments.
            </div>
            {/* Aggregate empire-wide income chips — surfaced here so the metric
                isn't lost when the empty state hides the detail panels. */}
            {totalPop > 0 && (
              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
                <span class="ornate-stat-chip" title="Total Population">👥 <strong>{totalPop}</strong></span>
                <span class="ornate-stat-chip" title="Avg Wealth"><ResourceIcon type="gold" size={16} /> <strong>{avgWealth}</strong></span>
              </div>
            )}
          </div>
        ) : (
          /* Two-column layout */
          <div class="prov-layout" style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>

            {/* Left: Ledger */}
            <div class="prov-ledger" style={{
              flex: '0 0 260px', minWidth: '220px',
              display: 'flex', flexDirection: 'column', gap: '8px',
              paddingRight: '4px',
            }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                marginBottom: '4px',
              }}>
                <div style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 600,
                  color: 'var(--color-gold-secondary)',
                  letterSpacing: '3px',
                  textTransform: 'uppercase',
                }}>
                  {allProvinces.length} Province{allProvinces.length !== 1 ? 's' : ''}
                </div>
                <span class="ornate-stat-chip" title="Avg Unrest">
                  <UnrestBar unrest={avgUnrest} modifier={0} width={50} />
                </span>
              </div>
              {allProvinces.map(p => (
                <ProvinceRow key={p.id} province={p} selected={selected?.id === p.id} />
              ))}
            </div>

            {/* Right: Detail */}
            <div class="prov-detail" style={{ flex: '1 1 400px', minWidth: '0', overflowY: 'auto', overflowX: 'hidden', paddingRight: '6px' }}>
              {selected ? (
                <ProvinceDetail province={selected} />
              ) : (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
                  Select a province
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Governor Picker Modal ── */}
      {showGovernorPicker.value && selected && (
        <div
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.7)',
            zIndex: 200,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => { showGovernorPicker.value = false; }}
        >
          <OrnateFrame
            width="min(580px, 92vw)"
            padding="compact"
            className="prov-detail"
            corners={false}
            style={{ maxHeight: '85vh', overflowY: 'auto', overflowX: 'hidden' }}
            onClick={(e: MouseEvent) => e.stopPropagation()}
          >
            <OrnateHeader
              titleSize="md"
              eyebrow="Hire Governor"
              title={selected.name}
              onClose={() => { showGovernorPicker.value = false; }}
            />
            <GovernorPicker provinceId={selected.id} />
          </OrnateFrame>
        </div>
      )}
    </>
  );
}

/** Alias kept for any direct importers of the old name. */
export const ProvinceScreen = ProvinciaeTab;
