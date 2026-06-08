import { describe, it, expect } from 'vitest';
import { migrateSave } from '../iter-belli-save';

const base = { discipline: 4 } as any;

describe('save migration to discipline 0–10', () => {
  it('a versionless (v1, 1–5) save doubles discipline into 0–10', () => {
    const out = migrateSave({ ...base }); // no schemaVersion
    expect(out.discipline).toBe(8);
    expect(out.schemaVersion).toBe(2);
  });
  it('a v2 save is left untouched', () => {
    const out = migrateSave({ ...base, schemaVersion: 2 });
    expect(out.discipline).toBe(4);
    expect(out.schemaVersion).toBe(2);
  });
  it('clamps the migrated value into 0–10', () => {
    expect(migrateSave({ discipline: 6 } as any).discipline).toBe(10);
  });
});
