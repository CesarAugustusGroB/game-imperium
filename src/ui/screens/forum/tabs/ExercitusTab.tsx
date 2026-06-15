import type { ComponentChildren } from 'preact';
import { useSignal } from '@preact/signals';
import { COHORT_CATALOG } from '../../../../game/army/cohort-data';
import type { Cohort } from '../../../../game/army/cohort';
import { canConsolidate, consolidateCohorts } from '../../../../game/army/cohort';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { gold, iuniores } from '../../../../game/core/resources';
import type { ResourceType } from '../../../../game/core/commander';
import {
  preparedArmy, preparedLegate, legateHiringPool,
  ensurePreparedArmy, recruitCohort, removeCohort, mergeCohorts, getRecruitCohortFailure,
  ensureLegatePool, hireLegate, dismissLegate,
  buySupplies, upgradeArmor, buyAmmunition, getDiscountedGold,
} from '../../../../game/progression/strategic-store';
import { nextArmorTier, armorUpgradeCost } from '../../../../game/progression/arsenal';
import { ARMORS } from '../../../../game/iterBelli/battle/balance';
import {
  previewHubReplenishment,
  replenishHubRoster,
  healCohortInRoster,
  healMercenaryWithGold,
} from '../../../../game/army/army-replenishment';
import { getLegateTraitById } from '../../../../game/army/legate-traits';
import { playSfx } from '../../../sound/sfx';
import type { PowerStat, UnitRole } from '../../../../game/army/unit-types';
import { POWER_STATS } from '../../../../game/army/unit-types';
import { BentoCard } from '../../../components/BentoCard';
import { Masthead } from '../Masthead';
import { SectionHeader } from '../components/SectionHeader';
import { ResourceAmount, ResourceIcon } from '../../../components/ResourceIcon';
import { resolveIconSize } from '../../../components/icon-system';
import { getPriorityStyle, priorityClass, type CardPriority } from '../../../components/card-priority';
import {
  IUNIORES,
  MERC_HEAL_GOLD_FRACTION,
  SUPPLIES_PER_GOLD,
  SUPPLY_MAX_CARRY,
  AMMO_MAX_CARRY,
  AMMO_PER_GOLD,
} from '../../../../config/game-config';
import statHpIcon from '../../../../assets/ui/icons/stat-hp-generated.png';
import statChargeIcon from '../../../../assets/ui/icons/stat-charge-generated.png';
import statHarassIcon from '../../../../assets/ui/icons/stat-harass-generated.png';
import statPushIcon from '../../../../assets/ui/icons/stat-push-generated.png';
import statSiegeIcon from '../../../../assets/ui/icons/stat-siege-generated.png';
import statMovementIcon from '../../../../assets/ui/icons/stat-movement-generated.png';

const LEGATE_HIRE_COST = 80;
const ACCENT = '#d4a843';

// Vertical unit-card dimensions (portrait 9:16, per wireframes.html → Exercitus).
const VCARD_W = 172;
const VCARD_MINI_W = 150;

/**
 * Resolve a cohort spriteId to its portrait URL in /asset/soldiers/.
 * Filename pattern: {spriteId with super_rare → super-rare}_{soldier|cavalry}.png
 */
function cohortSpriteUrl(spriteId?: string): string | null {
  if (!spriteId) return null;
  const base = spriteId.replace('super_rare', 'super-rare');
  const format = spriteId.includes('equite') || spriteId.includes('noble_horse') ? 'cavalry' : 'soldier';
  return `/asset/soldiers/${base}_${format}.png`;
}

/** Art zone at the top of a vertical unit card: sprite + role band + optional corner chip. */
function VCardArt({
  spriteUrl, role, corner,
}: {
  spriteUrl: string | null; role: UnitRole; corner?: ComponentChildren;
}) {
  const color = ROLE_COLORS[role];
  return (
    <div style={{
      position: 'relative', flex: '0 0 34%', minHeight: 0,
      background: `radial-gradient(circle at 50% 62%, ${color}26 0%, rgba(14, 12, 24, 0.9) 78%)`,
      borderBottom: '1px solid rgba(212, 168, 67, 0.18)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
    }}>
      {spriteUrl ? (
        <img src={spriteUrl} alt="" aria-hidden="true" loading="lazy" style={{
          height: '88%', aspectRatio: '1', objectFit: 'contain',
          filter: 'drop-shadow(0 2px 3px rgba(0, 0, 0, 0.6))',
        }} />
      ) : (
        <span style={{ color, fontSize: 30, opacity: 0.7 }}>{ROLE_ICONS[role]}</span>
      )}
      <div style={{
        position: 'absolute', top: 6, left: 6,
        fontSize: 8, padding: '2px 7px',
        background: color, color: '#fff',
        borderRadius: 2, letterSpacing: 1, textTransform: 'uppercase',
        fontFamily: 'var(--imp-font-display)', fontWeight: 700,
      }}>
        {ROLE_LABELS[role]}
      </div>
      {corner && (
        <div style={{ position: 'absolute', top: 5, right: 6 }}>{corner}</div>
      )}
    </div>
  );
}

const STAT_ICON_SRC: Record<PowerStat, string> = {
  charge: statChargeIcon,
  harass: statHarassIcon,
  push: statPushIcon,
  siege: statSiegeIcon,
  movement: statMovementIcon,
};

// Stat icons enlarged 2× over the base 'stat' token — readable without dominating the card.
const RECRUIT_STAT_ICON_SIZE = resolveIconSize('stat') * 2;

function RecruitStatIcon({
  src,
  label,
  value,
  muted = false,
}: {
  src: string;
  label: string;
  value: number;
  muted?: boolean;
}) {
  return (
    <span
      title={`${label}: ${value}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        minWidth: RECRUIT_STAT_ICON_SIZE + 18,
        opacity: muted ? 0.35 : 1,
      }}
    >
      <img
        src={src}
        alt=""
        aria-hidden="true"
        style={{
          width: RECRUIT_STAT_ICON_SIZE,
          height: RECRUIT_STAT_ICON_SIZE,
          objectFit: 'contain',
          filter: 'drop-shadow(0 1px 1px rgba(0, 0, 0, 0.75))',
          flex: '0 0 auto',
        }}
      />
      <span>{value}</span>
    </span>
  );
}

/** Stat grid (2 columns): HP + all power stats (zeros shown muted so the full profile is visible). */
function StatGrid({ stats }: { stats: Cohort['stats'] }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 8px',
      fontFamily: 'var(--imp-font-mono)', fontSize: 'var(--imp-text-xs)',
      color: 'var(--imp-text-mid)',
    }}>
      <RecruitStatIcon src={statHpIcon} label="HP" value={stats.hp} />
      {POWER_STATS.map((p) => (
        <RecruitStatIcon key={p.key} src={STAT_ICON_SRC[p.key]} label={p.label} value={stats[p.key]} muted={stats[p.key] <= 0} />
      ))}
    </div>
  );
}

/** Small gold quick-buy button used in the status strip. */
function MiniBuyButton({
  label, enabled, onClick, title,
}: {
  label: string; enabled: boolean; onClick: () => void; title?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={!enabled}
      title={title}
      style={{
        padding: '5px 9px',
        background: enabled ? `linear-gradient(180deg, ${ACCENT} 0%, #b8892a 100%)` : 'rgba(80, 70, 50, 0.3)',
        border: 'none', borderRadius: 2,
        color: enabled ? 'var(--imp-ink)' : 'var(--imp-text-lo)',
        fontFamily: 'var(--imp-font-display)', fontSize: 'var(--imp-text-xs)', fontWeight: 700,
        letterSpacing: 'var(--imp-meta-letter)',
        cursor: enabled ? 'pointer' : 'not-allowed',
        transition: 'all 160ms', whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  );
}

/** Inline meter (track + colored fill) used in the status strip. */
function MeterBar({ ratio, tone }: { ratio: number; tone: 'hp' | 'supply' }) {
  const pct = Math.min(Math.max(ratio, 0), 1) * 100;
  const fill = tone === 'hp'
    ? (ratio > 0.6 ? 'linear-gradient(90deg, #4a9a6a 0%, #7ecf97 100%)'
      : ratio > 0.3 ? 'linear-gradient(90deg, #d48b3a 0%, #e8a848 100%)'
      : 'linear-gradient(90deg, #c24a3a 0%, #d4604a 100%)')
    : (ratio > 0.5 ? `linear-gradient(90deg, ${ACCENT} 0%, #f0d080 100%)`
      : ratio > 0.2 ? 'linear-gradient(90deg, #d48b3a 0%, #e8a848 100%)'
      : 'linear-gradient(90deg, #c24a3a 0%, #d4604a 100%)');
  return (
    <div style={{
      position: 'relative', height: 8, flex: 1, minWidth: 60,
      background: 'rgba(20, 18, 32, 0.7)',
      border: '1px solid rgba(212, 168, 67, 0.25)',
      borderRadius: 2, overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', inset: 0, width: `${pct}%`,
        background: fill, transition: 'width 300ms ease', borderRadius: 2,
      }} />
    </div>
  );
}

const ROLE_COLORS: Record<UnitRole, string> = {
  vanguard: '#b23a3a',  // crimson — frontline
  reserve:  '#d4a843',  // gold — elite
  guard:    '#5a7aa0',  // lapis — specialist
};

const ROLE_LABELS: Record<UnitRole, string> = {
  vanguard: 'Vanguard',
  reserve:  'Reserve',
  guard:    'Guard',
};

const ROLE_ICONS: Record<UnitRole, string> = {
  vanguard: '⚔',
  reserve:  '★',
  guard:    '➶',
};

/** Grouped cohort row data (same id folded), with aggregated health + per-group heal target. */
interface CohortGroup {
  id: string;
  name: string;
  role: UnitRole;
  stats: Cohort['stats'];
  count: number;
  aurumCost: number;
  mercenary: boolean;
  curHp: number;
  maxHp: number;
  ooaCount: number;
  damagedCount: number;
  /** Array index of the most-damaged healable (citizen) instance in this group; null if none. */
  healIndex: number | null;
  healCost: number;
  /** HP ratio of the current heal target — used to pick the most-damaged instance. */
  healRatio: number;
}

export function ExercitusTab() {
  ensurePreparedArmy();
  ensureLegatePool();
  // Pending "merge cohorts" confirmation — holds the cohort id awaiting confirm.
  const mergeConfirmId = useSignal<string | null>(null);

  const currentGold = gold.value;
  const currentIuniores = iuniores.value;
  const army = preparedArmy.value;
  const cohorts = army?.cohorts ?? [];
  const legate = preparedLegate.value;
  const pool = legateHiringPool.value;
  const accent = ACCENT;
  const recruitableCohorts = COHORT_CATALOG.filter(c => !c.mercenary);
  const mercenaryCohorts = COHORT_CATALOG.filter(c => c.mercenary);

  // Grouped composition with aggregated current/max HP and a per-group heal target.
  const groupMap = new Map<string, CohortGroup>();
  let curHpTotal = 0;
  let maxHpTotal = 0;
  cohorts.forEach((c, index) => {
    const maxHp = c.stats.hp;
    const isOoA = c.outOfAction === true;
    const cur = c.currentHp ?? (isOoA ? 1 : maxHp);
    curHpTotal += cur;
    maxHpTotal += maxHp;
    let g = groupMap.get(c.id);
    if (!g) {
      g = {
        id: c.id, name: c.name, role: c.role, stats: c.stats,
        count: 0, aurumCost: c.aurumCost, mercenary: c.mercenary === true,
        curHp: 0, maxHp: 0, ooaCount: 0, damagedCount: 0, healIndex: null, healCost: 0, healRatio: 2,
      };
      groupMap.set(c.id, g);
    }
    g.count++;
    g.curHp += cur;
    g.maxHp += maxHp;
    if (isOoA) g.ooaCount++;
    const ratio = maxHp > 0 ? cur / maxHp : 1;
    if (ratio < 1) {
      g.damagedCount++;
      // Track the single most-damaged instance as the inline-heal target.
      // Citizens pay iuniores; mercenaries pay gold (a fraction of recruit cost).
      if (ratio < g.healRatio) {
        g.healIndex = index;
        g.healRatio = ratio;
        g.healCost = g.mercenary
          ? Math.max(1, Math.round(c.aurumCost * MERC_HEAL_GOLD_FRACTION * (maxHp - cur) / maxHp))
          : Math.round((maxHp - cur) * 1000 / maxHp);
      }
    }
  });
  const groups = Array.from(groupMap.values());

  const totalSize = army?.size ?? 0;
  const sizeLabel = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}K` : `${n}`);
  const subtitle = `${cohorts.length} cohort${cohorts.length === 1 ? '' : 's'} · ${sizeLabel(totalSize)} HP · ${legate ? `Legate ${legate.name.split(' ').slice(-1)[0]}` : 'No legate'}`;
  const hpRatioTotal = maxHpTotal > 0 ? curHpTotal / maxHpTotal : 1;

  // ── Supplies ──
  const currentSupplies = army?.supplies ?? 0;
  const supplyRatio = SUPPLY_MAX_CARRY > 0 ? currentSupplies / SUPPLY_MAX_CARRY : 0;
  const coversNodes = cohorts.length > 0 ? Math.floor(currentSupplies / cohorts.length) : 0;
  const maxBuyable = Math.min(currentGold * SUPPLIES_PER_GOLD, SUPPLY_MAX_CARRY - currentSupplies);
  const atCap = currentSupplies >= SUPPLY_MAX_CARRY;

  // ── Arsenal (armor tier + ammunition) ──
  const armorMaterial = army?.armorMaterial ?? 'copper';
  const armorLabel = armorMaterial.charAt(0).toUpperCase() + armorMaterial.slice(1);
  const nextArmor = nextArmorTier(armorMaterial);
  const nextArmorLabel = nextArmor ? nextArmor.charAt(0).toUpperCase() + nextArmor.slice(1) : null;
  const armorCostBase = armorUpgradeCost(armorMaterial);
  const armorCost = armorCostBase != null ? getDiscountedGold(armorCostBase) : null;
  const canUpgradeArmor = nextArmor != null && armorCost != null && currentGold >= armorCost;
  const currentAmmo = army?.ammunition ?? 0;
  const ammoRatio = AMMO_MAX_CARRY > 0 ? currentAmmo / AMMO_MAX_CARRY : 0;
  const ammoAtCap = currentAmmo >= AMMO_MAX_CARRY;
  const ammoBuyable = Math.min(currentGold * AMMO_PER_GOLD, AMMO_MAX_CARRY - currentAmmo);

  function handleRecruit(id: string) { if (recruitCohort(id).ok) playSfx('ui_equip'); }
  function handleRemove(id: string)  { removeCohort(id); playSfx('ui_sell'); }
  function handleMerge(id: string)   { mergeCohorts(id); playSfx('ui_equip'); }
  function handleHire(id: string)    { if (hireLegate(id, LEGATE_HIRE_COST)) playSfx('ui_equip'); }
  function handleDismiss()           { dismissLegate(); playSfx('ui_sell'); }
  function handleHealOne(idx: number, mercenary: boolean) {
    const result = mercenary ? healMercenaryWithGold(idx) : healCohortInRoster(idx);
    if (result !== null) playSfx('ui_equip');
  }
  function handleReplenishAll() {
    const result = replenishHubRoster();
    if (result && result.iunioresSpent > 0) playSfx('ui_equip');
  }
  function handleBuySupplies(qty: number) { if (buySupplies(qty)) playSfx('ui_equip'); }
  function handleBuyMax() { if (maxBuyable > 0) handleBuySupplies(maxBuyable); }
  function handleUpgradeArmor() { if (upgradeArmor()) playSfx('ui_equip'); }
  function handleBuyAmmo(qty: number) { if (buyAmmunition(qty)) playSfx('ui_equip'); }
  function handleBuyAmmoMax() { if (ammoBuyable > 0) handleBuyAmmo(ammoBuyable); }

  // Roster-health aggregates for the bulk "Replenish roster" footer action.
  const damagedCitizens = cohorts.filter((c) => !c.mercenary && (c.outOfAction === true || (c.currentHp ?? c.stats.hp) < c.stats.hp));
  const damagedMercs = cohorts.filter((c) => c.mercenary === true && (c.outOfAction === true || (c.currentHp ?? c.stats.hp) < c.stats.hp));
  const ooaCount = cohorts.filter((c) => c.outOfAction === true).length;
  const hubPreview = damagedCitizens.length > 0 ? previewHubReplenishment(cohorts, currentIuniores) : null;

  /** Vertical 9:16 recruit card: art on top, name + stat grid, cost + CTA anchored at the foot. */
  function renderRecruitCard(c: Cohort) {
    const recruitFailure = getRecruitCohortFailure(c.id);
    const canBuy = recruitFailure === null;
    const color = ROLE_COLORS[c.role];
    const badgeColor = c.mercenary ? '#c99245' : color;
    const priority: CardPriority = canBuy ? 'actionable' : 'disabled';
    const disabledCopy = recruitFailure === 'insufficient-iuniores'
      ? 'Insufficient iuniores. Gain more provinces or wait for a season tick.'
      : recruitFailure === 'insufficient-gold'
        ? `Needs ${getDiscountedGold(c.aurumCost)} gold`
        : null;

    return (
      <div key={c.id} class={priorityClass(priority)} title={c.description} style={{
        width: VCARD_MINI_W, aspectRatio: '9 / 16', flex: '0 0 auto',
        background: c.mercenary ? 'rgba(44, 28, 16, 0.58)' : 'rgba(20, 18, 32, 0.5)',
        border: '1px solid rgba(212, 168, 67, 0.15)',
        borderTop: `3px solid ${badgeColor}`,
        borderRadius: 2, overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        opacity: canBuy ? 1 : 0.72,
        ...getPriorityStyle(priority, badgeColor),
      }}>
        <VCardArt
          spriteUrl={cohortSpriteUrl(c.spriteId)}
          role={c.role}
          corner={c.mercenary && (
            <span title="Mercenary cohort — gold only." style={{
              fontSize: 8, padding: '2px 6px',
              border: '1px solid rgba(232, 192, 112, 0.5)',
              background: 'rgba(44, 28, 16, 0.85)',
              color: '#f0d080',
              borderRadius: 2, letterSpacing: 1, textTransform: 'uppercase',
              fontFamily: 'var(--imp-font-display)', fontWeight: 600, cursor: 'help',
            }}>
              Gold Only
            </span>
          )}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 10px', flex: 1, minHeight: 0 }}>
          <div style={{
            fontFamily: 'var(--imp-font-display)',
            fontSize: 'var(--imp-text-sm)', color: 'var(--imp-text-hi)',
            letterSpacing: 'var(--imp-meta-letter)', textTransform: 'uppercase',
            fontWeight: 600,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {c.name}
          </div>
          <StatGrid stats={c.stats} />
          <div style={{ marginTop: 'auto', paddingTop: 7, borderTop: '1px dashed rgba(212, 168, 67, 0.22)' }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              fontFamily: 'var(--imp-font-mono)', fontSize: 'var(--imp-text-xs)',
              color: canBuy ? '#b89a66' : 'var(--imp-text-lo)', marginBottom: 6,
            }}>
              <ResourceAmount type="gold" amount={c.aurumCost} iconSize="inline" />
              {!c.mercenary && <ResourceAmount type="iuniores" amount={IUNIORES.recruitCost} iconSize="inline" />}
            </div>
            <button
              onClick={() => handleRecruit(c.id)}
              disabled={!canBuy}
              title={c.mercenary ? 'Mercenary cohort — gold only.' : (disabledCopy ?? `Recruit ${c.name}`)}
              class={`imp-card-cta imp-card-cta-${canBuy ? 'actionable' : 'disabled'}`}
              style={{
                display: 'block', width: '100%',
                padding: '6px 8px',
                background: canBuy
                  ? `linear-gradient(180deg, ${accent} 0%, #b8892a 100%)`
                  : 'rgba(80, 70, 50, 0.3)',
                border: 'none',
                borderRadius: 2,
                color: canBuy ? 'var(--imp-ink)' : 'var(--imp-text-lo)',
                fontSize: 'var(--imp-text-xs)', fontWeight: 700,
                letterSpacing: 'var(--imp-meta-letter)', textTransform: 'uppercase',
                fontFamily: 'var(--imp-font-display)',
                cursor: canBuy ? 'pointer' : 'not-allowed',
                transition: 'all 160ms',
                ...getPriorityStyle(canBuy ? 'actionable' : 'disabled', accent),
              }}
            >
              {c.mercenary ? 'Hire' : 'Recruit'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  /** Vertical 9:16 cohort card: art + role band + count on top, HP bar + stat grid,
   *  cost and heal/remove actions anchored at the foot. */
  function renderCohortCard(g: CohortGroup) {
    const color = ROLE_COLORS[g.role];
    const ratio = g.maxHp > 0 ? g.curHp / g.maxHp : 1;
    const hpFill = g.ooaCount > 0
      ? 'linear-gradient(90deg, #c24a3a 0%, #d4604a 100%)'
      : ratio > 0.6 ? 'linear-gradient(90deg, #4a9a6a 0%, #7ecf97 100%)'
      : ratio > 0.3 ? 'linear-gradient(90deg, #d48b3a 0%, #e8a848 100%)'
      : 'linear-gradient(90deg, #c24a3a 0%, #d4604a 100%)';
    // Mercenaries heal with gold, citizens with iuniores.
    const healResource: ResourceType = g.mercenary ? 'gold' : 'iuniores';
    const canHeal = g.healIndex != null && (g.mercenary ? currentGold > 0 : currentIuniores > 0);
    const spriteUrl = cohortSpriteUrl(cohorts.find((c) => c.id === g.id)?.spriteId);

    return (
      <div key={g.id} style={{
        width: VCARD_W, aspectRatio: '9 / 16', flex: '0 0 auto',
        background: g.ooaCount > 0 ? 'rgba(50, 18, 22, 0.5)' : 'rgba(20, 18, 32, 0.6)',
        border: '1px solid rgba(212, 168, 67, 0.15)',
        borderTop: `3px solid ${color}`,
        borderRadius: 2, overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}>
        <VCardArt
          spriteUrl={spriteUrl}
          role={g.role}
          corner={(
            <span style={{
              fontFamily: 'var(--imp-font-mono)', fontSize: 13, fontWeight: 700,
              color: 'var(--imp-text-hi)', padding: '1px 7px',
              background: 'rgba(14, 12, 24, 0.8)', border: '1px solid rgba(212, 168, 67, 0.35)',
              borderRadius: 2,
            }}>
              ×{g.count}
            </span>
          )}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 10px', flex: 1, minHeight: 0 }}>
          {/* Name + type */}
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontFamily: 'var(--imp-font-display)', fontSize: 'var(--imp-text-sm)',
              color: 'var(--imp-text-hi)', letterSpacing: 'var(--imp-meta-letter)',
              textTransform: 'uppercase', fontWeight: 600,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {g.name}
            </div>
            <div style={{
              fontSize: 'var(--imp-text-xs)', color: 'var(--imp-text-mid)',
              fontStyle: 'italic', fontFamily: 'var(--imp-font-serif)',
            }}>
              {g.mercenary ? 'Mercenary' : 'Citizen cohort'}
            </div>
          </div>

          {/* Aggregated HP bar */}
          <div>
            <div style={{
              position: 'relative', height: 8,
              background: 'rgba(60, 56, 80, 0.55)', borderRadius: 999, overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute', inset: 0, width: `${Math.min(ratio * 100, 100)}%`,
                background: hpFill, transition: 'width 200ms ease',
              }} />
            </div>
            <div style={{
              fontFamily: 'var(--imp-font-mono)', fontSize: 'var(--imp-text-xs)',
              color: 'var(--imp-text-mid)', whiteSpace: 'nowrap', textAlign: 'right', marginTop: 3,
            }}>
              {g.ooaCount > 0 && <span title="Out of action" style={{ color: '#e88858' }}>⚕ </span>}
              {sizeLabel(g.curHp)} / {sizeLabel(g.maxHp)}
            </div>
          </div>

          {/* Stats */}
          <StatGrid stats={g.stats} />

          {/* Foot: cost + actions */}
          <div style={{ marginTop: 'auto', paddingTop: 7, borderTop: '1px dashed rgba(212, 168, 67, 0.22)' }}>
            <div style={{
              fontFamily: 'var(--imp-font-mono)', fontSize: 'var(--imp-text-xs)', color: 'var(--imp-text-mid)',
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6,
            }}>
              <ResourceAmount type="gold" amount={g.aurumCost} iconSize="inline" />
              {g.mercenary
                ? <span title="Mercenary — gold-only heal." style={{ color: '#c99245' }}>gold heal</span>
                : <ResourceAmount type="iuniores" amount={IUNIORES.recruitCost} iconSize="inline" />}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 5 }}>
              {g.damagedCount > 0 ? (
                <button
                  onClick={() => g.healIndex != null && handleHealOne(g.healIndex, g.mercenary)}
                  disabled={!canHeal}
                  title={canHeal
                    ? `Heal the most-damaged ${g.name} (${g.healCost} ${healResource} for a full heal; partial if short).`
                    : g.mercenary ? 'Insufficient gold.' : 'Insufficient iuniores. Pool is empty.'}
                  class={`imp-card-cta imp-card-cta-${canHeal ? 'actionable' : 'disabled'}`}
                  style={{
                    flex: 1, padding: '5px 8px',
                    background: canHeal ? `linear-gradient(180deg, ${accent} 0%, #b8892a 100%)` : 'rgba(80, 70, 50, 0.3)',
                    border: 'none', borderRadius: 2,
                    color: canHeal ? 'var(--imp-ink)' : 'var(--imp-text-lo)',
                    fontSize: 'var(--imp-text-xs)', fontWeight: 700,
                    letterSpacing: 'var(--imp-meta-letter)', textTransform: 'uppercase',
                    fontFamily: 'var(--imp-font-display)',
                    cursor: canHeal ? 'pointer' : 'not-allowed', transition: 'all 160ms',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                  }}
                >
                  Heal <ResourceAmount type={healResource} amount={g.healCost} iconSize="inline" />
                </button>
              ) : <span />}
              {canConsolidate(cohorts, g.id) && (
                <button
                  onClick={() => { mergeConfirmId.value = g.id; }}
                  title={`Merge damaged ${g.name} cohorts into fewer full ones (conserves total HP, frees slots; no cost)`}
                  style={{
                    width: 26, height: 26, padding: 0,
                    background: 'transparent', border: '1px solid rgba(212, 168, 67, 0.5)',
                    borderRadius: 2, color: 'var(--imp-gold-hi)', fontSize: 14, lineHeight: 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', fontFamily: 'var(--imp-font-body)', flexShrink: 0,
                  }}
                >
                  ⛬
                </button>
              )}
              <button
                onClick={() => handleRemove(g.id)}
                title={`Disband one ${g.name}`}
                style={{
                  width: 26, height: 26, padding: 0,
                  background: 'transparent', border: '1px solid rgba(212, 168, 67, 0.35)',
                  borderRadius: 2, color: 'var(--imp-text-mid)', fontSize: 13, lineHeight: 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', fontFamily: 'var(--imp-font-body)', flexShrink: 0,
                }}
              >
                −
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Priority for the cohorts card (drives the BentoCard accent treatment).
  const cohortsPriority: CardPriority = ooaCount > 0 ? 'critical'
    : damagedCitizens.length > 0 ? 'urgent'
    : cohorts.length > 0 ? 'actionable' : 'neutral';

  return (
    <>
      <Masthead title="Exercitus" subtitle={subtitle} accent={accent} />

      {(() => {
        const id = mergeConfirmId.value;
        if (!id) return null;
        const name = cohorts.find((c) => c.id === id)?.name ?? id;
        const before = cohorts.filter((c) => c.id === id).length;
        const after = consolidateCohorts(cohorts, id).filter((c) => c.id === id).length;
        const freed = before - after;
        return (
          <ConfirmDialog
            open
            title="Fusionar cohortes"
            body={`Consolidar ${before} ${name} en ${after} cohorte${after === 1 ? '' : 's'}. Conserva el HP total y libera ${freed} ranura${freed === 1 ? '' : 's'} del roster. No cuesta oro ni iuniores.`}
            confirmLabel="Fusionar"
            cancelLabel="Cancelar"
            onConfirm={() => { handleMerge(id); mergeConfirmId.value = null; }}
            onCancel={() => { mergeConfirmId.value = null; }}
          />
        );
      })()}

      <div style={{
        flex: 1, minHeight: 0, overflow: 'auto',
        padding: '16px 32px 24px',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>

        {/* ── Army Status strip: totals + supplies + ammunition, all in one line ── */}
        <BentoCard
          accent={accent}
          index={0}
          priority={currentSupplies <= 0 ? 'critical' : (supplyRatio < 0.25 || ammoRatio < 0.2) ? 'urgent' : 'neutral'}
        >
          <div style={{
            display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '12px 22px',
          }}>
            {/* Cohort count */}
            <span style={{
              fontFamily: 'var(--imp-font-display)', fontSize: 'var(--imp-text-sm)',
              color: 'var(--imp-text-hi)', letterSpacing: 'var(--imp-meta-letter)',
              textTransform: 'uppercase', whiteSpace: 'nowrap',
            }}>
              ⚔ {cohorts.length} cohort{cohorts.length === 1 ? '' : 's'}
            </span>

            {/* Total HP */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '1 1 180px', minWidth: 150 }}>
              <span style={{ fontFamily: 'var(--imp-font-mono)', fontSize: 'var(--imp-text-xs)', color: 'var(--imp-text-mid)', whiteSpace: 'nowrap' }}>♥ HP</span>
              <MeterBar ratio={hpRatioTotal} tone="hp" />
              <span style={{ fontFamily: 'var(--imp-font-mono)', fontSize: 'var(--imp-text-xs)', color: 'var(--imp-text-mid)', whiteSpace: 'nowrap' }}>
                {sizeLabel(curHpTotal)} / {sizeLabel(maxHpTotal)}
              </span>
            </div>

            {/* Supplies */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, flex: '1 1 250px', minWidth: 230 }}>
              <span title="1 supply per cohort per node." style={{ fontFamily: 'var(--imp-font-display)', fontSize: 'var(--imp-text-xs)', textTransform: 'uppercase', letterSpacing: 'var(--imp-meta-letter)', color: 'var(--imp-text-mid)', whiteSpace: 'nowrap' }}>❦ Supp.</span>
              <MeterBar ratio={supplyRatio} tone="supply" />
              <span style={{ fontFamily: 'var(--imp-font-mono)', fontSize: 'var(--imp-text-xs)', color: 'var(--imp-text-mid)', whiteSpace: 'nowrap' }}>{currentSupplies}/{SUPPLY_MAX_CARRY}</span>
              <MiniBuyButton label="+2" enabled={!atCap && currentGold >= getDiscountedGold(Math.ceil(2 / SUPPLIES_PER_GOLD)) && currentSupplies + 2 <= SUPPLY_MAX_CARRY} onClick={() => handleBuySupplies(2)} />
              <MiniBuyButton label="+10" enabled={!atCap && currentGold >= getDiscountedGold(Math.ceil(10 / SUPPLIES_PER_GOLD)) && currentSupplies + 10 <= SUPPLY_MAX_CARRY} onClick={() => handleBuySupplies(10)} />
              <MiniBuyButton label={maxBuyable > 0 ? `Max +${maxBuyable}` : 'Max'} enabled={maxBuyable > 0} onClick={handleBuyMax} title={`1 gold = ${SUPPLIES_PER_GOLD} supplies · covers ≈ ${coversNodes} node${coversNodes === 1 ? '' : 's'}`} />
            </div>

            {/* Ammunition */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, flex: '1 1 230px', minWidth: 210 }}>
              <span title="The harass budget for the decisive battle." style={{ fontFamily: 'var(--imp-font-display)', fontSize: 'var(--imp-text-xs)', textTransform: 'uppercase', letterSpacing: 'var(--imp-meta-letter)', color: 'var(--imp-text-mid)', whiteSpace: 'nowrap' }}>➶ Ammo</span>
              <MeterBar ratio={ammoRatio} tone="supply" />
              <span style={{ fontFamily: 'var(--imp-font-mono)', fontSize: 'var(--imp-text-xs)', color: 'var(--imp-text-mid)', whiteSpace: 'nowrap' }}>{currentAmmo}/{AMMO_MAX_CARRY}</span>
              <MiniBuyButton label="+10" enabled={!ammoAtCap && currentGold >= getDiscountedGold(Math.ceil(10 / AMMO_PER_GOLD)) && currentAmmo + 10 <= AMMO_MAX_CARRY} onClick={() => handleBuyAmmo(10)} />
              <MiniBuyButton label={ammoBuyable > 0 ? `Max +${ammoBuyable}` : 'Max'} enabled={ammoBuyable > 0} onClick={handleBuyAmmoMax} title={`1 gold = ${AMMO_PER_GOLD} ammo`} />
            </div>
          </div>
        </BentoCard>

        {/* ── Two columns: cohorts/recruit (left) · legate/armor (right) ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 14, alignItems: 'start' }}>

          {/* LEFT */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
            <BentoCard accent={accent} index={1} priority={cohortsPriority}>
              <SectionHeader
                title="Cohorts"
                accent={accent}
                right={<span style={{ fontFamily: 'var(--imp-font-mono)', fontSize: 'var(--imp-text-sm)', color: 'var(--imp-text-mid)' }}>
                  {cohorts.length} · {sizeLabel(curHpTotal)}/{sizeLabel(maxHpTotal)} HP
                </span>}
              />
              {groups.length === 0 ? (
                <div style={{
                  padding: '10px 4px', fontFamily: 'var(--imp-font-serif)',
                  fontStyle: 'italic', fontSize: 'var(--imp-text-sm)', color: 'var(--imp-text-mid)',
                }}>
                  No cohorts recruited yet. Pick from the catalog below.
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    {groups.map(renderCohortCard)}
                  </div>

                  {/* Roster-health footer: summary + bulk replenish */}
                  {(damagedCitizens.length > 0 || damagedMercs.length > 0) && (
                    <div style={{
                      marginTop: 11, paddingTop: 10,
                      borderTop: '1px solid rgba(212, 168, 67, 0.18)',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      flexWrap: 'wrap', gap: 10,
                    }}>
                      <span style={{ fontFamily: 'var(--imp-font-mono)', fontSize: 'var(--imp-text-xs)', color: 'var(--imp-text-mid)' }}>
                        {damagedCitizens.length} damaged
                        {ooaCount > 0 && <span style={{ color: '#e88858' }}> · {ooaCount} ⚕</span>}
                        {damagedMercs.length > 0 && <span style={{ color: '#f0d080' }}> · {damagedMercs.length} merc</span>}
                        {hubPreview && hubPreview.partialHeal && <span style={{ color: '#c27a52' }}> · partial (pool short)</span>}
                      </span>
                      {hubPreview && (
                        <button
                          onClick={handleReplenishAll}
                          disabled={hubPreview.iunioresSpent === 0}
                          title={hubPreview.iunioresSpent === 0
                            ? 'No iuniores in the pool — heal nothing.'
                            : `Spend ${hubPreview.iunioresSpent} iuniores to restore ${hubPreview.hpRestored} HP.`}
                          style={{
                            padding: '7px 14px',
                            background: hubPreview.iunioresSpent > 0 ? `linear-gradient(180deg, ${accent} 0%, #b8892a 100%)` : 'rgba(80, 70, 50, 0.3)',
                            border: 'none', borderRadius: 2,
                            color: hubPreview.iunioresSpent > 0 ? 'var(--imp-ink)' : 'var(--imp-text-lo)',
                            fontSize: 'var(--imp-text-xs)', fontWeight: 700,
                            letterSpacing: 'var(--imp-meta-letter)', textTransform: 'uppercase',
                            fontFamily: 'var(--imp-font-display)',
                            cursor: hubPreview.iunioresSpent > 0 ? 'pointer' : 'not-allowed',
                            display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap',
                          }}
                        >
                          Replenish roster <ResourceAmount type="iuniores" amount={hubPreview.iunioresSpent} iconSize="inline" />
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}
            </BentoCard>

            {/* Recruit */}
            <BentoCard
              accent={accent}
              index={2}
              priority={[...recruitableCohorts, ...mercenaryCohorts].some((c) => getRecruitCohortFailure(c.id) === null) ? 'actionable' : 'disabled'}
            >
              <SectionHeader
                title="Recruit"
                accent={accent}
                right={<span style={{
                  fontSize: 'var(--imp-text-xs)', color: 'var(--imp-text-mid)',
                  letterSpacing: 'var(--imp-meta-letter)', textTransform: 'uppercase',
                }}>
                  <ResourceIcon type="gold" size="row" /> {currentGold} | <ResourceIcon type="iuniores" size="row" /> {currentIuniores}
                </span>}
              />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {recruitableCohorts.map(renderRecruitCard)}
              </div>
              {mercenaryCohorts.length > 0 && (
                <>
                  <div style={{
                    marginTop: 10, paddingTop: 10,
                    borderTop: '1px solid rgba(212, 168, 67, 0.18)',
                    display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12,
                    marginBottom: 8,
                  }}>
                    <div style={{
                      fontFamily: 'var(--imp-font-display)', fontSize: 'var(--imp-text-sm)',
                      letterSpacing: 'var(--imp-meta-letter)', textTransform: 'uppercase', color: '#f0d080',
                    }}>
                      Mercenary Contracts
                    </div>
                    <div style={{
                      fontSize: 'var(--imp-text-xs)', color: 'var(--imp-text-mid)',
                      fontFamily: 'var(--imp-font-serif)', fontStyle: 'italic', textAlign: 'right',
                    }}>
                      Remain recruitable when citizen cohorts fail the iuniores gate.
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    {mercenaryCohorts.map(renderRecruitCard)}
                  </div>
                </>
              )}
            </BentoCard>
          </div>

          {/* RIGHT */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
            {/* Legatus — compact */}
            <BentoCard accent={accent} index={3} priority={legate ? 'actionable' : 'urgent'}>
              <SectionHeader title="Legatus" accent={accent} />
              {legate ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: '50%', flexShrink: 0,
                    border: `2px solid ${accent}`,
                    background: `radial-gradient(circle, ${accent}33 0%, var(--imp-ink) 70%)`,
                    boxShadow: `0 0 14px ${accent}40`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'var(--imp-font-display)', fontSize: 26, color: accent, opacity: 0.85,
                  }}>
                    {legate.name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: 'var(--imp-font-display)', fontSize: 14, color: 'var(--imp-text-hi)',
                      letterSpacing: 'var(--imp-meta-letter)', textTransform: 'uppercase', fontWeight: 600,
                    }}>
                      {legate.name}
                    </div>
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 5 }}>
                      {legate.traitIds.map((tid) => {
                        const trait = getLegateTraitById(tid);
                        if (!trait) return null;
                        return (
                          <div key={tid} title={trait.description} style={{
                            padding: '2px 7px', background: `${accent}18`, border: `1px solid ${accent}66`,
                            borderRadius: 2, fontSize: 'var(--imp-text-xs)', color: accent,
                            fontFamily: 'var(--imp-font-display)', letterSpacing: 'var(--imp-meta-letter)',
                            textTransform: 'uppercase', fontWeight: 600,
                          }}>
                            {trait.name}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <button
                    onClick={handleDismiss}
                    title="Dismiss legate"
                    style={{
                      flexShrink: 0, width: 28, height: 28, padding: 0,
                      background: 'transparent', border: '1px solid rgba(194, 74, 58, 0.55)',
                      borderRadius: 2, color: '#c24a3a', fontSize: 13, lineHeight: 1, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'var(--imp-font-body)',
                    }}
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div style={{
                  padding: '14px 8px', textAlign: 'center', fontFamily: 'var(--imp-font-serif)',
                  fontStyle: 'italic', fontSize: 'var(--imp-text-sm)', color: 'var(--imp-text-mid)',
                }}>
                  No legate hired. Pick a candidate below.
                </div>
              )}
            </BentoCard>

            {/* Armor */}
            <BentoCard accent={accent} index={4} priority={canUpgradeArmor ? 'actionable' : 'neutral'}>
              <SectionHeader
                title="Armor"
                accent={accent}
                right={<span style={{ fontFamily: 'var(--imp-font-mono)', fontSize: 'var(--imp-text-sm)', color: 'var(--imp-text-mid)' }}>
                  {ARMORS[armorMaterial]}% mitig.
                </span>}
              />
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 12px',
                background: 'rgba(20, 18, 32, 0.6)',
                border: '1px solid rgba(212, 168, 67, 0.15)',
                borderLeft: `3px solid ${accent}`, borderRadius: 2,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: 'var(--imp-font-display)', fontSize: 'var(--imp-text-sm)',
                    color: 'var(--imp-text-hi)', letterSpacing: 'var(--imp-meta-letter)', textTransform: 'uppercase',
                  }}>
                    {armorLabel} Armor
                  </div>
                  <div style={{
                    fontSize: 'var(--imp-text-sm)', color: 'var(--imp-text-mid)',
                    fontFamily: 'var(--imp-font-serif)', fontStyle: 'italic', marginTop: 2,
                  }}>
                    {ARMORS[armorMaterial]}% damage mitigation
                    {nextArmorLabel ? ` · next: ${nextArmorLabel} (${ARMORS[nextArmor!]}%)` : ' · max tier'}
                  </div>
                </div>
                <button
                  onClick={handleUpgradeArmor}
                  disabled={!canUpgradeArmor}
                  title={nextArmor == null ? 'Armor is at the highest tier.' : `Upgrade to ${nextArmorLabel} for ${armorCost} gold.`}
                  style={{
                    flexShrink: 0, padding: '6px 12px',
                    background: canUpgradeArmor ? `linear-gradient(180deg, ${accent} 0%, #b8892a 100%)` : 'rgba(80, 70, 50, 0.3)',
                    border: 'none', borderRadius: 2,
                    color: canUpgradeArmor ? 'var(--imp-ink)' : 'var(--imp-text-lo)',
                    fontFamily: 'var(--imp-font-display)', fontSize: 'var(--imp-text-xs)', fontWeight: 700,
                    letterSpacing: 'var(--imp-meta-letter)', textTransform: 'uppercase',
                    cursor: canUpgradeArmor ? 'pointer' : 'not-allowed', transition: 'all 160ms',
                  }}
                >
                  {nextArmor == null ? 'Max' : <>Upgrade — <ResourceAmount type="gold" amount={armorCost ?? 0} iconSize="inline" /></>}
                </button>
              </div>
            </BentoCard>

            {/* Hiring pool — shown when no legate */}
            {!legate && (
              <BentoCard accent={accent} index={5} priority={pool.length > 0 ? 'actionable' : 'disabled'}>
                <SectionHeader
                  title="Hiring Pool"
                  accent={accent}
                  right={<span style={{
                    fontSize: 'var(--imp-text-xs)', color: 'var(--imp-text-mid)',
                    letterSpacing: 'var(--imp-meta-letter)', textTransform: 'uppercase',
                  }}>
                    <ResourceAmount type="gold" amount={LEGATE_HIRE_COST} iconSize="inline" /> each
                  </span>}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {pool.length === 0 && (
                    <div style={{
                      padding: '10px 4px', fontFamily: 'var(--imp-font-serif)',
                      fontStyle: 'italic', fontSize: 'var(--imp-text-sm)', color: 'var(--imp-text-mid)',
                    }}>
                      The hiring pool is empty.
                    </div>
                  )}
                  {pool.map((candidate) => {
                    const affordable = currentGold >= LEGATE_HIRE_COST;
                    return (
                      <div key={candidate.id} style={{
                        padding: '10px 12px', background: 'rgba(20, 18, 32, 0.5)',
                        border: '1px solid rgba(212, 168, 67, 0.15)', borderRadius: 2,
                        display: 'flex', flexDirection: 'column', gap: 8,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 34, height: 34, borderRadius: '50%',
                            border: `1px solid ${accent}55`,
                            background: `radial-gradient(circle, ${accent}22 0%, var(--imp-panel) 100%)`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontFamily: 'var(--imp-font-display)', fontSize: 15, fontWeight: 700, color: accent, flexShrink: 0,
                          }}>
                            {candidate.name.charAt(0).toUpperCase()}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontFamily: 'var(--imp-font-display)', fontSize: 'var(--imp-text-sm)',
                              color: 'var(--imp-text-hi)', letterSpacing: 1, textTransform: 'uppercase', fontWeight: 600,
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              {candidate.name}
                            </div>
                            <div style={{
                              fontSize: 'var(--imp-text-xs)', color: 'var(--imp-text-mid)',
                              fontStyle: 'italic', fontFamily: 'var(--imp-font-serif)',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              {candidate.traitIds.map((t) => getLegateTraitById(t)?.name).filter(Boolean).join(' · ') || '—'}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleHire(candidate.id)}
                          disabled={!affordable}
                          style={{
                            padding: '6px 10px',
                            background: affordable ? `linear-gradient(180deg, ${accent} 0%, #b8892a 100%)` : 'rgba(80, 70, 50, 0.3)',
                            border: 'none', borderRadius: 2,
                            color: affordable ? 'var(--imp-ink)' : 'var(--imp-text-lo)',
                            fontSize: 'var(--imp-text-xs)', fontWeight: 700,
                            letterSpacing: 'var(--imp-meta-letter)', textTransform: 'uppercase',
                            fontFamily: 'var(--imp-font-display)', cursor: affordable ? 'pointer' : 'not-allowed',
                          }}
                        >
                          Hire — <ResourceAmount type="gold" amount={LEGATE_HIRE_COST} iconSize="inline" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </BentoCard>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
