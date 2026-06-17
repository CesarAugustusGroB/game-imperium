# Loop: barrido de bugs por pantalla (4 vueltas, cada 15 min)

Objetivo: revisar bugs en todas las pantallas **vivas** (Hub + Iter Belli + Title/Commander)
y corregir los de alta confianza. Ignorar sistemas deprecados (bellum/node-map).

Estado por vuelta — particionado para que cada vuelta sea acotada y completable.

## Plan
- **V1 — Title / Commander / App router / Forum shell + Overview** ✅
- **V2 — Provinciae / Consilium / Exercitus** ✅
- **V3 — Doctrinae / Decreta / DoctrineDraftModal / TutorialOverlay + Iter Belli (IterBelliScreen, OperationCard, CampaignLog, CampaignResourceBar, Itinerary)** ⏳
- **V4 — Batalla (BattleModal + battle/*, DeploymentPanel, OrderBar, CenterTrack, ArmyStatus, DecretaBar, BattleCanvas) + EndgameCard + transversal (recursos/save)** ⏳

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
