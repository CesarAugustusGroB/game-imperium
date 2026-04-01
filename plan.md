# Plan: S6-09 — Build Province Map View (conquered territories visualization)

## Task
Add a visual territory map to the ProvinceScreen showing conquered provinces on a strategic map. Each roguelike Province (from spoke completions) maps to a geographic map province. Player-owned territories are highlighted in commander faction color, with markers showing province names and unrest status. Clicking a territory selects it in the ledger.

## Approach
Build a Canvas2D mini-map component that renders the terrain image as background, overlays province territory markers at their UV positions (from topology.json), and highlights player-owned provinces. This avoids the complexity of embedding the full WebGL renderer while still providing meaningful geographic visualization.

Map roguelike provinces to map provinces sequentially: Roma→Latium (index 27, the Papal province — thematically Roman), subsequent conquests assigned to adjacent territories via topology adjacency graph.

## Steps
1. **Create province-map-store.ts** — loads topology.json, maintains mapping of roguelike province IDs to map province indices, expands territory via adjacency on each new conquest.
2. **Create ProvinceMapView component** — Canvas2D component that draws terrain background, province markers at UV positions, faction-colored highlights for owned territories, unrest indicators.
3. **Integrate into ProvinceScreen** — add map view above the two-column layout, clicking a marker selects province in ledger.
4. **Wire territory expansion** — when conquerProvince() runs, also claim the next map province via adjacency.

## Files to Change
| File | Change | Reason |
|------|--------|--------|
| `src/game/province-map-store.ts` | create | Topology loading, territory mapping, expansion |
| `src/ui/ProvinceMapView.tsx` | create | Canvas2D map visualization component |
| `src/ui/ProvinceScreen.tsx` | modify | Integrate map view, wire click-to-select |
| `src/game/province-store.ts` | modify | Call territory expansion on conquer |
| `src/game/game-state.ts` | modify | Init/reset province map store |

## Design decisions
- **Canvas2D over WebGL**: Simpler, no shader work, sufficient for markers on a static background.
- **Sequential expansion**: New provinces claim adjacent unclaimed map territories, creating a growing empire feel.
- **Roma = Latium**: Thematic starting point (Roman empire headquartered in Latium).

## Out of scope
- Full WebGL map integration with live LUT updates
- Map-based province creation (clicking to conquer)
- Animated territory transitions
