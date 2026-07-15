import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { AdventureContext } from './adventureContext';
import { getPlayableCharacterId } from '../data/characterAvailability';
import { loadCharacter, loadSettings, saveCharacter, saveSettings } from '../services/storage';
import type { UserSettings } from '../types/adventure';

export function AdventureProvider({ children }: { children: ReactNode }) {
  const [characterId, setStoredCharacterId] = useState(loadCharacter);
  const [settings, setSettings] = useState<UserSettings>(loadSettings);

  const setCharacterId = useCallback((value: string) => {
    setStoredCharacterId(getPlayableCharacterId(value));
  }, []);

  useEffect(() => saveCharacter(characterId), [characterId]);
  useEffect(() => saveSettings(settings), [settings]);

  return (
    <AdventureContext.Provider value={{ characterId, setCharacterId, settings, setSettings }}>
      {children}
    </AdventureContext.Provider>
  );
}
