import { Fragment } from 'preact';
import type { ComponentChildren } from 'preact';
import { signal } from '@preact/signals';
import { useEffect, useRef, useState } from 'preact/hooks';
import { navigateTo } from '../screens';
import { OrnateFrame, OrnateHeader } from '../components/OrnateFrame';
import { currentSpoke, currentNodeIndex, resetSpoke, advanceNode, completeSpoke, grantSpokeResource, spokeGains, applyNodeEffectsNow, legacyEncounterFromNodeType, chooseBranch } from '../../game/progression/spoke';
import type { Spoke, SpokeBranch, SpokeNode, NodeType, SeasonTickResult } from '../../game/progression/spoke';
import type { SpokeEffect } from '../../game/progression/spoke-effects';
import type { EncounterType } from '../../game/progression/landmark-types';
import { selectedCommander, completedSpokes, threatLevel } from '../../game/core/game-state';
import { conquerProvince, assignProvinceIdentity, getProvinceEffects } from '../../game/province/province-store';
import { getCandidateIndices, PROVINCE_NAMES } from '../../game/province/province-map-store';
import { calculateInitialWealth } from '../../game/province/province';
import type { TerrainType } from '../../data/terrain-data';
import type { TradeGoodType } from '../../data/trade-goods';
import { TRADE_GOOD_DATA } from '../../data/trade-goods';
import { FACTION_COLORS, RESOURCE_INFO, FACTION_PRIMARY_RESOURCE } from '../../game/core/commander';
import type { ResourceType } from '../../game/core/commander';
import { spendResource, getResource, gold, influence } from '../../game/core/resources';
import { NodeModal } from './NodeModal';
import { EventModal } from '../components/EventModal';
import type { GameEvent, EventChoice } from '../../game/events/event-types';
import { pickEvent, buildEventContext, applyEventChoice } from '../../game/events/event-engine';
import { getExtraEventChoices } from '../../game/items/doctrine-store';
import { manipulateUsesLeft, consumeManipulateUse } from '../../game/progression/strategic-store';
import { councilSlots, grantAdvisorXp, tierUpNotices } from '../../game/council/council-store';
import { ArmyDetailHUD } from '../components/ArmyDetailHUD';
import { computeArmyMorale } from '../../game/army/morale';
import type { MoraleResult, MoraleTier } from '../../game/army/morale';
import { SpokeTopBar } from '../components/spoke/SpokeTopBar';
import { LandmarkDetailsPanel } from '../components/spoke/LandmarkDetailsPanel';
import { LandmarkNode } from '../components/spoke/LandmarkNode';
import { RouteLine, type RouteLineState } from '../components/spoke/RouteLine';
import { previewReplenishment, replenishBoundArmy } from '../../game/army/army-replenishment';
import type { ReplenishmentPreview } from '../../game/army/army-replenishment';
import { supplyCostForNodes } from '../../game/army/supplies';
import { ENCOUNTER_BADGE_COLOR, ENCOUNTER_ICON, ENCOUNTER_LABEL, LANDMARK_LABEL } from '../components/spoke/landmark-presentation';
import { LaurelWreath } from '../components/motifs/LaurelWreath';
import type { Cohort } from '../../game/army/cohort';

// ── One-time CSS injection ──
if (typeof document !== 'undefined' && !document.getElementById('node-map-styles')) {
  const el = document.createElement('style');
  el.id = 'node-map-styles';
  el.textContent = `
    @keyframes node-pulse {
      0%, 100% { box-shadow: 0 0 12px var(--glow), 0 0 24px var(--glow); transform: scale(1); }
      50% { box-shadow: 0 0 24px var(--glow), 0 0 48px var(--glow); transform: scale(1.06); }
    }
    @keyframes checkmark-pop {
      0%   { transform: scale(0) rotate(-45deg); opacity: 0; }
      60%  { transform: scale(1.3) rotate(0deg); opacity: 1; }
      100% { transform: scale(1) rotate(0deg); opacity: 1; }
    }
    @keyframes resolve-flash {
      0%   { box-shadow: 0 0 0 0 rgba(212, 168, 67, 0.6); }
      50%  { box-shadow: 0 0 30px 8px rgba(212, 168, 67, 0.4); }
      100% { box-shadow: 0 0 0 0 rgba(212, 168, 67, 0); }
    }
    @keyframes line-sweep {
      0%   { background-position: -64px 0; }
      100% { background-position: 64px 0; }
    }
    @keyframes boss-breathe {
      0%, 100% { box-shadow: 0 0 16px var(--type-glow), 0 0 32px var(--type-glow), inset 0 0 8px var(--type-glow); transform: scale(1); }
      50%      { box-shadow: 0 0 24px var(--type-glow), 0 0 48px var(--type-glow), inset 0 0 14px var(--type-glow); transform: scale(1.04); }
    }
    @keyframes tooltip-in {
      from { opacity: 0; transform: translateX(-50%) translateY(4px); }
      to   { opacity: 1; transform: translateX(-50%) translateY(0); }
    }

    .node-circle { transition: all 0.25s var(--ease-default); }
    .node-circle:hover { filter: brightness(1.2); }
    .node-current { animation: node-pulse 2.5s ease-in-out infinite; cursor: pointer; }
    .node-current:hover { transform: scale(1.15) !important; }
    .node-current.node-boss { animation: boss-breathe 2.5s ease-in-out infinite; }
    .node-resolved { opacity: 0.6; }
    .node-future { opacity: 0.5; cursor: default; }

    .checkmark-overlay {
      animation: checkmark-pop 0.4s ease-out forwards;
    }

    .node-tooltip {
      position: absolute;
      bottom: calc(100% + 14px);
      left: 50%;
      transform: translateX(-50%);
      background: var(--color-bg-primary);
      border: 1px solid var(--color-border-default);
      border-radius: var(--radius-sm);
      padding: 6px 12px;
      white-space: nowrap;
      font-size: var(--font-size-sm);
      letter-spacing: 0.5px;
      pointer-events: none;
      z-index: 50;
      animation: tooltip-in var(--duration-fast) ease-out;
    }
    .node-tooltip::after {
      content: '';
      position: absolute;
      top: 100%;
      left: 50%;
      transform: translateX(-50%);
      border: 5px solid transparent;
      border-top-color: var(--color-border-default);
    }

    .line-next-active {
      position: relative;
      overflow: hidden;
    }
    .line-next-active::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(90deg, transparent 30%, var(--faction-color) 50%, transparent 70%);
      background-size: 64px 100%;
      animation: line-sweep 1.8s linear infinite;
      opacity: 0.5;
    }

    /* Manipulate reroll button */
    .manipulate-reroll-btn { transition: all var(--duration-fast) var(--ease-default); cursor: pointer; }
    .manipulate-reroll-btn:hover {
      border-color: rgba(74, 124, 194, 0.7) !important;
      color: #80b0e8 !important;
      background: rgba(30, 60, 120, 0.55) !important;
    }
    .manipulate-reroll-btn:active { transform: scale(0.97); }

    /* Retreat button hover */
    .retreat-btn { transition: all var(--duration-normal) var(--ease-default); }
    .retreat-btn:hover {
      border-color: rgba(200, 80, 80, 0.4) !important;
      color: rgba(220, 180, 140, 0.7) !important;
      background: rgba(60, 36, 40, 0.9) !important;
    }
    .retreat-btn:active { transform: scale(0.97); }

    /* Event choice hover */
    .event-choice-btn { transition: all var(--duration-normal) var(--ease-default); }
    .event-choice-btn:not(:disabled):hover {
      border-color: var(--color-border-strong) !important;
      background: rgba(70, 70, 95, 0.7) !important;
    }
    .event-choice-btn:not(:disabled):active { transform: scale(0.98); }

    /* Modal action buttons */
    .modal-action-btn { transition: all var(--duration-normal) var(--ease-default); }
    .modal-action-btn:hover {
      filter: brightness(1.2);
      box-shadow: 0 0 12px var(--color-border-subtle);
    }
    .modal-action-btn:active { transform: scale(0.97); }

    /* Retreat confirm buttons */
    .retreat-confirm-btn { transition: all var(--duration-normal) var(--ease-default); }
    .retreat-confirm-btn:hover {
      border-color: rgba(220, 100, 100, 0.7) !important;
      background: rgba(200, 60, 60, 0.4) !important;
    }
    .retreat-confirm-btn:active { transform: scale(0.97); }

    .retreat-cancel-btn { transition: all var(--duration-normal) var(--ease-default); }
    .retreat-cancel-btn:hover {
      border-color: var(--color-border-strong) !important;
      color: var(--color-text-secondary) !important;
    }
    .retreat-cancel-btn:active { transform: scale(0.97); }

    /* Thin scrollbar for node chain */
    .node-chain-scroll::-webkit-scrollbar { height: 4px; }
    .node-chain-scroll::-webkit-scrollbar-track { background: var(--color-bg-primary); border-radius: 2px; }
    .node-chain-scroll::-webkit-scrollbar-thumb { background: var(--color-border-subtle); border-radius: 2px; }
    .node-chain-scroll::-webkit-scrollbar-thumb:hover { background: var(--color-border-default); }

    /* Empty state link */
    .empty-state-btn { transition: all var(--duration-normal) var(--ease-default); }
    .empty-state-btn:hover {
      border-color: var(--color-border-strong) !important;
      color: var(--color-gold-primary) !important;
    }
    .empty-state-btn:active { transform: scale(0.97); }

    @keyframes node-modal-fade {
      from { opacity: 0; transform: scale(0.95) translateY(-4px); }
      to   { opacity: 1; transform: scale(1) translateY(0); }
    }
    @keyframes resolve-gold-flash {
      0% { box-shadow: 0 0 24px 8px rgba(212,168,67,0.6); }
      100% { box-shadow: 0 0 0 0 rgba(212,168,67,0); }
    }
    .node-resolving { animation: resolve-gold-flash 0.4s ease-out; }
    @media (max-width: 600px) {
      .node-circle { min-width: 56px !important; min-height: 56px !important; }
    }

    /* City choice cards */
    .city-card {
      transition: all var(--duration-normal) var(--ease-default);
      cursor: pointer;
    }
    .city-card:hover {
      border-color: var(--color-border-strong) !important;
      transform: translateY(-2px);
      box-shadow: var(--shadow-lg), 0 0 12px rgba(240,208,128,0.15) !important;
    }
    .city-card:active { transform: scale(0.98); }

    .bellum-stage {
      width: 100%;
      height: 100%;
      min-height: 0;
      position: relative;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      background: #070509;
      color: var(--imp-text);
      font-family: var(--imp-font-body);
      isolation: isolate;
    }
    .bellum-stage::before {
      content: '';
      position: absolute;
      inset: 0;
      background:
        radial-gradient(ellipse at 50% 45%, rgba(212,168,67,0.07), transparent 46%),
        radial-gradient(ellipse at 84% 42%, rgba(122,36,50,0.12), transparent 34%),
        linear-gradient(180deg, rgba(10,8,5,0.55), transparent 18%, transparent 78%, rgba(8,5,3,0.72));
      pointer-events: none;
      z-index: 3;
    }
    .bellum-map-area {
      position: relative;
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }
    .bellum-pan-layer {
      position: absolute;
      inset: 0;
      cursor: grab;
      touch-action: none;
      transition: transform var(--duration-fast) var(--ease-default);
      will-change: transform;
    }
    .bellum-pan-layer.is-dragging {
      cursor: grabbing;
      transition: none;
    }
    .bellum-map-svg {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
    }
    .bellum-node {
      cursor: pointer;
      outline: none;
    }
    .bellum-node:hover .bellum-node-hex {
      filter: brightness(1.14) drop-shadow(0 0 5px var(--node-glow));
    }
    .bellum-node-current .bellum-node-aura {
      animation: bellum-node-pulse 2.4s ease-in-out infinite;
    }
    .bellum-node-reachable .bellum-node-reach {
      animation: bellum-node-pulse 2.8s ease-in-out infinite;
    }
    .bellum-node-resolved {
      opacity: 0.62;
    }
    .bellum-node-locked {
      opacity: 0.45;
    }
    @keyframes bellum-node-pulse {
      0%, 100% { opacity: 0.12; transform: scale(1); }
      50% { opacity: 0.28; transform: scale(1.08); }
    }
    .bellum-floating-panel {
      position: absolute;
      z-index: 6;
      background: linear-gradient(180deg, rgba(28,20,12,0.94), rgba(14,10,5,0.98));
      border: 1px solid rgba(212,168,67,0.55);
      border-radius: 2px;
      box-shadow: 0 12px 30px rgba(0,0,0,0.62), inset 0 0 0 1px rgba(212,168,67,0.08);
    }
    .bellum-action-btn {
      transition: filter var(--duration-fast) var(--ease-default), transform var(--duration-fast) var(--ease-default);
    }
    .bellum-action-btn:hover:not(:disabled) {
      filter: brightness(1.12);
    }
    .bellum-action-btn:active:not(:disabled) {
      transform: scale(0.98);
    }
    .bellum-action-btn:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
    .bellum-bottom {
      position: absolute;
      left: 14px;
      right: 14px;
      bottom: 14px;
      z-index: 7;
      display: flex;
      align-items: stretch;
      gap: 12px;
    }
    .bellum-icon-strip {
      position: absolute;
      top: 14px;
      right: 18px;
      z-index: 7;
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 7px 9px;
      background: linear-gradient(180deg, rgba(28,20,12,0.86), rgba(14,10,5,0.92));
      border: 1px solid rgba(212,168,67,0.32);
      border-radius: 2px;
      box-shadow: 0 8px 18px rgba(0,0,0,0.45);
    }
    @media (max-width: 1100px) {
      .bellum-stage {
        min-height: 100vh;
        height: auto;
        overflow-y: auto;
      }
      .bellum-map-area {
        min-height: 840px;
      }
      .bellum-floating-panel {
        position: relative;
        left: auto !important;
        right: auto !important;
        top: auto !important;
        width: auto !important;
        margin: 12px;
      }
      .bellum-bottom {
        position: relative;
        left: auto;
        right: auto;
        bottom: auto;
        margin: 12px;
        flex-direction: column;
      }
    }
  `;
  document.head.appendChild(el);
}



// ── Node type visual styles ──
// S24-05: tier → badge color (matches ArmyDetailHUD palette).
const NODE_STYLES: Record<NodeType, { color: string; glow: string; hoverLabel: string; hint: string }> = {
  battle: { color: '#c24a3a', glow: '#c24a3a60', hoverLabel: 'Enter Battle', hint: 'Prepare for battle...' },
  rest: { color: '#4a9a6a', glow: '#4a9a6a60', hoverLabel: 'Rest Here', hint: 'A place to rest...' },
  event: { color: '#d4a843', glow: '#d4a84360', hoverLabel: 'Make a Choice', hint: 'Something stirs ahead...' },
  boss: { color: '#8a4ac2', glow: '#8a4ac260', hoverLabel: 'Face the Boss', hint: 'The final challenge awaits...' },
};

const MORALE_TIER_COLOR: Record<MoraleTier, string> = {
  broken:   'var(--color-danger)',
  shaken:   '#d48b3a',
  steady:   'var(--color-text-secondary)',
  resolute: 'var(--color-gold-secondary)',
  inspired: 'var(--color-gold-primary)',
};

function moraleTierLabel(tier: MoraleTier): string {
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}


// ── City choice types & state ──

interface CityCandidate {
  mapIndex: number;
  name: string;
  terrain: TerrainType;
  tradeGood: TradeGoodType;
  wealth: number;
}

const TERRAIN_ICON: Record<TerrainType, string> = {
  farmland: '🌾', hills: '⛰', coast: '⚓', forest: '🌲',
  plains: '🏞', mountains: '🏔', marsh: '🌿', desert: '🏜',
};

const TRADE_GOOD_ICON: Record<TradeGoodType, string> = {
  grain: '🌾', iron: '⚙️', silk: '🪡', marble: '🏛',
  wine: '🍷', timber: '🪵', fish: '🐟', horses: '🐎',
  gold_ore: '🪙', incense: '🕯', salt: '🧂', olives: '🫒',
};

// ── Modal state ──
const showRetreatConfirm = signal(false);
const showRestModal = signal(false);
const restGains = signal<{ type: ResourceType; actual: number; isPrimary: boolean }[]>([]);
const restPreview = signal<ReplenishmentPreview | null>(null);
const showEventModal = signal(false);
const activeEvent = signal<GameEvent | null>(null);
const showSpokeCompleteModal = signal(false);
const showCityChoiceModal = signal(false);
const cityCandidates = signal<CityCandidate[]>([]);
const showSeasonModal = signal(false);
const lastSeasonTick = signal<SeasonTickResult | null>(null);

/** Index of the node that just resolved (for gold flash animation). */
const justResolvedIndex = signal<number | null>(null);

/** Army Detail HUD visibility on the node map. */
const showArmyHUDOnMap = signal(false);

/** S27-07/08: id of the node whose details panel is shown. Tracks the
 *  player's current node by default; clicking any node selects it without
 *  activating it. `null` falls back to the current main-chain node. Id
 *  rather than index so branch nodes (S27-08) are addressable. */
const selectedNodeId = signal<string | null>(null);

/** S27-09: encounter outcome modal — used for forage/recruit/scout/ambush/
 *  hazard/unknown encounters. Shows the effects about to be applied; on
 *  Continue, advanceNode runs (which applies them). For ambush, Continue
 *  routes to BattleV2 instead. */
type OutcomeKind = 'forage' | 'recruit' | 'scout' | 'ambush' | 'hazard' | 'unknown';
const outcomeModalNode = signal<SpokeNode | null>(null);
const outcomeModalKind = signal<OutcomeKind | null>(null);

// Legacy NodeCircle / ConnectingLine deleted by S27-08; LandmarkNode +
// RouteLine own the chain rendering now.

function RetreatConfirmModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  return (
    <div
      role="dialog" aria-modal="true" aria-label="Retreat confirmation"
      style={{
        position: 'fixed', inset: '0', zIndex: '200',
        background: 'rgba(0, 0, 0, 0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-family)',
        animation: 'node-modal-fade var(--duration-normal) ease-out',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div style={{
        background: 'linear-gradient(135deg, var(--color-bg-secondary), var(--color-bg-primary))',
        border: '1px solid var(--color-border-default)',
        borderRadius: 'var(--radius-md)', padding: '28px 32px',
        maxWidth: '360px', width: '90%', textAlign: 'center',
      }}>
        <div style={{
          fontSize: 'var(--font-size-lg)', fontWeight: 600, color: 'var(--color-gold-primary)',
          letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px',
        }}>
          Retreat?
        </div>
        <div style={{
          fontSize: 'var(--font-size-md)', color: 'var(--color-text-muted)',
          lineHeight: '1.5', marginBottom: '20px',
        }}>
          You'll keep your army and resources, but forfeit all remaining spoke rewards.
        </div>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <button class="retreat-confirm-btn" onClick={onConfirm} style={{
            padding: '10px 20px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
            background: 'rgba(180, 60, 60, 0.3)', border: '1px solid rgba(200, 80, 80, 0.5)',
            color: '#e0a0a0', fontFamily: 'inherit', fontSize: 'var(--font-size-md)', fontWeight: 600, letterSpacing: '1px',
          }}>
            Confirm Retreat
          </button>
          <button class="retreat-cancel-btn" onClick={onCancel} style={{
            padding: '10px 20px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
            background: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border-default)',
            color: 'var(--color-text-secondary)', fontFamily: 'inherit', fontSize: 'var(--font-size-md)', letterSpacing: '1px',
          }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── S27-09: encounter outcome preview ──

const OUTCOME_TITLES: Record<OutcomeKind, string> = {
  forage:  'Forage the Land',
  recruit: 'Volunteers Rally',
  scout:   'Survey the Route',
  ambush:  'Ambush!',
  hazard:  'Hazard Underfoot',
  unknown: 'A Strange Sight',
};

const OUTCOME_FLAVOR: Record<OutcomeKind, string> = {
  forage:  'Your foragers fan out to gather what they can.',
  recruit: 'Locals press forward, eager to swell the ranks.',
  scout:   'From this vantage you can see far ahead.',
  ambush:  'Hidden enemies fall on your column. Steel yourselves.',
  hazard:  'The terrain itself bites at your column.',
  unknown: 'The air shifts. Something here is not yet plain.',
};

function outcomeModalTitle(kind: OutcomeKind): string {
  return OUTCOME_TITLES[kind];
}

function EncounterOutcomePreview({ node, kind, onContinue }: {
  node: SpokeNode;
  kind: OutcomeKind;
  onContinue: () => void;
}) {
  const effects = node.effects ?? [];
  const continueLabel = kind === 'ambush' ? 'Brace and Fight' : 'Continue';
  return (
    <>
      <div style={{
        fontSize: 'var(--font-size-md)', color: 'var(--color-text-muted)',
        lineHeight: '1.5', marginBottom: '16px', fontStyle: 'italic',
      }}>
        {OUTCOME_FLAVOR[kind]}
      </div>
      {node.name && (
        <div style={{
          fontFamily: 'var(--font-display)', fontSize: 'var(--font-size-md)',
          color: 'var(--color-gold-secondary)', letterSpacing: '2px',
          textTransform: 'uppercase', textAlign: 'center', marginBottom: '14px',
        }}>
          {node.name}
        </div>
      )}
      {effects.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '20px' }}>
          {effects.map((e, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              fontSize: 'var(--font-size-sm)',
              color: outcomeEffectColor(e),
            }}>
              {outcomeEffectLine(e)}
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <button class="modal-action-btn ornate-btn" onClick={onContinue} style={{ padding: '10px 24px' }}>
          {continueLabel}
        </button>
      </div>
    </>
  );
}

function outcomeEffectColor(e: SpokeEffect): string {
  if (e.type === 'morale' || e.type === 'supplies' || e.type === 'iuniores') {
    return e.delta < 0 ? 'var(--color-danger)' : '#6ab87a';
  }
  if (e.type === 'threat') return e.delta > 0 ? 'var(--color-danger)' : '#6ab87a';
  return 'var(--color-text-secondary)';
}

function outcomeEffectLine(e: SpokeEffect): string {
  switch (e.type) {
    case 'morale':   return `${signed(e.delta)} 🔥 Morale — ${e.label}`;
    case 'supplies': return `${signed(e.delta)} 📦 Supplies — ${e.label}`;
    case 'iuniores': return `${signed(e.delta)} 🛡 Iuniores — ${e.label}`;
    case 'threat':   return `${signed(e.delta)} ⚠ Threat — ${e.label}`;
    case 'reveal':
    case 'scout':    return `🔭 ${e.label}`;
    case 'battle-modifier': return `⚔ ${e.label}`;
  }
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

const MAP_W = 1000;
const MAP_H = 562;
const MAP_THREAD = '#a58c58';
const MAP_THREAD_DIM = '#6f6044';
const MAP_PAN_LIMIT_X = 180;
const MAP_PAN_LIMIT_Y = 110;
const PHASE_ROMAN: readonly string[] = ['I', 'II', 'III', 'IV'];

const MUTED_ENCOUNTER_COLOR: Partial<Record<EncounterType, string>> = {
  battle: '#a65a4c',
  elite_battle: '#b46352',
  boss: '#8b5a91',
  ambush: '#b48a42',
  siege: '#9b6c58',
  hazard: '#b4764c',
};

interface MapPoint {
  x: number;
  y: number;
}

function encounterFor(node: SpokeNode): EncounterType {
  return node.encounterType ?? legacyEncounterFromNodeType(node.type);
}

function intelLevel(node: SpokeNode): 0 | 1 | 2 {
  return node.scoutedLevel ?? (node.revealed === false ? 0 : 2);
}

function encounterColor(node: SpokeNode, accent: string): string {
  if (intelLevel(node) === 0) return '#5a5562';
  const enc = encounterFor(node);
  return MUTED_ENCOUNTER_COLOR[enc] ?? ENCOUNTER_BADGE_COLOR[enc] ?? accent;
}

function encounterGlow(node: SpokeNode, accent: string): string {
  return `${encounterColor(node, accent)}55`;
}

function nodeTitle(node: SpokeNode): string {
  if (intelLevel(node) === 0) return 'Unknown';
  return node.name ?? LANDMARK_LABEL[node.landmarkType ?? 'battlefield'] ?? ENCOUNTER_LABEL[encounterFor(node)];
}

function nodeSubtitle(node: SpokeNode): string {
  if (intelLevel(node) === 0) return 'Unscouted';
  return ENCOUNTER_LABEL[encounterFor(node)];
}

function actionText(node: SpokeNode): string {
  if (intelLevel(node) === 0) return 'Advance Blind';
  const enc = encounterFor(node);
  switch (enc) {
    case 'battle':
    case 'elite_battle':
    case 'siege':
      return 'Prepare Battle';
    case 'boss':
      return 'Engage Boss';
    case 'ambush':
      return 'Spring Ambush';
    case 'rest':
      return 'Make Camp';
    case 'forage':
      return 'Forage';
    case 'recruit':
      return 'Recruit Locals';
    case 'scout':
      return 'Send Scouts';
    case 'hazard':
      return 'Press Through';
    case 'merchant':
      return 'Approach';
    case 'event':
    case 'unknown':
    default:
      return 'Resolve';
  }
}

function mainCoord(index: number, total: number): MapPoint {
  if (total <= 1) return { x: 500, y: 285 };
  const t = index / (total - 1);
  const x = 82 + t * 835;
  if (index === 0) return { x, y: 470 };
  if (index === total - 1) return { x, y: 250 };
  const y = 295 + Math.sin(index * 1.17) * 138 - t * 30;
  return { x, y: Math.max(94, Math.min(478, y)) };
}

function branchCoord(anchor: MapPoint, branchIndex: number, chainIndex: number): MapPoint {
  const direction = branchIndex % 2 === 0 ? 1 : -1;
  return {
    x: Math.min(930, anchor.x + 88 + chainIndex * 92),
    y: Math.max(80, Math.min(500, anchor.y + direction * (88 + branchIndex * 20) + chainIndex * 26)),
  };
}

function clampMapPan(point: MapPoint): MapPoint {
  return {
    x: Math.max(-MAP_PAN_LIMIT_X, Math.min(MAP_PAN_LIMIT_X, point.x)),
    y: Math.max(-MAP_PAN_LIMIT_Y, Math.min(MAP_PAN_LIMIT_Y, point.y)),
  };
}

function hexPoints(r: number): string {
  return Array.from({ length: 6 }).map((_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    return `${Math.cos(a) * r},${Math.sin(a) * r}`;
  }).join(' ');
}

type StatGlyphKind = 'supplies' | 'morale' | 'gold' | 'influence' | 'army';

function StatGlyph({ kind, color, size = 20 }: { kind: StatGlyphKind; color: string; size?: number }) {
  switch (kind) {
    case 'supplies':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} stroke={color} strokeWidth="1.4" fill="none" strokeLinecap="round">
          <circle cx="12" cy="12" r="8.5" />
          <circle cx="12" cy="12" r="2.4" fill={color} stroke="none" />
          <line x1="12" y1="3.5" x2="12" y2="20.5" />
          <line x1="3.5" y1="12" x2="20.5" y2="12" />
          <line x1="6" y1="6" x2="18" y2="18" />
          <line x1="18" y1="6" x2="6" y2="18" />
        </svg>
      );
    case 'morale':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} fill={color} stroke={color} strokeWidth="0.6" strokeLinejoin="round">
          <path d="M12 4.5 C9.6 7.2 9.6 10.6 12 13.2 C14.4 10.6 14.4 7.2 12 4.5 Z" />
          <path d="M5.2 12.2 C6.2 15.2 9 17 12 16.4 C11.2 13.4 8.4 11.6 5.2 12.2 Z" />
          <path d="M18.8 12.2 C17.8 15.2 15 17 12 16.4 C12.8 13.4 15.6 11.6 18.8 12.2 Z" />
          <line x1="12" y1="13" x2="12" y2="20" stroke={color} strokeWidth="1.4" strokeLinecap="round" fill="none" />
        </svg>
      );
    case 'gold':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size}>
          <circle cx="12" cy="12" r="8.5" fill={color} fillOpacity="0.22" stroke={color} strokeWidth="1.4" />
          <circle cx="12" cy="12" r="4.8" fill="none" stroke={color} strokeWidth="1" strokeOpacity="0.7" />
          <circle cx="12" cy="12" r="1.4" fill={color} />
        </svg>
      );
    case 'influence':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size}>
          <path d="M12 3 L20.5 12 L12 21 L3.5 12 Z" fill={color} fillOpacity="0.55" stroke={color} strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M12 7.5 L16.5 12 L12 16.5 L7.5 12 Z" fill="none" stroke={color} strokeWidth="0.9" strokeOpacity="0.7" />
        </svg>
      );
    case 'army':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} stroke={color} strokeWidth="1.7" strokeLinecap="round" fill="none">
          <line x1="5" y1="5" x2="17.5" y2="17.5" />
          <line x1="19" y1="5" x2="6.5" y2="17.5" />
          <circle cx="5" cy="5" r="1.4" fill={color} stroke="none" />
          <circle cx="19" cy="5" r="1.4" fill={color} stroke="none" />
          <line x1="14.5" y1="20.5" x2="20" y2="15" strokeWidth="1.2" strokeOpacity="0.6" />
        </svg>
      );
  }
}

function StatIcon({ kind, color }: { kind: StatGlyphKind; color: string }) {
  return (
    <div style={{
      width: 38, height: 38, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(180deg, rgba(22,15,9,0.85), rgba(8,5,3,0.92))',
      border: `1px solid ${color}55`,
      boxShadow: `inset 0 0 8px ${color}22, 0 1px 2px rgba(0,0,0,0.55)`,
      borderRadius: 2,
      color,
    }}>
      <StatGlyph kind={kind} color={color} size={20} />
    </div>
  );
}

type TopBarStat = {
  label: string;
  icon: StatGlyphKind;
  color: string;
  value: string;
  secondary?: string;
  secondaryColor?: string;
  delta?: string;
  deltaColor?: string;
};

function BellumTopBar({ spoke, morale, accent }: { spoke: Spoke; morale: MoraleResult | null; accent: string }) {
  const resolvedCount = spoke.nodes.filter(n => n.resolved).length;
  const army = spoke.boundArmy;
  const supplies = army?.supplies ?? 0;
  const remaining = Math.max(0, spoke.nodes.length - currentNodeIndex.value);
  const needed = army ? supplyCostForNodes(army.cohorts.length, remaining) : 0;
  const supplyShort = army ? Math.max(0, needed - supplies) : 0;
  const phaseRoman = PHASE_ROMAN[Math.max(0, Math.min(PHASE_ROMAN.length - 1, spoke.currentSeason - 1))];
  const subtitle = spoke.duration > 1
    ? `Act ${phaseRoman} · Season ${spoke.currentSeason}/${spoke.duration} · ${resolvedCount}/${spoke.nodes.length} landmarks`
    : `Act ${phaseRoman} · ${resolvedCount}/${spoke.nodes.length} landmarks`;

  const stats: TopBarStat[] = [
    {
      label: 'Supplies',
      icon: 'supplies',
      color: '#6ec0c8',
      value: supplies.toLocaleString(),
      delta: supplyShort > 0 ? `−${supplyShort} short` : 'Ready',
      deltaColor: supplyShort > 0 ? '#c24a3a' : '#7a9a6a',
    },
    {
      label: 'Morale',
      icon: 'morale',
      color: '#7a9a6a',
      value: morale ? moraleTierLabel(morale.tier) : 'None',
      secondary: morale ? `${morale.total}` : undefined,
      secondaryColor: morale ? MORALE_TIER_COLOR[morale.tier] : 'var(--imp-text-lo)',
    },
    {
      label: 'Gold',
      icon: 'gold',
      color: '#d4a843',
      value: gold.value.toLocaleString(),
    },
    {
      label: 'Influence',
      icon: 'influence',
      color: '#b23a3a',
      value: influence.value.toLocaleString(),
    },
    {
      label: 'Army',
      icon: 'army',
      color: '#a86a6a',
      value: army ? army.size.toLocaleString() : '0',
      secondary: army ? `${army.cohorts.length} Coh.` : undefined,
      secondaryColor: 'var(--imp-text-mid)',
    },
  ];

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `minmax(300px, 0.9fr) repeat(${stats.length}, minmax(0, 1fr))`,
      alignItems: 'stretch', gap: 0,
      minHeight: 86, flexShrink: 0, zIndex: 8,
      background: `
        linear-gradient(180deg, rgba(28,20,12,0.97) 0%, rgba(18,12,7,0.98) 55%, rgba(12,8,4,0.98) 100%)
      `,
      borderTop: `1px solid ${accent}55`,
      borderBottom: `1px solid ${accent}66`,
      boxShadow: '0 4px 18px rgba(0,0,0,0.55), inset 0 1px 0 rgba(212,168,67,0.08)',
    }}>
      {/* Title block with laurel ornament */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '0 22px', minWidth: 0,
        borderRight: `1px solid ${accent}33`,
        background: `radial-gradient(ellipse 100% 120% at 0% 50%, ${accent}14, transparent 72%)`,
      }}>
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <LaurelWreath size={58} color={accent} opacity={0.85} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontFamily: 'var(--imp-font-display)',
            fontSize: 22,
            fontWeight: 700,
            color: 'var(--imp-text-hi)',
            letterSpacing: 2,
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            lineHeight: 1.05,
            textShadow: '0 1px 2px rgba(0,0,0,0.6)',
          }}>
            {spoke.label}
          </div>
          <div style={{
            marginTop: 3,
            fontFamily: 'var(--imp-font-serif)',
            fontSize: 13,
            fontStyle: 'italic',
            color: accent,
            letterSpacing: 0.4,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {subtitle}
          </div>
        </div>
      </div>

      {/* Stat cells */}
      {stats.map((s, i) => (
        <div key={s.label} style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '0 16px', minWidth: 0,
          borderRight: i === stats.length - 1 ? 'none' : `1px solid ${accent}22`,
        }}>
          <StatIcon kind={s.icon} color={s.color} />
          <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{
              fontFamily: 'var(--imp-font-display)',
              fontSize: 10,
              color: 'var(--imp-text-lo)',
              letterSpacing: 2.2,
              textTransform: 'uppercase',
              lineHeight: 1.2,
            }}>
              {s.label}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 2, minWidth: 0 }}>
              <span style={{
                fontFamily: 'var(--imp-font-display)',
                fontSize: 18,
                fontWeight: 700,
                color: 'var(--imp-text-hi)',
                whiteSpace: 'nowrap',
                lineHeight: 1.1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {s.value}
              </span>
              {s.secondary && (
                <span style={{
                  fontFamily: 'var(--imp-font-display)',
                  fontSize: 13,
                  fontWeight: 600,
                  color: s.secondaryColor ?? 'var(--imp-text-mid)',
                  whiteSpace: 'nowrap',
                }}>
                  {s.secondary}
                </span>
              )}
              {s.delta && (
                <span style={{
                  fontFamily: 'var(--imp-font-mono)',
                  fontSize: 10,
                  color: s.deltaColor ?? '#7a9a6a',
                  whiteSpace: 'nowrap',
                  letterSpacing: 0.5,
                }}>
                  {s.delta}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function MapBackdrop() {
  return (
    <svg class="bellum-map-svg" viewBox={`0 0 ${MAP_W} ${MAP_H}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <radialGradient id="bellumParchment" cx="50%" cy="50%" r="75%">
          <stop offset="0%" stopColor="#382719" />
          <stop offset="62%" stopColor="#21160d" />
          <stop offset="100%" stopColor="#0c0705" />
        </radialGradient>
        <linearGradient id="bellumForest" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#334128" />
          <stop offset="100%" stopColor="#172010" />
        </linearGradient>
        <linearGradient id="bellumMountain" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#55514c" />
          <stop offset="100%" stopColor="#181611" />
        </linearGradient>
      </defs>
      <rect width={MAP_W} height={MAP_H} fill="url(#bellumParchment)" />
      <g opacity="0.12" stroke="#c0a36a" strokeWidth="0.6" fill="none">
        <path d="M95 470Q260 430 420 455Q560 485 700 440Q820 404 945 425" />
        <path d="M160 150Q330 185 510 150Q690 116 850 138" />
        <circle cx="500" cy="286" r="58" />
        <path d="M500 222V350M436 286H564M458 244L542 328M542 244L458 328" />
      </g>
      <path d="M0 0H1000V205Q820 214 700 178Q560 138 420 176Q250 218 105 198Q45 188 0 202Z" fill="url(#bellumForest)" opacity="0.62" />
      <path d="M0 210L1000 220V420Q800 446 620 422Q430 405 240 430Q110 445 0 430Z" fill="#23170f" opacity="0.62" />
      <ellipse cx="340" cy="300" rx="200" ry="90" fill="url(#bellumForest)" opacity="0.62" />
      {Array.from({ length: 52 }).map((_, i) => {
        const a = (i * 137.5) % 360;
        const r = 28 + (i % 6) * 24;
        const cx = 360 + Math.cos(a * Math.PI / 180) * r;
        const cy = 300 + Math.sin(a * Math.PI / 180) * (r * 0.46);
        return <circle key={i} cx={cx} cy={cy} r={2 + (i % 3)} fill="#2d3b22" opacity="0.45" />;
      })}
      <g opacity="0.86">
        <polygon points="610,135 655,55 705,145" fill="url(#bellumMountain)" />
        <polygon points="690,178 760,80 830,190" fill="url(#bellumMountain)" />
        <polygon points="812,165 875,75 940,180" fill="url(#bellumMountain)" />
        <polygon points="655,55 673,78 638,78" fill="#b4ada4" opacity="0.55" />
        <polygon points="760,80 782,110 738,110" fill="#b4ada4" opacity="0.55" />
        <polygon points="875,75 897,105 852,105" fill="#b4ada4" opacity="0.55" />
      </g>
      <path d="M520 530Q620 510 690 486Q760 466 835 492Q905 515 1000 494V562H520Z" fill="#4e6d8d" opacity="0.72" />
      <ellipse cx="890" cy="260" rx="120" ry="92" fill="#7a2432" opacity="0.1" />
      <rect width={MAP_W} height={MAP_H} fill="none" />
    </svg>
  );
}

function BellumNode({ node, point, selected, current, reachable, accent, onSelect }: {
  node: SpokeNode;
  point: MapPoint;
  selected: boolean;
  current: boolean;
  reachable: boolean;
  accent: string;
  onSelect: () => void;
}) {
  const enc = encounterFor(node);
  const hidden = intelLevel(node) === 0;
  const baseColor = encounterColor(node, accent);
  const focusColor = ENCOUNTER_BADGE_COLOR[enc] ?? accent;
  const color = current ? accent : selected ? focusColor : baseColor;
  const glow = selected || current ? `${color}66` : encounterGlow(node, accent);
  const isBoss = enc === 'boss' || node.type === 'boss';
  const r = selected || isBoss ? 27 : 21;
  const icon = current ? 'SPQR' : hidden ? '?' : ENCOUNTER_ICON[enc];
  const label = nodeTitle(node);
  const className = `bellum-node${current ? ' bellum-node-current' : ''}${reachable && !current && !node.resolved ? ' bellum-node-reachable' : ''}${node.resolved ? ' bellum-node-resolved' : ''}${!reachable ? ' bellum-node-locked' : ''}`;

  return (
    <g
      class={className}
      style={{ '--node-glow': glow } as preact.JSX.CSSProperties}
      transform={`translate(${point.x} ${point.y})`}
      onClick={onSelect}
      tabIndex={0}
      role="button"
      aria-label={label}
    >
      {(reachable && !current && !node.resolved) && (
        <circle class="bellum-node-reach" r={r + 12} fill={accent} opacity={0.1} />
      )}
      {(selected || current || isBoss) && (
        <circle class="bellum-node-aura" r={r + 12} fill={glow} opacity={selected ? 0.22 : 0.14} />
      )}
      {selected && (
        <circle r={r + 6} fill="none" stroke={accent} strokeWidth={2} opacity={0.9} />
      )}
      <polygon
        class="bellum-node-hex"
        points={hexPoints(r)}
        fill={current ? 'rgba(44,32,12,0.96)' : hidden ? '#17151d' : `url(#bellumNode-${enc})`}
        stroke={selected ? accent : color}
        strokeWidth={selected ? 3 : current ? 2.4 : 1.7}
      />
      <text
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={current ? 9 : selected || isBoss ? 20 : 15}
        fontWeight={700}
        letterSpacing={current ? 1 : 0}
        fill={current ? 'var(--imp-gold-hi)' : hidden ? '#aaa2b5' : color}
        style={{ userSelect: 'none', pointerEvents: 'none', fontFamily: current ? 'var(--imp-font-display)' : undefined }}
      >
        {icon}
      </text>
      {node.resolved && (
        <text textAnchor="middle" y={r + 6} fontSize={14} fill={accent} fontWeight={700} style={{ pointerEvents: 'none' }}>✓</text>
      )}
      <g transform={`translate(0 ${r + (selected ? 18 : 14)})`} style={{ pointerEvents: 'none' }}>
        <text
          textAnchor="middle"
          y={selected ? 5 : 4}
          fontSize={selected ? 10 : 8.5}
          fontWeight={700}
          letterSpacing={2}
          fill={selected ? 'var(--imp-gold-hi)' : '#d8c69a'}
          style={{
            fontFamily: 'var(--imp-font-display)',
            textTransform: 'uppercase',
            userSelect: 'none',
            textShadow: '0 1px 5px rgba(0,0,0,0.95), 0 0 8px rgba(0,0,0,0.9)',
          }}
        >
          {label}
        </text>
      </g>
    </g>
  );
}

function BellumRoutes({ spoke, nodeIdx, accent }: { spoke: Spoke; nodeIdx: number; accent: string }) {
  const coords = spoke.nodes.map((_, i) => mainCoord(i, spoke.nodes.length));
  const branchSegments: preact.JSX.Element[] = [];

  spoke.branches?.forEach((branch, branchIndex) => {
    if (branch.attachAfter < nodeIdx) return;
    const anchor = coords[branch.attachAfter];
    if (!anchor) return;
    let from = anchor;
    branch.nodes.forEach((node, chainIndex) => {
      const to = branchCoord(anchor, branchIndex, chainIndex);
      const active = branch.attachAfter === nodeIdx && chainIndex === 0;
      branchSegments.push(
        <line
          key={`branch-line-${node.id}`}
          x1={from.x}
          y1={from.y}
          x2={to.x}
          y2={to.y}
          stroke={active ? accent : MAP_THREAD_DIM}
          strokeWidth={active ? 1.8 : 1.15}
          strokeDasharray="4 5"
          strokeLinecap="round"
          opacity={active ? 0.78 : 0.32}
        />,
      );
      from = to;
    });
  });

  return (
    <g>
      {coords.slice(1).map((to, i) => {
        const from = coords[i];
        const toIndex = i + 1;
        const resolved = spoke.nodes[i].resolved && spoke.nodes[toIndex].resolved;
        const current = toIndex === nodeIdx || toIndex === nodeIdx + 1;
        return (
          <line
            key={`main-line-${toIndex}`}
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            stroke={current ? accent : resolved ? MAP_THREAD : MAP_THREAD_DIM}
            strokeWidth={current ? 1.9 : 1.2}
            strokeDasharray="4 6"
            strokeLinecap="round"
            opacity={resolved ? 0.58 : current ? 0.78 : 0.28}
          />
        );
      })}
      {branchSegments}
    </g>
  );
}

function BellumMap({ spoke, nodeIdx, selectedId, accent, onSelect }: {
  spoke: Spoke;
  nodeIdx: number;
  selectedId: string | null;
  accent: string;
  onSelect: (node: SpokeNode) => void;
}) {
  return (
    <svg class="bellum-map-svg" viewBox={`0 0 ${MAP_W} ${MAP_H}`} preserveAspectRatio="xMidYMid slice" role="img" aria-label="Bellum campaign route">
      <defs>
        {Object.keys(ENCOUNTER_LABEL).map((enc) => {
          const color = ENCOUNTER_BADGE_COLOR[enc as EncounterType] ?? accent;
          return (
            <radialGradient key={enc} id={`bellumNode-${enc}`} cx="50%" cy="35%">
              <stop offset="0%" stopColor={color} stopOpacity="0.95" />
              <stop offset="62%" stopColor={color} stopOpacity="0.72" />
              <stop offset="100%" stopColor="#0e0805" stopOpacity="1" />
            </radialGradient>
          );
        })}
      </defs>
      <BellumRoutes spoke={spoke} nodeIdx={nodeIdx} accent={accent} />
      {spoke.nodes.map((node, i) => (
        <BellumNode
          key={node.id}
          node={node}
          point={mainCoord(i, spoke.nodes.length)}
          selected={selectedId === node.id}
          current={i === nodeIdx}
          reachable={node.resolved || i === nodeIdx || i === nodeIdx + 1}
          accent={accent}
          onSelect={() => onSelect(node)}
        />
      ))}
      {spoke.branches?.flatMap((branch: SpokeBranch, branchIndex) => {
        if (branch.attachAfter < nodeIdx) return [];
        const anchor = mainCoord(branch.attachAfter, spoke.nodes.length);
        const branchReachable = branch.attachAfter === nodeIdx;
        return branch.nodes.map((node, chainIndex) => (
          <BellumNode
            key={node.id}
            node={node}
            point={branchCoord(anchor, branchIndex, chainIndex)}
            selected={selectedId === node.id}
            current={false}
            reachable={branchReachable && chainIndex === 0}
            accent={accent}
            onSelect={() => onSelect(node)}
          />
        ));
      })}
    </svg>
  );
}

function BellumSelectedPanel({ node, isCurrent, actionDisabledReason, accent, onAction }: {
  node: SpokeNode | null;
  isCurrent: boolean;
  actionDisabledReason?: string;
  accent: string;
  onAction: () => void;
}) {
  if (!node) return null;
  const enc = encounterFor(node);
  const hidden = intelLevel(node) === 0;
  const color = encounterColor(node, accent);
  const effects = hidden ? [] : node.effects ?? [];
  const rewards = hidden ? [] : node.reward ?? [];
  const buttonDisabled = !isCurrent;

  return (
    <div class="bellum-floating-panel" style={{ top: 22, left: 22, width: 330, borderColor: `${color}aa`, borderTop: `2px solid ${color}` }}>
      <div style={{
        padding: '14px 18px',
        borderBottom: `1px solid ${color}66`,
        background: `linear-gradient(180deg, ${color}2e, ${color}12)`,
      }}>
        <div style={{
          fontFamily: 'var(--imp-font-display)', fontSize: 16, fontWeight: 700,
          letterSpacing: 3, color, textTransform: 'uppercase',
        }}>
          {nodeTitle(node)}
        </div>
        <div style={{
          marginTop: 3, fontFamily: 'var(--imp-font-serif)', fontStyle: 'italic',
          color: 'var(--imp-text-mid)', fontSize: 12,
        }}>
          {nodeSubtitle(node)}
        </div>
      </div>
      <div style={{ height: 124, position: 'relative', overflow: 'hidden', background: `linear-gradient(135deg, ${color}22, #0e0805)` }}>
        <MapBackdrop />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 38%, rgba(0,0,0,0.7))' }} />
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 42, color, textShadow: `0 0 18px ${color}`,
        }}>
          {hidden ? '?' : ENCOUNTER_ICON[enc]}
        </div>
      </div>
      <div style={{ padding: '14px 18px 16px' }}>
        <InfoLine label="Enemy Strength" value={hidden ? 'Unknown' : node.enemyStrength ? `${node.enemyStrength}` : node.threatHint ?? 'Steady'} color={encounterColor(node, accent)} />
        <InfoLine label="Terrain" value={hidden ? 'Unscouted' : node.terrain ?? LANDMARK_LABEL[node.landmarkType ?? 'battlefield']} color={hidden ? 'var(--imp-text-lo)' : '#7a9a6a'} />
        {rewards.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <PanelLabel>Reward</PanelLabel>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {rewards.map((r, i) => (
                <span key={i} style={{ fontFamily: 'var(--imp-font-display)', fontSize: 12, color: RESOURCE_INFO[r.resource].color, fontWeight: 700 }}>
                  +{r.amount} {RESOURCE_INFO[r.resource].label}
                </span>
              ))}
            </div>
          </div>
        )}
        {effects.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <PanelLabel>Effect</PanelLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {effects.slice(0, 3).map((e, i) => (
                <span key={i} style={{ fontSize: 12, color: outcomeEffectColor(e), lineHeight: 1.35 }}>
                  {outcomeEffectLine(e)}
                </span>
              ))}
            </div>
          </div>
        )}
        <div style={{
          marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(212,168,67,0.18)',
          fontFamily: 'var(--imp-font-serif)', fontSize: 13, fontStyle: 'italic',
          color: 'var(--imp-text-mid)', lineHeight: 1.45,
        }}>
          {hidden
            ? 'The route is obscured. Advance without scouting or seek recon before committing.'
            : descriptionFor(enc)}
        </div>
        <button
          class="bellum-action-btn"
          disabled={buttonDisabled}
          title={buttonDisabled ? actionDisabledReason ?? 'Select the current landmark to act.' : actionText(node)}
          onClick={onAction}
          style={{
            width: '100%', marginTop: 16, padding: '12px 14px',
            background: `linear-gradient(180deg, ${color}, #6a1810)`,
            border: `1px solid ${color}`,
            borderTop: `1px solid ${color}`,
            borderRadius: 2,
            color: '#f3d4b2',
            fontFamily: 'var(--imp-font-display)', fontSize: 12, fontWeight: 700,
            letterSpacing: 3, textTransform: 'uppercase',
            cursor: buttonDisabled ? 'not-allowed' : 'pointer',
            boxShadow: `0 2px 12px ${color}55, inset 0 1px 0 rgba(255,255,255,0.2)`,
          }}
        >
          {actionText(node)}
        </button>
      </div>
    </div>
  );
}

function PanelLabel({ children }: { children: ComponentChildren }) {
  return (
    <div style={{
      fontFamily: 'var(--imp-font-display)', fontSize: 10, color: 'var(--imp-text-lo)',
      letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700, marginBottom: 6,
    }}>
      {children}
    </div>
  );
}

function InfoLine({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <span style={{
        fontFamily: 'var(--imp-font-display)', fontSize: 10, color: 'var(--imp-text-lo)',
        letterSpacing: 1.8, textTransform: 'uppercase', fontWeight: 700,
      }}>
        {label}: 
      </span>
      <span style={{ fontFamily: 'var(--imp-font-display)', fontSize: 12, color, fontWeight: 700 }}>
        {value}
      </span>
    </div>
  );
}

function descriptionFor(enc: EncounterType): string {
  switch (enc) {
    case 'battle':
    case 'elite_battle':
      return 'Enemy forces block the road. Commit the legion and resolve the engagement.';
    case 'boss':
      return 'The campaign objective stands here. Victory will complete the conquest.';
    case 'ambush':
      return 'Hidden enemies threaten the column. The penalty applies before the battle begins.';
    case 'rest':
      return 'A defensible camp gives the army a chance to recover before the march continues.';
    case 'forage':
      return 'Quartermasters can gather supplies, though the terrain may carry hidden costs.';
    case 'scout':
      return 'Reconnaissance can reveal nearby uncertainty and improve the next decision.';
    case 'hazard':
      return 'The route itself is dangerous. Pressing through will test the army.';
    default:
      return 'A campaign incident awaits resolution before the legion can advance.';
  }
}

function BellumLegend({ accent }: { accent: string }) {
  const entries: EncounterType[] = ['battle', 'elite_battle', 'ambush', 'rest', 'forage', 'scout', 'event', 'siege', 'boss'];
  return (
    <div class="bellum-icon-strip" aria-label="Map legend">
      <span style={{
        width: 22, height: 22, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: `1px solid ${accent}88`, color: accent,
        fontFamily: 'var(--imp-font-display)', fontSize: 12, fontWeight: 800,
      }}>
        ?
      </span>
      {entries.map((enc) => {
        const color = MUTED_ENCOUNTER_COLOR[enc] ?? ENCOUNTER_BADGE_COLOR[enc] ?? accent;
        return (
          <span
            key={enc}
            title={ENCOUNTER_LABEL[enc]}
            style={{
              width: 24, height: 24, borderRadius: 2,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color, border: `1px solid ${color}66`,
              background: `radial-gradient(circle, ${color}33, transparent 76%)`,
              fontSize: 12,
            }}
          >
            {ENCOUNTER_ICON[enc]}
          </span>
        );
      })}
      <span title="Unknown / Partial Intel / Full Recon" style={{
        marginLeft: 3,
        fontFamily: 'var(--imp-font-mono)',
        fontSize: 10,
        color: 'var(--imp-text-lo)',
        letterSpacing: 1,
        whiteSpace: 'nowrap',
      }}>
        ? · P · R
      </span>
    </div>
  );
}

const COHORT_RARITY_COLOR: Record<NonNullable<Cohort['rarity']>, string> = {
  'common':       '#9b7d3a',
  'uncommon':     '#c8c8d0',
  'rare':         '#5a82c8',
  'super-rare':   '#a06ec8',
  'secret-rare':  '#c84a4a',
  'leader':       '#f0d080',
};

const COHORT_RARITY_LABEL: Record<NonNullable<Cohort['rarity']>, string> = {
  'common':       'Common',
  'uncommon':     'Uncommon',
  'rare':         'Rare',
  'super-rare':   'Super-Rare',
  'secret-rare':  'Secret-Rare',
  'leader':       'Leader',
};

const COHORT_ROLE_LABEL: Record<'vanguard' | 'reserve' | 'guard', string> = {
  vanguard: 'Vanguard',
  reserve:  'Reserve',
  guard:    'Guard',
};

function RoleGlyph({ role, color, size = 12 }: { role: 'vanguard' | 'reserve' | 'guard'; color: string; size?: number }) {
  switch (role) {
    case 'vanguard':
      return (
        <svg viewBox="0 0 16 16" width={size} height={size} fill={color} stroke={color} strokeWidth="0.6" strokeLinejoin="round">
          <path d="M8 2 L13.5 13 L8 10.5 L2.5 13 Z" />
        </svg>
      );
    case 'reserve':
      return (
        <svg viewBox="0 0 16 16" width={size} height={size} fill={color} stroke={color} strokeWidth="0.6" strokeLinejoin="round">
          <path d="M8 2 L13 4.5 V9 C13 11.8 10.8 13.4 8 14 C5.2 13.4 3 11.8 3 9 V4.5 Z" />
        </svg>
      );
    case 'guard':
      return (
        <svg viewBox="0 0 16 16" width={size} height={size} fill={color} stroke={color} strokeWidth="0.7" strokeLinejoin="round">
          <path d="M8 2 L9.6 6.4 L14 6.8 L10.6 9.6 L11.7 14 L8 11.6 L4.3 14 L5.4 9.6 L2 6.8 L6.4 6.4 Z" />
        </svg>
      );
  }
}

function CohortTooltipCard({ cohort, anchorColor, anchorRect }: {
  cohort: Cohort;
  anchorColor: string;
  anchorRect: { left: number; top: number; width: number };
}) {
  const maxHp = cohort.stats.hp;
  const currentHp = cohort.currentHp ?? maxHp;
  const hpPct = Math.max(0, Math.min(1, currentHp / maxHp));
  const hpColor = hpPct > 0.6 ? '#7a9a6a' : hpPct > 0.3 ? '#d4a843' : '#c24a3a';
  const rarity = cohort.rarity ?? 'common';
  const stats: Array<[string, number]> = [
    ['ATK', cohort.stats.atk],
    ['DEF', cohort.stats.def],
    ['HP',  cohort.stats.hp],
    ['AGI', cohort.stats.agi],
  ];
  const TIP_W = 240;
  const margin = 8;
  const anchorCenter = anchorRect.left + anchorRect.width / 2;
  const viewportW = typeof window === 'undefined' ? 1920 : window.innerWidth;
  const clampedLeft = Math.max(margin + TIP_W / 2, Math.min(viewportW - margin - TIP_W / 2, anchorCenter));
  const arrowOffsetPx = anchorCenter - clampedLeft; // negative if clamped right, positive if clamped left
  return (
    <div role="tooltip" style={{
      position: 'fixed',
      left: clampedLeft,
      top: anchorRect.top - margin,
      width: TIP_W,
      transform: 'translate(-50%, -100%)',
      padding: '12px 14px',
      background: 'linear-gradient(180deg, rgba(28,20,12,0.98), rgba(14,10,5,0.99))',
      border: `1px solid ${anchorColor}aa`,
      borderTop: `1px solid ${anchorColor}`,
      borderRadius: 2,
      boxShadow: `0 12px 28px rgba(0,0,0,0.7), 0 0 22px ${anchorColor}33, inset 0 0 0 1px rgba(0,0,0,0.4)`,
      zIndex: 1000,
      pointerEvents: 'none',
      textAlign: 'left',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <div style={{
          fontFamily: 'var(--imp-font-display)',
          fontSize: 14, fontWeight: 700,
          color: anchorColor,
          letterSpacing: 1.4,
          textTransform: 'uppercase',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {cohort.name}
        </div>
        <div style={{
          fontFamily: 'var(--imp-font-mono)',
          fontSize: 9,
          color: 'var(--imp-text-mid)',
          letterSpacing: 1.2,
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
        }}>
          {COHORT_RARITY_LABEL[rarity]}
        </div>
      </div>
      <div style={{
        marginTop: 2,
        fontFamily: 'var(--imp-font-serif)',
        fontSize: 11, fontStyle: 'italic',
        color: 'var(--imp-text-mid)',
        letterSpacing: 0.4,
      }}>
        {COHORT_ROLE_LABEL[cohort.role]}
        {cohort.outOfAction ? ' · Out of action' : ''}
        {cohort.mercenary ? ' · Mercenary' : ''}
      </div>

      <div style={{ marginTop: 9 }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
          fontFamily: 'var(--imp-font-mono)', fontSize: 9,
          color: 'var(--imp-text-lo)', letterSpacing: 1.5, textTransform: 'uppercase',
        }}>
          <span>HP</span>
          <span style={{ color: hpColor }}>{currentHp.toLocaleString()} / {maxHp.toLocaleString()}</span>
        </div>
        <div style={{ marginTop: 3, width: '100%', height: 5, background: 'rgba(0,0,0,0.6)', borderRadius: 1, overflow: 'hidden', border: '1px solid rgba(0,0,0,0.5)' }}>
          <div style={{
            width: `${hpPct * 100}%`, height: '100%',
            background: `linear-gradient(180deg, ${hpColor}, ${hpColor}aa)`,
          }} />
        </div>
      </div>

      <div style={{
        marginTop: 10,
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6,
      }}>
        {stats.map(([label, value]) => (
          <div key={label} style={{
            padding: '4px 0',
            background: 'rgba(0,0,0,0.35)',
            border: '1px solid rgba(212,168,67,0.18)',
            borderRadius: 2,
            textAlign: 'center',
          }}>
            <div style={{
              fontFamily: 'var(--imp-font-mono)', fontSize: 8,
              color: 'var(--imp-text-lo)', letterSpacing: 1.4, textTransform: 'uppercase',
            }}>
              {label}
            </div>
            <div style={{
              marginTop: 1,
              fontFamily: 'var(--imp-font-display)', fontSize: 13, fontWeight: 700,
              color: 'var(--imp-text-hi)',
            }}>
              {value.toLocaleString()}
            </div>
          </div>
        ))}
      </div>

      {cohort.description && (
        <div style={{
          marginTop: 10, paddingTop: 8,
          borderTop: '1px solid rgba(212,168,67,0.18)',
          fontFamily: 'var(--imp-font-serif)',
          fontSize: 11, fontStyle: 'italic',
          color: 'var(--imp-text-mid)',
          lineHeight: 1.4,
        }}>
          {cohort.description}
        </div>
      )}

      {/* Anchor pointer (downward) */}
      <div style={{
        position: 'absolute',
        top: '100%',
        left: `calc(50% + ${arrowOffsetPx}px)`,
        transform: 'translateX(-50%)',
        width: 0, height: 0,
        borderLeft: '7px solid transparent',
        borderRight: '7px solid transparent',
        borderTop: `7px solid ${anchorColor}aa`,
      }} />
    </div>
  );
}

function CohortPip({ cohort }: { cohort: Cohort }) {
  const pipRef = useRef<HTMLDivElement>(null);
  const [anchorRect, setAnchorRect] = useState<{ left: number; top: number; width: number } | null>(null);
  const maxHp = cohort.stats.hp;
  const currentHp = cohort.currentHp ?? maxHp;
  const hpPct = Math.max(0, Math.min(1, currentHp / maxHp));
  const wounded = cohort.outOfAction === true;
  const rarityColor = COHORT_RARITY_COLOR[cohort.rarity ?? 'common'];
  const abbrev = cohort.name.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || '???';
  const hpColor = hpPct > 0.6 ? '#7a9a6a' : hpPct > 0.3 ? '#d4a843' : '#c24a3a';
  const hover = anchorRect !== null;
  function captureRect() {
    if (pipRef.current) {
      const r = pipRef.current.getBoundingClientRect();
      setAnchorRect({ left: r.left, top: r.top, width: r.width });
    }
  }
  function clearRect() {
    setAnchorRect(null);
  }
  return (
    <div
      ref={pipRef}
      onMouseEnter={captureRect}
      onMouseLeave={clearRect}
      onFocus={captureRect}
      onBlur={clearRect}
      tabIndex={0}
      style={{
        flex: '0 0 58px', minWidth: 58,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 4px 5px',
        background: `linear-gradient(180deg, rgba(22,15,9,0.85) 0%, rgba(8,5,3,0.92) 100%)`,
        border: `1px solid ${rarityColor}${hover ? 'cc' : '77'}`,
        borderTop: `1px solid ${rarityColor}`,
        borderRadius: 2,
        opacity: wounded ? 0.5 : 1,
        position: 'relative',
        boxShadow: hover
          ? `inset 0 0 8px ${rarityColor}33, 0 0 12px ${rarityColor}55`
          : `inset 0 0 6px ${rarityColor}1a`,
        outline: 'none',
        cursor: 'default',
        transition: 'box-shadow 160ms ease, border-color 160ms ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        <RoleGlyph role={cohort.role} color={rarityColor} size={11} />
        <span style={{
          fontFamily: 'var(--imp-font-display)',
          fontSize: 11, fontWeight: 700,
          color: rarityColor,
          letterSpacing: 1.2,
        }}>
          {abbrev}
        </span>
      </div>
      <div style={{ width: '100%', height: 4, background: 'rgba(0,0,0,0.6)', borderRadius: 1, overflow: 'hidden', border: '1px solid rgba(0,0,0,0.5)' }}>
        <div style={{
          width: `${hpPct * 100}%`,
          height: '100%',
          background: `linear-gradient(180deg, ${hpColor}, ${hpColor}aa)`,
          transition: 'width 220ms ease',
        }} />
      </div>
      {wounded && (
        <div style={{
          position: 'absolute', top: 1, right: 2,
          fontSize: 9, color: '#c24a3a', fontWeight: 700,
        }}>⚠</div>
      )}
      {anchorRect && <CohortTooltipCard cohort={cohort} anchorColor={rarityColor} anchorRect={anchorRect} />}
    </div>
  );
}

function ActionButton({
  onClick, disabled, tone, glyph, label,
}: {
  onClick: () => void;
  disabled?: boolean;
  tone: 'gold' | 'danger';
  glyph: preact.JSX.Element;
  label: string;
}) {
  const color = tone === 'danger' ? '#c25040' : 'var(--imp-gold)';
  const borderTop = tone === 'danger' ? '#c25040' : 'var(--imp-gold)';
  const bg = tone === 'danger'
    ? 'linear-gradient(180deg, rgba(40,18,14,0.92), rgba(20,10,6,0.96))'
    : 'linear-gradient(180deg, rgba(28,20,12,0.92), rgba(14,10,5,0.96))';
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      class="bellum-action-btn"
      title={label}
      aria-label={label}
      style={{
        height: '100%', minWidth: 76,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
        padding: '0 14px',
        background: bg,
        border: `1px solid ${color}66`,
        borderTop: `1px solid ${borderTop}`,
        borderRadius: 2,
        color,
        fontFamily: 'var(--imp-font-display)',
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 2,
        textTransform: 'uppercase',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {glyph}
      <span>{label}</span>
    </button>
  );
}

function BellumArmyStrip({ spoke, morale, accent, onDetails, onRetreat }: {
  spoke: Spoke;
  morale: MoraleResult | null;
  accent: string;
  onDetails: () => void;
  onRetreat: () => void;
}) {
  const army = spoke.boundArmy;
  const legateName = spoke.boundLegate?.name ?? 'Senatus Mandate';
  const cohorts = army?.cohorts ?? [];
  const commander = selectedCommander.value;
  const remaining = Math.max(0, spoke.nodes.length - currentNodeIndex.value);
  const supplies = army?.supplies ?? 0;
  const totalNeeded = army ? supplyCostForNodes(army.cohorts.length, remaining) : 0;
  const perMarch = army && remaining > 0 ? Math.max(0, Math.ceil(totalNeeded / remaining)) : 0;
  const canAffordNext = army ? supplies >= perMarch : false;
  const marchChipColor = !army ? 'var(--imp-text-lo)' : canAffordNext ? '#6ec0c8' : '#c24a3a';
  void morale;

  return (
    <div class="bellum-bottom">
      <div style={{
        flex: 1, minWidth: 0, display: 'flex', alignItems: 'stretch', gap: 0,
        background: 'linear-gradient(180deg, rgba(28,20,12,0.96) 0%, rgba(18,12,7,0.98) 55%, rgba(12,8,4,0.99) 100%)',
        border: `1px solid ${accent}88`, borderTop: `2px solid ${accent}`,
        borderRadius: 2, minHeight: 92,
        boxShadow: `0 -4px 16px rgba(0,0,0,0.55), 0 0 22px ${accent}22`,
      }}>
        {/* Identity: commander portrait + legion + legate */}
        <div style={{
          flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 12,
          padding: '0 18px',
          borderRight: `1px solid ${accent}33`,
          background: `radial-gradient(ellipse 100% 120% at 0% 50%, ${accent}14, transparent 72%)`,
        }}>
          <div style={{
            width: 56, height: 64, flexShrink: 0,
            position: 'relative',
            border: `1px solid ${accent}aa`,
            borderTop: `2px solid ${accent}`,
            borderRadius: 2,
            background: `radial-gradient(circle at 50% 35%, ${accent}22, rgba(14,10,5,0.85) 75%)`,
            boxShadow: `inset 0 0 10px ${accent}33, 0 1px 4px rgba(0,0,0,0.6)`,
            overflow: 'hidden',
          }}>
            {commander?.portrait ? (
              <img
                src={commander.portrait}
                alt={commander.name}
                style={{
                  width: '100%', height: '100%',
                  objectFit: 'cover',
                  objectPosition: commander.portraitPosition ?? 'center 18%',
                  display: 'block',
                  filter: 'contrast(1.04) saturate(1.05)',
                }}
              />
            ) : (
              <div style={{
                width: '100%', height: '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: accent,
                fontFamily: 'var(--imp-font-display)',
                fontSize: 12, fontWeight: 800,
                letterSpacing: 1.6,
              }}>
                SPQR
              </div>
            )}
            {/* Subtle gold corner inlay */}
            <div style={{
              position: 'absolute', inset: 0, pointerEvents: 'none',
              background: `linear-gradient(180deg, transparent 60%, rgba(0,0,0,0.5) 100%)`,
            }} />
          </div>
          <div style={{ minWidth: 0, maxWidth: 200 }}>
            <div style={{
              fontFamily: 'var(--imp-font-display)',
              fontSize: 16, fontWeight: 700,
              color: 'var(--imp-text-hi)',
              letterSpacing: 1.6, textTransform: 'uppercase',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              lineHeight: 1.1,
            }}>
              {army?.name ?? 'No Army'}
            </div>
            <div style={{
              marginTop: 3,
              fontFamily: 'var(--imp-font-serif)',
              fontSize: 12, fontStyle: 'italic',
              color: accent,
              letterSpacing: 0.4,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {commander?.name ?? legateName}
            </div>
            {commander && legateName !== 'Senatus Mandate' && (
              <div style={{
                marginTop: 1,
                fontFamily: 'var(--imp-font-mono)',
                fontSize: 9,
                color: 'var(--imp-text-lo)',
                letterSpacing: 1.4,
                textTransform: 'uppercase',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                Legate · {legateName}
              </div>
            )}
          </div>
        </div>

        {/* Cohort pip row */}
        <div style={{
          flex: 1, minWidth: 0,
          display: 'flex', alignItems: 'stretch', gap: 6,
          padding: '10px 14px',
          overflowX: 'auto',
          overflowY: 'hidden',
          borderRight: `1px solid ${accent}33`,
        }}>
          {cohorts.length === 0 ? (
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--imp-font-serif)', fontStyle: 'italic',
              color: 'var(--imp-text-lo)', fontSize: 12, letterSpacing: 0.5,
            }}>
              No cohorts deployed
            </div>
          ) : (
            cohorts.map((c, i) => (
              <CohortPip key={c.instanceId ?? `${c.id}-${i}`} cohort={c} />
            ))
          )}
        </div>

        {/* Next-march cost chip */}
        {army && remaining > 0 && (
          <div title={`Supplies: ${supplies} · Need ${perMarch}/march · ${remaining} march${remaining === 1 ? '' : 'es'} ahead`} style={{
            flex: '0 0 auto',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 3,
            padding: '0 14px',
            borderRight: `1px solid ${accent}33`,
            minWidth: 92,
          }}>
            <div style={{
              fontFamily: 'var(--imp-font-display)',
              fontSize: 9,
              color: 'var(--imp-text-lo)',
              letterSpacing: 1.8,
              textTransform: 'uppercase',
            }}>
              Next March
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <svg viewBox="0 0 24 24" width={14} height={14} stroke={marchChipColor} strokeWidth="1.4" fill="none" strokeLinecap="round">
                <circle cx="12" cy="12" r="8.5" />
                <circle cx="12" cy="12" r="2.4" fill={marchChipColor} stroke="none" />
                <line x1="12" y1="3.5" x2="12" y2="20.5" />
                <line x1="3.5" y1="12" x2="20.5" y2="12" />
                <line x1="6" y1="6" x2="18" y2="18" />
                <line x1="18" y1="6" x2="6" y2="18" />
              </svg>
              <span style={{
                fontFamily: 'var(--imp-font-display)',
                fontSize: 16, fontWeight: 700,
                color: marchChipColor,
                letterSpacing: 0.5,
              }}>
                {perMarch === 0 ? 'Free' : `−${perMarch}`}
              </span>
            </div>
            <div style={{
              fontFamily: 'var(--imp-font-mono)',
              fontSize: 9,
              color: canAffordNext ? 'var(--imp-text-mid)' : '#c24a3a',
              letterSpacing: 0.8,
            }}>
              {canAffordNext ? `Have ${supplies}` : 'Insufficient'}
            </div>
          </div>
        )}

        {/* Action cluster */}
        <div style={{
          flex: '0 0 auto', display: 'flex', alignItems: 'stretch', gap: 0,
          padding: '8px 8px',
        }}>
          <ActionButton
            onClick={onDetails}
            disabled={!army}
            tone="gold"
            label="Details"
            glyph={
              <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 4 H17 A2 2 0 0 1 19 6 V20 L17 18.5 L15 20 L13 18.5 L11 20 L9 18.5 L7 20 L5 18.5 Z" />
                <line x1="8" y1="9" x2="16" y2="9" />
                <line x1="8" y1="12.5" x2="16" y2="12.5" />
                <line x1="8" y1="16" x2="13" y2="16" />
              </svg>
            }
          />
          <div style={{ width: 6 }} />
          <ActionButton
            onClick={onRetreat}
            tone="danger"
            label="Retreat"
            glyph={
              <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <line x1="6" y1="3" x2="6" y2="21" />
                <path d="M6 4 H17 L14 8 L17 12 H6" fill="currentColor" fillOpacity="0.25" />
              </svg>
            }
          />
        </div>
      </div>
    </div>
  );
}

export function NodeMapScreen() {
  const spoke = currentSpoke.value;
  const nodeIdx = currentNodeIndex.value;
  const commander = selectedCommander.value;
  const color = commander ? FACTION_COLORS[commander.faction] : '#f0d080';
  const spokeComplete = spoke ? nodeIdx >= spoke.nodes.length : false;
  const [mapPan, setMapPan] = useState<MapPoint>({ x: 0, y: 0 });
  const mapDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  // L1: clear per-spoke UI state when the spoke is torn down so stale node
  // selections / open modals from the previous spoke never bleed in.
  useEffect(() => {
    if (!spoke) {
      selectedNodeId.value = null;
      outcomeModalNode.value = null;
      outcomeModalKind.value = null;
    }
  }, [spoke]);

  function handleMapPointerDown(e: preact.JSX.TargetedPointerEvent<HTMLDivElement>) {
    const target = e.target as Element;
    if (
      target.closest('.bellum-node') ||
      target.closest('.bellum-floating-panel') ||
      target.closest('.bellum-icon-strip') ||
      target.closest('.bellum-bottom')
    ) {
      return;
    }

    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.classList.add('is-dragging');
    mapDragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: mapPan.x,
      originY: mapPan.y,
    };
  }

  function handleMapPointerMove(e: preact.JSX.TargetedPointerEvent<HTMLDivElement>) {
    const drag = mapDragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    e.preventDefault();
    setMapPan(clampMapPan({
      x: drag.originX + e.clientX - drag.startX,
      y: drag.originY + e.clientY - drag.startY,
    }));
  }

  function endMapDrag(e: preact.JSX.TargetedPointerEvent<HTMLDivElement>) {
    const drag = mapDragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    e.currentTarget.classList.remove('is-dragging');
    mapDragRef.current = null;
  }

  if (!spoke) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: '100vh', fontFamily: 'var(--font-family)',
        background: 'var(--color-bg-primary)',
        gap: '16px',
      }}>
        <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-lg)', letterSpacing: '1px' }}>
          No active spoke
        </div>
        <button class="empty-state-btn ornate-btn-ghost" onClick={() => navigateTo('hub')} style={{
          padding: '10px 24px',
        }}>
          Return to Hub
        </button>
      </div>
    );
  }

  // ── Handlers ──

  function handleRetreat() {
    showRetreatConfirm.value = false;
    threatLevel.value += 1;
    resetSpoke();
    navigateTo('hub');
  }

  function handleNodeActivate(node: SpokeNode) {
    // S27-09: dispatch ONLY by `enc` (encounterType, with legacy node.type
    // mapping for pre-Itinerarium spokes). The earlier OR-fallback wrongly
    // sent any node with type='battle' to BattleV2 even when its
    // encounterType was 'forage' / 'scout' / 'hazard' / 'ambush' — fixed
    // by collapsing to a single resolved encounter discriminator.
    const enc: EncounterType = node.encounterType ?? legacyEncounterFromNodeType(node.type);
    switch (enc) {
      case 'battle':
      case 'elite_battle':
      case 'boss':
      case 'siege':
        navigateTo('battleV2');
        return;
      case 'ambush':
        openOutcomeModal(node, 'ambush');
        return;
      case 'rest':
        openRestModal();
        return;
      case 'forage':
      case 'recruit':
      case 'scout':
      case 'hazard':
      case 'unknown':
        openOutcomeModal(node, enc);
        return;
      case 'event':
      case 'merchant':
      default:
        openEventModal();
        return;
    }
  }

  // S27-08: id-based selection. Falls back to the current main-chain node
  // when nothing is explicitly selected. Branches attached to the current
  // main-chain index are actionable — but only at their HEAD (nodes[0]).
  // Tail nodes (nodes[1..]) are inspect-only until the head is committed,
  // at which point the entire chain becomes part of the main path.
  const currentMainNode = spoke.nodes[nodeIdx] ?? null;
  const selectedId = selectedNodeId.value ?? currentMainNode?.id ?? null;

  // Scan all branches' chain nodes for selection match.
  const selectedBranchInfo = (() => {
    if (!selectedId || !spoke.branches) return null;
    for (const branch of spoke.branches) {
      const chainIdx = branch.nodes.findIndex(n => n.id === selectedId);
      if (chainIdx >= 0) {
        return {
          branch,
          chainIdx,
          isHead: chainIdx === 0,
          isReachable: branch.attachAfter === nodeIdx,
        };
      }
    }
    return null;
  })();

  const selectedNodeForPanel = (() => {
    if (!selectedId) return currentMainNode;
    const main = spoke.nodes.find(n => n.id === selectedId);
    if (main) return main;
    if (selectedBranchInfo) return selectedBranchInfo.branch.nodes[selectedBranchInfo.chainIdx];
    return currentMainNode;
  })();

  // Action button is enabled when the player has selected the current
  // main-chain node, OR a reachable branch's head. Tail nodes never enable
  // the button (the head must be committed first).
  const isReachableBranchHeadSelected =
    !!selectedBranchInfo && selectedBranchInfo.isHead && selectedBranchInfo.isReachable;
  const isCurrentSelected =
    selectedNodeForPanel?.id === currentMainNode?.id || isReachableBranchHeadSelected;

  function handleSelectedAction() {
    if (!selectedNodeForPanel) return;
    if (isReachableBranchHeadSelected) {
      activateBranch(selectedNodeForPanel.id);
      return;
    }
    if (isCurrentSelected) {
      handleNodeActivate(selectedNodeForPanel);
    }
  }
  function activateBranch(branchHeadId: string) {
    if (!chooseBranch(branchHeadId)) return;
    const swappedNode = currentSpoke.value?.nodes[nodeIdx];
    if (!swappedNode) return;
    selectedNodeId.value = swappedNode.id;
    handleNodeActivate(swappedNode);
  }

  function openOutcomeModal(node: SpokeNode, kind: OutcomeKind) {
    outcomeModalNode.value = node;
    outcomeModalKind.value = kind;
  }

  function handleOutcomeContinue() {
    const kind = outcomeModalKind.value;
    const node = outcomeModalNode.value;
    outcomeModalNode.value = null;
    outcomeModalKind.value = null;

    // Ambush: apply the negative effects BEFORE the battle so the hit
    // (morale loss, iuniores damage) actually biases the engagement.
    // applyNodeEffectsNow marks the node's effects as pre-applied so
    // PostBattleScreen's advanceNode does not double-apply on return.
    if (kind === 'ambush') {
      if (node) applyNodeEffectsNow(node);
      navigateTo('battleV2');
      return;
    }

    // Non-battle outcomes: animate the resolve flash and advance.
    justResolvedIndex.value = nodeIdx;
    setTimeout(() => { justResolvedIndex.value = null; }, 400);
    const result = advanceNode();
    if (result.seasonTicked) {
      lastSeasonTick.value = result.seasonTicked;
      showSeasonModal.value = true;
    }
  }

  function openRestModal() {
    const faction = commander?.faction;
    const allTypes: ResourceType[] = ['gold', 'faith', 'influence', 'momentum'];
    const primary = faction ? FACTION_PRIMARY_RESOURCE[faction] : null;
    const gains: { type: ResourceType; actual: number; isPrimary: boolean }[] = [];

    if (primary) {
      // Non-white: +1 base primary (×2 faction multiplier = +2 effective) + 1 random secondary
      gains.push({ type: primary, actual: grantSpokeResource(primary, 1, faction), isPrimary: true });
      const secondaries = allTypes.filter(t => t !== primary);
      const pick = secondaries[Math.floor(Math.random() * secondaries.length)];
      gains.push({ type: pick, actual: grantSpokeResource(pick, 1, faction), isPrimary: false });
    } else {
      // White: no primary — +2 to one random, +1 to another random
      const shuffled = [...allTypes].sort(() => Math.random() - 0.5);
      gains.push({ type: shuffled[0], actual: grantSpokeResource(shuffled[0], 2, faction), isPrimary: false });
      gains.push({ type: shuffled[1], actual: grantSpokeResource(shuffled[1], 1, faction), isPrimary: false });
    }

    restGains.value = gains;
    const boundArmy = currentSpoke.value?.boundArmy;
    restPreview.value = boundArmy
      ? previewReplenishment(boundArmy.cohorts, getResource('iuniores'))
      : null;
    showRestModal.value = true;
  }

  function handleRestReplenish() {
    if (restPreview.value && restPreview.value.iunioresSpent > 0) {
      replenishBoundArmy();
    }
    handleRestContinue();
  }

  function handleRestContinue() {
    showRestModal.value = false;
    restPreview.value = null;
    justResolvedIndex.value = nodeIdx;
    setTimeout(() => { justResolvedIndex.value = null; }, 400);
    const result = advanceNode();
    if (result.seasonTicked) {
      lastSeasonTick.value = result.seasonTicked;
      showSeasonModal.value = true;
    }
  }

  function openEventModal() {
    if (!commander) return;
    const context = buildEventContext(commander.faction);
    const event = pickEvent(context);

    // S4-11 + S6-10: Doctrine + Province (Basilica T3) extra-event-choices
    const provinceExtra = getProvinceEffects()
      .filter(e => e.type === 'extra-event-choices')
      .reduce((sum, e) => sum + ('count' in e ? e.count : 0), 0);
    const extraCount = getExtraEventChoices() + provinceExtra;
    if (extraCount > 0) {
      // Pull bonus choices from other eligible events
      const otherContext = { ...context, seenThisSpoke: new Set<string>() };
      const bonusChoices: EventChoice[] = [];
      // Deduplicate: track all choice texts already seen (from base event + bonus picks so far)
      const seenTexts = new Set(event.choices.map(c => c.text));
      const allEvents = [pickEvent(otherContext), pickEvent(otherContext), pickEvent(otherContext)];
      for (const other of allEvents) {
        if (other.id === event.id) continue;
        for (const choice of other.choices) {
          if (bonusChoices.length >= extraCount) break;
          if (!seenTexts.has(choice.text)) {
            bonusChoices.push(choice);
            seenTexts.add(choice.text);
          }
        }
        if (bonusChoices.length >= extraCount) break;
      }
      activeEvent.value = { ...event, choices: [...event.choices, ...bonusChoices] };
    } else {
      activeEvent.value = event;
    }
    showEventModal.value = true;
  }

  function handleEventChoice(choice: EventChoice) {
    applyEventChoice(choice, grantSpokeResource, spendResource, commander?.faction);
    showEventModal.value = false;
    activeEvent.value = null;
    justResolvedIndex.value = nodeIdx;
    setTimeout(() => { justResolvedIndex.value = null; }, 400);
    const result = advanceNode();
    if (result.seasonTicked) {
      lastSeasonTick.value = result.seasonTicked;
      showSeasonModal.value = true;
    }
  }

  // Show the spoke complete modal when all nodes are resolved; pre-roll city candidates
  if (spokeComplete && !showSpokeCompleteModal.value && cityCandidates.value.length === 0) {
    const indices = getCandidateIndices(2);
    cityCandidates.value = indices.map(mapIndex => {
      const { terrain, tradeGood } = assignProvinceIdentity();
      return {
        mapIndex,
        name: PROVINCE_NAMES[mapIndex] ?? `Province ${mapIndex}`,
        terrain,
        tradeGood,
        wealth: calculateInitialWealth(terrain, tradeGood, 3),
      };
    });
    showSpokeCompleteModal.value = true;
  }

  function handleReturnToHub() {
    // Apply completion bonus once, before marking spoke complete
    const faction = commander?.faction;
    grantSpokeResource('gold', 3, faction);
    grantSpokeResource('faith', 2, faction);
    grantSpokeResource('influence', 2, faction);
    grantSpokeResource('momentum', 2, faction);

    // Grant XP to each seated advisor; collect names of those who tiered up
    const newTierUps: string[] = [];
    for (const advisor of councilSlots.value) {
      if (advisor !== null) {
        const tieredUp = grantAdvisorXp(advisor.id, 1);
        if (tieredUp) newTierUps.push(advisor.name);
      }
    }
    if (newTierUps.length > 0) tierUpNotices.value = newTierUps;

    // Transition to city choice — province creation happens when player picks a city
    showSpokeCompleteModal.value = false;
    if (cityCandidates.value.length === 0) {
      // Fallback: no candidates available (map fully claimed), create province immediately
      if (spoke) conquerProvince(spoke.label, spokeGains.value, spoke.duration);
      completedSpokes.value += 1;
      completeSpoke();
      navigateTo('hub');
    } else {
      showCityChoiceModal.value = true;
    }
  }

  function handleCityChosen(city: CityCandidate) {
    if (spoke) {
      conquerProvince(city.name, spokeGains.value, spoke.duration, {
        terrain: city.terrain,
        tradeGood: city.tradeGood,
        mapIndex: city.mapIndex,
      });
    }
    showCityChoiceModal.value = false;
    cityCandidates.value = [];
    completedSpokes.value += 1;
    completeSpoke();
    navigateTo('hub');
  }

  // Current node for dynamic hint
  const morale = spoke.boundArmy ? computeArmyMorale(spoke) : null;
  const currentNode = spoke.nodes[nodeIdx] ?? null;
  const resolvedCount = spoke.nodes.filter(n => n.resolved).length;
  const progressPct = Math.round((resolvedCount / spoke.nodes.length) * 100);
  const supplies = spoke.boundArmy?.supplies ?? 0;
  const actionDisabledReason = selectedNodeForPanel?.resolved
    ? 'Already resolved'
    : isCurrentSelected
      ? undefined
      : 'Select your current landmark to act';

  return (
    <div class="bellum-stage">
      <BellumTopBar spoke={spoke} morale={morale} accent={color} />
      <div class="bellum-map-area">
        <div
          class="bellum-pan-layer"
          style={{ transform: `translate3d(${mapPan.x}px, ${mapPan.y}px, 0)` }}
          onPointerDown={handleMapPointerDown}
          onPointerMove={handleMapPointerMove}
          onPointerUp={endMapDrag}
          onPointerCancel={endMapDrag}
        >
          <MapBackdrop />
          <BellumMap
            spoke={spoke}
            nodeIdx={nodeIdx}
            selectedId={selectedId}
            accent={color}
            onSelect={(node) => { selectedNodeId.value = node.id; }}
          />
        </div>
        {!spokeComplete && (
          <BellumSelectedPanel
            node={selectedNodeForPanel}
            isCurrent={isCurrentSelected}
            actionDisabledReason={actionDisabledReason}
            accent={color}
            onAction={handleSelectedAction}
          />
        )}
        <BellumLegend accent={color} />
        <BellumArmyStrip
          spoke={spoke}
          morale={morale}
          accent={color}
          onDetails={() => { showArmyHUDOnMap.value = true; }}
          onRetreat={() => { showRetreatConfirm.value = true; }}
        />
      </div>
      <OrnateFrame width="min(1100px, 94vw)" style={{ display: 'none' }}>
        <OrnateHeader
          eyebrow="Spoke"
          title={spoke.label}
          titleSize="md"
          onClose={() => navigateTo('hub')}
          accentColor={color}
        />

        {/* S27-07: campaign stats bar (military focus — no hub resources) */}
        <SpokeTopBar />

        {/* Node map body */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

        {/* S27-08: campaign-map node chain — landmark tiles + state-aware
            route lines. Per-node Y jitter gives the chain a winding path
            feel rather than a perfectly straight button row. */}
        <div
          class="node-chain-scroll"
          style={{ width: '100%', overflowX: 'auto', padding: '64px 0 56px' }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            margin: '0 auto',
            padding: `0 clamp(12px, 5vw, 32px)`,
            width: 'max-content',
            minWidth: '100%',
            justifyContent: 'center',
            gap: '14px',
          }}>
            {spoke.nodes.map((node, i) => {
              // Subtle vertical jitter — start/boss stay on axis, mid-nodes
              // ride a sine wave so the chain reads as a winding route.
              const isEdge = i === 0 || i === spoke.nodes.length - 1;
              const jitterY = isEdge ? 0 : Math.sin(i * 0.85) * 8;

              const lineState: RouteLineState = i === 0
                ? 'reachable' // unused (no line before index 0)
                : spoke.nodes[i - 1].resolved && node.resolved
                  ? 'resolved'
                  : i === nodeIdx
                    ? 'current'
                    : i <= nodeIdx + 1
                      ? 'reachable'
                      : 'locked';

              const isReachable = node.resolved || i === nodeIdx || i === nodeIdx + 1;
              // Only render branches at-or-ahead of the player. Once we've
              // walked past the fork, the unused branch is dead — hide it
              // instead of leaving a locked tile floating on the map.
              const branchesHere = spoke.branches?.filter(
                b => b.attachAfter === i && b.attachAfter >= nodeIdx,
              ) ?? [];

              return (
                <Fragment key={node.id}>
                  {i > 0 && (
                    <RouteLine state={lineState} color={color} />
                  )}
                  <div
                    class={justResolvedIndex.value === i ? 'node-resolving' : undefined}
                    style={{ transform: `translateY(${jitterY}px)`, position: 'relative' }}
                  >
                    <LandmarkNode
                      node={node}
                      isCurrent={i === nodeIdx}
                      isSelected={selectedId === node.id}
                      isReachable={isReachable}
                      color={color}
                      onActivate={() => handleNodeActivate(node)}
                      onSelect={() => { selectedNodeId.value = node.id; }}
                    />
                    {/* S27-08: render branches attached to this node as a
                        chain hanging off the main path. Only the HEAD is
                        activatable (commits the chain via chooseBranch);
                        tail nodes are inspect-only until commitment. */}
                    {branchesHere.map((b, branchIdx) => {
                      const branchReachable = i === nodeIdx;
                      const branchLineState: RouteLineState = branchReachable ? 'reachable' : 'locked';
                      // Alternate vertical offset per branch so multiple
                      // branches at adjacent indices don't fully overlap.
                      const verticalOffset = 36 + branchIdx * 6;
                      return (
                        <div
                          key={b.nodes[0].id}
                          style={{
                            position: 'absolute',
                            top: '100%',
                            left: '50%',
                            transform: `translate(-30%, ${verticalOffset}px)`,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            pointerEvents: 'auto',
                          }}
                        >
                          <RouteLine state={branchLineState} color={color} direction="down-right" length={48} />
                          {b.nodes.map((chainNode, chainIdx) => {
                            const isHead = chainIdx === 0;
                            return (
                              <Fragment key={chainNode.id}>
                                {chainIdx > 0 && (
                                  <RouteLine state={branchLineState} color={color} direction="horizontal" length={32} />
                                )}
                                <LandmarkNode
                                  node={chainNode}
                                  isCurrent={false}
                                  isSelected={selectedId === chainNode.id}
                                  isReachable={branchReachable && isHead}
                                  color={color}
                                  onActivate={() => {
                                    // Only the head commits the branch.
                                    if (!branchReachable || !isHead) return;
                                    activateBranch(chainNode.id);
                                  }}
                                  onSelect={() => { selectedNodeId.value = chainNode.id; }}
                                />
                              </Fragment>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </Fragment>
              );
            })}
          </div>
        </div>

        {/* Dynamic hint text */}
        {!spokeComplete && currentNode && (
          <div style={{
            marginTop: '8px', fontSize: 'var(--font-size-md)',
            color: `${NODE_STYLES[currentNode.type].color}`,
            letterSpacing: '1px',
            fontStyle: 'italic',
            textShadow: `0 0 12px ${NODE_STYLES[currentNode.type].glow}`,
          }}>
            {NODE_STYLES[currentNode.type].hint}
          </div>
        )}

        {/* Progress bar */}
        <div style={{
          marginTop: '16px',
          width: '280px', maxWidth: '80%',
          height: '3px',
          background: 'rgba(60, 56, 80, 0.6)',
          borderRadius: '2px',
          overflow: 'hidden',
          border: '1px solid rgba(80, 70, 50, 0.2)',
        }}>
          <div style={{
            width: `${progressPct}%`,
            height: '100%',
            background: `linear-gradient(90deg, ${color}, ${color}cc)`,
            borderRadius: '2px',
            transition: 'width 0.6s ease-out',
            boxShadow: `0 0 8px ${color}40`,
          }} />
        </div>

        {/* Army bar — shown when spoke has a bound army */}
        {spoke.boundArmy && spoke.boundArmy.cohorts.length > 0 && (
          <button
            class="hub-panel-btn"
            onClick={() => { showArmyHUDOnMap.value = true; }}
            style={{
              marginTop: '12px',
              padding: '5px 14px',
              background: 'rgba(30, 28, 48, 0.7)',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--color-text-secondary)',
              fontFamily: 'inherit', fontSize: 'var(--font-size-xs)',
              letterSpacing: '1px',
            }}
          >
            ⚔ {spoke.boundArmy.cohorts.length} cohort{spoke.boundArmy.cohorts.length !== 1 ? 's' : ''}
            {spoke.boundLegate ? ` · ${spoke.boundLegate.name.split(' ')[0]}` : ''}
            {' · '}📦 {supplies}
            {morale && (
              <>
                {' · '}
                <span style={{ color: MORALE_TIER_COLOR[morale.tier] }}>
                  🔥 {moraleTierLabel(morale.tier)} {morale.total}
                </span>
              </>
            )}
          </button>
        )}

        {/* S27-07: selected-landmark details panel */}
        {!spokeComplete && selectedNodeForPanel && (
          <LandmarkDetailsPanel
            node={selectedNodeForPanel}
            isCurrent={isCurrentSelected}
            onAction={handleSelectedAction}
            accentColor={color}
          />
        )}

        {/* Retreat button — bottom of frame */}
        <div style={{ marginTop: '20px', alignSelf: 'flex-start' }}>
          <button class="retreat-btn ornate-btn-ghost" onClick={() => { showRetreatConfirm.value = true; }} style={{
            padding: '8px 18px',
          }}>
            Retreat
          </button>
        </div>

        </div>{/* end node map body */}
      </OrnateFrame>

      {/* Rest modal */}
      {showRestModal.value && (
        <NodeModal title="Your Army Rests" onClose={handleRestContinue}>
          {(() => {
            const preview = restPreview.value;
            const canReplenish = !!preview && preview.iunioresSpent > 0;
            return (
              <>
          <div style={{ fontSize: 'var(--font-size-md)', color: 'var(--color-text-muted)', lineHeight: '1.5', marginBottom: '16px' }}>
            Choose whether to spend iuniores on replenishment before moving on. Rest rewards below are already secured.
          </div>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '20px' }}>
            {restGains.value.map((g) => (
              <div key={g.type} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, color: RESOURCE_INFO[g.type].color }}>
                  {RESOURCE_INFO[g.type].icon} +{g.actual} {RESOURCE_INFO[g.type].label}
                </span>
                {g.isPrimary && (
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-gold-dim)', letterSpacing: '0.5px' }}>
                    (primary)
                  </span>
                )}
              </div>
            ))}
          </div>
          {(() => {
            if (!preview || preview.perCohort.length === 0) {
              return (
                <div style={{
                  fontSize: 'var(--font-size-sm)',
                  color: 'var(--color-text-muted)',
                  fontStyle: 'italic',
                  textAlign: 'center',
                  marginBottom: '20px',
                }}>
                  No bound army is present at this rest node.
                </div>
              );
            }

            const damagedCohorts = preview.perCohort.filter(c => c.missingHp > 0);
            const remainingDamage = preview.totalIunioresNeeded > preview.iunioresSpent
              ? damagedCohorts.reduce((sum, c) => sum + (c.maxHp - c.newCurrentHp), 0)
              : 0;

            return (
              <div style={{
                marginBottom: '20px',
                padding: '14px 16px',
                background: 'rgba(28, 26, 40, 0.82)',
                border: '1px solid rgba(212, 168, 67, 0.18)',
                borderRadius: 'var(--radius-sm)',
              }}>
                <div style={{
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 700,
                  color: 'var(--color-text-muted)',
                  letterSpacing: '2px',
                  textTransform: 'uppercase',
                  marginBottom: '10px',
                }}>
                  Replenishment Preview
                </div>
                {damagedCohorts.length === 0 ? (
                  <div style={{
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--color-text-secondary)',
                    lineHeight: 1.5,
                  }}>
                    Army at full strength. No iuniores will be spent.
                  </div>
                ) : preview.partialHeal ? (
                  <div style={{
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--color-text-secondary)',
                    lineHeight: 1.6,
                    marginBottom: '12px',
                  }}>
                    Pool has <span style={{ color: '#a88b5c', fontWeight: 700 }}>{preview.iunioresAvailable} iuniores</span>; partial heal will restore{' '}
                    <span style={{ color: 'var(--color-gold-secondary)', fontWeight: 700 }}>{preview.hpRestored} HP</span> across{' '}
                    <span style={{ color: 'var(--color-text-primary)', fontWeight: 700 }}>{damagedCohorts.length} cohorts</span>.{' '}
                    <span style={{ color: '#c27a52', fontWeight: 700 }}>{remainingDamage} HP</span> remains damaged.
                  </div>
                ) : (
                  <div style={{
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--color-text-secondary)',
                    lineHeight: 1.6,
                    marginBottom: '12px',
                  }}>
                    Replenish army: <span style={{ color: '#a88b5c', fontWeight: 700 }}>{preview.iunioresSpent} iuniores</span> to restore{' '}
                    <span style={{ color: 'var(--color-gold-secondary)', fontWeight: 700 }}>{preview.hpRestored} HP</span> across{' '}
                    <span style={{ color: 'var(--color-text-primary)', fontWeight: 700 }}>{damagedCohorts.length} cohorts</span>.
                  </div>
                )}

                {damagedCohorts.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {damagedCohorts.map((c) => {
                      const beforePct = c.maxHp > 0 ? (c.currentHp / c.maxHp) * 100 : 0;
                      const afterPct = c.maxHp > 0 ? (c.newCurrentHp / c.maxHp) * 100 : 0;
                      return (
                        <div key={c.cohortInstanceId} style={{
                          padding: '8px 10px',
                          background: 'rgba(12, 12, 18, 0.35)',
                          border: '1px solid rgba(212, 168, 67, 0.12)',
                          borderRadius: 'var(--radius-sm)',
                        }}>
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: '12px',
                            marginBottom: '6px',
                            alignItems: 'baseline',
                          }}>
                            <span style={{
                              fontSize: 'var(--font-size-sm)',
                              color: 'var(--color-text-primary)',
                              fontWeight: 600,
                            }}>
                              {c.cohortName}
                            </span>
                            <span style={{
                              fontSize: 'var(--font-size-xs)',
                              color: '#a88b5c',
                              letterSpacing: '1px',
                              textTransform: 'uppercase',
                            }}>
                              {c.iunioresSpent} 🛡
                            </span>
                          </div>
                          <div style={{
                            position: 'relative',
                            height: '8px',
                            background: 'rgba(60, 56, 80, 0.55)',
                            borderRadius: '999px',
                            overflow: 'hidden',
                            marginBottom: '6px',
                          }}>
                            <div style={{
                              position: 'absolute',
                              inset: 0,
                              width: `${beforePct}%`,
                              background: 'rgba(120, 92, 76, 0.85)',
                            }} />
                            <div style={{
                              position: 'absolute',
                              inset: 0,
                              width: `${afterPct}%`,
                              background: 'linear-gradient(90deg, #4a9a6a 0%, #7ecf97 100%)',
                              opacity: 0.85,
                            }} />
                          </div>
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: '8px',
                            fontSize: 'var(--font-size-xs)',
                            color: 'var(--color-text-muted)',
                          }}>
                            <span>{c.currentHp}/{c.maxHp} HP</span>
                            <span>+{c.hpRestored} HP</span>
                            <span>{c.newCurrentHp}/{c.maxHp} HP</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}

          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <button class="modal-action-btn ornate-btn-ghost" onClick={handleRestContinue} style={{
              padding: '10px 24px',
            }}>
              Continue Without Replenishing
            </button>
            <button
              class="modal-action-btn ornate-btn"
              onClick={handleRestReplenish}
              disabled={!canReplenish}
              style={{
                padding: '10px 24px',
                opacity: canReplenish ? 1 : 0.6,
                cursor: canReplenish ? 'pointer' : 'not-allowed',
              }}
              title={canReplenish ? 'Spend iuniores and restore HP.' : 'Army at full strength.'}
            >
              Replenish And Continue
            </button>
          </div>
              </>
            );
          })()}
        </NodeModal>
      )}

      {/* Event modal */}
      {showEventModal.value && activeEvent.value && (
        <>
          <EventModal
            event={activeEvent.value}
            onChoice={(index) => {
              const choice = activeEvent.value!.choices[index];
              handleEventChoice(choice);
            }}
            currentResources={{
              gold: getResource('gold'),
              faith: getResource('faith'),
              influence: getResource('influence'),
              momentum: getResource('momentum'),
            }}
          />
          {/* S7-12: Manipulate — Augustus event reroll, rendered as fixed overlay */}
          {manipulateUsesLeft.value > 0 && (
            <div
              style={{
                position: 'fixed',
                top: 'calc(50% + 240px)',   // below the ~480px tall modal card
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 210,
                width: '100%',
                maxWidth: '520px',
                padding: '0 16px',
                boxSizing: 'border-box' as const,
              }}
            >
              <button
                class="manipulate-reroll-btn"
                onClick={() => {
                  if (consumeManipulateUse()) {
                    // Tier 1 fix: clear stale event before re-picking so modal gets a clean state
                    activeEvent.value = null;
                    openEventModal();
                  }
                }}
                style={{
                  padding: '8px 14px', borderRadius: 'var(--radius-sm)',
                  background: 'rgba(30, 50, 100, 0.4)',
                  border: '1px solid rgba(74, 124, 194, 0.4)',
                  color: '#4a7cc2', fontFamily: 'inherit', fontSize: 'var(--font-size-sm)',
                  fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase',
                  width: '100%', textAlign: 'center',
                }}
              >
                Manipulate — Reroll Event ({manipulateUsesLeft.value} left)
              </button>
            </div>
          )}
        </>
      )}

      {/* S27-09: encounter outcome modal — shows what's about to happen
          for forage/recruit/scout/ambush/hazard/unknown encounters. The
          modal does NOT apply effects directly; advanceNode() does that
          (single application site, idempotent on resolved nodes). */}
      {outcomeModalNode.value && outcomeModalKind.value && (
        <NodeModal title={outcomeModalTitle(outcomeModalKind.value)} onClose={handleOutcomeContinue}>
          <EncounterOutcomePreview
            node={outcomeModalNode.value}
            kind={outcomeModalKind.value}
            onContinue={handleOutcomeContinue}
          />
        </NodeModal>
      )}

      {/* Spoke completion summary modal */}
      {showSpokeCompleteModal.value && (
        <NodeModal title={`${spoke.label} \u2014 Complete!`} onClose={handleReturnToHub}>
          {(() => {
            const battlesWon = spoke.nodes.filter((n) => (n.type === 'battle' || n.type === 'boss') && n.resolved).length;
            const gains = spokeGains.value;
            const allTypes: ResourceType[] = ['gold', 'faith', 'influence', 'momentum'];
            return (
              <>
                <div style={{
                  display: 'flex', gap: '16px', justifyContent: 'center',
                  marginBottom: '16px', fontSize: 'var(--font-size-md)', color: 'var(--color-text-muted)',
                }}>
                  <span>{spoke.nodes.length} nodes resolved</span>
                  <span>{battlesWon} battles won</span>
                </div>
                <div style={{
                  fontSize: 'var(--font-size-sm)', letterSpacing: '1px', textTransform: 'uppercase',
                  color: 'var(--color-text-muted)', marginBottom: '8px',
                }}>
                  Total Gains
                </div>
                <div style={{
                  display: 'flex', gap: '12px', justifyContent: 'center',
                  flexWrap: 'wrap', marginBottom: '20px',
                }}>
                  {allTypes.filter(t => gains[t] > 0).map(t => (
                    <span key={t} style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, color: RESOURCE_INFO[t].color }}>
                      {RESOURCE_INFO[t].icon} +{gains[t]} {RESOURCE_INFO[t].label}
                    </span>
                  ))}
                </div>
                <button class="modal-action-btn ornate-btn" onClick={handleReturnToHub} style={{
                  padding: '10px 24px',
                }}>
                  Choose Your Conquest →
                </button>
              </>
            );
          })()}
        </NodeModal>
      )}

      {/* City conquest choice modal */}
      {showCityChoiceModal.value && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.80)',
            zIndex: 210, display: 'flex', alignItems: 'center',
            justifyContent: 'center', padding: '20px',
          }}
        >
          <OrnateFrame width="min(680px, 94vw)" padding="compact">
            <OrnateHeader
              eyebrow="Spoke Complete"
              title="Choose Your Conquest"
              titleSize="md"
            />
            <p style={{
              textAlign: 'center', fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-muted)', margin: '0 0 20px',
            }}>
              Your campaign has earned a new territory. Choose wisely.
            </p>
            <div style={{
              display: 'flex', gap: '16px', justifyContent: 'center',
              flexWrap: 'wrap', paddingBottom: '8px',
            }}>
              {cityCandidates.value.map(city => (
                <div
                  key={city.mapIndex}
                  class="city-card"
                  onClick={() => handleCityChosen(city)}
                  style={{
                    flex: '1 1 240px', maxWidth: '260px', display: 'flex', flexDirection: 'column', gap: '0',
                    background: 'var(--color-marble-dark)',
                    border: '1px solid var(--color-border-default)',
                    borderTop: '2px solid var(--color-gold-secondary)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: 'var(--shadow-md)',
                    overflow: 'hidden',
                  }}
                >
                  {/* Card header */}
                  <div style={{
                    padding: '14px 16px 10px',
                    borderBottom: '1px solid var(--color-border-subtle)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '22px', lineHeight: 1 }}>{TERRAIN_ICON[city.terrain]}</span>
                      <span style={{
                        fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: 700,
                        color: 'var(--color-text-primary)', letterSpacing: '1.5px',
                        textTransform: 'uppercase',
                      }}>
                        {city.name}
                      </span>
                    </div>
                    <div style={{
                      fontSize: 'var(--font-size-xs)', letterSpacing: '1.5px',
                      textTransform: 'uppercase', color: 'var(--color-text-muted)',
                    }}>
                      {city.terrain}
                    </div>
                  </div>

                  {/* Stats */}
                  <div style={{ padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                      <span style={{ fontSize: '14px' }}>{TRADE_GOOD_ICON[city.tradeGood]}</span>
                      <span>{TRADE_GOOD_DATA[city.tradeGood].name}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                      <span style={{ fontSize: '13px' }}>🪙</span>
                      <span>Initial Wealth: </span>
                      <strong style={{ color: 'var(--color-gold-primary)' }}>{city.wealth}g</strong>
                    </div>
                  </div>

                  {/* Capture CTA */}
                  <div style={{ padding: '10px 12px 12px' }}>
                    <div
                      class="ornate-btn"
                      style={{ width: '100%', padding: '8px', textAlign: 'center' }}
                    >
                      Capture {city.name}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </OrnateFrame>
        </div>
      )}

      {/* Season tick modal */}
      {showSeasonModal.value && lastSeasonTick.value && (
        <NodeModal title={`Season ${lastSeasonTick.value.season} Begins`} onClose={() => { showSeasonModal.value = false; }}>
          <div style={{ fontSize: 'var(--font-size-md)', color: 'var(--color-text-secondary)', lineHeight: '1.6', display: 'flex', flexDirection: 'column', gap: '6px', textAlign: 'left' }}>
            {/* Upkeep paid */}
            {lastSeasonTick.value.upkeepPaid.length > 0 && (
              <div style={{
                padding: '8px 10px', borderRadius: 'var(--radius-md)',
                background: 'rgba(60, 50, 20, 0.2)',
                border: '1px solid var(--color-border-subtle)',
              }}>
                <div style={{ color: 'var(--color-text-primary)', letterSpacing: '1.5px', fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '4px' }}>Upkeep Paid</div>
                {lastSeasonTick.value.upkeepPaid.map((u, i) => (
                  <div key={i} style={{ color: 'rgba(200, 130, 130, 0.8)', fontSize: 'var(--font-size-sm)' }}>
                    {RESOURCE_INFO[u.resource].icon} -{u.amount} {RESOURCE_INFO[u.resource].label}
                  </div>
                ))}
              </div>
            )}
            {/* Upkeep shortfall */}
            {lastSeasonTick.value.upkeepShortfall.length > 0 && (
              <div style={{
                padding: '8px 10px', borderRadius: 'var(--radius-md)',
                background: 'rgba(120, 40, 30, 0.15)',
                border: '1px solid rgba(200, 80, 60, 0.2)',
              }}>
                <div style={{ color: '#c05050', letterSpacing: '1.5px', fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '4px' }}>Shortfall</div>
                {lastSeasonTick.value.upkeepShortfall.map((u, i) => (
                  <div key={i} style={{ color: '#c05050', fontSize: 'var(--font-size-sm)' }}>
                    {RESOURCE_INFO[u.resource].icon} Cannot afford {u.deficit} {RESOURCE_INFO[u.resource].label}
                  </div>
                ))}
              </div>
            )}
            {/* Province income */}
            {lastSeasonTick.value.provinceIncome && lastSeasonTick.value.provinceIncome.incomeGained.length > 0 && (
              <div style={{
                padding: '8px 10px', borderRadius: 'var(--radius-md)',
                background: 'rgba(30, 60, 30, 0.15)',
                border: '1px solid rgba(90, 160, 90, 0.12)',
              }}>
                <div style={{ color: 'rgba(90, 160, 90, 0.7)', letterSpacing: '1.5px', fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '4px' }}>Province Income</div>
                {lastSeasonTick.value.provinceIncome.incomeGained.map((u, i) => (
                  <div key={i} style={{ color: 'rgba(130, 200, 130, 0.8)', fontSize: 'var(--font-size-sm)' }}>
                    {RESOURCE_INFO[u.resource].icon} +{u.amount} {RESOURCE_INFO[u.resource].label}
                  </div>
                ))}
              </div>
            )}
            {/* Province expenses */}
            {lastSeasonTick.value.provinceIncome && lastSeasonTick.value.provinceIncome.expensesPaid > 0 && (
              <div style={{
                padding: '8px 10px', borderRadius: 'var(--radius-md)',
                background: 'rgba(60, 50, 20, 0.15)',
                border: '1px solid var(--color-border-subtle)',
              }}>
                <div style={{ color: 'rgba(200, 160, 100, 0.6)', letterSpacing: '1.5px', fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '4px' }}>Province Expenses</div>
                <div style={{ color: 'rgba(200, 160, 100, 0.7)', fontSize: 'var(--font-size-sm)' }}>
                  {RESOURCE_INFO.gold.icon} -{lastSeasonTick.value.provinceIncome.expensesPaid} Gold
                </div>
              </div>
            )}
            {/* Province expense shortfall */}
            {lastSeasonTick.value.provinceIncome && lastSeasonTick.value.provinceIncome.expenseShortfall > 0 && (
              <div style={{
                padding: '8px 10px', borderRadius: 'var(--radius-md)',
                background: 'rgba(120, 40, 30, 0.15)',
                border: '1px solid rgba(200, 80, 60, 0.2)',
              }}>
                <div style={{ color: '#c05050', letterSpacing: '1.5px', fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '4px' }}>Province Expense Shortfall</div>
                <div style={{ color: '#c05050', fontSize: 'var(--font-size-sm)' }}>
                  {RESOURCE_INFO.gold.icon} Cannot afford {lastSeasonTick.value.provinceIncome.expenseShortfall} Gold upkeep
                </div>
              </div>
            )}
            {/* Rebellion */}
            {lastSeasonTick.value.provinceIncome && lastSeasonTick.value.provinceIncome.rebellions.length > 0 && (
              <div style={{
                padding: '8px 10px', borderRadius: 'var(--radius-md)',
                background: 'rgba(140, 30, 20, 0.2)',
                border: '1px solid rgba(200, 60, 50, 0.3)',
              }}>
                <div style={{ color: '#e04040', letterSpacing: '1.5px', fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '4px' }}>Rebellion!</div>
                {lastSeasonTick.value.provinceIncome.rebellions.map((r, i) => (
                  <div key={i} style={{ color: '#e06050', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
                    {r.provinceName}: {r.lostInvestment ? `${r.lostInvestment} destroyed` : 'unrest critical'}
                  </div>
                ))}
              </div>
            )}
            {/* Threat */}
            <div style={{
              padding: '6px 10px', borderRadius: 'var(--radius-md)',
              background: 'rgba(60, 50, 20, 0.15)',
              border: '1px solid var(--color-border-subtle)',
              textAlign: 'center',
            }}>
              <span style={{ color: 'rgba(200, 160, 100, 0.7)', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
                Threat +{lastSeasonTick.value.threatIncrease} &middot; Season {lastSeasonTick.value.globalSeason}/{24}
              </span>
            </div>
          </div>
          <button class="modal-action-btn ornate-btn" onClick={() => { showSeasonModal.value = false; }} style={{
            marginTop: '14px', padding: '10px 24px',
          }}>
            Continue
          </button>
        </NodeModal>
      )}

      {/* Retreat confirmation modal */}
      {showRetreatConfirm.value && (
        <RetreatConfirmModal
          onConfirm={handleRetreat}
          onCancel={() => { showRetreatConfirm.value = false; }}
        />
      )}

      {/* Army Detail HUD — triggered from the army bar */}
      {showArmyHUDOnMap.value && spoke.boundArmy && (
        <ArmyDetailHUD
          army={spoke.boundArmy}
          legate={spoke.boundLegate ?? null}
          morale={computeArmyMorale(spoke)}
          onClose={() => { showArmyHUDOnMap.value = false; }}
        />
      )}
    </div>
  );
}
