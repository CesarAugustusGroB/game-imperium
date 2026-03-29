import { signal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { navigateTo } from './screens';
import { lastBattleResult, advanceNode, grantSpokeResource } from '../game/spoke';
import type { BattleResult } from '../game/spoke';
import { selectedCommander } from '../game/game-state';
import { FACTION_COLORS, RESOURCE_INFO } from '../game/commander';
import type { ResourceType } from '../game/commander';

// ── One-time CSS injection ──
if (typeof document !== 'undefined' && !document.getElementById('post-battle-styles')) {
  const el = document.createElement('style');
  el.id = 'post-battle-styles';
  el.textContent = `
    @keyframes banner-entrance {
      from { opacity: 0; transform: scale(0.9) translateY(-8px); }
      to   { opacity: 1; transform: scale(1) translateY(0); }
    }
    .battle-banner {
      animation: banner-entrance 0.4s ease-out;
    }
    .reward-btn { transition: all 0.2s ease; }
    .reward-btn:not(:disabled):hover {
      border-color: rgba(220, 190, 100, 0.5) !important;
      background: rgba(70, 70, 95, 0.7) !important;
      box-shadow: 0 2px 12px rgba(180, 160, 100, 0.1);
    }
    .reward-btn:not(:disabled):active { transform: scale(0.98); }
  `;
  document.head.appendChild(el);
}

// ── Reward definitions ──

interface Reward {
  label: string;
  description: string;
  resource: ResourceType | null; // null = conceptual (Heal Army)
  victory: number;
  defeat: number;
}

const REWARDS: Reward[] = [
  { label: 'Heal Army', description: 'Your soldiers recover', resource: null, victory: 0, defeat: 0 },
  { label: 'Bonus Gold', description: 'Plunder the battlefield', resource: 'gold', victory: 3, defeat: 1 },
  { label: 'Bonus Momentum', description: 'Press the advantage', resource: 'momentum', victory: 2, defeat: 1 },
  { label: 'Bonus Faith',    description: 'The gods favor you',  resource: 'faith',    victory: 1, defeat: 1 },
];

const BANNER: Record<BattleResult, { text: string; color: string }> = {
  victory: { text: 'VICTORY', color: '#f0d080' },
  defeat:  { text: 'DEFEAT',  color: '#c05050' },
  draw:    { text: 'DRAW',    color: '#888888' },
};

// ── Component state ──
const chosenIndex = signal<number | null>(null);

export function PostBattleScreen() {
  // Reset once on mount, not on every re-render (avoids double-pick race)
  useEffect(() => { chosenIndex.value = null; }, []);

  const result = lastBattleResult.value ?? 'defeat';
  const commander = selectedCommander.value;
  const color = commander ? FACTION_COLORS[commander.faction] : '#f0d080';
  const banner = BANNER[result];
  const isVictory = result === 'victory';

  function handlePick(index: number) {
    if (chosenIndex.value !== null) return; // already picked
    chosenIndex.value = index;

    const reward = REWARDS[index];
    if (reward.resource) {
      const amount = isVictory ? reward.victory : reward.defeat;
      grantSpokeResource(reward.resource, amount, commander?.faction);
    }

    // Resolve battle node and return to node map
    advanceNode();
    lastBattleResult.value = null;
    navigateTo('node-map');
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100vh', fontFamily: "'Segoe UI', system-ui, sans-serif",
      background: 'radial-gradient(ellipse at 50% 40%, rgba(30, 28, 50, 0.92), rgba(8, 8, 18, 0.97))',
      paddingTop: '38px', padding: '38px 16px 0',
    }}>
      {/* Banner */}
      <div class="battle-banner" style={{
        fontSize: '28px', fontWeight: 700, color: banner.color,
        letterSpacing: '6px', textTransform: 'uppercase', marginBottom: '4px',
        textShadow: `0 2px 12px ${banner.color}40`,
      }}>
        {banner.text}
      </div>

      {/* Decorative divider */}
      <div style={{
        width: '80px', height: '1px', marginBottom: '8px',
        background: `linear-gradient(90deg, transparent, ${banner.color}50, transparent)`,
      }} />

      <div style={{
        fontSize: '12px', color: 'rgba(180, 170, 150, 0.4)',
        letterSpacing: '1px', marginBottom: '32px',
      }}>
        Choose a reward
      </div>

      {/* Reward buttons */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: '10px',
        width: '100%', maxWidth: '360px',
      }}>
        {REWARDS.map((reward, i) => {
          const amount = isVictory ? reward.victory : reward.defeat;
          const isChosen = chosenIndex.value === i;

          return (
            <button
              class="reward-btn"
              key={reward.label}
              onClick={() => handlePick(i)}
              disabled={chosenIndex.value !== null}
              style={{
                padding: '12px 16px', borderRadius: '4px',
                cursor: chosenIndex.value !== null ? 'default' : 'pointer',
                background: isChosen
                  ? `linear-gradient(135deg, ${color}30, ${color}15)`
                  : 'rgba(60, 60, 80, 0.6)',
                border: `1px solid ${isChosen ? color : 'rgba(180, 160, 100, 0.25)'}`,
                color: chosenIndex.value !== null && !isChosen ? 'rgba(120, 110, 100, 0.3)' : '#d0c8a8',
                fontFamily: 'inherit', fontSize: '13px',
                textAlign: 'left',
                opacity: chosenIndex.value !== null && !isChosen ? 0.4 : 1,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                <span style={{ fontWeight: 600 }}>{reward.label}</span>
                {reward.resource && amount > 0 && (
                  <span style={{
                    fontWeight: 700, fontSize: '14px',
                    color: RESOURCE_INFO[reward.resource].color,
                  }}>
                    {RESOURCE_INFO[reward.resource].icon} +{amount}
                  </span>
                )}
              </div>
              <div style={{ fontSize: '11px', color: 'rgba(180, 170, 150, 0.5)' }}>
                {reward.description}
                {reward.resource === null && (
                  <span style={{ marginLeft: '6px', color: 'rgba(160, 150, 130, 0.4)', fontStyle: 'italic' }}>
                    (Army healing coming in future update)
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
