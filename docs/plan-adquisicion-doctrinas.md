# Plan — Adquisición de doctrinas a mitad de run

**Fecha:** 2026-06-12 · **Estado:** ✅ implementado (2026-06-12)
**Origen:** auditoría funcional de doctrinas (2026-06-11): el único camino de adquisición es el reparto íntegro al inicio del run; la pestaña Doctrinae ya promete «Acquire them from events or rewards» sin que exista tal sistema.

## Problema

`initializeRunScaffold` (game-state.ts:136-140) entrega al jugador **todas** las doctrinas
de su color + blancas (26 en el pool actual) en el turno 0. Consecuencias:

- «Adquirir doctrinas» no significa nada: ya las tienes todas.
- No hay progresión de doctrinas dentro del run — solo subir niveles.
- El texto de la pestaña Doctrinae miente (promete adquisición por eventos/recompensas).

## Enfoques considerados

| | Enfoque | Pros | Contras |
|---|---|---|---|
| **A** ✅ | **Draft de victoria** — al ganar una campaña de Iter Belli, elige 1 de 3 doctrinas no poseídas | Liga la progresión al loop central; variedad entre runs; estilo roguelite coherente con el juego de cartas; cumple la promesa «rewards» | Hay que partir el pool inicial; modal nuevo |
| B | Tienda en Doctrinae (oro/iuniores, refresco por temporada) | Simple; sumidero de oro | Menos emocionante; la economía ya tiene muchos sumideros; otra tienda más |
| C | Cartas de Iter Belli que otorgan doctrinas | Se integra al mazo | Las doctrinas son meta de hub: ganarla a mitad de campaña no surte efecto hasta la siguiente — sensación débil |

**Recomendación: A.** B puede añadirse después como complemento si el ritmo de drafts
resulta lento (hoy solo hay 2 escenarios → máx. ~2 drafts por run; crecerá con los escenarios).

## Diseño (enfoque A)

### 1. Partir el pool: núcleo inicial vs. adquirible

- Nuevo campo opcional en `Doctrine`: `starter?: boolean` (en `doctrine.ts`).
- En `doctrine-data.ts`, marcar como `starter: true` un núcleo de ~2 por color
  (las básicas: Sword, Diplomacy, Faith, Trade, People + 1-2 blancas básicas).
  El resto — incluidas las 3 nuevas (Horrea Publica, Disciplina Ferrea, Hearth) —
  queda adquirible. Números afinables en la implementación.
- `initializeRunScaffold` filtra el reparto inicial: `isDoctrineEquippable(d, faction) && d.starter`.
- El pool adquirible de un run = elegibles por color (`isDoctrineEquippable`) − ya poseídas.

### 2. Disparo del draft

- En `finishCampaign(victory=true)` (iter-belli-state.ts:470): además del oro de victoria,
  se calcula `pickRandom(3, poolAdquirible)` y se publica en un signal nuevo
  `pendingDoctrineDraft: Doctrine[] | null` (vive en `doctrine-store.ts` para no
  acoplar iterBelli → items en sentido inverso: iter-belli-state ya importa de items
  en la dirección segura usada por decreta — verificar y, si no, inyectar con el
  patrón `setXxxFn` que ya usa game-state para income/upkeep).
- Si quedan <3 doctrinas en el pool, se ofrecen las que haya; si 0, no hay draft
  (la victoria solo da el oro, como hoy).
- El draft NO caduca: persiste hasta que el jugador elige.

### 3. UI — modal de draft en el Forum

- Al volver al Forum tras la pantalla de resultado de campaña, si
  `pendingDoctrineDraft` no es null se muestra un modal («El Senado premia tu
  triunfo») con las 2-3 cartas de doctrina renderizadas con `DoctrineRenderer`
  (badge nivel I), estética del Forum (motifs Laurel/Corners existentes).
- Clic en una carta → `addDoctrineToCollection({...d, currentLevel: 1})`,
  el signal se limpia, toast/log opcional. Sin botón «rechazar» (YAGNI).
- Anclaje: el shell del Forum (`src/ui/screens/forum/`) ya superpone modales
  (p. ej. detalle de edificio) — seguir ese patrón.

### 4. Persistencia

- Si el run sobrevive recargas vía meta-save/save system, incluir
  `pendingDoctrineDraft` (ids) y el flag de poseídas ya queda implícito en
  `doctrineCollection`. Verificar en `meta-save.ts` / `verify-saves.ts` qué se
  serializa hoy del doctrine-store y replicar el patrón.
- Cuidado worktree: el usuario tiene WIP concurrente en meta-save (memoria
  codex) — coordinar antes de tocar ese archivo.

### 5. Docs (mismo cambio)

- `wireframes.html`: añadir el wireframe del modal de draft.
- `sistemas-del-juego.html`: sección Doctrinae — núcleo inicial vs. adquirible,
  draft de victoria; fila «Doctrinas · adquisición» en la tabla de estado.
- El texto placeholder de DoctrinaeTab («Acquire them from events or rewards»)
  pasa a ser verdad — reescribir a «Win campaigns to draft new doctrines».

## Plan de implementación (fases verificables)

1. **Fase 1 — pool.** `starter` en el tipo + marcado en data + filtro en
   `initializeRunScaffold`. Verificar: `npx tsx tools/verify-doctrine-hub.ts`
   (añadir check: el reparto inicial es subconjunto propio del pool elegible).
2. **Fase 2 — motor del draft.** Signal `pendingDoctrineDraft`, función
   `rollDoctrineDraft(faction)` (pura, testeable) + hook en `finishCampaign`.
   Test unitario: con pool conocido, victoria ⇒ 3 candidatas no poseídas,
   derrota ⇒ null; pool agotado ⇒ null.
3. **Fase 3 — UI modal.** Componente `DoctrineDraftModal` en el shell del Forum.
   Verificación manual con Playwright (ganar campaña Saguntum → modal → elegir →
   aparece en colección).
4. **Fase 4 — persistencia + docs.** Serialización si aplica; wireframes +
   sistemas actualizados; texto de DoctrinaeTab.

Cada fase: `npx tsc --noEmit` + `npx vitest run` + verify scripts antes de commit.

## Riesgos / preguntas abiertas

- **Balance del núcleo inicial:** reducir de «todas» a ~2 por color baja el poder
  inicial del jugador (menos cartas para los 4 slots). Mitigación: asegurar que el
  núcleo cubre los 4 slots (≥4 doctrinas iniciales por facción contando blancas).
- **Pocos escenarios:** con 2 escenarios, el draft se dispara poco. Aceptable hoy;
  si se nota, añadir el enfoque B (tienda) como complemento.
- **White commander:** ve todo el pool — su draft tiene más variedad; intencional.
