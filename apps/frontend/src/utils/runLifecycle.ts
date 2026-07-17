import { getEvaluationRoom } from '../data/rooms/evaluationRooms';
import type { AdaptiveProfile, ExperiencePreset } from '../types/adaptation';
import { gameplayReducer, createGameplayState, type GameplayState } from './gameplayState';
import { coordinateToGridPosition, findSafeSpawn } from './roomGeometry';
import { createEvaluationRoomOrder } from './roomProgression';

export function createFreshRun({
  maximumHealth,
  experiencePreset,
  longTermProfile,
  shortcutUnlocked,
  startedAt = Date.now(),
  runId = crypto.randomUUID(),
  runSeed = crypto.randomUUID(),
}: {
  maximumHealth: number;
  experiencePreset: ExperiencePreset;
  longTermProfile?: AdaptiveProfile;
  shortcutUnlocked?: boolean;
  startedAt?: number;
  runId?: string;
  runSeed?: string;
}): GameplayState {
  const roomOrder = createEvaluationRoomOrder();
  const firstRoom = getEvaluationRoom(roomOrder[0]!, shortcutUnlocked)!;
  return gameplayReducer(createGameplayState(maximumHealth), {
    type: 'start-run',
    maximumHealth,
    startedAt,
    runId,
    runSeed,
    experiencePreset,
    longTermProfile,
    roomOrder,
    currentRoomId: firstRoom.id,
    spawn: coordinateToGridPosition(findSafeSpawn(firstRoom, 'west')),
  });
}
