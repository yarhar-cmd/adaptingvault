import type { RoomDefinition } from '../../types/rooms';
import { evaluationRooms } from './evaluationRooms';
import { placeholderDungeonRoom } from './placeholderDungeonRoom';

export const allRooms: readonly RoomDefinition[] = [...evaluationRooms, placeholderDungeonRoom];

const roomsById = new Map(allRooms.map((room) => [room.id, room]));

export function getRoomDefinition(roomId: string): RoomDefinition | null {
  return roomsById.get(roomId) ?? null;
}
