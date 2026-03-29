import { selectedCommander } from '../game/game-state';
import { canAfford, spendResource } from '../game/resources';
import { RESOURCE_INFO } from '../game/commander';
import type { Commander, CommanderAbility } from '../game/commander';
import type { BattleState } from './battle-state';

let currentState: BattleState | null = null;
let abilityButton: HTMLButtonElement | null = null;

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

  // Placeholder ability execution — S3-04+ will implement real effects
  state.onAbilityExecute = (abilityId: string, _targetHex) => {
    const cmdr = selectedCommander.value;
    if (!cmdr) return;
    const ab = cmdr.tacticalAbility;
    if (ab.name !== abilityId) return;

    // Deduct cost
    if (ab.cost) {
      if (!spendResource(ab.cost.resource, ab.cost.amount)) return;
    }

    // Mark cooldown
    if (ab.cooldown === 'once-per-battle') {
      state.markAbilityUsed(abilityId);
    }

    // TODO S3-04+: execute actual ability effect based on abilityId and targetHex
    console.log(`[Ability] ${abilityId} activated`);
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
  const affordable = !ability.cost || canAfford(ability.cost.resource, ability.cost.amount);
  const disabled = onCooldown || !affordable || currentState.phase !== 'fighting';

  abilityButton.disabled = disabled;
  abilityButton.classList.toggle('targeting', isTargeting);
}

export function destroyAbilityBar(): void {
  const bar = document.getElementById('ability-bar');
  if (bar) bar.innerHTML = '';
  abilityButton = null;
  currentState = null;
}
