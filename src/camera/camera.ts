import { lerp, clamp, mat3Multiply, mat3Translate, mat3Scale } from '../utils/math';
import type { Mat3 } from '../utils/math';

export class Camera {
  // Current state
  x = 0.5;
  y = 0.5;
  zoom = 1.0;

  // Target state (for smooth interpolation)
  targetX = 0.5;
  targetY = 0.5;
  targetZoom = 1.0;

  // Limits
  minZoom = 0.5;
  maxZoom = 20.0;

  // Smoothing factor (0 = no smoothing, 1 = instant)
  smoothing = 0.12;

  // Aspect ratio
  aspect = 1.0;

  setAspect(width: number, height: number): void {
    this.aspect = width / height;
  }

  pan(dx: number, dy: number): void {
    this.targetX += dx / this.zoom;
    this.targetY += dy / this.zoom;
    this.clampTarget();
  }

  zoomAt(factor: number, screenX: number, screenY: number, canvasWidth: number, canvasHeight: number): void {
    const oldZoom = this.targetZoom;
    this.targetZoom = clamp(this.targetZoom * factor, this.minZoom, this.maxZoom);
    const zoomRatio = 1 - oldZoom / this.targetZoom;

    // Zoom toward cursor position
    const ndcX = (screenX / canvasWidth) * 2 - 1;
    const ndcY = -((screenY / canvasHeight) * 2 - 1);
    this.targetX += ndcX * zoomRatio * (this.aspect / this.targetZoom);
    this.targetY += ndcY * zoomRatio * (1.0 / this.targetZoom);
    this.clampTarget();
  }

  update(): void {
    this.x = lerp(this.x, this.targetX, this.smoothing);
    this.y = lerp(this.y, this.targetY, this.smoothing);
    this.zoom = lerp(this.zoom, this.targetZoom, this.smoothing);
  }

  getMatrix(): Mat3 {
    // Transform: scale by zoom, then translate so camera center maps to origin
    const sx = this.zoom / this.aspect;
    const sy = this.zoom;
    const tx = -(this.x * 2 - 1) * sx;
    const ty = -(this.y * 2 - 1) * sy;

    return mat3Multiply(
      mat3Translate(tx, ty),
      mat3Scale(sx, sy),
    );
  }

  // Convert screen coordinates to map UV
  screenToUV(screenX: number, screenY: number, canvasWidth: number, canvasHeight: number): [number, number] {
    const ndcX = (screenX / canvasWidth) * 2 - 1;
    const ndcY = -((screenY / canvasHeight) * 2 - 1);

    const u = this.x + (ndcX * this.aspect) / (this.zoom * 2);
    const v = this.y + ndcY / (this.zoom * 2);

    return [u, v];
  }

  private clampTarget(): void {
    this.targetX = clamp(this.targetX, 0, 1);
    this.targetY = clamp(this.targetY, 0, 1);
  }
}
