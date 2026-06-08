import { describe, it, expect } from 'vitest';
import * as B from '../iter-belli-balance';

describe('ammunition campaign constant', () => {
  it('START seeds a starting ammunition budget', () => {
    expect(B.START.ammunition).toBe(30);
  });
});
