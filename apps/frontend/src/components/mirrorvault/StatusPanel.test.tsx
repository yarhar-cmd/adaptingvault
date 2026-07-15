import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusPanel } from './StatusPanel';

describe('Resonant Ruins status panel', () => {
  it('renders live Warden health with distinct remaining and missing indicators', () => {
    const { container } = render(
      <StatusPanel
        room={1}
        mode="adaptive"
        character="Elian Voss"
        currentHealth={4}
        maximumHealth={6}
        isInvulnerable={false}
        isDefeated={false}
      />,
    );

    expect(screen.getByLabelText('4 of 6 health remaining.')).toBeVisible();
    expect(container.querySelectorAll('.health__indicators > span')).toHaveLength(6);
    expect(container.querySelectorAll('.health__remaining')).toHaveLength(4);
    expect(container.querySelectorAll('.health__missing')).toHaveLength(2);
  });

  it('exposes invulnerable and defeated conditions without relying on color', () => {
    const { rerender } = render(
      <StatusPanel
        room={1}
        mode="adaptive"
        character="Elian Voss"
        currentHealth={5}
        maximumHealth={6}
        isInvulnerable
        isDefeated={false}
      />,
    );
    expect(screen.getByText('◇ Invulnerable')).toBeVisible();
    expect(screen.getByLabelText(/Invulnerable/)).toBeVisible();

    rerender(
      <StatusPanel
        room={1}
        mode="adaptive"
        character="Elian Voss"
        currentHealth={0}
        maximumHealth={6}
        isInvulnerable={false}
        isDefeated
      />,
    );
    expect(screen.getByText('× Defeated')).toBeVisible();
    expect(screen.getByLabelText(/You were defeated/)).toBeVisible();
  });
});
