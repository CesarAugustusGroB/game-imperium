# Loop: Auto-mejoras (implementación del roadmap)

Fuente de verdad del roadmap: `investigacion-mejoras.html` (raíz del worktree).
Este fichero es el ESTADO del loop de implementación. Cada disparo lee esto, ejecuta
el siguiente paso LISTO, y actualiza Log + Backlog.

## Misión
Implementar las mejoras del reporte, EN ORDEN de dependencias, un paso pequeño y
shippeable por disparo. Commit + push automático tras cada paso verde.

## Invariantes (barra de seguridad — estándar del loop anterior)
- ≥75% de confianza en el cambio antes de tocarlo. Si no, SÁLTALO.
- Sin churn: cambios pequeños y acotados; un commit = un paso del backlog.
- `npx tsc --noEmit` + `npm run verify` + `npm run build` en VERDE antes de commitear.
- Deltas de soldados/iuniores SIEMPRE en centenas (techo ~1000–2000).
- Sincroniza los docs afectados en el MISMO commit (wireframes.html /
  sistemas-del-juego.html / sistema-de-eventos.html / iconos.html y el HTML del reporte).
- Commits Conventional en la rama `feat/auto-mejoras` (crear desde `develop` si no existe).
- NO lances equipos de agentes. NO modifiques WIP ajeno sin querer.
- Si un paso necesita una DECISIÓN del usuario o un SPEC (design doc) → NO lo codees:
  márcalo `BLOCKED` con la pregunta concreta y pasa al siguiente paso LISTO.
- Si no queda ningún paso LISTO: heartbeat de verify y reporta idle (no inventes trabajo).

## Procedimiento por disparo
1. Lee este fichero. Toma el primer paso con estado `READY` (de arriba abajo).
2. Investiga lo justo, implementa, verifica (tsc+verify+build), sincroniza docs.
3. Commit + push. Marca el paso `DONE` con el hash y una línea en el Log.
4. Si lo bloqueas, márcalo `BLOCKED: <pregunta>` y sigue con el siguiente `READY`.

## Backlog (en orden de ejecución)

### Fase 1 — Quick wins (bajo riesgo, alta confianza)
- [DONE] QW1 · A11y batalla: gate `prefers-reduced-motion` en `battle-fx.ts` (shake/partículas). (Topic 3)
- [READY] QW2 · `DoctrineDraftModal`: cerrar con Esc + click en backdrop + `aria-modal`. (Topic 1)
- [READY] QW3 · `SettingsPanel` z-index: subir de 20 a una capa coherente (sobre overlays/sidebar). (Topic 1)
- [READY] QW4 · Iconos POWER_STATS: sustituir glyphs emoji (🐎🪨🛡🏹👣) por `GameIcon` stat-* en el StatGrid de Exercitus (los iconos YA existen). (Topic 9)
- [READY] QW5 · Higiene docs/comentarios: quitar "× wealth tier" de `SynergyBonus` (province.ts) y aclarar que `wealthTiers` son display-only. (Topics 5,6)
- [READY] QW6 · `tools/verify-portraits.ts`: asertar que toda ruta de retrato (commanders/advisors/governors) resuelve a un fichero existente; añadir a `npm run verify`. (Topic 2)
- [READY] QW7 · Renombrar el comandante "Pope Innocent" → "Pope Leo" (decisión del usuario: el nombre cuadra con el retrato char_pope_leo.png). Solo el display name; mantener id 'innocent' para no romper saves. Revisar quote/passive si mencionan el nombre. (Topic 2)

### Fase 2 — Pasada Provinciae (5+6, claridad económica)
- [READY] PV1 · Desglose causal de ingreso en el panel de provincia: "Impuesto (w×tax) + Edificios + Trade + Subsist. ×Aqueduct ×Profiteer = N". (Topic 6)
- [READY] PV2 · Reetiquetar "Wealth Growth" como crecimiento de base imponible (stock), no ingreso de oro; marcar wealth como stock en su chip/hero. (Topic 5)
- [READY] PV3 · Generar un icono de wealth = BOLSA DE DINERO / saco (decisión del usuario), visualmente distinto del montón de monedas del oro (gold-stack). Seguir docs/icon-art-direction.md; guardar en src/assets/ui/resources/, cablear en lugar del wealth-icon actual, re-generar iconos.html. (Topics 5,9)
- [READY] PV4 · Documentar la creación de oro (4 capas) en `sistemas-del-juego.html`. (Topic 6)

### Fase 3 — Utilidades acotadas
- [READY] ME1 · Merge units: función pura `consolidateCohorts` (mismo-tipo, lossless-con-remanente) + test de invariante de `computeArmySize`. (Topic 4)
- [READY] ME2 · Botón "Fusionar" en la fila agrupada de `ExercitusTab` con `ConfirmDialog`, gating ≥2 instancias mismo-tipo y alguna dañada/OoA. (Topic 4)
- [READY] MO1 · Primitiva `<Modal>` + escala de z-index en design-tokens (APROBADO dentro del loop). MULTI-PASO: trocear en commits pequeños — (a) escala de z-index + componente Modal base sobre ConfirmDialog; (b..) migrar un modal por commit (DoctrineDraftModal → SettingsPanel → CampaignEventModal → battle → TutorialOverlay). Cada commit verde e independiente. (Topic 1)

### Fase 4 — Dificultad
- [READY] DF1 · Multiplicador global de dificultad: capa ×factor sobre soldados enemigos / mult de stats / % atrición / victoryGold, con Normal = ×1. Selector. Validar con `tools/sim-playthrough.ts` que cada nivel cae en su banda. Deltas en centenas. (Topic 10)
- [READY] DF2 · IA enemiga menos explotable: añadir aleatoriedad ponderada + contra-juego a la última orden del jugador en `enemy-ai.ts`, gateado por dificultad (Normal = comportamiento actual). (Topic 10)

### Fase 5 — Grandes (requieren SPEC antes de codear) — quedan BLOCKED por diseño
- [BLOCKED: necesita design doc] BG1 · Esclavos (botín convertible MVP). (Topic 7)
- [BLOCKED: necesita decisión de alcance] BG2 · Clímax de batalla a pantalla completa + arte de unidades + banners. (Topic 3)
- [READY] BG3 · Unificación de tokens `--imp-*` + reconciliación de fondo (APROBADO dentro del loop). MULTI-PASO de bajo churn por commit — (a) aliasar `--color-*` legacy a sus equivalentes `--imp-*` en design-tokens.css (sin tocar componentes); (b) reconciliar el hue de fondo a un solo "ink"; (c..) migrar referencias por fichero/dominio, un commit acotado cada vez. (Topic 8)

## Log
- QW1 DONE — battle-fx respeta prefers-reduced-motion: helper reduceMotion() (live), shake gateado en carga/asedio, addParticles no-op, deriva ambiental congelada. tsc+verify(17/17)+build verde.
