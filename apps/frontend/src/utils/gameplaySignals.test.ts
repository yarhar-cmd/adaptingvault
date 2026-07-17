import { describe, expect, it } from 'vitest';
import { createRectangularRoom } from './roomGeometry';
import { createGameplayState, gameplayReducer, type GameplayAction } from './gameplayState';

const order = [
  'evaluation-room-01',
  'evaluation-room-02',
  'evaluation-room-03',
  'evaluation-room-04',
  'evaluation-room-05',
];
const room = createRectangularRoom({
  id: 'signal-room',
  phase: 'evaluation',
  width: 9,
  height: 9,
  exitEnabled: true,
  hazards: [{ x: 2, y: 4 }],
});

function active() {
  return gameplayReducer(createGameplayState(6), {
    type: 'start-run',
    maximumHealth: 6,
    startedAt: 1_000,
    runId: 'signal-run',
    runSeed: 'seed',
    experiencePreset: 'new-delver',
    roomOrder: order,
    currentRoomId: order[0],
    spawn: { row: 4, column: 1 },
  });
}

describe('Resonant Ruins raw behavior signals', () => {
  it('tracks meaningful movement, coverage, blocking, attacks, shielding, rune contacts, and damage separately', () => {
    let state = active();
    state = gameplayReducer(state, {
      type: 'move',
      direction: 'left',
      trigger: 'press',
      id: 'blocked',
      timestamp: 1_100,
      room,
    });
    state = gameplayReducer(state, {
      type: 'move',
      direction: 'right',
      trigger: 'press',
      id: 'rune',
      timestamp: 1_200,
      room,
    });
    state = gameplayReducer(state, {
      type: 'move',
      direction: 'right',
      trigger: 'repeat',
      id: 'repeat',
      timestamp: 1_300,
      room,
    });
    state = gameplayReducer(state, { type: 'attack', id: 'attack', timestamp: 1_400, room });
    state = gameplayReducer(state, { type: 'shield', isShielding: true, timestamp: 1_500 });
    state = gameplayReducer(state, { type: 'shield', isShielding: false, timestamp: 1_900 });
    expect(state.adaptation.signals).toMatchObject({
      movementSteps: 1,
      blockedMovementAttempts: 1,
      damageTaken: 1,
      runeContacts: 1,
      swordSwings: 1,
      shieldActivations: 1,
      shieldTimeMs: 400,
    });
    expect(state.adaptation.signals.floorTilesVisited).toHaveLength(2);
  });

  it('records room duration and the chosen exit direction at transition', () => {
    const state = active();
    const action: GameplayAction = {
      type: 'commit-room-transition',
      destinationRoomId: 'evaluation-room-02',
      destinationRoomIndex: 1,
      destinationSpawn: { row: 5, column: 1 },
      enteredFrom: 'west',
      exitDirection: 'east',
      exitedAtMs: 5_000,
      exitChoice: {
        roomId: 'evaluation-room-01',
        roomIndex: 1,
        exitId: 'east',
        direction: 'east',
        enteredAtMs: 0,
        exitedAtMs: 5_000,
        timeSpentMs: 5_000,
      },
      evaluationComplete: false,
    };
    const transitioned = gameplayReducer(state, action);
    expect(transitioned.adaptation.signals.roomTimesMs).toEqual([]);
    expect(transitioned.adaptation.signals.floorTilesVisited).toEqual([]);
    expect(transitioned.adaptation.completedSummary).toMatchObject({
      roomCount: 1,
      totalRoomTimeMs: 5_000,
      floorTilesVisitedCount: 0,
      exitsChosenByDirection: { east: 1 },
    });
    expect(transitioned.runStats.dungeonRoomsCleared).toBe(0);
  });
});
