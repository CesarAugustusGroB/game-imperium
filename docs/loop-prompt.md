# Prompt loopeable — Consolidación de Imperium

> ⚠️ **MIGRADO (it.47):** el estado vivo del loop ahora vive en **`.loop/STATE.md`**
> (formato estándar: estado en fichero + prompt mínimo «lee STATE.md y continúa»).
> Este archivo queda como referencia histórica del backlog/reglas; no lo uses como
> prompt del cron. El cron re-inyecta un prompt corto que apunta a `.loop/STATE.md`.

> **Uso (legacy):** este archivo era el prompt de una iteración del loop de consolidación.
> Lánzalo con `/loop docs/loop-prompt.md` (o pega su contenido como prompt y deja
> que se repita). Cada vuelta avanza UN item del backlog, lo verifica y lo commitea.
> Es la continuación natural del loop `loop-1 … loop-12` registrado en
> `docs/loop-hallazgos.md`. Deriva del reporte `estado-desarrollo.html`.

---

## Rol y contexto

Eres Claude Code trabajando en la rama `feat/auto-mejoras` del proyecto **Imperium**
(grand-strategy romano, Vite + TS + Preact). El main loop está completo y jugable:
Título → Selección de Comandante → Foro Imperial (6 pestañas) → Iter Belli (campaña de
cartas + batalla de dados). Lee `CLAUDE.md` y los 4 docs HTML de referencia antes de tocar
sistemas/UI. Salud de partida: `tsc` limpio, 16/16 verify scripts, ~130 tests verdes.

**Fases del plan (`docs/plan-consolidacion.md`):** FASE 1 (contrato de efectos) y FASE 2
(profundidad del bucle) están cerradas salvo S-D. Lo que queda es el backlog de abajo.

---

## Reglas de cada iteración (INVARIANTES — no romper)

1. **Orientarte primero.** Lee `docs/loop-hallazgos.md` (qué ya se hizo — NO repetir) y
   localiza el siguiente item no terminado del **backlog priorizado**.
2. **Un item por vuelta.** Toma el primer item no completado. No mezcles sprints.
3. **Umbral de confianza ≥75%.** Implementa solo lo que entiendas con ≥75% de certeza.
   Lo dudoso se ANOTA en `docs/loop-hallazgos.md` (tabla «Dudosos / no implementados»)
   con el motivo, sin tocarlo.
4. **Cero texto-mentira.** Si tocas algo que muestra texto al jugador, o el código cumple
   lo que el texto promete, o reescribes el texto a lo real. Regla transversal del plan.
5. **Costes en oro = un solo helper.** Cualquier coste mostrado en UI debe pasar por el
   MISMO helper que el store usa para cobrar (lección del drift display-vs-spend, 3 casos).
6. **Verificar en verde.** Antes de commitear: `npx tsc --noEmit` limpio **y**
   `npm run verify` (todos los scripts) **y** `npm run build` (smoke del build de producción,
   plan S-K). Si añades un sistema con números, añade su `tools/verify-*.ts` y/o unit test.
7. **Docs en el mismo cambio.** Si cambias una pantalla, edita su wireframe en
   `wireframes.html`. Si cambias un sistema, sincroniza `sistemas-del-juego.html` /
   `sistema-de-eventos.html`. Si añades iconos, re-corre `node tools/gen-icon-gallery.mjs`.
8. **Registrar el hallazgo.** Añade una entrada nueva a `docs/loop-hallazgos.md`
   (no edites las viejas) con: qué hiciste, archivos tocados, qué quedó dudoso.
9. **Commit Conventional Commits**, un commit por iteración, en `feat/auto-mejoras`.
   Mensaje en el estilo de los existentes (`feat(loop-N)`, `fix(loop-N)`, `balance(...)`).
   Termina el mensaje con la línea `Co-Authored-By:` que use el repo.
10. **NO lanzar equipos de agentes** desde el loop salvo que el usuario lo pida
    explícitamente. Trabaja en el hilo principal.
11. **Estética/arte:** color variado, NO all-gold (`docs/icon-art-direction.md`).
12. **Respeta el WIP concurrente de codex** (advisor-data, portraits, meta-save): no
    clobberear cambios sin commitear que no sean tuyos.

---

## Backlog priorizado (orden de entrada recomendado)

Trabaja de arriba abajo. Marca `[x]` en este archivo cuando un item quede DoD-cumplido.

### [x] S-D · Blindaje del contrato de efectos  ✅ HECHO (it. 13, 2026-06-13)
`tools/verify-effects.ts` parsea las uniones DoctrineEffect/DecretumEffect del type-source y
falla si un tipo declarado no tiene sitio de aplicación registrado / el sitio ya no lo maneja /
el registro está obsoleto / los datos usan un tipo fuera de la unión. + invariantes económicos
(refund ≤ pagado, clamps de descuento). Recogido por `npm run verify` (17/17). De paso limpiado
el check muerto `resource-per-spoke` de verify-doctrine-hub.ts. tsc + 148 tests verdes.

### [x] S-M · Passive «Deus Vult» de Innocent  ✅ HECHO (it. 14, 2026-06-13)
+1 moral pre-batalla por doctrina de fe (gold) equipada, cap +3. Color-lock: Innocent (gold)
no puede equipar rojas, así que escala con su escuela de fe. Cableado vía nuevo param
`passiveMoraleBonus` de `buildPlayerSeed` + helper `getEquippedColorCount`; `description`
reescrita. tsc + 151 tests + 17/17 verify verdes.

### [x] S-L · Diplomacia sencilla (aliados)  ✅ HECHO (it. 15, 2026-06-13)
Nuevo `ally-store.ts` (forgedAllies, allyCount, addAlly, collectAllyIncome, reset) — store
dedicado, separado del narrativo npc-faction-store. Adquisición vía nuevo efecto de decretum
`gain-ally` (registrado en verify-effects, cableado en decretum-hub); repurpose de 2 cartas
azules: Foedus Amicitiae→reino, Foedus Gentium→tribu (esta última mata el duplicado exacto
Explorator==Spy). Pago por temporada en EndgameCard (tribu→iuniores, reino→oro). Passive de
Augustus «Web of Alliances» ya REAL: allyCount contingentes aliados (HP+stats) en la batalla.
Contador visible en TreasuryPanel. Persistido en meta-save. tsc + 157 tests + 17/17 verify.

### [x] S-I · Onboarding y legibilidad  ✅ HECHO (it. 16-17, 2026-06-13)
- [x] **Tooltips de fórmula en batalla** (it. 16): chip «≈N daño» en push/harass/siege,
  `expectedOrderDamage` pinado contra el resolver por `damage-estimate.test.ts`.
- [x] **Desglose del income** en provincias: YA EXISTÍA (`IncomeLedger` en ProvinciaeTab).
- [x] **Tutorial contextual** (it. 17): `TutorialOverlay.tsx` — modal de primera ejecución de
  3 pasos (bienvenida → las 6 pestañas del Foro → Iter Belli con upkeep/amenaza/plazo). Revivió
  el flag `tutorialDismissed` + el botón «Show Tutorial» del Sidebar, que estaban **muertos**
  (el overlay de Bellum se borró al deprecarlo). Montaje condicional en ForumShell (resetea al
  paso 0 al reabrir). Validado en vivo con Playwright punta a punta.
- [x] **Estados vacíos**: revisados — Consilium (`EmptyHero`/«Empty seat»/market vacío) y
  Doctrinae (`collection.length===0`/socket vacío) YA los tenían. Sin trabajo.
- **Nota (D26)**: 3 cómputos paralelos de income en ProvinciaeTab (`getNetGoldIncome` :1301,
  tooltip de inversión :1746, `IncomeLedger` :2370) — riesgo de drift display-vs-spend.
  Candidato a consolidar en un helper único (refactor, vuelta de blindaje).

### [ ] S-H · Consistencia visual final
- Llevar **Consilium** al lenguaje de cartas (coordinar con WIP de codex en advisor-data).
- Generar los **PNG hi-res de edificios** que faltan (solo existen basilica/castrum/pantheon)
  + emblemas por doctrina/decretum. Color variado, no all-gold.
- Microinteracciones (transiciones de modal, hover de cartas, feedback de compra) y sfx
  faltantes (cast de decretum, upgrade de doctrina, abrir modal).
- **DoD:** toda pantalla del loop usa el lenguaje de cartas y coincide con su wireframe.

### [~] S-J · Telemetría de playtest + balance  (FASE 4 — infra HECHA, playtest = humano)
- [x] **Log local de campañas (JSON)** (it. 18): `run-telemetry.ts` (cards/orders tally) +
  `CampaignLogEntry` en meta-save (`recordCampaignLog`, cap 100) registrado al cierre de cada
  campaña (EndgameCard): outcome, causa, temporada, días, oro/iuniores finales, supervivientes,
  cartas jugadas, órdenes usadas. **Export JSON** por botón en el modal de Opciones. Sin backend.
- [ ] **10+ runs de playtest + ajustes de balance con datos**: tarea **manual/humana** — el loop
  no puede jugar 10 partidas significativas. La infra ya captura los datos; pendiente jugar y
  descargar el JSON. Regla: tocar números SOLO con datos (la auditoría dice que son coherentes).

### [~] S-K · Robustez de saves + release-readiness  (FASE 4 — saves+build HECHO, perf pendiente)
- [x] **Test de migración de saves** (it. 19): fixtures reales en `tools/fixtures/` (v1/v2/v3)
  cargados con `?raw`; `meta-save-migration.test.ts` cubre v1/v2/v3 + entrada basura → siempre
  un save v3 válido, campos nuevos (campaignLogs/forgedAllies/tutorialDismissed) defaulteados,
  activeRun viejo rellenado, nunca lanza.
- [x] **`npm run build` smoke** (it. 19): build de producción verde (✓ ~3s, JS 590KB/150KB gzip).
  **Añadido al ritual del loop** (correr `npm run build` cada vuelta además de tsc+verify).
- [~] **Pasada de perf** (PARCIAL): 
  - [x] **Fondos optimizados** (it. 20): `campaign-briefing-background` (2.2MB→132KB) y
    `consilium_hero_bg` (2.0MB→81KB) pasados a WebP vía vite-imagetools (`?w=1920&quality=82&format=webp`).
    `roman_background` ya estaba optimizado (`as=picture`). −~4MB en el bundle de producción.
  - [x] **Iconos UI a WebP** (it. 21): `defaultDirectives` en `vite.config.ts` transcodea todos
    los PNG de `assets/ui/icons` y `assets/ui/resources` a WebP por defecto (format-only, sin
    resize → resolución intacta, iconos grandes `size={300}` sin pérdida). −75–86% por icono
    (nav-* 324KB→44KB, delta-* 310KB→50KB…). Un solo cambio de config, sin tocar imports.
  - [ ] Pendiente: **code-splitting** (chunk JS 590KB >500KB). Auditar RAF/listeners. Ver D28b.

---

## Si el backlog está vacío (modo barrido)

Cuando todos los items de arriba estén `[x]`, vuelve al modo de las iteraciones 1–12:
barre una zona del código o juega el juego en vivo con Playwright (Title → Forum → campaña
→ batalla), caza hallazgos de ≥75% confianza, anota los dudosos, documenta y commitea.
No repitas hallazgos ya listados en `docs/loop-hallazgos.md`.

## Definición de «consolidado» (criterio de salida global del loop)

1. Cero texto-mentira: todo efecto visible tiene código o fue reescrito.
2. `verify-effects.ts` + unit tests + `verify-*` en verde en cada commit.
3. Dos+ campañas jugables con identidad de comandante (pasiva + firmas) — incl. Innocent real.
4. Toda pantalla del loop usa el lenguaje de cartas y coincide con su wireframe.
5. Diplomacia sencilla viva (aliados tribu/reino) y Augustus honesto.
6. 10+ runs de playtest registradas y ≥1 pasada de balance basada en datos.
