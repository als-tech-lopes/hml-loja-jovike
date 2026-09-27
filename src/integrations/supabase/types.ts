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
      module_permissions: {
        Row: {
          created_at: string
          dashboard: boolean
          id: string
          movements: boolean
          products: boolean
          reports: boolean
          sales: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dashboard?: boolean
          id?: string
          movements?: boolean
          products?: boolean
          reports?: boolean
          sales?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          dashboard?: boolean
          id?: string
          movements?: boolean
          products?: boolean
          reports?: boolean
          sales?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      movements: {
        Row: {
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          id: string
          note: string
          product_id: string
          product_code: string
          product_name: string
          product_variant_id: string | null
          quantity: number
          source_sale_id: string | null
          status: string
          type: string
          variant_color: string | null
          variant_code: string | null
          variant_size: string | null
        }
        Insert: {
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          id?: string
          note?: string
          product_id: string
          product_code: string
          product_name: string
          product_variant_id?: string | null
          quantity: number
          source_sale_id?: string | null
          status?: string
          type: string
          variant_color?: string | null
          variant_code?: string | null
          variant_size?: string | null
        }
        Update: {
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          id?: string
          note?: string
          product_id?: string
          product_code?: string
          product_name?: string
          product_variant_id?: string | null
          quantity?: number
          source_sale_id?: string | null
          status?: string
          type?: string
          variant_color?: string | null
          variant_code?: string | null
          variant_size?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movements_product_variant_id_fkey"
            columns: ["product_variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movements_source_sale_id_fkey"
            columns: ["source_sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      offline_catalog_products: {
        Row: {
          created_at: string
          id: string
          product_id: string
          selected_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          selected_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          selected_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "offline_catalog_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      offline_catalog_settings: {
        Row: {
          created_at: string
          id: string
          max_products: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          max_products?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          max_products?: number
          updated_at?: string
        }
        Relationships: []
      }
      plan_features: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          module_key: string
          module_label: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          module_key: string
          module_label?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          module_key?: string
          module_label?: string
          updated_at?: string
        }
        Relationships: []
      }
      plan_templates: {
        Row: {
          created_at: string
          default_status: string
          due_day: number | null
          id: string
          max_users: number
          modules: Json
          monthly_value: number
          pix_key: string
          plan_key: string
          plan_label: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_status?: string
          due_day?: number | null
          id?: string
          max_users?: number
          modules?: Json
          monthly_value?: number
          pix_key?: string
          plan_key: string
          plan_label?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_status?: string
          due_day?: number | null
          id?: string
          max_users?: number
          modules?: Json
          monthly_value?: number
          pix_key?: string
          plan_key?: string
          plan_label?: string
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          category: string
          created_at: string
          description: string
          id: string
          image_url: string | null
          min_stock: number
          name: string
          purchase_price: number
          price: number
          product_code: string
          quantity: number
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string
          id?: string
          image_url?: string | null
          min_stock?: number
          name: string
          purchase_price?: number
          price?: number
          product_code?: string
          quantity?: number
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          id?: string
          image_url?: string | null
          min_stock?: number
          name?: string
          purchase_price?: number
          price?: number
          product_code?: string
          quantity?: number
          updated_at?: string
        }
        Relationships: []
      }
      product_variants: {
        Row: {
          color: string
          created_at: string
          description: string
          id: string
          min_stock: number
          price: number
          product_id: string
          quantity: number
          size: string
          variant_code: string
        }
        Insert: {
          color: string
          created_at?: string
          description?: string
          id?: string
          min_stock?: number
          price?: number
          product_id: string
          quantity?: number
          size: string
          variant_code?: string
        }
        Update: {
          color?: string
          created_at?: string
          description?: string
          id?: string
          min_stock?: number
          price?: number
          product_id?: string
          quantity?: number
          size?: string
          variant_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variant_images: {
        Row: {
          color: string
          created_at: string
          display_order: number
          id: string
          image_url: string
          product_id: string
        }
        Insert: {
          color: string
          created_at?: string
          display_order?: number
          id?: string
          image_url: string
          product_id: string
        }
        Update: {
          color?: string
          created_at?: string
          display_order?: number
          id?: string
          image_url?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variant_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sale_items: {
        Row: {
          id: string
          product_id: string
          product_code: string
          product_name: string
          product_variant_id: string | null
          quantity: number
          sale_id: string
          unit_price: number
          variant_color: string | null
          variant_code: string | null
          variant_size: string | null
        }
        Insert: {
          id?: string
          product_id: string
          product_code: string
          product_name: string
          product_variant_id?: string | null
          quantity: number
          sale_id: string
          unit_price: number
          variant_color?: string | null
          variant_code?: string | null
          variant_size?: string | null
        }
        Update: {
          id?: string
          product_id?: string
          product_code?: string
          product_name?: string
          product_variant_id?: string | null
          quantity?: number
          sale_id?: string
          unit_price?: number
          variant_color?: string | null
          variant_code?: string | null
          variant_size?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_product_variant_id_fkey"
            columns: ["product_variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          cancelled_at: string | null
          cancelled_by: string | null
          client_name: string
          client_phone: string
          created_at: string
          created_by: string | null
          discount_amount: number
          discount_type: string | null
          discount_value: number
          id: string
          note: string
          payment_method: string
          print_receipt: boolean
          sale_code: string
          status: string
          subtotal: number
          total: number
        }
        Insert: {
          cancelled_at?: string | null
          cancelled_by?: string | null
          client_name: string
          client_phone?: string
          created_at?: string
          created_by?: string | null
          discount_amount?: number
          discount_type?: string | null
          discount_value?: number
          id?: string
          note?: string
          payment_method: string
          print_receipt?: boolean
          sale_code?: string
          status?: string
          subtotal?: number
          total?: number
        }
        Update: {
          cancelled_at?: string | null
          cancelled_by?: string | null
          client_name?: string
          client_phone?: string
          created_at?: string
          created_by?: string | null
          discount_amount?: number
          discount_type?: string | null
          discount_value?: number
          id?: string
          note?: string
          payment_method?: string
          print_receipt?: boolean
          sale_code?: string
          status?: string
          subtotal?: number
          total?: number
        }
        Relationships: []
      }
      seller_commissions: {
        Row: {
          commission_percent: number
          created_at: string
          id: string
          seller_id: string
          updated_at: string
        }
        Insert: {
          commission_percent?: number
          created_at?: string
          id?: string
          seller_id: string
          updated_at?: string
        }
        Update: {
          commission_percent?: number
          created_at?: string
          id?: string
          seller_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          value?: string
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      tenant_billing: {
        Row: {
          created_at: string
          due_day: number | null
          id: string
          is_trial: boolean
          monthly_value: number
          payment_status: string
          pix_key: string
          plan_type: string
          trial_end_date: string | null
          trial_start_date: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          due_day?: number | null
          id?: string
          is_trial?: boolean
          monthly_value?: number
          payment_status?: string
          pix_key?: string
          plan_type?: string
          trial_end_date?: string | null
          trial_start_date?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          due_day?: number | null
          id?: string
          is_trial?: boolean
          monthly_value?: number
          payment_status?: string
          pix_key?: string
          plan_type?: string
          trial_end_date?: string | null
          trial_start_date?: string | null
          updated_at?: string
        }
        Relationships: []
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
      cancel_movement: { Args: { _movement_id: string }; Returns: undefined }
      cancel_sale: { Args: { _sale_id: string }; Returns: undefined }
      create_sale: {
        Args: {
          _client_name: string
          _client_phone: string
          _discount_type: string | null
          _discount_value: number
          _items: Json
          _note: string
          _payment_method: string
          _print_receipt: boolean
        }
        Returns: Database["public"]["Tables"]["sales"]["Row"]
      }
      create_stock_movement: {
        Args: {
          _note?: string
          _product_id: string
          _product_variant_id: string | null
          _quantity: number
          _type: string
        }
        Returns: Database["public"]["Tables"]["movements"]["Row"]
      }
      has_module_access: { Args: { _module: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_super_admin: { Args: { _user_id?: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user" | "super_admin"
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
      app_role: ["admin", "user", "super_admin"],
    },
  },
} as const
