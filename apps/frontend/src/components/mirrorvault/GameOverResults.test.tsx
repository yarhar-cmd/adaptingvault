import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GameOverResults } from './GameOverResults';

const defaultProps = {
  characterName: 'Warden',
  timeSurvived: '01:23',
  roomsCleared: 2,
  enemiesDefeated: 4,
  onHide: vi.fn(),
  onReopen: vi.fn(),
  onRestart: vi.fn(),
  onMainMenu: vi.fn(),
};

describe('Resonant Ruins game-over results', () => {
  it('renders the required dialog, dimming surface, frozen stats, and no future-history UI', () => {
    const { container } = render(<GameOverResults visible {...defaultProps} />);
    const dialog = screen.getByRole('dialog', { name: 'Game Over' });

    expect(container.querySelector('.game-over-backdrop')).not.toBeNull();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveFocus();
    expect(screen.getByText('The ruins remember your attempt.')).toBeVisible();
    expect(screen.getByText('Warden')).toBeVisible();
    expect(screen.getByText('01:23')).toBeVisible();
    expect(screen.queryByText(/best|recent|leaderboard|cause/i)).not.toBeInTheDocument();
  });

  it('hides from the close button and backdrop without activating from the dialog', () => {
    const onHide = vi.fn();
    const { container } = render(<GameOverResults visible {...defaultProps} onHide={onHide} />);

    fireEvent.click(screen.getByRole('button', { name: 'Hide game-over results' }));
    fireEvent.click(container.querySelector('.game-over-backdrop')!);
    fireEvent.click(screen.getByRole('dialog'));
    expect(onHide).toHaveBeenCalledTimes(2);
  });

  it('traps focus in close, restart, main-menu order and leaves Enter inert on the container', () => {
    const onRestart = vi.fn();
    render(<GameOverResults visible {...defaultProps} onRestart={onRestart} />);
    const dialog = screen.getByRole('dialog');
    const close = screen.getByRole('button', { name: 'Hide game-over results' });
    const restart = screen.getByRole('button', { name: 'Restart Run' });
    const menu = screen.getByRole('button', { name: 'Main Menu' });

    fireEvent.keyDown(dialog, { key: 'Enter' });
    expect(onRestart).not.toHaveBeenCalled();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(close).toHaveFocus();
    fireEvent.keyDown(close, { key: 'Tab' });
    expect(restart).toHaveFocus();
    fireEvent.keyDown(restart, { key: 'Tab' });
    expect(menu).toHaveFocus();
    fireEvent.keyDown(menu, { key: 'Tab' });
    expect(close).toHaveFocus();
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(menu).toHaveFocus();
  });

  it('renders a compact focusable button with only the three result stats', () => {
    const onReopen = vi.fn();
    render(<GameOverResults visible={false} {...defaultProps} onReopen={onReopen} />);
    const strip = screen.getByRole('button', { name: /Show game-over results/ });

    expect(strip).toHaveFocus();
    expect(screen.getByText('Time')).toBeVisible();
    expect(screen.getByText('Dungeon rooms')).toBeVisible();
    expect(screen.getByText('Enemies')).toBeVisible();
    expect(screen.queryByText('Warden')).not.toBeInTheDocument();
    expect(screen.queryByText('Restart Run')).not.toBeInTheDocument();
    fireEvent.keyDown(strip, { key: 'Enter' });
    fireEvent.keyDown(strip, { key: ' ' });
    fireEvent.click(strip);
    expect(onReopen).toHaveBeenCalledTimes(3);
  });

  it('restores focus between the dialog container and compact strip', () => {
    const { rerender } = render(<GameOverResults visible {...defaultProps} />);
    expect(screen.getByRole('dialog')).toHaveFocus();

    rerender(<GameOverResults visible={false} {...defaultProps} />);
    expect(screen.getByRole('button', { name: /Show game-over results/ })).toHaveFocus();

    rerender(<GameOverResults visible {...defaultProps} />);
    expect(screen.getByRole('dialog')).toHaveFocus();
  });
});
