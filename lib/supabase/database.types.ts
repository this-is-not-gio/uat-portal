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
      test_remarks: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          remark: string
          test_step_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          remark: string
          test_step_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          remark?: string
          test_step_id?: string
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
        }
        Insert: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          name?: string
          slug?: string
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
      generate_test_case_code: { Args: { p_epic_id: string }; Returns: string }
      is_internal: { Args: never; Returns: boolean }
    }
    Enums: {
      execution_status: "not_run" | "passed" | "skipped" | "failed"
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
      test_case_lifecycle: "new" | "updated"
      test_case_status: "Untested" | "In Progress" | "Passed" | "Failed"
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
      test_case_lifecycle: ["new", "updated"],
      test_case_status: ["Untested", "In Progress", "Passed", "Failed"],
      test_step_status: ["Untested", "Passed", "Failed", "Skipped", "Blocked"],
      user_role: ["Internal", "External"],
    },
  },
} as const
