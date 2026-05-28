import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve(process.cwd(), 'src/ui/screens/CommanderSelectScreen.tsx'), 'utf8');

const requiredMarkers = [
  ['commander asset root', '/asset/ui/commander-select/slices/'],
  ['asset path map', 'COMMANDER_UI_ASSETS'],
  ['screen chrome shell', 'cmdr-screen'],
  ['decorative border chrome', 'cmdr-border-corner'],
  ['side banners', 'cmdr-side-banner'],
  ['asset-backed card frame', 'cmdr-card-frame'],
  ['selected diamond image', 'selected_diamond'],
  ['asset-backed archetype icons', 'ARCHETYPE_ICON_ASSETS'],
  ['asset-backed ability icons', 'ABILITY_ICON_ASSETS'],
  ['asset-backed unit icons', 'UNIT_ICON_ASSETS'],
  ['asset-backed victory icons', 'VICTORY_ICON_ASSETS'],
  ['existing commander data source', 'COMMANDERS.map'],
  ['run creation still wired', 'startNewRun(commander)'],
] as const;

for (const [label, marker] of requiredMarkers) {
  if (!source.includes(marker)) {
    throw new Error(`Missing ${label}: expected marker "${marker}"`);
  }
}

const forbiddenMarkers = [
  ['legacy ornate frame wrapper', '<OrnateFrame'],
  ['legacy ornate divider', '<OrnateDivider'],
  ['inline svg icons', '<svg'],
  ['emoji unit placeholder map', 'UNIT_EMOJIS'],
  ['emoji book button copy', '📖'],
  ['emoji crown cta copy', '👑'],
] as const;

for (const [label, marker] of forbiddenMarkers) {
  if (source.includes(marker)) {
    throw new Error(`Commander select should not use ${label}: found "${marker}"`);
  }
}

console.log('Commander select UI source smoke test passed.');
