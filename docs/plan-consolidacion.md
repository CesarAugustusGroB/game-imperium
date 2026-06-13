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

### S-D · Blindaje — ✅ HECHO (2026-06-13)
- [x] **`tools/verify-effects.ts`**: parsea los literales de miembro de las uniones `DoctrineEffect`/`DecretumEffect` directamente del type-source y FALLA si un tipo declarado no tiene sitio de aplicación registrado (mapa explícito tipo→módulo), si el sitio registrado ya no lo maneja (`case 'x'`/`=== 'x'`), si hay una entrada de registro obsoleta (miembro eliminado), o si los datos usan un tipo fuera de la unión. Cubre el agujero real: ambas uniones se consumen con `default` permisivos (hub `return null`, batalla `return false`), así que añadir un miembro compila pero queda **inerte en silencio** — ahora el verificador lo caza. Recogido automáticamente por `npm run verify` (el runner hace glob de `verify-*.ts`).
- [x] **Invariantes económicos** (en el mismo script): `applyInvestmentDiscount` refund ≤ pagado y ≥1 por recurso (nunca gratis, incluso al 90%/maxInvestmentDiscount); `getShopDiscount`/`getUpkeepReduction` clampados a ≤75 al apilar; `getDiscountedGold` en `[1, base]`; `getInvestmentDiscount([])` = 0; `ECONOMY.maxInvestmentDiscount` en (0,100).
- [x] De paso: limpiado el check muerto de `verify-doctrine-hub.ts` que filtraba contra `resource-per-spoke` (miembro de unión ya eliminado; el `Extract<…>` resolvía a `never` y el check pasaba en vacío).
- **DoD cumplido**: `tsc` limpio · 17/17 verify · 148 unit tests verdes. Añadir un miembro a cualquiera de las dos uniones sin cablear su aplicación ahora hace fallar `npm run verify`.
- **Ampliación (it.29–32, 38):** `verify-effects.ts` cubre **las 8 uniones de efectos tabuladas** del juego: `DoctrineEffect`, `DecretumEffect`, `TradeGoodSpecial`, `FeatureSpecial`, `GovernorTrait`, `SynergyBonus`, `LegateEffect` y `AdvisorPassive`. Cada tipo debe estar registrado como **aplicado** (`files`) o **latente** (`{ latent: true }`, dato inerte documentado). Esto cazó la clase del bug `enables-building` (it.28). El parser de uniones quita comentarios antes de escanear (robusto a `;`/`{}`/`type:` en JSDoc). **`AdvisorPassive` es la más importante**: su `passiveModifier` tiene un `default` permisivo, así que un tipo nuevo quedaría silenciosamente inerte sin este guard. (Nota: it.32 declaró "cobertura completa" por error — había omitido AdvisorPassive; corregido en it.38.)

> **Pendiente menor (no bloquea S-D):** actualizar `sistemas-del-juego.html` (tabla de auditoría) y wireframes en el mismo cambio de cada item — convención transversal del plan.

---

## FASE 2 — Profundidad del bucle (desarrollar)

*Principio: que la decisión de cada run sea distinta — más ejes, no más botones.*

### S-E · Sinergias y edificios que faltan — ✅ HECHO (2026-06-11)
- [x] Añadidos **Forge** (red/hills: +iuniores; Military-Industrial con Castrum → −10% coste de reclutar cohortes vía `getEmpireRecruitDiscount` inyectado en `discountedGold`), **Sacred Grove** (gold/forest/marsh: −unrest +beauty, +oro en T2/T3), **Mine** (purple/hills: +oro +PWG) — InvestmentType + INVESTMENT_DATA + iconos SVG + `buildingPWG.mine`.
- [x] Las 6 sinergias referencian solo edificios registrados (test lo garantiza). Religious Harmony, Resource Commerce y Military-Industrial ahora vivas.
- [x] Tests: `se-synergies.test.ts` (7); 115 total verdes.
- **Nota:** `training_ground` y `watchtower` siguen pendientes (no son parte de ninguna sinergia).

### S-F · Segundo escenario de campaña — ✅ HECHO (2026-06-11)
- [x] **GALLIA** (`iter-belli-scenario-gallia.ts`): Alesia vs Vercingétorix con el arquetipo `gauls` (carga 20, disc 3, sin armadura) — un combate muy distinto al de Cartago. Reutiliza los ids de localización genéricos (frontera/tarraco/llanura/bosques) con nombres galos para que las cartas existentes sigan disponibles + objetivo `alesia` con su carta decisiva `asalto_alesia`.
- [x] **Registro `SCENARIOS`** + `getScenarioById`/`setActiveScenarioById`; `unlockedScenarios` signal; `unlockNextScenario` (victoria desbloquea el siguiente). Persistido en `ActiveRunSave` (per-run), reseteado en `resetRun`.
- [x] **Selector en EmbarkCard** (chips por escenario, solo si hay >1 desbloqueado; fija el activo antes de embarcar). Notificación pinned al desbloquear.
- [x] Tests: `scenario-unlock.test.ts` (9); 124 total verdes; los 9 `verify-iter-belli-*` pasan.
- **Nota:** sin cartas nuevas específicas de Gallia más allá de la decisiva — el pool genérico cubre la campaña; añadir 4-6 cartas galas queda como pulido opcional.

### S-G · Variedad táctica de la batalla — ✅ HECHO (2026-06-11)
- [x] **Acies Duplex** (formación común, disc 4): cubre el salto disc 3→5 hacia las formaciones únicas; all-rounder disciplinado.
- [x] **Centros de terreno nuevos**: `forest` (Dense Woods, −25% impacto de carga **ambos lados** vía nuevo `chargeDamp`) y `marsh` (Boggy Ground, −20% carga + moral al defensor). Mapeados desde el terreno del escenario, así **Gallia (forest) pelea en bosque** — controlar el centro deja de importar para la carga, neutralizando en parte a los galos (carga 20).
- [x] Arquetipos: Saguntum (carthage) y Gallia (gauls) en uso vivo. Los 4 verificados como bien formados; iberians/garrison quedan listos para los escenarios 3-4.
- [x] Tests: `sg-tactics.test.ts` (incl. prueba de que chargeDamp reduce el daño de carga real); 130 total verdes.

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
