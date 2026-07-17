# Resonant Ruins Enemy Framework v1

## Scope and authority

Enemy Framework v1 adds one enemy type, the Rat. Gameplay remains frontend-authoritative and the existing `gameplayReducer` plus `useRunController` remain the only gameplay state authority. React components render reducer state; they do not own independent combat or timer state.

The milestone does not add variants, bosses, ranged attacks, projectiles, stun, knockback, parry, loot, healing, upgrades, audio, accounts, backend persistence, or deployment work.

## Rat model and fixed constants

Rat state is typed as `chasing`, `telegraphing`, `cooldown`, or `corpse`. The constants in `apps/frontend/src/types/enemies.ts` are fixed for every preset, room depth, adaptive profile, and mode:

| Constant                                |    Value |
| --------------------------------------- | -------: |
| Movement interval                       |   333 ms |
| Attack telegraph                        |   300 ms |
| Attack cooldown                         | 1,200 ms |
| Maximum health                          |        2 |
| Attack damage                           |        1 |
| Corpse absorption                       |   700 ms |
| Universal player damage invulnerability |   500 ms |

## Movement, pathfinding, and collision

One shared 25 ms enemy clock sends timestamped ticks into the reducer only while current-room enemy objects exist. Rats move at most once per 333 ms interval and only in four cardinal directions. Deterministic BFS uses the stable neighbor order north, west, east, south. The player tile is a pathfinding destination but is never entered.

Static Rat pathfinding excludes void, walls, and exits. Dynamic movement also excludes every other living Rat and the player tile. Rune hazards remain walkable for Rats and never damage them. If no path exists or another Rat commits the desired tile first, the Rat waits for a later movement tick.

The player cannot enter a living Rat tile. Corpses become non-blocking immediately. While living enemies remain, exits whose condition is `enemies-defeated` are sealed for player collision and rendering. The final death opens those exits immediately; the 700 ms corpse effect may continue.

## Attacks, shield, and sword

An adjacent chasing Rat locks the player's current tile and rears for 300 ms without moving or retargeting. Resolution hits only that locked tile. Moving away causes a miss. The Rat then spends exactly 1,200 ms in cooldown.

At impact, directional blocking compares the Rat's current direction from the player with the player's current facing. A held shield blocks only matching directions, so the player can turn during the telegraph. A block deals no damage and does not stun, move, or reset the Rat. The CSS shield remains a carried gray shield when inactive and moves in front while active; it is not a ring.

Multiple Rats may telegraph and resolve in the same tick. The first unblocked hit starts the universal 500 ms player invulnerability window, so later same-window hits do not remove more health. Misses and blocks do not start invulnerability.

The sword attacks the adjacent facing tile for one damage. Rats have two health, show an injured mark at one health, and require two valid hits. Sword hits do not stun or knock back. A lethal hit cancels telegraph/cooldown state, increments defeat once, opens sealed exits immediately when it is the final Rat, and begins corpse absorption.

## Spawning and adaptation limits

Awakening Chambers 4 and 5 each define three ordered authored Rat spawns. Presets activate the first one, two, or three spawns for New Delver, Seasoned Adventurer, and Dungeon Veteran respectively. Authored priority is never randomized.

Generated rooms select zero or more safe deterministic spawns with caps of two, three, and four for those presets. Candidate tiles must be walkable floor, outside hazards and exits, at least five path steps from the player, at least two cardinal steps from an exit, reachable, unique, and compatible with the sealed-exit condition. If fewer safe tiles exist, the selected count is reduced.

Adaptation affects generated Rat quantity only. Existing aggression, caution, hazard-tolerance, room-shape/size, mode, preset, and seeded pressure inputs make small bounded count adjustments. They never alter Rat health, damage, speed, telegraph, cooldown, pathfinding, or player invulnerability. New combat signals are bounded numeric summaries; they do not currently change the five adaptive traits directly.

## Awakening order and authored rooms

New runs always use Chambers 1, 2, 3, 4, and 5 in order, then generated Dungeon Rooms. Chamber 4 is a clear 17 by 11 Rat-combat introduction without runes. Chamber 5 is a larger 21 by 15 combined encounter with sparse runes.

Legacy schema records keep any valid persisted `evaluation-room-*` order and current room. Migration does not teleport, replay, or regenerate the current room. Only new runs adopt the fixed order.

## Persistence, pause, and recovery

Active-run schema v5 stores exact enemy state for the current room only: IDs, type, position, health, state, locked target, remaining movement/telegraph/cooldown/corpse/hit-feedback durations, defeat-count flag, spawn metadata, count plan, AI freeze, and recent block feedback. It does not store past enemy paths or detailed enemy state from prior rooms.

Pause stores remaining durations relative to the pause timestamp. Resume shifts every absolute enemy deadline by the exact paused duration. Refreshing a paused run therefore preserves telegraph, cooldown, hit, and corpse time. Defeat and restart follow the existing archive/run lifecycle.

Schema v4 and older migrations use an empty current-room enemy state instead of inventing retroactive encounters. A malformed living enemy invalidates only the active run; profile, settings, and archive storage remain independent. A malformed or expired corpse is discarded without recounting defeat. Player-position repair excludes living Rat tiles.

## Development tools and Awakening editor

Development Debug Tools show current Rat state, path target/next step, remaining deadlines, spawn reason, counts, sealing, generated quantity inputs, and combat signals. `Spawn Rat`, `Defeat All Enemies`, and `Freeze Enemy AI` use reducer actions. Debug advance refuses while a living enemy seals the exit.

The development-only Awakening editor supports Chambers 1–5, dimensions, floor, wall/void, player spawn, normal and shortcut exits, hazards, ordered Rat spawns, erase, validation, reset, JSON copy, and isolated playable preview. Drafts use only `mirrorvault:awakening-editor-drafts:v1`; corruption clears that key alone. Normal gameplay always reads official room definitions from `apps/frontend/src/data/rooms/evaluationRooms.ts`.

After validation, use **Copy Room JSON** and manually update the matching definition in `apps/frontend/src/data/rooms/evaluationRooms.ts`. The browser never rewrites source files. Preview has its own reducer and enemy clock and never writes the active run, player profile, archive, or run history.

Production compilation removes the Debug/editor branch guarded by `import.meta.env.DEV`. After `npm run build`, `npm run verify:production-safety` scans emitted JavaScript for editor keys, controls, and diagnostics.

## Verification and limitations

Run `npm.cmd run test`, `npm.cmd run test:e2e`, `npm.cmd run lint`, `npm.cmd run typecheck`, `npm.cmd run build`, and `npm.cmd run verify:production-safety` from the repository root.

Coverage includes constants, deterministic BFS, collision, telegraph/miss/block/damage behavior, simultaneous i-frames, sword and corpse behavior, fixed authored counts, generated spawn validation, schema v5 restore, pause timing, 1,000-room bounded storage, editor isolation, official room validation, and Chromium critical flows.

Remaining limitations are intentional: temporary CSS Rat art, no parry, no enemy variety, no backtracking, no combat rewards, no backend authority, and no production editor.
