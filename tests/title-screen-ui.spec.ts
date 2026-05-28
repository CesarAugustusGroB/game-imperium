import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve(process.cwd(), 'src/ui/screens/TitleScreen.tsx'), 'utf8');

const requiredMarkers = [
  ['imperial full-screen shell', 'title-screen__imperial-shell'],
  ['large reference-style masthead', 'title-screen__masthead'],
  ['three primary menu buttons', 'title-screen__primary-actions'],
  ['footer action row', 'title-screen__footer-actions'],
  ['options modal wiring', 'OptionsModal'],
  ['credits modal surface', 'title-screen__credits-modal'],
  ['current optimized background', 'roman_background.png?w=1600;2400&format=avif;webp;png&as=picture'],
  ['brighter background treatment', 'title-screen__lightwash'],
  ['generated laurel wreath asset', '/asset/ui/generated/roman_laurel_wreath.png'],
  ['generated eagle asset', '/asset/ui/generated/roman_eagle.png'],
  ['emblem image styling', 'title-screen__emblem'],
  ['generated corner ornament asset', '/asset/ui/generated/roman_corner_ornament.png'],
  ['corner image styling', 'title-screen__corner-img'],
  ['lucide footer icons', 'Settings, BookOpen, Landmark'],
] as const;

for (const [label, marker] of requiredMarkers) {
  if (!source.includes(marker)) {
    throw new Error(`Missing ${label}: expected marker "${marker}"`);
  }
}

if (source.includes('<OrnateFrame')) {
  throw new Error('TitleScreen should not use the old centered OrnateFrame card layout.');
}

if (source.includes('/asset/ui/cortina_izq.png') || source.includes('title-screen__drape')) {
  throw new Error('TitleScreen should not render the old side curtains.');
}

if (source.includes("import { LaurelWreath }")) {
  throw new Error('TitleScreen should use the generated emblem asset instead of the old CSS/vector crest.');
}

if (source.includes('/asset/ui/generated/roman_imperial_emblem.png')) {
  throw new Error('TitleScreen should use separate laurel and eagle assets instead of the combined emblem.');
}

if (source.includes('.title-screen__corner::before') || source.includes('.title-screen__corner::after')) {
  throw new Error('TitleScreen should use generated corner images instead of CSS-drawn corner ornaments.');
}

console.log('TitleScreen UI source smoke test passed.');
