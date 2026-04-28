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

import { useState, useEffect } from 'preact/hooks';
import { navigateTo } from '../screens';
import {
  currentSpoke,
  currentNodeIndex,
  resetSpoke,
  advanceNode,
  completeSpoke,
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
import { SpokeLegendPanel } from '../components/spoke/SpokeLegendPanel';
import { ArmyCampaignPanel } from '../components/spoke/ArmyCampaignPanel';
import { ArmyDetailHUD } from '../components/ArmyDetailHUD';

if (typeof document !== 'undefined' && !document.getElementById('spoke-campaign-styles')) {
  const el = document.createElement('style');
  el.id = 'spoke-campaign-styles';
  el.textContent = `
    @keyframes spoke-campaign-fade-in {
      from { opacity: 0; transform: translateY(6px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes spoke-campaign-detail-swap {
      from { opacity: 0.3; transform: translateX(-4px); }
      to   { opacity: 1; transform: translateX(0); }
    }

    .spoke-campaign-grid {
      display: grid;
      grid-template-columns: minmax(260px, 300px) 1fr minmax(240px, 280px);
      grid-template-rows: auto 1fr auto;
      grid-template-areas:
        "topbar    topbar     topbar"
        "details   map        legend"
        "army      army       army";
      gap: 14px;
      width: min(1600px, 96vw);
      height: calc(100vh - 32px);
      margin: 16px auto;
      box-sizing: border-box;
      animation: spoke-campaign-fade-in var(--duration-normal, 300ms) var(--ease-default, ease) both;
    }
    @media (prefers-reduced-motion: reduce) {
      .spoke-campaign-grid { animation: none; }
    }
    /* Mid-size desktop: give the map slightly more breathing room. */
    @media (min-width: 1280px) {
      .spoke-campaign-grid {
        grid-template-columns: minmax(280px, 320px) 1fr minmax(260px, 300px);
        gap: 16px;
      }
    }
    .spoke-campaign-zone--details > * {
      animation: spoke-campaign-detail-swap var(--duration-fast, 150ms) var(--ease-default, ease) both;
    }
    @media (prefers-reduced-motion: reduce) {
      .spoke-campaign-zone--details > * { animation: none; }
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

  // T1.1: Detect spoke completion (all nodes resolved) and call completeSpoke()
  // so the store can do housekeeping (XP, resource grants, navigation triggers).
  // Mirrors NodeMapScreen's spokeComplete → handleReturnToHub pathway, simplified
  // for the campaign screen MVP (no city-choice modal yet — navigates directly).
  const spokeComplete = spoke ? nodeIdx >= spoke.nodes.length : false;
  useEffect(() => {
    if (spokeComplete && spoke) {
      completeSpoke();
      navigateTo('hub');
    }
  }, [spokeComplete, spoke]);

  // T1.2: Clear per-spoke UI state when the spoke tears down so stale node
  // selections / open HUDs from the previous spoke never bleed into the next.
  useEffect(() => {
    if (!spoke) {
      setSelectedNodeId(null);
      setShowArmyHUD(false);
    }
  }, [spoke]);

  // Define handleRetreat before the keyboard useEffect so the closure captures it.
  function handleRetreat() {
    threatLevel.value += 1;
    resetSpoke();
    navigateTo('hub');
  }

  // T1.3: Keyboard bindings — ESC closes army HUD or retreats; 'a' toggles HUD.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        if (showArmyHUD) {
          setShowArmyHUD(false);
        } else {
          handleRetreat();
        }
      } else if (e.key === 'a' && spoke?.boundArmy) {
        setShowArmyHUD((prev) => !prev);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showArmyHUD, spoke]);

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
        </div>

        <aside class="spoke-campaign-zone spoke-campaign-zone--details">
          <LandmarkDetailsPanel
            key={selectedNode?.id ?? 'empty'}
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
          <SpokeLegendPanel />
        </aside>

        <section class="spoke-campaign-zone spoke-campaign-zone--army">
          <ArmyCampaignPanel
            spoke={spoke}
            morale={morale}
            legateName={spoke.boundLegate?.name ?? null}
            onOpenDetails={() => setShowArmyHUD(true)}
            onRetreat={handleRetreat}
          />
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
