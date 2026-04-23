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
