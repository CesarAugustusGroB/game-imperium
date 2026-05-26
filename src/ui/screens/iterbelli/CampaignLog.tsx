import { useRef, useLayoutEffect } from 'preact/hooks';
import type { LogLine } from '../../../game/iterBelli/iter-belli-types';

/** Scrolling chronicle of the campaign's turns and events. */
export function CampaignLog({ lines }: { lines: LogLine[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines.length]);

  return (
    <div class="ib-log" ref={ref}>
      {lines.map((l, i) => (
        <div key={i} class={`ib-log-line ${l.kind}`}>{l.text}</div>
      ))}
    </div>
  );
}
