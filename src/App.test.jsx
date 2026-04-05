import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from './App';

describe('App', () => {
  it('renders the hero title', () => {
    render(<App />);
    expect(screen.getByText(/Your Personal/)).toBeInTheDocument();
    expect(screen.getByText(/Weather Companion/)).toBeInTheDocument();
  });

  it('renders the Weather App badge', () => {
    render(<App />);
    expect(screen.getByText('Weather App')).toBeInTheDocument();
  });

  it('renders all four feature cards', () => {
    render(<App />);
    expect(screen.getByText('Real-Time Forecasts')).toBeInTheDocument();
    expect(screen.getByText('Location-Based')).toBeInTheDocument();
    expect(screen.getByText('Severe Weather Alerts')).toBeInTheDocument();
    expect(screen.getByText('7-Day Forecast')).toBeInTheDocument();
  });

  it('shows success message after email submission', () => {
    render(<App />);
    const input = screen.getByPlaceholderText('Enter your email');
    const button = screen.getByRole('button', { name: 'Get Early Access' });

    fireEvent.change(input, { target: { value: 'test@example.com' } });
    fireEvent.click(button);

    expect(screen.getByRole('status')).toHaveTextContent(
      "Thanks! We'll notify you at test@example.com when we launch.",
    );
  });

  it('renders the footer', () => {
    render(<App />);
    expect(screen.getByText(/2026 Weather App/)).toBeInTheDocument();
  });
});
