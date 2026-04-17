import { selectedCommander } from '../game/core/game-state';
import { canAfford, spendResource, addResource } from '../game/core/resources';
import { RESOURCE_INFO, FACTION_COLORS } from '../game/core/commander';
import type { Commander, CommanderAbility } from '../game/core/commander';
import type { BattleState } from './battle-state';
import { isInDeploymentZone } from './battle-zones';
import { getHandWithCastability, castDecretum } from '../game/items/decretum-store';
import { getDecretumTargeting, DECRETUM_SELL_PRICE } from '../game/items/decretum';
import type { DecretumEffect } from '../game/items/decretum';
import type { ResourceType } from '../game/core/commander';
import { pendingEnemyConversions, nextInvestmentDiscount } from '../game/progression/strategic-store';
import { abilityRegistry, type AbilityEffect } from './effects';

/** Abilities that fire immediately (no targeting needed). */
const IMMEDIATE_ABILITIES = new Set(['Fury Charge']);

/** Abilities that target an empty hex (not a unit). */
const EMPTY_HEX_ABILITIES = new Set(['Buy Reinforcements']);

const MAX_MERCS = 2;
const MERC_COST = [3, 6]; // cost for 1st and 2nd merc

let currentState: BattleState | null = null;
let abilityButton: HTMLButtonElement | null = null;
let mercCount = 0;

/**
 * Initialize the ability bar for the current battle.
 * Renders the commander's tactical ability button and wires up the
 * `onAbilityExecute` callback on the given BattleState.
 * Must be called once when a battle starts.
 */
export function initAbilityBar(state: BattleState): void {
  currentState = state;
  const bar = document.getElementById('ability-bar');
  if (!bar) return;
  bar.innerHTML = '';

  const commander = selectedCommander.value;
  if (!commander) return;

  const ability = commander.tacticalAbility;
  const btn = document.createElement('button');
  btn.className = 'ability-btn';
  btn.dataset.abilityId = ability.name;
  btn.innerHTML = buildAbilityHTML(ability, commander);
  btn.addEventListener('click', () => handleAbilityClick(ability));
  bar.appendChild(btn);
  abilityButton = btn;
  mercCount = 0;

  // Ability execution — routing gates (cost / cooldown / target type) stay here;
  // the actual effect is dispatched through abilityRegistry.
  state.onAbilityExecute = (abilityId: string, targetHex) => {
    const cmdr = selectedCommander.value;
    if (!cmdr) return;
    const ab = cmdr.tacticalAbility;
    if (ab.name !== abilityId) return;

    // Buy Reinforcements — targets an empty hex, variable cost, up to MAX_MERCS
    if (EMPTY_HEX_ABILITIES.has(abilityId)) {
      if (state.getUnitAt(targetHex)) return;
      if (abilityId === 'Buy Reinforcements') {
        if (mercCount >= MAX_MERCS) return;
        const { cols, rows, vertical } = state.config;
        if (!isInDeploymentZone(targetHex, cols, rows, 'blue', !!vertical)) return;
        const cost = MERC_COST[mercCount] ?? MERC_COST[MERC_COST.length - 1];
        if (!spendResource('gold', cost)) return;
        abilityRegistry.apply(
          { type: 'Buy Reinforcements', mercIndex: mercCount },
          { engine: state, targetHex },
        );
        mercCount++;
        if (mercCount >= MAX_MERCS) state.markAbilityUsed(abilityId);
      }
      return;
    }

    // Other targeted abilities require a unit
    const target = state.getUnitAt(targetHex);
    if (!target || target.isDying) return;

    // Turncoat requires an enemy target
    if (abilityId === 'Turncoat' && target.faction === 'blue') return;

    // Deduct cost + mark cooldown
    if (ab.cost && !spendResource(ab.cost.resource, ab.cost.amount)) return;
    if (ab.cooldown === 'once-per-battle') state.markAbilityUsed(abilityId);

    // Dispatch through the ability registry — handlers live in effects/ability-effects.ts
    abilityRegistry.apply(
      { type: abilityId as AbilityEffect['type'] } as AbilityEffect,
      { engine: state, targetUnit: target, targetHex },
    );
  };
}

function buildAbilityHTML(ability: CommanderAbility, _commander: Commander): string {
  const costText = ability.cost
    ? `${RESOURCE_INFO[ability.cost.resource].icon} ${ability.cost.amount} ${RESOURCE_INFO[ability.cost.resource].label}`
    : 'Free';
  const cooldownText = ability.cooldown === 'once-per-battle' ? ' (1x)' : '';
  return `
    <span class="ability-name">${ability.name}</span>
    <span class="ability-cost">${costText}${cooldownText}</span>
    <span class="ability-hint">${ability.description}</span>
  `;
}

function handleAbilityClick(ability: CommanderAbility): void {
  if (!currentState || currentState.phase !== 'fighting') return;

  // Already targeting — cancel
  if (currentState.targetingAbility === ability.name) {
    currentState.setTargeting(null);
    return;
  }

  // Check cooldown
  if (ability.cooldown === 'once-per-battle' && currentState.isAbilityOnCooldown(ability.name)) return;

  // Check cost
  if (ability.cost && !canAfford(ability.cost.resource, ability.cost.amount)) return;

  // Immediate abilities — execute directly, no targeting
  if (IMMEDIATE_ABILITIES.has(ability.name)) {
    if (ability.cost && !spendResource(ability.cost.resource, ability.cost.amount)) return;
    if (ability.cooldown === 'once-per-battle') currentState.markAbilityUsed(ability.name);
    abilityRegistry.apply(
      { type: ability.name as AbilityEffect['type'] } as AbilityEffect,
      { engine: currentState },
    );
    return;
  }

  // Enter targeting mode
  currentState.setTargeting(ability.name);
}

/**
 * Update the ability button's enabled/disabled state and targeting highlight
 * every frame. Call this from the render/update loop while a battle is active.
 */
export function updateAbilityBar(): void {
  if (!currentState || !abilityButton) return;

  const commander = selectedCommander.value;
  if (!commander) return;

  const ability = commander.tacticalAbility;
  const isTargeting = currentState.targetingAbility === ability.name;
  const onCooldown = ability.cooldown === 'once-per-battle' && currentState.isAbilityOnCooldown(ability.name);
  // Buy Reinforcements has variable cost
  const currentCost = ability.name === 'Buy Reinforcements'
    ? MERC_COST[mercCount] ?? MERC_COST[MERC_COST.length - 1]
    : ability.cost?.amount ?? 0;
  const costResource = ability.cost?.resource ?? 'gold';
  const affordable = currentCost === 0 || canAfford(costResource, currentCost);
  const maxedOut = ability.name === 'Buy Reinforcements' && mercCount >= MAX_MERCS;
  const disabled = onCooldown || maxedOut || !affordable || currentState.phase !== 'fighting';

  abilityButton.disabled = disabled;
  abilityButton.classList.toggle('targeting', isTargeting);

  // Update cost display for Buy Reinforcements to show the current dynamic cost
  if (ability.name === 'Buy Reinforcements') {
    const costSpan = abilityButton.querySelector('.ability-cost');
    if (costSpan) {
      const resourceInfo = RESOURCE_INFO[costResource];
      costSpan.textContent = maxedOut
        ? 'Max mercs hired'
        : `${resourceInfo.icon} ${currentCost} ${resourceInfo.label}`;
    }
  }
}

/**
 * Tear down the ability bar at the end of a battle.
 * Clears the DOM, nulls the button reference, and resets merc count.
 * Should be called in the battle cleanup / unmount path.
 */
export function destroyAbilityBar(): void {
  const bar = document.getElementById('ability-bar');
  if (bar) bar.innerHTML = '';
  abilityButton = null;
  currentState = null;
  mercCount = 0;
}

// ── Decretum Bar ──

let decretumState: BattleState | null = null;

/**
 * Initialize the decretum hand bar for the current battle.
 * Renders a button for each scroll in the player's hand.
 * Must be called once when a battle starts.
 */
export function initDecretumBar(state: BattleState): void {
  decretumState = state;
  renderDecretumBar();
}

/**
 * Re-render the decretum bar each frame so castability stays in sync.
 * Call alongside updateAbilityBar() from the update loop.
 */
export function updateDecretumBar(): void {
  renderDecretumBar();
}

/**
 * Tear down the decretum bar at the end of a battle.
 */
export function destroyDecretumBar(): void {
  const bar = document.getElementById('decretum-bar');
  if (bar) {
    bar.innerHTML = '';
    delete bar.dataset.renderKey; // clear cache so next battle re-renders
  }
  decretumState = null;
}

function renderDecretumBar(): void {
  const bar = document.getElementById('decretum-bar');
  if (!bar || !decretumState) return;

  const hand = getHandWithCastability();
  const state = decretumState;

  // Only re-render if the content has changed (id + castable + cast cost affordability + phase)
  const newIds = hand.map(h => {
    const costOk = !h.decretum.castCost || (Object.entries(h.decretum.castCost) as [ResourceType, number][]).every(([res, amt]) => canAfford(res, amt));
    return h.decretum.id + ':' + h.castable + ':' + costOk;
  }).join(',') + ':' + state.phase;
  if (bar.dataset.renderKey === newIds) return;
  bar.dataset.renderKey = newIds;

  bar.innerHTML = '';
  const commander = selectedCommander.value;
  const factionColor = commander ? FACTION_COLORS[commander.faction] : 'rgba(180, 160, 100, 0.5)';

  for (const { decretum: d, castable } of hand) {
    const btn = document.createElement('button');
    btn.className = 'decretum-btn';
    btn.title = d.description;

    const rarityDot = d.rarity === 'legendary' ? '✦' : d.rarity === 'rare' ? '◆' : '·';
    btn.textContent = `${rarityDot} ${d.name}`;

    const castCostOk = !d.castCost || (Object.entries(d.castCost) as [ResourceType, number][]).every(([res, amt]) => canAfford(res, amt));
    const rarityPrice = DECRETUM_SELL_PRICE[d.rarity];
    if (castable && castCostOk && state.phase === 'fighting') {
      btn.title = d.description;
      btn.style.borderColor = factionColor;
      btn.style.color = factionColor;
      btn.addEventListener('click', () => handleDecretumClick(d.id, state));
    } else {
      btn.disabled = true;
      if (!castable) {
        btn.classList.add('decretum-spoils');
        btn.title = `${d.name} — Cannot cast (sell for ${rarityPrice}g)`;
      } else if (!castCostOk) {
        const costParts = (Object.entries(d.castCost!) as [ResourceType, number][])
          .map(([res, amt]) => `${amt} ${RESOURCE_INFO[res].label}`)
          .join(', ');
        btn.title = `${d.name} — Needs ${costParts} to activate`;
      } else {
        btn.title = `${d.name} — Battle not in progress`;
      }
    }

    bar.appendChild(btn);
  }
}

/** Apply a secondary decretum effect — routes strategic effects to signals, battle effects to state. */
function applyExtraEffect(effect: DecretumEffect, state: BattleState): void {
  if (effect.type === 'convert-enemy-next-battle') {
    pendingEnemyConversions.value += effect.count;
  } else if (effect.type === 'investment-discount') {
    nextInvestmentDiscount.value = Math.max(nextInvestmentDiscount.value, effect.percent);
  } else {
    state.applyDecretumEffect(effect);
  }
}

function handleDecretumClick(decretumId: string, state: BattleState): void {
  if (state.phase !== 'fighting') return;

  // If already targeting this decretum, cancel
  if (state.targetingAbility === `decretum:${decretumId}`) {
    state.setTargeting(null);
    renderDecretumBar();
    return;
  }

  const hand = getHandWithCastability();
  const entry = hand.find(h => h.decretum.id === decretumId);
  if (!entry || !entry.castable) return;

  const d = entry.decretum;

  // Check cast cost affordability
  if (d.castCost) {
    const canAffordAll = (Object.entries(d.castCost) as [ResourceType, number][])
      .every(([res, amt]) => canAfford(res, amt));
    if (!canAffordAll) return;
  }

  const targeting = getDecretumTargeting(d.effect);

  if (targeting === 'immediate') {
    // Spend cast cost first (verified affordable above)
    if (d.castCost) {
      (Object.entries(d.castCost) as [ResourceType, number][]).forEach(([res, amt]) => spendResource(res, amt));
    }
    // castDecretum removes scroll from hand — only apply effects if scroll was successfully consumed
    if (castDecretum(d.id)) {
      // resource-gain must be applied after cast succeeds to avoid granting resources on failure
      if (d.effect.type === 'resource-gain') {
        addResource(d.effect.resource, d.effect.amount);
      }
      state.applyDecretumEffect(d.effect);
      for (const extra of d.extraEffects ?? []) {
        applyExtraEffect(extra, state);
      }
    }
    renderDecretumBar();
    return;
  }

  // Targeted effects: enter targeting mode and wire onAbilityExecute
  state.setTargeting(`decretum:${d.id}`);
  renderDecretumBar();

  // Patch onAbilityExecute to intercept decretum targeting callbacks
  const prevExecute = state.onAbilityExecute;
  state.onAbilityExecute = (abilityId: string, targetHex) => {
    if (abilityId.startsWith('decretum:')) {
      const id = abilityId.slice('decretum:'.length);
      const h = getHandWithCastability().find(e => e.decretum.id === id);
      if (h && h.castable) {
        // Verify and spend cast cost for targeted decretums
        const tCastCostOk = !h.decretum.castCost || (Object.entries(h.decretum.castCost) as [ResourceType, number][]).every(([res, amt]) => canAfford(res, amt));
        if (!tCastCostOk) { state.setTargeting(null); renderDecretumBar(); state.onAbilityExecute = prevExecute; return; }
        if (h.decretum.castCost) {
          (Object.entries(h.decretum.castCost) as [ResourceType, number][]).forEach(([res, amt]) => spendResource(res, amt));
        }
        if (castDecretum(id)) {
          state.applyDecretumEffect(h.decretum.effect, targetHex);
          for (const extra of h.decretum.extraEffects ?? []) {
            applyExtraEffect(extra, state);
          }
        }
      }
      state.setTargeting(null);
      renderDecretumBar();
      // Restore the previous handler
      state.onAbilityExecute = prevExecute;
      return;
    }
    // Fall through to commander ability handler
    if (prevExecute) prevExecute(abilityId, targetHex);
  };
}

// All ability execution now lives in `src/battle/effects/ability-effects.ts`.
// This file is pure UI: button rendering + click routing + targeting setup.
