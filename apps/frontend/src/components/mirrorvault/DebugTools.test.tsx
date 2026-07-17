import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { VERSION_INFO } from '../../config/version';
import { NEUTRAL_ADAPTIVE_PROFILE } from '../../services/playerProfileStorage';
import { createGameplayState } from '../../utils/gameplayState';
import { DebugTools } from './DebugTools';

describe('Resonant Ruins development Debug Tools', () => {
  it('groups signals, profiles, generation state, sliders, and explicit controls for the drawer', () => {
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
        storageDiagnostics={{
          activeRunBytes: 2048,
          runArchiveBytes: 1024,
          detailedSnapshots: 5,
          currentVisitedTiles: 12,
          summarizedRooms: 42,
          activeRunSchemaVersion: 4,
          archiveSchemaVersion: 2,
        }}
      />,
    );
    expect(document.querySelector('.debug-tools')).toBeVisible();
    expect(screen.getByText('Raw signals')).toBeVisible();
    expect(screen.getByText('Adaptive profile')).toBeVisible();
    expect(screen.getByText('Generated room')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Version metadata' })).toBeVisible();
    expect(screen.getByText(VERSION_INFO.gameVersion)).toBeVisible();
    expect(screen.getByText(VERSION_INFO.generatorVersion)).toBeVisible();
    expect(screen.getByText(VERSION_INFO.adaptationVersion)).toBeVisible();
    expect(screen.getByText('Telemetry schema').nextElementSibling).toHaveTextContent(
      String(VERSION_INFO.telemetrySchemaVersion),
    );
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
