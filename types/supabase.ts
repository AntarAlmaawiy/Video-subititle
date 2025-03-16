// types/supabase.ts
export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export interface Database {
    public: {
        Tables: {
            subscription_plans: {
                Row: {
                    id: string
                    name: string
                    price_monthly: number
                    price_yearly: number
                    videos_per_day: number
                    storage_bytes: number
                    stripe_price_id_monthly: string | null
                    stripe_price_id_yearly: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id: string
                    name: string
                    price_monthly: number
                    price_yearly: number
                    videos_per_day: number
                    storage_bytes: number
                    stripe_price_id_monthly?: string | null
                    stripe_price_id_yearly?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    name?: string
                    price_monthly?: number
                    price_yearly?: number
                    videos_per_day?: number
                    storage_bytes?: number
                    stripe_price_id_monthly?: string | null
                    stripe_price_id_yearly?: string | null
                    created_at?: string
                    updated_at?: string
                }
            }
            user_subscriptions: {
                Row: {
                    id: string
                    user_id: string
                    plan_id: string
                    stripe_subscription_id: string | null
                    status: string
                    next_billing_date: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    plan_id: string
                    stripe_subscription_id?: string | null
                    status?: string
                    next_billing_date?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    plan_id?: string
                    stripe_subscription_id?: string | null
                    status?: string
                    next_billing_date?: string | null
                    created_at?: string
                    updated_at?: string
                }
            }
            users: {
                Row: {
                    id: string
                    email: string
                    full_name: string | null
                    avatar_url: string | null
                    stripe_customer_id: string | null
                    created_at: string | null
                    updated_at: string | null
                }
                Insert: {
                    id: string
                    email: string
                    full_name?: string | null
                    avatar_url?: string | null
                    stripe_customer_id?: string | null
                    created_at?: string | null
                    updated_at?: string | null
                }
                Update: {
                    id?: string
                    email?: string
                    full_name?: string | null
                    avatar_url?: string | null
                    stripe_customer_id?: string | null
                    created_at?: string | null
                    updated_at?: string | null
                }
            }
            video_processing: {
                Row: {
                    id: string
                    user_id: string
                    filename: string
                    file_size: number
                    status: string
                    source_language: string | null
                    target_language: string | null
                    original_url: string | null
                    processed_url: string | null
                    subtitle_url: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    filename: string
                    file_size?: number
                    status?: string
                    source_language?: string | null
                    target_language?: string | null
                    original_url?: string | null
                    processed_url?: string | null
                    subtitle_url?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    filename?: string
                    file_size?: number
                    status?: string
                    source_language?: string | null
                    target_language?: string | null
                    original_url?: string | null
                    processed_url?: string | null
                    subtitle_url?: string | null
                    created_at?: string
                    updated_at?: string
                }
            }
            video_library: {
                Row: {
                    id: string
                    user_id: string
                    file_path: string
                    file_name: string
                    file_size: number | null
                    language: string | null
                    source_language: string | null
                    duration: number | null
                    created_at: string
                    updated_at: string | null
                }
                Insert: {
                    id?: string
                    user_id: string
                    file_path: string
                    file_name: string
                    file_size?: number | null
                    language?: string | null
                    source_language?: string | null
                    duration?: number | null
                    created_at?: string
                    updated_at?: string | null
                }
                Update: {
                    id?: string
                    user_id?: string
                    file_path?: string
                    file_name?: string
                    file_size?: number | null
                    language?: string | null
                    source_language?: string | null
                    duration?: number | null
                    created_at?: string
                    updated_at?: string | null
                }
            }
        }
        Views: {
            [_ in never]: never
        }
        Functions: {
            get_user_storage_stats: {
                Args: {
                    user_id: string
                }
                Returns: {
                    used_storage: number
                    max_storage: number
                }
            }
        }
        Enums: {
            [_ in never]: never
        }
        CompositeTypes: {
            [_ in never]: never
        }
    }
}