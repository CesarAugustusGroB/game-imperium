import type { BattleState, BattleUnit } from './battle-state';
import type { Point } from './hex';
import { hexToPixel, hexCorners } from './hex';

export class BattleRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private state: BattleState;

  private bgImage: HTMLImageElement | null = null;
  private blueShield: HTMLImageElement | null = null;
  private redShield: HTMLImageElement | null = null;

  private hoveredHex: { q: number; r: number } | null = null;

  constructor(canvas: HTMLCanvasElement, state: BattleState) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get 2D context for battle canvas');
    this.ctx = ctx;
    this.state = state;
    this.loadAssets();
  }

  setState(state: BattleState): void {
    this.state = state;
  }

  setHoveredHex(hex: { q: number; r: number } | null): void {
    this.hoveredHex = hex;
  }

  private loadAssets(): void {
    const bg = new Image();
    bg.onload = () => { this.bgImage = bg; };
    bg.src = '/textures/battleground.png';

    const blue = new Image();
    blue.onload = () => { this.blueShield = blue; };
    blue.src = '/asset/blue-soldier.png';

    const red = new Image();
    red.onload = () => { this.redShield = red; };
    red.src = '/asset/roman-soldier.png';
  }

  resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
  }

  render(): void {
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.drawBackground();
    this.drawGrid();
    this.drawHoveredHex();
    this.drawMovementRange();
    this.drawSelectedHex();
    this.drawPaths();
    this.drawUnits();
    this.drawVictoryOverlay();
  }

  // ── Layers ──

  private drawBackground(): void {
    const { ctx, canvas } = this;
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (!this.bgImage) return;

    // Cover scaling
    const imgAspect = this.bgImage.width / this.bgImage.height;
    const canAspect = canvas.width / canvas.height;
    let dw: number, dh: number, dx: number, dy: number;
    if (canAspect > imgAspect) {
      dw = canvas.width;
      dh = canvas.width / imgAspect;
      dx = 0;
      dy = (canvas.height - dh) / 2;
    } else {
      dh = canvas.height;
      dw = canvas.height * imgAspect;
      dx = (canvas.width - dw) / 2;
      dy = 0;
    }
    ctx.drawImage(this.bgImage, dx, dy, dw, dh);

    // Slight darkening for grid visibility
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  private drawGrid(): void {
    const { ctx } = this;
    const origin = this.state.getGridOrigin(this.canvas.width, this.canvas.height);
    const size = this.state.config.hexSize;

    ctx.strokeStyle = 'rgba(200, 180, 120, 0.3)';
    ctx.lineWidth = 1;

    for (const hex of this.state.gridHexes) {
      const center = hexToPixel(hex, size, origin);
      this.strokeHex(center, size);
    }
  }

  private drawHoveredHex(): void {
    if (!this.hoveredHex) return;
    if (!this.state.isValidHex(this.hoveredHex)) return;
    // Don't highlight if it's the selected unit's hex
    const selected = this.state.getSelectedUnit();
    if (selected && selected.hex.q === this.hoveredHex.q && selected.hex.r === this.hoveredHex.r) return;

    const origin = this.state.getGridOrigin(this.canvas.width, this.canvas.height);
    const center = hexToPixel(this.hoveredHex, this.state.config.hexSize, origin);
    this.fillHex(center, this.state.config.hexSize, 'rgba(255, 255, 255, 0.08)');
  }

  private drawMovementRange(): void {
    const selected = this.state.getSelectedUnit();
    if (!selected) return;

    const origin = this.state.getGridOrigin(this.canvas.width, this.canvas.height);
    const size = this.state.config.hexSize;
    const range = this.state.getMovementRange(selected.hex);

    for (const hex of range) {
      const center = hexToPixel(hex, size, origin);
      this.fillHex(center, size, 'rgba(100, 200, 255, 0.18)');
      this.strokeHexStyled(center, size, 'rgba(100, 200, 255, 0.5)', 1.5);
    }
  }

  private drawSelectedHex(): void {
    const selected = this.state.getSelectedUnit();
    if (!selected) return;

    const origin = this.state.getGridOrigin(this.canvas.width, this.canvas.height);
    const center = hexToPixel(selected.hex, this.state.config.hexSize, origin);
    this.fillHex(center, this.state.config.hexSize, 'rgba(255, 215, 0, 0.2)');
    this.strokeHexStyled(center, this.state.config.hexSize, 'rgba(255, 215, 0, 0.7)', 2);
  }

  /** Draw dashed path lines for units that have a queued path. */
  private drawPaths(): void {
    const { ctx } = this;
    const origin = this.state.getGridOrigin(this.canvas.width, this.canvas.height);
    const size = this.state.config.hexSize;

    for (const unit of this.state.units.values()) {
      if (unit.path.length === 0) continue;

      ctx.save();
      ctx.strokeStyle = unit.faction === 'blue'
        ? 'rgba(100, 180, 255, 0.5)'
        : 'rgba(255, 100, 100, 0.5)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);

      // Start from current hex
      const start = hexToPixel(unit.hex, size, origin);
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);

      for (const pathHex of unit.path) {
        const pt = hexToPixel(pathHex, size, origin);
        ctx.lineTo(pt.x, pt.y);
      }
      ctx.stroke();

      // Target circle at final destination
      const last = unit.path[unit.path.length - 1];
      const target = hexToPixel(last, size, origin);
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(target.x, target.y, 6, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
    }
  }

  private drawUnits(): void {
    const origin = this.state.getGridOrigin(this.canvas.width, this.canvas.height);
    const size = this.state.config.hexSize;

    for (const unit of this.state.units.values()) {
      const dest = hexToPixel(unit.hex, size, origin);

      // Interpolate position during movement animation
      if (unit.prevHex && unit.moveProgress < 1) {
        const src = hexToPixel(unit.prevHex, size, origin);
        // Use linear for mid-path hops (smooth continuous walk),
        // easeOut only for the final hop (gentle stop)
        const t = unit.path.length > 0
          ? unit.moveProgress                      // linear — no pause between hops
          : this.easeOutCubic(unit.moveProgress);  // decelerate into final position
        const center = {
          x: src.x + (dest.x - src.x) * t,
          y: src.y + (dest.y - src.y) * t,
        };
        this.drawUnit(unit, center);
      } else {
        this.drawUnit(unit, dest);
      }
    }
  }

  private easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
  }

  private drawUnit(unit: BattleUnit, center: Point): void {
    const { ctx } = this;
    const isSelected = unit.id === this.state.selectedUnitId;
    const shieldImg = unit.faction === 'blue' ? this.blueShield : this.redShield;
    const iconSize = 60;

    // Compute damage ratio for cracks
    const damageRatio = 1 - Math.max(0, unit.strength) / unit.startingStrength;

    ctx.save();

    // Death fade: reduce global alpha during fade phase (deathProgress 0.33→1.0)
    if (unit.isDying && unit.deathProgress > 0.33) {
      const fadeT = (unit.deathProgress - 0.33) / 0.67; // 0→1
      ctx.globalAlpha = 1 - fadeT;
    }

    // Shake offset: rapid random jitter decaying over time
    let sx = center.x, sy = center.y;
    if (unit.shakeTimer > 0) {
      const intensity = unit.shakeTimer * 10; // decays from ~3.5px to 0
      sx += (Math.random() - 0.5) * intensity;
      sy += (Math.random() - 0.5) * intensity;
    }

    ctx.translate(sx, sy);

    // Selection glow
    if (isSelected) {
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur = 14;
    } else {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetY = 2;
    }

    // Shield image or fallback circle
    if (shieldImg) {
      ctx.drawImage(shieldImg, -iconSize / 2, -iconSize / 2 - 4, iconSize, iconSize);
    } else {
      ctx.beginPath();
      ctx.arc(0, -4, iconSize / 2, 0, Math.PI * 2);
      ctx.fillStyle = unit.faction === 'blue' ? '#3366aa' : '#aa3333';
      ctx.fill();
    }

    ctx.shadowColor = 'transparent';

    // White flash overlay on hit
    if (unit.flashTimer > 0) {
      const flashAlpha = unit.flashTimer * 4; // fades from ~0.8 to 0
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(0.8, flashAlpha)})`;
      ctx.beginPath();
      ctx.arc(0, -4, iconSize / 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Damage cracks (grietas) — accumulate with damage
    const crackRatio = unit.isDying
      ? Math.min(1, unit.deathProgress / 0.33) // spread to full during death phase 1
      : damageRatio;
    if (crackRatio > 0.05) {
      this.drawCracks(unit.crackSeed, iconSize, crackRatio);
    }

    // Selection ring
    if (isSelected) {
      ctx.beginPath();
      ctx.arc(0, -4, iconSize / 2 + 3, 0, Math.PI * 2);
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 2;
      ctx.stroke();
    }


    ctx.restore();
  }

  /** Seeded PRNG — deterministic float in [0,1) from integer seed. */
  private seededRandom(seed: number): number {
    const x = Math.sin(seed * 127.1 + seed * 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  /** Draw refined cracks over the unit sprite — fractal jagged paths with branches. */
  private drawCracks(seed: number, iconSize: number, intensity: number): void {
    const { ctx } = this;
    const MAX_MAIN_CRACKS = 6;
    const crackCount = Math.ceil(intensity * MAX_MAIN_CRACKS);
    const radius = iconSize / 2;

    ctx.save();
    ctx.translate(0, -4); // center on sprite
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (let i = 0; i < crackCount; i++) {
      const rng = (offset: number) => this.seededRandom(seed + i * 3571 + offset);

      // Evenly distributed base angles with jitter for natural feel
      const baseAngle = (i / MAX_MAIN_CRACKS) * Math.PI * 2;
      const angle = baseAngle + (rng(0) - 0.5) * 0.8;
      const len = radius * (0.6 + rng(1) * 0.4) * Math.min(1, intensity * 1.4);

      // Build multi-segment jagged main crack path
      const segments = 4 + Math.floor(rng(2) * 3); // 4-6 segments
      const points: { x: number; y: number }[] = [{ x: 0, y: 0 }];

      for (let s = 1; s <= segments; s++) {
        const t = s / segments;
        const drift = (rng(s * 17) - 0.5) * len * 0.18; // lateral jitter
        const px = Math.cos(angle) * len * t + Math.sin(angle) * drift;
        const py = Math.sin(angle) * len * t - Math.cos(angle) * drift;
        points.push({ x: px, y: py });
      }

      // Draw outer dark stroke (depth shadow)
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let s = 1; s < points.length; s++) {
        ctx.lineTo(points[s].x, points[s].y);
      }
      ctx.strokeStyle = 'rgba(10, 5, 2, 0.7)';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Draw inner bright highlight (hot crack interior)
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let s = 1; s < points.length; s++) {
        ctx.lineTo(points[s].x, points[s].y);
      }
      ctx.strokeStyle = `rgba(160, 80, 30, ${0.3 + intensity * 0.4})`;
      ctx.lineWidth = 1;
      ctx.stroke();

      // Branches — thinner cracks forking off at ~40-60% along the main path
      const branchCount = Math.floor(rng(3) * 2) + 1; // 1-2 branches
      for (let b = 0; b < branchCount; b++) {
        const branchIdx = 1 + Math.floor(rng(b * 31 + 50) * (points.length - 2));
        const origin = points[branchIdx];
        const branchAngle = angle + (rng(b * 47 + 70) - 0.5) * 1.8;
        const branchLen = len * (0.2 + rng(b * 61 + 80) * 0.2);

        const bSegs = 2 + Math.floor(rng(b * 71 + 90) * 2); // 2-3 segments
        const bPts: { x: number; y: number }[] = [origin];
        for (let s = 1; s <= bSegs; s++) {
          const bt = s / bSegs;
          const drift = (rng(b * 100 + s * 19) - 0.5) * branchLen * 0.2;
          bPts.push({
            x: origin.x + Math.cos(branchAngle) * branchLen * bt + Math.sin(branchAngle) * drift,
            y: origin.y + Math.sin(branchAngle) * branchLen * bt - Math.cos(branchAngle) * drift,
          });
        }

        // Branch outer stroke
        ctx.beginPath();
        ctx.moveTo(bPts[0].x, bPts[0].y);
        for (let s = 1; s < bPts.length; s++) ctx.lineTo(bPts[s].x, bPts[s].y);
        ctx.strokeStyle = 'rgba(10, 5, 2, 0.5)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Branch inner highlight
        ctx.beginPath();
        ctx.moveTo(bPts[0].x, bPts[0].y);
        for (let s = 1; s < bPts.length; s++) ctx.lineTo(bPts[s].x, bPts[s].y);
        ctx.strokeStyle = `rgba(140, 60, 20, ${0.2 + intensity * 0.3})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  private drawVictoryOverlay(): void {
    if (this.state.phase !== 'victory' || !this.state.winner) return;

    const { ctx, canvas } = this;

    // Dim background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const label = this.state.winner === 'blue' ? 'Blue Faction Wins!' : 'Red Faction Wins!';
    const color = this.state.winner === 'blue' ? '#5588dd' : '#dd5555';

    // Banner background
    const bannerH = 100;
    const bannerY = (canvas.height - bannerH) / 2;
    ctx.fillStyle = 'rgba(10, 10, 30, 0.9)';
    ctx.fillRect(0, bannerY, canvas.width, bannerH);

    // Top/bottom gold lines
    ctx.strokeStyle = 'rgba(220, 190, 100, 0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, bannerY);
    ctx.lineTo(canvas.width, bannerY);
    ctx.moveTo(0, bannerY + bannerH);
    ctx.lineTo(canvas.width, bannerY + bannerH);
    ctx.stroke();

    // Victory text
    ctx.font = "bold 36px 'Segoe UI', system-ui, sans-serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 16;
    ctx.fillText(label, canvas.width / 2, bannerY + bannerH / 2 - 8);
    ctx.shadowColor = 'transparent';

    // Subtitle
    ctx.font = "14px 'Segoe UI', system-ui, sans-serif";
    ctx.fillStyle = 'rgba(200, 190, 160, 0.6)';
    ctx.fillText(`Battle concluded in ${this.state.roundCount} rounds — press ESC to return`, canvas.width / 2, bannerY + bannerH / 2 + 22);
  }

  // ── Hex drawing helpers ──

  private strokeHex(center: Point, size: number): void {
    const { ctx } = this;
    const corners = hexCorners(center, size);
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < 6; i++) ctx.lineTo(corners[i].x, corners[i].y);
    ctx.closePath();
    ctx.stroke();
  }

  private strokeHexStyled(center: Point, size: number, style: string, lineWidth: number): void {
    const { ctx } = this;
    ctx.save();
    ctx.strokeStyle = style;
    ctx.lineWidth = lineWidth;
    this.strokeHex(center, size);
    ctx.restore();
  }

  private fillHex(center: Point, size: number, style: string): void {
    const { ctx } = this;
    const corners = hexCorners(center, size);
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < 6; i++) ctx.lineTo(corners[i].x, corners[i].y);
    ctx.closePath();
    ctx.fillStyle = style;
    ctx.fill();
  }
}
