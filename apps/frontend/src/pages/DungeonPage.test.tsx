import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdventureProvider } from '../context/AdventureProvider';
import { AppRoutes } from '../routes/AppRoutes';
import {
  ACTIVE_RUN_KEY,
  createActiveRunRecord,
  loadActiveRun,
  saveActiveRun,
  type ActiveRunRecord,
} from '../services/activeRunStorage';
import { loadPlayerProfile, PLAYER_PROFILE_KEY } from '../services/playerProfileStorage';
import { createFreshRun } from '../utils/runLifecycle';

function Location() {
  return <output data-testid="location">{useLocation().pathname}</output>;
}

function renderApp(path = '/dungeon') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AdventureProvider>
        <AppRoutes />
        <Location />
      </AdventureProvider>
    </MemoryRouter>,
  );
}

async function chooseAndDelve(label = 'Seasoned Adventurer') {
  fireEvent.click(screen.getByRole('radio', { name: label }));
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  expect(screen.getByText('Experience:')).toBeVisible();
  expect(screen.getByText(label)).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Delve' }));
  await act(() => vi.advanceTimersByTimeAsync(1));
}

async function advanceRoom() {
  if (!screen.queryByRole('button', { name: 'Advance to Next Room' })) {
    fireEvent.click(screen.getByRole('button', { name: 'Debug' }));
  }
  const defeatAll = screen.queryByRole('button', { name: 'Defeat All Enemies' });
  if (defeatAll && !defeatAll.hasAttribute('disabled')) fireEvent.click(defeatAll);
  fireEvent.click(screen.getByRole('button', { name: 'Advance to Next Room' }));
  await act(() => vi.advanceTimersByTimeAsync(310));
}

function activeRecord(): ActiveRunRecord {
  return JSON.parse(localStorage.getItem(ACTIVE_RUN_KEY)!) as ActiveRunRecord;
}

function persistRun(status: 'active' | 'defeated' = 'active') {
  const now = Date.now();
  const state = createFreshRun({
    maximumHealth: 6,
    experiencePreset: 'seasoned-adventurer',
    startedAt: now - 2_000,
    runId: 'persisted-run',
    runSeed: 'persisted-seed',
  });
  const record = createActiveRunRecord(state, 'warden', now)!;
  saveActiveRun(
    status === 'defeated'
      ? { ...record, status: 'defeated', currentHealth: 0, elapsedMs: 2_000 }
      : record,
  );
}

describe('Resonant Ruins dungeon routing, run layout, and pause flow', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 'ok' }) }),
    );
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('shows only first-time choice/setup on /dungeon, then Delve saves and navigates', async () => {
    renderApp();
    expect(screen.getByRole('heading', { name: 'Begin a descent' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    expect(screen.queryByRole('application')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pause' })).not.toBeInTheDocument();

    await chooseAndDelve('Dungeon Veteran');

    expect(screen.getByTestId('location')).toHaveTextContent('/dungeon/run');
    expect(screen.getAllByText('Awakening Chamber 1 / 5')[0]).toBeVisible();
    expect(loadPlayerProfile().record).toMatchObject({
      experiencePreset: 'dungeon-veteran',
      firstTimeComplete: true,
    });
    expect(activeRecord()).toMatchObject({ version: 5, experiencePreset: 'dungeon-veteran' });
  });

  it('redirects /dungeon to a valid run and /dungeon/run to setup when no run exists', () => {
    persistRun();
    const activeView = renderApp('/dungeon');
    expect(screen.getByTestId('location')).toHaveTextContent('/dungeon/run');
    expect(screen.getByRole('application')).toBeVisible();
    activeView.unmount();

    localStorage.clear();
    renderApp('/dungeon/run');
    expect(screen.getByTestId('location')).toHaveTextContent('/dungeon');
    expect(screen.getByRole('heading', { name: 'Begin a descent' })).toBeVisible();
  });

  it('uses the dedicated game shell without normal chrome, narrative, or stale copy', () => {
    persistRun();
    const { container } = renderApp('/dungeon/run');
    expect(container.querySelector('.game-shell')).toBeVisible();
    expect(container.querySelector('.site-header')).not.toBeInTheDocument();
    expect(container.querySelector('.site-footer')).not.toBeInTheDocument();
    expect(container.querySelector('.story-panel')).not.toBeInTheDocument();
    expect(screen.queryByText('Enter the experiment')).not.toBeInTheDocument();
    expect(screen.queryByText(/mock and local/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pause' })).toBeVisible();
    expect(screen.getByText('Health')).toBeVisible();
    expect(container.querySelector('.dungeon-grid-viewport')).toHaveAttribute(
      'data-maximum-columns',
      '21',
    );
    expect(container.querySelector('.dungeon-grid-viewport')).toHaveAttribute(
      'data-maximum-rows',
      '15',
    );
  });

  it('keeps progression, shortcut unlock, generated rooms, and exact refresh restoration', async () => {
    const view = renderApp();
    await chooseAndDelve();
    expect(document.querySelectorAll('.tile--exit-open')).toHaveLength(1);
    expect(document.querySelectorAll('.tile--exit-sealed')).toHaveLength(1);
    for (let chamber = 2; chamber <= 5; chamber += 1) {
      await advanceRoom();
      expect(screen.getAllByText(`Awakening Chamber ${chamber} / 5`)[0]).toBeVisible();
    }
    await advanceRoom();
    expect(screen.getAllByText('Dungeon Room 1')[0]).toBeVisible();
    expect(loadPlayerProfile().record?.shortcutUnlocked).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Move right' }));
    await act(() => vi.advanceTimersByTimeAsync(310));
    const before = activeRecord();
    const position = before.playerPosition;
    view.unmount();
    renderApp('/dungeon/run');
    expect(activeRecord().playerPosition).toEqual(position);
    expect(activeRecord().dungeonProgress?.currentRoom).toEqual(
      before.dungeonProgress?.currentRoom,
    );
  }, 15_000);

  it('pauses with Escape, disables gameplay, freezes survival, and resumes without held input', async () => {
    persistRun();
    renderApp('/dungeon/run');
    const board = document.querySelector('.game-board-panel')!;
    const beforeTime = board.getAttribute('data-survival-time');
    fireEvent.keyDown(window, { code: 'KeyD' });
    fireEvent.keyDown(window, { code: 'Escape' });
    const positionAtPause = activeRecord().playerPosition;
    expect(screen.getByRole('dialog', { name: 'Paused' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Move right' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Attack in/ })).toBeDisabled();
    fireEvent.keyDown(window, { code: 'Space' });
    await act(() => vi.advanceTimersByTimeAsync(5_000));
    expect(board).toHaveAttribute('data-survival-time', beforeTime);

    fireEvent.keyUp(window, { code: 'KeyD' });
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Paused' }), { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Paused' })).not.toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(250));
    expect(activeRecord().playerPosition).toEqual(positionAtPause);
  });

  it('restores a refreshed paused run paused with its timer still frozen', async () => {
    persistRun();
    const view = renderApp('/dungeon/run');
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    await act(() => vi.advanceTimersByTimeAsync(310));
    const elapsed = activeRecord().elapsedMs;
    expect(activeRecord().pauseState).toMatchObject({ isPaused: true, reason: 'pause-menu' });

    view.unmount();
    await act(() => vi.advanceTimersByTimeAsync(20_000));
    renderApp('/dungeon/run');
    expect(screen.getByRole('dialog', { name: 'Paused' })).toBeVisible();
    await act(() => vi.advanceTimersByTimeAsync(2_000));
    expect(activeRecord().elapsedMs).toBe(elapsed);
  });

  it('restarts from Pause with a fresh attempt while preserving preset and avoiding the archive', () => {
    persistRun();
    renderApp('/dungeon/run');
    const original = activeRecord();
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    fireEvent.click(screen.getByRole('button', { name: 'Restart Run' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(activeRecord().runId).toBe(original.runId);
    expect(screen.getByRole('button', { name: 'Restart Run' })).toHaveFocus();

    fireEvent.click(screen.getByRole('button', { name: 'Restart Run' }));
    fireEvent.click(screen.getByRole('button', { name: 'Restart Run' }));
    const restarted = activeRecord();
    expect(restarted.runId).not.toBe(original.runId);
    expect(restarted.dungeonProgress?.runSeed).not.toBe(original.dungeonProgress?.runSeed);
    expect(restarted).toMatchObject({
      status: 'active',
      currentHealth: 6,
      dungeonRoomsCleared: 0,
      experiencePreset: original.experiencePreset,
      pauseState: { isPaused: false, totalPausedMs: 0 },
      evaluationProgress: { currentRoomIndex: 0, currentRoomId: 'evaluation-room-01' },
    });
    expect(localStorage.getItem('mirrorvault:run-archive:v1')).toBeNull();
    expect(screen.getAllByText('Awakening Chamber 1 / 5')[0]).toBeVisible();
  });

  it('preserves the exact paused run through Settings and active-run Main Menu', async () => {
    persistRun();
    renderApp('/dungeon/run');
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/settings');
    expect(loadActiveRun().record?.pauseState).toMatchObject({ isPaused: true });

    fireEvent.click(screen.getByRole('link', { name: 'Dungeon' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/dungeon/run');
    expect(screen.getByRole('dialog', { name: 'Paused' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Main Menu' }));
    expect(screen.getByRole('heading', { name: 'Return to Main Menu?' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Return to Main Menu' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/');
    expect(loadActiveRun().record?.pauseState).toMatchObject({ isPaused: true });

    fireEvent.click(screen.getByRole('link', { name: 'Dungeon' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/dungeon/run');
    expect(screen.getByRole('dialog', { name: 'Paused' })).toBeVisible();
  });

  it('opens the development Debug drawer closed-by-default and overlays without narrative', () => {
    persistRun();
    renderApp('/dungeon/run');
    expect(screen.queryByRole('dialog', { name: 'Debug Tools' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Debug' }));
    expect(screen.getByRole('dialog', { name: 'Debug Tools' })).toHaveClass('debug-drawer');
    fireEvent.click(screen.getByRole('button', { name: 'Close Debug Tools' }));
    expect(screen.queryByRole('dialog', { name: 'Debug Tools' })).not.toBeInTheDocument();
  });

  it('disables Pause while a room transition is locked and reenables it after the fade', async () => {
    persistRun();
    renderApp('/dungeon/run');
    fireEvent.click(screen.getByRole('button', { name: 'Debug' }));
    fireEvent.click(screen.getByRole('button', { name: 'Advance to Next Room' }));
    expect(screen.getByRole('button', { name: 'Pause' })).toBeDisabled();
    await act(() => vi.advanceTimersByTimeAsync(310));
    expect(screen.getByRole('button', { name: 'Pause' })).toBeEnabled();
  });

  it('restarts a defeated run on /dungeon/run with a new ID and no setup screen', () => {
    persistRun('defeated');
    renderApp('/dungeon/run');
    fireEvent.click(screen.getByRole('button', { name: 'Restart Run' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/dungeon/run');
    expect(activeRecord().runId).not.toBe('persisted-run');
    expect(activeRecord()).toMatchObject({ status: 'active', currentHealth: 6 });
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  });

  it('keeps returning players on minimal Run Setup without active gameplay', () => {
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
    renderApp('/dungeon');
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(screen.getByText('New Delver')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Delve' })).toBeVisible();
    expect(screen.queryByRole('application')).not.toBeInTheDocument();
  });
});
