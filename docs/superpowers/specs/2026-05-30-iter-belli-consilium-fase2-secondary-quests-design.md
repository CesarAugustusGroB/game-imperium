# Hilo 3 · Fase 2 — Eventos secundarios del Consilium

**Branch:** `worktree-experimentation`
**Fecha:** 2026-05-30
**Estado:** diseño aprobado, pendiente de implementar

## Contexto

La Fase 1 (ya hecha) usa el Consilium para moldear la campaña Iter Belli:
el **1.er asiento ocupado** fija la **misión** (por color) con una condición
medible y bonus de oro al endgame; los **asientos siguientes** aportan
**modificadores** de stats iniciales (su `passive` → supplies/oro/amenaza/moral).

La Fase 2 añade, sobre los mismos asientos no-misión, **objetivos secundarios
a mitad de campaña**: mini-quests con ventana de turnos que el jugador cumple
jugando una carta-quest dedicada que aparece al llegar a una ubicación.

Este spec respeta el desacople de Fase 1: la lógica de campaña
(`src/game/iterBelli/`) no importa estado del run ni tipos de advisor; el bridge
advisor-aware vive en `src/data/iter-belli-consilium.ts` y se invoca desde
`EmbarkCard`.

## Decisiones de diseño

| Aspecto | Decisión |
|---|---|
| **Origen** | El 1.er asiento ocupado = misión (Fase 1). Cada asiento siguiente ocupado siembra una mini-quest, además de su modificador de stats de Fase 1. |
| **Forma** | Mini-quest con ventana de turnos, cumplida **jugando una carta-quest dedicada**. La carta *es* la quest. |
| **Disparo** | La carta aparece al **llegar a su ubicación** asignada (reusa el gating por `locations`). |
| **Color** | Determina **tema + recompensa (fija)** de la quest. |
| **Passive** | Modula la **ventana** de turnos (asesor más fuerte → más margen). El passive sigue dando además su modificador de stats de Fase 1; doble función, sin conflicto. |
| **Ubicación** | Aleatoria entre las 3 del medio (Tarraco / Llanura / Bosques), sin repetir entre quests. |
| **Al fallar (expira)** | Penalti **temático por color**. |

## Las 5 quests por color (valores propuestos)

| Color | Quest | Costo | Recompensa (al jugar) | Penalti (al expirar) |
|---|---|---|---|---|
| red | Asalto al fuerte | `time 1, supplies 4` | `+35 oro, enemyWeaken +1` | `amenaza +2` |
| blue | Pacifica la tribu | `gold 20` | `amenaza −3` | `amenaza +2` |
| gold | Rito de campaña | `time 1` | `moral +2` | `moral −2` |
| purple | Saquea la caravana | `time 1` | `+50 oro` | `moral −1, amenaza +1` |
| white | Recluta auxiliares | `gold 25` | `soldados +800` | `moral −2` |

**Ventana** = `QUEST_WINDOW_BASE (3)` + `(advisor.currentTier − 1)` → **3 / 4 / 5** turnos.

Los valores son afinables; el balance fino se valida en navegador, no en este spec.

## Ciclo de vida

```
Embark: asigna color · ubicación · ventana   (computeSecondaryQuests)
   → status 'pending'                          (guardado en S.quests al startear)
   → llegas a la ubicación → inyecta carta     (injectLocationQuests)
   → status 'active' (timer = ventana)
   → jugar la carta  → status 'completed'      (recompensa = effects de la carta)
   / expira la carta → status 'failed' + penalti temático
```

- La **recompensa** son los `effects` de la carta; el **costo**, su `cost`.
  Reusa el flujo `playCard` / `applyEffects` tal cual — cero sistema nuevo.
- La **ventana** es el `expiry` de la carta.
- El **penalti** reusa el path de `penalty()` ya existente para `compromiso`,
  desviado a tracking de quest: marca `failed` y aplica el penalti, pero **no**
  incrementa `brokenCommitments` (las quests se trackean aparte).

## Arquitectura

### Nuevo: `src/data/iter-belli-quests.ts` (data pura, sin advisor/run)

- `type QuestColor = 'red' | 'blue' | 'gold' | 'purple' | 'white'`
- `interface SecondaryQuestDef { color, title, desc, cost, effects, penalty }`
  donde `effects: (ctx) => CardEffects` (recompensa) y
  `penalty: (ctx) => PenaltyResult` (fallo), mismas firmas que `OperationCard`.
- `SECONDARY_QUESTS: Record<QuestColor, SecondaryQuestDef>` — las 5 de la tabla.
- `makeQuestCard(quest: SecondaryQuest): OperationCard` — fábrica que construye
  la carta a partir de la asignación: `id` único, `questId = quest.id`,
  `locations: [quest.locationId]`, `expiry: quest.window`, `effects`/`penalty`/
  `cost` del def por color. La importa el módulo de estado.

### Extender: `src/data/iter-belli-consilium.ts` (bridge advisor-aware)

- `computeSecondaryQuests(slots: (Advisor | null)[]): SecondaryQuest[]`
  - Recorre `slots`; salta el **1.er asiento ocupado** (es la misión, igual que
    `computeConsiliumSetup`).
  - Por cada asiento ocupado siguiente: `color = advisor.color`,
    `window = QUEST_WINDOW_BASE + (advisor.currentTier − 1)`,
    `title` del def por color.
  - Asigna a cada quest una `locationId` **aleatoria** de
    `['tarraco', 'llanura', 'bosques']`, **sin repetir** entre quests.
  - `id` único y estable por asignación (p.ej. `quest_${color}_${seatIdx}`).
  - `status: 'pending'`.

### Extender: `src/game/iterBelli/iter-belli-types.ts`

- `type QuestStatus = 'pending' | 'active' | 'completed' | 'failed'`
- `interface SecondaryQuest { id: string; color: string; title: string;
  locationId: string; window: number; status: QuestStatus }`
  (`color: string` para no importar `Faction` en el módulo de tipos de campaña.)
- `IterBelliState`: añadir `quests: SecondaryQuest[]`.
- `CampaignSeed`: añadir `quests?: SecondaryQuest[]`.
- `OperationCard`: añadir `questId?: string`.

### Extender: `src/game/iterBelli/iter-belli-state.ts`

- `freshState()`: `quests: []`.
- `startIterBelliCampaign(seed)`: `S.quests = seed.quests ?? []` (todas
  `pending`); llamar `injectLocationQuests()` tras `refillPool()` por si la
  ubicación inicial coincidiera (no debería, pero es defensivo).
- `injectLocationQuests()` — estilo `injectCrises`: por cada quest `pending`
  cuya `locationId === currentLocation().id`, `unshift` de `makeQuestCard(quest)`
  como `CardInstance` (timer = `window`) y marca la quest `'active'`. Idempotente
  (solo dispara sobre `pending`). Llamada en `endTurn` (tras `refillPool`).
- `playCard`: tras aplicar efectos, si `def.questId`, marcar esa quest
  `'completed'`.
- `endTurn` (loop de expiración): si una carta expirada tiene `questId`, marcar
  la quest `'failed'`, aplicar su `penalty()` (efectos + log), y **no** tocar
  `brokenCommitments`. Las cartas-quest no son `compromiso`, así que el branch
  de compromiso existente no las captura; se añade un branch dedicado.

### Extender: `src/data/iter-belli-balance.ts`

- `export const QUEST_WINDOW_BASE = 3;`

### Extender: UI

- `EmbarkCard.tsx`: computar `computeSecondaryQuests(councilSlots.value)` y
  pasarlo por el seed (`quests`), junto al mission/modifiers de Fase 1.
- `IterBelliScreen.tsx`: bajo la línea de misión, listar las quests `active`
  (título + turnos restantes, derivados del `timer` de su carta en el pool).
- `EndgameCard.tsx`: listar cada quest con su estado final (cumplida / fallida /
  no activada), en línea con cómo muestra hoy la misión.

## Riesgos / bordes

- **Auto-advance:** una carta con efecto `advance` salta de ubicación dentro del
  mismo turno; `injectLocationQuests` corre en `endTurn` tras el avance, así que
  la quest de la nueva ubicación se inyecta ese turno. Correcto.
- **Sagunto:** `refillPool` vacía el pool a solo `asalto_decisivo` en Sagunto.
  Las quests viven en ubicaciones medias, nunca en Sagunto → sin colisión.
- **Quest nunca activada:** si la campaña termina antes de llegar a la ubicación,
  la quest queda `pending` → endgame la muestra como "no activada". Aceptado.
- **De-dup del pool:** `refillPool` de-duplica por `def.id`; los ids de
  carta-quest son únicos → no se descartan ni se redibujan.
- **Slot de pool:** la carta-quest cuenta como no-Crisis y ocupa un hueco del
  `POOL_TARGET_SIZE`; el refill dibuja una carta normal menos mientras está
  activa. Aceptado (refuerza la presión de decisión).

## Verificación

- **`tools/verify-iter-belli-quests.ts`** (`npx tsx`):
  - `computeSecondaryQuests`: salta el asiento de misión; asigna color→quest
    correcto; ventana por tier (3/4/5); ubicaciones medias sin repetir.
  - Jugar la carta-quest → quest `completed` + efectos de recompensa aplicados.
  - Expirar la carta-quest → quest `failed` + penalti temático aplicado +
    `brokenCommitments` **sin** cambios.
  - `injectLocationQuests` solo dispara al coincidir la ubicación, una sola vez.
- **`tsc --noEmit`** limpio.
- **Chrome (Playwright):** la carta aparece al llegar a su ubicación; se cumple
  jugándola y falla dejándola expirar; el endgame refleja el estado.
