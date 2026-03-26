import { signal } from '@preact/signals';
import { COMMANDERS } from '../data/commanders';
import { FACTION_COLORS } from '../game/commander';
import type { Commander } from '../game/commander';
import { navigateTo } from './screens';

const hoveredId = signal<string | null>(null);
const selectedId = signal<string | null>(null);

function selectCommander(commander: Commander) {
  selectedId.value = commander.id;
  // TODO (S1-09): store in GameState, init resources
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
        width: '220px',
        background: isSelected
          ? `linear-gradient(135deg, ${color}30, ${color}18)`
          : 'linear-gradient(135deg, rgba(30, 28, 48, 0.95), rgba(20, 18, 36, 0.98))',
        border: `2px solid ${isHovered || isSelected ? color : color + '40'}`,
        borderRadius: '8px',
        padding: '20px 16px',
        cursor: 'pointer',
        transition: 'all 0.25s ease',
        transform: isHovered ? 'scale(1.04) translateY(-4px)' : 'scale(1)',
        boxShadow: isHovered
          ? `0 8px 32px ${color}30, 0 0 16px ${color}15`
          : '0 4px 12px rgba(0,0,0,0.3)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '10px',
      }}
    >
      {/* Portrait */}
      <img
        src={commander.portrait}
        alt={commander.name}
        style={{
          width: '72px', height: '72px', borderRadius: '50%',
          border: `2px solid ${color}`,
          filter: `drop-shadow(0 0 8px ${color}60)`,
        }}
      />

      {/* Name + Culture */}
      <div style={{ textAlign: 'center' }}>
        <div style={{
          fontSize: '16px', fontWeight: 700, color: color,
          letterSpacing: '1px', textTransform: 'uppercase',
        }}>
          {commander.name}
        </div>
        <div style={{
          fontSize: '11px', color: 'rgba(180, 170, 150, 0.5)',
          letterSpacing: '1px', marginTop: '2px',
        }}>
          {commander.culture}
        </div>
      </div>

      {/* Faction badge */}
      <div style={{
        fontSize: '10px', fontWeight: 600, letterSpacing: '2px', textTransform: 'uppercase',
        color: color, background: `${color}15`, padding: '3px 10px', borderRadius: '10px',
        border: `1px solid ${color}30`,
      }}>
        {commander.faction === 'gold' ? 'Religious' :
         commander.faction === 'red' ? 'Warlord' :
         commander.faction === 'blue' ? 'Diplomat' : 'Merchant'}
      </div>

      {/* Quote */}
      <div style={{
        fontSize: '11px', fontStyle: 'italic', color: 'rgba(200, 190, 160, 0.5)',
        textAlign: 'center', lineHeight: '1.4', minHeight: '30px',
      }}>
        "{commander.quote}"
      </div>

      {/* Passive */}
      <div style={{
        width: '100%', background: 'rgba(0,0,0,0.25)', borderRadius: '4px',
        padding: '8px', fontSize: '11px',
      }}>
        <div style={{ color: color, fontWeight: 600, marginBottom: '3px' }}>
          {commander.passive.name}
        </div>
        <div style={{ color: 'rgba(200, 190, 160, 0.6)', lineHeight: '1.3' }}>
          {commander.passive.description}
        </div>
      </div>

      {/* Abilities (shown on hover) */}
      {isHovered && (
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
      )}

      {/* Starting resources (shown on hover) */}
      {isHovered && (
        <div style={{
          display: 'flex', gap: '8px', fontSize: '11px', color: 'rgba(200, 190, 160, 0.6)',
        }}>
          {commander.startingResources.gold > 0 && <span>💰{commander.startingResources.gold}</span>}
          {commander.startingResources.faith > 0 && <span>⭐{commander.startingResources.faith}</span>}
          {commander.startingResources.influence > 0 && <span>👑{commander.startingResources.influence}</span>}
          {commander.startingResources.momentum > 0 && <span>🔥{commander.startingResources.momentum}</span>}
        </div>
      )}
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
      background: 'rgba(0,0,0,0.2)', borderRadius: '4px', padding: '6px 8px',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    }}>
      <div>
        <span style={{ fontSize: '9px', color: 'rgba(180,170,150,0.4)', textTransform: 'uppercase', letterSpacing: '1px' }}>
          {label}
        </span>
        <div style={{ fontSize: '11px', color: color, fontWeight: 600 }}>{name}</div>
      </div>
      <div style={{
        fontSize: '11px', color: cost ? 'rgba(200,190,160,0.6)' : '#6c6',
        fontWeight: 600,
      }}>
        {costText}
      </div>
    </div>
  );
}

export function CommanderSelectScreen() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100vh', fontFamily: "'Segoe UI', system-ui, sans-serif",
      background: 'radial-gradient(ellipse at 50% 40%, rgba(30, 28, 50, 0.92), rgba(8, 8, 18, 0.97))',
    }}>
      <style>{`
        @keyframes fade-in { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .cmdr-grid { animation: fade-in 0.4s ease-out; }
      `}</style>

      <div style={{
        fontSize: '20px', fontWeight: 600, color: '#f0d080',
        letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '32px',
        textShadow: '0 2px 8px rgba(180, 140, 60, 0.3)',
      }}>
        Choose Your Commander
      </div>

      <div class="cmdr-grid" style={{
        display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center',
        maxWidth: '960px', padding: '0 16px',
      }}>
        {COMMANDERS.map(c => <CommanderCard key={c.id} commander={c} />)}
      </div>

      <div style={{
        marginTop: '32px', fontSize: '12px', color: 'rgba(180, 170, 150, 0.3)',
        letterSpacing: '1px',
      }}>
        Hover to preview abilities • Click to select
      </div>
    </div>
  );
}
