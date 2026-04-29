// Pixi colors are 24-bit numbers (e.g. 0xd4a843). This helper formats them
// as 7-char hex strings for CSS — `#d4a843` etc. Used by the campaign UI
// to mirror Pixi terrain/event colors into Preact-rendered HUD elements.
export function colorToCss(hex: number): string {
  return '#' + hex.toString(16).padStart(6, '0');
}

export function rgbToKey(r: number, g: number, b: number): string {
  return `${r},${g},${b}`;
}

export function keyToRgb(key: string): [number, number, number] {
  const parts = key.split(',').map(Number);
  return [parts[0], parts[1], parts[2]];
}

export function rgbToIndex(r: number, g: number, b: number): number {
  return r * 65536 + g * 256 + b;
}

export function indexToRgb(index: number): [number, number, number] {
  const r = (index >> 16) & 0xff;
  const g = (index >> 8) & 0xff;
  const b = index & 0xff;
  return [r, g, b];
}
