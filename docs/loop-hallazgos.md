# Loop de auto-mejora — registro de hallazgos

Bitácora del loop horario en `feat/auto-mejoras`. Cada iteración: hallazgos
implementados (≥75% confianza) y dudosos (anotados, sin tocar). No repetir
hallazgos ya listados aquí.

## Iteración 1 — 2026-06-12

### Implementados

| # | Hallazgo | Fix | Archivos |
|---|---|---|---|
| 1 | `DoctrineDraftModal` (z 90) quedaba debajo del modal de edificio de ProvinciaeTab (z 200) — el draft podía quedar tapado e inclicable | z-index 90 → 300 | DoctrineDraftModal.tsx |
| 2 | `OrderBar` duplicaba `moraleMult` con una versión desactualizada (cap 1.0 vs rampa a 1.5 del engine). Sin efecto en el gating actual (ambas <1 ⇔ moral<6), pero fuente de verdad duplicada | importar `moraleMult` del resolver, borrar el duplicado | OrderBar.tsx |
| 3 | Harass «en seco»: la penalización solo aplicaba si empezabas con 0 munición; con munición insuficiente (p. ej. 5 de 9) disparabas sin penalización. La UI bloquea al jugador, pero la IA enemiga sí podía | `dry = ammo <= 0 \|\| ammo < coste` | resolver.ts |
| 4 | El `Math.max(0, eMoraleHit)` del charge anulaba en silencio el `-0.2` de carga fallida (alivio de moral del defensor escrito y muerto). `applyMorale` ya floorea la pérdida total a 0, así que quitar el clamp no puede regalar moral | devolver `eMoraleHit` sin clamp + comentario | resolver.ts |
| 5 | Traits de legado Charismatic/Inspiring prometían «+15/+25 morale» (escala legacy 0–100); el engine aplica /10 en escala 0–15 | textos → «+1.5/+2.5 pre-battle morale» | legate-traits.ts |

### Dudosos — NO implementados (revisar a mano)

| # | Hallazgo | Por qué no |
|---|---|---|
| D1 | `CampaignResourceBar` no limpia los `setTimeout` de los flashes. El comentario del código lo declara deliberado: un cleanup ingenuo en re-run cancelaría el timer anterior y dejaría flashes pegados. El fix correcto (Set de timers limpiado solo en unmount) es churn para un beneficio mínimo (timers de 1.7 s, autoconsumibles) | Diseño deliberado; riesgo de romper UX por limpiar «bien» |
| D2 | Tipos de pasiva de asesores semánticamente mentirosos: ADVISOR_DIPLOMAT usa `extra-event-choices` pero da oro (count×5); HEALER/VETERAN usan `heal-between-nodes` pero dan moral (amount/100). Los números finales SÍ cuadran con las descripciones | Renombrar tipos toca el union + consumidores; advisor-data tiene WIP concurrente de codex (memoria). Valor bajo: el jugador ve el efecto correcto |
| D3 | Reveal off-by-one (engine.ts:97-100): decrementa antes de pre-elegir. Mi traza da 3 rondas visibles para reveal=3 (el agente decía 2) y el cast del decretum pre-elige inmediato — puede que sea correcto | Confianza real <75%; requiere traza manual en una batalla |
| D4 | `applyMorale` confía en un comentario para no re-aplicar `sMorale` negativo (fragilidad, no bug) | Solo defensa documental; ya hay comentario |
| D5 | IA enemiga: `lineRelief` (moral<3) ensombrece `rally` (moral<2.5) y el check de envelop `movement+4>=12` casi siempre pasa | Comportamiento razonable; «arreglarlo» es rebalancear la IA sin spec |
| D6 | Merc heal usa `Math.round` vs `Math.floor` del ciudadano (estilo, los caps evitan overheal) | Cosmético puro |

## Iteración 2 — 2026-06-12

Zonas barridas: capa de cartas/quests/misiones de Iter Belli, simulación provincial
(tick/unrest/hambruna/rebelión), comandantes/progresión/referencias de assets.

### Implementados

| # | Hallazgo | Fix | Archivos |
|---|---|---|---|
| 6 | El tooltip de desglose de Unrest omitía la hambruna (+10/+25 por temporada) y el unrest de features únicas — el «por qué sube» quedaba invisible | filas 🌾 Famine y Unique feature en el breakdown | ProvinciaeTab.tsx |
| 7 | Veteran Stacks prometía «3 spokes without battle = lose all stacks» — inalcanzable: cada spoke culmina en batalla decisiva y `spokesSinceLastBattle` nunca incrementa. El spec vivo es «cap 5, se rompe al perder» (eso SÍ está implementado) | texto → «+5% per decisive victory (max 5). Lose all on defeat» | commanders.ts |
| 8 | Quests azul y blanca sin `time` explícito (dependían del fallback `cost.time \|\| 1`); el coste real de 1 día no se mostraba como las demás | `time: 1` explícito | iter-belli-quests.ts |

### Dudosos — NO implementados

| # | Hallazgo | Por qué no |
|---|---|---|
| D7 | Tick provincial: la hambruna dura mata población ANTES de calcular el surplus de crecimiento — menos bocas ⇒ surplus mayor ⇒ el crecimiento se reanuda antes. ¿Bug o autorregulación realista? Cambiarlo es rebalance sin spec | Decisión de diseño, no de código |
| D8 | `conquerProvince` con overrides no valida tradeGood vs terrain (el camino sin overrides sí). Hoy ningún caller pasa tradeGood override | Riesgo latente, sin impacto actual |
| D9 | Filtro redundante `c.timer === 99` en iter-belli-state:412 (cubierto por `timer > 0`); documenta la semántica «permanente» | Cosmético; quitar resta legibilidad |

### Falsos positivos verificados (no re-reportar)

- **`wireRunBonuses` antes del restore en meta-save**: las 4 inyecciones son closures
  que leen los signals al momento de USO, no al wirear. Restaurar advisors/doctrinas
  después es inofensivo. NO es bug.
- **Assets**: todas las referencias GameIcon/playSfx/retratos verificadas — sin rotas.
- **Capa de cartas**: vocabulario CardEffects completo, sin no-ops; elegibilidad,
  expiry, gambles, commitments y firma correctos contra sistema-de-eventos.html.
- **`startingResources` de comandantes**: llegan correctamente al run.
