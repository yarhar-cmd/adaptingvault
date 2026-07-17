import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { AdventureContext } from './adventureContext';
import { getPlayableCharacterId } from '../data/characterAvailability';
import {
  PROFILE_STORAGE_INVALID_WARNING,
  SETTINGS_STORAGE_INVALID_WARNING,
} from '../components/mirrorvault/StorageWarning';
import {
  loadCharacter,
  loadSettingsResult,
  saveCharacter,
  saveSettings,
} from '../services/storage';
import type { UserSettings } from '../types/adventure';
import {
  clearPlayerProfile,
  createPlayerProfile,
  loadPlayerProfile,
  savePlayerProfile,
} from '../services/playerProfileStorage';
import type { PlayerProfileRecord } from '../types/adaptation';

export function AdventureProvider({ children }: { children: ReactNode }) {
  const [initialStorage] = useState(() => ({
    settings: loadSettingsResult(),
    profile: loadPlayerProfile(),
  }));
  const recoveredProfile = initialStorage.profile.recoveredExperiencePreset
    ? createPlayerProfile(initialStorage.profile.recoveredExperiencePreset)
    : null;
  const [characterId, setStoredCharacterId] = useState(loadCharacter);
  const [settings, setSettings] = useState<UserSettings>(initialStorage.settings.settings);
  const [playerProfile, setPlayerProfile] = useState<PlayerProfileRecord | null>(
    initialStorage.profile.record ?? recoveredProfile,
  );
  const [storageWarning, setStorageWarning] = useState(
    initialStorage.settings.issue
      ? SETTINGS_STORAGE_INVALID_WARNING
      : initialStorage.profile.issue
        ? PROFILE_STORAGE_INVALID_WARNING
        : '',
  );

  const setCharacterId = useCallback((value: string) => {
    setStoredCharacterId(getPlayableCharacterId(value));
  }, []);

  useEffect(() => {
    if (initialStorage.settings.issue) saveSettings(settings);
    if (initialStorage.profile.issue) {
      if (playerProfile) savePlayerProfile(playerProfile);
      else clearPlayerProfile();
    }
  }, [initialStorage.profile.issue, initialStorage.settings.issue, playerProfile, settings]);
  useEffect(() => {
    if (saveCharacter(characterId)) setStorageWarning(SETTINGS_STORAGE_INVALID_WARNING);
  }, [characterId]);
  useEffect(() => {
    if (saveSettings(settings)) setStorageWarning(SETTINGS_STORAGE_INVALID_WARNING);
  }, [settings]);
  useEffect(() => {
    if (playerProfile && savePlayerProfile(playerProfile))
      setStorageWarning(PROFILE_STORAGE_INVALID_WARNING);
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
        storageWarning,
        dismissStorageWarning: () => setStorageWarning(''),
      }}
    >
      {children}
    </AdventureContext.Provider>
  );
}
