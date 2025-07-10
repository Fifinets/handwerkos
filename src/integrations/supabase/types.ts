export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      calendar_events: {
        Row: {
          assigned_employees: string[] | null
          color: string | null
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string
          end_time: string | null
          id: string
          is_full_day: boolean | null
          location: string | null
          start_date: string
          start_time: string | null
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          assigned_employees?: string[] | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date: string
          end_time?: string | null
          id?: string
          is_full_day?: boolean | null
          location?: string | null
          start_date: string
          start_time?: string | null
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          assigned_employees?: string[] | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string
          end_time?: string | null
          id?: string
          is_full_day?: boolean | null
          location?: string | null
          start_date?: string
          start_time?: string | null
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          city: string | null
          company_name: string
          contact_person: string
          country: string | null
          created_at: string
          customer_number: string | null
          email: string
          id: string
          phone: string | null
          postal_code: string | null
          status: string
          tax_number: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          company_name: string
          contact_person: string
          country?: string | null
          created_at?: string
          customer_number?: string | null
          email: string
          id?: string
          phone?: string | null
          postal_code?: string | null
          status?: string
          tax_number?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          company_name?: string
          contact_person?: string
          country?: string | null
          created_at?: string
          customer_number?: string | null
          email?: string
          id?: string
          phone?: string | null
          postal_code?: string | null
          status?: string
          tax_number?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      employee_absences: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          employee_id: string
          end_date: string
          end_time: string | null
          id: string
          is_full_day: boolean | null
          notes: string | null
          reason: string | null
          start_date: string
          start_time: string | null
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          employee_id: string
          end_date: string
          end_time?: string | null
          id?: string
          is_full_day?: boolean | null
          notes?: string | null
          reason?: string | null
          start_date: string
          start_time?: string | null
          status?: string
          type: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          employee_id?: string
          end_date?: string
          end_time?: string | null
          id?: string
          is_full_day?: boolean | null
          notes?: string | null
          reason?: string | null
          start_date?: string
          start_time?: string | null
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_absences_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_absences_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          created_at: string
          department: string | null
          email: string
          employee_number: string | null
          first_name: string
          hire_date: string | null
          hourly_rate: number | null
          id: string
          last_name: string
          phone: string | null
          position: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          department?: string | null
          email: string
          employee_number?: string | null
          first_name: string
          hire_date?: string | null
          hourly_rate?: number | null
          id?: string
          last_name: string
          phone?: string | null
          position?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          department?: string | null
          email?: string
          employee_number?: string | null
          first_name?: string
          hire_date?: string | null
          hourly_rate?: number | null
          id?: string
          last_name?: string
          phone?: string | null
          position?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      orders: {
        Row: {
          created_at: string
          currency: string | null
          customer_id: string
          description: string | null
          due_date: string | null
          id: string
          notes: string | null
          order_date: string
          order_number: string
          priority: string
          status: string
          title: string
          total_amount: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string | null
          customer_id: string
          description?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          order_number: string
          priority?: string
          status?: string
          title: string
          total_amount?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string | null
          customer_id?: string
          description?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          order_number?: string
          priority?: string
          status?: string
          title?: string
          total_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          first_name: string | null
          id: string
          last_name: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          first_name?: string | null
          id: string
          last_name?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      project_assignments: {
        Row: {
          created_at: string
          employee_id: string
          end_date: string | null
          hours_per_day: number | null
          id: string
          notes: string | null
          project_id: string
          role: string | null
          start_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          end_date?: string | null
          hours_per_day?: number | null
          id?: string
          notes?: string | null
          project_id: string
          role?: string | null
          start_date: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          end_date?: string | null
          hours_per_day?: number | null
          id?: string
          notes?: string | null
          project_id?: string
          role?: string | null
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_assignments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_material_purchases: {
        Row: {
          created_at: string
          id: string
          material_name: string
          project_id: string
          purchase_date: string
          quantity: number
          supplier: string | null
          total_price: number
          unit: string
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          material_name: string
          project_id: string
          purchase_date: string
          quantity: number
          supplier?: string | null
          total_price: number
          unit: string
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          material_name?: string
          project_id?: string
          purchase_date?: string
          quantity?: number
          supplier?: string | null
          total_price?: number
          unit?: string
          unit_price?: number
        }
        Relationships: []
      }
      project_material_usage: {
        Row: {
          created_at: string
          id: string
          material_name: string
          notes: string | null
          project_id: string
          quantity_used: number
          unit: string
          usage_date: string
          used_by_employee: string
        }
        Insert: {
          created_at?: string
          id?: string
          material_name: string
          notes?: string | null
          project_id: string
          quantity_used: number
          unit: string
          usage_date: string
          used_by_employee: string
        }
        Update: {
          created_at?: string
          id?: string
          material_name?: string
          notes?: string | null
          project_id?: string
          quantity_used?: number
          unit?: string
          usage_date?: string
          used_by_employee?: string
        }
        Relationships: []
      }
      project_work_hours: {
        Row: {
          created_at: string
          employee_name: string
          hours_worked: number
          id: string
          project_id: string
          work_date: string
          work_description: string | null
        }
        Insert: {
          created_at?: string
          employee_name: string
          hours_worked: number
          id?: string
          project_id: string
          work_date: string
          work_description?: string | null
        }
        Update: {
          created_at?: string
          employee_name?: string
          hours_worked?: number
          id?: string
          project_id?: string
          work_date?: string
          work_description?: string | null
        }
        Relationships: []
      }
      projects: {
        Row: {
          color: string | null
          created_at: string
          customer_id: string | null
          description: string | null
          end_date: string | null
          id: string
          location: string | null
          name: string
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          customer_id?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          location?: string | null
          name: string
          start_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          customer_id?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          location?: string | null
          name?: string
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entries: {
        Row: {
          break_duration: number | null
          created_at: string
          description: string | null
          employee_id: string
          end_location_address: string | null
          end_location_lat: number | null
          end_location_lng: number | null
          end_time: string | null
          id: string
          is_offline_synced: boolean | null
          offline_created_at: string | null
          project_id: string | null
          start_location_address: string | null
          start_location_lat: number | null
          start_location_lng: number | null
          start_time: string
          status: string
          updated_at: string
        }
        Insert: {
          break_duration?: number | null
          created_at?: string
          description?: string | null
          employee_id: string
          end_location_address?: string | null
          end_location_lat?: number | null
          end_location_lng?: number | null
          end_time?: string | null
          id?: string
          is_offline_synced?: boolean | null
          offline_created_at?: string | null
          project_id?: string | null
          start_location_address?: string | null
          start_location_lat?: number | null
          start_location_lng?: number | null
          start_time: string
          status?: string
          updated_at?: string
        }
        Update: {
          break_duration?: number | null
          created_at?: string
          description?: string | null
          employee_id?: string
          end_location_address?: string | null
          end_location_lat?: number | null
          end_location_lng?: number | null
          end_time?: string | null
          id?: string
          is_offline_synced?: boolean | null
          offline_created_at?: string | null
          project_id?: string | null
          start_location_address?: string | null
          start_location_lat?: number | null
          start_location_lng?: number | null
          start_time?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_time_entries_employee"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_time_entries_project"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entry_corrections: {
        Row: {
          approved_by: string | null
          corrected_description: string | null
          corrected_end_time: string | null
          corrected_start_time: string
          correction_reason: string
          created_at: string
          id: string
          original_description: string | null
          original_end_time: string | null
          original_start_time: string
          requested_by: string
          status: string
          time_entry_id: string
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          corrected_description?: string | null
          corrected_end_time?: string | null
          corrected_start_time: string
          correction_reason: string
          created_at?: string
          id?: string
          original_description?: string | null
          original_end_time?: string | null
          original_start_time: string
          requested_by: string
          status?: string
          time_entry_id: string
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          corrected_description?: string | null
          corrected_end_time?: string | null
          corrected_start_time?: string
          correction_reason?: string
          created_at?: string
          id?: string
          original_description?: string | null
          original_end_time?: string | null
          original_start_time?: string
          requested_by?: string
          status?: string
          time_entry_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_corrections_approved_by"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_corrections_requested_by"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_corrections_time_entry"
            columns: ["time_entry_id"]
            isOneToOne: false
            referencedRelation: "time_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
        }
        Relationships: []
      }
      working_hours_config: {
        Row: {
          break_duration: number
          created_at: string
          employee_id: string | null
          end_time: string
          id: string
          is_default: boolean
          start_time: string
          updated_at: string
          working_days: number[]
        }
        Insert: {
          break_duration?: number
          created_at?: string
          employee_id?: string | null
          end_time?: string
          id?: string
          is_default?: boolean
          start_time?: string
          updated_at?: string
          working_days?: number[]
        }
        Update: {
          break_duration?: number
          created_at?: string
          employee_id?: string | null
          end_time?: string
          id?: string
          is_default?: boolean
          start_time?: string
          updated_at?: string
          working_days?: number[]
        }
        Relationships: [
          {
            foreignKeyName: "fk_working_hours_employee"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_order_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      has_role: {
        Args:
          | {
              _user_id: string
              _role: Database["public"]["Enums"]["user_role"]
            }
          | { role: string }
        Returns: boolean
      }
    }
    Enums: {
      user_role: "manager" | "employee"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      user_role: ["manager", "employee"],
    },
  },
} as const
