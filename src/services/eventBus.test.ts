import { describe, it, expect, vi, beforeEach } from 'vitest';

// We need to mock the supabase import before importing eventBus
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  },
}));

// Import a fresh EventBus class for each test by re-importing
// The module exports a singleton, so we'll work with it directly
import { eventBus, type EventType, type EventData } from './eventBus';

describe('EventBus', () => {
  beforeEach(() => {
    // Clear all subscriptions by unsubscribing everything
    // We use getSubscriptionCount to verify cleanup
    eventBus.clearHistory();
  });

  describe('on (subscribe)', () => {
    it('returns a subscription id string', () => {
      const id = eventBus.on('CUSTOMER_CREATED', () => {});
      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
      expect(id.startsWith('sub_')).toBe(true);
      eventBus.off(id);
    });

    it('registers a handler that gets called on emit', async () => {
      const handler = vi.fn();
      const id = eventBus.on('CUSTOMER_CREATED', handler);

      await eventBus.emit('CUSTOMER_CREATED', { user_id: 'u1' });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ user_id: 'u1' })
      );
      eventBus.off(id);
    });

    it('does not call handler for different event types', async () => {
      const handler = vi.fn();
      const id = eventBus.on('CUSTOMER_CREATED', handler);

      await eventBus.emit('CUSTOMER_UPDATED', { user_id: 'u1' });

      expect(handler).not.toHaveBeenCalled();
      eventBus.off(id);
    });
  });

  describe('off (unsubscribe)', () => {
    it('removes a subscription so handler is no longer called', async () => {
      const handler = vi.fn();
      const id = eventBus.on('CUSTOMER_DELETED', handler);

      eventBus.off(id);

      await eventBus.emit('CUSTOMER_DELETED', {});

      expect(handler).not.toHaveBeenCalled();
    });

    it('does not throw when unsubscribing a non-existent id', () => {
      expect(() => eventBus.off('nonexistent_id_12345')).not.toThrow();
    });

    it('only removes the targeted subscription, not others for the same event', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const id1 = eventBus.on('ORDER_CREATED', handler1);
      const id2 = eventBus.on('ORDER_CREATED', handler2);

      eventBus.off(id1);

      await eventBus.emit('ORDER_CREATED', {});

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledTimes(1);
      eventBus.off(id2);
    });
  });

  describe('once', () => {
    it('fires the handler only once then auto-removes', async () => {
      const handler = vi.fn();
      eventBus.once('PROJECT_CREATED', handler);

      await eventBus.emit('PROJECT_CREATED', { id: '1' });
      await eventBus.emit('PROJECT_CREATED', { id: '2' });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ id: '1' })
      );
    });
  });

  describe('emit', () => {
    it('adds a timestamp if not provided', async () => {
      const handler = vi.fn();
      const id = eventBus.on('USER_LOGIN', handler);

      await eventBus.emit('USER_LOGIN', {});

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: expect.any(String),
        })
      );
      eventBus.off(id);
    });

    it('preserves a provided timestamp', async () => {
      const handler = vi.fn();
      const id = eventBus.on('USER_LOGOUT', handler);
      const ts = '2024-01-15T10:00:00.000Z';

      await eventBus.emit('USER_LOGOUT', { timestamp: ts });

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ timestamp: ts })
      );
      eventBus.off(id);
    });

    it('passes event data to all listeners', async () => {
      const data: EventData = { user_id: 'u1', name: 'Test', extra: 42 };
      const handler = vi.fn();
      const id = eventBus.on('MATERIAL_CREATED', handler);

      await eventBus.emit('MATERIAL_CREATED', data);

      const receivedData = handler.mock.calls[0][0];
      expect(receivedData.user_id).toBe('u1');
      expect(receivedData.name).toBe('Test');
      expect(receivedData.extra).toBe(42);
      eventBus.off(id);
    });

    it('handles errors in handlers without breaking other handlers', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const errorHandler = vi.fn().mockImplementation(() => {
        throw new Error('handler error');
      });
      const goodHandler = vi.fn();

      const id1 = eventBus.on('EXPENSE_CREATED', errorHandler);
      const id2 = eventBus.on('EXPENSE_CREATED', goodHandler);

      await eventBus.emit('EXPENSE_CREATED', {});

      expect(errorHandler).toHaveBeenCalledTimes(1);
      expect(goodHandler).toHaveBeenCalledTimes(1);

      consoleSpy.mockRestore();
      eventBus.off(id1);
      eventBus.off(id2);
    });
  });

  describe('multiple listeners', () => {
    it('calls all listeners for the same event', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const handler3 = vi.fn();

      const id1 = eventBus.on('INVOICE_CREATED', handler1);
      const id2 = eventBus.on('INVOICE_CREATED', handler2);
      const id3 = eventBus.on('INVOICE_CREATED', handler3);

      await eventBus.emit('INVOICE_CREATED', { amount: 100 });

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
      expect(handler3).toHaveBeenCalledTimes(1);

      eventBus.off(id1);
      eventBus.off(id2);
      eventBus.off(id3);
    });

    it('each listener receives the same data', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      const id1 = eventBus.on('INVOICE_UPDATED', handler1);
      const id2 = eventBus.on('INVOICE_UPDATED', handler2);

      await eventBus.emit('INVOICE_UPDATED', { invoice_id: 'inv-1' });

      expect(handler1.mock.calls[0][0].invoice_id).toBe('inv-1');
      expect(handler2.mock.calls[0][0].invoice_id).toBe('inv-1');

      eventBus.off(id1);
      eventBus.off(id2);
    });
  });

  describe('getHistory', () => {
    it('records emitted events in history', async () => {
      await eventBus.emit('BACKUP_CREATED', { backup_id: 'b1' });

      const history = eventBus.getHistory('BACKUP_CREATED');
      expect(history.length).toBeGreaterThanOrEqual(1);

      const lastEntry = history[history.length - 1];
      expect(lastEntry.event).toBe('BACKUP_CREATED');
      expect(lastEntry.data.backup_id).toBe('b1');
    });

    it('filters history by event type', async () => {
      await eventBus.emit('DOCUMENT_UPLOADED', { doc_id: 'd1' });
      await eventBus.emit('DOCUMENT_DELETED', { doc_id: 'd2' });

      const uploaded = eventBus.getHistory('DOCUMENT_UPLOADED');
      const deleted = eventBus.getHistory('DOCUMENT_DELETED');

      const uploadedLast = uploaded[uploaded.length - 1];
      const deletedLast = deleted[deleted.length - 1];

      expect(uploadedLast.data.doc_id).toBe('d1');
      expect(deletedLast.data.doc_id).toBe('d2');
    });

    it('limits history results', async () => {
      await eventBus.emit('AUDIT_LOG_CREATED', { id: '1' });
      await eventBus.emit('AUDIT_LOG_CREATED', { id: '2' });
      await eventBus.emit('AUDIT_LOG_CREATED', { id: '3' });

      const limited = eventBus.getHistory('AUDIT_LOG_CREATED', 2);
      expect(limited.length).toBe(2);
    });

    it('returns all history when no event filter is provided', async () => {
      const allHistory = eventBus.getHistory();
      expect(Array.isArray(allHistory)).toBe(true);
    });
  });

  describe('clearHistory', () => {
    it('empties the event history', async () => {
      await eventBus.emit('SYSTEM_ERROR', { error: 'test' });
      eventBus.clearHistory();

      const history = eventBus.getHistory();
      expect(history.length).toBe(0);
    });
  });

  describe('getSubscriptionCount', () => {
    it('returns 0 for events with no subscriptions', () => {
      expect(eventBus.getSubscriptionCount('STOCK_TRANSFER_CREATED')).toBe(0);
    });

    it('returns correct count for a specific event', () => {
      const id1 = eventBus.on('STOCK_RECEIVED', () => {});
      const id2 = eventBus.on('STOCK_RECEIVED', () => {});

      expect(eventBus.getSubscriptionCount('STOCK_RECEIVED')).toBe(2);

      eventBus.off(id1);
      eventBus.off(id2);
    });

    it('returns total count when no event is specified', () => {
      const initialCount = eventBus.getSubscriptionCount();
      const id = eventBus.on('STOCK_CONSUMED', () => {});

      expect(eventBus.getSubscriptionCount()).toBe(initialCount + 1);

      eventBus.off(id);
    });
  });
});
