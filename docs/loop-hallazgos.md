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

## Iteración 15 — 2026-06-13

Foco: **S-L · Diplomacia sencilla (aliados)** — decisión de diseño del usuario: implementar
diplomacia simple vía decretos/doctrinas; tribus→soldados, reinos→oro; contador visible;
arreglar el passive muerto de Augustus.

### Decisión de arquitectura

El sistema `npc-faction-store` existente (4 facciones fijas con relación hostil/neutral/amiga)
es **narrativo y estático** — no encaja con «ganar aliados tribu/reino por carta con pago por
temporada». En vez de sobrecargarlo, creé un **store dedicado y claramente separado**
(`ally-store.ts`) y repunté a Augustus ahí. El npc-faction-store queda intacto (flavor).

### Implementados

| # | Hallazgo / entrega | Detalle | Archivos |
|---|---|---|---|
| 33 | **Ally-store**: modelo tribu/reino, `allyCount`, `addAlly`, `collectAllyIncome` (tribu→+2 iuniores, reino→+2 oro/temporada), reset | store dedicado + computed + nombres temáticos por tipo | ally-store.ts (nuevo) |
| 34 | **Adquisición vía carta** (lenguaje de cartas, sin pantalla nueva): nuevo efecto de decretum `gain-ally` (allyKind), **registrado en verify-effects** (el guard de S-D lo exigió — validación end-to-end del contrato) y cableado en decretum-hub (toHubEffect/applyHubEffect/describe). Repurpose de 2 cartas azules: **Foedus Amicitiae**→reino, **Vox Exploratoris→Foedus Gentium**→tribu | el repurpose de Explorator mata de paso un **duplicado exacto** (Explorator==Spy, ambos reveal-99) sin perder funcionalidad; conteo 33 intacto | decretum.ts, decretum-hub.ts, decretum-data.ts, verify-effects.ts |
| 35 | **Pago por temporada** enganchado en el cierre de campaña (mismo loop que el income provincial, ×spokeDuration) | tribu→iuniores, reino→oro | EndgameCard.tsx |
| 36 | **Augustus «Web of Alliances» ya REAL** (era texto-mentira: el passive no estaba cableado): cada alianza forjada aporta un contingente aliado (HP `+500/u` + stats del `ALLY_COHORT_POOL`) al `PlayerSeed`, gated por `archetype === 'Diplomat'`. Reusa `pickAllyCohort`, scaffolding que estaba muerto | descripción del passive reescrita a lo real | BattleModal.tsx, commanders.ts |
| 37 | **Visibilidad**: medidor «Allies» en el TreasuryPanel del Foro (4º hueco del grid 2×2, icono cat-diplomacia) | siempre visible en el hub | TreasuryPanel.tsx |
| 38 | **Persistencia**: `forgedAllies` en meta-save (snapshot/restore/normalize, opcional para back-compat) + reset en startNewRun/resetRun | una alianza forjada sobrevive a recargas | meta-save.ts, game-state.ts |
| 39 | Tests: ally-store (6: vacío, addAlly por tipo, ids únicos, income tribu/reino, reset) | 157 unit tests verdes (+6) | ally-store.test.ts (nuevo) |
| 40 | Doc: nota de diplomacia/aliados en `sistemas-del-juego.html` | sistema live documentado | sistemas-del-juego.html |

**DoD S-L cumplido**: se gana/ve aliados; tribus→iuniores y reinos→oro tienen efecto real cada
temporada; Augustus ya no miente (passive cableado); `tsc` · 157 tests · 17/17 verify verdes.

### Dudosos / deferidos

| # | Observación | Por qué no |
|---|---|---|
| D23 | El pago de aliados solo se cobra al cerrar una campaña (loop de `collectProvinceIncome` en EndgameCard). Si en el futuro el hub gana un tick de temporada fuera de campaña, enganchar `collectAllyIncome` ahí también | Hoy la única fuente de avance de temporada es el cierre de campaña; cobertura total |
| D24 | Adquisición solo vía 2 decretos azules (Augustus-color). Otros comandantes pueden castear los blancos pero estos son azules → solo Augustus/blancos los lanzan. Ampliar con cartas blancas o doctrina de alianzas si se quiere democratizar | «Empezar simple» — el sistema está, ampliar es trivial |
| D25 | `allianceCount`/`allies`/`enemies` (game-state, derivados de npc-faction-store) siguen vivos como flavor narrativo paralelo al nuevo `allyCount`. Dos nociones de «alianza» coexisten | Refactor de unificación > beneficio; documentado para no confundir |

## Iteración 16 — 2026-06-13

Foco: **S-I · Onboarding y legibilidad** (parcial) — rebanada de **tooltips de fórmula en
batalla**. El desglose del income en provincias YA EXISTÍA (`IncomeLedger`), así que esa parte
del DoD estaba cubierta.

### Decisión de alcance / honestidad

S-I pide «desglose del daño esperado por orden (stat × dado × mult)». Un número de daño esperado
que NO coincida exacto con el resolver sería un **nuevo texto-mentira**. Por eso: (a) solo se
estima para las órdenes de daño **incondicional** push/harass/siege — charge depende de si el
enemigo aguanta (orden oculta) y move de un check de dado, así que no llevan número; (b) el
estimador es un **espejo read-only del resolver** y un test lo **pina contra el daño real** que
`resolveOrder` aplica al mismo dado → no puede divergir.

### Implementados

| # | Hallazgo / entrega | Detalle | Archivos |
|---|---|---|---|
| 41 | **Daño esperado por orden** en la barra de batalla: chip «≈N daño» en push/harass/siege | `orderDamageAtDie`/`expectedOrderDamage`/`expectedDie` en resolver.ts (espejo exacto de la fórmula: stat × dado × mult × discBonus × moraleMult × (1+centro) × DMG_SCALE, luego mitigate/guard según la orden). Dado medio = (1+(6+tier))/2. Surfaceado en OrderBar como chip verde | resolver.ts, OrderBar.tsx |
| 42 | **Test de consistencia** (clave anti-mentira): para un dado fijo, el estimador == daño real que `resolveOrder` quita al defensor (push con/ sin armadura+fortín, harass, siege que perfora); charge y órdenes de moral → 0 | 163 unit tests verdes (+6) | damage-estimate.test.ts (nuevo) |
| 43 | Doc: chip de daño esperado añadido al wireframe de la arena de batalla | wireframes.html sincronizado | wireframes.html |

**Entregado del DoD S-I**: legibilidad de fórmulas (batalla = chip de daño honesto; income =
ledger ya existente). `tsc` · 163 tests · 17/17 verify verdes.

### Pendiente de S-I (próximas vueltas)

| # | Pendiente | Nota |
|---|---|---|
| — | **Tutorial contextual** (primera visita a cada pestaña → 2-3 tooltips; primera campaña → upkeep/amenaza/plazo). El icono nav-tutorial ya existe | Requiere estado de «primera vez» persistido — pieza más grande, propia iteración |
| — | **Estados vacíos** consistentes en Consilium/Doctrinae | Pieza pequeña y segura |
| D26 | **3 cómputos paralelos de income** en ProvinciaeTab (`getNetGoldIncome` :1301, tooltip de inversión :1746, `IncomeLedger` :2370) — mismo patrón display-vs-spend que el loop ya cazó 3 veces. Candidato a consolidar en un helper único | Refactor; fuera del alcance de S-I, anotado para una vuelta de blindaje |

## Iteración 17 — 2026-06-13

Foco: **cerrar S-I** — la pieza de **tutorial contextual**. (Tooltips de fórmula = it.16;
desglose de income = ya existía; estados vacíos = ya existían en Consilium/Doctrinae.)

### Hallazgo: la UI de tutorial estaba MUERTA

El flag `tutorialDismissed` (persistido en meta-save) y el botón «Show Tutorial» del Sidebar
existían, pero **no había overlay** — se borró al deprecar Bellum (S34-03 era el tutorial de
Bellum). Consecuencia: el flag arrancaba en `false` y **nada lo ponía en `true`** (sin overlay
que lo descartara), así que el botón re-trigger (gated en `=== true`) **nunca aparecía**. Toda
la cadena estaba huérfana.

### Implementados

| # | Hallazgo / entrega | Detalle | Archivos |
|---|---|---|---|
| 44 | **`TutorialOverlay.tsx`** — tutorial de primera ejecución para el main loop actual: 3 pasos (bienvenida/el bucle → las 6 pestañas del Foro con icono+descripción → Iter Belli: upkeep/amenaza/plazo). Dots de paso, Atrás/Siguiente/Comenzar/Saltar | revive el flag + botón existentes; «Comenzar»/«Saltar» → `setTutorialDismissed(true)` (persiste); el botón del Sidebar lo reabre | TutorialOverlay.tsx (nuevo) |
| 45 | **Montaje condicional en ForumShell** (`{!tutorialDismissed.value && <TutorialOverlay/>}`) en vez de early-return interno | bug de UX que cacé en vivo: devolver `null` NO desmonta en Preact → el `useState(step)` persistía y al reabrir mostraba el último paso. Con montaje condicional el estado resetea al paso 0 | ForumShell.tsx |

**Validación en vivo (Playwright, punta a punta)**: primera carga del Foro → overlay en paso 0;
avance por los 3 pasos; «Saltar»/«Comenzar» persiste `tutorialDismissed=true` (leído de
localStorage `imperium-meta-save`); recarga → overlay oculto + botón «Show Tutorial» visible;
re-trigger → reabre en el paso 0; **0 errores de consola**.

**DoD S-I cumplido (completo)**: legibilidad de fórmulas + tutorial de primera ejecución +
estados vacíos. `tsc` · 163 tests · 17/17 verify · validado en vivo. wireframes.html sincronizado.

### Nota de proceso

Sin unit test para el overlay (componente presentacional puro); la validación correcta aquí es
el smoke-test en vivo, que además cazó el bug del estado de paso no-reseteado — un test unitario
no lo habría pillado. Patrón: para UI con estado de montaje, validar en runtime.

## Iteración 18 — 2026-06-13

Foco: **S-J · Telemetría de playtest** (la parte codeable; las 10+ runs son playtest humano).

### Hallazgo: el sistema de historial de runs estaba SIN CABLEAR

`RunRecord`, `runs[]`, `computeScore`, `getBestRun`, `victories`, `highScore`, `commanderWins`
existían en meta-save pero **nada los poblaba** — `recordRunStart` incrementa el contador de
inicio, pero **ninguna función registraba la finalización**. Otro sistema huérfano (como el
tutorial en it.17). En vez de revivir el RunRecord whole-run (semántica de «fin de run» difusa),
añadí telemetría **por-campaña** (límite bien definido: la fase `endgame`), que además sirve
mejor a las preguntas de balance de la auditoría (¿se usa siege? ¿el plazo fuerza decisiones?).

### Implementados

| # | Hallazgo / entrega | Detalle | Archivos |
|---|---|---|---|
| 46 | **`run-telemetry.ts`** — acumula cartas jugadas (conteo) y órdenes usadas (por clave de orden) por campaña; reset/snapshot | módulo-leaf sin señales (se lee una vez al cierre) | run-telemetry.ts (nuevo) |
| 47 | **Hooks de acumulación**: `tallyOrderUsed(order)` en `issueOrder` (controller), `tallyCardPlayed()` en `playCard` (state), `resetCampaignTelemetry()` en `startIterBelliCampaign` | 3 puntos, mínimos | controller.ts, iter-belli-state.ts |
| 48 | **`CampaignLogEntry` + `campaignLogs[]`** en meta-save (tipo, default, migración back-compat, `recordCampaignLog` cap 100, `exportCampaignLogsJson`) | registrado al cierre en `EndgameCard.returnToHub` con outcome/causa (`S.outcome.text`)/temporada/días/oro+iuniores finales/supervivientes/tallies | meta-save.ts, EndgameCard.tsx |
| 49 | **Export JSON** por botón en el modal de Opciones (`SettingsPanel`): descarga `imperium-telemetry-YYYY-MM-DD.json`; deshabilitado y «— vacío» sin logs | Blob + anchor download | SettingsPanel.tsx |
| 50 | Tests: tally/snapshot/reset + recordCampaignLog (orden most-recent-first, cap 100) + export JSON válido | 168 unit tests verdes (+5) | run-telemetry.test.ts (nuevo) |

**Validado en vivo**: botón «Descargar telemetría de campañas» renderiza en Opciones, muestra
«— vacío» y está deshabilitado sin logs; 0 errores de consola; HMR limpio. El path completo
campaña→log está cubierto por el `recordCampaignLog` testeado + el cableado de EndgameCard
validado por `tsc` (no jugué una campaña entera punta a punta — eso es el playtest humano de S-J).

**DoD S-J (infra) cumplido**: `tsc` · 168 tests · 17/17 verify. Sincronizado `sistemas-del-juego.html`
(fila de auditoría). El **playtest de 10+ runs + ajustes con datos queda como tarea humana**.

### Dudoso

| # | Observación | Por qué no |
|---|---|---|
| D27 | `cardsPlayed` es un conteo agregado, no por categoría/carta. Para análisis fino convendría tally por `def.id` o categoría, pero crece y «cartas jugadas» (conteo) cumple el DoD | Ampliable si el playtest lo pide |

## Iteración 19 — 2026-06-13

Foco: **S-K · Robustez de saves + release-readiness** — partes codeables (test de migración +
smoke del build). La pasada de perf queda anotada (refactor grande).

### Implementados

| # | Hallazgo / entrega | Detalle | Archivos |
|---|---|---|---|
| 51 | **Test de migración de saves** con fixtures reales en `tools/fixtures/` (el plan los pedía ahí): v1 (mínimo), v2 (con activeRun viejo), v3 (completo con campos nuevos). Cargados con **`?raw`** de Vite (string crudo = lo que `parseMetaSave` consume) — sin tipos de node, sin drift fichero↔test | cubre: v1/v2 defaultean los campos nuevos (campaignLogs/forgedAllies/tutorialDismissed), activeRun viejo se rellena (forgedAllies [], iuniores seedeado, equippedDoctrines [null×4]), v3 round-trip sin pérdida, y **entrada basura/null → save v3 limpio, nunca lanza** | meta-save-migration.test.ts (nuevo), tools/fixtures/meta-save-v{1,2,3-full}.json (nuevos) |
| 52 | **Smoke del build de producción**: `npm run build` verde (✓ ~3s, JS 590KB/150KB gzip, CSS 11KB). **Añadido al ritual del loop** (regla 6 del prompt: tsc + verify + build) | release-readiness | docs/loop-prompt.md |

**Decisión técnica** (`?raw` vs fs): el test vive en `src/` y se type-checkea con el tsconfig de
la app (`types: ["vite/client"]`, sin node), así que `node:fs` rompía `tsc`. Los imports `?raw`
de Vite leen el fichero real como string (tipado por vite/client) — lee los fixtures canónicos
sin duplicarlos ni depender de tipos de node.

**DoD S-K (saves+build) cumplido**: `tsc` · 172 tests (+4) · 17/17 verify · **build verde**.

### Dudoso / pendiente (refactor grande, fuera de alcance de una vuelta)

| # | Observación | Por qué no ahora |
|---|---|---|
| D28 | **Perf**: el build avisa chunk JS >500KB (sin code-splitting) y hay PNGs sin optimizar servidos tal cual: `roman_background` 3.5MB, `campaign-briefing-background` 2.3MB, `consilium_hero_bg` 2MB. Probablemente importados sin `vite-imagetools` (o en `public/`). Mover a `src/assets/` con `?format=avif;webp` + code-splitting por ruta recortaría MB. Auditar también RAF/listeners | **PARCIALMENTE RESUELTO (it. 20)** — ver abajo. Quedan code-splitting + iconos UI |

## Iteración 20 — 2026-06-13

Foco: rebanada acotada de **D28 (perf)** — optimización de los fondos PNG gigantes. (El backlog
S-A…S-K está completo salvo perf; esta es la pieza de menor riesgo y mayor MB-por-cambio.)

### Hallazgo

Tres fondos pesados en el build: `roman_background` (ya optimizado, `as=picture` AVIF/WebP — las
dos entradas PNG del build son solo fallbacks de ancho), pero **`campaign-briefing-background`
(2.2MB) y `consilium_hero_bg` (2.0MB) se importaban como PNG crudo sin imagetools** y se servían
enteros. Ambos se usan como `url(${import})` en CSS background → el cambio de import es transparente.

### Implementados

| # | Hallazgo / entrega | Detalle | Archivos |
|---|---|---|---|
| 53 | **Fondos a WebP vía vite-imagetools**: `?w=1920&quality=82&format=webp` en ambos imports | build: `consilium_hero_bg` 2.0MB→**81KB**, `campaign-briefing` 2.2MB→**132KB** (−94/96%). −~4MB en assets de producción | EmbarkCard.tsx, ConsiliumTab.tsx |
| 54 | **Shim de tipos** para el import URL-de-WebP (`declare module '*&format=webp'` → string), ya que el shim previo solo cubría `&as=picture` | la query debe TERMINAR en `&format=webp` para casar el glob | types/imagetools.d.ts |

**Validado en vivo (Playwright)**: tras iniciar un run, el fondo del EmbarkCard (Foro) y el hero
de Consilium **cargan correctamente** (1448×1086 y 1672px, `ok:true`), 0 errores de consola, sin
regresión visual. Nota: en **dev** vite-imagetools sirve el PNG original (por velocidad); el
**build de producción ya emite el WebP** (confirmado: el PNG de 2.2MB desapareció del bundle).

**DoD**: `tsc` · 172 tests · 17/17 verify · **build verde** (fondos WebP en el bundle).

### Pendiente de D28 (refactor mayor, próximas vueltas)

| # | Observación | Por qué no ahora |
|---|---|---|
| D28b | **Code-splitting**: chunk JS único de 590KB (>500KB). `import()` dinámico por pantalla (Battle/Forum/Title) o `codeSplitting` de rolldown | Riesgo de romper el arranque; necesita validar carga de cada ruta |
| D28c | ✅ **RESUELTO (it. 21)** — ver abajo: `defaultDirectives` en vite.config transcodea todos los iconos a WebP de una vez |

## Iteración 21 — 2026-06-13

Foco: **D28c (perf)** — los muchos iconos UI PNG pesados (~280–400KB c/u, decenas).

### Solución de un solo cambio (sin editar 60+ imports)

En vez de añadir `?format=webp` a cada import de icono, configuré **`defaultDirectives`** en
`vite-imagetools` (`vite.config.ts`): todo import bajo `assets/ui/icons/` o `assets/ui/resources/`
recibe `format=webp&quality=85` por defecto. Los imports con directivas explícitas (fondos
`as=picture`/`?format=webp`) las sobrescriben; rutas no-icono no reciben nada. Los imports siguen
siendo `'...png'` planos → **tipos intactos** (vite/client `*.png` → string), sin shim.

**Format-only (sin resize) a propósito**: `GameIcon` acepta tamaños numéricos hasta `size={300}`,
así que un cap de ancho habría emborronado los iconos grandes. Sin resize, la resolución se
preserva (verificado en vivo: `naturalWidth` 768px) y aun así WebP recorta el peso.

### Implementados

| # | Hallazgo / entrega | Detalle | Archivos |
|---|---|---|---|
| 55 | **Todos los iconos UI → WebP por config**: `defaultDirectives` scoped a icons/ + resources/ | build: nav-exercitus 324KB→44KB, delta-down 310KB→50KB, nav-next 305KB→50KB, stat-charge→76KB… **−75–86% por icono** (decenas de iconos + 17 recursos) | vite.config.ts |

**Validado en vivo (Playwright)**: tras iniciar un run, el Foro renderiza **31 imágenes, 0 rotas**;
los iconos se sirven vía `/@imagetools/<hash>` a 768px natural (resolución intacta); el retrato
(`/asset/` público) correctamente sin transformar; 0 errores de consola.

**DoD**: `tsc` · 172 tests · 17/17 verify · **build verde** (iconos WebP en el bundle). No se
regenera `iconos.html` (los PNG fuente en disco no cambian; el catálogo escanea la fuente).

### Pendiente de D28 (último resto)

| # | Observación | Por qué no ahora |
|---|---|---|
| D28b | **Code-splitting**: chunk JS único 590KB (>500KB). `import()` por pantalla o `codeSplitting` de rolldown. Auditar RAF/listeners | Riesgo de romper el arranque; necesita validar carga de cada ruta en vivo — propia iteración |

## Iteración 22 — 2026-06-13

**Modo barrido** (backlog codeable agotado): auditoría de los sistemas añadidos en las últimas
vueltas (ally-store, telemetría, EndgameCard) buscando bugs frescos.

### Implementados

| # | Hallazgo | Fix | Archivos |
|---|---|---|---|
| 56 | **`returnToHub` (EndgameCard) NO es idempotente y el botón «Volver al Hub» no tenía guard**: las líneas iniciales son incondicionales — `gold.value = s.gold`, `iuniores.value = s.iuniores`, `globalSeason += s.spokeDuration`, income provincial ×spokeDuration, income de aliados, conquista, draft, telemetría. Termina en `resetIterBelli()` (deja `outcome=null`, `gold=fallbackGold`). Un segundo disparo (doble-clic rápido antes de que el botón se desmonte) leería el estado RESETEADO y **pisaría el oro/iuniores del hub con los valores fallback** + avanzaría la temporada de más | `if (!outcome) return;` al inicio de `returnToHub` → idempotente. La primera llamada legítima siempre tiene outcome (el EndgameCard solo renderiza con `outcome`); tras el reset es null → no-op. `concludeBattleSession` (el otro botón one-shot) ya estaba guardado (`if (!s || !OPTS) return;`) | EndgameCard.tsx |

**Validación**: `tsc` · 172 tests · 17/17 verify · build verde. El guard es seguro por
construcción (la primera invocación siempre tiene outcome; la única llamada con outcome null es
una re-invocación tras el reset). No validado con doble-clic en vivo: llegar al endgame exige una
campaña entera (~15 pasos), desproporcionado para un guard de una línea cuya lógica es trivial.

### Falsos positivos verificados (no re-reportar)

- **Income de aliados vía `addResource`** (kingdom→gold, tribe→iuniores): `addResource` aplica
  War Profiteer (+50% solo a gold) e income-modifiers de doctrina. **NO es bug** — el tributo de
  aliados es income recurrente y «War Profiteer = +50% oro de todas las fuentes» encaja; los
  modifiers de income aplican legítimamente. Coherente con el modelo económico.
- **`concludeBattleSession`**: ya idempotente (`!s || !OPTS`).
- **Diluición de supervivientes por aliados de Augustus**: el HP de aliados se suma a `soldiers`
  Y a `initialSoldiers` por igual, así que el ratio de attrition se preserva razonablemente; los
  aliados «absorben» parte del daño — comportamiento aceptable/intencional, no bug.

## Iteración 23 — 2026-06-13

**Modo barrido**: rastreo del contrato de **descripción** de efectos de decretos (verify-effects
solo cubre los sitios de *aplicación*, no los de *render/describe*) tras añadir `gain-ally` (it.15).

### Hallazgo

`DecretumRenderer.tsx::effectSummary` tiene un switch sobre `e.type` con `default: '—'` que NO
cubre `threat-reduction`, `supplies-gain` ni `gain-ally` → esas cartas (Pax Empta, suministros,
las dos Foedus) renderizarían un guion en vez de su efecto. **PERO** `DecretumRenderer` (export
`DecretumCard`) y su gemelo `DoctrineRenderer` (export `DoctrineSlot`) son **código muerto**: cero
referencias a sus exports en todo `src/` (verificado por nombre de export, no de fichero),
commits viejos pre-loop, no en la lista de WIP de codex. La UI viva (DecretaTab/DoctrinaeTab)
renderiza sus propias cartas y describe los efectos vía `describeHubEffect` (actualizado en it.15
para gain-ally) + la `description` autorada → **correcta, sin el bug**.

### Implementados

| # | Hallazgo | Fix | Archivos |
|---|---|---|---|
| 57 | **Dos renderers de carta muertos** (`DecretumRenderer`/`DoctrineRenderer`), uno con un switch de efectos no-exhaustivo latente (3 tipos → «—»). Superados por las pestañas vivas DecretaTab/DoctrinaeTab que renderizan sus propias cartas | eliminados ambos ficheros — cero referencias, `tsc` limpio confirma cero rotura. Elimina superficie de mantenimiento + el bug latente de una sola vez | DecretumRenderer.tsx, DoctrineRenderer.tsx (borrados) |

**Validación**: `tsc` limpio tras el borrado (prueba de que nada los importaba) · 172 tests ·
17/17 verify · build verde. Reversible vía git si S-H los quisiera (improbable: S-H extendería
las pestañas vivas, no estos standalone).

### Falsos positivos verificados (no re-reportar)

- **DecretaTab (colección viva)**: describe los efectos con `describeHubEffect` + `d.description`
  → las cartas nuevas (gain-ally) se ven bien. No tiene el bug del switch.
- **DecretaBar (batalla)**: filtra por `hasBattleEffect` (línea 19) → los pergaminos hub-only
  (gain-ally/threat-reduction/supplies-gain) no se muestran en batalla. Correcto.
- **`isCastableAtHub` para gain-ally**: no es campaign-only, castable en el hub, `addAlly` aplicado
  vía `applyHubEffect`. Cableado correcto (ya cubierto por verify-effects en it.13/15).

## Iteración 24 — 2026-06-13

**Modo barrido**: seguimiento del sistema de historial de runs (notado parcialmente en it.18) +
smoke en vivo del flujo de campaña tras los cambios de telemetría/meta-save de it.13-23.

### Smoke en vivo (sin regresión)

Title → Warlord → Foro → **Embark** → campaña (#iterbelli, «Marcha de guerra en Hispania»,
misión «Asalto — vence en 8 días») → jugar carta **Acampar**: **0 errores de consola**. El flujo
de campaña sigue sano tras los hooks de telemetría añadidos a `playCard`/`issueOrder` (it.18).

### Hallazgo (ítem de DECISIÓN, no fix — clase D10/D11)

**El sistema de historial de runs está DOBLEMENTE muerto**: `RunRecord`, `runs[]`, `victories`,
`highScore`, `commanderWins`, `computeScore`, `getBestRun`, `hasCommanderWon` — **nada los puebla**
(ninguna función registra la finalización de un run; `recordRunStart` solo incrementa
`totalRunsStarted`, también sin lectores) **Y nada los consume** (cero referencias vivas a
`getBestRun`/`hasCommanderWon`/`victories`/`highScore`/`commanderWins`/`runs` en `src/`).

| # | Decisión pendiente | Por qué NO lo toco en el loop |
|---|---|---|
| D29 | **¿Implementar una pantalla de récords/estadísticas o recortar el scaffolding de run-records?** Es infraestructura del **save** (`MetaSave.runs/victories/highScore/commanderWins` + migración v1/v2/v3). Plausiblemente scaffolding para un futuro Title con «High Score / mejor run / comandantes ganados». Recortarlo toca el schema del save y la migración (riesgo) y podría tirar trabajo intencional; implementarlo exige decidir la semántica de «fin de run» (difusa: ¿temporada máxima? ¿victoria final? ¿abandono?) | Save schema + decisión de diseño del usuario, igual que D10 (eventos) / D11 (facciones). El loop no recorta save-infra ni inventa semántica de fin-de-run sin spec |

**Recomendación al usuario**: si se quiere una pantalla de récords, hay que (a) decidir qué cuenta
como «run completado», (b) cablear un `recordRunComplete(outcome)` en ese punto, (c) consumir
`getBestRun`/stats en el Title o un modal. Si no, recortar los 4 campos del save + helpers. La
telemetría por-campaña (S-J, it.18) ya cubre el análisis de balance, que era el uso prioritario.

### Dudoso menor (no implementado)

| # | Observación | Por qué no |
|---|---|---|
| D30 | **Telemetría infracontada en campañas recargadas**: `resetCampaignTelemetry` solo corre en `startIterBelliCampaign`, no en `restoreIterBelli`. Un reload a mitad de campaña deja los contadores (módulo) en 0, así que el `CampaignLogEntry` final pierde las cartas/órdenes pre-reload | Edge case (la mayoría de campañas no se recargan a mitad); persistir los contadores en el save es scope-creep para beneficio marginal. Anotado por si el playtest lo necesita |

## Iteración 25 — 2026-06-13

**Modo barrido**: auditoría doc-vs-código del **sistema de eventos pasivos** de Iter Belli
(sistema-de-eventos.html, el deep-dive «por qué bajó la moral»).

### Verificado en sync (no-issue)

Cruce de TODOS los números del doc contra `iter-belli-balance.ts`: upkeep −2/día, hambre
(−1 moral, −2% desertores), motín (<3, 30%, −5%), escaramuza (≥7, 50%, −0.5), emboscada
(≥5, 30%, −1.5, 6%), acampar (+0.5). **Todos coinciden.** Condiciones también: escaramuza requiere
territorio enemigo, emboscada requiere bosques — el código las enforce. Conteo de cartas: 38 = 38.

### Hallazgo: `truceTurns` es un mecanismo MUERTO (y el doc lo describía como vivo)

`truceTurns` (campo de estado + serialización en el save + decremento + 2 guards) existía, pero
**ningún sitio en `src/` lo asigna a un valor positivo** — ninguna carta/evento otorga tregua.
Resultado: el decremento nunca corre, y los guards `S.truceTurns === 0` eran **siempre true**
(no-ops). El doc lo describía como un paso vivo de la secuencia de turno («cuenta atrás de tregua»)
y de la amenaza pasiva («en tregua = 0; si no, cada turno») → texto-mentira (mecanismo que no
puede dispararse).

### Implementados

| # | Hallazgo | Fix | Archivos |
|---|---|---|---|
| 58 | **Mecanismo de tregua muerto** (`truceTurns` nunca otorgado) + doc que lo describía como vivo | Eliminado el campo, el decremento, los 2 guards (`=== 0` siempre true → desenvueltos) y la serialización save/restore. **Preservador de comportamiento** (truce siempre 0 → los guards ya estaban en estado «sin tregua»). Doc corregido: la amenaza pasiva aplica «cada turno», sin paso de tregua | iter-belli-state.ts, iter-belli-types.ts, iter-belli-save.ts, sistema-de-eventos.html |

**Validación**: `tsc` limpio · 172 tests · **17/17 verify (incl. verify-iter-belli-save** → save
round-trip íntegro tras quitar el campo) · build verde. Cero referencias a `truce` restantes.
Reversible vía git si se quisiera implementar una carta «negociar tregua» (re-añadir el campo +
un setter es trivial — pero entonces SÍ debe dispararse y documentarse de verdad).

## Iteración 26 — 2026-06-13

**Modo barrido** (continuación del patrón it.25): barrido de campos de estado por si otro está
muerto como `truceTurns`. Verificados vivos: `fortified`, `ambushDetected`, `enemyWeaken`,
`brokenCommitments` (todos escritos Y leídos). Uno muerto encontrado:

### Hallazgo: `spokesSinceLastBattle` es un contador SIEMPRE-0 (residuo del Veteran Stacks original)

`spokesSinceLastBattle` (signal en game-state + serializado en `ActiveRunSave`) **nunca se
incrementa**: todas sus escrituras son `= 0` (reset en startNewRun/resetRun/EndgameCard-victoria),
y su valor **solo se serializa, nunca se lee para ninguna lógica/display**. Es residuo del diseño
ORIGINAL de Veteran Stacks («pierdes stacks tras 3 spokes sin batalla»), que it.2 ya redISEÑÓ a
«+5% por victoria, se rompe al perder» — la descripción se corrigió entonces (commanders.ts +
docs), pero el contador muerto + su serialización quedaron. Mismo patrón que `truceTurns` (it.25).

### Implementados

| # | Hallazgo | Fix | Archivos |
|---|---|---|---|
| 59 | **Contador `spokesSinceLastBattle` muerto** (siempre 0, nunca leído) | Eliminado el signal, sus 3 resets, y su serialización completa en meta-save (import, campo de `ActiveRunSave`, migración, snapshot, restore). **Preservador de comportamiento** (siempre 0). Saves viejos: el campo extra se ignora en restore | game-state.ts, meta-save.ts, EndgameCard.tsx |

**Validación**: `tsc` limpio · 172 tests (incl. `meta-save-migration.test`) · 17/17 verify · build
verde · cero referencias restantes. Docs ya correctos (it.2 dejó la descripción de Veteran Stacks
en la versión redISEÑADA, sin mencionar este contador) → sin sync de docs.

### Nota de patrón (3 iteraciones)

Tres mecanismos huérfanos seguidos eliminados: renderers muertos (it.23), `truceTurns` (it.25),
`spokesSinceLastBattle` (it.26). Son residuos de rediseños previos (S-B Veteran Stacks, sistemas
de batalla deprecados). El save acumula campos siempre-default; cada uno es behavior-preserving de
quitar. **Candidato futuro**: un `verify-save-fields.ts` que marque campos del save que nunca se
leen para lógica (solo se serializan) — cazaría esta clase automáticamente.

## Iteración 27 — 2026-06-13

**Modo barrido** (sigue el patrón de residuos de rediseño): barrido de los campos del tipo
`Commander`. Vivos (consumidos por CommanderSelectScreen): `strategicAbilities` (plural),
`uniqueUnits`, `victoryPaths`, `playstyleFocus`, `archetypeDescription`, `passive`. Muertos:

### Hallazgo: `strategicAbility`/`tacticalAbility` (singular) son datos muertos

El tipo `Commander` tenía DOS modelos de habilidad: el **singular** `strategicAbility`/
`tacticalAbility` (tipo `CommanderAbility`, con `cost`/`cooldown` — el modelo de gameplay
ORIGINAL) y el **plural** `strategicAbilities` (display: name/description/stars). Tras S-B
(habilidades → cartas firma con su propio cost/cooldown), el singular quedó **sin un solo lector
en `src/`/`tools/`** — solo se definía (8 bloques en los 4 comandantes) y se declaraba en el tipo.
El display usa el plural. Duplicado confuso (¿cuál es «la» habilidad?).

### Implementados

| # | Hallazgo | Fix | Archivos |
|---|---|---|---|
| 60 | **Campos `strategicAbility`/`tacticalAbility` muertos** (+ la interfaz `CommanderAbility`, huérfana al quitarlos) | Eliminados los 2 campos del tipo, los 8 bloques de datos (4 comandantes × 2) y la interfaz `CommanderAbility`. Behavior-preserving (cero lecturas). El display sigue usando `strategicAbilities` plural | commander.ts, commanders.ts |

**Validación**: `tsc` limpio · 172 tests · 17/17 verify · build verde · cero referencias restantes ·
ningún doc HTML los mencionaba (sin sync). Cuarto residuo de rediseño eliminado seguido
(renderers it.23, truce it.25, spokesSinceLastBattle it.26, abilities singulares it.27).

## Iteración 28 — 2026-06-13

**Modo barrido** (variando del dead-code a contrato-de-efectos): auditoría de los `special` de
**trade goods** y **features** — el hueco D20 (verify-effects cubre doctrinas/decreta, no estos).

### Hallazgo: `enables-building` era una MENTIRA VISIBLE (y se podía cumplir)

`TradeGoodSpecial` tiene 4 tipos, **todos descritos al jugador** (switch en ProvinciaeTab). Pero:
`unrest-reduction` y `build-cost-discount` se aplican; **`enables-building` NO** — el trade good
**Hierro** declara `enables-building: 'forge'` y la UI muestra «Enables Forge», pero
`getAvailableBuildings` solo miraba UNIVERSAL + terreno, ignorando el special → la promesa no se
cumplía (las provincias con Hierro no podían construir la Forge salvo en Hills). `pop-cap-bonus`
también se describía («+N max population») pero no lo usa ningún trade good Y no existe sistema de
cap de población (los slots salen de población vía SETTLEMENT.tiers; «food is the natural ceiling»).

### Implementados

| # | Hallazgo | Fix | Archivos |
|---|---|---|---|
| 61 | **`enables-building` no aplicado** (Hierro → Forge prometido pero no cumplido) | `getAvailableBuildings` ahora añade el edificio del special `enables-building` aunque el terreno no lo permita (con guarda anti-duplicado). El gate único es `buildInvestment` → `getAvailableBuildings(p).includes(type)`, así que con esto la Forge se construye de verdad en provincias con Hierro | province.ts |
| 62 | **`pop-cap-bonus` muerto** (sin data, sin sistema de cap, pero con caso de descripción que mentiría si se usara) | eliminado el miembro de la unión `TradeGoodSpecial` + su caso de switch + comentario stale | trade-goods.ts, ProvinciaeTab.tsx |
| 63 | Test: `enables-building.test.ts` (Hierro desbloquea Forge en terreno que no lo permite; sin duplicado en Hills; trade good no-enabler no añade nada) | 175 tests verdes (+3) | enables-building.test.ts (nuevo) |

**Validación**: `tsc` · 175 tests · 17/17 verify · build verde. Sync de la tabla de auditoría en
`sistemas-del-juego.html` (fila trade-goods · enables-building).

### Falsos positivos / dudosos

- **Feature specials `extra-event-choice`/`cavalry-bonus`/`unit-discount`**: usados en data
  (Oráculo de Delfos, etc.) pero NO aplicados Y **NO mostrados en UI** → datos latentes inertes,
  no mienten al jugador (el doc ya lo dice, línea 756). `extra-event-choice` necesitaría el
  sistema de eventos muerto (D10). Quedan como están (no son mentira visible). (D31)
- **D20 reabierto**: verify-effects sigue sin cubrir trade-good/feature specials. Extenderlo
  (parsear `TradeGoodSpecial`/`FeatureSpecial` y exigir sitio de aplicación) cazaría esta clase —
  candidato de blindaje futuro. → **RESUELTO it.29.**

## Iteración 29 — 2026-06-13

**Blindaje** (ejecutando el candidato D20 de it.28): extender `verify-effects.ts` para cubrir
las uniones `special` de provincia, de modo que la clase del bug `enables-building` se cace
automáticamente y para siempre.

### Implementado

| # | Entrega | Detalle | Archivos |
|---|---|---|---|
| 64 | **`verify-effects.ts` ahora cubre 4 uniones** (antes 2): + `TradeGoodSpecial` + `FeatureSpecial`. Nuevo concepto de entrada **`AppEntry` = aplicado (`files`) \| latente (`{latent:true}`)**: un tipo descrito pero no aplicado falla el guard SALVO que se marque latente con motivo documentado | TradeGoodSpecial: build-cost-discount/unrest-reduction/enables-building → todos aplicados (province.ts). FeatureSpecial: famine-immunity aplicado; extra-event-choice/cavalry-bonus/unit-discount → **latentes documentados** (inertes, no mostrados, esperan sistemas futuros). Mismo motor que doctrina/decreta: parseo de literales del type-source + check de `case/===` en el sitio + anti-stale + data-solo-tipos-declarados | tools/verify-effects.ts |

**Por qué importa**: el guard ahora habría cazado `enables-building` (it.28) en el commit que lo
introdujo — un trade-good special descrito pero sin sitio de aplicación habría fallado
`npm run verify`. La anotación `latent` evita falsos positivos en los inertes-por-diseño (D31)
mientras sigue exigiendo una decisión explícita (aplicar o marcar latente) para cada tipo nuevo.

**Validación**: `verify-effects` exit 0 (4 uniones) · `tsc` limpio · 175 tests · 17/17 verify ·
build verde. Plan S-D actualizado (ampliación documentada).

## Iteración 30 — 2026-06-13

**Blindaje + verificación** (último sistema de "efectos especiales" de D20 sin cubrir): los
**traits de gobernador**.

### Verificado en sync (no-issue)

Los 6 tipos de `GovernorTrait` (`income-bonus`, `expense-reduction`, `unrest-reduction`,
`population-growth`, `investment-discount`, `garrison-strength`) están **todos aplicados** en
province.ts (income / gastos / unrest / comida / descuento de inversión / multiplicador de unrest
del Castrum). Contrato limpio, **cero traits mentirosos**. `garrison-strength` se aplica de verdad
(×1.15/1.25/1.35 a la reducción de unrest del Castrum, no solo se filtra).

### Implementado (blindaje preventivo)

| # | Entrega | Detalle | Archivos |
|---|---|---|---|
| 65 | **`verify-effects.ts` cubre ahora 5 uniones** (+ `GovernorTrait`): los 6 traits registrados como aplicados en province.ts, data de `ALL_GOVERNORS` verificada usando solo tipos declarados | completa la cobertura del contrato de efectos de provincia (doctrinas + decreta + trade-good + feature + governor). Un trait de gobernador futuro sin sitio de aplicación fallaría `npm run verify` | tools/verify-effects.ts |

**Validación**: `verify-effects` exit 0 (5 uniones) · `tsc` limpio · 175 tests · 17/17 verify ·
build verde.

### Nota de cobertura

Uniones de efectos cubiertas por verify-effects: DoctrineEffect, DecretumEffect, TradeGoodSpecial,
FeatureSpecial, GovernorTrait. **Pendientes (no tabuladas / bespoke)**: efectos de trait de
**legado** (adapter.ts: random-rally/morale-bonus/stat-bonus — un mini-switch local, todos
aplicados) y `bonus.type` de **sinergias** de edificio (province.ts: unrest/gold/iuniores). Ambos
están vivos hoy; tabularlos en verify-effects es posible pero de valor marginal (switches locales
pequeños, tsc-exhaustivos de facto). Anotado, no urgente.

## Iteración 31 — 2026-06-13

**Honestidad + blindaje**: auditados los efectos de trait de **legado** (`LegateEffect`) — el
mini-switch de `legateSeedMods` NO es tsc-exhaustivo (`if (t.effect.type === …)`), así que un
tipo no manejado queda inerte en silencio.

### Hallazgo: descripciones mentirosas de `aggressive`/`cautious` (sistema deprecado)

Los traits de legado `aggressive` y `cautious` decían **«Battle begins with lieutenant order set
to 'Attack'/'Defend'»** — pero NO hay sistema de órdenes de lugarteniente en la batalla actual
(era del battle node-map deprecado). Su efecto `lieutenant-preset` es **inerte** (nadie lee el
`order`). Su efecto REAL: desbloquean las formaciones únicas **Cuneus** (aggressive→Shock) y
**Testudo** (cautious→Engineer) vía `TRAIT_TO_FORMATION_TRAIT` (por ID de trait, no por el efecto).
El doc de sistemas (línea 750) YA lo describía bien — solo las descripciones in-game mentían.

### Implementados

| # | Hallazgo | Fix | Archivos |
|---|---|---|---|
| 66 | **Descripciones mentirosas** (prometían órdenes de lugarteniente inexistentes) | Reescritas a lo real: «Unlocks the Cuneus/Testudo … formation (requires discipline 5)» | legate-traits.ts |
| 67 | **Comentario engañoso del tipo `lieutenant-preset`** («Preset the player's initial lieutenant order») | Reescrito: documenta que es INERTE (sin sistema de órdenes; el gating real es por ID de trait) | legate.ts |
| 68 | **Blindaje**: `LegateEffect` añadido a verify-effects (6ª unión) — stat-bonus/random-rally/morale-bonus aplicados en adapter.ts; `lieutenant-preset` latente documentado | + **endurecido el parser de uniones**: ahora quita comentarios antes de escanear (mi propio JSDoc con un `;` truncaba la unión — fragilidad latente que afectaba a cualquier unión con `;`/`{}`/`type:` en comentarios) | verify-effects.ts |

**Validación**: verify-effects exit 0 (**6 uniones**) · `tsc` limpio · 175 tests · 17/17 verify ·
build verde. Sin sync de doc (sistemas-del-juego.html:750 ya era correcto).

## Iteración 32 — 2026-06-13

**Blindaje (cierre)**: la última unión de efectos del juego, `SynergyBonus` (bonus de sinergias
de edificio).

### Verificado en sync (no-issue)

`SynergyBonus` tiene 5 tipos (`pwg`, `food`, `gold`, `unrest`, `unit-cost-discount`), **todos
usados en `SYNERGY_DATA` y todos aplicados**: gold/unrest/pwg/food en province.ts, unit-cost-discount
en province-store.ts (descuento de reclutar cohortes). Contrato limpio, **cero bonus mentirosos**.

### Implementado

| # | Entrega | Detalle | Archivos |
|---|---|---|---|
| 69 | **`verify-effects.ts` cubre ahora 7 uniones** (+ `SynergyBonus`): los 5 bonus registrados como aplicados (province.ts + province-store.ts), data de `SYNERGY_DATA` verificada | **completa la cobertura**: las 7 uniones de efecto-tipo tabuladas del juego están guardadas | tools/verify-effects.ts |

**Validación**: verify-effects exit 0 (**7 uniones**) · `tsc` limpio · 175 tests · 17/17 verify ·
build verde.

### Cierre del arco de blindaje de efectos (it.13, 29–32)

`verify-effects.ts` guarda ahora **las 7 uniones de efecto-tipo del juego**: DoctrineEffect,
DecretumEffect, TradeGoodSpecial, FeatureSpecial, GovernorTrait, LegateEffect, SynergyBonus.
**No quedan más uniones tabuladas que añadir** — los efectos restantes (advisor passives, etc.)
no usan una unión `type`-discriminada que el verificador pueda parsear; son lógica bespoke. El
contrato «texto promete / código aplica» está cerrado para todo efecto tabulado: añadir un tipo
sin aplicarlo (o marcarlo latente) falla `npm run verify`.

## Iteración 33 — 2026-06-13

**Fix de calidad de datos**: D30 (anotado it.25) — la telemetría de campaña se infracontaba en
recargas a mitad. Relevante para que el playtest de S-J (tarea humana pendiente) produzca datos
fiables.

### Hallazgo (D30)

`run-telemetry.ts` guarda `cardsPlayed`/`ordersUsed` como estado de **módulo**, reseteado solo en
`startIterBelliCampaign`. En una **recarga a mitad de campaña**, el estado de módulo vuelve a 0
(JS fresco) pero `restoreIterBelli` restaura la campaña → el `CampaignLogEntry` final perdía todas
las cartas/órdenes jugadas antes del reload. Infracontaba justo las runs que un playtester recarga.

### Implementados

| # | Hallazgo | Fix | Archivos |
|---|---|---|---|
| 70 | **Telemetría infracontada en recargas** (D30) | `restoreCampaignTelemetry(snap)` en run-telemetry; la telemetría se **serializa en el save de campaña** (`IterBelliSave.telemetry`, opcional para back-compat) y se **rehidrata en `restoreIterBelli`**. Saves pre-D30 sin el campo → resetea a 0 | run-telemetry.ts, iter-belli-save.ts |
| 71 | Test: round-trip de `restoreCampaignTelemetry` (rehidrata del snapshot; `undefined` → limpio) | 176 tests verdes (+1) | run-telemetry.test.ts |

**Validación**: `tsc` limpio · 176 tests · **17/17 verify (incl. verify-iter-belli-save** → save
round-trip íntegro con el campo nuevo) · build verde. Doc de telemetría sincronizado
(sistemas-del-juego.html).

## Iteración 34 — 2026-06-13

**Smoke de integración en vivo** (Playwright): tras ~20 iteraciones de cambios sin una validación
end-to-end conjunta, jugar el flujo real para confirmar que todo integra. (El backlog codeable de
hallazgos está agotado; esto es verificación, no cambio.)

### Validado en vivo (sin regresión)

Save limpiado → **Title → Boudicca → Foro → Embark → Campaña** (#iterbelli, «Marcha de guerra en
Hispania», misión «Asalto en 8 días», 3400 soldados, track Frontera→Tarraco→Llanura→Bosques→Sagunto)
→ **jugar carta Acampar**: suministros 28 → **24** (−4, exacto al coste de la carta). El flujo
`playCard` (con el hook de telemetría `tallyCardPlayed` de it.18) y el render de la campaña
funcionan. **0 errores de consola** en toda la cadena.

### Limitación honesta

No se llegó al endgame por Playwright: las cartas del pool son `OperationCard` (divs con cursor
custom oculto), difíciles de dirigir de forma fiable por scraping del DOM. El path
**endgame → recordCampaignLog → returnToHub (guard) → telemetría persistida** queda cubierto por
unit tests (it.18 grabación, it.22 guard idempotente, it.33 round-trip de telemetría) y lógica
demostrablemente correcta — no re-validado en vivo aquí. Nota de proceso: para validar el endgame
en vivo haría falta un helper de test que exponga `playCard`/avance, o conducir la batalla decisiva
(muchos pasos frágiles).

### Resultado

Integración sana: el bucle principal (menú → hub → embark → campaña → jugar cartas) corre sin
errores tras los cambios de it.13–33. Sin cambio de código.

## Iteración 35 — 2026-06-13

**Cobertura nueva** (cierra el hueco de it.34): test de integración **headless** del flujo de
campaña — el path que Playwright no pudo conducir (cartas = OperationCard divs).

### Hallazgo

Ningún test conducía `startIterBelliCampaign`/`playCard` — el **bucle central de campaña** (sembrar
→ jugar carta → endTurn → upkeep → refill → telemetría) estaba **sin cobertura**. Los tests de
iter-belli existentes son unitarios estrechos (munición, decreta, disciplina, save, escenarios).

### Implementado

| # | Entrega | Detalle | Archivos |
|---|---|---|---|
| 72 | **`campaign-flow.test.ts`** — integración headless del bucle de campaña contra la máquina de estado real | 3 casos: (a) seed → pool poblado, turnNum 0, fase campaign; (b) jugar carta no-crisis → telemetría `cardsPlayed`=1, `turnNum`+1, `timeRemaining` baja, carta consumida del pool; (c) conducir 5 turnos sin crash → soldados ≥0, moral ∈[0,15], suministros finitos, tally == cartas jugadas | campaign-flow.test.ts (nuevo) |

**Por qué importa**: ejercita end-to-end `playCard → endTurn` (con el hook de telemetría de it.18 y
el upkeep pasivo) de forma fiable y permanente — donde el smoke de Playwright (it.34) solo pudo
jugar UNA carta. Una regresión en el bucle de campaña ahora falla `npx vitest`.

**Validación**: `tsc` limpio · **179 tests** (+3) · 17/17 verify · build verde. Sin cambio de
lógica (solo test) → sin sync de docs de referencia.

### Nota de cierre

El path que queda sin cubrir en vivo/headless es la **batalla decisiva + endgame + returnToHub**
(acoplados a la UI: BattleModal construye el seed y EndgameCard llama a recordCampaignLog). Sus
piezas están unit-testeadas (it.18/22/33 + el sim de batalla de it.6/8). Un test de integración
de ese tramo exigiría extraer la lógica de returnToHub de la UI — refactor, no urgente (D32).

## Iteración 36 — 2026-06-13

**Cobertura nueva (continuación de it.35)**: extiende el test de integración de campaña al
**puente batalla → campaña** (`applyBattleOutcome` → `finishCampaign` → endgame), el siguiente
tramo del bucle que estaba sin test.

### Implementado

| # | Entrega | Detalle | Archivos |
|---|---|---|---|
| 73 | **`applyBattleOutcome` cubierto** en campaign-flow.test (3 casos nuevos) | (a) **victoria** → finished/endgame, `outcome.victory` true, soldados = supervivientes, bonus de oro aplicado; (b) **derrota** → endgame, `outcome.victory` false, soldados = supervivientes; (c) **clamps** → supervivientes negativos → 0, moral >15 → clampada a [0,15] | campaign-flow.test.ts |

**Por qué importa**: cierra el puente lógico batalla→campaña (cómo el resultado de la batalla
decisiva termina la campaña y escribe el outcome). Junto a it.35 (bucle de cartas), la **máquina
de estado de campaña está ahora cubierta end-to-end** salvo el `returnToHub` de la UI (D32:
recursos de vuelta al hub + recordCampaignLog + draft — acoplado a EndgameCard).

**Validación**: `tsc` limpio · **182 tests** (+3) · 17/17 verify · build verde. Test-only.

### Cobertura de campaña tras it.35–36

`startIterBelliCampaign` → `playCard`/`endTurn` (upkeep, refill, telemetría) → `applyBattleOutcome`
→ `finishCampaign`/endgame: **todo bajo test de integración headless**. El único tramo sin cubrir
es la UI `EndgameCard.returnToHub` (D32, requiere extracción de la UI).

## Iteración 37 — 2026-06-13

**Decisión de no-refactor + cobertura segura.** Evalué D32 (extraer `returnToHub` para testearlo)
y decidí **NO hacerlo unilateralmente**: al leer la función completa, entremezcla lógica de juego
con concerns de UI (`addNotification`, `navigateTo`); extraerla limpio exige aceptar una violación
de capas game→UI o plumbing de retorno — un refactor no trivial de **código crítico que funciona**
(validado en vivo it.34) y que **no puedo re-validar end-to-end en vivo** (la limitación de it.34).
Riesgo > valor para un cambio autónomo. Queda para OK del usuario.

En su lugar, una adición de cobertura segura que avanza el espíritu de D32:

### Implementado

| # | Entrega | Detalle | Archivos |
|---|---|---|---|
| 74 | **`conquerProvince` cubierto** (sub-paso de victoria de `returnToHub`, sin tests) — 4 casos | añade provincia nombrada al run y la devuelve; **escala gains→income per-spoke** (÷duration, mín 1: gold 8/4=2, iuniores floored a 1); respeta override de terreno/trade-good; cada conquista añade una provincia distinta | conquer-province.test.ts (nuevo) |

**Validación**: `tsc` limpio · **186 tests** (+4) · 17/17 verify · build verde. Test-only.

### D32 — pendiente de decisión del usuario

Extraer `EndgameCard.returnToHub` a una función testeable (`concludeCampaign()`) cerraría el último
tramo del bucle (recursos de vuelta + recordCampaignLog + draft + conquista + XP). Es viable
(mover ~100 líneas verbatim + el guard de idempotencia de it.22), pero toca el camino crítico de
vuelta al hub y mezcla UI/lógica. **Recomendación**: hacerlo solo con confirmación, e idealmente
poder validar un endgame en vivo después. Cobertura actual del sub-paso de conquista ya añadida.

## Iteración 38 — 2026-06-13

**Blindaje (corrige una omisión de it.32)**: `AdvisorPassive` — la **8ª** unión de efectos
tabulada, que omití al declarar "cobertura completa" en it.32.

### Hallazgo

`AdvisorPassive` (11 tipos) se mapea a deltas del seed en `passiveModifier` (iter-belli-consilium),
con `shop-discount`/`loot-bonus` agregados aparte en council-store. Crucialmente, `passiveModifier`
tiene un **`default: return z` permisivo** → un tipo de pasiva nuevo quedaría **silenciosamente
inerte** (no aportaría deltas), justo la clase que verify-effects guarda. Los 11 están manejados
hoy, pero sin guard. Además it.32 declaró "no quedan uniones tabuladas" por error — `AdvisorPassive`
sí lo era.

### Implementado

| # | Entrega | Detalle | Archivos |
|---|---|---|---|
| 75 | **`verify-effects.ts` cubre ahora 8 uniones** (+ `AdvisorPassive`): 10 tipos registrados como aplicados en passiveModifier (`case 'X'`), `shop-discount` en council-store (`=== 'shop-discount'`, es el default de passiveModifier por diseño). Data de `STARTER_ADVISORS` verificada | un tipo de pasiva de asesor futuro sin aplicación falla `npm run verify` | tools/verify-effects.ts |

**Validación**: verify-effects exit 0 (**8 uniones**) · `tsc` limpio · 186 tests · 17/17 verify ·
build verde.

### Cobertura de efectos (corregida y completa)

8 uniones tabuladas guardadas: DoctrineEffect, DecretumEffect, TradeGoodSpecial, FeatureSpecial,
GovernorTrait, SynergyBonus, LegateEffect, **AdvisorPassive**. Esta es la última unión
`type`-discriminada con switch del juego — ahora sí completa. Un barrido de `switch.*type|=== '`
en src/game no revela más uniones de efecto-tipo sin guardar.

## Iteración 39 — 2026-06-13

**Regresión guard de un invariante crítico sin test**: la **regla de piedad de `refillPool`**
(it.6) — garantiza que siempre haya una carta de Movimiento en el pool, evitando el softlock de
«sequía de movimiento» (un bug real vivido en partida en it.6).

### Hallazgo

`refillPool` (iter-belli-state, interno) fuerza una carta de Movimiento si el pool refillado no
tiene ninguna (líneas 199-204). Es el fix anti-softlock de it.6 y **no tenía test** — un refactor
que lo rompiera reintroduciría el softlock en silencio. El invariante: tras cada refill (al sembrar
y en cada `endTurn`), el pool contiene un Movimiento si el escenario tiene movers elegibles (Saguntum
los tiene).

### Implementado

| # | Entrega | Detalle | Archivos |
|---|---|---|---|
| 76 | **Regla de piedad guardada** en campaign-flow.test: tras sembrar y a lo largo de 6 turnos jugados, el pool siempre contiene una carta `Movimiento` (a través del `refillPool` real) | si el pool se queda sin movers (clog de permanentes), el test falla — el softlock de it.6 no puede volver en silencio | campaign-flow.test.ts |

**Validación**: `tsc` limpio · **187 tests** (+1) · 17/17 verify · build verde. Test-only.

## Iteración 40 — 2026-06-13

**Herramienta de balance para S-J** (automatiza parte del playtest humano): `tools/sim-campaign.ts`
— Monte-Carlo headless de la **fase de marcha** (el trek de cartas frontera→Sagunto), complementa
el `sim-battle-balance.ts` (que cubre la batalla decisiva). Usa la misma máquina de estado headless
que el test de integración de campaña (it.35/36/39).

### Implementado

| # | Entrega | Detalle | Archivos |
|---|---|---|---|
| 77 | **`sim-campaign.ts`** — corre N campañas (default 500) con estrategia *advance-first* y reporta tasa de llegada al objetivo, días usados, suministros/moral/amenaza al llegar, % con bonus de misión (≤8d) | tool standalone (no en la suite verify, como sim-battle) | tools/sim-campaign.ts (nuevo) |

### Datos de balance (500 runs, ejército inicial, estrategia directa)

```
reached objective : 99.4%      ran out of days : 0.0%      collapsed en route : 0.6%
on arrival: días 6.1 (96.2% ≤8d bonus) · suministros 9.8/28 · moral 5.8/15 · amenaza 3.0/10
```

**Insight S-J**: respondiendo a las preguntas de la auditoría —
- *¿el plazo de 12 días fuerza decisiones?* **No, para marcha directa**: 0% se queda sin días, 96%
  llega con el bonus ≤8d. El plazo solo presiona si el jugador se demora (juega no-movimiento) —
  que es justo lo que la estrategia de erosión de Boudicca quiere (acumular enemyWeaken).
- *¿el colchón de suministros es frustrante?* **No en marcha directa**: termina ~9.8 de 28, nunca
  hambre. El colchón es cómodo (quizá generoso) si avanzas; la tensión real está en demorarse para
  erosionar al enemigo, que consume suministros.
- **Conclusión**: la fase de marcha es indulgente; la dificultad y las decisiones interesantes
  viven en la **batalla decisiva** (sim-battle) y en el trade-off erosión-vs-suministros. Tocar
  números de marcha NO está justificado por estos datos (coherente con la auditoría: «números
  coherentes, no tocar por sensación»).

**Validación**: `tsc` limpio · 187 tests · 17/17 verify · build verde. Sin cambios en `src/`
(solo el tool). S-J: la infra de telemetría (it.18/33) + estos dos sims cubren el análisis de
balance que era la parte codeable; jugar runs reales y descargar el JSON queda como tarea humana
opcional.

## Iteración 41 — 2026-06-13

**Sweep + honestidad (comentario obsoleto)**: auditado el sistema de moral de ejército. Verificado
sano salvo una mentira de documentación.

### Hallazgo

`src/game/army/morale.ts` y `legatusContributor` **no existen** (eliminados con los sistemas de
batalla deprecados). Pero el comentario del efecto `morale-bonus` en `legate.ts:41-46` afirmaba
que se consume «por el `legatusContributor` en `src/game/army/morale.ts`, NOT by the in-battle
effect pipeline — the in-battle handler is a no-op». **Doblemente falso**: (1) el fichero/función
no existen; (2) `morale-bonus` SÍ se aplica — `legateSeedMods` (adapter.ts:41) suma `amount / 10`
a la moral del PlayerSeed (escala legacy 0–100 → 0–15 del motor). El comentario también citaba un
`BASE_MORALE (100)` que no existe como constante (solo vivía en ese comentario).

### Implementado

| # | Hallazgo | Fix | Archivos |
|---|---|---|---|
| 78 | **Comentario obsoleto** de `morale-bonus`: referencia un sistema borrado y niega su aplicación real | reescrito a la verdad: aplicado por `legateSeedMods`/adapter (÷10 a la moral del seed); nota de que el path `morale.ts`/`legatusContributor` se eliminó. Última referencia a `BASE_MORALE` retirada | legate.ts |

**Validación**: `tsc` limpio · 187 tests · 17/17 verify · build verde. Cero referencias vivas a
`morale.ts`/`legatusContributor` restantes (solo la nota histórica corregida).

## Iteración 42 — 2026-06-13

**Sweep + DRY (drift latente display-vs-verdad)**: auditado el sistema de **arsenal/armadura**.
Verificado consistente; eliminada una duplicación que era un riesgo de mentira futura.

### Verificado en sync (no-issue)

- `ARMOR_LADDER` (copper/bronze/iron/steel) ↔ `ARMORS` mitigación (5/12/20/30): cubre los 4 tiers.
- **Coste de mejora de armadura**: `upgradeArmor` **cobra** `discountedGold(base)` y el UI **muestra**
  `getDiscountedGold(base)` — el MISMO helper → display == spend. Sin drift (it.24 ya lo cerró).

### Hallazgo: `ARMOR_PCT` duplicaba `ARMORS`

`ExercitusTab` redefinía localmente `ARMOR_PCT = { copper:5, bronze:12, iron:20, steel:30 }`,
idéntico a `ARMORS` (battle/balance) — pero **dos definiciones que pueden divergir**: un cambio
en `ARMORS` (los % reales de batalla) NO actualizaría el display → la mitigación mostrada al
jugador mentiría. Misma clase de drift «display-vs-verdad» que el loop combate.

### Implementado

| # | Hallazgo | Fix | Archivos |
|---|---|---|---|
| 79 | **`ARMOR_PCT` duplicado** (UI) vs `ARMORS` (batalla) — drift latente | ExercitusTab importa `ARMORS` y lo usa directamente; eliminada la constante local. Behavior-preserving (valores idénticos hoy) → la mitigación mostrada queda atada a la fuente de verdad de batalla | ExercitusTab.tsx |

**Validación it.42**: `tsc` limpio · 187 tests · 17/17 verify · build verde.

## Iteración 43 — 2026-06-13

**Fix de corrección real (D19, diferido en it.5)**: las ventas devolvían más que el precio mostrado.

### Hallazgo

`sellDecretum`, `sellDoctrine` y `fireAdvisor` usaban `addResource('gold', price)` para el ingreso
de la venta. `addResource` aplica los modificadores de ingreso (War Profiteer +50% para Crassus,
loot-bonus de un asesor Raider) → el jugador **recibía más que el precio mostrado**. Y el código
contradecía su propia intención: doctrine-store comentaba «selling bypasses the 2x primary resource
multiplier» (pasaba sin faction para evitar el 2x) y council-store comentaba «no income-modifier
tracking» — pero `addResource` filtraba War Profiteer/loot-bonus igual. Existe `refundResource`
(valor nominal, sin modificadores) construido justo para esto.

### Implementados

| # | Hallazgo | Fix | Archivos |
|---|---|---|---|
| 80 | **Ventas/refunds inflados** por War Profiteer/loot-bonus (D19) — lo recibido ≠ lo mostrado, contra la intención del propio código | los 3 (`sellDecretum`/`sellDoctrine`/`fireAdvisor`) usan `refundResource` (valor nominal) en vez de `addResource`; comentarios corregidos. Lo recibido == lo mostrado para todos los comandantes | decretum-store.ts, doctrine-store.ts, council-store.ts |
| 81 | Test: con War Profiteer activo, `refundResource` da valor nominal (vs `addResource` +50%), y `sellDoctrine`/`sellDecretum` pagan exactamente el precio mostrado | 190 tests verdes (+3) | sell-face-value.test.ts (nuevo) |

**Validación**: `tsc` limpio · 190 tests · 17/17 verify · build verde. Tabla de auditoría
sincronizada (sistemas-del-juego.html · Economía · ventas/refunds). **D19 cerrado.**

## Iteración 44 — 2026-06-13

**Cierre de dudosos diferidos**: revisados D13 y D14 (los últimos potencialmente-reales). D13 era
una fragilidad real (fijada); D14 es inofensivo (verificado).

### D13 — fijado: identificación de cohorte por índice, no por referencia

`legateSeedMods` (adapter.ts) elegía la cohorte más fuerte por **identidad de referencia**
(`c.stats === strongestKey`), lo que exigía casts feos `as unknown as PowerStats` y era frágil
(footgun si dos cohortes comparten el objeto stats, o si el roster se clona entre los dos loops).
Cambiado a **índice** (`i === strongestIdx`): behavior-idéntico (adapter.test 22 verdes confirman
que el rally sigue apuntando a la más fuerte), elimina la fragilidad Y los casts.

### D14 — verificado: no es bug

`battle-fx` no cancela los `setTimeout` de proyectiles en `stop()`, PERO el callback (línea 223)
está **guardado por `if (state)`** y solo hace push a un array local (no renderizado tras `stop()`,
GC'd al morir el closure). No puede lanzar; «fuga» autoconsumible de ~1s. it.3 acertó («impacto
mínimo»). No se toca.

### Implementado

| # | Hallazgo | Fix | Archivos |
|---|---|---|---|
| 82 | **D13: fragilidad de identidad de referencia** en la selección de cohorte fuerte | índice en vez de referencia; casts `as unknown as PowerStats` eliminados; behavior-idéntico | adapter.ts |

**Validación**: `tsc` limpio · 190 tests (adapter.test 22 verdes) · 17/17 verify · build verde.

### Estado de los dudosos diferidos

Tras it.43 (D19) y it.44 (D13 fijado, D14 verificado): los dudosos técnicos codeables están
**resueltos o verificados-seguros**. Lo que queda son decisiones de diseño del usuario
(D10/D11/D29), refactors que requieren su OK (D28b code-splitting, D32 returnToHub), o no-issues
documentados. **El barrido autónomo de hallazgos técnicos ha llegado a su fin natural.**

## Iteración 45 — 2026-06-13

**Sweep de verificación (no-issue)**: auditado el **tick de provincia** — income / unrest /
rebelión / devastación en `collectProvinceIncome` (+`applyRebellion`), un sistema crítico y
complejo que no había revisado a fondo.

### Verificado sano (sin bug)

- **Income/expenses**: agregados vía los helpers compartidos `getProvinceIncome`/`getProvinceExpenses`
  (mismos que el ledger del UI → no pueden divergir, sin drift display-vs-tick). Aqueduct T3 +10%,
  waive-upkeep suspende el drain, shortfall añade unrest solo a provincias con upkeep. Coherente.
- **Unrest**: `calculateUnrestDelta` + penalización de shortfall, clampado 0–100. Bien.
- **Rebelión** (`applyRebellion`): escalada coherente — 1ª (n=0): destruye 1-2 edificios, −1 pop;
  2ª (n=1): destruye 2, −2 pop; 3ª (n=2): **Ruined** (todos los edificios, pop 1, wealth 0,
  timers devastación/rubble); n≥3: sin efecto. **Crucial: resetea `unrest: 40` tras cada rebelión**
  → no se re-dispara cada tick (da margen). Auto-despide al gobernador en Ruined. Sin bug.

**Conclusión**: el tick de provincia es sólido. **Sin cambio de código.**

### Estado del loop (it.44–45)

Dos vueltas seguidas confirmando salud sin hallazgos de fix (it.44 cerró D13/D14; it.45 verifica el
tick de provincia). Coherente con el fin natural del barrido técnico declarado en it.44. El valor
por vuelta es ahora una confirmación de auditoría; el trabajo de fix genuino está bloqueado en las
decisiones de diseño del usuario (D10/D11/D29) y los refactors que requieren su OK (D28b/D32).

## Iteración 46 — 2026-06-13

**Sweep del routing de pantallas** (`screens.ts` / `resolveScreen`). Verificado sano; corregido un
ejemplo de comentario engañoso.

### Verificado sano

`LEGACY_TAB_MAP` remapea correctamente los nombres legacy a las pestañas del Foro (hub→overview,
council→consilium, provinces→provinciae, doctrine→doctrinae, army-recruitment/legate-hiring→exercitus).
`getInitialScreen`/hashchange validan contra `VALID_SCREENS` y redirigen a title las pantallas
run-dependientes sin comandante. `resolveScreen` normaliza el hash a `#forum` + tab. Coherente, sin bug.

### Implementado (fix trivial)

| # | Hallazgo | Fix | Archivos |
|---|---|---|---|
| 83 | Comentario engañoso: ponía `#battle` como ejemplo de hash inicial, pero `battle` NO es una pantalla rutable (es un modal dentro de `#iterbelli`) | ejemplo corregido a `#forum/#iterbelli/#provinces` + nota de que `#battle` no es rutable | screens.ts |

**Validación**: `tsc` limpio · 190 tests · 17/17 verify. (Comentario; sin efecto runtime.)

### Nota de proceso (it.44–46)

Tres vueltas seguidas de confirmación-de-salud con, a lo sumo, fixes triviales de comentario. Esto
es la evidencia clara de que **el barrido técnico autónomo está agotado**: las áreas se auditan
sanas y los hallazgos son cosméticos. Reitero la recomendación de **pausar el cron** y decidir los
ítems de diseño bloqueantes (D10/D11/D29) — ahí está el único trabajo de valor real que queda.

## Iteración 55 — 2026-06-14 — Tarea BAL (escala soldados/iuniores)

**Auditoría de la regla dura del usuario**: todo delta de soldados/iuniores de campaña
debe ir en **centenas** (techo ~1000–2000). Resultado: **el juego YA cumple**; ningún
valor a cambiar (sin churn). Inventario de flujos de campaña:

| Fuente | Valores | ¿Centenas? |
|---|---|---|
| Leva (`LEVY_IUNIORES_COST/SOLDIERS`) | 500 / 500 | ✓ |
| Mercenarios (`SIGNATURE.mercenariosSoldiers`) | 600 | ✓ |
| Cartas (iter-belli-cards) | −400, −300, −200, 800 | ✓ |
| Quest (iter-belli-quests) | 800 | ✓ |
| Advisor `soldiers-bonus` | 250 / 450 / 700 | ✓ |
| Eventos de campaña (D10) | 200 / 300 / 400 · iuniores 500 | ✓ |

**Fuera de la regla (a propósito)**: los `iuniores: 2..12` de doctrine-data/decretum-data
son **costes de mejora de items** (sub-economía del hub, escala pequeña deliberada), NO
flujos de campaña. Forzarlos a centenas sería un rebalanceo destructivo — **no tocar**.

**Blindaje**: `src/game/iterBelli/__tests__/soldier-iuniores-scale.test.ts` afirma que
las fuentes accesibles estáticamente (leva, mercenarios, advisor soldiers-bonus) están
en [100, 2000]. Los eventos ya tienen su guard en `campaign-events.test.ts`. Los literales
`soldiers` dentro de closures de cartas no son alcanzables estáticamente; revisados a mano,
todos en centenas a fecha de esta auditoría.

**Validación**: `tsc` limpio · 216 tests · 17/17 verify · build verde. BAL cerrada.
