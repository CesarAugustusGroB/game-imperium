# Sistema de eventos de campaña (D10) — Diseño

**Fecha:** 2026-06-14 · **Estado:** aprobado por el usuario, listo para plan

## Contexto

`src/game/events/event-store.ts` es infraestructura muerta: define `consequenceFlags`
(flags por run que encadenan eventos) y `seenEventsThisSpoke` (dedup por campaña),
pero **no hay catálogo de eventos ni callers vivos** — solo el meta-save los serializa.
Este diseño construye el sistema que ese stub anticipaba.

Los eventos NO son cartas y NO usan el motor de cartas. Son el **tejido conectivo
entre el Hub (Foro) y la campaña Iter Belli**: el estado del hub (Consilium +
provincias) genera *conflictos* que afloran como interludios narrativos raros
durante la marcha, y la elección del jugador **resuelve o agrava** ese conflicto
de vuelta en el Foro.

## Decisiones cerradas (con el usuario, 2026-06-14)

| Eje | Decisión |
|-----|----------|
| Naturaleza | Interludios narrativos, **NO cartas**, motor propio |
| Fuentes de conflicto | **Personajes (Consilium advisors) + Provincias** |
| Dirección de consecuencia | **Escriben de vuelta al hub** (resuelven/agravan), aplicado al volver al Foro |
| Frecuencia | **Máx. 1 por campaña**, a mitad de marcha, probabilístico si hay conflicto activo |
| Alcance v1 | **6–8 conflictos** (mezcla provincia + personaje); honra `extra-event-choice` |
| Arquitectura | **Snapshot al embarque + cola de efectos diferidos** + reutilizar `CardEffects` |

## Arquitectura

Flujo **unidireccional**: el módulo `events` NO importa los stores del hub (evita el
ciclo de imports tipo D12). Lee de un snapshot inmutable; solo el reductor del
retorno-al-hub escribe en province/council.

```
EMBARK ──► snapshot del hub ──► CampaignConflict[] (en el estado de campaña)
MARCHA (punto medio) ──► roll prob. ──► evento elegible ──► modal de elección
ELECCIÓN ──► efectos inmediatos (CardEffects) en la campaña
        └─► encola HubConsequence[] en el save (NO muta el hub aún)
RETORNO AL FORO ──► applyCampaignEventOutcomes() ──► escribe province/council stores
```

### Componentes

1. **Detección de conflictos (al embarque).** Una función pura
   `detectCampaignConflicts(hubSnapshot)` escanea advisors (lealtad baja, rivalidad)
   y provincias (unrest alto, recién conquistada, feature relevante) → lista de
   `CampaignConflict { id, source: 'advisor'|'province', sourceId, severity }`.
   Se sella en el estado de campaña al embarcar; los eventos solo leen de aquí.

2. **Catálogo de eventos** (`src/data/campaign-events.ts`). 6–8 `CampaignEvent`:
   `{ id, sourceType, eligible(conflictSnapshot, flags), title, body, choices }`.
   Cada `choice = { label, immediate: CardEffect[], consequence: HubConsequence[],
   setsFlag?, requiresFlag?, blockedByFlag?, premium?: boolean }`.
   `premium` = opción extra que solo aparece con el feature `extra-event-choice`.

3. **Selección y disparo** (`campaign-events-controller`). A mitad de marcha, una
   tirada (prob. configurable en balance); si acierta, hay conflicto activo y un
   evento elegible no visto este spoke con sus flags satisfechos → se dispara UNO.
   Tope duro: **≤1 evento por campaña**. Usa `markEventSeen` / `wasEventSeen`.

4. **Presentación** (`CampaignEventModal.tsx`). Modal narrativo que reutiliza el
   lenguaje visual de las cartas (sin acoplarse al motor de cartas). Muestra
   título + cuerpo + 2–3 opciones; la opción `premium` aparece solo si la run
   tiene el feature `extra-event-choice`.

5. **Resolución.** La elección aplica `immediate` (CardEffects) a la campaña en el
   acto y **encola** `consequence` (HubConsequence[]) en el save. `setsFlag` marca
   el `consequenceFlag` para encadenar.

6. **Aplicación diferida** (`applyCampaignEventOutcomes`). En el retorno-al-hub
   (mismo punto que ya importa province/council stores) un reductor aplica la cola:
   ajusta unrest de provincia, lealtad de advisor, recursos, etc. Limpia la cola.

### Vocabulario de efectos

- **Inmediatos** = `CardEffect` existentes → `verify-effects` los cubre gratis.
- **Diferidos** = nueva unión pequeña `HubConsequence`
  (`{ type:'province-unrest', delta } | { type:'advisor-loyalty', delta } |
  { type:'resource', resource, delta } | …`). Se registra como **9ª unión** en
  `verify-effects.ts` con su sitio de aplicación (`applyCampaignEventOutcomes`),
  para que añadir un miembro nuevo no quede inerte en silencio.

### Persistencia

`event-store` ya serializa `consequenceFlags` + `seenEventsThisSpoke`. Añadir la
**cola de `HubConsequence` pendientes** a `iter-belli-save` / `meta-save` para que
sobreviva a guardar/cargar a mitad de campaña.

## Balanceo (restricción del usuario)

- Todo delta de **soldados** e **iuniores** en eventos/efectos se denomina en
  **centenas** (p.ej. +200, −300, +500); techo en **millares bajos** (~1000–2000
  para el mayor swing). Nada de unidades sueltas ni decenas.
- Costes y ganancias por opción deben sentirse simétricos al riesgo: la opción
  segura paga poco, la arriesgada (gamble) ofrece centenas-altas pero puede costar
  tropas. Documentar las constantes en `iter-belli-balance.ts`.

## Review de bonos de efectos (tarea acompañante)

Auditar las **8 uniones** ya blindadas (`DoctrineEffect`, `DecretumEffect`,
`TradeGoodSpecial`, `FeatureSpecial`, `GovernorTrait`, `SynergyBonus`,
`LegateEffect`, `AdvisorPassive`): para cada miembro, verificar magnitud coherente
(sin outliers que rompan el balance), que el sitio de aplicación realmente surte el
efecto prometido (no "texto promete / código no aplica"), y normalizar cualquier
bono de soldados/iuniores a la escala de centenas. Registrar hallazgos en
`docs/loop-hallazgos.md`.

## Testing

- Unit: `detectCampaignConflicts` (cada fuente), elegibilidad (flags require/block),
  tope ≤1/campaña, `extra-event-choice` añade la opción premium.
- Integración headless: embark → snapshot → disparo de evento → elección →
  retorno-al-hub → `applyCampaignEventOutcomes` muta los stores correctos.
- `verify-effects` extendido a la 9ª unión `HubConsequence` (sitio obligatorio).
- Balance: test que afirma que todo delta soldados/iuniores ∈ [100, 2000].

## Fuera de alcance (v1)

- Conflictos originados por el comandante/flags de run como disparador primario
  (los flags solo encadenan dentro de una secuencia).
- Disparadores diegéticos por hito (entrar en territorio, tras batalla) — Enfoque C
  descartado para la v1.
- Diplomacia NPC (D11) — congelada por decisión separada.

## Docs a sincronizar

- `sistema-de-eventos.html` — añadir sección del sistema de eventos de campaña
  (distinto de las cartas) cuando exista.
- `sistemas-del-juego.html` — reflejar que los eventos hub↔campaña están vivos.
- `docs/loop-hallazgos.md` — hallazgos de la review de bonos.
