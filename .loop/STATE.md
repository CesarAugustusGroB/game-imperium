# Loop State — Consolidación de Imperium

> Estado vivo del loop. El cron re-inyecta un prompt mínimo («lee este fichero y
> continúa»), así que TODO el contexto que el loop necesita vive aquí. Mantenlo
> compacto: historial detallado → `docs/loop-hallazgos.md`.

## Misión
Construir el **sistema de eventos de campaña (D10)** — el tejido narrativo Hub↔Iter
Belli — y aprovechar el paso para **balancear** soldados/iuniores y **revisar todos
los bonos de efectos**. El main loop ya está consolidado (190 tests, 17/17 verify);
esto añade contenido vivo sin romper ese blindaje.

Diseño completo y aprobado: `docs/superpowers/specs/2026-06-14-campaign-events-design.md`.
**Léelo entero antes de tocar D10.** Resumen del contrato:
- Eventos = interludios narrativos, NO cartas, motor propio.
- Fuentes de conflicto: advisors del Consilium + provincias.
- Snapshot al embarque → cola de `HubConsequence` diferida → se aplica al volver al Foro
  (flujo unidireccional; `events` NO importa los stores del hub).
- Efectos inmediatos = `CardEffect` existentes; diferidos = nueva 9ª unión
  `HubConsequence` registrada en `verify-effects.ts`.
- Máx. 1 evento por campaña, a mitad de marcha, probabilístico. 6–8 conflictos en v1.
- **Escala numérica dura: todo delta de soldados/iuniores en CENTENAS (techo ~1000–2000);
  nunca unidades ni decenas.**

## Reglas de cada iteración (invariantes)
1. Lee este STATE.md + (si hace falta) `docs/loop-hallazgos.md`. Toma el siguiente
   paso LISTO del backlog.
2. Implementa solo con **≥75% de confianza**. Lo dudoso se anota, no se toca.
3. **No churn**: nunca cambies código que funciona solo para tener un commit.
4. **Verificación**: antes de commitear, `npx tsc --noEmit` + `npm run verify` +
   `npm run build` en verde. Tests nuevos para sistemas con números.
5. **Eficiencia**: verifica con `curl`+`Grep` por defecto; Playwright SOLO para
   cambios visuales genuinos (sus snapshots inflan el contexto).
6. Sincroniza los docs afectados (wireframes/sistemas/eventos HTML + hallazgos).
7. Commit Conventional Commits en `feat/eventos-campana`. Actualiza la sección **Log**
   y el **Backlog** de este fichero. NO lances equipos de agentes.

## Default cuando NO hay paso codeable listo
Confirma `npm run verify` en verde, anótalo en el Log como heartbeat, y reporta
que el loop está **idle a la espera de decisiones del usuario** (ver Backlog
bloqueado). **No fabriques cambios.**

## Status (2026-06-14)
Consolidación técnica COMPLETA (base estable: `tsc` limpio · 190 tests · 17/17 verify ·
build verde · 8 uniones blindadas). Arranca la **fase de contenido D10** sobre esa base.

## Backlog

### Épica activa: D10 — sistema de eventos de campaña (orden recomendado)
Construir por pasos; cada paso deja `tsc`+verify+build en verde y se commitea solo.
1. ✅ **Tipos + unión `HubConsequence`** (it.48) — `campaign-events-types.ts` con
   `CampaignConflict`/`CampaignEvent`/`EventChoice`/`HubConsequence`; 9ª unión
   registrada en `verify-effects.ts` (latente hasta paso 6). Nota de diseño: no hay
   campo `loyalty` en Advisor → la consecuencia de personaje se modela sobre `xp`.
2. ✅ **Detección de conflictos** (it.49) — `campaign-conflicts.ts` puro
   (`detectCampaignConflicts`: provincias con unrest ≥40 + consejo dividido ≥2
   colores). Snapshot sellado en `event-store.campaignConflicts` al embarcar
   (EmbarkCard). 4 tests. PEND: persistir el snapshot en meta-save (al paso 4,
   cuando el controller lo consuma).
3. ✅ **Catálogo** (it.50) — `src/data/campaign-events.ts`: 7 eventos (4 provincia
   + 3 advisor), 2–3 opciones, soldados/iuniores en centenas, 2 `premium`, 1 cadena
   por flag (`backed_rival` bloquea `advisor_divided_council`). Centinela `SOURCE_REF`
   (catálogo↔controller). `verify-effects` valida los tipos del catálogo. 6 tests.
4. ✅ **Controller** (it.51) — `campaign-events-controller.ts`: `selectCampaignEvent`
   (elegibilidad flags/seen/source), `resolveConsequences` (reescribe `SOURCE_REF`),
   `maybeFireCampaignEvent` (ventana 0.35–0.8, P=0.5, tope ≤1, seams rng/pick/progress),
   `resolveCampaignEventChoice`. Cola `pendingHubConsequences` + guard en event-store.
   Snapshot+cola+guard PERSISTIDOS en meta-save (cierra el PEND del paso 2). 8 tests.
5. ✅ **Modal** (it.52) — `CampaignEventModal.tsx` (overlay+card tokens, acento por
   fuente, chips de efectos, `{source}` sustituido, gating premium por
   `extra-event-choice`). Trigger `maybeFireCampaignEvent()` enganchado tras
   playCard/camp + guard de fase. Render del pending en IterBelliScreen. NOTA: no se
   forzó screenshot (evento probabilístico sin hook de dev); reutiliza CSS probado.
6. ✅ **Aplicación diferida** (it.53) — `apply-outcomes.ts`:
   `applyCampaignEventOutcomes()` drena `pendingHubConsequences` →
   `adjustProvinceUnrest` (clamp 0–100) / `adjustAdvisorXp` (signo, sin degradar
   tier) / recursos a valor nominal (`refundResource`/`spendResource`, cf. D19).
   Enganchado en `returnToHub`. **9ª unión `HubConsequence` deslatentizada** (sitio
   real en verify-effects). 3 tests. **Bucle Hub→campaña→Hub CERRADO.**
7. ✅ **Tests + docs** (it.54) — test integración headful embark→fire→resolve→retorno
   (2 tests, valida SOURCE_REF + tope ≤1). Docs sincronizados: nueva sección
   "Eventos de campaña" en `sistema-de-eventos.html` + nota en `sistemas-del-juego.html`.

**★ ÉPICA D10 COMPLETA** (it.48–54). Sistema de eventos de campaña vivo end-to-end:
detección → snapshot → disparo a mitad de marcha → modal → write-back al hub. 9ª
unión blindada. 213 tests. Siguiente foco del backlog: tareas BAL y REV.

### Tareas acompañantes
- ✅ **BAL** (it.55) — auditado: TODOS los flujos de campaña de soldados/iuniores
  YA están en centenas (leva 500, mercenarios 600, cartas −400/−300/−200/800, quest
  800, advisor soldiers-bonus 250/450/700, eventos 200–500). Sin cambios (sin churn).
  Blindado con `soldier-iuniores-scale.test.ts`. Los `iuniores:2..12` de doctrinas/
  decretos son costes de mejora (sub-economía aparte), FUERA de la regla. Ver hallazgos.
- ✅ **REV** (it.56) — auditadas las 8 uniones (semántica + magnitud). Todo
  coherente y fiel; sin "texto promete / no aplica" de cara al jugador. Sin fix
  ≥75% (los hallazgos son decisiones de balance/diseño). Documentado en hallazgos:
  **R1** (iuniores de items negligible vs pool de millares) y **R2** (misnomers
  `heal-between-nodes`/`extra-event-choices`; oportunidad: cablear el 2º a D10).

### Codeable y listo
- ✅ **D29** (it.57) — PANTALLA DE RÉCORDS: `RecordsScreen.tsx` (Anales de Campaña)
  sobre `metaSave.campaignLogs` (YA vivo vía `recordCampaignLog`; NO hizo falta
  recorder nuevo). Stats agregados + lista. Ruta `#records` (no REQUIRES_RUN),
  botón «Anales» en footer del Title. Docs: wireframes.html. NOTA: el sistema viejo
  `RunRecord`/`runs[]`/`computeScore`/`getBestRun` sigue MUERTO (duplicado) →
  candidato a recortar (decisión del usuario).
- **D32** — EXTRAER `returnToHub` de EndgameCard a la capa de lógica, con tests del
  camino crítico de vuelta al hub ANTES de tocar. (Ojo: ahora también drena eventos D10.)
- **D28b** — CODE-SPLITTING del bundle (~590KB) por rutas/pantallas, validando cada
  transición del main loop.

### Dirección confirmada (sin trabajo inmediato)
- **D11** — facciones NPC se CONSERVAN como base para diplomacia futura.
- **R1/R2** (ver hallazgos it.56) — balance de iuniores en items + cablear
  `extra-event-choices` advisor a D10: requieren decisión del usuario.

## Log (más reciente primero)
- it.57 — **D29 hecho**: `RecordsScreen` (Anales) sobre `campaignLogs` (ya vivo, sin
  recorder nuevo); ruta `#records` + botón en Title; wireframe añadido. tsc/216 tests/
  17 verify/build verde. Screenshot Playwright inconcluyente (dev server sirviendo otro
  worktree). Próximo: D32 (extraer returnToHub) o D28b (code-splitting).
- it.56 — **REV cerrada**: auditadas las 8 uniones de bonos (semántica + magnitud);
  coherentes y fieles, sin mentira de cara al jugador. 2 hallazgos de balance/diseño
  (R1 iuniores de items, R2 misnomers advisor) documentados, sin autofix. Read-only;
  17/17 verify verde. Próximo codeable: **D29** (pantalla de récords).
- it.55 — **BAL cerrada**: auditados todos los flujos soldados/iuniores de campaña →
  YA en centenas, sin cambios. Blindado con `soldier-iuniores-scale.test.ts` (3 tests).
  Costes de mejora doctrina/decreto quedan fuera de la regla (sub-economía). 216 tests ·
  17/17 verify · build verde. Próximo: tarea REV (auditar las 8 uniones de bonos).
- it.54 — **D10 paso 7 hecho → ÉPICA D10 COMPLETA**: test integración end-to-end
  (embark→fire→resolve→retorno, valida SOURCE_REF + tope) + docs HTML sincronizados.
  213 tests (+2) · 17/17 verify · build verde. Próximo: tarea BAL (normalizar deltas
  soldados/iuniores) o REV (auditar las 8 uniones de bonos).
- it.53 — **D10 paso 6 hecho**: `applyCampaignEventOutcomes` drena la cola al hub
  (unrest/xp/recursos a valor nominal) en `returnToHub`; 9ª unión deslatentizada.
  **Bucle Hub→campaña→Hub cerrado.** 211 tests (+3) · 17/17 verify · build verde.
  Próximo: paso 7 (test integración embark→evento→retorno + sync docs HTML).
- it.52 — **D10 paso 5 hecho**: `CampaignEventModal` (tokens overlay/card, chips de
  efectos, gating premium) + trigger enganchado tras playCard/camp con guard de fase.
  208 tests · 17/17 verify · build verde. El evento ya aflora; falta drenarlo al hub
  (paso 6). Próximo: paso 6 (`applyCampaignEventOutcomes` en retorno-al-hub).
- it.51 — **D10 paso 4 hecho**: controller (select/resolve/fire/resolveChoice) +
  cola `pendingHubConsequences` + guard ≤1; snapshot+cola+guard persistidos en
  meta-save (cierra PEND paso 2). Trigger se engancha en la pantalla en el paso 5.
  208 tests (+8) · 17/17 verify · build verde. Próximo: paso 5 (modal + wiring).
- it.50 — **D10 paso 3 hecho**: catálogo `campaign-events.ts` (7 eventos, centinela
  `SOURCE_REF`, cadena por flag, deltas soldados/iuniores en centenas). verify-effects
  ahora valida el catálogo. 200 tests (+6) · 17/17 verify · build verde. Próximo:
  paso 4 (controller: selección/disparo a mitad de marcha + persistir snapshot en meta-save).
- it.49 — **D10 paso 2 hecho**: `detectCampaignConflicts` puro (provincia unrest≥40 +
  consejo dividido) → snapshot sellado en `event-store.campaignConflicts` al embarcar.
  194 tests (+4) · 17/17 verify · build verde. Próximo: paso 3 (catálogo `campaign-events.ts`).
- it.48b — **D10 paso 1 hecho**: `campaign-events-types.ts` (4 tipos) + 9ª unión
  `HubConsequence` registrada (latente) en `verify-effects.ts`. tsc limpio · 17/17
  verify · build verde. Próximo: paso 2 (`detectCampaignConflicts` + snapshot al embarque).
- it.48 — **giro de misión**: el usuario decidió las 5 decisiones bloqueadas y
  aprobó el diseño de D10. Loop reorientado de auditoría → fase de contenido.
  Spec escrito (`specs/2026-06-14-campaign-events-design.md`), backlog D10+BAL+REV
  cargado. Próximo paso codeable: D10 paso 1 (tipos + unión `HubConsequence`).
- it.47 — formato `.loop/STATE.md` adoptado como estándar; cron de prueba creado.
  Heartbeat: `npm run verify` 17/17 verde. Loop **idle** a la espera de decisiones.
- it.46 — routing verificado sano + comentario `#battle` corregido.
- it.45 — tick de provincia/rebelión verificado sano (no-issue).
- it.44 — D13 fijado (cohorte por índice), D14 verificado seguro.
- it.43 — D19: ventas/refunds a valor nominal (refundResource). [fix económico real]
- it.13–42 — ver `docs/loop-hallazgos.md` (80+ hallazgos).
