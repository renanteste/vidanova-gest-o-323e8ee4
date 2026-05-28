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
      interesses_rotas: {
        Row: {
          created_at: string
          id: string
          motorista_id: string
          rota_id: string
          status: Database["public"]["Enums"]["interesse_status"]
          updated_at: string
          veiculo_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          motorista_id: string
          rota_id: string
          status?: Database["public"]["Enums"]["interesse_status"]
          updated_at?: string
          veiculo_id: string
        }
        Update: {
          created_at?: string
          id?: string
          motorista_id?: string
          rota_id?: string
          status?: Database["public"]["Enums"]["interesse_status"]
          updated_at?: string
          veiculo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "interesses_rotas_rota_id_fkey"
            columns: ["rota_id"]
            isOneToOne: false
            referencedRelation: "rotas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interesses_rotas_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          ativo: boolean
          cnh: string | null
          created_at: string
          fk_frota_id: string | null
          foto_url: string | null
          nome: string
          perfil: Database["public"]["Enums"]["app_role"]
          telefone: string | null
          updated_at: string
          user_id: string
          veiculo_id: string | null
        }
        Insert: {
          ativo?: boolean
          cnh?: string | null
          created_at?: string
          fk_frota_id?: string | null
          foto_url?: string | null
          nome: string
          perfil: Database["public"]["Enums"]["app_role"]
          telefone?: string | null
          updated_at?: string
          user_id: string
          veiculo_id?: string | null
        }
        Update: {
          ativo?: boolean
          cnh?: string | null
          created_at?: string
          fk_frota_id?: string | null
          foto_url?: string | null
          nome?: string
          perfil?: Database["public"]["Enums"]["app_role"]
          telefone?: string | null
          updated_at?: string
          user_id?: string
          veiculo_id?: string | null
        }
        Relationships: []
      }
      rotas: {
        Row: {
          construtora: string | null
          created_at: string
          criada_por: string
          destino_complemento: string | null
          destino_endereco: string
          distancia_km: number | null
          horario_previsto: string
          id: string
          lat_destino: number | null
          lat_origem: number | null
          lng_destino: number | null
          lng_origem: number | null
          material: string
          obra: string
          origem_complemento: string | null
          origem_endereco: string
          preco_por_m3: number
          responsavel: string | null
          status: Database["public"]["Enums"]["rota_status"]
          updated_at: string
        }
        Insert: {
          construtora?: string | null
          created_at?: string
          criada_por: string
          destino_complemento?: string | null
          destino_endereco: string
          distancia_km?: number | null
          horario_previsto: string
          id?: string
          lat_destino?: number | null
          lat_origem?: number | null
          lng_destino?: number | null
          lng_origem?: number | null
          material: string
          obra: string
          origem_complemento?: string | null
          origem_endereco: string
          preco_por_m3: number
          responsavel?: string | null
          status?: Database["public"]["Enums"]["rota_status"]
          updated_at?: string
        }
        Update: {
          construtora?: string | null
          created_at?: string
          criada_por?: string
          destino_complemento?: string | null
          destino_endereco?: string
          distancia_km?: number | null
          horario_previsto?: string
          id?: string
          lat_destino?: number | null
          lat_origem?: number | null
          lng_destino?: number | null
          lng_origem?: number | null
          material?: string
          obra?: string
          origem_complemento?: string | null
          origem_endereco?: string
          preco_por_m3?: number
          responsavel?: string | null
          status?: Database["public"]["Enums"]["rota_status"]
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      veiculos: {
        Row: {
          ativa: boolean
          capacidade_m3: number
          created_at: string
          foto_url: string | null
          id: string
          modelo: string
          placa: string
          proprietario_id: string
          tipo_cacamba: string
          updated_at: string
        }
        Insert: {
          ativa?: boolean
          capacidade_m3: number
          created_at?: string
          foto_url?: string | null
          id?: string
          modelo: string
          placa: string
          proprietario_id: string
          tipo_cacamba: string
          updated_at?: string
        }
        Update: {
          ativa?: boolean
          capacidade_m3?: number
          created_at?: string
          foto_url?: string | null
          id?: string
          modelo?: string
          placa?: string
          proprietario_id?: string
          tipo_cacamba?: string
          updated_at?: string
        }
        Relationships: []
      }
      viagens: {
        Row: {
          created_at: string
          fim_em: string | null
          foto_fim_url: string | null
          foto_inicio_url: string
          id: string
          inicio_em: string
          lat_fim: number | null
          lat_inicio: number
          lng_fim: number | null
          lng_inicio: number
          motorista_id: string
          rota_id: string
          updated_at: string
          valor_frete: number | null
          veiculo_id: string
        }
        Insert: {
          created_at?: string
          fim_em?: string | null
          foto_fim_url?: string | null
          foto_inicio_url: string
          id?: string
          inicio_em?: string
          lat_fim?: number | null
          lat_inicio: number
          lng_fim?: number | null
          lng_inicio: number
          motorista_id: string
          rota_id: string
          updated_at?: string
          valor_frete?: number | null
          veiculo_id: string
        }
        Update: {
          created_at?: string
          fim_em?: string | null
          foto_fim_url?: string | null
          foto_inicio_url?: string
          id?: string
          inicio_em?: string
          lat_fim?: number | null
          lat_inicio?: number
          lng_fim?: number | null
          lng_inicio?: number
          motorista_id?: string
          rota_id?: string
          updated_at?: string
          valor_frete?: number | null
          veiculo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "viagens_rota_id_fkey"
            columns: ["rota_id"]
            isOneToOne: false
            referencedRelation: "rotas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viagens_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_frota_id: { Args: { _user_id: string }; Returns: string }
      get_perfil: {
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
      app_role: "admin" | "frota" | "motorista_autonomo" | "motorista_vinculado"
      interesse_status: "pendente" | "aprovado" | "rejeitado"
      rota_status: "disponivel" | "finalizada"
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
      app_role: ["admin", "frota", "motorista_autonomo", "motorista_vinculado"],
      interesse_status: ["pendente", "aprovado", "rejeitado"],
      rota_status: ["disponivel", "finalizada"],
    },
  },
} as const
