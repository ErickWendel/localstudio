import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from '../../../src/App';

describe('App', () => {
  it('renders the application root', () => {
    render(<App />);

    expect(screen.getByText('EW Canvas AI')).toBeInTheDocument();
  });
});
