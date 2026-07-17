import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRectangularRoom } from '../utils/roomGeometry';
import { useEnemyClock } from './useEnemyClock';

const room = createRectangularRoom({
  id: 'enemy-clock-room',
  phase: 'dungeon',
  width: 9,
  height: 9,
  exitEnabled: true,
});

describe('Resonant Ruins centralized enemy clock', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('ticks from one shared interval only while enabled and cleans up on unmount', () => {
    const onTick = vi.fn();
    const { rerender, unmount } = renderHook(
      ({ enabled }) => useEnemyClock({ enabled, room, onTick }),
      { initialProps: { enabled: false } },
    );
    act(() => vi.advanceTimersByTime(100));
    expect(onTick).not.toHaveBeenCalled();

    rerender({ enabled: true });
    act(() => vi.advanceTimersByTime(100));
    expect(onTick).toHaveBeenCalledTimes(4);
    expect(onTick).toHaveBeenLastCalledWith(expect.any(Number), room);

    unmount();
    act(() => vi.advanceTimersByTime(100));
    expect(onTick).toHaveBeenCalledTimes(4);
  });
});
