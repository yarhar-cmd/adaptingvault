import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  archiveCompletedRun,
  createCompletedRunRecord,
  RUN_ARCHIVE_KEY,
} from '../services/runArchive';
import { HistoryPage } from './HistoryPage';

function archive(input: {
  id: string;
  characterId: 'warden' | 'seeker' | 'ember';
  experiencePreset?: 'new-delver' | 'seasoned-adventurer' | 'dungeon-veteran' | 'unknown';
  endedAt: string;
  time: number;
  rooms: number;
  enemies: number;
}) {
  archiveCompletedRun(
    createCompletedRunRecord({
      id: input.id,
      characterId: input.characterId,
      experiencePreset: input.experiencePreset,
      endedAt: input.endedAt,
      timeSurvivedMs: input.time,
      dungeonRoomsCleared: input.rooms,
      enemiesDefeated: input.enemies,
    }),
  );
}

describe('Resonant Ruins Runs page', () => {
  beforeEach(() => localStorage.clear());

  it('uses the current archive, renders Best before Recent, sorts newest first, and marks best owners', () => {
    localStorage.setItem('mirrorvault:runs', JSON.stringify([{ id: 'legacy-visible-no-more' }]));
    archive({
      id: 'older-best-time',
      characterId: 'warden',
      experiencePreset: 'seasoned-adventurer',
      endedAt: '2026-01-01T00:00:00.000Z',
      time: 90_000,
      rooms: 3,
      enemies: 0,
    });
    archive({
      id: 'newer-best-rooms',
      characterId: 'seeker',
      experiencePreset: 'new-delver',
      endedAt: '2026-02-01T00:00:00.000Z',
      time: 60_000,
      rooms: 7,
      enemies: 0,
    });

    render(<HistoryPage />);
    const best = screen.getByRole('heading', { name: 'Best Runs' });
    const recent = screen.getByRole('heading', { name: 'Recent Runs' });
    expect(best.compareDocumentPosition(recent) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const cards = document.querySelectorAll('.history-card');
    expect(cards[0]).toHaveTextContent('Seeker');
    expect(cards[1]).toHaveTextContent('Warden');
    expect(screen.queryByText('legacy-visible-no-more')).not.toBeInTheDocument();
    expect(within(cards[1] as HTMLElement).getByText('Best Survival')).toBeVisible();
    expect(within(cards[0] as HTMLElement).getByText('Best Rooms')).toBeVisible();
  });

  it('filters character and experience, preserves Unknown Experience, and clears filtered-empty state', () => {
    archive({
      id: 'unknown-run',
      characterId: 'ember',
      experiencePreset: 'unknown',
      endedAt: '2026-03-01T00:00:00.000Z',
      time: 30_000,
      rooms: 2,
      enemies: 0,
    });
    archive({
      id: 'warden-run',
      characterId: 'warden',
      experiencePreset: 'dungeon-veteran',
      endedAt: '2026-04-01T00:00:00.000Z',
      time: 40_000,
      rooms: 4,
      enemies: 0,
    });
    render(<HistoryPage />);
    expect(screen.getAllByText('Unknown Experience')).toHaveLength(2);

    fireEvent.change(screen.getByLabelText('Character'), { target: { value: 'ember' } });
    expect(screen.getByRole('heading', { name: 'Ember' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Warden' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Experience'), {
      target: { value: 'dungeon-veteran' },
    });
    expect(screen.getByText('No runs match these filters.')).toBeVisible();
    fireEvent.click(screen.getAllByRole('button', { name: 'Clear Filters' }).at(-1)!);
    expect(screen.getByRole('heading', { name: 'Warden' })).toBeVisible();
  });

  it('shows the no-run empty state and isolates corrupt archive recovery', () => {
    localStorage.setItem(RUN_ARCHIVE_KEY, '{');
    localStorage.setItem('mirrorvault:active-run:v1', 'preserved-active');
    render(<HistoryPage />);
    expect(screen.getByText(/No completed runs yet\./)).toBeVisible();
    expect(screen.getByText(/Your defeated runs will appear here\./)).toBeVisible();
    expect(screen.getByText(/run history was unreadable/i)).toBeVisible();
    expect(localStorage.getItem('mirrorvault:active-run:v1')).toBe('preserved-active');
  });
});
