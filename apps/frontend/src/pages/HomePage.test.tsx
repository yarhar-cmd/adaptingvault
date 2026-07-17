import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { createActiveRunRecord, saveActiveRun } from '../services/activeRunStorage';
import { createFreshRun } from '../utils/runLifecycle';
import { HomePage } from './HomePage';

describe('Resonant Ruins Main Menu run action', () => {
  beforeEach(() => localStorage.clear());

  it('shows Start Run without an active run', () => {
    render(<HomePage />, { wrapper: MemoryRouter });
    expect(screen.getByRole('link', { name: /Start Run/ })).toHaveAttribute('href', '/dungeon');
  });

  it('shows Resume Run and links directly to a valid paused or active run', () => {
    const now = Date.now();
    const gameplay = createFreshRun({
      maximumHealth: 6,
      experiencePreset: 'seasoned-adventurer',
      startedAt: now,
    });
    saveActiveRun(createActiveRunRecord(gameplay, 'warden', now)!);
    render(<HomePage />, { wrapper: MemoryRouter });
    expect(screen.getByRole('link', { name: /Resume Run/ })).toHaveAttribute(
      'href',
      '/dungeon/run',
    );
  });
});
