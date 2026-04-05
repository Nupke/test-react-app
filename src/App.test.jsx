import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from './App';

describe('App', () => {
  it('renders heading', () => {
    render(<App />);
    expect(screen.getByText('Test React App')).toBeInTheDocument();
  });

  it('renders description', () => {
    render(<App />);
    expect(screen.getByText('SDLC Pipeline Validation Project')).toBeInTheDocument();
  });

  it('increments counter on click', () => {
    render(<App />);
    const button = screen.getByRole('button');
    expect(button).toHaveTextContent('Count: 0');
    fireEvent.click(button);
    expect(button).toHaveTextContent('Count: 1');
  });
});
