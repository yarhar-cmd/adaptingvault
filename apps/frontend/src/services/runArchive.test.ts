import { beforeEach, describe, expect, it } from 'vitest';
import {
  archiveCompletedRun,
  createCompletedRunRecord,
  createEmptyRunArchive,
  loadRunArchive,
  parseRunArchive,
  RUN_ARCHIVE_KEY,
  RUN_HISTORY_LIMIT,
  type CharacterId,
} from './runArchive';
import type { ExperiencePreset } from '../types/adaptation';

function record(
  id: string,
  characterId: CharacterId = 'warden',
  preset: ExperiencePreset = 'seasoned-adventurer',
  rooms = Number(id),
) {
  return createCompletedRunRecord({
    id,
    characterId,
    experiencePreset: preset,
    endedAt: new Date(`2026-01-01T00:00:${id.padStart(2, '0')}.000Z`).toISOString(),
    timeSurvivedMs: Number(id) * 1_000,
    dungeonRoomsCleared: rooms,
    enemiesDefeated: Number(id),
  });
}

describe('Resonant Ruins completed-run archive v2', () => {
  beforeEach(() => localStorage.clear());

  it('stores preset and dungeon-only count, deduplicates, and keeps newest-first history', () => {
    const completed = record('1', 'warden', 'new-delver', 3);
    expect(archiveCompletedRun(completed)).toMatchObject({ saved: true, duplicate: false });
    expect(archiveCompletedRun(completed)).toMatchObject({ saved: true, duplicate: true });
    expect(loadRunArchive().data.histories.warden[0]).toMatchObject({
      experiencePreset: 'new-delver',
      dungeonRoomsCleared: 3,
    });
  });

  it('caps history per character without affecting another character', () => {
    archiveCompletedRun(record('1', 'seeker'));
    for (let index = 1; index <= RUN_HISTORY_LIMIT + 1; index += 1)
      archiveCompletedRun(record(String(index)));
    expect(loadRunArchive().data.histories.warden.map(({ id }) => id)).toEqual([
      '6',
      '5',
      '4',
      '3',
      '2',
    ]);
    expect(loadRunArchive().data.histories.seeker).toHaveLength(1);
  });

  it('partitions bests by character and preset and gives ties to the newer run', () => {
    archiveCompletedRun(
      createCompletedRunRecord({
        ...record('1'),
        id: 'one',
        endedAt: '2026-01-01T00:00:01.000Z',
        timeSurvivedMs: 10_000,
        dungeonRoomsCleared: 3,
        enemiesDefeated: 8,
      }),
    );
    archiveCompletedRun(
      createCompletedRunRecord({
        ...record('2'),
        id: 'two',
        endedAt: '2026-01-01T00:00:02.000Z',
        timeSurvivedMs: 10_000,
        dungeonRoomsCleared: 4,
        enemiesDefeated: 8,
      }),
    );
    archiveCompletedRun(record('3', 'warden', 'dungeon-veteran', 2));
    expect(loadRunArchive().data.bestStats.warden['seasoned-adventurer']).toMatchObject({
      bestTimeRunId: 'two',
      bestDungeonRoomsCleared: 4,
      bestRoomsRunId: 'two',
      bestEnemiesRunId: 'two',
    });
    expect(loadRunArchive().data.bestStats.warden['dungeon-veteran'].bestRoomsRunId).toBe('3');
  });

  it('migrates legacy records to explicit unknown without guessing a preset', () => {
    const legacy = {
      version: 1,
      histories: {
        warden: [
          {
            version: 1,
            id: 'legacy',
            characterId: 'warden',
            endedAt: '2026-01-01T00:00:00.000Z',
            timeSurvivedMs: 1000,
            roomsCleared: 4,
            enemiesDefeated: 2,
          },
        ],
        seeker: [],
        ember: [],
      },
      bestStats: {},
    };
    localStorage.setItem(RUN_ARCHIVE_KEY, JSON.stringify(legacy));
    const loaded = loadRunArchive();
    expect(loaded.issue).toBeNull();
    expect(loaded.data.histories.warden[0]).toMatchObject({
      experiencePreset: 'unknown',
      dungeonRoomsCleared: 4,
    });
  });

  it('rejects corrupt/future data and recovers when a new run is archived', () => {
    localStorage.setItem(
      RUN_ARCHIVE_KEY,
      JSON.stringify({ ...createEmptyRunArchive(), version: 99 }),
    );
    expect(archiveCompletedRun(record('1'))).toMatchObject({ saved: true, issue: 'invalid' });
    expect(loadRunArchive().issue).toBeNull();
    expect(parseRunArchive({ version: 2 })).toBeNull();
  });

  it('clamps completed numeric values', () => {
    expect(
      createCompletedRunRecord({
        id: 'x',
        characterId: 'warden',
        experiencePreset: 'new-delver',
        endedAt: '2026-01-01T00:00:00.000Z',
        timeSurvivedMs: -1,
        dungeonRoomsCleared: 2.8,
        enemiesDefeated: Number.NaN,
      }),
    ).toMatchObject({ timeSurvivedMs: 0, dungeonRoomsCleared: 2, enemiesDefeated: 0 });
  });
});
