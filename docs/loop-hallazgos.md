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

## Iteración 3 — 2026-06-12

Zonas barridas: UI profunda de batalla/campaña (BattleCanvas/battle-fx/deployment/
DecretaBar/Itinerary), stores nunca auditados (events, npc-factions, governors,
features), pasada transversal de exports muertos/TODOs/casts.

### Implementados

| # | Hallazgo | Fix | Archivos |
|---|---|---|---|
| 9 | El canvas de batalla se veía borroso en pantallas hi-DPI: `resize()` usaba píxeles CSS sin escalar el backing store | dims lógicas W/H + backing store ×DPR (cap 2) + `setTransform(DPR,…)` en el frame loop | battle-fx.ts |
| 10 | `Itinerary` renderizaba Fragments en un map sin `key` | `<Fragment key>` | Itinerary.tsx |

### Dudosos — NO implementados

| # | Hallazgo | Por qué no |
|---|---|---|
| D10 | **Sistema de eventos = stub muerto**: `src/game/events/event-store.ts` no tiene definiciones de eventos ni callers vivos (solo meta-save lo serializa). ¿Implementar eventos o borrar el stub + campos de save? | Decisión de diseño del usuario: es scaffolding deliberado o deuda |
| D11 | **Facciones NPC decorativas**: `initNPCFactions()` crea 4 facciones que nada modifica ni muestra; `setFactionRelation`/`adjustFactionStrength` sin callers; signals derivados sin lectores. ¿Sistema de diplomacia futuro o borrar? | Misma decisión de diseño que D10 |
| D12 | `hireGovernor()` no valida que `provinceId` exista (la UI lo garantiza). Arreglarlo limpio exige inyectar un validador por el ciclo de imports province-store ↔ governor-store | Plumbing > beneficio; sin impacto en juego normal |
| D13 | `legateSeedMods` (adapter.ts:47-51) identifica la cohorte más fuerte por identidad de referencia de `c.stats` — frágil si algún día se clonan cohortes | Funciona hoy; refactor a índice si se toca el adapter |
| D14 | battle-fx no cancela los setTimeout de proyectiles en `stop()` (fugas solo si el modal se desmonta a mitad de animación, ~1s) | Impacto mínimo, ciclo de vida corto |
| D15 | 15 constantes de asesores exportadas sin importadores directos (solo arman `STARTER_ADVISORS` en el mismo archivo) | Churn cosmético; advisor-data tiene WIP de codex |

### Falsos positivos verificados (iteración 3 — no re-reportar)

- **BattleCanvas «stale closure» en el useEffect de ronda**: el closure se recrea
  por render; cuando `round` cambia, lee las props frescas de ESE render. Diseño
  correcto («fire once per new round»).
- **`fxRef.current?.setState(state)` en el cuerpo del render**: push imperativo
  deliberado al motor canvas en cada render. No es bug.
- **Balance/config**: cero constantes muertas restantes; dependencias de package.json
  todas vivas; sin TODOs/FIXMEs pendientes en src/.

## Iteración 4 — 2026-06-12

Plato fuerte: **smoke-test runtime con Playwright** (Title → Commander Select →
Forum) + barrido estático de Title/CommanderSelect/sonido/CSS (vino casi limpio:
el audio, GoldDust, keyboard-nav y tokens están todos correctos).

### Implementados

| # | Hallazgo | Fix | Archivos |
|---|---|---|---|
| 11 | **Regresión del draft de doctrinas (cazada en runtime)**: los loadouts por defecto referenciaban doctrinas ya no-starter (`doctrine_blood`, `lex_militaris`, `vis_bellica`, `pantheon`, `divina_providentia`, `alliances`, `foedus_aeternum`, `infrastructure`, `annona`) → 2-3 slots vacíos al empezar + warnings en consola | loadouts = 2 propias starter + People/Militia (blancas) | game-state.ts |
| 12 | `tools/verify-commander-loadouts.ts` **podrido**: importaba `advisorPool`/`plannedSpoke` que ya no existen — crasheaba, por eso nadie cazó el #11 | actualizado a `advisorMarket` + check nuevo: loadout ⊆ starters | verify-commander-loadouts.ts |
| 13 | 404 de favicon en cada carga | favicon.png 64×64 (águila romana) + `<link rel=icon>` | index.html, public/favicon.png |
| 14 | Placeholders «to be defined» visibles en Commander Select (3 bullets de starting bonus, Oppidum Stronghold, Imperial Forum) | bullets con recursos/doctrinas reales; flavor honesto para los edificios | commanders.ts |

### Dudosos — NO implementados

| # | Hallazgo | Por qué no |
|---|---|---|
| D16 | Passive «Deus Vult» de Innocent: `description: 'Effect to be defined.'` — no hay implementación detrás. Y el passive de Augustus («each alliance = +1 allied unit») depende del sistema muerto de facciones (D11) | Ambos requieren la decisión de diseño D10/D11: implementar o recortar |
| D17 | Botón Begin Your Legacy no se deshabilita visualmente durante los 300ms de transición (el guard `selecting` ya evita el doble-run) | UX menor |
| D18 | Clase CSS `.imp-card-priority-neutral` sin usos | Cosmético |

### Lección de proceso

El verify script roto demostró que **los verify-\*.ts no corren en CI ni en cada
commit** — se pudren en silencio. Considerar: correr TODOS los verify scripts en
cada iteración del loop (no solo los «relevantes»), o un `npm run verify` agregado.

## Iteración 5 — 2026-06-12

Foco: ejecutar la lección de la it. 4 — correr los 16 verify scripts reveló que
**3 estaban rotos** (nadie los corría). Reparados todos + agregador nuevo.

### Implementados

| # | Hallazgo | Fix | Archivos |
|---|---|---|---|
| 15 | `npm run verify` no existía — los verify scripts solo corrían si alguien se acordaba | runner `tools/run-all-verify.ts` (corre los 16, falla con resumen) + script npm + CLAUDE.md actualizado | run-all-verify.ts, package.json, CLAUDE.md |
| 16 | `verify-advisor-market.ts` crasheaba: importaba `advisorPool`/`hireAdvisorFromMarket` (API eliminada — el pool ya no existe, solo market+slots) | reescrito contra el API vivo (unseat→market, hire a slot vacío, refuse ocupado, fire con fórmula de venta) | verify-advisor-market.ts |
| 17 | `verify-hub-replenishment.ts` fallaba: expectativas del balance viejo (triarii ya tiene 1000 HP, no ~1300) — **la fórmula vive bien**, el script estaba desactualizado; también pasaba `faith/influence/momentum` a initResources | expectativas recalculadas (350/500, hpRestored 340) y recursos muertos fuera | verify-hub-replenishment.ts |
| 18 | `verify-advisor-effects.ts` fallaba: esperaba «first seat = mission only», pero el comportamiento vivo y coherente (código + EmbarkCard + descripción del advisor) es misión + pasiva | expectativa actualizada (Consul −1 threat sí cuenta) | verify-advisor-effects.ts |

### Dudosos — NO implementados

| # | Hallazgo | Por qué no |
|---|---|---|
| D19 | `fireAdvisor`/`sellDoctrine` comentan «adds gold directly», pero `addResource` aplica los modificadores de ingreso (loot-bonus/Trade) también a las VENTAS — vender con Raider sentado da ~15% extra. ¿Intencional? Probablemente no, pero es céntimos | Decisión de balance; tocaría addResource o los callers de venta |

### Pendiente para la próxima iteración

- **Deep-run de campaña con Playwright**: embark → cartas → batalla decisiva →
  victoria → **modal del draft de doctrinas en vivo** (aún no visto renderizado).

## Iteración 6 — 2026-06-12

Foco: el deep-run de campaña con Playwright (jugada completa: 10 días de marcha,
batalla decisiva, derrota, retirada fallida, vuelta al hub). Dos hallazgos gordos
que solo el juego en vivo podía revelar.

### Implementados

| # | Hallazgo | Fix | Archivos |
|---|---|---|---|
| 19 | **Sequía de Movimiento**: el refill (4 huecos, sin duplicados) puede llenarse de cartas permanentes sin ninguna de Movimiento — 5 robos seguidos sin poder avanzar con el reloj corriendo; la única salida era quemar días. Vivido en partida: día 6 aún en Frontera, misión de 8 días muerta | **Regla de piedad** en `refillPool`: si el pool rellenado no tiene Movimiento, se fuerza una elegible como hueco extra. Validada en vivo (Marcha cautelosa apareció al turno siguiente). Doc de eventos sincronizado | iter-belli-state.ts, sistema-de-eventos.html |
| 20 | **Campaña restaurada inalcanzable**: al recargar con campaña en vuelo, el save la restaura pero ningún elemento de la UI consume `iterBelliActive` — el Forum mostraba «Embark», que re-sembraría una campaña nueva encima. Solo se podía volver navegando a mano a #iterbelli | EmbarkCard: con campaña activa el botón pasa a «Reanudar campaña» y solo navega (sin re-seed); el gate de council/cohorts no aplica al reanudar | EmbarkCard.tsx |

### Observaciones de balance (NO tocadas — para decidir)

| # | Observación |
|---|---|
| B1 | ✅ **RESUELTO (post-it.6, a petición del usuario)**: no era «cuesta arriba», era **matemáticamente imposible** — el simulador headless nuevo (`tools/sim-battle-balance.ts`, 400 batallas/config con el motor real) midió **0% de victorias incluso con el roster completo de 6 cohortes** (7.400 soldados, threat 0). Causa: carthage (11/9/13/5/11, disc 6, iron+fort 15) estaba afinado contra una curva de stats que el jugador no puede alcanzar (suma de cohortes 0-3 c/u). Fix sim-tuneado: base 7000→5000, carthage → 8/6/9/3/8, disc 5, bronze, fort 10. Curva resultante: 2 cohortes 0% (hay que reclutar — coherente), 4 de línea 25% en frío / 47-59% con campaña jugada, 6 completas 94-99%. De paso: `scenario.enemy.morale/discipline` y `ENEMY_MORALE/ENEMY_DISCIPLINE` eran números muertos (la batalla lee el arquetipo) — eliminados |
| B2 | Las 2 quests rojas del Consilium comparten plantilla → dos cartas «Asalto al fuerte» idénticas en mesa a la vez (confuso, distinta ventana). Cosmético |
| B3 | ✅ **CERRADO (it. 7)** — ver iteración 7: victoria en vivo + modal del draft verificado de punta a punta |

## Iteración 7 — 2026-06-12

Foco: validar en vivo el retuning de Sagunto y cerrar B3 (modal del draft).
**Primera victoria de la historia del juego jugada de punta a punta con Playwright.**

### Validado en vivo (sin cambios de código salvo el header del sim)

- **Run completo ganador con el ejército inicial + estrategia de erosión** (la que
  el retuning quería habilitar): Boudicca, leva +500 (3.900), erosión 6 acumulada
  (Furia gala ×2 ×2 doctrinas rojas, quest del fuerte, Despacho), llegada a Sagunto
  día 10/12, Mars +60%, hold-the-line contra cargas → **✦ VICTORIA ✦ round 10 por
  colapso de moral enemiga** (1.530 supervivientes vs 235). El enemigo entró con
  2.996 (5000 × 1.175 amenaza × 0.58 erosión) — los tres multiplicadores correctos.
- **Modal del draft de doctrinas EN VIVO** (B3): tras «Volver al Hub» apareció
  «El Senado premia tu triunfo» con 3 ofertas válidas (Resilience/Concordia blancas
  + Lex Militaris roja — elegibles, no poseídas, nivel I). Pick de Lex Militaris →
  entra en Collection («1 available»), modal se cierra, 4 slots intactos.
- **Cadena de victoria completa**: +200 oro de botín (242 final), provincia
  conquistada (Provinciae 2), **Gallia desbloqueada** (toast «Triunfo en Alesia»),
  season 0→2, supplies devueltos al hub con warning de restock. Consola limpia.
- **Sim ampliado**: configs de erosión alta confirman la estrategia (starter+weaken 7
  → 20%; 4 línea+weaken 5 → 100%) — la identidad de Boudicca (erosionar) funciona.

### Observaciones nuevas

| # | Observación |
|---|---|
| B4 | Economía temprana: oro inicial 2-8 vs cohorte más barata 20-40g — antes de la 1ª campaña no se puede reclutar. El camino real del oro es el botín de campaña (quest fuerte +35, caravana +50, victoria +200, misión +50). Coherente como roguelite («saquea → construye → domina»), pero la 1ª campaña es necesariamente a pelo. Si se quiere suavizar: subir startingResources o abaratar militia |
| B5 | El stat `charge 0` del roster inicial hace que la orden Charge no haga nada y se muestre igual (botón activo, daño 0). UX: ¿deshabilitar órdenes cuyo stat sea 0? |

### Validado en vivo esta iteración

- Fix G1 (threat escala al enemigo decisivo): 6.360 = base × (1+3/20) × (1−2×0.07) ✓
- Doctrinas rojas ×2 → doble línea «erosionado (+1)» en Furia gala (stack por slot, por diseño)
- Marcha nocturna (gamble 60%), expiry de compromisos con penalización, quest fallida
  (+2 amenaza), retirada fallida (check 5<11), rout por moral 0, derrota → EndgameCard
  → hub sin draft (correcto), consola limpia de punta a punta
