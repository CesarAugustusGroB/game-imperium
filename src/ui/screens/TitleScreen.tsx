import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { Settings, BookOpen, Landmark, X } from 'lucide-preact';
import { navigateTo, navigateToBellum } from '../screens';
import { GoldDust } from '../components/GoldDust';
import { OptionsModal } from '../components/SettingsPanel';
import bgPicture from '../../assets/backgrounds/roman_background.png?w=1600;2400&format=avif;webp;png&as=picture';
import { hasActiveRunSave, restoreActiveRun } from '../../game/core/meta-save';
import { currentSpoke } from '../../game/progression/spoke';

const STYLES = `
  .title-screen {
    position: fixed;
    inset: 0;
    width: 100vw;
    height: 100dvh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    font-family: var(--font-family);
    overflow: hidden;
    background-color: #050405;
  }
  html:has(.title-screen),
  body:has(.title-screen) {
    overflow: hidden;
    background: #050405;
  }
  .screen-wrapper:has(.title-screen) {
    padding-top: 0 !important;
  }
  .title-screen__bg {
    position: absolute;
    inset: -3%;
    transform: translate3d(var(--px, 0px), var(--py, 0px), 0) scale(1.03);
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
      radial-gradient(ellipse at 50% 22%, rgba(18, 14, 12, 0.04) 0%, rgba(8, 6, 5, 0.32) 52%, rgba(3, 3, 4, 0.74) 100%),
      linear-gradient(180deg, rgba(2, 2, 3, 0.48) 0%, rgba(6, 4, 3, 0.14) 36%, rgba(5, 4, 3, 0.64) 100%),
      linear-gradient(90deg, rgba(2, 2, 3, 0.54) 0%, rgba(2, 2, 3, 0.08) 22%, rgba(2, 2, 3, 0.08) 78%, rgba(2, 2, 3, 0.54) 100%);
  }
  .title-screen__lightwash {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 0;
    opacity: 0.55;
    mix-blend-mode: screen;
    background:
      radial-gradient(ellipse 940px 420px at 54% 28%, rgba(255, 211, 125, 0.22), transparent 70%),
      radial-gradient(ellipse 780px 360px at 82% 37%, rgba(230, 148, 58, 0.16), transparent 74%),
      linear-gradient(180deg, rgba(255, 226, 166, 0.08), transparent 44%);
  }
  .title-screen__smoke {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 0;
    opacity: 0.66;
    background:
      radial-gradient(ellipse 520px 180px at 50% 27%, rgba(212, 168, 67, 0.16), transparent 72%),
      radial-gradient(ellipse 720px 300px at 50% 76%, rgba(0, 0, 0, 0.42), transparent 72%);
  }
  .title-screen__imperial-shell {
    position: relative;
    z-index: 1;
    width: 100%;
    height: 100%;
    display: grid;
    grid-template-rows: auto 1fr auto;
    align-items: center;
    padding: 56px 32px 36px;
  }
  .title-screen__imperial-shell::before,
  .title-screen__imperial-shell::after {
    content: '';
    position: absolute;
    pointer-events: none;
    border: 1px solid rgba(212, 168, 67, 0.68);
    box-shadow:
      0 0 18px rgba(212, 168, 67, 0.16),
      inset 0 0 18px rgba(0, 0, 0, 0.72);
  }
  .title-screen__imperial-shell::before { inset: 10px; }
  .title-screen__imperial-shell::after {
    inset: 18px;
    border-color: rgba(240, 208, 128, 0.36);
  }
  .title-screen__corner {
    position: absolute;
    width: min(17vw, 220px);
    height: min(17vw, 220px);
    min-width: 128px;
    min-height: 128px;
    pointer-events: none;
    z-index: 2;
    opacity: 0.86;
    filter:
      drop-shadow(0 2px 8px rgba(0, 0, 0, 0.78))
      drop-shadow(0 0 10px rgba(212, 168, 67, 0.24));
  }
  .title-screen__corner-img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
    user-select: none;
    -webkit-user-drag: none;
  }
  .title-screen__corner--tl { top: 8px; left: 8px; transform: scaleX(-1); }
  .title-screen__corner--tr { top: 8px; right: 8px; }
  .title-screen__corner--bl { bottom: 8px; left: 8px; transform: scale(-1); }
  .title-screen__corner--br { bottom: 8px; right: 8px; transform: scaleY(-1); }
  .title-screen__masthead {
    width: min(920px, 100%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    justify-self: center;
    text-align: center;
    padding-top: 2px;
  }
  .title-screen__crest-row,
  .title-screen__subtitle-row,
  .title-screen__eagle-row {
    width: 100%;
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 20px;
  }
  .title-screen__crest-row {
    width: min(280px, 64%);
    gap: 18px;
  }
  .title-screen__eagle-row {
    width: min(700px, 82%);
    margin-top: -4px;
  }
  .title-screen__line {
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(212, 168, 67, 0.36) 12%, rgba(240, 208, 128, 0.96) 92%, transparent);
    box-shadow: 0 0 10px rgba(212, 168, 67, 0.22);
  }
  .title-screen__line--right { transform: scaleX(-1); }
  .title-screen__subtitle {
    color: #d7ad4b;
    font-family: var(--font-display);
    font-size: 19px;
    font-weight: 500;
    letter-spacing: 14px;
    text-transform: uppercase;
    text-shadow: 0 2px 10px rgba(0, 0, 0, 0.85), 0 0 20px rgba(212, 168, 67, 0.28);
    white-space: nowrap;
  }
  .title-screen__title {
    margin: 0;
    color: #f2c96b;
    font-family: var(--font-display);
    font-size: 106px;
    font-weight: 600;
    line-height: 0.88;
    letter-spacing: 22px;
    text-transform: uppercase;
    text-shadow:
      0 1px 0 #fff0be,
      0 4px 0 #7c4911,
      0 9px 18px rgba(0, 0, 0, 0.95),
      0 0 28px rgba(212, 168, 67, 0.42);
  }
  .title-screen__emblem {
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    user-select: none;
    filter:
      drop-shadow(0 2px 7px rgba(0, 0, 0, 0.86))
      drop-shadow(0 0 10px rgba(212, 168, 67, 0.28));
  }
  .title-screen__emblem img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  .title-screen__emblem--laurel {
    width: 70px;
    height: 70px;
    opacity: 0.88;
  }
  .title-screen__emblem--eagle {
    width: 158px;
    height: 92px;
    margin: -22px -18px;
  }
  .title-screen__menu-zone {
    width: min(610px, 100%);
    align-self: center;
    justify-self: center;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 18px;
    margin-top: 30px;
  }
  .title-screen__primary-actions {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }
  .title-screen__menu-button {
    position: relative;
    min-height: 96px;
    border: 2px solid rgba(212, 168, 67, 0.8);
    border-radius: 3px;
    background:
      linear-gradient(180deg, rgba(18, 22, 26, 0.92), rgba(9, 11, 14, 0.9)),
      radial-gradient(ellipse at center, rgba(212, 168, 67, 0.08), transparent 64%);
    color: #f3cb74;
    font-family: var(--font-display);
    font-size: 37px;
    font-weight: 600;
    letter-spacing: 3px;
    text-transform: uppercase;
    cursor: pointer;
    box-shadow:
      0 0 0 1px rgba(0, 0, 0, 0.88),
      inset 0 0 0 2px rgba(240, 208, 128, 0.18),
      inset 0 0 34px rgba(0, 0, 0, 0.74),
      0 12px 30px rgba(0, 0, 0, 0.62);
    text-shadow: 0 2px 6px rgba(0, 0, 0, 0.95), 0 0 18px rgba(212, 168, 67, 0.22);
    transition:
      transform var(--duration-fast) var(--ease-default),
      border-color var(--duration-normal) var(--ease-default),
      color var(--duration-normal) var(--ease-default),
      box-shadow var(--duration-normal) var(--ease-default),
      background var(--duration-normal) var(--ease-default);
  }
  .title-screen__menu-button::before {
    content: '';
    position: absolute;
    inset: 5px;
    border: 1px solid rgba(212, 168, 67, 0.46);
    pointer-events: none;
  }
  .title-screen__menu-button:hover:not(:disabled) {
    transform: translateY(-2px);
    color: #ffe5a5;
    border-color: rgba(240, 208, 128, 0.96);
    background:
      linear-gradient(180deg, rgba(34, 26, 18, 0.96), rgba(13, 14, 16, 0.92)),
      radial-gradient(ellipse at center, rgba(212, 168, 67, 0.2), transparent 68%);
    box-shadow:
      0 0 0 1px rgba(0, 0, 0, 0.88),
      inset 0 0 0 2px rgba(240, 208, 128, 0.28),
      inset 0 0 36px rgba(212, 168, 67, 0.08),
      0 0 24px rgba(212, 168, 67, 0.22),
      0 16px 32px rgba(0, 0, 0, 0.68);
  }
  .title-screen__menu-button:active:not(:disabled) {
    transform: translateY(0);
  }
  .title-screen__menu-button:disabled {
    cursor: not-allowed;
    opacity: 0.44;
    filter: saturate(0.5);
  }
  .title-screen__bottom-rule {
    width: min(720px, 70%);
    height: 1px;
    margin: 0 auto 16px;
    background: linear-gradient(90deg, transparent, rgba(240, 208, 128, 0.5), transparent);
  }
  .title-screen__footer {
    width: min(760px, 100%);
    align-self: end;
    justify-self: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-bottom: 8px;
  }
  .title-screen__footer-actions {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 30px;
    flex-wrap: wrap;
  }
  .title-screen__footer-button {
    min-width: 150px;
    min-height: 44px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    border: 0;
    border-radius: 0;
    background: transparent;
    color: #d9ae50;
    font-family: var(--font-display);
    font-size: 16px;
    font-weight: 600;
    letter-spacing: 4px;
    text-transform: uppercase;
    cursor: pointer;
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.86);
    transition: color var(--duration-fast) var(--ease-default), transform var(--duration-fast) var(--ease-default);
  }
  .title-screen__footer-button svg {
    width: 27px;
    height: 27px;
    stroke-width: 1.6;
    filter: drop-shadow(0 0 8px rgba(212, 168, 67, 0.28));
  }
  .title-screen__footer-button:hover {
    color: #ffe0a0;
    transform: translateY(-1px);
  }
  .title-screen__footer-separator {
    width: 1px;
    height: 34px;
    background: linear-gradient(180deg, transparent, rgba(212, 168, 67, 0.34), transparent);
  }
  .title-screen__credits-modal {
    position: fixed;
    inset: 0;
    z-index: 20;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: rgba(5, 4, 6, 0.76);
    backdrop-filter: blur(4px);
  }
  .title-screen__credits-card {
    position: relative;
    width: min(500px, 92vw);
    padding: 34px 36px 32px;
    border: 1px solid rgba(212, 168, 67, 0.74);
    background:
      linear-gradient(180deg, rgba(18, 17, 22, 0.98), rgba(8, 8, 11, 0.98)),
      radial-gradient(ellipse at top, rgba(212, 168, 67, 0.12), transparent 68%);
    box-shadow:
      0 0 0 1px rgba(0, 0, 0, 0.8),
      inset 0 0 0 1px rgba(240, 208, 128, 0.16),
      0 24px 64px rgba(0, 0, 0, 0.72);
    color: var(--color-text-secondary);
    text-align: center;
  }
  .title-screen__credits-card::before {
    content: '';
    position: absolute;
    inset: 6px;
    border: 1px solid rgba(212, 168, 67, 0.3);
    pointer-events: none;
  }
  .title-screen__credits-card h2 {
    margin: 0 0 8px;
    color: #f0d080;
    font-family: var(--font-display);
    font-size: 34px;
    font-weight: 600;
    letter-spacing: 5px;
    text-transform: uppercase;
  }
  .title-screen__credits-card p {
    margin: 8px 0 0;
    font-family: var(--font-family);
    font-size: var(--font-size-md);
    line-height: 1.55;
  }
  .title-screen__modal-close {
    position: absolute;
    top: 10px;
    right: 10px;
    width: 34px;
    height: 34px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid rgba(212, 168, 67, 0.34);
    border-radius: 2px;
    background: rgba(10, 9, 12, 0.8);
    color: #d7ad4b;
    cursor: pointer;
  }
  .title-screen__modal-close:hover {
    color: #ffe0a0;
    border-color: rgba(240, 208, 128, 0.8);
  }

  @keyframes title-fade-up {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .title-screen__masthead,
  .title-screen__btn-1,
  .title-screen__btn-2,
  .title-screen__btn-3,
  .title-screen__footer {
    animation: title-fade-up var(--duration-slow, 300ms) var(--ease-default, cubic-bezier(0.4, 0, 0.2, 1)) both;
  }
  .title-screen__masthead { animation-delay:   0ms; }
  .title-screen__btn-1   { animation-delay: 160ms; }
  .title-screen__btn-2   { animation-delay: 260ms; }
  .title-screen__btn-3   { animation-delay: 360ms; }
  .title-screen__footer  { animation-delay: 520ms; }

  @media (max-width: 960px) {
    .title-screen__imperial-shell {
      padding: 48px 28px 28px;
    }
    .title-screen__title {
      font-size: 74px;
      letter-spacing: 15px;
    }
    .title-screen__subtitle {
      font-size: 15px;
      letter-spacing: 9px;
    }
    .title-screen__menu-button {
      min-height: 82px;
      font-size: 30px;
    }
  }

  @media (max-width: 640px) {
    .title-screen__imperial-shell {
      padding: 42px 24px 24px;
      grid-template-rows: auto 1fr auto;
    }
    .title-screen__imperial-shell::before { inset: 8px; }
    .title-screen__imperial-shell::after { inset: 14px; }
    .title-screen__corner {
      width: 96px;
      height: 96px;
      min-width: 96px;
      min-height: 96px;
    }
    .title-screen__corner--tl { top: 2px; left: 2px; }
    .title-screen__corner--tr { top: 2px; right: 2px; }
    .title-screen__corner--bl { bottom: 2px; left: 2px; }
    .title-screen__corner--br { bottom: 2px; right: 2px; }
    .title-screen__masthead {
      gap: 10px;
    }
    .title-screen__subtitle-row {
      grid-template-columns: 1fr;
      gap: 8px;
    }
    .title-screen__subtitle-row .title-screen__line {
      display: none;
    }
    .title-screen__subtitle {
      font-size: 12px;
      letter-spacing: 5px;
      white-space: normal;
    }
    .title-screen__title {
      font-size: 46px;
      letter-spacing: 7px;
    }
    .title-screen__eagle-row {
      width: min(360px, 86%);
      gap: 12px;
    }
    .title-screen__emblem--laurel {
      width: 54px;
      height: 54px;
    }
    .title-screen__emblem--eagle {
      width: 104px;
      height: 66px;
      margin: -15px -10px;
    }
    .title-screen__menu-zone {
      gap: 14px;
      margin-top: 20px;
    }
    .title-screen__primary-actions {
      gap: 12px;
    }
    .title-screen__menu-button {
      min-height: 66px;
      font-size: 24px;
      letter-spacing: 2px;
    }
    .title-screen__footer-actions {
      width: 100%;
      gap: 8px;
      flex-wrap: nowrap;
    }
    .title-screen__footer-button {
      min-width: 0;
      flex: 1 1 0;
      min-height: 38px;
      gap: 6px;
      font-size: 11px;
      letter-spacing: 1.5px;
      padding: 0 2px;
    }
    .title-screen__footer-button svg {
      width: 22px;
      height: 22px;
    }
    .title-screen__footer-separator {
      display: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .title-screen__bg {
      transition: none !important;
      transform: scale(1.03) !important;
    }
    .title-screen__masthead,
    .title-screen__btn-1,
    .title-screen__btn-2,
    .title-screen__btn-3,
    .title-screen__footer {
      animation: none !important;
    }
    .title-screen__menu-button,
    .title-screen__footer-button {
      transition: none !important;
    }
  }
`;

function MenuButton({
  children,
  className,
  disabled,
  onClick,
}: {
  children: string;
  className: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      class={`title-screen__menu-button ${className}`}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function TitleScreen() {
  const bgRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const targetRef = useRef({ x: 0, y: 0 });
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [creditsOpen, setCreditsOpen] = useState(false);

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

  const canContinue = hasActiveRunSave();

  async function handleContinue() {
    const restored = await restoreActiveRun();
    if (!restored) return;
    if (currentSpoke.value) navigateToBellum();
    else navigateTo('forum');
  }

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
      <div class="title-screen__lightwash" />
      <div class="title-screen__smoke" />

      <div class="title-screen__imperial-shell">
        <span class="title-screen__corner title-screen__corner--tl">
          <img class="title-screen__corner-img" src="/asset/ui/generated/roman_corner_ornament.png" alt="" />
        </span>
        <span class="title-screen__corner title-screen__corner--tr">
          <img class="title-screen__corner-img" src="/asset/ui/generated/roman_corner_ornament.png" alt="" />
        </span>
        <span class="title-screen__corner title-screen__corner--bl">
          <img class="title-screen__corner-img" src="/asset/ui/generated/roman_corner_ornament.png" alt="" />
        </span>
        <span class="title-screen__corner title-screen__corner--br">
          <img class="title-screen__corner-img" src="/asset/ui/generated/roman_corner_ornament.png" alt="" />
        </span>

        <header class="title-screen__masthead">
          <div class="title-screen__crest-row" aria-hidden="true">
            <span class="title-screen__line" />
            <span class="title-screen__emblem title-screen__emblem--laurel">
              <img src="/asset/ui/generated/roman_laurel_wreath.png" alt="" />
            </span>
            <span class="title-screen__line title-screen__line--right" />
          </div>
          <div class="title-screen__subtitle-row">
            <span class="title-screen__line" />
            <span class="title-screen__subtitle">A Roman Strategy Game</span>
            <span class="title-screen__line title-screen__line--right" />
          </div>
          <h1 class="title-screen__title">Imperium</h1>
          <div class="title-screen__eagle-row" aria-hidden="true">
            <span class="title-screen__line" />
            <span class="title-screen__emblem title-screen__emblem--eagle">
              <img src="/asset/ui/generated/roman_eagle.png" alt="" />
            </span>
            <span class="title-screen__line title-screen__line--right" />
          </div>
        </header>

        <main class="title-screen__menu-zone" aria-label="Main menu">
          <div class="title-screen__primary-actions">
            <MenuButton className="title-screen__btn-1" onClick={() => navigateTo('commander-select')}>
              New Game
            </MenuButton>
            <MenuButton className="title-screen__btn-2" disabled={!canContinue} onClick={handleContinue}>
              Continue
            </MenuButton>
            <MenuButton className="title-screen__btn-3" onClick={() => navigateTo('quick-battle')}>
              Quick Battle
            </MenuButton>
          </div>
        </main>

        <footer class="title-screen__footer">
          <div class="title-screen__bottom-rule" />
          <div class="title-screen__footer-actions">
            <button type="button" class="title-screen__footer-button" onClick={() => setOptionsOpen(true)}>
              <Settings aria-hidden="true" />
              <span>Options</span>
            </button>
            <span class="title-screen__footer-separator" aria-hidden="true" />
            <button type="button" class="title-screen__footer-button" onClick={() => navigateTo('bellum-systems')}>
              <BookOpen aria-hidden="true" />
              <span>Tutorial</span>
            </button>
            <span class="title-screen__footer-separator" aria-hidden="true" />
            <button type="button" class="title-screen__footer-button" onClick={() => setCreditsOpen(true)}>
              <Landmark aria-hidden="true" />
              <span>Credits</span>
            </button>
          </div>
        </footer>
      </div>

      <OptionsModal open={optionsOpen} onClose={() => setOptionsOpen(false)} />

      {creditsOpen && (
        <div
          class="title-screen__credits-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Credits"
          onClick={() => setCreditsOpen(false)}
        >
          <div class="title-screen__credits-card" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              class="title-screen__modal-close"
              onClick={() => setCreditsOpen(false)}
              aria-label="Close credits"
            >
              <X aria-hidden="true" />
            </button>
            <h2>Credits</h2>
            <p>Imperium</p>
            <p>Strategy, campaign, battle systems, and UI direction by the Map2D team.</p>
          </div>
        </div>
      )}
    </div>
  );
}
