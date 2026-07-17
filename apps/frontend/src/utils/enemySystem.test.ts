import { describe, expect, it } from 'vitest';
import { NEUTRAL_ADAPTIVE_PROFILE } from '../services/playerProfileStorage';
import type { ExperiencePreset } from '../types/adaptation';
import {
  RAT_ATTACK_COOLDOWN_MS,
  RAT_ATTACK_DAMAGE,
  RAT_ATTACK_TELEGRAPH_MS,
  RAT_CORPSE_ABSORPTION_MS,
  RAT_MAX_HEALTH,
  RAT_MOVEMENT_INTERVAL_MS,
} from '../types/enemies';
import type { RoomDefinition } from '../types/rooms';
import { createRectangularRoom } from './roomGeometry';
import {
  authoredRatCount,
  createRoomEnemyState,
  findRatPath,
  nextRatPathStep,
  selectGeneratedRatSpawns,
} from './enemySystem';

function room(): RoomDefinition {
  return createRectangularRoom({
    id: 'rat-path-room',
    phase: 'dungeon',
    width: 9,
    height: 7,
    exitEnabled: true,
    hazards: [{ x: 4, y: 3 }],
    enemySpawns: [
      {
        id: 'rat-1',
        type: 'rat',
        tile: { x: 6, y: 3 },
        order: 1,
        source: 'generated',
        reason: 'Test spawn',
      },
    ],
  });
}

describe('Resonant Ruins Rat framework', () => {
  it('keeps the exact fixed Rat constants', () => {
    expect({
      RAT_MOVEMENT_INTERVAL_MS,
      RAT_ATTACK_TELEGRAPH_MS,
      RAT_ATTACK_COOLDOWN_MS,
      RAT_MAX_HEALTH,
      RAT_ATTACK_DAMAGE,
      RAT_CORPSE_ABSORPTION_MS,
    }).toEqual({
      RAT_MOVEMENT_INTERVAL_MS: 333,
      RAT_ATTACK_TELEGRAPH_MS: 300,
      RAT_ATTACK_COOLDOWN_MS: 1_200,
      RAT_MAX_HEALTH: 2,
      RAT_ATTACK_DAMAGE: 1,
      RAT_CORPSE_ABSORPTION_MS: 700,
    });
  });

  it('uses deterministic cardinal BFS, permits hazards, and respects occupied tiles', () => {
    const fixture = room();
    const start = { x: 6, y: 3 };
    const player = { x: 2, y: 3 };
    const first = findRatPath(fixture, start, player);
    const second = findRatPath(fixture, start, player);
    expect(first).toEqual(second);
    expect(first).toContainEqual({ x: 4, y: 3 });
    expect(
      first?.every(
        (tile, index) =>
          index === 0 ||
          Math.abs(tile.x - first[index - 1]!.x) + Math.abs(tile.y - first[index - 1]!.y) === 1,
      ),
    ).toBe(true);

    const rat = createRoomEnemyState(fixture, 'seasoned-adventurer', 1_000).rats[0]!;
    expect(nextRatPathStep(fixture, rat, player, new Set(['5:3']))).not.toEqual({ x: 5, y: 3 });
  });

  it('returns no path without crashing when static geometry encloses the Rat', () => {
    const fixture = room();
    const enclosed = {
      ...fixture,
      wallTiles: [
        ...(fixture.wallTiles ?? []),
        { x: 5, y: 3 },
        { x: 6, y: 2 },
        { x: 6, y: 4 },
        { x: 7, y: 3 },
      ],
    };
    expect(findRatPath(enclosed, { x: 6, y: 3 }, { x: 2, y: 3 })).toBeNull();
  });

  it('uses preset quantity only for authored encounters and never changes Rat stats', () => {
    const fixture = {
      ...room(),
      phase: 'evaluation' as const,
      enemySpawns: Array.from({ length: 3 }, (_, index) => ({
        id: `rat-${index + 1}`,
        type: 'rat' as const,
        tile: { x: 6 - index, y: 2 },
        order: index + 1,
        source: 'authored' as const,
        reason: `Authored ${index + 1}`,
      })),
    };
    const presets: ExperiencePreset[] = ['new-delver', 'seasoned-adventurer', 'dungeon-veteran'];
    expect(presets.map(authoredRatCount)).toEqual([1, 2, 3]);
    expect(
      presets.map((preset) => createRoomEnemyState(fixture, preset, 1_000).rats.length),
    ).toEqual([1, 2, 3]);
    for (const preset of presets) {
      for (const rat of createRoomEnemyState(fixture, preset, 1_000).rats) {
        expect(rat).toMatchObject({ health: 2, nextMovementAt: 1_333 });
      }
    }
  });

  it('selects generated Rat spawns deterministically within preset caps and safe distances', () => {
    const fixture = room();
    const input = {
      roomSeed: 'stable-seed',
      preset: 'dungeon-veteran' as const,
      profile: NEUTRAL_ADAPTIVE_PROFILE,
      mode: 'reinforce' as const,
      playerSpawn: { x: 1, y: 3 },
    };
    const first = selectGeneratedRatSpawns(fixture, input);
    const second = selectGeneratedRatSpawns(fixture, input);
    expect(first).toEqual(second);
    expect(first.plan.cap).toBe(4);
    expect(first.spawns.length).toBeLessThanOrEqual(4);
    for (const spawn of first.spawns) {
      expect(fixture.hazards).not.toContainEqual(spawn.tile);
      expect(
        Math.abs(spawn.tile.x - input.playerSpawn.x) + Math.abs(spawn.tile.y - input.playerSpawn.y),
      ).toBeGreaterThanOrEqual(5);
    }
  });
});
