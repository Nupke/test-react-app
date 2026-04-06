import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ProfilePage from './ProfilePage';

describe('ProfilePage', () => {
  it('renders user avatar with initials', () => {
    render(<ProfilePage />);
    expect(screen.getByLabelText('User avatar')).toHaveTextContent('JD');
  });

  it('renders user name and email', () => {
    render(<ProfilePage />);
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('jane.doe@example.com')).toBeInTheDocument();
  });

  it('renders personal info form fields', () => {
    render(<ProfilePage />);
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('renders account settings toggles', () => {
    render(<ProfilePage />);
    expect(screen.getByText('Email Notifications')).toBeInTheDocument();
    expect(screen.getByText('Dark Mode')).toBeInTheDocument();
    expect(screen.getByLabelText('Temperature unit')).toBeInTheDocument();
  });

  it('toggles notification switch', () => {
    render(<ProfilePage />);
    const notifToggle = screen.getAllByRole('switch')[0];
    expect(notifToggle).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(notifToggle);
    expect(notifToggle).toHaveAttribute('aria-checked', 'false');
  });

  it('shows success message on save', () => {
    render(<ProfilePage />);
    const saveBtn = screen.getByRole('button', { name: 'Save Changes' });
    fireEvent.click(saveBtn);
    expect(screen.getByText('Settings saved successfully!')).toBeInTheDocument();
  });

  it('calls onBack when back button clicked', () => {
    const onBack = vi.fn();
    render(<ProfilePage onBack={onBack} />);
    const backBtn = screen.getByRole('button', { name: 'Back to Home' });
    fireEvent.click(backBtn);
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('does not render back button when onBack is not provided', () => {
    render(<ProfilePage />);
    expect(
      screen.queryByRole('button', { name: 'Back to Home' }),
    ).not.toBeInTheDocument();
  });
});
