import {
  EVALUATION_ROOM_1_ID,
  EVALUATION_ROOM_5_ID,
  MIDDLE_EVALUATION_ROOM_IDS,
} from '../data/rooms/evaluationRooms';
import { PLACEHOLDER_DUNGEON_ROOM_ID } from '../data/rooms/placeholderDungeonRoom';

export type RandomSource = () => number;

export function createEvaluationRoomOrder(random: RandomSource = Math.random): string[] {
  const middleRooms = [...MIDDLE_EVALUATION_ROOM_IDS];
  for (let index = middleRooms.length - 1; index > 0; index -= 1) {
    const candidate = Math.floor(Math.min(Math.max(random(), 0), 0.999999999) * (index + 1));
    [middleRooms[index], middleRooms[candidate]] = [middleRooms[candidate]!, middleRooms[index]!];
  }
  return [EVALUATION_ROOM_1_ID, ...middleRooms, EVALUATION_ROOM_5_ID];
}

export function isValidEvaluationRoomOrder(value: unknown): value is string[] {
  if (!Array.isArray(value) || value.length !== 5) return false;
  if (value[0] !== EVALUATION_ROOM_1_ID || value[4] !== EVALUATION_ROOM_5_ID) return false;
  const middle = value.slice(1, 4);
  return (
    new Set(middle).size === MIDDLE_EVALUATION_ROOM_IDS.length &&
    MIDDLE_EVALUATION_ROOM_IDS.every((roomId) => middle.includes(roomId))
  );
}

export function getNextRoom(
  roomOrder: readonly string[],
  currentRoomIndex: number,
): {
  roomId: string;
  roomIndex: number;
  evaluationComplete: boolean;
} | null {
  if (currentRoomIndex < 0 || currentRoomIndex >= roomOrder.length) return null;
  if (currentRoomIndex === roomOrder.length - 1) {
    return {
      roomId: PLACEHOLDER_DUNGEON_ROOM_ID,
      roomIndex: roomOrder.length,
      evaluationComplete: true,
    };
  }
  return {
    roomId: roomOrder[currentRoomIndex + 1]!,
    roomIndex: currentRoomIndex + 1,
    evaluationComplete: false,
  };
}

export function formatRoomIndicator(roomId: string, currentRoomIndex: number): string {
  return roomId === PLACEHOLDER_DUNGEON_ROOM_ID
    ? 'Dungeon Room 1'
    : `Awakening Chamber ${currentRoomIndex + 1} / 5`;
}
