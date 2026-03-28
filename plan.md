# Plan: S2-01 — Define SpokeNode type

## Task
Create the foundational type definitions for the node map system: `NodeType`, `NodeReward`, and `SpokeNode`. These types are the building blocks for all Sprint 2 work (spoke generator, node map UI, node resolution).

## Approach
Single new file `src/game/spoke.ts` following the same pattern as `src/game/commander.ts` — plain TypeScript interfaces and type aliases, importing `ResourceType` to avoid duplication. This file will grow in S2-02 (Spoke type + signals) and S2-03 (generator function).

## Steps
1. Create `src/game/spoke.ts`
2. Import `ResourceType` from `./commander`
3. Define `NodeType` union: `'battle' | 'rest' | 'event' | 'boss'`
4. Define `NodeReward` type: `{ resource: ResourceType; amount: number }[]`
5. Define `SpokeNode` interface with all fields from the Notion spec

## Files to Change
| File | Change | Reason |
|------|--------|--------|
| `src/game/spoke.ts` | create | New file for spoke/node types |

## Design decisions
- **DRY**: Reuse `ResourceType` from `commander.ts` instead of redefining resource strings
- **Extensibility**: `NodeType` is a union that Sprint 6 will extend with 5 more variants
- **NodeReward as array**: A node can grant multiple resource types (e.g. battle gives gold + momentum)

## Test plan
- `npx tsc --noEmit` passes (type-only task, no runtime behavior)

## Risks
| Risk | Mitigation |
|------|------------|
| None | Estimate S, pure types |

## Out of scope
- `Spoke` container type (S2-02)
- Signals and reactive state (S2-02)
- Spoke generator function (S2-03)
