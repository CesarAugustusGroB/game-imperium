# Stats de Soldados — Referencia

Source of truth: `public/asset/soldiers/soldiers.json`. Stats gameplay en `src/game/army/cohort-data.ts` (reclutables) y `src/game/army/enemy-cohort-data.ts` (enemigos). Antes de que se aplique el multiplicador de amenaza post-spawn (+5% ATK/HP por nivel de amenaza).

**Leyenda:** `ATK` daño por ataque · `DEF` reducción de daño · `HP` vida · `AGI` velocidad · `Aurum` coste de reclutamiento

---

## 🛡️ Cohortes reclutables (Exercitus tab)

| Cohort | Rareza | Rol | Sprite | ATK | DEF | HP | AGI | Aurum | Movimiento |
|---|---|---|---|---:|---:|---:|---:|---:|---|
| Militia | common | vanguard | `roman_militia_common` | 100 | 30 | 800 | 35 | 20 | vanguard-march |
| Hastati | common | vanguard | `roman_hastatii_common` | 140 | 40 | 1000 | 40 | 40 | vanguard-march |
| Velites | uncommon | vanguard | `roman_velite_uncommon` | 130 | 25 | 700 | 90 | 30 | ranged-skirmisher |
| Cretan Archer | rare | vanguard | `cretan_archer_rare` | 120 | 20 | 700 | 85 | 70 | ranged-skirmisher |
| Principes | rare | vanguard | `roman_princeps_rare` | 170 | 55 | 1150 | 45 | 80 | vanguard-march |
| Equites | rare | guard | `roman_equite_rare` | 160 | 50 | 900 | 80 | 90 | flanker |
| Triarii | super-rare | reserve | `roman_triarii_super_rare` | 130 | 90 | 1300 | 25 | 100 | reserve-intercept |

### Notas de diseño
- **Militia** = levy barato, relleno de línea. Muere rápido, sale barato.
- **Hastati** = baseline front-line. La unidad contra la que se compara todo.
- **Velites** = cañón de cristal skirmisher. Alta agilidad, baja HP/DEF.
- **Cretan Archer** = arquero puro. Kitea melee a 3 hexes.
- **Principes** = veteranos pesados. Núcleo élite de la legión.
- **Equites** = caballería citizen. Flanquea por columnas laterales.
- **Triarii** = muro de último recurso. ALTA DEF+HP, AGI baja — no persigue, intercepta.

---

## ⚔️ Cohortes enemigas (barbarian horde / war host)

| Slot | Sprite | Rareza | Rol | ATK | DEF | HP | AGI | Movimiento |
|---|---|---|---|---:|---:|---:|---:|---|
| warrior (Gallic Warband) | `gallic_common` | common | vanguard | 125 | 25 | 850 | 55 | vanguard-march |
| raider (Persian Immortal) | `persian_immortal_uncommon` | uncommon | reserve | 115 | 40 | 820 | 70 | ranged-skirmisher |
| shieldbearer (Punic Citizen) | `punic_common` | common | guard | 95 | 75 | 1150 | 30 | vanguard-march |
| champion (Norse Raider) | `viking_common` | common | vanguard | 175 | 30 | 1100 | 65 | berserker |
| chieftain (Spartan Hoplite) | `spartan_rare` | rare | guard | 145 | 85 | 1400 | 40 | vanguard-march |
| warlord (Athenian Elite) | `athen_hoplite_elite_super_rare` | super-rare | vanguard | 195 | 70 | 1550 | 55 | vanguard-march |
| makedon-hetairoi | `makedon_hetairoi_secret_rare` | secret-rare | vanguard | 185 | 60 | 1500 | 85 | flanker |

Todas cuestan `0` Aurum (no reclutables).

### Notas de diseño enemigo
- **Gallic Warband** = shock infantry básica, barata y numerosa.
- **Persian Immortal** = reserva con arco; kitea a 3 hexes, intercepta brechas.
- **Punic Citizen** = shield-wall guard. Escudo Tanit, lento pero casi inamovible.
- **Norse Raider** = berserker puro. Sin disciplina, persigue siempre al más cercano.
- **Spartan Hoplite** = ancla élite. El shield lambda no se rompe primero.
- **Athenian Elite** = boss nivel super-rare. Cuirass dorado, lanza a dos manos.
- **Makedon Hetairoi** = caballería secret-rare. Xyston + flanker = letal.

---

## 🚫 Sprites reservados (gold-coin)

No aparecen en rosters aleatorios — uso narrativo sólo:

| Sprite | Archivo |
|---|---|
| `spartan_royal_super_rare` | spartan_royal_super-rare_soldier.png |
| `companion_super_rare` | companion_super-rare_soldier.png |

---

## 📊 Bandas de stats por rareza (referencia para añadir nuevos)

| Rareza | ATK | DEF | HP | AGI | Aurum |
|---|---|---|---|---|---|
| common | 100–150 | 25–50 | 800–1150 | 30–65 | 20–40 |
| uncommon | 115–170 | 25–60 | 700–1200 | 55–90 | 30–70 |
| rare | 120–170 | 20–85 | 700–1400 | 40–85 | 70–90 |
| super-rare | 130–195 | 70–90 | 1300–1550 | 25–55 | 100+ |
| secret-rare | 185+ | 60+ | 1500+ | 85+ | 150+ |

### Arquetipos dentro de la banda
- **shock-infantry** (Gallic, Viking): +ATK, −DEF, AGI media-alta
- **line-infantry** (Roman, Punic, Hoplites): ATK/DEF balanceados, AGI media
- **elite-infantry** (Immortal, Samurai, Spartan Royal): alta all-round
- **heavy-cavalry** (Companion, Hetairoi, Equites): alto ATK + AGI, DEF media, profile `flanker`
- **siege-beast** (War Elephant): HP/ATK extremos, AGI mínima
- **ranged** (Velites, Cretan Archer, Persian Immortal): AGI alta, DEF baja, profile `ranged-skirmisher`

---

## 🎬 Perfiles de movimiento AI

Definidos en `src/battle/movements/profiles.ts`:

| Profile | Comportamiento |
|---|---|
| `vanguard-march` | Marcha recto hasta engagement; después persigue (greedy). |
| `reserve-intercept` | Espera en zona propia; intercepta vanguards enemigos que entran. Se convierte en vanguard cuando no quedan enemigos vanguard. |
| `guard-stand` | Avanza hacia enemigos hasta engagement; después persigue. |
| `berserker` | Persigue al más cercano siempre, sin restricción de dirección. |
| `skirmisher` | Skirmish hasta engagement; después persigue. |
| `ranged-skirmisher` | Kitea enemigos a ≤3 hexes; intercepta en misma banda de profundidad; avanza si zona limpia. |
| `flanker` | Aproximación por columnas laterales; persigue tras engagement. |

---

_Actualizado: 2026-04-21 · Fuente: `src/game/army/cohort-data.ts` + `src/game/army/enemy-cohort-data.ts`_
