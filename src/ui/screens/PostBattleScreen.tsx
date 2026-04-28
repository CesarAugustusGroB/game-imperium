import { signal } from '@preact/signals';
import { useEffect, useMemo } from 'preact/hooks';
import { navigateTo } from '../screens';
import { lastBattleResult, advanceNode, grantSpokeResource, currentSpoke } from '../../game/progression/spoke';
import type { BattleResult } from '../../game/progression/spoke';
import { selectedCommander } from '../../game/core/game-state';
import { FACTION_COLORS, RESOURCE_INFO } from '../../game/core/commander';
import type { ResourceType } from '../../game/core/commander';
import { STARTER_DECRETUM } from '../../data/decretum-data';
import { isDecretumCastable } from '../../game/items/decretum';
import { addDecretum } from '../../game/items/decretum-store';
import { lastEnemyArmy } from '../../battle/index';
import { threatLevel } from '../../game/core/game-state';
import { lastVictoryCapSummary } from '../../battle/casualties';
import { applyPostBattleHealReward, POST_BATTLE_HEAL_REWARD_RATIO } from '../../game/army/army-replenishment';

if (typeof document !== 'undefined' && !document.getElementById('post-battle-styles')) {
  const el = document.createElement('style');
  el.id = 'post-battle-styles';
  el.textContent = `
    @keyframes post-battle-rise {
      from { opacity: 0; transform: translateY(18px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @keyframes post-battle-glow {
      0%, 100% { opacity: 0.5; transform: translate3d(-2%, 0, 0); }
      50% { opacity: 0.82; transform: translate3d(2%, -1%, 0); }
    }

    .post-battle-cinematic {
      min-height: 100vh;
      position: relative;
      overflow-x: hidden;
      overflow-y: auto;
      color: var(--color-text-primary);
      font-family: var(--font-family);
      background:
        url('/asset/backgrounds/post_battle_victory_background.png') center / cover fixed,
        #070915;
    }

    .post-battle-cinematic::before,
    .post-battle-cinematic::after {
      content: '';
      position: absolute;
      inset: 0;
      pointer-events: none;
    }

    .post-battle-cinematic::before {
      background:
        linear-gradient(90deg, rgba(12, 50, 83, 0.08), transparent 16%, transparent 84%, rgba(12, 50, 83, 0.08)),
        radial-gradient(circle at 50% 82%, rgba(2, 163, 255, 0.08), transparent 29%);
      mix-blend-mode: screen;
      animation: post-battle-glow 8s ease-in-out infinite;
    }

    .post-battle-cinematic::after {
      background:
        linear-gradient(90deg, rgba(232, 177, 66, 0.9), transparent 9%, transparent 91%, rgba(232, 177, 66, 0.9)),
        linear-gradient(180deg, rgba(232, 177, 66, 0.9), transparent 8%, transparent 92%, rgba(232, 177, 66, 0.85));
      opacity: 0.08;
    }

    .post-battle-shell {
      position: relative;
      z-index: 1;
      min-height: calc(100vh - 20px);
      margin: 10px;
      border: 1px solid rgba(243, 181, 63, 0.78);
      box-shadow:
        inset 0 0 0 1px rgba(26, 165, 255, 0.16),
        inset 0 0 48px rgba(2, 9, 18, 0.28),
        0 0 32px rgba(0, 0, 0, 0.65);
      padding: clamp(20px, 3.2vw, 42px);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: clamp(18px, 2vw, 26px);
      animation: post-battle-rise 0.42s ease-out;
    }

    .post-battle-header {
      width: min(980px, 100%);
      text-align: center;
      position: relative;
      padding-top: 6px;
    }

    .post-battle-banner {
      width: min(660px, 94%);
      height: auto;
      display: block;
      margin: 0 auto;
      filter: drop-shadow(0 0 22px rgba(241, 183, 78, 0.55));
    }

    .post-battle-fallback-title {
      font-family: var(--font-display);
      font-size: clamp(54px, 9vw, 126px);
      line-height: 0.9;
      color: var(--color-gold-primary);
      text-transform: uppercase;
      letter-spacing: 8px;
      text-shadow: 0 0 26px rgba(247, 195, 92, 0.58), 0 4px 0 rgba(0, 0, 0, 0.55);
    }

    .post-battle-subtitle {
      margin-top: -4px;
      font-family: var(--font-display);
      font-size: clamp(18px, 2.7vw, 34px);
      color: var(--color-gold-primary);
      letter-spacing: clamp(4px, 1vw, 12px);
      text-transform: uppercase;
      text-shadow: 0 0 18px rgba(247, 195, 92, 0.45);
    }

    .post-battle-summary-grid {
      width: min(1120px, 100%);
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 22px;
    }

    .post-battle-panel {
      min-height: 172px;
      padding: 22px 24px;
      background: linear-gradient(145deg, rgba(5, 17, 30, 0.86), rgba(7, 11, 22, 0.72));
      border: 1px solid rgba(218, 160, 58, 0.58);
      box-shadow: inset 0 0 28px rgba(12, 90, 142, 0.18), 0 12px 24px rgba(0, 0, 0, 0.34);
      position: relative;
    }

    .post-battle-panel::before,
    .post-battle-panel::after,
    .post-battle-reward-card::before,
    .post-battle-reward-card::after {
      content: '';
      position: absolute;
      width: 18px;
      height: 18px;
      pointer-events: none;
    }

    .post-battle-panel::before,
    .post-battle-reward-card::before {
      top: 6px;
      left: 6px;
      border-top: 1px solid rgba(243, 181, 63, 0.78);
      border-left: 1px solid rgba(243, 181, 63, 0.78);
    }

    .post-battle-panel::after,
    .post-battle-reward-card::after {
      right: 6px;
      bottom: 6px;
      border-right: 1px solid rgba(243, 181, 63, 0.78);
      border-bottom: 1px solid rgba(243, 181, 63, 0.78);
    }

    .post-battle-panel-label {
      font-family: var(--font-display);
      color: var(--color-gold-primary);
      text-transform: uppercase;
      letter-spacing: 2px;
      font-weight: 700;
      font-size: 15px;
      margin-bottom: 14px;
    }

    .post-battle-enemy-row {
      display: grid;
      grid-template-columns: 94px 1fr;
      gap: 18px;
      align-items: center;
    }

    .post-battle-enemy-emblem,
    .post-battle-casualty-emblem {
      width: 94px;
      aspect-ratio: 1;
      border: 1px solid rgba(41, 178, 255, 0.56);
      background:
        radial-gradient(circle, rgba(27, 151, 219, 0.22), transparent 58%),
        linear-gradient(145deg, rgba(3, 10, 20, 0.96), rgba(16, 22, 34, 0.9));
      box-shadow: inset 0 0 22px rgba(14, 126, 198, 0.28), 0 0 20px rgba(3, 132, 211, 0.15);
      display: grid;
      place-items: center;
      color: var(--color-gold-primary);
      font-family: var(--font-display);
      font-size: 38px;
      letter-spacing: 2px;
    }

    .post-battle-enemy-name,
    .post-battle-casualty-title {
      font-family: var(--font-display);
      color: #23bfff;
      font-size: clamp(22px, 2.3vw, 32px);
      letter-spacing: 0;
      line-height: 1.06;
      margin-bottom: 8px;
    }

    .post-battle-muted {
      color: rgba(232, 224, 204, 0.72);
      font-size: 14px;
      line-height: 1.45;
    }

    .post-battle-threat {
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .post-battle-casualty-top {
      display: grid;
      grid-template-columns: 1fr 94px;
      gap: 18px;
      align-items: center;
    }

    .post-battle-recovery {
      margin-top: 16px;
      padding-top: 12px;
      border-top: 1px solid rgba(218, 160, 58, 0.42);
      display: flex;
      justify-content: space-between;
      gap: 12px;
      color: var(--color-gold-primary);
      font-family: var(--font-display);
      letter-spacing: 1px;
      text-transform: uppercase;
    }

    .post-battle-casualty-list {
      margin-top: 12px;
      display: grid;
      gap: 8px;
    }

    .post-battle-casualty-line {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 12px;
      align-items: center;
      padding: 8px 10px;
      background: rgba(7, 13, 24, 0.62);
      border: 1px solid rgba(218, 160, 58, 0.18);
      font-size: 13px;
    }

    .post-battle-reward-title {
      font-family: var(--font-display);
      color: var(--color-gold-primary);
      letter-spacing: 8px;
      text-transform: uppercase;
      font-size: clamp(18px, 2.2vw, 30px);
      text-align: center;
      margin-top: -2px;
      width: min(1120px, 100%);
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: center;
      gap: 18px;
    }

    .post-battle-reward-title::before,
    .post-battle-reward-title::after {
      content: '';
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(243, 181, 63, 0.8), transparent);
    }

    .post-battle-rewards {
      width: min(1120px, 100%);
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
      gap: 16px;
      align-items: stretch;
    }

    .post-battle-reward-card {
      position: relative;
      min-height: 350px;
      padding: 18px 14px 16px;
      border: 1px solid rgba(218, 160, 58, 0.58);
      background:
        linear-gradient(180deg, rgba(3, 16, 29, 0.88), rgba(5, 8, 18, 0.92)),
        radial-gradient(circle at 50% 38%, rgba(32, 163, 244, 0.16), transparent 52%);
      color: var(--color-text-primary);
      box-shadow: inset 0 0 32px rgba(10, 109, 172, 0.16), 0 18px 26px rgba(0, 0, 0, 0.28);
      display: grid;
      grid-template-rows: auto auto 1fr auto auto;
      gap: 10px;
      cursor: pointer;
      text-align: center;
      font-family: var(--font-family);
      transition: transform 140ms ease, border-color 140ms ease, box-shadow 140ms ease;
    }

    .post-battle-reward-card:hover,
    .post-battle-reward-card:focus-visible {
      transform: translateY(-4px);
      border-color: rgba(35, 191, 255, 0.95);
      box-shadow: inset 0 0 42px rgba(13, 142, 217, 0.3), 0 18px 30px rgba(0, 0, 0, 0.38);
      outline: none;
    }

    .post-battle-reward-card.is-selected {
      border-color: #27c5ff;
      box-shadow:
        inset 0 0 52px rgba(23, 174, 255, 0.34),
        0 0 26px rgba(23, 174, 255, 0.34),
        0 18px 30px rgba(0, 0, 0, 0.42);
    }

    .post-battle-reward-card.is-recommended {
      background:
        linear-gradient(180deg, rgba(4, 22, 37, 0.92), rgba(4, 8, 18, 0.94)),
        radial-gradient(circle at 50% 38%, rgba(35, 191, 255, 0.24), transparent 52%);
    }

    .post-battle-reward-card:disabled {
      cursor: default;
      opacity: 0.82;
    }

    .post-battle-reward-badge {
      min-height: 26px;
      color: #07111d;
      background: linear-gradient(180deg, #f4ce70, #b87420);
      justify-self: center;
      padding: 5px 10px;
      font-size: 10px;
      letter-spacing: 1px;
      font-weight: 900;
      text-transform: uppercase;
      box-shadow: 0 0 14px rgba(241, 183, 78, 0.36);
    }

    .post-battle-reward-icon {
      width: 86px;
      aspect-ratio: 1;
      justify-self: center;
      border: 1px solid rgba(35, 191, 255, 0.58);
      background:
        radial-gradient(circle at 50% 38%, rgba(35, 191, 255, 0.3), transparent 56%),
        linear-gradient(145deg, rgba(4, 18, 32, 0.94), rgba(9, 12, 24, 0.92));
      box-shadow: inset 0 0 28px rgba(35, 191, 255, 0.18), 0 0 16px rgba(35, 191, 255, 0.16);
      display: grid;
      place-items: center;
      color: var(--color-gold-primary);
      font-family: var(--font-display);
      font-size: 38px;
      line-height: 1;
    }

    .post-battle-reward-card.resource-gold .post-battle-reward-icon,
    .post-battle-reward-card.resource-faith .post-battle-reward-icon {
      border-color: rgba(243, 181, 63, 0.72);
      box-shadow: inset 0 0 28px rgba(243, 181, 63, 0.2), 0 0 16px rgba(243, 181, 63, 0.16);
    }

    .post-battle-reward-name {
      color: #f4e7c6;
      font-family: var(--font-display);
      font-size: 22px;
      line-height: 1.05;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .post-battle-reward-value {
      color: #27c5ff;
      font-family: var(--font-display);
      font-size: clamp(34px, 4.5vw, 54px);
      line-height: 0.98;
      text-shadow: 0 0 18px rgba(39, 197, 255, 0.55);
    }

    .post-battle-reward-card.resource-gold .post-battle-reward-value,
    .post-battle-reward-card.resource-faith .post-battle-reward-value {
      color: var(--color-gold-primary);
      text-shadow: 0 0 18px rgba(243, 181, 63, 0.46);
    }

    .post-battle-reward-desc {
      align-self: end;
      color: rgba(232, 224, 204, 0.78);
      font-size: 13px;
      line-height: 1.42;
    }

    .post-battle-rarity {
      color: #27c5ff;
      font-family: var(--font-display);
      letter-spacing: 1.5px;
      text-transform: uppercase;
      font-size: 13px;
    }

    .post-battle-cta {
      width: min(520px, 100%);
      min-height: 58px;
      border: 1px solid rgba(243, 181, 63, 0.9);
      background: linear-gradient(180deg, rgba(11, 52, 84, 0.96), rgba(6, 20, 38, 0.96));
      color: var(--color-gold-primary);
      font-family: var(--font-display);
      font-size: clamp(18px, 2.5vw, 28px);
      letter-spacing: 5px;
      text-transform: uppercase;
      box-shadow: inset 0 0 24px rgba(35, 191, 255, 0.25), 0 0 22px rgba(243, 181, 63, 0.24);
      cursor: pointer;
      transition: transform 140ms ease, box-shadow 140ms ease;
    }

    .post-battle-cta:hover,
    .post-battle-cta:focus-visible {
      transform: translateY(-2px);
      box-shadow: inset 0 0 30px rgba(35, 191, 255, 0.32), 0 0 28px rgba(243, 181, 63, 0.34);
      outline: none;
    }

    .post-battle-cta:disabled {
      opacity: 0.55;
      cursor: default;
      transform: none;
    }

    @media (max-width: 780px) {
      .post-battle-shell {
        margin: 0;
        min-height: 100vh;
        border-left: 0;
        border-right: 0;
        padding: 18px 12px 24px;
      }

      .post-battle-summary-grid {
        grid-template-columns: 1fr;
        gap: 14px;
      }

      .post-battle-panel {
        min-height: 0;
        padding: 18px 16px;
      }

      .post-battle-enemy-row,
      .post-battle-casualty-top {
        grid-template-columns: 74px 1fr;
      }

      .post-battle-casualty-top {
        grid-template-columns: 1fr 74px;
      }

      .post-battle-enemy-emblem,
      .post-battle-casualty-emblem {
        width: 74px;
        font-size: 28px;
      }

      .post-battle-rewards {
        grid-template-columns: repeat(auto-fit, minmax(148px, 1fr));
        gap: 10px;
      }

      .post-battle-reward-card {
        min-height: 292px;
      }

      .post-battle-reward-title {
        letter-spacing: 3px;
        gap: 10px;
      }
    }
  `;
  document.head.appendChild(el);
}

interface ResourceReward {
  kind: 'resource';
  label: string;
  title: string;
  description: string;
  resource: ResourceType | null;
  victory: number;
  defeat: number;
}

interface DecretumReward {
  kind: 'decretum';
  label: string;
  title: string;
  description: string;
  tooltip: string;
  decretumIndex: number;
}

type Reward = ResourceReward | DecretumReward;

const STATIC_REWARDS: ResourceReward[] = [
  { kind: 'resource', label: 'Bonus Momentum', title: 'Momentum', description: 'Press the advantage.', resource: 'momentum', victory: 2, defeat: 1 },
  { kind: 'resource', label: 'Bonus Gold', title: 'Gold', description: 'Plunder the battlefield.', resource: 'gold', victory: 3, defeat: 1 },
  { kind: 'resource', label: 'Heal Army', title: 'Heal Army', description: 'Your soldiers recover.', resource: null, victory: 0, defeat: 0 },
  { kind: 'resource', label: 'Bonus Faith', title: 'Faith', description: 'The gods favor you.', resource: 'faith', victory: 1, defeat: 1 },
];

const BANNER: Record<BattleResult, { text: string; color: string; image?: string }> = {
  victory: { text: 'VICTORY', color: 'var(--color-gold-primary)', image: '/asset/ui/victory_banner.png' },
  defeat: { text: 'DEFEAT', color: 'var(--color-danger)', image: '/asset/ui/defeat_label.png' },
  draw: { text: 'DRAW', color: '#9ba0ad' },
};

const selectedRewardIndex = signal<number | null>(null);
const claimedReward = signal(false);
const bannerImageFailed = signal(false);

function getThreatCopy(threat: number): { label: string; color: string } {
  if (threat <= 2) return { label: 'Low', color: '#87df72' };
  if (threat <= 5) return { label: 'Moderate', color: 'var(--color-gold-primary)' };
  return { label: 'High', color: '#e66654' };
}

function getRewardAmount(reward: ResourceReward, isVictory: boolean): number {
  return isVictory ? reward.victory : reward.defeat;
}

function getRewardValue(reward: Reward, isVictory: boolean): string {
  if (reward.kind === 'decretum') return 'Scroll';
  if (reward.resource === null) return `${Math.round(POST_BATTLE_HEAL_REWARD_RATIO * 100)}%`;
  return `+${getRewardAmount(reward, isVictory)}`;
}

function getRewardIcon(reward: Reward): string {
  if (reward.kind === 'decretum') return 'IV';
  if (reward.resource === null) return '+';
  return RESOURCE_INFO[reward.resource].icon;
}

function getRewardRarity(reward: Reward): string {
  if (reward.kind === 'decretum') {
    return STARTER_DECRETUM[reward.decretumIndex]?.rarity ?? 'Rare';
  }
  if (reward.resource === null) return 'Recovery';
  return 'Common';
}

function getRecommendedRewardIndex(rewards: Reward[], damagedCount: number): number {
  if (damagedCount > 0) {
    const healIndex = rewards.findIndex((reward) => reward.kind === 'resource' && reward.resource === null);
    if (healIndex >= 0) return healIndex;
  }

  const goldIndex = rewards.findIndex((reward) => reward.kind === 'resource' && reward.resource === 'gold');
  if (goldIndex >= 0) return goldIndex;

  return 0;
}

function getRewardClass(reward: Reward): string {
  if (reward.kind === 'decretum') return 'resource-scroll';
  return reward.resource === null ? 'resource-heal' : `resource-${reward.resource}`;
}

export function PostBattleScreen() {
  useEffect(() => {
    selectedRewardIndex.value = null;
    claimedReward.value = false;
    bannerImageFailed.value = false;
  }, []);

  const result = lastBattleResult.value ?? 'defeat';
  const commander = selectedCommander.value;
  const commanderColor = commander ? FACTION_COLORS[commander.faction] : 'var(--color-gold-primary)';
  const banner = BANNER[result];
  const isVictory = result === 'victory';
  const spokeArmy = currentSpoke.value?.boundArmy;
  const damagedCohorts = spokeArmy?.cohorts.filter((cohort) => {
    const maxHp = cohort.stats.hp;
    const isOut = cohort.outOfAction === true;
    const currentHp = cohort.currentHp ?? (isOut ? 1 : maxHp);
    return currentHp < maxHp || isOut;
  }) ?? [];

  const dynamicRewards = useMemo<Reward[]>(() => {
    if (!isVictory || !commander) return [];

    const faction = commander.faction;
    const castableDecretum = STARTER_DECRETUM
      .map((d, i) => ({ d, i }))
      .filter(({ d }) => isDecretumCastable(d, faction));
    const pickedDecretumEntry = castableDecretum.length > 0
      ? castableDecretum[Math.floor(Math.random() * castableDecretum.length)]
      : null;

    if (pickedDecretumEntry === null) return [];

    return [{
      kind: 'decretum',
      label: 'New Scroll',
      title: 'New Scroll',
      description: pickedDecretumEntry.d.name,
      tooltip: pickedDecretumEntry.d.description,
      decretumIndex: pickedDecretumEntry.i,
    }];
  // Victory/commander are intentionally excluded so the random scroll is stable after mount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allRewards: Reward[] = [...STATIC_REWARDS, ...dynamicRewards];
  const recommendedIndex = getRecommendedRewardIndex(allRewards, damagedCohorts.length);
  const activeIndex = selectedRewardIndex.value !== null && selectedRewardIndex.value < allRewards.length
    ? selectedRewardIndex.value
    : recommendedIndex;
  const selectedReward = allRewards[activeIndex];
  const cap = isVictory ? lastVictoryCapSummary.value : null;
  const totalAbsorbed = cap?.totalAbsorbedHp ?? 0;

  function claimSelectedReward() {
    if (claimedReward.value || !selectedReward) return;
    claimedReward.value = true;

    if (selectedReward.kind === 'resource') {
      if (selectedReward.resource) {
        grantSpokeResource(selectedReward.resource, getRewardAmount(selectedReward, isVictory), commander?.faction);
      } else {
        applyPostBattleHealReward();
      }
    } else {
      const decretum = STARTER_DECRETUM[selectedReward.decretumIndex];
      addDecretum({ ...decretum, id: decretum.id + '_' + Date.now() });
    }

    advanceNode();
    lastBattleResult.value = null;
    lastEnemyArmy.value = null;
    navigateTo('node-map');
  }

  const enemy = lastEnemyArmy.value;
  const enemyGroups = new Map<string, { name: string; count: number }>();
  if (enemy) {
    for (const cohort of enemy.cohorts) {
      const group = enemyGroups.get(cohort.id);
      if (group) group.count++;
      else enemyGroups.set(cohort.id, { name: cohort.name, count: 1 });
    }
  }

  const threat = getThreatCopy(threatLevel.value);
  const casualtiesTitle = damagedCohorts.length === 0
    ? isVictory ? 'A Flawless Victory.' : 'No Cohorts Broken.'
    : isVictory ? 'Victory With Wounds.' : 'The Line Broke.';
  const casualtiesBody = damagedCohorts.length === 0
    ? isVictory
      ? totalAbsorbed > 0
        ? 'Field recovery absorbed every wound before your cohorts returned to camp.'
        : 'Not a single cohort broke formation.'
      : 'Your army can still regroup before the next march.'
    : `${damagedCohorts.length} cohort${damagedCohorts.length === 1 ? '' : 's'} require attention before the next battle.`;

  return (
    <div class="post-battle-cinematic">
      <main class="post-battle-shell">
        <header class="post-battle-header">
          {banner.image && !bannerImageFailed.value ? (
            <img
              class="post-battle-banner"
              src={banner.image}
              alt={banner.text}
              onError={(event) => {
                event.currentTarget.style.display = 'none';
                bannerImageFailed.value = true;
              }}
            />
          ) : (
            <div class="post-battle-fallback-title" style={{ color: banner.color }}>
              {banner.text}
            </div>
          )}
          <div class="post-battle-subtitle">Spoils of War</div>
        </header>

        <section class="post-battle-summary-grid">
          <article class="post-battle-panel">
            <div class="post-battle-panel-label">Enemy Force</div>
            <div class="post-battle-enemy-row">
              <div class="post-battle-enemy-emblem">X</div>
              <div>
                <div class="post-battle-enemy-name">{enemy?.name ?? 'Unknown Enemy'}</div>
                <div class="post-battle-muted" style={{ marginBottom: 12 }}>
                  Threat Level: <span class="post-battle-threat" style={{ color: threat.color }}>{threat.label}</span>
                </div>
                <div class="post-battle-muted">
                  {Array.from(enemyGroups.values()).length > 0
                    ? Array.from(enemyGroups.values()).map((group) => `${group.count} ${group.name}${group.count > 1 ? 's' : ''}`).join(' | ')
                    : 'No surviving enemy records.'}
                </div>
              </div>
            </div>
          </article>

          <article class="post-battle-panel">
            <div class="post-battle-panel-label">Casualties</div>
            <div class="post-battle-casualty-top">
              <div>
                <div class="post-battle-casualty-title">{casualtiesTitle}</div>
                <div class="post-battle-muted">{casualtiesBody}</div>
              </div>
              <div class="post-battle-casualty-emblem" style={{ color: commanderColor }}>VEX</div>
            </div>

            <div class="post-battle-recovery">
              <span>Field Recovery</span>
              <span>{totalAbsorbed} HP Absorbed</span>
            </div>

            {damagedCohorts.length > 0 && (
              <div class="post-battle-casualty-list">
                {damagedCohorts.map((cohort) => {
                  const maxHp = cohort.stats.hp;
                  const currentHp = cohort.currentHp ?? (cohort.outOfAction ? 1 : maxHp);
                  return (
                    <div class="post-battle-casualty-line" key={`cas-${cohort.instanceId ?? cohort.id}`}>
                      <span>{cohort.name}{cohort.outOfAction ? ' - Out of Action' : ''}</span>
                      <span>{currentHp} / {maxHp} HP</span>
                    </div>
                  );
                })}
              </div>
            )}
          </article>
        </section>

        <div class="post-battle-reward-title"><span>Choose Your Spoil</span></div>

        <section class="post-battle-rewards" aria-label="Battle rewards">
          {allRewards.map((reward, index) => {
            const isSelected = activeIndex === index;
            const isRecommended = recommendedIndex === index;
            const rewardClass = getRewardClass(reward);
            return (
              <button
                key={`${reward.label}-${index}`}
                type="button"
                class={`post-battle-reward-card ${rewardClass}${isSelected ? ' is-selected' : ''}${isRecommended ? ' is-recommended' : ''}`}
                title={reward.kind === 'decretum' ? reward.tooltip : undefined}
                onClick={() => {
                  if (!claimedReward.value) selectedRewardIndex.value = index;
                }}
                disabled={claimedReward.value}
              >
                <div class="post-battle-reward-badge">
                  {isRecommended ? 'Recommended' : reward.kind === 'decretum' ? 'New' : reward.label.replace('Bonus ', '')}
                </div>
                <div class="post-battle-reward-icon">{getRewardIcon(reward)}</div>
                <div class="post-battle-reward-name">{reward.title}</div>
                <div class="post-battle-reward-value">{getRewardValue(reward, isVictory)}</div>
                <div class="post-battle-reward-desc">
                  {reward.description}
                  {reward.kind === 'resource' && reward.resource === null
                    ? ` ${Math.round(POST_BATTLE_HEAL_REWARD_RATIO * 100)}% max HP to each damaged cohort.`
                    : ''}
                </div>
                <div class="post-battle-rarity">{getRewardRarity(reward)}</div>
              </button>
            );
          })}
        </section>

        <button
          type="button"
          class="post-battle-cta"
          onClick={claimSelectedReward}
          disabled={claimedReward.value || !selectedReward}
        >
          Claim Your Glory
        </button>
      </main>
    </div>
  );
}
