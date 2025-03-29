// lib/auth-helpers.ts
import { getAdminSupabase } from '@/lib/admin-supabase';

export async function ensureUserProfile(userId: string, email: string, name?: string) {
    if (!userId || !email) return null;

    const adminSupabase = getAdminSupabase();

    // Create username from email or name
    const username = name || email.split('@')[0];

    // Check if profile exists
    const { data: existingProfile } = await adminSupabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .single();

    if (!existingProfile) {
        // Create profile
        const { error: profileError } = await adminSupabase
            .from('profiles')
            .insert({
                id: userId,
                username,
                email,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });

        if (profileError) {
            console.error('Error creating profile:', profileError);
            return null;
        }
    }

    // Now ensure they have a subscription
    const { data: existingSub } = await adminSupabase
        .from('user_subscriptions')
        .select('id')
        .eq('user_id', userId)
        .single();

    if (!existingSub) {
        // Create free subscription
        const { error: subError } = await adminSupabase
            .from('user_subscriptions')
            .insert({
                user_id: userId,
                plan_id: 'free',
                status: 'active',
                next_billing_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });

        if (subError) {
            console.error('Error creating subscription:', subError);
        }
    }

    return true;
}