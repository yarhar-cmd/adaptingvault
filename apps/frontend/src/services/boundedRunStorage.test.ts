import { beforeEach, describe, expect, it } from 'vitest';
import { getRoomDefinition } from '../data/rooms';
import { NEUTRAL_ADAPTIVE_PROFILE } from './playerProfileStorage';
import { createBehaviorSignals } from '../utils/adaptiveProfile';
import { gameplayReducer, restoreGameplayState } from '../utils/gameplayState';
import { generateDungeonRoom } from '../utils/generatedRoomGenerator';
import { createRoomEnemyState } from '../utils/enemySystem';
import { coordinateToGridPosition, findSafeSpawn } from '../utils/roomGeometry';
import { createFreshRun } from '../utils/runLifecycle';
import {
  createActiveRunRecord,
  loadActiveRun,
  saveActiveRun,
  toRestorableGameplayRun,
} from './activeRunStorage';
import { serializedByteSize } from './storageDiagnostics';

describe('Resonant Ruins bounded active-run storage', () => {
  beforeEach(() => localStorage.clear());

  it('remains compact, restorable, and playable after 1,000 generated-room transitions', () => {
    let state = createFreshRun({
      maximumHealth: 6,
      experiencePreset: 'seasoned-adventurer',
      startedAt: 0,
      runId: 'thousand-room-run',
      runSeed: 'thousand-room-seed',
    });

    for (let roomNumber = 1; roomNumber <= 1_000; roomNumber += 1) {
      const generatedRoom = generateDungeonRoom({
        runSeed: 'thousand-room-seed',
        dungeonRoomNumber: roomNumber,
        chosenExitId: `exit-${roomNumber}`,
        entranceDirection: 'west',
        experiencePreset: 'seasoned-adventurer',
        effectiveProfile: NEUTRAL_ADAPTIVE_PROFILE,
        mode: roomNumber % 2 === 0 ? 'poke' : 'reinforce',
      });
      state = {
        ...state,
        adaptation: {
          ...state.adaptation,
          signals: {
            ...createBehaviorSignals(),
            movementSteps: 24,
            blockedMovementAttempts: roomNumber % 3,
            idleTimeMs: 500,
            damageTaken: roomNumber % 2,
            runeContacts: roomNumber % 4,
            shieldActivations: 2,
            shieldTimeMs: 700,
            swordSwings: 3,
            directionChanges: 8,
            floorTilesVisited: Array.from({ length: 30 }, (_, index) => `${index},${roomNumber}`),
          },
        },
      };
      state = gameplayReducer(state, {
        type: 'commit-room-transition',
        destinationRoomId: generatedRoom.roomSnapshot.id,
        destinationRoomIndex: 5,
        destinationSpawn: coordinateToGridPosition(
          findSafeSpawn(generatedRoom.roomSnapshot, 'west'),
        ),
        enteredFrom: 'west',
        exitedAtMs: roomNumber * 10_000,
        exitChoice: null,
        evaluationComplete: true,
        generatedRoom,
        incrementDungeonRooms: roomNumber > 1,
        chosenExitId: `exit-${roomNumber}`,
        nextPokeCooldown: 0,
        nextMode: roomNumber % 2 === 0 ? 'poke' : 'reinforce',
        exitDirection: 'east',
        enemies: createRoomEnemyState(
          generatedRoom.roomSnapshot,
          'seasoned-adventurer',
          roomNumber * 10_000,
          generatedRoom.details.enemyCountPlan ?? null,
        ),
      });
    }

    expect(state.adaptation.generatedRoomSignals).toHaveLength(5);
    expect(state.adaptation.signals.floorTilesVisited).toHaveLength(0);
    expect(state.adaptation.completedSummary.roomCount).toBe(1_000);
    expect(state.dungeonProgress?.chosenExitIds).toHaveLength(5);
    expect(
      Object.values(state.adaptation.currentRunProfile).every(
        (value) => Number.isFinite(value) && value >= 0 && value <= 1,
      ),
    ).toBe(true);

    const activeRecord = createActiveRunRecord(state, 'warden', 10_000_000);
    expect(activeRecord).not.toBeNull();
    expect(activeRecord?.enemies?.roomId).toBe(state.enemies.roomId);
    expect(activeRecord?.enemies?.rats).toHaveLength(state.enemies.rats.length);
    expect(activeRecord?.enemies?.rats.length).toBeLessThanOrEqual(3);
    expect(serializedByteSize(activeRecord)).toBeLessThan(50 * 1024);
    expect(saveActiveRun(activeRecord!)).toBeNull();
    const loaded = loadActiveRun();
    expect(loaded.issue).toBeNull();
    expect(loaded.record).not.toBeNull();

    const restored = restoreGameplayState(toRestorableGameplayRun(loaded.record!), 6, 10_000_100);
    const room =
      getRoomDefinition(restored.evaluationProgress!.currentRoomId) ??
      restored.dungeonProgress!.currentRoom!.roomSnapshot;
    const continued = gameplayReducer(restored, {
      type: 'move',
      direction: 'right',
      trigger: 'press',
      id: 'continue-after-restore',
      timestamp: 10_000_200,
      room,
    });
    expect(continued.status).toBe('active');
  }, 60_000);
});
