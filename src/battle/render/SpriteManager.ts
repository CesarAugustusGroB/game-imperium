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
      '/textures/battlegrounds/battleground.png',
      '/textures/battlegrounds/battleground2.png',
      '/textures/battlegrounds/Battleground3.png',
    ];
    const bgSrc = backgrounds[Math.floor(Math.random() * backgrounds.length)];
    const bg = new Image();
    bg.onload = () => { this.bgImage = bg; };
    bg.src = bgSrc;

    // Default faction:role sprites (fallback when a unit has no spriteId).
    // IMPORTANT: must NEVER reference a "fully-gold coin" sprite listed in
    // GOLD_RESERVED_SPRITE_IDS (src/game/army/cohort-data.ts) — those are
    // narrative-reserved and must not appear as a random fallback.
    this.loadShield('/asset/soldiers/spartan_rare_soldier.png',               (c) => { this.shields.set('blue:vanguard', c); });
    this.loadShield('/asset/soldiers/roman_legionary_uncommon_soldier.png',   (c) => { this.shields.set('blue:reserve',  c); });
    this.loadShield('/asset/soldiers/athens_hoplite_uncommon_soldier.png',    (c) => { this.shields.set('blue:guard',    c); });
    this.loadShield('/asset/soldiers/persian_immortal_uncommon_soldier.png',  (c) => { this.shields.set('red:vanguard',  c); });
    this.loadShield('/asset/soldiers/persian_immortal_uncommon_soldier.png',  (c) => { this.shields.set('red:reserve',   c); });
    this.loadShield('/asset/soldiers/persian_immortal_uncommon_soldier.png',  (c) => { this.shields.set('red:guard',     c); });

    // Per-sprite registry keyed by rarity-aware soldier id
    // (see public/asset/soldiers/soldiers.json — spriteIdPattern = `{culture}_{rarity}` with underscores).
    const soldiers: Record<string, string> = {
      roman_common:             '/asset/soldiers/roman_common_soldier.png',
      viking_common:            '/asset/soldiers/viking_common_soldier.png',
      gallic_common:            '/asset/soldiers/gallic_common_soldier.png',
      athens_hoplite_uncommon:  '/asset/soldiers/athens_hoplite_uncommon_soldier.png',
      persian_immortal_uncommon:'/asset/soldiers/persian_immortal_uncommon_soldier.png',
      samurai_uncommon:         '/asset/soldiers/samurai_uncommon_soldier.png',
      roman_legionary_uncommon: '/asset/soldiers/roman_legionary_uncommon_soldier.png',
      roman_hastatii_common:    '/asset/soldiers/roman_hastatii_common_soldier.png',
      roman_militia_common:     '/asset/soldiers/roman_militia_common_soldier.png',
      roman_velite_uncommon:    '/asset/soldiers/roman_velite_uncommon_soldier.png',
      roman_princeps_rare:      '/asset/soldiers/roman_princeps_rare_soldier.png',
      roman_triarii_super_rare: '/asset/soldiers/roman_triarii_super-rare_soldier.png',
      roman_equite_rare:        '/asset/soldiers/roman_equite_rare_cavalry.png',
      punic_common:             '/asset/soldiers/punic_common_soldier.png',
      spartan_rare:             '/asset/soldiers/spartan_rare_soldier.png',
      cretan_archer_rare:       '/asset/soldiers/cretan_archer_rare_soldier.png',
      war_elephant_rare:        '/asset/soldiers/war_elephant_rare_soldier.png',
      spartan_royal_super_rare: '/asset/soldiers/spartan_royal_super-rare_soldier.png',
      companion_super_rare:     '/asset/soldiers/companion_super-rare_soldier.png',
      athen_hoplite_elite_super_rare: '/asset/soldiers/athen_hoplite-elite_super-rare_soldier.png',
      makedon_hetairoi_secret_rare: '/asset/soldiers/makedon_hetairoi_secret-rare_cavalry.png',
      gallic_clansmen_common:       '/asset/soldiers/gallic_clansmen_common_soldier.png',
      gallic_neitos_uncommon:       '/asset/soldiers/gallic_neitos_uncommon_soldier.png',
      gallic_gaesatae_rare:         '/asset/soldiers/gallic_gaesatae_rare_soldier.png',
      gallic_noble_horse_rare:       '/asset/soldiers/gallic_noble_horse_rare_cavalry.png',
      gallic_noble_horse_super_rare: '/asset/soldiers/gallic_noble_horse_super-rare_cavalry.png',
      gallic_vergobret_super_rare:   '/asset/soldiers/gallic_vergobret_super-rare_soldier.png',
    };
    for (const [id, path] of Object.entries(soldiers)) {
      this.loadShield(path, (c) => { this.shields.set(id, c); });
    }

    // Commander leader card (capture objective)
    this.loadShield('/asset/soldiers/commander_leader_card.png', (c) => { this.starImage = c; });

    // Projectile sprites — none registered by default; ProjectileLayer falls
    // back to the programmatic line+arrowhead drawing.
    // To activate sprite rendering for arrows:
    //   this.loadShield('/asset/projectiles/arrow.png', (c) => { this.shields.set('arrow', c); });
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
