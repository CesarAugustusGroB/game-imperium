import { getAudioContext, sfxMuted, sfxVolume } from './sound';

export type SfxName =
  | 'hit' | 'crit' | 'dodge' | 'death'
  | 'ability_fire' | 'ability_heal' | 'charge'
  | 'ui_click' | 'ui_navigate' | 'ui_equip' | 'ui_sell'
  | 'card_draw' | 'victory_fanfare' | 'defeat_sting';

/** Play a procedurally synthesized sound effect by name. */
export function playSfx(name: SfxName, volume?: number): void {
  if (sfxMuted.value) return;

  const ctx = getAudioContext();
  const vol = volume ?? 1.0;

  switch (name) {
    case 'hit':           synthHit(ctx, vol);           break;
    case 'crit':          synthCrit(ctx, vol);          break;
    case 'dodge':         synthDodge(ctx, vol);         break;
    case 'death':         synthDeath(ctx, vol);         break;
    case 'ability_fire':  synthAbilityFire(ctx, vol);   break;
    case 'ability_heal':  synthAbilityHeal(ctx, vol);   break;
    case 'charge':        synthCharge(ctx, vol);        break;
    case 'ui_click':      synthUiClick(ctx, vol);       break;
    case 'ui_navigate':   synthUiNavigate(ctx, vol);    break;
    case 'ui_equip':      synthUiEquip(ctx, vol);       break;
    case 'ui_sell':       synthUiSell(ctx, vol);        break;
    case 'card_draw':     synthCardDraw(ctx, vol);      break;
    case 'victory_fanfare': synthVictoryFanfare(ctx, vol); break;
    case 'defeat_sting':  synthDefeatSting(ctx, vol);   break;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createNoiseBuffer(ctx: AudioContext, duration: number): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = Math.ceil(sampleRate * duration);
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function masterVol(vol: number): number {
  return vol * sfxVolume.value;
}

// ---------------------------------------------------------------------------
// Synth functions
// ---------------------------------------------------------------------------

/** Short impact — 80ms white noise burst through bandpass filter. */
function synthHit(ctx: AudioContext, vol: number): void {
  const now = ctx.currentTime;
  const duration = 0.08;

  const noise = ctx.createBufferSource();
  noise.buffer = createNoiseBuffer(ctx, duration);

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 800;
  filter.Q.value = 2;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(masterVol(vol) * 0.3, now);
  gain.gain.linearRampToValueAtTime(0, now + duration);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  noise.start(now);
  noise.stop(now + duration);
}

/** Louder hit + metallic ring. */
function synthCrit(ctx: AudioContext, vol: number): void {
  const now = ctx.currentTime;
  const noiseDuration = 0.08;

  // Noise burst (louder)
  const noise = ctx.createBufferSource();
  noise.buffer = createNoiseBuffer(ctx, noiseDuration);

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 800;
  filter.Q.value = 2;

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(masterVol(vol) * 0.45, now);
  noiseGain.gain.linearRampToValueAtTime(0, now + noiseDuration);

  noise.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(ctx.destination);

  noise.start(now);
  noise.stop(now + noiseDuration);

  // Metallic ring
  const ringDuration = 0.15;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = 1200;

  const ringGain = ctx.createGain();
  ringGain.gain.setValueAtTime(masterVol(vol) * 0.2, now);
  ringGain.gain.linearRampToValueAtTime(0, now + ringDuration);

  osc.connect(ringGain);
  ringGain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + ringDuration);
}

/** Quick whoosh — noise burst with high bandpass, very short. */
function synthDodge(ctx: AudioContext, vol: number): void {
  const now = ctx.currentTime;
  const duration = 0.05;

  const noise = ctx.createBufferSource();
  noise.buffer = createNoiseBuffer(ctx, duration);

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 2000;
  filter.Q.value = 1;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(masterVol(vol) * 0.15, now);
  gain.gain.linearRampToValueAtTime(0, now + duration);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  noise.start(now);
  noise.stop(now + duration);
}

/** Low rumble — sawtooth at 80Hz + noise through lowpass. */
function synthDeath(ctx: AudioContext, vol: number): void {
  const now = ctx.currentTime;
  const duration = 0.4;

  // Sawtooth rumble
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.value = 80;

  const oscGain = ctx.createGain();
  oscGain.gain.setValueAtTime(masterVol(vol) * 0.3, now);
  oscGain.gain.linearRampToValueAtTime(0, now + duration);

  osc.connect(oscGain);
  oscGain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + duration);

  // Noise through lowpass
  const noise = ctx.createBufferSource();
  noise.buffer = createNoiseBuffer(ctx, duration);

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 200;

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(masterVol(vol) * 0.2, now);
  noiseGain.gain.linearRampToValueAtTime(0, now + duration);

  noise.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(ctx.destination);

  noise.start(now);
  noise.stop(now + duration);
}

/** Arcane blast — sine sweep from 800Hz down to 200Hz over 200ms. */
function synthAbilityFire(ctx: AudioContext, vol: number): void {
  const now = ctx.currentTime;
  const duration = 0.2;

  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(800, now);
  osc.frequency.linearRampToValueAtTime(200, now + duration);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(masterVol(vol) * 0.3, now);
  gain.gain.linearRampToValueAtTime(0, now + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + duration);
}

/** Ascending chime — sine at 600, 900, 1200 Hz in sequence. */
function synthAbilityHeal(ctx: AudioContext, vol: number): void {
  const now = ctx.currentTime;
  const noteDurations = [0.1, 0.1, 0.15];
  const frequencies = [600, 900, 1200];
  let offset = 0;

  for (let i = 0; i < frequencies.length; i++) {
    const start = now + offset;
    const dur = noteDurations[i];

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = frequencies[i];

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(masterVol(vol) * 0.25, start + dur * 0.2);
    gain.gain.linearRampToValueAtTime(0, start + dur);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(start);
    osc.stop(start + dur);

    offset += dur;
  }
}

/** War horn — sawtooth at 150Hz + 300Hz layered, 300ms, slight gain swell. */
function synthCharge(ctx: AudioContext, vol: number): void {
  const now = ctx.currentTime;
  const duration = 0.3;
  const freqs = [150, 300];

  for (const freq of freqs) {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(masterVol(vol) * 0.1, now);
    gain.gain.linearRampToValueAtTime(masterVol(vol) * 0.25, now + duration * 0.6);
    gain.gain.linearRampToValueAtTime(0, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration);
  }
}

/** Subtle tick — sine at 1000Hz, 20ms, very quiet. */
function synthUiClick(ctx: AudioContext, vol: number): void {
  const now = ctx.currentTime;
  const duration = 0.02;

  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = 1000;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(masterVol(vol) * 0.3 * 0.3, now);
  gain.gain.linearRampToValueAtTime(0, now + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + duration);
}

/** Soft whoosh — noise through bandpass (1500Hz, Q=0.5), 100ms. */
function synthUiNavigate(ctx: AudioContext, vol: number): void {
  const now = ctx.currentTime;
  const duration = 0.1;

  const noise = ctx.createBufferSource();
  noise.buffer = createNoiseBuffer(ctx, duration);

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 1500;
  filter.Q.value = 0.5;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(masterVol(vol) * 0.12, now);
  gain.gain.linearRampToValueAtTime(0, now + duration);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  noise.start(now);
  noise.stop(now + duration);
}

/** Parchment rustle — noise burst (60ms) through bandpass (3000Hz, Q=1). */
function synthUiEquip(ctx: AudioContext, vol: number): void {
  const now = ctx.currentTime;
  const duration = 0.06;

  const noise = ctx.createBufferSource();
  noise.buffer = createNoiseBuffer(ctx, duration);

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 3000;
  filter.Q.value = 1;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(masterVol(vol) * 0.18, now);
  gain.gain.linearRampToValueAtTime(0, now + duration);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  noise.start(now);
  noise.stop(now + duration);
}

/** Coin clink — sine at 2000Hz (50ms) then 2500Hz (40ms). */
function synthUiSell(ctx: AudioContext, vol: number): void {
  const now = ctx.currentTime;

  // First clink
  const osc1 = ctx.createOscillator();
  osc1.type = 'sine';
  osc1.frequency.value = 2000;

  const gain1 = ctx.createGain();
  gain1.gain.setValueAtTime(masterVol(vol) * 0.25, now);
  gain1.gain.linearRampToValueAtTime(0, now + 0.05);

  osc1.connect(gain1);
  gain1.connect(ctx.destination);
  osc1.start(now);
  osc1.stop(now + 0.05);

  // Second clink
  const osc2 = ctx.createOscillator();
  osc2.type = 'sine';
  osc2.frequency.value = 2500;

  const gain2 = ctx.createGain();
  gain2.gain.setValueAtTime(masterVol(vol) * 0.2, now + 0.06);
  gain2.gain.linearRampToValueAtTime(0, now + 0.06 + 0.04);

  osc2.connect(gain2);
  gain2.connect(ctx.destination);
  osc2.start(now + 0.06);
  osc2.stop(now + 0.06 + 0.04);
}

/** Card shuffle — noise burst 40ms through highpass (1000Hz). */
function synthCardDraw(ctx: AudioContext, vol: number): void {
  const now = ctx.currentTime;
  const duration = 0.04;

  const noise = ctx.createBufferSource();
  noise.buffer = createNoiseBuffer(ctx, duration);

  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 1000;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(masterVol(vol) * 0.2, now);
  gain.gain.linearRampToValueAtTime(0, now + duration);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  noise.start(now);
  noise.stop(now + duration);
}

/** Ascending arpeggio — C5, E5, G5, C6 staggered by 120ms, final note 300ms. */
function synthVictoryFanfare(ctx: AudioContext, vol: number): void {
  const now = ctx.currentTime;
  const freqs = [523, 659, 784, 1047]; // C5, E5, G5, C6
  const stagger = 0.12;
  const noteDurations = [0.15, 0.15, 0.15, 0.3];

  for (let i = 0; i < freqs.length; i++) {
    const start = now + i * stagger;
    const dur = noteDurations[i];

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freqs[i];

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(masterVol(vol) * 0.3, start + 0.02);
    gain.gain.linearRampToValueAtTime(masterVol(vol) * 0.2, start + dur * 0.5);
    gain.gain.linearRampToValueAtTime(0, start + dur);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(start);
    osc.stop(start + dur);
  }
}

/** Descending minor — C4, Ab3, F3 as sawtooth through lowpass, staggered 180ms. */
function synthDefeatSting(ctx: AudioContext, vol: number): void {
  const now = ctx.currentTime;
  const freqs = [262, 208, 175]; // C4, Ab3, F3
  const stagger = 0.18;
  const noteDuration = 0.2;

  for (let i = 0; i < freqs.length; i++) {
    const start = now + i * stagger;

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = freqs[i];

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 600;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(masterVol(vol) * 0.25, start + 0.02);
    gain.gain.linearRampToValueAtTime(0, start + noteDuration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(start);
    osc.stop(start + noteDuration);
  }
}
