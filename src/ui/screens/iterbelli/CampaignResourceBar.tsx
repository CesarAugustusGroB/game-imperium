import { useRef, useState, useEffect } from 'preact/hooks';
import { Tooltip } from '../../components/Tooltip';
import { ROMAN, ALERT } from '../../../game/iterBelli/iter-belli-balance';
import type { IterBelliState } from '../../../game/iterBelli/iter-belli-types';
import { ResourceIcon } from '../../components/ResourceIcon';
import { GameIcon } from '../../components/GameIcon';
import type { GameIconName } from '../../components/GameIcon';
import type { ResourceType } from '../../../game/core/commander';

interface ResourceDef {
  key: string;
  glyph: string;
  label: string;
  value: string;
  /** Raw numeric value, for turn-over-turn delta detection. */
  num: number;
  /** Render deltas with one decimal (morale/threat) instead of an integer. */
  decimals?: boolean;
  tip: string;
  icon?: GameIconName;
  iconType?: ResourceType;
  alert?: boolean;
  warn?: boolean;
}

function resources(s: IterBelliState): ResourceDef[] {
  return [
    {
      key: 'soldiers', glyph: '⚔', icon: 'res-soldiers', label: 'Soldados', value: s.soldiers.toLocaleString('es'), num: s.soldiers,
      tip: 'Efectivos de tu ejército. Caen por hambre, motín, escaramuzas y emboscadas. Si bajan de 1000, la campaña fracasa.',
      alert: s.soldiers < ALERT.soldiersLow,
    },
    {
      key: 'morale', glyph: '♺', icon: 'res-morale', label: 'Moral', value: s.morale.toFixed(1), num: s.morale, decimals: true,
      tip: 'Cohesión del ejército (0–15). Bajo 3 hay riesgo de motín; a 0 el ejército se desbanda. Baja por hambre, escaramuzas, emboscadas y algunas marchas.',
      alert: s.morale < ALERT.moraleLow,
    },
    {
      key: 'discipline', glyph: '⛨', icon: 'res-discipline', label: 'Disciplina', value: ROMAN[s.discipline], num: s.discipline,
      tip: 'Nivel táctico (0–X). Desbloquea formaciones y órdenes más avanzadas; súbela con la instrucción de campamento.',
    },
    {
      key: 'supplies', glyph: '❦', icon: 'res-supplies', label: 'Suministros', value: String(s.supplies), num: s.supplies,
      tip: 'Víveres. Se consume 1 por turno. A 0 llega el hambre: deserciones y caída de moral.',
      alert: s.supplies <= 0,
      warn: s.supplies > 0 && s.supplies < ALERT.suppliesWarn,
    },
    {
      key: 'ammunition', glyph: '➶', label: 'Munición', value: String(s.ammunition), num: s.ammunition,
      tip: 'Proyectiles para hostigar en la batalla decisiva. Hostigar sin munición es casi inútil. Recárgala en ciudades aliadas.',
      alert: s.ammunition <= 0,
      warn: s.ammunition > 0 && s.ammunition < 10,
    },
    {
      key: 'gold', glyph: '', iconType: 'gold', label: 'Oro', value: String(s.gold), num: s.gold,
      tip: 'Oro de campaña (heredado del run). Paga cartas, sobornos y tributos; vuelve al hub al terminar.',
    },
    {
      key: 'iuniores', glyph: '', iconType: 'iuniores', label: 'Iuniores', value: s.iuniores.toLocaleString('es'), num: s.iuniores,
      tip: 'Reclutas heredados del run. Gástalos con la "Leva de iuniores" para reforzar soldados; el resto vuelve al hub.',
    },
    {
      key: 'threat', glyph: '☠', icon: 'res-threat', label: 'Amenaza', value: s.threat.toFixed(1), num: s.threat, decimals: true,
      tip: 'Atención enemiga (0–10). Alta amenaza dispara escaramuzas y emboscadas.',
      alert: s.threat >= ALERT.threatAlert,
      warn: s.threat >= ALERT.threatWarn && s.threat < ALERT.threatAlert,
    },
  ];
}

interface Flash { delta: number; decimals: boolean; id: number; }

/** Format a delta badge: +/− sign, 1 decimal for morale/threat, locale integer otherwise. */
function fmtDelta(delta: number, decimals: boolean): string {
  const sign = delta > 0 ? '+' : '−';
  const abs = Math.abs(delta);
  return sign + (decimals ? abs.toFixed(1) : Math.round(abs).toLocaleString('es'));
}

export function CampaignResourceBar({ state }: { state: IterBelliState }) {
  const days = Math.max(0, state.timeRemaining);
  const defs = resources(state);

  // Flash the delta on any resource that changed since the previous turn so the
  // player SEES passive drains (hunger/skirmish/ambush) and hidden card costs.
  const prevRef = useRef<Record<string, number> | null>(null);
  const [flashes, setFlashes] = useState<Record<string, Flash>>({});

  useEffect(() => {
    const prev = prevRef.current;
    if (prev) {
      const fresh: Record<string, Flash> = {};
      for (const d of defs) {
        const before = prev[d.key];
        if (before !== undefined && d.num !== before) {
          fresh[d.key] = { delta: d.num - before, decimals: !!d.decimals, id: Math.round(performance.now() * 1000) + Math.floor(Math.random() * 1000) };
        }
      }
      if (Object.keys(fresh).length > 0) {
        setFlashes((f) => ({ ...f, ...fresh }));
        const t = setTimeout(() => {
          setFlashes((f) => {
            const next = { ...f };
            for (const k of Object.keys(fresh)) if (next[k]?.id === fresh[k].id) delete next[k];
            return next;
          });
        }, 1700);
        // not returning the cleanup here would leak timers across rapid turns,
        // but a stale timer only clears its own id-matched flash, so it's safe.
        void t;
      }
    }
    prevRef.current = Object.fromEntries(defs.map((d) => [d.key, d.num]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <div class="ib-resbar">
      {defs.map((r) => {
        const flash = flashes[r.key];
        const dir = flash ? (flash.delta > 0 ? 'up' : 'down') : '';
        return (
          <Tooltip
            key={r.key}
            variant="rich"
            position="below"
            content={
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: 'var(--imp-gold-hi)' }}>
                  {r.icon ? <GameIcon name={r.icon} size="panel" /> : r.iconType ? <ResourceIcon type={r.iconType} size="panel" /> : r.glyph}
                  {r.label}
                </div>
                <div style={{ color: 'var(--imp-text-mid)', fontSize: 'var(--font-size-sm)' }}>{r.tip}</div>
              </div>
            }
          >
            <div class={`ib-res${r.alert ? ' alert' : ''}${r.warn ? ' warn' : ''}${dir ? ` flash-${dir}` : ''}`}>
              {flash && <span class={`ib-res-delta ${dir}`}>{fmtDelta(flash.delta, flash.decimals)}</span>}
              <span class="ib-res-label">
                {r.icon ? <GameIcon name={r.icon} size="row" /> : r.iconType ? <ResourceIcon type={r.iconType} size="row" /> : r.glyph} {r.label}
              </span>
              <span class="ib-res-value">{r.value}</span>
            </div>
          </Tooltip>
        );
      })}
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
