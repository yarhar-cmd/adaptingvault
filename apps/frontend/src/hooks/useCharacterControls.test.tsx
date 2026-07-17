import { useState } from 'react';
import { act, fireEvent, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCharacterControls } from './useCharacterControls';

type KeyboardEventType = 'keydown' | 'keyup';

interface KeyboardDispatchOptions {
  code: string;
  modifierShift: boolean;
  target?: Window | Document | Element;
  key?: string;
  repeat?: boolean;
}

function dispatchKeyboardEvent(
  type: KeyboardEventType,
  {
    code,
    modifierShift,
    target = window,
    key = code.startsWith('Shift') ? 'Shift' : '',
    repeat = false,
  }: KeyboardDispatchOptions,
) {
  const event = new KeyboardEvent(type, {
    bubbles: true,
    cancelable: true,
    code,
    key,
    repeat,
    shiftKey: modifierShift,
  });
  Object.defineProperty(event, 'getModifierState', {
    value: (modifier: string) => modifier === 'Shift' && modifierShift,
  });
  fireEvent(target, event);
  return event;
}

function renderControls() {
  const onMove = vi.fn();
  const onTurn = vi.fn();
  const onAttack = vi.fn();
  const onShieldChange = vi.fn();
  const hook = renderHook(() =>
    useCharacterControls({ enabled: true, onMove, onTurn, onAttack, onShieldChange }),
  );
  return { ...hook, onMove, onTurn, onAttack, onShieldChange };
}

function useShieldStateHarness() {
  const [isShielding, setIsShielding] = useState(false);
  const controls = useCharacterControls({
    enabled: true,
    onMove: vi.fn(),
    onTurn: vi.fn(),
    onAttack: vi.fn(),
    onShieldChange: setIsShielding,
  });
  return { controls, isShielding };
}

describe('Resonant Ruins character controls', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(document, 'hidden');
  });

  it.each([
    ['KeyW', 'up'],
    ['ArrowUp', 'up'],
    ['KeyS', 'down'],
    ['ArrowDown', 'down'],
    ['KeyA', 'left'],
    ['ArrowLeft', 'left'],
    ['KeyD', 'right'],
    ['ArrowRight', 'right'],
  ])('maps %s to %s and prevents its browser default', (code, direction) => {
    const { onMove } = renderControls();
    const event = dispatchKeyboardEvent('keydown', { code, modifierShift: false });

    expect(event.defaultPrevented).toBe(true);
    expect(onMove).toHaveBeenCalledWith(direction, 'press');
  });

  it('moves immediately, repeats every 200ms, and gives the latest held direction priority', () => {
    const { onMove } = renderControls();

    dispatchKeyboardEvent('keydown', { code: 'KeyD', modifierShift: false });
    expect(onMove).toHaveBeenLastCalledWith('right', 'press');

    act(() => vi.advanceTimersByTime(200));
    expect(onMove).toHaveBeenLastCalledWith('right', 'repeat');

    act(() => vi.advanceTimersByTime(190));
    dispatchKeyboardEvent('keydown', { code: 'KeyW', modifierShift: false });
    expect(onMove).toHaveBeenLastCalledWith('up', 'press');
    const immediateMoveCount = onMove.mock.calls.length;
    act(() => vi.advanceTimersByTime(10));
    expect(onMove).toHaveBeenCalledTimes(immediateMoveCount);
    act(() => vi.advanceTimersByTime(190));
    expect(onMove).toHaveBeenLastCalledWith('up', 'repeat');

    dispatchKeyboardEvent('keyup', { code: 'KeyW', modifierShift: false });
    act(() => vi.advanceTimersByTime(200));
    expect(onMove).toHaveBeenLastCalledWith('right', 'repeat');

    dispatchKeyboardEvent('keyup', { code: 'KeyD', modifierShift: false });
    const callCount = onMove.mock.calls.length;
    act(() => vi.advanceTimersByTime(400));
    expect(onMove).toHaveBeenCalledTimes(callCount);
  });

  it('ignores native repeat events and never combines held directions diagonally', () => {
    const { onMove } = renderControls();

    dispatchKeyboardEvent('keydown', { code: 'KeyD', modifierShift: false });
    dispatchKeyboardEvent('keydown', { code: 'KeyD', modifierShift: false, repeat: true });
    dispatchKeyboardEvent('keydown', { code: 'KeyW', modifierShift: false });

    expect(onMove.mock.calls).toEqual([
      ['right', 'press'],
      ['up', 'press'],
    ]);
  });

  it('tracks both Shift keys independently and turns without moving while shielding', () => {
    const { onMove, onTurn, onShieldChange } = renderControls();

    dispatchKeyboardEvent('keydown', { code: 'ShiftLeft', modifierShift: true });
    dispatchKeyboardEvent('keydown', { code: 'ShiftRight', modifierShift: true });
    dispatchKeyboardEvent('keydown', { code: 'KeyD', modifierShift: true });
    expect(onShieldChange).toHaveBeenCalledTimes(1);
    expect(onShieldChange).toHaveBeenLastCalledWith(true);
    expect(onTurn).toHaveBeenCalledWith('right', 'press');
    expect(onMove).not.toHaveBeenCalled();

    dispatchKeyboardEvent('keyup', { code: 'ShiftLeft', modifierShift: true });
    expect(onShieldChange).toHaveBeenCalledTimes(1);
    dispatchKeyboardEvent('keyup', { code: 'ShiftRight', modifierShift: false });
    expect(onShieldChange).toHaveBeenLastCalledWith(false);
  });

  it('continues routing held directional repeats to turning while shielding', () => {
    const { onMove, onTurn } = renderControls();

    dispatchKeyboardEvent('keydown', { code: 'ShiftLeft', modifierShift: true });
    dispatchKeyboardEvent('keydown', { code: 'KeyW', modifierShift: true });
    expect(onTurn).toHaveBeenLastCalledWith('up', 'press');

    act(() => vi.advanceTimersByTime(600));

    expect(onMove).not.toHaveBeenCalled();
    expect(onTurn.mock.calls).toEqual([
      ['up', 'press'],
      ['up', 'repeat'],
      ['up', 'repeat'],
      ['up', 'repeat'],
    ]);
  });

  it('uses the most recently held direction for shielded turning and falls back on release', () => {
    const { onMove, onTurn } = renderControls();

    dispatchKeyboardEvent('keydown', { code: 'ShiftLeft', modifierShift: true });
    dispatchKeyboardEvent('keydown', { code: 'KeyW', modifierShift: true });
    dispatchKeyboardEvent('keydown', { code: 'KeyD', modifierShift: true });
    expect(onTurn).toHaveBeenLastCalledWith('right', 'press');

    dispatchKeyboardEvent('keyup', { code: 'KeyD', modifierShift: true });
    act(() => vi.advanceTimersByTime(200));

    expect(onTurn).toHaveBeenLastCalledWith('up', 'repeat');
    expect(onMove).not.toHaveBeenCalled();
  });

  it('resumes the newest held direction immediately when keyboard shielding ends', () => {
    const { onMove, onTurn } = renderControls();

    dispatchKeyboardEvent('keydown', { code: 'ShiftLeft', modifierShift: true });
    dispatchKeyboardEvent('keydown', { code: 'KeyW', modifierShift: true });
    expect(onTurn).toHaveBeenCalledWith('up', 'press');
    expect(onMove).not.toHaveBeenCalled();

    dispatchKeyboardEvent('keyup', { code: 'ShiftLeft', modifierShift: false });

    expect(onMove).toHaveBeenCalledWith('up', 'resume');
  });

  it('keeps movement locked until both physical Shift keys are released', () => {
    const { onMove, onTurn } = renderControls();

    dispatchKeyboardEvent('keydown', { code: 'ShiftLeft', modifierShift: true });
    dispatchKeyboardEvent('keydown', { code: 'ShiftRight', modifierShift: true });
    dispatchKeyboardEvent('keydown', { code: 'KeyW', modifierShift: true });
    expect(onTurn).toHaveBeenCalledWith('up', 'press');

    dispatchKeyboardEvent('keyup', { code: 'ShiftLeft', modifierShift: true });
    expect(onMove).not.toHaveBeenCalled();

    dispatchKeyboardEvent('keyup', { code: 'ShiftRight', modifierShift: false });
    expect(onMove.mock.calls).toEqual([['up', 'resume']]);
  });

  it('keeps movement locked until overlapping pointer and keyboard shields both end', () => {
    const { onMove, onTurn, result } = renderControls();

    act(() => result.current.setPointerShielding(true));
    dispatchKeyboardEvent('keydown', { code: 'KeyW', modifierShift: false });
    dispatchKeyboardEvent('keydown', { code: 'ShiftLeft', modifierShift: true });
    expect(onTurn).toHaveBeenCalledWith('up', 'press');

    act(() => result.current.setPointerShielding(false));
    expect(onMove).not.toHaveBeenCalled();

    dispatchKeyboardEvent('keyup', { code: 'ShiftLeft', modifierShift: false });
    expect(onMove.mock.calls).toEqual([['up', 'resume']]);
  });

  it('routes on-screen directional actions to movement or turning based on shield state', () => {
    const { onMove, onTurn, result } = renderControls();

    act(() => result.current.move('up'));
    expect(onMove).toHaveBeenCalledWith('up', 'button');

    act(() => result.current.setPointerShielding(true));
    act(() => result.current.move('right'));
    expect(onTurn).toHaveBeenCalledWith('right', 'button');
    expect(onMove).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['ShiftLeft', 'ShiftRight'],
    ['ShiftRight', 'ShiftLeft'],
  ] as const)(
    'synchronizes React shield state after releasing %s and then %s',
    (firstReleased, secondReleased) => {
      const { result } = renderHook(useShieldStateHarness);

      dispatchKeyboardEvent('keydown', { code: 'ShiftLeft', modifierShift: true });
      dispatchKeyboardEvent('keydown', { code: 'ShiftRight', modifierShift: true });
      expect(result.current.isShielding).toBe(true);

      dispatchKeyboardEvent('keyup', { code: firstReleased, modifierShift: true });
      expect(result.current.isShielding).toBe(true);

      dispatchKeyboardEvent('keyup', { code: secondReleased, modifierShift: false });
      expect(result.current.isShielding).toBe(false);
    },
  );

  it('deduplicates repeated keydown events for the same physical Shift key', () => {
    const { onShieldChange } = renderControls();

    dispatchKeyboardEvent('keydown', { code: 'ShiftLeft', modifierShift: true });
    dispatchKeyboardEvent('keydown', { code: 'ShiftLeft', modifierShift: true });
    dispatchKeyboardEvent('keydown', {
      code: 'ShiftLeft',
      modifierShift: true,
      repeat: true,
    });
    expect(onShieldChange.mock.calls).toEqual([[true]]);

    dispatchKeyboardEvent('keyup', { code: 'ShiftLeft', modifierShift: false });
    expect(onShieldChange.mock.calls).toEqual([[true], [false]]);
  });

  it('recovers when one Shift keyup reports that the browser has released both Shift keys', () => {
    const { onShieldChange } = renderControls();

    dispatchKeyboardEvent('keydown', { code: 'ShiftLeft', modifierShift: true });
    dispatchKeyboardEvent('keydown', { code: 'ShiftRight', modifierShift: true });
    dispatchKeyboardEvent('keyup', { code: 'ShiftLeft', modifierShift: false });

    expect(onShieldChange.mock.calls).toEqual([[true], [false]]);
  });

  it('removes only the released Shift code while the browser reports Shift still held', () => {
    const { onShieldChange } = renderControls();

    dispatchKeyboardEvent('keydown', { code: 'ShiftLeft', modifierShift: true });
    dispatchKeyboardEvent('keydown', { code: 'ShiftRight', modifierShift: true });
    dispatchKeyboardEvent('keyup', { code: 'ShiftLeft', modifierShift: true });

    expect(onShieldChange.mock.calls).toEqual([[true]]);

    dispatchKeyboardEvent('keyup', { code: 'ShiftRight', modifierShift: false });
    expect(onShieldChange.mock.calls).toEqual([[true], [false]]);
  });

  it('clears stale keyboard Shift state without cancelling pointer shielding', () => {
    const { onAttack, onShieldChange, result } = renderControls();

    act(() => result.current.setPointerShielding(true));
    dispatchKeyboardEvent('keydown', { code: 'ShiftLeft', modifierShift: true });
    dispatchKeyboardEvent('keyup', { code: 'ShiftLeft', modifierShift: false });

    expect(onShieldChange.mock.calls).toEqual([[true]]);
    dispatchKeyboardEvent('keydown', { code: 'Space', modifierShift: false });
    expect(onAttack).not.toHaveBeenCalled();

    act(() => result.current.setPointerShielding(false));
    expect(onShieldChange.mock.calls).toEqual([[true], [false]]);
  });

  it('uses a non-Shift keyboard event to clear stale Shift entries', () => {
    const { onMove, onShieldChange } = renderControls();

    dispatchKeyboardEvent('keydown', { code: 'ShiftLeft', modifierShift: true });
    dispatchKeyboardEvent('keydown', { code: 'KeyD', modifierShift: false });

    expect(onShieldChange.mock.calls).toEqual([[true], [false]]);
    expect(onMove).toHaveBeenCalledWith('right', 'press');
  });

  it('processes Shift keyup on an interactive target in the capture phase', () => {
    const { onShieldChange } = renderControls();
    const input = document.createElement('input');
    input.addEventListener('keyup', (event) => event.stopPropagation());
    document.body.append(input);

    dispatchKeyboardEvent('keydown', { code: 'ShiftLeft', modifierShift: true });
    dispatchKeyboardEvent('keyup', {
      code: 'ShiftLeft',
      modifierShift: false,
      target: input,
    });

    expect(onShieldChange.mock.calls).toEqual([[true], [false]]);
  });

  it('keeps keyboard and pointer shielding independent', () => {
    const { onShieldChange, result } = renderControls();

    act(() => result.current.setPointerShielding(true));
    dispatchKeyboardEvent('keydown', { code: 'ShiftLeft', modifierShift: true });
    dispatchKeyboardEvent('keydown', { code: 'ShiftRight', modifierShift: true });
    dispatchKeyboardEvent('keyup', { code: 'ShiftLeft', modifierShift: true });
    dispatchKeyboardEvent('keyup', { code: 'ShiftRight', modifierShift: false });
    expect(onShieldChange.mock.calls).toEqual([[true]]);

    act(() => result.current.setPointerShielding(false));
    expect(onShieldChange.mock.calls).toEqual([[true], [false]]);
  });

  it('rejects attacks while shielding and delegates cooldown acceptance to gameplay state', () => {
    const { onAttack, result } = renderControls();

    dispatchKeyboardEvent('keydown', { code: 'ShiftLeft', modifierShift: true });
    dispatchKeyboardEvent('keydown', { code: 'Space', modifierShift: true });
    expect(onAttack).not.toHaveBeenCalled();

    dispatchKeyboardEvent('keyup', { code: 'ShiftLeft', modifierShift: false });
    onAttack.mockReturnValueOnce(false).mockReturnValueOnce(true);
    dispatchKeyboardEvent('keydown', { code: 'Space', modifierShift: false });
    expect(onAttack).toHaveBeenCalledTimes(1);
    expect(result.current.attack()).toBe(true);
    expect(onAttack).toHaveBeenCalledTimes(2);

    onAttack.mockReturnValueOnce(false);
    expect(result.current.attack()).toBe(false);
  });

  it('ignores gameplay keydown from interactive and editable elements', () => {
    const { onMove, onAttack, onShieldChange } = renderControls();
    const input = document.createElement('input');
    const button = document.createElement('button');
    const editable = document.createElement('div');
    editable.contentEditable = 'true';
    document.body.append(input, button, editable);

    dispatchKeyboardEvent('keydown', { code: 'KeyW', modifierShift: false, target: input });
    dispatchKeyboardEvent('keydown', { code: 'Space', modifierShift: false, target: button });
    dispatchKeyboardEvent('keydown', {
      code: 'ShiftLeft',
      modifierShift: true,
      target: editable,
    });

    expect(onMove).not.toHaveBeenCalled();
    expect(onAttack).not.toHaveBeenCalled();
    expect(onShieldChange).not.toHaveBeenCalled();
  });

  it('clears both keyboard Shift keys on blur', () => {
    const { onMove, onShieldChange } = renderControls();
    dispatchKeyboardEvent('keydown', { code: 'KeyD', modifierShift: false });
    dispatchKeyboardEvent('keydown', { code: 'ShiftLeft', modifierShift: true });
    dispatchKeyboardEvent('keydown', { code: 'ShiftRight', modifierShift: true });

    fireEvent.blur(window);
    const moveCount = onMove.mock.calls.length;
    act(() => vi.advanceTimersByTime(400));

    expect(onMove).toHaveBeenCalledTimes(moveCount);
    expect(onShieldChange.mock.calls).toEqual([[true], [false]]);
  });

  it('does not cancel pointer shielding when blur clears keyboard Shift state', () => {
    const { onShieldChange, result } = renderControls();
    act(() => result.current.setPointerShielding(true));
    dispatchKeyboardEvent('keydown', { code: 'ShiftLeft', modifierShift: true });
    dispatchKeyboardEvent('keydown', { code: 'ShiftRight', modifierShift: true });

    fireEvent.blur(window);
    expect(onShieldChange.mock.calls).toEqual([[true]]);

    act(() => result.current.setPointerShielding(false));
    expect(onShieldChange.mock.calls).toEqual([[true], [false]]);
  });

  it('clears both physical Shift keys when the document becomes hidden', () => {
    const { onShieldChange } = renderControls();
    dispatchKeyboardEvent('keydown', { code: 'ShiftLeft', modifierShift: true });
    dispatchKeyboardEvent('keydown', { code: 'ShiftRight', modifierShift: true });

    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    fireEvent(document, new Event('visibilitychange'));

    expect(onShieldChange.mock.calls).toEqual([[true], [false]]);
    dispatchKeyboardEvent('keyup', { code: 'ShiftLeft', modifierShift: false });
    expect(onShieldChange.mock.calls).toEqual([[true], [false]]);
  });

  it('clears keyboard and pointer shielding when the hook is disabled', () => {
    const onShieldChange = vi.fn();
    const onMove = vi.fn();
    const onTurn = vi.fn();
    const onAttack = vi.fn();
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useCharacterControls({
          enabled,
          onMove,
          onTurn,
          onAttack,
          onShieldChange,
        }),
      { initialProps: { enabled: true } },
    );
    act(() => result.current.setPointerShielding(true));
    dispatchKeyboardEvent('keydown', { code: 'ShiftLeft', modifierShift: true });
    dispatchKeyboardEvent('keydown', { code: 'KeyD', modifierShift: true });

    rerender({ enabled: false });
    const moveCount = onMove.mock.calls.length;
    const turnCount = onTurn.mock.calls.length;
    dispatchKeyboardEvent('keyup', { code: 'ShiftLeft', modifierShift: false });
    dispatchKeyboardEvent('keydown', { code: 'KeyW', modifierShift: false });
    act(() => vi.advanceTimersByTime(400));

    expect(onShieldChange.mock.calls).toEqual([[true], [false]]);
    expect(onMove).toHaveBeenCalledTimes(moveCount);
    expect(onTurn).toHaveBeenCalledTimes(turnCount);
    expect(onAttack).not.toHaveBeenCalled();
  });

  it('removes capture listeners and timers on unmount', () => {
    const { onMove, onShieldChange, unmount } = renderControls();
    dispatchKeyboardEvent('keydown', { code: 'KeyD', modifierShift: false });
    dispatchKeyboardEvent('keydown', { code: 'ShiftLeft', modifierShift: true });
    const moveCount = onMove.mock.calls.length;
    const shieldChangeCount = onShieldChange.mock.calls.length;

    unmount();
    dispatchKeyboardEvent('keydown', { code: 'KeyW', modifierShift: false });
    dispatchKeyboardEvent('keyup', { code: 'ShiftLeft', modifierShift: false });
    act(() => vi.advanceTimersByTime(400));

    expect(onMove).toHaveBeenCalledTimes(moveCount);
    expect(onShieldChange).toHaveBeenCalledTimes(shieldChangeCount);
  });
});
