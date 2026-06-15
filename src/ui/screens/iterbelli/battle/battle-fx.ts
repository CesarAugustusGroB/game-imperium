/**
 * Procedural 2D battle renderer — HTML5 Canvas 2D. Presentation-only: reads the
 * engine BattleState and draws it (terrain, squads, standards, projectiles,
 * particles, screen-shake, floating casualties). It NEVER mutates combat state.
 *
 * Ported from the validated prototype (docs/superpowers/mockups/battle-rework.html)
 * and wrapped in a factory so all animation state lives in the closure (no globals).
 */
import type { BattleState, Side } from '../../../../game/iterBelli/battle/types';
import { ORDERS } from '../../../../game/iterBelli/battle/orders';

interface Projectile { x0: number; y0: number; x1: number; y1: number; t: number; step: number; H: number; fire?: boolean; rock?: boolean; color: string; }
interface Pinned { x: number; y: number; ang: number; life: number; color: string; }
interface Particle { x: number; y: number; vx: number; vy: number; r: number; color: string; life: number; max: number; }
interface Floater { x: number; y: number; vy: number; text: string; color: string; life: number; max: number; }
interface Mote { x: number; y: number; vx: number; vy: number; r: number; a: number; }
interface SideAnim { lunge: number; recoil: number; flash: number; }

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const NF = (n: number) => Math.round(n).toLocaleString('en-US');

/** Engine center.terrain → the prototype's terrain key used by drawTerrain. */
function centerKeyOf(s: BattleState): 'hill' | 'ford' | 'camp' | 'plain' {
  switch (s.center.terrain) {
    case 'hills': return 'hill';
    case 'river': return 'ford';
    case 'settlement': return 'camp';
    default: return 'plain';
  }
}

export interface BattleFx {
  resize(): void;
  start(): void;
  stop(): void;
  setState(s: BattleState): void;
  triggerVisualEffects(side: Side, orderKey: string): void;
  spawnDamageFloat(side: Side, amount: number): void;
}

export function createBattleFx(canvas: HTMLCanvasElement): BattleFx {
  const ctx = canvas.getContext('2d')!;
  // Accessibility: honour the OS "reduce motion" setting. Read live (the user can
  // toggle it mid-run) so screen-shake, burst particles and ambient drift are
  // suppressed for motion-sensitive players — mirroring GoldDust's gate.
  const reduceMotionMQ = typeof matchMedia !== 'undefined' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  const reduceMotion = (): boolean => reduceMotionMQ?.matches === true;
  let state: BattleState | null = null;
  let raf = 0;
  let VT = 0;
  let shake = 0;
  const projectiles: Projectile[] = [];
  const pinned: Pinned[] = [];
  const particles: Particle[] = [];
  const floats: Floater[] = [];
  const anim: Record<Side, SideAnim> = { you: { lunge: 0, recoil: 0, flash: 0 }, enemy: { lunge: 0, recoil: 0, flash: 0 } };
  const ambient: Mote[] = Array.from({ length: 46 }, () => ({
    x: Math.random(), y: Math.random(), vx: rnd(-0.0006, 0.0006), vy: rnd(-0.0003, 0.0003), r: rnd(0.5, 2.2), a: rnd(0.05, 0.25),
  }));

  // Logical (CSS-pixel) size; the backing store is scaled by DPR so the
  // canvas stays sharp on hi-DPI screens. All drawing uses W/H coordinates.
  let W = 320, H = 180, DPR = 1;
  function resize(): void {
    const r = canvas.getBoundingClientRect();
    DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    W = Math.max(320, Math.round(r.width));
    H = Math.max(180, Math.round(r.height));
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
  }
  function setState(s: BattleState): void { state = s; }

  function battleLineX(w: number): number { return w / 2 + ((state!.control) / 100) * (w * 0.25); }
  function squadX(side: Side, w: number): number { const bx = battleLineX(w); return side === 'you' ? bx - 85 : bx + 85; }

  // ── Terrain ──
  function bg(w: number, h: number, base: string): void {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, base); g.addColorStop(1, '#07050a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }
  function drawTerrain(w: number, h: number): void {
    const cx = w / 2, cy = h / 2, k = centerKeyOf(state!);
    if (k === 'hill') {
      bg(w, h, '#2d381b');
      ctx.strokeStyle = 'rgba(212,168,67,0.07)'; ctx.lineWidth = 1;
      for (const r of [60, 105, 150, 195, 240]) { ctx.beginPath(); ctx.ellipse(cx, cy + 50, r, r * 0.55, 0, 0, Math.PI * 2); ctx.stroke(); }
    } else if (k === 'ford') {
      bg(w, h, '#132c3a');
      ctx.fillStyle = '#102d3d'; ctx.beginPath();
      ctx.moveTo(cx - 40, 0); ctx.lineTo(cx + 40, 0);
      ctx.bezierCurveTo(cx + 10, cy, cx + 90, cy, cx + 60, h); ctx.lineTo(cx - 20, h);
      ctx.bezierCurveTo(cx - 90, cy, cx - 70, cy, cx - 40, 0); ctx.fill();
      ctx.strokeStyle = '#2980b9'; ctx.lineWidth = 2; ctx.beginPath();
      for (let y = 0; y <= h; y += 8) { const xx = cx + Math.sin(y * 0.05 + VT) * 5; if (y === 0) ctx.moveTo(xx, y); else ctx.lineTo(xx, y); }
      ctx.stroke();
    } else if (k === 'camp') {
      bg(w, h, '#352920');
      ctx.strokeStyle = '#4a3728'; ctx.lineWidth = 4;
      for (const px of [cx - 80, cx + 80]) for (let y = 20; y < h - 10; y += 18) { ctx.beginPath(); ctx.moveTo(px, y); ctx.lineTo(px, y + 12); ctx.stroke(); }
    } else {
      bg(w, h, '#1a331f');
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1; ctx.setLineDash([4, 6]);
    ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, h); ctx.stroke(); ctx.setLineDash([]);
  }
  function drawAmbient(w: number, h: number): void {
    const windK = centerKeyOf(state!) === 'plain' ? 2 : 1;
    const drift = !reduceMotion();
    for (const m of ambient) {
      if (drift) { m.x += m.vx * windK; m.y += m.vy; }
      if (m.x > 1) m.x = 0; if (m.x < 0) m.x = 1; if (m.y > 1) m.y = 0; if (m.y < 0) m.y = 1;
      ctx.fillStyle = `rgba(200,190,160,${m.a})`; ctx.beginPath(); ctx.arc(m.x * w, m.y * h, m.r, 0, 7); ctx.fill();
    }
  }

  // ── Standards ──
  function drawStandard(side: Side): void {
    const w = W, h = H, cy = h / 2; const roman = side === 'you';
    const x = squadX(side, w) + (roman ? -25 : 25);
    ctx.save(); ctx.translate(x, cy + 35); ctx.rotate(Math.sin(VT * 1.5) * 0.08);
    ctx.strokeStyle = '#5c4033'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -65); ctx.stroke();
    ctx.fillStyle = roman ? '#d4a843' : '#b08d57'; ctx.beginPath(); ctx.arc(0, -66, 3, 0, 7); ctx.fill();
    if (roman) {
      ctx.strokeStyle = '#d4a843'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-9, -58); ctx.lineTo(9, -58); ctx.stroke();
      const yw = -35 + Math.sin(VT * 2.5) * 2; ctx.fillStyle = '#b21f1f'; ctx.fillRect(-9, -58, 18, yw + 58);
      ctx.fillStyle = '#f5d782'; ctx.font = '5px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('SPQR', 0, -46);
    } else {
      const yw = -25 + Math.cos(VT * 2) * 3; ctx.strokeStyle = '#2980b9'; ctx.lineWidth = 2;
      for (const off of [-5, 0, 5]) { ctx.beginPath(); ctx.moveTo(off, -58); ctx.lineTo(off + Math.sin(VT * 2 + off) * 2, yw); ctx.stroke(); }
    }
    ctx.restore();
  }

  // ── Soldiers ──
  function drawSoldier(x: number, y: number, side: Side): void {
    const roman = side === 'you';
    ctx.beginPath(); ctx.arc(x, y, 9, 0, 7); ctx.fillStyle = roman ? '#b21f1f' : '#1f4e70'; ctx.fill();
    ctx.lineWidth = 1; ctx.strokeStyle = '#000'; ctx.stroke();
    if (roman) {
      ctx.beginPath(); ctx.arc(x, y - 5, 5, Math.PI, 0); ctx.fillStyle = '#d4a843'; ctx.fill();
      ctx.save(); ctx.translate(x, y - 9); ctx.rotate(-0.6); ctx.beginPath(); ctx.ellipse(0, 0, 5, 2, 0, 0, 7); ctx.fillStyle = '#c0392b'; ctx.fill(); ctx.restore();
    } else {
      ctx.beginPath(); ctx.arc(x, y - 4, 6, Math.PI, 0); ctx.fillStyle = '#d35400'; ctx.fill();
      ctx.beginPath(); ctx.arc(x, y - 6, 4, Math.PI, 0); ctx.fillStyle = '#7f8c8d'; ctx.fill();
    }
    const sx = x + (roman ? 7 : -7);
    if (roman) {
      ctx.fillStyle = '#b21f1f'; ctx.fillRect(sx - 2, y - 7, 4, 14); ctx.strokeStyle = '#d4a843'; ctx.lineWidth = 1; ctx.strokeRect(sx - 2, y - 7, 4, 14);
      ctx.beginPath(); ctx.arc(sx, y, 1.5, 0, 7); ctx.fillStyle = '#f5d782'; ctx.fill();
    } else {
      ctx.beginPath(); ctx.arc(sx, y, 6, 0, 7); ctx.fillStyle = '#4a2c11'; ctx.fill(); ctx.strokeStyle = '#bdc3c7'; ctx.lineWidth = 1; ctx.stroke();
    }
    const wx = x + (roman ? 10 : -10); ctx.strokeStyle = '#7f8c8d'; ctx.lineWidth = roman ? 2 : 1.5;
    ctx.beginPath(); ctx.moveTo(x, y + 1); ctx.lineTo(wx, y + 1 - (roman ? 0 : 6)); ctx.stroke();
  }
  function drawSquad(side: Side): void {
    const w = W, h = H, cy = h / 2; const army = state![side]; const a = anim[side];
    const dir = side === 'you' ? 1 : -1; const base = squadX(side, w);
    const A = army.morale < 3 ? 2.8 : 1.2;
    const x = base + a.lunge * 1.5 * dir + a.recoil * -1.2 * dir;
    ctx.save();
    if (a.flash > 0) { ctx.shadowColor = 'rgba(231,76,60,0.9)'; ctx.shadowBlur = a.flash; }
    for (let i = 0; i < 5; i++) { const y = cy - 52 + i * 26 + Math.sin(VT * 2 + i) * A; drawSoldier(x, y, side); }
    ctx.restore();
  }

  // ── Projectiles / particles / floats ──
  function addParticles(x: number, y: number, n: number, color: string, spread: number, life?: number): void {
    if (reduceMotion()) return; // suppress decorative burst particles under reduce-motion
    for (let i = 0; i < n; i++) particles.push({ x, y, vx: rnd(-spread, spread), vy: rnd(-spread, spread), r: rnd(1, 3), color, life: life || rnd(20, 40), max: life || 40 });
  }
  function drawPinned(): void {
    for (let i = pinned.length - 1; i >= 0; i--) {
      const p = pinned[i]; p.life--; if (p.life <= 0) { pinned.splice(i, 1); continue; }
      ctx.save(); ctx.globalAlpha = p.life < 40 ? p.life / 40 : 1; ctx.translate(p.x, p.y); ctx.rotate(p.ang);
      ctx.strokeStyle = p.color; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -8); ctx.stroke(); ctx.restore();
    }
  }
  function updateProjectiles(): void {
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i]; p.t += p.step;
      const x = p.x0 + (p.x1 - p.x0) * p.t, y = p.y0 + (p.y1 - p.y0) * p.t + Math.sin(p.t * Math.PI) * (-p.H);
      if (p.t < 1) {
        addParticles(x, y, 1, p.fire ? '#e74c3c' : (p.rock ? '#7f8c8d' : '#888'), 0.4, 12);
        if (p.rock) { ctx.beginPath(); ctx.arc(x, y, 4, 0, 7); ctx.fillStyle = p.color; ctx.fill(); }
        else {
          const px = p.x0 + (p.x1 - p.x0) * (p.t - 0.04), py = p.y0 + (p.y1 - p.y0) * (p.t - 0.04) + Math.sin((p.t - 0.04) * Math.PI) * (-p.H);
          ctx.strokeStyle = p.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(x, y); ctx.stroke();
        }
      } else {
        addParticles(x, y, p.rock ? 14 : 4, p.rock ? '#dfc282' : (p.fire ? '#f39c12' : '#bbb'), p.rock ? 2.4 : 1.2);
        if (!p.rock && Math.random() < 0.6) pinned.push({ x, y, ang: rnd(-0.2, 0.2) + (p.x1 > p.x0 ? 0.3 : -0.3), life: 120, color: p.color });
        projectiles.splice(i, 1);
      }
    }
  }
  function updateParticles(): void {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]; p.x += p.vx; p.y += p.vy; p.life--; if (p.life <= 0) { particles.splice(i, 1); continue; }
      ctx.globalAlpha = p.life / p.max; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
    }
  }
  function drawFloats(): void {
    for (let i = floats.length - 1; i >= 0; i--) {
      const f = floats[i]; f.y += f.vy; f.life--; if (f.life <= 0) { floats.splice(i, 1); continue; }
      ctx.globalAlpha = Math.min(1, f.life / 20); ctx.fillStyle = f.color; ctx.font = 'bold 16px Cinzel, serif'; ctx.textAlign = 'center'; ctx.fillText(f.text, f.x, f.y); ctx.globalAlpha = 1;
    }
  }
  function drawLabels(w: number): void {
    ctx.textAlign = 'left'; ctx.font = '600 11px Cinzel, serif';
    ctx.fillStyle = '#f5d782'; ctx.fillText(state!.you.name, 14, 22);
    ctx.fillStyle = '#bdb3a0'; ctx.font = '10px EB Garamond, serif'; ctx.fillText(state!.you.formation.name, 14, 36);
    ctx.textAlign = 'right'; ctx.font = '600 11px Cinzel, serif';
    ctx.fillStyle = '#e8a090'; ctx.fillText(state!.enemy.name, w - 14, 22);
    ctx.fillStyle = '#bdb3a0'; ctx.font = '10px EB Garamond, serif'; ctx.fillText(state!.enemy.formation.name, w - 14, 36);
    ctx.textAlign = 'left';
  }

  // ── Order → visual mapping ──
  function triggerVisualEffects(side: Side, key: string): void {
    if (!state) return;
    const o = ORDERS[key as keyof typeof ORDERS]; if (!o) return;
    const w = W, cy = H / 2;
    const ax = squadX(side, w), dx = squadX(side === 'you' ? 'enemy' : 'you', w), mid = (ax + dx) / 2;
    if (o.sub === 'charge') { anim[side].lunge = 18; addParticles(mid, cy, 25, '#dfc282', 2.2); if (!reduceMotion()) shake = Math.max(shake, 10); }
    else if (o.sub === 'harass') {
      const fire = key === 'fireMissiles'; const n = fire ? 7 : 6;
      for (let j = 0; j < n; j++) setTimeout(() => { if (state) projectiles.push({ x0: ax, y0: cy, x1: dx, y1: cy + rnd(-40, 40), t: 0, step: 0.03, H: 50, fire, color: fire ? '#f39c12' : '#ffffff' }); }, j * 50);
    } else if (o.sub === 'siege') { projectiles.push({ x0: ax, y0: cy, x1: dx, y1: cy + rnd(-30, 30), t: 0, step: 0.015, H: 100, rock: true, color: '#bdc3c7' }); if (!reduceMotion()) shake = Math.max(shake, 14); }
    else if (o.sub === 'moral') {
      const heal = !o.eMorale; const col = heal ? '#f1c40f' : '#9b59b6';
      for (let j = 0; j < 15; j++) particles.push({ x: (heal ? ax : dx) + rnd(-14, 14), y: cy + rnd(-10, 10), vx: rnd(-0.2, 0.2), vy: rnd(-1.2, -0.5), r: rnd(1.5, 3), color: col, life: rnd(30, 55), max: 55 });
    } else if (o.sub === 'push') {
      anim[side].lunge = 8; addParticles(mid, cy, 8, '#cbb98a', 1.2);
      if (o.eMorale) for (let j = 0; j < 8; j++) particles.push({ x: dx + rnd(-12, 12), y: cy, vx: 0, vy: rnd(-1, -0.4), r: 2, color: '#9b59b6', life: 40, max: 40 });
    } else if (o.sub === 'move') { anim[side].lunge = 12; addParticles(mid, cy, 10, '#cbb98a', 1.6); }
  }
  function spawnDamageFloat(side: Side, amount: number): void {
    if (!state || amount <= 0) return;
    const w = W, cy = H / 2;
    const x = side === 'you' ? battleLineX(w) - 130 : battleLineX(w) + 110;
    floats.push({ x, y: cy - 10, vy: -0.6, text: '-' + NF(amount), color: '#e74c3c', life: 60, max: 60 });
  }

  // ── Loop (pipeline order per spec) ──
  function loop(): void {
    raf = requestAnimationFrame(loop);
    const w = W, h = H; VT += 0.05;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, w, h);
    if (!state) { ctx.fillStyle = '#07050a'; ctx.fillRect(0, 0, w, h); return; }
    ctx.save();
    if (shake > 0) { ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake); shake *= 0.9; if (shake < 0.3) shake = 0; }
    drawTerrain(w, h);
    drawAmbient(w, h);
    drawPinned();
    for (const s of ['you', 'enemy'] as Side[]) { const a = anim[s]; a.lunge *= 0.85; a.recoil *= 0.85; if (a.flash > 0) a.flash -= 1; }
    drawStandard('you'); drawStandard('enemy');
    drawSquad('you'); drawSquad('enemy');
    updateProjectiles();
    updateParticles();
    drawFloats();
    drawLabels(w);
    ctx.restore();
  }

  return {
    resize, setState, triggerVisualEffects, spawnDamageFloat,
    start() { if (!raf) raf = requestAnimationFrame(loop); },
    stop() { if (raf) { cancelAnimationFrame(raf); raf = 0; } },
  };
}
