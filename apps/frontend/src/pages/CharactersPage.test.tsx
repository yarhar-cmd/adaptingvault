import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { AdventureProvider } from '../context/AdventureProvider';
import { CharactersPage } from './CharactersPage';

function renderPage() {
  return render(
    <MemoryRouter>
      <AdventureProvider>
        <CharactersPage />
      </AdventureProvider>
    </MemoryRouter>,
  );
}

describe('Resonant Ruins character availability', () => {
  beforeEach(() => localStorage.clear());

  it('keeps the Warden selectable', () => {
    renderPage();
    const warden = screen.getByRole('button', { name: /Elian Voss/ });

    expect(warden).toBeEnabled();
    fireEvent.click(warden);
    expect(warden).toHaveAttribute('aria-pressed', 'true');
  });

  it.each([
    ['Mara Quill', 'seeker'],
    ['Iven Ash', 'ember'],
  ])('shows %s as dimmed, disabled, and Coming Later', (name, characterId) => {
    renderPage();
    const card = screen.getByRole('button', { name: new RegExp(name) });

    expect(card).toBeDisabled();
    expect(card).toHaveClass('is-unavailable');
    expect(card).toHaveTextContent('Coming Later.');
    expect(card).toHaveAttribute('aria-describedby', `${characterId}-availability`);
  });

  it('does not select unavailable characters through keyboard activation', () => {
    renderPage();
    const seeker = screen.getByRole('button', { name: /Mara Quill/ });
    const warden = screen.getByRole('button', { name: /Elian Voss/ });

    fireEvent.keyDown(seeker, { code: 'Enter', key: 'Enter' });
    fireEvent.keyUp(seeker, { code: 'Enter', key: 'Enter' });
    fireEvent.keyDown(seeker, { code: 'Space', key: ' ' });
    fireEvent.keyUp(seeker, { code: 'Space', key: ' ' });

    expect(warden).toHaveAttribute('aria-pressed', 'true');
    expect(seeker).toHaveAttribute('aria-pressed', 'false');
  });

  it('replaces a saved unavailable selection with the Warden without changing settings', async () => {
    localStorage.setItem('mirrorvault:character', 'seeker');
    localStorage.setItem('mirrorvault:settings', JSON.stringify({ sound: true }));
    renderPage();

    expect(screen.getByRole('button', { name: /Elian Voss/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await waitFor(() => expect(localStorage.getItem('mirrorvault:character')).toBe('warden'));
    expect(JSON.parse(localStorage.getItem('mirrorvault:settings') ?? '{}')).toMatchObject({
      sound: true,
    });
  });
});
