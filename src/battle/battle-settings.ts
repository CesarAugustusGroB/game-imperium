import { signal } from '@preact/signals';

/** Unit drop shadows + selection glow on all units. */
export const gfxShadows = signal(false);

/** Damage crack overlay on hurt units. */
export const gfxCracks = signal(true);

/** Hit / death particle effects. */
export const gfxParticles = signal(true);

/** 2× DPR sprite oversampling for crisp rendering (costs VRAM). */
export const gfxHighRes = signal(false);

/** Bumped when sprites need reloading (renderer watches this). */
export const spriteReloadTrigger = signal(0);

/** Per-layer profiling HUD: expands the FPS counter with ms/layer + entity counts. */
export const gfxPerfHud = signal(false);

/** Debug/gameplay option: both armies use the berserker movement profile. */
export const forceBerserkerMovement = signal(false);

const STORAGE_KEY = 'imperium:battle-settings:v1';

type BattleSettingsSnapshot = {
  gfxShadows?: boolean;
  gfxCracks?: boolean;
  gfxParticles?: boolean;
  gfxHighRes?: boolean;
  gfxPerfHud?: boolean;
  forceBerserkerMovement?: boolean;
};

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export function saveBattleSettings(): void {
  if (typeof localStorage === 'undefined') return;

  const snapshot: BattleSettingsSnapshot = {
    gfxShadows: gfxShadows.value,
    gfxCracks: gfxCracks.value,
    gfxParticles: gfxParticles.value,
    gfxHighRes: gfxHighRes.value,
    gfxPerfHud: gfxPerfHud.value,
    forceBerserkerMovement: forceBerserkerMovement.value,
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
}

export function loadBattleSettings(): void {
  if (typeof localStorage === 'undefined') return;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    const parsed = JSON.parse(raw) as BattleSettingsSnapshot;
    gfxShadows.value = asBoolean(parsed.gfxShadows, gfxShadows.value);
    gfxCracks.value = asBoolean(parsed.gfxCracks, gfxCracks.value);
    gfxParticles.value = asBoolean(parsed.gfxParticles, gfxParticles.value);
    gfxHighRes.value = asBoolean(parsed.gfxHighRes, gfxHighRes.value);
    gfxPerfHud.value = asBoolean(parsed.gfxPerfHud, gfxPerfHud.value);
    forceBerserkerMovement.value = asBoolean(
      parsed.forceBerserkerMovement,
      forceBerserkerMovement.value,
    );
  } catch {
    // Ignore corrupt local settings and continue with defaults.
  }
}
