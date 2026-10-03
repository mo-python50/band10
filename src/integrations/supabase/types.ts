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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      audience_votes: {
        Row: {
          created_at: string
          evaluation_id: string
          id: string
          ip_hash: string | null
          item_id: string
          voter_hash: string
        }
        Insert: {
          created_at?: string
          evaluation_id: string
          id?: string
          ip_hash?: string | null
          item_id: string
          voter_hash: string
        }
        Update: {
          created_at?: string
          evaluation_id?: string
          id?: string
          ip_hash?: string | null
          item_id?: string
          voter_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "audience_votes_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "evaluations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audience_votes_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "evaluation_items"
            referencedColumns: ["id"]
          },
        ]
      }
      criteria: {
        Row: {
          created_at: string
          description: string | null
          evaluation_id: string
          id: string
          max_score: number
          min_score: number
          name: string
          position: number
          weight: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          evaluation_id: string
          id?: string
          max_score?: number
          min_score?: number
          name?: string
          position?: number
          weight?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          evaluation_id?: string
          id?: string
          max_score?: number
          min_score?: number
          name?: string
          position?: number
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "criteria_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "evaluations"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_events: {
        Row: {
          actor_id: string | null
          created_at: string
          evaluation_id: string
          event_type: string
          id: string
          payload: Json
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          evaluation_id: string
          event_type: string
          id?: string
          payload?: Json
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          evaluation_id?: string
          event_type?: string
          id?: string
          payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_events_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "evaluations"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_items: {
        Row: {
          created_at: string
          description: string | null
          evaluation_id: string
          id: string
          image_url: string | null
          name: string
          position: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          evaluation_id: string
          id?: string
          image_url?: string | null
          name?: string
          position?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          evaluation_id?: string
          id?: string
          image_url?: string | null
          name?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_items_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "evaluations"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluations: {
        Row: {
          activated_at: string | null
          archived_at: string | null
          audience_enabled: boolean
          audience_weight: number
          category: string | null
          completed_at: string | null
          created_at: string
          description: string | null
          ends_at: string | null
          id: string
          judge_code: string
          name: string
          owner_id: string
          public_results: boolean
          public_token: string
          results_snapshot: Json | null
          show_judge_names: boolean
          starts_at: string | null
          status: Database["public"]["Enums"]["evaluation_status"]
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          archived_at?: string | null
          audience_enabled?: boolean
          audience_weight?: number
          category?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          judge_code: string
          name?: string
          owner_id?: string
          public_results?: boolean
          public_token?: string
          results_snapshot?: Json | null
          show_judge_names?: boolean
          starts_at?: string | null
          status?: Database["public"]["Enums"]["evaluation_status"]
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          archived_at?: string | null
          audience_enabled?: boolean
          audience_weight?: number
          category?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          judge_code?: string
          name?: string
          owner_id?: string
          public_results?: boolean
          public_token?: string
          results_snapshot?: Json | null
          show_judge_names?: boolean
          starts_at?: string | null
          status?: Database["public"]["Enums"]["evaluation_status"]
          updated_at?: string
        }
        Relationships: []
      }
      judge_comments: {
        Row: {
          comment: string
          evaluation_id: string
          id: string
          item_id: string
          judge_id: string
          updated_at: string
        }
        Insert: {
          comment: string
          evaluation_id: string
          id?: string
          item_id: string
          judge_id: string
          updated_at?: string
        }
        Update: {
          comment?: string
          evaluation_id?: string
          id?: string
          item_id?: string
          judge_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "judge_comments_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "evaluations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "judge_comments_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "evaluation_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "judge_comments_judge_id_fkey"
            columns: ["judge_id"]
            isOneToOne: false
            referencedRelation: "judges"
            referencedColumns: ["id"]
          },
        ]
      }
      judges: {
        Row: {
          display_name: string
          evaluation_id: string
          id: string
          joined_at: string
          last_active_at: string
          submitted_at: string | null
          token_hash: string
        }
        Insert: {
          display_name: string
          evaluation_id: string
          id?: string
          joined_at?: string
          last_active_at?: string
          submitted_at?: string | null
          token_hash: string
        }
        Update: {
          display_name?: string
          evaluation_id?: string
          id?: string
          joined_at?: string
          last_active_at?: string
          submitted_at?: string | null
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "judges_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "evaluations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
        }
        Relationships: []
      }
      scores: {
        Row: {
          criterion_id: string
          evaluation_id: string
          id: string
          item_id: string
          judge_id: string
          score: number
          updated_at: string
        }
        Insert: {
          criterion_id: string
          evaluation_id: string
          id?: string
          item_id: string
          judge_id: string
          score: number
          updated_at?: string
        }
        Update: {
          criterion_id?: string
          evaluation_id?: string
          id?: string
          item_id?: string
          judge_id?: string
          score?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scores_criterion_id_fkey"
            columns: ["criterion_id"]
            isOneToOne: false
            referencedRelation: "criteria"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scores_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "evaluations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scores_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "evaluation_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scores_judge_id_fkey"
            columns: ["judge_id"]
            isOneToOne: false
            referencedRelation: "judges"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      compute_results_live: { Args: { _eval: string }; Returns: Json }
      gen_judge_code: { Args: never; Returns: string }
      get_public_results: { Args: { _token: string }; Returns: Json }
      get_results: { Args: { _eval: string }; Returns: Json }
      is_eval_owner: { Args: { _eval: string }; Returns: boolean }
      set_evaluation_status: {
        Args: {
          _eval: string
          _status: Database["public"]["Enums"]["evaluation_status"]
        }
        Returns: undefined
      }
    }
    Enums: {
      evaluation_status:
        | "draft"
        | "active"
        | "paused"
        | "completed"
        | "archived"
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
      evaluation_status: ["draft", "active", "paused", "completed", "archived"],
    },
  },
} as const
