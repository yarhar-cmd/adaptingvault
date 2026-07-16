import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RUN_STORAGE_WARNING, StorageWarning } from './StorageWarning';

describe('Resonant Ruins storage warning', () => {
  it('uses a polite live region and can be dismissed', () => {
    const onDismiss = vi.fn();
    render(<StorageWarning message={RUN_STORAGE_WARNING} onDismiss={onDismiss} />);

    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss run history warning' }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
