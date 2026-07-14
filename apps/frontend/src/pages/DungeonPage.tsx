import { useState } from 'react';
import { DungeonGrid, type Direction } from '../components/mirrorvault/DungeonGrid';
import { DungeonSetupForm } from '../components/mirrorvault/DungeonSetupForm';
import { StatusPanel } from '../components/mirrorvault/StatusPanel';
import { StoryPanel } from '../components/mirrorvault/StoryPanel';
import { ErrorState, LoadingState } from '../components/common/States';
import { PrimaryButton, SecondaryButton } from '../components/common/Buttons';
import { api } from '../services/api';
import { characters, createMockAdventure, makeRunRecord } from '../services/mockAdventureService';
import { saveRun } from '../services/storage';
import type { AdventureScene, DungeonConfig } from '../types/adventure';
import { useAdventure } from '../hooks/useAdventure';

export function DungeonPage() {
  const { characterId } = useAdventure();
  const [config, setConfig] = useState<DungeonConfig>({ experience: 'occasional', challenge: 'balanced', playstyle: 'balanced', mode: 'adaptive', characterId });
  const [scene, setScene] = useState<AdventureScene | null>(null);
  const [room, setRoom] = useState(0);
  const [decisions, setDecisions] = useState<string[]>([]);
  const [player, setPlayer] = useState({ row: 2, column: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [complete, setComplete] = useState(false);

  const character = characters.find((item) => item.id === characterId) ?? characters[0]!;

  async function loadRoom(index: number, activeConfig = config) {
    setLoading(true);
    setError('');
    try {
      setScene(await createMockAdventure(activeConfig, index));
      setRoom(index + 1);
      setPlayer({ row: 2, column: 0 });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The chamber could not be prepared.');
    } finally {
      setLoading(false);
    }
  }

  async function begin() {
    const activeConfig = { ...config, characterId };
    setConfig(activeConfig);
    setDecisions([]);
    setComplete(false);
    void api.createAdventure(activeConfig).catch(() => undefined);
    await loadRoom(0, activeConfig);
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

  function move(direction: Direction) {
    setPlayer((current) => {
      const next = { ...current };
      if (direction === 'up') next.row = Math.max(0, current.row - 1);
      if (direction === 'down') next.row = Math.min(4, current.row + 1);
      if (direction === 'left') next.column = Math.max(0, current.column - 1);
      if (direction === 'right') next.column = Math.min(7, current.column + 1);
      return next;
    });
  }

  function reset() {
    setScene(null);
    setRoom(0);
    setDecisions([]);
    setComplete(false);
    setError('');
  }

  return (
    <div className="dungeon-page">
      <header className="dungeon-heading">
        <p className="eyebrow">01 / Live prototype</p>
        <h1>Enter the experiment</h1>
        <p>Everything here is mock and local. No real AI service is being used.</p>
      </header>

      {!scene && !loading && !complete && <DungeonSetupForm config={config} onChange={setConfig} onBegin={begin} />}
      {loading && <LoadingState label="The chamber is rearranging…" />}
      {error && <ErrorState>{error}</ErrorState>}
      {complete && (
        <section className="completion-card">
          <p className="eyebrow">Resonance complete</p>
          <h2>The vault has your measure.</h2>
          <p>Your six-room demo run was saved to this browser. The record contains only local mock decisions.</p>
          <PrimaryButton onClick={reset}>Begin another run</PrimaryButton>
        </section>
      )}
      {scene && !loading && (
        <>
          <StatusPanel room={room} mode={config.mode} character={character.name} />
          <div className="game-layout">
            <section className="game-board-panel">
              <div className="chamber-label"><span>{scene.chamber}</span><span>{room <= 3 ? 'Resonance dormant' : 'Resonance active'}</span></div>
              <DungeonGrid player={player} onMove={move} onAttack={() => setDecisions((items) => [...items, 'Attacked'])} />
            </section>
            <StoryPanel scene={scene} onChoose={choose} />
          </div>
          <SecondaryButton onClick={reset}>Reset demo</SecondaryButton>
        </>
      )}
    </div>
  );
}
