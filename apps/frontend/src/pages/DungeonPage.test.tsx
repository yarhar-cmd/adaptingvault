import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdventureProvider } from '../context/AdventureProvider';
import { ACTIVE_RUN_KEY, clearActiveRun, type ActiveRunRecord } from '../services/activeRunStorage';
import { loadPlayerProfile, PLAYER_PROFILE_KEY } from '../services/playerProfileStorage';
import { DungeonPage } from './DungeonPage';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/dungeon']}>
      <AdventureProvider>
        <DungeonPage />
      </AdventureProvider>
    </MemoryRouter>,
  );
}
async function chooseAndDelve(label = 'Seasoned Adventurer') {
  fireEvent.click(screen.getByRole('radio', { name: label }));
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  expect(screen.getByText(`Experience:`)).toBeVisible();
  expect(screen.getByText(label)).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Delve' }));
  await act(() => vi.advanceTimersByTimeAsync(1));
}
async function advance() {
  fireEvent.click(screen.getByRole('button', { name: 'Advance to Next Room' }));
  await act(() => vi.advanceTimersByTimeAsync(310));
}
function activeRecord(): ActiveRunRecord {
  return JSON.parse(localStorage.getItem(ACTIVE_RUN_KEY)!) as ActiveRunRecord;
}

describe('Resonant Ruins first-time flow and generated progression', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  it('requires one of all three presets, persists it, then shows Run Setup and Delve', async () => {
    renderPage();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    expect(screen.getAllByRole('radio').map((radio) => radio.getAttribute('value'))).toEqual([
      'new-delver',
      'seasoned-adventurer',
      'dungeon-veteran',
    ]);
    await chooseAndDelve('Dungeon Veteran');
    expect(loadPlayerProfile().record).toMatchObject({
      experiencePreset: 'dungeon-veteran',
      firstTimeComplete: true,
    });
    expect(screen.getAllByText('Awakening Chamber 1 / 5')[0]).toBeVisible();
    expect(activeRecord()).toMatchObject({
      experiencePreset: 'dungeon-veteran',
      dungeonRoomsCleared: 0,
    });
  });

  it('returning players skip experience choice but still see Run Setup', () => {
    localStorage.setItem(
      PLAYER_PROFILE_KEY,
      JSON.stringify({
        version: 1,
        experiencePreset: 'new-delver',
        firstTimeComplete: true,
        shortcutUnlocked: false,
        longTermProfile: {
          pace: 0.5,
          caution: 0.5,
          aggression: 0.5,
          hazardTolerance: 0.5,
          exploration: 0.5,
        },
        metadata: { completedAdaptiveRooms: 0, updatedAt: null },
      }),
    );
    renderPage();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(screen.getByText('New Delver')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Delve' })).toBeVisible();
  });

  it('keeps Chamber labels, hides the dungeon counter, unlocks the shortcut, and enters deterministic Dungeon Room 1', async () => {
    renderPage();
    await chooseAndDelve();
    expect(document.querySelectorAll('.tile--exit-open')).toHaveLength(1);
    expect(document.querySelectorAll('.tile--exit-sealed')).toHaveLength(1);
    expect(screen.queryByText('Dungeon Rooms Cleared')).not.toBeInTheDocument();
    for (let chamber = 2; chamber <= 5; chamber += 1) {
      await advance();
      expect(screen.getAllByText(`Awakening Chamber ${chamber} / 5`)[0]).toBeVisible();
      expect(activeRecord().dungeonRoomsCleared).toBe(0);
    }
    await advance();
    expect(screen.getAllByText('Dungeon Room 1')[0]).toBeVisible();
    expect(screen.getByText('Dungeon Rooms Cleared')).toBeVisible();
    expect(activeRecord()).toMatchObject({
      dungeonRoomsCleared: 0,
      evaluationProgress: { evaluationComplete: true },
      dungeonProgress: { dungeonRoomNumber: 1 },
    });
    expect(loadPlayerProfile().record?.shortcutUnlocked).toBe(true);
    const snapshot = activeRecord().dungeonProgress?.currentRoom?.roomSnapshot;
    expect(snapshot?.exits.length).toBeGreaterThanOrEqual(1);
  });

  it('continues generated rooms without a cap and increments only when leaving a Dungeon Room', async () => {
    renderPage();
    await chooseAndDelve();
    for (let index = 0; index < 5; index += 1) await advance();
    const firstSeed = activeRecord().dungeonProgress?.currentRoom?.roomSeed;
    await advance();
    expect(screen.getAllByText('Dungeon Room 2')[0]).toBeVisible();
    expect(activeRecord()).toMatchObject({
      dungeonRoomsCleared: 1,
      dungeonProgress: { dungeonRoomNumber: 2 },
    });
    expect(activeRecord().dungeonProgress?.currentRoom?.roomSeed).not.toBe(firstSeed);
  });

  it('preserves exact generated snapshot and position across refresh with no hook-order warnings', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const view = renderPage();
    await chooseAndDelve();
    for (let index = 0; index < 5; index += 1) await advance();
    fireEvent.click(screen.getByRole('button', { name: 'Move right' }));
    const before = activeRecord();
    view.unmount();
    renderPage();
    expect(activeRecord().dungeonProgress?.currentRoom).toEqual(
      before.dungeonProgress?.currentRoom,
    );
    expect(activeRecord().playerPosition).toEqual(before.playerPosition);
    expect(error.mock.calls.flat().join(' ')).not.toMatch(/hooks|invalid hook/i);
    error.mockRestore();
  });

  it('shows the unlocked second doorway and lets it enter Dungeon Room 1 without incrementing the counter', async () => {
    const firstView = renderPage();
    await chooseAndDelve();
    for (let index = 0; index < 5; index += 1) await advance();
    firstView.unmount();
    clearActiveRun();
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Delve' }));
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(document.querySelectorAll('.tile--exit-open')).toHaveLength(2);
    expect(document.querySelector('.tile--exit-sealed')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Move down' }));
    for (let index = 0; index < 14; index += 1)
      fireEvent.click(screen.getByRole('button', { name: 'Move right' }));
    await act(() => vi.advanceTimersByTimeAsync(310));
    expect(screen.getAllByText('Dungeon Room 1')[0]).toBeVisible();
    expect(activeRecord()).toMatchObject({
      dungeonRoomsCleared: 0,
      evaluationProgress: { exitChoices: [{ exitId: 'evaluation-room-01-shortcut-exit' }] },
    });
  });
});
