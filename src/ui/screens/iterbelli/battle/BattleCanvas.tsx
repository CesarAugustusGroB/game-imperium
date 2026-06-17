import { useEffect, useRef } from 'preact/hooks';
import type { BattleState, Side } from '../../../../game/iterBelli/battle/types';
import { createBattleFx } from './battle-fx';

interface Props {
  state: BattleState;
  /** Increments each round so the canvas knows to fire FX for the latest orders. */
  round: number;
  lastOrders: { you: string; enemy: string } | null;
  lastLosses: { you: number; enemy: number } | null;
}

export function BattleCanvas({ state, round, lastOrders, lastLosses }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const fxRef = useRef<ReturnType<typeof createBattleFx> | null>(null);
  const lastRound = useRef(0);

  useEffect(() => {
    if (!ref.current) return;
    const fx = createBattleFx(ref.current);
    fxRef.current = fx; fx.setState(state); fx.resize(); fx.start();
    const onResize = () => fx.resize();
    addEventListener('resize', onResize);
    return () => { removeEventListener('resize', onResize); fx.stop(); };
  }, []);

  // Keep the FX engine pointed at the latest battle state — in an effect, not the
  // render body, so the first mount's state isn't dropped before fxRef is populated.
  useEffect(() => { fxRef.current?.setState(state); }, [state]);

  // Fire visual effects once per new round.
  useEffect(() => {
    const fx = fxRef.current; if (!fx || round === lastRound.current) return;
    lastRound.current = round;
    if (lastOrders) { fx.triggerVisualEffects('you', lastOrders.you); fx.triggerVisualEffects('enemy', lastOrders.enemy); }
    if (lastLosses) {
      if (lastLosses.enemy > 0) fx.spawnDamageFloat('enemy' as Side, lastLosses.enemy);
      if (lastLosses.you > 0) fx.spawnDamageFloat('you' as Side, lastLosses.you);
    }
  }, [round]);

  return <canvas ref={ref} class="ib-bm-canvas" />;
}
