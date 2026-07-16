import { createRectangularRoom } from '../../utils/roomGeometry';

export const PLACEHOLDER_DUNGEON_ROOM_ID = 'dungeon-room-01-placeholder';

export const placeholderDungeonRoom = createRectangularRoom({
  id: PLACEHOLDER_DUNGEON_ROOM_ID,
  phase: 'dungeon',
  width: 17,
  height: 13,
  exitEnabled: false,
});
