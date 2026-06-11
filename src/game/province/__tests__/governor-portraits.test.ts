import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { ALL_GOVERNORS } from '../../../data/governor-data';

describe('governor portraits (character integration)', () => {
  it('every governor has a distinct /asset/portraits/ portrait', () => {
    const seen = new Set<string>();
    for (const g of ALL_GOVERNORS) {
      expect(g.portrait, `${g.id} portrait`).toMatch(/^\/asset\/portraits\/roman-portrait-\d{2}\.png$/);
      expect(seen.has(g.portrait!), `${g.id} duplicate portrait`).toBe(false);
      seen.add(g.portrait!);
    }
  });

  it('each referenced portrait file exists on disk', () => {
    for (const g of ALL_GOVERNORS) {
      const onDisk = resolve(process.cwd(), 'public' + g.portrait!);
      expect(existsSync(onDisk), `missing ${g.portrait}`).toBe(true);
    }
  });
});
