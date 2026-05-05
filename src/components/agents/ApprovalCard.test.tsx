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
      assignedEmployee: 'Hans Schmidt',
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

  it('renders the assigned employee', () => {
    render(<ApprovalCard {...baseProps} />);
    expect(screen.getByText(/Hans Schmidt/)).toBeInTheDocument();
    expect(screen.getByText(/änderbar/i)).toBeInTheDocument();
  });

  it('makes clear no auto-send happens', () => {
    render(<ApprovalCard {...baseProps} />);
    expect(screen.getByText(/verschickt nichts selbstständig/i)).toBeInTheDocument();
  });

  it('clicking Übernommen calls onApprove with taskId', () => {
    const onApprove = vi.fn();
    render(<ApprovalCard {...baseProps} onApprove={onApprove} />);
    fireEvent.click(screen.getByRole('button', { name: /übernommen/i }));
    expect(onApprove).toHaveBeenCalledWith('task-1');
  });

  it('clicking Zum Bearbeiten calls onNavigateToOffers', () => {
    const onNavigateToOffers = vi.fn();
    render(<ApprovalCard {...baseProps} onNavigateToOffers={onNavigateToOffers} />);
    fireEvent.click(screen.getByRole('button', { name: /bearbeiten/i }));
    expect(onNavigateToOffers).toHaveBeenCalled();
  });

  it('when alreadyApproved is true, Übernommen button is disabled', () => {
    render(<ApprovalCard {...baseProps} alreadyApproved={true} />);
    expect(screen.getByRole('button', { name: /übernommen/i })).toBeDisabled();
  });

  it('renders without crashing when preview fields are missing', () => {
    render(<ApprovalCard {...baseProps} preview={{}} />);
    // Both buttons still rendered
    expect(screen.getByRole('button', { name: /übernommen/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /bearbeiten/i })).toBeInTheDocument();
  });
});
