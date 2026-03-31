import { signal } from '@preact/signals';
import { useEffect, useMemo } from 'preact/hooks';
import { navigateTo } from './screens';
import { lastBattleResult, advanceNode, grantSpokeResource } from '../game/spoke';
import type { BattleResult } from '../game/spoke';
import { selectedCommander } from '../game/game-state';
import { FACTION_COLORS, RESOURCE_INFO } from '../game/commander';
import type { ResourceType } from '../game/commander';
import { STARTER_DOCTRINES } from '../data/doctrine-data';
import { STARTER_DECRETUM } from '../data/decretum-data';
import { isDoctrineEquippable } from '../game/doctrine';
import { isDecretumCastable } from '../game/decretum';
import { addDoctrineToCollection } from '../game/doctrine-store';
import { addDecretum } from '../game/decretum-store';

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
      border-color: rgba(220, 190, 100, 0.6) !important;
      background: rgba(50, 45, 70, 0.95) !important;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3), 0 0 12px rgba(180, 160, 100, 0.1);
    }
    .reward-btn:not(:disabled):active { transform: scale(0.98); }
  `;
  document.head.appendChild(el);
}

// ── Reward definitions ──

interface ResourceReward {
  kind: 'resource';
  label: string;
  description: string;
  resource: ResourceType | null; // null = conceptual (Heal Army)
  victory: number;
  defeat: number;
}

interface DoctrineReward {
  kind: 'doctrine';
  label: string;
  description: string;
  doctrineIndex: number; // index into STARTER_DOCTRINES
}

interface DecretumReward {
  kind: 'decretum';
  label: string;
  description: string;
  decretumIndex: number; // index into STARTER_DECRETUM
}

type Reward = ResourceReward | DoctrineReward | DecretumReward;

const STATIC_REWARDS: ResourceReward[] = [
  { kind: 'resource', label: 'Heal Army', description: 'Your soldiers recover', resource: null, victory: 0, defeat: 0 },
  { kind: 'resource', label: 'Bonus Gold', description: 'Plunder the battlefield', resource: 'gold', victory: 3, defeat: 1 },
  { kind: 'resource', label: 'Bonus Momentum', description: 'Press the advantage', resource: 'momentum', victory: 2, defeat: 1 },
  { kind: 'resource', label: 'Bonus Faith',    description: 'The gods favor you',  resource: 'faith',    victory: 1, defeat: 1 },
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

  // Build dynamic rewards once on mount; stable across re-renders via useMemo
  const dynamicRewards = useMemo<Reward[]>(() => {
    if (!isVictory || !commander) return [];

    const faction = commander.faction;

    // Pick a random equippable Doctrine
    const equippableDoctrines = STARTER_DOCTRINES
      .map((d, i) => ({ d, i }))
      .filter(({ d }) => isDoctrineEquippable(d, faction));
    const pickedDoctrineEntry = equippableDoctrines.length > 0
      ? equippableDoctrines[Math.floor(Math.random() * equippableDoctrines.length)]
      : null;

    // Pick a random castable Decretum
    const castableDecretum = STARTER_DECRETUM
      .map((d, i) => ({ d, i }))
      .filter(({ d }) => isDecretumCastable(d, faction));
    const pickedDecretumEntry = castableDecretum.length > 0
      ? castableDecretum[Math.floor(Math.random() * castableDecretum.length)]
      : null;

    const rewards: Reward[] = [];

    if (pickedDoctrineEntry !== null) {
      rewards.push({
        kind: 'doctrine',
        label: 'New Doctrine',
        description: pickedDoctrineEntry.d.name,
        doctrineIndex: pickedDoctrineEntry.i,
      });
    }

    if (pickedDecretumEntry !== null) {
      rewards.push({
        kind: 'decretum',
        label: 'New Scroll',
        description: pickedDecretumEntry.d.name,
        decretumIndex: pickedDecretumEntry.i,
      });
    }

    return rewards;
  // Victory/commander are intentionally excluded so the pick is stable after mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Combined rewards: static always shown, dynamic victory-only rewards appended
  const allRewards: Reward[] = [...STATIC_REWARDS, ...dynamicRewards];

  function handlePick(index: number) {
    if (chosenIndex.value !== null) return; // already picked
    chosenIndex.value = index;

    const reward = allRewards[index];

    if (reward.kind === 'resource') {
      if (reward.resource) {
        const amount = isVictory ? reward.victory : reward.defeat;
        grantSpokeResource(reward.resource, amount, commander?.faction);
      }
    } else if (reward.kind === 'doctrine') {
      const doctrine = STARTER_DOCTRINES[reward.doctrineIndex];
      addDoctrineToCollection({ ...doctrine, id: doctrine.id + '_' + Date.now(), currentLevel: 1 });
    } else if (reward.kind === 'decretum') {
      const decretum = STARTER_DECRETUM[reward.decretumIndex];
      addDecretum({ ...decretum, id: decretum.id + '_' + Date.now() });
    }

    // Resolve battle node and return to node map
    // Season ticks are handled by NodeMapScreen when it renders
    advanceNode();
    lastBattleResult.value = null;
    navigateTo('node-map');
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100vh', fontFamily: "'Segoe UI', system-ui, sans-serif",
      background: '#d8d0c8 url(/asset/marbel_background.png) center / contain no-repeat',
      paddingTop: '38px', padding: '38px 16px 0',
    }}>
      {/* Dark content panel */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        background: 'rgba(12, 10, 24, 0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderRadius: '12px',
        border: '1px solid rgba(180, 160, 100, 0.15)',
        padding: '36px 40px 32px',
        maxWidth: '90%',
        width: '480px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
      }}>
        {/* Banner */}
        {result === 'victory' ? (
          <img
            class="battle-banner"
            src="/asset/victory_banner.png"
            alt="Victory"
            style={{
              width: '320px', height: 'auto',
              marginBottom: '12px',
              filter: 'drop-shadow(0 4px 12px rgba(180, 140, 40, 0.4))',
            }}
          />
        ) : result === 'defeat' ? (
          <img
            class="battle-banner"
            src="/asset/defeat_label.png"
            alt="Defeat"
            style={{
              width: '320px', height: 'auto',
              marginBottom: '12px',
              filter: 'drop-shadow(0 4px 12px rgba(80, 40, 20, 0.5))',
            }}
          />
        ) : (
          <>
            <div class="battle-banner" style={{
              fontSize: '32px', fontWeight: 700, color: banner.color,
              letterSpacing: '6px', textTransform: 'uppercase', marginBottom: '4px',
              textShadow: `0 2px 16px ${banner.color}60, 0 0 40px ${banner.color}30`,
            }}>
              {banner.text}
            </div>
            <div style={{
              width: '80px', height: '2px', marginBottom: '8px',
              background: `linear-gradient(90deg, transparent, ${banner.color}70, transparent)`,
            }} />
          </>
        )}

        <div style={{
          fontSize: '12px', color: 'rgba(200, 190, 160, 0.6)',
          letterSpacing: '1px', marginBottom: '24px',
        }}>
          Choose a reward
        </div>

        {/* Reward buttons */}
        <div style={{
          display: 'flex', flexDirection: 'column', gap: '10px',
          width: '100%',
        }}>
          {allRewards.map((reward, i) => {
            const isChosen = chosenIndex.value === i;
            const rewardAccentColor = (reward.kind === 'doctrine' || reward.kind === 'decretum')
              ? color
              : undefined;

            return (
              <button
                class="reward-btn"
                key={reward.label + i}
                onClick={() => handlePick(i)}
                disabled={chosenIndex.value !== null}
                style={{
                  padding: '14px 18px', borderRadius: '6px',
                  cursor: chosenIndex.value !== null ? 'default' : 'pointer',
                  background: isChosen
                    ? `linear-gradient(135deg, ${color}35, ${color}18)`
                    : 'rgba(35, 32, 55, 0.9)',
                  border: `1px solid ${isChosen ? color : 'rgba(180, 160, 100, 0.3)'}`,
                  color: chosenIndex.value !== null && !isChosen ? 'rgba(120, 110, 100, 0.3)' : '#e8e0cc',
                  fontFamily: 'inherit', fontSize: '13px',
                  textAlign: 'left',
                  opacity: chosenIndex.value !== null && !isChosen ? 0.4 : 1,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                  <span style={{ fontWeight: 600, fontSize: '14px' }}>{reward.label}</span>
                  {reward.kind === 'resource' && reward.resource && (() => {
                    const amount = isVictory ? reward.victory : reward.defeat;
                    return amount > 0 ? (
                      <span style={{
                        fontWeight: 700, fontSize: '15px',
                        color: RESOURCE_INFO[reward.resource!].color,
                        textShadow: `0 0 8px ${RESOURCE_INFO[reward.resource!].color}40`,
                      }}>
                        {RESOURCE_INFO[reward.resource!].icon} +{amount}
                      </span>
                    ) : null;
                  })()}
                  {(reward.kind === 'doctrine' || reward.kind === 'decretum') && (
                    <span style={{
                      fontSize: '11px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase',
                      color: rewardAccentColor,
                      textShadow: `0 0 8px ${rewardAccentColor}60`,
                      opacity: 0.85,
                    }}>
                      {reward.kind === 'doctrine' ? 'Doctrine' : 'Scroll'}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '11px', color: 'rgba(200, 190, 170, 0.6)' }}>
                  {reward.kind === 'resource' ? (
                    <>
                      {reward.description}
                      {reward.resource === null && (
                        <span style={{ marginLeft: '6px', color: 'rgba(180, 170, 150, 0.45)', fontStyle: 'italic' }}>
                          (Army healing coming in future update)
                        </span>
                      )}
                    </>
                  ) : (
                    <span style={{
                      color: rewardAccentColor,
                      opacity: chosenIndex.value !== null && !isChosen ? 0.3 : 0.9,
                      fontStyle: 'italic',
                    }}>
                      {reward.description}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
