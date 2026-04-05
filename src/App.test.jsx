import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import App from './App';

describe('Movie Picker App', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders heading', () => {
    render(<App />);
    expect(screen.getByText('Movie Picker')).toBeInTheDocument();
  });

  it('renders subtitle', () => {
    render(<App />);
    expect(
      screen.getByText("Can't decide what to watch tonight? Let us pick for you!"),
    ).toBeInTheDocument();
  });

  it('renders genre filter buttons', () => {
    render(<App />);
    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('Sci-Fi')).toBeInTheDocument();
    expect(screen.getByText('Drama')).toBeInTheDocument();
  });

  it('renders pick button', () => {
    render(<App />);
    expect(screen.getByText('Pick a Movie')).toBeInTheDocument();
  });

  it('shows movie count', () => {
    render(<App />);
    expect(screen.getByText('15 movies available')).toBeInTheDocument();
  });

  it('filters movies by genre', () => {
    render(<App />);
    fireEvent.click(screen.getByText('Sci-Fi'));
    expect(screen.getByText('3 movies available')).toBeInTheDocument();
  });

  it('picks a random movie on button click', () => {
    render(<App />);
    fireEvent.click(screen.getByText('Pick a Movie'));
    expect(screen.getByText('Picking...')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(800);
    });

    expect(screen.getByTestId('movie-card')).toBeInTheDocument();
  });

  it('highlights picked movie in the list', () => {
    render(<App />);
    fireEvent.click(screen.getByText('Pick a Movie'));

    act(() => {
      vi.advanceTimersByTime(800);
    });

    const highlighted = document.querySelector('.highlighted');
    expect(highlighted).toBeInTheDocument();
  });

  it('clears picked movie when genre changes', () => {
    render(<App />);
    fireEvent.click(screen.getByText('Pick a Movie'));

    act(() => {
      vi.advanceTimersByTime(800);
    });

    expect(screen.getByTestId('movie-card')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Drama'));
    expect(screen.queryByTestId('movie-card')).not.toBeInTheDocument();
  });
});
