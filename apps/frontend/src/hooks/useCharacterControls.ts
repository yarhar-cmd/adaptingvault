import { useCallback, useEffect, useRef } from 'react';
import type { CardinalDirection, MoveTrigger } from '../types/player';

const MOVEMENT_INTERVAL_MS = 200;

type ShiftKeyCode = 'ShiftLeft' | 'ShiftRight';

const movementKeys: Record<string, CardinalDirection> = {
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
};

const shiftKeyCodes = new Set<ShiftKeyCode>(['ShiftLeft', 'ShiftRight']);
const gameplayKeys = new Set<string>([...Object.keys(movementKeys), ...shiftKeyCodes, 'Space']);

const interactiveSelector = [
  'a[href]',
  'button',
  'input',
  'select',
  'textarea',
  'summary',
  '[contenteditable]:not([contenteditable="false"])',
  '[role="button"]',
  '[role="checkbox"]',
  '[role="combobox"]',
  '[role="link"]',
  '[role="radio"]',
  '[role="slider"]',
  '[role="spinbutton"]',
  '[role="switch"]',
  '[role="textbox"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

interface HeldDirection {
  direction: CardinalDirection;
  order: number;
}

interface CharacterControlsOptions {
  enabled: boolean;
  onMove: (direction: CardinalDirection, trigger: MoveTrigger) => void;
  onTurn: (direction: CardinalDirection, trigger: MoveTrigger) => void;
  onAttack: () => boolean | void;
  onShieldChange: (isShielding: boolean) => void;
}

export interface CharacterControls {
  move: (direction: CardinalDirection) => void;
  attack: () => boolean;
  setPointerShielding: (isShielding: boolean) => void;
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (target.closest('[data-game-input-surface]')) return false;
  let current: Element | null = target;
  while (current) {
    if (
      current instanceof HTMLElement &&
      (current.isContentEditable ||
        current.contentEditable === 'true' ||
        current.contentEditable === 'plaintext-only')
    ) {
      return true;
    }
    current = current.parentElement;
  }
  return target.closest(interactiveSelector) !== null;
}

function isShiftKeyCode(code: string): code is ShiftKeyCode {
  return code === 'ShiftLeft' || code === 'ShiftRight';
}

export function useCharacterControls({
  enabled,
  onMove,
  onTurn,
  onAttack,
  onShieldChange,
}: CharacterControlsOptions): CharacterControls {
  const enabledRef = useRef(enabled);
  const onMoveRef = useRef(onMove);
  const onTurnRef = useRef(onTurn);
  const onAttackRef = useRef(onAttack);
  const onShieldChangeRef = useRef(onShieldChange);
  const heldDirectionsRef = useRef(new Map<string, HeldDirection>());
  const heldShiftKeysRef = useRef<Set<ShiftKeyCode>>(new Set());
  const pointerShieldingRef = useRef(false);
  const isShieldingRef = useRef(false);
  const pressOrderRef = useRef(0);
  const movementTimerRef = useRef<number | null>(null);

  enabledRef.current = enabled;
  onMoveRef.current = onMove;
  onTurnRef.current = onTurn;
  onAttackRef.current = onAttack;
  onShieldChangeRef.current = onShieldChange;

  const processDirection = useCallback((direction: CardinalDirection, trigger: MoveTrigger) => {
    if (isShieldingRef.current) onTurnRef.current(direction, trigger);
    else onMoveRef.current(direction, trigger);
  }, []);

  const synchronizeShieldState = useCallback((resumeHeldMovement = true) => {
    const isShielding = heldShiftKeysRef.current.size > 0 || pointerShieldingRef.current;
    if (isShieldingRef.current === isShielding) return;

    const wasShielding = isShieldingRef.current;
    isShieldingRef.current = isShielding;
    onShieldChangeRef.current(isShielding);

    if (wasShielding && !isShielding && resumeHeldMovement) {
      let latest: HeldDirection | undefined;
      for (const held of heldDirectionsRef.current.values()) {
        if (!latest || held.order > latest.order) latest = held;
      }
      if (latest) onMoveRef.current(latest.direction, 'resume');
    }
  }, []);

  const reconcileKeyboardShiftState = useCallback(
    (event: KeyboardEvent) => {
      const shiftIsPressed = event.getModifierState('Shift');

      if (event.type === 'keyup' && isShiftKeyCode(event.code)) {
        if (shiftIsPressed) heldShiftKeysRef.current.delete(event.code);
        else heldShiftKeysRef.current.clear();
        synchronizeShieldState();
        return;
      }

      if (!shiftIsPressed && heldShiftKeysRef.current.size > 0) {
        heldShiftKeysRef.current.clear();
        const directionalKeyDown =
          event.type === 'keydown' && movementKeys[event.code] !== undefined;
        synchronizeShieldState(!directionalKeyDown);
      }
    },
    [synchronizeShieldState],
  );

  const stopMovementTimer = useCallback(() => {
    if (movementTimerRef.current === null) return;
    window.clearInterval(movementTimerRef.current);
    movementTimerRef.current = null;
  }, []);

  const repeatLatestDirection = useCallback(() => {
    let latest: HeldDirection | undefined;
    for (const held of heldDirectionsRef.current.values()) {
      if (!latest || held.order > latest.order) latest = held;
    }
    if (latest) processDirection(latest.direction, 'repeat');
  }, [processDirection]);

  const startMovementTimer = useCallback(() => {
    if (movementTimerRef.current !== null) return;
    movementTimerRef.current = window.setInterval(repeatLatestDirection, MOVEMENT_INTERVAL_MS);
  }, [repeatLatestDirection]);

  const clearHeldControls = useCallback(() => {
    heldDirectionsRef.current.clear();
    stopMovementTimer();
    heldShiftKeysRef.current.clear();
    synchronizeShieldState();
  }, [stopMovementTimer, synchronizeShieldState]);

  const move = useCallback(
    (direction: CardinalDirection) => {
      if (!enabledRef.current) return;
      processDirection(direction, 'button');
    },
    [processDirection],
  );

  const attack = useCallback(() => {
    if (!enabledRef.current || isShieldingRef.current) return false;
    return onAttackRef.current() !== false;
  }, []);

  const setPointerShielding = useCallback(
    (isShielding: boolean) => {
      if (!enabledRef.current && isShielding) return;
      pointerShieldingRef.current = isShielding;
      synchronizeShieldState();
    },
    [synchronizeShieldState],
  );

  useEffect(() => {
    if (!enabled) {
      heldDirectionsRef.current.clear();
      stopMovementTimer();
      heldShiftKeysRef.current.clear();
      pointerShieldingRef.current = false;
      pressOrderRef.current = 0;
      synchronizeShieldState();
    }
  }, [enabled, stopMovementTimer, synchronizeShieldState]);

  useEffect(() => {
    const heldDirections = heldDirectionsRef.current;
    const heldShiftKeys = heldShiftKeysRef.current;

    function handleKeyDown(event: KeyboardEvent) {
      reconcileKeyboardShiftState(event);

      if (!enabledRef.current || !gameplayKeys.has(event.code) || isInteractiveTarget(event.target))
        return;
      event.preventDefault();

      const direction = movementKeys[event.code];
      if (direction) {
        if (event.repeat || heldDirectionsRef.current.has(event.code)) return;
        heldDirectionsRef.current.set(event.code, { direction, order: ++pressOrderRef.current });
        processDirection(direction, 'press');
        stopMovementTimer();
        startMovementTimer();
        return;
      }

      if (isShiftKeyCode(event.code)) {
        heldShiftKeysRef.current.add(event.code);
        synchronizeShieldState();
        return;
      }

      if (event.code === 'Space' && !event.repeat) attack();
    }

    function handleKeyUp(event: KeyboardEvent) {
      reconcileKeyboardShiftState(event);

      const direction = movementKeys[event.code];
      if (direction) {
        const wasHeld = heldDirectionsRef.current.delete(event.code);
        if (wasHeld && heldDirectionsRef.current.size === 0) stopMovementTimer();
      }

      if (
        enabledRef.current &&
        gameplayKeys.has(event.code) &&
        !isInteractiveTarget(event.target)
      ) {
        event.preventDefault();
      }
    }

    function handleVisibilityChange() {
      if (document.hidden) clearHeldControls();
    }

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);
    window.addEventListener('blur', clearHeldControls);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
      window.removeEventListener('blur', clearHeldControls);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      heldDirections.clear();
      heldShiftKeys.clear();
      pointerShieldingRef.current = false;
      isShieldingRef.current = false;
      stopMovementTimer();
    };
  }, [
    attack,
    clearHeldControls,
    reconcileKeyboardShiftState,
    processDirection,
    startMovementTimer,
    stopMovementTimer,
    synchronizeShieldState,
  ]);

  return { move, attack, setPointerShielding };
}
