import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ExperienceChoice } from '../components/mirrorvault/ExperienceChoice';
import { RunSetup } from '../components/mirrorvault/RunSetup';
import {
  ACTIVE_RUN_INVALID_WARNING,
  StorageWarning,
} from '../components/mirrorvault/StorageWarning';
import { getPlayableCharacterId } from '../data/characterAvailability';
import { useAdventure } from '../hooks/useAdventure';
import {
  clearActiveRun,
  createActiveRunRecord,
  loadActiveRun,
  saveActiveRun,
} from '../services/activeRunStorage';
import { characters } from '../services/mockAdventureService';
import { createPlayerProfile, savePlayerProfile } from '../services/playerProfileStorage';
import type { ExperiencePreset } from '../types/adaptation';
import { createFreshRun } from '../utils/runLifecycle';

export function DungeonEntryPage() {
  const navigate = useNavigate();
  const { characterId, playerProfile, setPlayerProfile } = useAdventure();
  const [initialActiveRun] = useState(loadActiveRun);
  const [selectedPreset, setSelectedPreset] = useState<ExperiencePreset | null>(
    playerProfile?.experiencePreset ?? null,
  );
  const [needsExperienceChoice, setNeedsExperienceChoice] = useState(
    !playerProfile?.firstTimeComplete,
  );
  const [storageWarning, setStorageWarning] = useState(
    initialActiveRun.issue ? ACTIVE_RUN_INVALID_WARNING : '',
  );

  useEffect(() => {
    if (initialActiveRun.issue) clearActiveRun();
  }, [initialActiveRun.issue]);

  if (initialActiveRun.record) return <Navigate to="/dungeon/run" replace />;

  const playableCharacterId = getPlayableCharacterId(characterId);
  const character = characters.find((item) => item.id === playableCharacterId) ?? characters[0]!;

  function chooseExperience(preset: ExperiencePreset) {
    const profile = createPlayerProfile(preset);
    setPlayerProfile(profile);
    savePlayerProfile(profile);
    setSelectedPreset(preset);
    setNeedsExperienceChoice(false);
  }

  function delve() {
    if (!selectedPreset) return;
    const now = Date.now();
    const gameplay = createFreshRun({
      maximumHealth: character.health,
      experiencePreset: selectedPreset,
      longTermProfile: playerProfile?.longTermProfile,
      shortcutUnlocked: playerProfile?.shortcutUnlocked,
      startedAt: now,
    });
    const record = createActiveRunRecord(gameplay, playableCharacterId, now)!;
    const issue = saveActiveRun(record);
    if (issue) {
      setStorageWarning('The run could not be saved in this browser. Check storage permissions.');
      return;
    }
    navigate('/dungeon/run');
  }

  return (
    <div className="dungeon-entry-page">
      <header className="dungeon-entry-heading">
        <p className="eyebrow">Resonant Ruins</p>
        <h1>Begin a descent</h1>
        <p>Everything runs locally in your browser. No gameplay data leaves your device.</p>
      </header>
      {storageWarning && (
        <StorageWarning message={storageWarning} onDismiss={() => setStorageWarning('')} />
      )}
      {needsExperienceChoice ? (
        <ExperienceChoice initialValue={selectedPreset} onContinue={chooseExperience} />
      ) : (
        selectedPreset && <RunSetup experiencePreset={selectedPreset} onDelve={delve} />
      )}
    </div>
  );
}
