// S30: gate the new PixiJS hex campaign map behind a compile-time flag.
// Flipped true at S30-07 once HexMapView lands and the Bellum tab can
// render the new map end-to-end. S30-12 retires the flag and removes
// the legacy NodeMapScreen entirely.
export const BELLUM_USE_PIXI = true;
