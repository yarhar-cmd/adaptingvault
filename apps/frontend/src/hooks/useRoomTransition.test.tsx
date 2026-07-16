import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRoomTransition } from './useRoomTransition';

describe('Resonant Ruins room transition', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('commits once, swaps at full black, and unlocks after both 150 ms phases', () => {
    const commit = vi.fn();
    const { result } = renderHook(() =>
      useRoomTransition({ currentRoomId: 'room-a', runId: 'run-1', reducedMotion: false }),
    );

    act(() => {
      expect(result.current.beginTransition({ destinationRoomId: 'room-b', commit })).toBe(true);
    });
    expect(commit).toHaveBeenCalledOnce();
    expect(result.current.phase).toBe('fading-out');
    expect(result.current.renderedRoomId).toBe('room-a');

    act(() => {
      expect(result.current.beginTransition({ destinationRoomId: 'room-b', commit })).toBe(false);
      vi.advanceTimersByTime(150);
    });
    expect(commit).toHaveBeenCalledOnce();
    expect(result.current.phase).toBe('fading-in');
    expect(result.current.renderedRoomId).toBe('room-b');

    act(() => vi.advanceTimersByTime(150));
    expect(result.current.phase).toBe('idle');
    expect(result.current.isTransitioning).toBe(false);
  });

  it('makes reduced-motion transitions immediate', () => {
    const commit = vi.fn();
    const { result } = renderHook(() =>
      useRoomTransition({ currentRoomId: 'room-a', runId: 'run-1', reducedMotion: true }),
    );

    act(() => {
      result.current.beginTransition({ destinationRoomId: 'room-b', commit });
    });
    expect(commit).toHaveBeenCalledOnce();
    expect(result.current).toMatchObject({
      phase: 'idle',
      renderedRoomId: 'room-b',
      isTransitioning: false,
    });
  });
});
