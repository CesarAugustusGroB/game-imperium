import { signal } from '@preact/signals';
import { navigateTo } from './screens';
import { selectedCommander } from '../game/game-state';
import { provinces, buildInvestment, canAffordCost, getNextInvestmentLevel } from '../game/province-store';
import {
  INVESTMENT_DATA, getProvinceIncome, getProvinceExpenses, getUnrestModifier,
  getInvestmentDiscount, applyInvestmentDiscount,
  type InvestmentType, type Province,
} from '../game/province';
import { FACTION_COLORS, RESOURCE_INFO, type ResourceType } from '../game/commander';
import { getResource } from '../game/resources';
import { getHireCost } from '../game/governor';
import {
  governorPool, governorAssignments,
  getAssignedGovernor, getGovernorTraits,
  hireGovernor, dismissGovernor,
} from '../game/governor-store';
import { nextInvestmentDiscount } from '../game/strategic-store';
import { ProvinceMapView } from './ProvinceMapView';
import { PANEL, PANEL_TITLE, ROMAN, formatCost } from './ui-constants';

// ── One-time CSS injection ──
if (typeof document !== 'undefined' && !document.getElementById('province-styles')) {
  const el = document.createElement('style');
  el.id = 'province-styles';
  el.textContent = `
    .prov-row { transition: all 0.15s ease; cursor: pointer; }
    .prov-row:hover { border-color: rgba(180, 160, 100, 0.45) !important; background: rgba(40, 35, 60, 0.5) !important; }
    .prov-row:active { transform: scale(0.99); }
    .prov-row-selected { border-color: rgba(240, 208, 128, 0.5) !important; background: rgba(50, 42, 12, 0.4) !important; }
    .inv-slot { transition: all 0.15s ease; }
    .inv-slot:hover { border-color: rgba(180, 160, 100, 0.4) !important; }
    .inv-build-btn { transition: all 0.15s ease; cursor: pointer; }
    .inv-build-btn:hover:not(:disabled) {
      border-color: rgba(240, 208, 128, 0.6) !important;
      background: rgba(80, 60, 20, 0.6) !important;
      color: #fff0c0 !important;
    }
    .inv-build-btn:active:not(:disabled) { transform: scale(0.96); }
    .inv-build-btn:disabled { opacity: 0.35; cursor: not-allowed; }
    .prov-back-btn { transition: all 0.15s ease; cursor: pointer; }
    .prov-back-btn:hover { border-color: rgba(180, 160, 100, 0.45) !important; color: rgba(240, 220, 160, 0.9) !important; }
    .prov-back-btn:active { transform: scale(0.97); }
    .gov-card { transition: all 0.15s ease; cursor: pointer; }
    .gov-card:hover { border-color: rgba(180, 160, 100, 0.45) !important; transform: translateY(-1px); box-shadow: 0 4px 16px rgba(0,0,0,0.3); }
    .gov-card:active { transform: scale(0.98); }
    .gov-dismiss-btn { transition: all 0.15s ease; cursor: pointer; }
    .gov-dismiss-btn:hover { background: rgba(180, 60, 40, 0.4) !important; border-color: rgba(200, 80, 60, 0.6) !important; color: #e8a0a0 !important; }
    .gov-tier-btn { transition: all 0.15s ease; cursor: pointer; }
    .gov-tier-btn:hover:not(:disabled) { border-color: rgba(240, 208, 128, 0.6) !important; background: rgba(80, 60, 20, 0.6) !important; color: #fff0c0 !important; }
    .gov-tier-btn:disabled { opacity: 0.35; cursor: not-allowed; }
    .gov-tier-btn:active:not(:disabled) { transform: scale(0.96); }
    /* Styled scrollbar for province ledger */
    .prov-ledger::-webkit-scrollbar { width: 4px; }
    .prov-ledger::-webkit-scrollbar-track { background: rgba(20, 18, 36, 0.3); border-radius: 2px; }
    .prov-ledger::-webkit-scrollbar-thumb { background: rgba(180, 160, 100, 0.2); border-radius: 2px; }
    .prov-ledger::-webkit-scrollbar-thumb:hover { background: rgba(180, 160, 100, 0.35); }
    .prov-ledger { scrollbar-width: thin; scrollbar-color: rgba(180,160,100,0.2) transparent; }
    @keyframes prov-fade-in {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes inv-build-success {
      0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(240,208,128,0); }
      40% { transform: scale(1.05); box-shadow: 0 0 16px 4px rgba(240,208,128,0.4); }
      100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(240,208,128,0); }
    }
    .inv-slot-building { animation: inv-build-success 0.5s ease-out; }
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

// ── Sub-components ──

function UnrestBar({ unrest, modifier }: { unrest: number; modifier: number }) {
  const pct = Math.min(100, Math.max(0, unrest));
  const barColor = pct > 70 ? '#c24a3a' : pct > 40 ? '#d4a843' : '#5a8a4a';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <div style={{ width: '60px', height: '5px', background: 'rgba(40, 35, 60, 0.8)', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: barColor, borderRadius: '3px', transition: 'width 0.3s ease' }} />
      </div>
      <span style={{ fontSize: '9px', color: 'rgba(200, 190, 160, 0.5)', minWidth: '20px' }}>{unrest}</span>
      {modifier !== 0 && (
        <span style={{ fontSize: '8px', color: modifier < 0 ? '#5a8a4a' : '#c24a3a' }}>
          {modifier > 0 ? '+' : ''}{modifier}/s
        </span>
      )}
    </div>
  );
}

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
      buildInvestment(province.id, type);
      buildingSlotType.value = type;
      setTimeout(() => { buildingSlotType.value = null; }, 600);
    }
  }

  return (
    <div class={`inv-slot${buildingSlotType.value === type ? ' inv-slot-building' : ''}`} style={{
      background: 'rgba(20, 18, 36, 0.6)',
      border: `1px solid ${currentLevel > 0 ? `${fColor}30` : 'rgba(180, 160, 100, 0.08)'}`,
      borderTop: `3px solid ${currentLevel > 0 ? fColor : 'rgba(180, 160, 100, 0.1)'}`,
      borderRadius: '6px', padding: '10px',
      display: 'flex', flexDirection: 'column', gap: '6px',
      opacity: currentLevel > 0 ? 1 : 0.7,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: '10px', fontWeight: 700, color: fColor, letterSpacing: '0.8px', textTransform: 'uppercase' }}>
          {data.name}
        </div>
        {currentLevel > 0 && (
          <div style={{
            width: '18px', height: '18px', borderRadius: '50%',
            background: 'rgba(50, 42, 12, 0.8)', border: '1px solid rgba(240, 208, 128, 0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '8px', fontWeight: 700, color: '#f0d080',
          }}>
            {ROMAN[currentLevel]}
          </div>
        )}
      </div>

      {/* Current effect */}
      {currentEffect ? (
        <div style={{ fontSize: '9px', color: 'rgba(200, 190, 160, 0.55)', lineHeight: '1.4' }}>
          {currentEffect.description}
        </div>
      ) : (
        <div style={{ fontSize: '9px', color: 'rgba(180, 170, 150, 0.3)', fontStyle: 'italic', lineHeight: '1.4' }}>
          {data.flavour}
        </div>
      )}

      {/* Build / Upgrade button */}
      {!maxed && cost && (
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '3px' }}>
          {effectiveDiscount > 0 && (
            <div style={{
              fontSize: '8px', color: 'rgba(90, 180, 90, 0.7)',
              letterSpacing: '0.5px', textAlign: 'center',
            }}>
              -{effectiveDiscount}%{scrollDiscount > 0 ? ' (scroll)' : ' governor'} discount
            </div>
          )}
          <button
            class="inv-build-btn"
            disabled={!affordable}
            onClick={handleBuild}
            style={{
              padding: '5px 8px', borderRadius: '4px',
              background: 'rgba(50, 42, 12, 0.6)',
              border: '1px solid rgba(240, 208, 128, 0.25)',
              color: '#f0d080', fontFamily: 'inherit',
              fontSize: '9px', fontWeight: 600, letterSpacing: '0.8px',
              textTransform: 'uppercase',
            }}
          >
            {currentLevel === 0 ? 'Build' : `Upgrade ${ROMAN[currentLevel]} \u2192 ${ROMAN[nextLevel]}`} &middot; {formatCost(cost)}
          </button>
        </div>
      )}

      {maxed && (
        <div style={{
          marginTop: 'auto', padding: '5px 8px',
          fontSize: '9px', fontWeight: 600, letterSpacing: '0.8px',
          color: 'rgba(90, 138, 74, 0.7)', textTransform: 'uppercase', textAlign: 'center',
        }}>
          Max Level
        </div>
      )}
    </div>
  );
}

function ProvinceRow({ province, selected }: { province: Province; selected: boolean }) {
  const traits = getGovernorTraits(province.id);
  const income = getProvinceIncome(province, traits);
  const expenses = getProvinceExpenses(province, traits);
  const unrestMod = getUnrestModifier(province, traits);
  const invCount = province.investments.length;

  return (
    <div
      class={`prov-row${selected ? ' prov-row-selected' : ''}`}
      onClick={() => { selectedProvinceId.value = province.id; }}
      style={{
        padding: '10px 12px', borderRadius: '6px',
        background: selected ? 'rgba(50, 42, 12, 0.4)' : 'rgba(20, 18, 36, 0.5)',
        border: `1px solid ${selected ? 'rgba(240, 208, 128, 0.5)' : 'rgba(180, 160, 100, 0.08)'}`,
        display: 'flex', flexDirection: 'column', gap: '6px',
      }}
    >
      {/* Row header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(240, 220, 160, 0.85)', letterSpacing: '0.5px' }}>
          {province.name}
        </div>
        <div style={{ fontSize: '9px', color: 'rgba(180, 170, 150, 0.35)' }}>
          {invCount}/6
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ fontSize: '9px', color: 'rgba(200, 190, 160, 0.5)' }}>
          Pop {province.population}
        </div>
        <div style={{ fontSize: '9px', color: 'rgba(200, 190, 160, 0.5)' }}>
          {formatIncome(income)}
        </div>
        <div style={{ fontSize: '9px', color: 'rgba(200, 160, 100, 0.45)' }}>
          -{expenses}g
        </div>
        <UnrestBar unrest={province.unrest} modifier={unrestMod} />
      </div>
    </div>
  );
}

function GovernorPicker({ provinceId }: { provinceId: string }) {
  const pool = governorPool.value;

  // Force signal reads for reactivity
  getResource('gold');
  getResource('faith');
  getResource('influence');
  getResource('momentum');

  if (pool.length === 0) {
    return (
      <div style={{ padding: '12px', textAlign: 'center', fontSize: '10px', color: 'rgba(180, 170, 150, 0.35)', fontStyle: 'italic' }}>
        All governors assigned to other provinces
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', animation: 'prov-fade-in 0.15s ease-out' }}>
      {pool.map(gov => {
        const fColor = FACTION_COLORS[gov.color];
        return (
          <div key={gov.id} class="gov-card" style={{
            background: 'rgba(20, 18, 36, 0.6)',
            border: `1px solid rgba(180, 160, 100, 0.1)`,
            borderLeft: `3px solid ${fColor}`,
            borderRadius: '6px', padding: '10px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <div style={{
                width: '24px', height: '24px', borderRadius: '50%',
                background: `${fColor}20`, border: `2px solid ${fColor}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '10px', fontWeight: 700, color: fColor,
              }}>
                {gov.name[0]}
              </div>
              <div style={{ fontSize: '11px', fontWeight: 600, color: fColor }}>{gov.name}</div>
            </div>
            {/* Tier hire buttons */}
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
                      flex: '1 1 0', minWidth: '90px',
                      padding: '7px 8px', borderRadius: '4px',
                      background: 'rgba(50, 42, 12, 0.5)',
                      border: '1px solid rgba(240, 208, 128, 0.2)',
                      color: '#f0d080', fontFamily: 'inherit',
                      fontSize: '9px', fontWeight: 600, letterSpacing: '0.5px',
                      textTransform: 'uppercase',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{
                        width: '16px', height: '16px', borderRadius: '50%',
                        background: 'rgba(50, 42, 12, 0.8)', border: '1px solid rgba(240, 208, 128, 0.3)',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '7px', fontWeight: 700, color: '#f0d080', flexShrink: 0,
                      }}>{ROMAN[tier]}</span>
                      Tier {ROMAN[tier]}
                    </span>
                    <span style={{ fontSize: '8px', opacity: 0.55, fontWeight: 400, textTransform: 'none', lineHeight: '1.3', textAlign: 'center' }}>
                      {tierData.description.split(' ').slice(0, 6).join(' ')}
                    </span>
                    <span style={{ fontSize: '8px', opacity: 0.7, color: '#d4a843' }}>{formatCost(cost)}</span>
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

function ProvinceDetail({ province }: { province: Province }) {
  const traits = getGovernorTraits(province.id);
  const income = getProvinceIncome(province, traits);
  const expenses = getProvinceExpenses(province, traits);
  const unrestMod = getUnrestModifier(province, traits);
  const assigned = getAssignedGovernor(province.id);

  // Read assignment signal for reactivity
  void governorAssignments.value;
  void governorPool.value;

  return (
    <div style={{ animation: 'prov-fade-in 0.2s ease-out' }}>
      {/* Header */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '16px', fontWeight: 600, color: 'rgba(240, 220, 160, 0.9)', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>
          {province.name}
        </div>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ fontSize: '10px', color: 'rgba(200, 190, 160, 0.5)' }}>Population: <span style={{ color: 'rgba(240, 220, 160, 0.8)', fontWeight: 600 }}>{province.population}</span></div>
          <div style={{ fontSize: '10px', color: 'rgba(200, 190, 160, 0.5)' }}>Income: <span style={{ color: 'rgba(240, 220, 160, 0.8)', fontWeight: 600 }}>{formatIncome(income)}</span></div>
          <div style={{ fontSize: '10px', color: 'rgba(200, 190, 160, 0.5)' }}>Expenses: <span style={{ color: 'rgba(200, 160, 100, 0.7)', fontWeight: 600 }}>-{expenses}g</span></div>
          <div style={{ fontSize: '10px', color: 'rgba(200, 190, 160, 0.5)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            Unrest: <UnrestBar unrest={province.unrest} modifier={unrestMod} />
          </div>
        </div>
      </div>

      {/* Governor slot */}
      <div style={{ ...PANEL, marginBottom: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', ...PANEL_TITLE }}>
          <span>Governor</span>
          {assigned ? (
            <button
              class="gov-dismiss-btn"
              onClick={() => { dismissGovernor(province.id); showGovernorPicker.value = false; }}
              style={{
                padding: '2px 8px', borderRadius: '3px',
                background: 'rgba(120, 40, 30, 0.3)',
                border: '1px solid rgba(180, 80, 60, 0.3)',
                color: 'rgba(220, 120, 100, 0.7)',
                fontFamily: 'inherit', fontSize: '8px', fontWeight: 600,
                letterSpacing: '0.8px', textTransform: 'uppercase',
              }}
            >
              Dismiss
            </button>
          ) : (
            <button
              class="gov-tier-btn"
              onClick={() => { showGovernorPicker.value = !showGovernorPicker.value; }}
              style={{
                padding: '2px 8px', borderRadius: '3px',
                background: 'transparent',
                border: '1px solid rgba(180, 160, 100, 0.18)',
                color: 'rgba(200, 190, 160, 0.42)',
                fontFamily: 'inherit', fontSize: '8px', fontWeight: 600,
                letterSpacing: '1px', textTransform: 'uppercase',
              }}
            >
              {showGovernorPicker.value ? 'Cancel' : 'Hire →'}
            </button>
          )}
        </div>
        {assigned ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <div style={{
                width: '28px', height: '28px', borderRadius: '50%',
                background: `${FACTION_COLORS[assigned.governor.color]}20`,
                border: `2px solid ${FACTION_COLORS[assigned.governor.color]}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '12px', fontWeight: 700, color: FACTION_COLORS[assigned.governor.color],
              }}>
                {assigned.governor.name[0]}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: FACTION_COLORS[assigned.governor.color] }}>{assigned.governor.name}</span>
                  <span style={{
                    padding: '1px 5px', borderRadius: '8px',
                    background: 'rgba(50, 42, 12, 0.8)', border: '1px solid rgba(240, 208, 128, 0.3)',
                    fontSize: '7px', fontWeight: 700, color: '#f0d080',
                  }}>
                    {ROMAN[assigned.tier]}
                  </span>
                </div>
                <div style={{ fontSize: '9px', color: 'rgba(180, 170, 150, 0.5)', marginTop: '2px' }}>
                  {assigned.governor.tiers[assigned.tier - 1].description}
                </div>
              </div>
            </div>
          </div>
        ) : showGovernorPicker.value ? (
          <GovernorPicker provinceId={province.id} />
        ) : (
          <div style={{ fontSize: '10px', color: 'rgba(180, 170, 150, 0.3)', fontStyle: 'italic' }}>
            No governor assigned
          </div>
        )}
      </div>

      {/* Investment grid */}
      <div style={PANEL_TITLE}>Investments</div>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
        gap: '8px',
      }}>
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
  const color = faction ? FACTION_COLORS[faction] : '#d4a843';
  const allProvinces = provinces.value;

  // Auto-select first province if none selected or selected doesn't exist
  const selectedId = selectedProvinceId.value;
  const selected = allProvinces.find(p => p.id === selectedId) ?? allProvinces[0] ?? null;
  if (selected && selectedId !== selected.id) {
    selectedProvinceId.value = selected.id;
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      minHeight: '100vh', fontFamily: "'Segoe UI', system-ui, sans-serif",
      background: '#d8d0c8 url(/asset/marbel_background.png) center / contain no-repeat',
      paddingTop: '48px', paddingBottom: '32px',
    }}>
      <div style={{
        width: 'min(1100px, 94vw)',
        background: 'rgba(12, 10, 24, 0.85)',
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        borderRadius: '12px', border: '1px solid rgba(180, 160, 100, 0.15)',
        padding: '24px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}>
        {/* Title bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <div style={{ fontSize: '22px', fontWeight: 600, color, letterSpacing: '4px', textTransform: 'uppercase', textShadow: `0 2px 8px ${color}30` }}>
            Provinces
          </div>
          <button
            class="prov-back-btn"
            onClick={() => navigateTo('hub')}
            style={{
              padding: '8px 16px', borderRadius: '4px',
              background: 'rgba(40, 35, 60, 0.6)',
              border: '1px solid rgba(180, 160, 100, 0.2)',
              color: 'rgba(220, 200, 160, 0.65)',
              fontFamily: 'inherit', fontSize: '11px', fontWeight: 600,
              letterSpacing: '1px', textTransform: 'uppercase',
            }}
          >
            &larr; Hub
          </button>
        </div>
        <div style={{ width: '60px', height: '1px', marginBottom: '20px', background: `linear-gradient(90deg, transparent, ${color}60, transparent)` }} />

        {/* Map view */}
        {allProvinces.length > 0 && (
          <div style={{ marginBottom: '16px' }}>
            <ProvinceMapView
              selectedId={selected?.id ?? null}
              onSelect={(id) => { selectedProvinceId.value = id; }}
            />
          </div>
        )}

        {allProvinces.length === 0 ? (
          /* Empty state */
          <div style={{
            padding: '60px 20px', textAlign: 'center',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
          }}>
            <div style={{ fontSize: '32px', opacity: 0.3 }}>🏛</div>
            <div style={{ fontSize: '13px', color: 'rgba(200, 190, 160, 0.45)', letterSpacing: '1px' }}>
              No provinces conquered yet
            </div>
            <div style={{ fontSize: '10px', color: 'rgba(180, 170, 150, 0.28)', maxWidth: '300px', lineHeight: '1.5' }}>
              Complete spokes to conquer provinces. Each province generates income and can be improved with investments.
            </div>
          </div>
        ) : (
          /* Two-column layout */
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-start' }}>

            {/* Left: Ledger */}
            <div class="prov-ledger" style={{
              flex: '0 0 260px', minWidth: '220px',
              display: 'flex', flexDirection: 'column', gap: '6px',
              maxHeight: 'calc(100vh - 200px)', overflowY: 'auto',
              paddingRight: '4px',
            }}>
              <div style={PANEL_TITLE}>{allProvinces.length} Province{allProvinces.length !== 1 ? 's' : ''}</div>
              {allProvinces.map(p => (
                <ProvinceRow key={p.id} province={p} selected={selected?.id === p.id} />
              ))}
            </div>

            {/* Right: Detail */}
            <div style={{ flex: '1 1 400px', minWidth: '0' }}>
              {selected ? (
                <ProvinceDetail province={selected} />
              ) : (
                <div style={{ padding: '40px', textAlign: 'center', color: 'rgba(180, 170, 150, 0.3)', fontSize: '11px' }}>
                  Select a province
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
