import { signal } from '@preact/signals';
import { navigateTo } from './screens';
import { lastBattleResult, advanceNode } from '../game/spoke';
import type { BattleResult } from '../game/spoke';
import { selectedCommander } from '../game/game-state';
import { FACTION_COLORS, RESOURCE_INFO } from '../game/commander';
import type { ResourceType } from '../game/commander';
import { addResource } from '../game/resources';

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
  { label: 'Bonus Faith', description: 'The gods favor you', resource: 'faith', victory: 1, defeat: 1 },
];

const BANNER: Record<BattleResult, { text: string; color: string }> = {
  victory: { text: 'VICTORY', color: '#f0d080' },
  defeat:  { text: 'DEFEAT',  color: '#c05050' },
  draw:    { text: 'DRAW',    color: '#888888' },
};

// ── Component state ──
const chosenIndex = signal<number | null>(null);

export function PostBattleScreen() {
  // Reset on each render
  chosenIndex.value = null;

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
      addResource(reward.resource, amount, commander?.faction);
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
      paddingTop: '38px',
    }}>
      {/* Banner */}
      <div style={{
        fontSize: '28px', fontWeight: 700, color: banner.color,
        letterSpacing: '6px', textTransform: 'uppercase', marginBottom: '8px',
        textShadow: `0 2px 12px ${banner.color}40`,
      }}>
        {banner.text}
      </div>

      <div style={{
        fontSize: '12px', color: 'rgba(180, 170, 150, 0.4)',
        letterSpacing: '1px', marginBottom: '40px',
      }}>
        Choose a reward
      </div>

      {/* Reward buttons */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: '10px',
        width: '320px',
      }}>
        {REWARDS.map((reward, i) => {
          const amount = isVictory ? reward.victory : reward.defeat;
          const isChosen = chosenIndex.value === i;

          return (
            <button
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
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: '2px' }}>
                {reward.label}
              </div>
              <div style={{ fontSize: '11px', color: 'rgba(180, 170, 150, 0.5)' }}>
                {reward.description}
                {reward.resource && amount > 0 && (
                  <span style={{
                    marginLeft: '8px', fontWeight: 600,
                    color: RESOURCE_INFO[reward.resource].color,
                  }}>
                    {RESOURCE_INFO[reward.resource].icon} +{amount}
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
