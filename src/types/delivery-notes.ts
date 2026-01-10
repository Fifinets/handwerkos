// Temporary type definitions for delivery notes functionality
export interface DeliveryNote {
  id: string
  number: string
  status: string
  delivery_date: string
  created_at: string
  project_id?: string
  customer_id?: string
}

export interface TimeEntry {
  id: string
  project_id: string
  status: string
  started_at: string
  ended_at: string | null
  duration_minutes_computed: number
  description: string
  segment_type: string
}

export interface Project {
  id: string
  name: string
  customer: {
    id: string
    name: string
    email: string | null
  }
}