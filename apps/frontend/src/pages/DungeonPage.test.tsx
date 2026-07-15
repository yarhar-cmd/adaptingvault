import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdventureProvider } from '../context/AdventureProvider';
import { DungeonPage } from './DungeonPage';

function renderPage() {
  return render(
    <MemoryRouter>
      <AdventureProvider>
        <DungeonPage />
      </AdventureProvider>
    </MemoryRouter>,
  );
}

function press(code: string) {
  fireEvent.keyDown(window, { code });
  fireEvent.keyUp(window, { code });
}

describe('Resonant Ruins dungeon health integration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    localStorage.clear();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('Local API unavailable in test'))),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('starts the Warden at six health, applies rune damage, and preserves it across rooms', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Begin assessment →' }));
    await act(() => vi.advanceTimersByTimeAsync(220));

    expect(screen.getByLabelText('6 of 6 health remaining.')).toBeVisible();

    press('KeyW');
    for (let step = 0; step < 5; step += 1) press('KeyD');

    expect(screen.getByLabelText(/5 of 6 health remaining.*Invulnerable/)).toBeVisible();
    expect(screen.getByText('Rune damaged you. 5 of 6 health remaining.')).toHaveAttribute(
      'aria-live',
      'polite',
    );

    fireEvent.click(screen.getByRole('button', { name: /Cross toward the rune/ }));
    await act(() => vi.advanceTimersByTimeAsync(220));

    expect(screen.getByLabelText(/5 of 6 health remaining/)).toBeVisible();
  });
});
