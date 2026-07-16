import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DebugTools } from '../components/mirrorvault/DebugTools';
import { DungeonGrid } from '../components/mirrorvault/DungeonGrid';
import { EvaluationCompleteText } from '../components/mirrorvault/EvaluationCompleteText';
import { ExperienceChoice } from '../components/mirrorvault/ExperienceChoice';
import { GameOverResults } from '../components/mirrorvault/GameOverResults';
import { RoomStatus } from '../components/mirrorvault/RoomStatus';
import { RunSetup } from '../components/mirrorvault/RunSetup';
import { StatusPanel } from '../components/mirrorvault/StatusPanel';
import {
  ACTIVE_RUN_INVALID_WARNING,
  ACTIVE_RUN_STORAGE_WARNING,
  RUN_STORAGE_INVALID_WARNING,
  RUN_STORAGE_WARNING,
  StorageWarning,
} from '../components/mirrorvault/StorageWarning';
import { StoryPanel } from '../components/mirrorvault/StoryPanel';
import { getPlayableCharacterId } from '../data/characterAvailability';
import { getRoomDefinition } from '../data/rooms';
import { EVALUATION_ROOM_1_ID, getEvaluationRoom } from '../data/rooms/evaluationRooms';
import { useActiveRunPersistence } from '../hooks/useActiveRunPersistence';
import { useAdventure } from '../hooks/useAdventure';
import { useCharacterControls } from '../hooks/useCharacterControls';
import { useDefeatControls } from '../hooks/useDefeatControls';
import { useInvulnerabilityTimer } from '../hooks/useInvulnerabilityTimer';
import { useRoomTransition } from '../hooks/useRoomTransition';
import { api } from '../services/api';
import {
  clearActiveRun,
  createActiveRunRecord,
  loadActiveRun,
  saveActiveRun,
  toRestorableGameplayRun,
} from '../services/activeRunStorage';
import { characters, getMockAdventure } from '../services/mockAdventureService';
import { createPlayerProfile, savePlayerProfile } from '../services/playerProfileStorage';
import { archiveCompletedRun, createCompletedRunRecord } from '../services/runArchive';
import type { AdaptiveProfile, ExperiencePreset, PlayerProfileRecord } from '../types/adaptation';
import type { DungeonConfig } from '../types/adventure';
import type { GridPosition } from '../types/player';
import type { RoomDefinition, RoomExit } from '../types/rooms';
import { getEffectiveProfile, updateLongTermProfile } from '../utils/adaptiveProfile';
import { generateDungeonRoom, oppositeExitDirection } from '../utils/generatedRoomGenerator';
import { chooseGeneratedRoomMode } from '../utils/generatedRoomParameters';
import {
  createGameplayState,
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
  roomBounds,
} from '../utils/roomGeometry';
import {
  createEvaluationRoomOrder,
  formatRoomIndicator,
  getNextRoom,
} from '../utils/roomProgression';

type RunFlow = 'experience-choice' | 'run-setup' | 'playing';
interface GameplayInitializer {
  maximumHealth: number;
  restoredRun: ReturnType<typeof loadActiveRun>['record'];
}
function initializeGameplay({ maximumHealth, restoredRun }: GameplayInitializer): GameplayState {
  return restoredRun
    ? restoreGameplayState(toRestorableGameplayRun(restoredRun), maximumHealth, Date.now())
    : createGameplayState(maximumHealth);
}

export function DungeonPage() {
  const navigate = useNavigate();
  const { characterId, settings, playerProfile, setPlayerProfile } = useAdventure();
  const [initialActiveRun] = useState(loadActiveRun);
  const playableCharacterId = getPlayableCharacterId(
    initialActiveRun.record?.characterId ?? characterId,
  );
  const character = characters.find((item) => item.id === playableCharacterId) ?? characters[0]!;
  const [selectedPreset, setSelectedPreset] = useState<ExperiencePreset | null>(
    initialActiveRun.record?.experiencePreset ?? playerProfile?.experiencePreset ?? null,
  );
  const [flow, setFlow] = useState<RunFlow>(
    initialActiveRun.record
      ? 'playing'
      : playerProfile?.firstTimeComplete
        ? 'run-setup'
        : 'experience-choice',
  );
  const [config, setConfig] = useState<DungeonConfig>({
    experience: selectedPreset ?? 'seasoned-adventurer',
    challenge: 'balanced',
    playstyle: 'balanced',
    mode: 'adaptive',
    characterId: playableCharacterId,
  });
  const [gameplay, dispatchGameplay] = useReducer(
    gameplayReducer,
    { maximumHealth: character.health, restoredRun: initialActiveRun.record },
    initializeGameplay,
  );
  const [hiddenResultsRunId, setHiddenResultsRunId] = useState<string | null>(null);
  const [storageWarning, setStorageWarning] = useState(
    initialActiveRun.issue === 'invalid'
      ? ACTIVE_RUN_INVALID_WARNING
      : initialActiveRun.issue === 'unavailable'
        ? ACTIVE_RUN_STORAGE_WARNING
        : '',
  );
  const [showEvaluationComplete, setShowEvaluationComplete] = useState(false);
  const [debugProfileOverride, setDebugProfileOverride] = useState<AdaptiveProfile | null>(null);
  const actionSequence = useRef(0);
  const gameRegionRef = useRef<HTMLDivElement>(null);
  const archivedRunIdsRef = useRef(new Set<string>());
  const roomSnapshotsRef = useRef(new Map<string, RoomDefinition>());

  const progress = gameplay.evaluationProgress;
  const generatedSave = gameplay.dungeonProgress?.currentRoom ?? null;
  const currentRoomId =
    generatedSave?.roomSnapshot.id ?? progress?.currentRoomId ?? EVALUATION_ROOM_1_ID;
  const currentRoom =
    generatedSave?.roomSnapshot ??
    getEvaluationRoom(currentRoomId, playerProfile?.shortcutUnlocked) ??
    getRoomDefinition(EVALUATION_ROOM_1_ID)!;
  roomSnapshotsRef.current.set(currentRoom.id, currentRoom);
  const inGeneratedDungeon = Boolean(generatedSave);
  const roomLabel = inGeneratedDungeon
    ? `Dungeon Room ${generatedSave!.dungeonRoomNumber}`
    : formatRoomIndicator(currentRoom.id, progress?.currentRoomIndex ?? 0);
  const defeated = gameplay.status === 'defeated';
  const resultsVisible = defeated && hiddenResultsRunId !== gameplay.runStats.runId;
  const scene =
    gameplay.status === 'idle'
      ? null
      : getMockAdventure(config, Math.min(progress?.currentRoomIndex ?? 0, 4));
  const roomTransition = useRoomTransition({
    currentRoomId,
    runId: gameplay.runStats.runId,
    reducedMotion: settings.reducedMotion,
  });
  const renderedRoom = roomSnapshotsRef.current.get(roomTransition.renderedRoomId) ?? currentRoom;

  useEffect(() => {
    if (!playerProfile && initialActiveRun.record?.experiencePreset) {
      const recovered = createPlayerProfile(initialActiveRun.record.experiencePreset);
      setPlayerProfile(recovered);
      savePlayerProfile(recovered);
    }
  }, [initialActiveRun.record, playerProfile, setPlayerProfile]);

  useEffect(() => {
    if (!storageWarning) return;
    const timer = window.setTimeout(() => setStorageWarning(''), 5_000);
    return () => window.clearTimeout(timer);
  }, [storageWarning]);
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
        endedAt: new Date(startedAt + timeSurvived).toISOString(),
        timeSurvivedMs: timeSurvived,
        dungeonRoomsCleared,
        enemiesDefeated,
      }),
    );
    if (result.issue === 'invalid') setStorageWarning(RUN_STORAGE_INVALID_WARNING);
    if (result.issue === 'unavailable' || result.issue === 'write-failed')
      setStorageWarning(RUN_STORAGE_WARNING);
  }, [gameplay.experiencePreset, gameplay.runStats, gameplay.status, playableCharacterId]);

  useInvulnerabilityTimer({
    status: roomTransition.isTransitioning ? 'idle' : gameplay.status,
    expiresAt: gameplay.invulnerability.expiresAt,
    runId: gameplay.runStats.runId,
    onExpire: ({ runId, expectedExpiresAt, timestamp }) =>
      dispatchGameplay({ type: 'invulnerability-expired', runId, expectedExpiresAt, timestamp }),
  });
  const handleActiveRunIssue = useCallback(() => setStorageWarning(ACTIVE_RUN_STORAGE_WARNING), []);
  useActiveRunPersistence({
    gameplay,
    characterId: playableCharacterId,
    onIssue: handleActiveRunIssue,
  });
  const persistGameplayState = useCallback(
    (next: GameplayState, now: number) => {
      const record = createActiveRunRecord(next, playableCharacterId, now);
      if (record && saveActiveRun(record)) setStorageWarning(ACTIVE_RUN_STORAGE_WARNING);
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
    roomSnapshotsRef.current.set(generatedRoom.roomSnapshot.id, generatedRoom.roomSnapshot);
    return { generatedRoom, entranceDirection, scheduled, effectiveProfile };
  }

  function commitExitTransition(exit: RoomExit) {
    if (!progress || !gameplay.dungeonProgress || gameplay.status !== 'active') return;
    const now = Date.now();
    const exitedAtMs = getTimeSurvived(gameplay.runStats, now);
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
      };
    } else {
      const next = getNextRoom(progress.roomOrder, progress.currentRoomIndex);
      if (!next || next.evaluationComplete) return;
      const destination = getEvaluationRoom(next.roomId, playerProfile?.shortcutUnlocked);
      if (!destination) return;
      roomSnapshotsRef.current.set(destination.id, destination);
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
        if (completingChambers) setShowEvaluationComplete(true);
      },
    });
  }

  const controls = useCharacterControls({
    enabled: Boolean(scene && gameplay.status === 'active' && !roomTransition.isTransitioning),
    onMove: (direction, trigger) => {
      const exit = canCrossRoomExit(currentRoom, gameplay.player.position, direction);
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
    onAttack: () =>
      dispatchGameplay({
        type: 'attack',
        id: nextActionId('attack'),
        timestamp: Date.now(),
        room: currentRoom,
      }),
    onShieldChange: (isShielding) =>
      dispatchGameplay({ type: 'shield', isShielding, timestamp: Date.now() }),
  });

  const restartRun = useCallback(() => {
    const preset = selectedPreset ?? playerProfile?.experiencePreset;
    if (!preset) {
      setFlow('experience-choice');
      return;
    }
    const now = Date.now();
    const roomOrder = createEvaluationRoomOrder();
    const firstRoom = getEvaluationRoom(roomOrder[0]!, playerProfile?.shortcutUnlocked)!;
    const action: GameplayAction = {
      type: 'start-run',
      maximumHealth: character.health,
      startedAt: now,
      runId: crypto.randomUUID(),
      runSeed: crypto.randomUUID(),
      experiencePreset: preset,
      longTermProfile: playerProfile?.longTermProfile,
      roomOrder,
      currentRoomId: firstRoom.id,
      spawn: coordinateToGridPosition(findSafeSpawn(firstRoom, 'west')),
    };
    const next = gameplayReducer(gameplay, action);
    actionSequence.current = 0;
    setHiddenResultsRunId(null);
    setShowEvaluationComplete(false);
    setDebugProfileOverride(null);
    setFlow('playing');
    dispatchGameplay(action);
    persistGameplayState(next, now);
  }, [character.health, gameplay, persistGameplayState, playerProfile, selectedPreset]);
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

  function chooseExperience(preset: ExperiencePreset) {
    const profile = createPlayerProfile(preset);
    saveProfile(profile);
    setSelectedPreset(preset);
    setConfig((current) => ({ ...current, experience: preset }));
    setFlow('run-setup');
  }
  function begin() {
    if (!selectedPreset) return;
    const activeConfig = {
      ...config,
      experience: selectedPreset,
      characterId: playableCharacterId,
    };
    setConfig(activeConfig);
    void api.createAdventure(activeConfig).catch(() => undefined);
    restartRun();
  }
  function returnToMainMenu() {
    clearActiveRun();
    setHiddenResultsRunId(null);
    setShowEvaluationComplete(false);
    dispatchGameplay({ type: 'reset-to-idle', maximumHealth: character.health });
    navigate('/');
  }

  const frozenTime = formatSurvivalTime(getTimeSurvived(gameplay.runStats, Date.now()));
  const gameOverProps = {
    characterName: character.role.replace(/^The /, ''),
    timeSurvived: frozenTime,
    roomsCleared: gameplay.runStats.dungeonRoomsCleared,
    enemiesDefeated: gameplay.runStats.enemiesDefeated,
    onHide: () => setHiddenResultsRunId(gameplay.runStats.runId),
    onReopen: () => setHiddenResultsRunId(null),
    onRestart: restartRun,
    onMainMenu: returnToMainMenu,
  };
  const renderedHazards: GridPosition[] = (renderedRoom.hazards ?? []).map(
    coordinateToGridPosition,
  );
  const collapsedEntrance = getCollapsedEntrance(
    renderedRoom,
    generatedSave?.details.entranceDirection ?? progress?.enteredFrom ?? 'west',
  );
  const hideEvaluationComplete = useCallback(() => setShowEvaluationComplete(false), []);

  return (
    <div className="dungeon-page">
      <header className="dungeon-heading">
        <p className="eyebrow">01 / Live prototype</p>
        <h1>Enter the experiment</h1>
        <p>Everything here is mock and local. No real AI service is being used.</p>
      </header>
      {flow === 'experience-choice' && (
        <ExperienceChoice initialValue={selectedPreset} onContinue={chooseExperience} />
      )}
      {flow === 'run-setup' && selectedPreset && (
        <RunSetup experiencePreset={selectedPreset} onDelve={begin} />
      )}
      {flow === 'playing' && scene && (
        <>
          <RoomStatus label={roomLabel} />
          <StatusPanel
            roomLabel={roomLabel}
            mode={config.mode}
            character={character.name}
            currentHealth={gameplay.currentHealth}
            maximumHealth={gameplay.maximumHealth}
            isInvulnerable={
              roomTransition.isTransitioning || gameplay.invulnerability.expiresAt !== null
            }
            isDefeated={defeated}
            dungeonRoomsCleared={
              inGeneratedDungeon ? gameplay.runStats.dungeonRoomsCleared : undefined
            }
          />
          {storageWarning && (
            <StorageWarning message={storageWarning} onDismiss={() => setStorageWarning('')} />
          )}
          <div className="game-over-region" ref={gameRegionRef}>
            {defeated && !resultsVisible && <GameOverResults visible={false} {...gameOverProps} />}
            <div className="game-layout">
              <section
                className="game-board-panel"
                data-game-status={gameplay.status}
                data-room-id={currentRoom.id}
                data-survival-time={frozenTime}
              >
                <div className="chamber-label">
                  <span>{roomLabel}</span>
                  <span>{inGeneratedDungeon ? 'Dungeon active' : 'Awakening active'}</span>
                </div>
                <DungeonGrid
                  bounds={roomBounds(renderedRoom)}
                  hazards={renderedHazards}
                  room={renderedRoom}
                  collapsedEntrance={collapsedEntrance}
                  hidePlayer={roomTransition.phase === 'fading-out'}
                  player={gameplay.player}
                  status={gameplay.status}
                  isInvulnerable={
                    roomTransition.isTransitioning || gameplay.invulnerability.expiresAt !== null
                  }
                  blockedMove={gameplay.blockedMove}
                  lastAttack={gameplay.lastAttack}
                  lastDamage={gameplay.lastDamage}
                  lastAvoidedDamage={gameplay.lastAvoidedDamage}
                  announcement={gameplay.announcement}
                  controlsDisabled={gameplay.status !== 'active' || roomTransition.isTransitioning}
                  onMove={controls.move}
                  onAttack={controls.attack}
                  onShieldChange={controls.setPointerShielding}
                />
                {roomTransition.phase !== 'idle' && (
                  <div
                    className={`room-transition room-transition--${roomTransition.phase}`}
                    aria-hidden="true"
                  />
                )}
                {showEvaluationComplete && (
                  <EvaluationCompleteText onFinished={hideEvaluationComplete} />
                )}
                {defeated && resultsVisible && <GameOverResults visible {...gameOverProps} />}
              </section>
              <StoryPanel scene={scene} onChoose={() => undefined} />
            </div>
          </div>
          {import.meta.env.DEV && playerProfile && (
            <DebugTools
              gameplay={gameplay}
              longTermProfile={playerProfile.longTermProfile}
              onAdvance={() =>
                currentRoom.exits.find((exit) => exit.enabled) &&
                commitExitTransition(currentRoom.exits.find((exit) => exit.enabled)!)
              }
              onTemporaryOverride={(profile) => {
                setDebugProfileOverride(profile);
                dispatchGameplay({ type: 'apply-debug-profile', profile });
              }}
              onClearOverrides={() => {
                setDebugProfileOverride(null);
                dispatchGameplay({
                  type: 'apply-debug-profile',
                  profile: gameplay.adaptation.currentRunProfile,
                });
              }}
              onApplyOverrides={(profile) =>
                saveProfile({
                  ...playerProfile,
                  longTermProfile: profile,
                  metadata: { ...playerProfile.metadata, updatedAt: new Date().toISOString() },
                })
              }
            />
          )}
        </>
      )}
    </div>
  );
}
