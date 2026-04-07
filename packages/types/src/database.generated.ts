export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      attachments: {
        Row: {
          caption: string | null
          category: Database["public"]["Enums"]["attachment_category"]
          company_id: string
          created_at: string
          file_name: string
          file_size_bytes: number
          id: string
          inspection_id: string | null
          inspection_item_id: string | null
          job_id: string
          mime_type: string
          storage_bucket: string
          storage_path: string
          updated_at: string
          uploaded_by_user_id: string
        }
        Insert: {
          caption?: string | null
          category?: Database["public"]["Enums"]["attachment_category"]
          company_id: string
          created_at?: string
          file_name: string
          file_size_bytes: number
          id?: string
          inspection_id?: string | null
          inspection_item_id?: string | null
          job_id: string
          mime_type: string
          storage_bucket: string
          storage_path: string
          updated_at?: string
          uploaded_by_user_id: string
        }
        Update: {
          caption?: string | null
          category?: Database["public"]["Enums"]["attachment_category"]
          company_id?: string
          created_at?: string
          file_name?: string
          file_size_bytes?: number
          id?: string
          inspection_id?: string | null
          inspection_item_id?: string | null
          job_id?: string
          mime_type?: string
          storage_bucket?: string
          storage_path?: string
          updated_at?: string
          uploaded_by_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attachments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "inspections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_inspection_item_id_fkey"
            columns: ["inspection_item_id"]
            isOneToOne: false
            referencedRelation: "inspection_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_delivery_attempts: {
        Row: {
          attempt_number: number
          attempted_at: string
          communication_id: string
          created_at: string
          error_message: string | null
          id: string
          provider: string
          request_payload: Json
          response_payload: Json
          succeeded: boolean
          updated_at: string
        }
        Insert: {
          attempt_number: number
          attempted_at?: string
          communication_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          provider: string
          request_payload?: Json
          response_payload?: Json
          succeeded: boolean
          updated_at?: string
        }
        Update: {
          attempt_number?: number
          attempted_at?: string
          communication_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          provider?: string
          request_payload?: Json
          response_payload?: Json
          succeeded?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_delivery_attempts_communication_id_fkey"
            columns: ["communication_id"]
            isOneToOne: false
            referencedRelation: "customer_communications"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_events: {
        Row: {
          actor_user_id: string | null
          communication_type: Database["public"]["Enums"]["communication_type"]
          company_id: string
          created_at: string
          customer_id: string
          estimate_id: string | null
          event_type: Database["public"]["Enums"]["communication_event_type"]
          failed_at: string | null
          failure_message: string | null
          id: string
          idempotency_key: string
          invoice_id: string | null
          job_id: string | null
          occurred_at: string
          payload: Json
          payment_id: string | null
          processed_at: string | null
          scheduled_for: string
          trigger_source: Database["public"]["Enums"]["communication_trigger_source"]
          updated_at: string
        }
        Insert: {
          actor_user_id?: string | null
          communication_type: Database["public"]["Enums"]["communication_type"]
          company_id: string
          created_at?: string
          customer_id: string
          estimate_id?: string | null
          event_type: Database["public"]["Enums"]["communication_event_type"]
          failed_at?: string | null
          failure_message?: string | null
          id?: string
          idempotency_key: string
          invoice_id?: string | null
          job_id?: string | null
          occurred_at?: string
          payload?: Json
          payment_id?: string | null
          processed_at?: string | null
          scheduled_for?: string
          trigger_source: Database["public"]["Enums"]["communication_trigger_source"]
          updated_at?: string
        }
        Update: {
          actor_user_id?: string | null
          communication_type?: Database["public"]["Enums"]["communication_type"]
          company_id?: string
          created_at?: string
          customer_id?: string
          estimate_id?: string | null
          event_type?: Database["public"]["Enums"]["communication_event_type"]
          failed_at?: string | null
          failure_message?: string | null
          id?: string
          idempotency_key?: string
          invoice_id?: string | null
          job_id?: string | null
          occurred_at?: string
          payload?: Json
          payment_id?: string | null
          processed_at?: string | null
          scheduled_for?: string
          trigger_source?: Database["public"]["Enums"]["communication_trigger_source"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_events_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_events_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_events_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_events_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_automation_settings: {
        Row: {
          company_id: string
          created_at: string
          dispatch_en_route_sms_enabled: boolean
          dispatch_running_late_sms_enabled: boolean
          invoice_payment_reminder_sms_enabled: boolean
          updated_at: string
          updated_by_user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          dispatch_en_route_sms_enabled?: boolean
          dispatch_running_late_sms_enabled?: boolean
          invoice_payment_reminder_sms_enabled?: boolean
          updated_at?: string
          updated_by_user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          dispatch_en_route_sms_enabled?: boolean
          dispatch_running_late_sms_enabled?: boolean
          invoice_payment_reminder_sms_enabled?: boolean
          updated_at?: string
          updated_by_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_automation_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_automation_settings_updated_by_user_id_fkey"
            columns: ["updated_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_onboarding_profiles: {
        Row: {
          business_address: string | null
          business_phone: string | null
          campaign_description: string | null
          company_id: string
          created_at: string
          doing_business_as: string | null
          help_reply_text: string | null
          legal_business_name: string | null
          opt_in_workflow: string | null
          preferred_sender_type: string | null
          privacy_policy_url: string | null
          sample_invoice_reminder_message: string | null
          sample_on_the_way_message: string | null
          sample_running_late_message: string | null
          stop_reply_text: string | null
          support_email: string | null
          terms_url: string | null
          updated_at: string
          updated_by_user_id: string
          website_url: string | null
        }
        Insert: {
          business_address?: string | null
          business_phone?: string | null
          campaign_description?: string | null
          company_id: string
          created_at?: string
          doing_business_as?: string | null
          help_reply_text?: string | null
          legal_business_name?: string | null
          opt_in_workflow?: string | null
          preferred_sender_type?: string | null
          privacy_policy_url?: string | null
          sample_invoice_reminder_message?: string | null
          sample_on_the_way_message?: string | null
          sample_running_late_message?: string | null
          stop_reply_text?: string | null
          support_email?: string | null
          terms_url?: string | null
          updated_at?: string
          updated_by_user_id: string
          website_url?: string | null
        }
        Update: {
          business_address?: string | null
          business_phone?: string | null
          campaign_description?: string | null
          company_id?: string
          created_at?: string
          doing_business_as?: string | null
          help_reply_text?: string | null
          legal_business_name?: string | null
          opt_in_workflow?: string | null
          preferred_sender_type?: string | null
          privacy_policy_url?: string | null
          sample_invoice_reminder_message?: string | null
          sample_on_the_way_message?: string | null
          sample_running_late_message?: string | null
          stop_reply_text?: string | null
          support_email?: string | null
          terms_url?: string | null
          updated_at?: string
          updated_by_user_id?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "communication_onboarding_profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_onboarding_profiles_updated_by_user_id_fkey"
            columns: ["updated_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_user_id: string
          slug: string
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_user_id: string
          slug: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_user_id?: string
          slug?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      company_memberships: {
        Row: {
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_memberships_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      core_inventory_events: {
        Row: {
          company_id: string
          created_at: string
          held_at: string
          held_by_user_id: string
          id: string
          inventory_item_id: string
          job_inventory_issue_id: string | null
          notes: string | null
          part_request_line_id: string | null
          purchase_order_line_id: string | null
          quantity: number
          returned_at: string | null
          status: Database["public"]["Enums"]["core_inventory_status"]
          stock_location_id: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          held_at?: string
          held_by_user_id: string
          id?: string
          inventory_item_id: string
          job_inventory_issue_id?: string | null
          notes?: string | null
          part_request_line_id?: string | null
          purchase_order_line_id?: string | null
          quantity: number
          returned_at?: string | null
          status?: Database["public"]["Enums"]["core_inventory_status"]
          stock_location_id: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          held_at?: string
          held_by_user_id?: string
          id?: string
          inventory_item_id?: string
          job_inventory_issue_id?: string | null
          notes?: string | null
          part_request_line_id?: string | null
          purchase_order_line_id?: string | null
          quantity?: number
          returned_at?: string | null
          status?: Database["public"]["Enums"]["core_inventory_status"]
          stock_location_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "core_inventory_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "core_inventory_events_held_by_user_id_fkey"
            columns: ["held_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "core_inventory_events_inventory_item_company_fkey"
            columns: ["inventory_item_id", "company_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "core_inventory_events_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "core_inventory_events_job_inventory_issue_company_fkey"
            columns: ["job_inventory_issue_id", "company_id"]
            isOneToOne: false
            referencedRelation: "job_inventory_issues"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "core_inventory_events_job_inventory_issue_id_fkey"
            columns: ["job_inventory_issue_id"]
            isOneToOne: false
            referencedRelation: "job_inventory_issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "core_inventory_events_part_request_line_company_fkey"
            columns: ["part_request_line_id", "company_id"]
            isOneToOne: false
            referencedRelation: "part_request_lines"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "core_inventory_events_part_request_line_id_fkey"
            columns: ["part_request_line_id"]
            isOneToOne: false
            referencedRelation: "part_request_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "core_inventory_events_purchase_order_line_company_fkey"
            columns: ["purchase_order_line_id", "company_id"]
            isOneToOne: false
            referencedRelation: "purchase_order_lines"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "core_inventory_events_purchase_order_line_id_fkey"
            columns: ["purchase_order_line_id"]
            isOneToOne: false
            referencedRelation: "purchase_order_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "core_inventory_events_stock_location_company_fkey"
            columns: ["stock_location_id", "company_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "core_inventory_events_stock_location_id_fkey"
            columns: ["stock_location_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_addresses: {
        Row: {
          access_window_notes: string | null
          city: string
          company_id: string
          country: string
          created_at: string
          customer_id: string
          gate_code: string | null
          id: string
          is_active: boolean
          is_primary: boolean
          label: string
          line1: string
          line2: string | null
          parking_notes: string | null
          postal_code: string
          service_contact_name: string | null
          service_contact_phone: string | null
          site_name: string | null
          state: string
          updated_at: string
        }
        Insert: {
          access_window_notes?: string | null
          city: string
          company_id: string
          country?: string
          created_at?: string
          customer_id: string
          gate_code?: string | null
          id?: string
          is_active?: boolean
          is_primary?: boolean
          label?: string
          line1: string
          line2?: string | null
          parking_notes?: string | null
          postal_code: string
          service_contact_name?: string | null
          service_contact_phone?: string | null
          site_name?: string | null
          state: string
          updated_at?: string
        }
        Update: {
          access_window_notes?: string | null
          city?: string
          company_id?: string
          country?: string
          created_at?: string
          customer_id?: string
          gate_code?: string | null
          id?: string
          is_active?: boolean
          is_primary?: boolean
          label?: string
          line1?: string
          line2?: string | null
          parking_notes?: string | null
          postal_code?: string
          service_contact_name?: string | null
          service_contact_phone?: string | null
          site_name?: string | null
          state?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_addresses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_addresses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_communication_preferences: {
        Row: {
          allow_appointment_confirmations: boolean
          allow_dispatch_updates: boolean
          allow_estimate_notifications: boolean
          allow_invoice_notifications: boolean
          allow_payment_reminders: boolean
          company_id: string
          created_at: string
          customer_id: string
          email_enabled: boolean
          id: string
          preferred_channel:
            | Database["public"]["Enums"]["communication_channel"]
            | null
          sms_enabled: boolean
          updated_at: string
        }
        Insert: {
          allow_appointment_confirmations?: boolean
          allow_dispatch_updates?: boolean
          allow_estimate_notifications?: boolean
          allow_invoice_notifications?: boolean
          allow_payment_reminders?: boolean
          company_id: string
          created_at?: string
          customer_id: string
          email_enabled?: boolean
          id?: string
          preferred_channel?:
            | Database["public"]["Enums"]["communication_channel"]
            | null
          sms_enabled?: boolean
          updated_at?: string
        }
        Update: {
          allow_appointment_confirmations?: boolean
          allow_dispatch_updates?: boolean
          allow_estimate_notifications?: boolean
          allow_invoice_notifications?: boolean
          allow_payment_reminders?: boolean
          company_id?: string
          created_at?: string
          customer_id?: string
          email_enabled?: boolean
          id?: string
          preferred_channel?:
            | Database["public"]["Enums"]["communication_channel"]
            | null
          sms_enabled?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_communication_preferences_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_communication_preferences_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_communications: {
        Row: {
          body_html: string | null
          body_text: string
          channel: Database["public"]["Enums"]["communication_channel"]
          communication_type: Database["public"]["Enums"]["communication_type"]
          company_id: string
          created_at: string
          created_by_user_id: string | null
          customer_id: string
          delivered_at: string | null
          error_code: string | null
          error_message: string | null
          estimate_id: string | null
          event_id: string | null
          failed_at: string | null
          id: string
          invoice_id: string | null
          job_id: string | null
          payment_id: string | null
          provider: string
          provider_message_id: string | null
          provider_metadata: Json
          queued_at: string
          recipient_email: string | null
          recipient_name: string
          recipient_phone: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["communication_status"]
          subject: string | null
          updated_at: string
        }
        Insert: {
          body_html?: string | null
          body_text: string
          channel: Database["public"]["Enums"]["communication_channel"]
          communication_type: Database["public"]["Enums"]["communication_type"]
          company_id: string
          created_at?: string
          created_by_user_id?: string | null
          customer_id: string
          delivered_at?: string | null
          error_code?: string | null
          error_message?: string | null
          estimate_id?: string | null
          event_id?: string | null
          failed_at?: string | null
          id?: string
          invoice_id?: string | null
          job_id?: string | null
          payment_id?: string | null
          provider: string
          provider_message_id?: string | null
          provider_metadata?: Json
          queued_at?: string
          recipient_email?: string | null
          recipient_name: string
          recipient_phone?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["communication_status"]
          subject?: string | null
          updated_at?: string
        }
        Update: {
          body_html?: string | null
          body_text?: string
          channel?: Database["public"]["Enums"]["communication_channel"]
          communication_type?: Database["public"]["Enums"]["communication_type"]
          company_id?: string
          created_at?: string
          created_by_user_id?: string | null
          customer_id?: string
          delivered_at?: string | null
          error_code?: string | null
          error_message?: string | null
          estimate_id?: string | null
          event_id?: string | null
          failed_at?: string | null
          id?: string
          invoice_id?: string | null
          job_id?: string | null
          payment_id?: string | null
          provider?: string
          provider_message_id?: string | null
          provider_metadata?: Json
          queued_at?: string
          recipient_email?: string | null
          recipient_name?: string
          recipient_phone?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["communication_status"]
          subject?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_communications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_communications_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_communications_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_communications_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "communication_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_communications_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_communications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_communications_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_document_link_events: {
        Row: {
          company_id: string
          created_at: string
          created_by_user_id: string | null
          customer_id: string
          document_kind: Database["public"]["Enums"]["customer_document_kind"]
          estimate_id: string | null
          event_type: Database["public"]["Enums"]["customer_document_event_type"]
          id: string
          invoice_id: string | null
          ip_address: unknown
          job_id: string
          link_id: string
          metadata: Json
          occurred_at: string
          user_agent: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by_user_id?: string | null
          customer_id: string
          document_kind: Database["public"]["Enums"]["customer_document_kind"]
          estimate_id?: string | null
          event_type: Database["public"]["Enums"]["customer_document_event_type"]
          id?: string
          invoice_id?: string | null
          ip_address?: unknown
          job_id: string
          link_id: string
          metadata?: Json
          occurred_at?: string
          user_agent?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by_user_id?: string | null
          customer_id?: string
          document_kind?: Database["public"]["Enums"]["customer_document_kind"]
          estimate_id?: string | null
          event_type?: Database["public"]["Enums"]["customer_document_event_type"]
          id?: string
          invoice_id?: string | null
          ip_address?: unknown
          job_id?: string
          link_id?: string
          metadata?: Json
          occurred_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_document_link_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_document_link_events_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_document_link_events_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_document_link_events_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_document_link_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_document_link_events_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "customer_document_links"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_document_links: {
        Row: {
          access_token_hash: string
          company_id: string
          completed_at: string | null
          created_at: string
          created_by_user_id: string
          customer_id: string
          document_kind: Database["public"]["Enums"]["customer_document_kind"]
          estimate_id: string | null
          expires_at: string
          first_viewed_at: string | null
          id: string
          invoice_id: string | null
          job_id: string
          last_sent_communication_id: string | null
          last_viewed_at: string | null
          revoked_at: string | null
          revoked_reason: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["customer_document_link_status"]
          updated_at: string
          view_count: number
        }
        Insert: {
          access_token_hash: string
          company_id: string
          completed_at?: string | null
          created_at?: string
          created_by_user_id: string
          customer_id: string
          document_kind: Database["public"]["Enums"]["customer_document_kind"]
          estimate_id?: string | null
          expires_at: string
          first_viewed_at?: string | null
          id?: string
          invoice_id?: string | null
          job_id: string
          last_sent_communication_id?: string | null
          last_viewed_at?: string | null
          revoked_at?: string | null
          revoked_reason?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["customer_document_link_status"]
          updated_at?: string
          view_count?: number
        }
        Update: {
          access_token_hash?: string
          company_id?: string
          completed_at?: string | null
          created_at?: string
          created_by_user_id?: string
          customer_id?: string
          document_kind?: Database["public"]["Enums"]["customer_document_kind"]
          estimate_id?: string | null
          expires_at?: string
          first_viewed_at?: string | null
          id?: string
          invoice_id?: string | null
          job_id?: string
          last_sent_communication_id?: string | null
          last_viewed_at?: string | null
          revoked_at?: string | null
          revoked_reason?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["customer_document_link_status"]
          updated_at?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "customer_document_links_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_document_links_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_document_links_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_document_links_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_document_links_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_document_links_last_sent_communication_id_fkey"
            columns: ["last_sent_communication_id"]
            isOneToOne: false
            referencedRelation: "customer_communications"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          company_id: string
          company_name: string | null
          created_at: string
          email: string | null
          first_name: string
          id: string
          is_active: boolean
          last_name: string
          notes: string | null
          phone: string | null
          relationship_type: Database["public"]["Enums"]["customer_relationship_type"]
          updated_at: string
        }
        Insert: {
          company_id: string
          company_name?: string | null
          created_at?: string
          email?: string | null
          first_name: string
          id?: string
          is_active?: boolean
          last_name: string
          notes?: string | null
          phone?: string | null
          relationship_type?: Database["public"]["Enums"]["customer_relationship_type"]
          updated_at?: string
        }
        Update: {
          company_id?: string
          company_name?: string | null
          created_at?: string
          email?: string | null
          first_name?: string
          id?: string
          is_active?: boolean
          last_name?: string
          notes?: string | null
          phone?: string | null
          relationship_type?: Database["public"]["Enums"]["customer_relationship_type"]
          updated_at?: string
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
      data_import_runs: {
        Row: {
          company_id: string
          created_at: string
          finished_at: string | null
          id: string
          last_error_message: string | null
          last_heartbeat_at: string | null
          options_json: Json
          provider: Database["public"]["Enums"]["migration_source_provider"]
          source_account_id: string
          started_at: string | null
          started_by_user_id: string
          status: Database["public"]["Enums"]["data_import_run_status"]
          summary_json: Json
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          finished_at?: string | null
          id?: string
          last_error_message?: string | null
          last_heartbeat_at?: string | null
          options_json?: Json
          provider: Database["public"]["Enums"]["migration_source_provider"]
          source_account_id: string
          started_at?: string | null
          started_by_user_id: string
          status?: Database["public"]["Enums"]["data_import_run_status"]
          summary_json?: Json
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          finished_at?: string | null
          id?: string
          last_error_message?: string | null
          last_heartbeat_at?: string | null
          options_json?: Json
          provider?: Database["public"]["Enums"]["migration_source_provider"]
          source_account_id?: string
          started_at?: string | null
          started_by_user_id?: string
          status?: Database["public"]["Enums"]["data_import_run_status"]
          summary_json?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_import_runs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_import_runs_source_account_id_fkey"
            columns: ["source_account_id"]
            isOneToOne: false
            referencedRelation: "migration_source_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_import_runs_started_by_user_id_fkey"
            columns: ["started_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      data_import_checkpoints: {
        Row: {
          company_id: string
          created_at: string
          cursor_json: Json
          entity_type: Database["public"]["Enums"]["data_import_entity_type"]
          failed_count: number
          id: string
          last_error_message: string | null
          processed_count: number
          run_id: string
          status: Database["public"]["Enums"]["data_import_checkpoint_status"]
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          cursor_json?: Json
          entity_type: Database["public"]["Enums"]["data_import_entity_type"]
          failed_count?: number
          id?: string
          last_error_message?: string | null
          processed_count?: number
          run_id: string
          status?: Database["public"]["Enums"]["data_import_checkpoint_status"]
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          cursor_json?: Json
          entity_type?: Database["public"]["Enums"]["data_import_entity_type"]
          failed_count?: number
          id?: string
          last_error_message?: string | null
          processed_count?: number
          run_id?: string
          status?: Database["public"]["Enums"]["data_import_checkpoint_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_import_checkpoints_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_import_checkpoints_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "data_import_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      dispatch_calendar_settings: {
        Row: {
          company_id: string
          created_at: string
          day_end_hour: number
          day_start_hour: number
          default_view: Database["public"]["Enums"]["dispatch_calendar_view"]
          show_saturday: boolean
          show_sunday: boolean
          slot_minutes: number
          updated_at: string
          updated_by_user_id: string
          week_starts_on: number
        }
        Insert: {
          company_id: string
          created_at?: string
          day_end_hour?: number
          day_start_hour?: number
          default_view?: Database["public"]["Enums"]["dispatch_calendar_view"]
          show_saturday?: boolean
          show_sunday?: boolean
          slot_minutes?: number
          updated_at?: string
          updated_by_user_id: string
          week_starts_on?: number
        }
        Update: {
          company_id?: string
          created_at?: string
          day_end_hour?: number
          day_start_hour?: number
          default_view?: Database["public"]["Enums"]["dispatch_calendar_view"]
          show_saturday?: boolean
          show_sunday?: boolean
          slot_minutes?: number
          updated_at?: string
          updated_by_user_id?: string
          week_starts_on?: number
        }
        Relationships: [
          {
            foreignKeyName: "dispatch_calendar_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatch_calendar_settings_updated_by_user_id_fkey"
            columns: ["updated_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dispatch_resource_preferences: {
        Row: {
          company_id: string
          created_at: string
          id: string
          is_visible_by_default: boolean
          lane_color: string | null
          lane_order: number
          technician_user_id: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          is_visible_by_default?: boolean
          lane_color?: string | null
          lane_order?: number
          technician_user_id: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          is_visible_by_default?: boolean
          lane_color?: string | null
          lane_order?: number
          technician_user_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispatch_resource_preferences_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatch_resource_preferences_technician_user_id_fkey"
            columns: ["technician_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dispatch_saved_view_members: {
        Row: {
          company_id: string
          created_at: string
          display_order: number
          id: string
          saved_view_id: string
          technician_user_id: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          display_order?: number
          id?: string
          saved_view_id: string
          technician_user_id: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          display_order?: number
          id?: string
          saved_view_id?: string
          technician_user_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispatch_saved_view_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatch_saved_view_members_saved_view_id_company_id_fkey"
            columns: ["saved_view_id", "company_id"]
            isOneToOne: false
            referencedRelation: "dispatch_saved_views"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "dispatch_saved_view_members_technician_user_id_fkey"
            columns: ["technician_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dispatch_saved_views: {
        Row: {
          company_id: string
          created_at: string
          created_by_user_id: string
          id: string
          include_unassigned: boolean
          is_default: boolean
          name: string
          scope: Database["public"]["Enums"]["dispatch_calendar_scope"]
          updated_at: string
          view: Database["public"]["Enums"]["dispatch_calendar_view"]
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by_user_id: string
          id?: string
          include_unassigned?: boolean
          is_default?: boolean
          name: string
          scope?: Database["public"]["Enums"]["dispatch_calendar_scope"]
          updated_at?: string
          view?: Database["public"]["Enums"]["dispatch_calendar_view"]
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by_user_id?: string
          id?: string
          include_unassigned?: boolean
          is_default?: boolean
          name?: string
          scope?: Database["public"]["Enums"]["dispatch_calendar_scope"]
          updated_at?: string
          view?: Database["public"]["Enums"]["dispatch_calendar_view"]
        }
        Relationships: [
          {
            foreignKeyName: "dispatch_saved_views_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatch_saved_views_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      estimate_line_items: {
        Row: {
          actual_cost_cents: number | null
          company_id: string
          created_at: string
          description: string | null
          estimate_id: string
          estimate_section_id: string | null
          estimated_cost_cents: number | null
          id: string
          item_type: string
          job_id: string
          line_subtotal_cents: number
          name: string
          part_request_line_id: string | null
          position: number
          quantity: number
          taxable: boolean
          unit_price_cents: number
          updated_at: string
        }
        Insert: {
          actual_cost_cents?: number | null
          company_id: string
          created_at?: string
          description?: string | null
          estimate_id: string
          estimate_section_id?: string | null
          estimated_cost_cents?: number | null
          id?: string
          item_type: string
          job_id: string
          line_subtotal_cents: number
          name: string
          part_request_line_id?: string | null
          position: number
          quantity: number
          taxable?: boolean
          unit_price_cents: number
          updated_at?: string
        }
        Update: {
          actual_cost_cents?: number | null
          company_id?: string
          created_at?: string
          description?: string | null
          estimate_id?: string
          estimate_section_id?: string | null
          estimated_cost_cents?: number | null
          id?: string
          item_type?: string
          job_id?: string
          line_subtotal_cents?: number
          name?: string
          part_request_line_id?: string | null
          position?: number
          quantity?: number
          taxable?: boolean
          unit_price_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "estimate_line_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_line_items_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_line_items_estimate_section_id_fkey"
            columns: ["estimate_section_id"]
            isOneToOne: false
            referencedRelation: "estimate_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_line_items_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_line_items_part_request_line_id_fkey"
            columns: ["part_request_line_id"]
            isOneToOne: false
            referencedRelation: "part_request_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      estimate_sections: {
        Row: {
          company_id: string
          created_at: string
          created_by_user_id: string
          description: string | null
          estimate_id: string
          id: string
          job_id: string
          notes: string | null
          position: number
          source: Database["public"]["Enums"]["estimate_section_source"]
          source_ref: string | null
          title: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by_user_id: string
          description?: string | null
          estimate_id: string
          id?: string
          job_id: string
          notes?: string | null
          position: number
          source?: Database["public"]["Enums"]["estimate_section_source"]
          source_ref?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by_user_id?: string
          description?: string | null
          estimate_id?: string
          id?: string
          job_id?: string
          notes?: string | null
          position?: number
          source?: Database["public"]["Enums"]["estimate_section_source"]
          source_ref?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "estimate_sections_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_sections_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_sections_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_sections_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      estimate_service_package_lines: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          id: string
          item_type: string
          manufacturer: string | null
          name: string
          part_number: string | null
          position: number
          quantity: number
          service_package_id: string
          supplier_sku: string | null
          taxable: boolean
          unit_price_cents: number
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          item_type: string
          manufacturer?: string | null
          name: string
          part_number?: string | null
          position: number
          quantity?: number
          service_package_id: string
          supplier_sku?: string | null
          taxable?: boolean
          unit_price_cents?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          item_type?: string
          manufacturer?: string | null
          name?: string
          part_number?: string | null
          position?: number
          quantity?: number
          service_package_id?: string
          supplier_sku?: string | null
          taxable?: boolean
          unit_price_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "estimate_service_package_lines_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_service_package_lines_service_package_id_fkey"
            columns: ["service_package_id"]
            isOneToOne: false
            referencedRelation: "estimate_service_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      estimate_service_packages: {
        Row: {
          company_id: string
          created_at: string
          created_by_user_id: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by_user_id: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by_user_id?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "estimate_service_packages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_service_packages_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      estimates: {
        Row: {
          accepted_at: string | null
          approval_statement: string | null
          approved_by_name: string | null
          approved_signature_id: string | null
          company_id: string
          created_at: string
          created_by_user_id: string
          currency_code: string
          declined_at: string | null
          discount_cents: number
          estimate_number: string
          id: string
          job_id: string
          notes: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["estimate_status"]
          subtotal_cents: number
          tax_cents: number
          tax_rate_basis_points: number
          terms: string | null
          title: string
          total_cents: number
          updated_at: string
          voided_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          approval_statement?: string | null
          approved_by_name?: string | null
          approved_signature_id?: string | null
          company_id: string
          created_at?: string
          created_by_user_id: string
          currency_code?: string
          declined_at?: string | null
          discount_cents?: number
          estimate_number: string
          id?: string
          job_id: string
          notes?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["estimate_status"]
          subtotal_cents?: number
          tax_cents?: number
          tax_rate_basis_points?: number
          terms?: string | null
          title: string
          total_cents?: number
          updated_at?: string
          voided_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          approval_statement?: string | null
          approved_by_name?: string | null
          approved_signature_id?: string | null
          company_id?: string
          created_at?: string
          created_by_user_id?: string
          currency_code?: string
          declined_at?: string | null
          discount_cents?: number
          estimate_number?: string
          id?: string
          job_id?: string
          notes?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["estimate_status"]
          subtotal_cents?: number
          tax_cents?: number
          tax_rate_basis_points?: number
          terms?: string | null
          title?: string
          total_cents?: number
          updated_at?: string
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "estimates_approved_signature_id_fkey"
            columns: ["approved_signature_id"]
            isOneToOne: false
            referencedRelation: "signatures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimates_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      external_record_mappings: {
        Row: {
          company_id: string
          created_at: string
          entity_type: Database["public"]["Enums"]["data_import_entity_type"]
          external_id: string
          id: string
          internal_id: string
          internal_table: string
          last_import_run_id: string | null
          payload_hash: string
          provider: Database["public"]["Enums"]["migration_source_provider"]
          source_updated_at: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          entity_type: Database["public"]["Enums"]["data_import_entity_type"]
          external_id: string
          id?: string
          internal_id: string
          internal_table: string
          last_import_run_id?: string | null
          payload_hash: string
          provider: Database["public"]["Enums"]["migration_source_provider"]
          source_updated_at?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          entity_type?: Database["public"]["Enums"]["data_import_entity_type"]
          external_id?: string
          id?: string
          internal_id?: string
          internal_table?: string
          last_import_run_id?: string | null
          payload_hash?: string
          provider?: Database["public"]["Enums"]["migration_source_provider"]
          source_updated_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_record_mappings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_record_mappings_last_import_run_id_fkey"
            columns: ["last_import_run_id"]
            isOneToOne: false
            referencedRelation: "data_import_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      inspection_items: {
        Row: {
          company_id: string
          created_at: string
          finding_severity:
            | Database["public"]["Enums"]["finding_severity"]
            | null
          id: string
          inspection_id: string
          is_required: boolean
          item_key: string
          job_id: string
          label: string
          position: number
          recommendation: string | null
          section_key: string
          status: Database["public"]["Enums"]["inspection_item_status"]
          technician_notes: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          finding_severity?:
            | Database["public"]["Enums"]["finding_severity"]
            | null
          id?: string
          inspection_id: string
          is_required?: boolean
          item_key: string
          job_id: string
          label: string
          position: number
          recommendation?: string | null
          section_key: string
          status?: Database["public"]["Enums"]["inspection_item_status"]
          technician_notes?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          finding_severity?:
            | Database["public"]["Enums"]["finding_severity"]
            | null
          id?: string
          inspection_id?: string
          is_required?: boolean
          item_key?: string
          job_id?: string
          label?: string
          position?: number
          recommendation?: string | null
          section_key?: string
          status?: Database["public"]["Enums"]["inspection_item_status"]
          technician_notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspection_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_items_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "inspections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_items_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      inspections: {
        Row: {
          company_id: string
          completed_at: string | null
          completed_by_user_id: string | null
          created_at: string
          id: string
          job_id: string
          started_at: string
          started_by_user_id: string
          status: Database["public"]["Enums"]["inspection_status"]
          template_version: string
          updated_at: string
        }
        Insert: {
          company_id: string
          completed_at?: string | null
          completed_by_user_id?: string | null
          created_at?: string
          id?: string
          job_id: string
          started_at?: string
          started_by_user_id: string
          status?: Database["public"]["Enums"]["inspection_status"]
          template_version: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          completed_at?: string | null
          completed_by_user_id?: string | null
          created_at?: string
          id?: string
          job_id?: string
          started_at?: string
          started_by_user_id?: string
          status?: Database["public"]["Enums"]["inspection_status"]
          template_version?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspections_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_cycle_count_lines: {
        Row: {
          company_id: string
          counted_quantity: number
          created_at: string
          cycle_count_id: string
          expected_quantity: number
          id: string
          inventory_item_id: string
          notes: string | null
          updated_at: string
          variance_quantity: number
        }
        Insert: {
          company_id: string
          counted_quantity: number
          created_at?: string
          cycle_count_id: string
          expected_quantity: number
          id?: string
          inventory_item_id: string
          notes?: string | null
          updated_at?: string
          variance_quantity: number
        }
        Update: {
          company_id?: string
          counted_quantity?: number
          created_at?: string
          cycle_count_id?: string
          expected_quantity?: number
          id?: string
          inventory_item_id?: string
          notes?: string | null
          updated_at?: string
          variance_quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_cycle_count_lines_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_cycle_count_lines_cycle_count_company_fkey"
            columns: ["cycle_count_id", "company_id"]
            isOneToOne: false
            referencedRelation: "inventory_cycle_counts"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "inventory_cycle_count_lines_cycle_count_id_fkey"
            columns: ["cycle_count_id"]
            isOneToOne: false
            referencedRelation: "inventory_cycle_counts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_cycle_count_lines_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_cycle_count_lines_item_company_fkey"
            columns: ["inventory_item_id", "company_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      inventory_cycle_counts: {
        Row: {
          company_id: string
          counted_at: string
          counted_by_user_id: string
          created_at: string
          id: string
          notes: string | null
          stock_location_id: string
          updated_at: string
        }
        Insert: {
          company_id: string
          counted_at?: string
          counted_by_user_id: string
          created_at?: string
          id?: string
          notes?: string | null
          stock_location_id: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          counted_at?: string
          counted_by_user_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          stock_location_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_cycle_counts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_cycle_counts_counted_by_user_id_fkey"
            columns: ["counted_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_cycle_counts_stock_location_company_fkey"
            columns: ["stock_location_id", "company_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "inventory_cycle_counts_stock_location_id_fkey"
            columns: ["stock_location_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_item_aliases: {
        Row: {
          alias_type: Database["public"]["Enums"]["inventory_alias_type"]
          company_id: string
          created_at: string
          id: string
          inventory_item_id: string
          updated_at: string
          value: string
        }
        Insert: {
          alias_type: Database["public"]["Enums"]["inventory_alias_type"]
          company_id: string
          created_at?: string
          id?: string
          inventory_item_id: string
          updated_at?: string
          value: string
        }
        Update: {
          alias_type?: Database["public"]["Enums"]["inventory_alias_type"]
          company_id?: string
          created_at?: string
          id?: string
          inventory_item_id?: string
          updated_at?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_item_aliases_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_item_aliases_inventory_item_company_fkey"
            columns: ["inventory_item_id", "company_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "inventory_item_aliases_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          company_id: string
          created_at: string
          default_unit_cost_cents: number | null
          description: string | null
          id: string
          is_active: boolean
          item_type: Database["public"]["Enums"]["inventory_item_type"]
          manufacturer: string | null
          name: string
          notes: string | null
          part_number: string | null
          sku: string
          supplier_account_id: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          default_unit_cost_cents?: number | null
          description?: string | null
          id?: string
          is_active?: boolean
          item_type?: Database["public"]["Enums"]["inventory_item_type"]
          manufacturer?: string | null
          name: string
          notes?: string | null
          part_number?: string | null
          sku: string
          supplier_account_id?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          default_unit_cost_cents?: number | null
          description?: string | null
          id?: string
          is_active?: boolean
          item_type?: Database["public"]["Enums"]["inventory_item_type"]
          manufacturer?: string | null
          name?: string
          notes?: string | null
          part_number?: string | null
          sku?: string
          supplier_account_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_supplier_account_id_fkey"
            columns: ["supplier_account_id"]
            isOneToOne: false
            referencedRelation: "supplier_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_reservations: {
        Row: {
          company_id: string
          created_at: string
          created_by_user_id: string
          id: string
          inventory_item_id: string
          job_id: string
          notes: string | null
          part_request_line_id: string | null
          quantity_consumed: number
          quantity_released: number
          quantity_reserved: number
          stock_location_id: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by_user_id: string
          id?: string
          inventory_item_id: string
          job_id: string
          notes?: string | null
          part_request_line_id?: string | null
          quantity_consumed?: number
          quantity_released?: number
          quantity_reserved?: number
          stock_location_id: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by_user_id?: string
          id?: string
          inventory_item_id?: string
          job_id?: string
          notes?: string | null
          part_request_line_id?: string | null
          quantity_consumed?: number
          quantity_released?: number
          quantity_reserved?: number
          stock_location_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_reservations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_reservations_inventory_item_company_fkey"
            columns: ["inventory_item_id", "company_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "inventory_reservations_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_reservations_job_company_fkey"
            columns: ["job_id", "company_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "inventory_reservations_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_reservations_part_request_line_company_fkey"
            columns: ["part_request_line_id", "company_id"]
            isOneToOne: false
            referencedRelation: "part_request_lines"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "inventory_reservations_part_request_line_id_fkey"
            columns: ["part_request_line_id"]
            isOneToOne: false
            referencedRelation: "part_request_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_reservations_stock_location_company_fkey"
            columns: ["stock_location_id", "company_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "inventory_reservations_stock_location_id_fkey"
            columns: ["stock_location_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_stock_settings: {
        Row: {
          company_id: string
          created_at: string
          id: string
          inventory_item_id: string
          is_stocked_here: boolean
          low_stock_threshold_quantity: number
          preferred_reorder_quantity: number | null
          reorder_point_quantity: number
          stock_location_id: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          inventory_item_id: string
          is_stocked_here?: boolean
          low_stock_threshold_quantity?: number
          preferred_reorder_quantity?: number | null
          reorder_point_quantity?: number
          stock_location_id: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          inventory_item_id?: string
          is_stocked_here?: boolean
          low_stock_threshold_quantity?: number
          preferred_reorder_quantity?: number | null
          reorder_point_quantity?: number
          stock_location_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_stock_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_stock_settings_inventory_item_company_fkey"
            columns: ["inventory_item_id", "company_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "inventory_stock_settings_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_stock_settings_stock_location_company_fkey"
            columns: ["stock_location_id", "company_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "inventory_stock_settings_stock_location_id_fkey"
            columns: ["stock_location_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_transactions: {
        Row: {
          company_id: string
          created_at: string
          created_by_user_id: string
          effective_at: string
          id: string
          inventory_item_id: string
          job_id: string | null
          notes: string | null
          part_request_line_id: string | null
          part_return_line_id: string | null
          purchase_order_line_id: string | null
          purchase_receipt_line_id: string | null
          quantity_delta: number
          reference_number: string | null
          source_id: string | null
          source_type: Database["public"]["Enums"]["inventory_transaction_source_type"]
          stock_location_id: string
          transaction_type: Database["public"]["Enums"]["inventory_transaction_type"]
          unit_cost_cents: number | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by_user_id: string
          effective_at?: string
          id?: string
          inventory_item_id: string
          job_id?: string | null
          notes?: string | null
          part_request_line_id?: string | null
          part_return_line_id?: string | null
          purchase_order_line_id?: string | null
          purchase_receipt_line_id?: string | null
          quantity_delta: number
          reference_number?: string | null
          source_id?: string | null
          source_type: Database["public"]["Enums"]["inventory_transaction_source_type"]
          stock_location_id: string
          transaction_type: Database["public"]["Enums"]["inventory_transaction_type"]
          unit_cost_cents?: number | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by_user_id?: string
          effective_at?: string
          id?: string
          inventory_item_id?: string
          job_id?: string | null
          notes?: string | null
          part_request_line_id?: string | null
          part_return_line_id?: string | null
          purchase_order_line_id?: string | null
          purchase_receipt_line_id?: string | null
          quantity_delta?: number
          reference_number?: string | null
          source_id?: string | null
          source_type?: Database["public"]["Enums"]["inventory_transaction_source_type"]
          stock_location_id?: string
          transaction_type?: Database["public"]["Enums"]["inventory_transaction_type"]
          unit_cost_cents?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_inventory_item_company_fkey"
            columns: ["inventory_item_id", "company_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "inventory_transactions_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_job_company_fkey"
            columns: ["job_id", "company_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "inventory_transactions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_part_request_line_company_fkey"
            columns: ["part_request_line_id", "company_id"]
            isOneToOne: false
            referencedRelation: "part_request_lines"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "inventory_transactions_part_request_line_id_fkey"
            columns: ["part_request_line_id"]
            isOneToOne: false
            referencedRelation: "part_request_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_part_return_line_company_fkey"
            columns: ["part_return_line_id", "company_id"]
            isOneToOne: false
            referencedRelation: "part_return_lines"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "inventory_transactions_part_return_line_id_fkey"
            columns: ["part_return_line_id"]
            isOneToOne: false
            referencedRelation: "part_return_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_purchase_order_line_company_fkey"
            columns: ["purchase_order_line_id", "company_id"]
            isOneToOne: false
            referencedRelation: "purchase_order_lines"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "inventory_transactions_purchase_order_line_id_fkey"
            columns: ["purchase_order_line_id"]
            isOneToOne: false
            referencedRelation: "purchase_order_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_purchase_receipt_line_company_fkey"
            columns: ["purchase_receipt_line_id", "company_id"]
            isOneToOne: false
            referencedRelation: "purchase_receipt_lines"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "inventory_transactions_purchase_receipt_line_id_fkey"
            columns: ["purchase_receipt_line_id"]
            isOneToOne: false
            referencedRelation: "purchase_receipt_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_stock_location_company_fkey"
            columns: ["stock_location_id", "company_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "inventory_transactions_stock_location_id_fkey"
            columns: ["stock_location_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_transfer_lines: {
        Row: {
          company_id: string
          created_at: string
          id: string
          inventory_item_id: string
          notes: string | null
          quantity_received: number
          quantity_requested: number
          quantity_shipped: number
          transfer_id: string
          unit_cost_cents: number | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          inventory_item_id: string
          notes?: string | null
          quantity_received?: number
          quantity_requested: number
          quantity_shipped?: number
          transfer_id: string
          unit_cost_cents?: number | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          inventory_item_id?: string
          notes?: string | null
          quantity_received?: number
          quantity_requested?: number
          quantity_shipped?: number
          transfer_id?: string
          unit_cost_cents?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_transfer_lines_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transfer_lines_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transfer_lines_item_company_fkey"
            columns: ["inventory_item_id", "company_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "inventory_transfer_lines_transfer_company_fkey"
            columns: ["transfer_id", "company_id"]
            isOneToOne: false
            referencedRelation: "inventory_transfers"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "inventory_transfer_lines_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "inventory_transfers"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_transfers: {
        Row: {
          company_id: string
          created_at: string
          from_stock_location_id: string
          id: string
          notes: string | null
          received_at: string | null
          received_by_user_id: string | null
          reference_number: string | null
          requested_at: string
          requested_by_user_id: string
          shipped_at: string | null
          shipped_by_user_id: string | null
          status: Database["public"]["Enums"]["inventory_transfer_status"]
          to_stock_location_id: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          from_stock_location_id: string
          id?: string
          notes?: string | null
          received_at?: string | null
          received_by_user_id?: string | null
          reference_number?: string | null
          requested_at?: string
          requested_by_user_id: string
          shipped_at?: string | null
          shipped_by_user_id?: string | null
          status?: Database["public"]["Enums"]["inventory_transfer_status"]
          to_stock_location_id: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          from_stock_location_id?: string
          id?: string
          notes?: string | null
          received_at?: string | null
          received_by_user_id?: string | null
          reference_number?: string | null
          requested_at?: string
          requested_by_user_id?: string
          shipped_at?: string | null
          shipped_by_user_id?: string | null
          status?: Database["public"]["Enums"]["inventory_transfer_status"]
          to_stock_location_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_transfers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transfers_from_location_company_fkey"
            columns: ["from_stock_location_id", "company_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "inventory_transfers_from_stock_location_id_fkey"
            columns: ["from_stock_location_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transfers_received_by_user_id_fkey"
            columns: ["received_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transfers_requested_by_user_id_fkey"
            columns: ["requested_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transfers_shipped_by_user_id_fkey"
            columns: ["shipped_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transfers_to_location_company_fkey"
            columns: ["to_stock_location_id", "company_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "inventory_transfers_to_stock_location_id_fkey"
            columns: ["to_stock_location_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_line_items: {
        Row: {
          actual_cost_cents: number | null
          company_id: string
          created_at: string
          description: string | null
          estimated_cost_cents: number | null
          id: string
          invoice_id: string
          item_type: string
          job_id: string
          line_subtotal_cents: number
          name: string
          part_request_line_id: string | null
          position: number
          quantity: number
          taxable: boolean
          unit_price_cents: number
          updated_at: string
        }
        Insert: {
          actual_cost_cents?: number | null
          company_id: string
          created_at?: string
          description?: string | null
          estimated_cost_cents?: number | null
          id?: string
          invoice_id: string
          item_type: string
          job_id: string
          line_subtotal_cents: number
          name: string
          part_request_line_id?: string | null
          position: number
          quantity: number
          taxable?: boolean
          unit_price_cents: number
          updated_at?: string
        }
        Update: {
          actual_cost_cents?: number | null
          company_id?: string
          created_at?: string
          description?: string | null
          estimated_cost_cents?: number | null
          id?: string
          invoice_id?: string
          item_type?: string
          job_id?: string
          line_subtotal_cents?: number
          name?: string
          part_request_line_id?: string | null
          position?: number
          quantity?: number
          taxable?: boolean
          unit_price_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_line_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_line_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_line_items_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_line_items_part_request_line_id_fkey"
            columns: ["part_request_line_id"]
            isOneToOne: false
            referencedRelation: "part_request_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_paid_cents: number
          balance_due_cents: number
          company_id: string
          created_at: string
          created_by_user_id: string
          currency_code: string
          discount_cents: number
          due_at: string | null
          estimate_id: string | null
          id: string
          invoice_number: string
          issued_at: string | null
          job_id: string
          notes: string | null
          paid_at: string | null
          payment_url: string | null
          payment_url_expires_at: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          stripe_checkout_session_id: string | null
          subtotal_cents: number
          tax_cents: number
          tax_rate_basis_points: number
          terms: string | null
          title: string
          total_cents: number
          updated_at: string
          voided_at: string | null
        }
        Insert: {
          amount_paid_cents?: number
          balance_due_cents?: number
          company_id: string
          created_at?: string
          created_by_user_id: string
          currency_code?: string
          discount_cents?: number
          due_at?: string | null
          estimate_id?: string | null
          id?: string
          invoice_number: string
          issued_at?: string | null
          job_id: string
          notes?: string | null
          paid_at?: string | null
          payment_url?: string | null
          payment_url_expires_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          stripe_checkout_session_id?: string | null
          subtotal_cents?: number
          tax_cents?: number
          tax_rate_basis_points?: number
          terms?: string | null
          title: string
          total_cents?: number
          updated_at?: string
          voided_at?: string | null
        }
        Update: {
          amount_paid_cents?: number
          balance_due_cents?: number
          company_id?: string
          created_at?: string
          created_by_user_id?: string
          currency_code?: string
          discount_cents?: number
          due_at?: string | null
          estimate_id?: string | null
          id?: string
          invoice_number?: string
          issued_at?: string | null
          job_id?: string
          notes?: string | null
          paid_at?: string | null
          payment_url?: string | null
          payment_url_expires_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          stripe_checkout_session_id?: string | null
          subtotal_cents?: number
          tax_cents?: number
          tax_rate_basis_points?: number
          terms?: string | null
          title?: string
          total_cents?: number
          updated_at?: string
          voided_at?: string | null
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
            foreignKeyName: "invoices_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_inventory_issues: {
        Row: {
          company_id: string
          created_at: string
          id: string
          inventory_item_id: string
          inventory_reservation_id: string
          issued_at: string
          issued_by_user_id: string
          job_id: string
          notes: string | null
          part_request_line_id: string | null
          quantity_consumed: number
          quantity_issued: number
          quantity_returned: number
          status: Database["public"]["Enums"]["job_inventory_issue_status"]
          stock_location_id: string
          unit_cost_cents: number
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          inventory_item_id: string
          inventory_reservation_id: string
          issued_at?: string
          issued_by_user_id: string
          job_id: string
          notes?: string | null
          part_request_line_id?: string | null
          quantity_consumed?: number
          quantity_issued: number
          quantity_returned?: number
          status?: Database["public"]["Enums"]["job_inventory_issue_status"]
          stock_location_id: string
          unit_cost_cents: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          inventory_item_id?: string
          inventory_reservation_id?: string
          issued_at?: string
          issued_by_user_id?: string
          job_id?: string
          notes?: string | null
          part_request_line_id?: string | null
          quantity_consumed?: number
          quantity_issued?: number
          quantity_returned?: number
          status?: Database["public"]["Enums"]["job_inventory_issue_status"]
          stock_location_id?: string
          unit_cost_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_inventory_issues_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_inventory_issues_inventory_item_company_fkey"
            columns: ["inventory_item_id", "company_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "job_inventory_issues_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_inventory_issues_inventory_reservation_id_fkey"
            columns: ["inventory_reservation_id"]
            isOneToOne: false
            referencedRelation: "inventory_reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_inventory_issues_issued_by_user_id_fkey"
            columns: ["issued_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_inventory_issues_job_company_fkey"
            columns: ["job_id", "company_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "job_inventory_issues_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_inventory_issues_part_request_line_company_fkey"
            columns: ["part_request_line_id", "company_id"]
            isOneToOne: false
            referencedRelation: "part_request_lines"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "job_inventory_issues_part_request_line_id_fkey"
            columns: ["part_request_line_id"]
            isOneToOne: false
            referencedRelation: "part_request_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_inventory_issues_reservation_company_fkey"
            columns: ["inventory_reservation_id", "company_id"]
            isOneToOne: false
            referencedRelation: "inventory_reservations"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "job_inventory_issues_stock_location_company_fkey"
            columns: ["stock_location_id", "company_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "job_inventory_issues_stock_location_id_fkey"
            columns: ["stock_location_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      job_notes: {
        Row: {
          author_user_id: string
          body: string
          company_id: string
          created_at: string
          id: string
          is_internal: boolean
          job_id: string
          updated_at: string
        }
        Insert: {
          author_user_id: string
          body: string
          company_id: string
          created_at?: string
          id?: string
          is_internal?: boolean
          job_id: string
          updated_at?: string
        }
        Update: {
          author_user_id?: string
          body?: string
          company_id?: string
          created_at?: string
          id?: string
          is_internal?: boolean
          job_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_notes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_notes_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_status_history: {
        Row: {
          changed_by_user_id: string
          company_id: string
          created_at: string
          from_status: Database["public"]["Enums"]["job_status"] | null
          id: string
          job_id: string
          reason: string | null
          to_status: Database["public"]["Enums"]["job_status"]
        }
        Insert: {
          changed_by_user_id: string
          company_id: string
          created_at?: string
          from_status?: Database["public"]["Enums"]["job_status"] | null
          id?: string
          job_id: string
          reason?: string | null
          to_status: Database["public"]["Enums"]["job_status"]
        }
        Update: {
          changed_by_user_id?: string
          company_id?: string
          created_at?: string
          from_status?: Database["public"]["Enums"]["job_status"] | null
          id?: string
          job_id?: string
          reason?: string | null
          to_status?: Database["public"]["Enums"]["job_status"]
        }
        Relationships: [
          {
            foreignKeyName: "job_status_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_status_history_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          arrival_window_end_at: string | null
          arrival_window_start_at: string | null
          assigned_technician_user_id: string | null
          canceled_at: string | null
          company_id: string
          completed_at: string | null
          created_at: string
          created_by_user_id: string
          customer_concern: string | null
          customer_id: string
          description: string | null
          id: string
          internal_summary: string | null
          is_active: boolean
          priority: string
          scheduled_end_at: string | null
          scheduled_start_at: string | null
          service_site_id: string | null
          source: string
          started_at: string | null
          status: Database["public"]["Enums"]["job_status"]
          title: string
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          arrival_window_end_at?: string | null
          arrival_window_start_at?: string | null
          assigned_technician_user_id?: string | null
          canceled_at?: string | null
          company_id: string
          completed_at?: string | null
          created_at?: string
          created_by_user_id: string
          customer_concern?: string | null
          customer_id: string
          description?: string | null
          id?: string
          internal_summary?: string | null
          is_active?: boolean
          priority?: string
          scheduled_end_at?: string | null
          scheduled_start_at?: string | null
          service_site_id?: string | null
          source?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          title: string
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          arrival_window_end_at?: string | null
          arrival_window_start_at?: string | null
          assigned_technician_user_id?: string | null
          canceled_at?: string | null
          company_id?: string
          completed_at?: string | null
          created_at?: string
          created_by_user_id?: string
          customer_concern?: string | null
          customer_id?: string
          description?: string | null
          id?: string
          internal_summary?: string | null
          is_active?: boolean
          priority?: string
          scheduled_end_at?: string | null
          scheduled_start_at?: string | null
          service_site_id?: string | null
          source?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          title?: string
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_service_site_id_fkey"
            columns: ["service_site_id"]
            isOneToOne: false
            referencedRelation: "customer_addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      migration_source_accounts: {
        Row: {
          capabilities_json: Json
          company_id: string
          created_at: string
          credential_ciphertext: string | null
          credential_hint: string | null
          display_name: string
          id: string
          last_error_message: string | null
          last_verified_at: string | null
          provider: Database["public"]["Enums"]["migration_source_provider"]
          settings_json: Json
          status: Database["public"]["Enums"]["migration_source_account_status"]
          updated_at: string
          webhook_secret: string | null
        }
        Insert: {
          capabilities_json?: Json
          company_id: string
          created_at?: string
          credential_ciphertext?: string | null
          credential_hint?: string | null
          display_name: string
          id?: string
          last_error_message?: string | null
          last_verified_at?: string | null
          provider: Database["public"]["Enums"]["migration_source_provider"]
          settings_json?: Json
          status?: Database["public"]["Enums"]["migration_source_account_status"]
          updated_at?: string
          webhook_secret?: string | null
        }
        Update: {
          capabilities_json?: Json
          company_id?: string
          created_at?: string
          credential_ciphertext?: string | null
          credential_hint?: string | null
          display_name?: string
          id?: string
          last_error_message?: string | null
          last_verified_at?: string | null
          provider?: Database["public"]["Enums"]["migration_source_provider"]
          settings_json?: Json
          status?: Database["public"]["Enums"]["migration_source_account_status"]
          updated_at?: string
          webhook_secret?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "migration_source_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      part_request_lines: {
        Row: {
          actual_unit_cost_cents: number | null
          company_id: string
          core_charge_cents: number
          created_at: string
          created_by_user_id: string
          description: string
          estimate_id: string | null
          estimate_line_item_id: string | null
          estimated_unit_cost_cents: number | null
          id: string
          inventory_item_id: string | null
          job_id: string
          last_supplier_account_id: string | null
          manufacturer: string | null
          needs_core: boolean
          notes: string | null
          part_number: string | null
          part_request_id: string
          quantity_consumed_from_stock: number
          quantity_core_due: number
          quantity_core_returned: number
          quantity_installed: number
          quantity_issued_from_inventory: number
          quantity_ordered: number
          quantity_received: number
          quantity_requested: number
          quantity_reserved_from_stock: number
          quantity_returned: number
          quantity_returned_to_inventory: number
          quoted_unit_cost_cents: number | null
          status: Database["public"]["Enums"]["part_lifecycle_status"]
          stock_location_id: string | null
          supplier_sku: string | null
          updated_at: string
        }
        Insert: {
          actual_unit_cost_cents?: number | null
          company_id: string
          core_charge_cents?: number
          created_at?: string
          created_by_user_id: string
          description: string
          estimate_id?: string | null
          estimate_line_item_id?: string | null
          estimated_unit_cost_cents?: number | null
          id?: string
          inventory_item_id?: string | null
          job_id: string
          last_supplier_account_id?: string | null
          manufacturer?: string | null
          needs_core?: boolean
          notes?: string | null
          part_number?: string | null
          part_request_id: string
          quantity_consumed_from_stock?: number
          quantity_core_due?: number
          quantity_core_returned?: number
          quantity_installed?: number
          quantity_issued_from_inventory?: number
          quantity_ordered?: number
          quantity_received?: number
          quantity_requested?: number
          quantity_reserved_from_stock?: number
          quantity_returned?: number
          quantity_returned_to_inventory?: number
          quoted_unit_cost_cents?: number | null
          status?: Database["public"]["Enums"]["part_lifecycle_status"]
          stock_location_id?: string | null
          supplier_sku?: string | null
          updated_at?: string
        }
        Update: {
          actual_unit_cost_cents?: number | null
          company_id?: string
          core_charge_cents?: number
          created_at?: string
          created_by_user_id?: string
          description?: string
          estimate_id?: string | null
          estimate_line_item_id?: string | null
          estimated_unit_cost_cents?: number | null
          id?: string
          inventory_item_id?: string | null
          job_id?: string
          last_supplier_account_id?: string | null
          manufacturer?: string | null
          needs_core?: boolean
          notes?: string | null
          part_number?: string | null
          part_request_id?: string
          quantity_consumed_from_stock?: number
          quantity_core_due?: number
          quantity_core_returned?: number
          quantity_installed?: number
          quantity_issued_from_inventory?: number
          quantity_ordered?: number
          quantity_received?: number
          quantity_requested?: number
          quantity_reserved_from_stock?: number
          quantity_returned?: number
          quantity_returned_to_inventory?: number
          quoted_unit_cost_cents?: number | null
          status?: Database["public"]["Enums"]["part_lifecycle_status"]
          stock_location_id?: string | null
          supplier_sku?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "part_request_lines_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "part_request_lines_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "part_request_lines_estimate_line_item_id_fkey"
            columns: ["estimate_line_item_id"]
            isOneToOne: false
            referencedRelation: "estimate_line_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "part_request_lines_inventory_item_company_fkey"
            columns: ["inventory_item_id", "company_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "part_request_lines_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "part_request_lines_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "part_request_lines_last_supplier_account_id_fkey"
            columns: ["last_supplier_account_id"]
            isOneToOne: false
            referencedRelation: "supplier_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "part_request_lines_part_request_id_fkey"
            columns: ["part_request_id"]
            isOneToOne: false
            referencedRelation: "part_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "part_request_lines_stock_location_company_fkey"
            columns: ["stock_location_id", "company_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "part_request_lines_stock_location_id_fkey"
            columns: ["stock_location_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      part_requests: {
        Row: {
          assigned_buyer_user_id: string | null
          company_id: string
          created_at: string
          estimate_id: string | null
          id: string
          job_id: string
          notes: string | null
          origin: Database["public"]["Enums"]["part_request_origin"]
          requested_by_user_id: string
          status: Database["public"]["Enums"]["part_request_status"]
          updated_at: string
        }
        Insert: {
          assigned_buyer_user_id?: string | null
          company_id: string
          created_at?: string
          estimate_id?: string | null
          id?: string
          job_id: string
          notes?: string | null
          origin: Database["public"]["Enums"]["part_request_origin"]
          requested_by_user_id: string
          status?: Database["public"]["Enums"]["part_request_status"]
          updated_at?: string
        }
        Update: {
          assigned_buyer_user_id?: string | null
          company_id?: string
          created_at?: string
          estimate_id?: string | null
          id?: string
          job_id?: string
          notes?: string | null
          origin?: Database["public"]["Enums"]["part_request_origin"]
          requested_by_user_id?: string
          status?: Database["public"]["Enums"]["part_request_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "part_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "part_requests_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "part_requests_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      part_return_lines: {
        Row: {
          company_id: string
          created_at: string
          credit_amount_cents: number | null
          id: string
          is_core_return: boolean
          notes: string | null
          part_return_id: string
          purchase_order_line_id: string
          quantity_returned: number
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          credit_amount_cents?: number | null
          id?: string
          is_core_return?: boolean
          notes?: string | null
          part_return_id: string
          purchase_order_line_id: string
          quantity_returned?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          credit_amount_cents?: number | null
          id?: string
          is_core_return?: boolean
          notes?: string | null
          part_return_id?: string
          purchase_order_line_id?: string
          quantity_returned?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "part_return_lines_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "part_return_lines_part_return_id_fkey"
            columns: ["part_return_id"]
            isOneToOne: false
            referencedRelation: "part_returns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "part_return_lines_purchase_order_line_id_fkey"
            columns: ["purchase_order_line_id"]
            isOneToOne: false
            referencedRelation: "purchase_order_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      part_returns: {
        Row: {
          company_id: string
          created_at: string
          id: string
          notes: string | null
          purchase_order_id: string | null
          reason: string | null
          return_number: string | null
          returned_at: string | null
          returned_by_user_id: string
          status: Database["public"]["Enums"]["part_return_status"]
          supplier_account_id: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          notes?: string | null
          purchase_order_id?: string | null
          reason?: string | null
          return_number?: string | null
          returned_at?: string | null
          returned_by_user_id: string
          status?: Database["public"]["Enums"]["part_return_status"]
          supplier_account_id: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          purchase_order_id?: string | null
          reason?: string | null
          return_number?: string | null
          returned_at?: string | null
          returned_by_user_id?: string
          status?: Database["public"]["Enums"]["part_return_status"]
          supplier_account_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "part_returns_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "part_returns_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "part_returns_supplier_account_id_fkey"
            columns: ["supplier_account_id"]
            isOneToOne: false
            referencedRelation: "supplier_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_cents: number
          company_id: string
          created_at: string
          currency_code: string
          id: string
          invoice_id: string
          job_id: string
          paid_at: string
          provider: string
          receipt_url: string | null
          status: Database["public"]["Enums"]["payment_status"]
          stripe_charge_id: string | null
          stripe_checkout_session_id: string
          stripe_event_id: string
          stripe_payment_intent_id: string | null
          updated_at: string
        }
        Insert: {
          amount_cents: number
          company_id: string
          created_at?: string
          currency_code?: string
          id?: string
          invoice_id: string
          job_id: string
          paid_at?: string
          provider?: string
          receipt_url?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          stripe_charge_id?: string | null
          stripe_checkout_session_id: string
          stripe_event_id: string
          stripe_payment_intent_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          company_id?: string
          created_at?: string
          currency_code?: string
          id?: string
          invoice_id?: string
          job_id?: string
          paid_at?: string
          provider?: string
          receipt_url?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          stripe_charge_id?: string | null
          stripe_checkout_session_id?: string
          stripe_event_id?: string
          stripe_payment_intent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      procurement_provider_accounts: {
        Row: {
          capabilities_json: Json
          company_id: string
          created_at: string
          credential_ciphertext: string | null
          credential_hint: string | null
          display_name: string
          id: string
          last_error_message: string | null
          last_verified_at: string | null
          provider: Database["public"]["Enums"]["procurement_provider"]
          settings_json: Json
          status: Database["public"]["Enums"]["procurement_provider_account_status"]
          updated_at: string
          username: string | null
        }
        Insert: {
          capabilities_json?: Json
          company_id: string
          created_at?: string
          credential_ciphertext?: string | null
          credential_hint?: string | null
          display_name: string
          id?: string
          last_error_message?: string | null
          last_verified_at?: string | null
          provider: Database["public"]["Enums"]["procurement_provider"]
          settings_json?: Json
          status?: Database["public"]["Enums"]["procurement_provider_account_status"]
          updated_at?: string
          username?: string | null
        }
        Update: {
          capabilities_json?: Json
          company_id?: string
          created_at?: string
          credential_ciphertext?: string | null
          credential_hint?: string | null
          display_name?: string
          id?: string
          last_error_message?: string | null
          last_verified_at?: string | null
          provider?: Database["public"]["Enums"]["procurement_provider"]
          settings_json?: Json
          status?: Database["public"]["Enums"]["procurement_provider_account_status"]
          updated_at?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "procurement_provider_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      procurement_provider_order_lines: {
        Row: {
          company_id: string
          created_at: string
          id: string
          provider_line_reference: string | null
          provider_order_id: string
          provider_quote_line_id: string | null
          purchase_order_line_id: string
          quantity: number
          raw_response_json: Json
          unit_price_cents: number | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          provider_line_reference?: string | null
          provider_order_id: string
          provider_quote_line_id?: string | null
          purchase_order_line_id: string
          quantity?: number
          raw_response_json?: Json
          unit_price_cents?: number | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          provider_line_reference?: string | null
          provider_order_id?: string
          provider_quote_line_id?: string | null
          purchase_order_line_id?: string
          quantity?: number
          raw_response_json?: Json
          unit_price_cents?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "procurement_provider_order_lines_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procurement_provider_order_lines_order_company_fkey"
            columns: ["provider_order_id", "company_id"]
            isOneToOne: false
            referencedRelation: "procurement_provider_orders"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "procurement_provider_order_lines_provider_order_id_fkey"
            columns: ["provider_order_id"]
            isOneToOne: false
            referencedRelation: "procurement_provider_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procurement_provider_order_lines_provider_quote_line_id_fkey"
            columns: ["provider_quote_line_id"]
            isOneToOne: false
            referencedRelation: "procurement_provider_quote_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procurement_provider_order_lines_purchase_order_line_company_fk"
            columns: ["purchase_order_line_id", "company_id"]
            isOneToOne: false
            referencedRelation: "purchase_order_lines"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "procurement_provider_order_lines_purchase_order_line_id_fkey"
            columns: ["purchase_order_line_id"]
            isOneToOne: false
            referencedRelation: "purchase_order_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procurement_provider_order_lines_quote_line_company_fkey"
            columns: ["provider_quote_line_id", "company_id"]
            isOneToOne: false
            referencedRelation: "procurement_provider_quote_lines"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      procurement_provider_orders: {
        Row: {
          company_id: string
          created_at: string
          id: string
          last_error_message: string | null
          manual_fallback_reason: string | null
          provider_account_id: string
          provider_order_reference: string | null
          provider_quote_id: string | null
          purchase_order_id: string
          raw_request_json: Json
          raw_response_json: Json
          response_received_at: string | null
          status: Database["public"]["Enums"]["procurement_provider_order_status"]
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          last_error_message?: string | null
          manual_fallback_reason?: string | null
          provider_account_id: string
          provider_order_reference?: string | null
          provider_quote_id?: string | null
          purchase_order_id: string
          raw_request_json?: Json
          raw_response_json?: Json
          response_received_at?: string | null
          status?: Database["public"]["Enums"]["procurement_provider_order_status"]
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          last_error_message?: string | null
          manual_fallback_reason?: string | null
          provider_account_id?: string
          provider_order_reference?: string | null
          provider_quote_id?: string | null
          purchase_order_id?: string
          raw_request_json?: Json
          raw_response_json?: Json
          response_received_at?: string | null
          status?: Database["public"]["Enums"]["procurement_provider_order_status"]
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "procurement_provider_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procurement_provider_orders_provider_account_company_fkey"
            columns: ["provider_account_id", "company_id"]
            isOneToOne: false
            referencedRelation: "procurement_provider_accounts"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "procurement_provider_orders_provider_account_id_fkey"
            columns: ["provider_account_id"]
            isOneToOne: false
            referencedRelation: "procurement_provider_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procurement_provider_orders_provider_quote_id_fkey"
            columns: ["provider_quote_id"]
            isOneToOne: false
            referencedRelation: "procurement_provider_quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procurement_provider_orders_purchase_order_company_fkey"
            columns: ["purchase_order_id", "company_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "procurement_provider_orders_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procurement_provider_orders_quote_company_fkey"
            columns: ["provider_quote_id", "company_id"]
            isOneToOne: false
            referencedRelation: "procurement_provider_quotes"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      procurement_provider_quote_lines: {
        Row: {
          availability_text: string | null
          company_id: string
          core_charge_cents: number | null
          created_at: string
          description: string
          eta_text: string | null
          id: string
          manufacturer: string | null
          part_number: string | null
          part_request_line_id: string
          provider_location_key: string | null
          provider_offer_key: string
          provider_product_key: string | null
          provider_quote_id: string
          provider_supplier_key: string
          provider_supplier_mapping_id: string | null
          provider_supplier_name: string
          quantity: number
          raw_response_json: Json
          selected_for_cart: boolean
          unit_price_cents: number | null
          updated_at: string
        }
        Insert: {
          availability_text?: string | null
          company_id: string
          core_charge_cents?: number | null
          created_at?: string
          description: string
          eta_text?: string | null
          id?: string
          manufacturer?: string | null
          part_number?: string | null
          part_request_line_id: string
          provider_location_key?: string | null
          provider_offer_key: string
          provider_product_key?: string | null
          provider_quote_id: string
          provider_supplier_key: string
          provider_supplier_mapping_id?: string | null
          provider_supplier_name: string
          quantity?: number
          raw_response_json?: Json
          selected_for_cart?: boolean
          unit_price_cents?: number | null
          updated_at?: string
        }
        Update: {
          availability_text?: string | null
          company_id?: string
          core_charge_cents?: number | null
          created_at?: string
          description?: string
          eta_text?: string | null
          id?: string
          manufacturer?: string | null
          part_number?: string | null
          part_request_line_id?: string
          provider_location_key?: string | null
          provider_offer_key?: string
          provider_product_key?: string | null
          provider_quote_id?: string
          provider_supplier_key?: string
          provider_supplier_mapping_id?: string | null
          provider_supplier_name?: string
          quantity?: number
          raw_response_json?: Json
          selected_for_cart?: boolean
          unit_price_cents?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "procurement_provider_quote_li_provider_supplier_mapping_id_fkey"
            columns: ["provider_supplier_mapping_id"]
            isOneToOne: false
            referencedRelation: "procurement_provider_supplier_mappings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procurement_provider_quote_lines_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procurement_provider_quote_lines_part_request_line_id_fkey"
            columns: ["part_request_line_id"]
            isOneToOne: false
            referencedRelation: "part_request_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procurement_provider_quote_lines_provider_quote_id_fkey"
            columns: ["provider_quote_id"]
            isOneToOne: false
            referencedRelation: "procurement_provider_quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procurement_provider_quote_lines_quote_company_fkey"
            columns: ["provider_quote_id", "company_id"]
            isOneToOne: false
            referencedRelation: "procurement_provider_quotes"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "procurement_provider_quote_lines_request_line_company_fkey"
            columns: ["part_request_line_id", "company_id"]
            isOneToOne: false
            referencedRelation: "part_request_lines"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "procurement_provider_quote_lines_supplier_mapping_company_fkey"
            columns: ["provider_supplier_mapping_id", "company_id"]
            isOneToOne: false
            referencedRelation: "procurement_provider_supplier_mappings"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      procurement_provider_quotes: {
        Row: {
          company_id: string
          created_at: string
          estimate_id: string | null
          expires_at: string | null
          id: string
          job_id: string
          metadata_json: Json
          part_request_id: string
          provider_account_id: string
          requested_at: string
          requested_by_user_id: string
          search_context_json: Json
          status: Database["public"]["Enums"]["procurement_provider_quote_status"]
          updated_at: string
          vehicle_context_json: Json
        }
        Insert: {
          company_id: string
          created_at?: string
          estimate_id?: string | null
          expires_at?: string | null
          id?: string
          job_id: string
          metadata_json?: Json
          part_request_id: string
          provider_account_id: string
          requested_at?: string
          requested_by_user_id: string
          search_context_json?: Json
          status?: Database["public"]["Enums"]["procurement_provider_quote_status"]
          updated_at?: string
          vehicle_context_json?: Json
        }
        Update: {
          company_id?: string
          created_at?: string
          estimate_id?: string | null
          expires_at?: string | null
          id?: string
          job_id?: string
          metadata_json?: Json
          part_request_id?: string
          provider_account_id?: string
          requested_at?: string
          requested_by_user_id?: string
          search_context_json?: Json
          status?: Database["public"]["Enums"]["procurement_provider_quote_status"]
          updated_at?: string
          vehicle_context_json?: Json
        }
        Relationships: [
          {
            foreignKeyName: "procurement_provider_quotes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procurement_provider_quotes_estimate_company_fkey"
            columns: ["estimate_id", "company_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "procurement_provider_quotes_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procurement_provider_quotes_job_company_fkey"
            columns: ["job_id", "company_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "procurement_provider_quotes_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procurement_provider_quotes_part_request_company_fkey"
            columns: ["part_request_id", "company_id"]
            isOneToOne: false
            referencedRelation: "part_requests"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "procurement_provider_quotes_part_request_id_fkey"
            columns: ["part_request_id"]
            isOneToOne: false
            referencedRelation: "part_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procurement_provider_quotes_provider_account_company_fkey"
            columns: ["provider_account_id", "company_id"]
            isOneToOne: false
            referencedRelation: "procurement_provider_accounts"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "procurement_provider_quotes_provider_account_id_fkey"
            columns: ["provider_account_id"]
            isOneToOne: false
            referencedRelation: "procurement_provider_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      procurement_provider_supplier_mappings: {
        Row: {
          company_id: string
          created_at: string
          id: string
          last_error_message: string | null
          last_verified_at: string | null
          metadata_json: Json
          provider_account_id: string
          provider_location_key: string | null
          provider_supplier_key: string
          provider_supplier_name: string
          status: Database["public"]["Enums"]["procurement_provider_supplier_mapping_status"]
          supplier_account_id: string
          supports_order: boolean
          supports_quote: boolean
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          last_error_message?: string | null
          last_verified_at?: string | null
          metadata_json?: Json
          provider_account_id: string
          provider_location_key?: string | null
          provider_supplier_key: string
          provider_supplier_name: string
          status?: Database["public"]["Enums"]["procurement_provider_supplier_mapping_status"]
          supplier_account_id: string
          supports_order?: boolean
          supports_quote?: boolean
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          last_error_message?: string | null
          last_verified_at?: string | null
          metadata_json?: Json
          provider_account_id?: string
          provider_location_key?: string | null
          provider_supplier_key?: string
          provider_supplier_name?: string
          status?: Database["public"]["Enums"]["procurement_provider_supplier_mapping_status"]
          supplier_account_id?: string
          supports_order?: boolean
          supports_quote?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "procurement_provider_supplier_mappings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procurement_provider_supplier_mappings_provider_account_company"
            columns: ["provider_account_id", "company_id"]
            isOneToOne: false
            referencedRelation: "procurement_provider_accounts"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "procurement_provider_supplier_mappings_provider_account_id_fkey"
            columns: ["provider_account_id"]
            isOneToOne: false
            referencedRelation: "procurement_provider_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procurement_provider_supplier_mappings_supplier_account_company"
            columns: ["supplier_account_id", "company_id"]
            isOneToOne: false
            referencedRelation: "supplier_accounts"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "procurement_provider_supplier_mappings_supplier_account_id_fkey"
            columns: ["supplier_account_id"]
            isOneToOne: false
            referencedRelation: "supplier_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      procurement_supply_list_lines: {
        Row: {
          company_id: string
          created_at: string
          default_quantity: number
          description: string
          expected_unit_cost_cents: number | null
          id: string
          inventory_item_id: string | null
          notes: string | null
          provider: Database["public"]["Enums"]["procurement_provider"]
          provider_offer_key: string | null
          provider_product_key: string | null
          search_query: string | null
          supply_list_id: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          default_quantity?: number
          description: string
          expected_unit_cost_cents?: number | null
          id?: string
          inventory_item_id?: string | null
          notes?: string | null
          provider: Database["public"]["Enums"]["procurement_provider"]
          provider_offer_key?: string | null
          provider_product_key?: string | null
          search_query?: string | null
          supply_list_id: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          default_quantity?: number
          description?: string
          expected_unit_cost_cents?: number | null
          id?: string
          inventory_item_id?: string | null
          notes?: string | null
          provider?: Database["public"]["Enums"]["procurement_provider"]
          provider_offer_key?: string | null
          provider_product_key?: string | null
          search_query?: string | null
          supply_list_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "procurement_supply_list_lines_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procurement_supply_list_lines_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procurement_supply_list_lines_supply_list_id_fkey"
            columns: ["supply_list_id"]
            isOneToOne: false
            referencedRelation: "procurement_supply_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      procurement_supply_lists: {
        Row: {
          company_id: string
          created_at: string
          created_by_user_id: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by_user_id: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by_user_id?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "procurement_supply_lists_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          default_company_id: string | null
          email: string
          full_name: string | null
          id: string
          meet_your_mechanic_enabled: boolean
          phone: string | null
          profile_photo_bucket: string | null
          profile_photo_path: string | null
          technician_bio: string | null
          technician_certifications: string[]
          updated_at: string
          years_experience: number | null
        }
        Insert: {
          created_at?: string
          default_company_id?: string | null
          email: string
          full_name?: string | null
          id: string
          meet_your_mechanic_enabled?: boolean
          phone?: string | null
          profile_photo_bucket?: string | null
          profile_photo_path?: string | null
          technician_bio?: string | null
          technician_certifications?: string[]
          updated_at?: string
          years_experience?: number | null
        }
        Update: {
          created_at?: string
          default_company_id?: string | null
          email?: string
          full_name?: string | null
          id?: string
          meet_your_mechanic_enabled?: boolean
          phone?: string | null
          profile_photo_bucket?: string | null
          profile_photo_path?: string | null
          technician_bio?: string | null
          technician_certifications?: string[]
          updated_at?: string
          years_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_default_company_id_fkey"
            columns: ["default_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_lines: {
        Row: {
          company_id: string
          core_charge_cents: number
          created_at: string
          description: string
          id: string
          inventory_item_id: string | null
          is_core_returnable: boolean
          job_id: string
          manufacturer: string | null
          part_number: string | null
          part_request_line_id: string
          purchase_order_id: string
          quantity_core_due: number
          quantity_core_held: number
          quantity_core_returned: number
          quantity_core_returned_from_inventory: number
          quantity_installed: number
          quantity_ordered: number
          quantity_received: number
          quantity_returned: number
          status: Database["public"]["Enums"]["part_lifecycle_status"]
          stock_location_id: string | null
          supplier_account_id: string
          supplier_cart_line_id: string | null
          supplier_part_number: string | null
          unit_actual_cost_cents: number | null
          unit_ordered_cost_cents: number
          updated_at: string
        }
        Insert: {
          company_id: string
          core_charge_cents?: number
          created_at?: string
          description: string
          id?: string
          inventory_item_id?: string | null
          is_core_returnable?: boolean
          job_id: string
          manufacturer?: string | null
          part_number?: string | null
          part_request_line_id: string
          purchase_order_id: string
          quantity_core_due?: number
          quantity_core_held?: number
          quantity_core_returned?: number
          quantity_core_returned_from_inventory?: number
          quantity_installed?: number
          quantity_ordered?: number
          quantity_received?: number
          quantity_returned?: number
          status?: Database["public"]["Enums"]["part_lifecycle_status"]
          stock_location_id?: string | null
          supplier_account_id: string
          supplier_cart_line_id?: string | null
          supplier_part_number?: string | null
          unit_actual_cost_cents?: number | null
          unit_ordered_cost_cents?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          core_charge_cents?: number
          created_at?: string
          description?: string
          id?: string
          inventory_item_id?: string | null
          is_core_returnable?: boolean
          job_id?: string
          manufacturer?: string | null
          part_number?: string | null
          part_request_line_id?: string
          purchase_order_id?: string
          quantity_core_due?: number
          quantity_core_held?: number
          quantity_core_returned?: number
          quantity_core_returned_from_inventory?: number
          quantity_installed?: number
          quantity_ordered?: number
          quantity_received?: number
          quantity_returned?: number
          status?: Database["public"]["Enums"]["part_lifecycle_status"]
          stock_location_id?: string | null
          supplier_account_id?: string
          supplier_cart_line_id?: string | null
          supplier_part_number?: string | null
          unit_actual_cost_cents?: number | null
          unit_ordered_cost_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_lines_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_lines_inventory_item_company_fkey"
            columns: ["inventory_item_id", "company_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "purchase_order_lines_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_lines_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_lines_part_request_line_id_fkey"
            columns: ["part_request_line_id"]
            isOneToOne: false
            referencedRelation: "part_request_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_lines_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_lines_stock_location_company_fkey"
            columns: ["stock_location_id", "company_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "purchase_order_lines_stock_location_id_fkey"
            columns: ["stock_location_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_lines_supplier_account_id_fkey"
            columns: ["supplier_account_id"]
            isOneToOne: false
            referencedRelation: "supplier_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_lines_supplier_cart_line_id_fkey"
            columns: ["supplier_cart_line_id"]
            isOneToOne: false
            referencedRelation: "supplier_cart_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          company_id: string
          created_at: string
          expected_at: string | null
          external_reference: string | null
          id: string
          manual_order_url: string | null
          notes: string | null
          ordered_at: string | null
          ordered_by_user_id: string
          po_number: string
          status: Database["public"]["Enums"]["purchase_order_status"]
          supplier_account_id: string
          supplier_cart_id: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          expected_at?: string | null
          external_reference?: string | null
          id?: string
          manual_order_url?: string | null
          notes?: string | null
          ordered_at?: string | null
          ordered_by_user_id: string
          po_number: string
          status?: Database["public"]["Enums"]["purchase_order_status"]
          supplier_account_id: string
          supplier_cart_id?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          expected_at?: string | null
          external_reference?: string | null
          id?: string
          manual_order_url?: string | null
          notes?: string | null
          ordered_at?: string | null
          ordered_by_user_id?: string
          po_number?: string
          status?: Database["public"]["Enums"]["purchase_order_status"]
          supplier_account_id?: string
          supplier_cart_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_account_id_fkey"
            columns: ["supplier_account_id"]
            isOneToOne: false
            referencedRelation: "supplier_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_cart_id_fkey"
            columns: ["supplier_cart_id"]
            isOneToOne: false
            referencedRelation: "supplier_carts"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_receipt_lines: {
        Row: {
          company_id: string
          created_at: string
          id: string
          notes: string | null
          purchase_order_line_id: string
          quantity_received: number
          receipt_id: string
          received_into_inventory_quantity: number
          unit_received_cost_cents: number | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          notes?: string | null
          purchase_order_line_id: string
          quantity_received?: number
          receipt_id: string
          received_into_inventory_quantity?: number
          unit_received_cost_cents?: number | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          purchase_order_line_id?: string
          quantity_received?: number
          receipt_id?: string
          received_into_inventory_quantity?: number
          unit_received_cost_cents?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_receipt_lines_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_receipt_lines_purchase_order_line_id_fkey"
            columns: ["purchase_order_line_id"]
            isOneToOne: false
            referencedRelation: "purchase_order_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_receipt_lines_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "purchase_receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_receipts: {
        Row: {
          company_id: string
          created_at: string
          id: string
          notes: string | null
          purchase_order_id: string
          receipt_number: string | null
          received_at: string
          received_by_user_id: string
          supplier_account_id: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          notes?: string | null
          purchase_order_id: string
          receipt_number?: string | null
          received_at: string
          received_by_user_id: string
          supplier_account_id: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          purchase_order_id?: string
          receipt_number?: string | null
          received_at?: string
          received_by_user_id?: string
          supplier_account_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_receipts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_receipts_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_receipts_supplier_account_id_fkey"
            columns: ["supplier_account_id"]
            isOneToOne: false
            referencedRelation: "supplier_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      service_units: {
        Row: {
          assigned_technician_user_id: string | null
          company_id: string
          created_at: string
          display_name: string
          id: string
          is_active: boolean
          license_plate: string | null
          license_state: string | null
          make: string | null
          model: string | null
          notes: string | null
          stock_location_id: string
          unit_code: string
          updated_at: string
          vin: string | null
          year: number | null
        }
        Insert: {
          assigned_technician_user_id?: string | null
          company_id: string
          created_at?: string
          display_name: string
          id?: string
          is_active?: boolean
          license_plate?: string | null
          license_state?: string | null
          make?: string | null
          model?: string | null
          notes?: string | null
          stock_location_id: string
          unit_code: string
          updated_at?: string
          vin?: string | null
          year?: number | null
        }
        Update: {
          assigned_technician_user_id?: string | null
          company_id?: string
          created_at?: string
          display_name?: string
          id?: string
          is_active?: boolean
          license_plate?: string | null
          license_state?: string | null
          make?: string | null
          model?: string | null
          notes?: string | null
          stock_location_id?: string
          unit_code?: string
          updated_at?: string
          vin?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "service_units_assigned_technician_user_id_fkey"
            columns: ["assigned_technician_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_units_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_units_company_stock_location_fk"
            columns: ["stock_location_id", "company_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      signatures: {
        Row: {
          captured_by_user_id: string | null
          company_id: string
          created_at: string
          estimate_id: string
          file_size_bytes: number
          id: string
          job_id: string
          mime_type: string
          signed_by_name: string
          statement: string
          storage_bucket: string
          storage_path: string
          updated_at: string
        }
        Insert: {
          captured_by_user_id?: string | null
          company_id: string
          created_at?: string
          estimate_id: string
          file_size_bytes: number
          id?: string
          job_id: string
          mime_type: string
          signed_by_name: string
          statement: string
          storage_bucket: string
          storage_path: string
          updated_at?: string
        }
        Update: {
          captured_by_user_id?: string | null
          company_id?: string
          created_at?: string
          estimate_id?: string
          file_size_bytes?: number
          id?: string
          job_id?: string
          mime_type?: string
          signed_by_name?: string
          statement?: string
          storage_bucket?: string
          storage_path?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "signatures_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signatures_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: true
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signatures_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_provider_accounts: {
        Row: {
          capabilities_json: Json
          company_id: string
          created_at: string
          credential_ciphertext: string | null
          credential_hint: string | null
          display_name: string
          from_number: string
          id: string
          is_default: boolean
          last_error_message: string | null
          last_verified_at: string | null
          provider: Database["public"]["Enums"]["sms_provider"]
          settings_json: Json
          status: Database["public"]["Enums"]["sms_provider_account_status"]
          updated_at: string
          username: string | null
        }
        Insert: {
          capabilities_json?: Json
          company_id: string
          created_at?: string
          credential_ciphertext?: string | null
          credential_hint?: string | null
          display_name: string
          from_number: string
          id?: string
          is_default?: boolean
          last_error_message?: string | null
          last_verified_at?: string | null
          provider: Database["public"]["Enums"]["sms_provider"]
          settings_json?: Json
          status?: Database["public"]["Enums"]["sms_provider_account_status"]
          updated_at?: string
          username?: string | null
        }
        Update: {
          capabilities_json?: Json
          company_id?: string
          created_at?: string
          credential_ciphertext?: string | null
          credential_hint?: string | null
          display_name?: string
          from_number?: string
          id?: string
          is_default?: boolean
          last_error_message?: string | null
          last_verified_at?: string | null
          provider?: Database["public"]["Enums"]["sms_provider"]
          settings_json?: Json
          status?: Database["public"]["Enums"]["sms_provider_account_status"]
          updated_at?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_provider_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_locations: {
        Row: {
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          location_type: Database["public"]["Enums"]["inventory_location_type"]
          name: string
          notes: string | null
          slug: string
          technician_user_id: string | null
          updated_at: string
          vehicle_label: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          location_type?: Database["public"]["Enums"]["inventory_location_type"]
          name: string
          notes?: string | null
          slug: string
          technician_user_id?: string | null
          updated_at?: string
          vehicle_label?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          location_type?: Database["public"]["Enums"]["inventory_location_type"]
          name?: string
          notes?: string | null
          slug?: string
          technician_user_id?: string | null
          updated_at?: string
          vehicle_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_locations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_locations_technician_user_id_fkey"
            columns: ["technician_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_accounts: {
        Row: {
          company_id: string
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          external_url: string | null
          id: string
          is_active: boolean
          mode: Database["public"]["Enums"]["supplier_account_mode"]
          name: string
          notes: string | null
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          company_id: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          external_url?: string | null
          id?: string
          is_active?: boolean
          mode?: Database["public"]["Enums"]["supplier_account_mode"]
          name: string
          notes?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          external_url?: string | null
          id?: string
          is_active?: boolean
          mode?: Database["public"]["Enums"]["supplier_account_mode"]
          name?: string
          notes?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_cart_lines: {
        Row: {
          availability_text: string | null
          cart_id: string
          company_id: string
          created_at: string
          id: string
          job_id: string
          notes: string | null
          part_request_line_id: string
          provider_quote_line_id: string | null
          quantity: number
          quoted_core_charge_cents: number
          quoted_unit_cost_cents: number | null
          supplier_account_id: string
          supplier_part_number: string | null
          supplier_url: string | null
          updated_at: string
        }
        Insert: {
          availability_text?: string | null
          cart_id: string
          company_id: string
          created_at?: string
          id?: string
          job_id: string
          notes?: string | null
          part_request_line_id: string
          provider_quote_line_id?: string | null
          quantity?: number
          quoted_core_charge_cents?: number
          quoted_unit_cost_cents?: number | null
          supplier_account_id: string
          supplier_part_number?: string | null
          supplier_url?: string | null
          updated_at?: string
        }
        Update: {
          availability_text?: string | null
          cart_id?: string
          company_id?: string
          created_at?: string
          id?: string
          job_id?: string
          notes?: string | null
          part_request_line_id?: string
          provider_quote_line_id?: string | null
          quantity?: number
          quoted_core_charge_cents?: number
          quoted_unit_cost_cents?: number | null
          supplier_account_id?: string
          supplier_part_number?: string | null
          supplier_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_cart_lines_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "supplier_carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_cart_lines_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_cart_lines_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_cart_lines_part_request_line_id_fkey"
            columns: ["part_request_line_id"]
            isOneToOne: false
            referencedRelation: "part_request_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_cart_lines_provider_quote_line_company_fkey"
            columns: ["provider_quote_line_id", "company_id"]
            isOneToOne: false
            referencedRelation: "procurement_provider_quote_lines"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "supplier_cart_lines_provider_quote_line_id_fkey"
            columns: ["provider_quote_line_id"]
            isOneToOne: false
            referencedRelation: "procurement_provider_quote_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_cart_lines_supplier_account_id_fkey"
            columns: ["supplier_account_id"]
            isOneToOne: false
            referencedRelation: "supplier_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_carts: {
        Row: {
          company_id: string
          converted_purchase_order_id: string | null
          created_at: string
          created_by_user_id: string
          id: string
          source_bucket_key: string
          status: Database["public"]["Enums"]["supplier_cart_status"]
          submitted_at: string | null
          submitted_by_user_id: string | null
          supplier_account_id: string
          updated_at: string
        }
        Insert: {
          company_id: string
          converted_purchase_order_id?: string | null
          created_at?: string
          created_by_user_id: string
          id?: string
          source_bucket_key: string
          status?: Database["public"]["Enums"]["supplier_cart_status"]
          submitted_at?: string | null
          submitted_by_user_id?: string | null
          supplier_account_id: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          converted_purchase_order_id?: string | null
          created_at?: string
          created_by_user_id?: string
          id?: string
          source_bucket_key?: string
          status?: Database["public"]["Enums"]["supplier_cart_status"]
          submitted_at?: string | null
          submitted_by_user_id?: string | null
          supplier_account_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_carts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_carts_converted_purchase_order_id_fkey"
            columns: ["converted_purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_carts_supplier_account_id_fkey"
            columns: ["supplier_account_id"]
            isOneToOne: false
            referencedRelation: "supplier_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_routing_rules: {
        Row: {
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          match_has_core: boolean | null
          match_job_priority: string | null
          match_part_term: string | null
          match_vehicle_make: string | null
          name: string
          priority: number
          supplier_account_id: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          match_has_core?: boolean | null
          match_job_priority?: string | null
          match_part_term?: string | null
          match_vehicle_make?: string | null
          name: string
          priority?: number
          supplier_account_id: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          match_has_core?: boolean | null
          match_job_priority?: string | null
          match_part_term?: string | null
          match_vehicle_make?: string | null
          name?: string
          priority?: number
          supplier_account_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_routing_rules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_routing_rules_supplier_account_id_fkey"
            columns: ["supplier_account_id"]
            isOneToOne: false
            referencedRelation: "supplier_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      technician_availability_blocks: {
        Row: {
          block_type: string
          company_id: string
          created_at: string
          created_by_user_id: string
          ends_at: string
          id: string
          is_all_day: boolean
          notes: string | null
          starts_at: string
          technician_user_id: string
          title: string
          updated_at: string
        }
        Insert: {
          block_type: string
          company_id: string
          created_at?: string
          created_by_user_id: string
          ends_at: string
          id?: string
          is_all_day?: boolean
          notes?: string | null
          starts_at: string
          technician_user_id: string
          title: string
          updated_at?: string
        }
        Update: {
          block_type?: string
          company_id?: string
          created_at?: string
          created_by_user_id?: string
          ends_at?: string
          id?: string
          is_all_day?: boolean
          notes?: string | null
          starts_at?: string
          technician_user_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "technician_availability_blocks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      technician_location_pings: {
        Row: {
          accuracy_meters: number | null
          altitude_meters: number | null
          captured_at: string
          company_id: string
          created_at: string
          heading_degrees: number | null
          id: string
          latitude: number
          longitude: number
          source: string
          speed_meters_per_second: number | null
          technician_user_id: string
        }
        Insert: {
          accuracy_meters?: number | null
          altitude_meters?: number | null
          captured_at?: string
          company_id: string
          created_at?: string
          heading_degrees?: number | null
          id?: string
          latitude: number
          longitude: number
          source?: string
          speed_meters_per_second?: number | null
          technician_user_id: string
        }
        Update: {
          accuracy_meters?: number | null
          altitude_meters?: number | null
          captured_at?: string
          company_id?: string
          created_at?: string
          heading_degrees?: number | null
          id?: string
          latitude?: number
          longitude?: number
          source?: string
          speed_meters_per_second?: number | null
          technician_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "technician_location_pings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_carfax_summaries: {
        Row: {
          company_id: string
          created_at: string
          fetched_at: string | null
          id: string
          last_attempted_at: string
          last_error_message: string | null
          next_eligible_refresh_at: string
          status: string
          summary: Json | null
          updated_at: string
          vehicle_id: string
          vin_snapshot: string
        }
        Insert: {
          company_id: string
          created_at?: string
          fetched_at?: string | null
          id?: string
          last_attempted_at?: string
          last_error_message?: string | null
          next_eligible_refresh_at?: string
          status: string
          summary?: Json | null
          updated_at?: string
          vehicle_id: string
          vin_snapshot: string
        }
        Update: {
          company_id?: string
          created_at?: string
          fetched_at?: string | null
          id?: string
          last_attempted_at?: string
          last_error_message?: string | null
          next_eligible_refresh_at?: string
          status?: string
          summary?: Json | null
          updated_at?: string
          vehicle_id?: string
          vin_snapshot?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_carfax_summaries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_carfax_summaries_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: true
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          color: string | null
          company_id: string
          created_at: string
          customer_id: string
          engine: string | null
          id: string
          is_active: boolean
          license_plate: string | null
          license_state: string | null
          make: string
          model: string
          notes: string | null
          odometer: number | null
          ownership_type: Database["public"]["Enums"]["vehicle_ownership_type"]
          trim: string | null
          updated_at: string
          vin: string | null
          year: number | null
        }
        Insert: {
          color?: string | null
          company_id: string
          created_at?: string
          customer_id: string
          engine?: string | null
          id?: string
          is_active?: boolean
          license_plate?: string | null
          license_state?: string | null
          make: string
          model: string
          notes?: string | null
          odometer?: number | null
          ownership_type?: Database["public"]["Enums"]["vehicle_ownership_type"]
          trim?: string | null
          updated_at?: string
          vin?: string | null
          year?: number | null
        }
        Update: {
          color?: string | null
          company_id?: string
          created_at?: string
          customer_id?: string
          engine?: string | null
          id?: string
          is_active?: boolean
          license_plate?: string | null
          license_state?: string | null
          make?: string
          model?: string
          notes?: string | null
          odometer?: number | null
          ownership_type?: Database["public"]["Enums"]["vehicle_ownership_type"]
          trim?: string | null
          updated_at?: string
          vin?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cancel_inventory_transfer: {
        Args: { target_notes?: string; target_transfer_id: string }
        Returns: string
      }
      change_assigned_job_status: {
        Args: {
          change_reason?: string
          next_status: Database["public"]["Enums"]["job_status"]
          target_job_id: string
        }
        Returns: undefined
      }
      change_job_status: {
        Args: {
          change_reason?: string
          next_status: Database["public"]["Enums"]["job_status"]
          target_job_id: string
        }
        Returns: undefined
      }
      complete_assigned_inspection: {
        Args: { target_inspection_id: string }
        Returns: undefined
      }
      consume_inventory_reservation: {
        Args: {
          target_created_by_user_id: string
          target_effective_at?: string
          target_notes?: string
          target_quantity_consumed: number
          target_reservation_id: string
        }
        Returns: string
      }
      consume_job_inventory_issue: {
        Args: {
          target_issue_id: string
          target_notes?: string
          target_quantity_consumed: number
        }
        Returns: string
      }
      create_inspection_for_job: {
        Args: {
          target_company_id: string
          target_items: Json
          target_job_id: string
          target_started_by_user_id: string
          target_template_version: string
        }
        Returns: string
      }
      create_inventory_adjustment: {
        Args: {
          target_company_id: string
          target_created_by_user_id?: string
          target_effective_at?: string
          target_inventory_item_id: string
          target_notes?: string
          target_quantity?: number
          target_stock_location_id: string
          target_transaction_type: Database["public"]["Enums"]["inventory_transaction_type"]
          target_unit_cost_cents?: number
        }
        Returns: string
      }
      create_inventory_cycle_count: {
        Args: {
          target_company_id: string
          target_counted_at?: string
          target_counted_by_user_id: string
          target_lines?: Json
          target_notes?: string
          target_stock_location_id: string
        }
        Returns: string
      }
      create_inventory_transfer: {
        Args: {
          target_company_id: string
          target_from_stock_location_id: string
          target_lines?: Json
          target_notes?: string
          target_reference_number?: string
          target_requested_by_user_id: string
          target_to_stock_location_id: string
        }
        Returns: string
      }
      create_job_inventory_issue: {
        Args: {
          target_company_id: string
          target_inventory_reservation_id: string
          target_issued_at?: string
          target_issued_by_user_id?: string
          target_notes?: string
          target_quantity_issued: number
        }
        Returns: string
      }
      has_company_role: {
        Args: {
          allowed_roles: Database["public"]["Enums"]["app_role"][]
          target_company_id: string
        }
        Returns: boolean
      }
      increment_customer_document_link_view: {
        Args: { target_link_id: string; target_viewed_at?: string }
        Returns: {
          access_token_hash: string
          company_id: string
          completed_at: string | null
          created_at: string
          created_by_user_id: string
          customer_id: string
          document_kind: Database["public"]["Enums"]["customer_document_kind"]
          estimate_id: string | null
          expires_at: string
          first_viewed_at: string | null
          id: string
          invoice_id: string | null
          job_id: string
          last_sent_communication_id: string | null
          last_viewed_at: string | null
          revoked_at: string | null
          revoked_reason: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["customer_document_link_status"]
          updated_at: string
          view_count: number
        }
        SetofOptions: {
          from: "*"
          to: "customer_document_links"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      inventory_available_quantity: {
        Args: {
          target_company_id: string
          target_inventory_item_id: string
          target_stock_location_id: string
        }
        Returns: number
      }
      inventory_on_hand_quantity: {
        Args: {
          target_company_id: string
          target_inventory_item_id: string
          target_stock_location_id: string
        }
        Returns: number
      }
      inventory_reserved_quantity: {
        Args: {
          target_company_id: string
          target_inventory_item_id: string
          target_stock_location_id: string
        }
        Returns: number
      }
      is_assigned_technician_customer: {
        Args: { target_customer_id: string }
        Returns: boolean
      }
      is_assigned_technician_estimate: {
        Args: { target_estimate_id: string }
        Returns: boolean
      }
      is_assigned_technician_inspection: {
        Args: { target_inspection_id: string }
        Returns: boolean
      }
      is_assigned_technician_invoice: {
        Args: { target_invoice_id: string }
        Returns: boolean
      }
      is_assigned_technician_job: {
        Args: { target_job_id: string }
        Returns: boolean
      }
      is_assigned_technician_payment: {
        Args: { target_payment_id: string }
        Returns: boolean
      }
      is_assigned_technician_vehicle: {
        Args: { target_vehicle_id: string }
        Returns: boolean
      }
      is_company_member: {
        Args: { target_company_id: string }
        Returns: boolean
      }
      is_company_owner: {
        Args: { target_company_id: string }
        Returns: boolean
      }
      is_valid_assigned_technician_job_transition: {
        Args: {
          current_status: Database["public"]["Enums"]["job_status"]
          next_status: Database["public"]["Enums"]["job_status"]
        }
        Returns: boolean
      }
      is_valid_estimate_status_transition: {
        Args: {
          current_status: Database["public"]["Enums"]["estimate_status"]
          next_status: Database["public"]["Enums"]["estimate_status"]
        }
        Returns: boolean
      }
      is_valid_invoice_status_transition: {
        Args: {
          current_status: Database["public"]["Enums"]["invoice_status"]
          next_status: Database["public"]["Enums"]["invoice_status"]
        }
        Returns: boolean
      }
      is_valid_job_status_transition: {
        Args: {
          current_status: Database["public"]["Enums"]["job_status"]
          next_status: Database["public"]["Enums"]["job_status"]
        }
        Returns: boolean
      }
      recalculate_invoice_totals: {
        Args: { target_invoice_id: string }
        Returns: undefined
      }
      receive_inventory_transfer: {
        Args: {
          target_lines?: Json
          target_notes?: string
          target_received_at?: string
          target_received_by_user_id?: string
          target_transfer_id: string
        }
        Returns: string
      }
      receive_purchased_inventory: {
        Args: {
          target_company_id: string
          target_created_by_user_id?: string
          target_effective_at?: string
          target_inventory_item_id: string
          target_notes?: string
          target_purchase_order_line_id: string
          target_purchase_receipt_line_id: string
          target_quantity_received?: number
          target_stock_location_id: string
          target_unit_cost_cents?: number
        }
        Returns: string
      }
      record_core_inventory_hold: {
        Args: {
          target_company_id: string
          target_effective_at?: string
          target_held_by_user_id: string
          target_inventory_item_id: string
          target_job_inventory_issue_id?: string
          target_notes?: string
          target_part_request_line_id?: string
          target_purchase_order_line_id?: string
          target_quantity: number
          target_stock_location_id: string
        }
        Returns: string
      }
      record_core_inventory_return: {
        Args: {
          target_core_event_id: string
          target_effective_at?: string
          target_notes?: string
          target_returned_by_user_id: string
        }
        Returns: string
      }
      record_stripe_invoice_payment: {
        Args: {
          target_amount_cents?: number
          target_company_id: string
          target_currency_code?: string
          target_invoice_id: string
          target_job_id: string
          target_paid_at?: string
          target_receipt_url?: string
          target_stripe_charge_id?: string
          target_stripe_checkout_session_id: string
          target_stripe_event_id?: string
          target_stripe_payment_intent_id?: string
        }
        Returns: string
      }
      release_inventory_reservation: {
        Args: {
          target_quantity_released: number
          target_reservation_id: string
        }
        Returns: string
      }
      reserve_inventory_for_job: {
        Args: {
          target_company_id: string
          target_created_by_user_id?: string
          target_inventory_item_id: string
          target_job_id: string
          target_notes?: string
          target_part_request_line_id?: string
          target_quantity_reserved?: number
          target_stock_location_id: string
        }
        Returns: string
      }
      return_job_inventory_issue: {
        Args: {
          target_effective_at?: string
          target_issue_id: string
          target_notes?: string
          target_quantity_returned: number
          target_returned_by_user_id?: string
        }
        Returns: string
      }
      return_purchase_order_line_with_inventory: {
        Args: {
          target_company_id: string
          target_credit_amount_cents?: number
          target_inventory_quantity_returned?: number
          target_is_core_return?: boolean
          target_notes?: string
          target_purchase_order_id: string
          target_purchase_order_line_id: string
          target_quantity_returned?: number
          target_reason?: string
          target_return_number?: string
          target_returned_at?: string
          target_returned_by_user_id: string
          target_supplier_account_id: string
        }
        Returns: string
      }
      ship_inventory_transfer: {
        Args: {
          target_lines?: Json
          target_notes?: string
          target_shipped_at?: string
          target_shipped_by_user_id?: string
          target_transfer_id: string
        }
        Returns: string
      }
      sync_part_request_line_inventory_issue_totals: {
        Args: { target_part_request_line_id: string }
        Returns: undefined
      }
      sync_part_request_line_inventory_stock_coverage: {
        Args: { target_part_request_line_id: string }
        Returns: undefined
      }
      sync_purchase_order_line_core_inventory_totals: {
        Args: { target_purchase_order_line_id: string }
        Returns: undefined
      }
      update_assigned_inspection_item: {
        Args: {
          next_finding_severity?: Database["public"]["Enums"]["finding_severity"]
          next_recommendation?: string
          next_status: Database["public"]["Enums"]["inspection_item_status"]
          next_technician_notes?: string
          target_inspection_item_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "owner" | "admin" | "dispatcher" | "technician"
      attachment_category:
        | "general"
        | "before"
        | "after"
        | "issue"
        | "inspection"
      communication_channel: "email" | "sms"
      communication_event_type:
        | "estimate_notification_requested"
        | "invoice_notification_requested"
        | "payment_reminder_requested"
        | "appointment_confirmation_requested"
        | "dispatch_update_requested"
      communication_status:
        | "queued"
        | "processing"
        | "sent"
        | "delivered"
        | "failed"
        | "canceled"
      communication_trigger_source: "manual" | "workflow" | "system" | "webhook"
      communication_type:
        | "estimate_notification"
        | "invoice_notification"
        | "payment_reminder"
        | "appointment_confirmation"
        | "dispatch_update"
      core_inventory_status: "held" | "returned"
      customer_relationship_type: "retail_customer" | "fleet_account"
      customer_document_event_type:
        | "created"
        | "sent"
        | "viewed"
        | "copied"
        | "approval_started"
        | "approved"
        | "declined"
        | "payment_started"
        | "payment_succeeded"
        | "payment_failed"
        | "expired"
        | "revoked"
      customer_document_kind: "estimate" | "invoice" | "job_visit"
      customer_document_link_status:
        | "active"
        | "expired"
        | "revoked"
        | "completed"
      data_import_run_status:
        | "queued"
        | "processing"
        | "paused"
        | "completed"
        | "failed"
        | "canceled"
      data_import_checkpoint_status:
        | "pending"
        | "processing"
        | "completed"
        | "failed"
      data_import_entity_type:
        | "customer"
        | "customer_address"
        | "vehicle"
        | "order"
        | "estimate"
        | "invoice"
        | "inspection"
        | "attachment"
      dispatch_calendar_scope: "all_workers" | "single_tech" | "subset"
      dispatch_calendar_view: "day" | "week" | "month"
      estimate_section_source: "manual" | "labor_suggestion" | "service_package"
      estimate_status: "draft" | "sent" | "accepted" | "declined" | "void"
      finding_severity: "low" | "medium" | "high" | "critical"
      inspection_item_status: "pass" | "attention" | "fail" | "not_checked"
      inspection_status: "draft" | "in_progress" | "completed"
      inventory_alias_type:
        | "manufacturer_part_number"
        | "supplier_sku"
        | "alternate_sku"
      inventory_item_type: "stocked" | "non_stocked"
      inventory_location_type: "warehouse" | "shop" | "van"
      inventory_reorder_status: "ok" | "low_stock" | "reorder_due"
      inventory_transaction_source_type:
        | "manual"
        | "purchase_receipt"
        | "purchase_return"
        | "part_request"
        | "job"
        | "inventory_count"
        | "transfer"
        | "job_issue"
        | "job_return"
        | "cycle_count"
        | "core_event"
      inventory_transaction_type:
        | "adjustment_in"
        | "adjustment_out"
        | "purchase_receipt"
        | "purchase_return"
        | "reservation_in"
        | "reservation_out"
        | "consumption"
        | "release"
        | "transfer_in"
        | "transfer_out"
        | "job_issue"
        | "job_return"
        | "cycle_count_gain"
        | "cycle_count_loss"
        | "core_hold_in"
        | "core_hold_out"
        | "core_return_out"
      inventory_transfer_status:
        | "draft"
        | "in_transit"
        | "received"
        | "canceled"
      invoice_status: "draft" | "issued" | "partially_paid" | "paid" | "void"
      job_inventory_issue_status:
        | "issued"
        | "partially_returned"
        | "returned"
        | "consumed"
      job_status:
        | "new"
        | "scheduled"
        | "dispatched"
        | "en_route"
        | "arrived"
        | "diagnosing"
        | "waiting_approval"
        | "waiting_parts"
        | "repairing"
        | "ready_for_payment"
        | "in_progress"
        | "completed"
        | "canceled"
      migration_source_account_status:
        | "connected"
        | "action_required"
        | "error"
        | "disconnected"
      migration_source_provider: "shopmonkey"
      part_lifecycle_status:
        | "quoted"
        | "ordered"
        | "received"
        | "installed"
        | "returned"
        | "core_due"
        | "core_returned"
      part_request_origin: "job_detail" | "estimate_editor"
      part_request_status: "open" | "fulfilled" | "canceled"
      part_return_status: "draft" | "submitted" | "completed" | "canceled"
      payment_status: "succeeded" | "failed"
      procurement_provider: "partstech" | "repairlink" | "amazon_business"
      procurement_provider_account_status:
        | "connected"
        | "action_required"
        | "error"
        | "disconnected"
      sms_provider: "twilio" | "telnyx"
      sms_provider_account_status:
        | "connected"
        | "action_required"
        | "error"
        | "disconnected"
      procurement_provider_order_status:
        | "draft"
        | "submitted"
        | "accepted"
        | "manual_required"
        | "failed"
        | "canceled"
      procurement_provider_quote_status:
        | "draft"
        | "priced"
        | "selected"
        | "converted"
        | "manual_required"
        | "expired"
        | "failed"
      procurement_provider_supplier_mapping_status:
        | "active"
        | "pending_approval"
        | "unmapped"
        | "disabled"
      purchase_order_status:
        | "draft"
        | "ordered"
        | "partially_received"
        | "received"
        | "canceled"
        | "closed"
      supplier_account_mode: "manual" | "link_out"
      supplier_cart_status: "open" | "submitted" | "converted" | "abandoned"
      vehicle_ownership_type: "customer_owned" | "fleet_account_asset"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  storage: {
    Tables: {
      buckets: {
        Row: {
          allowed_mime_types: string[] | null
          avif_autodetection: boolean | null
          created_at: string | null
          file_size_limit: number | null
          id: string
          name: string
          owner: string | null
          owner_id: string | null
          public: boolean | null
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string | null
        }
        Insert: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id: string
          name: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
        }
        Update: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id?: string
          name?: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
        }
        Relationships: []
      }
      buckets_analytics: {
        Row: {
          created_at: string
          deleted_at: string | null
          format: string
          id: string
          name: string
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          format?: string
          id?: string
          name: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          format?: string
          id?: string
          name?: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Relationships: []
      }
      buckets_vectors: {
        Row: {
          created_at: string
          id: string
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Relationships: []
      }
      iceberg_namespaces: {
        Row: {
          bucket_name: string
          catalog_id: string
          created_at: string
          id: string
          metadata: Json
          name: string
          updated_at: string
        }
        Insert: {
          bucket_name: string
          catalog_id: string
          created_at?: string
          id?: string
          metadata?: Json
          name: string
          updated_at?: string
        }
        Update: {
          bucket_name?: string
          catalog_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "iceberg_namespaces_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "buckets_analytics"
            referencedColumns: ["id"]
          },
        ]
      }
      iceberg_tables: {
        Row: {
          bucket_name: string
          catalog_id: string
          created_at: string
          id: string
          location: string
          name: string
          namespace_id: string
          remote_table_id: string | null
          shard_id: string | null
          shard_key: string | null
          updated_at: string
        }
        Insert: {
          bucket_name: string
          catalog_id: string
          created_at?: string
          id?: string
          location: string
          name: string
          namespace_id: string
          remote_table_id?: string | null
          shard_id?: string | null
          shard_key?: string | null
          updated_at?: string
        }
        Update: {
          bucket_name?: string
          catalog_id?: string
          created_at?: string
          id?: string
          location?: string
          name?: string
          namespace_id?: string
          remote_table_id?: string | null
          shard_id?: string | null
          shard_key?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "iceberg_tables_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "buckets_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "iceberg_tables_namespace_id_fkey"
            columns: ["namespace_id"]
            isOneToOne: false
            referencedRelation: "iceberg_namespaces"
            referencedColumns: ["id"]
          },
        ]
      }
      migrations: {
        Row: {
          executed_at: string | null
          hash: string
          id: number
          name: string
        }
        Insert: {
          executed_at?: string | null
          hash: string
          id: number
          name: string
        }
        Update: {
          executed_at?: string | null
          hash?: string
          id?: number
          name?: string
        }
        Relationships: []
      }
      objects: {
        Row: {
          bucket_id: string | null
          created_at: string | null
          id: string
          last_accessed_at: string | null
          metadata: Json | null
          name: string | null
          owner: string | null
          owner_id: string | null
          path_tokens: string[] | null
          updated_at: string | null
          user_metadata: Json | null
          version: string | null
        }
        Insert: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Update: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "objects_bucketId_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads: {
        Row: {
          bucket_id: string
          created_at: string
          id: string
          in_progress_size: number
          key: string
          owner_id: string | null
          upload_signature: string
          user_metadata: Json | null
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          id: string
          in_progress_size?: number
          key: string
          owner_id?: string | null
          upload_signature: string
          user_metadata?: Json | null
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          id?: string
          in_progress_size?: number
          key?: string
          owner_id?: string | null
          upload_signature?: string
          user_metadata?: Json | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads_parts: {
        Row: {
          bucket_id: string
          created_at: string
          etag: string
          id: string
          key: string
          owner_id: string | null
          part_number: number
          size: number
          upload_id: string
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          etag: string
          id?: string
          key: string
          owner_id?: string | null
          part_number: number
          size?: number
          upload_id: string
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          etag?: string
          id?: string
          key?: string
          owner_id?: string | null
          part_number?: number
          size?: number
          upload_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_parts_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "s3_multipart_uploads_parts_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "s3_multipart_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      vector_indexes: {
        Row: {
          bucket_id: string
          created_at: string
          data_type: string
          dimension: number
          distance_metric: string
          id: string
          metadata_configuration: Json | null
          name: string
          updated_at: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          data_type: string
          dimension: number
          distance_metric: string
          id?: string
          metadata_configuration?: Json | null
          name: string
          updated_at?: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          data_type?: string
          dimension?: number
          distance_metric?: string
          id?: string
          metadata_configuration?: Json | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vector_indexes_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets_vectors"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_insert_object: {
        Args: { bucketid: string; metadata: Json; name: string; owner: string }
        Returns: undefined
      }
      extension: { Args: { name: string }; Returns: string }
      filename: { Args: { name: string }; Returns: string }
      foldername: { Args: { name: string }; Returns: string[] }
      get_common_prefix: {
        Args: { p_delimiter: string; p_key: string; p_prefix: string }
        Returns: string
      }
      get_size_by_bucket: {
        Args: never
        Returns: {
          bucket_id: string
          size: number
        }[]
      }
      list_multipart_uploads_with_delimiter: {
        Args: {
          bucket_id: string
          delimiter_param: string
          max_keys?: number
          next_key_token?: string
          next_upload_token?: string
          prefix_param: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
        }[]
      }
      list_objects_with_delimiter: {
        Args: {
          _bucket_id: string
          delimiter_param: string
          max_keys?: number
          next_token?: string
          prefix_param: string
          sort_order?: string
          start_after?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      operation: { Args: never; Returns: string }
      search: {
        Args: {
          bucketname: string
          levels?: number
          limits?: number
          offsets?: number
          prefix: string
          search?: string
          sortcolumn?: string
          sortorder?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_by_timestamp: {
        Args: {
          p_bucket_id: string
          p_level: number
          p_limit: number
          p_prefix: string
          p_sort_column: string
          p_sort_column_after: string
          p_sort_order: string
          p_start_after: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_v2: {
        Args: {
          bucket_name: string
          levels?: number
          limits?: number
          prefix: string
          sort_column?: string
          sort_column_after?: string
          sort_order?: string
          start_after?: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
    }
    Enums: {
      buckettype: "STANDARD" | "ANALYTICS" | "VECTOR"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["owner", "admin", "dispatcher", "technician"],
      attachment_category: [
        "general",
        "before",
        "after",
        "issue",
        "inspection",
      ],
      communication_channel: ["email", "sms"],
      communication_event_type: [
        "estimate_notification_requested",
        "invoice_notification_requested",
        "payment_reminder_requested",
        "appointment_confirmation_requested",
        "dispatch_update_requested",
      ],
      communication_status: [
        "queued",
        "processing",
        "sent",
        "delivered",
        "failed",
        "canceled",
      ],
      communication_trigger_source: ["manual", "workflow", "system", "webhook"],
      communication_type: [
        "estimate_notification",
        "invoice_notification",
        "payment_reminder",
        "appointment_confirmation",
        "dispatch_update",
      ],
      core_inventory_status: ["held", "returned"],
      customer_relationship_type: ["retail_customer", "fleet_account"],
      customer_document_event_type: [
        "created",
        "sent",
        "viewed",
        "copied",
        "approval_started",
        "approved",
        "declined",
        "payment_started",
        "payment_succeeded",
        "payment_failed",
        "expired",
        "revoked",
      ],
      customer_document_kind: ["estimate", "invoice", "job_visit"],
      customer_document_link_status: [
        "active",
        "expired",
        "revoked",
        "completed",
      ],
      data_import_run_status: [
        "queued",
        "processing",
        "paused",
        "completed",
        "failed",
        "canceled",
      ],
      data_import_checkpoint_status: [
        "pending",
        "processing",
        "completed",
        "failed",
      ],
      data_import_entity_type: [
        "customer",
        "customer_address",
        "vehicle",
        "order",
        "estimate",
        "invoice",
        "inspection",
        "attachment",
      ],
      dispatch_calendar_scope: ["all_workers", "single_tech", "subset"],
      dispatch_calendar_view: ["day", "week", "month"],
      estimate_section_source: [
        "manual",
        "labor_suggestion",
        "service_package",
      ],
      estimate_status: ["draft", "sent", "accepted", "declined", "void"],
      finding_severity: ["low", "medium", "high", "critical"],
      inspection_item_status: ["pass", "attention", "fail", "not_checked"],
      inspection_status: ["draft", "in_progress", "completed"],
      inventory_alias_type: [
        "manufacturer_part_number",
        "supplier_sku",
        "alternate_sku",
      ],
      inventory_item_type: ["stocked", "non_stocked"],
      inventory_location_type: ["warehouse", "shop", "van"],
      inventory_reorder_status: ["ok", "low_stock", "reorder_due"],
      inventory_transaction_source_type: [
        "manual",
        "purchase_receipt",
        "purchase_return",
        "part_request",
        "job",
        "inventory_count",
        "transfer",
        "job_issue",
        "job_return",
        "cycle_count",
        "core_event",
      ],
      inventory_transaction_type: [
        "adjustment_in",
        "adjustment_out",
        "purchase_receipt",
        "purchase_return",
        "reservation_in",
        "reservation_out",
        "consumption",
        "release",
        "transfer_in",
        "transfer_out",
        "job_issue",
        "job_return",
        "cycle_count_gain",
        "cycle_count_loss",
        "core_hold_in",
        "core_hold_out",
        "core_return_out",
      ],
      inventory_transfer_status: [
        "draft",
        "in_transit",
        "received",
        "canceled",
      ],
      invoice_status: ["draft", "issued", "partially_paid", "paid", "void"],
      job_inventory_issue_status: [
        "issued",
        "partially_returned",
        "returned",
        "consumed",
      ],
      job_status: [
        "new",
        "scheduled",
        "dispatched",
        "en_route",
        "arrived",
        "diagnosing",
        "waiting_approval",
        "waiting_parts",
        "repairing",
        "ready_for_payment",
        "in_progress",
        "completed",
        "canceled",
      ],
      migration_source_account_status: [
        "connected",
        "action_required",
        "error",
        "disconnected",
      ],
      migration_source_provider: ["shopmonkey"],
      part_lifecycle_status: [
        "quoted",
        "ordered",
        "received",
        "installed",
        "returned",
        "core_due",
        "core_returned",
      ],
      part_request_origin: ["job_detail", "estimate_editor"],
      part_request_status: ["open", "fulfilled", "canceled"],
      part_return_status: ["draft", "submitted", "completed", "canceled"],
      payment_status: ["succeeded", "failed"],
      procurement_provider: ["partstech", "repairlink", "amazon_business"],
      procurement_provider_account_status: [
        "connected",
        "action_required",
        "error",
        "disconnected",
      ],
      sms_provider: ["twilio", "telnyx"],
      sms_provider_account_status: [
        "connected",
        "action_required",
        "error",
        "disconnected",
      ],
      procurement_provider_order_status: [
        "draft",
        "submitted",
        "accepted",
        "manual_required",
        "failed",
        "canceled",
      ],
      procurement_provider_quote_status: [
        "draft",
        "priced",
        "selected",
        "converted",
        "manual_required",
        "expired",
        "failed",
      ],
      procurement_provider_supplier_mapping_status: [
        "active",
        "pending_approval",
        "unmapped",
        "disabled",
      ],
      purchase_order_status: [
        "draft",
        "ordered",
        "partially_received",
        "received",
        "canceled",
        "closed",
      ],
      supplier_account_mode: ["manual", "link_out"],
      supplier_cart_status: ["open", "submitted", "converted", "abandoned"],
      vehicle_ownership_type: ["customer_owned", "fleet_account_asset"],
    },
  },
  storage: {
    Enums: {
      buckettype: ["STANDARD", "ANALYTICS", "VECTOR"],
    },
  },
} as const
