import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AgentChatView } from './AgentChatView';
import * as useAgentChatModule from '@/hooks/useAgentChat';

describe('AgentChatView', () => {
  const onNavigateToOffers = vi.fn();
  const sendMessage = vi.fn();
  const approve = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function mockHook(messages: useAgentChatModule.AgentMessage[], isLoading = false) {
    vi.spyOn(useAgentChatModule, 'useAgentChat').mockReturnValue({
      messages,
      isLoading,
      sendMessage,
      approve,
    });
  }

  it('renders the placeholder when no messages', () => {
    mockHook([]);
    render(<AgentChatView onNavigateToOffers={onNavigateToOffers} />);
    expect(screen.getByText(/wie kann ich helfen/i)).toBeInTheDocument();
  });

  it('renders user and agent messages with correct roles', () => {
    mockHook([
      { id: 'm1', role: 'user', content: 'Erstelle Angebot' },
      { id: 'm2', role: 'agent', content: 'Analysiere…', status: 'running' },
    ]);
    render(<AgentChatView onNavigateToOffers={onNavigateToOffers} />);
    expect(screen.getByText('Erstelle Angebot')).toBeInTheDocument();
    expect(screen.getByText('Analysiere…')).toBeInTheDocument();
  });

  it('renders ApprovalCard when an agent message is awaiting_approval', () => {
    mockHook([
      {
        id: 'm1',
        role: 'agent',
        content: 'Angebot erstellt',
        status: 'awaiting_approval',
        taskId: 'task-1',
        preview: { customer: 'Müller GmbH' },
        agentMessage: 'Angebot erstellt.',
      },
    ]);
    render(<AgentChatView onNavigateToOffers={onNavigateToOffers} />);
    expect(screen.getByText(/Müller GmbH/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /freigeben/i })).toBeInTheDocument();
  });

  it('clicking the send button calls sendMessage with the input value', () => {
    mockHook([]);
    render(<AgentChatView onNavigateToOffers={onNavigateToOffers} />);
    const input = screen.getByPlaceholderText(/Nachricht/i);
    fireEvent.change(input, { target: { value: 'Test-Nachricht' } });
    fireEvent.click(screen.getByRole('button', { name: /senden/i }));
    expect(sendMessage).toHaveBeenCalledWith('Test-Nachricht');
  });

  it('Enter in input sends message, Shift+Enter does not', () => {
    mockHook([]);
    render(<AgentChatView onNavigateToOffers={onNavigateToOffers} />);
    const input = screen.getByPlaceholderText(/Nachricht/i);
    fireEvent.change(input, { target: { value: 'Hi' } });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });
    expect(sendMessage).toHaveBeenCalledWith('Hi');

    sendMessage.mockClear();
    fireEvent.change(input, { target: { value: 'Multi\nline' } });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('input is disabled while isLoading=true', () => {
    mockHook([], true);
    render(<AgentChatView onNavigateToOffers={onNavigateToOffers} />);
    expect(screen.getByPlaceholderText(/Nachricht/i)).toBeDisabled();
  });

  it('clicking Freigeben in ApprovalCard calls approve(taskId)', () => {
    mockHook([
      {
        id: 'm1',
        role: 'agent',
        content: 'Angebot erstellt',
        status: 'awaiting_approval',
        taskId: 'task-1',
        preview: { customer: 'X' },
      },
    ]);
    render(<AgentChatView onNavigateToOffers={onNavigateToOffers} />);
    fireEvent.click(screen.getByRole('button', { name: /freigeben/i }));
    expect(approve).toHaveBeenCalledWith('task-1');
  });
});
