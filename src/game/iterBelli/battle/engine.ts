import type { BattleArmy, BattleState, CenterDef, EnemyArchetype, OrderKey, Rng, RoundLogLine, Side } from './types';
import { ORDERS, FORMATIONS } from './orders';
import { resolveOrder, resolveCenter, applyMorale, checkEnd, finish, centerTier } from './resolver';
import { enemyChoose } from './enemy-ai';

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

type ArmySeed = Partial<BattleArmy> & Pick<BattleArmy, 'hp' | 'morale' | 'discipline' | 'stats' | 'armorPct' | 'armorName' | 'ammo' | 'formation'> & { fortPct?: number; fortName?: string | null; name?: string };

export function makeBattleArmy(side: Side, seed: ArmySeed | EnemyArchetype): BattleArmy {
  const s = seed as any;
  // formation may be a FormationKey string (from EnemyArchetype) or a FormationDef object (from ArmySeed)
  const formation = typeof s.formation === 'string' ? FORMATIONS[s.formation as keyof typeof FORMATIONS] : s.formation;
  return {
    name: s.name ?? (side === 'you' ? 'Your legion' : 'Enemy army'),
    side,
    hp: s.hp, maxHp: s.hp,
    morale: s.morale, discipline: s.disc ?? s.discipline,
    stats: { ...s.stats },
    armorPct: s.armorPct, armorName: s.armorName,
    fortPct: s.fortPct ?? 0, fortName: s.fortName ?? null,
    ammo: s.ammo, maxAmmo: s.ammo,
    formation,
    encircled: false, encircleTurns: 0, drums: 0, guardMult: 1,
    defendedLast: false, retreated: false, strengthPct: 100,
  };
}

export function makeBattleState(you: BattleArmy, enemy: BattleArmy, center: CenterDef, control = 0): BattleState {
  return { you, enemy, round: 0, control, center, finished: false, victory: null, endMsg: '', lastDice: { you: null, enemy: null } };
}

export function playRound(S: BattleState, playerKey: OrderKey, rng: Rng): { log: RoundLogLine[]; enemyOrder: OrderKey } {
  if (S.finished) return { log: [], enemyOrder: playerKey };
  S.round++;
  S.you.guardMult = 1; S.enemy.guardMult = 1;
  const eKey = enemyChoose(S);
  const yO = ORDERS[playerKey], eO = ORDERS[eKey];
  const yTier = centerTier(S.control, 'you'), eTier = centerTier(S.control, 'enemy');
  const yFaces = 6 + yTier, eFaces = 6 + eTier;
  const yDie = rng.rollDie(yFaces), eDie = rng.rollDie(eFaces);
  S.lastDice = { you: { raw: yDie, faces: yFaces, bonus: yTier }, enemy: { raw: eDie, faces: eFaces, bonus: eTier } };

  const log: RoundLogLine[] = [{ text: `Round ${S.round} — You: ${yO.name} (d${yFaces}) · Enemy: ${eO.name} (d${eFaces})`, kind: 'head' }];
  const yHp = S.you.hp, eHp = S.enemy.hp;

  // Evasion (retreat / hit & run) must blunt THIS round's incoming damage regardless of
  // which side resolves first, so set the guard up front from each order's movement check.
  // (resolveMove also sets it on success — idempotent; this covers the side that resolves second.)
  if (playerKey === 'retreat') S.you.guardMult = 0.25;
  else if (yO.effect === 'hitrun' && yDie + S.you.stats.movement >= (yO.check ?? 0)) S.you.guardMult = 0.25;
  if (eO.effect === 'hitrun' && eDie + S.enemy.stats.movement >= (eO.check ?? 0)) S.enemy.guardMult = 0.25;

  resolveCenter(S, yO, eO, yDie, eDie);
  const yRes = resolveOrder(S, S.you, S.enemy, yO, yDie, eO);
  const eRes = resolveOrder(S, S.enemy, S.you, eO, eDie, yO);
  log.push(...yRes.log, ...eRes.log);

  applyMorale(S, S.you, yHp, yO, eRes.eMoraleHit);
  applyMorale(S, S.enemy, eHp, eO, yRes.eMoraleHit);

  for (const a of [S.you, S.enemy]) {
    if (a.drums > 0) { a.morale = clamp(a.morale + 1.0 + a.discipline * 0.06, 0, 10); a.drums--; }
    if (a.encircled) { a.encircleTurns--; if (a.encircleTurns <= 0) a.encircled = false; }
  }

  S.you.defendedLast = !!yO.defensive; S.enemy.defendedLast = !!eO.defensive;

  if (S.you.retreated && !S.finished) {
    const loss = clamp(0.25 - S.you.discipline * 0.015, 0.08, 0.25);
    S.you.hp = Math.round(S.you.hp * (1 - loss));
    finish(S, false, `You withdraw — ${Math.round(loss * 100)}% lost covering the retreat.`);
    log.push({ text: S.endMsg, kind: 'out' });
  }

  checkEnd(S);
  if (S.finished && S.endMsg && !log.some((l) => l.kind === 'out')) log.push({ text: S.endMsg, kind: 'out' });
  return { log, enemyOrder: eKey };
}

/** Production RNG. Tests inject a deterministic one. */
export const realRng: Rng = { rollDie: (n) => 1 + Math.floor(Math.random() * n) };
