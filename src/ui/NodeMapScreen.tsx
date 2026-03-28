import { Fragment } from 'preact';
import { signal } from '@preact/signals';
import { navigateTo } from './screens';
import { currentSpoke, currentNodeIndex, resetSpoke, advanceNode, completeSpoke } from '../game/spoke';
import type { SpokeNode, NodeType } from '../game/spoke';
import { selectedCommander, completedSpokes } from '../game/game-state';
import { FACTION_COLORS } from '../game/commander';

// ── One-time CSS injection ──
if (typeof document !== 'undefined' && !document.getElementById('node-map-styles')) {
  const el = document.createElement('style');
  el.id = 'node-map-styles';
  el.textContent = `
    @keyframes node-pulse {
      0%, 100% { box-shadow: 0 0 12px var(--glow), 0 0 24px var(--glow); transform: scale(1); }
      50% { box-shadow: 0 0 20px var(--glow), 0 0 40px var(--glow); transform: scale(1.08); }
    }
    .node-circle { transition: all 0.25s ease; }
    .node-circle:hover { filter: brightness(1.15); }
    .node-current { animation: node-pulse 2s ease-in-out infinite; cursor: pointer; }
    .node-current:hover { transform: scale(1.12); }
    .node-resolved { opacity: 0.45; }
    .node-future { opacity: 0.35; cursor: default; }
  `;
  document.head.appendChild(el);
}

// ── Icons per node type ──
const NODE_ICONS: Record<NodeType, string> = {
  battle: '\u2694\uFE0F',  // ⚔️
  rest:   '\uD83C\uDFD5\uFE0F',  // 🏕️
  event:  '\uD83D\uDCDC',  // 📜
  boss:   '\uD83D\uDC80',  // 💀
};

const NODE_LABELS: Record<NodeType, string> = {
  battle: 'Battle',
  rest: 'Rest',
  event: 'Event',
  boss: 'Boss',
};

// ── Retreat confirmation state ──
const showRetreatConfirm = signal(false);

function NodeCircle({ node, isCurrent, color }: {
  node: SpokeNode;
  isCurrent: boolean;
  color: string;
}) {
  const stateClass = node.resolved ? 'node-resolved' : isCurrent ? 'node-current' : 'node-future';

  function handleClick() {
    if (!isCurrent || node.resolved) return;
    if (node.type === 'battle' || node.type === 'boss') {
      navigateTo('battle');
    } else {
      // rest/event: auto-resolve for now (S2-06/S2-07 will add modals)
      advanceNode();
    }
  }

  return (
    <div
      class={`node-circle ${stateClass}`}
      onClick={handleClick}
      style={{
        '--glow': color + '60',
        width: '56px',
        height: '56px',
        borderRadius: '50%',
        background: node.resolved
          ? 'rgba(40, 38, 55, 0.9)'
          : isCurrent
            ? `linear-gradient(135deg, ${color}25, ${color}10)`
            : 'rgba(30, 28, 48, 0.9)',
        border: `2px solid ${isCurrent ? color : node.resolved ? 'rgba(100, 100, 100, 0.3)' : 'rgba(180, 160, 100, 0.15)'}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        flexShrink: '0',
      } as Record<string, string>}
    >
      {/* Icon */}
      <span style={{ fontSize: '20px', lineHeight: '1' }}>
        {node.resolved ? '\u2714' : NODE_ICONS[node.type]}
      </span>

      {/* Label below circle */}
      <div style={{
        position: 'absolute',
        bottom: '-20px',
        fontSize: '9px',
        letterSpacing: '1px',
        textTransform: 'uppercase',
        color: isCurrent ? color : 'rgba(180, 170, 150, 0.4)',
        whiteSpace: 'nowrap',
        fontWeight: isCurrent ? '600' : '400',
      }}>
        {NODE_LABELS[node.type]}
      </div>
    </div>
  );
}

function ConnectingLine({ resolved, color }: { resolved: boolean; color: string }) {
  return (
    <div style={{
      width: '48px',
      height: '2px',
      background: resolved
        ? 'rgba(100, 100, 100, 0.25)'
        : `linear-gradient(90deg, ${color}50, ${color}25)`,
      flexShrink: 0,
      alignSelf: 'center',
    }} />
  );
}

function RetreatConfirmModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div style={{
      position: 'fixed', inset: '0', zIndex: '200',
      background: 'rgba(0, 0, 0, 0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Segoe UI', system-ui, sans-serif",
    }}>
      <div style={{
        background: 'linear-gradient(135deg, rgba(30, 28, 48, 0.98), rgba(20, 18, 36, 0.99))',
        border: '1px solid rgba(180, 160, 100, 0.25)',
        borderRadius: '8px', padding: '28px 32px',
        maxWidth: '360px', textAlign: 'center',
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
          <button
            onClick={onConfirm}
            style={{
              padding: '8px 18px', borderRadius: '4px', cursor: 'pointer',
              background: 'rgba(180, 60, 60, 0.3)', border: '1px solid rgba(200, 80, 80, 0.5)',
              color: '#e0a0a0', fontFamily: 'inherit', fontSize: '13px', fontWeight: 600,
            }}
          >
            Confirm Retreat
          </button>
          <button
            onClick={onCancel}
            style={{
              padding: '8px 18px', borderRadius: '4px', cursor: 'pointer',
              background: 'rgba(60, 60, 80, 0.6)', border: '1px solid rgba(180, 160, 100, 0.25)',
              color: '#d0c8a8', fontFamily: 'inherit', fontSize: '13px',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export function NodeMapScreen() {
  // Reset stale modal state on each render
  showRetreatConfirm.value = false;

  const spoke = currentSpoke.value;
  const nodeIdx = currentNodeIndex.value;
  const commander = selectedCommander.value;
  const color = commander ? FACTION_COLORS[commander.faction] : '#f0d080';
  const spokeComplete = spoke ? nodeIdx >= spoke.nodes.length : false;

  if (!spoke) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', color: 'rgba(200, 190, 160, 0.5)',
        fontFamily: "'Segoe UI', system-ui, sans-serif",
      }}>
        No active spoke — return to hub
      </div>
    );
  }

  function handleRetreat() {
    showRetreatConfirm.value = false;
    resetSpoke();
    navigateTo('hub');
  }

  function handleSpokeComplete() {
    completedSpokes.value += 1;
    completeSpoke();
    navigateTo('hub');
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100vh', fontFamily: "'Segoe UI', system-ui, sans-serif",
      background: 'radial-gradient(ellipse at 50% 40%, rgba(30, 28, 50, 0.92), rgba(8, 8, 18, 0.97))',
      paddingTop: '38px', // leave room for ResourceBar
    }}>
      {/* Spoke label */}
      <div style={{
        fontSize: '14px', fontWeight: 600, color,
        letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '8px',
        textShadow: `0 2px 8px ${color}30`,
      }}>
        {spoke.label}
      </div>

      {/* Progress text */}
      <div style={{
        fontSize: '11px', color: 'rgba(180, 170, 150, 0.4)',
        letterSpacing: '1px', marginBottom: '40px',
      }}>
        Node {Math.min(nodeIdx + 1, spoke.nodes.length)} of {spoke.nodes.length}
      </div>

      {/* Node chain */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0',
        padding: '0 24px', maxWidth: '100%', overflowX: 'auto',
      }}>
        {spoke.nodes.map((node, i) => (
          <Fragment key={node.id}>
            {i > 0 && (
              <ConnectingLine
                resolved={spoke.nodes[i - 1].resolved}
                color={color}
              />
            )}
            <NodeCircle
              node={node}
              isCurrent={i === nodeIdx}
              color={color}
            />
          </Fragment>
        ))}
      </div>

      {/* Current node hint / spoke complete */}
      {spokeComplete ? (
        <div style={{ marginTop: '40px', textAlign: 'center' }}>
          <div style={{
            fontSize: '14px', fontWeight: 600, color,
            letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px',
          }}>
            Spoke Complete!
          </div>
          <button
            onClick={handleSpokeComplete}
            style={{
              padding: '10px 24px', borderRadius: '4px', cursor: 'pointer',
              background: `linear-gradient(135deg, ${color}30, ${color}15)`,
              border: `1px solid ${color}60`,
              color, fontFamily: 'inherit', fontSize: '13px', fontWeight: 600,
              letterSpacing: '1px',
            }}
          >
            Return to Hub
          </button>
        </div>
      ) : (
        <div style={{
          marginTop: '40px', fontSize: '12px',
          color: 'rgba(180, 170, 150, 0.4)', letterSpacing: '1px',
        }}>
          Click the active node to proceed
        </div>
      )}

      {/* Retreat button */}
      <button
        onClick={() => { showRetreatConfirm.value = true; }}
        style={{
          position: 'fixed', bottom: '20px', left: '20px',
          padding: '8px 16px', borderRadius: '4px', cursor: 'pointer',
          background: 'rgba(40, 36, 60, 0.9)',
          border: '1px solid rgba(180, 160, 100, 0.2)',
          color: 'rgba(200, 180, 140, 0.5)',
          fontFamily: 'inherit', fontSize: '12px', letterSpacing: '1px',
          transition: 'all 0.2s ease',
        }}
      >
        ← Retreat
      </button>

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
