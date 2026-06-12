/**
 * Runs every tools/verify-*.ts sequentially and fails on the first broken one.
 * Keeps the verify scripts honest — they rot silently when nothing runs them
 * (see docs/loop-hallazgos.md, iteración 4/5).
 * Run: npm run verify
 */
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const toolsDir = dirname(fileURLToPath(import.meta.url));
const scripts = readdirSync(toolsDir)
  .filter((f) => f.startsWith('verify-') && f.endsWith('.ts'))
  .sort();

let failed = 0;
for (const script of scripts) {
  const r = spawnSync(process.execPath, ['--import', 'tsx', join(toolsDir, script)], {
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
  });
  if (r.status === 0) {
    console.log(`✓ ${script}`);
  } else {
    failed++;
    console.error(`✗ ${script}`);
    const tail = (r.stdout + r.stderr).trim().split('\n').slice(-6).join('\n');
    console.error(tail.replace(/^/gm, '    '));
  }
}

console.log(`\n${scripts.length - failed}/${scripts.length} verify scripts passed.`);
if (failed > 0) process.exit(1);
