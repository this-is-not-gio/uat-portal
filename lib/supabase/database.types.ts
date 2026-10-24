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
      attachments: {
        Row: {
          content_type: string
          created_at: string
          file_name: string
          id: string
          kind: Database["public"]["Enums"]["attachment_kind"]
          object_key: string
          remark_id: string | null
          size_bytes: number
          status: Database["public"]["Enums"]["attachment_status"]
          test_case_result_id: string | null
          test_step_result_id: string | null
          uploaded_by: string
        }
        Insert: {
          content_type: string
          created_at?: string
          file_name: string
          id?: string
          kind: Database["public"]["Enums"]["attachment_kind"]
          object_key: string
          remark_id?: string | null
          size_bytes: number
          status?: Database["public"]["Enums"]["attachment_status"]
          test_case_result_id?: string | null
          test_step_result_id?: string | null
          uploaded_by: string
        }
        Update: {
          content_type?: string
          created_at?: string
          file_name?: string
          id?: string
          kind?: Database["public"]["Enums"]["attachment_kind"]
          object_key?: string
          remark_id?: string | null
          size_bytes?: number
          status?: Database["public"]["Enums"]["attachment_status"]
          test_step_result_id?: string | null
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "attachments_test_case_result_id_fkey"
            columns: ["test_case_result_id"]
            isOneToOne: false
            referencedRelation: "test_case_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_remark_id_fkey"
            columns: ["remark_id"]
            isOneToOne: false
            referencedRelation: "test_remarks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_test_step_result_id_fkey"
            columns: ["test_step_result_id"]
            isOneToOne: false
            referencedRelation: "test_step_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
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
      iteration_excluded_testers: {
        Row: {
          iteration_id: string
          user_id: string
        }
        Insert: {
          iteration_id: string
          user_id: string
        }
        Update: {
          iteration_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "iteration_excluded_testers_iteration_id_fkey"
            columns: ["iteration_id"]
            isOneToOne: false
            referencedRelation: "test_iterations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "iteration_excluded_testers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      iteration_testers: {
        Row: {
          created_at: string
          iteration_id: string
          organization_id: string
          status: string
          submitted_at: string | null
          test_role_id: string
          user_id: string
          withdrawn_at: string | null
        }
        Insert: {
          created_at?: string
          iteration_id: string
          organization_id: string
          status?: string
          submitted_at?: string | null
          test_role_id: string
          user_id: string
          withdrawn_at?: string | null
        }
        Update: {
          created_at?: string
          iteration_id?: string
          organization_id?: string
          status?: string
          submitted_at?: string | null
          test_role_id?: string
          user_id?: string
          withdrawn_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "iteration_testers_iteration_id_fkey"
            columns: ["iteration_id"]
            isOneToOne: false
            referencedRelation: "test_iterations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "iteration_testers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "iteration_testers_test_role_id_fkey"
            columns: ["test_role_id"]
            isOneToOne: false
            referencedRelation: "test_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "iteration_testers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_roles: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          test_role_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          test_role_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          test_role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_roles_test_role_id_fkey"
            columns: ["test_role_id"]
            isOneToOne: false
            referencedRelation: "test_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      manual_blocks: {
        Row: {
          block_type: string
          body: string
          created_at: string
          data: Json
          header: string
          id: string
          module_id: string
          section_id: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          block_type?: string
          body?: string
          created_at?: string
          data?: Json
          header: string
          id?: string
          module_id: string
          section_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          block_type?: string
          body?: string
          created_at?: string
          data?: Json
          header?: string
          id?: string
          module_id?: string
          section_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "manual_blocks_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "manual_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_blocks_section_id_module_id_fkey"
            columns: ["section_id", "module_id"]
            isOneToOne: false
            referencedRelation: "manual_sections"
            referencedColumns: ["id", "module_id"]
          },
        ]
      }
      manual_modules: {
        Row: {
          created_at: string
          description: string
          id: string
          is_published: boolean
          slug: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          is_published?: boolean
          slug: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          is_published?: boolean
          slug?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      manual_sections: {
        Row: {
          created_at: string
          description: string
          id: string
          module_id: string
          slug: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          module_id: string
          slug: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          module_id?: string
          slug?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "manual_sections_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "manual_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          type: Database["public"]["Enums"]["org_type"]
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          type: Database["public"]["Enums"]["org_type"]
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          type?: Database["public"]["Enums"]["org_type"]
        }
        Relationships: []
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
          org_role_id: string | null
          organization_id: string | null
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          created_at?: string
          full_name?: string
          id: string
          org_role_id?: string | null
          organization_id?: string | null
          role?: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          org_role_id?: string | null
          organization_id?: string | null
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: [
          {
            foreignKeyName: "profiles_org_role_fkey"
            columns: ["org_role_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "organization_roles"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
      suite_endpoints: {
        Row: {
          created_at: string
          id: string
          name: string
          sort_order: number
          testing_suite_id: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          testing_suite_id: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          testing_suite_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "suite_endpoints_testing_suite_id_fkey"
            columns: ["testing_suite_id"]
            isOneToOne: false
            referencedRelation: "testing_suites"
            referencedColumns: ["id"]
          },
        ]
      }
      suite_overview_sections: {
        Row: {
          content: string
          created_at: string
          icon: string | null
          id: string
          sort_order: number
          testing_suite_id: string
          title: string
        }
        Insert: {
          content?: string
          created_at?: string
          icon?: string | null
          id?: string
          sort_order?: number
          testing_suite_id: string
          title: string
        }
        Update: {
          content?: string
          created_at?: string
          icon?: string | null
          id?: string
          sort_order?: number
          testing_suite_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "suite_overview_sections_testing_suite_id_fkey"
            columns: ["testing_suite_id"]
            isOneToOne: false
            referencedRelation: "testing_suites"
            referencedColumns: ["id"]
          },
        ]
      }
      sign_off_comments: {
        Row: {
          body: string
          created_at: string
          created_by: string
          id: string
          page: number
          parent_id: string | null
          prefix: string
          quote: string
          sign_off_id: string
          suffix: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by: string
          id?: string
          page: number
          prefix?: string
          quote: string
          sign_off_id: string
          suffix?: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string
          id?: string
          page?: number
          prefix?: string
          quote?: string
          sign_off_id?: string
          suffix?: string
        }
        Relationships: [
          {
            foreignKeyName: "sign_off_comments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sign_off_comments_sign_off_id_fkey"
            columns: ["sign_off_id"]
            isOneToOne: false
            referencedRelation: "suite_sign_offs"
            referencedColumns: ["id"]
          },
        ]
      }
      suite_sign_offs: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          exceptions: Json
          id: string
          iteration_id: string
          note: string | null
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          report: Json | null
          revoked_at: string | null
          revoked_by: string | null
          signed_off_at: string
          signed_off_by: string | null
          status: Database["public"]["Enums"]["sign_off_status"]
          testing_suite_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          exceptions?: Json
          id?: string
          iteration_id: string
          note?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          report?: Json | null
          revoked_at?: string | null
          revoked_by?: string | null
          signed_off_at?: string
          signed_off_by?: string | null
          status?: Database["public"]["Enums"]["sign_off_status"]
          testing_suite_id: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          exceptions?: Json
          id?: string
          iteration_id?: string
          note?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          report?: Json | null
          revoked_at?: string | null
          revoked_by?: string | null
          signed_off_at?: string
          signed_off_by?: string | null
          status?: Database["public"]["Enums"]["sign_off_status"]
          testing_suite_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "suite_sign_offs_acknowledged_by_fkey"
            columns: ["acknowledged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suite_sign_offs_iteration_id_fkey"
            columns: ["iteration_id"]
            isOneToOne: false
            referencedRelation: "test_iterations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suite_sign_offs_rejected_by_fkey"
            columns: ["rejected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      suite_manual_modules: {
        Row: {
          created_at: string
          module_id: string
          suite_id: string
        }
        Insert: {
          created_at?: string
          module_id: string
          suite_id: string
        }
        Update: {
          created_at?: string
          module_id?: string
          suite_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "suite_manual_modules_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "manual_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suite_manual_modules_suite_id_fkey"
            columns: ["suite_id"]
            isOneToOne: false
            referencedRelation: "testing_suites"
            referencedColumns: ["id"]
          },
        ]
      }
      suite_test_accounts: {
        Row: {
          created_at: string
          id: string
          password: string
          sort_order: number
          test_role_id: string | null
          tester_name: string
          testing_suite_id: string
          username: string
        }
        Insert: {
          created_at?: string
          id?: string
          password: string
          sort_order?: number
          test_role_id?: string | null
          tester_name?: string
          testing_suite_id: string
          username: string
        }
        Update: {
          created_at?: string
          id?: string
          password?: string
          sort_order?: number
          test_role_id?: string | null
          tester_name?: string
          testing_suite_id?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "suite_test_accounts_test_role_id_fkey"
            columns: ["test_role_id"]
            isOneToOne: false
            referencedRelation: "test_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suite_test_accounts_testing_suite_id_fkey"
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
          organization_id: string | null
          preconditions: Json
          priority: Database["public"]["Enums"]["priority_level"] | null
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
          test_role_id: string | null
          tester_id: string | null
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
          organization_id?: string | null
          preconditions?: Json
          priority?: Database["public"]["Enums"]["priority_level"] | null
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
          test_role_id?: string | null
          tester_id?: string | null
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
          organization_id?: string | null
          preconditions?: Json
          priority?: Database["public"]["Enums"]["priority_level"] | null
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
          test_role_id?: string | null
          tester_id?: string | null
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
            foreignKeyName: "test_case_results_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          {
            foreignKeyName: "test_case_results_test_role_id_fkey"
            columns: ["test_role_id"]
            isOneToOne: false
            referencedRelation: "test_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_case_results_tester_fkey"
            columns: ["iteration_id", "tester_id"]
            isOneToOne: false
            referencedRelation: "iteration_testers"
            referencedColumns: ["iteration_id", "user_id"]
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
          section_id: string
          status: Database["public"]["Enums"]["test_case_status"]
          test_role_id: string | null
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
          section_id: string
          status?: Database["public"]["Enums"]["test_case_status"]
          test_role_id?: string | null
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
          section_id?: string
          status?: Database["public"]["Enums"]["test_case_status"]
          test_role_id?: string | null
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
          {
            foreignKeyName: "test_cases_test_role_id_fkey"
            columns: ["test_role_id"]
            isOneToOne: false
            referencedRelation: "test_roles"
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
          scope_test_case_ids: string[] | null
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
          scope_test_case_ids?: string[] | null
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
          scope_test_case_ids?: string[] | null
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
          test_case_result_id: string | null
          test_step_id: string | null
          test_step_result_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          remark: string
          test_case_result_id?: string | null
          test_step_id?: string | null
          test_step_result_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          remark?: string
          test_case_result_id?: string | null
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
            foreignKeyName: "test_remarks_test_case_result_id_fkey"
            columns: ["test_case_result_id"]
            isOneToOne: false
            referencedRelation: "test_case_results"
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
      test_roles: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
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
          exit_criteria: Json
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
          exit_criteria?: Json
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
          exit_criteria?: Json
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
      add_sign_off_comment: {
        Args: { p_body: string; p_page: number; p_prefix: string; p_quote: string; p_sign_off_id: string; p_suffix: string }
        Returns: Database["public"]["Tables"]["sign_off_comments"]["Row"]
      }
      delete_sign_off_comment: {
        Args: { p_comment_id: string }
        Returns: undefined
      }
      reply_sign_off_comment: {
        Args: { p_body: string; p_parent_id: string }
        Returns: Database["public"]["Tables"]["sign_off_comments"]["Row"]
      }
      update_sign_off_comment: {
        Args: { p_comment_id: string; p_body: string }
        Returns: undefined
      }
      acknowledge_sign_off: {
        Args: { p_by?: string; p_suite_id: string }
        Returns: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          exceptions: Json
          id: string
          iteration_id: string
          note: string | null
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          report: Json | null
          revoked_at: string | null
          revoked_by: string | null
          signed_off_at: string
          signed_off_by: string | null
          status: Database["public"]["Enums"]["sign_off_status"]
          testing_suite_id: string
        }
        SetofOptions: {
          from: "*"
          to: "suite_sign_offs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      apply_derived_case_status: {
        Args: { p_case_result_id: string }
        Returns: undefined
      }
      apply_iteration_sync: {
        Args: {
          p_add?: string[]
          p_by?: string
          p_drop?: string[]
          p_iteration_id: string
          p_join?: string[]
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
      begin_iteration: {
        Args: { p_iteration_id: string }
        Returns: {
          completed_at: string | null
          created_by: string | null
          id: string
          iteration_number: number
          label: string | null
          name: string
          planned_end_date: string | null
          scope_test_case_ids: string[] | null
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
      can_see_all_results: { Args: never; Returns: boolean }
      can_withdraw_participation: {
        Args: { p_iteration_id: string }
        Returns: boolean
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
      case_result_siblings: {
        Args: { p_case_result_id: string }
        Returns: string[]
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
          scope_test_case_ids: string[] | null
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
      clear_all_stale_drafts: { Args: Record<PropertyKey, never>; Returns: number }
      clear_stale_drafts: { Args: Record<PropertyKey, never>; Returns: number }
      complete_storage_deletions: { Args: { p_keys: string[] }; Returns: undefined }
      pending_storage_deletions: { Args: { p_limit?: number }; Returns: string[] }
      create_draft_attachment: {
        Args: {
          p_content_type: string
          p_file_name: string
          p_size_bytes: number
          p_step_result_id: string
        }
        Returns: {
          content_type: string
          created_at: string
          file_name: string
          id: string
          kind: Database["public"]["Enums"]["attachment_kind"]
          object_key: string
          remark_id: string | null
          size_bytes: number
          status: Database["public"]["Enums"]["attachment_status"]
          test_case_result_id: string | null
          test_step_result_id: string | null
          uploaded_by: string
        }
        SetofOptions: {
          from: "*"
          to: "attachments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_sign_off: {
        Args: { p_by?: string; p_suite_id: string }
        Returns: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          exceptions: Json
          id: string
          iteration_id: string
          note: string | null
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          report: Json | null
          revoked_at: string | null
          revoked_by: string | null
          signed_off_at: string
          signed_off_by: string | null
          status: Database["public"]["Enums"]["sign_off_status"]
          testing_suite_id: string
        }
        SetofOptions: {
          from: "*"
          to: "suite_sign_offs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_test_role: {
        Args: { p_name: string; p_org_ids?: string[] }
        Returns: {
          created_at: string
          id: string
          name: string
        }
        SetofOptions: {
          from: "*"
          to: "test_roles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      current_org_id: { Args: never; Returns: string }
      current_role_: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      delete_draft_attachment: {
        Args: { p_attachment_id: string }
        Returns: string
      }
      delete_section: { Args: { p_section_id: string }; Returns: undefined }
      delete_suite: { Args: { p_suite_id: string }; Returns: undefined }
      delete_test_case: { Args: { p_test_case_id: string }; Returns: undefined }
      delete_test_case_rows: {
        Args: { p_test_case_id: string }
        Returns: undefined
      }
      derived_case_status: {
        Args: { p_case_result_id: string }
        Returns: Database["public"]["Enums"]["test_case_status"]
      }
      discard_sign_off_draft: {
        Args: { p_sign_off_id: string }
        Returns: undefined
      }
      force_refresh_case_result: {
        Args: { p_by?: string; p_case_result_id: string; p_reason?: string }
        Returns: undefined
      }
      force_refresh_case_result_one: {
        Args: { p_by: string; p_case_result_id: string; p_reason: string }
        Returns: undefined
      }
      generate_test_case_code: { Args: { p_epic_id: string }; Returns: string }
      get_iteration_case_verdicts: {
        Args: { p_iteration_id: string }
        Returns: {
          blocked: number
          case_key: string
          copies: number
          failed: number
          in_progress: number
          organization_id: string
          passed: number
          test_case_id: string
          untested: number
          verdict: Database["public"]["Enums"]["test_case_status"]
        }[]
      }
      get_iteration_changes: {
        Args: { p_iteration_id: string }
        Returns: {
          audience_changed: boolean
          change: string
          code: string
          has_results: boolean
          incomplete: boolean
          organization_id: string
          organization_name: string
          test_case_id: string
          test_case_result_id: string
          test_role_name: string
          title: string
          user_id: string
        }[]
      }
      get_iteration_coverage: {
        Args: { p_iteration_id: string }
        Returns: Json
      }
      get_round_case_history: {
        Args: { p_iteration_id: string }
        Returns: {
          changed_since: boolean
          last_result: string
          last_round_name: string
          test_case_id: string
        }[]
      }
      get_round_coverage: {
        Args: {
          p_suite_id: string
          p_ticked_user_ids?: string[]
          p_test_case_ids: string[]
        }
        Returns: Json
      }
      get_sidebar_suites: {
        Args: never
        Returns: {
          code: string
          my_ever_participated: boolean
          my_in_open_round: boolean
          my_remaining: number
          my_submitted_at: string
          name: string
          open_iteration_name: string
          open_iteration_number: number
          open_iteration_status: Database["public"]["Enums"]["iteration_status"]
          open_planned_end: string
          slug: string
          status: Database["public"]["Enums"]["suite_status"]
          suite_id: string
        }[]
      }
      get_suite_case_states: {
        Args: { p_suite_id: string }
        Returns: {
          flags: string[]
          open_round_name: string
          per_org: Json
          result: string
          result_round_name: string
          status: string
          test_case_id: string
        }[]
      }
      import_test_cases: {
        Args: { p_cases: Json; p_suite_id: string }
        Returns: Json
      }
      is_admin: { Args: never; Returns: boolean }
      is_internal: { Args: never; Returns: boolean }
      issue_sign_off: {
        Args: {
          p_by?: string
          p_note?: string
          p_report?: Json
          p_sign_off_id: string
        }
        Returns: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          exceptions: Json
          id: string
          iteration_id: string
          note: string | null
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          report: Json | null
          revoked_at: string | null
          revoked_by: string | null
          signed_off_at: string
          signed_off_by: string | null
          status: Database["public"]["Enums"]["sign_off_status"]
          testing_suite_id: string
        }
        SetofOptions: {
          from: "*"
          to: "suite_sign_offs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      iteration_scope_cases: { Args: { p_iteration_id: string }; Returns: Json }
      post_case_remark_with_attachments: {
        Args: { p_case_result_id: string; p_remark: string; p_attachment_ids?: string[] }
        Returns: { id: string; remark: string; created_at: string }[]
      }
      create_draft_case_attachment: {
        Args: { p_case_result_id: string; p_content_type: string; p_file_name: string; p_size_bytes: number }
        Returns: Database["public"]["Tables"]["attachments"]["Row"]
        SetofOptions: { from: "*"; to: "attachments"; isOneToOne: true; isSetofReturn: false }
      }
      post_remark_with_attachments: {
        Args: { p_step_result_id: string; p_remark: string; p_attachment_ids?: string[] }
        Returns: { id: string; remark: string; created_at: string }[]
      }
      mark_attachment_ready: {
        Args: { p_attachment_id: string }
        Returns: {
          content_type: string
          created_at: string
          file_name: string
          id: string
          kind: Database["public"]["Enums"]["attachment_kind"]
          object_key: string
          remark_id: string | null
          size_bytes: number
          status: Database["public"]["Enums"]["attachment_status"]
          test_case_result_id: string | null
          test_step_result_id: string | null
          uploaded_by: string
        }
        SetofOptions: {
          from: "*"
          to: "attachments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      norm_role_name: { Args: { p_name: string }; Returns: string }
      org_has_case_role: {
        Args: { p_org_id: string; p_test_role_id: string }
        Returns: boolean
      }
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
      reject_sign_off: {
        Args: { p_by?: string; p_reason?: string; p_suite_id: string }
        Returns: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          exceptions: Json
          id: string
          iteration_id: string
          note: string | null
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          report: Json | null
          revoked_at: string | null
          revoked_by: string | null
          signed_off_at: string
          signed_off_by: string | null
          status: Database["public"]["Enums"]["sign_off_status"]
          testing_suite_id: string
        }
        SetofOptions: {
          from: "*"
          to: "suite_sign_offs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      remove_case_result: {
        Args: { p_case_result_id: string }
        Returns: undefined
      }
      reorder_manual_blocks: {
        Args: { p_block_ids: string[]; p_module_id: string; p_section_id: string }
        Returns: undefined
      }
      reorder_manual_modules: {
        Args: { p_module_ids: string[] }
        Returns: undefined
      }
      reorder_manual_sections: {
        Args: { p_module_id: string; p_section_ids: string[] }
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
      reset_iteration: {
        Args: { p_iteration_id: string }
        Returns: {
          completed_at: string | null
          created_by: string | null
          id: string
          iteration_number: number
          label: string | null
          name: string
          planned_end_date: string | null
          scope_test_case_ids: string[] | null
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
      rollup_case_status: {
        Args: { p_statuses: Database["public"]["Enums"]["test_case_status"][] }
        Returns: Database["public"]["Enums"]["test_case_status"]
      }
      round_coverage: {
        Args: { p_cases: Json; p_ticked_user_ids: string[] }
        Returns: Json
      }
      round_roster_drift: {
        Args: { p_iteration_id: string }
        Returns: {
          change: string
          full_name: string
          organization_id: string
          organization_name: string
          test_role_id: string
          test_role_name: string
          user_id: string
        }[]
      }
      save_sign_off_draft: {
        Args: { p_note?: string; p_report?: Json; p_sign_off_id: string }
        Returns: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          exceptions: Json
          id: string
          iteration_id: string
          note: string | null
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          report: Json | null
          revoked_at: string | null
          revoked_by: string | null
          signed_off_at: string
          signed_off_by: string | null
          status: Database["public"]["Enums"]["sign_off_status"]
          testing_suite_id: string
        }
        SetofOptions: {
          from: "*"
          to: "suite_sign_offs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      save_suite_endpoints: {
        Args: { p_endpoints: Json; p_suite_id: string }
        Returns: {
          created_at: string
          id: string
          name: string
          sort_order: number
          testing_suite_id: string
          url: string
        }[]
        SetofOptions: {
          from: "*"
          to: "suite_endpoints"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      save_suite_overview_sections: {
        Args: { p_sections: Json; p_suite_id: string }
        Returns: {
          content: string
          created_at: string
          icon: string | null
          id: string
          sort_order: number
          testing_suite_id: string
          title: string
        }[]
        SetofOptions: {
          from: "*"
          to: "suite_overview_sections"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      save_suite_test_accounts: {
        Args: { p_accounts: Json; p_suite_id: string }
        Returns: {
          created_at: string
          id: string
          password: string
          sort_order: number
          test_role_id: string | null
          testing_suite_id: string
          username: string
        }[]
        SetofOptions: {
          from: "*"
          to: "suite_test_accounts"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      save_test_case: { Args: { p_payload: Json }; Returns: string }
      set_case_inclusion: {
        Args: { p_case_result_ids: string[]; p_included: boolean }
        Returns: undefined
      }
      set_iteration_testers_ticked: {
        Args: {
          p_iteration_id: string
          p_ticked: boolean
          p_user_ids: string[]
        }
        Returns: undefined
      }
      set_suite_manual_modules: {
        Args: { p_module_ids: string[]; p_suite_id: string }
        Returns: undefined
      }
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
          exit_criteria: Json
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
      set_test_role_orgs: {
        Args: { p_org_ids: string[]; p_test_role_id: string }
        Returns: undefined
      }
      sign_off_iteration: { Args: { p_suite_id: string }; Returns: string }
      slugify: { Args: { p_text: string }; Returns: string }
      start_iteration: {
        Args: {
          p_created_by?: string
          p_name?: string
          p_planned_end_date?: string
          p_suite_id: string
        }
        Returns: {
          completed_at: string | null
          created_by: string | null
          id: string
          iteration_number: number
          label: string | null
          name: string
          planned_end_date: string | null
          scope_test_case_ids: string[] | null
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
      stop_iteration: {
        Args: { p_iteration_id: string }
        Returns: {
          completed_at: string | null
          created_by: string | null
          id: string
          iteration_number: number
          label: string | null
          name: string
          planned_end_date: string | null
          scope_test_case_ids: string[] | null
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
      submit_participation: {
        Args: { p_iteration_id: string }
        Returns: string
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
        Returns: string[]
      }
      test_case_content_hash: {
        Args: { p_test_case_id: string }
        Returns: string
      }
      test_case_issues: { Args: { p_test_case_id: string }; Returns: string[] }
      update_iteration_details: {
        Args: {
          p_iteration_id: string
          p_name?: string
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
          scope_test_case_ids: string[] | null
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
          exit_criteria: Json
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
      withdraw_participation: {
        Args: { p_iteration_id: string }
        Returns: undefined
      }
    }
    Enums: {
      attachment_kind: "image" | "pdf" | "video"
      attachment_status: "pending" | "ready"
      execution_status: "not_run" | "passed" | "skipped" | "failed"
      iteration_status: "not_started" | "in_progress" | "completed" | "stopped"
      org_type: "vendor" | "client" | "external"
      priority_level: "low" | "medium" | "high"
      sign_off_status:
        | "drafting"
        | "issued"
        | "acknowledged"
        | "rejected"
        | "withdrawn"
      suite_status:
        | "draft"
        | "ready"
        | "in_testing"
        | "for_sign_off"
        | "sign_off_issued"
        | "sign_off_rejected"
        | "signed_off"
        | "archived"
      test_case_lifecycle: "new" | "updated"
      test_case_status:
        | "Untested"
        | "In Progress"
        | "Passed"
        | "Failed"
        | "Blocked"
      test_step_status: "Untested" | "Passed" | "Failed" | "Skipped" | "Blocked"
      user_role: "Internal" | "External" | "Admin"
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
      attachment_kind: ["image", "pdf", "video"],
      attachment_status: ["pending", "ready"],
      execution_status: ["not_run", "passed", "skipped", "failed"],
      iteration_status: ["not_started", "in_progress", "completed", "stopped"],
      org_type: ["vendor", "client", "external"],
      priority_level: ["low", "medium", "high"],
      sign_off_status: [
        "drafting",
        "issued",
        "acknowledged",
        "rejected",
        "withdrawn",
      ],
      suite_status: [
        "draft",
        "ready",
        "in_testing",
        "for_sign_off",
        "sign_off_issued",
        "sign_off_rejected",
        "signed_off",
        "archived",
      ],
      test_case_lifecycle: ["new", "updated"],
      test_case_status: [
        "Untested",
        "In Progress",
        "Passed",
        "Failed",
        "Blocked",
      ],
      test_step_status: ["Untested", "Passed", "Failed", "Skipped", "Blocked"],
      user_role: ["Internal", "External", "Admin"],
    },
  },
} as const
