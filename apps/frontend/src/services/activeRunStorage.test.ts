import { beforeEach, describe, expect, it } from 'vitest';
import { NEUTRAL_ADAPTIVE_PROFILE } from './playerProfileStorage';
import { getRoomDefinition } from '../data/rooms';
import { createAdaptiveRunState, createBehaviorSignals } from '../utils/adaptiveProfile';
import { generateDungeonRoom } from '../utils/generatedRoomGenerator';
import {
  clearActiveRun,
  loadActiveRun,
  parseActiveRunRecord,
  saveActiveRun,
  toRestorableGameplayRun,
  ACTIVE_RUN_VERSION,
  type ActiveRunRecord,
} from './activeRunStorage';
import { gameplayReducer, getTimeSurvived, restoreGameplayState } from '../utils/gameplayState';
import { createCombatMetrics, type StoredRatEnemy } from '../types/enemies';

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
    pauseState: { isPaused: false, totalPausedMs: 0 },
    timers: {
      invulnerabilityRemainingMs: 0,
      pendingRune: null,
      attackCooldownRemainingMs: 0,
    },
    enemies: {
      roomId: 'evaluation-room-02',
      rats: [],
      aiFrozen: false,
      countPlan: null,
      lastBlockRemainingMs: 0,
      lastBlockKind: null,
      awarenessGraceRemainingMs: 0,
      combatMetrics: createCombatMetrics(),
    },
    ...overrides,
  };
}

function legacyAdaptation() {
  const current = createAdaptiveRunState();
  const baseline = { ...createBehaviorSignals(), roomTimesMs: [4_000], movementSteps: 10 };
  return {
    ...current,
    signals: { ...baseline, movementSteps: 13 },
    currentRoomSignalBaseline: baseline,
  };
}

function storedRat(overrides: Partial<StoredRatEnemy> = {}): StoredRatEnemy {
  return {
    id: 'evaluation-room-02-rat-1',
    type: 'rat',
    position: { x: 6, y: 5 },
    facing: 'left',
    awareness: 'alerted',
    health: 1,
    state: 'telegraphing',
    lockedTarget: { x: 5, y: 5 },
    movementRemainingMs: 0,
    telegraphRemainingMs: 200,
    lungeRemainingMs: 0,
    recoveryRemainingMs: 0,
    recoveryKind: null,
    attackOutcome: null,
    corpseRemainingMs: 0,
    hitFlashRemainingMs: 40,
    defeatCounted: false,
    spawnSource: 'authored',
    spawnReason: 'Persistence fixture',
    authoredSpawnNumber: 1,
    nextPathStep: null,
    pathDistanceToPlayer: 1,
    pathBlocked: false,
    ...overrides,
  };
}

describe('Resonant Ruins active-run storage v6', () => {
  beforeEach(() => localStorage.clear());
  it('round-trips preset, run seed, profile signals, Chamber analytics, and exact position', () => {
    const active = record();
    expect(saveActiveRun(active)).toBeNull();
    expect(loadActiveRun()).toEqual({ record: active, issue: null });
  });
  it('rejects incompatible and internally invalid records without throwing', () => {
    expect(parseActiveRunRecord({ ...record(), version: 99 })).toBeNull();
    expect(parseActiveRunRecord({ ...record(), experiencePreset: 'invented' })).toBeNull();
    expect(parseActiveRunRecord({ ...record(), pauseState: { isPaused: true } })).toBeNull();
    expect(
      parseActiveRunRecord({
        ...record(),
        timers: {
          invulnerabilityRemainingMs: -1,
          pendingRune: null,
          attackCooldownRemainingMs: 0,
        },
      }),
    ).toBeNull();
  });
  it('repairs an invalid current position to a safe spawn without discarding the run', () => {
    const repaired = parseActiveRunRecord({ ...record(), playerPosition: { x: 0, y: 0 } });
    expect(repaired).toMatchObject({ version: 6, positionRepaired: true });
    expect(repaired?.playerPosition).not.toEqual({ x: 0, y: 0 });
  });
  it('round-trips a paused run and its remaining gameplay timers', () => {
    const paused = record({
      pauseState: {
        isPaused: true,
        reason: 'pause-menu',
        pausedAt: 50_000,
        totalPausedMs: 2_000,
      },
      timers: {
        invulnerabilityRemainingMs: 350,
        pendingRune: { x: 4, y: 5 },
        attackCooldownRemainingMs: 275,
      },
    });
    saveActiveRun(paused);
    expect(loadActiveRun()).toEqual({ record: paused, issue: null });
    const restored = restoreGameplayState(toRestorableGameplayRun(paused), 6, 100_000);
    expect(restored.pause).toEqual({
      isPaused: true,
      reason: 'pause-menu',
      pausedAt: 100_000,
      totalPausedMs: 2_000,
    });
    expect(restored.invulnerability).toEqual({
      expiresAt: 100_350,
      pendingRune: { row: 5, column: 4 },
    });
    expect(restored.attackCooldown.readyAt).toBe(100_275);
    expect(getTimeSurvived(restored.runStats, 150_000, restored.pause)).toBe(paused.elapsedMs);
  });
  it('round-trips only the current room Rat state with exact remaining timers', () => {
    const active = record({
      enemies: {
        roomId: 'evaluation-room-02',
        aiFrozen: true,
        countPlan: null,
        lastBlockRemainingMs: 80,
        lastBlockKind: 'regular',
        awarenessGraceRemainingMs: 120,
        combatMetrics: createCombatMetrics(),
        rats: [storedRat()],
      },
    });
    expect(saveActiveRun(active)).toBeNull();
    expect(loadActiveRun()).toEqual({ record: active, issue: null });
    const restored = restoreGameplayState(toRestorableGameplayRun(active), 6, 100_000);
    expect(restored.enemies).toMatchObject({
      roomId: 'evaluation-room-02',
      aiFrozen: true,
      lastBlockAt: 100_080,
      lastBlockKind: 'regular',
      awarenessGraceEndsAt: 100_120,
      rats: [
        {
          id: 'evaluation-room-02-rat-1',
          health: 1,
          state: 'telegraphing',
          telegraphEndsAt: 100_200,
          hitFlashUntil: 100_040,
        },
      ],
    });
  });
  it('restores lunge and recovery exactly without applying post-impact damage twice', () => {
    const duringLunge = record({
      currentHealth: 3,
      playerPosition: { x: 5, y: 5 },
      enemies: {
        ...record().enemies!,
        rats: [
          storedRat({
            state: 'lunging',
            telegraphRemainingMs: 0,
            lungeRemainingMs: 75,
            recoveryKind: 'standard',
            attackOutcome: 'hit',
            hitFlashRemainingMs: 0,
          }),
        ],
      },
    });
    const restored = restoreGameplayState(toRestorableGameplayRun(duringLunge), 6, 100_000);
    expect(restored.enemies.rats[0]).toMatchObject({
      state: 'lunging',
      lockedTarget: { x: 5, y: 5 },
      lungeEndsAt: 100_075,
      attackOutcome: 'hit',
    });
    const fixture = getRoomDefinition('evaluation-room-02')!;
    const afterLunge = gameplayReducer(restored, {
      type: 'enemy-tick',
      timestamp: 100_075,
      room: fixture,
    });
    expect(afterLunge.currentHealth).toBe(3);
    expect(afterLunge.enemies.rats[0]).toMatchObject({
      state: 'recovering',
      recoveryEndsAt: 100_375,
    });

    const recoveryRecord = record({
      enemies: {
        ...record().enemies!,
        rats: [
          storedRat({
            state: 'recovering',
            lockedTarget: { x: 5, y: 5 },
            telegraphRemainingMs: 0,
            recoveryRemainingMs: 180,
            recoveryKind: 'perfect-block',
            attackOutcome: 'perfect-block',
            hitFlashRemainingMs: 0,
          }),
        ],
      },
    });
    const restoredRecovery = restoreGameplayState(
      toRestorableGameplayRun(recoveryRecord),
      6,
      200_000,
    );
    expect(restoredRecovery.enemies.rats[0]).toMatchObject({
      state: 'recovering',
      recoveryEndsAt: 200_180,
      recoveryKind: 'perfect-block',
    });
  });
  it('migrates v5 Rat cooldown state into v6 recovery without losing remaining time', () => {
    const base = record();
    const migrated = parseActiveRunRecord({
      ...base,
      version: 5,
      enemies: {
        roomId: 'evaluation-room-02',
        aiFrozen: false,
        countPlan: null,
        lastBlockRemainingMs: 0,
        rats: [
          {
            id: 'legacy-rat',
            type: 'rat',
            position: { x: 6, y: 5 },
            health: 1,
            state: 'cooldown',
            lockedTarget: null,
            movementRemainingMs: 0,
            telegraphRemainingMs: 0,
            cooldownRemainingMs: 240,
            corpseRemainingMs: 0,
            hitFlashRemainingMs: 0,
            defeatCounted: false,
            spawnSource: 'authored',
            spawnReason: 'Legacy v5 Rat',
            nextPathStep: null,
          },
        ],
      },
    });
    expect(migrated).toMatchObject({
      version: 6,
      enemies: {
        awarenessGraceRemainingMs: 0,
        rats: [
          {
            id: 'legacy-rat',
            state: 'recovering',
            awareness: 'alerted',
            recoveryRemainingMs: 240,
            recoveryKind: 'standard',
          },
        ],
      },
    });
  });
  it('migrates a v2 active run as unpaused with cleared temporary timers', () => {
    const legacy = { ...record(), version: 2 as const, adaptation: legacyAdaptation() };
    delete legacy.pauseState;
    delete legacy.timers;
    expect(parseActiveRunRecord(legacy)).toMatchObject({
      version: 6,
      pauseState: { isPaused: false, totalPausedMs: 0 },
      timers: {
        invulnerabilityRemainingMs: 0,
        pendingRune: null,
        attackCooldownRemainingMs: 0,
      },
    });
  });
  it('compacts v3 cumulative signals and detailed snapshots during migration', () => {
    const migrated = parseActiveRunRecord({
      ...record(),
      version: 3,
      adaptation: {
        ...legacyAdaptation(),
        generatedRoomSignals: Array.from({ length: 9 }, (_, index) => ({
          roomNumber: index + 1,
          signals: createBehaviorSignals(),
        })),
      },
    });
    expect(migrated).toMatchObject({
      version: 6,
      adaptation: {
        completedSummary: { roomCount: 1, totalRoomTimeMs: 4_000, movementSteps: 10 },
        signals: { movementSteps: 3, roomTimesMs: [] },
      },
    });
    expect(migrated?.adaptation?.generatedRoomSignals).toHaveLength(5);
  });
  it('rejects malformed generated-room snapshots instead of restoring unsafe state', () => {
    const generated = record().dungeonProgress?.currentRoom;
    expect(generated).toBeNull();
    expect(
      parseActiveRunRecord({
        ...record(),
        dungeonProgress: {
          ...record().dungeonProgress,
          dungeonRoomNumber: 1,
          currentRoom: { roomSnapshot: { id: 'broken-room' } },
        },
      }),
    ).toBeNull();
  });
  it('migrates the legacy numeric generator version to centralized version metadata', () => {
    const generated = generateDungeonRoom({
      runSeed: 'legacy-generator-run',
      dungeonRoomNumber: 1,
      chosenExitId: 'legacy-generator-exit',
      entranceDirection: 'west',
      experiencePreset: 'seasoned-adventurer',
      effectiveProfile: NEUTRAL_ADAPTIVE_PROFILE,
      mode: 'reinforce',
    });
    const spawn = generated.roomSnapshot.spawnPoints?.west;
    expect(spawn).toBeDefined();
    if (!spawn) throw new Error('Generated fixture has no west spawn.');
    const base = record();
    const migrated = parseActiveRunRecord({
      ...base,
      playerPosition: spawn,
      evaluationProgress: {
        ...base.evaluationProgress,
        currentRoomIndex: 5,
        currentRoomId: generated.roomSnapshot.id,
        evaluationComplete: true,
      },
      dungeonProgress: {
        ...base.dungeonProgress,
        dungeonRoomNumber: 1,
        enteredFrom: 'west',
        currentRoom: {
          ...generated,
          generatorVersion: 1,
          details: { ...generated.details, generatorVersion: 1 },
        },
      },
      enemies: { ...base.enemies, roomId: generated.roomSnapshot.id },
    });
    expect(migrated?.dungeonProgress?.currentRoom).toMatchObject({
      generatorVersion: 'generator-1',
      details: { generatorVersion: 'generator-1' },
    });
  });
  it('reports corrupt JSON and can clear an active run', () => {
    localStorage.setItem('mirrorvault:active-run:v1', '{');
    expect(loadActiveRun()).toEqual({ record: null, issue: 'invalid' });
    expect(clearActiveRun()).toBeNull();
    expect(loadActiveRun()).toEqual({ record: null, issue: null });
  });
});
