# Loop State — Game Balancer · Progresión exponencial

> Estado vivo del loop. El cron re-inyecta un prompt mínimo; TODO el contexto vive
> aquí. Mantenlo compacto. (Historia del loop anterior D10 → git de feat/eventos-campana.)

## Misión
Reformar la curva de progresión para que sea más EXPONENCIAL y se sienta compuesta,
manteniendo el juego jugable y monótono. "Exponencial" =
- Poder del jugador compone por inversión (cohortes/armadura/disciplina/doctrinas).
- Ingresos de victoria escalan geométricamente por escenario (financian costes geométricos).
- Dificultad enemiga escala geométricamente entre escenarios, de modo que el winrate
  de un jugador "apropiadamente preparado" se mantiene en banda (~50%) mientras el
  infrapreparado se queda atrás cada vez más rápido y el sobrepreparado se despega.
  La SENSACIÓN es de poder creciente; la dificultad sigue al jugador.

## Barreras (no negociables) — toda iteración las demuestra con sims
1. Soldados/iuniores: deltas SIEMPRE en centenas, techo ~1000–2000.
2. Monotonía: más inversión ⇒ winrate igual o mayor, nunca menor (cero inversiones).
3. Banda jugable: tier apropiado del escenario 40–65% (jamás 0% ni ~100%).
4. Accesibilidad: Saguntum estándar ≥ ~35% (primera campaña aprendible).
5. Exponencial real: el gradiente entre tiers/escenarios CRECE respecto al baseline, no se aplana.
6. Verde antes de commit: tsc + verify 17/17 + build. Docs sincronizados.
7. Una palanca por iteración, reversible, ≥75% confianza, sin churn.

## Reglas de cada iteración (invariantes)
1. Lee este STATE.md. Toma la siguiente palanca LISTA del backlog.
2. **BASELINE** — corre y anota winrates:
   `npx tsx tools/sim-playthrough.ts 1000` · `npx tsx tools/sim-battle-balance.ts` · `npx tsx tools/sim-campaign.ts 1000`
3. **CAMBIO** — UNA sola palanca; tuneo de constantes/datos en ficheros de balance
   (iter-belli-balance.ts, escenarios, doctrine/decretum-data), NO arquitectura ni la
   matemática del resolver.
4. **RE-MIDE** con los mismos sims. Acepta SOLO si pasan TODAS las barreras de arriba.
5. **VERDE** — `npx tsc --noEmit` + `npm run verify` (17/17) + `npm run build`.
6. Sincroniza docs afectados (sistemas-del-juego / sistema-de-eventos / wireframes +
   números en iter-belli-balance.ts). Commit Conventional Commits en `feat/balance-exponencial`.
   Actualiza Log y Backlog con la tabla winrate ANTES/DESPUÉS.
7. NO lances equipos de agentes. Eficiencia: sims + Grep; nada de Playwright salvo cambio visual.

## Default cuando NO hay paso codeable o ninguna palanca pasa las barreras
Re-corre los sims, anótalo como heartbeat en el Log, reporta **idle**. No fabriques cambios.

## Baseline de referencia (sim-playthrough, rush, tras fix de escenario 266b3dd)
| tier            | Saguntum | Gallia |
|-----------------|----------|--------|
| infrapreparado  |   0%     |   0%   |
| estándar        |  13%     |   3%   |
| bien preparado  |  87%     |  54%   |

Problemas conocidos: acantilado casi binario (13%→87%); erosión en marcha es trampa
neta (reach 99%→65% por solo +0.7 weaken); 0% para infrapreparado es un muro.

## Backlog de palancas (ordenado; una por iteración)
1. ⏳ **Escalado enemigo geométrico entre escenarios** — `ENEMY_BASE_SOLDIERS` y los
   `baseSoldiers`/stats por escenario. Hoy 5000→6500 (×1.3). Subir a ×1.6–2.0 por
   peldaño para que cada campaña sea un escalón real. Validar: el tier bien-preparado
   baja por escenario (p.ej. 80%→60%→45%) dentro de banda.
2. ⏳ **Recompensa de victoria geométrica** — `VICTORY_GOLD_BONUS` (oro, no soldados):
   200→400→800… por índice de escenario, para financiar los costes geométricos.
3. ⏳ **Poder de doctrina/decreto compuesto** — costes ya ×3/×6 por tier; escalar los
   EFECTOS para que el tier III >2× tier I (inversión que compone en batalla). Vigilar
   centenas en deltas de soldados/iuniores.
4. ⏳ **Convertir la erosión-trampa en palanca exponencial** — `ENEMY_WEAKEN_PER_POINT`
   o coste/potencia de las cartas de weaken: que invertir tiempo de marcha en erosionar
   dé ventaja compuesta sin ser obligatorio. Validar: reach balanced ≥ ~80% y su winrate
   supera claramente al rush al mismo tier.
5. ⏳ **Suavizar el acantilado de preparación** — contrapeso anti-ruptura: ensanchar la
   banda donde el tier estándar vive ~45–55% para que la táctica importe (evitar el
   13%→87% binario).
6. ⏳ **Leva de refuerzos / curva disciplina-moral** — palancas tardías.

## Log (más reciente primero)
- (vacío — primera iteración aún no corrida)
