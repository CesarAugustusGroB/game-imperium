import type { RenderContext } from './RenderContext';

export interface Layer {
  name: string;
  render(rc: RenderContext): void;
  /**
   * Optional — return false to skip this layer entirely.
   * Useful for gfx-settings toggles (e.g. particles disabled).
   */
  enabled?(rc: RenderContext): boolean;
  /**
   * Optional — when true, this layer is drawn OUTSIDE the camera
   * transform (i.e. in screen/HUD space).  Defaults to false.
   */
  fixed?: boolean;
}
