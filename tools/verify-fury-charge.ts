import { strict as assert } from 'node:assert';
import { BattleState } from '../src/battle/battle-state';
import { abilityRegistry } from '../src/battle/effects';
import { offsetToAxialFlatTop } from '../src/battle/hex';

function offsetRow(hex: { q: number; r: number }): number {
  return hex.r + Math.floor(hex.q / 2);
}

{
  const state = new BattleState({ cols: 10, rows: 10, vertical: true });
  state.generateGrid();

  const start = offsetToAxialFlatTop(5, 7);
  const unit = state.addUnit('blue', start, 'Boudicca Test', 'vanguard');

  abilityRegistry.apply({ type: 'Fury Charge' }, { engine: state });

  assert.equal(offsetRow(unit.hex), 6, 'Vertical Fury Charge should first step upward for blue units');
  assert.deepEqual(
    unit.path.at(-1),
    offsetToAxialFlatTop(5, 5),
    'Vertical Fury Charge should queue a two-row upward leap',
  );
}

{
  const state = new BattleState({ cols: 10, rows: 10, vertical: false });
  state.generateGrid();

  const start = { q: 2, r: 5 };
  const unit = state.addUnit('blue', start, 'Boudicca Legacy Test', 'vanguard');

  abilityRegistry.apply({ type: 'Fury Charge' }, { engine: state });

  assert.equal(unit.hex.q, 3, 'Horizontal Fury Charge should still first step right for blue units');
  assert.equal(unit.path.at(-1)?.q, 4, 'Horizontal Fury Charge should still queue a two-hex rightward charge');
}

console.log('Fury Charge verification passed.');
