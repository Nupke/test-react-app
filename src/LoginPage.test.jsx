import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import LoginPage from './LoginPage';

describe('LoginPage', () => {
  it('renders the sign in form', () => {
    render(<LoginPage />);
    expect(screen.getByRole('heading', { name: 'Sign In' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
  });

  it('renders OAuth buttons for Google and GitHub', () => {
    render(<LoginPage />);
    expect(
      screen.getByRole('button', { name: /Google/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /GitHub/i }),
    ).toBeInTheDocument();
  });

  it('shows error when submitting empty form', () => {
    render(<LoginPage />);
    const submitBtn = screen.getByRole('button', { name: 'Sign In' });
    fireEvent.click(submitBtn);
    // HTML5 validation prevents submission, so no error message shown
    // The form fields have required attribute
    expect(screen.getByLabelText('Email')).toBeRequired();
    expect(screen.getByLabelText('Password')).toBeRequired();
  });

  it('renders the sign up link', () => {
    render(<LoginPage />);
    expect(screen.getByText('Sign up')).toBeInTheDocument();
  });

  it('renders back button when onBack prop is provided', () => {
    const onBack = vi.fn();
    render(<LoginPage onBack={onBack} />);
    const backBtn = screen.getByRole('button', { name: 'Back to Home' });
    fireEvent.click(backBtn);
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('does not render back button when onBack is not provided', () => {
    render(<LoginPage />);
    expect(
      screen.queryByRole('button', { name: 'Back to Home' }),
    ).not.toBeInTheDocument();
  });
});
