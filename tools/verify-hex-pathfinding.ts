import type { HexTile, TerrainType, EventType } from '../src/game/campaign/campaign-types';
import { reachableSet, findPath } from '../src/game/campaign/hex-pathfinding';
import { calculateReachableTiles } from '../src/game/campaign/movement';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

let tileIdCounter = 0;
function makeTile(
  q: number,
  r: number,
  overrides?: Partial<HexTile>,
): HexTile {
  return {
    id: `${q},${r}`,
    q,
    r,
    terrain: 'plains' as TerrainType,
    event: 'none' as EventType,
    discovered: true,
    visited: false,
    reachable: false,
    current: false,
    movementCost: 1,
    ...overrides,
  };
}

// Test 1: Straight-line plains — path from (0,0) to (3,0) with MP=3
{
  const tiles = [
    makeTile(0, 0),
    makeTile(1, 0),
    makeTile(2, 0),
    makeTile(3, 0),
  ];
  const path = findPath(tiles[0], tiles[3], tiles, 3);
  assert(path !== null, 'Test 1: path should exist');
  assert(path!.length === 4, `Test 1: path length should be 4, got ${path!.length}`);
  assert(path![0].id === '0,0', 'Test 1: path starts at (0,0)');
  assert(path![3].id === '3,0', 'Test 1: path ends at (3,0)');
  console.log('PASS: Test 1 — straight-line plains 4-tile path');
}

// Test 2: Mountain detour
// Direct path (0,0)→(1,0)→(2,0) is blocked at (1,0). Detour via (1,-1).
{
  const tiles = [
    makeTile(0, 0),
    makeTile(1, 0, { terrain: 'mountains', movementCost: 999 }),
    makeTile(2, 0),
    makeTile(1, -1),
    makeTile(2, -1),
  ];
  const path = findPath(tiles[0], tiles[2], tiles, 10);
  assert(path !== null, 'Test 2: detour path should exist');
  assert(path!.length > 2, `Test 2: detour path length ${path!.length} should be > 2`);
  const ids = path!.map((t) => t.id);
  assert(!ids.includes('1,0'), 'Test 2: path does not cross mountains');
  console.log('PASS: Test 2 — mountain detour');
}

// Test 3: Unreachable past MP budget
{
  const tiles = [
    makeTile(0, 0),
    makeTile(1, 0),
    makeTile(2, 0),
    makeTile(3, 0),
  ];
  const path = findPath(tiles[0], tiles[3], tiles, 2);
  assert(path === null, 'Test 3: path should be null when goal costs 3 but MP=2');
  console.log('PASS: Test 3 — unreachable past MP budget returns null');
}

// Test 4: Regression vs S30 — immediate neighbor included in reachable set
{
  const tiles = [
    makeTile(0, 0, { current: true }),
    makeTile(1, 0),
    makeTile(0, 1),
  ];
  const reachable = calculateReachableTiles(tiles[0], tiles, 2);
  const ids = reachable.map((t) => t.id);
  assert(ids.includes('1,0'), 'Test 4: immediate neighbor (1,0) should be reachable');
  console.log('PASS: Test 4 — immediate neighbor is reachable (S30 regression)');
}

// Test 5: Visited retreat — a visited tile IS in the reachable set
{
  const tiles = [
    makeTile(0, 0, { current: true }),
    makeTile(1, 0, { visited: true }),
  ];
  const set = reachableSet(tiles[0], tiles, 2);
  assert(set.has('1,0'), 'Test 5: visited tile should be reachable (retreat allowed)');
  console.log('PASS: Test 5 — visited tile is in reachable set (retreat)');
}

// Test 6: Undiscovered wall — undiscovered tile is NOT in reachable set
{
  const tiles = [
    makeTile(0, 0),
    makeTile(1, 0, { discovered: false }),
  ];
  const set = reachableSet(tiles[0], tiles, 3);
  assert(!set.has('1,0'), 'Test 6: undiscovered tile should not be reachable');
  console.log('PASS: Test 6 — undiscovered tile excluded from reachable set');
}

// Test 7: reachableSet costs — 2 plains steps cost 2
{
  const tiles = [
    makeTile(0, 0),
    makeTile(1, 0),
    makeTile(2, 0),
  ];
  const set = reachableSet(tiles[0], tiles, 3);
  assert(set.get('0,0') === 0, 'Test 7: start tile cost should be 0');
  assert(set.get('1,0') === 1, 'Test 7: first step cost should be 1');
  assert(set.get('2,0') === 2, `Test 7: second step cost should be 2, got ${set.get('2,0')}`);
  console.log('PASS: Test 7 — reachableSet costs are cumulative per tile entered');
}

console.log('\nAll pathfinding checks passed');
