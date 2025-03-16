import { createClient } from '@supabase/supabase-js';

// Create a singleton instance of the admin Supabase client
let _adminSupabase: ReturnType<typeof createClient> | null = null;

// Export a singleton instance for server components
export const adminSupabase = (() => {
    if (typeof window !== 'undefined') {
        throw new Error('Admin Supabase client can only be used on the server side');
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';

    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Missing Supabase environment variables for admin client');
    }

    if (!_adminSupabase) {
        _adminSupabase = createClient(supabaseUrl, supabaseServiceKey);
    }

    return _adminSupabase;
})();

// Export a function for components that need a fresh instance
export function getAdminSupabase() {
    if (typeof window !== 'undefined') {
        throw new Error('Admin Supabase client can only be used on the server side');
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';

    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Missing Supabase environment variables for admin client');
    }

    return createClient(supabaseUrl, supabaseServiceKey);
}