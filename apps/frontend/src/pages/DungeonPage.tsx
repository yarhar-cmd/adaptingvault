import { useReducer, useRef, useState } from 'react';
import { ErrorState, LoadingState } from '../components/common/States';
import { PrimaryButton, SecondaryButton } from '../components/common/Buttons';
import { DungeonGrid } from '../components/mirrorvault/DungeonGrid';
import { DungeonSetupForm } from '../components/mirrorvault/DungeonSetupForm';
import { StatusPanel } from '../components/mirrorvault/StatusPanel';
import { StoryPanel } from '../components/mirrorvault/StoryPanel';
import { getPlayableCharacterId } from '../data/characterAvailability';
import { CURRENT_ROOM_LAYOUT } from '../data/roomLayout';
import { useAdventure } from '../hooks/useAdventure';
import { useCharacterControls } from '../hooks/useCharacterControls';
import { useInvulnerabilityTimer } from '../hooks/useInvulnerabilityTimer';
import { api } from '../services/api';
import { characters, createMockAdventure, makeRunRecord } from '../services/mockAdventureService';
import { saveRun } from '../services/storage';
import type { AdventureScene, DungeonConfig } from '../types/adventure';
import {
  createGameplayState,
  formatSurvivalTime,
  gameplayReducer,
  getTimeSurvived,
} from '../utils/gameplayState';

export function DungeonPage() {
  const { characterId } = useAdventure();
  const playableCharacterId = getPlayableCharacterId(characterId);
  const character = characters.find((item) => item.id === playableCharacterId) ?? characters[0]!;
  const [config, setConfig] = useState<DungeonConfig>({
    experience: 'occasional',
    challenge: 'balanced',
    playstyle: 'balanced',
    mode: 'adaptive',
    characterId: playableCharacterId,
  });
  const [scene, setScene] = useState<AdventureScene | null>(null);
  const [room, setRoom] = useState(0);
  const [decisions, setDecisions] = useState<string[]>([]);
  const [gameplay, dispatchGameplay] = useReducer(
    gameplayReducer,
    character.health,
    createGameplayState,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [complete, setComplete] = useState(false);
  const actionSequence = useRef(0);
  const runSequence = useRef(0);

  useInvulnerabilityTimer({
    status: gameplay.status,
    expiresAt: gameplay.invulnerability.expiresAt,
    runId: gameplay.runStats.runId,
    onExpire: ({ runId, expectedExpiresAt, timestamp }) => {
      dispatchGameplay({
        type: 'invulnerability-expired',
        runId,
        expectedExpiresAt,
        timestamp,
      });
    },
  });

  function nextActionId(prefix: 'move' | 'attack') {
    actionSequence.current += 1;
    return `${prefix}-${actionSequence.current}`;
  }

  const controls = useCharacterControls({
    enabled: Boolean(scene && !loading && gameplay.status === 'active'),
    onMove: (direction, trigger) => {
      dispatchGameplay({
        type: 'move',
        direction,
        trigger,
        id: nextActionId('move'),
        timestamp: Date.now(),
        hazards: CURRENT_ROOM_LAYOUT.hazards,
      });
    },
    onTurn: (direction, trigger) => {
      dispatchGameplay({ type: 'turn', direction, trigger });
    },
    onAttack: () => {
      dispatchGameplay({ type: 'attack', id: nextActionId('attack'), timestamp: Date.now() });
      setDecisions((items) => [...items, 'Attacked']);
    },
    onShieldChange: (isShielding) => dispatchGameplay({ type: 'shield', isShielding }),
  });

  async function loadRoom(index: number, activeConfig = config, isNewRun = false) {
    if (!isNewRun) dispatchGameplay({ type: 'reset-room' });
    setLoading(true);
    setError('');
    try {
      setScene(await createMockAdventure(activeConfig, index));
      setRoom(index + 1);
      if (isNewRun) {
        const activeCharacter =
          characters.find((item) => item.id === activeConfig.characterId) ?? characters[0]!;
        runSequence.current += 1;
        dispatchGameplay({
          type: 'start-run',
          maximumHealth: activeCharacter.health,
          startedAt: Date.now(),
          runId: `run-${runSequence.current}`,
        });
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The chamber could not be prepared.');
    } finally {
      setLoading(false);
    }
  }

  async function begin() {
    const activeConfig = { ...config, characterId: playableCharacterId };
    setConfig(activeConfig);
    setDecisions([]);
    setComplete(false);
    void api.createAdventure(activeConfig).catch(() => undefined);
    await loadRoom(0, activeConfig, true);
  }

  async function choose(_choiceId: string, label: string) {
    const nextDecisions = [...decisions, label];
    setDecisions(nextDecisions);
    if (room >= 6) {
      saveRun(makeRunRecord(config, character, nextDecisions, 6));
      setComplete(true);
      setScene(null);
      return;
    }
    await loadRoom(room);
  }

  function reset() {
    setScene(null);
    setRoom(0);
    setDecisions([]);
    setComplete(false);
    setError('');
    dispatchGameplay({ type: 'reset-to-idle', maximumHealth: character.health });
  }

  return (
    <div className="dungeon-page">
      <header className="dungeon-heading">
        <p className="eyebrow">01 / Live prototype</p>
        <h1>Enter the experiment</h1>
        <p>Everything here is mock and local. No real AI service is being used.</p>
      </header>

      {!scene && !loading && !complete && (
        <DungeonSetupForm config={config} onChange={setConfig} onBegin={begin} />
      )}
      {loading && <LoadingState label="The chamber is rearranging…" />}
      {error && <ErrorState>{error}</ErrorState>}
      {complete && (
        <section className="completion-card">
          <p className="eyebrow">Resonance complete</p>
          <h2>The vault has your measure.</h2>
          <p>
            Your six-room demo run was saved to this browser. The record contains only local mock
            decisions.
          </p>
          <PrimaryButton onClick={reset}>Begin another run</PrimaryButton>
        </section>
      )}
      {scene && !loading && (
        <>
          <StatusPanel
            room={room}
            mode={config.mode}
            character={character.name}
            currentHealth={gameplay.currentHealth}
            maximumHealth={gameplay.maximumHealth}
            isInvulnerable={gameplay.invulnerability.expiresAt !== null}
            isDefeated={gameplay.status === 'defeated'}
          />
          <div className="game-layout">
            <section
              className="game-board-panel"
              data-game-status={gameplay.status}
              data-survival-time={formatSurvivalTime(
                getTimeSurvived(gameplay.runStats, Date.now()),
              )}
            >
              <div className="chamber-label">
                <span>{scene.chamber}</span>
                <span>{room <= 3 ? 'Resonance dormant' : 'Resonance active'}</span>
              </div>
              <DungeonGrid
                bounds={CURRENT_ROOM_LAYOUT.bounds}
                hazards={CURRENT_ROOM_LAYOUT.hazards}
                player={gameplay.player}
                status={gameplay.status}
                isInvulnerable={gameplay.invulnerability.expiresAt !== null}
                blockedMove={gameplay.blockedMove}
                lastAttack={gameplay.lastAttack}
                lastDamage={gameplay.lastDamage}
                lastAvoidedDamage={gameplay.lastAvoidedDamage}
                announcement={gameplay.announcement}
                controlsDisabled={gameplay.status !== 'active'}
                onMove={controls.move}
                onAttack={controls.attack}
                onShieldChange={controls.setPointerShielding}
              />
            </section>
            <StoryPanel scene={scene} onChoose={choose} />
          </div>
          <SecondaryButton onClick={reset}>Reset demo</SecondaryButton>
        </>
      )}
    </div>
  );
}
