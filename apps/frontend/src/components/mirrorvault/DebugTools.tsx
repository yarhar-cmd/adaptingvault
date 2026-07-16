import { useState } from 'react';
import type { AdaptiveProfile, AdaptiveTrait } from '../../types/adaptation';
import type { GameplayState } from '../../utils/gameplayState';
import { getAdaptationStrength } from '../../utils/adaptiveProfile';
import { PrimaryButton, SecondaryButton } from '../common/Buttons';

const traits: AdaptiveTrait[] = ['pace', 'caution', 'aggression', 'hazardTolerance', 'exploration'];

export function DebugTools({
  gameplay,
  longTermProfile,
  onAdvance,
  onTemporaryOverride,
  onClearOverrides,
  onApplyOverrides,
}: {
  gameplay: GameplayState;
  longTermProfile: AdaptiveProfile;
  onAdvance: () => void;
  onTemporaryOverride: (profile: AdaptiveProfile) => void;
  onClearOverrides: () => void;
  onApplyOverrides: (profile: AdaptiveProfile) => void;
}) {
  const [overrides, setOverrides] = useState<AdaptiveProfile | null>(null);
  const signals = gameplay.adaptation.signals;
  const generated = gameplay.dungeonProgress?.currentRoom;

  function setTrait(trait: AdaptiveTrait, value: number) {
    const next = { ...(overrides ?? gameplay.adaptation.effectiveProfile), [trait]: value };
    setOverrides(next);
    onTemporaryOverride(next);
  }

  return (
    <details className="debug-tools" open>
      <summary>Debug Tools</summary>
      <div className="debug-tools__grid">
        <section aria-labelledby="debug-signals-title">
          <h3 id="debug-signals-title">Raw signals</h3>
          <dl>
            <div>
              <dt>Recent room times</dt>
              <dd>{signals.roomTimesMs.slice(-5).join(', ') || 'None'}</dd>
            </div>
            <div>
              <dt>Movement steps</dt>
              <dd>{signals.movementSteps}</dd>
            </div>
            <div>
              <dt>Blocked attempts</dt>
              <dd>{signals.blockedMovementAttempts}</dd>
            </div>
            <div>
              <dt>Idle time</dt>
              <dd>{signals.idleTimeMs} ms</dd>
            </div>
            <div>
              <dt>Damage / rune contacts</dt>
              <dd>
                {signals.damageTaken} / {signals.runeContacts}
              </dd>
            </div>
            <div>
              <dt>Shield uses / time</dt>
              <dd>
                {signals.shieldActivations} / {signals.shieldTimeMs} ms
              </dd>
            </div>
            <div>
              <dt>Sword swings</dt>
              <dd>{signals.swordSwings}</dd>
            </div>
            <div>
              <dt>Floor coverage</dt>
              <dd>{signals.floorTilesVisited.length} tiles</dd>
            </div>
            <div>
              <dt>Direction changes</dt>
              <dd>{signals.directionChanges}</dd>
            </div>
            <div>
              <dt>Exit directions</dt>
              <dd>
                {Object.entries(signals.exitsChosenByDirection)
                  .map(([key, value]) => `${key} ${value}`)
                  .join(', ')}
              </dd>
            </div>
          </dl>
        </section>
        <section aria-labelledby="debug-profile-title">
          <h3 id="debug-profile-title">Adaptive profile</h3>
          {traits.map((trait) => (
            <label key={trait}>
              <span>
                {trait.replace(/([A-Z])/g, ' $1')} —{' '}
                {(overrides ?? gameplay.adaptation.effectiveProfile)[trait].toFixed(2)}
              </span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={(overrides ?? gameplay.adaptation.effectiveProfile)[trait]}
                onChange={(event) => setTrait(trait, Number(event.target.value))}
              />
              <small>
                Saved {longTermProfile[trait].toFixed(2)} · run{' '}
                {gameplay.adaptation.currentRunProfile[trait].toFixed(2)} · effective{' '}
                {gameplay.adaptation.effectiveProfile[trait].toFixed(2)}
              </small>
            </label>
          ))}
          <p>
            Adaptation strength:{' '}
            {Math.round(
              getAdaptationStrength(Math.max(1, gameplay.dungeonProgress?.dungeonRoomNumber ?? 1)) *
                100,
            )}
            %
          </p>
        </section>
        <section aria-labelledby="debug-generation-title">
          <h3 id="debug-generation-title">Generated room</h3>
          {generated ? (
            <dl>
              <div>
                <dt>Number / seed</dt>
                <dd>
                  {generated.dungeonRoomNumber} / {generated.roomSeed}
                </dd>
              </div>
              <div>
                <dt>Generator</dt>
                <dd>v{generated.generatorVersion}</dd>
              </div>
              <div>
                <dt>Shape / dimensions</dt>
                <dd>
                  {generated.details.shape} / {generated.roomSnapshot.width}×
                  {generated.roomSnapshot.height}
                </dd>
              </div>
              <div>
                <dt>Entrance</dt>
                <dd>{generated.details.entranceDirection}</dd>
              </div>
              <div>
                <dt>Exits</dt>
                <dd>
                  {generated.roomSnapshot.exits
                    .map((exit) => `${exit.direction} (${exit.tile.x},${exit.tile.y})`)
                    .join(', ')}
                </dd>
              </div>
              <div>
                <dt>Hazards / pattern</dt>
                <dd>
                  {generated.roomSnapshot.hazards?.length ?? 0} / {generated.details.hazardPattern}
                </dd>
              </div>
              <div>
                <dt>Mode / cooldown</dt>
                <dd>
                  {generated.details.mode} / {gameplay.dungeonProgress?.pokeCooldown ?? 0}
                </dd>
              </div>
              <div>
                <dt>Validation / retries</dt>
                <dd>
                  {generated.details.validationErrors.length ? 'failed' : 'valid'} /{' '}
                  {generated.details.retryCount}
                </dd>
              </div>
              <div>
                <dt>Reasons</dt>
                <dd>{generated.details.reasons.join('; ') || 'Baseline weights'}</dd>
              </div>
            </dl>
          ) : (
            <p>Complete the Awakening Chambers or use the unlocked shortcut.</p>
          )}
        </section>
      </div>
      <div className="debug-tools__actions">
        <SecondaryButton onClick={onAdvance}>Advance to Next Room</SecondaryButton>
        <SecondaryButton
          onClick={() => {
            setOverrides(null);
            onClearOverrides();
          }}
        >
          Clear Temporary Overrides
        </SecondaryButton>
        <PrimaryButton
          disabled={!overrides}
          onClick={() => overrides && onApplyOverrides(overrides)}
        >
          Apply Overrides to Saved Profile
        </PrimaryButton>
      </div>
    </details>
  );
}
