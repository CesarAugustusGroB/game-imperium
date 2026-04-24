import { Fragment } from 'preact';
import { signal } from '@preact/signals';
import { useEffect, useState } from 'preact/hooks';
import { navigateTo } from '../screens';
import { OrnateFrame, OrnateHeader } from '../components/OrnateFrame';
import { currentSpoke, currentNodeIndex, resetSpoke, advanceNode, completeSpoke, grantSpokeResource, spokeGains } from '../../game/progression/spoke';
import type { SpokeNode, NodeType, SeasonTickResult } from '../../game/progression/spoke';
import { selectedCommander, completedSpokes, threatLevel } from '../../game/core/game-state';
import { conquerProvince, assignProvinceIdentity, getProvinceEffects } from '../../game/province/province-store';
import { getCandidateIndices, PROVINCE_NAMES } from '../../game/province/province-map-store';
import { calculateInitialWealth } from '../../game/province/province';
import type { TerrainType } from '../../data/terrain-data';
import type { TradeGoodType } from '../../data/trade-goods';
import { TRADE_GOOD_DATA } from '../../data/trade-goods';
import { FACTION_COLORS, RESOURCE_INFO, FACTION_PRIMARY_RESOURCE } from '../../game/core/commander';
import type { ResourceType } from '../../game/core/commander';
import { spendResource, getResource } from '../../game/core/resources';
import { NodeModal } from './NodeModal';
import { EventModal } from '../components/EventModal';
import type { GameEvent, EventChoice } from '../../game/events/event-types';
import { pickEvent, buildEventContext, applyEventChoice } from '../../game/events/event-engine';
import { getExtraEventChoices } from '../../game/items/doctrine-store';
import { manipulateUsesLeft, consumeManipulateUse } from '../../game/progression/strategic-store';
import { councilSlots, grantAdvisorXp, tierUpNotices } from '../../game/council/council-store';
import { ArmyDetailHUD } from '../components/ArmyDetailHUD';
import { computeArmyMorale } from '../../game/army/morale';
import type { MoraleTier } from '../../game/army/morale';
import { previewReplenishment, replenishBoundArmy } from '../../game/army/army-replenishment';
import type { ReplenishmentPreview } from '../../game/army/army-replenishment';

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
  `;
  document.head.appendChild(el);
}

// ── Icons per node type ──
const NODE_ICONS: Record<NodeType, string> = {
  battle: '\u2694\uFE0F',
  rest:   '\uD83C\uDFD5\uFE0F',
  event:  '\uD83D\uDCDC',
  boss:   '\uD83D\uDC80',
};

const NODE_LABELS: Record<NodeType, string> = {
  battle: 'Battle',
  rest: 'Rest',
  event: 'Event',
  boss: 'Boss',
};

// ── Node type visual styles ──
const NODE_STYLES: Record<NodeType, { color: string; glow: string; hoverLabel: string; hint: string }> = {
  battle: { color: '#c24a3a', glow: '#c24a3a60', hoverLabel: 'Enter Battle',       hint: 'Prepare for battle...' },
  rest:   { color: '#4a9a6a', glow: '#4a9a6a60', hoverLabel: 'Rest Here',           hint: 'A place to rest...' },
  event:  { color: '#d4a843', glow: '#d4a84360', hoverLabel: 'Make a Choice',       hint: 'Something stirs ahead...' },
  boss:   { color: '#8a4ac2', glow: '#8a4ac260', hoverLabel: 'Face the Boss',       hint: 'The final challenge awaits...' },
};

// S24-05: tier → badge color (matches ArmyDetailHUD palette).
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

const NODE_SIZE_REGULAR = 68;
const NODE_SIZE_BOSS = 82;

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

function NodeCircle({ node, isCurrent, color, onActivate }: {
  node: SpokeNode;
  isCurrent: boolean;
  color: string;
  onActivate: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const typeStyle = NODE_STYLES[node.type];
  const isBoss = node.type === 'boss';
  const size = isBoss ? NODE_SIZE_BOSS : NODE_SIZE_REGULAR;
  const stateClass = node.resolved
    ? 'node-resolved'
    : isCurrent
      ? `node-current${isBoss ? ' node-boss' : ''}`
      : 'node-future';

  function handleClick() {
    if (!isCurrent || node.resolved) return;
    onActivate();
  }

  // Compute background
  const bg = node.resolved
    ? `linear-gradient(135deg, rgba(40, 38, 55, 0.9), rgba(30, 28, 45, 0.95))`
    : isCurrent
      ? `linear-gradient(135deg, ${typeStyle.color}30, ${typeStyle.color}10)`
      : `linear-gradient(135deg, ${typeStyle.color}12, ${typeStyle.color}06)`;

  // Compute border color
  const borderColor = node.resolved
    ? 'rgba(212, 168, 67, 0.35)'
    : isCurrent
      ? typeStyle.color
      : `${typeStyle.color}25`;

  // Tooltip text
  const tooltipText = node.resolved
    ? 'Completed'
    : isCurrent
      ? typeStyle.hoverLabel
      : node.reward
        ? `${NODE_LABELS[node.type]} \u2014 ${node.reward.map(r => `${RESOURCE_INFO[r.resource].icon}${r.amount}`).join(' ')}`
        : NODE_LABELS[node.type];

  return (
    <div
      class={`node-circle ${stateClass}`}
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      role={isCurrent && !node.resolved ? 'button' : undefined}
      aria-label={isCurrent && !node.resolved ? `Activate ${NODE_LABELS[node.type]} node` : undefined}
      tabIndex={isCurrent && !node.resolved ? 0 : undefined}
      onKeyDown={isCurrent && !node.resolved ? (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onActivate(); } } : undefined}
      style={{
        '--glow': isCurrent ? typeStyle.glow : color + '60',
        '--type-glow': typeStyle.glow,
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '50%',
        background: bg,
        border: `${isCurrent ? 3 : 2}px solid ${borderColor}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        flexShrink: '0',
        outline: 'none',
      } as Record<string, string>}
    >
      {/* Icon */}
      {node.resolved ? (
        <>
          <span style={{ fontSize: isBoss ? '22px' : '18px', lineHeight: '1', opacity: 0.3 }}>
            {NODE_ICONS[node.type]}
          </span>
          <span class="checkmark-overlay" style={{
            position: 'absolute',
            fontSize: 'var(--font-size-lg)',
            lineHeight: '1',
            color: 'var(--color-gold-secondary)',
            textShadow: '0 0 8px rgba(212, 168, 67, 0.5)',
          }}>
            {'\u2714'}
          </span>
        </>
      ) : (
        <span style={{
          fontSize: isBoss ? '28px' : '22px',
          lineHeight: '1',
          filter: isCurrent ? `drop-shadow(0 0 4px ${typeStyle.glow})` : 'none',
        }}>
          {NODE_ICONS[node.type]}
        </span>
      )}

      {/* Label below circle */}
      <div style={{
        position: 'absolute',
        bottom: '-22px',
        fontSize: 'var(--font-size-xs)',
        letterSpacing: '1px',
        textTransform: 'uppercase',
        color: isCurrent ? typeStyle.color : node.resolved ? 'rgba(212, 168, 67, 0.6)' : `${typeStyle.color}80`,
        whiteSpace: 'nowrap',
        fontWeight: isCurrent ? '600' : '400',
      }}>
        {NODE_LABELS[node.type]}
      </div>

      {/* Tooltip on hover */}
      {hovered && (
        <div class="node-tooltip" style={{
          color: node.resolved ? 'var(--color-gold-secondary)' : isCurrent ? typeStyle.color : 'var(--color-text-secondary)',
        }}>
          {tooltipText}
        </div>
      )}
    </div>
  );
}

function ConnectingLine({ resolved, color, isNextActive }: {
  resolved: boolean;
  color: string;
  isNextActive: boolean;
}) {
  const lineClass = isNextActive ? 'line-next-active' : '';
  return (
    <div
      class={lineClass}
      aria-hidden="true"
      style={{
        '--faction-color': color,
        width: '64px',
        height: '3px',
        borderRadius: '1.5px',
        background: resolved
          ? `linear-gradient(90deg, ${color}60, ${color}35)`
          : 'repeating-linear-gradient(90deg, rgba(100,100,100,0.2) 0px, rgba(100,100,100,0.2) 6px, transparent 6px, transparent 12px)',
        flexShrink: '0',
        alignSelf: 'center',
        position: 'relative',
        boxShadow: resolved ? `0 0 6px ${color}30` : 'none',
      } as Record<string, string>}
    />
  );
}

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

export function NodeMapScreen() {
  const spoke = currentSpoke.value;
  const nodeIdx = currentNodeIndex.value;
  const commander = selectedCommander.value;
  const color = commander ? FACTION_COLORS[commander.faction] : '#f0d080';
  const spokeComplete = spoke ? nodeIdx >= spoke.nodes.length : false;

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
    if (node.type === 'battle' || node.type === 'boss') {
      navigateTo('battleV2');
    } else if (node.type === 'rest') {
      openRestModal();
    } else if (node.type === 'event') {
      openEventModal();
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
  const currentNode = spoke.nodes[nodeIdx] ?? null;
  const resolvedCount = spoke.nodes.filter(n => n.resolved).length;
  const progressPct = Math.round((resolvedCount / spoke.nodes.length) * 100);

  // S24-05: pre-battle morale for the bound army. Surfaced as a header pill
  // chip + an inline segment on the army bar. Breakdown lives in the modal
  // (ArmyDetailHUD).
  const morale = spoke.boundArmy ? computeArmyMorale(spoke) : null;
  const moraleTooltip = morale
    ? (morale.modifiers.length === 0
        ? `Morale — ${moraleTierLabel(morale.tier)} (${morale.total}). No modifiers active.`
        : `Morale — ${moraleTierLabel(morale.tier)} (${morale.total})\n` +
          morale.modifiers
            .slice()
            .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
            .map((m) => `  ${m.delta >= 0 ? '+' : ''}${m.delta}  ${m.label}`)
            .join('\n'))
    : undefined;

  const supplies = spoke.boundArmy?.supplies ?? 0;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100vh', fontFamily: 'var(--font-family)',
      background: 'var(--color-bg-primary)',
      paddingTop: '38px',
    }}>
      <OrnateFrame width="min(1100px, 94vw)">
        <OrnateHeader
          eyebrow="Spoke"
          title={spoke.label}
          titleSize="md"
          rightSlot={(
            <>
              {morale && (
                <span
                  class="ornate-stat-chip"
                  title={moraleTooltip}
                  style={{ color: MORALE_TIER_COLOR[morale.tier] }}
                >
                  🔥 <strong>{moraleTierLabel(morale.tier)} {morale.total}</strong>
                </span>
              )}
              {spoke.boundArmy && (
                <span class="ornate-stat-chip" title="Supplies">
                  📦 <strong>{supplies}</strong>
                </span>
              )}
              <span class="ornate-stat-chip" title="Posture" style={{ color: spoke.posture === 'attacking' ? '#e07050' : '#60a8d0' }}>
                {spoke.posture === 'attacking' ? '⚔' : '🛡'} <strong>{spoke.posture === 'attacking' ? 'Attacking' : 'Defending'}</strong>
              </span>
              <span class="ornate-stat-chip" title="Progress">
                🚩 <strong>{resolvedCount}/{spoke.nodes.length}</strong>
              </span>
              {spoke.duration > 1 && (
                <span class="ornate-stat-chip" title="Season">
                  🌿 <strong>S{spoke.currentSeason}/{spoke.duration}</strong>
                </span>
              )}
            </>
          )}
          onClose={() => navigateTo('hub')}
          accentColor={color}
        />

        {/* Node map body */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

        {/* Node chain */}
        <div
          class="node-chain-scroll"
          style={{ width: '100%', overflowX: 'auto', padding: '52px 0 36px' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', margin: '0 auto', padding: `0 clamp(12px, 5vw, 32px)`, width: 'max-content', minWidth: '100%', justifyContent: 'center' }}>
            {spoke.nodes.map((node, i) => (
              <Fragment key={node.id}>
                {i > 0 && (
                  <ConnectingLine
                    resolved={spoke.nodes[i - 1].resolved}
                    color={color}
                    isNextActive={i === nodeIdx && spoke.nodes[i - 1].resolved}
                  />
                )}
                <div class={justResolvedIndex.value === i ? 'node-resolving' : undefined} style={{ borderRadius: '50%' }}>
                  <NodeCircle
                    node={node}
                    isCurrent={i === nodeIdx}
                    color={color}
                    onActivate={() => handleNodeActivate(node)}
                  />
                </div>
              </Fragment>
            ))}
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
            const preview = restPreview.value;
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
                        <div key={`${c.cohortId}-${c.currentHp}-${c.newCurrentHp}`} style={{
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
              disabled={!restPreview.value || restPreview.value.iunioresSpent === 0}
              style={{
                padding: '10px 24px',
                opacity: !restPreview.value || restPreview.value.iunioresSpent === 0 ? 0.6 : 1,
                cursor: !restPreview.value || restPreview.value.iunioresSpent === 0 ? 'not-allowed' : 'pointer',
              }}
              title={!restPreview.value || restPreview.value.iunioresSpent === 0 ? 'Army at full strength.' : 'Spend iuniores and restore HP.'}
            >
              Replenish And Continue
            </button>
          </div>
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
              {lastSeasonTick.value.doomUpkeep > 0 && (
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'rgba(200, 130, 130, 0.7)', marginTop: '2px' }}>
                  Doom drain: -{lastSeasonTick.value.doomUpkeep}g
                </div>
              )}
            </div>
            {lastSeasonTick.value.doomMilestone && (
              <div style={{
                padding: '8px 12px', borderRadius: 'var(--radius-md)',
                background: 'rgba(140, 30, 20, 0.25)',
                border: '1px solid rgba(200, 60, 50, 0.3)',
                textAlign: 'center',
              }}>
                <span style={{ color: '#e06050', fontSize: 'var(--font-size-sm)', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>
                  {lastSeasonTick.value.doomMilestone}
                </span>
              </div>
            )}
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
