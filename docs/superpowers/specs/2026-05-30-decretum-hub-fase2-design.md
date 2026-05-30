# Hilo 4 · Fase 2 — Decreta consumibles (Hub)

**Branch:** `worktree-experimentation`
**Fecha:** 2026-05-30
**Estado:** diseño aprobado, pendiente de implementar

## Contexto

Los **Decreta** son una mano de pergaminos consumibles (`decretumHand`, máx 5 vía
`maxHandSize`) en `src/game/items/decretum-store.ts`. Hoy se lanzaban en la
batalla hex — **deprecada** (solo Hub + Iter Belli están vivos), así que el
casteo actual está muerto.

Esta fase les da un hogar vivo: se **lanzan desde el Hub** (pestaña Decreta) por
un **efecto de Hub** instantáneo o continuo. **No entran a Iter Belli.** Es un
mecanismo de Hub puro (no toca el módulo de campaña).

Decisión de contenido: **set chico de efectos-Hub vivos**. Solo los Decreta cuyo
efecto traduce bien al Hub son casteables; el resto queda **inerte** (no
casteable en Hub, etiquetado en la UI).

## Decisiones de diseño

| Aspecto | Decisión |
|---|---|
| **Dónde** | Se lanzan desde el Hub (DecretaTab). No entran a la campaña. |
| **Efecto** | Instantáneo (boon inmediato) o continuo por N temporadas (tickea en el reloj). |
| **Contenido** | Set chico vivo (4 kinds); Decreta sin efecto-Hub quedan inertes. |
| **Consumo** | Single-use: al lanzar se aplica y se remueve de la mano. Respeta faction-lock y `castCost`. |

## Hechos verificados contra los datos (`decretum-data.ts`, `decretum.ts`)

- `DecretumEffect.heal.amount` es **fracción de HP máx** (0.3 / 0.2 / 0.25 / 1.0).
- `resource-gain` vivos (gold): merchant(5), tax(3), aerarium(4), cursus(10).
  Deprecados (influence/momentum/faith): senate, foedus, pietas → inertes.
- `upkeep-reduction {seasons}`: supply(1), annona(2). (Es un waive total, no un
  porcentaje — el tipo no lleva `percent`.)
- `spawn`: legion(vanguard×2), mob(guard×3), vanguard(vanguard×1), plebs(guard×2).
- **Ningún decretum usa `investment-discount` como efecto primario** (cursus lo
  lleva en `extraEffects`) → `shop-discount` se descarta del set vivo (YAGNI);
  cursus vive por su grant de oro. Los `extraEffects` se ignoran en esta fase.
- **Ningún decretum vivo tiene `castCost`** (los castCost están en inertes y son
  de recursos deprecados). El gate respeta `castCost` igual, defensivamente.
- Resto (buff/debuff/damage/reveal/prevent-death/convert-enemy/event-modifier) →
  inertes.

## El set chico de efectos-Hub vivos

`toHubEffect(decretum): HubDecretumEffect | null` — switch por `effect.type`;
null = inerte.

```ts
type HubDecretumEffect =
  | { kind: 'grant'; resource: ResourceType; amount: number }   // instant
  | { kind: 'heal-army'; fraction: number; target: 'all' | 'single' } // instant
  | { kind: 'recruit'; iuniores: number }                       // instant
  | { kind: 'waive-upkeep'; seasons: number };                  // continuo
```

| Efecto Decretum | → HubDecretumEffect | Clase |
|---|---|---|
| `resource-gain` con resource ∈ {gold, iuniores} | `{ kind:'grant', resource, amount }` | instant |
| `resource-gain` con resource deprecado | `null` (inerte) | — |
| `heal {amount, target}` | `{ kind:'heal-army', fraction: amount, target }` | instant |
| `spawn {count}` | `{ kind:'recruit', iuniores: count * RECRUIT_IUNIORES_PER_UNIT }` | instant |
| `upkeep-reduction {seasons}` | `{ kind:'waive-upkeep', seasons }` | continuo |
| cualquier otro | `null` (inerte) | — |

Constante propuesta: `RECRUIT_IUNIORES_PER_UNIT = 250` (vanguard×2 → 500, guard×3
→ 750). Ajustable.

Vivos resultantes: 4 grants de oro + 4 heals + 4 spawns + 2 upkeep = **14
casteables**; 16 inertes. Único continuo de la fase: `waive-upkeep`.

## Aplicación de cada kind

- **grant:** `addResource(resource, amount)` (gold/iuniores; respeta los
  multiplicadores existentes de `addResource`). Instantáneo.
- **heal-army:** sobre `preparedArmy.value`. `target:'all'` → cada cohorte
  `currentHp = min(stats.hp, (currentHp ?? stats.hp) + round(fraction*stats.hp))`.
  `target:'single'` → sana la cohorte más dañada por `round(fraction*stats.hp)`
  (fraction 1.0 = a tope). Re-sincronizar `size` vía `computeArmySize`. Sin
  `preparedArmy` o sin cohortes → no-op (el pergamino igual se consume).
- **recruit:** `addResource('iuniores', iuniores)`. Instantáneo.
- **waive-upkeep:** push a `activeDecretumEffects` con `remainingSeasons = seasons`.
  Mientras haya ≥1 activo, el `season-tick` no cobra upkeep esa temporada.

## Arquitectura (Hub puro — no toca Iter Belli)

### Nuevo: `src/game/items/decretum-hub.ts`

Para evitar un ciclo de imports (store ↔ hub), el signal de efectos activos y sus
tipos viven aquí (el hub importa `removeDecretum`/`decretumHand` del store, una
sola dirección).

- `HubDecretumEffect` (union de arriba).
- `interface ActiveDecretumEffect { decretumId: string; name: string; effect: HubDecretumEffect; remainingSeasons: number }`
- `export const activeDecretumEffects = signal<ActiveDecretumEffect[]>([]);`
- `RECRUIT_IUNIORES_PER_UNIT = 250`.
- `toHubEffect(d: Decretum): HubDecretumEffect | null`.
- `isCastableAtHub(d: Decretum, faction: Faction | null): boolean` —
  `faction != null && isDecretumCastable(d, faction) && toHubEffect(d) != null &&`
  afford de `castCost` (vía `canAfford`).
- `castDecretumAtHub(id: string): boolean` — busca en `decretumHand`; valida
  `isCastableAtHub`; gasta `castCost` (`spendResource`); aplica el efecto
  (instant → directo; continuo → push a `activeDecretumEffects`); `removeDecretum(id)`;
  retorna true. (Refleja `castDecretum` pero aplicando el efecto-Hub.)
- `isUpkeepWaived(): boolean` — `activeDecretumEffects.value.some(a => a.effect.kind === 'waive-upkeep')`.
- `tickActiveDecretumEffects(): void` — `remainingSeasons--` y filtrar ≤ 0.

### Extender: `src/game/progression/season-tick.ts`

En `runSeasonTick`, donde hoy se lee la reducción de upkeep de doctrinas:
- Si `isUpkeepWaived()` → `reductionMultiplier = 0` (upkeep 0 esa temporada),
  combinándose con la reducción porcentual de doctrinas (el waive gana).
- Al final del tick (tras incrementar `globalSeason`), llamar
  `tickActiveDecretumEffects()` exactamente una vez.

### Extender: `src/ui/screens/forum/tabs/DecretaTab.tsx`

- En el detalle del pergamino, botón **"Lanzar"** habilitado si
  `isCastableAtHub(d, faction)`; al hacer click → `castDecretumAtHub(d.id)` + sfx.
  Muestra una línea de qué hará (derivada de `toHubEffect`). Si es inerte, en vez
  del botón un texto "Sin efecto de Hub".
- Lista de **efectos continuos activos** (`activeDecretumEffects.value`) con
  nombre + temporadas restantes (arriba del grid o en el panel).
- Actualizar el hint actual ("se lanzan en batalla …") a "se lanzan desde el Hub".
- `DecretaPanel.tsx` (sidebar): badge opcional con el conteo de activos.

## Riesgos / bordes

- **heal sin ejército:** `castDecretumAtHub` de un heal sin `preparedArmy` es
  no-op pero consume el pergamino. Aceptado (la UI puede atenuar el botón si no
  hay ejército; opcional). Para evitar gasto inútil, `isCastableAtHub` **no**
  chequea ejército — mantener el gate simple; la decisión de gastar es del jugador.
- **waive-upkeep apilado:** dos waive activos no se "suman" (el upkeep ya es 0);
  ambos decrementan en paralelo. Intencional.
- **season-tick llamado en varios contextos:** el decremento va dentro de
  `runSeasonTick` (que incrementa `globalSeason` una vez por temporada), así que
  ocurre exactamente una vez por avance de temporada.
- **castCost en recursos deprecados:** ningún decretum vivo tiene castCost; el
  gate lo respeta igual (afford check) sin efecto práctico en esta fase.
- **extraEffects ignorados:** solo se mapea el efecto primario (cursus pierde su
  descuento extra pero vive por el grant de oro). Deferido.
- **Sin ciclo de imports:** tipos + signal de activos en `decretum-hub.ts`;
  importa del store en una sola dirección; `season-tick` y la UI importan del hub.

## Verificación

- **`tools/verify-decretum-hub.ts`** (`npx tsx`):
  - `toHubEffect`: gold/iuniores resource-gain → grant; influence/momentum/faith →
    null; heal → heal-army (fraction = amount, target); spawn → recruit
    (count×250); upkeep-reduction → waive-upkeep (seasons); buff/damage/reveal/
    prevent-death/convert/event-modifier → null.
  - `castDecretumAtHub`: grant aplica +recurso y remueve de mano; recruit +iuniores;
    heal-army sana cohortes de un `preparedArmy` de prueba; waive-upkeep hace push
    a `activeDecretumEffects` (remainingSeasons = seasons) y remueve de mano;
    inerte → false, mano intacta; faction-lock respetado (commander de color
    incompatible → false).
  - `isUpkeepWaived` + `tickActiveDecretumEffects`: con un waive activo →
    `isUpkeepWaived()` true; tras N ticks expira y queda false; el array filtra
    expirados.
  - (Si es práctico) un `runSeasonTick` con un waive activo no cobra upkeep
    (gold sin cambios por upkeep) vs. sin waive sí cobra.
- **`tsc --noEmit`** limpio.
- **Regresión:** `verify-iter-belli-doctrines.ts`, `verify-iter-belli-quests.ts`,
  `verify-iter-belli-consilium.ts` siguen pasando.
- **Chrome (Playwright):** con un Decretum vivo en la mano, la pestaña Decreta
  muestra "Lanzar"; lanzarlo aplica el boon (oro/iuniores/heal) y lo saca de la
  mano; un waive-upkeep aparece en la lista de activos con temporadas restantes.
