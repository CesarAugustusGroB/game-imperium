/** The five additive power stats summed across an army's roster. */
export interface PowerStats {
  charge: number; harass: number; push: number; siege: number; movement: number;
}
export type StatKey = keyof PowerStats;
export type Subsystem = 'push' | 'harass' | 'charge' | 'siege' | 'move' | 'moral';

export type OrderKey =
  | 'advance' | 'holdLine' | 'charge' | 'skirmish' | 'siege'
  | 'envelop' | 'flank' | 'drums' | 'taunt' | 'rally'
  | 'warCry' | 'fireMissiles' | 'hitRun' | 'wedge' | 'allOut'
  | 'lineRelief' | 'retreat';

export interface OrderDef {
  name: string;
  sub: Subsystem;
  stat?: StatKey;
  mult?: number;
  disc: number;
  /** Damage to enemy morale (routed through applyMorale, discipline-resisted). */
  eMorale?: number;
  /** Change to own morale (applied directly; negative = reckless self-cost). */
  sMorale?: number;
  ammo?: number;
  push?: number;          // center-move weight (push orders only)
  defensive?: boolean;    // braces vs charge
  protect?: number;       // casualty-morale reduction when bracing
  pierce?: boolean;       // ignores armor + fortification (siege)
  pierceBrace?: boolean;  // ignores the defensive brace (wedge)
  breakCenter?: boolean;  // seizes the center on a landing hit (wedge)
  reckless?: boolean;     // bold order, locked when shaken
  allIn?: boolean;        // amplified recoil
  drums?: boolean;        // sets sustained drums
  refresh?: boolean;      // line relief: +morale + incoming-damage cut
  wedge?: boolean;        // log/animation flavor
  check?: number;         // movement skill-check threshold
  effect?: 'encircle' | 'flank' | 'hitrun' | 'retreat';
  desc: string;
}

export type FormationKey =
  | 'battleLine' | 'openOrder' | 'shieldWall' | 'triplex' | 'testudo' | 'cuneus';

export interface FormationDef {
  name: string;
  kind: 'common' | 'unique';
  disc: number;
  trait: string | null;
  antiMissile?: boolean;
  orders: OrderKey[];
  desc: string;
}

export interface CenterDef {
  name: string;
  terrain: string;
  desc: string;
  dmg?: number;                 // +damage to holder
  chargeBonus?: number;         // +charge to holder
  enemyChargePenalty?: number;  // −charge to the holder's attacker
  moraleRegen?: number;         // +morale/round to holder
}

export interface EnemyArchetype {
  name: string;
  formation: FormationKey;
  hp: number; morale: number; disc: number;
  stats: PowerStats;
  armorPct: number; armorName: string;
  ammo: number;
  fortPct: number; fortName?: string;
  desc: string;
}

export type Side = 'you' | 'enemy';

export interface BattleArmy {
  name: string;
  side: Side;
  hp: number; maxHp: number;
  morale: number;
  discipline: number;
  stats: PowerStats;
  armorPct: number; armorName: string;
  fortPct: number; fortName: string | null;
  ammo: number; maxAmmo: number;
  formation: FormationDef;
  encircled: boolean; encircleTurns: number;
  drums: number;
  guardMult: number;       // per-round incoming-damage multiplier (hit&run / relief)
  defendedLast: boolean;
  retreated: boolean;
  strengthPct: number;     // display only in Thread A
  /** Battle-long incoming-damage multiplier from decretum def buffs (<1 = protected). */
  dmgTakenMult?: number;
  /** Pending death-prevention charges (decretum Oracle/Triumphus): a killing blow leaves 5% HP instead. */
  preventDeath?: number;
}

export interface DieData { raw: number; faces: number; bonus: number; }

export interface BattleState {
  you: BattleArmy;
  enemy: BattleArmy;
  round: number;
  control: number;         // −100..+100
  center: CenterDef;
  finished: boolean;
  victory: boolean | null;
  endMsg: string;
  lastDice: { you: DieData | null; enemy: DieData | null };
  /** Rounds left of revealed enemy intent (decretum Spy/Augur). */
  revealRounds?: number;
  /** Pre-picked enemy order for the next round, shown in the UI while reveal is active. */
  nextEnemyOrder?: OrderKey | null;
  /** Rounds left of advantage on the player die — roll twice, keep best (decretum Tribune). */
  advantageRounds?: number;
}

export type RoundLogLine = { text: string; kind: '' | 'head' | 'you' | 'en' | 'mor' | 'crit' | 'out' };

/** Injectable dice so rounds are deterministic in tests. */
export interface Rng { rollDie(faces: number): number; }
