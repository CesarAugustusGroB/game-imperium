import type { BattleState } from './battle-state';
import type { BattleRenderer } from './battle-renderer';
import type { LieutenantOrder } from './battle-types';
import { pixelToHex, hexEqual } from './hex';

const PAN_SPEED = 400; // pixels per second

export class BattleInput {
  private canvas: HTMLCanvasElement;
  private state: BattleState;
  private renderer: BattleRenderer;
  private onExit: () => void;

  private boundClick: (e: MouseEvent) => void;
  private boundContextmenu: (e: MouseEvent) => void;
  private boundKeydown: (e: KeyboardEvent) => void;
  private boundKeyup: (e: KeyboardEvent) => void;
  private boundMousemove: (e: MouseEvent) => void;
  private isAttached = false;

  /** Currently held WASD keys. */
  private keysDown = new Set<string>();

  constructor(canvas: HTMLCanvasElement, state: BattleState, renderer: BattleRenderer, onExit: () => void) {
    this.canvas = canvas;
    this.state = state;
    this.renderer = renderer;
    this.onExit = onExit;

    this.boundClick = this.onClick.bind(this);
    this.boundContextmenu = this.onContextmenu.bind(this);
    this.boundKeydown = this.onKeydown.bind(this);
    this.boundKeyup = this.onKeyup.bind(this);
    this.boundMousemove = this.onMousemove.bind(this);
  }

  /** Call each frame to update camera pan from held WASD keys. */
  updateCamera(dt: number): void {
    let dx = 0, dy = 0;
    if (this.keysDown.has('a') || this.keysDown.has('arrowleft'))  dx += 1;
    if (this.keysDown.has('d') || this.keysDown.has('arrowright')) dx -= 1;
    if (this.keysDown.has('w') || this.keysDown.has('arrowup'))    dy += 1;
    if (this.keysDown.has('s') || this.keysDown.has('arrowdown'))  dy -= 1;
    if (dx !== 0 || dy !== 0) {
      this.renderer.cameraX += dx * PAN_SPEED * dt;
      this.renderer.cameraY += dy * PAN_SPEED * dt;
    }
  }

  setState(state: BattleState): void {
    this.state = state;
  }

  attach(): void {
    if (this.isAttached) return;
    this.canvas.addEventListener('click', this.boundClick);
    this.canvas.addEventListener('contextmenu', this.boundContextmenu);
    this.canvas.addEventListener('mousemove', this.boundMousemove);
    window.addEventListener('keydown', this.boundKeydown);
    window.addEventListener('keyup', this.boundKeyup);
    this.isAttached = true;
  }

  detach(): void {
    if (!this.isAttached) return;
    this.canvas.removeEventListener('click', this.boundClick);
    this.canvas.removeEventListener('contextmenu', this.boundContextmenu);
    this.canvas.removeEventListener('mousemove', this.boundMousemove);
    window.removeEventListener('keydown', this.boundKeydown);
    window.removeEventListener('keyup', this.boundKeyup);
    this.keysDown.clear();
    this.renderer.setHoveredHex(null);
    this.isAttached = false;
  }

  /** Left-click: select / deselect units. */
  private onClick(e: MouseEvent): void {
    if (this.state.phase === 'victory') {
      this.onExit();
      return;
    }
    // Targeting mode — redirect click to ability execution
    if (this.state.targetingAbility !== null) {
      const origin = this.state.getGridOrigin(this.canvas.clientWidth, this.canvas.clientHeight);
      const clicked = pixelToHex(e.offsetX - this.renderer.cameraX, e.offsetY - this.renderer.cameraY, this.state.config.hexSize, origin, !!this.state.config.vertical);
      if (this.state.isValidHex(clicked) && this.state.onAbilityExecute) {
        this.state.onAbilityExecute(this.state.targetingAbility, clicked);
      }
      this.state.setTargeting(null);
      return;
    }
    const origin = this.state.getGridOrigin(this.canvas.clientWidth, this.canvas.clientHeight);
    const clicked = pixelToHex(e.offsetX - this.renderer.cameraX, e.offsetY - this.renderer.cameraY, this.state.config.hexSize, origin, !!this.state.config.vertical);

    if (!this.state.isValidHex(clicked)) {
      this.state.selectUnit(null);
      return;
    }

    const unitHere = this.state.getUnitAt(clicked);
    const selected = this.state.getSelectedUnit();

    if (selected && unitHere && unitHere.id === selected.id) {
      this.state.selectUnit(null);
    } else if (unitHere) {
      this.state.selectUnit(unitHere.id);
    } else {
      this.state.selectUnit(null);
    }
  }

  /** Right-click: move selected unit along path (like strategic map). */
  private onContextmenu(e: MouseEvent): void {
    e.preventDefault();
    const selected = this.state.getSelectedUnit();
    if (!selected) return;
    if (this.state.isUnitMoving(selected)) return;

    const origin = this.state.getGridOrigin(this.canvas.clientWidth, this.canvas.clientHeight);
    const clicked = pixelToHex(e.offsetX - this.renderer.cameraX, e.offsetY - this.renderer.cameraY, this.state.config.hexSize, origin, !!this.state.config.vertical);

    if (!this.state.isValidHex(clicked)) return;

    const range = this.state.getMovementRange(selected.hex);
    if (range.some(h => hexEqual(h, clicked))) {
      this.state.moveUnitAlongPath(selected.id, clicked);
    }
  }

  private onMousemove(e: MouseEvent): void {
    const origin = this.state.getGridOrigin(this.canvas.clientWidth, this.canvas.clientHeight);
    const hex = pixelToHex(e.offsetX - this.renderer.cameraX, e.offsetY - this.renderer.cameraY, this.state.config.hexSize, origin, !!this.state.config.vertical);
    this.renderer.setHoveredHex(this.state.isValidHex(hex) ? hex : null);
  }

  private onKeyup(e: KeyboardEvent): void {
    this.keysDown.delete(e.key.toLowerCase());
  }

  private onKeydown(e: KeyboardEvent): void {
    // Track held keys for camera pan
    this.keysDown.add(e.key.toLowerCase());

    // Space toggles pause
    if (e.key === ' ') {
      e.preventDefault();
      this.state.togglePause();
      return;
    }

    // ESC cancels targeting mode before anything else
    if (e.key === 'Escape' && this.state.targetingAbility !== null) {
      this.state.setTargeting(null);
      return;
    }
    if (this.state.phase === 'fighting') {
      const orderKeys: Record<string, LieutenantOrder> = {
        '0': 'auto', '1': 'attack', '2': 'defend', '3': 'skirmish', '4': 'mobile',
      };
      const order = orderKeys[e.key];
      if (order) { this.state.setLieutenantOrder(order); return; }
    }
    if (e.key === 'Escape') {
      // During victory, ESC always exits
      if (this.state.phase === 'victory') {
        this.onExit();
        return;
      }
      if (this.state.selectedUnitId !== null) {
        this.state.selectUnit(null);
      } else {
        this.onExit();
      }
    }
  }
}
