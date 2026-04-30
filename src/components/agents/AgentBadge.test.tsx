import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AgentBadge } from './AgentBadge';

describe('AgentBadge', () => {
  it('renders the KI label', () => {
    render(<AgentBadge />);
    expect(screen.getByText('KI')).toBeInTheDocument();
  });

  it('has aria-label for accessibility', () => {
    render(<AgentBadge />);
    expect(screen.getByLabelText(/KI-erstellt/i)).toBeInTheDocument();
  });

  it('respects optional className prop', () => {
    const { container } = render(<AgentBadge className="custom-x" />);
    expect(container.firstChild).toHaveClass('custom-x');
  });
});
