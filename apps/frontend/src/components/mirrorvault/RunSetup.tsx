import { EXPERIENCE_PRESETS, type ExperiencePreset } from '../../types/adaptation';
import { PrimaryButton } from '../common/Buttons';
import { Panel } from '../common/Panel';

export function RunSetup({
  experiencePreset,
  onDelve,
}: {
  experiencePreset: ExperiencePreset;
  onDelve: () => void;
}) {
  return (
    <Panel className="run-setup" eyebrow="Run setup">
      <div className="run-setup__space" aria-hidden="true" />
      <div className="run-setup__center">
        <h2>Prepare to delve</h2>
        <p>
          <span>Experience:</span> <strong>{EXPERIENCE_PRESETS[experiencePreset].label}</strong>
        </p>
        <PrimaryButton onClick={onDelve}>Delve</PrimaryButton>
      </div>
      <div className="run-setup__space" aria-hidden="true" />
    </Panel>
  );
}
