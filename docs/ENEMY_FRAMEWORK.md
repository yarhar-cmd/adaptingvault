# Resonant Ruins Enemy Framework v0.2

Rat Combat & Kiting v0.2 keeps gameplay frontend-authoritative. `gameplayReducer` owns combat state and absolute deadlines, `useEnemyClock` supplies one shared 25 ms timestamped tick, and React/CSS only render that state. Animation callbacks never deal damage.

## Rat model

Every Rat stores a cardinal facing, permanent room awareness (`unaware` or `alerted`), position, health, locked attack target, combat state, serializable deadlines, recovery kind, last attack outcome, and bounded debug fields. The living state sequence is:

`idle` → `chasing` → `telegraphing` → `lunging` → `recovering` → `chasing`

Any living state may become `corpse`. A lethal sword hit clears the pending target and every attack deadline. A nonlethal sword hit during telegraph damages the Rat without interrupting it.

## Central balance configuration

`apps/frontend/src/config/combat.ts` is the single TypeScript source of truth.

| Rule                                 |                 Initial v0.2 value |
| ------------------------------------ | ---------------------------------: |
| Rat movement interval                |                             333 ms |
| Attack telegraph                     |                             425 ms |
| Visual lunge                         |                             100 ms |
| Standard recovery                    |                             300 ms |
| Perfect-block recovery               |                       500 ms total |
| Perfect-block window                 | final 125 ms before logical impact |
| Room-entry awareness grace           |                             500 ms |
| Awareness range                      |                       7 path tiles |
| Attacked-Rat alert propagation       |                       3 path tiles |
| Generated Rat minimum spawn distance |                       4 path tiles |
| Rat health / damage                  |                              2 / 1 |
| Player damage invulnerability        |                             500 ms |

These values are constant across experience presets. Presets still affect authored/generated Rat quantity only.

## Awareness and authored Chambers

Rats begin unaware and idle. Awareness evaluation starts after the 500 ms room-entry grace period and uses deterministic cardinal path distance, not straight-line distance. A Rat within 7 path tiles becomes alerted permanently for that room. Striking an unaware Rat alerts it immediately and alerts living Rats within 3 path tiles of the struck Rat.

The same rules apply to authored and generated Rats. Automated reachability coverage confirms that every authored Rat in Awakening Chambers 4 and 5 remains reachable from the player spawn and that their enemy-defeat exit objectives remain completable. The tutorial layout was not redesigned.

## Attack, dodge, and recovery

An adjacent chasing Rat faces the player, locks the player's current tile, and telegraphs for 425 ms without moving or retargeting. At the stored logical impact deadline, the reducer resolves exactly one outcome and enters `lunging`. The 100 ms lunge is visual only: the Rat remains on its logical tile and cannot deal a second collision or damage event.

Leaving the locked tile causes a miss. Remaining there causes a hit unless the current held shield faces the Rat. Hit, miss, and regular block all lead to 300 ms recovery after the visual lunge. Perfect block leads to 500 ms recovery and stronger recoil. Multiple Rats may telegraph and resolve on the same tick; stable Rat-ID order plus the existing universal invulnerability window makes health loss deterministic.

## Shield and perfect block

The shield exists only while a keyboard Shift key or accessible hold control is physically active. Shielding locks movement but still permits turning. It protects only the current facing direction.

A block is perfect when either the shield was freshly raised in the correct direction or an already-raised shield was turned into the correct direction during the final 125 ms before logical impact. A shield held correctly before that window gives a regular block.

The player token renders a metallic-gray shield at its facing edge. The former protected-neighbor outline, hexagon marker, and inactive carried shield are removed. Sage `#7E9C82` appears briefly after a successful block; perfect blocks use a stronger sage reaction and Rat recoil. No visible BLOCKED, PERFECT, or PARRY label is rendered.

## Deterministic movement and body-lock prevention

Rats use cardinal BFS with stable neighbor order north, west, east, south. Void, walls, and exits are not walkable; rune hazards are walkable. Living Rats and the player are dynamic blockers. Stable Rat-ID processing and destination reservation prevent overlap, same-tile commits, and direct swaps.

Before a chasing Rat commits a preferred move, the reducer calculates the player's current legal cardinal escapes. If static room geometry provides at least two legal movement choices but other Rats have reduced the player to one current escape, a nonattacking Rat avoids reserving that final tile when it can choose another deterministic candidate or wait. Telegraphing, lunging, and recovering Rats remain stationary. Attack permission is not limited by this rule. Genuine geometric dead ends are not made safe.

## Pause, save, and refresh

Active-run schema v6 stores current-room Rat facing, awareness, target, state, attack outcome, recovery kind, metrics, and remaining movement, awareness-grace, telegraph, lunge, recovery, corpse, and feedback durations. v5 `cooldown` records migrate to v6 `recovering` records without losing remaining time. Earlier migrations remain supported.

Pause freezes every enemy deadline by shifting it by the exact paused duration on resume. Refresh reconstructs deadlines from remaining durations. Restoring `lunging` means logical impact already occurred, so later ticks only enter recovery and cannot apply duplicate damage.

Exact restoration refers to authoritative combat state and timers. Physical keyboard/pointer held state and perfect-block input timestamps are intentionally cleared on pause or refresh; the player resumes with the shield lowered to prevent stuck controls.

Generated room saves retain the generator version that produced them. New rooms use `generator-2`; legacy numeric version `1` restores as `generator-1` instead of being relabeled. The game version is `mvp-0.2`, adaptation remains `rules-1`, and telemetry schema remains `1`.

## Development diagnostics

Development-only Combat Debug shows each Rat's ID, tile, facing, awareness, path distance, state, target, remaining deadlines, blockage, and selected step. It also shows player escape tiles, live Rat-state counts, attacks, dodges, blocks, sword results, damage, combat duration, maximum alert pressure, and body-lock interventions.

Resetting Combat Debug stores a local display baseline only. It does not mutate gameplay, adaptive data, Rat state, run history, or saved-run integrity. Debug Tools and all Combat Debug labels remain behind `import.meta.env.DEV`; the production safety scan rejects those strings in emitted JavaScript.

## Deliberately deferred

No new enemy, healing, weapon, upgrade, treasure, boss, audio, mobile control, research telemetry, machine learning, backend authority, internal-wall generator, or preset-specific Rat intelligence is included. Balance questions still requiring browser playtesting are recorded in `docs/BALANCE_CHANGELOG.md`.
