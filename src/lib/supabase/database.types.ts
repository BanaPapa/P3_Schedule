
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
            "academies": {
                  Row: {
                    "contact_name": string | null,"created_at": string,"family_id": string,"id": string,"memo": string | null,"name": string,"phone": string | null,"updated_at": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "contact_name"?: string | null,"created_at"?: string,"family_id": string,"id"?: string,"memo"?: string | null,"name": string,"phone"?: string | null,"updated_at"?: string,"version"?: number
                  }
                  Update: {
                    "contact_name"?: string | null,"created_at"?: string,"family_id"?: string,"id"?: string,"memo"?: string | null,"name"?: string,"phone"?: string | null,"updated_at"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "academies_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"audit_logs": {
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
                },"class_rules": {
                  Row: {
                    "created_at": string,"effective_from": string,"effective_until": string | null,"end_time": string,"enrollment_id": string,"family_id": string,"id": string,"start_time": string,"updated_at": string,"version": number,"weekday": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"effective_from": string,"effective_until"?: string | null,"end_time": string,"enrollment_id": string,"family_id": string,"id"?: string,"start_time": string,"updated_at"?: string,"version"?: number,"weekday": number
                  }
                  Update: {
                    "created_at"?: string,"effective_from"?: string,"effective_until"?: string | null,"end_time"?: string,"enrollment_id"?: string,"family_id"?: string,"id"?: string,"start_time"?: string,"updated_at"?: string,"version"?: number,"weekday"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "class_rules_enrollment_id_family_id_fkey"
      columns: ["enrollment_id","family_id"]
isOneToOne: false
      referencedRelation: "enrollments"
      referencedColumns: ["id","family_id"]
    },{
      foreignKeyName: "class_rules_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"class_sessions": {
                  Row: {
                    "created_at": string,"end_time": string,"enrollment_id": string,"family_id": string,"id": string,"kind": Database["public"]['Enums']["class_session_kind"],"makeup_waived": boolean,"note": string | null,"origin_session_id": string | null,"rule_id": string | null,"session_date": string,"start_time": string,"status": Database["public"]['Enums']["class_session_status"],"updated_at": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"end_time": string,"enrollment_id": string,"family_id": string,"id"?: string,"kind"?: Database["public"]['Enums']["class_session_kind"],"makeup_waived"?: boolean,"note"?: string | null,"origin_session_id"?: string | null,"rule_id"?: string | null,"session_date": string,"start_time": string,"status"?: Database["public"]['Enums']["class_session_status"],"updated_at"?: string,"version"?: number
                  }
                  Update: {
                    "created_at"?: string,"end_time"?: string,"enrollment_id"?: string,"family_id"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["class_session_kind"],"makeup_waived"?: boolean,"note"?: string | null,"origin_session_id"?: string | null,"rule_id"?: string | null,"session_date"?: string,"start_time"?: string,"status"?: Database["public"]['Enums']["class_session_status"],"updated_at"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "class_sessions_enrollment_id_family_id_fkey"
      columns: ["enrollment_id","family_id"]
isOneToOne: false
      referencedRelation: "enrollments"
      referencedColumns: ["id","family_id"]
    },{
      foreignKeyName: "class_sessions_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "class_sessions_origin_fkey"
      columns: ["origin_session_id","family_id"]
isOneToOne: false
      referencedRelation: "class_sessions"
      referencedColumns: ["id","family_id"]
    },{
      foreignKeyName: "class_sessions_origin_fkey"
      columns: ["origin_session_id","family_id"]
isOneToOne: false
      referencedRelation: "makeup_waitlist"
      referencedColumns: ["id","family_id"]
    },{
      foreignKeyName: "class_sessions_rule_id_family_id_fkey"
      columns: ["rule_id","family_id"]
isOneToOne: false
      referencedRelation: "class_rules"
      referencedColumns: ["id","family_id"]
    }
                  ]
                },"enrollments": {
                  Row: {
                    "academy_id": string,"child_id": string,"created_at": string,"end_date": string | null,"family_id": string,"id": string,"memo": string | null,"start_date": string,"subject": string,"updated_at": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "academy_id": string,"child_id": string,"created_at"?: string,"end_date"?: string | null,"family_id": string,"id"?: string,"memo"?: string | null,"start_date": string,"subject": string,"updated_at"?: string,"version"?: number
                  }
                  Update: {
                    "academy_id"?: string,"child_id"?: string,"created_at"?: string,"end_date"?: string | null,"family_id"?: string,"id"?: string,"memo"?: string | null,"start_date"?: string,"subject"?: string,"updated_at"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "enrollments_academy_id_family_id_fkey"
      columns: ["academy_id","family_id"]
isOneToOne: false
      referencedRelation: "academies"
      referencedColumns: ["id","family_id"]
    },{
      foreignKeyName: "enrollments_child_id_family_id_fkey"
      columns: ["child_id","family_id"]
isOneToOne: false
      referencedRelation: "children"
      referencedColumns: ["id","family_id"]
    },{
      foreignKeyName: "enrollments_family_id_fkey"
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
                },"tuition_invoice_items": {
                  Row: {
                    "amount": number,"created_at": string,"family_id": string,"id": string,"invoice_id": string,"kind": Database["public"]['Enums']["tuition_item_kind"],"label": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"created_at"?: string,"family_id": string,"id"?: string,"invoice_id": string,"kind": Database["public"]['Enums']["tuition_item_kind"],"label": string
                  }
                  Update: {
                    "amount"?: number,"created_at"?: string,"family_id"?: string,"id"?: string,"invoice_id"?: string,"kind"?: Database["public"]['Enums']["tuition_item_kind"],"label"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tuition_invoice_items_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tuition_invoice_items_invoice_id_family_id_fkey"
      columns: ["invoice_id","family_id"]
isOneToOne: false
      referencedRelation: "tuition_invoice_summaries"
      referencedColumns: ["id","family_id"]
    },{
      foreignKeyName: "tuition_invoice_items_invoice_id_family_id_fkey"
      columns: ["invoice_id","family_id"]
isOneToOne: false
      referencedRelation: "tuition_invoices"
      referencedColumns: ["id","family_id"]
    }
                  ]
                },"tuition_invoices": {
                  Row: {
                    "adjustment_reason": string | null,"base_amount": number,"billable_count": number,"billing_month": string,"confirmed_at": string,"confirmed_by": string | null,"created_at": string,"enrollment_id": string,"estimated_amount": number | null,"family_id": string,"id": string,"method": Database["public"]['Enums']["tuition_method"],"session_count": number,"unit_amount": number | null,"updated_at": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "adjustment_reason"?: string | null,"base_amount": number,"billable_count"?: number,"billing_month": string,"confirmed_at"?: string,"confirmed_by"?: string | null,"created_at"?: string,"enrollment_id": string,"estimated_amount"?: number | null,"family_id": string,"id"?: string,"method": Database["public"]['Enums']["tuition_method"],"session_count"?: number,"unit_amount"?: number | null,"updated_at"?: string,"version"?: number
                  }
                  Update: {
                    "adjustment_reason"?: string | null,"base_amount"?: number,"billable_count"?: number,"billing_month"?: string,"confirmed_at"?: string,"confirmed_by"?: string | null,"created_at"?: string,"enrollment_id"?: string,"estimated_amount"?: number | null,"family_id"?: string,"id"?: string,"method"?: Database["public"]['Enums']["tuition_method"],"session_count"?: number,"unit_amount"?: number | null,"updated_at"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "tuition_invoices_enrollment_id_family_id_fkey"
      columns: ["enrollment_id","family_id"]
isOneToOne: false
      referencedRelation: "enrollments"
      referencedColumns: ["id","family_id"]
    },{
      foreignKeyName: "tuition_invoices_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"tuition_payments": {
                  Row: {
                    "amount": number,"created_at": string,"created_by": string | null,"family_id": string,"id": string,"invoice_id": string,"memo": string | null,"method": string | null,"paid_on": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"created_at"?: string,"created_by"?: string | null,"family_id": string,"id"?: string,"invoice_id": string,"memo"?: string | null,"method"?: string | null,"paid_on": string
                  }
                  Update: {
                    "amount"?: number,"created_at"?: string,"created_by"?: string | null,"family_id"?: string,"id"?: string,"invoice_id"?: string,"memo"?: string | null,"method"?: string | null,"paid_on"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tuition_payments_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tuition_payments_invoice_id_family_id_fkey"
      columns: ["invoice_id","family_id"]
isOneToOne: false
      referencedRelation: "tuition_invoice_summaries"
      referencedColumns: ["id","family_id"]
    },{
      foreignKeyName: "tuition_payments_invoice_id_family_id_fkey"
      columns: ["invoice_id","family_id"]
isOneToOne: false
      referencedRelation: "tuition_invoices"
      referencedColumns: ["id","family_id"]
    }
                  ]
                },"tuition_policies": {
                  Row: {
                    "absent_billable": boolean,"academy_cancelled_billable": boolean,"created_at": string,"effective_month": string,"enrollment_id": string,"family_id": string,"id": string,"memo": string | null,"method": Database["public"]['Enums']["tuition_method"],"monthly_amount": number | null,"payment_day": number | null,"per_session_amount": number | null,"updated_at": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "absent_billable"?: boolean,"academy_cancelled_billable"?: boolean,"created_at"?: string,"effective_month": string,"enrollment_id": string,"family_id": string,"id"?: string,"memo"?: string | null,"method": Database["public"]['Enums']["tuition_method"],"monthly_amount"?: number | null,"payment_day"?: number | null,"per_session_amount"?: number | null,"updated_at"?: string,"version"?: number
                  }
                  Update: {
                    "absent_billable"?: boolean,"academy_cancelled_billable"?: boolean,"created_at"?: string,"effective_month"?: string,"enrollment_id"?: string,"family_id"?: string,"id"?: string,"memo"?: string | null,"method"?: Database["public"]['Enums']["tuition_method"],"monthly_amount"?: number | null,"payment_day"?: number | null,"per_session_amount"?: number | null,"updated_at"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "tuition_policies_enrollment_id_family_id_fkey"
      columns: ["enrollment_id","family_id"]
isOneToOne: false
      referencedRelation: "enrollments"
      referencedColumns: ["id","family_id"]
    },{
      foreignKeyName: "tuition_policies_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "makeup_waitlist": {
                  Row: {
                    "created_at": string,"end_time": string,"enrollment_id": string,"family_id": string,"id": string,"kind": Database["public"]['Enums']["class_session_kind"],"makeup_waived": boolean,"note": string | null,"origin_session_id": string | null,"rule_id": string | null,"session_date": string,"start_time": string,"status": Database["public"]['Enums']["class_session_status"],"updated_at": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                           "created_at"?: string | null,"end_time"?: string | null,"enrollment_id"?: string | null,"family_id"?: string | null,"id"?: string | null,"kind"?: Database["public"]['Enums']["class_session_kind"] | null,"makeup_waived"?: boolean | null,"note"?: string | null,"origin_session_id"?: string | null,"rule_id"?: string | null,"session_date"?: string | null,"start_time"?: string | null,"status"?: Database["public"]['Enums']["class_session_status"] | null,"updated_at"?: string | null,"version"?: number | null
                         }
                        Update: {
                           "created_at"?: string | null,"end_time"?: string | null,"enrollment_id"?: string | null,"family_id"?: string | null,"id"?: string | null,"kind"?: Database["public"]['Enums']["class_session_kind"] | null,"makeup_waived"?: boolean | null,"note"?: string | null,"origin_session_id"?: string | null,"rule_id"?: string | null,"session_date"?: string | null,"start_time"?: string | null,"status"?: Database["public"]['Enums']["class_session_status"] | null,"updated_at"?: string | null,"version"?: number | null
                         }
                        Relationships: [
                    {
      foreignKeyName: "class_sessions_enrollment_id_family_id_fkey"
      columns: ["enrollment_id","family_id"]
isOneToOne: false
      referencedRelation: "enrollments"
      referencedColumns: ["id","family_id"]
    },{
      foreignKeyName: "class_sessions_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "class_sessions_origin_fkey"
      columns: ["origin_session_id","family_id"]
isOneToOne: false
      referencedRelation: "class_sessions"
      referencedColumns: ["id","family_id"]
    },{
      foreignKeyName: "class_sessions_origin_fkey"
      columns: ["origin_session_id","family_id"]
isOneToOne: false
      referencedRelation: "makeup_waitlist"
      referencedColumns: ["id","family_id"]
    },{
      foreignKeyName: "class_sessions_rule_id_family_id_fkey"
      columns: ["rule_id","family_id"]
isOneToOne: false
      referencedRelation: "class_rules"
      referencedColumns: ["id","family_id"]
    }
                  ]
                },"tuition_invoice_summaries": {
                  Row: {
                    "adjustment_reason": string | null,"balance": number | null,"base_amount": number,"billable_count": number,"billing_month": string,"confirmed_at": string,"confirmed_by": string | null,"created_at": string,"discount_amount": number | null,"enrollment_id": string,"estimated_amount": number | null,"extra_amount": number | null,"family_id": string,"id": string,"method": Database["public"]['Enums']["tuition_method"],"paid_amount": number | null,"session_count": number,"total_amount": number | null,"unit_amount": number | null,"updated_at": string,"version": number
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "tuition_invoices_enrollment_id_family_id_fkey"
      columns: ["enrollment_id","family_id"]
isOneToOne: false
      referencedRelation: "enrollments"
      referencedColumns: ["id","family_id"]
    },{
      foreignKeyName: "tuition_invoices_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "accept_invitation":
{ Args: { "p_code": string,"p_display_name": string }; Returns: string
                           },
"adjust_invoice":
{ Args: { "p_base_amount": number,"p_invoice_id": string,"p_reason": string,"p_version": number }; Returns: undefined
                           },
"cancel_invoice":
{ Args: { "p_invoice_id": string,"p_version": number }; Returns: undefined
                           },
"change_schedule_from":
{ Args: { "p_enrollment_id": string,"p_from": string,"p_rules": Json }; Returns: undefined
                           },
"confirm_invoice":
{ Args: { "p_base_amount": number,"p_enrollment_id": string,"p_items": Json,"p_month": string,"p_reason": string }; Returns: string
                           },
"create_enrollment":
{ Args: { "p_academy_id": string,"p_child_id": string,"p_end_date": string,"p_rules": Json,"p_start_date": string,"p_subject": string }; Returns: string
                           },
"create_family":
{ Args: { "p_display_name": string,"p_name": string }; Returns: string
                           },
"create_invitation":
{ Args: Record<PropertyKey, never>; Returns: {
              "code": string,"expires_at": string
            }[]
                           },
"create_makeup":
{ Args: { "p_date": string,"p_end_time": string,"p_session_id": string,"p_start_time": string,"p_version": number }; Returns: string
                           },
"delete_enrollment":
{ Args: { "p_enrollment_id": string }; Returns: undefined
                           },
"end_enrollment":
{ Args: { "p_end_date": string,"p_enrollment_id": string }; Returns: undefined
                           },
"ensure_sessions_until":
{ Args: { "p_until": string }; Returns: number
                           },
"get_invitation":
{ Args: { "p_code": string }; Returns: {
              "expires_at": string,"family_name": string,"inviter_name": string,"status": string
            }[]
                           },
"reschedule_session":
{ Args: { "p_date": string,"p_end_time": string,"p_session_id": string,"p_start_time": string,"p_version": number }; Returns: string
                           },
"revoke_invitation":
{ Args: { "p_invitation_id": string }; Returns: undefined
                           },
"save_tuition_policy":
{ Args: { "p_absent_billable": boolean,"p_academy_cancelled_billable": boolean,"p_effective_month": string,"p_enrollment_id": string,"p_memo": string,"p_method": Database["public"]['Enums']["tuition_method"],"p_monthly_amount": number,"p_payment_day": number,"p_per_session_amount": number }; Returns: string
                           },
"set_makeup_waived":
{ Args: { "p_session_id": string,"p_version": number,"p_waived": boolean }; Returns: undefined
                           },
"set_session_status":
{ Args: { "p_session_id": string,"p_status": Database["public"]['Enums']["class_session_status"],"p_version": number }; Returns: undefined
                           },
"tuition_estimates":
{ Args: { "p_enrollment_id"?: string,"p_month": string }; Returns: {
              "billable_count": number,"enrollment_id": string,"estimated_amount": number,"method": Database["public"]['Enums']["tuition_method"],"payment_day": number,"policy_id": string,"session_count": number,"unit_amount": number
            }[]
                           },
"tuition_session_breakdown":
{ Args: { "p_enrollment_id": string,"p_month": string }; Returns: {
              "billable": boolean,"kind": Database["public"]['Enums']["class_session_kind"],"origin_status": Database["public"]['Enums']["class_session_status"],"session_date": string,"session_id": string,"start_time": string,"status": Database["public"]['Enums']["class_session_status"]
            }[]
                           }
          }
          Enums: {
            "class_session_kind": "regular"|"makeup"|"rescheduled","class_session_status": "scheduled"|"completed"|"absent"|"academy_cancelled"|"cancelled"|"makeup_scheduled"|"makeup_completed","family_role": "owner"|"parent","tuition_item_kind": "extra"|"discount","tuition_method": "monthly"|"per_session"|"manual"
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
            "class_session_kind": ["regular", "makeup", "rescheduled"],"class_session_status": ["scheduled", "completed", "absent", "academy_cancelled", "cancelled", "makeup_scheduled", "makeup_completed"],"family_role": ["owner", "parent"],"tuition_item_kind": ["extra", "discount"],"tuition_method": ["monthly", "per_session", "manual"]
          }
        }
} as const
