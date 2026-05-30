# Hilo 4 · Fase 1 — Doctrinae → cartas de campaña

**Branch:** `worktree-experimentation`
**Fecha:** 2026-05-30
**Estado:** diseño aprobado, pendiente de implementar

## Contexto

El Hub tiene un sistema de **Doctrinae**: hasta 4 doctrinas **equipadas**
(`equippedDoctrines` en `src/game/items/doctrine-store.ts`), cada una con 3
niveles (I/II/III, `currentLevel`), color-locked. Sus efectos actuales aplican a
la batalla hex y a la economía estratégica del Hub, pero **nada fluye hoy a la
campaña Iter Belli**.

Este hilo conecta las doctrinas equipadas con la campaña: cada doctrina
**modifica** el pool de cartas / la marcha según su **color**. No inyecta cartas
nuevas (eso fue la decisión de diseño). El motor expone **hooks** para que una
doctrina pueda interactuar con la campaña de cualquier manera; esta fase entrega
una **conducta insignia por color (5)**, con la arquitectura lista para conductas
por-doctrina a futuro.

Respeta el desacople ya establecido (Consilium/Quests): el módulo de lógica de
campaña (`src/game/iterBelli/`) no importa estado del run ni tipos de doctrina;
el bridge advisor/doctrine-aware vive en `src/data/` y se invoca desde
`EmbarkCard`.

## Decisiones de diseño

| Aspecto | Decisión |
|---|---|
| **Alcance** | Solo **Doctrinae** equipadas. Decreta queda como Fase 2 (mano consumible, requiere writeback). |
| **Efecto** | **Modifican** el pool/eventos existentes (no inyectan cartas nuevas). |
| **Base** | Por **color**: una conducta insignia por color, escalada por nivel I/II/III. |
| **Apilado** | Varias doctrinas del mismo color apilan (cada una aporta su modificador). |
| **Filosofía** | Una doctrina puede hacer *cualquier cosa* a la campaña → motor de hooks flexible (frecuencia/costo/efectos/reacción por turno). |

## Motor de hooks

El módulo de campaña solo conoce un tipo puro con hooks **opcionales**. Una
doctrina implementa los que necesita.

```ts
// iter-belli-types.ts
interface DoctrineCampaignModifier {
  id: string;
  label: string;
  /** Multiplicador del peso de robo de una carta (ausente → 1). */
  weight?(card: OperationCard): number;
  /** Ajuste de costo (descuento) al jugar una carta. */
  costDelta?(card: OperationCard): Partial<CardCost>;
  /** Efectos extra sumados al jugar una carta. */
  onPlay?(card: OperationCard, ctx: CardContext): CardEffects;
  /** Efectos pasivos aplicados cada turno. */
  onTurn?(state: IterBelliState): CardEffects;
}
```

Puntos de consulta en el motor:

- `drawCard()` → peso efectivo = `card.weight × Π modifier.weight(card)` (sobre
  los modificadores que definen `weight`).
- `playCard()` → aplica `costDelta(card)` (descuento, clamp ≥ 0) y suma
  `onPlay(card, ctx)` a los efectos resueltos antes de `applyEffects`.
- `endTurn()` → aplica cada `onTurn(state)` como un bag de efectos pasivos.

Fase 1 ejercita `onPlay`, `costDelta` y `onTurn`; `weight` queda disponible para
conductas futuras sin tocar a los consumidores.

## Las 5 conductas insignia por color (valores propuestos)

Nivel `t` = `currentLevel` ∈ {1, 2, 3}.

| Color | Doctrina | Hook | Efecto |
|---|---|---|---|
| red | Marcial | `onPlay` sobre categoría **Coerción** | `enemyWeaken += t` |
| blue | Diplomática | `costDelta` + `onPlay` sobre **Diplomacia** | costo `gold −5·t` (clamp ≥ 0); `threat −t` extra |
| purple | Económica | `onPlay` sobre **Logística** | `supplies += 2·t` |
| gold | Religiosa | `onTurn` | `morale += 0.3·t` por turno |
| white | Populista | `onTurn` | `supplies += 1·t` por turno |

Los hooks `onPlay`/`costDelta` chequean la categoría de la carta (`card.category`)
y devuelven vacío para categorías no afectadas. Los valores son afinables; el
balance fino se valida en navegador.

## Arquitectura

### Nuevo: `src/data/iter-belli-doctrines.ts` (data + funciones puras)

- Importa solo tipos de `iter-belli-types` (`OperationCard`, `CardContext`,
  `CardEffects`, `CardCost`, `CategoryName`, `IterBelliState`,
  `DoctrineCampaignModifier`) y el tipo `Doctrine`/`Faction` del dominio run
  (para el bridge). **No** importa estado mutable del run.
- `type DoctrineColor = 'red' | 'blue' | 'gold' | 'purple' | 'white'`.
- `DOCTRINE_MODIFIERS: Record<DoctrineColor, (level: number) => DoctrineCampaignModifier>`
  — las 5 conductas; cada factory cierra sobre el nivel para escalar.
- `computeDoctrineModifiers(equipped: (Doctrine | null)[]): DoctrineCampaignModifier[]`
  — por cada slot ocupado: `DOCTRINE_MODIFIERS[doctrine.color](doctrine.currentLevel)`.
  Varias del mismo color producen varios modificadores (apilan). `id` único por
  slot (p.ej. `doctrine_${color}_${slotIdx}`).

### Extender: `src/game/iterBelli/iter-belli-types.ts`

- `DoctrineCampaignModifier` (arriba).
- `IterBelliState`: añadir `doctrineModifiers: DoctrineCampaignModifier[]`.
- `CampaignSeed`: añadir `doctrineModifiers?: DoctrineCampaignModifier[]`
  (CampaignSeed vive en iter-belli-state.ts).

### Extender: `src/game/iterBelli/iter-belli-state.ts`

- `freshState()`: `doctrineModifiers: []`.
- `startIterBelliCampaign(seed)`:
  `S.doctrineModifiers = (seed.doctrineModifiers ?? []).slice();`
- `drawCard()`: al construir el peso, multiplicar `c.weight` por el producto de
  `m.weight(c)` para cada modificador que defina `weight`.
- `playCard(instanceId)`: tras resolver `def`, antes de aplicar costo, restar
  `m.costDelta(def)` (sumando deltas, clamp por recurso ≥ 0); tras computar `eff`,
  fusionar (sumar) cada `m.onPlay(def, ctx)` en el bag aplicado.
- `endTurn(timeCost)`: tras el upkeep, para cada modificador con `onTurn`,
  `applyEffects(m.onTurn(S))`. (Decisión: aplicar después del upkeep, antes de
  hambre/motín, para que los pasivos de suministros/moral mitiguen las crisis del
  mismo turno.)

### Extender: UI

- `EmbarkCard.tsx`: importar `computeDoctrineModifiers`; computar (memoizado sobre
  `equippedDoctrines.value`, como el patrón de quests) y pasar por el seed; añadir
  un preview "Doctrinae: …" con los labels de los modificadores activos.

## Detalle de las 5 conductas

```ts
const DOCTRINE_MODIFIERS = {
  red: (t) => ({ id: 'doctrine_red', label: 'Doctrina Marcial',
    onPlay: (card) => card.category === 'Coerción' ? { enemyWeaken: t } : {} }),
  blue: (t) => ({ id: 'doctrine_blue', label: 'Doctrina Diplomática',
    costDelta: (card) => card.category === 'Diplomacia' ? { gold: -5 * t } : {},
    onPlay: (card) => card.category === 'Diplomacia' ? { threat: -t } : {} }),
  purple: (t) => ({ id: 'doctrine_purple', label: 'Doctrina Económica',
    onPlay: (card) => card.category === 'Logística' ? { supplies: 2 * t } : {} }),
  gold: (t) => ({ id: 'doctrine_gold', label: 'Doctrina Religiosa',
    onTurn: () => ({ morale: 0.3 * t }) }),
  white: (t) => ({ id: 'doctrine_white', label: 'Doctrina Populista',
    onTurn: () => ({ supplies: t }) }),
};
```

`costDelta` con `gold: -5*t` se aplica como descuento: el costo efectivo de oro es
`max(0, cost.gold − 5*t)`. El motor ya clampa recursos a ≥ 0 en `applyChange`.

## Riesgos / bordes

- **Descuento de costo:** `costDelta` debe reducir el costo, no permitir costo
  negativo. El gasto se aplica vía `applyChange('gold', -costEfectivo)` con el
  costo ya clampeado a ≥ 0.
- **onPlay y batallas:** las cartas que disparan la batalla final
  (`triggerFinalBattle`) no son de las categorías afectadas; aun si lo fueran,
  `onPlay` solo suma efectos de recurso, sin tocar el flujo de batalla.
- **onTurn y crisis:** aplicar `onTurn` tras el upkeep y antes de hambre/motín
  permite que los pasivos de gold/white mitiguen una crisis el mismo turno —
  comportamiento intencional.
- **weight ausente en Fase 1:** ninguna de las 5 conductas usa `weight`; el motor
  debe tratar `weight` ausente como multiplicador 1 (no romper `drawCard`).
- **Decoupling:** el modificador lleva funciones (igual que `effects`/`penalty`
  de las cartas); se computa en embark y se guarda en estado. El motor solo
  importa el TIPO; el bridge (que importa `Doctrine`) vive en `src/data/` y lo
  llama EmbarkCard.
- **Apilado:** dos doctrinas del mismo color suman sus efectos (dos modificadores
  con el mismo comportamiento). Intencional.

## Verificación

- **`tools/verify-iter-belli-doctrines.ts`** (`npx tsx`):
  - `computeDoctrineModifiers`: slots vacíos → `[]`; color→modificador correcto;
    escala por nivel (el efecto en t=2 duplica al de t=1 donde corresponda);
    apilado (dos del mismo color → dos modificadores).
  - Hooks vía el motor (API pública): seed con red → jugar una carta de Coerción
    incrementa `enemyWeaken` en t; seed con blue → costo de oro de una carta de
    Diplomacia baja en 5·t y `threat` baja t extra; seed con gold → tras un
    `camp()`/`endTurn`, `morale` sube ~0.3·t; seed con white → `supplies` sube t
    por turno.
  - Categorías no afectadas no cambian (una carta de Logística con red no recibe
    `enemyWeaken`).
- **`tsc --noEmit`** limpio.
- **Regresión:** `verify-iter-belli-consilium.ts` y `verify-iter-belli-quests.ts`
  siguen pasando.
- **Chrome (Playwright):** con doctrinas equipadas, el embark muestra "Doctrinae:
  …" y los efectos se sienten en campaña (oro/suministros/moral/erosión).
