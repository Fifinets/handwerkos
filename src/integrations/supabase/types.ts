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
      app_schema_version: {
        Row: {
          applied_at: string
          applied_by: string | null
          description: string | null
          error_message: string | null
          migration_time_ms: number | null
          rollback_sql: string | null
          success: boolean | null
          version: string
        }
        Insert: {
          applied_at?: string
          applied_by?: string | null
          description?: string | null
          error_message?: string | null
          migration_time_ms?: number | null
          rollback_sql?: string | null
          success?: boolean | null
          version: string
        }
        Update: {
          applied_at?: string
          applied_by?: string | null
          description?: string | null
          error_message?: string | null
          migration_time_ms?: number | null
          rollback_sql?: string | null
          success?: boolean | null
          version?: string
        }
        Relationships: []
      }
      blocks: {
        Row: {
          content: Json | null
          created_at: string
          id: string
          locked: boolean | null
          order: number | null
          page_id: string
          schema_version: number | null
          styles: Json | null
          type: string
          updated_at: string
        }
        Insert: {
          content?: Json | null
          created_at?: string
          id?: string
          locked?: boolean | null
          order?: number | null
          page_id: string
          schema_version?: number | null
          styles?: Json | null
          type: string
          updated_at?: string
        }
        Update: {
          content?: Json | null
          created_at?: string
          id?: string
          locked?: boolean | null
          order?: number | null
          page_id?: string
          schema_version?: number | null
          styles?: Json | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocks_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          }
        ]
      }
      pages: {
        Row: {
          created_at: string
          id: string
          order: number | null
          seo_meta: Json | null
          site_id: string
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          order?: number | null
          seo_meta?: Json | null
          site_id: string
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          order?: number | null
          seo_meta?: Json | null
          site_id?: string
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pages_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          }
        ]
      }
      sites: {
        Row: {
          created_at: string
          custom_domain: string | null
          id: string
          legal_profile: Json | null
          published_at: string | null
          status: string | null
          subdomain: string
          template_id: string | null
          theme_config: Json | null
          title: string
          updated_at: string
          user_id: string
          web_profile: Json | null
        }
        Insert: {
          created_at?: string
          custom_domain?: string | null
          id?: string
          legal_profile?: Json | null
          published_at?: string | null
          status?: string | null
          subdomain: string
          template_id?: string | null
          theme_config?: Json | null
          title: string
          updated_at?: string
          user_id: string
          web_profile?: Json | null
        }
        Update: {
          created_at?: string
          custom_domain?: string | null
          id?: string
          legal_profile?: Json | null
          published_at?: string | null
          status?: string | null
          subdomain?: string
          template_id?: string | null
          theme_config?: Json | null
          title?: string
          updated_at?: string
          user_id?: string
          web_profile?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "sites_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          }
        ]
      }
      templates: {
        Row: {
          created_at: string
          default_blocks: Json | null
          default_pages: Json | null
          default_theme_config: Json | null
          id: string
          industry: string
          name: string
          preview_image: string | null
          version: number | null
        }
        Insert: {
          created_at?: string
          default_blocks?: Json | null
          default_pages?: Json | null
          default_theme_config?: Json | null
          id?: string
          industry: string
          name: string
          preview_image?: string | null
          version?: number | null
        }
        Update: {
          created_at?: string
          default_blocks?: Json | null
          default_pages?: Json | null
          default_theme_config?: Json | null
          id?: string
          industry?: string
          name?: string
          preview_image?: string | null
          version?: number | null
        }
        Relationships: []

      }
      attendance: {
        Row: {
          autogenerated: boolean | null
          break_minutes: number | null
          breaks: Json | null
          clock_in: string
          clock_in_location: Json | null
          clock_out: string | null
          clock_out_location: Json | null
          company_id: string | null
          created_at: string
          created_by: string | null
          date: string
          employee_id: string
          id: string
          note: string | null
          status: string
          updated_at: string
          updated_by: string | null
          work_minutes: number | null
        }
        Insert: {
          autogenerated?: boolean | null
          break_minutes?: number | null
          breaks?: Json | null
          clock_in: string
          clock_in_location?: Json | null
          clock_out?: string | null
          clock_out_location?: Json | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          date: string
          employee_id: string
          id?: string
          note?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          work_minutes?: number | null
        }
        Update: {
          autogenerated?: boolean | null
          break_minutes?: number | null
          breaks?: Json | null
          clock_in?: string
          clock_in_location?: Json | null
          clock_out?: string | null
          clock_out_location?: Json | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          employee_id?: string
          id?: string
          note?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          work_minutes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
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
      cost_centers: {
        Row: {
          billable: boolean | null
          code: string
          color: string | null
          company_id: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          payroll: boolean | null
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          billable?: boolean | null
          code: string
          color?: string | null
          company_id?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          payroll?: boolean | null
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          billable?: boolean | null
          code?: string
          color?: string | null
          company_id?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          payroll?: boolean | null
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cost_centers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      cron_logs: {
        Row: {
          completed_at: string | null
          created_at: string
          details: Json | null
          duration_seconds: number | null
          error_message: string | null
          id: string
          started_at: string
          status: string | null
          task: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          details?: Json | null
          duration_seconds?: number | null
          error_message?: string | null
          id?: string
          started_at?: string
          status?: string | null
          task: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          details?: Json | null
          duration_seconds?: number | null
          error_message?: string | null
          id?: string
          started_at?: string
          status?: string | null
          task?: string
        }
        Relationships: []
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
      delivery_note_items: {
        Row: {
          created_at: string
          delivery_note_id: string
          description: string
          id: string
          item_type: string
          material_id: string | null
          quantity: number | null
          sort_order: number | null
          time_segment_id: string | null
          total_price: number | null
          unit: string | null
          unit_price: number | null
        }
        Insert: {
          created_at?: string
          delivery_note_id: string
          description: string
          id?: string
          item_type: string
          material_id?: string | null
          quantity?: number | null
          sort_order?: number | null
          time_segment_id?: string | null
          total_price?: number | null
          unit?: string | null
          unit_price?: number | null
        }
        Update: {
          created_at?: string
          delivery_note_id?: string
          description?: string
          id?: string
          item_type?: string
          material_id?: string | null
          quantity?: number | null
          sort_order?: number | null
          time_segment_id?: string | null
          total_price?: number | null
          unit?: string | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_note_items_delivery_note_id_fkey"
            columns: ["delivery_note_id"]
            isOneToOne: false
            referencedRelation: "delivery_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_note_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_note_items_time_segment_id_fkey"
            columns: ["time_segment_id"]
            isOneToOne: false
            referencedRelation: "time_segments"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_notes: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          break_minutes: number | null
          company_id: string | null
          created_at: string
          created_by: string | null
          created_by_employee_id: string | null
          customer_id: string | null
          delivery_address: Json | null
          delivery_date: string
          delivery_note_number: string | null
          description: string | null
          end_time: string | null
          id: string
          number: string
          pdf_generated_at: string | null
          pdf_url: string | null
          project_id: string | null
          rejection_reason: string | null
          signature_data: Json | null
          signature_name: string | null
          signed_at: string | null
          signed_by_name: string | null
          start_time: string | null
          status: string
          submitted_at: string | null
          total_break_minutes: number | null
          total_work_minutes: number | null
          updated_at: string
          work_date: string | null
          work_hours: number | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          break_minutes?: number | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          created_by_employee_id?: string | null
          customer_id?: string | null
          delivery_address?: Json | null
          delivery_date?: string
          delivery_note_number?: string | null
          description?: string | null
          end_time?: string | null
          id?: string
          number: string
          pdf_generated_at?: string | null
          pdf_url?: string | null
          project_id?: string | null
          rejection_reason?: string | null
          signature_data?: Json | null
          signature_name?: string | null
          signed_at?: string | null
          signed_by_name?: string | null
          start_time?: string | null
          status?: string
          submitted_at?: string | null
          total_break_minutes?: number | null
          total_work_minutes?: number | null
          updated_at?: string
          work_date?: string | null
          work_hours?: number | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          break_minutes?: number | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          created_by_employee_id?: string | null
          customer_id?: string | null
          delivery_address?: Json | null
          delivery_date?: string
          delivery_note_number?: string | null
          description?: string | null
          end_time?: string | null
          id?: string
          number?: string
          pdf_generated_at?: string | null
          pdf_url?: string | null
          project_id?: string | null
          rejection_reason?: string | null
          signature_data?: Json | null
          signature_name?: string | null
          signed_at?: string | null
          signed_by_name?: string | null
          start_time?: string | null
          status?: string
          submitted_at?: string | null
          total_break_minutes?: number | null
          total_work_minutes?: number | null
          updated_at?: string
          work_date?: string | null
          work_hours?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_notes_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_notes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_notes_created_by_employee_id_fkey"
            columns: ["created_by_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_notes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
      email_logs: {
        Row: {
          cc: string[] | null
          created_at: string
          delivery_note_id: string | null
          error_message: string | null
          id: string
          recipient: string
          resend_id: string | null
          sent_at: string
          status: string | null
          subject: string
        }
        Insert: {
          cc?: string[] | null
          created_at?: string
          delivery_note_id?: string | null
          error_message?: string | null
          id?: string
          recipient: string
          resend_id?: string | null
          sent_at?: string
          status?: string | null
          subject: string
        }
        Update: {
          cc?: string[] | null
          created_at?: string
          delivery_note_id?: string | null
          error_message?: string | null
          id?: string
          recipient?: string
          resend_id?: string | null
          sent_at?: string
          status?: string | null
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_delivery_note_id_fkey"
            columns: ["delivery_note_id"]
            isOneToOne: false
            referencedRelation: "delivery_notes"
            referencedColumns: ["id"]
          },
        ]
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
          grants: string[] | null
          hire_date: string | null
          hourly_rate: number | null
          id: string
          last_name: string
          license: string | null
          phone: string | null
          position: string | null
          qualifications: string | null
          role: string | null
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
          grants?: string[] | null
          hire_date?: string | null
          hourly_rate?: number | null
          id?: string
          last_name: string
          license?: string | null
          phone?: string | null
          position?: string | null
          qualifications?: string | null
          role?: string | null
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
          grants?: string[] | null
          hire_date?: string | null
          hourly_rate?: number | null
          id?: string
          last_name?: string
          license?: string | null
          phone?: string | null
          position?: string | null
          qualifications?: string | null
          role?: string | null
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
      expenses: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          category: string
          company_id: string | null
          created_at: string
          description: string | null
          employee_id: string | null
          expense_date: string
          id: string
          is_billable: boolean | null
          project_id: string | null
          receipt_url: string | null
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          category: string
          company_id?: string | null
          created_at?: string
          description?: string | null
          employee_id?: string | null
          expense_date: string
          id?: string
          is_billable?: boolean | null
          project_id?: string | null
          receipt_url?: string | null
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          category?: string
          company_id?: string | null
          created_at?: string
          description?: string | null
          employee_id?: string | null
          expense_date?: string
          id?: string
          is_billable?: boolean | null
          project_id?: string | null
          receipt_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          company_id: string | null
          created_at: string
          description: string | null
          enabled: boolean | null
          flag_name: string
          id: string
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          description?: string | null
          enabled?: boolean | null
          flag_name: string
          id?: string
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          description?: string | null
          enabled?: boolean | null
          flag_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "feature_flags_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      immutable_files: {
        Row: {
          company_id: string | null
          created_at: string | null
          created_by: string | null
          entity_id: string
          entity_type: string
          file_name: string
          file_path: string
          file_size: number
          id: string
          is_original: boolean | null
          legal_category: string | null
          mime_type: string
          retention_until: string | null
          sha256_hash: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          entity_id: string
          entity_type: string
          file_name: string
          file_path: string
          file_size: number
          id?: string
          is_original?: boolean | null
          legal_category?: string | null
          mime_type: string
          retention_until?: string | null
          sha256_hash: string
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          entity_id?: string
          entity_type?: string
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          is_original?: boolean | null
          legal_category?: string | null
          mime_type?: string
          retention_until?: string | null
          sha256_hash?: string
        }
        Relationships: []
      }
      invoice_items: {
        Row: {
          created_at: string
          description: string
          id: string
          invoice_id: string
          position_number: number
          quantity: number
          source_id: string | null
          source_type: string
          total_gross: number | null
          total_net: number | null
          total_vat: number | null
          unit: string
          unit_price: number
          vat_rate: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          position_number: number
          quantity?: number
          source_id?: string | null
          source_type: string
          total_gross?: number | null
          total_net?: number | null
          total_vat?: number | null
          unit?: string
          unit_price: number
          vat_rate?: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          position_number?: number
          quantity?: number
          source_id?: string | null
          source_type?: string
          total_gross?: number | null
          total_net?: number | null
          total_vat?: number | null
          unit?: string
          unit_price?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
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
          invoice_type: string | null
          is_locked: boolean | null
          net_amount: number
          notes: string | null
          order_id: string | null
          payment_terms: string | null
          quote_id: string | null
          service_period_end: string | null
          service_period_start: string | null
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
          invoice_type?: string | null
          is_locked?: boolean | null
          net_amount?: number
          notes?: string | null
          order_id?: string | null
          payment_terms?: string | null
          quote_id?: string | null
          service_period_end?: string | null
          service_period_start?: string | null
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
          invoice_type?: string | null
          is_locked?: boolean | null
          net_amount?: number
          notes?: string | null
          order_id?: string | null
          payment_terms?: string | null
          quote_id?: string | null
          service_period_end?: string | null
          service_period_start?: string | null
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
            foreignKeyName: "invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
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
      materials: {
        Row: {
          category: string | null
          company_id: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          sku: string | null
          stock: number | null
          unit: string | null
          unit_price: number | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          sku?: string | null
          stock?: number | null
          unit?: string | null
          unit_price?: number | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          sku?: string | null
          stock?: number | null
          unit?: string | null
          unit_price?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "materials_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      migration_log: {
        Row: {
          error_message: string | null
          executed_at: string
          executed_by: string | null
          execution_time_ms: number | null
          id: string
          migration_file: string
          status: string
        }
        Insert: {
          error_message?: string | null
          executed_at?: string
          executed_by?: string | null
          execution_time_ms?: number | null
          id?: string
          migration_file: string
          status: string
        }
        Update: {
          error_message?: string | null
          executed_at?: string
          executed_by?: string | null
          execution_time_ms?: number | null
          id?: string
          migration_file?: string
          status?: string
        }
        Relationships: []
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
      ocr_results: {
        Row: {
          company_id: string | null
          confidence_scores: Json
          created_at: string | null
          created_by: string
          duplicates_of: string | null
          extracted_text: string
          file_hash: string | null
          filesize: number | null
          id: string
          immutable_file_id: string | null
          mime_type: string | null
          ocr_engine: string | null
          ocr_engine_version: string | null
          original_file_path: string
          original_filename: string | null
          page_count: number | null
          processing_errors: string[] | null
          status: string
          structured_data: Json
          updated_at: string | null
          validated_at: string | null
          validated_by: string | null
          validation_notes: string | null
          version: number | null
        }
        Insert: {
          company_id?: string | null
          confidence_scores: Json
          created_at?: string | null
          created_by: string
          duplicates_of?: string | null
          extracted_text: string
          file_hash?: string | null
          filesize?: number | null
          id?: string
          immutable_file_id?: string | null
          mime_type?: string | null
          ocr_engine?: string | null
          ocr_engine_version?: string | null
          original_file_path: string
          original_filename?: string | null
          page_count?: number | null
          processing_errors?: string[] | null
          status?: string
          structured_data: Json
          updated_at?: string | null
          validated_at?: string | null
          validated_by?: string | null
          validation_notes?: string | null
          version?: number | null
        }
        Update: {
          company_id?: string | null
          confidence_scores?: Json
          created_at?: string | null
          created_by?: string
          duplicates_of?: string | null
          extracted_text?: string
          file_hash?: string | null
          filesize?: number | null
          id?: string
          immutable_file_id?: string | null
          mime_type?: string | null
          ocr_engine?: string | null
          ocr_engine_version?: string | null
          original_file_path?: string
          original_filename?: string | null
          page_count?: number | null
          processing_errors?: string[] | null
          status?: string
          structured_data?: Json
          updated_at?: string | null
          validated_at?: string | null
          validated_by?: string | null
          validation_notes?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ocr_results_duplicates_of_fkey"
            columns: ["duplicates_of"]
            isOneToOne: false
            referencedRelation: "ocr_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocr_results_immutable_file_id_fkey"
            columns: ["immutable_file_id"]
            isOneToOne: false
            referencedRelation: "immutable_files"
            referencedColumns: ["id"]
          },
        ]
      }
      offer_items: {
        Row: {
          created_at: string
          description: string
          id: string
          internal_notes: string | null
          is_optional: boolean
          item_type: string
          material_purchase_cost: number | null
          offer_id: string
          planned_hours_item: number | null
          position_number: number
          quantity: number
          unit: string
          unit_price_net: number
          vat_rate: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          internal_notes?: string | null
          is_optional?: boolean
          item_type?: string
          material_purchase_cost?: number | null
          offer_id: string
          planned_hours_item?: number | null
          position_number: number
          quantity?: number
          unit?: string
          unit_price_net?: number
          vat_rate?: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          internal_notes?: string | null
          is_optional?: boolean
          item_type?: string
          material_purchase_cost?: number | null
          offer_id?: string
          planned_hours_item?: number | null
          position_number?: number
          quantity?: number
          unit?: string
          unit_price_net?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "offer_items_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_items_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers_with_totals"
            referencedColumns: ["id"]
          },
        ]
      }
      offer_targets: {
        Row: {
          billable_hourly_rate: number | null
          complexity: string | null
          created_at: string
          id: string
          internal_hourly_rate: number | null
          offer_id: string
          planned_hours_total: number | null
          planned_material_cost_total: number | null
          planned_other_cost: number | null
          project_manager_id: string | null
          snapshot_created_at: string | null
          snapshot_target_cost: number | null
          snapshot_target_margin: number | null
          snapshot_target_revenue: number | null
          target_end_date: string | null
          target_start_date: string | null
          updated_at: string
        }
        Insert: {
          billable_hourly_rate?: number | null
          complexity?: string | null
          created_at?: string
          id?: string
          internal_hourly_rate?: number | null
          offer_id: string
          planned_hours_total?: number | null
          planned_material_cost_total?: number | null
          planned_other_cost?: number | null
          project_manager_id?: string | null
          snapshot_created_at?: string | null
          snapshot_target_cost?: number | null
          snapshot_target_margin?: number | null
          snapshot_target_revenue?: number | null
          target_end_date?: string | null
          target_start_date?: string | null
          updated_at?: string
        }
        Update: {
          billable_hourly_rate?: number | null
          complexity?: string | null
          created_at?: string
          id?: string
          internal_hourly_rate?: number | null
          offer_id?: string
          planned_hours_total?: number | null
          planned_material_cost_total?: number | null
          planned_other_cost?: number | null
          project_manager_id?: string | null
          snapshot_created_at?: string | null
          snapshot_target_cost?: number | null
          snapshot_target_margin?: number | null
          snapshot_target_revenue?: number | null
          target_end_date?: string | null
          target_start_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "offer_targets_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: true
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_targets_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: true
            referencedRelation: "offers_with_totals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_targets_project_manager_id_fkey"
            columns: ["project_manager_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      offers: {
        Row: {
          acceptance_note: string | null
          accepted_at: string | null
          accepted_by: string | null
          company_id: string
          contact_person: string | null
          created_at: string
          created_by: string | null
          customer_address: string | null
          customer_id: string
          customer_name: string
          customer_reference: string | null
          execution_notes: string | null
          execution_period_text: string | null
          id: string
          is_locked: boolean
          notes: string | null
          offer_date: string
          offer_number: string
          payment_terms: string | null
          project_location: string | null
          project_name: string
          skonto_days: number | null
          skonto_percent: number | null
          snapshot_created_at: string | null
          snapshot_discount_amount: number | null
          snapshot_discount_percent: number | null
          snapshot_gross_total: number | null
          snapshot_net_total: number | null
          snapshot_subtotal_net: number | null
          snapshot_vat_amount: number | null
          snapshot_vat_rate: number | null
          status: string
          terms_text: string | null
          updated_at: string
          valid_until: string | null
          version: number
          warranty_text: string | null
        }
        Insert: {
          acceptance_note?: string | null
          accepted_at?: string | null
          accepted_by?: string | null
          company_id: string
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          customer_address?: string | null
          customer_id: string
          customer_name: string
          customer_reference?: string | null
          execution_notes?: string | null
          execution_period_text?: string | null
          id?: string
          is_locked?: boolean
          notes?: string | null
          offer_date?: string
          offer_number: string
          payment_terms?: string | null
          project_location?: string | null
          project_name: string
          skonto_days?: number | null
          skonto_percent?: number | null
          snapshot_created_at?: string | null
          snapshot_discount_amount?: number | null
          snapshot_discount_percent?: number | null
          snapshot_gross_total?: number | null
          snapshot_net_total?: number | null
          snapshot_subtotal_net?: number | null
          snapshot_vat_amount?: number | null
          snapshot_vat_rate?: number | null
          status?: string
          terms_text?: string | null
          updated_at?: string
          valid_until?: string | null
          version?: number
          warranty_text?: string | null
        }
        Update: {
          acceptance_note?: string | null
          accepted_at?: string | null
          accepted_by?: string | null
          company_id?: string
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          customer_address?: string | null
          customer_id?: string
          customer_name?: string
          customer_reference?: string | null
          execution_notes?: string | null
          execution_period_text?: string | null
          id?: string
          is_locked?: boolean
          notes?: string | null
          offer_date?: string
          offer_number?: string
          payment_terms?: string | null
          project_location?: string | null
          project_name?: string
          skonto_days?: number | null
          skonto_percent?: number | null
          snapshot_created_at?: string | null
          snapshot_discount_amount?: number | null
          snapshot_discount_percent?: number | null
          snapshot_gross_total?: number | null
          snapshot_net_total?: number | null
          snapshot_subtotal_net?: number | null
          snapshot_vat_amount?: number | null
          snapshot_vat_rate?: number | null
          status?: string
          terms_text?: string | null
          updated_at?: string
          valid_until?: string | null
          version?: number
          warranty_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "offers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          company_id: string | null
          completed_at: string | null
          confirmed_at: string | null
          created_at: string
          currency: string | null
          customer_id: string
          description: string | null
          due_date: string | null
          id: string
          notes: string | null
          offer_id: string | null
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
          completed_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          currency?: string | null
          customer_id: string
          description?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          offer_id?: string | null
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
          completed_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          currency?: string | null
          customer_id?: string
          description?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          offer_id?: string | null
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
          {
            foreignKeyName: "orders_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers_with_totals"
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
          offer_id: string | null
          offer_number: string | null
          order_id: string | null
          planned_hours: number | null
          project_manager_id: string | null
          start_date: string
          status: string
          target_end_date: string | null
          target_hours: number | null
          target_margin: number | null
          target_material_cost: number | null
          target_other_cost: number | null
          target_revenue: number | null
          target_total_cost: number | null
          targets_locked: boolean | null
          targets_snapshot_at: string | null
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
          offer_id?: string | null
          offer_number?: string | null
          order_id?: string | null
          planned_hours?: number | null
          project_manager_id?: string | null
          start_date: string
          status?: string
          target_end_date?: string | null
          target_hours?: number | null
          target_margin?: number | null
          target_material_cost?: number | null
          target_other_cost?: number | null
          target_revenue?: number | null
          target_total_cost?: number | null
          targets_locked?: boolean | null
          targets_snapshot_at?: string | null
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
          offer_id?: string | null
          offer_number?: string | null
          order_id?: string | null
          planned_hours?: number | null
          project_manager_id?: string | null
          start_date?: string
          status?: string
          target_end_date?: string | null
          target_hours?: number | null
          target_margin?: number | null
          target_material_cost?: number | null
          target_other_cost?: number | null
          target_revenue?: number | null
          target_total_cost?: number | null
          targets_locked?: boolean | null
          targets_snapshot_at?: string | null
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
          {
            foreignKeyName: "projects_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: true
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: true
            referencedRelation: "offers_with_totals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
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
      reminder_logs: {
        Row: {
          created_at: string
          id: string
          message: string | null
          recipient: string
          reference_id: string | null
          sent_at: string
          status: string | null
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          recipient: string
          reference_id?: string | null
          sent_at?: string
          status?: string | null
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          recipient?: string
          reference_id?: string | null
          sent_at?: string
          status?: string | null
          type?: string
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          material_id: string
          movement_type: string
          notes: string | null
          project_id: string | null
          quantity: number
          reference_number: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          material_id: string
          movement_type: string
          notes?: string | null
          project_id?: string | null
          quantity: number
          reference_number?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          material_id?: string
          movement_type?: string
          notes?: string | null
          project_id?: string | null
          quantity?: number
          reference_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_invoice_items: {
        Row: {
          account_code: string | null
          cost_center_id: string | null
          description: string
          discount_percent: number | null
          id: string
          invoice_id: string
          material_id: string | null
          net_amount: number
          position_no: number | null
          project_id: string | null
          quantity: number
          tax_amount: number
          tax_rate: number
          unit: string | null
          unit_price: number
        }
        Insert: {
          account_code?: string | null
          cost_center_id?: string | null
          description: string
          discount_percent?: number | null
          id?: string
          invoice_id: string
          material_id?: string | null
          net_amount: number
          position_no?: number | null
          project_id?: string | null
          quantity?: number
          tax_amount: number
          tax_rate: number
          unit?: string | null
          unit_price: number
        }
        Update: {
          account_code?: string | null
          cost_center_id?: string | null
          description?: string
          discount_percent?: number | null
          id?: string
          invoice_id?: string
          material_id?: string | null
          net_amount?: number
          position_no?: number | null
          project_id?: string | null
          quantity?: number
          tax_amount?: number
          tax_rate?: number
          unit?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "supplier_invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "supplier_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_invoice_payments: {
        Row: {
          amount: number
          bank_transaction_id: string | null
          created_at: string | null
          created_by: string | null
          id: string
          invoice_id: string
          notes: string | null
          paid_at: string
          payment_method: string | null
          payment_reference: string | null
        }
        Insert: {
          amount: number
          bank_transaction_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          invoice_id: string
          notes?: string | null
          paid_at: string
          payment_method?: string | null
          payment_reference?: string | null
        }
        Update: {
          amount?: number
          bank_transaction_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          invoice_id?: string
          notes?: string | null
          paid_at?: string
          payment_method?: string | null
          payment_reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_invoice_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "supplier_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_invoice_taxes: {
        Row: {
          base_amount: number
          id: string
          invoice_id: string
          tax_amount: number
          tax_rate: number
          tax_type: string | null
        }
        Insert: {
          base_amount: number
          id?: string
          invoice_id: string
          tax_amount: number
          tax_rate: number
          tax_type?: string | null
        }
        Update: {
          base_amount?: number
          id?: string
          invoice_id?: string
          tax_amount?: number
          tax_rate?: number
          tax_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_invoice_taxes_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "supplier_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_invoices: {
        Row: {
          approval_status: string | null
          company_id: string | null
          created_at: string | null
          created_by: string
          currency: string
          description: string | null
          due_date: string | null
          gross_total: number | null
          iban: string | null
          id: string
          immutable_file_id: string | null
          invoice_date: string
          invoice_number: string
          net_total: number | null
          ocr_result_id: string | null
          order_id: string | null
          payment_status: string
          payment_terms: string | null
          project_id: string | null
          reference: string | null
          status: string
          supplier_id: string | null
          supplier_name: string
          total_amount: number
          updated_at: string | null
          validation_errors: Json | null
          vat_amount: number | null
          vat_total: number | null
        }
        Insert: {
          approval_status?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by: string
          currency?: string
          description?: string | null
          due_date?: string | null
          gross_total?: number | null
          iban?: string | null
          id?: string
          immutable_file_id?: string | null
          invoice_date: string
          invoice_number: string
          net_total?: number | null
          ocr_result_id?: string | null
          order_id?: string | null
          payment_status?: string
          payment_terms?: string | null
          project_id?: string | null
          reference?: string | null
          status?: string
          supplier_id?: string | null
          supplier_name: string
          total_amount: number
          updated_at?: string | null
          validation_errors?: Json | null
          vat_amount?: number | null
          vat_total?: number | null
        }
        Update: {
          approval_status?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string
          currency?: string
          description?: string | null
          due_date?: string | null
          gross_total?: number | null
          iban?: string | null
          id?: string
          immutable_file_id?: string | null
          invoice_date?: string
          invoice_number?: string
          net_total?: number | null
          ocr_result_id?: string | null
          order_id?: string | null
          payment_status?: string
          payment_terms?: string | null
          project_id?: string | null
          reference?: string | null
          status?: string
          supplier_id?: string | null
          supplier_name?: string
          total_amount?: number
          updated_at?: string | null
          validation_errors?: Json | null
          vat_amount?: number | null
          vat_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_invoices_immutable_file_id_fkey"
            columns: ["immutable_file_id"]
            isOneToOne: false
            referencedRelation: "immutable_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_invoices_ocr_result_id_fkey"
            columns: ["ocr_result_id"]
            isOneToOne: false
            referencedRelation: "ocr_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_invoices_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: Json | null
          bic: string | null
          company_id: string
          contact_info: Json | null
          created_at: string | null
          created_by: string | null
          iban: string | null
          id: string
          is_active: boolean | null
          name: string
          notes: string | null
          payment_terms: string | null
          tax_number: string | null
          updated_at: string | null
          vat_id: string | null
        }
        Insert: {
          address?: Json | null
          bic?: string | null
          company_id: string
          contact_info?: Json | null
          created_at?: string | null
          created_by?: string | null
          iban?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          notes?: string | null
          payment_terms?: string | null
          tax_number?: string | null
          updated_at?: string | null
          vat_id?: string | null
        }
        Update: {
          address?: Json | null
          bic?: string | null
          company_id?: string
          contact_info?: Json | null
          created_at?: string | null
          created_by?: string | null
          iban?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          notes?: string | null
          payment_terms?: string | null
          tax_number?: string | null
          updated_at?: string | null
          vat_id?: string | null
        }
        Relationships: []
      }
      time_audit_log: {
        Row: {
          action: string
          changed_at: string
          changed_by: string | null
          company_id: string | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          ip_address: unknown
          new_values: Json | null
          old_values: Json | null
          reason: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by?: string | null
          company_id?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          reason?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string | null
          company_id?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          reason?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "time_audit_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entries: {
        Row: {
          attendance_id: string | null
          billable: boolean | null
          break_duration: number | null
          company_id: string | null
          cost_center_id: string | null
          created_at: string
          description: string | null
          employee_id: string
          end_location_address: string | null
          end_location_lat: number | null
          end_location_lng: number | null
          end_time: string | null
          gps_location: Json | null
          id: string
          is_offline_synced: boolean | null
          offline_created_at: string | null
          project_id: string | null
          start_location_address: string | null
          start_location_lat: number | null
          start_location_lng: number | null
          start_time: string
          status: string
          status_approval: string | null
          type: string | null
          updated_at: string
        }
        Insert: {
          attendance_id?: string | null
          billable?: boolean | null
          break_duration?: number | null
          company_id?: string | null
          cost_center_id?: string | null
          created_at?: string
          description?: string | null
          employee_id: string
          end_location_address?: string | null
          end_location_lat?: number | null
          end_location_lng?: number | null
          end_time?: string | null
          gps_location?: Json | null
          id?: string
          is_offline_synced?: boolean | null
          offline_created_at?: string | null
          project_id?: string | null
          start_location_address?: string | null
          start_location_lat?: number | null
          start_location_lng?: number | null
          start_time: string
          status?: string
          status_approval?: string | null
          type?: string | null
          updated_at?: string
        }
        Update: {
          attendance_id?: string | null
          billable?: boolean | null
          break_duration?: number | null
          company_id?: string | null
          cost_center_id?: string | null
          created_at?: string
          description?: string | null
          employee_id?: string
          end_location_address?: string | null
          end_location_lat?: number | null
          end_location_lng?: number | null
          end_time?: string | null
          gps_location?: Json | null
          id?: string
          is_offline_synced?: boolean | null
          offline_created_at?: string | null
          project_id?: string | null
          start_location_address?: string | null
          start_location_lat?: number | null
          start_location_lng?: number | null
          start_time?: string
          status?: string
          status_approval?: string | null
          type?: string | null
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
            foreignKeyName: "time_entries_attendance_id_fkey"
            columns: ["attendance_id"]
            isOneToOne: false
            referencedRelation: "attendance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
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
            foreignKeyName: "fk_corrections_time_entry"
            columns: ["time_entry_id"]
            isOneToOne: false
            referencedRelation: "time_entries_cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_corrections_time_entry"
            columns: ["time_entry_id"]
            isOneToOne: false
            referencedRelation: "time_entries_projects"
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
      time_rules: {
        Row: {
          auto_break_after_minutes: number | null
          auto_break_duration_minutes: number | null
          auto_submit_on_coverage: boolean | null
          company_id: string | null
          coverage_green_min: number | null
          coverage_yellow_min: number | null
          created_at: string
          id: string
          is_active: boolean | null
          max_work_day_minutes: number | null
          max_work_week_minutes: number | null
          min_break_duration_minutes: number | null
          min_breaks_minutes: number | null
          min_work_duration_minutes: number | null
          overtime_daily_minutes: number | null
          overtime_weekly_minutes: number | null
          reconciliation_tolerance_percent: number | null
          require_reconciliation: boolean | null
          round_direction: string | null
          round_to_minutes: number | null
          updated_at: string
        }
        Insert: {
          auto_break_after_minutes?: number | null
          auto_break_duration_minutes?: number | null
          auto_submit_on_coverage?: boolean | null
          company_id?: string | null
          coverage_green_min?: number | null
          coverage_yellow_min?: number | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          max_work_day_minutes?: number | null
          max_work_week_minutes?: number | null
          min_break_duration_minutes?: number | null
          min_breaks_minutes?: number | null
          min_work_duration_minutes?: number | null
          overtime_daily_minutes?: number | null
          overtime_weekly_minutes?: number | null
          reconciliation_tolerance_percent?: number | null
          require_reconciliation?: boolean | null
          round_direction?: string | null
          round_to_minutes?: number | null
          updated_at?: string
        }
        Update: {
          auto_break_after_minutes?: number | null
          auto_break_duration_minutes?: number | null
          auto_submit_on_coverage?: boolean | null
          company_id?: string | null
          coverage_green_min?: number | null
          coverage_yellow_min?: number | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          max_work_day_minutes?: number | null
          max_work_week_minutes?: number | null
          min_break_duration_minutes?: number | null
          min_breaks_minutes?: number | null
          min_work_duration_minutes?: number | null
          overtime_daily_minutes?: number | null
          overtime_weekly_minutes?: number | null
          reconciliation_tolerance_percent?: number | null
          require_reconciliation?: boolean | null
          round_direction?: string | null
          round_to_minutes?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_rules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      time_segments: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          approved_minutes: number | null
          audit_delta: Json | null
          company_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          duration_minutes_computed: number | null
          employee_id: string
          ended_at: string | null
          id: string
          notes: string | null
          project_id: string | null
          segment_type: string
          started_at: string
          status: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          approved_minutes?: number | null
          audit_delta?: Json | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_minutes_computed?: number | null
          employee_id: string
          ended_at?: string | null
          id?: string
          notes?: string | null
          project_id?: string | null
          segment_type?: string
          started_at: string
          status?: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          approved_minutes?: number | null
          audit_delta?: Json | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_minutes_computed?: number | null
          employee_id?: string
          ended_at?: string | null
          id?: string
          notes?: string | null
          project_id?: string | null
          segment_type?: string
          started_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_segments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_segments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_segments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      timesheet_locks: {
        Row: {
          company_id: string | null
          created_at: string
          employee_id: string
          id: string
          locked_at: string
          locked_by: string
          reason: string | null
          unlock_reason: string | null
          unlocked_at: string | null
          unlocked_by: string | null
          week_start_date: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          employee_id: string
          id?: string
          locked_at?: string
          locked_by: string
          reason?: string | null
          unlock_reason?: string | null
          unlocked_at?: string | null
          unlocked_by?: string | null
          week_start_date: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          employee_id?: string
          id?: string
          locked_at?: string
          locked_by?: string
          reason?: string | null
          unlock_reason?: string | null
          unlocked_at?: string | null
          unlocked_by?: string | null
          week_start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "timesheet_locks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheet_locks_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheet_locks_locked_by_fkey"
            columns: ["locked_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheet_locks_unlocked_by_fkey"
            columns: ["unlocked_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      timesheets: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          break_minutes: number | null
          company_id: string | null
          created_at: string
          date: string
          description: string | null
          employee_id: string
          end_time: string | null
          hourly_rate: number | null
          hours: number
          id: string
          is_billable: boolean | null
          project_id: string
          start_time: string | null
          task_category: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          break_minutes?: number | null
          company_id?: string | null
          created_at?: string
          date: string
          description?: string | null
          employee_id: string
          end_time?: string | null
          hourly_rate?: number | null
          hours: number
          id?: string
          is_billable?: boolean | null
          project_id: string
          start_time?: string | null
          task_category?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          break_minutes?: number | null
          company_id?: string | null
          created_at?: string
          date?: string
          description?: string | null
          employee_id?: string
          end_time?: string | null
          hourly_rate?: number | null
          hours?: number
          id?: string
          is_billable?: boolean | null
          project_id?: string
          start_time?: string | null
          task_category?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "timesheets_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheets_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
      waitlist: {
        Row: {
          created_at: string
          email: string
          goal: string | null
          id: string
          obstacle: string | null
          situation: string | null
          tried: string | null
        }
        Insert: {
          created_at?: string
          email: string
          goal?: string | null
          id?: string
          obstacle?: string | null
          situation?: string | null
          tried?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          goal?: string | null
          id?: string
          obstacle?: string | null
          situation?: string | null
          tried?: string | null
        }
        Relationships: []
      }
      weekly_reports: {
        Row: {
          company_id: string | null
          created_at: string
          data: Json
          employee_count: number | null
          id: string
          total_hours: number | null
          week_end: string
          week_start: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          data: Json
          employee_count?: number | null
          id?: string
          total_hours?: number | null
          week_end: string
          week_start: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          data?: Json
          employee_count?: number | null
          id?: string
          total_hours?: number | null
          week_end?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_reports_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
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
      offer_items_customer: {
        Row: {
          description: string | null
          id: string | null
          is_optional: boolean | null
          item_type: string | null
          offer_id: string | null
          position_number: number | null
          quantity: number | null
          total_net: number | null
          unit: string | null
          unit_price_net: number | null
          vat_rate: number | null
        }
        Insert: {
          description?: string | null
          id?: string | null
          is_optional?: boolean | null
          item_type?: string | null
          offer_id?: string | null
          position_number?: number | null
          quantity?: number | null
          total_net?: never
          unit?: string | null
          unit_price_net?: number | null
          vat_rate?: number | null
        }
        Update: {
          description?: string | null
          id?: string | null
          is_optional?: boolean | null
          item_type?: string | null
          offer_id?: string | null
          position_number?: number | null
          quantity?: number | null
          total_net?: never
          unit?: string | null
          unit_price_net?: number | null
          vat_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "offer_items_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_items_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers_with_totals"
            referencedColumns: ["id"]
          },
        ]
      }
      offers_with_totals: {
        Row: {
          acceptance_note: string | null
          accepted_at: string | null
          accepted_by: string | null
          company_id: string | null
          contact_person: string | null
          created_at: string | null
          created_by: string | null
          customer_address: string | null
          customer_id: string | null
          customer_name: string | null
          customer_reference: string | null
          discount_amount: number | null
          discount_percent: number | null
          execution_notes: string | null
          execution_period_text: string | null
          gross_total: number | null
          id: string | null
          is_locked: boolean | null
          net_total: number | null
          notes: string | null
          offer_date: string | null
          offer_number: string | null
          payment_terms: string | null
          project_location: string | null
          project_name: string | null
          skonto_days: number | null
          skonto_percent: number | null
          snapshot_created_at: string | null
          snapshot_discount_amount: number | null
          snapshot_discount_percent: number | null
          snapshot_gross_total: number | null
          snapshot_net_total: number | null
          snapshot_subtotal_net: number | null
          snapshot_vat_amount: number | null
          snapshot_vat_rate: number | null
          status: string | null
          subtotal_net: number | null
          terms_text: string | null
          updated_at: string | null
          valid_until: string | null
          vat_amount: number | null
          vat_rate: number | null
          version: number | null
          warranty_text: string | null
        }
        Relationships: [
          {
            foreignKeyName: "offers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entries_cost_centers: {
        Row: {
          attendance_id: string | null
          billable: boolean | null
          break_duration: number | null
          company_id: string | null
          cost_center_id: string | null
          created_at: string | null
          description: string | null
          employee_id: string | null
          end_location_address: string | null
          end_location_lat: number | null
          end_location_lng: number | null
          end_time: string | null
          gps_location: Json | null
          id: string | null
          is_offline_synced: boolean | null
          offline_created_at: string | null
          project_id: string | null
          start_location_address: string | null
          start_location_lat: number | null
          start_location_lng: number | null
          start_time: string | null
          status: string | null
          status_approval: string | null
          type: string | null
          updated_at: string | null
        }
        Insert: {
          attendance_id?: string | null
          billable?: boolean | null
          break_duration?: number | null
          company_id?: string | null
          cost_center_id?: string | null
          created_at?: string | null
          description?: string | null
          employee_id?: string | null
          end_location_address?: string | null
          end_location_lat?: number | null
          end_location_lng?: number | null
          end_time?: string | null
          gps_location?: Json | null
          id?: string | null
          is_offline_synced?: boolean | null
          offline_created_at?: string | null
          project_id?: string | null
          start_location_address?: string | null
          start_location_lat?: number | null
          start_location_lng?: number | null
          start_time?: string | null
          status?: string | null
          status_approval?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          attendance_id?: string | null
          billable?: boolean | null
          break_duration?: number | null
          company_id?: string | null
          cost_center_id?: string | null
          created_at?: string | null
          description?: string | null
          employee_id?: string | null
          end_location_address?: string | null
          end_location_lat?: number | null
          end_location_lng?: number | null
          end_time?: string | null
          gps_location?: Json | null
          id?: string | null
          is_offline_synced?: boolean | null
          offline_created_at?: string | null
          project_id?: string | null
          start_location_address?: string | null
          start_location_lat?: number | null
          start_location_lng?: number | null
          start_time?: string | null
          status?: string | null
          status_approval?: string | null
          type?: string | null
          updated_at?: string | null
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
            foreignKeyName: "time_entries_attendance_id_fkey"
            columns: ["attendance_id"]
            isOneToOne: false
            referencedRelation: "attendance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entries_projects: {
        Row: {
          attendance_id: string | null
          billable: boolean | null
          break_duration: number | null
          company_id: string | null
          cost_center_id: string | null
          created_at: string | null
          description: string | null
          employee_id: string | null
          end_location_address: string | null
          end_location_lat: number | null
          end_location_lng: number | null
          end_time: string | null
          gps_location: Json | null
          id: string | null
          is_offline_synced: boolean | null
          offline_created_at: string | null
          project_id: string | null
          start_location_address: string | null
          start_location_lat: number | null
          start_location_lng: number | null
          start_time: string | null
          status: string | null
          status_approval: string | null
          type: string | null
          updated_at: string | null
        }
        Insert: {
          attendance_id?: string | null
          billable?: boolean | null
          break_duration?: number | null
          company_id?: string | null
          cost_center_id?: string | null
          created_at?: string | null
          description?: string | null
          employee_id?: string | null
          end_location_address?: string | null
          end_location_lat?: number | null
          end_location_lng?: number | null
          end_time?: string | null
          gps_location?: Json | null
          id?: string | null
          is_offline_synced?: boolean | null
          offline_created_at?: string | null
          project_id?: string | null
          start_location_address?: string | null
          start_location_lat?: number | null
          start_location_lng?: number | null
          start_time?: string | null
          status?: string | null
          status_approval?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          attendance_id?: string | null
          billable?: boolean | null
          break_duration?: number | null
          company_id?: string | null
          cost_center_id?: string | null
          created_at?: string | null
          description?: string | null
          employee_id?: string | null
          end_location_address?: string | null
          end_location_lat?: number | null
          end_location_lng?: number | null
          end_time?: string | null
          gps_location?: Json | null
          id?: string | null
          is_offline_synced?: boolean | null
          offline_created_at?: string | null
          project_id?: string | null
          start_location_address?: string | null
          start_location_lat?: number | null
          start_location_lng?: number | null
          start_time?: string | null
          status?: string | null
          status_approval?: string | null
          type?: string | null
          updated_at?: string | null
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
            foreignKeyName: "time_entries_attendance_id_fkey"
            columns: ["attendance_id"]
            isOneToOne: false
            referencedRelation: "attendance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_offer_and_create_project: {
        Args: {
          p_acceptance_note?: string
          p_accepted_by?: string
          p_offer_id: string
        }
        Returns: string
      }
      accept_offer_create_order: {
        Args: {
          p_accepted_by?: string
          p_create_project?: boolean
          p_offer_id: string
        }
        Returns: {
          offer_id: string
          order_id: string
          order_number: string
          project_id: string
        }[]
      }
      add_invoice_manual_item: {
        Args: {
          p_description: string
          p_invoice_id: string
          p_quantity?: number
          p_unit?: string
          p_unit_price?: number
          p_vat_rate?: number
        }
        Returns: string
      }
      build_invoice_from_project: {
        Args: {
          p_deduct_advance_invoices?: boolean
          p_include_delivery_note_extras?: boolean
          p_include_offer_items?: boolean
          p_invoice_type?: string
          p_project_id: string
        }
        Returns: string
      }
      calculate_invoice_totals: {
        Args: { p_invoice_id: string }
        Returns: {
          items_count: number
          total_gross: number
          total_net: number
          total_vat: number
        }[]
      }
      calculate_offer_target_totals: {
        Args: { p_offer_id: string }
        Returns: {
          planned_hours: number
          planned_labor_cost: number
          planned_material_cost: number
          planned_other_cost: number
          target_margin: number
          target_revenue: number
          total_planned_cost: number
        }[]
      }
      calculate_offer_totals: {
        Args: { p_offer_id: string }
        Returns: {
          discount_amount: number
          discount_percent: number
          gross_total: number
          net_total: number
          subtotal_net: number
          vat_amount: number
          vat_rate: number
        }[]
      }
      check_overtime_limits: {
        Args: { p_date: string; p_employee_id: string; p_work_minutes: number }
        Returns: {
          daily_limit: number
          daily_total: number
          violates_daily: boolean
          violates_weekly: boolean
          weekly_limit: number
          weekly_total: number
        }[]
      }
      check_reconciliation: {
        Args: { p_date: string; p_employee_id: string }
        Returns: {
          attendance_minutes: number
          break_minutes: number
          cost_center_minutes: number
          coverage_percent: number
          difference_minutes: number
          is_within_tolerance: boolean
          project_minutes: number
          status: string
          total_accounted_minutes: number
        }[]
      }
      cleanup_expired_invitations: { Args: never; Returns: undefined }
      cleanup_old_logs: { Args: never; Returns: undefined }
      create_offer_with_targets:
      | {
        Args: { items_data: Json; offer_data: Json; targets_data: Json }
        Returns: Json
      }
      | {
        Args: {
          p_company_id: string
          p_customer_address?: string
          p_customer_id: string
          p_customer_name: string
          p_internal_hourly_rate?: number
          p_planned_hours?: number
          p_project_location?: string
          p_project_manager_id?: string
          p_project_name: string
          p_target_end_date?: string
          p_target_start_date?: string
        }
        Returns: string
      }
      create_project_from_order: {
        Args: {
          p_order_id: string
          p_project_manager_id?: string
          p_project_name?: string
        }
        Returns: string
      }
      employee_has_grant: { Args: { p_grant: string }; Returns: boolean }
      fn_detect_invoice_duplicates: {
        Args: {
          p_company_id: string
          p_exclude_invoice_id?: string
          p_gross_total: number
          p_invoice_date: string
          p_invoice_number: string
          p_supplier_id: string
        }
        Returns: {
          confidence: number
          details: Json
          duplicate_type: string
          invoice_id: string
        }[]
      }
      fn_find_supplier_matches: {
        Args: {
          p_company_id: string
          p_iban?: string
          p_name: string
          p_vat_id?: string
        }
        Returns: {
          match_reason: string
          match_score: number
          supplier_id: string
        }[]
      }
      fn_validate_invoice_data: {
        Args: { p_company_id: string; p_structured_data: Json }
        Returns: Json
      }
      generate_delivery_note_number: {
        Args: { p_company_id: string }
        Returns: string
      }
      generate_invoice_number:
      | { Args: never; Returns: string }
      | { Args: { p_company_id: string }; Returns: string }
      generate_offer_number: { Args: { p_company_id: string }; Returns: string }
      generate_order_number:
      | { Args: never; Returns: string }
      | { Args: { p_company_id: string }; Returns: string }
      generate_quote_number: { Args: never; Returns: string }
      get_active_cost_centers: {
        Args: { p_company_id: string }
        Returns: {
          billable: boolean
          code: string
          color: string
          description: string
          icon: string
          id: string
          name: string
          payroll: boolean
        }[]
      }
      get_audit_trail: {
        Args: { p_entity_id: string; p_entity_type: string }
        Returns: {
          action: string
          changed_at: string
          changed_by_email: string
          id: string
          new_values: Json
          old_values: Json
          reason: string
        }[]
      }
      get_current_attendance: {
        Args: { p_employee_id: string }
        Returns: {
          break_minutes: number
          clock_in: string
          clock_out: string
          date: string
          id: string
          status: string
          work_minutes: number
        }[]
      }
      get_current_employee_id: { Args: never; Returns: string }
      get_current_employee_with_grants: {
        Args: never
        Returns: {
          company_id: string
          email: string
          first_name: string
          grants: string[]
          id: string
          last_name: string
          role: string
          user_id: string
        }[]
      }
      get_current_schema_version: { Args: never; Returns: string }
      get_next_number: {
        Args: { comp_id?: string; seq_name: string }
        Returns: string
      }
      get_time_rules: {
        Args: { p_company_id: string }
        Returns: {
          auto_break_after_minutes: number
          auto_break_duration_minutes: number
          coverage_green_min: number
          coverage_yellow_min: number
          id: string
          max_work_day_minutes: number
          max_work_week_minutes: number
          min_break_duration_minutes: number
          min_breaks_minutes: number
          min_work_duration_minutes: number
          overtime_daily_minutes: number
          overtime_weekly_minutes: number
          reconciliation_tolerance_percent: number
          require_reconciliation: boolean
          round_direction: string
          round_to_minutes: number
        }[]
      }
      get_user_company_ids: { Args: never; Returns: string[] }
      has_role:
      | {
        Args: {
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: boolean
      }
      | { Args: { role: string }; Returns: boolean }
      increment_vacation_days_used: {
        Args: { days_to_add: number; employee_id_param: string }
        Returns: undefined
      }
      is_current_user_manager: { Args: never; Returns: boolean }
      is_feature_enabled: {
        Args: { p_company_id?: string; p_flag_name: string }
        Returns: boolean
      }
      is_manager_safe: { Args: never; Returns: boolean }
      is_user_manager_in_company: {
        Args: { p_company_id: string }
        Returns: boolean
      }
      is_valid_delivery_note_status_transition: {
        Args: { p_new_status: string; p_old_status: string }
        Returns: boolean
      }
      is_valid_invoice_status_transition: {
        Args: { p_new_status: string; p_old_status: string }
        Returns: boolean
      }
      is_valid_offer_status_transition: {
        Args: { p_new_status: string; p_old_status: string }
        Returns: boolean
      }
      is_valid_order_status_transition: {
        Args: { p_new_status: string; p_old_status: string }
        Returns: boolean
      }
      is_valid_project_status_transition: {
        Args: { p_new_status: string; p_old_status: string }
        Returns: boolean
      }
      is_version_applied: { Args: { p_version: string }; Returns: boolean }
      is_week_locked: {
        Args: { p_date: string; p_employee_id: string }
        Returns: boolean
      }
      lock_week: {
        Args: {
          p_employee_id: string
          p_reason?: string
          p_week_start_date: string
        }
        Returns: string
      }
      log_audit_entry: {
        Args: {
          p_action: string
          p_entity_id: string
          p_entity_type: string
          p_new_values?: Json
          p_old_values?: Json
          p_reason?: string
        }
        Returns: string
      }
      register_schema_version: {
        Args: {
          p_description: string
          p_migration_time_ms?: number
          p_version: string
        }
        Returns: undefined
      }
      rpc_apply_time_rules: {
        Args: { p_apply_rounding?: boolean; p_delivery_note_id: string }
        Returns: Json
      }
      rpc_approve_time_segments: {
        Args: {
          p_date_from?: string
          p_date_to?: string
          p_employee_id?: string
          p_segment_ids?: string[]
        }
        Returns: Json
      }
      rpc_bulk_approve_invoices: {
        Args: { p_company_id: string; p_invoice_ids: string[] }
        Returns: Json
      }
      rpc_create_delivery_note: {
        Args: {
          p_customer_id: string
          p_date_from?: string
          p_date_to?: string
          p_delivery_address?: Json
          p_delivery_date?: string
          p_include_materials?: boolean
          p_project_id: string
          p_segment_ids?: string[]
        }
        Returns: Json
      }
      rpc_get_active_time_tracking: { Args: never; Returns: Json }
      rpc_get_invoice_details: {
        Args: { p_company_id?: string; p_invoice_id: string }
        Returns: Json
      }
      rpc_get_time_summary: {
        Args: {
          p_employee_id?: string
          p_end_date: string
          p_start_date: string
        }
        Returns: Json
      }
      rpc_import_supplier_invoice_from_ocr: {
        Args: {
          p_auto_approve?: boolean
          p_company_id: string
          p_ocr_result_id: string
        }
        Returns: Json
      }
      rpc_mark_invoice_paid: {
        Args: {
          p_amount: number
          p_bank_tx_id?: string
          p_company_id?: string
          p_invoice_id: string
          p_paid_at: string
          p_reference?: string
        }
        Returns: Json
      }
      rpc_revalidate_invoice: {
        Args: { p_company_id: string; p_invoice_id: string }
        Returns: Json
      }
      rpc_set_invoice_approval: {
        Args: {
          p_approval_status: string
          p_company_id?: string
          p_invoice_id: string
          p_reason?: string
        }
        Returns: Json
      }
      rpc_sign_delivery_note: {
        Args: {
          p_delivery_note_id: string
          p_signature_data: Json
          p_signed_by_name: string
        }
        Returns: Json
      }
      rpc_start_time_segment: {
        Args: {
          p_description?: string
          p_project_id: string
          p_work_type?: string
        }
        Returns: string
      }
      rpc_start_time_tracking: {
        Args: {
          p_description?: string
          p_project_id: string
          p_segment_type?: string
        }
        Returns: Json
      }
      rpc_stop_time_segment: { Args: { p_segment_id: string }; Returns: Json }
      rpc_stop_time_tracking: { Args: { p_notes?: string }; Returns: Json }
      rpc_switch_project: {
        Args: {
          p_description?: string
          p_from_segment_id: string
          p_to_project_id: string
          p_to_work_type?: string
        }
        Returns: Json
      }
      rpc_switch_time_tracking: {
        Args: {
          p_description?: string
          p_new_project_id: string
          p_notes_for_previous?: string
          p_segment_type?: string
        }
        Returns: Json
      }
      sanitize_text_input: { Args: { input_text: string }; Returns: string }
      sync_invoice_totals: {
        Args: { p_invoice_id: string }
        Returns: undefined
      }
      unlock_week: {
        Args: {
          p_employee_id: string
          p_reason: string
          p_week_start_date: string
        }
        Returns: boolean
      }
      user_has_company_access: {
        Args: { company_id_param: string }
        Returns: boolean
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
