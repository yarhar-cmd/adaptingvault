import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AttackAction, PlayerState } from '../../types/player';
import type { RoomDefinition } from '../../types/rooms';
import { CURRENT_ROOM_LAYOUT } from '../../data/roomLayout';
import { evaluationRooms } from '../../data/rooms/evaluationRooms';
import { coordinateToGridPosition, roomBounds } from '../../utils/roomGeometry';
import { DungeonGrid } from './DungeonGrid';

const bounds = { rows: 5, columns: 8 } as const;
const basePlayer: PlayerState = {
  position: { row: 2, column: 2 },
  facing: 'right',
  isShielding: false,
  shieldDirection: null,
};

function renderGrid(player: PlayerState = basePlayer, attack: AttackAction | null = null) {
  return render(
    <DungeonGrid
      bounds={bounds}
      hazards={CURRENT_ROOM_LAYOUT.hazards}
      player={player}
      status="active"
      isInvulnerable={false}
      blockedMove={null}
      lastAttack={attack}
      lastDamage={null}
      lastAvoidedDamage={null}
      announcement="Moved right."
      controlsDisabled={false}
      onMove={vi.fn()}
      onAttack={() => true}
      onShieldChange={vi.fn()}
    />,
  );
}

function dataDrivenGrid(room: RoomDefinition) {
  return (
    <DungeonGrid
      bounds={roomBounds(room)}
      hazards={(room.hazards ?? []).map(coordinateToGridPosition)}
      room={room}
      collapsedEntrance={{ x: 0, y: Math.floor(room.height / 2) }}
      player={{
        ...basePlayer,
        position: { row: Math.floor(room.height / 2), column: 1 },
      }}
      status="active"
      isInvulnerable={false}
      blockedMove={null}
      lastAttack={null}
      lastDamage={null}
      lastAvoidedDamage={null}
      announcement="Entered the next room."
      controlsDisabled={false}
      onMove={vi.fn()}
      onAttack={() => true}
      onShieldChange={vi.fn()}
    />
  );
}

describe('Resonant Ruins dungeon grid', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('provides Resonant Ruins instructions and a polite status announcement', () => {
    renderGrid();

    expect(
      screen.getByRole('application', { name: 'Resonant Ruins playable dungeon grid' }),
    ).toHaveAttribute('aria-describedby', 'resonant-ruins-grid-instructions');
    expect(screen.getByText(/Resonant Ruins controls/)).toBeVisible();
    expect(screen.getByText('Moved right.')).toHaveAttribute('aria-live', 'polite');
  });

  it('keeps facing and shield visuals visible and updates the protected tile', () => {
    const shieldingRight: PlayerState = {
      ...basePlayer,
      isShielding: true,
      shieldDirection: 'right',
    };
    const { container, rerender } = renderGrid(shieldingRight);

    expect(container.querySelector('.player-token--shielding')).not.toBeNull();
    expect(container.querySelector('.player-token__facing')).toHaveTextContent('→');
    expect(container.querySelectorAll('.tile--shield-protected')).toHaveLength(1);

    const shieldingDown: PlayerState = {
      ...shieldingRight,
      facing: 'down',
      shieldDirection: 'down',
    };
    rerender(
      <DungeonGrid
        bounds={bounds}
        hazards={CURRENT_ROOM_LAYOUT.hazards}
        player={shieldingDown}
        status="active"
        isInvulnerable={false}
        blockedMove={null}
        lastAttack={null}
        lastDamage={null}
        lastAvoidedDamage={null}
        announcement="Moved down."
        controlsDisabled={false}
        onMove={vi.fn()}
        onAttack={() => true}
        onShieldChange={vi.fn()}
      />,
    );

    expect(container.querySelector('.player-token--shielding')).not.toBeNull();
    expect(container.querySelector('.player-token__facing')).toHaveTextContent('↓');
    expect(container.querySelectorAll('.tile--shield-protected')).toHaveLength(1);
  });

  it('retains the shield treatment without rendering a protected tile outside the room', () => {
    const { container } = renderGrid({
      ...basePlayer,
      position: { row: 0, column: 2 },
      facing: 'up',
      isShielding: true,
      shieldDirection: 'up',
    });

    expect(container.querySelector('.player-token--shielding')).not.toBeNull();
    expect(container.querySelector('.player-token__facing')).toHaveTextContent('↑');
    expect(container.querySelector('.tile--shield-protected')).toBeNull();
  });

  it('renders an in-room slash briefly and never renders an out-of-room target', () => {
    const attack: AttackAction = {
      id: 'attack-1',
      source: { row: 2, column: 2 },
      attemptedTarget: { row: 2, column: 3 },
      target: { row: 2, column: 3 },
      facing: 'right',
      damage: 1,
      timestamp: 1,
      blockedReason: null,
    };
    const { container, rerender } = renderGrid(basePlayer, attack);
    expect(container.querySelectorAll('.tile--attack-target')).toHaveLength(1);

    act(() => vi.advanceTimersByTime(180));
    expect(container.querySelector('.tile--attack-target')).toBeNull();

    rerender(
      <DungeonGrid
        bounds={bounds}
        hazards={CURRENT_ROOM_LAYOUT.hazards}
        player={{ ...basePlayer, position: { row: 0, column: 2 }, facing: 'up' }}
        status="active"
        isInvulnerable={false}
        blockedMove={null}
        lastAttack={{
          ...attack,
          id: 'attack-edge',
          source: { row: 0, column: 2 },
          attemptedTarget: { row: -1, column: 2 },
          target: null,
          facing: 'up',
          blockedReason: 'bounds',
        }}
        lastDamage={null}
        lastAvoidedDamage={null}
        announcement="Attacked beyond the room boundary."
        controlsDisabled={false}
        onMove={vi.fn()}
        onAttack={() => true}
        onShieldChange={vi.fn()}
      />,
    );

    expect(container.querySelector('.tile--attack-target')).toBeNull();
  });

  it('renders blocked-movement feedback briefly', () => {
    const { container } = render(
      <DungeonGrid
        bounds={bounds}
        hazards={CURRENT_ROOM_LAYOUT.hazards}
        player={{ ...basePlayer, facing: 'left' }}
        status="active"
        isInvulnerable={false}
        blockedMove={{
          id: 'move-blocked',
          source: { row: 2, column: 2 },
          attemptedTarget: { row: 2, column: 1 },
          target: { row: 2, column: 2 },
          facing: 'left',
          moved: false,
          blockedReason: 'tile',
        }}
        lastAttack={null}
        lastDamage={null}
        lastAvoidedDamage={null}
        announcement="Blocked moving left."
        controlsDisabled={false}
        onMove={vi.fn()}
        onAttack={() => true}
        onShieldChange={vi.fn()}
      />,
    );

    expect(container.querySelector('.player-token--bump')).not.toBeNull();
    act(() => vi.advanceTimersByTime(160));
    expect(container.querySelector('.player-token--bump')).toBeNull();
  });

  it('renders both shared hazard coordinates and preserves the rune beneath the player', () => {
    const { container } = renderGrid({
      ...basePlayer,
      position: CURRENT_ROOM_LAYOUT.hazards[0]!,
    });
    const tiles = Array.from(container.querySelectorAll('.tile'));

    expect(container.querySelectorAll('.tile--hazard')).toHaveLength(2);
    expect(tiles[1 * bounds.columns + 5]).toHaveClass('tile--hazard', 'tile--player');
    expect(tiles[4 * bounds.columns + 2]).toHaveClass('tile--hazard');
    expect(screen.getByText(/Red rune floor markings are walkable hazards/)).toBeVisible();
  });

  it('shows nonfatal damage and invulnerability feedback', () => {
    const { container } = render(
      <DungeonGrid
        bounds={bounds}
        hazards={CURRENT_ROOM_LAYOUT.hazards}
        player={basePlayer}
        status="active"
        isInvulnerable
        blockedMove={null}
        lastAttack={null}
        lastDamage={{
          id: 'damage-1',
          source: 'rune',
          amount: 1,
          timestamp: 100,
          fatal: false,
        }}
        lastAvoidedDamage={null}
        announcement="Rune damaged you. 5 of 6 health remaining."
        controlsDisabled={false}
        onMove={vi.fn()}
        onAttack={() => true}
        onShieldChange={vi.fn()}
      />,
    );

    expect(container.querySelector('.player-token--damaged')).not.toBeNull();
    expect(container.querySelector('.player-token--invulnerable')).not.toBeNull();
    expect(container.querySelector('.player-token__invulnerable')).toHaveTextContent('◇');
  });

  it('renders a defeated player without active indicators and disables every control', () => {
    const { container } = render(
      <DungeonGrid
        bounds={bounds}
        hazards={CURRENT_ROOM_LAYOUT.hazards}
        player={{ ...basePlayer, isShielding: false, shieldDirection: null }}
        status="defeated"
        isInvulnerable={false}
        blockedMove={null}
        lastAttack={null}
        lastDamage={{
          id: 'fatal-1',
          source: 'rune',
          amount: 1,
          timestamp: 100,
          fatal: true,
        }}
        lastAvoidedDamage={null}
        announcement="You were defeated."
        controlsDisabled
        onMove={vi.fn()}
        onAttack={() => true}
        onShieldChange={vi.fn()}
      />,
    );

    expect(container.querySelector('.player-token--defeated')).not.toBeNull();
    expect(container.querySelector('.player-token__dead-mark')).toHaveTextContent('×');
    expect(container.querySelector('.player-token--damaged')).toBeNull();
    expect(container.querySelector('.player-token__facing')).toBeNull();
    expect(container.querySelector('.player-token__shield')).toBeNull();
    expect(container.querySelector('.tile--shield-protected')).toBeNull();
    for (const control of screen.getAllByRole('button')) expect(control).toBeDisabled();
  });

  it('renders variable room geometry, visible walls, an open exit, and a collapsed entrance', () => {
    const room = evaluationRooms[1]!;
    const { container } = render(
      <DungeonGrid
        bounds={roomBounds(room)}
        hazards={[]}
        room={room}
        collapsedEntrance={{ x: 0, y: 5 }}
        player={{ ...basePlayer, position: { row: 5, column: 1 } }}
        status="active"
        isInvulnerable={false}
        blockedMove={null}
        lastAttack={null}
        lastDamage={null}
        lastAvoidedDamage={null}
        announcement="Entered the next room."
        controlsDisabled={false}
        onMove={vi.fn()}
        onAttack={() => true}
        onShieldChange={vi.fn()}
      />,
    );

    expect(container.querySelectorAll('.tile')).toHaveLength(room.width * room.height);
    expect(container.querySelectorAll('.tile--wall')).toHaveLength(
      (room.wallTiles?.length ?? 0) - 1,
    );
    expect(container.querySelectorAll('.tile--exit-open')).toHaveLength(1);
    expect(container.querySelectorAll('.tile--collapsed-entrance')).toHaveLength(1);
    expect(screen.getByRole('application')).toHaveAttribute('data-room-columns', '17');
    expect(screen.getByRole('application')).toHaveAttribute('data-room-rows', '11');
    expect(screen.getByRole('application').getAttribute('style')).toContain('--room-columns: 17');
    expect(screen.getByRole('application').getAttribute('style')).toContain('--room-rows: 11');
    expect(container.querySelector('.dungeon-grid-viewport')).toHaveAttribute(
      'data-maximum-columns',
      '21',
    );
    expect(container.querySelector('.dungeon-grid-viewport')).toHaveAttribute(
      'data-maximum-rows',
      '15',
    );
  });

  it('uses one shared responsive tile scale while room track counts change', () => {
    const smallRoom = evaluationRooms[0]!;
    const largeRoom = evaluationRooms[3]!;
    const { container, rerender } = render(dataDrivenGrid(smallRoom));
    const smallGrid = screen.getByRole('application');
    const smallViewport = container.querySelector('.dungeon-grid-viewport');

    expect(smallGrid).toHaveAttribute('data-room-columns', '15');
    expect(smallGrid).toHaveAttribute('data-room-rows', '11');
    expect(smallViewport).toHaveAttribute('data-maximum-columns', '21');
    expect(smallViewport).toHaveAttribute('data-maximum-rows', '15');
    expect(smallViewport).not.toHaveAttribute('style');
    expect(container.querySelectorAll('.tile')).toHaveLength(15 * 11);

    rerender(dataDrivenGrid(largeRoom));
    const largeGrid = screen.getByRole('application');
    const largeViewport = container.querySelector('.dungeon-grid-viewport');

    expect(largeGrid).toHaveAttribute('data-room-columns', '17');
    expect(largeGrid).toHaveAttribute('data-room-rows', '11');
    expect(largeViewport).not.toHaveAttribute('style');
    expect(container.querySelectorAll('.tile')).toHaveLength(17 * 11);
    expect(container.querySelector('.tile--wall')).not.toHaveAttribute('style');
    expect(container.querySelector('.tile--exit-open')).not.toHaveAttribute('style');
    expect(container.querySelector('.player-token')).not.toHaveAttribute('style');

    rerender(dataDrivenGrid(evaluationRooms[2]!));
    expect(container.querySelector('.tile--hazard')).not.toHaveAttribute('style');
    expect(container.querySelector('.tile--hazard')).toHaveClass('tile');
  });
});
