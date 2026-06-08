import { describe, it, expect } from 'vitest';
import { CARD_DEFS } from '../iter-belli-cards';

const card = () => CARD_DEFS.find((c) => c.id === 'reabastecer_municion')!;

describe('ammunition buy card', () => {
  it('exists, costs gold + a day, grants ammunition', () => {
    expect(card().category).toBe('Logística');
    expect(card().cost).toEqual({ time: 1, gold: 30 });
    expect(card().effects({} as any)).toEqual({ ammunition: 18 });
  });
  it('requires the gold on hand', () => {
    expect(card().requires!({ state: { gold: 30 } } as any)).toBe(true);
    expect(card().requires!({ state: { gold: 10 } } as any)).toBe(false);
  });
});
