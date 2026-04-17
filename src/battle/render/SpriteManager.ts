import { gfxHighRes } from '../battle-settings';

/**
 * Owns all sprite assets used by the battle renderer:
 *  - A random background image
 *  - Per-faction / per-role shield sprites (pre-rendered to offscreen canvas)
 *  - The commander "star" image used as a capture-objective icon
 */
export class SpriteManager {
  /** Pre-rendered shield canvases keyed by "faction:role". */
  readonly shields = new Map<string, HTMLCanvasElement>();

  /** Pre-rendered commander round icon used as the capture star. */
  starImage: HTMLCanvasElement | null = null;

  private bgImage: HTMLImageElement | null = null;

  constructor() {
    this.loadAssets();
  }

  getBgImage(): HTMLImageElement | null {
    return this.bgImage;
  }

  /** Re-initialise all sprite caches (called when gfxHighRes changes). */
  reloadSprites(): void {
    this.shields.clear();
    this.starImage = null;
    this.bgImage = null;
    this.loadAssets();
  }

  private loadAssets(): void {
    const backgrounds = [
      '/textures/battleground.png',
      '/textures/battleground2.png',
      '/textures/Battleground3.png',
    ];
    const bgSrc = backgrounds[Math.floor(Math.random() * backgrounds.length)];
    const bg = new Image();
    bg.onload = () => { this.bgImage = bg; };
    bg.src = bgSrc;

    // Blue team: Spartans
    this.loadShield('/asset/spartan_round.png',        (c) => { this.shields.set('blue:vanguard', c); });
    this.loadShield('/asset/spartan_gold_round.png',   (c) => { this.shields.set('blue:reserve',  c); });
    this.loadShield('/asset/athens_hoplite_round.png', (c) => { this.shields.set('blue:guard',    c); });
    // Red team: Persians (all roles share the same sprite)
    this.loadShield('/asset/persina_inmortal_round.png', (c) => { this.shields.set('red:vanguard', c); });
    this.loadShield('/asset/persina_inmortal_round.png', (c) => { this.shields.set('red:reserve',  c); });
    this.loadShield('/asset/persina_inmortal_round.png', (c) => { this.shields.set('red:guard',    c); });
    // Commander star (capture objective)
    this.loadShield('/asset/commander_round.png', (c) => { this.starImage = c; });
  }

  /**
   * Pre-render a sprite image to an offscreen canvas at 2× display size
   * for crisp sub-pixel rendering.
   */
  loadShield(src: string, onReady: (canvas: HTMLCanvasElement) => void): void {
    const img = new Image();
    img.onload = () => {
      const dpr = window.devicePixelRatio || 1;
      const cacheSize = Math.round(60 * dpr * (gfxHighRes.value ? 2 : 1));
      const offscreen = document.createElement('canvas');
      offscreen.width  = cacheSize;
      offscreen.height = cacheSize;
      const octx = offscreen.getContext('2d')!;
      octx.imageSmoothingEnabled = true;
      octx.imageSmoothingQuality = 'high';
      // Preserve aspect ratio within the square canvas
      const aspect = img.width / img.height;
      let dw: number, dh: number, dx: number, dy: number;
      if (aspect > 1) {
        dw = cacheSize; dh = cacheSize / aspect;
        dx = 0;         dy = (cacheSize - dh) / 2;
      } else {
        dh = cacheSize; dw = cacheSize * aspect;
        dx = (cacheSize - dw) / 2; dy = 0;
      }
      octx.drawImage(img, dx, dy, dw, dh);
      onReady(offscreen);
    };
    img.src = src;
  }
}
