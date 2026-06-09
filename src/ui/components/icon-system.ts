export const ICON_SIZES = {
  stat: 14,
  micro: 17,
  inline: 21,
  row: 24,
  panel: 27,
  hud: 33,
  classLabel: 35,
  hero: 40,
} as const;

export type IconSizeName = keyof typeof ICON_SIZES;
export type IconSize = IconSizeName | number;

export function resolveIconSize(size: IconSize): number {
  return typeof size === 'number' ? size : ICON_SIZES[size];
}
