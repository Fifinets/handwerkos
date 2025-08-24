export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
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
          company_id: string | null
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
          company_id?: string | null
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
          company_id?: string | null
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
            foreignKeyName: "calendar_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      company_settings: {
        Row: {
          company_address: string | null
          company_city: string | null
          company_country: string | null
          company_email: string | null
          company_id: string | null
          company_name: string
          company_phone: string | null
          company_postal_code: string | null
          company_website: string | null
          created_at: string
          default_break_duration: number | null
          default_currency: string | null
          default_tax_rate: number | null
          default_vacation_days: number | null
          default_working_hours_end: string | null
          default_working_hours_start: string | null
          email_signature: string | null
          id: string
          invoice_prefix: string | null
          invoice_terms: string | null
          is_active: boolean | null
          logo_url: string | null
          order_prefix: string | null
          quote_prefix: string | null
          quote_validity_days: number | null
          tax_number: string | null
          updated_at: string
          vat_number: string | null
        }
        Insert: {
          company_address?: string | null
          company_city?: string | null
          company_country?: string | null
          company_email?: string | null
          company_id?: string | null
          company_name?: string
          company_phone?: string | null
          company_postal_code?: string | null
          company_website?: string | null
          created_at?: string
          default_break_duration?: number | null
          default_currency?: string | null
          default_tax_rate?: number | null
          default_vacation_days?: number | null
          default_working_hours_end?: string | null
          default_working_hours_start?: string | null
          email_signature?: string | null
          id?: string
          invoice_prefix?: string | null
          invoice_terms?: string | null
          is_active?: boolean | null
          logo_url?: string | null
          order_prefix?: string | null
          quote_prefix?: string | null
          quote_validity_days?: number | null
          tax_number?: string | null
          updated_at?: string
          vat_number?: string | null
        }
        Update: {
          company_address?: string | null
          company_city?: string | null
          company_country?: string | null
          company_email?: string | null
          company_id?: string | null
          company_name?: string
          company_phone?: string | null
          company_postal_code?: string | null
          company_website?: string | null
          created_at?: string
          default_break_duration?: number | null
          default_currency?: string | null
          default_tax_rate?: number | null
          default_vacation_days?: number | null
          default_working_hours_end?: string | null
          default_working_hours_start?: string | null
          email_signature?: string | null
          id?: string
          invoice_prefix?: string | null
          invoice_terms?: string | null
          is_active?: boolean | null
          logo_url?: string | null
          order_prefix?: string | null
          quote_prefix?: string | null
          quote_validity_days?: number | null
          tax_number?: string | null
          updated_at?: string
          vat_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          anrede: string | null
          bank_name: string | null
          benutzer_id: string | null
          bic: string | null
          city: string | null
          company_id: string | null
          company_name: string
          contact_person: string
          country: string | null
          created_at: string
          customer_number: string | null
          email: string
          fax: string | null
          first_name: string | null
          iban: string | null
          id: string
          kontoinhaber: string | null
          last_name: string | null
          mobile: string | null
          passwort: string | null
          phone: string | null
          postal_code: string | null
          preisgruppe: string | null
          skonto_prozent: string | null
          skonto_tage: string | null
          status: string
          tax_number: string | null
          updated_at: string
          waehrung: string | null
          website: string | null
          zahlungsziel: string | null
          zugprd_status: string | null
        }
        Insert: {
          address?: string | null
          anrede?: string | null
          bank_name?: string | null
          benutzer_id?: string | null
          bic?: string | null
          city?: string | null
          company_id?: string | null
          company_name: string
          contact_person: string
          country?: string | null
          created_at?: string
          customer_number?: string | null
          email: string
          fax?: string | null
          first_name?: string | null
          iban?: string | null
          id?: string
          kontoinhaber?: string | null
          last_name?: string | null
          mobile?: string | null
          passwort?: string | null
          phone?: string | null
          postal_code?: string | null
          preisgruppe?: string | null
          skonto_prozent?: string | null
          skonto_tage?: string | null
          status?: string
          tax_number?: string | null
          updated_at?: string
          waehrung?: string | null
          website?: string | null
          zahlungsziel?: string | null
          zugprd_status?: string | null
        }
        Update: {
          address?: string | null
          anrede?: string | null
          bank_name?: string | null
          benutzer_id?: string | null
          bic?: string | null
          city?: string | null
          company_id?: string | null
          company_name?: string
          contact_person?: string
          country?: string | null
          created_at?: string
          customer_number?: string | null
          email?: string
          fax?: string | null
          first_name?: string | null
          iban?: string | null
          id?: string
          kontoinhaber?: string | null
          last_name?: string | null
          mobile?: string | null
          passwort?: string | null
          phone?: string | null
          postal_code?: string | null
          preisgruppe?: string | null
          skonto_prozent?: string | null
          skonto_tage?: string | null
          status?: string
          tax_number?: string | null
          updated_at?: string
          waehrung?: string | null
          website?: string | null
          zahlungsziel?: string | null
          zugprd_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      document_items: {
        Row: {
          company_id: string | null
          created_at: string
          description: string
          id: string
          invoice_id: string | null
          position: number
          quantity: number
          quote_id: string | null
          total_price: number
          unit: string | null
          unit_price: number
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          description: string
          id?: string
          invoice_id?: string | null
          position: number
          quantity?: number
          quote_id?: string | null
          total_price: number
          unit?: string | null
          unit_price: number
        }
        Update: {
          company_id?: string | null
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string | null
          position?: number
          quantity?: number
          quote_id?: string | null
          total_price?: number
          unit?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      email_attachments: {
        Row: {
          content_type: string | null
          created_at: string
          email_id: string
          file_url: string | null
          filename: string
          id: string
          size_bytes: number | null
        }
        Insert: {
          content_type?: string | null
          created_at?: string
          email_id: string
          file_url?: string | null
          filename: string
          id?: string
          size_bytes?: number | null
        }
        Update: {
          content_type?: string | null
          created_at?: string
          email_id?: string
          file_url?: string | null
          filename?: string
          id?: string
          size_bytes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "email_attachments_email_id_fkey"
            columns: ["email_id"]
            isOneToOne: false
            referencedRelation: "emails"
            referencedColumns: ["id"]
          },
        ]
      }
      email_categories: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          name: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      email_signatures: {
        Row: {
          content: string
          created_at: string
          id: string
          is_default: boolean
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      email_sync_settings: {
        Row: {
          auto_sync_enabled: boolean
          created_at: string
          id: string
          last_sync_at: string | null
          sync_interval_minutes: number
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_sync_enabled?: boolean
          created_at?: string
          id?: string
          last_sync_at?: string | null
          sync_interval_minutes?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_sync_enabled?: boolean
          created_at?: string
          id?: string
          last_sync_at?: string | null
          sync_interval_minutes?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          body: string
          created_at: string
          id: string
          name: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          name: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          name?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      emails: {
        Row: {
          ai_category_id: string | null
          ai_confidence: number | null
          ai_extracted_data: Json | null
          ai_sentiment: string | null
          ai_summary: string | null
          company_id: string | null
          content: string | null
          created_at: string
          customer_id: string | null
          html_content: string | null
          id: string
          in_reply_to: string | null
          is_read: boolean | null
          is_starred: boolean | null
          message_id: string | null
          priority: string | null
          processed_at: string | null
          processing_status: string | null
          project_id: string | null
          received_at: string
          recipient_email: string
          sender_email: string
          sender_name: string | null
          subject: string
          thread_id: string | null
          updated_at: string
        }
        Insert: {
          ai_category_id?: string | null
          ai_confidence?: number | null
          ai_extracted_data?: Json | null
          ai_sentiment?: string | null
          ai_summary?: string | null
          company_id?: string | null
          content?: string | null
          created_at?: string
          customer_id?: string | null
          html_content?: string | null
          id?: string
          in_reply_to?: string | null
          is_read?: boolean | null
          is_starred?: boolean | null
          message_id?: string | null
          priority?: string | null
          processed_at?: string | null
          processing_status?: string | null
          project_id?: string | null
          received_at?: string
          recipient_email: string
          sender_email: string
          sender_name?: string | null
          subject: string
          thread_id?: string | null
          updated_at?: string
        }
        Update: {
          ai_category_id?: string | null
          ai_confidence?: number | null
          ai_extracted_data?: Json | null
          ai_sentiment?: string | null
          ai_summary?: string | null
          company_id?: string | null
          content?: string | null
          created_at?: string
          customer_id?: string | null
          html_content?: string | null
          id?: string
          in_reply_to?: string | null
          is_read?: boolean | null
          is_starred?: boolean | null
          message_id?: string | null
          priority?: string | null
          processed_at?: string | null
          processing_status?: string | null
          project_id?: string | null
          received_at?: string
          recipient_email?: string
          sender_email?: string
          sender_name?: string | null
          subject?: string
          thread_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "emails_ai_category_id_fkey"
            columns: ["ai_category_id"]
            isOneToOne: false
            referencedRelation: "email_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emails_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emails_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emails_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_absences: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          company_id: string | null
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
          company_id?: string | null
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
          company_id?: string | null
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
            foreignKeyName: "employee_absences_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
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
      employee_invitations: {
        Row: {
          company_id: string | null
          created_at: string | null
          email: string
          employee_data: Json | null
          expires_at: string
          id: string
          invite_token: string
          invited_by: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          email: string
          employee_data?: Json | null
          expires_at: string
          id?: string
          invite_token: string
          invited_by?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          email?: string
          employee_data?: Json | null
          expires_at?: string
          id?: string
          invite_token?: string
          invited_by?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_invitations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          company_id: string | null
          created_at: string
          department: string | null
          email: string
          employee_number: string | null
          first_name: string
          hire_date: string | null
          hourly_rate: number | null
          id: string
          last_name: string
          license: string | null
          phone: string | null
          position: string | null
          qualifications: string | null
          status: string
          updated_at: string
          user_id: string | null
          vacation_days_total: number | null
          vacation_days_used: number | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          department?: string | null
          email: string
          employee_number?: string | null
          first_name: string
          hire_date?: string | null
          hourly_rate?: number | null
          id?: string
          last_name: string
          license?: string | null
          phone?: string | null
          position?: string | null
          qualifications?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
          vacation_days_total?: number | null
          vacation_days_used?: number | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          department?: string | null
          email?: string
          employee_number?: string | null
          first_name?: string
          hire_date?: string | null
          hourly_rate?: number | null
          id?: string
          last_name?: string
          license?: string | null
          phone?: string | null
          position?: string | null
          qualifications?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
          vacation_days_total?: number | null
          vacation_days_used?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          company_id: string | null
          created_at: string
          currency: string | null
          customer_id: string
          description: string | null
          due_date: string
          id: string
          invoice_date: string
          invoice_number: string
          net_amount: number
          notes: string | null
          payment_terms: string | null
          quote_id: string | null
          signature_url: string | null
          status: string
          tax_amount: number
          tax_rate: number
          title: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          currency?: string | null
          customer_id: string
          description?: string | null
          due_date: string
          id?: string
          invoice_date?: string
          invoice_number: string
          net_amount?: number
          notes?: string | null
          payment_terms?: string | null
          quote_id?: string | null
          signature_url?: string | null
          status?: string
          tax_amount?: number
          tax_rate?: number
          title: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          currency?: string | null
          customer_id?: string
          description?: string | null
          due_date?: string
          id?: string
          invoice_date?: string
          invoice_number?: string
          net_amount?: number
          notes?: string | null
          payment_terms?: string | null
          quote_id?: string | null
          signature_url?: string | null
          status?: string
          tax_amount?: number
          tax_rate?: number
          title?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      number_sequences: {
        Row: {
          company_id: string | null
          created_at: string
          current_value: number | null
          format: string | null
          id: string
          last_reset_year: number | null
          prefix: string | null
          sequence_name: string
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          current_value?: number | null
          format?: string | null
          id?: string
          last_reset_year?: number | null
          prefix?: string | null
          sequence_name: string
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          current_value?: number | null
          format?: string | null
          id?: string
          last_reset_year?: number | null
          prefix?: string | null
          sequence_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          company_id: string | null
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
          company_id?: string | null
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
          company_id?: string | null
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
            foreignKeyName: "orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
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
          city: string | null
          company_id: string
          company_name: string | null
          country: string | null
          created_at: string
          department: string | null
          email: string
          employee_number: string | null
          first_name: string | null
          hire_date: string | null
          hourly_rate: number | null
          id: string
          last_name: string | null
          phone: string | null
          position: string | null
          postal_code: string | null
          referral_source: string | null
          status: string | null
          street_address: string | null
          updated_at: string
          vat_id: string | null
          voucher_code: string | null
        }
        Insert: {
          city?: string | null
          company_id: string
          company_name?: string | null
          country?: string | null
          created_at?: string
          department?: string | null
          email: string
          employee_number?: string | null
          first_name?: string | null
          hire_date?: string | null
          hourly_rate?: number | null
          id: string
          last_name?: string | null
          phone?: string | null
          position?: string | null
          postal_code?: string | null
          referral_source?: string | null
          status?: string | null
          street_address?: string | null
          updated_at?: string
          vat_id?: string | null
          voucher_code?: string | null
        }
        Update: {
          city?: string | null
          company_id?: string
          company_name?: string | null
          country?: string | null
          created_at?: string
          department?: string | null
          email?: string
          employee_number?: string | null
          first_name?: string | null
          hire_date?: string | null
          hourly_rate?: number | null
          id?: string
          last_name?: string | null
          phone?: string | null
          position?: string | null
          postal_code?: string | null
          referral_source?: string | null
          status?: string | null
          street_address?: string | null
          updated_at?: string
          vat_id?: string | null
          voucher_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      project_assignments: {
        Row: {
          company_id: string | null
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
          company_id?: string | null
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
          company_id?: string | null
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
            foreignKeyName: "project_assignments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
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
      project_team_members: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          created_at: string | null
          employee_id: string
          id: string
          project_id: string
          role: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          created_at?: string | null
          employee_id: string
          id?: string
          project_id: string
          role?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          created_at?: string | null
          employee_id?: string
          id?: string
          project_id?: string
          role?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_team_members_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_team_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
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
          budget: number | null
          color: string | null
          company_id: string | null
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
          budget?: number | null
          color?: string | null
          company_id?: string | null
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
          budget?: number | null
          color?: string | null
          company_id?: string | null
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
            foreignKeyName: "projects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          company_id: string | null
          created_at: string
          currency: string | null
          customer_id: string
          description: string | null
          id: string
          net_amount: number
          notes: string | null
          quote_date: string
          quote_number: string
          signature_url: string | null
          status: string
          tax_amount: number
          tax_rate: number
          title: string
          total_amount: number
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          currency?: string | null
          customer_id: string
          description?: string | null
          id?: string
          net_amount?: number
          notes?: string | null
          quote_date?: string
          quote_number: string
          signature_url?: string | null
          status?: string
          tax_amount?: number
          tax_rate?: number
          title: string
          total_amount?: number
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          currency?: string | null
          customer_id?: string
          description?: string | null
          id?: string
          net_amount?: number
          notes?: string | null
          quote_date?: string
          quote_number?: string
          signature_url?: string | null
          status?: string
          tax_amount?: number
          tax_rate?: number
          title?: string
          total_amount?: number
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_customer_id_fkey"
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
          company_id: string | null
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
          company_id?: string | null
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
          company_id?: string | null
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
          {
            foreignKeyName: "time_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entry_corrections: {
        Row: {
          approved_by: string | null
          company_id: string | null
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
          company_id?: string | null
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
          company_id?: string | null
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
          {
            foreignKeyName: "time_entry_corrections_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_email_connections: {
        Row: {
          access_token: string | null
          created_at: string
          email_address: string | null
          id: string
          is_active: boolean
          provider: string
          refresh_token: string | null
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          created_at?: string
          email_address?: string | null
          id?: string
          is_active?: boolean
          provider?: string
          refresh_token?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          created_at?: string
          email_address?: string | null
          id?: string
          is_active?: boolean
          provider?: string
          refresh_token?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      vacation_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          created_by: string | null
          days_requested: number
          employee_id: string
          end_date: string
          id: string
          reason: string | null
          request_type: string
          start_date: string
          status: string
          updated_at: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          created_by?: string | null
          days_requested: number
          employee_id: string
          end_date: string
          id?: string
          reason?: string | null
          request_type?: string
          start_date: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          created_by?: string | null
          days_requested?: number
          employee_id?: string
          end_date?: string
          id?: string
          reason?: string | null
          request_type?: string
          start_date?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vacation_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      working_hours_config: {
        Row: {
          break_duration: number
          company_id: string | null
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
          company_id?: string | null
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
          company_id?: string | null
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
          {
            foreignKeyName: "working_hours_config_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_expired_invitations: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      generate_invoice_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_order_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_quote_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_next_number: {
        Args: { comp_id?: string; seq_name: string }
        Returns: string
      }
      has_role: {
        Args:
          | {
              _role: Database["public"]["Enums"]["user_role"]
              _user_id: string
            }
          | { role: string }
        Returns: boolean
      }
      increment_vacation_days_used: {
        Args: { days_to_add: number; employee_id_param: string }
        Returns: undefined
      }
      sanitize_text_input: {
        Args: { input_text: string }
        Returns: string
      }
      validate_email_content: {
        Args: { content_text: string }
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
