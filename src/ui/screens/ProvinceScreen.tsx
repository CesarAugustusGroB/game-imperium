import { signal } from '@preact/signals';
import { navigateTo } from '../screens';
import { selectedCommander } from '../../game/core/game-state';
import { playSfx } from '../sound/sfx';
import { provinces, buildInvestment, canAffordCost, getNextInvestmentLevel } from '../../game/province/province-store';
import {
  INVESTMENT_DATA, getProvinceIncome, getProvinceExpenses, getUnrestModifier,
  getInvestmentDiscount, applyInvestmentDiscount,
  type InvestmentType, type Province,
} from '../../game/province/province';
import { FACTION_COLORS, RESOURCE_INFO, type ResourceType } from '../../game/core/commander';
import { getResource } from '../../game/core/resources';
import { getHireCost } from '../../game/province/governor';
import {
  governorPool, governorAssignments,
  getAssignedGovernor, getGovernorTraits,
  hireGovernor, dismissGovernor,
} from '../../game/province/governor-store';
import { nextInvestmentDiscount } from '../../game/progression/strategic-store';
import { ROMAN, formatCost } from '../ui-constants';
import { Portrait } from '../components/Portrait';
import { Tooltip } from '../components/Tooltip';
import { BuildingIcon } from '../components/BuildingIcon';
import { OrnateFrame, OrnateHeader } from '../components/OrnateFrame';

// ── One-time CSS injection ──
if (typeof document !== 'undefined' && !document.getElementById('province-styles')) {
  const el = document.createElement('style');
  el.id = 'province-styles';
  el.textContent = `
    /* ── Province ledger rows ── */
    .prov-row { transition: all var(--duration-fast) var(--ease-default); cursor: pointer; }
    .prov-row:hover { border-color: var(--color-border-strong) !important; background: rgba(40, 35, 60, 0.55) !important; }
    .prov-row:active { transform: scale(0.99); }
    .prov-row-selected {
      border-color: var(--color-gold-primary) !important;
      background: rgba(80, 60, 20, 0.35) !important;
      box-shadow: inset 3px 0 0 var(--color-gold-primary);
    }
    .prov-ledger::-webkit-scrollbar { width: 4px; }
    .prov-ledger::-webkit-scrollbar-track { background: transparent; }
    .prov-ledger::-webkit-scrollbar-thumb { background: rgba(180, 160, 100, 0.25); border-radius: 2px; }
    .prov-ledger::-webkit-scrollbar-thumb:hover { background: rgba(180, 160, 100, 0.45); }
    .prov-ledger { scrollbar-width: thin; scrollbar-color: rgba(180,160,100,0.25) transparent; }

    /* ── Governor card ── */
    .gov-strip {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 14px 16px;
      background: linear-gradient(90deg, rgba(40, 30, 60, 0.55), rgba(20, 16, 32, 0.4));
      border: 1px solid var(--color-border-default);
      border-radius: var(--radius-md);
      position: relative;
      overflow: hidden;
    }
    .gov-strip::before {
      content: '';
      position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
      background: var(--color-gold-secondary);
    }
    .gov-name {
      font-family: var(--font-display);
      font-size: var(--font-size-lg);
      font-weight: 600;
      letter-spacing: 2px;
      text-transform: uppercase;
    }
    .gov-tier-pill {
      display: inline-flex; align-items: center; justify-content: center;
      min-width: 22px; height: 18px; padding: 0 6px;
      border-radius: 9px;
      background: rgba(50, 42, 12, 0.85);
      border: 1px solid var(--color-gold-primary);
      color: var(--color-gold-primary);
      font-size: var(--font-size-xs); font-weight: 700;
      letter-spacing: 1px;
    }
    .gov-dismiss-btn { transition: all var(--duration-fast) var(--ease-default); cursor: pointer; }
    .gov-dismiss-btn:hover { background: rgba(180, 60, 40, 0.4) !important; border-color: rgba(200, 80, 60, 0.6) !important; color: #e8a0a0 !important; }
    .gov-hire-btn { transition: all var(--duration-fast) var(--ease-default); cursor: pointer; }
    .gov-hire-btn:hover { border-color: var(--color-gold-primary) !important; color: var(--color-gold-primary) !important; background: rgba(80, 60, 20, 0.5) !important; }
    .gov-hire-btn:active { transform: scale(0.97); }

    /* ── Investment hero cards ── */
    .inv-card {
      position: relative;
      display: flex; flex-direction: column;
      background: linear-gradient(180deg, rgba(40, 32, 60, 0.5) 0%, rgba(18, 14, 32, 0.85) 100%);
      border: 1px solid var(--color-border-default);
      border-radius: var(--radius-md);
      overflow: hidden;
      transition: all var(--duration-fast) var(--ease-default);
    }
    .inv-card:hover {
      border-color: var(--color-gold-primary);
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4), 0 0 16px rgba(240, 208, 128, 0.15);
    }
    .inv-card.inv-locked { opacity: 0.78; }
    .inv-hero {
      position: relative;
      height: 96px;
      display: flex; align-items: center; justify-content: center;
      border-bottom: 1px solid var(--color-border-default);
    }
    .inv-hero::before {
      content: '';
      position: absolute; inset: 0;
      background: radial-gradient(ellipse at center, rgba(240, 208, 128, 0.08) 0%, transparent 70%);
      pointer-events: none;
    }
    .inv-level {
      position: absolute;
      top: 6px; right: 6px;
      min-width: 22px; height: 22px;
      padding: 0 6px;
      display: flex; align-items: center; justify-content: center;
      background: rgba(20, 16, 32, 0.85);
      border: 1px solid var(--color-gold-primary);
      border-radius: 11px;
      font-family: var(--font-display);
      font-size: var(--font-size-xs);
      font-weight: 700;
      color: var(--color-gold-primary);
      letter-spacing: 0.5px;
    }
    .inv-nameplate {
      padding: 8px 12px 4px;
      font-family: var(--font-display);
      font-size: var(--font-size-md);
      font-weight: 700;
      color: var(--color-gold-primary);
      letter-spacing: 2px;
      text-transform: uppercase;
      text-align: center;
      text-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
    }
    .inv-desc {
      padding: 0 12px 10px;
      font-size: var(--font-size-xs);
      color: var(--color-text-secondary);
      text-align: center;
      line-height: 1.45;
      flex: 1;
      min-height: 32px;
    }
    /* Position override for ornate-btn inside investment cards */
    .inv-card .ornate-btn { margin: 0 10px 10px; }
    .inv-maxed {
      margin: 0 10px 10px;
      padding: 7px 8px;
      font-size: var(--font-size-xs);
      font-weight: 700;
      letter-spacing: 1px;
      color: rgba(90, 138, 74, 0.85);
      text-transform: uppercase;
      text-align: center;
      border: 1px solid rgba(90, 138, 74, 0.3);
      border-radius: var(--radius-sm);
      background: rgba(30, 50, 30, 0.3);
    }

    /* ── Animations ── */
    @keyframes prov-fade-in {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes inv-build-success {
      0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(240,208,128,0); }
      40% { transform: scale(1.05); box-shadow: 0 0 20px 6px rgba(240,208,128,0.5); }
      100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(240,208,128,0); }
    }
    .inv-slot-building { animation: inv-build-success 0.5s ease-out; }

    /* ── Governor picker modal ── */
    .gov-picker-card { transition: all var(--duration-fast) var(--ease-default); }
    .gov-tier-btn { transition: all var(--duration-fast) var(--ease-default); cursor: pointer; }
    .gov-tier-btn:hover:not(:disabled) {
      border-color: var(--color-gold-primary) !important;
      background: rgba(80, 60, 20, 0.6) !important;
      color: #fff0c0 !important;
    }
    .gov-tier-btn:disabled { opacity: 0.35; cursor: not-allowed; }
    .gov-tier-btn:active:not(:disabled) { transform: scale(0.96); }

    /* ── Responsive ── */
    @media (max-width: 720px) {
      .ornate-frame { padding: 18px 14px; }
      .ornate-title { font-size: 32px; letter-spacing: 4px; }
      .prov-layout { flex-direction: column !important; }
      .prov-ledger { flex: 1 1 auto !important; max-height: 200px !important; }
      .inv-grid { grid-template-columns: repeat(2, 1fr) !important; }
    }
  `;
  document.head.appendChild(el);
}

const ALL_INVESTMENTS: InvestmentType[] = ['castrum', 'basilica', 'pantheon', 'market', 'aqueduct', 'insula'];

const selectedProvinceId = signal<string | null>(null);
const showGovernorPicker = signal(false);
const buildingSlotType = signal<string | null>(null);

// ── Helpers ──

function formatIncome(income: Partial<Record<ResourceType, number>>): string {
  const parts = (Object.entries(income) as [ResourceType, number][])
    .filter(([, amt]) => amt > 0)
    .map(([res, amt]) => `${RESOURCE_INFO[res].icon}${amt}`);
  return parts.length > 0 ? parts.join(' ') : '-';
}

function UnrestBar({ unrest, modifier, width = 60 }: { unrest: number; modifier: number; width?: number }) {
  const pct = Math.min(100, Math.max(0, unrest));
  const barColor = pct > 70 ? 'var(--color-danger)' : pct > 40 ? 'var(--color-gold-secondary)' : 'var(--color-success)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <div style={{ width: `${width}px`, height: '5px', background: 'rgba(40, 35, 60, 0.8)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: barColor, borderRadius: 'var(--radius-sm)', transition: 'width var(--duration-slow) var(--ease-default)' }} />
      </div>
      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', minWidth: '20px' }}>{unrest}</span>
      {modifier !== 0 && (
        <span style={{ fontSize: '8px', color: modifier < 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
          {modifier > 0 ? '+' : ''}{modifier}/s
        </span>
      )}
    </div>
  );
}

// ── Investment hero card ──

function InvestmentSlot({ province, type }: { province: Province; type: InvestmentType }) {
  const data = INVESTMENT_DATA[type];
  const existing = province.investments.find(i => i.type === type);
  const currentLevel = existing?.level ?? 0;
  const nextLevel = getNextInvestmentLevel(province, type);
  const maxed = nextLevel === 0;
  const fColor = FACTION_COLORS[data.color];

  const nextEffect = nextLevel > 0 ? data.levels[nextLevel - 1] : null;
  const currentEffect = currentLevel > 0 ? data.levels[currentLevel - 1] : null;
  const baseCost = nextEffect?.buildCost;

  // Apply governor + scroll investment discounts for display
  const traits = getGovernorTraits(province.id);
  const governorDiscount = getInvestmentDiscount(traits);
  const scrollDiscount = nextInvestmentDiscount.value;
  const effectiveDiscount = Math.min(90, governorDiscount + scrollDiscount);
  const cost = baseCost && effectiveDiscount > 0 ? applyInvestmentDiscount(baseCost, effectiveDiscount) : baseCost;
  const affordable = cost ? canAffordCost(cost) : false;

  // Force signal reads for reactivity on resource changes
  getResource('gold');
  getResource('faith');
  getResource('influence');
  getResource('momentum');

  function handleBuild() {
    if (nextLevel > 0) {
      playSfx('ui_click');
      buildInvestment(province.id, type);
      buildingSlotType.value = type;
      setTimeout(() => { buildingSlotType.value = null; }, 600);
    }
  }

  const incomeBonus = currentEffect?.incomeBonus ?? {};
  const unrestChange = currentEffect?.unrestChange ?? 0;

  const investmentTooltip = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <div style={{ fontWeight: 700, color: 'var(--color-gold-primary)' }}>
        {data.name}{currentLevel > 0 ? ` Lv.${currentLevel}` : ''}
      </div>
      {currentLevel === 0 ? (
        <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
          {data.flavour}
        </div>
      ) : (
        <div>
          <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
            {currentEffect?.description ?? ''}
          </div>
          {(Object.entries(incomeBonus) as [ResourceType, number][]).map(([res, amt]) => (
            amt > 0 ? (
              <div key={res} style={{ color: 'var(--color-success)', fontSize: 'var(--font-size-xs)' }}>
                +{amt} {RESOURCE_INFO[res].icon} per spoke
              </div>
            ) : null
          ))}
          {unrestChange < 0 && (
            <div style={{ color: 'var(--color-success)', fontSize: 'var(--font-size-xs)' }}>
              {unrestChange} unrest per spoke
            </div>
          )}
        </div>
      )}
      {nextLevel > 0 && cost && (
        <div style={{ marginTop: '4px', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>
          {currentLevel === 0 ? 'Build' : `Upgrade to Lv.${nextLevel}`}: {formatCost(cost)}
        </div>
      )}
    </div>
  );

  const heroBg = currentLevel > 0
    ? `radial-gradient(ellipse at center, ${fColor}28 0%, transparent 70%), linear-gradient(180deg, rgba(40, 32, 60, 0.7), rgba(18, 14, 32, 0.95))`
    : `linear-gradient(180deg, rgba(40, 32, 60, 0.5), rgba(18, 14, 32, 0.85))`;

  return (
    <Tooltip content={investmentTooltip} variant="rich" position="above">
      <div
        class={`inv-card${currentLevel === 0 ? ' inv-locked' : ''}${buildingSlotType.value === type ? ' inv-slot-building' : ''}`}
        style={{ borderTop: `2px solid ${currentLevel > 0 ? fColor : 'rgba(180, 160, 100, 0.18)'}` }}
      >
        <div class="inv-hero" style={{ background: heroBg }}>
          <BuildingIcon type={type} size={64} color={currentLevel > 0 ? fColor : 'var(--color-gold-secondary)'} />
          {currentLevel > 0 && <span class="inv-level">{ROMAN[currentLevel]}</span>}
        </div>
        <div class="inv-nameplate" style={currentLevel > 0 ? { color: fColor } : undefined}>
          {data.name}
        </div>
        <div class="inv-desc">
          {currentEffect ? currentEffect.description : <em style={{ opacity: 0.7 }}>{data.flavour}</em>}
        </div>
        {!maxed && cost && (
          <button class="ornate-btn" disabled={!affordable} onClick={handleBuild}>
            {currentLevel === 0 ? 'Build' : `${ROMAN[currentLevel]} → ${ROMAN[nextLevel]}`} · {formatCost(cost)}
          </button>
        )}
        {maxed && <div class="inv-maxed">Max Level</div>}
      </div>
    </Tooltip>
  );
}

// ── Province ledger row ──

function ProvinceRow({ province, selected }: { province: Province; selected: boolean }) {
  const traits = getGovernorTraits(province.id);
  const income = getProvinceIncome(province, traits);
  const expenses = getProvinceExpenses(province, traits);
  const unrestMod = getUnrestModifier(province, traits);
  const invCount = province.investments.length;

  const unrestColor =
    province.unrest < 40
      ? 'var(--color-success)'
      : province.unrest < 70
      ? 'var(--color-warning)'
      : 'var(--color-danger)';

  const rowTooltip = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
      <div style={{ fontWeight: 700, color: 'var(--color-gold-primary)', marginBottom: '2px' }}>
        {province.name}
      </div>
      <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)' }}>
        Population: {province.population}
      </div>
      <div style={{ color: unrestColor, fontSize: 'var(--font-size-sm)' }}>
        Unrest: {province.unrest}/100
      </div>
      {invCount > 0 && (
        <div style={{ marginTop: '4px', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)' }}>
          {province.investments.map(inv => `${INVESTMENT_DATA[inv.type].name} Lv.${inv.level}`).join(', ')}
        </div>
      )}
    </div>
  );

  return (
    <div style={{ display: 'contents' }}>
      <Tooltip content={rowTooltip} variant="rich" position="right">
        <div
          class={`prov-row${selected ? ' prov-row-selected' : ''}`}
          onClick={() => { selectedProvinceId.value = province.id; }}
          style={{
            padding: '12px 14px',
            borderRadius: 'var(--radius-md)',
            background: selected ? 'rgba(80, 60, 20, 0.35)' : 'rgba(20, 16, 32, 0.5)',
            border: `1px solid ${selected ? 'var(--color-gold-primary)' : 'var(--color-border-default)'}`,
            display: 'flex', flexDirection: 'column', gap: '6px',
          }}
        >
          {/* Row header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'var(--font-size-md)',
                fontWeight: 600,
                color: selected ? 'var(--color-gold-primary)' : 'var(--color-text-primary)',
                letterSpacing: '2px',
                textTransform: 'uppercase',
              }}
            >
              {province.name}
            </div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
              {invCount}/6
            </div>
          </div>

          {/* Stats row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
              Pop {province.population}
            </div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
              {formatIncome(income)}
            </div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'rgba(200, 160, 100, 0.45)' }}>
              -{expenses}g
            </div>
          </div>
          <UnrestBar unrest={province.unrest} modifier={unrestMod} width={80} />
        </div>
      </Tooltip>
    </div>
  );
}

// ── Governor picker (modal content) ──

function GovernorPicker({ provinceId }: { provinceId: string }) {
  const pool = governorPool.value;

  // Force signal reads for reactivity
  getResource('gold');
  getResource('faith');
  getResource('influence');
  getResource('momentum');

  if (pool.length === 0) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
        All governors assigned to other provinces
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', animation: 'prov-fade-in var(--duration-fast) var(--ease-default)' }}>
      {pool.map(gov => {
        const fColor = FACTION_COLORS[gov.color];
        return (
          <div
            key={gov.id}
            class="gov-picker-card"
            style={{
              background: 'linear-gradient(90deg, rgba(30, 24, 50, 0.7), rgba(18, 14, 32, 0.85))',
              border: '1px solid var(--color-border-default)',
              borderLeft: `3px solid ${fColor}`,
              borderRadius: 'var(--radius-md)',
              padding: '12px 14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <div style={{
                width: '28px', height: '28px', borderRadius: '50%',
                background: `${fColor}22`, border: `2px solid ${fColor}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-display)', fontSize: 'var(--font-size-md)', fontWeight: 700, color: fColor,
              }}>
                {gov.name[0]}
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'var(--font-size-md)',
                  fontWeight: 600,
                  color: fColor,
                  letterSpacing: '2px',
                  textTransform: 'uppercase',
                }}
              >
                {gov.name}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {([1, 2, 3] as const).map(tier => {
                const cost = getHireCost(gov, tier);
                const affordable = canAffordCost(cost);
                const tierData = gov.tiers[tier - 1];
                return (
                  <button
                    key={tier}
                    class="gov-tier-btn"
                    disabled={!affordable}
                    onClick={() => {
                      hireGovernor(gov.id, provinceId, tier);
                      showGovernorPicker.value = false;
                    }}
                    title={tierData.description}
                    style={{
                      flex: '1 1 0', minWidth: '100px',
                      padding: '8px 8px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'rgba(50, 42, 12, 0.5)',
                      border: '1px solid var(--color-border-strong)',
                      color: 'var(--color-gold-primary)',
                      fontFamily: 'inherit',
                      fontSize: 'var(--font-size-xs)', fontWeight: 600,
                      letterSpacing: '0.5px', textTransform: 'uppercase',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <span class="gov-tier-pill">{ROMAN[tier]}</span>
                      Tier {ROMAN[tier]}
                    </span>
                    <span style={{ fontSize: '8px', opacity: 0.6, fontWeight: 400, textTransform: 'none', lineHeight: '1.3', textAlign: 'center' }}>
                      {tierData.description.split(' ').slice(0, 6).join(' ')}
                    </span>
                    <span style={{ fontSize: '9px', color: 'var(--color-gold-secondary)', fontWeight: 700 }}>{formatCost(cost)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Province detail (right panel: governor strip + building grid) ──

function ProvinceDetail({ province }: { province: Province }) {
  const assigned = getAssignedGovernor(province.id);

  // Read assignment signal for reactivity
  void governorAssignments.value;
  void governorPool.value;

  return (
    <div style={{ animation: 'prov-fade-in var(--duration-normal) var(--ease-default)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Governor strip */}
      <div class="gov-strip">
        {assigned ? (
          <>
            <Portrait
              alt={assigned.governor.name}
              size="medium"
              factionColor={FACTION_COLORS[assigned.governor.color]}
              tier={assigned.tier as 1 | 2 | 3}
            />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span class="gov-name" style={{ color: FACTION_COLORS[assigned.governor.color] }}>
                  {assigned.governor.name}
                </span>
                <span class="gov-tier-pill">{ROMAN[assigned.tier]}</span>
              </div>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', lineHeight: '1.4' }}>
                {assigned.governor.tiers[assigned.tier - 1].description}
              </div>
            </div>
            <button
              class="gov-dismiss-btn"
              onClick={() => { dismissGovernor(province.id); showGovernorPicker.value = false; }}
              style={{
                padding: '6px 12px',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(120, 40, 30, 0.3)',
                border: '1px solid rgba(180, 80, 60, 0.4)',
                color: 'rgba(220, 120, 100, 0.8)',
                fontFamily: 'inherit',
                fontSize: 'var(--font-size-xs)', fontWeight: 600,
                letterSpacing: '1px', textTransform: 'uppercase',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              Dismiss
            </button>
          </>
        ) : (
          <>
            <div style={{
              width: '96px', height: '112px',
              border: '2px dashed var(--color-border-subtle)',
              borderRadius: 'var(--radius-sm)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '36px', color: 'var(--color-text-muted)',
              flexShrink: 0,
            }}>
              ⚔
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
              <div class="gov-name" style={{ color: 'var(--color-text-muted)' }}>No Governor</div>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                Hire a governor to gain bonuses for this province.
              </div>
            </div>
            <button
              class="gov-hire-btn"
              onClick={() => { showGovernorPicker.value = true; }}
              style={{
                padding: '8px 16px',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(50, 42, 12, 0.5)',
                border: '1px solid var(--color-border-strong)',
                color: 'var(--color-gold-secondary)',
                fontFamily: 'inherit',
                fontSize: 'var(--font-size-xs)', fontWeight: 700,
                letterSpacing: '1.5px', textTransform: 'uppercase',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              Hire →
            </button>
          </>
        )}
      </div>

      {/* Building hero grid */}
      <div
        class="inv-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '12px',
        }}
      >
        {ALL_INVESTMENTS.map(type => (
          <InvestmentSlot key={type} province={province} type={type} />
        ))}
      </div>
    </div>
  );
}

// ── Main screen ──

export function ProvinceScreen() {
  const commander = selectedCommander.value;
  const faction = commander?.faction;
  const accent = faction ? FACTION_COLORS[faction] : 'var(--color-gold-primary)';
  const allProvinces = provinces.value;

  // Auto-select first province if none selected or selected doesn't exist
  const selectedId = selectedProvinceId.value;
  const selected = allProvinces.find(p => p.id === selectedId) ?? allProvinces[0] ?? null;
  if (selected && selectedId !== selected.id) {
    selectedProvinceId.value = selected.id;
  }

  // Stats for header (province-specific)
  const headerTraits = selected ? getGovernorTraits(selected.id) : [];
  const headerIncome = selected ? getProvinceIncome(selected, headerTraits) : null;
  const headerExpenses = selected ? getProvinceExpenses(selected, headerTraits) : 0;
  const headerUnrestMod = selected ? getUnrestModifier(selected, headerTraits) : 0;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      minHeight: '100vh', fontFamily: 'var(--font-family)',
      background: 'var(--color-bg-primary)',
      paddingTop: '40px', paddingBottom: '40px',
    }}>
      <OrnateFrame width="min(1180px, 94vw)">
        <OrnateHeader
          eyebrow="Provinces"
          title={selected ? selected.name : '—'}
          rightSlot={selected && headerIncome && (
            <>
              <span class="ornate-stat-chip" title="Population">👥 <strong>{selected.population}</strong></span>
              <span class="ornate-stat-chip" title="Income per spoke">{formatIncome(headerIncome)}</span>
              <span class="ornate-stat-chip" title="Expenses">−<strong style={{ color: 'rgba(220, 160, 100, 0.85)' }}>{headerExpenses}g</strong></span>
              <span class="ornate-stat-chip" title="Unrest"><UnrestBar unrest={selected.unrest} modifier={headerUnrestMod} width={50} /></span>
            </>
          )}
          onClose={() => navigateTo('hub')}
          accentColor={accent}
        />

        {allProvinces.length === 0 ? (
          /* Empty state */
          <div style={{
            padding: '60px 20px', textAlign: 'center',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
          }}>
            <div style={{ fontSize: '48px', opacity: 0.3 }}>🏛</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--font-size-lg)', color: 'var(--color-text-secondary)', letterSpacing: '3px', textTransform: 'uppercase' }}>
              No provinces conquered yet
            </div>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', maxWidth: '320px', lineHeight: '1.5' }}>
              Complete spokes to conquer provinces. Each province generates income and can be improved with investments.
            </div>
          </div>
        ) : (
          /* Two-column layout */
          <div class="prov-layout" style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>

            {/* Left: Ledger */}
            <div class="prov-ledger" style={{
              flex: '0 0 260px', minWidth: '220px',
              display: 'flex', flexDirection: 'column', gap: '8px',
              maxHeight: 'calc(100vh - 260px)', overflowY: 'auto',
              paddingRight: '4px',
            }}>
              <div style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 600,
                color: 'var(--color-gold-secondary)',
                letterSpacing: '3px',
                textTransform: 'uppercase',
                marginBottom: '4px',
              }}>
                {allProvinces.length} Province{allProvinces.length !== 1 ? 's' : ''}
              </div>
              {allProvinces.map(p => (
                <ProvinceRow key={p.id} province={p} selected={selected?.id === p.id} />
              ))}
            </div>

            {/* Right: Detail */}
            <div style={{ flex: '1 1 400px', minWidth: '0', maxHeight: 'calc(100vh - 260px)', overflowY: 'auto', paddingRight: '4px' }}>
              {selected ? (
                <ProvinceDetail province={selected} />
              ) : (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
                  Select a province
                </div>
              )}
            </div>
          </div>
        )}
      </OrnateFrame>

      {/* ── Governor Picker Modal ── */}
      {showGovernorPicker.value && selected && (
        <div
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.7)',
            zIndex: 200,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => { showGovernorPicker.value = false; }}
        >
          <OrnateFrame
            width="min(580px, 92vw)"
            padding="compact"
            style={{ maxHeight: '85vh', overflowY: 'auto' }}
            onClick={(e: MouseEvent) => e.stopPropagation()}
          >
            <OrnateHeader
              titleSize="md"
              eyebrow="Hire Governor"
              title={selected.name}
              onClose={() => { showGovernorPicker.value = false; }}
            />
            <GovernorPicker provinceId={selected.id} />
          </OrnateFrame>
        </div>
      )}
    </div>
  );
}
