/**
 * SpokeCampaignScreen — S29 layout shell for the new Itinerarium UI.
 *
 * Sits behind the legacy `node-map` route during migration. NodeMapScreen
 * remains the production renderer; this screen is the target layout that
 * S29-04..09 will populate (illustrated map, route SVG, legend/intel,
 * legion campaign panel). For now it wires the pieces that already exist
 * (top bar, landmark details, retreat, army HUD) and drops placeholders
 * into the zones that future tasks will fill.
 *
 * No game logic lives here — the screen reads `currentSpoke` /
 * `currentNodeIndex` signals and dispatches the existing store handlers
 * (`resetSpoke`, `threatLevel`, `navigateTo`).
 */

import { useState } from 'preact/hooks';
import { navigateTo } from '../screens';
import {
  currentSpoke,
  currentNodeIndex,
  resetSpoke,
  advanceNode,
  applyNodeEffectsNow,
  legacyEncounterFromNodeType,
} from '../../game/progression/spoke';
import type { SpokeNode } from '../../game/progression/spoke';
import type { EncounterType } from '../../game/progression/landmark-types';
import { threatLevel, selectedCommander } from '../../game/core/game-state';
import { FACTION_COLORS } from '../../game/core/commander';
import { computeArmyMorale } from '../../game/army/morale';
import { SpokeCampaignTopBar } from '../components/spoke/SpokeCampaignTopBar';
import { LandmarkDetailsPanel } from '../components/spoke/LandmarkDetailsPanel';
import { LandmarkMap } from '../components/spoke/LandmarkMap';
import { LandmarkMapNode } from '../components/spoke/LandmarkMapNode';
import { LandmarkRoute } from '../components/spoke/LandmarkRoute';
import { ArmyDetailHUD } from '../components/ArmyDetailHUD';

if (typeof document !== 'undefined' && !document.getElementById('spoke-campaign-styles')) {
  const el = document.createElement('style');
  el.id = 'spoke-campaign-styles';
  el.textContent = `
    .spoke-campaign-grid {
      display: grid;
      grid-template-columns: minmax(280px, 320px) 1fr minmax(260px, 300px);
      grid-template-rows: auto 1fr auto;
      grid-template-areas:
        "topbar    topbar     topbar"
        "details   map        legend"
        "army      army       army";
      gap: 16px;
      width: min(1600px, 96vw);
      height: calc(100vh - 32px);
      margin: 16px auto;
      box-sizing: border-box;
    }
    .spoke-campaign-zone {
      background: rgba(14, 12, 28, 0.72);
      border: 1px solid rgba(180, 160, 100, 0.22);
      border-radius: var(--radius-md);
      padding: 12px 16px;
      box-sizing: border-box;
      overflow: auto;
      position: relative;
    }
    .spoke-campaign-zone--topbar    { grid-area: topbar; padding: 8px 12px; }
    .spoke-campaign-zone--details   { grid-area: details; }
    .spoke-campaign-zone--map       { grid-area: map; min-height: 320px; }
    .spoke-campaign-zone--map-flush { padding: 0; overflow: hidden; }
    .spoke-campaign-zone--legend    { grid-area: legend; }
    .spoke-campaign-zone--army      { grid-area: army; min-height: 96px; }

    .spoke-campaign-placeholder {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      gap: 6px;
      color: var(--color-text-muted);
      font-family: var(--font-display);
      letter-spacing: 1.5px;
      text-transform: uppercase;
      text-align: center;
    }
    .spoke-campaign-placeholder-eyebrow {
      font-size: var(--font-size-xs);
      color: var(--color-gold-dim);
      letter-spacing: 2px;
    }
    .spoke-campaign-placeholder-title {
      font-size: var(--font-size-md);
      color: var(--color-text-secondary);
    }
    .spoke-campaign-placeholder-hint {
      font-size: var(--font-size-xs);
      color: var(--color-text-muted);
      letter-spacing: 1px;
      text-transform: none;
    }

    .spoke-campaign-actions {
      position: absolute;
      top: 14px;
      right: 18px;
      display: flex;
      gap: 8px;
      z-index: 5;
    }
    .spoke-campaign-action-btn {
      padding: 6px 14px;
      background: rgba(14, 12, 28, 0.85);
      border: 1px solid rgba(180, 160, 100, 0.4);
      border-radius: var(--radius-sm);
      color: var(--color-gold-dim);
      font-family: var(--font-family);
      font-size: var(--font-size-xs);
      letter-spacing: 1.5px;
      text-transform: uppercase;
      cursor: pointer;
      transition: all var(--duration-fast) var(--ease-default);
    }
    .spoke-campaign-action-btn:hover {
      color: var(--color-gold-primary);
      border-color: rgba(212, 168, 67, 0.7);
    }
    .spoke-campaign-action-btn--danger:hover {
      color: var(--color-danger, #d96a6a);
      border-color: rgba(217, 106, 106, 0.7);
    }

    @media (max-width: 1100px) {
      .spoke-campaign-grid {
        grid-template-columns: 1fr;
        grid-template-areas:
          "topbar"
          "map"
          "details"
          "legend"
          "army";
        height: auto;
      }
    }
  `;
  document.head.appendChild(el);
}

export function SpokeCampaignScreen() {
  const spoke = currentSpoke.value;
  const nodeIdx = currentNodeIndex.value;
  const commander = selectedCommander.value;
  const accent = commander ? FACTION_COLORS[commander.faction] : '#f0d080';
  const [showArmyHUD, setShowArmyHUD] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

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
        <button
          class="spoke-campaign-action-btn"
          onClick={() => navigateTo('hub')}
          style={{ padding: '10px 24px' }}
        >
          Return to Hub
        </button>
      </div>
    );
  }

  function handleRetreat() {
    threatLevel.value += 1;
    resetSpoke();
    navigateTo('hub');
  }

  const currentNode = spoke.nodes[nodeIdx] ?? null;
  const morale = spoke.boundArmy ? computeArmyMorale(spoke) : null;

  // Selected node — falls back to current main-chain node when nothing is
  // explicitly selected so the details panel always has something to show.
  const selectedNode = selectedNodeId
    ? spoke.nodes.find((n) => n.id === selectedNodeId) ?? currentNode
    : currentNode;
  const selectedIsCurrent =
    !!selectedNode && !!currentNode && selectedNode.id === currentNode.id && !selectedNode.resolved;

  function dispatchEncounter(node: SpokeNode) {
    const enc: EncounterType = node.encounterType ?? legacyEncounterFromNodeType(node.type);
    switch (enc) {
      case 'battle':
      case 'elite_battle':
      case 'boss':
      case 'siege':
        navigateTo('battleV2');
        return;
      case 'ambush':
        // Apply the ambush penalties before the engagement so the hit
        // (morale loss / iuniores damage) biases the battle, matching
        // the legacy NodeMapScreen contract. advanceNode on return
        // skips re-applying because applyNodeEffectsNow records the id.
        applyNodeEffectsNow(node);
        navigateTo('battleV2');
        return;
      // Non-combat encounters: progress through using the existing
      // resolve pipeline. NodeMapScreen wraps this in rich modals
      // (rest preview, event picker, outcome flash); the campaign
      // screen MVP keeps the single primary action and lets the
      // store handle effect application + resolution + season tick.
      default:
        advanceNode();
        return;
    }
  }

  function handleAction() {
    if (!selectedNode || !selectedIsCurrent) return;
    dispatchEncounter(selectedNode);
  }

  const actionLabel = selectedNode ? actionLabelFor(selectedNode) : 'Resolve';
  const disabledReason = !selectedNode
    ? undefined
    : selectedNode.resolved
      ? 'Already resolved'
      : !selectedIsCurrent
        ? 'Select your current landmark to act'
        : undefined;

  return (
    <div style={{ background: 'var(--color-bg-primary)', minHeight: '100vh' }}>
      <div class="spoke-campaign-grid">
        <div class="spoke-campaign-zone spoke-campaign-zone--topbar">
          <SpokeCampaignTopBar />
          <div class="spoke-campaign-actions">
            <button
              class="spoke-campaign-action-btn"
              onClick={() => setShowArmyHUD(true)}
              disabled={!spoke.boundArmy}
              title={spoke.boundArmy ? 'View army roster' : 'No army bound'}
            >
              Army
            </button>
            <button
              class="spoke-campaign-action-btn spoke-campaign-action-btn--danger"
              onClick={handleRetreat}
            >
              Retreat
            </button>
          </div>
        </div>

        <aside class="spoke-campaign-zone spoke-campaign-zone--details">
          <LandmarkDetailsPanel
            node={selectedNode}
            isCurrent={selectedIsCurrent}
            accentColor={accent}
            actionLabel={actionLabel}
            actionDisabledReason={disabledReason}
            onAction={handleAction}
          />
        </aside>

        <section class="spoke-campaign-zone spoke-campaign-zone--map spoke-campaign-zone--map-flush">
          <LandmarkMap
            nodes={spoke.nodes}
            renderRoute={(segment) => (
              <LandmarkRoute
                key={`route-${segment.toIndex}`}
                segment={segment}
                currentNodeIdx={nodeIdx}
                accent={accent}
              />
            )}
            renderNode={(node, _coord, i) => {
              const isCurrent = i === nodeIdx;
              // Reachable = resolved tail (showable) OR the current step's
              // immediate next neighbor. Selection-only here — encounter
              // resolution lives behind the details-panel action (S29-07).
              const isReachable = node.resolved || isCurrent || i === nodeIdx + 1;
              return (
                <LandmarkMapNode
                  node={node}
                  isCurrent={isCurrent}
                  isReachable={isReachable}
                  isSelected={selectedNodeId === node.id}
                  accent={accent}
                  onSelect={(n) => setSelectedNodeId(n.id)}
                />
              );
            }}
          />
        </section>

        <aside class="spoke-campaign-zone spoke-campaign-zone--legend">
          <div class="spoke-campaign-placeholder">
            <span class="spoke-campaign-placeholder-eyebrow">Legend &amp; Intel</span>
            <span class="spoke-campaign-placeholder-title">Coming in S29-08</span>
          </div>
        </aside>

        <section class="spoke-campaign-zone spoke-campaign-zone--army">
          <div class="spoke-campaign-placeholder">
            <span class="spoke-campaign-placeholder-eyebrow">Legion</span>
            <span class="spoke-campaign-placeholder-title">
              {spoke.boundArmy ? `${spoke.boundArmy.cohorts.length} cohorts bound` : 'No army bound'}
            </span>
            <span class="spoke-campaign-placeholder-hint">Legion campaign panel · S29-09</span>
          </div>
        </section>
      </div>

      {showArmyHUD && spoke.boundArmy && (
        <ArmyDetailHUD
          army={spoke.boundArmy}
          legate={spoke.boundLegate ?? null}
          morale={morale}
          onClose={() => setShowArmyHUD(false)}
        />
      )}
    </div>
  );
}

// Encounter-keyed action verbs for the details panel button. Hidden nodes
// (`scoutedLevel === 0`) collapse to "Advance Blind" so the player still
// has a single primary action they can commit to without scouting first.
function actionLabelFor(node: SpokeNode): string {
  const intel = node.scoutedLevel ?? (node.revealed === false ? 0 : 2);
  if (intel === 0) return 'Advance Blind';
  const enc: EncounterType = node.encounterType ?? legacyEncounterFromNodeType(node.type);
  switch (enc) {
    case 'battle':
    case 'elite_battle':
    case 'siege':
      return 'Prepare Battle';
    case 'boss':       return 'Engage Boss';
    case 'ambush':     return 'Spring the Ambush';
    case 'rest':       return 'Make Camp';
    case 'forage':     return 'Forage';
    case 'recruit':    return 'Recruit Locals';
    case 'scout':      return 'Send Scouts';
    case 'hazard':     return 'Press Through';
    case 'event':      return 'Resolve';
    case 'merchant':   return 'Approach';
    case 'unknown':    return 'Advance Blind';
    default:           return 'Resolve';
  }
}
