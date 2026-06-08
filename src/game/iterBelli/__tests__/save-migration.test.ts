import { describe, it, expect } from 'vitest';
import { migrateSave } from '../iter-belli-save';

describe('save migration', () => {
  it('v1 (versionless, 1–5) doubles discipline, defaults ammo, bumps to v3', () => {
    const out = migrateSave({ discipline: 4 } as any);
    expect(out.discipline).toBe(8);
    expect(out.ammunition).toBe(30);
    expect(out.schemaVersion).toBe(3);
  });
  it('v2 keeps discipline, backfills ammo, bumps to v3', () => {
    const out = migrateSave({ discipline: 4, schemaVersion: 2 } as any);
    expect(out.discipline).toBe(4);
    expect(out.ammunition).toBe(30);
    expect(out.schemaVersion).toBe(3);
  });
  it('v3 with ammo is left untouched', () => {
    const out = migrateSave({ discipline: 4, ammunition: 12, schemaVersion: 3 } as any);
    expect(out).toEqual({ discipline: 4, ammunition: 12, schemaVersion: 3 });
  });
  it('clamps a migrated v1 discipline into 0–10', () => {
    expect(migrateSave({ discipline: 6 } as any).discipline).toBe(10);
  });
});
