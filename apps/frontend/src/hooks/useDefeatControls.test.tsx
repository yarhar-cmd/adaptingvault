import { fireEvent, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDefeatControls } from './useDefeatControls';

describe('Resonant Ruins defeat keyboard controls', () => {
  let region: HTMLDivElement;
  let insideButton: HTMLButtonElement;
  let insideInput: HTMLInputElement;
  let outsideButton: HTMLButtonElement;

  beforeEach(() => {
    region = document.createElement('div');
    insideButton = document.createElement('button');
    insideInput = document.createElement('input');
    outsideButton = document.createElement('button');
    region.append(insideButton, insideInput);
    document.body.append(region, outsideButton);
  });

  afterEach(() => {
    region.remove();
    outsideButton.remove();
  });

  function setup(defeated = true) {
    const onRestart = vi.fn();
    const onToggleResults = vi.fn();
    const gameRegionRef = { current: region };
    const result = renderHook(
      ({ isDefeated }) =>
        useDefeatControls({
          defeated: isDefeated,
          gameRegionRef,
          onRestart,
          onToggleResults,
        }),
      { initialProps: { isDefeated: defeated } },
    );
    return { ...result, onRestart, onToggleResults };
  }

  it('restarts once from a fresh R press while defeated and focused in the game region', () => {
    const { onRestart } = setup();
    insideButton.focus();

    fireEvent.keyDown(window, { code: 'KeyR' });
    fireEvent.keyDown(window, { code: 'KeyR', repeat: true });
    fireEvent.keyDown(window, { code: 'KeyR' });
    expect(onRestart).toHaveBeenCalledOnce();

    fireEvent.keyUp(window, { code: 'KeyR' });
    fireEvent.keyDown(window, { code: 'KeyR' });
    expect(onRestart).toHaveBeenCalledTimes(2);
  });

  it('ignores R while active, outside the game region, or on repeat', () => {
    const active = setup(false);
    insideButton.focus();
    fireEvent.keyDown(window, { code: 'KeyR' });
    fireEvent.keyUp(window, { code: 'KeyR' });
    expect(active.onRestart).not.toHaveBeenCalled();
    active.unmount();

    const defeated = setup();
    outsideButton.focus();
    fireEvent.keyDown(window, { code: 'KeyR' });
    fireEvent.keyUp(window, { code: 'KeyR' });
    insideButton.focus();
    fireEvent.keyDown(window, { code: 'KeyR', repeat: true });
    expect(defeated.onRestart).not.toHaveBeenCalled();
  });

  it('requires a release after an R press that began before death', () => {
    const { onRestart, rerender } = setup(false);
    insideButton.focus();
    fireEvent.keyDown(window, { code: 'KeyR' });
    rerender({ isDefeated: true });
    fireEvent.keyDown(window, { code: 'KeyR', repeat: true });
    expect(onRestart).not.toHaveBeenCalled();

    fireEvent.keyUp(window, { code: 'KeyR' });
    fireEvent.keyDown(window, { code: 'KeyR' });
    expect(onRestart).toHaveBeenCalledOnce();
  });

  it('does not claim R from an editable control inside the game region', () => {
    const { onRestart } = setup();
    insideInput.focus();
    fireEvent.keyDown(insideInput, { code: 'KeyR' });
    fireEvent.keyUp(insideInput, { code: 'KeyR' });

    expect(onRestart).not.toHaveBeenCalled();
  });

  it('toggles results with Escape only while defeated and focused in the game region', () => {
    const { onToggleResults } = setup();
    insideButton.focus();
    fireEvent.keyDown(window, { code: 'Escape' });
    expect(onToggleResults).toHaveBeenCalledOnce();

    outsideButton.focus();
    fireEvent.keyDown(window, { code: 'Escape' });
    fireEvent.keyDown(window, { code: 'Escape', repeat: true });
    expect(onToggleResults).toHaveBeenCalledOnce();
  });
});
