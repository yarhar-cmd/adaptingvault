import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { VERSION_INFO } from '../../config/version';
import { NEUTRAL_ADAPTIVE_PROFILE } from '../../services/playerProfileStorage';
import { createGameplayState } from '../../utils/gameplayState';
import { DebugTools } from './DebugTools';
import { createRectangularRoom } from '../../utils/roomGeometry';
import { createRoomEnemyState } from '../../utils/enemySystem';

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

  it('shows live Combat Debug state and resets only its displayed baseline', () => {
    const room = createRectangularRoom({
      id: 'combat-debug-room',
      phase: 'dungeon',
      width: 9,
      height: 7,
      exitEnabled: true,
      enemySpawns: [
        {
          id: 'debug-rat-1',
          type: 'rat',
          tile: { x: 5, y: 3 },
          order: 1,
          source: 'generated',
          reason: 'Debug test',
        },
      ],
    });
    const enemies = createRoomEnemyState(room, 'seasoned-adventurer', 1_000);
    enemies.combatMetrics.attacksStarted = 4;
    enemies.combatMetrics.perfectBlocks = 2;
    const gameplay = { ...createGameplayState(6), enemies };

    render(
      <DebugTools
        gameplay={gameplay}
        longTermProfile={NEUTRAL_ADAPTIVE_PROFILE}
        onAdvance={vi.fn()}
        onTemporaryOverride={vi.fn()}
        onClearOverrides={vi.fn()}
        onApplyOverrides={vi.fn()}
        storageDiagnostics={{
          activeRunBytes: 0,
          runArchiveBytes: 0,
          detailedSnapshots: 0,
          currentVisitedTiles: 0,
          summarizedRooms: 0,
          activeRunSchemaVersion: 6,
          archiveSchemaVersion: 2,
        }}
        enemies={enemies}
        room={room}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Combat Debug' })).toBeVisible();
    expect(screen.getByText('Attacks started').nextElementSibling).toHaveTextContent('4');
    expect(screen.getByText('Perfect blocks').nextElementSibling).toHaveTextContent('2');
    fireEvent.click(screen.getByRole('button', { name: 'Reset Combat Debug counters' }));
    expect(screen.getByText('Attacks started').nextElementSibling).toHaveTextContent('0');
    expect(enemies.combatMetrics.attacksStarted).toBe(4);
    expect(gameplay.enemies).toBe(enemies);
  });
});
