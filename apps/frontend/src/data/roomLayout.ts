import type { GridPosition, RoomBounds } from '../types/player';
import { positionsMatch } from '../utils/playerActions';

export interface RoomLayout {
  bounds: RoomBounds;
  hazards: readonly GridPosition[];
}

export const CURRENT_ROOM_LAYOUT: RoomLayout = {
  bounds: { rows: 5, columns: 8 },
  hazards: [
    { row: 1, column: 5 },
    { row: 4, column: 2 },
  ],
};

export function isHazardPosition(
  position: GridPosition,
  hazards: readonly GridPosition[] = CURRENT_ROOM_LAYOUT.hazards,
): boolean {
  return hazards.some((hazard) => positionsMatch(position, hazard));
}
