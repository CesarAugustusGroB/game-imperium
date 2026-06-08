import type { ArmorMaterial } from '../../types/index';

/** Armor tiers in ascending protection order. */
export const ARMOR_LADDER: readonly ArmorMaterial[] = ['copper', 'bronze', 'iron', 'steel'] as const;

/** Gold to upgrade FROM each tier to the next; null = already at the top. */
export const ARMOR_UPGRADE_GOLD: Record<ArmorMaterial, number | null> = {
  copper: 60, bronze: 120, iron: 220, steel: null,
};

/** The next tier up, or null if already at the top. */
export function nextArmorTier(material: ArmorMaterial): ArmorMaterial | null {
  const i = ARMOR_LADDER.indexOf(material);
  return i >= 0 && i < ARMOR_LADDER.length - 1 ? ARMOR_LADDER[i + 1] : null;
}

/** Gold cost to upgrade from `material` to the next tier, or null at the top. */
export function armorUpgradeCost(material: ArmorMaterial): number | null {
  return ARMOR_UPGRADE_GOLD[material];
}
