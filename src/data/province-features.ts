// ── Province unique features (S19-01) ──

/**
 * Special effect a province feature may grant.
 * null = no special effect.
 */
export type FeatureSpecial =
  | { type: 'extra-event-choice' }
  | { type: 'cavalry-bonus' }
  | { type: 'unit-discount'; percent: number }
  | { type: 'famine-immunity' }
  | null;

/**
 * A unique province feature — a landmark, omen, or wonder that gives
 * the province a distinct identity and mechanical bonus. 8–12 are
 * randomly assigned per run via the feature pool (S19-02).
 */
export interface ProvinceFeature {
  id: string;
  name: string;
  /** Flavour text shown in the discovery notification and province detail. */
  flavour: string;
  /** Flat gold income per season. */
  goldPerSeason: number;
  /** Food production bonus per season (feeds into calculateFoodProduction). */
  foodPerSeason: number;
  /** Flat faith income per season. */
  faithPerSeason: number;
  /** Flat influence income per season. */
  influencePerSeason: number;
  /** Flat momentum income per season. */
  momentumPerSeason: number;
  /** Unrest modifier per season (negative = suppresses). */
  unrestPerSeason: number;
  /** Beautiness score bonus (adds to immigration chance). */
  beautinessBonus: number;
  /** Build cost discount percentage (0–100). */
  buildCostDiscount: number;
  /** Positive Wealth Generation bonus per season. */
  wealthGrowthBonus: number;
  /** Optional special effect. */
  special: FeatureSpecial;
}

// ── Canonical features table ──

export const ALL_FEATURES: ProvinceFeature[] = [

  // ══════════════════════════════════════════════
  //  GEOGRAPHIC LANDMARKS (7)
  // ══════════════════════════════════════════════

  {
    id: 'nile_delta',
    name: 'The Nile Delta',
    flavour: 'Annual floods deposit rich silt across the lowlands, turning barren sand into the breadbasket of empires.',
    goldPerSeason: 2, foodPerSeason: 3, faithPerSeason: 0, influencePerSeason: 0, momentumPerSeason: 0,
    unrestPerSeason: 0, beautinessBonus: 0, buildCostDiscount: 0, wealthGrowthBonus: 1,
    special: null,
  },
  {
    id: 'fertile_crescent',
    name: 'The Fertile Crescent',
    flavour: 'Between two great rivers lies the cradle of agriculture — grain grows almost unbidden here.',
    goldPerSeason: 0, foodPerSeason: 4, faithPerSeason: 0, influencePerSeason: 0, momentumPerSeason: 0,
    unrestPerSeason: 0, beautinessBonus: 0, buildCostDiscount: 0, wealthGrowthBonus: 0,
    special: null,
  },
  {
    id: 'volcanic_soil',
    name: 'Volcanic Soil',
    flavour: 'Ash from ancient eruptions makes the earth impossibly fertile, though tremors remind all who is master.',
    goldPerSeason: 0, foodPerSeason: 2, faithPerSeason: 1, influencePerSeason: 0, momentumPerSeason: 0,
    unrestPerSeason: 0, beautinessBonus: 0, buildCostDiscount: 0, wealthGrowthBonus: 1,
    special: null,
  },
  {
    id: 'thermopylae_pass',
    name: 'Thermopylae Pass',
    flavour: 'The Hot Gates — where three hundred held a million. The narrow pass makes this land easy to defend, hard to conquer.',
    goldPerSeason: 0, foodPerSeason: 0, faithPerSeason: 0, influencePerSeason: 0, momentumPerSeason: 3,
    unrestPerSeason: -5, beautinessBonus: 0, buildCostDiscount: 0, wealthGrowthBonus: 0,
    special: null,
  },
  {
    id: 'natural_harbour',
    name: 'Natural Harbour',
    flavour: 'A deep-water bay sheltered from storms — ships from every nation dock here, filling the markets.',
    goldPerSeason: 3, foodPerSeason: 1, faithPerSeason: 0, influencePerSeason: 0, momentumPerSeason: 0,
    unrestPerSeason: 0, beautinessBonus: 5, buildCostDiscount: 0, wealthGrowthBonus: 2,
    special: null,
  },
  {
    id: 'mountain_spring',
    name: 'Sacred Mountain Spring',
    flavour: 'Crystal water flows from the heights, believed by locals to carry blessings from the gods themselves.',
    goldPerSeason: 0, foodPerSeason: 1, faithPerSeason: 2, influencePerSeason: 0, momentumPerSeason: 0,
    unrestPerSeason: -3, beautinessBonus: 8, buildCostDiscount: 0, wealthGrowthBonus: 0,
    special: null,
  },
  {
    id: 'great_river_ford',
    name: 'Great River Ford',
    flavour: 'The only safe crossing for leagues in either direction. Whoever holds the ford commands the trade routes.',
    goldPerSeason: 2, foodPerSeason: 0, faithPerSeason: 0, influencePerSeason: 1, momentumPerSeason: 0,
    unrestPerSeason: 0, beautinessBonus: 0, buildCostDiscount: 0, wealthGrowthBonus: 2,
    special: null,
  },

  // ══════════════════════════════════════════════
  //  RELIGIOUS / MYTHIC SITES (7)
  // ══════════════════════════════════════════════

  {
    id: 'oracle_of_delphi',
    name: 'Oracle of Delphi',
    flavour: 'The Pythia speaks in riddles, but kings and generals still come from across the world seeking her counsel.',
    goldPerSeason: 0, foodPerSeason: 0, faithPerSeason: 4, influencePerSeason: 1, momentumPerSeason: 0,
    unrestPerSeason: -3, beautinessBonus: 5, buildCostDiscount: 0, wealthGrowthBonus: 0,
    special: { type: 'extra-event-choice' },
  },
  {
    id: 'mount_olympus',
    name: 'Mount Olympus',
    flavour: 'The abode of the gods towers above the clouds. Pilgrims flock to its base, and the faithful are rewarded.',
    goldPerSeason: 0, foodPerSeason: 0, faithPerSeason: 5, influencePerSeason: 0, momentumPerSeason: 0,
    unrestPerSeason: -5, beautinessBonus: 10, buildCostDiscount: 0, wealthGrowthBonus: 0,
    special: null,
  },
  {
    id: 'eleusinian_mysteries',
    name: 'Eleusinian Mysteries',
    flavour: 'The secret rites of Demeter promise salvation in the afterlife. Initiates emerge transformed.',
    goldPerSeason: 0, foodPerSeason: 0, faithPerSeason: 3, influencePerSeason: 2, momentumPerSeason: 0,
    unrestPerSeason: -5, beautinessBonus: 0, buildCostDiscount: 0, wealthGrowthBonus: 0,
    special: null,
  },
  {
    id: 'druidic_stones',
    name: 'Druidic Standing Stones',
    flavour: 'Ancient megaliths hum with forgotten power. The druids guard their secrets, but their blessings touch all.',
    goldPerSeason: 0, foodPerSeason: 1, faithPerSeason: 3, influencePerSeason: 0, momentumPerSeason: 0,
    unrestPerSeason: -2, beautinessBonus: 5, buildCostDiscount: 0, wealthGrowthBonus: 0,
    special: null,
  },
  {
    id: 'temple_of_vesta',
    name: 'Temple of Vesta',
    flavour: 'The eternal flame burns in the sacred hearth. While it burns, Rome endures — and this province prospers.',
    goldPerSeason: 0, foodPerSeason: 0, faithPerSeason: 2, influencePerSeason: 3, momentumPerSeason: 0,
    unrestPerSeason: -8, beautinessBonus: 5, buildCostDiscount: 0, wealthGrowthBonus: 0,
    special: null,
  },
  {
    id: 'isle_of_the_dead',
    name: 'Isle of the Dead',
    flavour: 'A mist-shrouded island where the departed are honoured. The living fear it, but its aura keeps order.',
    goldPerSeason: 0, foodPerSeason: 0, faithPerSeason: 2, influencePerSeason: 0, momentumPerSeason: 1,
    unrestPerSeason: -10, beautinessBonus: 0, buildCostDiscount: 0, wealthGrowthBonus: 0,
    special: null,
  },
  {
    id: 'sacred_grove',
    name: 'Sacred Grove of Diana',
    flavour: 'An ancient forest where the huntress-goddess is worshipped. No axe may fell these trees.',
    goldPerSeason: 0, foodPerSeason: 2, faithPerSeason: 2, influencePerSeason: 0, momentumPerSeason: 0,
    unrestPerSeason: -2, beautinessBonus: 8, buildCostDiscount: 0, wealthGrowthBonus: 0,
    special: null,
  },

  // ══════════════════════════════════════════════
  //  HISTORICAL MONUMENTS (6)
  // ══════════════════════════════════════════════

  {
    id: 'library_of_alexandria',
    name: 'Library of Alexandria',
    flavour: 'The greatest repository of knowledge ever assembled. Scholars flock here, and construction benefits from their expertise.',
    goldPerSeason: 0, foodPerSeason: 0, faithPerSeason: 0, influencePerSeason: 3, momentumPerSeason: 0,
    unrestPerSeason: 0, beautinessBonus: 10, buildCostDiscount: 20, wealthGrowthBonus: 0,
    special: null,
  },
  {
    id: 'romulus_monument',
    name: 'Monument of Romulus & Remus',
    flavour: 'The founders of Rome are honoured here. Their wolf-mother watches over the city, inspiring all who serve.',
    goldPerSeason: 0, foodPerSeason: 0, faithPerSeason: 1, influencePerSeason: 2, momentumPerSeason: 2,
    unrestPerSeason: -3, beautinessBonus: 8, buildCostDiscount: 0, wealthGrowthBonus: 0,
    special: null,
  },
  {
    id: 'forum_of_augustus',
    name: 'Forum of Augustus',
    flavour: 'A grand civic centre where law, commerce, and politics converge. Influence radiates from its marble halls.',
    goldPerSeason: 1, foodPerSeason: 0, faithPerSeason: 0, influencePerSeason: 4, momentumPerSeason: 0,
    unrestPerSeason: -3, beautinessBonus: 12, buildCostDiscount: 0, wealthGrowthBonus: 1,
    special: null,
  },
  {
    id: 'carthaginian_ruins',
    name: 'Carthaginian Ruins',
    flavour: 'The bones of a fallen empire. Scavengers strip its markets of Punic gold, and the rubble yields building stone.',
    goldPerSeason: 3, foodPerSeason: 0, faithPerSeason: 0, influencePerSeason: 0, momentumPerSeason: 0,
    unrestPerSeason: 0, beautinessBonus: 0, buildCostDiscount: 15, wealthGrowthBonus: 1,
    special: null,
  },
  {
    id: 'appian_way',
    name: 'The Appian Way',
    flavour: 'Queen of roads — legions march swiftly along its paved stones, and merchants follow in their wake.',
    goldPerSeason: 2, foodPerSeason: 0, faithPerSeason: 0, influencePerSeason: 0, momentumPerSeason: 2,
    unrestPerSeason: 0, beautinessBonus: 0, buildCostDiscount: 0, wealthGrowthBonus: 2,
    special: null,
  },
  {
    id: 'colosseum',
    name: 'Colosseum',
    flavour: 'Fifty thousand Romans roar as gladiators clash on blood-soaked sand. The mob is pacified — for now.',
    goldPerSeason: 1, foodPerSeason: 0, faithPerSeason: 0, influencePerSeason: 0, momentumPerSeason: 3,
    unrestPerSeason: -10, beautinessBonus: 15, buildCostDiscount: 0, wealthGrowthBonus: 0,
    special: null,
  },

  // ══════════════════════════════════════════════
  //  ECONOMIC WONDERS (5)
  // ══════════════════════════════════════════════

  {
    id: 'silver_mines_laurion',
    name: 'Silver Mines of Laurion',
    flavour: 'Deep shafts plunge into veins of silver. The wealth finances fleets and armies alike.',
    goldPerSeason: 5, foodPerSeason: 0, faithPerSeason: 0, influencePerSeason: 0, momentumPerSeason: 0,
    unrestPerSeason: 3, beautinessBonus: -5, buildCostDiscount: 0, wealthGrowthBonus: 3,
    special: null,
  },
  {
    id: 'phoenician_trade_hub',
    name: 'Phoenician Trade Hub',
    flavour: 'Purple-sailed merchant galleys bring exotic goods from every shore. The docks never sleep.',
    goldPerSeason: 4, foodPerSeason: 0, faithPerSeason: 0, influencePerSeason: 1, momentumPerSeason: 0,
    unrestPerSeason: 0, beautinessBonus: 5, buildCostDiscount: 0, wealthGrowthBonus: 3,
    special: null,
  },
  {
    id: 'amber_road',
    name: 'The Amber Road',
    flavour: 'From the cold Baltic to the warm Mediterranean, amber and furs flow south while gold flows north.',
    goldPerSeason: 3, foodPerSeason: 0, faithPerSeason: 0, influencePerSeason: 0, momentumPerSeason: 0,
    unrestPerSeason: 0, beautinessBonus: 0, buildCostDiscount: 0, wealthGrowthBonus: 4,
    special: null,
  },
  {
    id: 'tin_islands',
    name: 'The Tin Islands',
    flavour: 'Mysterious islands at the edge of the known world. Their tin is essential for bronze — and commands princely sums.',
    goldPerSeason: 3, foodPerSeason: 0, faithPerSeason: 0, influencePerSeason: 0, momentumPerSeason: 1,
    unrestPerSeason: 0, beautinessBonus: 0, buildCostDiscount: 10, wealthGrowthBonus: 2,
    special: null,
  },
  {
    id: 'grain_dole',
    name: 'The Grain Dole',
    flavour: 'Free bread for the masses. It drains the treasury but keeps bellies full and streets quiet.',
    goldPerSeason: -2, foodPerSeason: 3, faithPerSeason: 0, influencePerSeason: 2, momentumPerSeason: 0,
    unrestPerSeason: -8, beautinessBonus: 5, buildCostDiscount: 0, wealthGrowthBonus: 0,
    special: { type: 'famine-immunity' },
  },

  // ══════════════════════════════════════════════
  //  MILITARY SITES (3)
  // ══════════════════════════════════════════════

  {
    id: 'hannibals_crossing',
    name: 'Hannibal\'s Crossing',
    flavour: 'Where the Carthaginian led elephants over the Alps. The memory still inspires audacious tactics.',
    goldPerSeason: 0, foodPerSeason: 0, faithPerSeason: 0, influencePerSeason: 0, momentumPerSeason: 4,
    unrestPerSeason: 0, beautinessBonus: 0, buildCostDiscount: 0, wealthGrowthBonus: 0,
    special: { type: 'unit-discount', percent: 15 },
  },
  {
    id: 'spartan_agoge',
    name: 'Spartan Agoge',
    flavour: 'The brutal training grounds of Lacedaemon. Boys enter, warriors emerge — or they don\'t emerge at all.',
    goldPerSeason: 0, foodPerSeason: 0, faithPerSeason: 0, influencePerSeason: 0, momentumPerSeason: 5,
    unrestPerSeason: 3, beautinessBonus: 0, buildCostDiscount: 0, wealthGrowthBonus: 0,
    special: { type: 'unit-discount', percent: 20 },
  },
  {
    id: 'praetorian_barracks',
    name: 'Praetorian Barracks',
    flavour: 'Elite soldiers guard the emperor\'s interests — and line their own pockets. Dangerous, but indispensable.',
    goldPerSeason: 0, foodPerSeason: 0, faithPerSeason: 0, influencePerSeason: 2, momentumPerSeason: 3,
    unrestPerSeason: -5, beautinessBonus: 0, buildCostDiscount: 0, wealthGrowthBonus: 0,
    special: { type: 'cavalry-bonus' },
  },
];
