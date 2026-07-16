import { useState } from 'react';
import {
  EXPERIENCE_PRESETS,
  EXPERIENCE_PRESET_IDS,
  type ExperiencePreset,
} from '../../types/adaptation';
import { PrimaryButton } from '../common/Buttons';
import { Panel } from '../common/Panel';

export function ExperienceChoice({
  initialValue = null,
  onContinue,
}: {
  initialValue?: ExperiencePreset | null;
  onContinue: (preset: ExperiencePreset) => void;
}) {
  const [selected, setSelected] = useState<ExperiencePreset | null>(initialValue);
  return (
    <Panel className="experience-choice" eyebrow="First descent">
      <h2>Choose your experience</h2>
      <fieldset className="experience-choice__options">
        <legend>Dungeon experience</legend>
        {EXPERIENCE_PRESET_IDS.map((preset) => (
          <label key={preset} className={selected === preset ? 'is-selected' : ''}>
            <input
              type="radio"
              name="experience-preset"
              value={preset}
              checked={selected === preset}
              onChange={() => setSelected(preset)}
            />
            <span>{EXPERIENCE_PRESETS[preset].label}</span>
          </label>
        ))}
      </fieldset>
      <PrimaryButton disabled={!selected} onClick={() => selected && onContinue(selected)}>
        Continue
      </PrimaryButton>
    </Panel>
  );
}
