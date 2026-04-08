import type { GameState } from '../game/core/state';
import type { ProvinceRegistry } from '../game/province/provinces';

export class Overlay {
  private tooltip: HTMLElement;
  private nameEl: HTMLElement;
  private ownerEl: HTMLElement;
  private terrainEl: HTMLElement;
  private gameState: GameState;
  private registry: ProvinceRegistry;

  constructor(gameState: GameState, registry: ProvinceRegistry) {
    this.gameState = gameState;
    this.registry = registry;
    this.tooltip = document.getElementById('tooltip')!;
    this.nameEl = this.tooltip.querySelector('.province-name')!;
    this.ownerEl = this.tooltip.querySelector('.province-owner')!;
    this.terrainEl = this.tooltip.querySelector('.province-terrain')!;
  }

  update(mouseX: number, mouseY: number): void {
    const key = this.gameState.hoveredProvinceKey;

    if (!key) {
      this.tooltip.style.display = 'none';
      return;
    }

    const province = this.registry.getProvinceByKey(key);
    if (!province) {
      this.tooltip.style.display = 'none';
      return;
    }

    const nation = this.gameState.getNation(province.owner);

    this.nameEl.textContent = province.name;
    this.ownerEl.textContent = nation ? `Owner: ${nation.name}` : 'Unowned';
    this.terrainEl.textContent = province.terrain;

    this.tooltip.style.display = 'block';
    this.tooltip.style.left = `${mouseX + 15}px`;
    this.tooltip.style.top = `${mouseY + 15}px`;
  }
}
