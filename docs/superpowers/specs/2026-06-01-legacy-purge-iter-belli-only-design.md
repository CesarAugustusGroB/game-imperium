# Legacy Purge — Iter Belli as the only campaign/battle — design

**Branch:** `worktree-experimentation`
**Fecha:** 2026-06-01
**Estado:** diseño aprobado, pendiente de implementar

## Objetivo

Eliminar por completo los sistemas legacy del juego dejando **Iter Belli** (campaña
de cartas + batalla de dados) como **el único** modo de campaña y de batalla. El
flujo vivo queda: `Title → CommanderSelect → Forum/Hub → EmbarkCard → Iter Belli →
EndgameCard → Hub`.

Se borran: **bellum** (mapa hex + sus pantallas), **spoke**, el **sistema de
batalla viejo** (motor campal de `src/battle/**`), **Quick Battle**, y las
**pantallas de fin de partida** (Victory/Defeat/EndScreen).

## Decisiones (todas confirmadas)

| Tema | Decisión |
|---|---|
| Alcance batalla | Borrar también el combate campal viejo **y** Quick Battle. Iter Belli = único combate. |
| Fin de run | **Sin fin-de-run por ahora.** Se borran Victory/Defeat/EndScreen y `recordRunComplete`. El run solo termina con "Abandon Run". (Consecuencia aceptada: no hay pantalla de victoria de partida ni grabación de stats de run.) |
| Terreno al embarcar | Del **escenario activo** (SAGUNTUM por defecto), vía un nuevo campo `provinceTerrain`. |
| Duración al embarcar | Calculada desde los consejeros sentados (se extrae la lógica de `generateSpokeFromCouncil`, sin generar spoke/nodos). |
| Roster de 5 escenarios | **Follow-up posterior** a la purga (el embark ya tomará el terreno del escenario activo). |

## Hallazgos clave del mapeo

1. **Iter Belli es autocontenido**: no importa nada de `src/battle/**`, `src/game/army/*`
   (salvo tipos compartidos) ni `src/game/campaign/**`. Su enemigo sale de
   `iter-belli-balance` / el escenario. → todo el motor de batalla viejo muere limpio.
2. **`runSeasonTick` solo lo llaman `spoke.ts` y `campaign-season.ts`** (bellum). Al
   borrarlos, `season-tick.ts` queda muerto. Sus setters (`setExtraUpkeepReductionFn`,
   `setThreatReductionFn`) los cablea `game-state.ts`; hay que quitar ese wiring.
   Implica que los passives de asesor `upkeep-reduction`/`threat-reduction` (canal
   season-tick) **no actuaban en el flujo vivo** — se eliminan sin cambio de
   comportamiento vivo.
3. **El embark vivo no usa `startSpokeFromCouncil`.** `EmbarkCard.handleEmbark` llama
   `startIterBelliCampaign` directo y solo lee `plannedSpoke` para `theme`/`duration`/
   `label`/gate. `startSpokeFromCouncil` (con sus grants de asesor) solo lo invoca el
   **muerto** `HubScreen`. → esos grants (Inocencio +fe, doctrina `resource-per-spoke`,
   `advisorSpokeGrants`) **no corren hoy en vivo**; se borran con el path muerto, sin
   cambio de comportamiento vivo. (Re-cablearlos a Iter Belli es trabajo del follow-up
   de Consilium, fuera de alcance aquí.)
4. **`navigateTo('victory'/'defeat')` solo ocurre en `main.tsx`** al resolver la batalla
   final vieja. Iter Belli no tiene fin-de-run (decisión: sin fin-de-run por ahora).
5. **`completedSpokes`/`battlesWon`/`spokesSinceLastBattle`** se incrementan en
   `EndgameCard` (Iter Belli) — ya desacoplados del spoke; **sobreviven** como señales.

## Supervivientes (NO borrar — compartidos con Hub/Iter Belli vivos)

- Tipos de ejército: `ArmyData`, `Cohort` (`src/types`, `src/game/army/cohort.ts`),
  `computeArmySize`, helpers de HP de cohorte; `cohort-data.ts` (`COHORT_CATALOG`,
  `getCohortById`) y el tipo `Legate` — usados por el **reclutamiento del Hub** y el
  seed de Iter Belli.
- `src/game/core/resources.ts`, `src/game/province/**` (`conquerProvince`, province-store),
  `src/game/core/game-state.ts` (señales; se limpian sólo los wirings de season-tick).
- Todo `src/ui/screens/forum/**` (Hub) y `src/game/iterBelli/**` + `src/ui/screens/iterbelli/**`.
- Council/advisor/doctrine/consilium (passives que actúan en el Hub vía `strategic-store`
  income/shop-discount siguen vivos).

## Fase 1 — Desacoplar el embark del spoke

Tras esta fase **nada vivo lee `plannedSpoke`/`currentSpoke`**, habilitando la purga.

### 1a. `CampaignScenario` gana `provinceTerrain`
- `iter-belli-types.ts`: añadir `provinceTerrain: TerrainType` a `CampaignScenario`
  (import del tipo `TerrainType` de `src/data/terrain-data`).
- `SAGUNTUM` (`iter-belli-scenario-saguntum.ts`): `provinceTerrain: 'plains'`
  (equivale al default actual de `themeToTerrain(undefined)`).
- Extender `verify-iter-belli-scenario.ts`: `provinceTerrain` presente y es un terreno válido.

### 1b. Helper de duración sin spoke — `council-store.ts`
- Nuevo `plannedCampaignDuration(): number`: extrae **verbatim** el cálculo de duración
  de `generateSpokeFromCouncil` (promedio de midpoints de `durationRange` de los
  sentados → `round(clamp(2,4, avg))`; `0` sentados → `1`, igual que el fallback actual
  `spoke?.duration ?? 1`):
  ```ts
  export function plannedCampaignDuration(): number {
    const seated = councilSlots.value.filter((a): a is Advisor => a !== null);
    if (seated.length === 0) return 1;
    const avg = seated.reduce((s, a) => {
      const [min, max] = getCurrentSpokeTemplate(a).durationRange;
      return s + (min + max) / 2;
    }, 0) / seated.length;
    return Math.round(Math.min(4, Math.max(2, avg)));
  }
  ```
- `canEmbarkFromCouncil(): boolean` → `councilSlots.value.some(Boolean)` (preserva el gate
  actual: sin asesor sentado no había `plannedSpoke` y `canEmbark` era false).

### 1c. Reescribir `EmbarkCard.tsx` sin spoke
- Quitar `import { plannedSpoke } from council-store` y todo uso de `spoke`.
- `canEmbark` = `canEmbarkFromCouncil()`.
- `campaignTitle`: desde el escenario activo (p.ej. `\`Campaña — ${getActiveScenario().enemy.name}\``)
  o un título genérico; ya no `spoke.label`.
- En `handleEmbark`:
  - `spokeTerrain` → `getActiveScenario().provinceTerrain`.
  - `spokeDuration` → `plannedCampaignDuration()`.
  - resto del seed igual (army, consilium, doctrinas, embark bonus). Sin cambios en
    `startIterBelliCampaign`.
- El warning de suministros y el preview de misión/quests/doctrinas se mantienen
  (no dependen del spoke; usan `councilSlots`/`preparedArmy`).

### 1d. Verificación de Fase 1
- `tsc --noEmit` limpio · `verify-iter-belli-*` pasan.
- Grep: `plannedSpoke`/`currentSpoke` ya no aparecen en `src/ui/screens/forum/**`.
- Chrome: sentar 1 asesor → Embark sigue habilitado → campaña Iter Belli arranca con
  duración y terreno correctos.

## Fase 2 — La purga (borrado)

Borrar en bloque (con `tsc` iterando para cazar imports colgantes):

### Directorios / módulos
- `src/battle/**` (motor campal viejo completo: engine, render, systems, effects,
  deployment, casualties, progression-bridge, quick-battle-scenarios, battle-settings…).
- `src/game/campaign/**` (bellum hex completo: hex-battle, campaign-*, bellum-*,
  hex-pathfinding/scouting, movement, terrain, encounter-*).
- `src/game/progression/spoke.ts`, `spoke-effects.ts`, `season-tick.ts`,
  `landmark-*` (los exclusivos de spoke; conservar lo que use el Hub), y los demás
  `progression/*` que sólo sirven al spoke (verificar import-by-import).
- `src/game/army/enemy-army-generator.ts`, `src/game/army/morale.ts` (solo los usaba
  battle/bellum/spoke; confirmar con grep que nada vivo los importa).
- `src/ui/components/spoke/**`, `src/ui/components/bellum/**`, y HUDs de batalla
  (`ArmyDetailHUD.tsx` y similares exclusivos de batalla).
- Pantallas: `BattleScreenV2.tsx`, `PostBattleScreen.tsx`, `QuickBattleScreen.tsx`,
  `VictoryScreen.tsx`, `DefeatScreen.tsx`, `EndScreen.tsx`, `BellumSystemsScreen.tsx`,
  `CampaignHexScreen.tsx`, `HubScreen.tsx`.

### Limpiezas en archivos vivos
- `src/main.tsx`: quitar todos los imports y bloques de batalla (BattleMode, el loop
  RAF de render, `effect(currentScreen)` de enter/exit, inyecciones de navegación hex/
  defeat, resize). `main.tsx` queda solo montando la app Preact.
- `src/ui/screens.ts` / `index.ts`: quitar de `ScreenName`/`VALID_SCREENS`/`REQUIRES_RUN`
  los valores `quick-battle`, `battle`, `battleV2`, `post-battle`, `victory`, `defeat`,
  `bellum-systems`; quitar `navigateToBellum`; quitar el tab `bellum` (`forum/state.ts`,
  `ForumShell.tsx`).
- `src/ui/screens/App.tsx`: quitar imports y entradas de `SCREEN_COMPONENTS`/`BARE_SCREENS`
  de todas las pantallas borradas.
- `src/ui/screens/TitleScreen.tsx`: quitar el botón **Quick Battle** y el branch de
  resume `if (currentSpoke.value) navigateToBellum()` (queda sólo `navigateTo('forum')`).
- `src/game/core/game-state.ts`: quitar imports/wirings de `season-tick` (los setters
  `setExtraUpkeepReductionFn`/`setThreatReductionFn` y su limpieza en `resetRun`).
  Conservar señales `completedSpokes`/`battlesWon`/`spokesSinceLastBattle`/`veteranStacks`/
  `globalSeason`/`threatLevel`/`MAX_SEASONS`.
- `src/game/core/meta-save.ts`: quitar persistencia de `plannedSpoke`/`currentSpoke` y
  la función `recordRunComplete` (sin llamadores tras borrar EndScreen). Conservar el
  resto del save (resources, council, doctrinas, decreta, completedSpokes, provincias…).
- `src/game/council/council-store.ts`: borrar `generateSpokeFromCouncil`,
  `startSpokeFromCouncil`, `regeneratePlannedSpoke`, `plannedSpoke`, y las llamadas a
  `regeneratePlannedSpoke` en `seatAdvisor`/`unseatAdvisor`/`hireAndSeatAdvisor`.
  Conservar `plannedCampaignDuration`/`canEmbarkFromCouncil` (Fase 1) y los agregadores
  de passives del Hub que siguen vivos (`advisorShopDiscount`/`advisorIncomeBonus`…).
- `src/data/iter-belli-conquest.ts`: borrar `THEME_TERRAIN`/`themeToTerrain` (sin uso
  tras Fase 1c). Conservar `pickConquestName`/`CONQUEST_NAMES`/`PROVINCE_REWARD`.

### Verificación de Fase 2
- `npx tsc --noEmit` limpio (cero imports colgantes).
- `npx tsx tools/verify-iter-belli-scenario.ts` + `verify-iter-belli-{consilium,doctrines,quests}`
  + `verify-decretum-hub` + `verify-doctrine-hub` pasan.
- Grep de cero residuos en `src/`: `from './battle`, `/game/campaign/`, `plannedSpoke`,
  `currentSpoke`, `startSpokeFromCouncil`, `runSeasonTick`, `BattleMode`,
  `navigateToBellum`, `quick-battle`, `'battleV2'`.
- `git status`: solo borrados + las ediciones de limpieza listadas.
- Chrome (humo del flujo completo): Title → New Game → CommanderSelect → Forum/Hub
  (sin tab bellum, sin botón Quick Battle) → sentar asesor → Embark → campaña Iter Belli
  → batalla de dados → EndgameCard → vuelve al Hub. Abandon Run vuelve al título.

## Riesgos / bordes

- **Borrado en cascada:** muchos `progression/*` y `army/*` son ambiguos; la regla es
  borrar **import-by-import** guiado por `tsc` — si un símbolo lo usa código vivo
  (Hub/Iter Belli), se conserva. No borrar por nombre sin verificar el grafo de imports.
- **Sin fin-de-run:** consecuencia aceptada. `globalSeason` sigue avanzando y se muestra
  en el Masthead, pero llegar a `MAX_SEASONS` ya no dispara nada (no hay pantalla). El
  run se cierra con "Abandon Run".
- **Passives muertos retirados:** `upkeep-reduction`/`threat-reduction` (season-tick) y
  los spoke-grants (Inocencio/doctrina/asesor) se eliminan; no actuaban en vivo. Su
  re-cableado a Iter Belli es follow-up de Consilium, explícitamente fuera de alcance.
- **Persistencia:** quitar campos spoke del save puede invalidar saves viejos; aceptable
  (no hay usuarios). El loader debe tolerar su ausencia (ignorar claves desconocidas).
- **Orden:** Fase 1 antes que Fase 2 — desacoplar primero, borrar después. Cada commit
  deja `tsc` limpio.

## Follow-up (fuera de alcance, ya diseñado)

- **Roster de 5 escenarios** (mission→scenario): trivial tras esta purga, porque el
  embark ya toma `provinceTerrain` + enemigo del escenario activo. Spec aparte.
