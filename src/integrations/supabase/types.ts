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
      departments: {
        Row: {
          color_theme: string
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          color_theme?: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          color_theme?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      lead_activities: {
        Row: {
          activity_type: string
          created_at: string
          description: string
          id: string
          lead_id: string
          new_stage: Database["public"]["Enums"]["lead_stage"] | null
          old_stage: Database["public"]["Enums"]["lead_stage"] | null
          scheduled_at: string | null
          student_id: string | null
          user_id: string
        }
        Insert: {
          activity_type: string
          created_at?: string
          description: string
          id?: string
          lead_id: string
          new_stage?: Database["public"]["Enums"]["lead_stage"] | null
          old_stage?: Database["public"]["Enums"]["lead_stage"] | null
          scheduled_at?: string | null
          student_id?: string | null
          user_id: string
        }
        Update: {
          activity_type?: string
          created_at?: string
          description?: string
          id?: string
          lead_id?: string
          new_stage?: Database["public"]["Enums"]["lead_stage"] | null
          old_stage?: Database["public"]["Enums"]["lead_stage"] | null
          scheduled_at?: string | null
          student_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_activities_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_activities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_to: string | null
          birth_date: string | null
          campaign: string | null
          converted_at: string | null
          course_interest: string | null
          cpf: string | null
          created_at: string
          created_by: string | null
          department_id: string | null
          discount_percent: number | null
          education_level: string | null
          email: string | null
          enrollment_fee_paid: boolean | null
          enrollment_fee_value: number | null
          enrollment_installments: number | null
          final_value: number | null
          first_contact_date: string | null
          first_installment_paid: boolean | null
          first_installment_value: number | null
          has_diploma: boolean | null
          id: string
          installment_count: number | null
          installment_value: number | null
          lost_at: string | null
          lost_reason: string | null
          material_installments: number | null
          material_value: number | null
          media_source_id: string | null
          name: string
          next_contact_date: string | null
          notes: string | null
          payment_method: string | null
          phone: string | null
          quote_value: number | null
          stage: Database["public"]["Enums"]["lead_stage"]
          status: Database["public"]["Enums"]["lead_status"]
          student_id: string | null
          uniform_installments: number | null
          uniform_paid: boolean | null
          uniform_value: number | null
          unit_id: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          assigned_to?: string | null
          birth_date?: string | null
          campaign?: string | null
          converted_at?: string | null
          course_interest?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          discount_percent?: number | null
          education_level?: string | null
          email?: string | null
          enrollment_fee_paid?: boolean | null
          enrollment_fee_value?: number | null
          enrollment_installments?: number | null
          final_value?: number | null
          first_contact_date?: string | null
          first_installment_paid?: boolean | null
          first_installment_value?: number | null
          has_diploma?: boolean | null
          id?: string
          installment_count?: number | null
          installment_value?: number | null
          lost_at?: string | null
          lost_reason?: string | null
          material_installments?: number | null
          material_value?: number | null
          media_source_id?: string | null
          name: string
          next_contact_date?: string | null
          notes?: string | null
          payment_method?: string | null
          phone?: string | null
          quote_value?: number | null
          stage?: Database["public"]["Enums"]["lead_stage"]
          status?: Database["public"]["Enums"]["lead_status"]
          student_id?: string | null
          uniform_installments?: number | null
          uniform_paid?: boolean | null
          uniform_value?: number | null
          unit_id?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          assigned_to?: string | null
          birth_date?: string | null
          campaign?: string | null
          converted_at?: string | null
          course_interest?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          discount_percent?: number | null
          education_level?: string | null
          email?: string | null
          enrollment_fee_paid?: boolean | null
          enrollment_fee_value?: number | null
          enrollment_installments?: number | null
          final_value?: number | null
          first_contact_date?: string | null
          first_installment_paid?: boolean | null
          first_installment_value?: number | null
          has_diploma?: boolean | null
          id?: string
          installment_count?: number | null
          installment_value?: number | null
          lost_at?: string | null
          lost_reason?: string | null
          material_installments?: number | null
          material_value?: number | null
          media_source_id?: string | null
          name?: string
          next_contact_date?: string | null
          notes?: string | null
          payment_method?: string | null
          phone?: string | null
          quote_value?: number | null
          stage?: Database["public"]["Enums"]["lead_stage"]
          status?: Database["public"]["Enums"]["lead_status"]
          student_id?: string | null
          uniform_installments?: number | null
          uniform_paid?: boolean | null
          uniform_value?: number | null
          unit_id?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_media_source_id_fkey"
            columns: ["media_source_id"]
            isOneToOne: false
            referencedRelation: "media_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "school_units"
            referencedColumns: ["id"]
          },
        ]
      }
      media_sources: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string | null
          read: boolean
          task_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          read?: boolean
          task_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          read?: boolean
          task_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      processes: {
        Row: {
          checklist: Json | null
          created_at: string
          department_id: string | null
          description: string | null
          id: string
          procedure_path: string | null
          title: string
          updated_at: string
        }
        Insert: {
          checklist?: Json | null
          created_at?: string
          department_id?: string | null
          description?: string | null
          id?: string
          procedure_path?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          checklist?: Json | null
          created_at?: string
          department_id?: string | null
          description?: string | null
          id?: string
          procedure_path?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "processes_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          department_id: string | null
          full_name: string | null
          id: string
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          department_id?: string | null
          full_name?: string | null
          id: string
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          department_id?: string | null
          full_name?: string | null
          id?: string
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "school_units"
            referencedColumns: ["id"]
          },
        ]
      }
      school_units: {
        Row: {
          active: boolean
          city: string
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          city: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          city?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      students: {
        Row: {
          code: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "school_units"
            referencedColumns: ["id"]
          },
        ]
      }
      task_completions: {
        Row: {
          completed_at: string
          completed_by: string | null
          created_at: string
          cycle_key: string | null
          department_id: string | null
          id: string
          notes: string | null
          process_id: string | null
          task_id: string | null
          task_title: string
          unit_id: string | null
        }
        Insert: {
          completed_at?: string
          completed_by?: string | null
          created_at?: string
          cycle_key?: string | null
          department_id?: string | null
          id?: string
          notes?: string | null
          process_id?: string | null
          task_id?: string | null
          task_title: string
          unit_id?: string | null
        }
        Update: {
          completed_at?: string
          completed_by?: string | null
          created_at?: string
          cycle_key?: string | null
          department_id?: string | null
          id?: string
          notes?: string | null
          process_id?: string | null
          task_id?: string | null
          task_title?: string
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_completions_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_completions_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_completions_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_completions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_completions_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "school_units"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assignee_id: string | null
          checklist: Json | null
          created_at: string
          cycle_key: string | null
          department_id: string | null
          description: string | null
          due_date: string | null
          frequency: Database["public"]["Enums"]["task_frequency"]
          id: string
          last_completed_at: string | null
          priority: Database["public"]["Enums"]["task_priority"]
          procedure_path: string | null
          process_id: string | null
          status: Database["public"]["Enums"]["task_status"]
          title: string
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          checklist?: Json | null
          created_at?: string
          cycle_key?: string | null
          department_id?: string | null
          description?: string | null
          due_date?: string | null
          frequency?: Database["public"]["Enums"]["task_frequency"]
          id?: string
          last_completed_at?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          procedure_path?: string | null
          process_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          checklist?: Json | null
          created_at?: string
          cycle_key?: string | null
          department_id?: string | null
          description?: string | null
          due_date?: string | null
          frequency?: Database["public"]["Enums"]["task_frequency"]
          id?: string
          last_completed_at?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          procedure_path?: string | null
          process_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "school_units"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_create_user_profile: {
        Args: {
          _department_id?: string
          _full_name: string
          _role?: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: string
      }
      create_task_notification: {
        Args: {
          _assignee_id: string
          _message: string
          _task_id: string
          _title: string
        }
        Returns: string
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "employee" | "unit_admin"
      lead_stage:
        | "assuntos_pendentes"
        | "pendencia_eja"
        | "pendencia_online"
        | "pendencia_tecnico"
        | "desistentes"
        | "rescisao_cancelamento"
        | "finalizado"
      lead_status: "ativo" | "inativo" | "convertido" | "perdido"
      task_frequency: "daily" | "weekly" | "monthly"
      task_priority: "low" | "medium" | "high"
      task_status: "todo" | "in_progress" | "review" | "done"
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
      app_role: ["admin", "manager", "employee", "unit_admin"],
      lead_stage: [
        "assuntos_pendentes",
        "pendencia_eja",
        "pendencia_online",
        "pendencia_tecnico",
        "desistentes",
        "rescisao_cancelamento",
        "finalizado",
      ],
      lead_status: ["ativo", "inativo", "convertido", "perdido"],
      task_frequency: ["daily", "weekly", "monthly"],
      task_priority: ["low", "medium", "high"],
      task_status: ["todo", "in_progress", "review", "done"],
    },
  },
} as const
