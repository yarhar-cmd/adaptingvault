import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NEUTRAL_ADAPTIVE_PROFILE } from '../../services/playerProfileStorage';
import { createGameplayState } from '../../utils/gameplayState';
import { DebugTools } from './DebugTools';

describe('Resonant Ruins development Debug Tools', () => {
  it('groups signals, profiles, generation state, sliders, and explicit controls in one collapsible region', () => {
    const temporary = vi.fn();
    const clear = vi.fn();
    const apply = vi.fn();
    const advance = vi.fn();
    render(
      <DebugTools
        gameplay={createGameplayState(6)}
        longTermProfile={NEUTRAL_ADAPTIVE_PROFILE}
        onAdvance={advance}
        onTemporaryOverride={temporary}
        onClearOverrides={clear}
        onApplyOverrides={apply}
      />,
    );
    expect(screen.getByText('Debug Tools').closest('details')).toHaveAttribute('open');
    expect(screen.getByText('Raw signals')).toBeVisible();
    expect(screen.getByText('Adaptive profile')).toBeVisible();
    expect(screen.getByText('Generated room')).toBeVisible();
    const pace = screen.getByRole('slider', { name: /pace/i });
    fireEvent.change(pace, { target: { value: '.8' } });
    expect(temporary).toHaveBeenCalledWith(expect.objectContaining({ pace: 0.8 }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply Overrides to Saved Profile' }));
    expect(apply).toHaveBeenCalledWith(expect.objectContaining({ pace: 0.8 }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear Temporary Overrides' }));
    expect(clear).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Advance to Next Room' }));
    expect(advance).toHaveBeenCalled();
  });
});
