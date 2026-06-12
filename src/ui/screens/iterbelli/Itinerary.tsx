import { Fragment } from 'preact';
import { getActiveScenario } from '../../../game/iterBelli/iter-belli-scenario';

/** Horizontal progress rail of the campaign stops (from the active scenario). */
export function Itinerary({ locationIdx }: { locationIdx: number }) {
  return (
    <div class="ib-itinerary">
      {getActiveScenario().locations.map((l, i) => {
        const cls = [
          'ib-stop',
          i < locationIdx ? 'visited' : '',
          i === locationIdx ? 'current' : '',
          l.type === 'objetivo' ? 'objective' : '',
        ].filter(Boolean).join(' ');
        return (
          <Fragment key={l.id ?? i}>
            {i > 0 && <div class={`ib-line${i <= locationIdx ? ' done' : ''}`} />}
            <div class={cls} title={l.name}>
              <div class="ib-dot" />
              <div class="ib-stop-name">{l.name.split(' ')[0]}</div>
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}
