import { useCallback, useEffect, useRef } from 'preact/hooks';
import { navigateTo } from '../screens';
import { OrnateFrame, OrnateHeader } from '../components/OrnateFrame';
import { GoldDust } from '../components/GoldDust';
import bgPicture from '../../assets/backgrounds/roman_background.png?w=1600;2400&format=avif;webp;png&as=picture';

const STYLES = `
  .title-screen {
    position: relative;
    width: 100vw;
    height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    font-family: var(--font-family);
    overflow: hidden;
    background-color: var(--color-bg-primary);
  }
  .title-screen__bg {
    position: absolute;
    inset: -4%;
    transform: translate3d(var(--px, 0px), var(--py, 0px), 0) scale(1.04);
    transition: transform 300ms var(--ease-default);
    will-change: transform;
  }
  .title-screen__bg picture,
  .title-screen__bg img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center;
  }
  .title-screen__dust {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 0;
  }
  .title-screen__vignette {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 0;
    background:
      radial-gradient(ellipse at center, transparent 28%, rgba(8,6,4,0.55) 85%, rgba(8,6,4,0.88) 100%),
      linear-gradient(180deg, rgba(10,8,6,0.25) 0%, transparent 40%, rgba(10,8,6,0.50) 100%);
  }
  .title-screen__content {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  @keyframes title-fade-up {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .title-screen__frame,
  .title-screen__btn-1,
  .title-screen__btn-2,
  .title-screen__btn-3,
  .title-screen__version {
    animation: title-fade-up var(--duration-slow, 300ms) var(--ease-default, cubic-bezier(0.4, 0, 0.2, 1)) both;
  }
  .title-screen__frame   { animation-delay:   0ms; }
  .title-screen__btn-1   { animation-delay: 160ms; }
  .title-screen__btn-2   { animation-delay: 260ms; }
  .title-screen__btn-3   { animation-delay: 360ms; }
  .title-screen__version { animation-delay: 520ms; }

  .title-screen .ornate-btn,
  .title-screen .ornate-btn-ghost {
    transition:
      transform var(--duration-fast) var(--ease-default),
      filter var(--duration-normal) var(--ease-default),
      box-shadow var(--duration-normal) var(--ease-default);
  }
  .title-screen .ornate-btn:hover:not(:disabled) {
    transform: translateY(-1px) scale(1.01);
    filter: drop-shadow(0 0 18px rgba(220, 168, 67, 0.55));
  }
  .title-screen .ornate-btn:active:not(:disabled) {
    transform: translateY(0) scale(0.99);
    filter: drop-shadow(0 0 8px rgba(220, 168, 67, 0.35));
    transition-duration: var(--duration-fast);
  }
  .title-screen .ornate-btn-ghost:hover:not(:disabled) {
    transform: translateY(-1px);
    filter: drop-shadow(0 0 12px rgba(220, 168, 67, 0.35));
  }

  /* Image-based primary button (NEW GAME) — 4 states stacked as <img>, cross-faded. */
  .title-screen .ornate-btn-img {
    position: relative;
    display: block;
    width: 100%;
    padding: 0;
    border: none;
    background: transparent;
    cursor: pointer;
    line-height: 0;
    transition:
      transform var(--duration-fast) var(--ease-default),
      filter var(--duration-normal) var(--ease-default);
    filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.45));
  }
  .title-screen .ornate-btn-img:focus-visible {
    outline: 2px solid var(--color-gold-primary);
    outline-offset: 4px;
  }
  .title-screen .ornate-btn-img:disabled {
    cursor: not-allowed;
  }
  .title-screen .ornate-btn-img__state {
    display: block;
    width: 100%;
    height: auto;
    user-select: none;
    -webkit-user-drag: none;
  }
  .title-screen .ornate-btn-img__state--hover,
  .title-screen .ornate-btn-img__state--press,
  .title-screen .ornate-btn-img__state--disabled {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    transition: opacity 140ms var(--ease-default);
    pointer-events: none;
  }
  .title-screen .ornate-btn-img:hover:not(:disabled) .ornate-btn-img__state--hover { opacity: 1; }
  .title-screen .ornate-btn-img:active:not(:disabled) .ornate-btn-img__state--press { opacity: 1; }
  .title-screen .ornate-btn-img:active:not(:disabled) .ornate-btn-img__state--hover { opacity: 0; }
  .title-screen .ornate-btn-img:disabled .ornate-btn-img__state--disabled { opacity: 1; }
  .title-screen .ornate-btn-img:disabled .ornate-btn-img__state--default { opacity: 0; }
  .title-screen .ornate-btn-img:hover:not(:disabled) {
    transform: translateY(-1px) scale(1.005);
    filter: drop-shadow(0 4px 16px rgba(220, 168, 67, 0.35)) drop-shadow(0 2px 8px rgba(0, 0, 0, 0.45));
  }
  .title-screen .ornate-btn-img:active:not(:disabled) {
    transform: translateY(0) scale(0.995);
    transition-duration: var(--duration-fast);
  }

  @keyframes shield-float {
    0%, 100% { transform: translateY(0); }
    50%      { transform: translateY(-10px); }
  }

  @media (prefers-reduced-motion: reduce) {
    .title-screen__bg {
      transition: none !important;
      transform: scale(1.04) !important;
    }
    .title-screen__frame,
    .title-screen__btn-1,
    .title-screen__btn-2,
    .title-screen__btn-3,
    .title-screen__version {
      animation: none !important;
    }
    .title-screen .ornate-btn,
    .title-screen .ornate-btn-ghost,
    .title-screen .ornate-btn-img {
      transition: none !important;
    }
    .title-screen .ornate-btn-img__state--hover,
    .title-screen .ornate-btn-img__state--press,
    .title-screen .ornate-btn-img__state--disabled {
      transition: none !important;
    }
  }
`;

const shieldStyle: Record<string, string> = {
  width: '120px', height: '120px', marginBottom: '24px',
  filter: 'drop-shadow(0 0 24px var(--color-border-strong))',
  animation: 'shield-float 3s ease-in-out infinite',
};

const versionStyle: Record<string, string> = {
  position: 'fixed', bottom: '16px', right: '20px',
  fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', letterSpacing: '1px',
};

export function TitleScreen() {
  const bgRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const targetRef = useRef({ x: 0, y: 0 });

  const reduceMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const handleMove = useCallback((e: MouseEvent) => {
    const { innerWidth: w, innerHeight: h } = window;
    const nx = (e.clientX / w) * 2 - 1;
    const ny = (e.clientY / h) * 2 - 1;
    targetRef.current = { x: -nx * 8, y: -ny * 8 };

    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const el = bgRef.current;
      if (!el) return;
      el.style.setProperty('--px', `${targetRef.current.x}px`);
      el.style.setProperty('--py', `${targetRef.current.y}px`);
    });
  }, []);

  useEffect(() => () => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <div class="title-screen" onMouseMove={reduceMotion ? undefined : handleMove}>
      <style>{STYLES}</style>

      <div class="title-screen__bg" ref={bgRef}>
        <picture>
          {bgPicture.sources.avif && <source type="image/avif" srcSet={bgPicture.sources.avif} />}
          {bgPicture.sources.webp && <source type="image/webp" srcSet={bgPicture.sources.webp} />}
          <img src={bgPicture.img.src} alt="" width={bgPicture.img.w} height={bgPicture.img.h} />
        </picture>
      </div>

      <GoldDust className="title-screen__dust" count={14} />

      <div class="title-screen__vignette" />

      <div class="title-screen__content">
        <img
          src="/asset/soldiers/spartan_royal_super-rare_soldier.png"
          alt="Shield"
          style={shieldStyle}
        />

        <div class="title-screen__frame">
          <OrnateFrame width="min(560px, 92vw)" padding="hero">
            <OrnateHeader
              eyebrow="A Roman strategy game"
              title="IMPERIUM"
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
              <button
                class="ornate-btn-img title-screen__btn-1"
                aria-label="New Game"
                onClick={() => navigateTo('commander-select')}
              >
                <img
                  class="ornate-btn-img__state ornate-btn-img__state--default"
                  src="/asset/ui/buttom_new_game_default.png"
                  alt=""
                  aria-hidden="true"
                />
                <img
                  class="ornate-btn-img__state ornate-btn-img__state--hover"
                  src="/asset/ui/buttom_new_game_hover.png"
                  alt=""
                  aria-hidden="true"
                />
                <img
                  class="ornate-btn-img__state ornate-btn-img__state--press"
                  src="/asset/ui/buttom_new_game_press.png"
                  alt=""
                  aria-hidden="true"
                />
                <img
                  class="ornate-btn-img__state ornate-btn-img__state--disabled"
                  src="/asset/ui/buttom_new_game_disabled.png"
                  alt=""
                  aria-hidden="true"
                />
              </button>
              <button
                class="ornate-btn-ghost title-screen__btn-2"
                style={{ padding: '14px 24px', fontSize: 'var(--font-size-lg)', letterSpacing: '2px' }}
                disabled
              >
                Continue
              </button>
              <button
                class="ornate-btn-ghost title-screen__btn-3"
                style={{ padding: '14px 24px', fontSize: 'var(--font-size-lg)', letterSpacing: '2px' }}
                onClick={() => navigateTo('quick-battle')}
              >
                Quick Battle
              </button>
            </div>
          </OrnateFrame>
        </div>
      </div>

      <div class="title-screen__version" style={versionStyle}>v0.5.0 — Sprint 5</div>
    </div>
  );
}
