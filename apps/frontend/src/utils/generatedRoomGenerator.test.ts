import { describe, expect, it, vi } from 'vitest';
import { VERSION_INFO } from '../config/version';
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
    const generated = generateDungeonRoom(request('same'));
    expect(generated).toEqual(generateDungeonRoom(request('same')));
    expect(generated).toMatchObject({
      generatorVersion: VERSION_INFO.generatorVersion,
      details: { generatorVersion: VERSION_INFO.generatorVersion },
    });
    expect(generated.roomSeed.endsWith(`:${VERSION_INFO.generatorVersion}`)).toBe(true);
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
  it('validates 1,200 deterministic seeds across presets, entrances, and modes', () => {
    const shapes = new Set<string>();
    const entrances = new Set<string>();
    const hazardPatterns = new Set<string>();
    const exitCounts = new Set<number>();
    const ratCounts = new Map<string, Set<number>>();
    let maximumHazards = 0;
    let sawZeroHazards = false;
    const directions = ['north', 'south', 'east', 'west'] as const;
    const presets = ['new-delver', 'seasoned-adventurer', 'dungeon-veteran'] as const;
    for (let index = 0; index < 1_200; index += 1) {
      const preset = presets[index % presets.length];
      const generated = generateDungeonRoom({
        ...request(`property-${index}`, index + 1),
        entranceDirection: directions[index % directions.length],
        mode: index % 2 === 0 ? 'reinforce' : 'poke',
        experiencePreset: preset,
      });
      const room = generated.roomSnapshot;
      const validation = validateGeneratedRoom(room);
      expect(
        validation.errors,
        `${generated.roomSeed}; preset=${preset}; shape=${room.shape}; requested=${generated.details.enemyCountPlan?.requestedCount}; selected=${room.enemySpawns?.length ?? 0}; errors=${validation.errors.join(',')}`,
      ).toEqual([]);
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
      entrances.add(room.entrance!.direction);
      hazardPatterns.add(generated.details.hazardPattern);
      exitCounts.add(room.exits.length);
      const counts = ratCounts.get(preset) ?? new Set<number>();
      counts.add(room.enemySpawns?.length ?? 0);
      ratCounts.set(preset, counts);
      maximumHazards = Math.max(maximumHazards, room.hazards?.length ?? 0);
      if ((room.hazards?.length ?? 0) === 0) sawZeroHazards = true;
    }
    expect(shapes).toEqual(new Set(['rectangle', 'l-shape']));
    expect(entrances).toEqual(new Set(directions));
    expect(hazardPatterns).toEqual(new Set(['scattered', 'clustered']));
    expect(exitCounts).toEqual(new Set([1, 2, 3]));
    expect(sawZeroHazards).toBe(true);
    expect(maximumHazards).toBeGreaterThanOrEqual(4);
    expect(ratCounts.get('new-delver')).toEqual(new Set([0, 1, 2]));
    expect(ratCounts.get('seasoned-adventurer')).toEqual(new Set([0, 1, 2, 3]));
    expect(ratCounts.get('dungeon-veteran')).toEqual(new Set([0, 1, 2, 3, 4]));
  }, 60_000);
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
