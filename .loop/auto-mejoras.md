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
- [DONE] QW2 · `DoctrineDraftModal`: añadido `role="dialog"` + `aria-modal` + `aria-labelledby` (accesibilidad). NOTA: el cierre con Esc/backdrop NO se añadió — el modal es elección OBLIGATORIA por diseño ("blocks the Forum until a choice is made"); cerrarlo permitiría saltarse la recompensa de victoria. Ver QW2b. (Topic 1)
- [BLOCKED: ¿El victory draft de doctrina debe poder saltarse/cerrarse (Esc/backdrop), o se mantiene como elección obligatoria? El código lo trata como forzado.] QW2b · Cierre dismissible del DoctrineDraftModal. (Topic 1)
- [DONE] QW3 · `SettingsPanel` z-index 20 → 9000 (sobre overlays de gameplay ≤600, bajo ConfirmDialog/MusicToggle 9999). Comentario documenta el orden; se formalizará con la escala de tokens (MO1). (Topic 1)
- [DONE] QW4 · Iconos POWER_STATS. Descubierto: la UI YA usa iconos de imagen en AMBOS sitios (ExercitusTab vía STAT_ICON_SRC, ArmyStatus vía GameIcon); el campo `glyph` emoji en unit-types.ts estaba MUERTO y su comentario era falso. Eliminado el campo muerto + corregido el comentario. No se mostraba ningún emoji al usuario. (Topic 9)
- [DONE] QW5 · Higiene de comentarios: corregido el comentario falso "× wealth tier × tax" en `SynergyBonus` gold (province.ts:350) → es gold plano de edificio; aclarado `flatGold` en trade-goods.ts; documentado `wealthTiers` como DISPLAY-ONLY (no multiplica oro) en game-config.ts. (Topics 5,6)
- [DONE] QW6 · `tools/verify-portraits.ts`: aserta que toda ruta de retrato (commanders/advisors/governors) resuelve a un fichero bajo public/. Auto-descubierto por run-all-verify.ts → ahora 18/18. Auditó 24 retratos, todos OK. (Topic 2)
- [DONE] QW7 · Renombrado "Pope Innocent" → "Pope Leo" (display name en commanders.ts; id 'innocent' intacto para saves). Comentario de BattleModal y docs de estado actual (GAME_CONTEXT.md, GEMINI.md, reporte) sincronizados. Logs históricos (loop-*.md, specs, estado-desarrollo.html) y GDD.md legacy NO tocados (audit trail / describen sistemas retirados). (Topic 2) — CIERRA FASE 1.

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
- QW2 DONE — DoctrineDraftModal con role/aria-modal/aria-labelledby. Descubierto: es elección obligatoria por diseño, así que el cierre dismissible se separó a QW2b (BLOCKED, necesita decisión). Reporte (Topic 1) sincronizado. tsc+verify(17/17)+build verde.
- QW3 DONE — SettingsPanel z-index 20→9000 (estaba por debajo de todos los overlays). Reporte (Topic 1) sincronizado. tsc+verify(17/17)+build verde.
- QW4 DONE — POWER_STATS: la UI ya usaba iconos de imagen en ambos sitios; el campo glyph emoji era dead code con comentario falso. Eliminado + comentario corregido. Reporte (Topic 9) sincronizado. tsc+verify(17/17)+build verde.
- QW5 DONE — higiene de 3 comentarios sobre "wealth tier" (province.ts SynergyBonus, trade-goods.ts flatGold, game-config.ts wealthTiers). Aclaran que NO hay multiplicador de oro por wealth-tier. Reporte (Topics 5,6) sincronizado. tsc+verify(17/17)+build verde.
- QW6 DONE — tools/verify-portraits.ts añadido (auto-descubierto). Aserta 24 retratos (commanders/advisors/governors) contra public/; todos resuelven. npm run verify ahora 18/18. Reporte (Topic 2) sincronizado. tsc+verify+build verde.
- QW7 DONE — comandante "Pope Innocent"→"Pope Leo" (display only; id 'innocent' intacto). Docs de estado actual sincronizados; históricos no tocados. tsc+verify(18/18)+build verde. ✅ FASE 1 (quick wins) COMPLETA.
