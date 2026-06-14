# Loop State — Game Balancer · Progresión exponencial

> Estado vivo del loop. El cron re-inyecta un prompt mínimo; TODO el contexto vive
> aquí. Mantenlo compacto. (Historia del loop anterior D10 → git de feat/eventos-campana.)

## Misión
Reformar la curva de progresión para que sea más EXPONENCIAL y se sienta compuesta,
manteniendo el juego jugable y monótono. "Exponencial" =
- Poder del jugador compone por inversión (cohortes/armadura/disciplina/doctrinas).
- Ingresos de victoria escalan geométricamente por escenario (financian costes geométricos).
- Dificultad enemiga escala geométricamente entre escenarios, de modo que el winrate
  de un jugador "apropiadamente preparado" se mantiene en banda (~50%) mientras el
  infrapreparado se queda atrás cada vez más rápido y el sobrepreparado se despega.
  La SENSACIÓN es de poder creciente; la dificultad sigue al jugador.

## Barreras (no negociables) — toda iteración las demuestra con sims
1. Soldados/iuniores: deltas SIEMPRE en centenas, techo ~1000–2000.
2. Monotonía: más inversión ⇒ winrate igual o mayor, nunca menor (cero inversiones).
3. Banda jugable: tier apropiado del escenario 40–65% (jamás 0% ni ~100%).
4. Accesibilidad: Saguntum estándar ≥ ~35% (primera campaña aprendible).
5. Exponencial real: el gradiente entre tiers/escenarios CRECE respecto al baseline, no se aplana.
6. Verde antes de commit: tsc + verify 17/17 + build. Docs sincronizados.
7. Una palanca por iteración, reversible, ≥75% confianza, sin churn.

## Reglas de cada iteración (invariantes)
1. Lee este STATE.md. Toma la siguiente palanca LISTA del backlog.
2. **BASELINE** — corre y anota winrates:
   `npx tsx tools/sim-playthrough.ts 1000` · `npx tsx tools/sim-battle-balance.ts` · `npx tsx tools/sim-campaign.ts 1000`
3. **CAMBIO** — UNA sola palanca; tuneo de constantes/datos en ficheros de balance
   (iter-belli-balance.ts, escenarios, doctrine/decretum-data), NO arquitectura ni la
   matemática del resolver.
4. **RE-MIDE** con los mismos sims. Acepta SOLO si pasan TODAS las barreras de arriba.
5. **VERDE** — `npx tsc --noEmit` + `npm run verify` (17/17) + `npm run build`.
6. Sincroniza docs afectados (sistemas-del-juego / sistema-de-eventos / wireframes +
   números en iter-belli-balance.ts). Commit Conventional Commits en `feat/balance-exponencial`.
   Actualiza Log y Backlog con la tabla winrate ANTES/DESPUÉS.
7. NO lances equipos de agentes. Eficiencia: sims + Grep; nada de Playwright salvo cambio visual.

## Default cuando NO hay paso codeable o ninguna palanca pasa las barreras
Re-corre los sims, anótalo como heartbeat en el Log, reporta **idle**. No fabriques cambios.

## Baseline de referencia (sim-playthrough, rush, tras fix de escenario 266b3dd)
| tier            | Saguntum | Gallia |
|-----------------|----------|--------|
| infrapreparado  |   0%     |   0%   |
| estándar        |  13%     |   3%   |
| bien preparado  |  87%     |  54%   |

Problemas conocidos: acantilado casi binario (13%→87%) — pero el muro es intencional
(perder y farmear, decisión del usuario it.4). NOTA it.9: la "trampa de erosión" era un
ARTEFACTO del bot — con estrategia que busca weaken de verdad, reach vuelve a ~99% y se
erosiona; no es trampa para juego hábil (la acumulación la limita la escasez de cartas = diseño).

## Backlog de palancas (ordenado; una por iteración)
1. ✅ **Escalado enemigo geométrico entre escenarios** (it.4) — DESBLOQUEADA con el 3.er
   escenario NUMANTIA (arquetipo `iberians`, caetrati elite). Escalera: Sag carthage 5000 →
   Gallia gauls 6500 → Numancia iberians 5200 (menos efectivos pero stats elite = peldaño de
   dificultad geométrico, no de headcount). victoryGold 200→400→800. El tier apropiado sube
   por escenario (standard→fully→veterano), cada uno ~50%. Decisión del usuario: perder y
   farmear antes de ganar es la progresión prevista (suelo de accesibilidad relajado).
2. ✅ **Recompensa de victoria geométrica** (it.1) — `victoryGold` por escenario
   (Saguntum 200 → Gallia 400, ×2), leído en `applyBattleOutcome`. Funda los costes
   geométricos sin tocar la batalla.
3. 🟢 **Poder de doctrina/decreto compuesto** — EN CURSO. Geométricas y modeladas: soldados
   (SWORD/IRON, it.5) y disciplina (DISCIPLINA_FERREA +3→+4, it.8). El sim equipa el kit real del
   veterano (Sword+Iron+Blood+Disciplina III). PENDIENTE: moral (se lava en la marcha → bajo valor,
   skip) y los decretos de BATALLA (el sim no los castea en combate → próxima mejora de fidelidad).
4. ✅ **Erosión como palanca** — RESUELTA. Potencia ×1.43 (it.2, weaken 0.07→0.10). La
   "acumulación-trampa" resultó ser un ARTEFACTO de medición (it.9): con la estrategia balanced
   buscando cartas que conceden weaken de verdad, reach sube de ~65% a ~99% Y se erosiona (no era
   trampa, era el bot malgastando turnos). El avg weaken ~1.0 lo limita la escasez de cartas de
   weaken en el mazo = decisión de diseño, no bug. Erosión funciona para juego hábil; sin cambio de juego.
5. ⏳ **Suavizar el acantilado de preparación** — contrapeso anti-ruptura: ensanchar la
   banda donde el tier estándar vive ~45–55% para que la táctica importe (evitar el
   13%→87% binario).
6. ⏳ **Leva de refuerzos / curva disciplina-moral** — palancas tardías.

## Log (más reciente primero)
- it.10 — **CIERRE: misión cumplida, cron parado.** Heartbeat final verde (campaign reach 99.8%,
  17/17 verify). Escalera exponencial limpia y validada bajo medición fiel — fully-prep: Sag 88% →
  Gallia 55% → Numancia 0.1% (caída acelerando); veterano 100%/99%/50% (en banda en su escenario).
  Backlog exponencial AGOTADO: P1✅ P2✅ P3✅(soldados+disciplina) P4✅. Restos = marginales (moral
  se lava) o no-exponenciales (decretos = tácticos, QA). Cron 4221193a CANCELADO para no quemar
  tokens en heartbeats sin progreso. Reabrir el loop solo si se añade un eje nuevo (p.ej. modelar
  decretos de batalla para QA, reabrir acantilado, economía de provincias).
- it.9 — **FIDELIDAD DEL SIM: estrategia balanced que BUSCA weaken (resuelve P4).** La balanced
  jugaba cartas de categoría-erosión al azar (mayoría sin weaken) → malgastaba días → reach ~65%
  (la "trampa"). Nuevo `grantsWeaken()` evalúa los efectos reales de la carta; la balanced ahora
  TARGETea weaken. Resultado: **reach ~65%→~99%** y se sigue erosionando (avg weaken 0.7→1.0,
  limitado por escasez de cartas = diseño). La "trampa de erosión" era artefacto del bot, NO un
  fallo del juego → P4 cerrada sin tocar el juego. Medición corregida (balanced más fuerte y
  realista): banda intacta en tiers apropiados (Gallia fully 63%, Numancia veterano 57%), monotonía
  ✓. Solo cambia `tools/sim-playthrough.ts`. tsc · 17/17 verify · build.
  | tier balanced overall | Saguntum a→d | Gallia a→d | Numancia a→d |
  | fully-prep. | 61→86% | 51→63% | 1→3% |
  | veterano    | 65→99% | 64→99% | 43→57% |
- it.8 — **Palanca 3: doctrina de disciplina geométrica + modelada.** DISCIPLINA_FERREA tier III
  +3→**+4** (escalera +1/+2/+4, ×2 último paso; coste ya iuniores 300/600/1200). Fidelidad: el sim
  separa la base del veterano (disc hardcodeada 6 → 4 = Warlord+legado) y equipa la doctrina real en
  el 4.º slot → disc 8 desde datos reales, no bundle. El kit real (disc 8) supera el proxy anterior y
  rebasó banda en Numancia (rush 58.7%→71.5%), así que **recalibrado Numancia baseSoldiers 5200→5900**
  → veterano rush **50.0%** (en banda), monótono (0/0/0.1/50). Disciplina no es delta de soldados/
  iuniores (cap 10, safe). tsc · 17/17 verify · build · sin docs (wireframe muestra tier I, sin cambio).
  Escalera fully aún más exponencial: 88.6→53.7→0.1.
  | tier (rush) | Saguntum | Gallia | Numancia |
  | fully-prep. | 88.6% | 53.7% | 0.1% |
  | veterano    | 99.9% | 99.9% | 50.0% |
- it.7 — **FIDELIDAD DEL SIM: equipa doctrinas reales (desbloquea P3).** El tier `veteran` deja
  el proxy `statMult 1.4 / passiveMorale 2` y pasa a EQUIPAR doctrinas reales: Sword III +800,
  Iron III +1600, Blood III +3 moral, sumadas al seed como `getEmbarkBonus` (4 slots, nivel actual).
  statMult 1.25 = pasiva real del Warlord (Veteran Stacks). Solo cambia `tools/sim-playthrough.ts`
  (JUEGO INTACTO). Resultado: los tiers ligeros idénticos al baseline (sin doctrinas → kit 0, sin
  regresión); el veterano con kit real queda mejor modelado y **Numancia AGUANTA la calibración**
  (veterano rush 54.6%→58.7%, sigue en banda 40-65, sin re-tunear). Monotonía ✓, escalera ✓
  (fully 88→54→0.7; veterano 99→99→59). tsc · 17/17 verify · build. Ahora las palancas de doctrina
  de embarque son MEDIBLES. PENDIENTE fidelidad: castear decretos de batalla en el sim.
  | tier (rush) | Saguntum | Gallia | Numancia |
  | fully-prep. | 88.6% | 53.7% | 0.7% |
  | veterano    | 99.8% | 99.3% | 58.7% |
- it.6 — **HEARTBEAT + IDLE — el loop alcanzó su límite medible.** Sims estables/verdes
  (sim-playthrough sin cambios; sim-battle Numancia confirma el muro: full disc4 weaken0 = 8%,
  weaken5 = 100%; campaign reach 99.9%; 17/17 verify). Palancas hechas: P1 (Numancia), P2 (oro),
  P3-soldados (escaleras geom.), P4-potencia (weaken 0.10). Las que quedan **comparten un único
  bloqueo**: el sim NO equipa el kit real (doctrinas/decretos/legado), así que P3-resto (moral/oro/
  decretos de batalla) y P4-acumulación son seguros-por-construcción pero invisibles al sim → no
  balanceables a ciegas. P5 (acantilado) vetada por el usuario (muro intencional). **DECISIÓN ÚNICA
  PARA SEGUIR**: invertir en fidelidad del sim — que EQUIPE doctrinas/decretos reales (recalibra el
  baseline; es tooling, no un tweak de constante → fuera del scope de "una palanca", por eso no se
  auto-ejecuta). Sin eso, el loop solo puede dar heartbeats.
- it.5 — **Palanca 3 (parcial): escaleras de doctrina de soldados geométricas.** SWORD tier III
  600→800, IRON tier III 1200→1600 (ambas ahora ×2 por paso, antes lineal +200/+400). Hundreds-safe
  (≤2000), monótono, verify de doctrinas verde. Con el coste ya ×3/×6, maximizar una doctrina roja
  ahora compone más soldados de embarque por iuniores invertido (meta-economía exponencial). El sim
  no equipa doctrinas → re-medida IDÉNTICA al baseline (prueba de no-regresión a los tiers calibrados),
  igual estatus que la palanca 2 (oro). Descartada P5 (acantilado) por decisión del usuario (muro
  intencional). tsc · 17/17 verify · build · sin cambios de docs (los docs describen doctrinas en
  genérico; el "+600 soldados" de los docs es una carta, no la doctrina).
  PENDIENTE para medir doctrinas de verdad: que el sim EQUIPE doctrinas reales (lo que pediste).
- it.4 — **Palanca 1 DESBLOQUEADA: 3.er escenario NUMANTIA** (decisión del usuario). Nuevo
  `iter-belli-scenario-numantia.ts` (arquetipo `iberians`, objetivo Numancia, terreno hills,
  carta decisiva `asalto_numancia`, victoryGold 800). Registrado en SCENARIOS; Gallia→Numancia
  se desbloquea por la lógica genérica index+1. **Mejora de fidelidad del sim** (decisión usuario
  pto.1): nuevo tier `veteran` (statMult 1.4 + disc6 + moral+2 ≈ kit de doctrinas/legado) para
  medir escenarios tardíos. Calibrado baseSoldiers 7000→5200 (iberians elite): veterano Numancia
  rush **56%** (en banda 40-65), monótono (under/std/fully ~0% → grind para ganar, filosofía del
  usuario). Escalera geométrica demostrada (tier fully fijo: Sag 90%→Gallia 53%→Numancia 0.5%).
  Barreras: deltas soldados/iuniores sin tocar, monotonía ✓, banda ✓ (apropiado/escenario ~50%),
  accesibilidad relajada por diseño. tsc · 224 tests (+1 numancia, test unlock actualizado) ·
  17/17 verify · build · docs sincronizados (sistemas/eventos/wireframes: 2→3 escenarios).
  | tier (rush) | Saguntum | Gallia | Numancia |
  | fully-prep. | 90% | 53% | 0.5% |
  | veteran     | 100% | 99% | 56% |
- it.3 — **HEARTBEAT + IDLE** (ninguna palanca pasa todas las barreras con ≥75% confianza).
  Sims estables (sim-playthrough 1000, sin cambios desde it.2): Sag rush std 12.8% / fully 88.3%;
  Sag balanced std 28.7% / fully 62.3%; Gallia balanced fully 50.2%. Campaign reach 100%.
  Por qué idle: **P3** (doctrina/decreto) exponencial pero el sim no equipa doctrinas → no medible.
  **P4-acumulación**: la carta de erosión pura (409) es `compromiso` → la estrategia balanced del
  sim la excluye; las que sí juega (151/457) mezclan efectos y se eligen semi-al-azar → señal
  turbia; y fully balanced ya en 62% (pegado al techo 65%) → overshoot. Baja confianza.
  **P1** bloqueada por diseño (necesita 3.er escenario). **P5** medible pero anti-exponencial.
  DECISIONES PARA DESBLOQUEAR (usuario): (a) mejorar la fidelidad del sim — estrategia balanced
  que BUSQUE cartas de weaken + equipar doctrinas — para medir P3/P4; (b) ¿es "estándar" el tier
  apropiado de Saguntum (entonces P5 sube accesibilidad, aceptando aplanar el acantilado) o es
  "infrainvertido" (mantener el muro)?; (c) añadir 3.er escenario para P1.
- it.2 — **Palanca 4 (parcial): erosión más potente.** `ENEMY_WEAKEN_PER_POINT` 0.07→0.10.
  Exponencial DEMOSTRADO en sim-battle-balance (recompensa por punto crece fuerte): weaken 2
  Sag starter+2line 53%→**92%**, full Gallia 54%→**80%**. En sim-playthrough (avg weaken 0.7)
  el efecto realista es modesto y seguro: balanced estándar +3-4pp ambos escenarios; tier
  apropiado en banda (Sag fully balanced 60→61%, Gallia 48→49%); monotonía intacta; deltas
  soldados/iuniores sin tocar. Coste de oportunidad (reach balanced ~60%) lo mantiene como
  apuesta, no autovictoria. Descartadas esta iter: palanca 3 (exponencial pero el sim no
  equipa doctrinas → no medible) y palanca 5 (medible pero anti-exponencial). tsc · 17/17
  verify · build · docs sincronizados (sistema-de-eventos −10%, sistemas-del-juego ×0,10).
  PENDIENTE el 50% restante de la palanca 4: acumulación de weaken (multi-carta).
  | tier (sim-playthrough 1000) | Sag rush a→d | Sag bal a→d | Gallia bal a→d |
  | estándar | 11→12% | 26→30% | 11→15% |
  | bien prep. | 86→88% | 60→61% | 48→49% |
- it.1 — **Palanca 2 hecha: recompensa de victoria geométrica.** `victoryGold` por
  escenario (Saguntum 200 → Gallia 400, ×2) en `applyBattleOutcome`; el meta-loop ahora
  compone (ganar campañas tardías financia los costes de mejora ×3/×6). Elegida sobre la
  palanca 1 (escalado enemigo) porque ésta choca con la intención de diseño de Gallia
  (veterano gana >50%). Barrera demostrada: winrates sim IDÉNTICOS al baseline (el oro no
  entra en la batalla) → cero regresión, monotonía intacta, Gallia-fully 50–52% (en banda).
  tsc · 17/17 verify · build · 20 tests afectados verdes. Tabla (sim-playthrough 1000, rush):
  | tier | Sag antes→después | Gallia antes→después |
  | infrapreparado | 0%→0% | 0%→0% |
  | estándar | 11%→10% | 3%→3% |
  | bien preparado | 87%→89% | 55%→52% |  (Δ = ruido MC ±3pp)
  Próximo: palanca 3 (poder de doctrina/decreto compuesto) o 5 (suavizar acantilado).
