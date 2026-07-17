import { useEffect, useRef } from 'react';
import type { RoomDefinition } from '../types/rooms';

const ENEMY_CLOCK_RESOLUTION_MS = 25;

export function useEnemyClock({
  enabled,
  room,
  onTick,
}: {
  enabled: boolean;
  room: RoomDefinition;
  onTick: (timestamp: number, room: RoomDefinition) => void;
}) {
  const onTickRef = useRef(onTick);
  const roomRef = useRef(room);
  onTickRef.current = onTick;
  roomRef.current = room;

  useEffect(() => {
    if (!enabled) return;
    const timer = window.setInterval(
      () => onTickRef.current(Date.now(), roomRef.current),
      ENEMY_CLOCK_RESOLUTION_MS,
    );
    return () => window.clearInterval(timer);
  }, [enabled]);
}
