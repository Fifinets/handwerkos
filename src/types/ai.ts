// AI Features DTOs and Zod schemas for HandwerkOS
// Supports AI-powered intent parsing, estimates, and suggestions

import { z } from 'zod';

// AI Suggestion schemas
export const AiSuggestionCreateSchema = z.object({
  project_id: z.string().uuid().optional(),
  suggestion_type: z.enum(['parse_intent', 'estimate', 'schedule', 'material_list', 'cost_breakdown', 'timeline']),
  input_data: z.record(z.any()).refine((data) => Object.keys(data).length > 0, 'Input data is required'),
  output_data: z.record(z.any()).refine((data) => Object.keys(data).length > 0, 'Output data is required'),
  confidence_score: z.number().min(0).max(1).optional(),
  model_version: z.string().optional(),
  trace_id: z.string().uuid().optional(),
});

export const AiSuggestionUpdateSchema = AiSuggestionCreateSchema.partial().extend({
  status: z.enum(['active', 'applied', 'rejected', 'superseded']).optional(),
  applied_by: z.string().uuid().optional(),
  applied_at: z.string().datetime().optional(),
  feedback_score: z.number().int().min(1).max(5).optional(),
  feedback_notes: z.string().optional(),
});

export const AiSuggestionSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid().optional(),
  suggestion_type: z.enum(['parse_intent', 'estimate', 'schedule', 'material_list', 'cost_breakdown', 'timeline']),
  input_data: z.record(z.any()),
  output_data: z.record(z.any()),
  confidence_score: z.number().min(0).max(1).optional(),
  model_version: z.string().optional(),
  trace_id: z.string().uuid().optional(),
  status: z.enum(['active', 'applied', 'rejected', 'superseded']).default('active'),
  applied_by: z.string().uuid().optional(),
  applied_at: z.string().datetime().optional(),
  feedback_score: z.number().int().min(1).max(5).optional(),
  feedback_notes: z.string().optional(),
  company_id: z.string().uuid().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

// AI Index schemas for RAG
export const AiIndexCreateSchema = z.object({
  ref_type: z.string().min(1, 'Reference type is required'),
  ref_id: z.string().uuid('Valid reference ID required'),
  content_text: z.string().min(1, 'Content text is required'),
  metadata: z.record(z.any()).optional(),
});

export const AiIndexSchema = z.object({
  id: z.string().uuid(),
  ref_type: z.string(),
  ref_id: z.string().uuid(),
  content_text: z.string(),
  embedding: z.array(z.number()).optional(), // Vector embedding
  metadata: z.record(z.any()).optional(),
  indexed_at: z.string().datetime(),
  company_id: z.string().uuid().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

// AI Processing Queue schemas
export const AiProcessingQueueCreateSchema = z.object({
  operation_type: z.enum(['index_content', 'generate_estimate', 'create_schedule', 'extract_intent']),
  entity_type: z.string().min(1, 'Entity type is required'),
  entity_id: z.string().uuid('Valid entity ID required'),
  input_data: z.record(z.any()).refine((data) => Object.keys(data).length > 0, 'Input data is required'),
  priority: z.number().int().min(1).max(10).default(5),
  scheduled_for: z.string().datetime().optional(),
});

export const AiProcessingQueueSchema = z.object({
  id: z.string().uuid(),
  operation_type: z.enum(['index_content', 'generate_estimate', 'create_schedule', 'extract_intent']),
  entity_type: z.string(),
  entity_id: z.string().uuid(),
  input_data: z.record(z.any()),
  priority: z.number().int().min(1).max(10).default(5),
  status: z.enum(['pending', 'processing', 'completed', 'failed']).default('pending'),
  attempts: z.number().int().min(0).default(0),
  max_attempts: z.number().int().min(1).default(3),
  error_message: z.string().optional(),
  result_data: z.record(z.any()).optional(),
  scheduled_for: z.string().datetime(),
  started_at: z.string().datetime().optional(),
  completed_at: z.string().datetime().optional(),
  company_id: z.string().uuid().optional(),
  created_at: z.string().datetime(),
});

// AI Training Data schemas
export const AiTrainingDataCreateSchema = z.object({
  data_type: z.enum(['estimate_correction', 'schedule_feedback', 'material_suggestion', 'cost_actual_vs_predicted']),
  input_features: z.record(z.any()).refine((data) => Object.keys(data).length > 0, 'Input features required'),
  expected_output: z.record(z.any()).refine((data) => Object.keys(data).length > 0, 'Expected output required'),
  predicted_output: z.record(z.any()).optional(),
  prediction_error: z.number().optional(),
  project_id: z.string().uuid().optional(),
  suggestion_id: z.string().uuid().optional(),
});

export const AiTrainingDataSchema = z.object({
  id: z.string().uuid(),
  data_type: z.enum(['estimate_correction', 'schedule_feedback', 'material_suggestion', 'cost_actual_vs_predicted']),
  input_features: z.record(z.any()),
  expected_output: z.record(z.any()),
  predicted_output: z.record(z.any()).optional(),
  prediction_error: z.number().optional(),
  project_id: z.string().uuid().optional(),
  suggestion_id: z.string().uuid().optional(),
  company_id: z.string().uuid().optional(),
  created_at: z.string().datetime(),
});

// AI API Request/Response schemas for specific operations
export const ParseIntentRequestSchema = z.object({
  text: z.string().min(1, 'Text content is required'),
  context: z.object({
    customer_info: z.string().optional(),
    previous_projects: z.array(z.string()).optional(),
    preferred_materials: z.array(z.string()).optional(),
  }).optional(),
});

export const ParseIntentResponseSchema = z.object({
  intent_type: z.enum(['quote_request', 'project_inquiry', 'maintenance', 'consultation', 'emergency']),
  confidence: z.number().min(0).max(1),
  extracted_data: z.object({
    customer_name: z.string().optional(),
    project_type: z.string().optional(),
    description: z.string().optional(),
    urgency: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
    budget_range: z.object({
      min: z.number().optional(),
      max: z.number().optional(),
    }).optional(),
    timeline: z.object({
      start_date: z.string().date().optional(),
      end_date: z.string().date().optional(),
      duration_days: z.number().optional(),
    }).optional(),
    materials: z.array(z.object({
      name: z.string(),
      quantity: z.number().optional(),
      unit: z.string().optional(),
    })).optional(),
  }),
  suggestions: z.array(z.string()).optional(),
});

export const GenerateEstimateRequestSchema = z.object({
  project_description: z.string().min(1, 'Project description is required'),
  project_type: z.string().optional(),
  customer_id: z.string().uuid().optional(),
  timeline: z.object({
    start_date: z.string().date().optional(),
    duration_days: z.number().min(1).optional(),
  }).optional(),
  requirements: z.array(z.string()).optional(),
  similar_projects: z.array(z.string().uuid()).optional(),
});

export const GenerateEstimateResponseSchema = z.object({
  confidence: z.number().min(0).max(1),
  total_estimate: z.number().min(0),
  breakdown: z.object({
    labor_hours: z.number().min(0),
    labor_cost: z.number().min(0),
    material_cost: z.number().min(0),
    equipment_cost: z.number().min(0).default(0),
    overhead_cost: z.number().min(0).default(0),
  }),
  materials: z.array(z.object({
    name: z.string(),
    material_id: z.string().uuid().optional(),
    quantity: z.number().min(0),
    unit: z.string(),
    unit_price: z.number().min(0),
    total_cost: z.number().min(0),
    availability: z.enum(['available', 'order_needed', 'unavailable']).optional(),
  })),
  timeline: z.object({
    estimated_duration_days: z.number().min(1),
    phases: z.array(z.object({
      name: z.string(),
      duration_days: z.number().min(1),
      description: z.string().optional(),
    })).optional(),
  }),
  risks: z.array(z.object({
    description: z.string(),
    impact: z.enum(['low', 'medium', 'high']),
    mitigation: z.string().optional(),
  })).optional(),
});

export const CreateScheduleRequestSchema = z.object({
  project_id: z.string().uuid('Project ID is required'),
  requirements: z.object({
    start_date: z.string().date().optional(),
    end_date: z.string().date().optional(),
    duration_days: z.number().min(1).optional(),
    required_skills: z.array(z.string()).optional(),
    team_size: z.number().int().min(1).optional(),
  }),
  constraints: z.object({
    available_employees: z.array(z.string().uuid()).optional(),
    excluded_dates: z.array(z.string().date()).optional(),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  }).optional(),
});

export const CreateScheduleResponseSchema = z.object({
  confidence: z.number().min(0).max(1),
  recommended_schedule: z.array(z.object({
    employee_id: z.string().uuid(),
    employee_name: z.string(),
    dates: z.array(z.object({
      date: z.string().date(),
      hours: z.number().min(0).max(24),
      tasks: z.array(z.string()).optional(),
    })),
    total_hours: z.number().min(0),
  })),
  conflicts: z.array(z.object({
    type: z.enum(['employee_unavailable', 'overallocation', 'skill_mismatch', 'deadline_conflict']),
    description: z.string(),
    affected_employees: z.array(z.string().uuid()).optional(),
    severity: z.enum(['low', 'medium', 'high']),
  })),
  alternatives: z.array(z.object({
    description: z.string(),
    impact: z.string(),
    schedule: z.any().optional(),
  })).optional(),
});

// Export TypeScript types
export type AiSuggestion = z.infer<typeof AiSuggestionSchema>;
export type AiSuggestionCreate = z.infer<typeof AiSuggestionCreateSchema>;
export type AiSuggestionUpdate = z.infer<typeof AiSuggestionUpdateSchema>;

export type AiIndex = z.infer<typeof AiIndexSchema>;
export type AiIndexCreate = z.infer<typeof AiIndexCreateSchema>;

export type AiProcessingQueue = z.infer<typeof AiProcessingQueueSchema>;
export type AiProcessingQueueCreate = z.infer<typeof AiProcessingQueueCreateSchema>;

export type AiTrainingData = z.infer<typeof AiTrainingDataSchema>;
export type AiTrainingDataCreate = z.infer<typeof AiTrainingDataCreateSchema>;

export type ParseIntentRequest = z.infer<typeof ParseIntentRequestSchema>;
export type ParseIntentResponse = z.infer<typeof ParseIntentResponseSchema>;

export type GenerateEstimateRequest = z.infer<typeof GenerateEstimateRequestSchema>;
export type GenerateEstimateResponse = z.infer<typeof GenerateEstimateResponseSchema>;

export type CreateScheduleRequest = z.infer<typeof CreateScheduleRequestSchema>;
export type CreateScheduleResponse = z.infer<typeof CreateScheduleResponseSchema>;