import type { DungeonConfig } from '../../types/adventure';
import { PrimaryButton } from '../common/Buttons';
import { Panel } from '../common/Panel';

export function DungeonSetupForm({
  config,
  onChange,
  onBegin,
}: {
  config: DungeonConfig;
  onChange: (config: DungeonConfig) => void;
  onBegin: () => void;
}) {
  const patch = <K extends keyof DungeonConfig>(key: K, value: DungeonConfig[K]) =>
    onChange({ ...config, [key]: value });

  return (
    <Panel className="setup-panel" eyebrow="Assessment intake">
      <h2>Before the vault opens…</h2>
      <p>
        Tell us what you expect. These answers do not set the result; they let the local demo
        compare what you say with the choices you make.
      </p>
      <div className="form-grid">
        <label>
          Dungeon-game experience
          <select
            value={config.experience}
            onChange={(event) => patch('experience', event.target.value as DungeonConfig['experience'])}
          >
            <option value="new">This is new to me</option>
            <option value="occasional">I play occasionally</option>
            <option value="veteran">I know the genre well</option>
          </select>
        </label>
        <label>
          Preferred challenge
          <select
            value={config.challenge}
            onChange={(event) => patch('challenge', event.target.value as DungeonConfig['challenge'])}
          >
            <option value="relaxed">Relaxed</option>
            <option value="balanced">Balanced</option>
            <option value="demanding">Demanding</option>
          </select>
        </label>
        <label>
          What sounds most satisfying?
          <select
            value={config.playstyle}
            onChange={(event) => patch('playstyle', event.target.value as DungeonConfig['playstyle'])}
          >
            <option value="balanced">A bit of everything</option>
            <option value="combat">Mastering combat</option>
            <option value="puzzle">Solving the room</option>
            <option value="exploration">Finding every secret</option>
          </select>
        </label>
      </div>
      <fieldset className="mode-picker">
        <legend>Generation mode</legend>
        <button
          className={config.mode === 'adaptive' ? 'is-selected' : ''}
          type="button"
          onClick={() => patch('mode', 'adaptive')}
          aria-pressed={config.mode === 'adaptive'}
        >
          Adaptive
          <small>Rooms respond to play</small>
        </button>
        <button
          className={config.mode === 'random' ? 'is-selected' : ''}
          type="button"
          onClick={() => patch('mode', 'random')}
          aria-pressed={config.mode === 'random'}
        >
          Completely random
          <small>Control-group generation</small>
        </button>
      </fieldset>
      <PrimaryButton onClick={onBegin}>Begin assessment →</PrimaryButton>
    </Panel>
  );
}
