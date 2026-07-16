import { describe, expect, it } from 'vitest';
import {
  EVALUATION_ROOM_1_ID,
  EVALUATION_ROOM_2_ID,
  EVALUATION_ROOM_3_ID,
  EVALUATION_ROOM_4_ID,
  EVALUATION_ROOM_5_ID,
} from '../data/rooms/evaluationRooms';
import { PLACEHOLDER_DUNGEON_ROOM_ID } from '../data/rooms/placeholderDungeonRoom';
import {
  createEvaluationRoomOrder,
  formatRoomIndicator,
  getNextRoom,
  isValidEvaluationRoomOrder,
} from './roomProgression';

describe('Resonant Ruins evaluation progression', () => {
  it('keeps rooms one and five fixed while deterministically shuffling the middle three', () => {
    const values = [0, 0];
    const order = createEvaluationRoomOrder(() => values.shift() ?? 0);

    expect(order).toEqual([
      EVALUATION_ROOM_1_ID,
      EVALUATION_ROOM_3_ID,
      EVALUATION_ROOM_4_ID,
      EVALUATION_ROOM_2_ID,
      EVALUATION_ROOM_5_ID,
    ]);
    expect(isValidEvaluationRoomOrder(order)).toBe(true);
  });

  it('produces predictable different orders from injected random sources', () => {
    const unchanged = createEvaluationRoomOrder(() => 0.999999);
    const reversed = createEvaluationRoomOrder(() => 0);
    expect(unchanged).toEqual([
      EVALUATION_ROOM_1_ID,
      EVALUATION_ROOM_2_ID,
      EVALUATION_ROOM_3_ID,
      EVALUATION_ROOM_4_ID,
      EVALUATION_ROOM_5_ID,
    ]);
    expect(reversed).not.toEqual(unchanged);
  });

  it('selects the next evaluation room and then the dungeon placeholder', () => {
    const order = createEvaluationRoomOrder(() => 0.999999);
    expect(getNextRoom(order, 0)).toEqual({
      roomId: EVALUATION_ROOM_2_ID,
      roomIndex: 1,
      evaluationComplete: false,
    });
    expect(getNextRoom(order, 4)).toEqual({
      roomId: PLACEHOLDER_DUNGEON_ROOM_ID,
      roomIndex: 5,
      evaluationComplete: true,
    });
  });

  it('formats evaluation and dungeon indicators without player-facing room names', () => {
    expect(formatRoomIndicator(EVALUATION_ROOM_4_ID, 3)).toBe('Awakening Chamber 4 / 5');
    expect(formatRoomIndicator(PLACEHOLDER_DUNGEON_ROOM_ID, 5)).toBe('Dungeon Room 1');
  });

  it('rejects malformed, duplicate, and incomplete room orders', () => {
    expect(isValidEvaluationRoomOrder([])).toBe(false);
    expect(
      isValidEvaluationRoomOrder([
        EVALUATION_ROOM_1_ID,
        EVALUATION_ROOM_2_ID,
        EVALUATION_ROOM_2_ID,
        EVALUATION_ROOM_4_ID,
        EVALUATION_ROOM_5_ID,
      ]),
    ).toBe(false);
  });
});
