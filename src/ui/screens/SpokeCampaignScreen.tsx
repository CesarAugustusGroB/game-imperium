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
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    @keyframes spoke-campaign-detail-swap {
      from { opacity: 0.3; transform: translateX(-4px); }
      to   { opacity: 1; transform: translateX(0); }
    }

    /* ── Root: full-bleed painted-map stage ──────────────────────────── */
    .spoke-campaign-stage {
      position: fixed;
      inset: 0;
      overflow: hidden;
      background-color: #0d0a14;
      isolation: isolate;
      animation: spoke-campaign-fade-in 400ms var(--ease-default, ease) both;
    }
    @media (prefers-reduced-motion: reduce) {
      .spoke-campaign-stage { animation: none; }
    }
    .spoke-campaign-stage::before {
      content: '';
      position: absolute;
      inset: 0;
      background: url('/asset/promesa/node_map_promesa.png') center/cover no-repeat;
      filter: saturate(0.85) brightness(0.55) contrast(1.05);
      z-index: 0;
    }
    /* Painterly vignette on top of the bg so center pops. */
    .spoke-campaign-stage::after {
      content: '';
      position: absolute;
      inset: 0;
      background:
        radial-gradient(ellipse at 50% 55%, transparent 38%, rgba(8, 6, 16, 0.65) 92%),
        linear-gradient(180deg, rgba(8, 6, 16, 0.55) 0%, transparent 18%, transparent 78%, rgba(8, 6, 16, 0.65) 100%);
      pointer-events: none;
      z-index: 1;
    }

    /* ── Grid sits on top of the painted stage ─────────────────────── */
    .spoke-campaign-grid {
      position: relative;
      z-index: 2;
      display: grid;
      grid-template-columns: minmax(280px, 340px) 1fr minmax(240px, 280px);
      grid-template-rows: auto 1fr auto;
      grid-template-areas:
        "topbar    topbar     topbar"
        "details   map        legend"
        "army      army       army";
      gap: 0;
      width: 100vw;
      height: 100vh;
      box-sizing: border-box;
    }
    @media (min-width: 1280px) {
      .spoke-campaign-grid {
        grid-template-columns: minmax(320px, 360px) 1fr minmax(260px, 300px);
      }
    }

    /* ── Zones are transparent — components carry their own painted skin */
    .spoke-campaign-zone {
      box-sizing: border-box;
      position: relative;
      overflow: visible;
    }
    .spoke-campaign-zone--topbar  { grid-area: topbar; }
    .spoke-campaign-zone--details { grid-area: details; padding: 22px 18px 22px 22px; overflow-y: auto; }
    .spoke-campaign-zone--map     { grid-area: map; padding: 12px 8px; min-height: 320px; }
    .spoke-campaign-zone--legend  { grid-area: legend; padding: 22px 22px 22px 18px; overflow-y: auto; }
    .spoke-campaign-zone--army    { grid-area: army; }

    /* Detail-swap animation on selection change. */
    .spoke-campaign-zone--details > * {
      animation: spoke-campaign-detail-swap var(--duration-fast, 150ms) var(--ease-default, ease) both;
    }
    @media (prefers-reduced-motion: reduce) {
      .spoke-campaign-zone--details > * { animation: none; }
    }

    /* ── Painted card frame — used by side panels and the army strip */
    .spoke-painted-card {
      position: relative;
      background:
        linear-gradient(180deg, rgba(28, 22, 36, 0.96) 0%, rgba(18, 14, 24, 0.96) 100%);
      border: 1px solid rgba(186, 152, 88, 0.55);
      border-radius: 6px;
      box-shadow:
        0 0 0 1px rgba(8, 6, 14, 0.8),
        0 18px 40px rgba(0, 0, 0, 0.6),
        inset 0 0 0 1px rgba(212, 168, 67, 0.1);
      padding: 18px 18px 22px;
    }
    .spoke-painted-card::before,
    .spoke-painted-card::after {
      content: '';
      position: absolute;
      width: 14px;
      height: 14px;
      border: 1.5px solid rgba(212, 168, 67, 0.8);
      pointer-events: none;
    }
    .spoke-painted-card::before {
      top: 4px; left: 4px;
      border-right: none; border-bottom: none;
    }
    .spoke-painted-card::after {
      bottom: 4px; right: 4px;
      border-left: none; border-top: none;
    }
    /* Strip nested panel chrome so the painted-card frame is the only border. */
    .spoke-painted-card .landmark-details-panel {
      background: none;
      border: none;
      box-shadow: none;
      margin: 0;
      padding: 0;
      max-width: none;
    }
    .spoke-painted-card .landmark-details-panel::before { display: none; }

    /* Details card: pull the art header flush to the card edges. */
    .spoke-painted-card--details {
      padding-top: 0;
      overflow: hidden;
    }
    .spoke-painted-card--details .ldp-art-header {
      border-radius: 5px 5px 0 0;
      margin-bottom: 0;
    }
    .spoke-painted-card--details .ldp-content {
      padding: 14px 16px 0;
    }

    .spoke-painted-card .spoke-legend {
      gap: 14px;
    }

    /* Empty-state button kept for the no-spoke fallback. */
    .spoke-campaign-action-btn {
      padding: 6px 14px;
      background: rgba(14, 12, 28, 0.85);
      border: 1px solid rgba(180, 160, 100, 0.4);
      border-radius: 4px;
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

    /* ── Narrow-screen collapse ─────────────────────────────────────── */
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
        min-height: 100vh;
      }
      .spoke-campaign-stage { position: relative; min-height: 100vh; }
      .spoke-campaign-zone--details,
      .spoke-campaign-zone--legend { padding: 16px; }
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
    <div class="spoke-campaign-stage">
      <div class="spoke-campaign-grid">
        <div class="spoke-campaign-zone spoke-campaign-zone--topbar">
          <SpokeCampaignTopBar />
        </div>

        <aside class="spoke-campaign-zone spoke-campaign-zone--details">
          <div class="spoke-painted-card spoke-painted-card--details">
            <LandmarkDetailsPanel
              key={selectedNode?.id ?? 'empty'}
              node={selectedNode}
              isCurrent={selectedIsCurrent}
              accentColor={accent}
              actionLabel={actionLabel}
              actionDisabledReason={disabledReason}
              onAction={handleAction}
            />
          </div>
        </aside>

        <section class="spoke-campaign-zone spoke-campaign-zone--map">
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
          <div class="spoke-painted-card">
            <SpokeLegendPanel />
          </div>
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
