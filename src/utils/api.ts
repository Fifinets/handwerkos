// API utilities and error handling for HandwerkOS
// Provides consistent error handling, request ID logging, and response formatting

import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import type { ApiResponse, ApiSuccessResponse, ApiErrorResponse } from '@/types/core';

// Error codes for consistent API error handling
export const API_ERROR_CODES = {
  // Authentication & Authorization
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  INVALID_TOKEN: 'INVALID_TOKEN',
  
  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  
  // Business Logic
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  RESOURCE_ALREADY_EXISTS: 'RESOURCE_ALREADY_EXISTS',
  BUSINESS_RULE_VIOLATION: 'BUSINESS_RULE_VIOLATION',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  
  // GoBD Compliance
  IMMUTABLE_RECORD: 'IMMUTABLE_RECORD',
  AUDIT_REQUIRED: 'AUDIT_REQUIRED',
  DOCUMENT_LOCKED: 'DOCUMENT_LOCKED',
  RETENTION_PERIOD_ACTIVE: 'RETENTION_PERIOD_ACTIVE',
  
  // System
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
} as const;

export type ApiErrorCode = typeof API_ERROR_CODES[keyof typeof API_ERROR_CODES];

// Custom error class for API errors
export class ApiError extends Error {
  constructor(
    public code: ApiErrorCode,
    message: string,
    public details?: any,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Request ID generator for tracing
export const generateRequestId = (): string => {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Success response formatter
export const createSuccessResponse = <T>(
  data: T,
  message?: string
): ApiSuccessResponse<T> => ({
  success: true,
  data,
  message,
});

// Error response formatter
export const createErrorResponse = (
  error: ApiError | Error | string,
  requestId?: string
): ApiErrorResponse => {
  if (error instanceof ApiError) {
    return {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: {
          ...error.details,
          requestId,
          timestamp: new Date().toISOString(),
        },
      },
    };
  }
  
  if (error instanceof Error) {
    return {
      success: false,
      error: {
        code: API_ERROR_CODES.INTERNAL_ERROR,
        message: error.message,
        details: {
          requestId,
          timestamp: new Date().toISOString(),
        },
      },
    };
  }
  
  return {
    success: false,
    error: {
      code: API_ERROR_CODES.INTERNAL_ERROR,
      message: typeof error === 'string' ? error : 'Unknown error occurred',
      details: {
        requestId,
        timestamp: new Date().toISOString(),
      },
    },
  };
};

// Zod validation helper
export const validateInput = <T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  errorMessage?: string
): T => {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ApiError(
        API_ERROR_CODES.VALIDATION_ERROR,
        errorMessage || 'Input validation failed',
        {
          validationErrors: error.errors,
          receivedData: data,
        }
      );
    }
    throw error;
  }
};

// Supabase error handler
export const handleSupabaseError = (error: any): never => {
  console.error('Supabase error:', error);
  
  if (error.code === 'PGRST116') {
    throw new ApiError(
      API_ERROR_CODES.FORBIDDEN,
      'Insufficient permissions to access this resource',
      { supabaseCode: error.code }
    );
  }
  
  if (error.code === '23505') {
    throw new ApiError(
      API_ERROR_CODES.RESOURCE_ALREADY_EXISTS,
      'Resource already exists',
      { supabaseCode: error.code, constraint: error.constraint }
    );
  }
  
  if (error.code === '23503') {
    throw new ApiError(
      API_ERROR_CODES.BUSINESS_RULE_VIOLATION,
      'Referenced resource does not exist',
      { supabaseCode: error.code, constraint: error.constraint }
    );
  }
  
  throw new ApiError(
    API_ERROR_CODES.DATABASE_ERROR,
    error.message || 'Database operation failed',
    { supabaseError: error }
  );
};

// Generic API call wrapper
export async function apiCall<T>(
  operation: () => Promise<T>,
  context?: string
): Promise<T> {
  const requestId = generateRequestId();
  
  try {
    console.log(`[${requestId}] Starting API operation: ${context || 'Unknown'}`);
    const result = await operation();
    console.log(`[${requestId}] API operation completed successfully`);
    return result;
  } catch (error) {
    console.error(`[${requestId}] API operation failed:`, error);
    
    if (error instanceof ApiError) {
      throw error;
    }
    
    if (error && typeof error === 'object' && 'code' in error) {
      handleSupabaseError(error);
    }
    
    throw new ApiError(
      API_ERROR_CODES.INTERNAL_ERROR,
      error instanceof Error ? error.message : 'Unknown error occurred',
      { requestId, originalError: error }
    );
  }
}

// Supabase query builder with error handling
export class ApiQueryBuilder<T> {
  private query: any;
  private requestId: string;
  
  constructor(query: any) {
    this.query = query;
    this.requestId = generateRequestId();
  }
  
  async execute(): Promise<T[]> {
    return apiCall(async () => {
      const { data, error } = await this.query;
      if (error) {
        handleSupabaseError(error);
      }
      return data || [];
    }, `Query execution [${this.requestId}]`);
  }
  
  async executeSingle(): Promise<T> {
    return apiCall(async () => {
      const { data, error } = await this.query.single();
      if (error) {
        if (error.code === 'PGRST116') {
          throw new ApiError(
            API_ERROR_CODES.RESOURCE_NOT_FOUND,
            'Resource not found'
          );
        }
        handleSupabaseError(error);
      }
      return data;
    }, `Single query execution [${this.requestId}]`);
  }
  
  async executeWithCount(): Promise<{ data: T[]; count: number }> {
    return apiCall(async () => {
      const { data, error, count } = await this.query;
      if (error) {
        handleSupabaseError(error);
      }
      return { data: data || [], count: count || 0 };
    }, `Query with count execution [${this.requestId}]`);
  }
}

// Create query builder
export const createQuery = <T>(query: any): ApiQueryBuilder<T> => {
  return new ApiQueryBuilder<T>(query);
};

// Authentication helpers
export const getCurrentUser = async () => {
  return apiCall(async () => {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) {
      throw new ApiError(
        API_ERROR_CODES.UNAUTHORIZED,
        'Authentication required'
      );
    }
    if (!user) {
      throw new ApiError(
        API_ERROR_CODES.UNAUTHORIZED,
        'User not authenticated'
      );
    }
    return user;
  }, 'Get current user');
};

export const getCurrentUserProfile = async () => {
  return apiCall(async () => {
    const user = await getCurrentUser();
    
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    
    if (error) {
      handleSupabaseError(error);
    }
    
    return profile;
  }, 'Get current user profile');
};

// Rate limiting helper (client-side)
const requestCounters = new Map<string, { count: number; resetAt: number }>();

export const checkRateLimit = (
  identifier: string,
  limit: number = 100,
  windowMs: number = 60000 // 1 minute
): void => {
  const now = Date.now();
  const counter = requestCounters.get(identifier);
  
  if (!counter || counter.resetAt <= now) {
    requestCounters.set(identifier, { count: 1, resetAt: now + windowMs });
    return;
  }
  
  if (counter.count >= limit) {
    throw new ApiError(
      API_ERROR_CODES.RATE_LIMIT_EXCEEDED,
      'Rate limit exceeded. Please try again later.',
      { 
        limit,
        resetAt: new Date(counter.resetAt).toISOString(),
      }
    );
  }
  
  counter.count++;
};

// Retry logic for failed requests
export const withRetry = async <T>(
  operation: () => Promise<T>,
  maxAttempts: number = 3,
  delayMs: number = 1000
): Promise<T> => {
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      // Don't retry on validation errors or business logic errors
      if (error instanceof ApiError && [
        API_ERROR_CODES.VALIDATION_ERROR,
        API_ERROR_CODES.BUSINESS_RULE_VIOLATION,
        API_ERROR_CODES.UNAUTHORIZED,
        API_ERROR_CODES.FORBIDDEN,
      ].includes(error.code)) {
        throw error;
      }
      
      if (attempt === maxAttempts) {
        break;
      }
      
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
    }
  }
  
  throw lastError;
};

// Type-safe localStorage wrapper
export const storage = {
  get<T>(key: string, defaultValue?: T): T | null {
    try {
      const item = localStorage.getItem(key);
      if (!item) return defaultValue || null;
      return JSON.parse(item) as T;
    } catch {
      return defaultValue || null;
    }
  },
  
  set<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error('Failed to save to localStorage:', error);
    }
  },
  
  remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Failed to remove from localStorage:', error);
    }
  },
  
  clear(): void {
    try {
      localStorage.clear();
    } catch (error) {
      console.error('Failed to clear localStorage:', error);
    }
  },
};