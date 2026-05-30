# Doctrine Hub Revival — design

**Branch:** `worktree-experimentation`
**Fecha:** 2026-05-30
**Estado:** diseño aprobado, pendiente de implementar

## Contexto

Auditoría previa: el sistema de Doctrinae se diseñó para la batalla hex
(**deprecada**), así que **19 de 23** doctrinas tienen su efecto de Hub muerto.
Solo `income-modifier` (gold) y `upkeep-reduction` están vivos. Las 23 sí hacen
algo en la campaña Iter Belli (Fase 1, por color), pero su descripción de Hub
está mayormente muerta y la tarjeta no muestra el efecto de campaña.

Este rework (A+B+D del menú): **reescribe la data de doctrinas** para que cada
efecto sea nativo de Hub (vivo), **cablea** las superficies faltantes, y
**muestra** el efecto de campaña en la tarjeta.

## Decisiones de diseño

| Aspecto | Decisión |
|---|---|
| **Enfoque** | Reescribir `doctrine-data.ts` con efectos de Hub vivos (no capa de traducción). |
| **Efectos de combate** | Van al **ejército al embarcar** (soldiers/morale) y a economía donde no encaja. |
| **`extra-event-choices`** | Se descarta de la data (consumidor incierto) → se reprograma a `resource-per-spoke gold`. |
| **Tipos de batalla** | Salen de la data; **quedan en el union** `DoctrineEffect` para que el código de batalla deprecado siga compilando. |
| **UI (A)** | La tarjeta muestra el efecto de Hub **y** el de campaña (Fase 1 por color). |

## Vocabulario de efectos de Hub (lo que la data usará)

Pasivos persistentes mientras la doctrina está equipada. El **único tipo nuevo**
es `embark-bonus`; el resto ya existe en el union.

```ts
// game/items/doctrine.ts — añadir al union DoctrineEffect:
| { type: 'embark-bonus'; stat: 'soldiers' | 'morale' | 'supplies' | 'discipline'; amount: number }
```

| Efecto | Superficie / consumidor | Estado |
|---|---|---|
| `income-modifier {resource:'gold', multiplier}` | `resources.ts` addResource | ✅ ya vivo |
| `upkeep-reduction {percent}` | `season-tick` | ✅ ya vivo |
| `resource-per-spoke {resource:'gold'\|'iuniores', amount}` | `council-store` (spoke start) | ✅ ya vivo |
| `shop-discount {percent}` | **NUEVO wiring**: compras del Hub | a cablear |
| `embark-bonus {stat, amount}` | **NUEVO**: seed de Iter Belli al embarcar | a crear |

La data usa solo estos 5. `extra-event-choices` y los tipos de batalla
(stat-modifier/heal-on-kill/revive/heal-battle-start/free-units/ally-units) ya
**no aparecen** en `doctrine-data.ts`.

## Regla de mapeo (efecto viejo → nuevo) + constantes

```
SOLDIER_PER_PCT  = 4000   // un +X% de maxHp/armor/damage → +round(X * 4000) soldiers
SOLDIER_PER_UNIT = 400    // free-units / ally-units: +count * 400 soldiers
SPOKE_GOLD_SCALE = 5      // resource-per-spoke influence/faith (n) → gold n*5
```

| Efecto viejo | → Nuevo |
|---|---|
| `stat-modifier maxHp/armor/damage` (pct) | `embark-bonus soldiers` (+round(pct·4000)) |
| `free-units` / `ally-units` (count) | `embark-bonus soldiers` (+count·400) |
| `heal-on-kill` / `heal-battle-start` / `revive` | `embark-bonus morale` (+1/+2/+3 por nivel I/II/III) |
| `resource-per-spoke influence/faith` (n) | `resource-per-spoke gold` (n·5) |
| `extra-event-choices` (count) | `resource-per-spoke gold` (count·5) |
| `shop-discount` | se mantiene (ahora cableado) |
| `income-modifier` / `upkeep-reduction` | se mantienen |

`morale` se clampa a `MORALE_MAX`; `soldiers` se suma a los del seed.

## Re-mapeo completo de las 23 (nivel I / II / III)

**🔴 Red (Military) → ejército más grande al embarcar**
- Sword (dmg 5/10/15%) → `embark soldiers` +200 / +400 / +600
- Iron (armor 10/20/30%) → `embark soldiers` +400 / +800 / +1200
- Blood (heal-on-kill) → `embark morale` +1 / +2 / +3
- Lex Militaris (free vanguard 1/2/3) → `embark soldiers` +400 / +800 / +1200
- Vis Bellica (armor + heal + dmg) → `embark soldiers` +200/+400/+600 **y** `embark morale` +1/+1/+2

**🔵 Blue (Diplomatic) → economía/spoke + tienda**
- Diplomacy (influence/spoke) → `resource-per-spoke gold` 5 / 10 / 15
- Court (extra-event-choices) → `resource-per-spoke gold` 5 / 10 / 15
- Alliances (ally-units) → `embark soldiers` +400 / +800 / +1200
- Pax Romana (influence + shop) → `resource-per-spoke gold` 5/10/15 **y** `shop-discount` 5/10/15%
- Foedus Aeternum (ally + income) → `embark soldiers` +400/+800/+1200 **y** `income-modifier gold` 15/25/40%

**🟡 Gold (Religious) → moral al embarcar + oro/spoke**
- Faith (faith/spoke) → `resource-per-spoke gold` 5 / 10 / 15
- Miracles (heal-battle-start) → `embark morale` +1 / +2 / +3
- Pantheon (revive) → `embark morale` +1 / +2 / +3
- Divina Providentia (faith + revive) → `resource-per-spoke gold` 5/10/15 **y** `embark morale` +1/+2/+3

**🟣 Purple (Economic) → ya vivo (sin cambios de tipo)**
- Trade → `income-modifier gold` 15/30/50% *(igual)*
- Infrastructure → `upkeep-reduction` 10/20/30% *(igual)*
- Market → `shop-discount` 10/20/30% *(igual; ahora cableado)*
- Annona → `income-modifier gold` 15/30/50% **y** `upkeep-reduction` 10/20/30% *(igual)*

**⚪ White (Populist) → soldados/moral al embarcar**
- People (maxHp 10/20/30%) → `embark soldiers` +400 / +800 / +1200
- Militia (free guard 1/2/3) → `embark soldiers` +400 / +800 / +1200
- Resilience (maxHp + heal) → `embark soldiers` +200/+400/+600 **y** `embark morale` +1/+2/+3
- Virtus Populi (maxHp + free reserve) → `embark soldiers` +800 / +1600 / +2400
- Concordia (heal + events) → `embark morale` +1/+2/+3 **y** `resource-per-spoke gold` 5/10/15

Las `description` de cada nivel se reescriben para reflejar el efecto nuevo (en
inglés, como el resto del archivo). Los `upgradeCost` se conservan tal cual.

## Arquitectura / wiring

### `src/game/items/doctrine.ts`
- Añadir `embark-bonus` al union `DoctrineEffect` (los tipos de batalla quedan).

### `src/data/doctrine-data.ts`
- Reescribir los `effects` (y `description`) de las 23 según la tabla. `color`,
  `id`, `name`, `currentLevel`, `upgradeCost` sin cambios.

### `src/game/items/doctrine-store.ts`
- `getShopDiscount(): number` — suma de `shop-discount` de las equipadas (vía
  `getActiveEffects()`), clamp 0–75.
- `getEmbarkBonus(): { soldiers; morale; supplies; discipline }` — suma de
  `embark-bonus` por stat de las equipadas. *(O exportar un selector que use
  getActiveEffects; mismo patrón que `getIncomeModifier`.)*

### Cableado de `shop-discount` (compras del Hub)
- `src/game/progression/strategic-store.ts`: en `buySupplies`, reclutar cohorte
  (`aurumCost`) y la otra compra de gold, aplicar el descuento:
  `cost = Math.round(baseCost * (1 - getShopDiscount()/100))` antes de
  `spendResource('gold', cost)`.
- Contratar asesor (donde se gasta `advisor.cost`): mismo descuento.
  *(Identificar los sitios exactos en el plan; aplicar un helper común.)*

### Cableado de `embark-bonus` (seed de campaña)
- `src/data/iter-belli-doctrines.ts` o un nuevo módulo bridge:
  `computeDoctrineEmbarkBonus(equipped): { soldiers; morale; supplies; discipline }`.
- `EmbarkCard.tsx`: sumar al seed de `startIterBelliCampaign` —
  `soldiers += bonus.soldiers`, `startMorale += bonus.morale`,
  `supplies += bonus.supplies`, `discipline += bonus.discipline` (clamp 1–5).
  Es un canal **separado** de los `DoctrineCampaignModifier` de Fase 1 (que son
  hooks de cartas), análogo a `computeConsiliumSetup`.

### UI (A) — `DoctrinaeTab.tsx` / `DoctrineRenderer.tsx`
- Añadir un case `embark-bonus` al renderer de efectos (texto: p.ej. "+400
  soldiers on campaign start").
- En la tarjeta/detalle de doctrina, además del efecto de Hub, mostrar su
  **efecto de campaña** (derivado del color vía un helper que describa la
  conducta de Fase 1: rojo→Coerción +enemyWeaken, etc.). Un mapa color→texto.

## Riesgos / bordes
- **Batalla deprecada:** los tipos de batalla quedan en el union solo para que
  `battle/effects/doctrine-effects.ts` compile; la data ya no los usa. No se
  toca el código de batalla.
- **embark-bonus solo aplica a Iter Belli:** si no hay `preparedArmy`/embark, no
  hace nada (es un seed de campaña). Aceptado.
- **shop-discount clamp:** sumar varias doctrinas no debe pasar de un máximo
  razonable (clamp 75%).
- **resource-per-spoke gold** ya está cableado; solo cambian los valores/recurso
  (de influence/faith deprecados a gold).
- **Descripciones:** deben coincidir con el efecto real (la queja original fue
  descripciones que mentían). Verificar que cada `description` refleje su
  `effects`.

## Verificación
- **`tools/verify-doctrine-hub.ts`** (`npx tsx`):
  - `getShopDiscount` suma + clamp; `getEmbarkBonus`/`computeDoctrineEmbarkBonus`
    suma por stat de un set de doctrinas equipadas.
  - shop-discount reduce el costo en `buySupplies`/reclutar (gold gastado menor).
  - embark-bonus llega al seed: con doctrinas equipadas, el `startIterBelliCampaign`
    arranca con +soldiers/+morale esperados.
  - cada doctrina de `STARTER_DOCTRINES` usa solo tipos del vocabulario vivo
    (sin stat-modifier/heal/revive/free-units/ally-units/extra-event-choices en
    su data) — guard contra regresión de "efecto muerto".
- `tsc --noEmit` limpio.
- Regresión: `verify-iter-belli-doctrines/quests/consilium` + `verify-decretum-hub` pasan.
- Chrome: equipar doctrinas, ver descripciones reales + efecto de campaña en la
  tarjeta; comprar con descuento; embarcar y ver el bonus de ejército/moral.
