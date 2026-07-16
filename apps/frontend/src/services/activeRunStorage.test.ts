import { beforeEach, describe, expect, it } from 'vitest';
import { createAdaptiveRunState } from '../utils/adaptiveProfile';
import {
  clearActiveRun,
  loadActiveRun,
  parseActiveRunRecord,
  saveActiveRun,
  ACTIVE_RUN_VERSION,
  type ActiveRunRecord,
} from './activeRunStorage';

function record(overrides: Partial<ActiveRunRecord> = {}): ActiveRunRecord {
  return {
    version: ACTIVE_RUN_VERSION,
    runId: 'active-run-1',
    characterId: 'warden',
    status: 'active',
    elapsedMs: 12_345,
    currentHealth: 4,
    maximumHealth: 6,
    playerPosition: { x: 4, y: 5 },
    facing: 'right',
    dungeonRoomsCleared: 0,
    enemiesDefeated: 0,
    experiencePreset: 'seasoned-adventurer',
    evaluationProgress: {
      roomOrder: [
        'evaluation-room-01',
        'evaluation-room-02',
        'evaluation-room-03',
        'evaluation-room-04',
        'evaluation-room-05',
      ],
      currentRoomIndex: 1,
      currentRoomId: 'evaluation-room-02',
      enteredFrom: 'west',
      roomEnteredAtMs: 5_000,
      exitChoices: [
        {
          roomId: 'evaluation-room-01',
          roomIndex: 1,
          exitId: 'evaluation-room-01-east-exit',
          direction: 'east',
          enteredAtMs: 0,
          exitedAtMs: 5_000,
          timeSpentMs: 5_000,
        },
      ],
      evaluationComplete: false,
    },
    dungeonProgress: {
      runSeed: 'seed',
      dungeonRoomNumber: 0,
      currentRoom: null,
      enteredFrom: null,
      chosenExitIds: [],
      pokeCooldown: 0,
      previousMode: null,
    },
    adaptation: createAdaptiveRunState(),
    ...overrides,
  };
}

describe('Resonant Ruins active-run storage v2', () => {
  beforeEach(() => localStorage.clear());
  it('round-trips preset, run seed, profile signals, Chamber analytics, and exact position', () => {
    const active = record();
    expect(saveActiveRun(active)).toBeNull();
    expect(loadActiveRun()).toEqual({ record: active, issue: null });
  });
  it('rejects incompatible and internally invalid records without throwing', () => {
    expect(parseActiveRunRecord({ ...record(), version: 99 })).toBeNull();
    expect(parseActiveRunRecord({ ...record(), playerPosition: { x: 0, y: 0 } })).toBeNull();
    expect(parseActiveRunRecord({ ...record(), experiencePreset: 'invented' })).toBeNull();
  });
  it('reports corrupt JSON and can clear an active run', () => {
    localStorage.setItem('mirrorvault:active-run:v1', '{');
    expect(loadActiveRun()).toEqual({ record: null, issue: 'invalid' });
    expect(clearActiveRun()).toBeNull();
    expect(loadActiveRun()).toEqual({ record: null, issue: null });
  });
});
