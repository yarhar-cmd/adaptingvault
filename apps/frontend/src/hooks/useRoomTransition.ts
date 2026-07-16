import { useCallback, useEffect, useRef, useState } from 'react';

export type RoomTransitionPhase = 'idle' | 'fading-out' | 'fading-in';

interface BeginRoomTransitionOptions {
  destinationRoomId: string;
  commit: () => void;
}

export function useRoomTransition({
  currentRoomId,
  runId,
  reducedMotion,
}: {
  currentRoomId: string;
  runId: string | null;
  reducedMotion: boolean;
}) {
  const [phase, setPhase] = useState<RoomTransitionPhase>('idle');
  const [renderedRoomId, setRenderedRoomId] = useState(currentRoomId);
  const lockedRef = useRef(false);
  const timersRef = useRef<number[]>([]);
  const currentRoomIdRef = useRef(currentRoomId);
  currentRoomIdRef.current = currentRoomId;

  const clearTimers = useCallback(() => {
    for (const timer of timersRef.current) window.clearTimeout(timer);
    timersRef.current = [];
  }, []);

  useEffect(() => {
    clearTimers();
    lockedRef.current = false;
    setPhase('idle');
    setRenderedRoomId(currentRoomIdRef.current);
  }, [clearTimers, runId]);

  useEffect(() => {
    if (phase === 'idle') setRenderedRoomId(currentRoomId);
  }, [currentRoomId, phase]);

  useEffect(() => clearTimers, [clearTimers]);

  const beginTransition = useCallback(
    ({ destinationRoomId, commit }: BeginRoomTransitionOptions): boolean => {
      if (lockedRef.current) return false;
      lockedRef.current = true;
      clearTimers();
      commit();

      if (reducedMotion) {
        setRenderedRoomId(destinationRoomId);
        setPhase('idle');
        lockedRef.current = false;
        return true;
      }

      setPhase('fading-out');
      const swapTimer = window.setTimeout(() => {
        setRenderedRoomId(destinationRoomId);
        setPhase('fading-in');
        const unlockTimer = window.setTimeout(() => {
          setPhase('idle');
          lockedRef.current = false;
          timersRef.current = [];
        }, 150);
        timersRef.current.push(unlockTimer);
      }, 150);
      timersRef.current.push(swapTimer);
      return true;
    },
    [clearTimers, reducedMotion],
  );

  return {
    beginTransition,
    isTransitioning: phase !== 'idle',
    phase,
    renderedRoomId,
  };
}
