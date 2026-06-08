import { describe, it, expect } from 'vitest';
import { CARD_DEFS } from '../iter-belli-cards';

const drill = () => CARD_DEFS.find((c) => c.id === 'instruccion_campamento')!;

describe('drill card', () => {
  it('exists in the deck with the Postura category', () => {
    expect(drill()).toBeDefined();
    expect(drill().category).toBe('Postura');
  });
  it('costs a day + supplies and grants +1 discipline', () => {
    expect(drill().cost).toEqual({ time: 1, supplies: 4 });
    expect(drill().effects({ state: { supplies: 10, discipline: 3 } } as any)).toEqual({ discipline: 1 });
  });
  it('is gated off when discipline is maxed or supplies are short', () => {
    expect(drill().requires!({ state: { discipline: 10, supplies: 10 } } as any)).toBe(false);
    expect(drill().requires!({ state: { discipline: 3, supplies: 2 } } as any)).toBe(false);
    expect(drill().requires!({ state: { discipline: 3, supplies: 10 } } as any)).toBe(true);
  });
});
