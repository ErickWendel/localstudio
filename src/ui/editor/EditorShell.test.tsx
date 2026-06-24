import { render, screen } from '@testing-library/react';
import { createAppServices } from '../../app/composition';
import { EditorShell } from './EditorShell';

describe('EditorShell', () => {
  it('renders the approved editor shell landmarks', () => {
    render(<EditorShell services={createAppServices()} />);

    expect(screen.getByText('EW Canvas AI')).toBeInTheDocument();
    expect(screen.getByText('Untitled AI Deck')).toBeInTheDocument();
    expect(screen.getByText('PT-BR')).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('Describe slide structure or organize current content...'),
    ).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'AI Tools' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });
});
