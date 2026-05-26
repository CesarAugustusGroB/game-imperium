import { LOCATIONS } from '../../../data/iter-belli-locations';

/** Horizontal progress rail of the 5 campaign stops. */
export function Itinerary({ locationIdx }: { locationIdx: number }) {
  return (
    <div class="ib-itinerary">
      {LOCATIONS.map((l, i) => {
        const cls = [
          'ib-stop',
          i < locationIdx ? 'visited' : '',
          i === locationIdx ? 'current' : '',
          l.type === 'objetivo' ? 'objective' : '',
        ].filter(Boolean).join(' ');
        return (
          <>
            {i > 0 && <div class={`ib-line${i <= locationIdx ? ' done' : ''}`} />}
            <div class={cls} title={l.name}>
              <div class="ib-dot" />
              <div class="ib-stop-name">{l.name.split(' ')[0]}</div>
            </div>
          </>
        );
      })}
    </div>
  );
}
