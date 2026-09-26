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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      expected_results: {
        Row: {
          created_at: string
          id: string
          order_index: number
          result: string
          test_step_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_index?: number
          result: string
          test_step_id: string
        }
        Update: {
          created_at?: string
          id?: string
          order_index?: number
          result?: string
          test_step_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expected_results_test_step_id_fkey"
            columns: ["test_step_id"]
            isOneToOne: false
            referencedRelation: "test_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      preconditions: {
        Row: {
          condition: string
          created_at: string
          id: string
          order_index: number
          test_case_id: string
        }
        Insert: {
          condition: string
          created_at?: string
          id?: string
          order_index?: number
          test_case_id: string
        }
        Update: {
          condition?: string
          created_at?: string
          id?: string
          order_index?: number
          test_case_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "preconditions_test_case_id_fkey"
            columns: ["test_case_id"]
            isOneToOne: false
            referencedRelation: "test_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          created_at?: string
          full_name?: string
          id: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: []
      }
      sections: {
        Row: {
          created_at: string
          id: string
          name: string
          order_index: number
          slug: string
          test_suite_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          order_index?: number
          slug: string
          test_suite_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          order_index?: number
          slug?: string
          test_suite_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sections_epic_id_fkey"
            columns: ["test_suite_id"]
            isOneToOne: false
            referencedRelation: "testing_suites"
            referencedColumns: ["id"]
          },
        ]
      }
      suite_sign_offs: {
        Row: {
          exceptions: Json
          id: string
          iteration_id: string
          note: string | null
          revoked_at: string | null
          revoked_by: string | null
          signed_off_at: string
          signed_off_by: string | null
          testing_suite_id: string
        }
        Insert: {
          exceptions?: Json
          id?: string
          iteration_id: string
          note?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          signed_off_at?: string
          signed_off_by?: string | null
          testing_suite_id: string
        }
        Update: {
          exceptions?: Json
          id?: string
          iteration_id?: string
          note?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          signed_off_at?: string
          signed_off_by?: string | null
          testing_suite_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "suite_sign_offs_iteration_id_fkey"
            columns: ["iteration_id"]
            isOneToOne: false
            referencedRelation: "test_iterations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suite_sign_offs_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suite_sign_offs_signed_off_by_fkey"
            columns: ["signed_off_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suite_sign_offs_testing_suite_id_fkey"
            columns: ["testing_suite_id"]
            isOneToOne: false
            referencedRelation: "testing_suites"
            referencedColumns: ["id"]
          },
        ]
      }
      test_case_result_archives: {
        Row: {
          archived_at: string
          archived_by: string | null
          id: string
          iteration_id: string
          reason: string
          snapshot: Json
          test_case_result_id: string
        }
        Insert: {
          archived_at?: string
          archived_by?: string | null
          id?: string
          iteration_id: string
          reason: string
          snapshot: Json
          test_case_result_id: string
        }
        Update: {
          archived_at?: string
          archived_by?: string | null
          id?: string
          iteration_id?: string
          reason?: string
          snapshot?: Json
          test_case_result_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_case_result_archives_archived_by_fkey"
            columns: ["archived_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_case_result_archives_iteration_id_fkey"
            columns: ["iteration_id"]
            isOneToOne: false
            referencedRelation: "test_iterations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_case_result_archives_test_case_result_id_fkey"
            columns: ["test_case_result_id"]
            isOneToOne: false
            referencedRelation: "test_case_results"
            referencedColumns: ["id"]
          },
        ]
      }
      test_case_results: {
        Row: {
          code: string | null
          completed_at: string | null
          executed_by: string | null
          id: string
          included_in_run: boolean
          iteration_id: string
          order_index: number
          preconditions: Json
          priority: Database["public"]["Enums"]["priority_level"] | null
          role_assignee:
            | Database["public"]["Enums"]["role_assignee_type"]
            | null
          section_name: string | null
          section_order: number
          section_slug: string | null
          source_hash: string | null
          status: Database["public"]["Enums"]["test_case_status"]
          status_overridden: boolean
          sync_kind: string | null
          synced_at: string | null
          synced_by: string | null
          test_case_id: string | null
          title: string
        }
        Insert: {
          code?: string | null
          completed_at?: string | null
          executed_by?: string | null
          id?: string
          included_in_run?: boolean
          iteration_id: string
          order_index?: number
          preconditions?: Json
          priority?: Database["public"]["Enums"]["priority_level"] | null
          role_assignee?:
            | Database["public"]["Enums"]["role_assignee_type"]
            | null
          section_name?: string | null
          section_order?: number
          section_slug?: string | null
          source_hash?: string | null
          status?: Database["public"]["Enums"]["test_case_status"]
          status_overridden?: boolean
          sync_kind?: string | null
          synced_at?: string | null
          synced_by?: string | null
          test_case_id?: string | null
          title: string
        }
        Update: {
          code?: string | null
          completed_at?: string | null
          executed_by?: string | null
          id?: string
          included_in_run?: boolean
          iteration_id?: string
          order_index?: number
          preconditions?: Json
          priority?: Database["public"]["Enums"]["priority_level"] | null
          role_assignee?:
            | Database["public"]["Enums"]["role_assignee_type"]
            | null
          section_name?: string | null
          section_order?: number
          section_slug?: string | null
          source_hash?: string | null
          status?: Database["public"]["Enums"]["test_case_status"]
          status_overridden?: boolean
          sync_kind?: string | null
          synced_at?: string | null
          synced_by?: string | null
          test_case_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_case_results_executed_by_fkey"
            columns: ["executed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_case_results_iteration_id_fkey"
            columns: ["iteration_id"]
            isOneToOne: false
            referencedRelation: "test_iterations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_case_results_synced_by_fkey"
            columns: ["synced_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_case_results_test_case_id_fkey"
            columns: ["test_case_id"]
            isOneToOne: false
            referencedRelation: "test_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      test_cases: {
        Row: {
          code: string | null
          created_at: string
          created_by: string | null
          description: string
          id: string
          lifecycle_status: Database["public"]["Enums"]["test_case_lifecycle"]
          order_index: number
          priority: Database["public"]["Enums"]["priority_level"]
          role_assignee:
            | Database["public"]["Enums"]["role_assignee_type"]
            | null
          section_id: string
          status: Database["public"]["Enums"]["test_case_status"]
          title: string
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          lifecycle_status?: Database["public"]["Enums"]["test_case_lifecycle"]
          order_index?: number
          priority?: Database["public"]["Enums"]["priority_level"]
          role_assignee?:
            | Database["public"]["Enums"]["role_assignee_type"]
            | null
          section_id: string
          status?: Database["public"]["Enums"]["test_case_status"]
          title: string
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          lifecycle_status?: Database["public"]["Enums"]["test_case_lifecycle"]
          order_index?: number
          priority?: Database["public"]["Enums"]["priority_level"]
          role_assignee?:
            | Database["public"]["Enums"]["role_assignee_type"]
            | null
          section_id?: string
          status?: Database["public"]["Enums"]["test_case_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_cases_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_cases_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
        ]
      }
      test_executions: {
        Row: {
          cycle_label: string
          defect_remarks: string
          executed_at: string
          executed_by: string | null
          id: string
          status: Database["public"]["Enums"]["execution_status"]
          test_case_id: string
        }
        Insert: {
          cycle_label?: string
          defect_remarks?: string
          executed_at?: string
          executed_by?: string | null
          id?: string
          status?: Database["public"]["Enums"]["execution_status"]
          test_case_id: string
        }
        Update: {
          cycle_label?: string
          defect_remarks?: string
          executed_at?: string
          executed_by?: string | null
          id?: string
          status?: Database["public"]["Enums"]["execution_status"]
          test_case_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_executions_executed_by_fkey"
            columns: ["executed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_executions_test_case_id_fkey"
            columns: ["test_case_id"]
            isOneToOne: false
            referencedRelation: "test_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      test_iterations: {
        Row: {
          completed_at: string | null
          created_by: string | null
          id: string
          iteration_number: number
          label: string | null
          name: string
          planned_end_date: string | null
          slug: string
          started_at: string
          status: Database["public"]["Enums"]["iteration_status"]
          testing_suite_id: string
        }
        Insert: {
          completed_at?: string | null
          created_by?: string | null
          id?: string
          iteration_number: number
          label?: string | null
          name: string
          planned_end_date?: string | null
          slug: string
          started_at?: string
          status?: Database["public"]["Enums"]["iteration_status"]
          testing_suite_id: string
        }
        Update: {
          completed_at?: string | null
          created_by?: string | null
          id?: string
          iteration_number?: number
          label?: string | null
          name?: string
          planned_end_date?: string | null
          slug?: string
          started_at?: string
          status?: Database["public"]["Enums"]["iteration_status"]
          testing_suite_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_iterations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_iterations_testing_suite_id_fkey"
            columns: ["testing_suite_id"]
            isOneToOne: false
            referencedRelation: "testing_suites"
            referencedColumns: ["id"]
          },
        ]
      }
      test_remarks: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          remark: string
          test_step_id: string | null
          test_step_result_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          remark: string
          test_step_id?: string | null
          test_step_result_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          remark?: string
          test_step_id?: string | null
          test_step_result_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "test_remarks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_remarks_test_step_id_fkey"
            columns: ["test_step_id"]
            isOneToOne: false
            referencedRelation: "test_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_remarks_test_step_result_id_fkey"
            columns: ["test_step_result_id"]
            isOneToOne: false
            referencedRelation: "test_step_results"
            referencedColumns: ["id"]
          },
        ]
      }
      test_step_results: {
        Row: {
          expected_results: Json
          id: string
          order_index: number
          status: Database["public"]["Enums"]["test_step_status"]
          step: string
          test_case_result_id: string
          test_step_id: string | null
        }
        Insert: {
          expected_results?: Json
          id?: string
          order_index?: number
          status?: Database["public"]["Enums"]["test_step_status"]
          step: string
          test_case_result_id: string
          test_step_id?: string | null
        }
        Update: {
          expected_results?: Json
          id?: string
          order_index?: number
          status?: Database["public"]["Enums"]["test_step_status"]
          step?: string
          test_case_result_id?: string
          test_step_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "test_step_results_test_case_result_id_fkey"
            columns: ["test_case_result_id"]
            isOneToOne: false
            referencedRelation: "test_case_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_step_results_test_step_id_fkey"
            columns: ["test_step_id"]
            isOneToOne: false
            referencedRelation: "test_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      test_steps: {
        Row: {
          created_at: string
          id: string
          order_index: number
          status: Database["public"]["Enums"]["test_step_status"] | null
          step: string
          test_case_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_index?: number
          status?: Database["public"]["Enums"]["test_step_status"] | null
          step: string
          test_case_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          order_index?: number
          status?: Database["public"]["Enums"]["test_step_status"] | null
          step?: string
          test_case_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_steps_test_case_id_fkey"
            columns: ["test_case_id"]
            isOneToOne: false
            referencedRelation: "test_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      testing_suites: {
        Row: {
          code: string | null
          created_at: string
          created_by: string | null
          description: string
          id: string
          name: string
          slug: string
          status: Database["public"]["Enums"]["suite_status"]
        }
        Insert: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          name: string
          slug: string
          status?: Database["public"]["Enums"]["suite_status"]
        }
        Update: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          name?: string
          slug?: string
          status?: Database["public"]["Enums"]["suite_status"]
        }
        Relationships: [
          {
            foreignKeyName: "epics_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_derived_case_status: {
        Args: { p_case_result_id: string }
        Returns: undefined
      }
      apply_iteration_sync: {
        Args: {
          p_add?: string[]
          p_by?: string
          p_iteration_id: string
          p_refresh?: string[]
          p_remove?: string[]
        }
        Returns: undefined
      }
      assert_can: { Args: { p_action: string }; Returns: undefined }
      assert_suite_editable: {
        Args: { p_suite_id: string }
        Returns: Database["public"]["Enums"]["suite_status"]
      }
      assert_suite_readiness: {
        Args: { p_suite_id: string }
        Returns: undefined
      }
      cancel_iteration: { Args: { p_iteration_id: string }; Returns: undefined }
      case_preconditions_json: {
        Args: { p_test_case_id: string }
        Returns: Json
      }
      case_result_has_results: {
        Args: { p_case_result_id: string }
        Returns: boolean
      }
      complete_iteration: {
        Args: { p_iteration_id: string }
        Returns: {
          completed_at: string | null
          created_by: string | null
          id: string
          iteration_number: number
          label: string | null
          name: string
          planned_end_date: string | null
          slug: string
          started_at: string
          status: Database["public"]["Enums"]["iteration_status"]
          testing_suite_id: string
        }
        SetofOptions: {
          from: "*"
          to: "test_iterations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      delete_section: { Args: { p_section_id: string }; Returns: undefined }
      delete_suite: { Args: { p_suite_id: string }; Returns: undefined }
      delete_test_case: { Args: { p_test_case_id: string }; Returns: undefined }
      delete_test_case_rows: {
        Args: { p_test_case_id: string }
        Returns: undefined
      }
      force_refresh_case_result: {
        Args: { p_by?: string; p_case_result_id: string; p_reason?: string }
        Returns: undefined
      }
      generate_test_case_code: { Args: { p_epic_id: string }; Returns: string }
      get_iteration_changes: {
        Args: { p_iteration_id: string }
        Returns: {
          change: string
          code: string
          has_results: boolean
          test_case_id: string
          test_case_result_id: string
          title: string
        }[]
      }
      is_internal: { Args: never; Returns: boolean }
      recompute_case_result_status: {
        Args: { p_case_result_id: string }
        Returns: undefined
      }
      refresh_case_result: {
        Args: { p_case_result_id: string }
        Returns: undefined
      }
      refresh_case_result_internal: {
        Args: { p_case_result_id: string }
        Returns: undefined
      }
      remove_case_result: {
        Args: { p_case_result_id: string }
        Returns: undefined
      }
      reorder_sections: {
        Args: { p_section_ids: string[]; p_suite_id: string }
        Returns: undefined
      }
      reorder_test_cases: {
        Args: { p_section_id: string; p_test_case_ids: string[] }
        Returns: undefined
      }
      save_test_case: { Args: { p_payload: Json }; Returns: string }
      set_suite_status: {
        Args: {
          p_status: Database["public"]["Enums"]["suite_status"]
          p_suite_id: string
        }
        Returns: {
          code: string | null
          created_at: string
          created_by: string | null
          description: string
          id: string
          name: string
          slug: string
          status: Database["public"]["Enums"]["suite_status"]
        }
        SetofOptions: {
          from: "*"
          to: "testing_suites"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      sign_off_suite: {
        Args: { p_by?: string; p_note?: string; p_suite_id: string }
        Returns: {
          exceptions: Json
          id: string
          iteration_id: string
          note: string | null
          revoked_at: string | null
          revoked_by: string | null
          signed_off_at: string
          signed_off_by: string | null
          testing_suite_id: string
        }
        SetofOptions: {
          from: "*"
          to: "suite_sign_offs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      slugify: { Args: { p_text: string }; Returns: string }
      start_iteration: {
        Args: {
          p_created_by?: string
          p_label?: string
          p_planned_end_date?: string
          p_suite_id: string
          p_test_case_ids?: string[]
        }
        Returns: {
          completed_at: string | null
          created_by: string | null
          id: string
          iteration_number: number
          label: string | null
          name: string
          planned_end_date: string | null
          slug: string
          started_at: string
          status: Database["public"]["Enums"]["iteration_status"]
          testing_suite_id: string
        }
        SetofOptions: {
          from: "*"
          to: "test_iterations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      step_expected_results_json: {
        Args: { p_test_step_id: string }
        Returns: Json
      }
      suite_readiness_issues: {
        Args: { p_suite_id: string }
        Returns: {
          code: string
          issue: string
          test_case_id: string
          title: string
        }[]
      }
      suite_test_case_issues: {
        Args: { p_suite_id: string }
        Returns: {
          code: string
          issue: string
          test_case_id: string
          title: string
        }[]
      }
      sync_iteration: {
        Args: { p_iteration_id: string; p_test_case_ids?: string[] }
        Returns: undefined
      }
      test_case_content_hash: {
        Args: { p_test_case_id: string }
        Returns: string
      }
      test_case_issues: { Args: { p_test_case_id: string }; Returns: string[] }
      update_iteration_details: {
        Args: {
          p_iteration_id: string
          p_label?: string
          p_planned_end_date?: string
        }
        Returns: {
          completed_at: string | null
          created_by: string | null
          id: string
          iteration_number: number
          label: string | null
          name: string
          planned_end_date: string | null
          slug: string
          started_at: string
          status: Database["public"]["Enums"]["iteration_status"]
          testing_suite_id: string
        }
        SetofOptions: {
          from: "*"
          to: "test_iterations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      upsert_section: {
        Args: {
          p_id?: string
          p_name?: string
          p_slug?: string
          p_suite_id: string
        }
        Returns: {
          created_at: string
          id: string
          name: string
          order_index: number
          slug: string
          test_suite_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "sections"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      upsert_suite: {
        Args: {
          p_by?: string
          p_code?: string
          p_description?: string
          p_id?: string
          p_name?: string
          p_slug?: string
        }
        Returns: {
          code: string | null
          created_at: string
          created_by: string | null
          description: string
          id: string
          name: string
          slug: string
          status: Database["public"]["Enums"]["suite_status"]
        }
        SetofOptions: {
          from: "*"
          to: "testing_suites"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      execution_status: "not_run" | "passed" | "skipped" | "failed"
      iteration_status: "in_progress" | "completed"
      priority_level: "low" | "medium" | "high"
      role_assignee_type:
        | "Kora-Admin"
        | "Kora-Workflow"
        | "Action-Officer"
        | "Supervisor"
        | "Division-Manager"
        | "Deputy-Commissioner"
        | "Insurance Commissioner"
        | "Company Admin"
      suite_status: "draft" | "ready" | "in_testing" | "signed_off" | "archived"
      test_case_lifecycle: "new" | "updated"
      test_case_status:
        | "Untested"
        | "In Progress"
        | "Passed"
        | "Failed"
        | "Blocked"
      test_step_status: "Untested" | "Passed" | "Failed" | "Skipped" | "Blocked"
      user_role: "Internal" | "External"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      execution_status: ["not_run", "passed", "skipped", "failed"],
      iteration_status: ["in_progress", "completed"],
      priority_level: ["low", "medium", "high"],
      role_assignee_type: [
        "Kora-Admin",
        "Kora-Workflow",
        "Action-Officer",
        "Supervisor",
        "Division-Manager",
        "Deputy-Commissioner",
        "Insurance Commissioner",
        "Company Admin",
      ],
      suite_status: ["draft", "ready", "in_testing", "signed_off", "archived"],
      test_case_lifecycle: ["new", "updated"],
      test_case_status: [
        "Untested",
        "In Progress",
        "Passed",
        "Failed",
        "Blocked",
      ],
      test_step_status: ["Untested", "Passed", "Failed", "Skipped", "Blocked"],
      user_role: ["Internal", "External"],
    },
  },
} as const
