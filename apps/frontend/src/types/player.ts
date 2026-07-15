export type CardinalDirection = 'up' | 'down' | 'left' | 'right';

export type MoveTrigger = 'press' | 'repeat' | 'button' | 'resume';

export interface GridPosition {
  row: number;
  column: number;
}

export interface RoomBounds {
  rows: number;
  columns: number;
}

export interface PlayerState {
  position: GridPosition;
  facing: CardinalDirection;
  isShielding: boolean;
  shieldDirection: CardinalDirection | null;
}

export type BlockedReason = 'bounds' | 'tile';

export interface MoveResult {
  id: string;
  source: GridPosition;
  attemptedTarget: GridPosition;
  target: GridPosition;
  facing: CardinalDirection;
  moved: boolean;
  blockedReason: BlockedReason | null;
}

export interface AttackAction {
  id: string;
  source: GridPosition;
  attemptedTarget: GridPosition;
  target: GridPosition | null;
  facing: CardinalDirection;
  damage: 1;
  timestamp: number;
  blockedReason: BlockedReason | null;
}

export interface CollisionContext {
  bounds: RoomBounds;
  isBlocked?: (position: GridPosition) => boolean;
}
