import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const root = process.cwd();
const globalsPath = resolve(root, 'src/ui/globals.css');
const globals = readFileSync(globalsPath, 'utf8');

const requiredGlobalMarkers = [
  '--scrollbar-thumb',
  '--scrollbar-track',
  'scrollbar-width: thin',
  'scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track)',
  '*::-webkit-scrollbar',
  'width: 8px',
  '*::-webkit-scrollbar-thumb',
  'border-radius: 999px',
] as const;

for (const marker of requiredGlobalMarkers) {
  if (!globals.includes(marker)) {
    throw new Error(`Global scrollbar style is missing marker: ${marker}`);
  }
}

const allowedScrollbarStyleFiles = new Set(['src/ui/globals.css']);
const sourceFiles: string[] = [];

function collectFiles(dir: string) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      collectFiles(path);
      continue;
    }
    if (/\.(css|ts|tsx)$/.test(entry)) sourceFiles.push(path);
  }
}

collectFiles(resolve(root, 'src'));

for (const file of sourceFiles) {
  const rel = relative(root, file).replaceAll('\\', '/');
  if (allowedScrollbarStyleFiles.has(rel)) continue;

  const source = readFileSync(file, 'utf8');
  if (source.includes('::-webkit-scrollbar') || source.includes('scrollbar-color')) {
    throw new Error(`Scrollbar styling should inherit the global style, but ${rel} defines its own.`);
  }
}

console.log('Global scrollbar style smoke test passed.');
