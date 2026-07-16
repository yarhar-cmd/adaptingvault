import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { AdventureContext } from './adventureContext';
import { getPlayableCharacterId } from '../data/characterAvailability';
import { loadCharacter, loadSettings, saveCharacter, saveSettings } from '../services/storage';
import type { UserSettings } from '../types/adventure';
import { loadPlayerProfile, savePlayerProfile } from '../services/playerProfileStorage';
import type { PlayerProfileRecord } from '../types/adaptation';

export function AdventureProvider({ children }: { children: ReactNode }) {
  const [characterId, setStoredCharacterId] = useState(loadCharacter);
  const [settings, setSettings] = useState<UserSettings>(loadSettings);
  const [playerProfile, setPlayerProfile] = useState<PlayerProfileRecord | null>(
    () => loadPlayerProfile().record,
  );

  const setCharacterId = useCallback((value: string) => {
    setStoredCharacterId(getPlayableCharacterId(value));
  }, []);

  useEffect(() => saveCharacter(characterId), [characterId]);
  useEffect(() => saveSettings(settings), [settings]);
  useEffect(() => {
    if (playerProfile) savePlayerProfile(playerProfile);
  }, [playerProfile]);

  return (
    <AdventureContext.Provider
      value={{
        characterId,
        setCharacterId,
        settings,
        setSettings,
        playerProfile,
        setPlayerProfile,
      }}
    >
      {children}
    </AdventureContext.Provider>
  );
}
