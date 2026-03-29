import type { BattleState } from './battle-state';
import type { BattleRenderer } from './battle-renderer';
import type { LieutenantOrder } from './battle-types';
import { pixelToHex, hexEqual } from './hex';

export class BattleInput {
  private canvas: HTMLCanvasElement;
  private state: BattleState;
  private renderer: BattleRenderer;
  private onExit: () => void;

  private boundClick: (e: MouseEvent) => void;
  private boundContextmenu: (e: MouseEvent) => void;
  private boundKeydown: (e: KeyboardEvent) => void;
  private boundMousemove: (e: MouseEvent) => void;
  private isAttached = false;

  constructor(canvas: HTMLCanvasElement, state: BattleState, renderer: BattleRenderer, onExit: () => void) {
    this.canvas = canvas;
    this.state = state;
    this.renderer = renderer;
    this.onExit = onExit;

    this.boundClick = this.onClick.bind(this);
    this.boundContextmenu = this.onContextmenu.bind(this);
    this.boundKeydown = this.onKeydown.bind(this);
    this.boundMousemove = this.onMousemove.bind(this);
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
    this.isAttached = true;
  }

  detach(): void {
    if (!this.isAttached) return;
    this.canvas.removeEventListener('click', this.boundClick);
    this.canvas.removeEventListener('contextmenu', this.boundContextmenu);
    this.canvas.removeEventListener('mousemove', this.boundMousemove);
    window.removeEventListener('keydown', this.boundKeydown);
    this.renderer.setHoveredHex(null);
    this.isAttached = false;
  }

  /** Left-click: select / deselect units. */
  private onClick(e: MouseEvent): void {
    if (this.state.phase === 'victory') {
      this.onExit();
      return;
    }
    const origin = this.state.getGridOrigin(this.canvas.clientWidth, this.canvas.clientHeight);
    const clicked = pixelToHex(e.offsetX, e.offsetY, this.state.config.hexSize, origin);

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
    const clicked = pixelToHex(e.clientX, e.clientY, this.state.config.hexSize, origin);

    if (!this.state.isValidHex(clicked)) return;

    const range = this.state.getMovementRange(selected.hex);
    if (range.some(h => hexEqual(h, clicked))) {
      this.state.moveUnitAlongPath(selected.id, clicked);
    }
  }

  private onMousemove(e: MouseEvent): void {
    const origin = this.state.getGridOrigin(this.canvas.clientWidth, this.canvas.clientHeight);
    const hex = pixelToHex(e.offsetX, e.offsetY, this.state.config.hexSize, origin);
    this.renderer.setHoveredHex(this.state.isValidHex(hex) ? hex : null);
  }

  private onKeydown(e: KeyboardEvent): void {
    if (this.state.phase === 'fighting') {
      const orderKeys: Record<string, LieutenantOrder> = {
        '1': 'attack', '2': 'defend', '3': 'skirmish', '4': 'mobile',
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
