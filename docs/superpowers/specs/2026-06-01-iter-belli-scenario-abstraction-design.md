# Iter Belli — Scenario Abstraction (seam) — design

**Branch:** `worktree-experimentation`
**Fecha:** 2026-06-01
**Estado:** diseño aprobado, pendiente de implementar

## Contexto

La campaña Iter Belli está cableada al escenario **Sagunto / Aníbal Barca / Hispania**.
El motor (`iter-belli-state.ts`, `iter-belli-combat.ts`) importa globales y literales
específicos de ese escenario. Este trabajo **abstrae** ese contenido a una definición
genérica `CampaignScenario` y deja **Sagunto como la primera instancia concreta**
(`SAGUNTUM`), para poder personalizar/añadir escenarios después.

**Alcance (decidido):** *Solo el seam — refactor puro.* Gameplay idéntico, cero
cambios de balance. No se añade selección por spoke ni un 2º escenario (eso es fase 2).

**Arquitectura (decidida):** *Opción A — holder de módulo.* Un `getActiveScenario()` /
`setActiveScenario()` / `resetActiveScenario()` con default `SAGUNTUM`. El motor lo lee;
el bridge del Hub (`CampaignSeed` / `EmbarkCard`) **no se toca**.

## Lo que hoy está hardcodeado (inventario)

| Qué | Dónde | Literal |
|---|---|---|
| Itinerario (5 paradas) | `data/iter-belli-locations.ts` → `LOCATIONS` | frontera, tarraco, llanura, bosques, **sagunto** |
| Crisis | `data/iter-belli-locations.ts` → `CRISES` | hambre / motin / encuentro (sabor púnico) |
| Enemigo | `iter-belli-combat.ts:268,282` + `balance` | `'Aníbal Barca'`, `Maniobrera`, 7000/2000/8/5 |
| Objetivo + carta decisiva | `iter-belli-state.ts:134,397` | id `'sagunto'`, carta `'asalto_decisivo'` |
| Narrativa de cierre | `iter-belli-state.ts:415,432-436` | "Triunfo en Hispania", "Has vencido en Sagunto", "ejército púnico" |
| Nombres de conquista | `data/iter-belli-conquest.ts` → `CONQUEST_NAMES` | topónimos iberos |

Lo que **NO** se mueve (es matemática genérica, se queda en `balance`):
`ENEMY_THREAT_DIVISOR`, `ENEMY_WEAKEN_PER_POINT`, `FORTIFIED_TERRAIN_MULT`,
`BATTLE_MAX_ROUNDS`, upkeep/hambre/motín/escaramuza/emboscada, clamps.

## El tipo `CampaignScenario`

En `iter-belli-types.ts` (junto a `Location`, `Crisis`, `DoctrineName`):

```ts
export interface ScenarioEnemy {
  name: string;          // 'Aníbal Barca'
  doctrine: DoctrineName;// 'Maniobrera'
  baseSoldiers: number;  // 7000
  minSoldiers: number;   // 2000
  morale: number;        // 8
  discipline: number;    // 5
}

export interface ScenarioNarrative {
  victoryTitle: string;  // 'Triunfo en Hispania'
  defeatTitle: string;   // 'Campaña fallida'
  victoryText: string;   // 'Has derrotado al ejército púnico. Sagunto se rinde. La campaña es un éxito.'
  defeatText: string;    // 'Tu ejército ha sido derrotado en Sagunto. La campaña ha fracasado.'
  /** Logs con interpolación → funciones para clavar el output verbatim. */
  battleWonLog: (survivors: number) => string;  // `Has vencido en Sagunto. Quedan ${n} soldados.`
  battleLostLog: (survivors: number) => string; // `Derrota en Sagunto. Quedan ${n} soldados.`
}

export interface CampaignScenario {
  id: string;                                  // 'saguntum'
  locations: Location[];                       // el itinerario
  objectiveLocationId: string;                 // 'sagunto'
  decisiveCardId: string;                      // 'asalto_decisivo'
  crises: Record<'hambre' | 'motin' | 'encuentro', Crisis>;
  enemy: ScenarioEnemy;
  narrative: ScenarioNarrative;
  conquestNames: string[];
}
```

> `narrative` lleva funciones — `CampaignScenario` es un objeto de código, no se serializa.
> Esto garantiza que los logs interpolados salgan **idénticos** a los actuales.

## Instancia `SAGUNTUM`

Nuevo `src/data/iter-belli-scenario-saguntum.ts`. **Compone los datos existentes**
(no los duplica) y **referencia las constantes de enemigo de `balance`** para que los
valores sean provablemente idénticos:

```ts
import { LOCATIONS, CRISES } from './iter-belli-locations';
import { CONQUEST_NAMES } from './iter-belli-conquest';
import * as B from '../game/iterBelli/iter-belli-balance';
import type { CampaignScenario } from '../game/iterBelli/iter-belli-types';

export const SAGUNTUM: CampaignScenario = {
  id: 'saguntum',
  locations: LOCATIONS,
  objectiveLocationId: 'sagunto',
  decisiveCardId: 'asalto_decisivo',
  crises: CRISES,
  enemy: {
    name: 'Aníbal Barca',
    doctrine: 'Maniobrera',
    baseSoldiers: B.ENEMY_BASE_SOLDIERS,
    minSoldiers: B.ENEMY_MIN_SOLDIERS,
    morale: B.ENEMY_MORALE,
    discipline: B.ENEMY_DISCIPLINE,
  },
  narrative: {
    victoryTitle: 'Triunfo en Hispania',
    defeatTitle: 'Campaña fallida',
    victoryText: 'Has derrotado al ejército púnico. Sagunto se rinde. La campaña es un éxito.',
    defeatText: 'Tu ejército ha sido derrotado en Sagunto. La campaña ha fracasado.',
    battleWonLog: (n) => `Has vencido en Sagunto. Quedan ${n} soldados.`,
    battleLostLog: (n) => `Derrota en Sagunto. Quedan ${n} soldados.`,
  },
  conquestNames: CONQUEST_NAMES,
};
```

## El holder del escenario activo

Nuevo `src/game/iterBelli/iter-belli-scenario.ts`:

```ts
import type { CampaignScenario } from './iter-belli-types';
import { SAGUNTUM } from '../../data/iter-belli-scenario-saguntum';

let active: CampaignScenario = SAGUNTUM;

export function getActiveScenario(): CampaignScenario { return active; }
export function setActiveScenario(s: CampaignScenario): void { active = s; }
export function resetActiveScenario(): void { active = SAGUNTUM; }
```

Sin ciclos: `data/saguntum` importa solo *tipos* de `iter-belli-types` + datos de `data/*`;
`game/iter-belli-scenario` importa el dato `SAGUNTUM`; `state` y `combat` importan el holder.

## Cambios en el motor

### `iter-belli-state.ts`
- Quitar `import { CRISES, LOCATIONS } from '../../data/iter-belli-locations'`;
  añadir `import { getActiveScenario, resetActiveScenario } from './iter-belli-scenario'`.
- `currentLocation()` → `getActiveScenario().locations[S.locationIdx]`.
- `refillPool()` → comparar con `getActiveScenario().objectiveLocationId` y usar
  `getActiveScenario().decisiveCardId` en vez de `'sagunto'` / `'asalto_decisivo'`.
- `injectCrises()` → `getActiveScenario().crises`.
- `checkEndConditions()` (línea 397) → comparar con `objectiveLocationId`.
- `finishCampaign()` → `title` desde `narrative.victoryTitle/defeatTitle`.
- `applyBattleOutcome()` → logs desde `narrative.battleWonLog/battleLostLog`;
  textos de cierre desde `narrative.victoryText/defeatText`.
- `startIterBelliCampaign()` y `resetIterBelli()` → llaman `resetActiveScenario()`
  (default SAGUNTUM; el seed del Hub no cambia).

### `iter-belli-combat.ts`
- `beginBattle()` → leer `const sc = getActiveScenario()`; `makeArmy(sc.enemy.name, enemySoldiers, sc.enemy.morale, sc.enemy.discipline, sc.enemy.doctrine)`;
  `enemySoldiers` usa `sc.enemy.baseSoldiers` / `sc.enemy.minSoldiers`. El log de cabecera
  usa `sc.enemy.name` y la disciplina romana del enemigo. `enemyMult` sigue con `B.*`.

### `EndgameCard.tsx`
- `pickConquestName` gana un 2º parámetro opcional `names: string[] = CONQUEST_NAMES`;
  la llamada pasa `getActiveScenario().conquestNames`. Back-compat total.

## Riesgos / bordes

- **Sin drift de balance:** el enemigo referencia `B.*`; itinerario/crisis/nombres son las
  mismas instancias. La narrativa se copia verbatim (logs como funciones).
- **Sin ciclos de imports:** verificado arriba (data→tipos, game-holder→data, motor→holder).
- **`pickConquestName` default:** mantiene `CONQUEST_NAMES` como default → si algún otro
  consumidor lo llama sin el 2º arg, comportamiento idéntico.
- **Reset:** `resetActiveScenario()` en `resetIterBelli` y `startIterBelliCampaign` evita
  que un futuro `setActiveScenario` quede pegado entre runs.
- **`balance` retiene los nombres `ENEMY_*`:** siguen siendo los números canónicos de
  Sagunto; futuros escenarios definen los suyos en su objeto, sin tocar `balance`.

## Verificación

- **`tools/verify-iter-belli-scenario.ts`** (`npx tsx`):
  - `SAGUNTUM.locations.length === 5`; `objectiveLocationId === 'sagunto'`;
    existe una location con ese id y `type === 'objetivo'`.
  - `enemy`: name `'Aníbal Barca'`, doctrine `'Maniobrera'`, baseSoldiers 7000,
    minSoldiers 2000, morale 8, discipline 5.
  - `narrative`: las 4 prosas no vacías; `battleWonLog(123)` contiene `'123'` y `'Sagunto'`.
  - `decisiveCardId === 'asalto_decisivo'` y existe esa carta en `CARD_DEFS`.
  - `getActiveScenario() === SAGUNTUM` por defecto; tras `setActiveScenario(x)` cambia y
    `resetActiveScenario()` lo devuelve a SAGUNTUM.
- `tsc --noEmit` limpio.
- Regresión: `verify-iter-belli-consilium` / `verify-iter-belli-doctrines` /
  `verify-iter-belli-quests` / `verify-decretum-hub` / `verify-doctrine-hub` pasan.
- Chrome: nueva partida → embarcar → marcha hasta Sagunto → batalla decisiva contra
  Aníbal → victoria/derrota muestran la misma narrativa de siempre.
