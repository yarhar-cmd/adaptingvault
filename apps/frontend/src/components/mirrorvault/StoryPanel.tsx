import type { AdventureScene } from '../../types/adventure';
import { Panel } from '../common/Panel';

export function StoryPanel({
  scene,
  onChoose,
}: {
  scene: AdventureScene;
  onChoose: (choiceId: string, label: string) => void;
}) {
  return (
    <Panel className="story-panel" eyebrow="Mock local narrative">
      <p className="chapter-label">{scene.chamber}</p>
      <h2>{scene.title}</h2>
      <p>{scene.narrative}</p>
      <div className="choice-list">
        {scene.choices.map((choice) => (
          <button key={choice.id} type="button" onClick={() => onChoose(choice.id, choice.label)}>
            <span>{choice.label}</span>
            <small>{choice.tone}</small>
          </button>
        ))}
      </div>
    </Panel>
  );
}
