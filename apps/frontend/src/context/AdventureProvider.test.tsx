import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  PROFILE_STORAGE_INVALID_WARNING,
  SETTINGS_STORAGE_INVALID_WARNING,
} from '../components/mirrorvault/StorageWarning';
import { useAdventure } from '../hooks/useAdventure';
import { createPlayerProfile, PLAYER_PROFILE_KEY } from '../services/playerProfileStorage';
import { AdventureProvider } from './AdventureProvider';

const SETTINGS_KEY = 'mirrorvault:settings';
const ACTIVE_KEY = 'mirrorvault:active-run:v1';
const ARCHIVE_KEY = 'mirrorvault:run-archive:v2';

function Probe() {
  const { settings, playerProfile, storageWarning } = useAdventure();
  return (
    <output>
      {storageWarning}|{String(settings.sound)}|{playerProfile?.experiencePreset ?? 'none'}|
      {String(playerProfile?.shortcutUnlocked ?? false)}
    </output>
  );
}

describe('Resonant Ruins isolated storage recovery', () => {
  beforeEach(() => localStorage.clear());

  it('resets corrupt settings without touching profile, active run, or archive', async () => {
    const profileRaw = JSON.stringify(createPlayerProfile('dungeon-veteran'));
    localStorage.setItem(SETTINGS_KEY, '{');
    localStorage.setItem(PLAYER_PROFILE_KEY, profileRaw);
    localStorage.setItem(ACTIVE_KEY, 'active-marker');
    localStorage.setItem(ARCHIVE_KEY, 'archive-marker');

    render(
      <AdventureProvider>
        <Probe />
      </AdventureProvider>,
    );

    expect(screen.getByText(new RegExp(SETTINGS_STORAGE_INVALID_WARNING))).toBeInTheDocument();
    await waitFor(() => expect(localStorage.getItem(SETTINGS_KEY)).not.toBe('{'));
    expect(localStorage.getItem(PLAYER_PROFILE_KEY)).toBe(profileRaw);
    expect(localStorage.getItem(ACTIVE_KEY)).toBe('active-marker');
    expect(localStorage.getItem(ARCHIVE_KEY)).toBe('archive-marker');
  });

  it('recovers a safe preset and relocks shortcuts when only the profile is corrupt', async () => {
    const settingsRaw = JSON.stringify({ sound: true, reducedMotion: false, highContrast: false });
    localStorage.setItem(SETTINGS_KEY, settingsRaw);
    localStorage.setItem(
      PLAYER_PROFILE_KEY,
      JSON.stringify({ experiencePreset: 'new-delver', shortcutUnlocked: true, invalid: true }),
    );
    localStorage.setItem(ACTIVE_KEY, 'active-marker');
    localStorage.setItem(ARCHIVE_KEY, 'archive-marker');

    render(
      <AdventureProvider>
        <Probe />
      </AdventureProvider>,
    );

    expect(screen.getByText(new RegExp(PROFILE_STORAGE_INVALID_WARNING))).toBeInTheDocument();
    await waitFor(() => {
      const recovered = JSON.parse(localStorage.getItem(PLAYER_PROFILE_KEY)!);
      expect(recovered).toMatchObject({
        experiencePreset: 'new-delver',
        shortcutUnlocked: false,
        firstTimeComplete: true,
      });
    });
    expect(localStorage.getItem(SETTINGS_KEY)).toBe(settingsRaw);
    expect(localStorage.getItem(ACTIVE_KEY)).toBe('active-marker');
    expect(localStorage.getItem(ARCHIVE_KEY)).toBe('archive-marker');
  });
});
