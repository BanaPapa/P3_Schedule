
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "audit_logs": {
                  Row: {
                    "action": string,"actor_id": string | null,"created_at": string,"family_id": string,"id": number,"new_data": Json | null,"old_data": Json | null,"record_id": string,"table_name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"created_at"?: string,"family_id": string,"id"?: never,"new_data"?: Json | null,"old_data"?: Json | null,"record_id": string,"table_name": string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"created_at"?: string,"family_id"?: string,"id"?: never,"new_data"?: Json | null,"old_data"?: Json | null,"record_id"?: string,"table_name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"children": {
                  Row: {
                    "birth_date": string | null,"color": string,"created_at": string,"family_id": string,"id": string,"name": string,"sort_order": number,"updated_at": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "birth_date"?: string | null,"color"?: string,"created_at"?: string,"family_id": string,"id"?: string,"name": string,"sort_order"?: number,"updated_at"?: string,"version"?: number
                  }
                  Update: {
                    "birth_date"?: string | null,"color"?: string,"created_at"?: string,"family_id"?: string,"id"?: string,"name"?: string,"sort_order"?: number,"updated_at"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "children_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"families": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"name": string,"updated_at": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"name": string,"updated_at"?: string,"version"?: number
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"name"?: string,"updated_at"?: string,"version"?: number
                  }
                  Relationships: [
                    
                  ]
                },"family_invitations": {
                  Row: {
                    "accepted_at": string | null,"accepted_by": string | null,"code": string,"created_at": string,"created_by": string | null,"expires_at": string,"family_id": string,"id": string,"revoked_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"code"?: string,"created_at"?: string,"created_by"?: string | null,"expires_at"?: string,"family_id": string,"id"?: string,"revoked_at"?: string | null
                  }
                  Update: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"code"?: string,"created_at"?: string,"created_by"?: string | null,"expires_at"?: string,"family_id"?: string,"id"?: string,"revoked_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "family_invitations_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"family_members": {
                  Row: {
                    "created_at": string,"display_name": string,"family_id": string,"id": string,"role": Database["public"]['Enums']["family_role"],"updated_at": string,"user_id": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"display_name": string,"family_id": string,"id"?: string,"role"?: Database["public"]['Enums']["family_role"],"updated_at"?: string,"user_id": string,"version"?: number
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string,"family_id"?: string,"id"?: string,"role"?: Database["public"]['Enums']["family_role"],"updated_at"?: string,"user_id"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "family_members_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "accept_invitation":
{ Args: { "p_code": string,"p_display_name": string }; Returns: string
                           },
"create_family":
{ Args: { "p_display_name": string,"p_name": string }; Returns: string
                           },
"create_invitation":
{ Args: Record<PropertyKey, never>; Returns: {
              "code": string,"expires_at": string
            }[]
                           },
"get_invitation":
{ Args: { "p_code": string }; Returns: {
              "expires_at": string,"family_name": string,"inviter_name": string,"status": string
            }[]
                           },
"revoke_invitation":
{ Args: { "p_invitation_id": string }; Returns: undefined
                           }
          }
          Enums: {
            "family_role": "owner"|"parent"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "family_role": ["owner", "parent"]
          }
        }
} as const
