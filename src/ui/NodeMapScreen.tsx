import { Fragment } from 'preact';
import { signal } from '@preact/signals';
import { useEffect, useState } from 'preact/hooks';
import { navigateTo } from './screens';
import { currentSpoke, currentNodeIndex, resetSpoke, advanceNode, completeSpoke, grantSpokeResource, spokeGains } from '../game/spoke';
import type { SpokeNode, NodeType, SeasonTickResult } from '../game/spoke';
import { selectedCommander, completedSpokes, threatLevel } from '../game/game-state';
import { conquerProvince, getProvinceEffects } from '../game/province-store';
import { FACTION_COLORS, RESOURCE_INFO, FACTION_PRIMARY_RESOURCE } from '../game/commander';
import type { ResourceType } from '../game/commander';
import { spendResource } from '../game/resources';
import { NodeModal } from './NodeModal';
import type { GameEvent, EventChoice } from '../game/event-types';
import { pickEvent, buildEventContext, applyEventChoice, canAffordEventChoice } from '../game/event-engine';
import { getExtraEventChoices } from '../game/doctrine-store';
import { manipulateUsesLeft, consumeManipulateUse } from '../game/strategic-store';
import { councilSlots, grantAdvisorXp, tierUpNotices } from '../game/council-store';

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

    .node-circle { transition: all 0.25s ease; }
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
      background: rgba(16, 14, 28, 0.95);
      border: 1px solid rgba(180, 160, 100, 0.3);
      border-radius: 4px;
      padding: 6px 12px;
      white-space: nowrap;
      font-size: 11px;
      letter-spacing: 0.5px;
      pointer-events: none;
      z-index: 50;
      animation: tooltip-in 0.15s ease-out;
    }
    .node-tooltip::after {
      content: '';
      position: absolute;
      top: 100%;
      left: 50%;
      transform: translateX(-50%);
      border: 5px solid transparent;
      border-top-color: rgba(180, 160, 100, 0.3);
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
    .manipulate-reroll-btn { transition: all 0.15s ease; cursor: pointer; }
    .manipulate-reroll-btn:hover {
      border-color: rgba(74, 124, 194, 0.7) !important;
      color: #80b0e8 !important;
      background: rgba(30, 60, 120, 0.55) !important;
    }
    .manipulate-reroll-btn:active { transform: scale(0.97); }

    /* Retreat button hover */
    .retreat-btn { transition: all 0.2s ease; }
    .retreat-btn:hover {
      border-color: rgba(200, 80, 80, 0.4) !important;
      color: rgba(220, 180, 140, 0.7) !important;
      background: rgba(60, 36, 40, 0.9) !important;
    }
    .retreat-btn:active { transform: scale(0.97); }

    /* Event choice hover */
    .event-choice-btn { transition: all 0.2s ease; }
    .event-choice-btn:not(:disabled):hover {
      border-color: rgba(220, 190, 100, 0.5) !important;
      background: rgba(70, 70, 95, 0.7) !important;
    }
    .event-choice-btn:not(:disabled):active { transform: scale(0.98); }

    /* Modal action buttons */
    .modal-action-btn { transition: all 0.2s ease; }
    .modal-action-btn:hover {
      filter: brightness(1.2);
      box-shadow: 0 0 12px rgba(180, 160, 100, 0.15);
    }
    .modal-action-btn:active { transform: scale(0.97); }

    /* Retreat confirm buttons */
    .retreat-confirm-btn { transition: all 0.2s ease; }
    .retreat-confirm-btn:hover {
      border-color: rgba(220, 100, 100, 0.7) !important;
      background: rgba(200, 60, 60, 0.4) !important;
    }
    .retreat-confirm-btn:active { transform: scale(0.97); }

    .retreat-cancel-btn { transition: all 0.2s ease; }
    .retreat-cancel-btn:hover {
      border-color: rgba(220, 190, 100, 0.4) !important;
      color: #e0d8b8 !important;
    }
    .retreat-cancel-btn:active { transform: scale(0.97); }

    /* Thin scrollbar for node chain */
    .node-chain-scroll::-webkit-scrollbar { height: 4px; }
    .node-chain-scroll::-webkit-scrollbar-track { background: rgba(20, 18, 36, 0.5); border-radius: 2px; }
    .node-chain-scroll::-webkit-scrollbar-thumb { background: rgba(180, 160, 100, 0.2); border-radius: 2px; }
    .node-chain-scroll::-webkit-scrollbar-thumb:hover { background: rgba(180, 160, 100, 0.35); }

    /* Empty state link */
    .empty-state-btn { transition: all 0.2s ease; }
    .empty-state-btn:hover {
      border-color: rgba(220, 190, 100, 0.5) !important;
      color: #f0d080 !important;
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

const NODE_SIZE_REGULAR = 68;
const NODE_SIZE_BOSS = 82;

// ── Modal state ──
const showRetreatConfirm = signal(false);
const showRestModal = signal(false);
const restGains = signal<{ type: ResourceType; actual: number; isPrimary: boolean }[]>([]);
const showEventModal = signal(false);
const activeEvent = signal<GameEvent | null>(null);
const showSpokeCompleteModal = signal(false);
const showSeasonModal = signal(false);
const lastSeasonTick = signal<SeasonTickResult | null>(null);

/** Index of the node that just resolved (for gold flash animation). */
const justResolvedIndex = signal<number | null>(null);

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
            fontSize: '16px',
            lineHeight: '1',
            color: '#d4a843',
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
        fontSize: '9px',
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
          color: node.resolved ? '#d4a843' : isCurrent ? typeStyle.color : 'rgba(200, 190, 160, 0.7)',
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
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        animation: 'node-modal-fade 0.2s ease-out',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div style={{
        background: 'linear-gradient(135deg, rgba(30, 28, 48, 0.98), rgba(20, 18, 36, 0.99))',
        border: '1px solid rgba(180, 160, 100, 0.25)',
        borderRadius: '8px', padding: '28px 32px',
        maxWidth: '360px', width: '90%', textAlign: 'center',
      }}>
        <div style={{
          fontSize: '16px', fontWeight: 600, color: '#f0d080',
          letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px',
        }}>
          Retreat?
        </div>
        <div style={{
          fontSize: '13px', color: 'rgba(200, 190, 160, 0.6)',
          lineHeight: '1.5', marginBottom: '20px',
        }}>
          You'll keep your army and resources, but forfeit all remaining spoke rewards.
        </div>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <button class="retreat-confirm-btn" onClick={onConfirm} style={{
            padding: '10px 20px', borderRadius: '4px', cursor: 'pointer',
            background: 'rgba(180, 60, 60, 0.3)', border: '1px solid rgba(200, 80, 80, 0.5)',
            color: '#e0a0a0', fontFamily: 'inherit', fontSize: '13px', fontWeight: 600, letterSpacing: '1px',
          }}>
            Confirm Retreat
          </button>
          <button class="retreat-cancel-btn" onClick={onCancel} style={{
            padding: '10px 20px', borderRadius: '4px', cursor: 'pointer',
            background: 'rgba(60, 60, 80, 0.6)', border: '1px solid rgba(180, 160, 100, 0.25)',
            color: '#d0c8a8', fontFamily: 'inherit', fontSize: '13px', letterSpacing: '1px',
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
        height: '100vh', fontFamily: "'Segoe UI', system-ui, sans-serif",
        background: '#d8d0c8 url(/asset/marbel_background.png) center / contain no-repeat',
        gap: '16px',
      }}>
        <div style={{ color: 'rgba(200, 190, 160, 0.5)', fontSize: '14px', letterSpacing: '1px' }}>
          No active spoke
        </div>
        <button class="empty-state-btn" onClick={() => navigateTo('hub')} style={{
          padding: '10px 24px', borderRadius: '4px', cursor: 'pointer',
          background: 'rgba(60, 60, 80, 0.6)', border: '1px solid rgba(180, 160, 100, 0.25)',
          color: '#d0c8a8', fontFamily: 'inherit', fontSize: '13px', fontWeight: 600, letterSpacing: '1px',
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
      navigateTo('battle');
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
    showRestModal.value = true;
  }

  function handleRestContinue() {
    showRestModal.value = false;
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

  function canAffordChoice(choice: EventChoice): boolean {
    return canAffordEventChoice(choice);
  }

  // Show the spoke complete modal when all nodes are resolved
  if (spokeComplete && !showSpokeCompleteModal.value) {
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

    // Create a province from the completed spoke
    if (spoke) {
      conquerProvince(spoke.label, spokeGains.value, spoke.duration);
    }

    showSpokeCompleteModal.value = false;
    completedSpokes.value += 1;
    completeSpoke();
    navigateTo('hub');
  }

  // Current node for dynamic hint
  const currentNode = spoke.nodes[nodeIdx] ?? null;
  const resolvedCount = spoke.nodes.filter(n => n.resolved).length;
  const progressPct = Math.round((resolvedCount / spoke.nodes.length) * 100);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100vh', fontFamily: "'Segoe UI', system-ui, sans-serif",
      background: '#d8d0c8 url(/asset/marbel_background.png) center / contain no-repeat',
      paddingTop: '38px',
    }}>
      {/* Dark content panel */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        background: 'rgba(12, 10, 24, 0.82)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderRadius: '12px',
        border: '1px solid rgba(180, 160, 100, 0.15)',
        padding: '28px 24px 24px',
        maxWidth: '90%',
        width: '860px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
      }}>
        {/* Spoke label + posture badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
          <div style={{
            fontSize: '18px', fontWeight: 600, color,
            letterSpacing: '4px', textTransform: 'uppercase',
            textShadow: `0 2px 12px ${color}50, 0 0 24px ${color}20`,
          }}>
            {spoke.label}
          </div>
          <div style={{
            fontSize: '10px', fontWeight: 700, letterSpacing: '0.8px',
            color: spoke.posture === 'attacking' ? '#e07050' : '#60a8d0',
            opacity: 0.85,
          }}>
            {spoke.posture === 'attacking' ? '⚔ Attacking' : '🛡 Defending'}
          </div>
        </div>

        {/* Decorative underline */}
        <div style={{
          width: '80px', height: '2px', marginBottom: '8px',
          background: `linear-gradient(90deg, transparent, ${color}60, transparent)`,
          borderRadius: '1px',
        }} />

        {/* Progress text */}
        <div style={{
          fontSize: '11px', color: 'rgba(180, 170, 150, 0.5)',
          letterSpacing: '1px', marginBottom: '12px',
        }}>
          Node <span style={{ color: `${color}90`, fontWeight: 600 }}>{Math.min(nodeIdx + 1, spoke.nodes.length)}</span> of {spoke.nodes.length}
          {spoke.duration > 1 && (
            <span style={{ marginLeft: '12px', color: 'rgba(200, 160, 100, 0.5)' }}>
              Season {spoke.currentSeason}/{spoke.duration}
            </span>
          )}
        </div>

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
            marginTop: '8px', fontSize: '13px',
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
      </div>

      {/* Retreat button */}
      <button class="retreat-btn" onClick={() => { showRetreatConfirm.value = true; }} style={{
        position: 'fixed', bottom: '20px', left: '20px',
        padding: '10px 18px', borderRadius: '4px', cursor: 'pointer',
        background: 'rgba(40, 36, 60, 0.9)',
        border: '1px solid rgba(180, 160, 100, 0.2)',
        color: 'rgba(200, 180, 140, 0.5)',
        fontFamily: 'inherit', fontSize: '12px', letterSpacing: '1px',
      }}>
        Retreat
      </button>

      {/* Rest modal */}
      {showRestModal.value && (
        <NodeModal title="Your Army Rests" onClose={handleRestContinue}>
          <div style={{ fontSize: '13px', color: 'rgba(200, 190, 160, 0.6)', lineHeight: '1.5', marginBottom: '16px' }}>
            Your forces recover their strength.
          </div>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '20px' }}>
            {restGains.value.map((g) => (
              <div key={g.type} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: RESOURCE_INFO[g.type].color }}>
                  {RESOURCE_INFO[g.type].icon} +{g.actual} {RESOURCE_INFO[g.type].label}
                </span>
                {g.isPrimary && (
                  <span style={{ fontSize: '9px', color: 'rgba(180, 160, 100, 0.5)', letterSpacing: '0.5px' }}>
                    (primary)
                  </span>
                )}
              </div>
            ))}
          </div>
          <button class="modal-action-btn" onClick={handleRestContinue} style={{
            padding: '10px 24px', borderRadius: '4px', cursor: 'pointer',
            background: `linear-gradient(135deg, ${color}30, ${color}15)`,
            border: `1px solid ${color}60`,
            color, fontFamily: 'inherit', fontSize: '13px', fontWeight: 600, letterSpacing: '1px',
          }}>
            Continue
          </button>
        </NodeModal>
      )}

      {/* Event modal */}
      {showEventModal.value && activeEvent.value && (
        <NodeModal title={activeEvent.value.title} onClose={() => { /* no-op: force a choice */ }}>
          <div style={{ fontSize: '13px', color: 'rgba(200, 190, 160, 0.6)', lineHeight: '1.5', marginBottom: '20px' }}>
            {activeEvent.value.description}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {activeEvent.value.choices.map((choice, i) => {
              const affordable = canAffordChoice(choice);
              return (
                <button class="event-choice-btn" key={i}
                  onClick={() => affordable && handleEventChoice(choice)}
                  disabled={!affordable}
                  style={{
                    padding: '10px 16px', borderRadius: '4px',
                    cursor: affordable ? 'pointer' : 'default',
                    background: affordable ? 'rgba(60, 60, 80, 0.6)' : 'rgba(30, 30, 40, 0.4)',
                    border: `1px solid ${affordable ? 'rgba(180, 160, 100, 0.3)' : 'rgba(80, 80, 80, 0.2)'}`,
                    color: affordable ? '#d0c8a8' : 'rgba(120, 110, 100, 0.4)',
                    fontFamily: 'inherit', fontSize: '13px', textAlign: 'left',
                    opacity: affordable ? 1 : 0.5,
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: choice.effects.length ? '4px' : '0' }}>
                    {choice.text}
                  </div>
                  {choice.effects.length > 0 && (
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', fontSize: '11px' }}>
                      {choice.effects.map((e, j) => (
                        <span key={j} style={{
                          color: e.amount > 0 ? RESOURCE_INFO[e.resource].color : '#c66', fontWeight: 600,
                        }}>
                          {RESOURCE_INFO[e.resource].icon} {e.amount > 0 ? '+' : ''}{e.amount} {RESOURCE_INFO[e.resource].label}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
            {/* S7-12: Manipulate — Augustus event reroll */}
            {manipulateUsesLeft.value > 0 && (
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
                  marginTop: '8px', padding: '8px 14px', borderRadius: '4px',
                  background: 'rgba(30, 50, 100, 0.4)',
                  border: '1px solid rgba(74, 124, 194, 0.4)',
                  color: '#4a7cc2', fontFamily: 'inherit', fontSize: '11px',
                  fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase',
                  width: '100%', textAlign: 'center',
                }}
              >
                Manipulate — Reroll Event ({manipulateUsesLeft.value} left)
              </button>
            )}
          </div>
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
                  marginBottom: '16px', fontSize: '12px', color: 'rgba(180, 170, 150, 0.5)',
                }}>
                  <span>{spoke.nodes.length} nodes resolved</span>
                  <span>{battlesWon} battles won</span>
                </div>
                <div style={{
                  fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase',
                  color: 'rgba(180, 170, 150, 0.35)', marginBottom: '8px',
                }}>
                  Total Gains
                </div>
                <div style={{
                  display: 'flex', gap: '12px', justifyContent: 'center',
                  flexWrap: 'wrap', marginBottom: '20px',
                }}>
                  {allTypes.filter(t => gains[t] > 0).map(t => (
                    <span key={t} style={{ fontSize: '13px', fontWeight: 600, color: RESOURCE_INFO[t].color }}>
                      {RESOURCE_INFO[t].icon} +{gains[t]} {RESOURCE_INFO[t].label}
                    </span>
                  ))}
                </div>
                <button class="modal-action-btn" onClick={handleReturnToHub} style={{
                  padding: '10px 24px', borderRadius: '4px', cursor: 'pointer',
                  background: `linear-gradient(135deg, ${color}30, ${color}15)`,
                  border: `1px solid ${color}60`,
                  color, fontFamily: 'inherit', fontSize: '13px', fontWeight: 600, letterSpacing: '1px',
                }}>
                  Return to Hub
                </button>
              </>
            );
          })()}
        </NodeModal>
      )}

      {/* Season tick modal */}
      {showSeasonModal.value && lastSeasonTick.value && (
        <NodeModal title={`Season ${lastSeasonTick.value.season} Begins`} onClose={() => { showSeasonModal.value = false; }}>
          <div style={{ fontSize: '12px', color: 'rgba(200, 190, 160, 0.7)', lineHeight: '1.6', display: 'flex', flexDirection: 'column', gap: '6px', textAlign: 'left' }}>
            {/* Upkeep paid */}
            {lastSeasonTick.value.upkeepPaid.length > 0 && (
              <div style={{
                padding: '8px 10px', borderRadius: '6px',
                background: 'rgba(60, 50, 20, 0.2)',
                border: '1px solid rgba(240, 208, 128, 0.1)',
              }}>
                <div style={{ color: 'rgba(240, 208, 128, 0.6)', letterSpacing: '1.5px', fontSize: '9px', textTransform: 'uppercase', fontWeight: 700, marginBottom: '4px' }}>Upkeep Paid</div>
                {lastSeasonTick.value.upkeepPaid.map((u, i) => (
                  <div key={i} style={{ color: 'rgba(200, 130, 130, 0.8)', fontSize: '11px' }}>
                    {RESOURCE_INFO[u.resource].icon} -{u.amount} {RESOURCE_INFO[u.resource].label}
                  </div>
                ))}
              </div>
            )}
            {/* Upkeep shortfall */}
            {lastSeasonTick.value.upkeepShortfall.length > 0 && (
              <div style={{
                padding: '8px 10px', borderRadius: '6px',
                background: 'rgba(120, 40, 30, 0.15)',
                border: '1px solid rgba(200, 80, 60, 0.2)',
              }}>
                <div style={{ color: '#c05050', letterSpacing: '1.5px', fontSize: '9px', textTransform: 'uppercase', fontWeight: 700, marginBottom: '4px' }}>Shortfall</div>
                {lastSeasonTick.value.upkeepShortfall.map((u, i) => (
                  <div key={i} style={{ color: '#c05050', fontSize: '11px' }}>
                    {RESOURCE_INFO[u.resource].icon} Cannot afford {u.deficit} {RESOURCE_INFO[u.resource].label}
                  </div>
                ))}
              </div>
            )}
            {/* Province income */}
            {lastSeasonTick.value.provinceIncome && lastSeasonTick.value.provinceIncome.incomeGained.length > 0 && (
              <div style={{
                padding: '8px 10px', borderRadius: '6px',
                background: 'rgba(30, 60, 30, 0.15)',
                border: '1px solid rgba(90, 160, 90, 0.12)',
              }}>
                <div style={{ color: 'rgba(90, 160, 90, 0.7)', letterSpacing: '1.5px', fontSize: '9px', textTransform: 'uppercase', fontWeight: 700, marginBottom: '4px' }}>Province Income</div>
                {lastSeasonTick.value.provinceIncome.incomeGained.map((u, i) => (
                  <div key={i} style={{ color: 'rgba(130, 200, 130, 0.8)', fontSize: '11px' }}>
                    {RESOURCE_INFO[u.resource].icon} +{u.amount} {RESOURCE_INFO[u.resource].label}
                  </div>
                ))}
              </div>
            )}
            {/* Province expenses */}
            {lastSeasonTick.value.provinceIncome && lastSeasonTick.value.provinceIncome.expensesPaid > 0 && (
              <div style={{
                padding: '8px 10px', borderRadius: '6px',
                background: 'rgba(60, 50, 20, 0.15)',
                border: '1px solid rgba(200, 160, 100, 0.1)',
              }}>
                <div style={{ color: 'rgba(200, 160, 100, 0.6)', letterSpacing: '1.5px', fontSize: '9px', textTransform: 'uppercase', fontWeight: 700, marginBottom: '4px' }}>Province Expenses</div>
                <div style={{ color: 'rgba(200, 160, 100, 0.7)', fontSize: '11px' }}>
                  {RESOURCE_INFO.gold.icon} -{lastSeasonTick.value.provinceIncome.expensesPaid} Gold
                </div>
              </div>
            )}
            {/* Province expense shortfall */}
            {lastSeasonTick.value.provinceIncome && lastSeasonTick.value.provinceIncome.expenseShortfall > 0 && (
              <div style={{
                padding: '8px 10px', borderRadius: '6px',
                background: 'rgba(120, 40, 30, 0.15)',
                border: '1px solid rgba(200, 80, 60, 0.2)',
              }}>
                <div style={{ color: '#c05050', letterSpacing: '1.5px', fontSize: '9px', textTransform: 'uppercase', fontWeight: 700, marginBottom: '4px' }}>Province Expense Shortfall</div>
                <div style={{ color: '#c05050', fontSize: '11px' }}>
                  {RESOURCE_INFO.gold.icon} Cannot afford {lastSeasonTick.value.provinceIncome.expenseShortfall} Gold upkeep
                </div>
              </div>
            )}
            {/* Rebellion */}
            {lastSeasonTick.value.provinceIncome && lastSeasonTick.value.provinceIncome.rebellions.length > 0 && (
              <div style={{
                padding: '8px 10px', borderRadius: '6px',
                background: 'rgba(140, 30, 20, 0.2)',
                border: '1px solid rgba(200, 60, 50, 0.3)',
              }}>
                <div style={{ color: '#e04040', letterSpacing: '1.5px', fontSize: '9px', textTransform: 'uppercase', fontWeight: 700, marginBottom: '4px' }}>Rebellion!</div>
                {lastSeasonTick.value.provinceIncome.rebellions.map((r, i) => (
                  <div key={i} style={{ color: '#e06050', fontSize: '11px', fontWeight: 600 }}>
                    {r.provinceName}: {r.lostInvestment ? `${r.lostInvestment} destroyed` : 'unrest critical'}
                  </div>
                ))}
              </div>
            )}
            {/* Threat */}
            <div style={{
              padding: '6px 10px', borderRadius: '6px',
              background: 'rgba(60, 50, 20, 0.15)',
              border: '1px solid rgba(200, 160, 100, 0.1)',
              textAlign: 'center',
            }}>
              <span style={{ color: 'rgba(200, 160, 100, 0.7)', fontSize: '11px', fontWeight: 600 }}>
                Threat +{lastSeasonTick.value.threatIncrease} &middot; Season {lastSeasonTick.value.globalSeason}/{24}
              </span>
              {lastSeasonTick.value.doomUpkeep > 0 && (
                <div style={{ fontSize: '9px', color: 'rgba(200, 130, 130, 0.7)', marginTop: '2px' }}>
                  Doom drain: -{lastSeasonTick.value.doomUpkeep}g
                </div>
              )}
            </div>
            {lastSeasonTick.value.doomMilestone && (
              <div style={{
                padding: '8px 12px', borderRadius: '6px',
                background: 'rgba(140, 30, 20, 0.25)',
                border: '1px solid rgba(200, 60, 50, 0.3)',
                textAlign: 'center',
              }}>
                <span style={{ color: '#e06050', fontSize: '11px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>
                  {lastSeasonTick.value.doomMilestone}
                </span>
              </div>
            )}
          </div>
          <button class="modal-action-btn" onClick={() => { showSeasonModal.value = false; }} style={{
            marginTop: '14px', padding: '10px 24px', borderRadius: '4px', cursor: 'pointer',
            background: 'linear-gradient(135deg, rgba(80, 60, 20, 0.7), rgba(50, 40, 18, 0.9))',
            border: '1px solid rgba(220, 190, 100, 0.4)',
            color: '#f0d080', fontFamily: 'inherit', fontSize: '12px', fontWeight: 600,
            letterSpacing: '1.5px', textTransform: 'uppercase',
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
    </div>
  );
}
