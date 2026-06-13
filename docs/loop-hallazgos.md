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
| B5 | ✅ **CERRADO (it. 8)** — la orden Charge se bloquea con motivo claro cuando `charge = 0` (impacto 0 + recoil = estrictamente mala); desde el rediseño de la escena el chip rojo ya lo señalaba |

## Iteración 8 — 2026-06-12 (última antes de pausar el loop)

Foco: pasar **Gallia** por el simulador (nunca auditada) + cerrar B5.

### Implementados

| # | Hallazgo | Fix | Archivos |
|---|---|---|---|
| 21 | **Gallia rota como lo estaba Sagunto**: gauls (charge 20, base 9.000) aniquilaban en 3-8 rounds — el roster completo VETERANO (disc 5, hierro) ganaba 2-7% sin erosión pesada | Sim-tuneado: base 9.000→6.500, min 2.500→2.200, gauls charge 20→14, push 8→6 (identidad charge-bomb intacta — el counter sigue siendo el brace). Curva resultante: full fresco 25/50/100%, full veterano 72/95/100%, 4-línea veterano 17/51/99% — segunda campaña más dura que la primera y que premia la progresión | iter-belli-scenario-gallia.ts, orders.ts, sim-battle-balance.ts |
| 22 | B5: Charge clicable con `charge 0` (estrictamente dañina: impacto 0, recoil completo) | lock con motivo: «Sin tropas de choque (carga 0)» | OrderBar.tsx |

El simulador ahora cubre ambos escenarios con perfiles fresh/veteran y queda como
herramienta estándar para cualquier escenario futuro (iberians/garrison ya tienen
arquetipo definido — pasar por el sim ANTES de cablearlos).

## Iteración 9 — 2026-06-12

Foco: smoke-test de las pantallas de menú (Title/Options/Credits) en vivo.

### Implementados

| # | Hallazgo | Fix | Archivos |
|---|---|---|---|
| 23 | **El modal de Options decía «No options available.»** — placeholder vacío pese a existir señales de audio (`musicMuted`/`sfxMuted`/`sfxVolume`) ya cableadas al motor de sonido pero sin UI que las tocara | `SettingsPanel` ahora expone 3 controles reales: toggle Música, toggle Efectos de sonido, slider de volumen; preferencias persistidas en localStorage (`persistAudioPrefs`) y rehidratadas al cargar | SettingsPanel.tsx, sound.ts |

Validado en vivo: los 3 controles renderizan, el toggle de SFX es reactivo y
escribe `imperium.sfxMuted` en localStorage. Credits ya funcionaba.

## Iteración 10 — 2026-06-12

Foco: pestaña Exercitus (reclutamiento/arsenal/compras) + coherencia profunda de los 4 docs.

### Implementados

| # | Hallazgo | Fix | Archivos |
|---|---|---|---|
| 24 | **Los costes en oro de Exercitus se mostraban/gateaban SIN el descuento de tienda** que sí se aplica al pagar (`discountedGold`): el tooltip de reclutar decía «Needs N gold» con el precio base, el botón de mejorar armadura podía aparecer deshabilitado teniendo oro suficiente (gateaba contra el base), y los botones +2/+10 de suministros/munición igual. Inconsistencia entre lo mostrado y lo cobrado | exporté `getDiscountedGold(base)` y lo usé en el tooltip de reclutar, el gate+etiqueta de armadura, y los gates de los botones de suministros/munición | strategic-store.ts, ExercitusTab.tsx |
| 25 | Doc: «los 30 pergaminos» (sistemas:758) contradecía «33 cartas/pergaminos» en las líneas 730/742 — el código tiene 33 decretos | typo → 33 | sistemas-del-juego.html |

### Falsos positivos verificados (no re-reportar)

- **Botón de curar con `recurso > 0` en vez de `>= healCost`**: NO es bug — el heal
  es **parcial** y siempre cura ≥1 HP con cualquier cantidad (resolver:
  `floor(spend×maxHp/1000)` para ciudadanos ≥1 con maxHp≥1000; mercenarios igual).
  Habilitar con `>0` es correcto.
- **Docs vs código**: tras el barrido completo de los 4 docs, todo lo demás coherente
  — doctrinas 4 slots, suministros −2/turno, los 5 power-stats, GDD.md histórico,
  iconos de stats ya en `iconos.html`, Options con controles reales. Solo el typo #25.

## Iteración 11 — 2026-06-12

Foco: **self-review adversarial** del código de batalla recién añadido (it. 7-8) +
DeploymentPanel/ConsiliumTab sin barrer.

### Implementados

| # | Hallazgo | Fix | Archivos |
|---|---|---|---|
| 26 | El hero del Consilium mostraba un badge de **coste en oro también para asesores ya sentados** (con el precio base sin descuento) — confunde: ya están contratados, no hay nada que pagar. Para candidatos sí debe verse el coste de contratación (descontado) | `cost = isSeated ? null : getDiscountedAdvisorCost(...)` + render condicional del badge. Verificado en vivo: el sentado (Centurion Varro) ya no muestra «60» | ConsiliumTab.tsx |

### Self-review limpio (verificado contra engine/resolver — sin bugs)

- **CenterTrack.tsx**: marcador `(100-control)/200×100` mapea +100→izq / −100→der
  correcto; thresholds ±25 coinciden con `centerTier`; dado `6+tier` = `yFaces` del
  engine; null-handling y chip de bonus (>0) correctos.
- **OrderBar.tsx**: cada chip refleja el campo real de ORDERS; `stat×mult` = cómputo
  del resolver; lock de charge-0 correcto; fórmula de prueba de movimiento = resolveMove.
- **ArmyStatus.tsx**, **GameIcon.tsx** (5 iconos stat), **iter-belli-save.ts**
  (re-inyección de carta decisiva con triple guarda) — todos limpios.
- **DeploymentPanel**: formaciones filtradas por disciplina+traits correctas, las 3
  únicas gated por `TRAIT_TO_FORMATION_TRAIT`, fallback a battleLine sin dead-end.
- **ConsiliumTab**: `computeConsiliumSetup`/`computeSecondaryQuests` (regla
  first-seat-mission) bien reflejados; el hire de candidatos ya usaba el coste descontado.

## Iteración 12 — 2026-06-12

Foco: flujo interactivo de inversión en Provinciae + barrido runtime de las 6 pestañas.

### Implementados

| # | Hallazgo | Fix | Archivos |
|---|---|---|---|
| 27 | **El coste de construcción mostrado omitía el descuento del bien comercial** (Mármol −15%, Madera −10%) que el store SÍ aplica al pagar: `InvestmentSlot` y el modal de detalle calculaban `gobernador+pergamino` pero no el trade. Una provincia con Madera mostraba 13g y cobraba 11g — y el gate de «asequible» divergía del cobro real (tercer caso de drift display-vs-spend tras Exercitus #24 y asesores #26) | plegué el trade discount dentro de `getInvestmentDiscount(traits, province)` (fuente única que ya usan store y UI) y quité la suma separada del store; UI correcta sin tocar (su cap 90 == `ECONOMY.maxInvestmentDiscount`) | province.ts, province-store.ts |

### Validado en vivo

- Barrido de las **6 pestañas** del Forum (Provinciae/Consilium/Exercitus/Doctrinae/
  Decreta/Forum): **0 errores, 0 warnings** de consola.
- Falsos positivos verificados del agente: tax sliders sincronizados con el tick,
  gating de tiers (no se salta T2→T3), hire de gobernador coste=cobro, sin botones
  mentirosos. Solo el #27 era real.

### Patrón recurrente (3 iteraciones seguidas)

Display-vs-spend del descuento: Exercitus (#24), asesores sentados (#26), inversión
provincial (#27). En los tres la UI mostraba/gateaba el precio base mientras el store
cobraba el descontado. **Lección**: cualquier coste en oro que se muestre en UI debe
pasar por el MISMO helper que el store usa para cobrar — no recalcular el descuento
en paralelo. Candidato a revisión preventiva si aparece un cuarto sitio.

### Validado en vivo esta iteración

- Fix G1 (threat escala al enemigo decisivo): 6.360 = base × (1+3/20) × (1−2×0.07) ✓
- Doctrinas rojas ×2 → doble línea «erosionado (+1)» en Furia gala (stack por slot, por diseño)
- Marcha nocturna (gamble 60%), expiry de compromisos con penalización, quest fallida
  (+2 amenaza), retirada fallida (check 5<11), rout por moral 0, derrota → EndgameCard
  → hub sin draft (correcto), consola limpia de punta a punta

## Iteración 13 — 2026-06-13

Primera vuelta del loop reanudado (`docs/loop-prompt.md`). Foco: **S-D · Blindaje del
contrato de efectos** — único hueco de la FASE 1 del plan de consolidación.

### Implementados

| # | Hallazgo / entrega | Detalle | Archivos |
|---|---|---|---|
| 28 | **`verify-effects.ts` — guarda del contrato de efectos**. Ambas uniones (`DoctrineEffect`/`DecretumEffect`) se consumen con `default` permisivos (hub `return null`, batalla `return false`), así que añadir un miembro **compila pero queda inerte en silencio** — el agujero exacto del «texto promete / código no aplica» | El script parsea los literales de miembro **del type-source** (escáner de profundidad de llaves, no del `;` interno) y FALLA si: un tipo declarado no tiene sitio de aplicación registrado · el sitio ya no lo maneja (`case 'x'`/`=== 'x'`) · hay una entrada de registro obsoleta · los datos (DOCTRINE_CATALOG/STARTER_DECRETUM) usan un tipo fuera de la unión. 4 doctrina + 14 decreta cubiertos | tools/verify-effects.ts (nuevo) |
| 29 | **Invariantes económicos** (mismo script) | `applyInvestmentDiscount` refund ≤ pagado y ≥1 por recurso (nunca gratis, ni al 90% ni a `maxInvestmentDiscount`); `getShopDiscount`/`getUpkeepReduction` ≤75 al apilar; `getDiscountedGold` ∈ [1, base]; `getInvestmentDiscount([])`=0; `ECONOMY.maxInvestmentDiscount` ∈ (0,100) | tools/verify-effects.ts |
| 30 | **Check muerto en `verify-doctrine-hub.ts`**: filtraba el dato contra `resource-per-spoke`, miembro de la unión `DoctrineEffect` **ya eliminado**. El `Extract<…, {type:'resource-per-spoke'}>` resolvía a `never`, así que `.every()` sobre el array filtrado (vacío) pasaba en vacío — un check que no verificaba nada | quitado el check vacío y `resource-per-spoke` de `LIVE_TYPES` | tools/verify-doctrine-hub.ts |

**DoD S-D cumplido**: `tsc` limpio · **17/17** verify (el runner hace glob de `verify-*.ts`,
recoge el nuevo solo) · **148** unit tests verdes. Añadir un miembro a cualquiera de las dos
uniones sin cablear su aplicación ahora rompe `npm run verify`.

### Dudosos / fuera de alcance — NO implementados

| # | Hallazgo | Por qué no |
|---|---|---|
| D20 | Traits de legado / features únicas de provincia / governors NO usan una unión de efecto-tipo tabulada (son mods bespoke en `adapter.ts` / `province.ts`). El verificador de contrato no les aplica tal cual | El plan los listaba, pero su «contrato» no es un switch tipo→efecto; tabularlos es un refactor mayor sin bug actual. Anotado como extensión futura |
| D21 | Pendiente transversal: sincronizar la tabla de auditoría de `sistemas-del-juego.html` con que el contrato ahora tiene guarda automática | Doc, no código; siguiente vuelta o cuando se toque ese doc |

## Iteración 14 — 2026-06-13

Foco: **S-M · Passive «Deus Vult» de Innocent** — efecto real (decisión de diseño del
usuario: «diseñar un efecto real»). Era `description: 'Effect to be defined.'`, placeholder
sin código detrás.

### Decisión de diseño clave (resuelta en la implementación)

El efecto aprobado se redactó como «doctrinas rojas/religiosas», pero **Innocent es facción
`gold`** y el color-lock le impide equipar doctrinas **rojas** (un comandante equipa su color
+ blanco). Si Deus Vult escalara con rojas, **nunca dispararía** para Innocent. La única
lectura coherente: escala con sus doctrinas de **fe = gold** (Faith/Miracles/Pantheon…), que
es exactamente su escuela. Implementado así.

### Implementados

| # | Hallazgo / entrega | Detalle | Archivos |
|---|---|---|---|
| 31 | **Deus Vult vivo**: +1 moral pre-batalla por doctrina de fe (gold) equipada, cap +3 | Helper testeable `getEquippedColorCount(color)` en doctrine-store; nuevo param `passiveMoraleBonus` en `buildPlayerSeed` (sumado dentro del `clampMorale` 0–15, mismo patrón que el `statMult` de Veteran Stacks); cálculo en `BattleModal` gated por `archetype === 'Religious'`, pasado a ambos call sites (seed0 + playerSeedFor). `description` y bullet de starting-bonus reescritos a lo real | doctrine-store.ts, adapter.ts, BattleModal.tsx, commanders.ts |
| 32 | Tests: moral con `passiveMoraleBonus` (suma + clamp a 15) en adapter.test; `getEquippedColorCount` (cuenta por color, ignora nulls, 0 sin equipar) en equipped-color.test (nuevo) | 151 unit tests verdes (+3) | adapter.test.ts, equipped-color.test.ts (nuevo) |

**DoD S-M cumplido**: `tsc` limpio · 17/17 verify · 151 unit tests · elegir a Innocent cambia
mediblemente la moral inicial según las doctrinas de fe equipadas; texto honesto. Marcado
hecho en `estado-desarrollo.html` (tag ③) y `docs/loop-prompt.md`.

### Observación (no implementada)

| # | Observación | Por qué no |
|---|---|---|
| D22 | El passive solo aplica en la batalla decisiva de Iter Belli (donde se construye el `PlayerSeed`). No hay otra batalla en el loop vivo, así que la cobertura es total hoy; si se añaden escaramuzas con seed propio, recablear ahí también | Sin batalla extra hoy; nota para escenarios futuros |
