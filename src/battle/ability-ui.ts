import { selectedCommander } from '../game/game-state';
import { canAfford, spendResource } from '../game/resources';
import { RESOURCE_INFO } from '../game/commander';
import type { Commander, CommanderAbility } from '../game/commander';
import type { BattleState } from './battle-state';
import { SHAKE_DURATION, FLASH_DURATION, ROLE_STATS } from './battle-config';
import { hexToCol } from './battle-zones';

/** Abilities that fire immediately (no targeting needed). */
const IMMEDIATE_ABILITIES = new Set(['Fury Charge']);

/** Abilities that target an empty hex (not a unit). */
const EMPTY_HEX_ABILITIES = new Set(['Buy Reinforcements']);

const MAX_MERCS = 2;
const MERC_COST = [3, 6]; // cost for 1st and 2nd merc
const BLUE_BACK_COL_MAX = 4; // columns 0-3 are blue's back rows

let currentState: BattleState | null = null;
let abilityButton: HTMLButtonElement | null = null;
let mercCount = 0;

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

  // Ability execution — dispatch by ability name
  state.onAbilityExecute = (abilityId: string, targetHex) => {
    const cmdr = selectedCommander.value;
    if (!cmdr) return;
    const ab = cmdr.tacticalAbility;
    if (ab.name !== abilityId) return;

    // Buy Reinforcements targets an empty hex
    if (EMPTY_HEX_ABILITIES.has(abilityId)) {
      if (state.getUnitAt(targetHex)) return; // must be empty
      if (abilityId === 'Buy Reinforcements') {
        if (mercCount >= MAX_MERCS) return;
        const col = hexToCol(targetHex);
        if (col >= BLUE_BACK_COL_MAX) return; // must be back rows
        const cost = MERC_COST[mercCount] ?? MERC_COST[MERC_COST.length - 1];
        if (!spendResource('gold', cost)) return;
        executeBuyReinforcements(state, targetHex);
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

    // Deduct cost
    if (ab.cost) {
      if (!spendResource(ab.cost.resource, ab.cost.amount)) return;
    }

    // Mark cooldown
    if (ab.cooldown === 'once-per-battle') {
      state.markAbilityUsed(abilityId);
    }

    // Execute ability effect
    switch (abilityId) {
      case 'Miracle':
        executeMiracle(state, target);
        break;
      case 'Turncoat':
        executeTurncoat(state, target);
        break;
      default:
        break;
    }
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
    executeImmediate(currentState, ability.name);
    return;
  }

  // Enter targeting mode
  currentState.setTargeting(ability.name);
}

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
}

export function destroyAbilityBar(): void {
  const bar = document.getElementById('ability-bar');
  if (bar) bar.innerHTML = '';
  abilityButton = null;
  currentState = null;
  mercCount = 0;
}

// ── Miracle (Pope Innocent) ──

function executeMiracle(state: BattleState, target: { id: number; faction: string; hex: { q: number; r: number }; currentHp: number; stats: { hp: number }; isDying: boolean; shakeTimer: number; flashTimer: number }): void {
  if (target.faction === 'blue') {
    // Heal friendly unit to full HP
    target.currentHp = target.stats.hp;
    target.flashTimer = FLASH_DURATION;
    state.floatingTexts.push({
      text: 'HEALED!', hex: { q: target.hex.q, r: target.hex.r },
      color: '#ffd700', timer: 0.8, duration: 0.8,
    });
  } else {
    // Smite enemy unit — deal 2000 damage
    const damage = 2000;
    target.currentHp -= damage;
    target.shakeTimer = SHAKE_DURATION;
    target.flashTimer = FLASH_DURATION;
    state.floatingTexts.push({
      text: 'SMITE!', hex: { q: target.hex.q, r: target.hex.r },
      color: '#ffd700', timer: 0.8, duration: 0.8,
    });
    // Death check
    if (target.currentHp <= 0) {
      target.currentHp = 0;
      target.isDying = true;
    }
  }
}

// ── Immediate ability dispatch ──

function executeImmediate(state: BattleState, abilityId: string): void {
  switch (abilityId) {
    case 'Fury Charge':
      executeFuryCharge(state);
      break;
  }
}

// ── Fury Charge (Boudicca) ──

function executeFuryCharge(state: BattleState): void {
  const blueUnits = state.getFactionUnits('blue');
  const dir = 1; // blue advances right (+q)

  for (const unit of blueUnits) {
    if (unit.isDying) continue;

    // Try to advance 2 hexes forward
    let currentHex = unit.hex;
    let moved = 0;
    for (let step = 0; step < 2; step++) {
      const nextHex = { q: currentHex.q + dir, r: currentHex.r };
      if (!state.isValidHex(nextHex)) break;

      const occupant = state.getUnitAt(nextHex);
      if (occupant && !occupant.isDying) {
        if (occupant.faction !== 'blue') {
          // Impact damage on collision with enemy
          const impactDamage = 1000;
          occupant.currentHp -= impactDamage;
          occupant.shakeTimer = SHAKE_DURATION;
          occupant.flashTimer = FLASH_DURATION;
          state.floatingTexts.push({
            text: 'CHARGE!', hex: { q: occupant.hex.q, r: occupant.hex.r },
            color: '#ff4444', timer: 0.8, duration: 0.8,
          });
          if (occupant.currentHp <= 0) {
            occupant.currentHp = 0;
            occupant.isDying = true;
          }
        }
        break; // blocked by unit (friendly or enemy after impact)
      }

      currentHex = nextHex;
      moved++;
    }

    // Move unit to furthest reached hex
    if (moved > 0) {
      state.moveUnitAlongPath(unit.id, currentHex);
    }
  }

  // Floating text for the charge itself
  state.floatingTexts.push({
    text: 'FURY CHARGE!', hex: { q: 10, r: 7 },
    color: '#ff4444', timer: 1.0, duration: 1.0,
  });
}

// ── Buy Reinforcements (Crassus) ──

function executeBuyReinforcements(state: BattleState, hex: { q: number; r: number }): void {
  const stats = { ...ROLE_STATS.vanguard };
  const unit = state.addUnit('blue', hex, `Mercenary ${mercCount + 1}`, 'vanguard', stats);
  // 70% HP — expendable hired troops
  unit.currentHp = Math.floor(unit.stats.hp * 0.7);
  unit.flashTimer = FLASH_DURATION;
  state.floatingTexts.push({
    text: 'HIRED!', hex: { q: hex.q, r: hex.r },
    color: '#d4a843', timer: 0.8, duration: 0.8,
  });
}

// ── Turncoat (Augustus) ──

function executeTurncoat(state: BattleState, target: { id: number; faction: string; hex: { q: number; r: number }; currentHp: number; stats: { hp: number }; flashTimer: number; pinnedBy: number | null }): void {
  // Switch faction to player side
  (target as { faction: string }).faction = 'blue';

  // Set HP to 50% of max (demoralized)
  target.currentHp = Math.floor(target.stats.hp * 0.5);

  // Clear pin — converted unit is no longer engaged
  target.pinnedBy = null;

  // Visual feedback
  target.flashTimer = FLASH_DURATION;
  state.floatingTexts.push({
    text: 'TURNCOAT!', hex: { q: target.hex.q, r: target.hex.r },
    color: '#4a7cc2', timer: 1.0, duration: 1.0,
  });
}
