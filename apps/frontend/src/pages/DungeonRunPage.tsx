import { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { DebugDrawer } from '../components/mirrorvault/DebugDrawer';
import { DungeonGrid } from '../components/mirrorvault/DungeonGrid';
import { AwakeningCompleteText } from '../components/mirrorvault/AwakeningCompleteText';
import { GameOverResults } from '../components/mirrorvault/GameOverResults';
import { GameShell } from '../components/mirrorvault/GameShell';
import { PauseMenu } from '../components/mirrorvault/PauseMenu';
import { RoomStatus } from '../components/mirrorvault/RoomStatus';
import { StatusPanel } from '../components/mirrorvault/StatusPanel';
import { StorageWarning } from '../components/mirrorvault/StorageWarning';
import { useRunController } from '../hooks/useRunController';
import { loadActiveRun, type ActiveRunRecord } from '../services/activeRunStorage';
import { roomBounds } from '../utils/roomGeometry';

export function DungeonRunPage() {
  const [initialRun] = useState(loadActiveRun);
  if (!initialRun.record) return <Navigate to="/dungeon" replace />;
  return <DungeonRunSession initialRecord={initialRun.record} />;
}

function DungeonRunSession({ initialRecord }: { initialRecord: ActiveRunRecord }) {
  const run = useRunController(initialRecord);
  const [debugOpen, setDebugOpen] = useState(false);
  const pauseButtonRef = useRef<HTMLButtonElement>(null);
  const debugButtonRef = useRef<HTMLButtonElement>(null);
  const paused = run.gameplay.pause.isPaused;
  const { defeated, pauseRun, setDebugInterfaceOpen } = run;

  useEffect(() => {
    if (paused || defeated) setDebugOpen(false);
  }, [defeated, paused]);

  useEffect(() => {
    setDebugInterfaceOpen(debugOpen);
  }, [debugOpen, setDebugInterfaceOpen]);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.code !== 'Escape' || event.repeat || event.defaultPrevented || paused || defeated)
        return;
      event.preventDefault();
      if (debugOpen) setDebugOpen(false);
      else pauseRun();
    }
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [debugOpen, defeated, paused, pauseRun]);

  const isInvulnerable =
    run.roomTransition.isTransitioning || run.gameplay.invulnerability.expiresAt !== null;
  const controlsDisabled =
    run.gameplay.status !== 'active' || paused || run.roomTransition.isTransitioning || debugOpen;
  const enemiesRemaining = run.gameplay.enemies.rats.filter(
    (rat) => rat.health > 0 && rat.state !== 'corpse',
  ).length;

  return (
    <GameShell
      showDebug={Boolean(import.meta.env.DEV && run.debug)}
      debugOpen={debugOpen}
      debugButtonRef={debugButtonRef}
      onDebug={() => setDebugOpen((current) => !current)}
      pauseDisabled={run.defeated || paused || run.roomTransition.isTransitioning}
      pauseButtonRef={pauseButtonRef}
      onPause={run.pauseRun}
    >
      <RoomStatus label={run.roomLabel} />
      <StatusPanel
        roomLabel={run.roomLabel}
        mode="Exploring"
        character={run.character.name}
        currentHealth={run.gameplay.currentHealth}
        maximumHealth={run.gameplay.maximumHealth}
        isInvulnerable={isInvulnerable}
        isDefeated={run.defeated}
        dungeonRoomsCleared={
          run.inGeneratedDungeon ? run.gameplay.runStats.dungeonRoomsCleared : undefined
        }
        enemiesRemaining={
          run.gameplay.enemies.rats.length > 0 || run.currentRoom.enemySpawns?.length
            ? enemiesRemaining
            : undefined
        }
      />
      {run.storageWarning && (
        <StorageWarning message={run.storageWarning} onDismiss={run.clearStorageWarning} />
      )}
      <div className="game-run-region game-over-region" ref={run.gameRegionRef}>
        {run.defeated && !run.resultsVisible && (
          <GameOverResults visible={false} {...run.gameOverProps} />
        )}
        <section
          className="game-board-panel"
          data-game-status={run.gameplay.status}
          data-paused={paused}
          data-room-id={run.currentRoom.id}
          data-survival-time={run.frozenTime}
        >
          <div className="chamber-label">
            <span>{run.roomLabel}</span>
            <span>{run.inGeneratedDungeon ? 'Dungeon active' : 'Awakening active'}</span>
          </div>
          <DungeonGrid
            bounds={roomBounds(run.renderedRoom)}
            hazards={run.renderedHazards}
            room={run.renderedRoom}
            collapsedEntrance={run.collapsedEntrance}
            hidePlayer={run.roomTransition.phase === 'fading-out'}
            player={run.gameplay.player}
            status={run.gameplay.status}
            isInvulnerable={isInvulnerable}
            blockedMove={run.gameplay.blockedMove}
            lastAttack={run.gameplay.lastAttack}
            lastDamage={run.gameplay.lastDamage}
            lastAvoidedDamage={run.gameplay.lastAvoidedDamage}
            announcement={run.gameplay.announcement}
            controlsDisabled={controlsDisabled}
            onMove={run.controls.move}
            onAttack={run.controls.attack}
            onShieldChange={run.controls.setPointerShielding}
            enemies={run.gameplay.enemies}
            exitsSealed={enemiesRemaining > 0}
          />
          {run.gameplay.currentHealth === 1 && !run.defeated && (
            <div className="low-health-vignette" aria-hidden="true" />
          )}
          {run.roomTransition.phase !== 'idle' && (
            <div
              className={`room-transition room-transition--${run.roomTransition.phase}`}
              aria-hidden="true"
            />
          )}
          {run.showAwakeningComplete && (
            <AwakeningCompleteText onFinished={run.hideAwakeningComplete} />
          )}
          {run.defeated && run.resultsVisible && <GameOverResults visible {...run.gameOverProps} />}
        </section>
      </div>
      <PauseMenu
        open={paused}
        pauseButtonRef={pauseButtonRef}
        savedMessage={run.lastSavedMessage}
        onResume={run.resumeRun}
        onSettings={run.openSettings}
        onRestart={run.restartRun}
        onMainMenu={run.returnToMainMenuPreservingRun}
      />
      {import.meta.env.DEV && run.debug && (
        <DebugDrawer
          open={debugOpen}
          triggerRef={debugButtonRef}
          onClose={() => setDebugOpen(false)}
          debugToolsProps={{ gameplay: run.gameplay, ...run.debug }}
        />
      )}
    </GameShell>
  );
}
