import { describe, it, expect } from 'vitest';
import { computeStartingDiscipline } from '../iter-belli-state';

describe('computeStartingDiscipline (0–10, base 2 + archetype + legate ±2)', () => {
  it('a plain Warlord starts at base 2', () => {
    expect(computeStartingDiscipline('Warlord', [])).toBe(2);
  });
  it('archetype bonus adds on top of base', () => {
    expect(computeStartingDiscipline('Diplomat', [])).toBe(4); // 2 + 2
    expect(computeStartingDiscipline('Merchant', [])).toBe(3); // 2 + 1
  });
  it('legate disciplined traits add, net-clamped to +2', () => {
    expect(computeStartingDiscipline('Warlord', ['disciplined'])).toBe(3);
    expect(computeStartingDiscipline('Warlord', ['disciplined', 'cautious', 'tactician'])).toBe(4); // +3 -> +2
  });
  it('negative traits net-clamp to -2 and the floor is 0', () => {
    expect(computeStartingDiscipline('Warlord', ['aggressive', 'rallying'])).toBe(0); // 2 - 2
  });
  it('null archetype falls back to base only', () => {
    expect(computeStartingDiscipline(null, [])).toBe(2);
  });
});
