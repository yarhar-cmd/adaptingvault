import { useState } from 'react';
import type { AdaptiveProfile, AdaptiveTrait } from '../../types/adaptation';
import type { GameplayState } from '../../utils/gameplayState';
import { getAdaptationStrength } from '../../utils/adaptiveProfile';
import { PrimaryButton, SecondaryButton } from '../common/Buttons';
import { formatByteSize, type StorageDiagnostics } from '../../services/storageDiagnostics';
import type { EnemyRoomState } from '../../types/enemies';
import { AwakeningEditor } from './AwakeningEditor';

const traits: AdaptiveTrait[] = ['pace', 'caution', 'aggression', 'hazardTolerance', 'exploration'];

export function DebugTools({
  gameplay,
  longTermProfile,
  onAdvance,
  onTemporaryOverride,
  onClearOverrides,
  onApplyOverrides,
  storageDiagnostics,
  enemies,
  livingEnemyCount = 0,
  onSpawnRat,
  onDefeatAllEnemies,
  onFreezeEnemyAi,
}: {
  gameplay: GameplayState;
  longTermProfile: AdaptiveProfile;
  onAdvance: () => void;
  onTemporaryOverride: (profile: AdaptiveProfile) => void;
  onClearOverrides: () => void;
  onApplyOverrides: (profile: AdaptiveProfile) => void;
  storageDiagnostics: StorageDiagnostics;
  enemies?: EnemyRoomState;
  livingEnemyCount?: number;
  onSpawnRat?: () => void;
  onDefeatAllEnemies?: () => void;
  onFreezeEnemyAi?: (frozen: boolean) => void;
}) {
  const [overrides, setOverrides] = useState<AdaptiveProfile | null>(null);
  const signals = gameplay.adaptation.signals;
  const generated = gameplay.dungeonProgress?.currentRoom;
  const debugNow = Date.now();
  const remaining = (deadline: number | null) =>
    deadline === null ? 0 : Math.max(0, deadline - debugNow);

  function setTrait(trait: AdaptiveTrait, value: number) {
    const next = { ...(overrides ?? gameplay.adaptation.effectiveProfile), [trait]: value };
    setOverrides(next);
    onTemporaryOverride(next);
  }

  return (
    <div className="debug-tools">
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
              <dt>Rats spawned / defeated</dt>
              <dd>
                {signals.ratsSpawned} / {signals.ratsDefeated}
              </dd>
            </div>
            <div>
              <dt>Enemy attacks started / landed</dt>
              <dd>
                {signals.enemyAttacksStarted} / {signals.enemyAttacksLanded}
              </dd>
            </div>
            <div>
              <dt>Enemy attacks missed / blocked</dt>
              <dd>
                {signals.enemyAttacksMissed} / {signals.enemyAttacksBlocked}
              </dd>
            </div>
            <div>
              <dt>Sword swings at enemies / Rats damaged</dt>
              <dd>
                {signals.swordSwingsAtEnemies} / {signals.ratsDamaged}
              </dd>
            </div>
            <div>
              <dt>Combat time</dt>
              <dd>{signals.combatTimeMs} ms</dd>
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
        <section aria-labelledby="debug-storage-title">
          <h3 id="debug-storage-title">Storage stability</h3>
          <dl>
            <div>
              <dt>Active-run record size</dt>
              <dd>{formatByteSize(storageDiagnostics.activeRunBytes)}</dd>
            </div>
            <div>
              <dt>Run archive size</dt>
              <dd>{formatByteSize(storageDiagnostics.runArchiveBytes)}</dd>
            </div>
            <div>
              <dt>Detailed snapshots retained</dt>
              <dd>{storageDiagnostics.detailedSnapshots}</dd>
            </div>
            <div>
              <dt>Current-room visited tiles</dt>
              <dd>{storageDiagnostics.currentVisitedTiles}</dd>
            </div>
            <div>
              <dt>Summarized completed rooms</dt>
              <dd>{storageDiagnostics.summarizedRooms}</dd>
            </div>
            <div>
              <dt>Active-run schema version</dt>
              <dd>{storageDiagnostics.activeRunSchemaVersion}</dd>
            </div>
            <div>
              <dt>Archive schema version</dt>
              <dd>{storageDiagnostics.archiveSchemaVersion}</dd>
            </div>
          </dl>
        </section>
        {enemies && (
          <section aria-labelledby="debug-enemies-title">
            <h3 id="debug-enemies-title">Enemy framework</h3>
            <dl>
              <div>
                <dt>Living / total Rats</dt>
                <dd>
                  {livingEnemyCount} / {enemies.rats.length}
                </dd>
              </div>
              <div>
                <dt>Exits</dt>
                <dd>{livingEnemyCount > 0 ? 'sealed' : 'open'}</dd>
              </div>
              <div>
                <dt>Enemy AI</dt>
                <dd>{enemies.aiFrozen ? 'frozen' : 'running'}</dd>
              </div>
              <div>
                <dt>Count / cap</dt>
                <dd>
                  {enemies.countPlan
                    ? `${enemies.countPlan.selectedCount} / ${enemies.countPlan.cap}`
                    : 'Authored'}
                </dd>
              </div>
              {enemies.countPlan && (
                <>
                  <div>
                    <dt>Selected count pressure</dt>
                    <dd>{enemies.countPlan.basePressure.toFixed(2)}</dd>
                  </div>
                  <div>
                    <dt>Room-size adjustment</dt>
                    <dd>{enemies.countPlan.roomSizeAdjustment.toFixed(2)}</dd>
                  </div>
                  <div>
                    <dt>Hazard adjustment</dt>
                    <dd>{enemies.countPlan.hazardAdjustment.toFixed(2)}</dd>
                  </div>
                  <div>
                    <dt>Adaptation adjustment</dt>
                    <dd>{enemies.countPlan.adaptationAdjustment.toFixed(2)}</dd>
                  </div>
                  <div>
                    <dt>Preset adjustment</dt>
                    <dd>{enemies.countPlan.presetAdjustment.toFixed(2)}</dd>
                  </div>
                </>
              )}
            </dl>
            <ul className="debug-enemy-list">
              {enemies.rats.map((rat) => (
                <li key={rat.id}>
                  <strong>{rat.id}</strong>
                  <span>
                    ({rat.position.x},{rat.position.y}) · {rat.health} HP · {rat.state}
                  </span>
                  <span>
                    target{' '}
                    {rat.lockedTarget ? `${rat.lockedTarget.x},${rat.lockedTarget.y}` : 'none'} ·
                    next {rat.nextPathStep ? `${rat.nextPathStep.x},${rat.nextPathStep.y}` : 'none'}
                  </span>
                  <span>
                    move {remaining(rat.nextMovementAt)} ms · telegraph{' '}
                    {remaining(rat.telegraphEndsAt)} ms · cooldown {remaining(rat.cooldownEndsAt)}{' '}
                    ms · corpse {remaining(rat.corpseEndsAt)} ms
                  </span>
                  <span>
                    {rat.spawnSource}: {rat.spawnReason}
                    {rat.authoredSpawnNumber ? ` · Spawn ${rat.authoredSpawnNumber}` : ''} · counted{' '}
                    {String(rat.defeatCounted)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
      <AwakeningEditor />
      <div className="debug-tools__actions">
        <SecondaryButton disabled={livingEnemyCount > 0} onClick={onAdvance}>
          Advance to Next Room
        </SecondaryButton>
        {onSpawnRat && <SecondaryButton onClick={onSpawnRat}>Spawn Rat</SecondaryButton>}
        {onDefeatAllEnemies && (
          <SecondaryButton onClick={onDefeatAllEnemies}>Defeat All Enemies</SecondaryButton>
        )}
        {onFreezeEnemyAi && (
          <SecondaryButton onClick={() => onFreezeEnemyAi(!enemies?.aiFrozen)}>
            {enemies?.aiFrozen ? 'Resume Enemy AI' : 'Freeze Enemy AI'}
          </SecondaryButton>
        )}
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
    </div>
  );
}
