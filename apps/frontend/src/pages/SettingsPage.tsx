import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageContainer } from '../components/layout/PageContainer';
import { ConfirmationDialog } from '../components/mirrorvault/ConfirmationDialog';
import { useAdventure } from '../hooks/useAdventure';
import { clearActiveRun, loadActiveRun } from '../services/activeRunStorage';
import {
  changeExperiencePreset,
  createPlayerProfile,
  resetPlayerProfile,
} from '../services/playerProfileStorage';
import {
  EXPERIENCE_PRESETS,
  EXPERIENCE_PRESET_IDS,
  type ExperiencePreset,
} from '../types/adaptation';

type PendingAction =
  { type: 'experience'; preset: ExperiencePreset } | { type: 'profile-reset' } | null;

export function SettingsPage() {
  const navigate = useNavigate();
  const { settings, setSettings, playerProfile, setPlayerProfile } = useAdventure();
  const [pending, setPending] = useState<PendingAction>(null);
  const toggle = (key: keyof typeof settings) =>
    setSettings({ ...settings, [key]: !settings[key] });

  function requestExperienceChange(preset: ExperiencePreset) {
    if (preset === playerProfile?.experiencePreset) return;
    if (loadActiveRun().record) setPending({ type: 'experience', preset });
    else {
      setPlayerProfile(
        playerProfile ? changeExperiencePreset(playerProfile, preset) : createPlayerProfile(preset),
      );
    }
  }

  function confirmPending() {
    if (!pending) return;
    if (pending.type === 'experience') {
      setPlayerProfile(
        playerProfile
          ? changeExperiencePreset(playerProfile, pending.preset)
          : createPlayerProfile(pending.preset),
      );
    } else if (playerProfile) {
      setPlayerProfile(resetPlayerProfile(playerProfile, true));
    }
    clearActiveRun();
    setPending(null);
    navigate('/');
  }

  return (
    <PageContainer
      eyebrow="Local controls"
      title="Settings"
      intro="These preferences are stored in your browser and can be changed at any time."
    >
      <div className="settings-list">
        <label>
          <span>
            <strong>Experience preset</strong>
            <small>Shapes how strongly generated rooms reinforce or test your play style.</small>
          </span>
          <select
            aria-label="Experience preset"
            value={playerProfile?.experiencePreset ?? ''}
            onChange={(event) => requestExperienceChange(event.target.value as ExperiencePreset)}
          >
            <option value="" disabled>
              Choose experience
            </option>
            {EXPERIENCE_PRESET_IDS.map((preset) => (
              <option key={preset} value={preset}>
                {EXPERIENCE_PRESETS[preset].label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>
            <strong>Ambient sound</strong>
            <small>Reserved for future local audio. No sound file is included yet.</small>
          </span>
          <input type="checkbox" checked={settings.sound} onChange={() => toggle('sound')} />
        </label>
        <label>
          <span>
            <strong>Reduce motion</strong>
            <small>Disables decorative transitions and pulses.</small>
          </span>
          <input
            type="checkbox"
            checked={settings.reducedMotion}
            onChange={() => toggle('reducedMotion')}
          />
        </label>
        <label>
          <span>
            <strong>High contrast</strong>
            <small>Strengthens text and interface borders.</small>
          </span>
          <input
            type="checkbox"
            checked={settings.highContrast}
            onChange={() => toggle('highContrast')}
          />
        </label>
        <div className="settings-action">
          <span>
            <strong>Adaptive profile</strong>
            <small>
              Forget learned traits and relock the Awakening Chamber shortcut. Run history and best
              records remain.
            </small>
          </span>
          <button
            className="button button--secondary"
            type="button"
            disabled={!playerProfile}
            onClick={() => setPending({ type: 'profile-reset' })}
          >
            Reset adaptive profile
          </button>
        </div>
      </div>

      <ConfirmationDialog
        open={pending?.type === 'experience'}
        title="Change experience preset?"
        confirmLabel="Change and reset"
        onConfirm={confirmPending}
        onCancel={() => setPending(null)}
      >
        <p>
          The current run will reset, the adaptive profile and active learning data will return to
          neutral, and the Awakening Chamber shortcut will relock. You will return to Main Menu.
        </p>
        <p>
          Completed-run history and best records will remain under their original experience
          presets.
        </p>
      </ConfirmationDialog>
      <ConfirmationDialog
        open={pending?.type === 'profile-reset'}
        title="Reset adaptive profile?"
        confirmLabel="Reset profile"
        onConfirm={confirmPending}
        onCancel={() => setPending(null)}
      >
        <p>
          This clears learned traits and metadata, relocks the shortcut, clears the active run, and
          returns to Main Menu. Your selected experience, completed-run history, and best records
          remain.
        </p>
      </ConfirmationDialog>
    </PageContainer>
  );
}
