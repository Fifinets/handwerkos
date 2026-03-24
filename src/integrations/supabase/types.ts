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
      ai_index: {
        Row: {
          company_id: string | null
          content_text: string
          created_at: string
          embedding: string | null
          id: string
          indexed_at: string
          metadata: Json | null
          ref_id: string
          ref_type: string
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          content_text: string
          created_at?: string
          embedding?: string | null
          id?: string
          indexed_at?: string
          metadata?: Json | null
          ref_id: string
          ref_type: string
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          content_text?: string
          created_at?: string
          embedding?: string | null
          id?: string
          indexed_at?: string
          metadata?: Json | null
          ref_id?: string
          ref_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_processing_queue: {
        Row: {
          attempts: number | null
          company_id: string | null
          completed_at: string | null
          created_at: string
          entity_id: string
          entity_type: string
          error_message: string | null
          id: string
          input_data: Json
          max_attempts: number | null
          operation_type: string
          priority: number | null
          result_data: Json | null
          scheduled_for: string | null
          started_at: string | null
          status: string | null
        }
        Insert: {
          attempts?: number | null
          company_id?: string | null
          completed_at?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          error_message?: string | null
          id?: string
          input_data: Json
          max_attempts?: number | null
          operation_type: string
          priority?: number | null
          result_data?: Json | null
          scheduled_for?: string | null
          started_at?: string | null
          status?: string | null
        }
        Update: {
          attempts?: number | null
          company_id?: string | null
          completed_at?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          error_message?: string | null
          id?: string
          input_data?: Json
          max_attempts?: number | null
          operation_type?: string
          priority?: number | null
          result_data?: Json | null
          scheduled_for?: string | null
          started_at?: string | null
          status?: string | null
        }
        Relationships: []
      }
      ai_suggestions: {
        Row: {
          applied_at: string | null
          applied_by: string | null
          company_id: string | null
          confidence_score: number | null
          created_at: string
          feedback_notes: string | null
          feedback_score: number | null
          id: string
          input_data: Json
          model_version: string | null
          output_data: Json
          project_id: string | null
          status: string | null
          suggestion_type: string
          trace_id: string | null
          updated_at: string
        }
        Insert: {
          applied_at?: string | null
          applied_by?: string | null
          company_id?: string | null
          confidence_score?: number | null
          created_at?: string
          feedback_notes?: string | null
          feedback_score?: number | null
          id?: string
          input_data: Json
          model_version?: string | null
          output_data: Json
          project_id?: string | null
          status?: string | null
          suggestion_type: string
          trace_id?: string | null
          updated_at?: string
        }
        Update: {
          applied_at?: string | null
          applied_by?: string | null
          company_id?: string | null
          confidence_score?: number | null
          created_at?: string
          feedback_notes?: string | null
          feedback_score?: number | null
          id?: string
          input_data?: Json
          model_version?: string | null
          output_data?: Json
          project_id?: string | null
          status?: string | null
          suggestion_type?: string
          trace_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_suggestions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "employee_assigned_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_suggestions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_training_data: {
        Row: {
          company_id: string | null
          created_at: string
          data_type: string
          expected_output: Json
          id: string
          input_features: Json
          predicted_output: Json | null
          prediction_error: number | null
          project_id: string | null
          suggestion_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          data_type: string
          expected_output: Json
          id?: string
          input_features: Json
          predicted_output?: Json | null
          prediction_error?: number | null
          project_id?: string | null
          suggestion_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          data_type?: string
          expected_output?: Json
          id?: string
          input_features?: Json
          predicted_output?: Json | null
          prediction_error?: number | null
          project_id?: string | null
          suggestion_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_training_data_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "employee_assigned_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_training_data_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_training_data_suggestion_id_fkey"
            columns: ["suggestion_id"]
            isOneToOne: false
            referencedRelation: "ai_suggestions"
            referencedColumns: ["id"]
          },
        ]
      }
      amge_calculations: {
        Row: {
          agk_betrag: number | null
          agk_prozent: number | null
          bgk_bauleitung: number | null
          bgk_betrag: number | null
          bgk_geraete: number | null
          bgk_gesamt_prozent: number | null
          bgk_hilfsstoffe: number | null
          bgk_sonstige: number | null
          bgk_transport: number | null
          company_id: string
          created_at: string | null
          custom_surcharges: Json | null
          custom_surcharges_betrag: number | null
          description: string | null
          direktlohn: number
          gewinn_betrag: number | null
          gewinn_prozent: number | null
          id: string
          is_active: boolean | null
          lohn_mit_agk: number | null
          lohn_mit_bgk: number | null
          lohn_mit_custom: number | null
          lohn_mit_lzk: number | null
          lzk_berufsgenossenschaft: number | null
          lzk_betrag: number | null
          lzk_gesamt_prozent: number | null
          lzk_lohnfortzahlung: number | null
          lzk_sonstige: number | null
          lzk_sozialversicherung: number | null
          lzk_urlaubsgeld: number | null
          lzk_winterbau: number | null
          name: string
          updated_at: string | null
          valid_from: string | null
          valid_until: string | null
          verrechnungslohn: number | null
          wagnis_betrag: number | null
          wagnis_prozent: number | null
        }
        Insert: {
          agk_betrag?: number | null
          agk_prozent?: number | null
          bgk_bauleitung?: number | null
          bgk_betrag?: number | null
          bgk_geraete?: number | null
          bgk_gesamt_prozent?: number | null
          bgk_hilfsstoffe?: number | null
          bgk_sonstige?: number | null
          bgk_transport?: number | null
          company_id: string
          created_at?: string | null
          custom_surcharges?: Json | null
          custom_surcharges_betrag?: number | null
          description?: string | null
          direktlohn?: number
          gewinn_betrag?: number | null
          gewinn_prozent?: number | null
          id?: string
          is_active?: boolean | null
          lohn_mit_agk?: number | null
          lohn_mit_bgk?: number | null
          lohn_mit_custom?: number | null
          lohn_mit_lzk?: number | null
          lzk_berufsgenossenschaft?: number | null
          lzk_betrag?: number | null
          lzk_gesamt_prozent?: number | null
          lzk_lohnfortzahlung?: number | null
          lzk_sonstige?: number | null
          lzk_sozialversicherung?: number | null
          lzk_urlaubsgeld?: number | null
          lzk_winterbau?: number | null
          name?: string
          updated_at?: string | null
          valid_from?: string | null
          valid_until?: string | null
          verrechnungslohn?: number | null
          wagnis_betrag?: number | null
          wagnis_prozent?: number | null
        }
        Update: {
          agk_betrag?: number | null
          agk_prozent?: number | null
          bgk_bauleitung?: number | null
          bgk_betrag?: number | null
          bgk_geraete?: number | null
          bgk_gesamt_prozent?: number | null
          bgk_hilfsstoffe?: number | null
          bgk_sonstige?: number | null
          bgk_transport?: number | null
          company_id?: string
          created_at?: string | null
          custom_surcharges?: Json | null
          custom_surcharges_betrag?: number | null
          description?: string | null
          direktlohn?: number
          gewinn_betrag?: number | null
          gewinn_prozent?: number | null
          id?: string
          is_active?: boolean | null
          lohn_mit_agk?: number | null
          lohn_mit_bgk?: number | null
          lohn_mit_custom?: number | null
          lohn_mit_lzk?: number | null
          lzk_berufsgenossenschaft?: number | null
          lzk_betrag?: number | null
          lzk_gesamt_prozent?: number | null
          lzk_lohnfortzahlung?: number | null
          lzk_sonstige?: number | null
          lzk_sozialversicherung?: number | null
          lzk_urlaubsgeld?: number | null
          lzk_winterbau?: number | null
          name?: string
          updated_at?: string | null
          valid_from?: string | null
          valid_until?: string | null
          verrechnungslohn?: number | null
          wagnis_betrag?: number | null
          wagnis_prozent?: number | null
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          changed_fields: string[] | null
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
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          changed_fields?: string[] | null
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
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          changed_fields?: string[] | null
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
          user_email?: string | null
          user_id?: string | null
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
          project_id: string | null
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
          project_id?: string | null
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
          project_id?: string | null
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
          {
            foreignKeyName: "calendar_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "employee_assigned_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
          bank_account_holder: string | null
          bank_bic: string | null
          bank_iban: string | null
          bank_name: string | null
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
          bank_account_holder?: string | null
          bank_bic?: string | null
          bank_iban?: string | null
          bank_name?: string | null
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
          bank_account_holder?: string | null
          bank_bic?: string | null
          bank_iban?: string | null
          bank_name?: string | null
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
      customer_contacts: {
        Row: {
          company_id: string | null
          created_at: string
          customer_id: string
          email: string | null
          first_name: string
          id: string
          is_primary: boolean | null
          last_name: string
          phone: string | null
          role: string | null
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          customer_id: string
          email?: string | null
          first_name: string
          id?: string
          is_primary?: boolean | null
          last_name: string
          phone?: string | null
          role?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          customer_id?: string
          email?: string | null
          first_name?: string
          id?: string
          is_primary?: boolean | null
          last_name?: string
          phone?: string | null
          role?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_contacts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_notes: {
        Row: {
          company_id: string
          content: string
          created_at: string | null
          customer_id: string
          employee_id: string | null
          follow_up_date: string | null
          follow_up_done: boolean | null
          id: string
          note_type: string
          title: string | null
          updated_at: string | null
        }
        Insert: {
          company_id: string
          content: string
          created_at?: string | null
          customer_id: string
          employee_id?: string | null
          follow_up_date?: string | null
          follow_up_done?: boolean | null
          id?: string
          note_type?: string
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          content?: string
          created_at?: string | null
          customer_id?: string
          employee_id?: string | null
          follow_up_date?: string | null
          follow_up_done?: boolean | null
          id?: string
          note_type?: string
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_notes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_notes_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
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
          customer_type: string | null
          display_name: string | null
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
          customer_type?: string | null
          display_name?: string | null
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
          customer_type?: string | null
          display_name?: string | null
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
          id: string
          item_type: string
          material_name: string | null
          material_quantity: number | null
          material_unit: string | null
          photo_caption: string | null
          photo_url: string | null
          sort_order: number
          unit_price: number | null
        }
        Insert: {
          created_at?: string
          delivery_note_id: string
          id?: string
          item_type: string
          material_name?: string | null
          material_quantity?: number | null
          material_unit?: string | null
          photo_caption?: string | null
          photo_url?: string | null
          sort_order?: number
          unit_price?: number | null
        }
        Update: {
          created_at?: string
          delivery_note_id?: string
          id?: string
          item_type?: string
          material_name?: string | null
          material_quantity?: number | null
          material_unit?: string | null
          photo_caption?: string | null
          photo_url?: string | null
          sort_order?: number
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
        ]
      }
      delivery_notes: {
        Row: {
          additional_employee_ids: string[] | null
          approved_at: string | null
          approved_by: string | null
          break_minutes: number
          company_id: string
          created_at: string
          customer_id: string | null
          delivery_note_number: string | null
          description: string
          employee_id: string
          end_time: string | null
          id: string
          project_id: string
          rejection_reason: string | null
          signature_data: string | null
          signature_name: string | null
          signed_at: string | null
          start_time: string | null
          status: string
          submitted_at: string | null
          updated_at: string
          work_date: string
        }
        Insert: {
          additional_employee_ids?: string[] | null
          approved_at?: string | null
          approved_by?: string | null
          break_minutes?: number
          company_id: string
          created_at?: string
          customer_id?: string | null
          delivery_note_number?: string | null
          description?: string
          employee_id: string
          end_time?: string | null
          id?: string
          project_id: string
          rejection_reason?: string | null
          signature_data?: string | null
          signature_name?: string | null
          signed_at?: string | null
          start_time?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
          work_date: string
        }
        Update: {
          additional_employee_ids?: string[] | null
          approved_at?: string | null
          approved_by?: string | null
          break_minutes?: number
          company_id?: string
          created_at?: string
          customer_id?: string | null
          delivery_note_number?: string | null
          description?: string
          employee_id?: string
          end_time?: string | null
          id?: string
          project_id?: string
          rejection_reason?: string | null
          signature_data?: string | null
          signature_name?: string | null
          signed_at?: string | null
          start_time?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
          work_date?: string
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
            foreignKeyName: "delivery_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_notes_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_notes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "employee_assigned_projects"
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
            referencedRelation: "employee_assigned_projects"
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
      employee_material_usage: {
        Row: {
          created_at: string | null
          created_by: string | null
          employee_id: string | null
          id: string
          material_id: string | null
          notes: string | null
          project_id: string | null
          quantity_used: number
          usage_date: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          employee_id?: string | null
          id?: string
          material_id?: string | null
          notes?: string | null
          project_id?: string | null
          quantity_used: number
          usage_date?: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          employee_id?: string | null
          id?: string
          material_id?: string | null
          notes?: string | null
          project_id?: string | null
          quantity_used?: number
          usage_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_material_usage_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_material_usage_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_material_usage_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "employee_assigned_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_material_usage_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          company_id: string | null
          contact_info: string | null
          created_at: string
          department: string | null
          email: string
          employee_number: string | null
          first_name: string
          hire_date: string | null
          hourly_rate: number | null
          hourly_wage: number | null
          id: string
          last_name: string
          license: string | null
          phone: string | null
          position: string | null
          qualifications: string | null
          role_description: string | null
          status: string
          updated_at: string
          user_id: string | null
          vacation_days_total: number | null
          vacation_days_used: number | null
        }
        Insert: {
          company_id?: string | null
          contact_info?: string | null
          created_at?: string
          department?: string | null
          email: string
          employee_number?: string | null
          first_name: string
          hire_date?: string | null
          hourly_rate?: number | null
          hourly_wage?: number | null
          id?: string
          last_name: string
          license?: string | null
          phone?: string | null
          position?: string | null
          qualifications?: string | null
          role_description?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
          vacation_days_total?: number | null
          vacation_days_used?: number | null
        }
        Update: {
          company_id?: string | null
          contact_info?: string | null
          created_at?: string
          department?: string | null
          email?: string
          employee_number?: string | null
          first_name?: string
          hire_date?: string | null
          hourly_rate?: number | null
          hourly_wage?: number | null
          id?: string
          last_name?: string
          license?: string | null
          phone?: string | null
          position?: string | null
          qualifications?: string | null
          role_description?: string | null
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
            referencedRelation: "employee_assigned_projects"
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
      immutable_files: {
        Row: {
          company_id: string | null
          created_at: string
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
          created_at?: string
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
          created_at?: string
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
      invoices: {
        Row: {
          company_id: string | null
          created_at: string
          currency: string | null
          customer_id: string
          description: string | null
          due_date: string
          gross_amount: number
          id: string
          invoice_date: string
          invoice_number: string
          net_amount: number
          notes: string | null
          offer_id: string | null
          payment_terms: string | null
          project_id: string
          signature_url: string | null
          snapshot_customer_address: string | null
          snapshot_customer_name: string | null
          snapshot_tax_number: string | null
          status: string
          tax_amount: number
          tax_rate: number
          title: string
          updated_at: string
          workflow_origin_id: string | null
          workflow_origin_type: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          currency?: string | null
          customer_id: string
          description?: string | null
          due_date: string
          gross_amount?: number
          id?: string
          invoice_date?: string
          invoice_number: string
          net_amount?: number
          notes?: string | null
          offer_id?: string | null
          payment_terms?: string | null
          project_id: string
          signature_url?: string | null
          snapshot_customer_address?: string | null
          snapshot_customer_name?: string | null
          snapshot_tax_number?: string | null
          status?: string
          tax_amount?: number
          tax_rate?: number
          title: string
          updated_at?: string
          workflow_origin_id?: string | null
          workflow_origin_type?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          currency?: string | null
          customer_id?: string
          description?: string | null
          due_date?: string
          gross_amount?: number
          id?: string
          invoice_date?: string
          invoice_number?: string
          net_amount?: number
          notes?: string | null
          offer_id?: string | null
          payment_terms?: string | null
          project_id?: string
          signature_url?: string | null
          snapshot_customer_address?: string | null
          snapshot_customer_name?: string | null
          snapshot_tax_number?: string | null
          status?: string
          tax_amount?: number
          tax_rate?: number
          title?: string
          updated_at?: string
          workflow_origin_id?: string | null
          workflow_origin_type?: string | null
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
            foreignKeyName: "invoices_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "employee_assigned_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_bids: {
        Row: {
          company_id: string | null
          craftsman_id: string
          created_at: string | null
          id: string
          job_id: string
          message: string
          price_estimate: number | null
          status: string
          updated_at: string | null
        }
        Insert: {
          company_id?: string | null
          craftsman_id: string
          created_at?: string | null
          id?: string
          job_id: string
          message: string
          price_estimate?: number | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          company_id?: string | null
          craftsman_id?: string
          created_at?: string | null
          id?: string
          job_id?: string
          message?: string
          price_estimate?: number | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_bids_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_bids_craftsman_id_fkey"
            columns: ["craftsman_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_bids_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "marketplace_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_jobs: {
        Row: {
          budget_range: string | null
          category: string
          created_at: string | null
          customer_id: string | null
          description: string
          id: string
          images: Json | null
          location: string
          status: string
          title: string
          updated_at: string | null
        }
        Insert: {
          budget_range?: string | null
          category: string
          created_at?: string | null
          customer_id?: string | null
          description: string
          id?: string
          images?: Json | null
          location: string
          status?: string
          title: string
          updated_at?: string | null
        }
        Update: {
          budget_range?: string | null
          category?: string
          created_at?: string | null
          customer_id?: string | null
          description?: string
          id?: string
          images?: Json | null
          location?: string
          status?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_jobs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      material_order_items: {
        Row: {
          created_at: string | null
          id: string
          material_id: string | null
          notes: string | null
          order_id: string | null
          quantity_delivered: number | null
          quantity_ordered: number
          total_price: number | null
          unit_price: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          material_id?: string | null
          notes?: string | null
          order_id?: string | null
          quantity_delivered?: number | null
          quantity_ordered: number
          total_price?: number | null
          unit_price: number
        }
        Update: {
          created_at?: string | null
          id?: string
          material_id?: string | null
          notes?: string | null
          order_id?: string | null
          quantity_delivered?: number | null
          quantity_ordered?: number
          total_price?: number | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "material_order_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "material_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      material_orders: {
        Row: {
          actual_delivery_date: string | null
          company_id: string | null
          created_at: string | null
          created_by: string | null
          expected_delivery_date: string | null
          id: string
          notes: string | null
          order_date: string
          order_number: string
          status: string | null
          supplier_id: string | null
          total_amount: number | null
          updated_at: string | null
        }
        Insert: {
          actual_delivery_date?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          expected_delivery_date?: string | null
          id?: string
          notes?: string | null
          order_date: string
          order_number: string
          status?: string | null
          supplier_id?: string | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Update: {
          actual_delivery_date?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          expected_delivery_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          order_number?: string
          status?: string | null
          supplier_id?: string | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "material_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      material_stock_movements: {
        Row: {
          created_at: string | null
          created_by: string | null
          employee_id: string | null
          id: string
          material_id: string | null
          movement_type: string
          project_id: string | null
          quantity: number
          reason: string | null
          reference_id: string | null
          reference_type: string | null
          unit_price: number | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          employee_id?: string | null
          id?: string
          material_id?: string | null
          movement_type: string
          project_id?: string | null
          quantity: number
          reason?: string | null
          reference_id?: string | null
          reference_type?: string | null
          unit_price?: number | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          employee_id?: string | null
          id?: string
          material_id?: string | null
          movement_type?: string
          project_id?: string | null
          quantity?: number
          reason?: string | null
          reference_id?: string | null
          reference_type?: string | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "material_stock_movements_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_stock_movements_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_stock_movements_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "employee_assigned_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_stock_movements_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      materials: {
        Row: {
          barcode: string | null
          category: string | null
          company_id: string | null
          created_at: string | null
          created_by: string | null
          current_stock: number | null
          description: string | null
          id: string
          is_active: boolean | null
          max_stock: number | null
          min_stock: number | null
          name: string
          reorder_min: number | null
          sku: string | null
          storage_location: string | null
          supplier: string | null
          supplier_article_number: string | null
          supplier_id: string | null
          unit: string
          unit_price: number | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          barcode?: string | null
          category?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          current_stock?: number | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          max_stock?: number | null
          min_stock?: number | null
          name: string
          reorder_min?: number | null
          sku?: string | null
          storage_location?: string | null
          supplier?: string | null
          supplier_article_number?: string | null
          supplier_id?: string | null
          unit: string
          unit_price?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          barcode?: string | null
          category?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          current_stock?: number | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          max_stock?: number | null
          min_stock?: number | null
          name?: string
          reorder_min?: number | null
          sku?: string | null
          storage_location?: string | null
          supplier?: string | null
          supplier_article_number?: string | null
          supplier_id?: string | null
          unit?: string
          unit_price?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "materials_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "materials_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      number_sequences: {
        Row: {
          company_id: string | null
          created_at: string
          current_value: number
          format_pattern: string | null
          id: string
          last_reset_year: number | null
          prefix: string | null
          sequence_name: string
          updated_at: string
          year_reset: boolean | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          current_value?: number
          format_pattern?: string | null
          id?: string
          last_reset_year?: number | null
          prefix?: string | null
          sequence_name: string
          updated_at?: string
          year_reset?: boolean | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          current_value?: number
          format_pattern?: string | null
          id?: string
          last_reset_year?: number | null
          prefix?: string | null
          sequence_name?: string
          updated_at?: string
          year_reset?: boolean | null
        }
        Relationships: []
      }
      ocr_results: {
        Row: {
          confidence_scores: Json
          created_at: string | null
          created_by: string
          extracted_text: string
          id: string
          original_file_path: string
          status: string
          structured_data: Json
          updated_at: string | null
          validated_at: string | null
          validated_by: string | null
          validation_notes: string | null
        }
        Insert: {
          confidence_scores: Json
          created_at?: string | null
          created_by: string
          extracted_text: string
          id?: string
          original_file_path: string
          status?: string
          structured_data: Json
          updated_at?: string | null
          validated_at?: string | null
          validated_by?: string | null
          validation_notes?: string | null
        }
        Update: {
          confidence_scores?: Json
          created_at?: string | null
          created_by?: string
          extracted_text?: string
          id?: string
          original_file_path?: string
          status?: string
          structured_data?: Json
          updated_at?: string | null
          validated_at?: string | null
          validated_by?: string | null
          validation_notes?: string | null
        }
        Relationships: []
      }
      offer_items: {
        Row: {
          created_at: string | null
          description: string
          id: string
          internal_notes: string | null
          is_optional: boolean | null
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
          created_at?: string | null
          description: string
          id?: string
          internal_notes?: string | null
          is_optional?: boolean | null
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
          created_at?: string | null
          description?: string
          id?: string
          internal_notes?: string | null
          is_optional?: boolean | null
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
        ]
      }
      offer_targets: {
        Row: {
          billable_hourly_rate: number | null
          complexity: string | null
          created_at: string | null
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
          updated_at: string | null
        }
        Insert: {
          billable_hourly_rate?: number | null
          complexity?: string | null
          created_at?: string | null
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
          updated_at?: string | null
        }
        Update: {
          billable_hourly_rate?: number | null
          complexity?: string | null
          created_at?: string | null
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
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "offer_targets_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
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
          created_at: string | null
          created_by: string | null
          customer_id: string
          customer_reference: string | null
          execution_notes: string | null
          execution_period_text: string | null
          final_text: string | null
          id: string
          intro_text: string | null
          is_locked: boolean | null
          is_reverse_charge: boolean | null
          notes: string | null
          offer_date: string
          offer_number: string
          payment_terms: string | null
          project_id: string | null
          project_location: string | null
          project_name: string
          show_labor_share: boolean | null
          skonto_days: number | null
          skonto_percent: number | null
          snapshot_contact_name: string | null
          snapshot_created_at: string | null
          snapshot_customer_address: string | null
          snapshot_customer_name: string
          snapshot_discount_amount: number | null
          snapshot_discount_percent: number | null
          snapshot_gross_total: number | null
          snapshot_net_total: number | null
          snapshot_subtotal_net: number | null
          snapshot_vat_amount: number | null
          snapshot_vat_rate: number | null
          status: string
          terms_text: string | null
          updated_at: string | null
          valid_until: string | null
          version: number | null
          warranty_text: string | null
        }
        Insert: {
          acceptance_note?: string | null
          accepted_at?: string | null
          accepted_by?: string | null
          company_id: string
          created_at?: string | null
          created_by?: string | null
          customer_id: string
          customer_reference?: string | null
          execution_notes?: string | null
          execution_period_text?: string | null
          final_text?: string | null
          id?: string
          intro_text?: string | null
          is_locked?: boolean | null
          is_reverse_charge?: boolean | null
          notes?: string | null
          offer_date?: string
          offer_number: string
          payment_terms?: string | null
          project_id?: string | null
          project_location?: string | null
          project_name: string
          show_labor_share?: boolean | null
          skonto_days?: number | null
          skonto_percent?: number | null
          snapshot_contact_name?: string | null
          snapshot_created_at?: string | null
          snapshot_customer_address?: string | null
          snapshot_customer_name: string
          snapshot_discount_amount?: number | null
          snapshot_discount_percent?: number | null
          snapshot_gross_total?: number | null
          snapshot_net_total?: number | null
          snapshot_subtotal_net?: number | null
          snapshot_vat_amount?: number | null
          snapshot_vat_rate?: number | null
          status?: string
          terms_text?: string | null
          updated_at?: string | null
          valid_until?: string | null
          version?: number | null
          warranty_text?: string | null
        }
        Update: {
          acceptance_note?: string | null
          accepted_at?: string | null
          accepted_by?: string | null
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          customer_id?: string
          customer_reference?: string | null
          execution_notes?: string | null
          execution_period_text?: string | null
          final_text?: string | null
          id?: string
          intro_text?: string | null
          is_locked?: boolean | null
          is_reverse_charge?: boolean | null
          notes?: string | null
          offer_date?: string
          offer_number?: string
          payment_terms?: string | null
          project_id?: string | null
          project_location?: string | null
          project_name?: string
          show_labor_share?: boolean | null
          skonto_days?: number | null
          skonto_percent?: number | null
          snapshot_contact_name?: string | null
          snapshot_created_at?: string | null
          snapshot_customer_address?: string | null
          snapshot_customer_name?: string
          snapshot_discount_amount?: number | null
          snapshot_discount_percent?: number | null
          snapshot_gross_total?: number | null
          snapshot_net_total?: number | null
          snapshot_subtotal_net?: number | null
          snapshot_vat_amount?: number | null
          snapshot_vat_rate?: number | null
          status?: string
          terms_text?: string | null
          updated_at?: string | null
          valid_until?: string | null
          version?: number | null
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
            foreignKeyName: "offers_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "employee_assigned_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          company_id: string | null
          completed_at: string | null
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
          project_id: string
          status: string
          title: string
          total_amount: number | null
          updated_at: string
          workflow_origin_id: string | null
          workflow_origin_type: string | null
          workflow_target_id: string | null
          workflow_target_type: string | null
        }
        Insert: {
          company_id?: string | null
          completed_at?: string | null
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
          project_id: string
          status?: string
          title: string
          total_amount?: number | null
          updated_at?: string
          workflow_origin_id?: string | null
          workflow_origin_type?: string | null
          workflow_target_id?: string | null
          workflow_target_type?: string | null
        }
        Update: {
          company_id?: string | null
          completed_at?: string | null
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
          project_id?: string
          status?: string
          title?: string
          total_amount?: number | null
          updated_at?: string
          workflow_origin_id?: string | null
          workflow_origin_type?: string | null
          workflow_target_id?: string | null
          workflow_target_type?: string | null
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
            foreignKeyName: "orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "employee_assigned_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
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
            referencedRelation: "employee_assigned_projects"
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
      project_comments: {
        Row: {
          comment: string
          created_at: string
          created_by: string | null
          id: string
          project_id: string | null
          updated_at: string
        }
        Insert: {
          comment: string
          created_at?: string
          created_by?: string | null
          id?: string
          project_id?: string | null
          updated_at?: string
        }
        Update: {
          comment?: string
          created_at?: string
          created_by?: string | null
          id?: string
          project_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_comments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "employee_assigned_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_comments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_documents: {
        Row: {
          created_at: string
          document_type: string | null
          file_path: string | null
          file_size: number | null
          file_url: string | null
          id: string
          is_favorite: boolean | null
          metadata: Json | null
          mime_type: string | null
          name: string
          project_id: string | null
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          document_type?: string | null
          file_path?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          is_favorite?: boolean | null
          metadata?: Json | null
          mime_type?: string | null
          name: string
          project_id?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          document_type?: string | null
          file_path?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          is_favorite?: boolean | null
          metadata?: Json | null
          mime_type?: string | null
          name?: string
          project_id?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "employee_assigned_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      project_material_assignments: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          assigned_quantity: number
          id: string
          material_id: string | null
          notes: string | null
          project_id: string | null
          used_quantity: number | null
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          assigned_quantity: number
          id?: string
          material_id?: string | null
          notes?: string | null
          project_id?: string | null
          used_quantity?: number | null
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          assigned_quantity?: number
          id?: string
          material_id?: string | null
          notes?: string | null
          project_id?: string | null
          used_quantity?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "project_material_assignments_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_material_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "employee_assigned_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_material_assignments_project_id_fkey"
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
      project_materials: {
        Row: {
          created_at: string
          delivery_date: string | null
          id: string
          material_id: string | null
          name: string
          notes: string | null
          order_date: string | null
          project_id: string | null
          quantity: number | null
          status: string | null
          supplier: string | null
          total_price: number | null
          unit: string | null
          unit_price: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          delivery_date?: string | null
          id?: string
          material_id?: string | null
          name: string
          notes?: string | null
          order_date?: string | null
          project_id?: string | null
          quantity?: number | null
          status?: string | null
          supplier?: string | null
          total_price?: number | null
          unit?: string | null
          unit_price?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          delivery_date?: string | null
          id?: string
          material_id?: string | null
          name?: string
          notes?: string | null
          order_date?: string | null
          project_id?: string | null
          quantity?: number | null
          status?: string | null
          supplier?: string | null
          total_price?: number | null
          unit?: string | null
          unit_price?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_materials_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_materials_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "employee_assigned_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_materials_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_milestones: {
        Row: {
          assigned_to: string | null
          completed_date: string | null
          created_at: string
          description: string | null
          due_date: string
          id: string
          is_completed: boolean | null
          priority: string | null
          project_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          completed_date?: string | null
          created_at?: string
          description?: string | null
          due_date: string
          id?: string
          is_completed?: boolean | null
          priority?: string | null
          project_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          completed_date?: string | null
          created_at?: string
          description?: string | null
          due_date?: string
          id?: string
          is_completed?: boolean | null
          priority?: string | null
          project_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_milestones_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_milestones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "employee_assigned_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_milestones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_sites: {
        Row: {
          address: string
          city: string
          company_id: string | null
          country: string | null
          created_at: string
          customer_id: string
          id: string
          name: string | null
          notes: string | null
          postal_code: string | null
          updated_at: string
        }
        Insert: {
          address: string
          city: string
          company_id?: string | null
          country?: string | null
          created_at?: string
          customer_id: string
          id?: string
          name?: string | null
          notes?: string | null
          postal_code?: string | null
          updated_at?: string
        }
        Update: {
          address?: string
          city?: string
          company_id?: string | null
          country?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          name?: string | null
          notes?: string | null
          postal_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_sites_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_sites_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      project_team_assignments: {
        Row: {
          created_at: string
          employee_id: string | null
          end_date: string | null
          hourly_rate: number | null
          hours_actual: number | null
          hours_budgeted: number | null
          id: string
          is_active: boolean | null
          project_id: string | null
          responsibilities: string[] | null
          role: string | null
          start_date: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          employee_id?: string | null
          end_date?: string | null
          hourly_rate?: number | null
          hours_actual?: number | null
          hours_budgeted?: number | null
          id?: string
          is_active?: boolean | null
          project_id?: string | null
          responsibilities?: string[] | null
          role?: string | null
          start_date?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          employee_id?: string | null
          end_date?: string | null
          hourly_rate?: number | null
          hours_actual?: number | null
          hours_budgeted?: number | null
          id?: string
          is_active?: boolean | null
          project_id?: string | null
          responsibilities?: string[] | null
          role?: string | null
          start_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_team_assignments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_team_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "employee_assigned_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_team_assignments_project_id_fkey"
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
          besichtigung_calendar_event_id: string | null
          besichtigung_date: string | null
          besichtigung_employee_id: string | null
          besichtigung_time_end: string | null
          besichtigung_time_start: string | null
          budget: number | null
          color: string | null
          company_id: string | null
          completed_at: string | null
          created_at: string
          customer_id: string | null
          description: string | null
          end_date: string | null
          id: string
          labor_costs: number | null
          location: string | null
          material_costs: number | null
          milestone_date: string | null
          name: string
          next_milestone: string | null
          profile_id: string | null
          progress_percentage: number | null
          project_site_id: string | null
          project_type: string
          start_date: string | null
          status: string
          status_color: string | null
          updated_at: string
          work_calendar_event_id: string | null
          work_end_date: string | null
          work_start_date: string | null
          workflow_origin_id: string | null
          workflow_origin_type: string | null
          workflow_target_id: string | null
          workflow_target_type: string | null
        }
        Insert: {
          besichtigung_calendar_event_id?: string | null
          besichtigung_date?: string | null
          besichtigung_employee_id?: string | null
          besichtigung_time_end?: string | null
          besichtigung_time_start?: string | null
          budget?: number | null
          color?: string | null
          company_id?: string | null
          completed_at?: string | null
          created_at?: string
          customer_id?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          labor_costs?: number | null
          location?: string | null
          material_costs?: number | null
          milestone_date?: string | null
          name: string
          next_milestone?: string | null
          profile_id?: string | null
          progress_percentage?: number | null
          project_site_id?: string | null
          project_type?: string
          start_date?: string | null
          status?: string
          status_color?: string | null
          updated_at?: string
          work_calendar_event_id?: string | null
          work_end_date?: string | null
          work_start_date?: string | null
          workflow_origin_id?: string | null
          workflow_origin_type?: string | null
          workflow_target_id?: string | null
          workflow_target_type?: string | null
        }
        Update: {
          besichtigung_calendar_event_id?: string | null
          besichtigung_date?: string | null
          besichtigung_employee_id?: string | null
          besichtigung_time_end?: string | null
          besichtigung_time_start?: string | null
          budget?: number | null
          color?: string | null
          company_id?: string | null
          completed_at?: string | null
          created_at?: string
          customer_id?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          labor_costs?: number | null
          location?: string | null
          material_costs?: number | null
          milestone_date?: string | null
          name?: string
          next_milestone?: string | null
          profile_id?: string | null
          progress_percentage?: number | null
          project_site_id?: string | null
          project_type?: string
          start_date?: string | null
          status?: string
          status_color?: string | null
          updated_at?: string
          work_calendar_event_id?: string | null
          work_end_date?: string | null
          work_start_date?: string | null
          workflow_origin_id?: string | null
          workflow_origin_type?: string | null
          workflow_target_id?: string | null
          workflow_target_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_besichtigung_calendar_event_id_fkey"
            columns: ["besichtigung_calendar_event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_besichtigung_employee_id_fkey"
            columns: ["besichtigung_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
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
            foreignKeyName: "projects_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_project_site_id_fkey"
            columns: ["project_site_id"]
            isOneToOne: false
            referencedRelation: "project_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_work_calendar_event_id_fkey"
            columns: ["work_calendar_event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          body: Json | null
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
          total_gross: number | null
          total_net: number | null
          updated_at: string
          valid_until: string | null
          workflow_target_id: string | null
          workflow_target_type: string | null
        }
        Insert: {
          body?: Json | null
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
          total_gross?: number | null
          total_net?: number | null
          updated_at?: string
          valid_until?: string | null
          workflow_target_id?: string | null
          workflow_target_type?: string | null
        }
        Update: {
          body?: Json | null
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
          total_gross?: number | null
          total_net?: number | null
          updated_at?: string
          valid_until?: string | null
          workflow_target_id?: string | null
          workflow_target_type?: string | null
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
      site_legal_data: {
        Row: {
          address: string | null
          company_name: string | null
          contact_email: string | null
          contact_phone: string | null
          owner: string | null
          site_id: string
          updated_at: string
          vat_id: string | null
        }
        Insert: {
          address?: string | null
          company_name?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          owner?: string | null
          site_id: string
          updated_at?: string
          vat_id?: string | null
        }
        Update: {
          address?: string | null
          company_name?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          owner?: string | null
          site_id?: string
          updated_at?: string
          vat_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "site_legal_data_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: true
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
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
          },
        ]
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
            referencedRelation: "employee_assigned_projects"
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
      supplier_invoices: {
        Row: {
          created_at: string | null
          created_by: string
          description: string | null
          due_date: string | null
          iban: string | null
          id: string
          invoice_date: string
          invoice_number: string
          ocr_result_id: string | null
          status: string
          supplier_name: string
          total_amount: number
          updated_at: string | null
          vat_amount: number | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          description?: string | null
          due_date?: string | null
          iban?: string | null
          id?: string
          invoice_date: string
          invoice_number: string
          ocr_result_id?: string | null
          status?: string
          supplier_name: string
          total_amount: number
          updated_at?: string | null
          vat_amount?: number | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          description?: string | null
          due_date?: string | null
          iban?: string | null
          id?: string
          invoice_date?: string
          invoice_number?: string
          ocr_result_id?: string | null
          status?: string
          supplier_name?: string
          total_amount?: number
          updated_at?: string | null
          vat_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_invoices_ocr_result_id_fkey"
            columns: ["ocr_result_id"]
            isOneToOne: false
            referencedRelation: "ocr_results"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          company_id: string | null
          contact_person: string | null
          created_at: string | null
          created_by: string | null
          email: string | null
          id: string
          is_active: boolean | null
          name: string
          payment_terms: number | null
          phone: string | null
          tax_number: string | null
        }
        Insert: {
          address?: string | null
          company_id?: string | null
          contact_person?: string | null
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          payment_terms?: number | null
          phone?: string | null
          tax_number?: string | null
        }
        Update: {
          address?: string | null
          company_id?: string | null
          contact_person?: string | null
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          payment_terms?: number | null
          phone?: string | null
          tax_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_auth_codes: {
        Row: {
          code: string
          company_id: string
          created_at: string
          expires_at: string
          user_id: string
        }
        Insert: {
          code: string
          company_id: string
          created_at?: string
          expires_at: string
          user_id: string
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string
          expires_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "telegram_auth_codes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_users: {
        Row: {
          company_id: string
          created_at: string
          id: string
          telegram_chat_id: number
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          telegram_chat_id: number
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          telegram_chat_id?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "telegram_users_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
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
            referencedRelation: "employee_assigned_projects"
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
            referencedRelation: "employee_assigned_projects"
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
          absence_type: string
          approved_at: string | null
          approved_by: string | null
          company_id: string
          created_at: string | null
          days_requested: number
          employee_id: string
          end_date: string
          id: string
          reason: string | null
          rejection_reason: string | null
          start_date: string
          status: string
          updated_at: string | null
        }
        Insert: {
          absence_type?: string
          approved_at?: string | null
          approved_by?: string | null
          company_id: string
          created_at?: string | null
          days_requested: number
          employee_id: string
          end_date: string
          id?: string
          reason?: string | null
          rejection_reason?: string | null
          start_date: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          absence_type?: string
          approved_at?: string | null
          approved_by?: string | null
          company_id?: string
          created_at?: string | null
          days_requested?: number
          employee_id?: string
          end_date?: string
          id?: string
          reason?: string | null
          rejection_reason?: string | null
          start_date?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vacation_requests_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vacation_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
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
      web_leads: {
        Row: {
          created_at: string
          email: string | null
          id: string
          message: string | null
          name: string
          phone: string | null
          site_id: string
          status: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          message?: string | null
          name: string
          phone?: string | null
          site_id: string
          status?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          message?: string | null
          name?: string
          phone?: string | null
          site_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "web_leads_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_chains: {
        Row: {
          created_at: string | null
          current_step: string
          customer_id: string
          id: string
          invoice_id: string | null
          metadata: Json | null
          offer_id: string | null
          order_id: string | null
          project_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          current_step: string
          customer_id: string
          id?: string
          invoice_id?: string | null
          metadata?: Json | null
          offer_id?: string | null
          order_id?: string | null
          project_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          current_step?: string
          customer_id?: string
          id?: string
          invoice_id?: string | null
          metadata?: Json | null
          offer_id?: string | null
          order_id?: string | null
          project_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workflow_chains_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_chains_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_chains_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_chains_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_chains_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "employee_assigned_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_chains_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
      employee_assigned_projects: {
        Row: {
          assignment_active: boolean | null
          budget: number | null
          color: string | null
          company_id: string | null
          created_at: string | null
          customer_id: string | null
          description: string | null
          employee_hourly_rate: number | null
          employee_role: string | null
          end_date: string | null
          id: string | null
          labor_costs: number | null
          material_costs: number | null
          milestone_date: string | null
          name: string | null
          next_milestone: string | null
          profile_id: string | null
          progress_percentage: number | null
          project_site_id: string | null
          start_date: string | null
          status: string | null
          status_color: string | null
          updated_at: string | null
          workflow_origin_id: string | null
          workflow_origin_type: string | null
          workflow_target_id: string | null
          workflow_target_type: string | null
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
            foreignKeyName: "projects_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_project_site_id_fkey"
            columns: ["project_site_id"]
            isOneToOne: false
            referencedRelation: "project_sites"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_invitation_by_token: {
        Args: { p_token: string }
        Returns: boolean
      }
      calculate_project_labor_costs: {
        Args: { project_id_param: string }
        Returns: number
      }
      calculate_project_material_costs: {
        Args: { project_id_param: string }
        Returns: number
      }
      cleanup_expired_invitations: { Args: never; Returns: undefined }
      create_ai_suggestion: {
        Args: {
          p_confidence_score?: number
          p_input_data: Json
          p_model_version?: string
          p_output_data: Json
          p_project_id: string
          p_suggestion_type: string
          p_trace_id?: string
        }
        Returns: string
      }
      create_audit_entry: {
        Args: {
          p_action: string
          p_changed_fields?: string[]
          p_entity_id: string
          p_entity_type: string
          p_new_values?: Json
          p_old_values?: Json
          p_reason?: string
        }
        Returns: string
      }
      create_offer_with_targets: {
        Args: { items_data: Json; offer_data: Json; targets_data: Json }
        Returns: Json
      }
      generate_invoice_number: { Args: never; Returns: string }
      generate_order_number: { Args: never; Returns: string }
      generate_quote_number: { Args: never; Returns: string }
      get_invitation_by_token: {
        Args: { p_token: string }
        Returns: {
          company_id: string
          created_at: string
          email: string
          employee_data: Json
          expires_at: string
          id: string
          invite_token: string
          invited_by: string
          status: string
          updated_at: string
        }[]
      }
      get_next_number: {
        Args: { comp_id?: string; seq_name: string }
        Returns: string
      }
      has_role:
        | {
            Args: {
              _role: Database["public"]["Enums"]["user_role"]
              _user_id: string
            }
            Returns: boolean
          }
        | { Args: { role: string }; Returns: boolean }
      sanitize_text_input: { Args: { input_text: string }; Returns: string }
      search_ai_index: {
        Args: {
          company_id_filter?: string
          limit_results?: number
          query_embedding: string
          ref_types?: string[]
        }
        Returns: {
          content_text: string
          id: string
          metadata: Json
          ref_id: string
          ref_type: string
          similarity: number
        }[]
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
      user_role: "manager" | "employee" | "customer" | "craftsman"
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
      user_role: ["manager", "employee", "customer", "craftsman"],
    },
  },
} as const
A new version of Supabase CLI is available: v2.78.1 (currently installed v2.76.6)
We recommend updating regularly for new features and bug fixes: https://supabase.com/docs/guides/cli/getting-started#updating-the-supabase-cli
