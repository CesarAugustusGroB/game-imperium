import { Tooltip } from '../../components/Tooltip';
import { ROMAN, ALERT } from '../../../game/iterBelli/iter-belli-balance';
import type { IterBelliState } from '../../../game/iterBelli/iter-belli-types';

interface ResourceDef {
  key: string;
  glyph: string;
  label: string;
  value: string;
  tip: string;
  alert?: boolean;
  warn?: boolean;
}

function resources(s: IterBelliState): ResourceDef[] {
  return [
    {
      key: 'soldiers', glyph: '⚔', label: 'Soldados', value: s.soldiers.toLocaleString('es'),
      tip: 'Efectivos de tu ejército. Caen por hambre, motín, escaramuzas y emboscadas. Si bajan de 1000, la campaña fracasa.',
      alert: s.soldiers < ALERT.soldiersLow,
    },
    {
      key: 'morale', glyph: '♺', label: 'Moral', value: s.morale.toFixed(1),
      tip: 'Cohesión del ejército (0–10). Bajo 3 hay riesgo de motín; a 0 el ejército se desbanda.',
      alert: s.morale < ALERT.moraleLow,
    },
    {
      key: 'discipline', glyph: '⛨', label: 'Disciplina', value: ROMAN[s.discipline],
      tip: 'Nivel táctico (I–V). Desbloquea posturas de batalla más avanzadas.',
    },
    {
      key: 'supplies', glyph: '❦', label: 'Suministros', value: String(s.supplies),
      tip: 'Víveres. Se consume 1 por turno. A 0 llega el hambre: deserciones y caída de moral.',
      alert: s.supplies <= 0,
      warn: s.supplies > 0 && s.supplies < ALERT.suppliesWarn,
    },
    {
      key: 'gold', glyph: '⚜', label: 'Oro', value: String(s.gold),
      tip: 'Oro de campaña (heredado del run). Paga cartas, sobornos y tributos; vuelve al hub al terminar.',
    },
    {
      key: 'threat', glyph: '☠', label: 'Amenaza', value: s.threat.toFixed(1),
      tip: 'Atención enemiga (0–10). Alta amenaza dispara escaramuzas y emboscadas.',
      alert: s.threat >= ALERT.threatAlert,
      warn: s.threat >= ALERT.threatWarn && s.threat < ALERT.threatAlert,
    },
  ];
}

export function CampaignResourceBar({ state }: { state: IterBelliState }) {
  const days = Math.max(0, state.timeRemaining);
  return (
    <div class="ib-resbar">
      {resources(state).map((r) => (
        <Tooltip
          key={r.key}
          variant="rich"
          position="below"
          content={
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontWeight: 700, color: 'var(--imp-gold-hi)' }}>{r.glyph} {r.label}</div>
              <div style={{ color: 'var(--imp-text-mid)', fontSize: 'var(--font-size-sm)' }}>{r.tip}</div>
            </div>
          }
        >
          <div class={`ib-res${r.alert ? ' alert' : ''}${r.warn ? ' warn' : ''}`}>
            <span class="ib-res-label">{r.glyph} {r.label}</span>
            <span class="ib-res-value">{r.value}</span>
          </div>
        </Tooltip>
      ))}
      <Tooltip
        variant="rich"
        position="below"
        content={<div>Días restantes de plazo consular. Si llegan a 0 antes de Sagunto, el Senado te releva.</div>}
      >
        <div class={`ib-clock${days <= ALERT.clockAlert ? ' alert' : ''}`}>
          <span class="ib-res-label">⧗ Plazo</span>
          <span class="ib-res-value">{days}d</span>
        </div>
      </Tooltip>
    </div>
  );
}
