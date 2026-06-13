# Prompt loopeable — Consolidación de Imperium

> **Uso:** este archivo es el prompt de una iteración del loop de consolidación.
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
   `npm run verify` 16/16 (o más, si añadiste scripts). Si añades un sistema con números,
   añade su `tools/verify-*.ts` y/o unit test.
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

### [~] S-I · Onboarding y legibilidad  (PARCIAL — continuar)  ← EMPEZAR AQUÍ
- [x] **Tooltips de fórmula en batalla** (it. 16): chip «≈N daño» en push/harass/siege,
  calculado por `expectedOrderDamage` (resolver) al dado medio, **pinado contra el resolver
  real** por `damage-estimate.test.ts` (no puede mentir). Charge/move excluidos (dependen del
  enemigo oculto / check). 
- [x] **Desglose del income** en provincias: YA EXISTÍA (componente `IncomeLedger` en
  ProvinciaeTab — tax/edificios/subsistencia/trade − gastos). No requería trabajo.
- [ ] **Tutorial contextual** (el icono nav-tutorial ya existe): primera visita a cada pestaña →
  2–3 tooltips guiados; primera campaña → explicación de upkeep/amenaza/plazo.
- [ ] Estados vacíos consistentes (revisar Consilium/Doctrinae).
- **DoD restante:** tutorial de primera visita + estados vacíos. (La legibilidad de fórmulas
  ya está cubierta: batalla = chip de daño; income = ledger.)
- **Nota (D26)**: 3 cómputos paralelos de income en ProvinciaeTab (`getNetGoldIncome` :1301,
  tooltip de inversión :1746, `IncomeLedger` :2370) — riesgo de drift display-vs-spend.
  Candidato a consolidar en un helper único (fuera del alcance de S-I; refactor).

### [ ] S-H · Consistencia visual final
- Llevar **Consilium** al lenguaje de cartas (coordinar con WIP de codex en advisor-data).
- Generar los **PNG hi-res de edificios** que faltan (solo existen basilica/castrum/pantheon)
  + emblemas por doctrina/decretum. Color variado, no all-gold.
- Microinteracciones (transiciones de modal, hover de cartas, feedback de compra) y sfx
  faltantes (cast de decretum, upgrade de doctrina, abrir modal).
- **DoD:** toda pantalla del loop usa el lenguaje de cartas y coincide con su wireframe.

### [ ] S-J · Telemetría de playtest + balance  (FASE 4)
- Log local de runs (JSON): duración, recursos finales, causa de derrota, cartas jugadas,
  órdenes usadas. Sin backend — descarga manual.
- 10+ runs guiadas por las tensiones de la auditoría. Ajustar números SOLO con datos.

### [ ] S-K · Robustez de saves + release-readiness  (FASE 4)
- Test de migración de saves (fixtures en `tools/fixtures/`).
- Pasada de perf (bundle, imágenes vía vite-imagetools, RAF/listeners).
- `npm run build` + smoke test del build de producción en el ritual de cada vuelta.

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
