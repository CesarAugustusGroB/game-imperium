# Loop: barrido de bugs por pantalla (4 vueltas, cada 15 min)

Objetivo: revisar bugs en todas las pantallas **vivas** (Hub + Iter Belli + Title/Commander)
y corregir los de alta confianza. Ignorar sistemas deprecados (bellum/node-map).

Estado por vuelta — particionado para que cada vuelta sea acotada y completable.

## Plan
- **V1 — Title / Commander / App router / Forum shell + Overview** ✅
- **V2 — Provinciae / Consilium / Exercitus** ✅
- **V3 — Doctrinae / Decreta / DoctrineDraftModal / TutorialOverlay + Iter Belli (IterBelliScreen, OperationCard, CampaignLog, CampaignResourceBar, Itinerary)** ✅
- **V4 — Batalla (BattleModal + battle/*, DeploymentPanel, OrderBar, CenterTrack, ArmyStatus, DecretaBar, BattleCanvas) + EndgameCard + transversal (recursos/save)** ✅

## V1 — hallazgos y veredicto
Corregidos (alta confianza):
- `StatChip.tsx:21` — mostraba `+0` para delta cero (`>= 0`); ahora `> 0`.
- `Sidebar.tsx:364` — toggle de colapso usaba snapshot stale `collapsed`; ahora `!sidebarCollapsed.value`.
- `TitleScreen.tsx:612` — `handleContinue` async sin guardia → doble-click hacía doble `restoreActiveRun()`; añadida `continuingRef`.

Descartados (falsos positivos / edge cases especulativos, sin cambio):
- `CommanderSelect:1111` — el timeout 300ms NO corre durante una transición (`startNewRun` no navega); `transitionState` está idle al disparar.
- `App.tsx` bootResuming + arrow-keys race — edge cases no probados; el "fix" cambiaría comportamiento sin bug demostrado.

Commit: ver `fix(ui): V1 bug sweep`.

## V2 — hallazgos y veredicto
Consilium: **sin bugs** (hire/dismiss/afford/effects verificados correctos).

Corregidos (alta confianza, ProvinciaeTab.tsx):
- `getNetGoldIncome` omitía `uniqueFeature.goldPerSeason` → el ledger/admin subestimaba el ingreso neto vs el tick real (`getProvinceIncome` sí lo suma). Añadido `featureGold` antes del multiplicador de gobernador, replicando la fórmula exacta.
- Auto-select de provincia escribía `selectedProvinceId.value` **durante el render** → movido a `useEffect([selected?.id])`.

Descartados (verificados, sin cambio):
- Bar acumulador de población (`(accumPct/barRef)*100`): correcto para "progreso hacia el siguiente punto de pob." (1 unidad = 1/barRef del ancho); el fix propuesto sobrellenaría. (Overflow cosmético solo en pop≥10, no se toca.)
- Exercitus `healIndex` "stale closure": en Preact+signals, mutar el roster re-renderiza y regenera handlers con índice fresco → no hay closure stale real.
- Exercitus `maxBuyable`/`ammoBuyable` ignoran descuento de tienda: bug real pero estrecho (solo con doctrina shop-discount) y el cálculo exacto con `ceil`+descuento es delicado → diferido para no introducir un cálculo sutil mal.

## V3 — hallazgos y veredicto
Doctrinae/Decreta: **sin bugs** (equip/upgrade/cast/sell/afford verificados; coste mostrado == coste cobrado vía la misma `getUpgradeCost`).

Corregido (alta confianza):
- **OperationCard mostraba/chequeaba el costo CRUDO**, pero `playCard` aplica `costDelta` de doctrinas (la doctrina azul descuenta oro en cartas de Diplomacia) y clampa ≥0 → una carta con descuento se veía gris/injugable y mostraba el coste sin descuento. Fix a prueba de divergencias: extraído `effectiveCardCost(def)` exportado desde `iter-belli-state.ts`, usado por `playCard` (cobro) Y `OperationCard` (afford + filas de coste).

Descartados (verificados, sin cambio):
- `CampaignResourceBar` timer sin cleanup: intencional (comentado), id-guard hace inocuo el timer stale, Preact tolera setState post-unmount y los timers se autoexpiran en 1700ms (no se acumulan). Cleanup ingenuo cortaría el flash → no se toca.
- `DoctrineDraftModal d.levels[0]`: `levels` es `TierTuple` (3) garantizado por el tipo y los datos → no es bug, sería guardia defensiva.
- `CampaignLog` key por índice: log append-only → seguro hoy (el agente mismo lo bajó del umbral).

## V4 — hallazgos y veredicto (FINAL)
EndgameCard + recursos/save: **sin bugs** (writeback de supervivientes, semilla iuniores única, migración, boundaries de spend/canAfford/refund verificados).

Corregidos (alta confianza):
- `BattleCanvas`: `setState(state)` se llamaba en el **cuerpo del render** → en el primer mount `fxRef.current` es null y el estado inicial se perdía (canvas negro hasta el siguiente re-render). Movido a sembrar en el effect de montaje + `useEffect([state])`.
- `OrderBar`: el chip de "prueba" de la orden **Retreat** mostraba el umbral base (`o.check`) pero el resolver exige `+6` cuando estás **encerclado** → el jugador veía un número engañoso. Ahora muestra el umbral real (+6) con aviso "(encerclado)". No se añadió lock duro: con mov+dado alto puede ser alcanzable.

Descartados (verificados, sin cambio):
- Race en `castBattleDecretum`/`issueOrder`: single-threaded (solo click handlers) → sin race.
- Centro `ford`/`enemyChargePenalty`: la condición penaliza correctamente la carga enemiga contra el poseedor del centro.

## Resumen del barrido (4/4 completado)
6 bugs reales corregidos en 4 commits; ~12 hallazgos de agentes descartados como falsos positivos tras verificación directa.
- V1 `00fce37` — StatChip `+0`; toggle stale Sidebar; guardia double-continue Title.
- V2 `fba3608` — ledger de oro neto omitía feature gold; signal escrita en render → useEffect.
- V3 `b5bb4b7` — UI de cartas ignoraba descuentos de doctrina (cartas injugables) → helper compartido `effectiveCardCost`.
- V4 `<este commit>` — BattleCanvas estado inicial perdido; umbral de Retreat encerclado engañoso.
Verificación por vuelta: tsc + 18/18 verify + (V3/V4) 198/198 vitest.
