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
1. **Tipos + unión `HubConsequence`** — define `CampaignConflict`, `CampaignEvent`,
   `EventChoice`, `HubConsequence`. Regístrala como 9ª unión en `verify-effects.ts`
   con su sitio de aplicación. (Test: verify-effects sigue verde y exige la 9ª.)
2. **Detección de conflictos** — `detectCampaignConflicts(snapshot)` puro sobre
   advisors + provincias. Sella el snapshot en el estado de campaña al embarcar.
3. **Catálogo** — `src/data/campaign-events.ts`: 6–8 eventos (mezcla provincia +
   advisor), 2–3 opciones c/u, deltas de soldados/iuniores en CENTENAS. Opción
   `premium` para `extra-event-choice`.
4. **Controller** — selección/disparo a mitad de marcha, tope ≤1/campaña,
   probabilístico, respeta flags require/block y `seenEventsThisSpoke`.
5. **Modal** — `CampaignEventModal.tsx` con el lenguaje visual de las cartas.
6. **Aplicación diferida** — `applyCampaignEventOutcomes()` en el retorno-al-hub;
   persistir la cola pendiente en iter-belli-save/meta-save.
7. **Tests + docs** — integración headless embark→evento→retorno; sincronizar
   `sistema-de-eventos.html` y `sistemas-del-juego.html`.

### Tareas acompañantes (intercalar; pueden ir antes/durante D10)
- **BAL** — normalizar TODO delta de soldados/iuniores (cartas, leva, eventos,
  efectos) a escala de centenas (techo ~1000–2000). Test que afirme el rango.
- **REV** — review de las 8 uniones de bonos: por cada miembro, confirmar magnitud
  coherente y que el sitio aplica lo prometido (caza "texto promete / no aplica").
  Hallazgos → `docs/loop-hallazgos.md`; fixes solo con ≥75% confianza.

### Dirección confirmada (sin trabajo inmediato)
- **D11** — facciones NPC se CONSERVAN como base para diplomacia futura.
- **D29** (pantalla de récords), **D32** (extraer returnToHub), **D28b**
  (code-splitting) — aprobados; abordar DESPUÉS de cerrar la épica D10.

## Log (más reciente primero)
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
