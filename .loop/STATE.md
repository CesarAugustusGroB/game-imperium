# Loop State — Consolidación de Imperium

> Estado vivo del loop. El cron re-inyecta un prompt mínimo («lee este fichero y
> continúa»), así que TODO el contexto que el loop necesita vive aquí. Mantenlo
> compacto: historial detallado → `docs/loop-hallazgos.md`.

## Misión
Terminar de consolidar el main loop (Foro ↔ Iter Belli): todo lo que el juego
promete en pantalla es real, el contrato de efectos está blindado, y los números
están a prueba de regresiones.

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
7. Commit Conventional Commits en `feat/auto-mejoras`. Actualiza la sección **Log**
   y el **Backlog** de este fichero. NO lances equipos de agentes.

## Default cuando NO hay paso codeable listo
Confirma `npm run verify` en verde, anótalo en el Log como heartbeat, y reporta
que el loop está **idle a la espera de decisiones del usuario** (ver Backlog
bloqueado). **No fabriques cambios.**

## Status (2026-06-13)
Consolidación técnica COMPLETA. `tsc` limpio · **190 tests** · **17/17 verify** ·
build verde. Contrato de efectos blindado en **8 uniones** (`verify-effects.ts`).
Bucle de campaña + tick de provincia + rebelión + routing auditados/testeados.
Dead code limpio, mentiras corregidas (D19 incl.), perf de imágenes hecho.

## Backlog

### Codeable y listo
- (vacío) — el backlog técnico autónomo está agotado.

### Bloqueado en decisión del usuario (NO ejecutar sin su OK)
- **D10** — sistema de eventos (stub muerto): ¿implementar o recortar?
- **D11** — facciones NPC (decorativas): ¿diplomacia futura o recortar?
- **D29** — historial de runs (muerto): ¿pantalla de récords o recortar el save?
- **D28b** — code-splitting (chunk JS 590KB): refactor con validación de rutas.
- **D32** — extraer `returnToHub` de la UI: toca el camino crítico de vuelta al hub.

## Log (más reciente primero)
- it.46 — routing verificado sano + comentario `#battle` corregido.
- it.45 — tick de provincia/rebelión verificado sano (no-issue).
- it.44 — D13 fijado (cohorte por índice), D14 verificado seguro.
- it.43 — D19: ventas/refunds a valor nominal (refundResource). [fix económico real]
- it.13–42 — ver `docs/loop-hallazgos.md` (80+ hallazgos).
