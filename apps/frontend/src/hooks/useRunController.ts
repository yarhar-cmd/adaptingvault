import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ACTIVE_RUN_POSITION_REPAIRED_WARNING,
  ACTIVE_RUN_STORAGE_WARNING,
  RUN_STORAGE_INVALID_WARNING,
  RUN_STORAGE_WARNING,
} from '../components/mirrorvault/StorageWarning';
import { getPlayableCharacterId } from '../data/characterAvailability';
import { getRoomDefinition } from '../data/rooms';
import { EVALUATION_ROOM_1_ID, getEvaluationRoom } from '../data/rooms/evaluationRooms';
import {
  clearActiveRun,
  createActiveRunRecord,
  saveActiveRun,
  toRestorableGameplayRun,
  type ActiveRunRecord,
} from '../services/activeRunStorage';
import { characters } from '../services/mockAdventureService';
import { createPlayerProfile, savePlayerProfile } from '../services/playerProfileStorage';
import { archiveCompletedRun, createCompletedRunRecord } from '../services/runArchive';
import { getStorageDiagnostics } from '../services/storageDiagnostics';
import type { AdaptiveProfile, PlayerProfileRecord } from '../types/adaptation';
import type { GridPosition } from '../types/player';
import type { RoomDefinition, RoomExit } from '../types/rooms';
import { getEffectiveProfile, updateLongTermProfile } from '../utils/adaptiveProfile';
import { generateDungeonRoom, oppositeExitDirection } from '../utils/generatedRoomGenerator';
import { chooseGeneratedRoomMode } from '../utils/generatedRoomParameters';
import {
  formatSurvivalTime,
  gameplayReducer,
  getTimeSurvived,
  restoreGameplayState,
  type GameplayAction,
  type GameplayState,
} from '../utils/gameplayState';
import {
  canCrossRoomExit,
  coordinateToGridPosition,
  findSafeSpawn,
  getCollapsedEntrance,
} from '../utils/roomGeometry';
import { formatRoomIndicator, getNextRoom } from '../utils/roomProgression';
import { createFreshRun } from '../utils/runLifecycle';
import { useActiveRunPersistence } from './useActiveRunPersistence';
import { useAdventure } from './useAdventure';
import { useCharacterControls } from './useCharacterControls';
import { useDefeatControls } from './useDefeatControls';
import { useInvulnerabilityTimer } from './useInvulnerabilityTimer';
import { useEnemyClock } from './useEnemyClock';
import { useRoomTransition } from './useRoomTransition';
import { createRoomEnemyState, livingRats } from '../utils/enemySystem';

function rememberRoom(cache: Map<string, RoomDefinition>, room: RoomDefinition) {
  cache.delete(room.id);
  cache.set(room.id, room);
  while (cache.size > 3) cache.delete(cache.keys().next().value!);
}

export function useRunController(initialRecord: ActiveRunRecord) {
  const navigate = useNavigate();
  const { settings, playerProfile, setPlayerProfile } = useAdventure();
  const playableCharacterId = getPlayableCharacterId(initialRecord.characterId);
  const character = characters.find((item) => item.id === playableCharacterId) ?? characters[0]!;
  const [gameplay, dispatchGameplay] = useReducer(gameplayReducer, undefined, () =>
    restoreGameplayState(
      toRestorableGameplayRun(initialRecord),
      initialRecord.maximumHealth,
      Date.now(),
    ),
  );
  const [hiddenResultsRunId, setHiddenResultsRunId] = useState<string | null>(null);
  const [storageWarning, setStorageWarning] = useState(
    initialRecord.positionRepaired ? ACTIVE_RUN_POSITION_REPAIRED_WARNING : '',
  );
  const [showAwakeningComplete, setShowAwakeningComplete] = useState(false);
  const [debugProfileOverride, setDebugProfileOverride] = useState<AdaptiveProfile | null>(null);
  const [clockNow, setClockNow] = useState(Date.now);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [debugInterfaceOpen, setDebugInterfaceOpenState] = useState(false);
  const debugOpenedAtRef = useRef<number | null>(null);
  const actionSequence = useRef(0);
  const gameRegionRef = useRef<HTMLDivElement>(null);
  const archivedRunIdsRef = useRef(new Set<string>());
  const roomSnapshotsRef = useRef(new Map<string, RoomDefinition>());
  const setDebugInterfaceOpen = useCallback(
    (open: boolean) => {
      const now = Date.now();
      if (open && debugOpenedAtRef.current === null) debugOpenedAtRef.current = now;
      if (!open && debugOpenedAtRef.current !== null) {
        dispatchGameplay({
          type: 'shift-enemy-timers',
          duration: Math.max(0, now - debugOpenedAtRef.current),
        });
        debugOpenedAtRef.current = null;
      }
      setDebugInterfaceOpenState(open);
    },
    [dispatchGameplay],
  );

  const progress = gameplay.evaluationProgress;
  const generatedSave = gameplay.dungeonProgress?.currentRoom ?? null;
  const currentRoomId =
    generatedSave?.roomSnapshot.id ?? progress?.currentRoomId ?? EVALUATION_ROOM_1_ID;
  const currentRoom =
    generatedSave?.roomSnapshot ??
    getEvaluationRoom(currentRoomId, playerProfile?.shortcutUnlocked) ??
    getRoomDefinition(EVALUATION_ROOM_1_ID)!;
  rememberRoom(roomSnapshotsRef.current, currentRoom);
  const inGeneratedDungeon = Boolean(generatedSave);
  const roomLabel = inGeneratedDungeon
    ? `Dungeon Room ${generatedSave!.dungeonRoomNumber}`
    : formatRoomIndicator(currentRoom.id, progress?.currentRoomIndex ?? 0);
  const defeated = gameplay.status === 'defeated';
  const resultsVisible = defeated && hiddenResultsRunId !== gameplay.runStats.runId;
  const roomTransition = useRoomTransition({
    currentRoomId,
    runId: gameplay.runStats.runId,
    reducedMotion: settings.reducedMotion,
  });
  const renderedRoom = roomSnapshotsRef.current.get(roomTransition.renderedRoomId) ?? currentRoom;
  const livingEnemyCount = livingRats(gameplay.enemies).length;

  useEnemyClock({
    enabled: Boolean(
      gameplay.status === 'active' &&
      gameplay.enemies.rats.length > 0 &&
      !gameplay.pause.isPaused &&
      !roomTransition.isTransitioning &&
      !debugInterfaceOpen,
    ),
    room: currentRoom,
    onTick: (timestamp, room) => dispatchGameplay({ type: 'enemy-tick', timestamp, room }),
  });

  useEffect(() => {
    if (!playerProfile) {
      const recovered = createPlayerProfile(
        initialRecord.experiencePreset ?? 'seasoned-adventurer',
      );
      setPlayerProfile(recovered);
      savePlayerProfile(recovered);
    }
  }, [initialRecord.experiencePreset, playerProfile, setPlayerProfile]);

  useEffect(() => {
    if (!storageWarning) return;
    const timer = window.setTimeout(() => setStorageWarning(''), 5_000);
    return () => window.clearTimeout(timer);
  }, [storageWarning]);

  useEffect(() => {
    if (gameplay.status !== 'active' || gameplay.pause.isPaused) return;
    setClockNow(Date.now());
    const timer = window.setInterval(() => setClockNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [gameplay.pause.isPaused, gameplay.status]);

  useEffect(() => {
    const { runId, startedAt, timeSurvived, dungeonRoomsCleared, enemiesDefeated } =
      gameplay.runStats;
    if (
      gameplay.status !== 'defeated' ||
      !runId ||
      startedAt === null ||
      timeSurvived === null ||
      archivedRunIdsRef.current.has(runId)
    )
      return;
    archivedRunIdsRef.current.add(runId);
    const result = archiveCompletedRun(
      createCompletedRunRecord({
        id: runId,
        characterId: playableCharacterId,
        experiencePreset: gameplay.experiencePreset ?? 'unknown',
        endedAt: new Date(startedAt + timeSurvived + gameplay.pause.totalPausedMs).toISOString(),
        timeSurvivedMs: timeSurvived,
        dungeonRoomsCleared,
        enemiesDefeated,
      }),
    );
    if (result.issue === 'invalid') setStorageWarning(RUN_STORAGE_INVALID_WARNING);
    if (result.issue === 'unavailable' || result.issue === 'write-failed')
      setStorageWarning(RUN_STORAGE_WARNING);
  }, [
    gameplay.experiencePreset,
    gameplay.pause.totalPausedMs,
    gameplay.runStats,
    gameplay.status,
    playableCharacterId,
  ]);

  useInvulnerabilityTimer({
    status: roomTransition.isTransitioning || gameplay.pause.isPaused ? 'idle' : gameplay.status,
    expiresAt: gameplay.invulnerability.expiresAt,
    runId: gameplay.runStats.runId,
    onExpire: ({ runId, expectedExpiresAt, timestamp }) =>
      dispatchGameplay({ type: 'invulnerability-expired', runId, expectedExpiresAt, timestamp }),
  });

  const handleActiveRunIssue = useCallback(() => setStorageWarning(ACTIVE_RUN_STORAGE_WARNING), []);
  const saveNow = useActiveRunPersistence({
    gameplay,
    characterId: playableCharacterId,
    onIssue: handleActiveRunIssue,
    onSaved: setLastSavedAt,
  });
  const persistGameplayState = useCallback(
    (next: GameplayState, now: number) => {
      const record = createActiveRunRecord(next, playableCharacterId, now);
      if (!record) return false;
      const issue = saveActiveRun(record);
      if (issue) {
        setStorageWarning(ACTIVE_RUN_STORAGE_WARNING);
        return false;
      }
      setLastSavedAt(now);
      return true;
    },
    [playableCharacterId],
  );

  function nextActionId(prefix: 'move' | 'attack') {
    actionSequence.current += 1;
    return `${prefix}-${actionSequence.current}`;
  }

  function saveProfile(next: PlayerProfileRecord) {
    setPlayerProfile(next);
    if (savePlayerProfile(next)) setStorageWarning(ACTIVE_RUN_STORAGE_WARNING);
  }

  function generateDestination(
    exit: RoomExit,
    dungeonRoomNumber: number,
    profile: AdaptiveProfile,
    longTermProfile = playerProfile?.longTermProfile ?? profile,
  ) {
    const dungeon = gameplay.dungeonProgress!;
    const scheduled = chooseGeneratedRoomMode({
      runSeed: dungeon.runSeed,
      dungeonRoomNumber,
      experiencePreset: gameplay.experiencePreset!,
      previousMode: dungeon.previousMode,
      pokeCooldown: dungeon.pokeCooldown,
    });
    const effectiveProfile = getEffectiveProfile(longTermProfile, profile, dungeonRoomNumber);
    const entranceDirection = oppositeExitDirection(exit.direction);
    const generatedRoom = generateDungeonRoom({
      runSeed: dungeon.runSeed,
      dungeonRoomNumber,
      chosenExitId: exit.id,
      entranceDirection,
      experiencePreset: gameplay.experiencePreset!,
      effectiveProfile,
      mode: scheduled.mode,
    });
    rememberRoom(roomSnapshotsRef.current, generatedRoom.roomSnapshot);
    return { generatedRoom, entranceDirection, scheduled, effectiveProfile };
  }

  function commitExitTransition(exit: RoomExit) {
    if (
      !progress ||
      !gameplay.dungeonProgress ||
      gameplay.status !== 'active' ||
      gameplay.pause.isPaused ||
      roomTransition.isTransitioning
    )
      return;
    const now = Date.now();
    const exitedAtMs = getTimeSurvived(gameplay.runStats, now, gameplay.pause);
    const exitChoice =
      currentRoom.phase === 'evaluation'
        ? {
            roomId: currentRoom.id,
            roomIndex: progress.currentRoomIndex + 1,
            exitId: exit.id,
            direction: exit.direction,
            enteredAtMs: progress.roomEnteredAtMs,
            exitedAtMs,
            timeSpentMs: Math.max(0, exitedAtMs - progress.roomEnteredAtMs),
          }
        : null;
    const shortcut = exit.kind === 'shortcut';
    const completingChambers =
      currentRoom.phase === 'evaluation' && progress.currentRoomIndex === 4;

    let action: GameplayAction;
    if (currentRoom.phase === 'dungeon' || shortcut || completingChambers) {
      const nextNumber =
        currentRoom.phase === 'dungeon' ? gameplay.dungeonProgress.dungeonRoomNumber + 1 : 1;
      const profilePreviewAction: GameplayAction = {
        type: 'commit-room-transition',
        destinationRoomId: currentRoom.id,
        destinationRoomIndex: progress.currentRoomIndex,
        destinationSpawn: gameplay.player.position,
        enteredFrom: progress.enteredFrom ?? 'west',
        exitedAtMs,
        exitChoice,
        evaluationComplete: progress.evaluationComplete,
        exitDirection: exit.direction,
      };
      const profileForRoom =
        debugProfileOverride ??
        gameplayReducer(gameplay, profilePreviewAction).adaptation.currentRunProfile;
      const updatedLongTerm = playerProfile
        ? updateLongTermProfile(playerProfile.longTermProfile, profileForRoom)
        : profileForRoom;
      const { generatedRoom, entranceDirection, scheduled, effectiveProfile } = generateDestination(
        exit,
        nextNumber,
        profileForRoom,
        updatedLongTerm,
      );
      action = {
        type: 'commit-room-transition',
        destinationRoomId: generatedRoom.roomSnapshot.id,
        destinationRoomIndex: 5,
        destinationSpawn: coordinateToGridPosition(
          findSafeSpawn(generatedRoom.roomSnapshot, entranceDirection),
        ),
        enteredFrom: entranceDirection,
        exitedAtMs,
        exitChoice,
        evaluationComplete: true,
        generatedRoom,
        incrementDungeonRooms: currentRoom.phase === 'dungeon',
        chosenExitId: exit.id,
        nextPokeCooldown: scheduled.nextPokeCooldown,
        nextMode: scheduled.mode,
        exitDirection: exit.direction,
        effectiveProfile,
        enemies: createRoomEnemyState(
          generatedRoom.roomSnapshot,
          gameplay.experiencePreset!,
          now,
          generatedRoom.details.enemyCountPlan ?? null,
        ),
      };
    } else {
      const next = getNextRoom(progress.roomOrder, progress.currentRoomIndex);
      if (!next || next.evaluationComplete) return;
      const destination = getEvaluationRoom(next.roomId, playerProfile?.shortcutUnlocked);
      if (!destination) return;
      rememberRoom(roomSnapshotsRef.current, destination);
      action = {
        type: 'commit-room-transition',
        destinationRoomId: destination.id,
        destinationRoomIndex: next.roomIndex,
        destinationSpawn: coordinateToGridPosition(findSafeSpawn(destination, 'west')),
        enteredFrom: 'west',
        exitedAtMs,
        exitChoice,
        evaluationComplete: false,
        exitDirection: exit.direction,
        enemies: createRoomEnemyState(destination, gameplay.experiencePreset!, now),
      };
    }

    const nextGameplay = gameplayReducer(gameplay, action);
    if (completingChambers && playerProfile) {
      saveProfile({
        ...playerProfile,
        shortcutUnlocked: true,
        longTermProfile: updateLongTermProfile(
          playerProfile.longTermProfile,
          nextGameplay.adaptation.currentRunProfile,
        ),
        metadata: {
          completedAdaptiveRooms: playerProfile.metadata.completedAdaptiveRooms,
          updatedAt: new Date().toISOString(),
        },
      });
    } else if (currentRoom.phase === 'dungeon' && playerProfile) {
      saveProfile({
        ...playerProfile,
        longTermProfile: updateLongTermProfile(
          playerProfile.longTermProfile,
          nextGameplay.adaptation.currentRunProfile,
        ),
        metadata: {
          completedAdaptiveRooms: playerProfile.metadata.completedAdaptiveRooms + 1,
          updatedAt: new Date().toISOString(),
        },
      });
    }
    roomTransition.beginTransition({
      destinationRoomId: action.destinationRoomId,
      commit: () => {
        dispatchGameplay(action);
        persistGameplayState(nextGameplay, now);
        if (completingChambers) setShowAwakeningComplete(true);
      },
    });
  }

  const controls = useCharacterControls({
    enabled: Boolean(
      gameplay.status === 'active' &&
      !gameplay.pause.isPaused &&
      !roomTransition.isTransitioning &&
      !debugInterfaceOpen,
    ),
    onMove: (direction, trigger) => {
      const exit = canCrossRoomExit(
        currentRoom,
        gameplay.player.position,
        direction,
        livingEnemyCount,
      );
      if (exit) commitExitTransition(exit);
      else
        dispatchGameplay({
          type: 'move',
          direction,
          trigger,
          id: nextActionId('move'),
          timestamp: Date.now(),
          room: currentRoom,
        });
    },
    onTurn: (direction, trigger) =>
      dispatchGameplay({ type: 'turn', direction, trigger, timestamp: Date.now() }),
    onAttack: () => {
      const timestamp = Date.now();
      if (gameplay.attackCooldown.readyAt !== null && timestamp < gameplay.attackCooldown.readyAt)
        return false;
      dispatchGameplay({
        type: 'attack',
        id: nextActionId('attack'),
        timestamp,
        room: currentRoom,
      });
      return true;
    },
    onShieldChange: (isShielding) =>
      dispatchGameplay({ type: 'shield', isShielding, timestamp: Date.now() }),
  });

  const restartRun = useCallback(() => {
    const preset = gameplay.experiencePreset ?? playerProfile?.experiencePreset;
    if (!preset) {
      clearActiveRun();
      navigate('/dungeon', { replace: true });
      return;
    }
    const now = Date.now();
    const next = createFreshRun({
      maximumHealth: character.health,
      experiencePreset: preset,
      longTermProfile: playerProfile?.longTermProfile,
      shortcutUnlocked: playerProfile?.shortcutUnlocked,
      startedAt: now,
    });
    actionSequence.current = 0;
    setHiddenResultsRunId(null);
    setShowAwakeningComplete(false);
    setDebugProfileOverride(null);
    dispatchGameplay({
      type: 'start-run',
      maximumHealth: next.maximumHealth,
      startedAt: next.runStats.startedAt!,
      runId: next.runStats.runId!,
      runSeed: next.dungeonProgress!.runSeed,
      experiencePreset: preset,
      longTermProfile: playerProfile?.longTermProfile,
      roomOrder: next.evaluationProgress!.roomOrder,
      currentRoomId: next.evaluationProgress!.currentRoomId,
      spawn: next.player.position,
    });
    persistGameplayState(next, now);
  }, [character.health, gameplay.experiencePreset, navigate, persistGameplayState, playerProfile]);

  const toggleResults = useCallback(
    () =>
      setHiddenResultsRunId((current) =>
        current === gameplay.runStats.runId ? null : gameplay.runStats.runId,
      ),
    [gameplay.runStats.runId],
  );
  useDefeatControls({
    defeated,
    gameRegionRef,
    onRestart: restartRun,
    onToggleResults: toggleResults,
  });

  const pauseRun = useCallback(() => {
    if (gameplay.status !== 'active' || gameplay.pause.isPaused || roomTransition.isTransitioning)
      return false;
    const now = Date.now();
    const action: GameplayAction = { type: 'pause-run', timestamp: now, reason: 'pause-menu' };
    const next = gameplayReducer(gameplay, action);
    dispatchGameplay(action);
    persistGameplayState(next, now);
    setClockNow(now);
    return true;
  }, [gameplay, persistGameplayState, roomTransition.isTransitioning]);

  const resumeRun = useCallback(() => {
    if (gameplay.status !== 'active' || !gameplay.pause.isPaused) return false;
    const now = Date.now();
    const action: GameplayAction = { type: 'resume-run', timestamp: now };
    const next = gameplayReducer(gameplay, action);
    dispatchGameplay(action);
    persistGameplayState(next, now);
    setClockNow(now);
    return true;
  }, [gameplay, persistGameplayState]);

  const openSettings = useCallback(() => {
    saveNow();
    navigate('/settings');
  }, [navigate, saveNow]);

  const returnToMainMenuPreservingRun = useCallback(() => {
    saveNow();
    navigate('/');
  }, [navigate, saveNow]);

  const returnToMainMenuAfterDefeat = useCallback(() => {
    clearActiveRun();
    navigate('/');
  }, [navigate]);

  const frozenTime = formatSurvivalTime(
    getTimeSurvived(gameplay.runStats, clockNow, gameplay.pause),
  );
  const renderedHazards: GridPosition[] = (renderedRoom.hazards ?? []).map(
    coordinateToGridPosition,
  );
  const collapsedEntrance = getCollapsedEntrance(
    renderedRoom,
    generatedSave?.details.entranceDirection ?? progress?.enteredFrom ?? 'west',
  );

  return {
    gameplay,
    character,
    currentRoom,
    renderedRoom,
    renderedHazards,
    collapsedEntrance,
    roomLabel,
    inGeneratedDungeon,
    defeated,
    resultsVisible,
    roomTransition,
    controls,
    gameRegionRef,
    storageWarning,
    clearStorageWarning: () => setStorageWarning(''),
    setDebugInterfaceOpen,
    showAwakeningComplete,
    hideAwakeningComplete: () => setShowAwakeningComplete(false),
    frozenTime,
    lastSavedMessage: lastSavedAt !== null && !storageWarning ? 'Run saved' : undefined,
    pauseRun,
    resumeRun,
    openSettings,
    returnToMainMenuPreservingRun,
    restartRun,
    gameOverProps: {
      characterName: character.role.replace(/^The /, ''),
      timeSurvived: frozenTime,
      roomsCleared: gameplay.runStats.dungeonRoomsCleared,
      enemiesDefeated: gameplay.runStats.enemiesDefeated,
      onHide: () => setHiddenResultsRunId(gameplay.runStats.runId),
      onReopen: () => setHiddenResultsRunId(null),
      onRestart: restartRun,
      onMainMenu: returnToMainMenuAfterDefeat,
    },
    debug: playerProfile && {
      longTermProfile: playerProfile.longTermProfile,
      storageDiagnostics: getStorageDiagnostics(gameplay, playableCharacterId, clockNow),
      onAdvance: () => {
        if (livingEnemyCount > 0) return;
        const exit = currentRoom.exits.find((candidate) => candidate.enabled);
        if (exit) commitExitTransition(exit);
      },
      livingEnemyCount,
      enemies: gameplay.enemies,
      onSpawnRat: () =>
        dispatchGameplay({ type: 'debug-spawn-rat', timestamp: Date.now(), room: currentRoom }),
      onDefeatAllEnemies: () =>
        dispatchGameplay({ type: 'debug-defeat-all-enemies', timestamp: Date.now() }),
      onFreezeEnemyAi: (frozen: boolean) =>
        dispatchGameplay({ type: 'debug-freeze-enemy-ai', frozen }),
      onTemporaryOverride: (profile: AdaptiveProfile) => {
        setDebugProfileOverride(profile);
        dispatchGameplay({ type: 'apply-debug-profile', profile });
      },
      onClearOverrides: () => {
        setDebugProfileOverride(null);
        dispatchGameplay({
          type: 'apply-debug-profile',
          profile: gameplay.adaptation.currentRunProfile,
        });
      },
      onApplyOverrides: (profile: AdaptiveProfile) =>
        saveProfile({
          ...playerProfile,
          longTermProfile: profile,
          metadata: { ...playerProfile.metadata, updatedAt: new Date().toISOString() },
        }),
    },
  };
}
