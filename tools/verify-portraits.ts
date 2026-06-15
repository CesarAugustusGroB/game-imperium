/**
 * Verifies every data-driven portrait path resolves to a real file under
 * public/. Catches drift like a renamed/missing character art before it ships
 * as a broken <img> (e.g. the pope_leo/innocent mismatch flagged in the
 * mejoras report, Topic 2). Covers commanders, advisors and governors.
 * Run: npm run verify  (auto-discovered by run-all-verify.ts)
 */
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COMMANDERS } from '../src/data/commanders';
import { STARTER_ADVISORS } from '../src/data/advisor-data';
import { ALL_GOVERNORS } from '../src/data/governor-data';

const publicDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

/** Web path like "/asset/characters/x.png" → absolute disk path under public/. */
function toDiskPath(webPath: string): string {
  return join(publicDir, webPath.replace(/^\//, ''));
}

interface PortraitRef { kind: string; id: string; portrait: string }

const refs: PortraitRef[] = [];
for (const c of COMMANDERS) refs.push({ kind: 'commander', id: c.id, portrait: c.portrait });
for (const a of STARTER_ADVISORS) if (a.portrait) refs.push({ kind: 'advisor', id: a.id, portrait: a.portrait });
for (const g of ALL_GOVERNORS) if (g.portrait) refs.push({ kind: 'governor', id: g.id, portrait: g.portrait });

const missing = refs.filter((r) => !existsSync(toDiskPath(r.portrait)));

if (missing.length > 0) {
  console.error(`verify-portraits: ${missing.length} broken portrait path(s):`);
  for (const m of missing) console.error(`  [${m.kind}] ${m.id} → ${m.portrait}`);
  throw new Error(`${missing.length} portrait path(s) do not resolve to a file under public/`);
}

console.log(`verify-portraits: ok (${refs.length} portraits checked)`);
