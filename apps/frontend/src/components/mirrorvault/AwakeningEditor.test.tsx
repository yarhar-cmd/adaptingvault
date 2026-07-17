import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EDITOR_DRAFT_KEY } from '../../services/editorDraftStorage';
import { AwakeningEditor } from './AwakeningEditor';

describe('Resonant Ruins development Awakening editor', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    );
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it('selects all five rooms, exposes painting tools, validates, previews, and exits in isolation', () => {
    const { container } = render(<AwakeningEditor />);
    expect(screen.getByRole('heading', { name: 'Awakening Chamber Editor' })).toBeVisible();
    expect(screen.getByRole('combobox', { name: 'Awakening Chamber' })).toHaveValue(
      'evaluation-room-01',
    );
    expect(screen.getByRole('button', { name: 'Rat Spawn' })).toBeVisible();

    fireEvent.change(screen.getByRole('combobox', { name: 'Awakening Chamber' }), {
      target: { value: 'evaluation-room-04' },
    });
    expect(screen.getByRole('button', { name: 'Tile 9, 5: rat 1' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Tile 12, 3: rat 2' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Tile 12, 7: rat 3' })).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Validate Room' }));
    expect(screen.getByRole('status')).toHaveTextContent('Room is valid.');
    expect(screen.getByRole('button', { name: 'Preview Room' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Preview Room' }));
    expect(screen.getByRole('region', { name: 'Preview Mode' })).toBeVisible();
    expect(container.querySelectorAll('.rat-token')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Exit Preview' }));
    expect(screen.getByRole('heading', { name: 'Awakening Chamber Editor' })).toBeVisible();
    expect(localStorage.getItem(EDITOR_DRAFT_KEY)).not.toBeNull();
  });

  it('renumbers Rat spawns after erase and requires validation before copy or preview', () => {
    render(<AwakeningEditor />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Awakening Chamber' }), {
      target: { value: 'evaluation-room-04' },
    });
    expect(screen.getByRole('button', { name: 'Copy Room JSON' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Erase' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tile 9, 5: rat 1' }));
    expect(screen.queryByRole('button', { name: 'Tile 9, 5: rat 1' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tile 12, 3: rat 1' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Tile 12, 7: rat 2' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Validate Room' }));
    expect(screen.getByRole('status')).toHaveTextContent('validation errors');
    expect(screen.getByRole('button', { name: 'Copy Room JSON' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Preview Room' })).toBeDisabled();
  });
});
