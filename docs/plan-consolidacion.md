# Plan de Consolidación — Jugabilidad & Sistemas

> **Objetivo:** terminar de desarrollar, pulir y consolidar el main loop (Foro Imperial ↔ Iter Belli) hasta que **todo lo que el juego promete en pantalla sea real**, el bucle sea rejugable con identidad por comandante, y los números estén blindados contra regresiones.
>
> Basado en la auditoría de sistemas de junio 2026 (ver `sistemas-del-juego.html` → pestaña *Efectos & Auditoría*). Convención de sprints: continúa la serie S-N existente.

---

## Estado de partida (qué ya está hecho)

- **UI consolidada en lenguaje de cartas**: Exercitus (unidades 9:16 con sprites), Doctrinae (cartas de escuela 3:4 + pista de niveles), Decreta (pergaminos 3:4 con gemas de rareza), modal de detalle de edificio en Provinciae. Wireframes sincronizados.
- **Código muerto eliminado**: renderer WebGL legacy, bellum/node-map, sistema de eventos antiguo, recursos fe/influencia/momentum.
- **Dos pasadas de bugs**: exploit de oro en reclutar→quitar, doble coste de moral en All-Out, dead-end de despliegue, upkeep×timeCost, pool del asalto, deep links, etc. 83 unit tests + scripts `verify-*` en verde.
- **Auditoría completa**: números coherentes (tensiones intencionales documentadas); la brecha real es el **contrato de efectos** — texto que promete cosas que el código no aplica.

---

## FASE 1 — Cerrar el contrato de efectos (consolidar)

*Principio: ningún texto visible promete algo que el código no hace. O se implementa, o se reescribe.*

### S-A · Decreta en batalla ⭐ — ✅ HECHO (2026-06-11)
El módulo de batalla no importaba decreta: ~10 de 30 pergaminos eran inlanzables en todo el juego.

- [x] **DecretaBar** sobre la OrderBar de la batalla: un lanzamiento por batalla, consume el pergamino (`removeDecretum`), coste pagado del pool de campaña (`spendCampaignCost`).
- [x] `battle/decreta.ts` espejo de `toHubEffect()`: buff atk/def/agi (stats ×, `dmgTakenMult`), `damage` directo + fuego amigo 10% en área, `heal` (all = % maxHp, single = % de 1000), `prevent-death` (salvación al 5% maxHp, consumida en `playRound`), `spawn`/`convert` (±500 HP/unidad, convert cap 30%), `reveal` (intención enemiga pre-calculada — `enemyChoose` es determinista), `event-modifier` → ventaja en el dado 2 rondas.
- [x] Color-lock respetado; descripciones de Spy/Augur/Haruspex/Tribune/Legatus/Triumphus/Merchant reescritas a lo que hacen de verdad; Triumphus gana su +50% agility prometido como extraEffect.
- [x] Cobertura: `battle-decreta.test.ts` (12 tests) incluye el invariante «todo pergamino lanzable en hub o batalla».
- **DoD cumplido**: fila `Decreta · batalla` → `vivo` en la auditoría.

### S-B · Legados y comandantes con peso real — ✅ HECHO (2026-06-11)
- [x] **Bonos de stats de traits de legado** en `legateSeedMods` (adapter), consumidos por `buildPlayerSeed`: stat-bonus por rol (veteran/disciplined/tactician/swift), stoic +15% HP, charismatic/inspiring +moral (legacy ÷10), rallying +25% a la cohorte más fuerte.
- [x] **Habilidades estratégicas → cartas firma** (2 por arquetipo): `firma_grito_guerra` (Warlord: +moral +enemyWeaken), `firma_cruzada` (Religious: +moral +enemyWeaken, cuesta oro), `firma_manipular` (Diplomat: `refreshPool` rebaraja el pool), `firma_oportunidad` (Merchant: +oro +suministros). Signals huérfanos (`crusadeBattlesLeft`/`warCryActive`/`manipulateUsesLeft`/`goldenOpportunityPending`/`pendingEnemyConversions` + `useStrategic`/`canUseStrategic`/`consume*`) eliminados de strategic-store y meta-save.
- [x] **Pasiva Veteran Stacks** (Warlord): +5% ataque por victoria decisiva (cap 5), se rompe al perder; aplicada como `statMult` en `buildPlayerSeed`, persiste en meta-save (`veteranStacks`).
- [x] Tests: 7 nuevos en `adapter.test.ts`; verify-iter-belli-commander actualizado a la escala 0–10 viva (era stale del rework de disciplina).
- **DoD cumplido**: elegir legado cambia mediblemente la batalla; cada arquetipo tiene 2 firmas + (Warlord) pasiva.

### S-C · Pasada de honestidad — ✅ HECHO (2026-06-11)
- [x] **Villa T3** «farmland yield doubled» → implementado (×2 food de terreno farmland en `calculateFoodProduction`).
- [x] **Market T3** «exchange rates» → +1 wealth growth real (`buildingPWG.market[3]` 4→5) + texto reescrito.
- [x] **Castrum T2/T3, Basilica T3, Pantheon T3, Fishery T3, Stables**: textos que prometían sistemas inexistentes (unidades gratis, revive, event-choice, cavalry) reescritos a lo real. `getProvinceEffects()` (nunca consumido) **eliminado**.
- [x] **Doctrina `upkeep-reduction`** (Infrastructure/Annona) → `getUpkeepReduction()` aplicado a expenses de provincia vía `setUpkeepReductionFn` (patrón inyectado, evita ciclo).
- [x] **`famine-immunity`** (feature) → el dole de grano mantiene `famineTimer` a 0. **Horses cavalry-bonus** (mentira visible) → eliminado, +2 iuniores reales.
- [x] **Smuggler shop-discount y gobernadores**: ya funcionaban — la auditoría inicial los marcó mal. Verificado: `advisorShopDiscount` aplicado al coste de asesores; todos los traits de gobernador cableados.
- [x] Tests: `sc-honesty.test.ts` (6); 108 total verdes. `verify-province-resources` pasa.
- **DoD cumplido**: cero filas `muerto` en la tabla de auditoría (las features especiales latentes no se muestran → no mienten).

### S-D · Blindaje
- [ ] **`tools/verify-effects.ts`**: recorre doctrinas/decreta/traits/features/governors y FALLA si un tipo de efecto declarado no tiene sitio de aplicación registrado (mapa explícito tipo→módulo). Se añade al ritual de verificación.
- [ ] Unit tests para los invariantes económicos: refund ≤ pagado, caps de income/descuentos, clamps de campaña.
- [ ] Actualizar `sistemas-del-juego.html` (tabla de auditoría) y wireframes en el mismo PR de cada item.

---

## FASE 2 — Profundidad del bucle (desarrollar)

*Principio: que la decisión de cada run sea distinta — más ejes, no más botones.*

### S-E · Sinergias y edificios que faltan
- [ ] Añadir **Forge** (red/mountains: −coste de reclutamiento local), **Sacred Grove** (gold/forest: −unrest, +beautiness), **Mine** (purple/mountains: +oro, +PWG) — completa las 3 sinergias muertas. Pipeline existente: INVESTMENT_DATA + SVG en BuildingIcon + arte hi-res opcional.
- [ ] Sinergias restantes verificadas con test (Aqueduct+Granary food, Insula+Aqueduct unrest).

### S-F · Segundo escenario de campaña
- [ ] Escenario 2 post-Saguntum (p. ej. **cruce del Ebro / Gallia**): nuevo `iter-belli-scenario-*.ts` con localizaciones, crisis y enemigo (`gauls` ya existe como arquetipo de batalla con identidad propia: carga 20, disciplina 3).
- [ ] Selector de campaña en EmbarkCard cuando hay >1 escenario desbloqueado (victoria desbloquea el siguiente).
- [ ] 6–8 cartas nuevas específicas del escenario (el motor ya soporta `locations` por id).
- **DoD**: dos campañas jugables encadenadas; el meta-save persiste el progreso de escenarios.

### S-G · Variedad táctica de la batalla
- [ ] Usar los 4 arquetipos enemigos existentes (carthage/gauls/iberians/garrison) según escenario/quest — hoy solo se ve carthage en el flujo normal.
- [ ] 1 formación común nueva (p. ej. **acies duplex**, disc 4) para suavizar el salto disc 3→5 de las únicas.
- [ ] Centro: 1–2 terrenos nuevos (bosque: −charge ambos; colina fortificada) ligados al terreno del escenario.

---

## FASE 3 — Pulido (pulir)

### S-H · Consistencia visual final
- [ ] Pasada del lenguaje de cartas a lo que falta: Consilium (asesores como cartas — coordinar con el WIP de codex) y Overview/EmbarkCard.
- [ ] Arte: generar los 15 PNG hi-res de edificios que faltan (solo existen basilica/castrum/pantheon) y emblemas por doctrina/decretum (la zona de emblema ya está preparada para sustituir el glifo). Dirección: color variado, no all-gold (`docs/icon-art-direction.md`).
- [ ] Microinteracciones: transiciones de modal, hover de cartas, feedback de compra (animación ya existe en buildInvestment — extender a recruit/heal/equip).
- [ ] Sonido: sfx faltantes (cast de decretum, upgrade de doctrina, abrir modal).

### S-I · Onboarding y legibilidad
- [ ] **Tutorial contextual** (el icono nav-tutorial ya existe): primera visita a cada tab → 2–3 tooltips guiados; primera campaña → explicación de upkeep/amenaza/plazo.
- [ ] Tooltips de fórmulas: en la batalla, desglose del daño esperado por orden (stat × dado × mult); en provincias, desglose del income.
- [ ] Estados vacíos consistentes (ya hay en Decreta/Provinciae; revisar Consilium/Doctrinae).

---

## FASE 4 — Balance y cierre (consolidar)

### S-J · Telemetría de playtest + balance
- [ ] Log local de runs (JSON): duración, recursos al final, causa de derrota, cartas jugadas, órdenes usadas. Sin backend — descarga manual.
- [ ] 10+ runs de playtest guiados por las tensiones de la auditoría: ¿el colchón de 4 suministros es divertido o frustrante? ¿se usa siege alguna vez contra carthage? ¿el plazo de 12 días fuerza decisiones o solo castiga?
- [ ] Ajustes de números SOLO después de los datos (la auditoría dice que son coherentes; tocar por sensación, no por especulación).

### S-K · Robustez de saves y release-readiness
- [ ] Test de migración de saves: cargar un save de cada versión anterior del formato (fixtures en `tools/fixtures/`).
- [ ] Pasada de rendimiento: bundle, imágenes (vite-imagetools para los nuevos PNG), RAF/listeners.
- [ ] `npm run build` + smoke test del build de producción en el ritual de cada sprint.

---

## Orden recomendado y dependencias

```
FASE 1 (S-A → S-D)  ······ 1ª — sin esto, todo lo demás construye sobre promesas rotas
FASE 2 (S-E → S-G)  ······ 2ª — S-F depende de S-A/S-B (las campañas usan los efectos nuevos)
FASE 3 (S-H → S-I)  ······ 3ª — pulir cuando el contenido está estable (S-H puede solapar F2)
FASE 4 (S-J → S-K)  ······ 4ª — balance con datos al final; saves/build continuo desde F1
```

- **Quick wins de una tarde** (se pueden adelantar): Smuggler fix, Villa/Market T3, upkeep-reduction, bonos de legado (S-B.1).
- **El gordo**: S-A (decreta en batalla) — tocarlo primero también valida la arquitectura de efectos para Castrum/Pantheon (S-C) y las firmas (S-B).
- **Regla transversal**: cada item actualiza en el mismo cambio la fila de la auditoría en `sistemas-del-juego.html` y, si toca pantalla, su wireframe.

## Definición de «consolidado» (criterio de salida global)

1. Cero texto-mentira: todo efecto visible tiene código o fue reescrito.
2. `verify-effects.ts` + unit tests + `verify-*` en verde en cada PR.
3. Dos campañas jugables con identidad de comandante funcional (pasiva + firmas).
4. Toda pantalla del loop usa el lenguaje de cartas y coincide con su wireframe.
5. 10+ runs de playtest registradas y al menos una pasada de balance basada en datos.
