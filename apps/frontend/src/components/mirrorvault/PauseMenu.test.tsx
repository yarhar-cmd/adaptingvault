import { createRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PauseMenu } from './PauseMenu';

describe('Resonant Ruins Pause menu', () => {
  it('uses the exact menu order, focuses Resume, traps focus, and resumes on Escape', () => {
    const pauseButtonRef = createRef<HTMLButtonElement>();
    const onResume = vi.fn();
    const onSettings = vi.fn();
    const onRestart = vi.fn();
    const onMainMenu = vi.fn();
    render(
      <>
        <button ref={pauseButtonRef}>Pause</button>
        <PauseMenu
          open
          pauseButtonRef={pauseButtonRef}
          onResume={onResume}
          onSettings={onSettings}
          onRestart={onRestart}
          onMainMenu={onMainMenu}
          savedMessage="Run saved"
        />
      </>,
    );

    const dialog = screen.getByRole('dialog', { name: 'Paused' });
    const resume = screen.getByRole('button', { name: 'Resume' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(resume).toHaveFocus();
    expect(
      Array.from(document.querySelectorAll('.pause-menu__actions button')).map((button) =>
        button.textContent?.trim(),
      ),
    ).toEqual(['Resume', 'Settings', 'Restart Run', 'Main Menu']);
    expect(screen.getByText('Run saved')).toBeVisible();
    fireEvent.keyDown(resume, { key: 'Tab', shiftKey: true });
    expect(screen.getByRole('button', { name: 'Main Menu' })).toHaveFocus();

    fireEvent.click(screen.getByRole('button', { name: 'Main Menu' }));
    expect(screen.getByRole('heading', { name: 'Return to Main Menu?' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('heading', { name: 'Paused' })).toBeVisible();

    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(onResume).toHaveBeenCalledOnce();
    expect(onSettings).not.toHaveBeenCalled();
    expect(onMainMenu).not.toHaveBeenCalled();
  });

  it('confirms Restart, focuses Cancel, restores Restart focus, and closes nested confirmation first', () => {
    const pauseButtonRef = createRef<HTMLButtonElement>();
    const onRestart = vi.fn();
    render(
      <PauseMenu
        open
        pauseButtonRef={pauseButtonRef}
        onResume={vi.fn()}
        onSettings={vi.fn()}
        onRestart={onRestart}
        onMainMenu={vi.fn()}
      />,
    );
    const restart = screen.getByRole('button', { name: 'Restart Run' });
    fireEvent.click(restart);
    expect(screen.getByRole('heading', { name: 'Restart Run?' })).toBeVisible();
    expect(screen.getByText(/current run and progress will be lost/i)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.getByRole('heading', { name: 'Paused' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Restart Run' })).toHaveFocus();

    fireEvent.click(screen.getByRole('button', { name: 'Restart Run' }));
    fireEvent.click(screen.getByRole('button', { name: 'Restart Run' }));
    expect(onRestart).toHaveBeenCalledOnce();
  });
});
