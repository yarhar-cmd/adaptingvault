import { describe, expect, it } from 'vitest';
import { NEUTRAL_ADAPTIVE_PROFILE } from '../services/playerProfileStorage';
import type { RoomDefinition } from '../types/rooms';
import { generateDungeonRoom } from './generatedRoomGenerator';
import { validateGeneratedRoom } from './generatedRoomValidator';

function validRoom(): RoomDefinition {
  return generateDungeonRoom({
    runSeed: 'validator-fixture',
    dungeonRoomNumber: 1,
    chosenExitId: 'fixture-exit',
    entranceDirection: 'west',
    experiencePreset: 'seasoned-adventurer',
    effectiveProfile: NEUTRAL_ADAPTIVE_PROFILE,
    mode: 'reinforce',
  }).roomSnapshot;
}

describe('Resonant Ruins generated-room validator', () => {
  it('rejects out-of-bounds and duplicate terrain coordinates', () => {
    const room = validRoom();
    expect(
      validateGeneratedRoom({
        ...room,
        wallTiles: [...room.wallTiles!, { x: -1, y: 0 }, room.wallTiles![0]!],
        hazards: [
          ...room.hazards!,
          { x: -1, y: -1 },
          ...(room.hazards![0] ? [room.hazards![0]] : []),
        ],
      }).errors,
    ).toEqual(
      expect.arrayContaining(['wall-out-of-bounds', 'duplicate-wall', 'hazard-out-of-bounds']),
    );
  });

  it('rejects an entrance on the wrong boundary or overlapping an enabled exit', () => {
    const room = validRoom();
    const exit = room.exits[0]!;
    expect(
      validateGeneratedRoom({
        ...room,
        entrance: { direction: 'west', tile: exit.tile },
      }).errors,
    ).toEqual(expect.arrayContaining(['invalid-entrance', 'entrance-exit-overlap']));
  });

  it('rejects malformed exit structure and duplicate exit identity', () => {
    const room = validRoom();
    const first = room.exits[0]!;
    expect(
      validateGeneratedRoom({
        ...room,
        exits: [{ ...first, condition: { type: 'invented' } as never }, { ...first }],
      }).errors,
    ).toEqual(
      expect.arrayContaining([
        'invalid-exit-structure',
        'duplicate-exit-id',
        'duplicate-exit-coordinate',
      ]),
    );
  });

  it('rejects hazards on the spawn and unsafe routes', () => {
    const room = validRoom();
    const spawn = room.spawnPoints![room.entrance!.direction]!;
    expect(
      validateGeneratedRoom({
        ...room,
        hazards: [...room.hazards!, spawn],
      }).errors,
    ).toEqual(expect.arrayContaining(['invalid-spawn', 'hazard-near-spawn']));
  });
});
