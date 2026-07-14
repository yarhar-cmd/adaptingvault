import { Link } from 'react-router-dom';
import { PageContainer } from '../components/layout/PageContainer';
import { characters } from '../services/mockAdventureService';
import { useAdventure } from '../hooks/useAdventure';

export function CharactersPage() {
  const { characterId, setCharacterId } = useAdventure();
  return (
    <PageContainer eyebrow="The delvers" title="Choose who enters." intro="Each local demo character emphasizes a different readable play signal. Your selection is saved only in this browser.">
      <div className="character-grid">
        {characters.map((character) => (
          <button key={character.id} className={`character-card ${characterId === character.id ? 'is-selected' : ''}`} type="button" onClick={() => setCharacterId(character.id)} aria-pressed={characterId === character.id}>
            <span className="character-sigil">{character.sigil}</span>
            <span className="eyebrow">{character.role}</span>
            <strong>{character.name}</strong>
            <p>{character.description}</p>
            <small>{character.trait}</small>
          </button>
        ))}
      </div>
      <Link className="button button--primary" to="/dungeon">Enter as selected delver →</Link>
    </PageContainer>
  );
}
