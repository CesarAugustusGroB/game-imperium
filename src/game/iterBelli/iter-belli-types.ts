/**
 * Iter Belli — type definitions for the card-driven "march of war" campaign.
 *
 * Ported from the standalone prototype (Iter Belli — Campaña en Hispania) and
 * adapted to a pure, signal-friendly data model: card behaviour is expressed as
 * functions over an explicit {@link CardContext} instead of closures over a
 * module-global mutable state.
 *
 * This module is self-contained: nothing under `src/game/campaign/*` (the hex
 * Bellum system) is imported or referenced here.
 */

// ── Categories & locations ──────────────────────────────────────────────────

export type CategoryName =
  | 'Logística'
  | 'Movimiento'
  | 'Inteligencia'
  | 'Coerción'
  | 'Diplomacia'
  | 'Postura'
  | 'Operaciones'
  | 'Crisis';

export interface Category {
  /** CSS color (token reference or literal) used as the card accent. */
  color: string;
  /** Glyph shown in the card header. */
  icon: string;
}

export type LocationType = 'neutral' | 'aliado' | 'enemigo' | 'objetivo';

export interface Location {
  id: string;
  name: string;
  desc: string;
  type: LocationType;
  /** Signed threat applied each turn while resting here (0 = none). */
  threatPerTurn: number;
}

export interface Crisis {
  name: string;
  category: 'Crisis';
  desc: string;
  icon: string;
}

// ── Cards ─────────────────────────────────────────────────────────────────

export type CardType = 'compromiso' | 'arriesgada';

export interface CardCost {
  /** Days consumed (defaults to 1 when omitted). */
  time?: number;
  gold?: number;
  supplies?: number;
  /** Iuniores (recruit pool) spent — used by the levy card. */
  iuniores?: number;
}

/**
 * Resource deltas + one-shot flags produced by playing a card. Every field is
 * optional; only present keys are applied.
 */
export interface CardEffects {
  soldiers?: number;
  morale?: number;
  discipline?: number;
  supplies?: number;
  gold?: number;
  threat?: number;
  /** Erodes the final enemy army (each point = −7% effectives). */
  enemyWeaken?: number;
  /** Extends the campaign clock by N days. */
  time_bonus?: number;
  /** Advance one stop along the itinerary. */
  advance?: number;
  ambushDetected?: boolean;
  fortified?: boolean;
  triggerFinalBattle?: boolean;
}

/** Player archetype, mirrors Commander['archetype']. null when no commander. */
export type Archetype = 'Religious' | 'Warlord' | 'Diplomat' | 'Merchant';

/** Read-only context handed to a card's behaviour functions. */
export interface CardContext {
  state: Readonly<IterBelliState>;
  loc: Location;
  /** Commander archetype for this campaign; gates signature cards. */
  archetype?: Archetype | null;
}

/** Result of a broken-commitment penalty: optional material effects + a log line. */
export interface PenaltyResult {
  effects?: CardEffects;
  msg: string;
}

export interface OperationCard {
  id: string;
  name: string;
  category: CategoryName;
  cardType?: CardType;
  desc: string;
  cost: CardCost;
  effects: (ctx: CardContext) => CardEffects;
  /** Eligible location ids, or `['*']` for anywhere. */
  locations: string[];
  /** Turns the card survives in the pool before expiring. */
  expiry: number;
  /** Relative draw weight. */
  weight: number;
  /** Set when this card is a Consilium secondary-quest card; links it to a SecondaryQuest. */
  questId?: string;
  /** Gate: card only appears when this returns true. */
  requires?: (ctx: CardContext) => boolean;
  // ── arriesgada (gamble) ──
  successChance?: number;
  failureEffects?: (ctx: CardContext) => CardEffects;
  failureMsg?: string;
  // ── compromiso (commitment) ──
  penalty?: (ctx: CardContext) => PenaltyResult;
  penaltyDesc?: string;
}

// ── Secondary quests (Consilium Fase 2) ─────────────────────────────────────

export type QuestStatus = 'pending' | 'active' | 'completed' | 'failed';

/**
 * A Consilium secondary objective. Seeded at embark from a non-mission seat;
 * its card is injected when the army reaches `locationId` and must be played
 * within `window` turns. `color` is a plain string to keep this module free of
 * advisor/run types.
 */
export interface SecondaryQuest {
  id: string;
  color: string;
  title: string;
  locationId: string;
  window: number;
  status: QuestStatus;
}

// ── Doctrine campaign modifiers (Doctrinae Fase 1) ───────────────────────────

/**
 * A campaign modifier contributed by one equipped Hub doctrine. All hooks are
 * optional; the engine consults whichever a modifier defines. `color` lives in
 * the run domain, so this type stays color-agnostic — the data bridge maps
 * doctrines to these.
 */
export interface DoctrineCampaignModifier {
  id: string;
  label: string;
  /** Draw-weight multiplier for a card (absent → treated as 1). */
  weight?: (card: OperationCard, ctx: CardContext) => number;
  /** Cost adjustment (negative = discount) applied when a card is played. */
  costDelta?: (card: OperationCard, ctx: CardContext) => CardCost;
  /** Extra effects added when a card is played. */
  onPlay?: (card: OperationCard, ctx: CardContext) => CardEffects;
  /** Passive effects applied each turn. */
  onTurn?: (state: IterBelliState) => CardEffects;
}

export type AnyCardDef = OperationCard | CrisisCard;

/** Crisis pool entry — derived from {@link Crisis}, not directly playable. */
export interface CrisisCard {
  id: string;
  name: string;
  category: 'Crisis';
  desc: string;
  icon: string;
}

export interface CardInstance {
  instanceId: number;
  def: AnyCardDef;
  /** Remaining turns before expiry; 99 = does not expire. */
  timer: number;
}

export function isCrisisDef(def: AnyCardDef): def is CrisisCard {
  return def.category === 'Crisis';
}

// ── Campaign state ──────────────────────────────────────────────────────────

export type CampaignPhase = 'campaign' | 'battle' | 'endgame';

export type LogKind = '' | 'event' | 'battle' | 'turn';

export interface LogLine {
  text: string;
  kind: LogKind;
}

export interface CampaignOutcome {
  victory: boolean;
  title: string;
  text: string;
  /** Snapshot of survivors / stats for the endgame card. */
  soldiers: number;
  turnNum: number;
  brokenCommitments: number;
}

export interface IterBelliState {
  // Resources
  soldiers: number;
  morale: number;       // clamped 0–10
  discipline: number;   // clamped 1–5
  supplies: number;
  gold: number;
  /** Recruit pool carried from the run (seeded at embark, written back on return). */
  iuniores: number;
  threat: number;       // clamped 0–10
  timeRemaining: number;
  turnNum: number;

  // Location
  locationIdx: number;

  // Pool
  pool: CardInstance[];
  cardIdCounter: number;

  // Flags
  ambushDetected: boolean;
  fortified: boolean;
  truceTurns: number;
  finished: boolean;
  enemyWeaken: number;
  brokenCommitments: number;

  // Presentation / lifecycle
  phase: CampaignPhase;
  outcome: CampaignOutcome | null;
  /** Commander archetype for this campaign (gates signature cards). */
  archetype: Archetype | null;

  /** Soldiers the campaign began with — used to scale survivors back to cohorts. */
  initialSoldiers: number;
  /** Conquered-province terrain (from the spoke theme); seeded at embark. */
  spokeTerrain: string;
  /** Spoke duration in seasons (1–4); advances the Hub season clock on return. */
  spokeDuration: number;
  /** Active campaign mission id (from the first-seated advisor's color); null if none. */
  missionId: string | null;
  /** Consilium secondary quests (from non-mission seats); empty if none. */
  quests: SecondaryQuest[];
  /** Campaign modifiers from equipped Hub doctrines (Fase 1); empty if none. */
  doctrineModifiers: DoctrineCampaignModifier[];
}

// ── Battle ──────────────────────────────────────────────────────────────────

export type StanceName =
  | 'Frontal'
  | 'Retirada desordenada'
  | 'Línea pesada'
  | 'Hostigamiento'
  | 'Retirada ordenada'
  | 'Reserva táctica'
  | 'Envolvimiento'
  | 'Resistencia obstinada'
  | 'Falsa retirada'
  | 'Doble línea';

export interface StanceDef {
  discipline_req: number;
  aggressivity: number;
  offensive_mult: number;
  morale_factor: number;
  ends_battle: boolean;
  soldier_loss_pct: number;
  desc: string;
}

export type DoctrineName = 'Tribal' | 'Cauta' | 'Maniobrera' | 'Disciplinada' | 'Agresiva' | 'PLAYER';

export interface BattleArmy {
  name: string;
  soldiers: number;
  morale: number;
  discipline: number;
  doctrine: DoctrineName;
  initial_soldiers: number;
  false_retreat_combo: boolean;
  encircled: boolean;
  encirclement_strength: number;
  obstinate_used: boolean;
  last_stance: StanceName | null;
}

export interface DieData {
  raw: number;
  bonus: number;
  total: number;
  faces: number;
}

export interface RoundResult {
  log: string[];
  dice: { atk: DieData | null; dfn: DieData | null };
  winner: 'atk' | 'dfn' | null;
}

export interface BattleOutcome {
  finished: boolean;
  atkOk?: boolean;
  msg?: string;
}

export type BattleLogKind = '' | 'head' | 'outcome';

export interface BattleLogLine {
  text: string;
  kind: BattleLogKind;
}

export interface BattleState {
  atk: BattleArmy;
  dfn: BattleArmy;
  terrainAtkMult: number;
  terrainDfnMult: number;
  defDieBonus: number;
  round: number;
  finished: boolean;
  /** Label only — the player picks stances freely. */
  playerDoctrine: DoctrineName;
  log: BattleLogLine[];
  /** Latest dice shown on the panels. */
  lastDice: { atk: DieData | null; dfn: DieData | null };
  /** Set once the battle resolves; drives the end-of-battle button. */
  victory: boolean | null;
}
