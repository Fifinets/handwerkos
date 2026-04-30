import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ApprovalCard } from './ApprovalCard';

describe('ApprovalCard', () => {
  const baseProps = {
    taskId: 'task-1',
    preview: {
      customer: 'Müller GmbH',
      projectName: 'Zählertausch',
      gesamtNetto: 555,
      positionsAnzahl: 2,
    },
    agentMessage: 'Angebot erstellt.',
    onApprove: vi.fn(),
    onNavigateToOffers: vi.fn(),
  };

  it('renders customer and project name from preview', () => {
    render(<ApprovalCard {...baseProps} />);
    expect(screen.getByText(/Müller GmbH/)).toBeInTheDocument();
    expect(screen.getByText(/Zählertausch/)).toBeInTheDocument();
  });

  it('renders the formatted total net amount', () => {
    render(<ApprovalCard {...baseProps} />);
    expect(screen.getByText(/555/)).toBeInTheDocument();
    expect(screen.getByText(/netto/i)).toBeInTheDocument();
  });

  it('renders the agent message', () => {
    render(<ApprovalCard {...baseProps} />);
    expect(screen.getByText('Angebot erstellt.')).toBeInTheDocument();
  });

  it('clicking Freigeben calls onApprove with taskId', () => {
    const onApprove = vi.fn();
    render(<ApprovalCard {...baseProps} onApprove={onApprove} />);
    fireEvent.click(screen.getByRole('button', { name: /freigeben/i }));
    expect(onApprove).toHaveBeenCalledWith('task-1');
  });

  it('clicking Ansehen calls onNavigateToOffers', () => {
    const onNavigateToOffers = vi.fn();
    render(<ApprovalCard {...baseProps} onNavigateToOffers={onNavigateToOffers} />);
    fireEvent.click(screen.getByRole('button', { name: /ansehen/i }));
    expect(onNavigateToOffers).toHaveBeenCalled();
  });

  it('when alreadyApproved is true, Freigeben button is disabled', () => {
    render(<ApprovalCard {...baseProps} alreadyApproved={true} />);
    expect(screen.getByRole('button', { name: /freigegeben/i })).toBeDisabled();
  });

  it('shows fallback text when preview fields are missing', () => {
    render(<ApprovalCard {...baseProps} preview={{}} />);
    expect(screen.getByText(/freigeben/i)).toBeInTheDocument();
  });
});
