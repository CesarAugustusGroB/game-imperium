import { signal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { Portrait } from '../components/Portrait';
import { COMMANDERS } from '../../data/commanders';
import { FACTION_COLORS } from '../../game/core/commander';
import type { Commander } from '../../game/core/commander';
import { startNewRun } from '../../game/core/game-state';
import { navigateTo } from '../screens';

const hoveredId = signal<string | null>(null);
const selectedId = signal<string | null>(null);
const selecting = signal(false);

// Inject animation CSS once
if (typeof document !== 'undefined' && !document.getElementById('cmdr-styles')) {
  const el = document.createElement('style');
  el.id = 'cmdr-styles';
  el.textContent = `
    @keyframes fade-in { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
    .cmdr-grid { animation: fade-in 0.4s ease-out; }
    .cmdr-back-btn { transition: all var(--duration-normal) var(--ease-default); }
    .cmdr-back-btn:hover {
      border-color: var(--color-border-strong) !important;
      color: var(--color-text-secondary) !important;
    }
    .cmdr-back-btn:active { transform: scale(0.97); }
  `;
  document.head.appendChild(el);
}

function selectCommander(commander: Commander) {
  if (selecting.value === true) return;
  selecting.value = true;
  selectedId.value = commander.id;
  startNewRun(commander);
  setTimeout(() => navigateTo('hub'), 300);
}

function CommanderCard({ commander }: { commander: Commander }) {
  const color = FACTION_COLORS[commander.faction];
  const isHovered = hoveredId.value === commander.id;
  const isSelected = selectedId.value === commander.id;

  return (
    <div
      onMouseEnter={() => { hoveredId.value = commander.id; }}
      onMouseLeave={() => { hoveredId.value = null; }}
      onClick={() => selectCommander(commander)}
      style={{
        width: '210px',
        background: isSelected
          ? `linear-gradient(135deg, ${color}30, ${color}18)`
          : `linear-gradient(135deg, var(--color-bg-secondary), var(--color-bg-primary))`,
        border: `2px solid ${isHovered || isSelected ? color : color + '40'}`,
        borderRadius: 'var(--radius-md)',
        padding: '20px 16px',
        cursor: 'pointer',
        transition: `all 0.25s var(--ease-default)`,
        transform: isHovered ? 'scale(1.04) translateY(-4px)' : 'scale(1)',
        boxShadow: isHovered
          ? `0 8px 32px ${color}30, 0 0 16px ${color}15`
          : 'var(--shadow-sm)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '10px',
      }}
    >
      <Portrait
        src={commander.portrait}
        alt={commander.name}
        size="large"
        factionColor={color}
        selected={isSelected}
      />

      {/* Culture */}
      <div style={{
        fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)',
        letterSpacing: '2px', textTransform: 'uppercase', textAlign: 'center',
        marginTop: '-4px',
      }}>
        {commander.culture}
      </div>

      {/* Faction badge */}
      <div style={{
        fontSize: 'var(--font-size-sm)', fontWeight: 600, letterSpacing: '2px', textTransform: 'uppercase',
        color: color, background: `${color}15`, padding: '3px 10px', borderRadius: '10px',
        border: `1px solid ${color}30`,
      }}>
        {commander.faction === 'gold' ? 'Religious' :
         commander.faction === 'red' ? 'Warlord' :
         commander.faction === 'blue' ? 'Diplomat' : 'Merchant'}
      </div>

      {/* Quote */}
      <div style={{
        fontSize: 'var(--font-size-sm)', fontStyle: 'italic', color: 'var(--color-text-secondary)',
        textAlign: 'center', lineHeight: '1.4', minHeight: '30px',
      }}>
        "{commander.quote}"
      </div>

      {/* Passive */}
      <div style={{
        width: '100%', background: 'rgba(0,0,0,0.25)', borderRadius: 'var(--radius-sm)',
        padding: '8px', fontSize: 'var(--font-size-sm)',
      }}>
        <div style={{ color: color, fontWeight: 600, marginBottom: '3px' }}>
          {commander.passive.name}
        </div>
        <div style={{ color: 'var(--color-text-secondary)', lineHeight: '1.3' }}>
          {commander.passive.description}
        </div>
      </div>

      {/* Abilities (always visible) */}
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <AbilityRow
          label="Strategic"
          name={commander.strategicAbility.name}
          cost={commander.strategicAbility.cost}
          color={color}
        />
        <AbilityRow
          label="Tactical"
          name={commander.tacticalAbility.name}
          cost={commander.tacticalAbility.cost}
          color={color}
        />
      </div>

      {/* Starting resources (always visible) */}
      <div style={{
        display: 'flex', gap: '8px', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)',
      }}>
        {commander.startingResources.gold > 0 && <span>💰{commander.startingResources.gold}</span>}
        {commander.startingResources.faith > 0 && <span>⭐{commander.startingResources.faith}</span>}
        {commander.startingResources.influence > 0 && <span>👑{commander.startingResources.influence}</span>}
        {commander.startingResources.momentum > 0 && <span>🔥{commander.startingResources.momentum}</span>}
      </div>
    </div>
  );
}

function AbilityRow({ label, name, cost, color }: {
  label: string;
  name: string;
  cost: { resource: string; amount: number } | null;
  color: string;
}) {
  const costText = cost
    ? `${cost.resource === 'gold' ? '💰' : cost.resource === 'faith' ? '⭐' : cost.resource === 'influence' ? '👑' : '🔥'}${cost.amount}`
    : 'Free';

  return (
    <div style={{
      background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-sm)', padding: '6px 8px',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    }}>
      <div>
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
          {label}
        </span>
        <div style={{ fontSize: 'var(--font-size-sm)', color: color, fontWeight: 600 }}>{name}</div>
      </div>
      <div style={{
        fontSize: 'var(--font-size-sm)', color: cost ? 'var(--color-text-secondary)' : '#6c6',
        fontWeight: 600,
      }}>
        {costText}
      </div>
    </div>
  );
}

export function CommanderSelectScreen() {
  useEffect(() => {
    // Reset stale state from previous visit
    hoveredId.value = null;
    selectedId.value = null;
    selecting.value = false;
    return () => {
      hoveredId.value = null;
      selectedId.value = null;
      selecting.value = false;
    };
  }, []);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', fontFamily: 'var(--font-family)',
      background: '#d8d0c8 url(/asset/marbel_background.png) center / contain no-repeat',
      padding: '40px 16px',
    }}>
      <div style={{
        fontSize: 'var(--font-size-xl)', fontWeight: 600, color: 'var(--color-gold-primary)',
        letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '8px',
        textShadow: '0 2px 8px rgba(180, 140, 60, 0.3)',
      }}>
        Choose Your Commander
      </div>

      {/* Decorative divider */}
      <div style={{
        width: '60px', height: '1px', marginBottom: '32px',
        background: `linear-gradient(90deg, transparent, var(--color-gold-primary), transparent)`,
      }} />

      <div class="cmdr-grid" style={{
        display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center',
        maxWidth: '960px', padding: '0 16px',
      }}>
        {COMMANDERS.map(c => <CommanderCard key={c.id} commander={c} />)}
      </div>

      <div style={{
        marginTop: '32px', fontSize: 'var(--font-size-md)', color: 'var(--color-text-muted)',
        letterSpacing: '1px',
      }}>
        Click to select
      </div>

      {/* Back button */}
      <button
        class="cmdr-back-btn"
        onClick={() => navigateTo('title')}
        style={{
          position: 'fixed', bottom: '20px', left: '20px',
          padding: '10px 18px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
          background: 'var(--color-bg-tertiary)',
          border: `1px solid var(--color-border-default)`,
          color: 'var(--color-text-secondary)',
          fontFamily: 'inherit', fontSize: 'var(--font-size-md)', letterSpacing: '1px',
        }}
      >
        Back
      </button>
    </div>
  );
}
