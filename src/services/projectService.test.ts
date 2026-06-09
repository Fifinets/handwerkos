import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockFrom,
  mockSelect,
  mockEq,
  mockNeq,
  mockOrder,
  mockRange,
  mockContains,
  mockSingle,
  mockAuthGetUser,
} = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockSelect: vi.fn().mockReturnThis(),
  mockEq: vi.fn().mockReturnThis(),
  mockNeq: vi.fn().mockReturnThis(),
  mockOrder: vi.fn(),
  mockRange: vi.fn().mockReturnThis(),
  mockContains: vi.fn().mockReturnThis(),
  mockSingle: vi.fn(),
  mockAuthGetUser: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: any[]) => {
      mockFrom(...args);
      return {
        select: mockSelect,
        eq: mockEq,
        neq: mockNeq,
        order: mockOrder,
        range: mockRange,
        contains: mockContains,
        single: mockSingle,
      };
    },
    auth: {
      getUser: mockAuthGetUser,
    },
  },
}));

vi.mock('@/utils/api', () => ({
  apiCall: vi.fn(async (fn: () => Promise<any>) => fn()),
  validateInput: vi.fn((_schema: any, data: any) => data),
  ApiError: class ApiError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
  API_ERROR_CODES: {
    BUSINESS_RULE_VIOLATION: 'BUSINESS_RULE_VIOLATION',
  },
}));

vi.mock('./eventBus', () => ({
  eventBus: { emit: vi.fn() },
}));

import { ProjectService } from './projectService';

describe('ProjectService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnThis();
    mockEq.mockReturnThis();
    mockNeq.mockReturnThis();
    mockRange.mockReturnThis();
    mockContains.mockReturnThis();
    mockAuthGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
  });

  describe('getProjects', () => {
    it('filters projects by the current user company', async () => {
      mockSingle.mockResolvedValueOnce({
        data: { company_id: 'company-1' },
        error: null,
      });
      mockOrder.mockResolvedValueOnce({
        data: [{ id: 'project-1', name: 'Eigene Baustelle', company_id: 'company-1' }],
        error: null,
        count: 1,
      });

      const result = await ProjectService.getProjects();

      expect(mockFrom).toHaveBeenCalledWith('profiles');
      expect(mockEq).toHaveBeenCalledWith('company_id', 'company-1');
      expect(result.items).toHaveLength(1);
    });
  });
});
