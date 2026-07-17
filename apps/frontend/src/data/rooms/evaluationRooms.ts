import type { RoomDefinition } from '../../types/rooms';
import { createRectangularRoom } from '../../utils/roomGeometry';

export const EVALUATION_ROOM_1_ID = 'evaluation-room-01';
export const EVALUATION_ROOM_2_ID = 'evaluation-room-02';
export const EVALUATION_ROOM_3_ID = 'evaluation-room-03';
export const EVALUATION_ROOM_4_ID = 'evaluation-room-04';
export const EVALUATION_ROOM_5_ID = 'evaluation-room-05';

export const EVALUATION_ROOM_IDS = [
  EVALUATION_ROOM_1_ID,
  EVALUATION_ROOM_2_ID,
  EVALUATION_ROOM_3_ID,
  EVALUATION_ROOM_4_ID,
  EVALUATION_ROOM_5_ID,
] as const;

export const MIDDLE_EVALUATION_ROOM_IDS = [
  EVALUATION_ROOM_2_ID,
  EVALUATION_ROOM_3_ID,
  EVALUATION_ROOM_4_ID,
] as const;

export const evaluationRooms: readonly RoomDefinition[] = [
  createRectangularRoom({
    id: EVALUATION_ROOM_1_ID,
    phase: 'evaluation',
    width: 15,
    height: 11,
    exitEnabled: true,
    exits: [
      {
        id: `${EVALUATION_ROOM_1_ID}-east-exit`,
        direction: 'east',
        tile: { x: 14, y: 4 },
        kind: 'standard',
        condition: { type: 'always' },
        enabled: true,
      },
      {
        id: `${EVALUATION_ROOM_1_ID}-shortcut-exit`,
        direction: 'east',
        tile: { x: 14, y: 6 },
        kind: 'shortcut',
        condition: { type: 'always' },
        enabled: false,
      },
    ],
  }),
  createRectangularRoom({
    id: EVALUATION_ROOM_2_ID,
    phase: 'evaluation',
    width: 17,
    height: 11,
    exitEnabled: true,
  }),
  createRectangularRoom({
    id: EVALUATION_ROOM_3_ID,
    phase: 'evaluation',
    width: 15,
    height: 13,
    exitEnabled: true,
    hazards: [{ x: 7, y: 6 }],
  }),
  createRectangularRoom({
    id: EVALUATION_ROOM_4_ID,
    phase: 'evaluation',
    width: 17,
    height: 11,
    exitEnabled: true,
    exits: [
      {
        id: `${EVALUATION_ROOM_4_ID}-east-exit`,
        direction: 'east',
        tile: { x: 16, y: 5 },
        kind: 'standard',
        condition: { type: 'enemies-defeated' },
        enabled: true,
      },
    ],
    enemySpawns: [
      {
        id: `${EVALUATION_ROOM_4_ID}-rat-1`,
        type: 'rat',
        tile: { x: 9, y: 5 },
        order: 1,
        source: 'authored',
        reason: 'Primary combat introduction',
      },
      {
        id: `${EVALUATION_ROOM_4_ID}-rat-2`,
        type: 'rat',
        tile: { x: 12, y: 3 },
        order: 2,
        source: 'authored',
        reason: 'Secondary cross-pressure',
      },
      {
        id: `${EVALUATION_ROOM_4_ID}-rat-3`,
        type: 'rat',
        tile: { x: 12, y: 7 },
        order: 3,
        source: 'authored',
        reason: 'Veteran flank pressure',
      },
    ],
  }),
  createRectangularRoom({
    id: EVALUATION_ROOM_5_ID,
    phase: 'evaluation',
    width: 21,
    height: 15,
    exitEnabled: true,
    hazards: [
      { x: 8, y: 5 },
      { x: 11, y: 9 },
    ],
    exits: [
      {
        id: `${EVALUATION_ROOM_5_ID}-east-exit`,
        direction: 'east',
        tile: { x: 20, y: 7 },
        kind: 'standard',
        condition: { type: 'enemies-defeated' },
        enabled: true,
      },
    ],
    enemySpawns: [
      {
        id: `${EVALUATION_ROOM_5_ID}-rat-1`,
        type: 'rat',
        tile: { x: 10, y: 3 },
        order: 1,
        source: 'authored',
        reason: 'Combined encounter lead',
      },
      {
        id: `${EVALUATION_ROOM_5_ID}-rat-2`,
        type: 'rat',
        tile: { x: 14, y: 7 },
        order: 2,
        source: 'authored',
        reason: 'Combined encounter center pressure',
      },
      {
        id: `${EVALUATION_ROOM_5_ID}-rat-3`,
        type: 'rat',
        tile: { x: 10, y: 11 },
        order: 3,
        source: 'authored',
        reason: 'Combined encounter veteran flank',
      },
    ],
  }),
];

export function getEvaluationRoom(roomId: string, shortcutUnlocked = false): RoomDefinition | null {
  const room = evaluationRooms.find((item) => item.id === roomId);
  if (!room) return null;
  if (room.id !== EVALUATION_ROOM_1_ID) return room;
  return {
    ...room,
    exits: room.exits.map((exit) =>
      exit.kind === 'shortcut' ? { ...exit, enabled: shortcutUnlocked } : exit,
    ),
  };
}
