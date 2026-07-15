import type {
  AttackAction,
  CardinalDirection,
  CollisionContext,
  GridPosition,
  MoveResult,
  PlayerState,
  RoomBounds,
} from '../types/player';

const directionOffsets: Record<CardinalDirection, GridPosition> = {
  up: { row: -1, column: 0 },
  down: { row: 1, column: 0 },
  left: { row: 0, column: -1 },
  right: { row: 0, column: 1 },
};

export function getAdjacentPosition(
  position: GridPosition,
  direction: CardinalDirection,
): GridPosition {
  const offset = directionOffsets[direction];
  return {
    row: position.row + offset.row,
    column: position.column + offset.column,
  };
}

export function isPositionInBounds(position: GridPosition, bounds: RoomBounds): boolean {
  return (
    position.row >= 0 &&
    position.row < bounds.rows &&
    position.column >= 0 &&
    position.column < bounds.columns
  );
}

export function positionsMatch(left: GridPosition, right: GridPosition): boolean {
  return left.row === right.row && left.column === right.column;
}

export function turnPlayer(player: PlayerState, direction: CardinalDirection): PlayerState {
  return {
    ...player,
    facing: direction,
    shieldDirection: player.isShielding ? direction : null,
  };
}

export function attemptMove(
  player: PlayerState,
  direction: CardinalDirection,
  collision: CollisionContext,
  id: string,
): { player: PlayerState; result: MoveResult } {
  const attemptedTarget = getAdjacentPosition(player.position, direction);
  const blockedReason = !isPositionInBounds(attemptedTarget, collision.bounds)
    ? 'bounds'
    : collision.isBlocked?.(attemptedTarget)
      ? 'tile'
      : null;
  const target = blockedReason ? player.position : attemptedTarget;
  const nextPlayer: PlayerState = {
    ...player,
    position: target,
    facing: direction,
    shieldDirection: player.isShielding ? direction : null,
  };

  return {
    player: nextPlayer,
    result: {
      id,
      source: player.position,
      attemptedTarget,
      target,
      facing: direction,
      moved: blockedReason === null,
      blockedReason,
    },
  };
}

export function createAttackAction(
  player: PlayerState,
  collision: CollisionContext,
  id: string,
  timestamp: number,
): AttackAction {
  const attemptedTarget = getAdjacentPosition(player.position, player.facing);
  const isInBounds = isPositionInBounds(attemptedTarget, collision.bounds);
  const blockedReason = !isInBounds
    ? 'bounds'
    : collision.isBlocked?.(attemptedTarget)
      ? 'tile'
      : null;

  return {
    id,
    source: player.position,
    attemptedTarget,
    target: isInBounds ? attemptedTarget : null,
    facing: player.facing,
    damage: 1,
    timestamp,
    blockedReason,
  };
}

export function getProtectedTile(player: PlayerState, bounds: RoomBounds): GridPosition | null {
  if (!player.isShielding || !player.shieldDirection) return null;

  const protectedTile = getAdjacentPosition(player.position, player.shieldDirection);
  return isPositionInBounds(protectedTile, bounds) ? protectedTile : null;
}
