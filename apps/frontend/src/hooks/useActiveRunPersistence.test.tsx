import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as activeRunStorage from '../services/activeRunStorage';
import { createFreshRun } from '../utils/runLifecycle';
import { useActiveRunPersistence } from './useActiveRunPersistence';

describe('Resonant Ruins active-run write failures', () => {
  afterEach(() => vi.useRealTimers());

  it('warns without mutating gameplay and rate-limits repeated quota failures', () => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
    vi.spyOn(activeRunStorage, 'saveActiveRun').mockReturnValue('write-failed');
    const onIssue = vi.fn();
    const gameplay = createFreshRun({
      maximumHealth: 6,
      experiencePreset: 'seasoned-adventurer',
      startedAt: 0,
      runId: 'write-failure-run',
      runSeed: 'write-failure-seed',
    });
    const before = JSON.stringify(gameplay);
    const { result } = renderHook(() =>
      useActiveRunPersistence({ gameplay, characterId: 'warden', onIssue }),
    );

    act(() => {
      expect(result.current()).toBe('write-failed');
      expect(result.current()).toBe('write-failed');
    });
    expect(onIssue).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(gameplay)).toBe(before);

    act(() => {
      vi.advanceTimersByTime(3_000);
      expect(result.current()).toBe('write-failed');
    });
    expect(onIssue).toHaveBeenCalledTimes(2);
  });
});
