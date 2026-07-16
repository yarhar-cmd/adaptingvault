import { describe, expect, it, vi } from 'vitest';
import { NEUTRAL_ADAPTIVE_PROFILE } from '../services/playerProfileStorage';
import { generateDungeonRoom, oppositeExitDirection } from './generatedRoomGenerator';
import { hasSafePath, validateGeneratedRoom } from './generatedRoomValidator';

function request(seed: string, room = 1) {
  return {
    runSeed: seed,
    dungeonRoomNumber: room,
    chosenExitId: `exit-${room}`,
    entranceDirection: 'west' as const,
    experiencePreset: 'seasoned-adventurer' as const,
    effectiveProfile: NEUTRAL_ADAPTIVE_PROFILE,
    mode: 'reinforce' as const,
  };
}

describe('Resonant Ruins deterministic generated rooms', () => {
  it('reproduces identical inputs and changes deterministic room seed with exit input', () => {
    expect(generateDungeonRoom(request('same'))).toEqual(generateDungeonRoom(request('same')));
    expect(
      generateDungeonRoom({ ...request('same'), chosenExitId: 'different' }).roomSeed,
    ).not.toBe(generateDungeonRoom(request('same')).roomSeed);
  });
  it('supports cardinal opposite-side entrances', () => {
    expect(
      ['north', 'south', 'east', 'west'].map((direction) =>
        oppositeExitDirection(direction as never),
      ),
    ).toEqual(['south', 'north', 'west', 'east']);
  });
  it('validates at least 1,000 deterministic seeds with connected floors, legal exits, and hazard-free routes', () => {
    const shapes = new Set<string>();
    let sawZeroHazards = false;
    for (let index = 0; index < 1_000; index += 1) {
      const generated = generateDungeonRoom(request(`property-${index}`, index + 1));
      const room = generated.roomSnapshot;
      const validation = validateGeneratedRoom(room);
      expect(validation.errors, `${generated.roomSeed}: ${validation.errors.join(',')}`).toEqual(
        [],
      );
      expect(room.width).toBeGreaterThanOrEqual(room.shape === 'l-shape' ? 11 : 9);
      expect(room.width).toBeLessThanOrEqual(21);
      expect(room.height).toBeLessThanOrEqual(15);
      expect(room.exits.length).toBeGreaterThanOrEqual(1);
      expect(room.exits.length).toBeLessThanOrEqual(3);
      expect(room.entrance).toBeDefined();
      const spawn = room.spawnPoints?.[room.entrance?.direction ?? 'west'];
      expect(spawn).toBeDefined();
      if (!spawn) throw new Error('Generated room did not include its validated spawn.');
      expect(room.exits.every((exit) => hasSafePath(room, spawn, exit.tile))).toBe(true);
      shapes.add(room.shape!);
      if ((room.hazards?.length ?? 0) === 0) sawZeroHazards = true;
    }
    expect(shapes).toEqual(new Set(['rectangle', 'l-shape']));
    expect(sawZeroHazards).toBe(true);
  });
  it('rejects an invalid room and returns a known-safe fallback after exactly twenty forced invalid candidates', () => {
    const generated = generateDungeonRoom(request('invalid-check'));
    expect(validateGeneratedRoom({ ...generated.roomSnapshot, exits: [] })).toMatchObject({
      valid: false,
    });
    let attempts = 0;
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const fallback = generateDungeonRoom(request('forced-fallback'), () => {
      attempts += 1;
      return { valid: false, errors: ['forced-invalid'] };
    });
    expect(attempts).toBe(20);
    expect(fallback.details).toMatchObject({
      mode: 'fallback',
      retryCount: 20,
      validationErrors: ['forced-invalid'],
    });
    expect(validateGeneratedRoom(fallback.roomSnapshot).valid).toBe(true);
    expect(warning).toHaveBeenCalledWith(
      'Resonant Ruins generation fallback',
      expect.objectContaining({
        retryCount: 20,
        validationErrors: ['forced-invalid'],
        fallback: true,
      }),
    );
    warning.mockRestore();
  });
});
