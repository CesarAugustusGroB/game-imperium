import { useState } from 'preact/hooks';
import type { Province } from '../../../../game/province/province';
import {
  INVESTMENT_DATA, calculateNetWealthChange,
  getProvinceIncome, getProvinceExpenses,
} from '../../../../game/province/province';
import { getAssignedGovernor, getGovernorTraits, getGovernorSalary } from '../../../../game/province/governor-store';
import { ROMAN } from '../../../ui-constants';
import { TERRAIN_ICONS, TRADE_GOOD_ICONS } from '../tabs/ProvinciaeTab';
import { Tooltip } from '../../../components/Tooltip';
import { ResourceAmount } from '../../../components/ResourceIcon';
import { getPriorityStyle, priorityClass, type CardPriority } from '../../../components/card-priority';

interface ProvinceRowProps {
  p: Province;
  accent?: string;
  onClick?: () => void;
  selected?: boolean;
}

/**
 * Render a single province row — used in the Forum Overview and the full
 * Provinciae tab ledger. Only reads fields that exist on Province today
 * (name, unrest, investments, baseIncome, governorId). Design fields we
 * don't have (tier "Core/Heartland/...", build-max) are derived or
 * omitted rather than invented.
 */
export function ProvinceRow({ p, accent = '#d4a843', onClick, selected = false }: ProvinceRowProps) {
  const [hover, setHover] = useState(false);

  const unrestColor =
    p.unrest > 60 ? '#c24a3a' :
    p.unrest > 35 ? accent :
    '#7a9a6a';

  // Real net gold per season — mirrors the tick (getProvinceIncome) minus
  // upkeep + governor salary — so the row matches the ledger, not stale
  // baseIncome. Net (not gross) to honour the red/green coloring below.
  const traits = getGovernorTraits(p.id);
  const totalIncome =
    (getProvinceIncome(p, traits).gold ?? 0)
    - getProvinceExpenses(p, traits)
    - getGovernorSalary(p.id);
  const assigned = getAssignedGovernor(p.id);
  const governorName = assigned?.governor.name ?? null;

  // ── Rich hover tooltip — mirrors the one on the full Provinciae tab's ledger row ──
  const terrainIcon = TERRAIN_ICONS[p.terrain] ?? '?';
  const tradeIcon = p.tradeGood ? (TRADE_GOOD_ICONS[p.tradeGood] ?? '') : '';
  const netWealthChange = calculateNetWealthChange(p, p.terrain);
  const tooltipUnrestColor =
    p.unrest < 40 ? 'var(--color-success)' :
    p.unrest < 70 ? 'var(--color-warning)' :
    'var(--color-danger)';
  const priority: CardPriority = selected
    ? 'selected'
    : p.unrest >= 70
      ? 'critical'
      : p.unrest >= 45
        ? 'urgent'
        : totalIncome > 0
          ? 'actionable'
          : 'neutral';

  const rowTooltip = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <div style={{ fontWeight: 700, color: 'var(--color-gold-primary)', marginBottom: '2px' }}>
        {p.name}
      </div>
      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
        {terrainIcon} {p.terrain}{tradeIcon ? ` · ${tradeIcon} ${p.tradeGood}` : ''}
      </div>
      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
        Wealth: {p.wealth} ({netWealthChange >= 0 ? '+' : ''}{netWealthChange.toFixed(1)}/s)
      </div>
      <div style={{ fontSize: 'var(--font-size-xs)', color: tooltipUnrestColor }}>
        Unrest: {p.unrest}/100
      </div>
      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
        Net: <ResourceAmount type="gold" amount={totalIncome} sign={totalIncome >= 0 ? '+' : ''} iconSize="inline" /> / turn · Governor: {governorName ?? 'none'}
      </div>
      {p.investments.length > 0 && (
        <div style={{ marginTop: '3px', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>
          {p.investments.map(inv => `${INVESTMENT_DATA[inv.type].name} ${ROMAN[inv.level]}`).join(' · ')}
        </div>
      )}
    </div>
  );

  return (
    <Tooltip content={rowTooltip} variant="rich" position="right">
    <div
      class={priorityClass(priority)}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: '9px 11px',
        background:
          selected ? 'rgba(80, 60, 20, 0.25)' :
          hover ? 'rgba(40, 36, 60, 0.7)' :
          'rgba(20, 18, 32, 0.4)',
        border: `1px solid ${selected || hover ? 'rgba(212, 168, 67, 0.35)' : 'rgba(212, 168, 67, 0.15)'}`,
        borderLeft: `3px solid ${accent}`,
        borderRadius: 2,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 150ms',
        display: 'flex', alignItems: 'center', gap: 10,
        ...getPriorityStyle(priority, accent),
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: 'var(--imp-font-serif)',
          fontSize: 13,
          color: 'var(--imp-text-hi)',
          fontStyle: 'italic',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {p.name}
        </div>
        <div style={{
          fontSize: 'var(--imp-text-xs)', letterSpacing: 'var(--imp-meta-letter)',
          color: 'var(--imp-text-mid)',
          textTransform: 'uppercase',
        }}>
          {p.terrain} · {governorName ?? 'ungoverned'}
        </div>
      </div>
      <div style={{ width: 56 }}>
        <div style={{
          fontSize: 'var(--imp-text-xs)', letterSpacing: 'var(--imp-meta-letter)',
          color: 'var(--imp-text-mid)',
          textTransform: 'uppercase',
          marginBottom: 2,
        }}>
          Unrest
        </div>
        <div style={{
          width: '100%', height: 3,
          background: 'rgba(0, 0, 0, 0.5)',
          borderRadius: 2, overflow: 'hidden',
        }}>
          <div style={{
            width: `${Math.max(0, Math.min(100, p.unrest))}%`,
            height: '100%',
            background: unrestColor,
            boxShadow: `0 0 4px ${unrestColor}`,
          }} />
        </div>
      </div>
      <div style={{ textAlign: 'right', minWidth: 50 }}>
        <div style={{
          fontFamily: 'var(--imp-font-mono)',
          fontSize: 'var(--imp-text-sm)',
          color: totalIncome >= 0 ? '#7a9a6a' : '#c24a3a',
          fontWeight: 600,
        }}>
          <ResourceAmount type="gold" amount={totalIncome} sign={totalIncome >= 0 ? '+' : ''} iconSize="row" />
        </div>
        <div style={{
          fontSize: 'var(--imp-text-xs)',
          color: 'var(--imp-text-mid)',
          letterSpacing: 0.5,
        }}>
          {p.investments.length} built
        </div>
      </div>
    </div>
    </Tooltip>
  );
}
