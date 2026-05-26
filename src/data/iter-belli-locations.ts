/**
 * Iter Belli — itinerary, crises and card categories.
 * Ported verbatim from the prototype; category colours remapped to accents that
 * read well on the dark Imperium surface.
 */

import type { Category, CategoryName, Crisis, Location } from '../game/iterBelli/iter-belli-types';

export const LOCATIONS: Location[] = [
  {
    id: 'frontera',
    name: 'Frontera de Hispania',
    desc: 'Territorio neutral. Aliados itálicos al norte, frontera celtibera al sur. Tranquilidad relativa.',
    type: 'neutral',
    threatPerTurn: 0,
  },
  {
    id: 'tarraco',
    name: 'Tarraco (ciudad aliada)',
    desc: 'Plaza fuerte aliada. Mercado activo, depósito imperial, inteligencia local. Lugar para reabastecerse.',
    type: 'aliado',
    threatPerTurn: -0.5,
  },
  {
    id: 'llanura',
    name: 'Llanura ibera',
    desc: 'Territorio ibero hostil. Tribus dispersas, caballería ligera enemiga. La amenaza crece cada día que pasas aquí.',
    type: 'enemigo',
    threatPerTurn: 1,
  },
  {
    id: 'bosques',
    name: 'Bosques saguntinos',
    desc: 'Terreno cerrado, ideal para emboscadas. El bosque oculta tanto a tus exploradores como a los suyos.',
    type: 'enemigo',
    threatPerTurn: 1.5,
  },
  {
    id: 'sagunto',
    name: 'Sagunto',
    desc: 'Sagunto. El ejército púnico te espera. Aquí se decide la campaña.',
    type: 'objetivo',
    threatPerTurn: 0,
  },
];

export const CRISES: Record<'hambre' | 'motin' | 'encuentro', Crisis> = {
  hambre: {
    name: 'Hambre en filas',
    category: 'Crisis',
    desc: 'Los suministros se agotaron. Los hombres pasan hambre, la moral cae cada día.',
    icon: '✖',
  },
  motin: {
    name: 'Riesgo de motín',
    category: 'Crisis',
    desc: 'La moral está rota. Los oficiales reportan murmullos de deserción.',
    icon: '✖',
  },
  encuentro: {
    name: 'Vanguardia enemiga avistada',
    category: 'Crisis',
    desc: 'Tus exploradores reportan tropa púnica cerca. Decide cómo responder o se decidirá por ti.',
    icon: '✖',
  },
};

/** Category icon + accent colour (dark-theme friendly). */
export const CATEGORIES: Record<CategoryName, Category> = {
  'Logística':    { color: '#c9a23f', icon: '❦' },
  'Movimiento':   { color: '#5a8ab0', icon: '→' },
  'Inteligencia': { color: '#7faa6a', icon: '✦' },
  'Coerción':     { color: '#b23a3a', icon: '✜' },
  'Diplomacia':   { color: '#d4a843', icon: '✋' },
  'Postura':      { color: '#9a9aa6', icon: '⛨' },
  'Operaciones':  { color: '#a972a9', icon: '⚜' },
  'Crisis':       { color: '#c24a3a', icon: '✖' },
};
