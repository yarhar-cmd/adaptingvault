import { useRef, useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NEUTRAL_ADAPTIVE_PROFILE } from '../../services/playerProfileStorage';
import { createGameplayState } from '../../utils/gameplayState';
import { DebugDrawer } from './DebugDrawer';

function Harness() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={triggerRef} type="button" onClick={() => setOpen(true)}>
        Debug
      </button>
      <DebugDrawer
        open={open}
        triggerRef={triggerRef}
        onClose={() => setOpen(false)}
        debugToolsProps={{
          gameplay: createGameplayState(6),
          longTermProfile: NEUTRAL_ADAPTIVE_PROFILE,
          onAdvance: vi.fn(),
          onTemporaryOverride: vi.fn(),
          onClearOverrides: vi.fn(),
          onApplyOverrides: vi.fn(),
          storageDiagnostics: {
            activeRunBytes: 0,
            runArchiveBytes: 0,
            detailedSnapshots: 0,
            currentVisitedTiles: 0,
            summarizedRooms: 0,
            activeRunSchemaVersion: 4,
            archiveSchemaVersion: 2,
          },
        }}
      />
    </>
  );
}

describe('Resonant Ruins Debug drawer', () => {
  it('is closed by default, opens as an overlay, focuses close, and restores focus on Escape', () => {
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Debug' });
    expect(screen.queryByRole('dialog', { name: 'Debug Tools' })).not.toBeInTheDocument();

    fireEvent.click(trigger);
    const drawer = screen.getByRole('dialog', { name: 'Debug Tools' });
    expect(drawer).toHaveClass('debug-drawer');
    expect(screen.getByRole('button', { name: 'Close Debug Tools' })).toHaveFocus();

    fireEvent.keyDown(drawer, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Debug Tools' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
