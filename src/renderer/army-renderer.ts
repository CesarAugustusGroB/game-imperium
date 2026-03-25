import type { Camera } from '../camera/camera';
import type { ArmyManager } from '../game/army';
import type { GameState } from '../game/state';
import type { ArmyData } from '../types/index';

export class ArmyRenderer {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private camera: Camera;
  private armyManager: ArmyManager;
  private gameState: GameState;
  private shieldImage: HTMLImageElement | null = null;
  private tintedShields: Map<string, HTMLCanvasElement> = new Map();
  selectedArmyId: number | null = null;

  constructor(
    overlayCanvas: HTMLCanvasElement,
    camera: Camera,
    armyManager: ArmyManager,
    gameState: GameState,
  ) {
    this.canvas = overlayCanvas;
    const ctx = overlayCanvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get 2D context for army overlay');
    this.ctx = ctx;
    this.camera = camera;
    this.armyManager = armyManager;
    this.gameState = gameState;
    this.loadShieldImage();
  }

  private loadShieldImage(): void {
    const img = new Image();
    img.onload = () => { this.shieldImage = img; };
    img.src = '/asset/blue-soldier.png';
  }

  private getTintedShield(nationId: string, color: number[]): HTMLCanvasElement | null {
    if (this.tintedShields.has(nationId)) return this.tintedShields.get(nationId)!;
    if (!this.shieldImage) return null;

    const c = document.createElement('canvas');
    c.width = this.shieldImage.width;
    c.height = this.shieldImage.height;
    const tctx = c.getContext('2d')!;

    // Draw original shield
    tctx.drawImage(this.shieldImage, 0, 0);

    // Tint with nation color — source-atop preserves transparency
    tctx.globalCompositeOperation = 'source-atop';
    tctx.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.45)`;
    tctx.fillRect(0, 0, c.width, c.height);

    this.tintedShields.set(nationId, c);
    return c;
  }

  resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
  }

  render(): void {
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const [, army] of this.armyManager.armies) {
      const [u, v] = this.armyManager.getArmyPosition(army);
      const [sx, sy] = this.uvToScreen(u, v);

      if (sx < -50 || sx > canvas.width + 50 || sy < -50 || sy > canvas.height + 50) continue;

      this.drawArmy(army, sx, sy);
    }

    // Draw movement path for selected army
    if (this.selectedArmyId !== null) {
      const army = this.armyManager.armies.get(this.selectedArmyId);
      if (army) this.drawPath(army);
    }

    // Draw battle log
    this.drawBattleLog();
  }

  private drawArmy(army: ArmyData, sx: number, sy: number): void {
    const { ctx } = this;
    const nation = this.gameState.getNation(army.owner);
    const color = nation ? nation.color : [150, 150, 150];
    const isSelected = army.id === this.selectedArmyId;
    const isMoving = army.targetProvinceIndex !== null;

    const scale = Math.min(Math.max(this.camera.zoom * 0.5, 0.6), 2.5);
    const shieldSize = 38 * scale;

    // Get nation-tinted shield (cached per nation)
    const shield = this.getTintedShield(army.owner, color);

    ctx.save();
    ctx.translate(sx, sy);

    // Combat pulse — scale throb + red glow
    let drawScale = 1.0;
    if (army.inCombat) {
      const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 200);
      drawScale = 1.0 + 0.08 * pulse;
      ctx.shadowColor = `rgba(255, 50, 50, ${0.5 + 0.3 * pulse})`;
      ctx.shadowBlur = 10 * scale;
    } else if (isSelected) {
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur = 12 * scale;
    } else {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
      ctx.shadowBlur = 4 * scale;
      ctx.shadowOffsetY = 2 * scale;
    }

    const s = shieldSize * drawScale;
    const half = s / 2;

    // Draw shield image (or fallback circle)
    if (shield) {
      ctx.drawImage(shield, -half, -half, s, s);
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, half, 0, Math.PI * 2);
      ctx.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
      ctx.fill();
    }

    ctx.shadowColor = 'transparent';

    // Selection ring
    if (isSelected) {
      ctx.beginPath();
      ctx.arc(0, 0, half + 2 * scale, 0, Math.PI * 2);
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 2.5 * scale;
      ctx.stroke();
    }

    // Movement indicator dot
    if (isMoving && !army.inCombat) {
      ctx.fillStyle = '#ffcc00';
      ctx.beginPath();
      ctx.arc(half * 0.7, -half * 0.7, 3.5 * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Crossed swords for combat
    if (army.inCombat) {
      const swordY = -half - 6 * scale;
      const swordSize = 6 * scale;
      ctx.strokeStyle = '#ff4444';
      ctx.lineWidth = 2 * scale;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-swordSize, swordY - swordSize);
      ctx.lineTo(swordSize, swordY + swordSize);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(swordSize, swordY - swordSize);
      ctx.lineTo(-swordSize, swordY + swordSize);
      ctx.stroke();

      if (army.lastRoll > 0) {
        const rollFontSize = Math.max(9, 10 * scale);
        ctx.font = `bold ${rollFontSize}px 'Segoe UI', system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffdd44';
        ctx.fillText(`🎲${army.lastRoll}`, 0, swordY - swordSize - 4 * scale);
      }
    }

    // Army size label below shield
    const fontSize = Math.max(9, 11 * scale);
    ctx.font = `bold ${fontSize}px 'Segoe UI', system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const sizeText = army.size >= 1000 ? `${(army.size / 1000).toFixed(1)}K` : String(army.size);
    const labelY = half + 2 * scale;

    // Text background pill
    const metrics = ctx.measureText(sizeText);
    const pillW = metrics.width + 8 * scale;
    const pillH = fontSize + 4 * scale;
    ctx.beginPath();
    ctx.roundRect(-pillW / 2, labelY - 1 * scale, pillW, pillH, 3 * scale);
    ctx.fillStyle = 'rgba(10, 10, 30, 0.8)';
    ctx.fill();
    ctx.strokeStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.6)`;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Text
    ctx.fillStyle = '#f0e0c0';
    ctx.fillText(sizeText, 0, labelY);

    ctx.restore();
  }

  private drawPath(army: ArmyData): void {
    const { ctx } = this;
    const path: number[] = [];

    const [cu, cv] = this.armyManager.getArmyPosition(army);
    const [csx, csy] = this.uvToScreen(cu, cv);

    if (army.targetProvinceIndex !== null) {
      path.push(army.targetProvinceIndex);
    }
    path.push(...army.path);

    if (path.length === 0) return;

    ctx.save();
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.6)';
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(csx, csy);

    for (const provinceIdx of path) {
      const center = this.armyManager.topology.centers[String(provinceIdx)];
      if (!center) continue;
      const [sx2, sy2] = this.uvToScreen(center[0], center[1]);
      ctx.lineTo(sx2, sy2);
    }

    ctx.stroke();

    if (path.length > 0) {
      const lastIdx = path[path.length - 1];
      const lastCenter = this.armyManager.topology.centers[String(lastIdx)];
      if (lastCenter) {
        const [dx, dy] = this.uvToScreen(lastCenter[0], lastCenter[1]);
        ctx.beginPath();
        ctx.arc(dx, dy, 6, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 215, 0, 0.4)';
        ctx.fill();
        ctx.strokeStyle = '#ffd700';
        ctx.setLineDash([]);
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  private drawBattleLog(): void {
    const { ctx, canvas } = this;
    const events = this.armyManager.battleEvents;
    if (events.length === 0) return;

    // Show last 4 events, fading out
    const now = Date.now();
    const visible = events.filter(e => now - e.timestamp < 8000).slice(-4);

    ctx.save();
    const startY = canvas.height - 20;

    for (let i = visible.length - 1; i >= 0; i--) {
      const event = visible[i];
      const age = (now - event.timestamp) / 8000;
      const alpha = Math.max(0, 1 - age);
      const y = startY - (visible.length - 1 - i) * 22;

      ctx.font = 'bold 13px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'left';

      // Background bar
      ctx.fillStyle = `rgba(10, 10, 30, ${0.7 * alpha})`;
      ctx.fillRect(10, y - 14, canvas.width - 20, 20);

      // Battle text
      const text = `⚔ ${event.attackerName} (🎲${event.attackerRoll}) vs ${event.defenderName} (🎲${event.defenderRoll}+1) — Atk lost ${event.attackerDamage}, Def lost ${event.defenderDamage}`;
      ctx.fillStyle = `rgba(240, 220, 160, ${alpha})`;
      ctx.fillText(text, 16, y);
    }

    ctx.restore();
  }

  private uvToScreen(u: number, v: number): [number, number] {
    const flippedV = 1.0 - v;

    const cam = this.camera;
    const sx = cam.zoom / cam.aspect;
    const sy = cam.zoom;
    const tx = -(cam.x * 2 - 1) * sx;
    const ty = -(cam.y * 2 - 1) * sy;

    const ndcX = (u * 2 - 1) * sx + tx;
    const ndcY = (flippedV * 2 - 1) * sy + ty;

    const screenX = (ndcX + 1) * 0.5 * this.canvas.width;
    const screenY = (1 - ndcY) * 0.5 * this.canvas.height;

    return [screenX, screenY];
  }

  hitTest(screenX: number, screenY: number): number | null {
    const hitRadius = 25;
    let closestId: number | null = null;
    let closestDist = Infinity;

    for (const [, army] of this.armyManager.armies) {
      const [u, v] = this.armyManager.getArmyPosition(army);
      const [sx, sy] = this.uvToScreen(u, v);
      const dx = screenX - sx;
      const dy = screenY - sy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < hitRadius && dist < closestDist) {
        closestDist = dist;
        closestId = army.id;
      }
    }

    return closestId;
  }
}
