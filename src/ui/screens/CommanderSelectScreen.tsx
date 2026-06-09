import { signal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { COMMANDERS } from '../../data/commanders';
import { ARCHETYPE_COLORS } from '../../game/core/commander';
import type { Commander } from '../../game/core/commander';
import { startNewRun } from '../../game/core/game-state';
import { navigateTo } from '../screens';
import bgPicture from '../../assets/backgrounds/roman_background.png?w=1600;2400&format=avif;webp;png&as=picture';

const selectedIndex = signal(0);
const selecting = signal(false);

const ASSET_ROOT = '/asset/ui/commander-select/slices/';
const asset = (file: string) => `${ASSET_ROOT}${file}`;

const COMMANDER_UI_ASSETS = {
  headerEagle: asset('005_header_eagle_large.png'),
  headerLineLeft: asset('002_header_line_top_left.png'),
  headerLineRight: asset('003_header_line_top_right.png'),
  sideBannerLeft: asset('012_side_banner_left.png'),
  sideBannerRight: asset('013_side_banner_right.png'),
  selected_diamond: asset('055_icon_medallion_laurel_small.png'),
  carouselLeft: asset('028_carousel_button_left.png'),
  carouselRight: asset('029_carousel_button_right.png'),
  panelFrameLarge: asset('065_panel_frame_large.png'),
  panelDivider: asset('043_panel_divider_vertical_long.png'),
  crown: asset('059_icon_crown_medallion.png'),
};

const ARCHETYPE_ICON_ASSETS: Record<Commander['archetype'], string> = {
  Warlord: asset('022_icon_archetype_warlord.png'),
  Religious: asset('023_icon_archetype_religious.png'),
  Diplomat: asset('024_icon_archetype_diplomat.png'),
  Merchant: asset('025_icon_archetype_merchant.png'),
};

const ABILITY_ICON_ASSETS: Record<string, string> = {
  'War Cry': asset('036_icon_ability_sunburst.png'),
  'Fury Charge': asset('031_icon_ability_sword.png'),
  'Call Crusade': asset('035_icon_ability_banner.png'),
  Miracle: asset('038_icon_ability_dove.png'),
  Manipulate: asset('039_icon_ability_scroll.png'),
  Turncoat: asset('037_icon_ability_handshake.png'),
  'Golden Opportunity': asset('041_icon_ability_money_bag.png'),
  'Buy Reinforcements': asset('033_icon_unit_helmet.png'),
};

const UNIT_ICON_ASSETS: Record<Commander['archetype'], [string, string]> = {
  Warlord: [asset('044_icon_unit_soldier.png'), asset('050_icon_unit_tower.png')],
  Religious: [asset('045_icon_unit_cavalry.png'), asset('051_icon_unit_cathedral.png')],
  Diplomat: [asset('034_icon_unit_shield.png'), asset('049_icon_unit_temple.png')],
  Merchant: [asset('032_icon_ability_crossed_swords.png'), asset('053_icon_unit_fields.png')],
};

const VICTORY_ICON_ASSETS: Record<string, string> = {
  Domination: asset('056_icon_victory_laurel.png'),
  Raiding: asset('057_icon_victory_skull.png'),
  Cultural: asset('058_icon_victory_temple.png'),
  Religious: asset('062_icon_victory_sun.png'),
  Diplomatic: asset('063_icon_victory_globe.png'),
  Economic: asset('041_icon_ability_money_bag.png'),
};

if (typeof document !== 'undefined' && !document.getElementById('cmdr-select-styles')) {
  const el = document.createElement('style');
  el.id = 'cmdr-select-styles';
  el.textContent = `
    @keyframes cmdr-fade-in {
      from { opacity: 0; transform: translateY(14px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .screen-wrapper:has(.cmdr-screen) {
      padding-top: 0 !important;
    }

    .cmdr-screen {
      position: relative;
      min-height: 100dvh;
      overflow: hidden;
      display: grid;
      grid-template-rows: auto minmax(0, 1fr) auto;
      gap: 6px;
      padding: 14px 42px 16px;
      background: #050405;
      color: var(--color-text-primary);
      font-family: var(--font-family);
    }

    .cmdr-bg,
    .cmdr-bg picture,
    .cmdr-bg img {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
    }

    .cmdr-bg img {
      object-fit: cover;
      object-position: center;
      filter: brightness(0.42) saturate(0.82) contrast(1.04);
    }

    .cmdr-bg::after {
      content: '';
      position: absolute;
      inset: 0;
      background:
        radial-gradient(ellipse 1000px 440px at 50% 2%, rgba(246, 197, 91, 0.13), transparent 68%),
        linear-gradient(180deg, rgba(2, 2, 4, 0.88), rgba(3, 3, 5, 0.5) 32%, rgba(2, 2, 4, 0.88)),
        linear-gradient(90deg, rgba(0, 0, 0, 0.8), rgba(0, 0, 0, 0.24) 24%, rgba(0, 0, 0, 0.24) 76%, rgba(0, 0, 0, 0.8));
      pointer-events: none;
    }

    .cmdr-side-banner {
      position: absolute;
      z-index: 2;
      pointer-events: none;
      user-select: none;
      -webkit-user-drag: none;
      top: 64px;
      width: min(13vw, 190px);
      max-height: 55vh;
      object-fit: contain;
      opacity: 0.78;
      filter: drop-shadow(0 12px 26px rgba(0, 0, 0, 0.86));
    }

    .cmdr-side-banner--left { left: 30px; }
    .cmdr-side-banner--right { right: 30px; }

    .cmdr-header {
      position: relative;
      z-index: 3;
      justify-self: center;
      width: min(860px, 100%);
      text-align: center;
      animation: cmdr-fade-in 360ms var(--ease-default) both;
    }

    .cmdr-header__crest-row {
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: center;
      gap: 22px;
      width: min(500px, 74%);
      margin: 0 auto -2px;
    }

    .cmdr-header__line {
      height: 18px;
      object-fit: fill;
      opacity: 0.78;
      filter: drop-shadow(0 0 8px rgba(212, 168, 67, 0.24));
    }

    .cmdr-header__eagle {
      width: 72px;
      height: 40px;
      object-fit: contain;
      filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.84));
    }

    .cmdr-header__eyebrow {
      color: #f0d080;
      font-family: var(--font-display);
      font-size: 18px;
      letter-spacing: 10px;
      text-transform: uppercase;
      text-shadow: 0 2px 10px rgba(0, 0, 0, 0.9);
    }

    .cmdr-header__title-wrap {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 20px;
    }

    .cmdr-header__title {
      margin: 2px 0 0;
      color: #f5cf78;
      font-family: var(--font-display);
      font-size: clamp(50px, 5vw, 76px);
      font-weight: 600;
      line-height: 0.9;
      letter-spacing: 14px;
      text-transform: uppercase;
      text-shadow:
        0 1px 0 #fff0be,
        0 4px 0 #6d3f10,
        0 10px 22px rgba(0, 0, 0, 0.95),
        0 0 32px rgba(212, 168, 67, 0.38);
    }

    .cmdr-header__subtitle {
      margin-top: 7px;
      color: rgba(236, 213, 164, 0.76);
      font-family: var(--font-display);
      font-size: 14px;
      letter-spacing: 6px;
      text-transform: uppercase;
    }

    .cmdr-carousel {
      position: relative;
      z-index: 3;
      width: min(1160px, 100%);
      align-self: center;
      justify-self: center;
      display: grid;
      grid-template-columns: 58px minmax(0, 1fr) 58px;
      align-items: center;
      gap: 20px;
      animation: cmdr-fade-in 420ms 90ms var(--ease-default) both;
    }

    .cmdr-carousel__cards {
      min-width: 0;
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 18px;
      align-items: end;
    }

    .cmdr-carousel-arrow {
      position: relative;
      width: 58px;
      height: 58px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 0;
      background: transparent;
      cursor: pointer;
      padding: 0;
      filter: drop-shadow(0 6px 14px rgba(0, 0, 0, 0.78));
    }

    .cmdr-carousel-arrow img {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: contain;
      transition: filter 160ms var(--ease-default), transform 160ms var(--ease-default);
    }

    .cmdr-carousel-arrow:hover img {
      filter: brightness(1.18) drop-shadow(0 0 10px rgba(212, 168, 67, 0.42));
      transform: scale(1.04);
    }

    .cmdr-card-wrap {
      position: relative;
      min-width: 0;
      width: min(100%, 230px);
      justify-self: center;
      aspect-ratio: 0.68;
    }

    .cmdr-card {
      position: absolute;
      inset: 0;
      padding: 0;
      color: inherit;
      cursor: pointer;
      overflow: hidden;
      background: #09070d;
      border: 2px solid transparent;
      border-image: linear-gradient(155deg, #f0d080, #8f6a1e 48%, #e7c46f) 1;
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.6);
      transition: transform 180ms var(--ease-default), filter 180ms var(--ease-default), box-shadow 180ms var(--ease-default);
    }

    .cmdr-card::before {
      content: '';
      position: absolute;
      inset: 4px;
      z-index: 4;
      border: 1px solid rgba(240, 208, 128, 0.28);
      pointer-events: none;
    }

    .cmdr-card:hover {
      transform: translateY(-3px);
      box-shadow: 0 8px 26px rgba(0, 0, 0, 0.66), 0 0 16px rgba(240, 208, 128, 0.32);
    }

    .cmdr-card-wrap:not(.is-selected) .cmdr-card {
      filter: brightness(0.78) saturate(0.9);
    }

    .cmdr-card-wrap.is-selected .cmdr-card {
      border-image: linear-gradient(155deg, #ffe9a8, #f0d080 50%, #ffe9a8) 1;
      box-shadow:
        0 0 0 1px rgba(255, 233, 168, 0.5),
        0 0 26px rgba(240, 208, 128, 0.58),
        0 0 54px rgba(240, 208, 128, 0.24);
    }

    .cmdr-card-wrap.is-selected .cmdr-card::before {
      border-color: rgba(255, 233, 168, 0.55);
    }

    .cmdr-card__portrait,
    .cmdr-card__portrait-shade {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      user-select: none;
      -webkit-user-drag: none;
    }

    .cmdr-card__portrait {
      object-fit: cover;
      object-position: center top;
      z-index: 2;
      filter: saturate(0.94) contrast(1.02);
    }

    .cmdr-card__portrait-shade {
      z-index: 3;
      background:
        linear-gradient(180deg, rgba(4, 4, 5, 0.86), rgba(6, 5, 7, 0.12) 38%, rgba(4, 4, 5, 0.84) 100%),
        radial-gradient(ellipse at center, transparent 46%, rgba(0, 0, 0, 0.42) 100%);
    }

    .cmdr-card__top {
      position: absolute;
      z-index: 4;
      top: 7%;
      left: 8%;
      right: 6%;
      display: grid;
      grid-template-columns: 30px minmax(0, 1fr);
      gap: 7px;
      align-items: center;
      text-align: left;
    }

    .cmdr-card__icon,
    .cmdr-summary__icon,
    .cmdr-list-icon,
    .cmdr-victory-icon {
      object-fit: contain;
      flex: 0 0 auto;
      filter: drop-shadow(0 3px 8px rgba(0, 0, 0, 0.74));
    }

    .cmdr-card__icon {
      width: 30px;
      height: 30px;
    }

    .cmdr-card__culture {
      color: rgba(236, 213, 164, 0.88);
      font-size: clamp(8px, 0.6vw, 10px);
      font-weight: 700;
      letter-spacing: 0.8px;
      line-height: 1.15;
      text-transform: uppercase;
      text-shadow: 0 2px 6px rgba(0, 0, 0, 0.92);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .cmdr-card__archetype {
      margin-top: 2px;
      font-family: var(--font-display);
      font-size: clamp(14px, 1vw, 17px);
      font-weight: 700;
      letter-spacing: 0.8px;
      line-height: 1;
      text-transform: uppercase;
      white-space: nowrap;
      text-shadow: 0 2px 8px rgba(0, 0, 0, 0.95), 0 0 15px currentColor;
    }

    .cmdr-card__quote {
      position: absolute;
      z-index: 4;
      left: 10%;
      right: 10%;
      bottom: 9%;
      color: rgba(240, 231, 210, 0.92);
      font-size: clamp(11px, 0.9vw, 14px);
      font-style: italic;
      line-height: 1.35;
      text-align: center;
      text-shadow: 0 2px 8px rgba(0, 0, 0, 0.95);
    }

    .cmdr-panel {
      position: relative;
      z-index: 3;
      width: min(1420px, 100%);
      justify-self: center;
      padding: 42px 32px 30px;
      background: rgba(4, 5, 7, 0.68);
      border: 1px solid rgba(212, 168, 67, 0.58);
      box-shadow:
        inset 0 0 0 1px rgba(240, 208, 128, 0.12),
        inset 0 0 48px rgba(0, 0, 0, 0.46),
        0 16px 36px rgba(0, 0, 0, 0.46);
      animation: cmdr-fade-in 440ms 160ms var(--ease-default) both;
    }

    .cmdr-panel__frame {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: fill;
      z-index: -1;
      pointer-events: none;
      filter: drop-shadow(0 14px 30px rgba(0, 0, 0, 0.68));
      opacity: 0.82;
      display: none;
    }

    /* All commanders' detail grids are stacked in one grid cell so the panel is
       always sized to the TALLEST commander — switching commanders never resizes
       the panel. Only the selected grid is visible; hidden ones keep their
       layout box (visibility:hidden) so they still drive the shared height. */
    .cmdr-details-stack {
      display: grid;
    }
    .cmdr-details-stack > .cmdr-details-grid {
      grid-area: 1 / 1;
      transition: opacity 220ms var(--ease-default);
    }
    .cmdr-details-grid[data-active='false'] {
      visibility: hidden;
      opacity: 0;
      pointer-events: none;
    }
    .cmdr-details-grid {
      display: grid;
      grid-template-columns: 1.25fr 1fr 1fr 1fr;
      gap: 20px;
    }

    .cmdr-detail-column {
      min-width: 0;
      position: relative;
    }

    .cmdr-detail-column + .cmdr-detail-column::before {
      content: '';
      position: absolute;
      left: -14px;
      top: 4px;
      bottom: 0;
      width: 1px;
      background: linear-gradient(180deg, transparent, rgba(212, 168, 67, 0.38), transparent);
    }

    .cmdr-col-heading {
      color: #dfb85a;
      font-family: var(--font-display);
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 3.2px;
      text-transform: uppercase;
      white-space: nowrap;
    }

    .cmdr-section-underline {
      width: 100%;
      height: 1px;
      margin: 5px 0 9px;
      background: linear-gradient(90deg, rgba(223, 184, 90, 0.85), rgba(212, 168, 67, 0.42) 62%, transparent);
    }

    .cmdr-summary__head {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 6px;
    }

    .cmdr-summary__icon {
      width: 44px;
      height: 44px;
    }

    .cmdr-summary__title {
      font-family: var(--font-display);
      font-size: 22px;
      line-height: 1;
      letter-spacing: 3px;
      text-transform: uppercase;
      text-shadow: 0 2px 8px rgba(0, 0, 0, 0.9);
    }

    .cmdr-copy {
      color: rgba(232, 226, 210, 0.82);
      font-size: 12px;
      line-height: 1.38;
    }

    .cmdr-bonus-list {
      list-style: none;
      padding: 0;
      margin: 0;
      display: grid;
      gap: 3px;
    }

    .cmdr-bonus-list li {
      position: relative;
      padding-left: 18px;
      color: rgba(232, 226, 210, 0.8);
      font-size: 12px;
      line-height: 1.28;
    }

    .cmdr-bonus-list li::before {
      content: '';
      position: absolute;
      left: 1px;
      top: 0.58em;
      width: 6px;
      height: 6px;
      transform: rotate(45deg);
      background: #d7ad4b;
      box-shadow: 0 0 8px rgba(212, 168, 67, 0.44);
    }

    .cmdr-focus-row {
      display: flex;
      flex-wrap: wrap;
      gap: 7px;
    }

    .cmdr-focus-pill {
      border: 1px solid currentColor;
      background: rgba(0, 0, 0, 0.26);
      padding: 4px 10px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 1px;
      text-transform: uppercase;
    }

    .cmdr-ability-card,
    .cmdr-unit-item,
    .cmdr-victory-row {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 3px 8px 3px 0;
      background: linear-gradient(90deg, transparent, rgba(2, 3, 5, 0.34));
    }

    .cmdr-ability-card {
      min-height: 66px;
      padding: 8px 10px;
      border: 1px solid rgba(212, 168, 67, 0.14);
      background: linear-gradient(180deg, rgba(7, 8, 11, 0.64), rgba(2, 3, 5, 0.44));
      box-shadow: inset 0 0 20px rgba(0, 0, 0, 0.28);
    }

    .cmdr-list-stack {
      display: grid;
      gap: 8px;
    }

    .cmdr-list-icon {
      width: 42px;
      height: 42px;
    }

    .cmdr-list-title {
      color: #e7bd60;
      font-family: var(--font-display);
      font-size: 15px;
      line-height: 1.1;
      letter-spacing: 1.4px;
      text-transform: uppercase;
    }

    .cmdr-list-body {
      margin-top: 3px;
      color: rgba(232, 226, 210, 0.74);
      font-size: 11px;
      line-height: 1.3;
    }

    .cmdr-stars {
      margin-left: auto;
      color: currentColor;
      font-weight: 800;
      white-space: nowrap;
    }

    .cmdr-victory-icon {
      width: 40px;
      height: 40px;
    }

    .cmdr-victory-dots {
      margin-left: auto;
      display: inline-flex;
      gap: 5px;
      padding-top: 7px;
      white-space: nowrap;
    }

    .cmdr-victory-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      border: 1px solid rgba(212, 168, 67, 0.45);
      background: transparent;
    }

    .cmdr-victory-dot.is-filled {
      background: #e0b45b;
      box-shadow: 0 0 8px rgba(212, 168, 67, 0.42);
    }

    .cmdr-bottom-bar {
      margin-top: 10px;
      padding-top: 9px;
      border-top: 1px solid rgba(212, 168, 67, 0.28);
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: center;
      gap: 16px;
    }

    .cmdr-secondary-btn,
    .cmdr-cta-btn {
      position: relative;
      border-radius: 3px;
      font-family: var(--font-display);
      text-transform: uppercase;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition:
        transform 160ms var(--ease-default),
        border-color 200ms var(--ease-default),
        color 200ms var(--ease-default),
        box-shadow 200ms var(--ease-default),
        background 200ms var(--ease-default);
    }

    .cmdr-secondary-btn::before,
    .cmdr-cta-btn::before {
      content: '';
      position: absolute;
      inset: 5px;
      border: 1px solid rgba(212, 168, 67, 0.42);
      pointer-events: none;
    }

    .cmdr-cta-btn {
      justify-self: end;
      min-width: min(360px, 100%);
      min-height: 58px;
      padding: 0 32px;
      gap: 14px;
      border: 2px solid rgba(212, 168, 67, 0.82);
      background:
        linear-gradient(180deg, rgba(18, 22, 26, 0.94), rgba(9, 11, 14, 0.92)),
        radial-gradient(ellipse at center, rgba(212, 168, 67, 0.1), transparent 64%);
      color: #f3cb74;
      letter-spacing: 3px;
      font-size: 18px;
      font-weight: 600;
      cursor: pointer;
      box-shadow:
        0 0 0 1px rgba(0, 0, 0, 0.88),
        inset 0 0 0 2px rgba(240, 208, 128, 0.16),
        inset 0 0 30px rgba(0, 0, 0, 0.7),
        0 10px 24px rgba(0, 0, 0, 0.56);
      text-shadow: 0 2px 6px rgba(0, 0, 0, 0.95), 0 0 16px rgba(212, 168, 67, 0.22);
    }

    .cmdr-cta-btn:hover {
      transform: translateY(-2px);
      color: #ffe5a5;
      border-color: rgba(240, 208, 128, 0.96);
      background:
        linear-gradient(180deg, rgba(34, 26, 18, 0.96), rgba(13, 14, 16, 0.94)),
        radial-gradient(ellipse at center, rgba(212, 168, 67, 0.22), transparent 68%);
      box-shadow:
        0 0 0 1px rgba(0, 0, 0, 0.88),
        inset 0 0 0 2px rgba(240, 208, 128, 0.26),
        inset 0 0 32px rgba(212, 168, 67, 0.08),
        0 0 22px rgba(212, 168, 67, 0.22),
        0 14px 28px rgba(0, 0, 0, 0.62);
    }

    .cmdr-cta-btn:active {
      transform: translateY(0);
    }

    .cmdr-cta-btn img {
      width: 26px;
      height: 26px;
      object-fit: contain;
      filter: drop-shadow(0 0 6px rgba(212, 168, 67, 0.4));
    }

    .cmdr-secondary-btn {
      justify-self: start;
      min-width: 250px;
      min-height: 48px;
      padding: 0 20px;
      gap: 10px;
      border: 1px solid rgba(212, 168, 67, 0.5);
      background: linear-gradient(180deg, rgba(16, 18, 22, 0.9), rgba(8, 9, 12, 0.88));
      color: #d9ae50;
      letter-spacing: 2px;
      font-size: 13px;
      font-weight: 600;
      cursor: not-allowed;
      box-shadow:
        inset 0 0 0 1px rgba(240, 208, 128, 0.1),
        0 6px 16px rgba(0, 0, 0, 0.5);
    }

    .cmdr-secondary-btn:disabled {
      opacity: 0.5;
      filter: saturate(0.6);
    }

    .cmdr-secondary-btn img {
      width: 22px;
      height: 22px;
      object-fit: contain;
      opacity: 0.85;
    }

    .cmdr-difficulty {
      display: flex;
      align-items: center;
      gap: 10px;
      color: rgba(236, 213, 164, 0.54);
      font-family: var(--font-display);
      font-size: 13px;
      letter-spacing: 4px;
      text-transform: uppercase;
      white-space: nowrap;
    }

    .cmdr-difficulty img {
      width: 34px;
      height: 34px;
      object-fit: contain;
      opacity: 0.7;
    }

    .cmdr-esc-btn {
      position: absolute;
      z-index: 5;
      top: 22px;
      right: 26px;
      width: 38px;
      height: 38px;
      border: 1px solid rgba(212, 168, 67, 0.52);
      border-radius: 50%;
      background: rgba(5, 5, 7, 0.64);
      color: #d9ae50;
      font-family: var(--font-display);
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 0 14px rgba(0, 0, 0, 0.78);
    }

    @media (max-width: 1240px) {
      .cmdr-screen {
        padding-inline: 28px;
      }
      .cmdr-side-banner {
        opacity: 0.38;
      }
      .cmdr-details-grid {
        grid-template-columns: 1.12fr 1fr 1fr;
      }
      .cmdr-detail-column:last-child {
        grid-column: 1 / -1;
      }
      .cmdr-detail-column:last-child::before {
        display: none;
      }
    }

    @media (max-width: 860px) {
      .cmdr-screen {
        min-height: 100dvh;
        overflow-y: auto;
        grid-template-rows: auto auto auto;
        padding: 42px 22px 26px;
      }
      .cmdr-side-banner {
        display: none;
      }
      .cmdr-header__crest-row {
        width: min(330px, 82%);
        gap: 12px;
      }
      .cmdr-header__eagle {
        width: 64px;
      }
      .cmdr-header__eyebrow {
        font-size: 14px;
        letter-spacing: 6px;
      }
      .cmdr-header__title {
        font-size: clamp(34px, 10vw, 42px);
        letter-spacing: 4px;
      }
      .cmdr-header__subtitle {
        font-size: 11px;
        letter-spacing: 3px;
      }
      .cmdr-carousel {
        grid-template-columns: 48px minmax(0, 1fr) 48px;
        gap: 8px;
      }
      .cmdr-carousel__cards {
        grid-template-columns: 1fr;
        width: min(310px, 100%);
        justify-self: center;
      }
      .cmdr-card-wrap {
        display: none;
      }
      .cmdr-card-wrap.is-selected {
        display: block;
      }
      .cmdr-carousel-arrow {
        width: 48px;
        height: 48px;
      }
      .cmdr-panel {
        padding: 42px 24px 26px;
        border: 1px solid rgba(212, 168, 67, 0.52);
        box-shadow: inset 0 0 0 1px rgba(240, 208, 128, 0.12);
      }
      .cmdr-panel__frame {
        display: none;
      }
      .cmdr-details-grid {
        grid-template-columns: 1fr;
        gap: 18px;
      }
      .cmdr-detail-column::before {
        display: none;
      }
      .cmdr-bottom-bar {
        grid-template-columns: 1fr;
      }
      .cmdr-secondary-btn,
      .cmdr-difficulty,
      .cmdr-cta-btn {
        justify-self: stretch;
      }
      .cmdr-difficulty {
        justify-content: center;
      }
    }
  `;
  document.head.appendChild(el);
}

function AssetImage({
  className,
  src,
  alt = '',
}: {
  className?: string;
  src: string;
  alt?: string;
}) {
  return <img class={className} src={src} alt={alt} aria-hidden={alt ? undefined : 'true'} />;
}

function EscButton() {
  return (
    <button class="cmdr-esc-btn" type="button" onClick={() => navigateTo('title')} aria-label="Back to title">
      X
    </button>
  );
}

function CarouselArrow({ dir, onClick }: { dir: 'left' | 'right'; onClick: () => void }) {
  return (
    <button class="cmdr-carousel-arrow" type="button" onClick={onClick} aria-label={dir === 'left' ? 'Previous commander' : 'Next commander'}>
      <AssetImage src={dir === 'left' ? COMMANDER_UI_ASSETS.carouselLeft : COMMANDER_UI_ASSETS.carouselRight} />
    </button>
  );
}

function ScreenChrome() {
  return (
    <>
      <AssetImage className="cmdr-side-banner cmdr-side-banner--left" src={COMMANDER_UI_ASSETS.sideBannerLeft} />
      <AssetImage className="cmdr-side-banner cmdr-side-banner--right" src={COMMANDER_UI_ASSETS.sideBannerRight} />
    </>
  );
}

function CommanderHeader() {
  return (
    <header class="cmdr-header">
      <div class="cmdr-header__crest-row">
        <AssetImage className="cmdr-header__line" src={COMMANDER_UI_ASSETS.headerLineLeft} />
        <AssetImage className="cmdr-header__eagle" src={COMMANDER_UI_ASSETS.headerEagle} />
        <AssetImage className="cmdr-header__line" src={COMMANDER_UI_ASSETS.headerLineRight} />
      </div>
      <div class="cmdr-header__eyebrow">Choose Your</div>
      <div class="cmdr-header__title-wrap">
        <h1 class="cmdr-header__title">Commander</h1>
      </div>
      <div class="cmdr-header__subtitle">Lead your civilization. Shape history.</div>
    </header>
  );
}

function CommanderCard({
  commander,
  isSelected,
  onClick,
}: {
  commander: Commander;
  isSelected: boolean;
  onClick: () => void;
}) {
  const color = ARCHETYPE_COLORS[commander.archetype];

  return (
    <div class={`cmdr-card-wrap${isSelected ? ' is-selected' : ''}`}>
      <button class="cmdr-card" type="button" onClick={onClick} aria-pressed={isSelected}>
        <img
          class="cmdr-card__portrait"
          src={commander.portrait}
          alt=""
          style={{ objectPosition: commander.portraitPosition ?? 'center top' }}
        />
        <div class="cmdr-card__portrait-shade" />
        <div class="cmdr-card__top">
          <AssetImage className="cmdr-card__icon" src={ARCHETYPE_ICON_ASSETS[commander.archetype]} />
          <div>
            <div class="cmdr-card__culture">{commander.culture}</div>
            <div class="cmdr-card__archetype" style={{ color }}>{commander.archetype}</div>
          </div>
        </div>
        <div class="cmdr-card__quote">"{commander.quote}"</div>
      </button>
    </div>
  );
}

function SectionHeading({ children }: { children: string }) {
  return (
    <>
      <div class="cmdr-col-heading">{children}</div>
      <div class="cmdr-section-underline" aria-hidden="true" />
    </>
  );
}

function ArchetypeSummary({ commander }: { commander: Commander }) {
  const color = ARCHETYPE_COLORS[commander.archetype];

  return (
    <div class="cmdr-detail-column">
      <div class="cmdr-summary__head">
        <AssetImage className="cmdr-summary__icon" src={ARCHETYPE_ICON_ASSETS[commander.archetype]} />
        <div class="cmdr-summary__title" style={{ color }}>{commander.archetype}</div>
      </div>
      <div class="cmdr-copy">{commander.archetypeDescription}</div>

      <SectionHeading>Starting Bonuses</SectionHeading>
      <ul class="cmdr-bonus-list">
        {commander.startingBonuses.map((bonus) => <li key={bonus}>{bonus}</li>)}
      </ul>

      <SectionHeading>Playstyle Focus</SectionHeading>
      <div class="cmdr-focus-row">
        {commander.playstyleFocus.map((tag) => (
          <span key={tag} class="cmdr-focus-pill" style={{ color }}>{tag}</span>
        ))}
      </div>
    </div>
  );
}

function AbilityListItem({
  ability,
  color,
}: {
  ability: { name: string; description: string; stars: number };
  color: string;
}) {
  return (
    <div class="cmdr-ability-card">
      <AssetImage className="cmdr-list-icon" src={ABILITY_ICON_ASSETS[ability.name] ?? asset('036_icon_ability_sunburst.png')} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <div class="cmdr-list-title" style={{ color }}>{ability.name}</div>
          <div class="cmdr-stars" style={{ color }}>{'*'.repeat(ability.stars)}</div>
        </div>
        <div class="cmdr-list-body">{ability.description}</div>
      </div>
    </div>
  );
}

function StrategicAbilitiesColumn({ commander }: { commander: Commander }) {
  const color = ARCHETYPE_COLORS[commander.archetype];

  return (
    <div class="cmdr-detail-column">
      <SectionHeading>Strategic Abilities</SectionHeading>
      <div class="cmdr-list-stack">
        {commander.strategicAbilities.map((ability) => (
          <AbilityListItem key={ability.name} ability={ability} color={color} />
        ))}
      </div>
    </div>
  );
}

function UnitListItem({
  unit,
  icon,
}: {
  unit: { name: string; description: string };
  icon: string;
}) {
  return (
    <div class="cmdr-unit-item">
      <AssetImage className="cmdr-list-icon" src={icon} />
      <div style={{ minWidth: 0 }}>
        <div class="cmdr-list-title">{unit.name}</div>
        <div class="cmdr-list-body">{unit.description}</div>
      </div>
    </div>
  );
}

function UniqueUnitsColumn({ commander }: { commander: Commander }) {
  const icons = UNIT_ICON_ASSETS[commander.archetype];

  return (
    <div class="cmdr-detail-column">
      <SectionHeading>Unique Units & Improvements</SectionHeading>
      <div class="cmdr-list-stack">
        {commander.uniqueUnits.map((unit, index) => (
          <UnitListItem key={unit.name} unit={unit} icon={icons[index] ?? icons[0]} />
        ))}
      </div>
    </div>
  );
}

function VictoryPathRow({ path }: { path: { name: string; description: string; progress: number } }) {
  return (
    <div class="cmdr-victory-row">
      <AssetImage className="cmdr-victory-icon" src={VICTORY_ICON_ASSETS[path.name] ?? asset('056_icon_victory_laurel.png')} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div class="cmdr-list-title">{path.name}</div>
        <div class="cmdr-list-body">{path.description}</div>
      </div>
      <div class="cmdr-victory-dots" aria-hidden="true">
        {Array.from({ length: 5 }, (_, index) => (
          <span key={index} class={`cmdr-victory-dot${index < path.progress ? ' is-filled' : ''}`} />
        ))}
      </div>
    </div>
  );
}

function VictoryPathsColumn({ commander }: { commander: Commander }) {
  return (
    <div class="cmdr-detail-column">
      <SectionHeading>Victory Paths</SectionHeading>
      <div class="cmdr-list-stack">
        {commander.victoryPaths.map((path) => <VictoryPathRow key={path.name} path={path} />)}
      </div>
    </div>
  );
}

function DifficultyPlaceholder() {
  return (
    <div class="cmdr-difficulty" title="Coming soon">
      <span>Difficulty</span>
      <AssetImage src={COMMANDER_UI_ASSETS.selected_diamond} />
      <span>Soon</span>
    </div>
  );
}

function beginRun() {
  if (selecting.value) return;
  const commander = COMMANDERS[selectedIndex.value];
  selecting.value = true;
  startNewRun(commander);
  setTimeout(() => navigateTo('hub'), 300);
}

export function CommanderSelectScreen() {
  useEffect(() => {
    selectedIndex.value = 0;
    selecting.value = false;

    function handleKey(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') selectedIndex.value = (selectedIndex.value + COMMANDERS.length - 1) % COMMANDERS.length;
      if (e.key === 'ArrowRight') selectedIndex.value = (selectedIndex.value + 1) % COMMANDERS.length;
      if (e.key === 'Enter') beginRun();
      if (e.key === 'Escape') navigateTo('title');
    }

    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('keydown', handleKey);
      selectedIndex.value = 0;
      selecting.value = false;
    };
  }, []);

  const commander = COMMANDERS[selectedIndex.value];

  return (
    <div class="cmdr-screen">
      <div class="cmdr-bg" aria-hidden="true">
        <picture>
          {bgPicture.sources.avif && <source type="image/avif" srcSet={bgPicture.sources.avif} />}
          {bgPicture.sources.webp && <source type="image/webp" srcSet={bgPicture.sources.webp} />}
          <img src={bgPicture.img.src} alt="" width={bgPicture.img.w} height={bgPicture.img.h} />
        </picture>
      </div>

      <ScreenChrome />
      <EscButton />
      <CommanderHeader />

      <main class="cmdr-carousel" aria-label="Choose commander">
        <CarouselArrow dir="left" onClick={() => { selectedIndex.value = (selectedIndex.value + COMMANDERS.length - 1) % COMMANDERS.length; }} />
        <div class="cmdr-carousel__cards">
          {COMMANDERS.map((candidate, index) => (
            <CommanderCard
              key={candidate.id}
              commander={candidate}
              isSelected={selectedIndex.value === index}
              onClick={() => { selectedIndex.value = index; }}
            />
          ))}
        </div>
        <CarouselArrow dir="right" onClick={() => { selectedIndex.value = (selectedIndex.value + 1) % COMMANDERS.length; }} />
      </main>

      <section class="cmdr-panel" aria-label={`${commander.archetype} details`}>
        <AssetImage className="cmdr-panel__frame" src={COMMANDER_UI_ASSETS.panelFrameLarge} />
        <div class="cmdr-details-stack">
          {COMMANDERS.map((candidate, index) => {
            const active = selectedIndex.value === index;
            return (
              <div
                key={candidate.id}
                class="cmdr-details-grid"
                data-active={active ? 'true' : 'false'}
                aria-hidden={active ? undefined : 'true'}
              >
                <ArchetypeSummary commander={candidate} />
                <StrategicAbilitiesColumn commander={candidate} />
                <UniqueUnitsColumn commander={candidate} />
                <VictoryPathsColumn commander={candidate} />
              </div>
            );
          })}
        </div>

        <div class="cmdr-bottom-bar">
          <button class="cmdr-secondary-btn" type="button" disabled title="Coming soon">
            <AssetImage src={VICTORY_ICON_ASSETS.Cultural} />
            <span>View Civilization Details</span>
          </button>
          <DifficultyPlaceholder />
          <button class="cmdr-cta-btn" type="button" onClick={beginRun}>
            <span>Begin Your Legacy</span>
            <AssetImage src={COMMANDER_UI_ASSETS.crown} />
          </button>
        </div>
      </section>
    </div>
  );
}
