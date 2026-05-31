# Consilium Hub Integration + Passive Revival — design

**Branch:** `worktree-experimentation`
**Fecha:** 2026-05-31
**Estado:** diseño aprobado, pendiente de implementar

## Contexto

Auditoría: los passives de los asesores del Consilium se consumen **solo al
embarcar** (`computeConsiliumSetup` → `passiveModifier` → deltas del seed de
campaña, Fase 1), **solo en los asientos no-misión**, y **no afectan el Hub**.
Además hay mapeos muertos: `extra-event-choices` y `resource-per-spoke` de
recursos deprecados (faith/influence/momentum) → nada; `shop-discount` → un proxy
raro a oro (no descuenta nada).

Este rework (A+B+C, paralelo al de las doctrinas): **revive** los passives
muertos, los **integra al Hub** (un asesor sentado afecta el Hub como una
doctrina equipada), y **muestra el efecto real** en la pestaña Consilium. El
canal de seed de campaña (Fase 1) **se mantiene** (decisión "ambos").

## Decisiones de diseño

| Aspecto | Decisión |
|---|---|
| **Doble canal** | Un passive de asesor sentado actúa en el **Hub** (persistente) **y** siembra la **campaña** al embarcar. |
| **Hub: qué asientos** | Todos los asientos ocupados aportan al Hub (incluido el de misión). |
| **Seed: qué asientos** | Solo los no-misión (regla Fase 1 sin cambios). |
| **Revivir** | Cero passives muertos: deprecado→gold, extra-event-choices→gold, shop-discount deja de ser proxy. |
| **Sin ciclos de imports** | Agregadores de advisor en `council-store`; donde un import directo cicla (strategic-store), se usa el patrón de inyección ya existente (`setIncomeModifierFn`). |

## Mapeo por passive — Hub (B) + seed de campaña (A, revivido)

| Passive | Efecto de Hub (nuevo) | Seed de campaña |
|---|---|---|
| `upkeep-reduction {%}` | −% upkeep de temporada (season-tick) | +supplies *(igual)* |
| `shop-discount {%}` | **−% precios del Hub** (se suma al descuento total) | — *(se elimina el proxy a oro)* |
| `loot-bonus {%}` | +% income de oro (income-modifier) | +oro *(igual)* |
| `resource-per-spoke {res,n}` | +n por spoke (gold/iuniores); deprecado→gold | +oro seed (gold/iuniores; deprecado→gold) |
| `threat-reduction {n}` | −n al crecimiento de amenaza por temporada (floor 0) | −amenaza seed *(igual)* |
| `heal-between-nodes {n}` | — (sin hogar de Hub; nodes deprecados) | +moral seed *(igual)* |
| `extra-event-choices {n}` | **revivido** → +n·5 oro por spoke | +n·5 oro seed (revivido) |

Constante: `EVENT_CHOICE_GOLD = 5` (oro por "choice"). `resource-per-spoke`
deprecado se trata como gold de igual `amount`.

## Arquitectura

### Nuevo: agregadores de passive en `src/game/council/council-store.ts`
Leen `councilSlots` (asesores sentados) + `getCurrentPassive`. (council-store ya
importa `getShopDiscount` de doctrine-store; no introduce ciclos.)
- `advisorShopDiscount(): number` — suma de `shop-discount` de los sentados, clamp 0–75 combinado con el de doctrinas en el consumidor.
- `advisorUpkeepReduction(): number` — suma de `upkeep-reduction` %.
- `advisorIncomeBonus(resource): number` — `loot-bonus` % (gold) + `resource-per-spoke` de ese recurso, como fracción aditiva.
- `advisorThreatReduction(): number` — suma de `threat-reduction`.
- `advisorSpokeGrants(): { resource: ResourceType; amount: number }[]` — `resource-per-spoke` (deprecado→gold) + `extra-event-choices`→gold (n·5), para el grant de spoke.

### Combinar en los consumidores del Hub (sin ciclos)
- **Income (loot-bonus + resource-per-spoke gold):** vía el setter existente. En `game-state.ts`, `setIncomeModifierFn` pasa a `(res) => getIncomeModifier(res) + advisorIncomeBonus(res)`. (game-state importa ambos.)
- **Spoke grants:** el loop de spoke-start en council-store (que hoy recorre `getActiveEffects()` para `resource-per-spoke` de doctrinas) suma además `advisorSpokeGrants()`. (mismo archivo, directo.)
- **Advisor hire shop-discount:** `getAdvisorCost`/`getDiscountedAdvisorCost` usan `getShopDiscount() + advisorShopDiscount()` (ambos disponibles en council-store).
- **buySupplies / recruit shop-discount (strategic-store):** strategic-store NO puede importar council-store (council→strategic ya existe). Se añade un setter `setExtraShopDiscountFn(fn)` en strategic-store (default `() => 0`); `discountedGold` usa `getShopDiscount() + extraShopDiscountFn()`. `game-state` lo cablea a `advisorShopDiscount`. (mismo patrón que `setIncomeModifierFn`.)
- **season-tick upkeep + threat:** season-tick añade setters `setExtraUpkeepReductionFn` y `setThreatReductionFn` (default `() => 0`), cableados por game-state a `advisorUpkeepReduction`/`advisorThreatReduction`. El upkeep total = doctrina% + advisor% (clamp). El threat de temporada = `max(0, THREAT_PER_SEASON − advisorThreatReduction())`. (inyección para evitar el ciclo season-tick↔council.)

(Todos los setters se cablean en `initializeRunScaffold` junto a `setIncomeModifierFn` y se limpian en `resetRun` como ya se hace con `setIncomeModifierFn(null)`.)

### `src/data/iter-belli-consilium.ts` — `passiveModifier` revivido
- `extra-event-choices` → `{ ...z, gold: passive.count * EVENT_CHOICE_GOLD }`.
- `resource-per-spoke` → `gold: passive.amount` para cualquier recurso (deprecado→gold), no solo gold.
- `shop-discount` → ya no aporta al seed (se quita del case loot/shop; loot-bonus sigue dando gold).

### UI (C) — `ConsiliumTab.tsx`
- `describePassive` / `heroLine` muestran el efecto real (Hub + campaña) en vez de la descripción genérica del passive. Un helper por tipo que arme el texto a partir del mapeo de arriba (p.ej. shop-discount → "−10% precios del Hub", resource-per-spoke faith → "+2 oro por spoke", extra-event-choices → "+5 oro por spoke").

## Riesgos / bordes
- **Sin ciclos:** agregadores en council-store; income/shop/upkeep/threat hacia strategic-store y season-tick vía setters cableados en game-state (patrón existente). Verificar que ningún setter quede sin cablear (default 0 = comportamiento previo).
- **Doble conteo:** Hub y seed son canales distintos (Hub mientras sentado; seed al embarcar) — intencional ("ambos"), no es doble conteo del mismo efecto.
- **shop-discount total clamp:** doctrina + advisor sumados, clamp 0–75 en el punto de consumo.
- **Reset:** todos los setters nuevos se limpian en `resetRun` (como `setIncomeModifierFn(null)`).
- **heal-between-nodes:** sin efecto de Hub (solo seed moral); intencional, no es un muerto (sigue dando moral al embarcar).
- **threat floor:** el threat de temporada no baja de 0 aunque la reducción de asesores exceda THREAT_PER_SEASON.

## Verificación
- **`tools/verify-consilium-hub.ts`** (`npx tsx`):
  - Agregadores: `advisorShopDiscount`/`advisorUpkeepReduction`/`advisorIncomeBonus`/`advisorThreatReduction`/`advisorSpokeGrants` suman bien sobre un councilSlots de prueba.
  - `passiveModifier` revivido: extra-event-choices → gold>0; resource-per-spoke faith/influence → gold>0; shop-discount → sin gold de proxy (no aporta seed).
  - Integración: con un asesor de shop-discount sentado, el descuento total (doctrina+advisor) baja un precio del Hub; con upkeep-reduction, el season-tick cobra menos; con threat-reduction, el threat de temporada sube menos; income-modifier combinado incluye loot-bonus.
  - Cero passives muertos: ningún tipo de `AdvisorPassive` produce efecto nulo salvo heal-between-nodes-en-Hub (intencional).
- `tsc --noEmit` limpio.
- Regresión: `verify-doctrine-hub` + `verify-iter-belli-consilium/doctrines/quests` + `verify-decretum-hub` pasan.
- Chrome: sentar asesores → ver descripciones reales en Consilium; comprar con descuento; season-tick con menos upkeep/threat; embark con el seed revivido.
