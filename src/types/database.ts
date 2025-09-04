// Generated TypeScript types for new HandwerkOS database tables

export interface TimeSegment {
  id: string
  employee_id: string
  project_id: string | null
  company_id: string
  started_at: string
  ended_at: string | null
  duration_minutes_computed: number | null
  segment_type: 'work' | 'break' | 'drive'
  status: 'active' | 'paused' | 'completed'
  description: string | null
  notes: string | null
  created_at: string
  updated_at: string
  created_by: string | null
}

export interface TimeRule {
  id: string
  company_id: string
  round_to_minutes: number
  round_direction: 'up' | 'down' | 'nearest'
  min_work_duration_minutes: number
  min_break_duration_minutes: number
  auto_break_after_minutes: number | null
  auto_break_duration_minutes: number | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface DeliveryNote {
  id: string
  company_id: string
  project_id: string | null
  customer_id: string
  number: string
  status: 'draft' | 'sent' | 'signed' | 'cancelled'
  delivery_date: string
  delivery_address: Record<string, any> | null
  total_work_minutes: number
  total_break_minutes: number
  signature_data: Record<string, any> | null
  signed_at: string | null
  signed_by_name: string | null
  pdf_url: string | null
  pdf_generated_at: string | null
  created_at: string
  updated_at: string
  created_by: string | null
}

export interface DeliveryNoteItem {
  id: string
  delivery_note_id: string
  item_type: 'time' | 'material' | 'service'
  time_segment_id: string | null
  material_id: string | null
  description: string
  quantity: number
  unit: string
  unit_price: number | null
  total_price: number | null
  sort_order: number
  created_at: string
}

export interface EmailLog {
  id: string
  delivery_note_id: string | null
  recipient: string
  cc: string[] | null
  subject: string
  status: 'sent' | 'delivered' | 'failed' | 'bounced'
  resend_id: string | null
  error_message: string | null
  sent_at: string
  created_at: string
}

export interface CronLog {
  id: string
  task: string
  status: 'running' | 'completed' | 'failed'
  details: Record<string, any> | null
  error_message: string | null
  started_at: string
  completed_at: string | null
  duration_seconds: number | null
  created_at: string
}

export interface WeeklyReport {
  id: string
  company_id: string
  week_start: string
  week_end: string
  data: Record<string, any>
  total_hours: number | null
  employee_count: number | null
  created_at: string
}

export interface ReminderLog {
  id: string
  type: string
  reference_id: string | null
  recipient: string
  message: string | null
  status: 'sent' | 'delivered' | 'failed'
  sent_at: string
  created_at: string
}

// Extended types with relations
export interface TimeSegmentWithRelations extends TimeSegment {
  employee?: {
    id: string
    first_name: string
    last_name: string
    email?: string
  }
  project?: {
    id: string
    name: string
    customer?: {
      id: string
      name: string
    }
  }
}

export interface DeliveryNoteWithRelations extends DeliveryNote {
  project?: {
    id: string
    name: string
    description?: string
    customer: {
      id: string
      name: string
      email: string | null
      phone: string | null
    }
  }
  items?: DeliveryNoteItemWithRelations[]
}

export interface DeliveryNoteItemWithRelations extends DeliveryNoteItem {
  time_segment?: {
    started_at: string
    ended_at: string | null
    duration_minutes_computed: number | null
    segment_type: string
    description?: string
  }
  material?: {
    name: string
    unit: string
    unit_price: number
  }
}

// RPC function response types
export interface TimeTrackingResponse {
  success: boolean
  action: 'started' | 'stopped' | 'switched' | 'already_active' | 'nothing_to_stop'
  segment?: TimeSegment
  old_segment?: TimeSegment
  new_segment?: TimeSegment
  previous_segment_id?: string
  duration_minutes?: number
  message?: string
}

export interface ActiveTimeStatus {
  success: boolean
  active: boolean
  segment?: {
    id: string
    project_id: string | null
    project_name: string | null
    customer_name: string | null
    segment_type: string
    started_at: string
    current_duration_minutes: number
    description: string | null
  }
  message?: string
  error?: string
}

export interface TimeSummaryResponse {
  employee_id: string
  period_start: string
  period_end: string
  total_work_minutes: number
  total_break_minutes: number
  total_drive_minutes: number
  total_segments: number
  projects: Array<{
    project_id: string | null
    project_name: string | null
    total_minutes: number
  }>
}

export interface DeliveryNoteResponse {
  success: boolean
  delivery_note: DeliveryNote
  item_count: number
  total_work_minutes: number
  total_break_minutes: number
  message?: string
}

export interface SignDeliveryNoteResponse {
  success: boolean
  action: 'signed' | 'already_signed'
  delivery_note: DeliveryNote
  message?: string
}

export interface TimeRulesResponse {
  success: boolean
  action: 'rules_applied' | 'no_rules_applied'
  adjustments?: Array<{
    item_id: string
    original_minutes: number
    rounded_minutes: number
    difference: number
  }>
  rule_used?: TimeRule
  message?: string
}

// Form types for UI components
export interface CreateDeliveryNoteForm {
  projectId: string
  customerId: string
  deliveryDate: Date
  timeSegmentIds: string[]
  materialItems: Array<{
    materialId?: string
    description: string
    quantity: number
    unit?: string
    unitPrice?: number
  }>
  deliveryAddress?: Record<string, any>
}

export interface SignatureData {
  svg: string
  name: string
  timestamp?: string
}

// Filter and search types
export interface DeliveryNoteFilters {
  status?: Array<'draft' | 'sent' | 'signed' | 'cancelled'>
  projectId?: string
  startDate?: string
  endDate?: string
  customerId?: string
}

export interface TimeSegmentFilters {
  employeeId?: string
  projectId?: string
  segmentType?: Array<'work' | 'break' | 'drive'>
  status?: Array<'active' | 'paused' | 'completed'>
  startDate?: string
  endDate?: string
}

// API response wrapper
export interface ApiResponse<T> {
  data?: T
  error?: {
    message: string
    code?: string
    details?: any
  }
  status: number
}

// Utility types
export type DeliveryNoteStatus = 'draft' | 'sent' | 'signed' | 'cancelled'
export type TimeSegmentType = 'work' | 'break' | 'drive'
export type TimeSegmentStatus = 'active' | 'paused' | 'completed'
export type EmailStatus = 'sent' | 'delivered' | 'failed' | 'bounced'
export type CronStatus = 'running' | 'completed' | 'failed'

// Database table names
export const TABLE_NAMES = {
  TIME_SEGMENTS: 'time_segments',
  TIME_RULES: 'time_rules',
  DELIVERY_NOTES: 'delivery_notes',
  DELIVERY_NOTE_ITEMS: 'delivery_note_items',
  EMAIL_LOGS: 'email_logs',
  CRON_LOGS: 'cron_logs',
  WEEKLY_REPORTS: 'weekly_reports',
  REMINDER_LOGS: 'reminder_logs'
} as const

// RPC function names
export const RPC_FUNCTIONS = {
  START_TIME_TRACKING: 'rpc_start_time_tracking',
  STOP_TIME_TRACKING: 'rpc_stop_time_tracking',
  SWITCH_TIME_TRACKING: 'rpc_switch_time_tracking',
  GET_ACTIVE_TIME_TRACKING: 'rpc_get_active_time_tracking',
  GET_TIME_SUMMARY: 'rpc_get_time_summary',
  CREATE_DELIVERY_NOTE: 'rpc_create_delivery_note',
  SIGN_DELIVERY_NOTE: 'rpc_sign_delivery_note',
  APPLY_TIME_RULES: 'rpc_apply_time_rules'
} as const

// Edge function names
export const EDGE_FUNCTIONS = {
  GENERATE_DELIVERY_NOTE_PDF: 'generate-delivery-note-pdf',
  SEND_DOCUMENT_EMAIL: 'send-document-email',
  TIME_TRACKING_CRON: 'time-tracking-cron'
} as const