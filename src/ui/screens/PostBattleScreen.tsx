import { signal } from '@preact/signals';
import { useEffect, useMemo } from 'preact/hooks';
import { navigateTo } from '../screens';
import { lastBattleResult, advanceNode, grantSpokeResource } from '../../game/progression/spoke';
import type { BattleResult } from '../../game/progression/spoke';
import { selectedCommander } from '../../game/core/game-state';
import { FACTION_COLORS, RESOURCE_INFO } from '../../game/core/commander';
import type { ResourceType } from '../../game/core/commander';
import { STARTER_DOCTRINES } from '../../data/doctrine-data';
import { STARTER_DECRETUM } from '../../data/decretum-data';
import { isDoctrineEquippable } from '../../game/items/doctrine';
import { isDecretumCastable } from '../../game/items/decretum';
import { addDoctrineToCollection } from '../../game/items/doctrine-store';
import { addDecretum } from '../../game/items/decretum-store';
import { OrnateFrame, OrnateHeader } from '../components/OrnateFrame';
import { lastEnemyArmy } from '../../battle/index';
import { threatLevel } from '../../game/core/game-state';

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
    .reward-tooltip-wrap { position: relative; }
    .reward-item-tooltip {
      display: none;
      position: absolute;
      bottom: calc(100% + 8px);
      left: 50%;
      transform: translateX(-50%);
      background: var(--color-bg-primary);
      border: 1px solid var(--color-border-default);
      border-radius: var(--radius-sm);
      padding: 8px 14px;
      font-size: var(--font-size-sm);
      color: var(--color-text-secondary);
      white-space: nowrap;
      z-index: 50;
      pointer-events: none;
      box-shadow: var(--shadow-md);
    }
    .reward-tooltip-wrap:hover .reward-item-tooltip { display: block; }
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
  tooltip: string;       // level-1 effect description
  doctrineIndex: number; // index into STARTER_DOCTRINES
}

interface DecretumReward {
  kind: 'decretum';
  label: string;
  description: string;
  tooltip: string;       // scroll effect description
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
  victory: { text: 'VICTORY', color: 'var(--color-gold-primary)' },
  defeat:  { text: 'DEFEAT',  color: 'var(--color-danger)' },
  draw:    { text: 'DRAW',    color: '#888888' },
};

// ── Component state ──
const chosenIndex = signal<number | null>(null);

export function PostBattleScreen() {
  // Reset once on mount, not on every re-render (avoids double-pick race)
  useEffect(() => { chosenIndex.value = null; }, []);

  const result = lastBattleResult.value ?? 'defeat';
  const commander = selectedCommander.value;
  const color = commander ? FACTION_COLORS[commander.faction] : 'var(--color-gold-primary)';
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
        tooltip: pickedDoctrineEntry.d.levels[0].description,
        doctrineIndex: pickedDoctrineEntry.i,
      });
    }

    if (pickedDecretumEntry !== null) {
      rewards.push({
        kind: 'decretum',
        label: 'New Scroll',
        description: pickedDecretumEntry.d.name,
        tooltip: pickedDecretumEntry.d.description,
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
    lastEnemyArmy.value = null;
    navigateTo('node-map');
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100vh', fontFamily: 'var(--font-family)',
      background: 'var(--color-bg-primary)',
      padding: '38px 16px',
    }}>
      <OrnateFrame width="min(900px, 94vw)" padding="default" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <OrnateHeader
          eyebrow="Spoils of war"
          title={result === 'victory' ? 'VICTORY' : result === 'defeat' ? 'DEFEAT' : 'STALEMATE'}
          accentColor={result === 'victory' ? 'var(--color-gold-primary)' : result === 'defeat' ? 'var(--color-danger)' : 'var(--color-gold-secondary)'}
        />

        {/* Banner — decorative image flourish; kept as visual accent below the header */}
        {result === 'victory' ? (
          <img
            class="battle-banner"
            src="/asset/ui/victory_banner.png"
            alt="Victory"
            style={{
              width: 'min(320px, 90%)', height: 'auto',
              marginBottom: '12px',
              filter: 'drop-shadow(0 4px 12px rgba(180, 140, 40, 0.4))',
            }}
          />
        ) : result === 'defeat' ? (
          <img
            class="battle-banner"
            src="/asset/ui/defeat_label.png"
            alt="Defeat"
            style={{
              width: 'min(320px, 90%)', height: 'auto',
              marginBottom: '12px',
              filter: 'drop-shadow(0 4px 12px rgba(80, 40, 20, 0.5))',
            }}
          />
        ) : (
          /* Draw has no image asset — decorative divider line as visual flourish */
          <div class="battle-banner" style={{
            width: '80px', height: '2px', marginBottom: '16px',
            background: `linear-gradient(90deg, transparent, ${banner.color}70, transparent)`,
          }} />
        )}

        {/* S15-05: Enemy Force Summary */}
        {lastEnemyArmy.value && (() => {
          const enemy = lastEnemyArmy.value!;
          const groups = new Map<string, { name: string; count: number }>();
          for (const c of enemy.cohorts) {
            const g = groups.get(c.id);
            if (g) g.count++;
            else groups.set(c.id, { name: c.name, count: 1 });
          }
          const threat = threatLevel.value;
          return (
            <div style={{
              width: '100%', marginBottom: '16px', padding: '10px 14px',
              background: 'rgba(60, 30, 30, 0.25)',
              border: '1px solid rgba(180, 80, 60, 0.2)',
              borderRadius: 'var(--radius-md)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{
                  fontSize: 'var(--font-size-xs)', fontWeight: 700,
                  color: 'var(--color-text-muted)', letterSpacing: '2px', textTransform: 'uppercase',
                }}>
                  Enemy Force
                </span>
                <span style={{
                  fontSize: '8px', color: 'var(--color-text-muted)', letterSpacing: '1px',
                }}>
                  Threat {threat}
                </span>
              </div>
              <div style={{
                fontSize: 'var(--font-size-sm)', fontWeight: 700,
                color: 'rgba(220, 120, 100, 0.85)', fontFamily: 'var(--font-display)',
                letterSpacing: '0.8px', marginBottom: '4px',
              }}>
                {enemy.name}
              </div>
              <div style={{
                fontSize: '8px', color: 'var(--color-text-muted)', lineHeight: '1.5',
              }}>
                {Array.from(groups.values()).map(g => `${g.count} ${g.name}${g.count > 1 ? 's' : ''}`).join(' · ')}
              </div>
            </div>
          );
        })()}

        <div style={{
          fontSize: 'var(--font-size-md)', color: 'var(--color-text-secondary)',
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

            const tooltipText = (reward.kind === 'doctrine' || reward.kind === 'decretum')
              ? reward.tooltip
              : undefined;

            return (
              <div class="reward-tooltip-wrap" key={reward.label + i}>
                <button
                  class="ornate-btn"
                  onClick={() => handlePick(i)}
                  disabled={chosenIndex.value !== null}
                  style={{
                    width: '100%',
                    padding: '14px 18px', borderRadius: 'var(--radius-md)',
                    cursor: chosenIndex.value !== null ? 'default' : 'pointer',
                    background: isChosen
                      ? `linear-gradient(135deg, ${color}35, ${color}18)`
                      : 'rgba(35, 32, 55, 0.9)',
                    border: `1px solid ${isChosen ? color : 'var(--color-border-default)'}`,
                    color: chosenIndex.value !== null && !isChosen ? 'rgba(120, 110, 100, 0.3)' : '#e8e0cc',
                    fontFamily: 'inherit', fontSize: 'var(--font-size-md)',
                    textAlign: 'left',
                    opacity: chosenIndex.value !== null && !isChosen ? 0.4 : 1,
                    textTransform: 'none',
                    letterSpacing: 'normal',
                    fontWeight: 'normal',
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
                        fontSize: 'var(--font-size-sm)', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase',
                        color: rewardAccentColor,
                        textShadow: `0 0 8px ${rewardAccentColor}60`,
                        opacity: 0.85,
                      }}>
                        {reward.kind === 'doctrine' ? 'Doctrine' : 'Scroll'}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                    {reward.kind === 'resource' ? (
                      <>
                        {reward.description}
                        {reward.resource === null && (
                          <span style={{ marginLeft: '6px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
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
                {tooltipText && (
                  <div class="reward-item-tooltip">{tooltipText}</div>
                )}
              </div>
            );
          })}
        </div>
      </OrnateFrame>
    </div>
  );
}
