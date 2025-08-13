import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';
import { toast } from 'sonner';

// Common API error types
export enum API_ERROR_CODES {
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  VALIDATION_ERROR = 422,
  INTERNAL_ERROR = 500,
}

// Custom API Error class
export class ApiError extends Error {
  constructor(
    message: string,
    public code: API_ERROR_CODES,
    public details?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Common API call wrapper with error handling
export async function apiCall<T>(
  operation: () => Promise<T>,
  operationName: string
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    console.error(`API Error in ${operationName}:`, error);
    
    if (error instanceof ApiError) {
      toast.error(`${operationName}: ${error.message}`);
      throw error;
    }
    
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    toast.error(`${operationName}: ${message}`);
    throw new ApiError(message, API_ERROR_CODES.INTERNAL_ERROR);
  }
}

// Query helper class
export class Query<T> {
  constructor(private query: any) {}

  async executeSingle(): Promise<T> {
    const { data, error } = await this.query;
    
    if (error) {
      throw new ApiError(
        'Database query failed',
        API_ERROR_CODES.INTERNAL_ERROR,
        error.message
      );
    }
    
    if (!data) {
      throw new ApiError(
        'No data found',
        API_ERROR_CODES.NOT_FOUND
      );
    }
    
    return data;
  }

  async executeArray(): Promise<T[]> {
    const { data, error } = await this.query;
    
    if (error) {
      throw new ApiError(
        'Database query failed',
        API_ERROR_CODES.INTERNAL_ERROR,
        error.message
      );
    }
    
    return data || [];
  }
}

// Create a Query instance
export function createQuery<T>(query: any): Query<T> {
  return new Query<T>(query);
}

// Input validation helper
export function validateInput<T>(schema: z.ZodSchema<T>, input: unknown): T {
  try {
    return schema.parse(input);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const message = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      throw new ApiError(
        'Validation failed',
        API_ERROR_CODES.VALIDATION_ERROR,
        message
      );
    }
    throw error;
  }
}

// Get current user profile
export async function getCurrentUserProfile() {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    throw new ApiError(
      'User not authenticated',
      API_ERROR_CODES.UNAUTHORIZED
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (profileError) {
    throw new ApiError(
      'User profile not found',
      API_ERROR_CODES.NOT_FOUND,
      profileError.message
    );
  }

  return { ...user, profile };
}

// Common date helpers
export const dateHelpers = {
  formatForDatabase: (date: Date): string => {
    return date.toISOString();
  },
  
  parseFromDatabase: (dateString: string): Date => {
    return new Date(dateString);
  },
  
  isValidDate: (date: any): boolean => {
    return date instanceof Date && !isNaN(date.getTime());
  },
  
  addDays: (date: Date, days: number): Date => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  },
  
  startOfDay: (date: Date): Date => {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    return result;
  },
  
  endOfDay: (date: Date): Date => {
    const result = new Date(date);
    result.setHours(23, 59, 59, 999);
    return result;
  }
};

// Common validation schemas
export const commonSchemas = {
  uuid: z.string().uuid(),
  email: z.string().email(),
  phone: z.string().min(1),
  currency: z.number().min(0),
  percentage: z.number().min(0).max(100),
  dateString: z.string().datetime(),
};