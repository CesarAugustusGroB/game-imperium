import { playSfx } from '../../sound/sfx';
import { iterBelliState, iterBelliLog, camp, playCard, currentLocation } from '../../../game/iterBelli/iter-belli-state';
import { POOL_TARGET_SIZE, CAMP_SUPPLY_COST, CAMP_MORALE_GAIN } from '../../../game/iterBelli/iter-belli-balance';
import { getMissionById } from '../../../data/iter-belli-consilium';
import { isCrisisDef } from '../../../game/iterBelli/iter-belli-types';
import { CampaignResourceBar } from './CampaignResourceBar';
import { Itinerary } from './Itinerary';
import { OperationCard } from './OperationCard';
import { CampaignLog } from './CampaignLog';
import { BattleModal } from './BattleModal';
import { EndgameCard } from './EndgameCard';
import { ResourceAmount } from '../../components/ResourceIcon';

// ── CSS injection (idempotent; refreshes content on HMR re-execution) ──
if (typeof document !== 'undefined') {
  const el = document.getElementById('iterbelli-styles') ?? document.createElement('style');
  el.id = 'iterbelli-styles';
  el.textContent = `
  .ib-screen {
    min-height: 100vh; box-sizing: border-box;
    padding: 22px clamp(16px, 4vw, 48px) 32px;
    background:
      radial-gradient(ellipse 1200px 600px at 50% 0%, rgba(122, 36, 50, 0.10), transparent 60%),
      linear-gradient(180deg, var(--imp-ink-soft) 0%, var(--imp-ink) 100%);
    color: var(--imp-text);
    font-family: var(--imp-font-body);
  }
  .ib-head { text-align: center; margin-bottom: 14px; }
  .ib-head .eyebrow { font-size: var(--imp-text-xs); letter-spacing: var(--imp-title-letter); text-transform: uppercase; color: var(--imp-gold-mid); }
  .ib-head h1 {
    font-family: var(--imp-font-display); font-weight: 600; font-size: clamp(26px, 4vw, 40px);
    letter-spacing: 4px; color: var(--imp-gold-hi); margin: 2px 0 0; text-shadow: 0 2px 12px rgba(0,0,0,0.6);
  }
  .ib-head .sub { font-style: italic; color: var(--imp-text-mid); font-size: 13px; }
  .ib-mission { margin-top: 6px; font-family: var(--imp-font-display); font-size: 13px; letter-spacing: 1px; color: var(--imp-gold); }
  .ib-mission-cond { color: var(--imp-text-mid); letter-spacing: 0; }

  /* ── Resource bar ── */
  .ib-resbar { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; margin-bottom: 14px; }
  .ib-res, .ib-clock {
    position: relative;
    display: flex; flex-direction: column; align-items: center; gap: 2px;
    min-width: 92px; padding: 7px 12px;
    background: var(--imp-panel); border: 1px solid var(--imp-gold-faint); border-radius: var(--radius-sm);
    transition: background var(--duration-fast) var(--ease-default), border-color var(--duration-fast) var(--ease-default);
  }
  .ib-res-label { font-size: var(--imp-text-xs); letter-spacing: var(--imp-meta-letter); text-transform: uppercase; color: var(--imp-text-mid); }
  .ib-res-value { font-family: var(--imp-font-mono); font-size: 17px; font-weight: 600; color: var(--imp-text-hi); transition: color var(--duration-fast) var(--ease-default); }
  .ib-res.warn { border-color: rgba(212,168,67,0.55); }
  .ib-res.warn .ib-res-value { color: var(--imp-gold-hi); }
  .ib-res.alert, .ib-clock.alert { border-color: var(--imp-danger); background: rgba(125,20,20,0.18); }
  .ib-res.alert .ib-res-value, .ib-clock.alert .ib-res-value { color: var(--imp-crimson); }

  /* ── Per-turn delta flash: green on gain, red on loss ── */
  @keyframes ib-flash-down { 0% { box-shadow: 0 0 0 2px rgba(194,74,58,0.9), 0 0 16px rgba(194,74,58,0.5); border-color: var(--imp-crimson); } 100% { box-shadow: none; } }
  @keyframes ib-flash-up { 0% { box-shadow: 0 0 0 2px rgba(122,168,106,0.9), 0 0 16px rgba(122,168,106,0.5); border-color: #7aa86a; } 100% { box-shadow: none; } }
  .ib-res.flash-down { animation: ib-flash-down 1.6s var(--ease-default); }
  .ib-res.flash-up { animation: ib-flash-up 1.6s var(--ease-default); }
  .ib-res.flash-down .ib-res-value { color: var(--imp-crimson); }
  .ib-res.flash-up .ib-res-value { color: #8fbe7e; }
  @keyframes ib-delta-float { 0% { opacity: 0; transform: translate(-50%, 4px); } 18% { opacity: 1; } 78% { opacity: 1; } 100% { opacity: 0; transform: translate(-50%, -16px); } }
  .ib-res-delta {
    position: absolute; top: -6px; left: 50%; transform: translateX(-50%);
    font-family: var(--imp-font-mono); font-size: 14px; font-weight: 700;
    padding: 1px 7px; border-radius: 999px; pointer-events: none; white-space: nowrap;
    animation: ib-delta-float 1.6s var(--ease-default) forwards; z-index: 5;
  }
  .ib-res-delta.up { color: #0c1a0c; background: #8fbe7e; }
  .ib-res-delta.down { color: #fff; background: var(--imp-crimson); }

  /* ── Itinerary ── */
  .ib-itinerary { display: flex; align-items: center; justify-content: center; gap: 4px; margin-bottom: 16px; flex-wrap: wrap; }
  .ib-stop { display: flex; flex-direction: column; align-items: center; gap: 4px; width: 78px; text-align: center; opacity: 0.55; }
  .ib-stop.visited { opacity: 0.85; }
  .ib-stop.current { opacity: 1; }
  .ib-dot { width: 12px; height: 12px; border-radius: 50%; border: 2px solid var(--imp-gold-mid); background: var(--imp-ink); }
  .ib-stop.visited .ib-dot { background: var(--imp-gold-mid); }
  .ib-stop.current .ib-dot { background: var(--imp-gold-hi); box-shadow: 0 0 10px rgba(240,208,128,0.7); border-color: var(--imp-gold-hi); }
  .ib-stop.objective .ib-dot { border-color: var(--imp-crimson); }
  .ib-stop.objective.current .ib-dot { background: var(--imp-crimson); box-shadow: 0 0 10px rgba(178,58,58,0.8); }
  .ib-stop-name { font-size: var(--imp-text-xs); letter-spacing: 0.5px; text-transform: uppercase; color: var(--imp-text-mid); }
  .ib-stop.current .ib-stop-name { color: var(--imp-gold-hi); }
  .ib-line { width: 28px; height: 2px; background: var(--imp-gold-faint); }
  .ib-line.done { background: var(--imp-gold-mid); }

  /* ── Main layout ── */
  .ib-main { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 16px; align-items: start; }
  @media (max-width: 900px) { .ib-main { grid-template-columns: 1fr; } }
  .ib-location {
    padding: 14px 18px; margin-bottom: 14px;
    background: var(--imp-panel); border: 1px solid var(--imp-gold-faint); border-left: 3px solid var(--imp-gold); border-radius: var(--radius-sm);
  }
  .ib-location-name { font-family: var(--imp-font-display); font-size: 19px; letter-spacing: 1px; color: var(--imp-gold-hi); }
  .ib-location-desc { font-size: 13px; color: var(--imp-text-mid); margin-top: 4px; line-height: 1.45; }

  .ib-pool { display: grid; grid-template-columns: repeat(auto-fill, minmax(216px, 1fr)); gap: 12px; }
  .ib-card-ph { border: 2px dashed var(--imp-gold-faint); border-radius: 3px; min-height: 220px; opacity: 0.25; }

  .ib-actions { margin-top: 14px; display: flex; gap: 10px; flex-wrap: wrap; }
  .ib-camp-btn {
    padding: 10px 18px; border-radius: var(--radius-sm); cursor: pointer;
    background: var(--imp-panel-soft); border: 1px solid var(--imp-gold-dim); color: var(--imp-text);
    font-family: var(--imp-font-body); font-size: 13px; letter-spacing: 0.5px;
    transition: border-color var(--duration-fast) var(--ease-default), background var(--duration-fast) var(--ease-default);
  }
  .ib-camp-btn:hover { border-color: var(--imp-gold); background: var(--imp-panel-hover); }
  .ib-camp-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  /* ── Operation card ── */
  .ib-card {
    position: relative; padding: 14px 14px 12px; border-radius: 3px;
    background: linear-gradient(180deg, color-mix(in srgb, var(--card-color, #d4a843) 14%, transparent), rgba(22,19,34,0.96) 70%);
    border: 1px solid var(--imp-gold-faint); border-top: 3px solid var(--card-color, #d4a843);
    display: flex; flex-direction: column; gap: 7px; cursor: pointer;
    transition: transform var(--duration-fast) var(--ease-default), box-shadow var(--duration-fast) var(--ease-default), border-color var(--duration-fast) var(--ease-default);
  }
  .ib-card:hover { transform: translateY(-2px); box-shadow: 0 6px 18px rgba(0,0,0,0.5); border-color: var(--imp-gold-dim); }
  .ib-card.disabled { opacity: 0.45; cursor: not-allowed; filter: grayscale(0.4); }
  .ib-card.disabled:hover { transform: none; box-shadow: none; }
  .ib-card.crisis { border-top-color: var(--imp-crimson); background: linear-gradient(180deg, rgba(125,20,20,0.22), rgba(22,19,34,0.96) 70%); cursor: default; }
  .ib-card.commitment { border-style: dashed; }
  .ib-card.arriesgada { border-top-style: double; border-top-width: 4px; }
  .ib-card.quest { border-top-width: 4px; border-color: var(--imp-gold-faint); }
  .ib-card-timer { position: absolute; top: 8px; right: 8px; font-family: var(--imp-font-mono); font-size: var(--imp-text-xs); color: var(--imp-text-mid); background: rgba(0,0,0,0.35); padding: 1px 6px; border-radius: 8px; }
  .ib-card-timer.urgent { color: var(--imp-crimson); }
  .ib-card-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: var(--imp-text-xs); letter-spacing: var(--imp-meta-letter); text-transform: uppercase; color: var(--card-color, var(--imp-gold)); font-weight: 700; }
  .ib-card-icon { margin-right: 2px; }
  .ib-card-name { font-family: var(--imp-font-display); font-size: 17px; font-weight: 600; color: var(--imp-text-hi); line-height: 1.15; }
  .ib-card-desc { font-size: 12px; color: var(--imp-text-mid); line-height: 1.4; flex: 1; }
  .ib-card-effects { display: flex; flex-direction: column; gap: 3px; border-top: 1px solid var(--imp-gold-faint); padding-top: 7px; }
  .ib-effect { display: flex; justify-content: space-between; align-items: center; font-size: 12px; }
  .ib-effect .label { color: var(--imp-text-mid); }
  .ib-effect .pos { color: var(--imp-oxidize); font-weight: 600; }
  .ib-effect .neg { color: var(--imp-crimson); font-weight: 600; }
  .ib-gamble-chance { text-align: center; font-family: var(--imp-font-mono); font-size: 12px; color: var(--imp-gold-hi); margin-top: 4px; }
  .ib-gamble-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 4px; }
  .ib-gamble-col { padding: 6px; border-radius: 3px; background: rgba(0,0,0,0.22); }
  .ib-gamble-col.success { border: 1px solid rgba(122,154,106,0.4); }
  .ib-gamble-col.failure { border: 1px solid rgba(178,58,58,0.4); }
  .ib-gamble-col-title { font-size: var(--imp-text-xs); text-transform: uppercase; letter-spacing: var(--imp-meta-letter); color: var(--imp-text-mid); margin-bottom: 3px; }
  .ib-commit-penalty { font-size: var(--imp-text-sm); font-style: italic; color: var(--imp-gold-mid); border-top: 1px dashed var(--imp-gold-faint); padding-top: 6px; }

  /* ── Log ── */
  .ib-log {
    background: var(--imp-panel); border: 1px solid var(--imp-gold-faint); border-radius: var(--radius-sm);
    padding: 12px 14px; max-height: 60vh; overflow-y: auto; display: flex; flex-direction: column; gap: 5px;
    font-size: 12px; line-height: 1.4;
  }
  .ib-log-line { color: var(--imp-text-mid); }
  .ib-log-line.turn { color: var(--imp-gold-hi); font-weight: 600; border-top: 1px solid var(--imp-gold-faint); padding-top: 6px; margin-top: 2px; }
  .ib-log-line.event { color: var(--imp-text); }
  .ib-log-line.battle { color: var(--imp-crimson); font-weight: 600; }
  .ib-log-line.crisis { color: var(--imp-crimson); font-weight: 600; padding-left: 8px; border-left: 3px solid var(--imp-crimson); }

  /* (.ib-overlay retired — BattleModal & EndgameCard now use the shared <Modal>.) */
  .ib-section-title { font-family: var(--imp-font-display); font-size: var(--imp-text-lg); letter-spacing: var(--imp-title-letter); text-transform: uppercase; color: var(--imp-gold-hi); margin-bottom: 8px; }

  /* ── Battle modal ── */
  .ib-bm-arena { display: grid; grid-template-columns: 1fr auto 1fr; gap: 14px; align-items: stretch; margin-bottom: 14px; }
  @media (max-width: 640px) { .ib-bm-arena { grid-template-columns: 1fr; } }
  .ib-bm-army { background: var(--imp-panel); border: 1px solid var(--imp-gold-faint); border-radius: var(--radius-sm); padding: 12px; display: flex; flex-direction: column; gap: 6px; }
  .ib-bm-army-name { font-family: var(--imp-font-display); font-size: 16px; color: var(--imp-gold-hi); }
  .ib-bm-army-meta { font-size: var(--imp-text-xs); letter-spacing: var(--imp-meta-letter); text-transform: uppercase; color: var(--imp-text-mid); }
  .ib-bm-flags { display: flex; gap: 4px; flex-wrap: wrap; min-height: 18px; }
  .ib-bm-flag { font-size: var(--imp-text-xs); padding: 1px 6px; border-radius: 8px; background: rgba(0,0,0,0.3); color: var(--imp-text-mid); border: 1px solid var(--imp-gold-faint); }
  .ib-bm-flag.danger { color: var(--imp-crimson); border-color: var(--imp-danger); }
  .ib-bm-stat-row { display: flex; justify-content: space-between; font-size: var(--imp-text-sm); color: var(--imp-text-mid); margin-bottom: 2px; }
  .ib-bm-stat-row.stats { margin-top: auto; padding-top: 4px; border-top: 1px solid var(--imp-gold-faint); font-family: var(--imp-font-mono); font-size: 11px; justify-content: center; gap: 10px; }
  .ib-bm-pstat { display: inline-flex; align-items: center; gap: 3px; color: var(--imp-text-mid); }
  .ib-bm-bar { height: 6px; border-radius: 3px; background: rgba(0,0,0,0.4); overflow: hidden; }
  .ib-bm-bar-fill { height: 100%; background: var(--imp-gold); transition: width var(--duration-slow) var(--ease-default); }
  .ib-bm-bar-fill.morale { background: var(--imp-lapis); }
  .ib-bm-stance-active { align-self: flex-start; font-size: var(--imp-text-xs); padding: 2px 8px; border-radius: 8px; background: rgba(212,168,67,0.14); color: var(--imp-gold-hi); border: 1px solid var(--imp-gold-faint); }
  /* ── Center column: round + dice + control track ── */
  .ib-bm-center { display: flex; flex-direction: column; align-items: stretch; justify-content: flex-start; gap: 8px; min-width: 250px; max-width: 290px; }
  .ib-bm-dice { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .ib-bm-die { display: flex; flex-direction: column; align-items: center; gap: 1px; padding: 6px 4px 5px; border-radius: 6px; background: rgba(0,0,0,0.35); border: 1px solid var(--imp-gold-dim); }
  .ib-bm-die.you { border-top: 2px solid var(--imp-gold); }
  .ib-bm-die.en { border-top: 2px solid var(--imp-crimson); }
  .ib-bm-die-label { font-size: var(--imp-text-xs); letter-spacing: var(--imp-meta-letter); text-transform: uppercase; color: var(--imp-text-mid); }
  .ib-bm-die-face { font-family: var(--imp-font-mono); font-size: 26px; font-weight: 700; line-height: 1.1; color: var(--imp-gold-hi); }
  .ib-bm-die.en .ib-bm-die-face { color: #e08a7a; }
  .ib-bm-die-meta { font-family: var(--imp-font-mono); font-size: 10px; color: var(--imp-text-lo); }
  .ib-bm-die-meta .bonus { color: var(--imp-oxidize); }
  .ib-bm-die-order { font-size: var(--imp-text-xs); color: var(--imp-text-mid); text-align: center; line-height: 1.2; min-height: 2.4em; display: flex; align-items: center; }
  .ib-bm-centerbox { background: rgba(0,0,0,0.25); border: 1px solid var(--imp-gold-faint); border-radius: var(--radius-sm); padding: 8px 10px; display: flex; flex-direction: column; gap: 5px; }
  .ib-bm-center-name { font-size: var(--imp-text-xs); letter-spacing: var(--imp-meta-letter); text-transform: uppercase; color: var(--imp-gold-hi); text-align: center; }
  .ib-bm-center-desc { font-size: var(--imp-text-xs); color: var(--imp-text-mid); text-align: center; line-height: 1.3; min-height: 2.6em; }
  .ib-bm-track { position: relative; height: 10px; border-radius: 5px; background: rgba(0,0,0,0.45); border: 1px solid var(--imp-gold-faint); overflow: visible; }
  .ib-bm-track-zone { position: absolute; top: 0; bottom: 0; width: 37.5%; opacity: 0.35; }
  .ib-bm-track-zone.you { left: 0; background: linear-gradient(90deg, var(--imp-gold), transparent); border-radius: 5px 0 0 5px; }
  .ib-bm-track-zone.en { right: 0; background: linear-gradient(270deg, var(--imp-crimson), transparent); border-radius: 0 5px 5px 0; }
  .ib-bm-track-marker { position: absolute; top: -3px; bottom: -3px; width: 4px; margin-left: -2px; border-radius: 2px; background: var(--imp-gold-hi); box-shadow: 0 0 6px rgba(212,168,67,0.8); transition: left var(--duration-slow) var(--ease-default); }
  .ib-bm-track-ends { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; font-family: var(--imp-font-mono); font-size: 10px; color: var(--imp-text-lo); }
  .ib-bm-track-ends .hold.you { color: var(--imp-gold-hi); font-weight: 700; }
  .ib-bm-track-ends .hold.en { color: var(--imp-crimson); font-weight: 700; }
  .ib-bm-track-holder { font-size: var(--imp-text-xs); color: var(--imp-text-mid); text-align: center; letter-spacing: .04em; }
  .ib-bm-track-holder.you { color: var(--imp-gold-hi); }
  .ib-bm-track-holder.en { color: var(--imp-crimson); }
  .ib-bm-round { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; }
  .ib-bm-round-label { font-size: var(--imp-text-xs); letter-spacing: var(--imp-meta-letter); text-transform: uppercase; color: var(--imp-text-mid); }
  .ib-bm-round-num { font-family: var(--imp-font-mono); font-size: 30px; color: var(--imp-gold-hi); }
  .ib-bm-stances-section { margin-bottom: 12px; }
  .ib-bm-warn { font-size: 12px; color: var(--imp-crimson); margin-bottom: 8px; }
  .ib-bm-stances { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
  .ib-bm-stance-btn { text-align: left; padding: 8px 10px; border-radius: 3px; cursor: pointer; background: var(--imp-panel-soft); border: 1px solid var(--imp-gold-dim); color: var(--imp-text); font-family: var(--imp-font-body); transition: border-color var(--duration-fast) var(--ease-default), background var(--duration-fast) var(--ease-default); }
  .ib-bm-stance-btn:hover:not(:disabled) { border-color: var(--imp-gold); background: var(--imp-panel-hover); }
  .ib-bm-stance-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .ib-bm-stance-name { font-size: 13px; font-weight: 700; color: var(--imp-gold-hi); }
  .ib-bm-stance-desc { font-size: var(--imp-text-xs); color: var(--imp-text-mid); margin-top: 2px; line-height: 1.35; }
  .ib-bm-log { background: rgba(0,0,0,0.3); border: 1px solid var(--imp-gold-faint); border-radius: var(--radius-sm); padding: 10px 12px; max-height: 26vh; overflow-y: auto; display: flex; flex-direction: column; gap: 3px; font-size: var(--imp-text-sm); }
  .ib-bm-log-line { color: var(--imp-text-mid); }
  .ib-bm-log-line.head { color: var(--imp-gold-hi); font-weight: 600; border-top: 1px solid var(--imp-gold-faint); padding-top: 5px; margin-top: 2px; }
  .ib-bm-log-line.outcome { color: var(--imp-crimson); font-weight: 700; }

  /* ── Endgame ── */
  .ib-end-mark { font-family: var(--imp-font-display); font-size: 13px; letter-spacing: 4px; }
  .ib-end-mark.victory { color: var(--imp-gold-hi); }
  .ib-end-mark.defeat { color: var(--imp-crimson); }
  .ib-end-title { font-family: var(--imp-font-display); font-size: 28px; color: var(--imp-text-hi); margin: 8px 0 6px; }
  .ib-end-text { font-size: 14px; color: var(--imp-text-mid); line-height: 1.5; margin-bottom: 14px; }
  .ib-end-stats { display: flex; flex-direction: column; gap: 5px; text-align: left; max-width: 360px; margin: 0 auto; font-size: 13px; }
  .ib-end-stats > div { display: flex; justify-content: space-between; border-bottom: 1px solid var(--imp-gold-faint); padding-bottom: 3px; }
  .ib-end-stats span { color: var(--imp-text-mid); }
  .ib-end-stats strong { color: var(--imp-text-hi); font-family: var(--imp-font-mono); }
  .ib-bm-canvas { display:block; width:100%; height:300px; background:#07050a; border:1px solid var(--imp-gold-faint); border-radius: var(--radius-sm); margin-bottom: 12px; }
  .ib-bm-deploy { padding: 6px 2px 2px; }
  .ib-bm-forms { display:grid; grid-template-columns: repeat(auto-fill, minmax(200px,1fr)); gap:10px; }
  .ib-bm-form { text-align:left; padding:12px; border-radius:3px; cursor:pointer; background: var(--imp-panel-soft); border:1px solid var(--imp-gold-dim); border-left:3px solid var(--imp-gold); color: var(--imp-text); }
  .ib-bm-form:hover:not(:disabled) { border-color: var(--imp-gold); background: var(--imp-panel-hover); }
  .ib-bm-form.locked, .ib-bm-form:disabled { opacity:.4; cursor:not-allowed; }
  .ib-bm-form-name { font-family: var(--imp-font-display); font-size:14px; color: var(--imp-gold-hi); }
  .ib-bm-form-req { font-size: var(--imp-text-xs); letter-spacing: var(--imp-meta-letter); text-transform:uppercase; color: var(--imp-text-mid); margin:2px 0 4px; }
  .ib-bm-form-desc { font-size: var(--imp-text-sm); color: var(--imp-text-mid); line-height:1.35; }
  /* Order cards: uniform size (equal columns + equal min-height), full info chips. */
  .ib-bm-orders { display:grid; grid-template-columns: repeat(auto-fill, minmax(190px,1fr)); gap:8px; margin-bottom:12px; align-items:stretch; }
  .ib-bm-order { display:flex; flex-direction:column; gap:4px; min-height:118px; text-align:left; padding:8px 10px; border-radius:3px; cursor:pointer; background: var(--imp-panel-soft); border:1px solid var(--imp-gold-dim); border-left:3px solid var(--imp-gold); color: var(--imp-text); font-family: var(--imp-font-body); }
  .ib-bm-order.sub-charge { border-left-color: var(--imp-crimson); }
  .ib-bm-order.sub-harass { border-left-color: var(--imp-oxidize); }
  .ib-bm-order.sub-moral { border-left-color: var(--imp-lapis); }
  .ib-bm-order.sub-move { border-left-color: #9a7fc0; }
  .ib-bm-order:hover:not(:disabled) { border-color: var(--imp-gold); background: var(--imp-panel-hover); }
  .ib-bm-order:disabled { opacity:.45; cursor:not-allowed; }
  .ib-bm-order-head { display:flex; justify-content:space-between; align-items:baseline; gap:6px; }
  .ib-bm-order-name { font-size:12.5px; font-weight:700; color: var(--imp-gold-hi); }
  .ib-bm-order-sub { font-size:9px; letter-spacing:.08em; text-transform:uppercase; color: var(--imp-text-lo); white-space:nowrap; }
  .ib-bm-order-desc { font-size: var(--imp-text-xs); color: var(--imp-text-mid); line-height:1.3; }
  .ib-bm-order-chips { display:flex; flex-wrap:wrap; gap:3px; margin-top:auto; }
  .ib-bm-chip { font-family: var(--imp-font-mono); font-size:9.5px; padding:1px 5px; border-radius:7px; background: rgba(0,0,0,0.32); border:1px solid var(--imp-gold-faint); color: var(--imp-text-mid); white-space:nowrap; }
  .ib-bm-chip.good { color:#9ed3b4; border-color: rgba(143,190,126,0.45); }
  .ib-bm-chip.bad { color: var(--imp-crimson); border-color: rgba(212,96,74,0.5); }
  .ib-bm-chip.warn { color: var(--imp-oxidize); }
  .ib-bm-order-lock { font-size: var(--imp-text-xs); color: var(--imp-crimson); }
  .ib-bm-decreta { margin-bottom:10px; }
  .ib-bm-decreta-head { display:flex; align-items:center; justify-content:space-between; gap:10px; font-size: var(--imp-text-xs); letter-spacing: var(--imp-meta-letter); text-transform:uppercase; color: var(--imp-text-mid); margin-bottom:6px; }
  .ib-bm-decreta-intent { color: var(--imp-gold-hi); text-transform:none; letter-spacing:0; font-size: var(--imp-text-sm); }
  .ib-bm-decreta-row { display:flex; flex-wrap:wrap; gap:7px; }
  .ib-bm-scroll { text-align:left; padding:6px 10px; border-radius:3px; cursor:pointer; background: var(--imp-panel-soft); border:1px solid var(--imp-gold-dim); border-top:3px solid var(--imp-gold); color: var(--imp-text); }
  .ib-bm-scroll:hover:not(:disabled) { border-color: var(--imp-gold); background: var(--imp-panel-hover); }
  .ib-bm-scroll:disabled { opacity:.4; cursor:not-allowed; }
  .ib-bm-scroll-name { font-size:11.5px; font-weight:700; color: var(--imp-gold-hi); }
  .ib-bm-scroll-meta { font-size: var(--imp-text-xs); color: var(--imp-text-mid); margin-top:1px; text-transform:uppercase; letter-spacing:.05em; }
  .ib-bm-decreta-cast { font-size: var(--imp-text-sm); color: var(--imp-text-mid); font-style:italic; padding:4px 2px; }
  `;
  document.head.appendChild(el);
}

const CAMP_LABEL = `Acampar · 1 día · −${CAMP_SUPPLY_COST} suministros · +${CAMP_MORALE_GAIN} moral`;

export function IterBelliScreen() {
  const s = iterBelliState.value;
  const log = iterBelliLog.value;
  const loc = currentLocation();
  const inCampaign = s.phase === 'campaign';
  const mission = getMissionById(s.missionId);
  const activeQuests = s.quests.filter((q) => q.status === 'active');

  // Pad the pool with placeholders to keep a steady grid.
  const placeholders = Math.max(0, POOL_TARGET_SIZE - s.pool.length);

  return (
    <div class="ib-screen">
      <header class="ib-head">
        <div class="eyebrow">Iter Belli · Campaña en Hispania</div>
        <h1>MARCHA DE GUERRA</h1>
        <div class="sub">Lleva a tus legiones de la frontera a Sagunto antes del invierno.</div>
        {mission && (
          <div class="ib-mission">
            Misión: {mission.title}{' '}
            <span class="ib-mission-cond">
              — {mission.conditionResource ? (
                <>
                  {mission.conditionResource.lead}{' '}
                  <ResourceAmount
                    type={mission.conditionResource.type}
                    amount={mission.conditionResource.amount}
                    iconSize="micro"
                  />{' '}
                  {mission.conditionResource.tail}
                </>
              ) : mission.conditionDesc}
              {' · Recompensa '}
              <ResourceAmount type="gold" amount={mission.bonusGold} sign="+" iconSize="micro" />
            </span>
          </div>
        )}
        {activeQuests.map((q) => {
          const qc = s.pool.find((c) => !isCrisisDef(c.def) && c.def.questId === q.id);
          const turns = qc ? qc.timer : 0;
          return (
            <div key={q.id} class="ib-mission">
              ◆ Objetivo: {q.title} <span class="ib-mission-cond">— {turns} {turns === 1 ? 'turno' : 'turnos'} restantes</span>
            </div>
          );
        })}
      </header>

      <CampaignResourceBar state={s} />
      <Itinerary locationIdx={s.locationIdx} />

      <div class="ib-main">
        <div class="ib-left">
          <div class="ib-location">
            <div class="ib-location-name">{loc.name}</div>
            <div class="ib-location-desc">{loc.desc}</div>
          </div>

          <div class="ib-pool">
            {s.pool.map((card) => (
              <OperationCard
                key={card.instanceId}
                card={card}
                state={s}
                onPlay={(id) => { playSfx('ui_equip'); playCard(id); }}
              />
            ))}
            {Array.from({ length: placeholders }, (_, i) => <div key={`ph-${i}`} class="ib-card-ph" />)}
          </div>

          <div class="ib-actions">
            <button
              class="ib-camp-btn"
              disabled={!inCampaign}
              onClick={() => { playSfx('ui_click'); camp(); }}
            >
              {CAMP_LABEL}
            </button>
          </div>
        </div>

        <CampaignLog lines={log} />
      </div>

      {s.phase === 'battle' && <BattleModal />}
      {s.phase === 'endgame' && <EndgameCard />}
    </div>
  );
}
