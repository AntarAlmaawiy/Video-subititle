// lib/auth-helpers.ts
import { getAdminSupabase } from '@/lib/admin-supabase';

export async function ensureUserProfile(userId: string, email: string, name?: string) {
    if (!userId || !email) return null;

    const adminSupabase = getAdminSupabase();

    // Create username from email or name
    const username = name || email.split('@')[0];

    try {
        // Check if profile exists
        const { data: existingProfile } = await adminSupabase
            .from('profiles')
            .select('id')
            .eq('id', userId)
            .maybeSingle();

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
            } else {
                console.log(`Successfully created profile for ${userId}`);
            }
        }

        // Now ensure they have a subscription
        const { data: existingSub } = await adminSupabase
            .from('user_subscriptions')
            .select('id')
            .eq('user_id', userId)
            .maybeSingle();

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
                return null;
            } else {
                console.log(`Successfully created subscription for ${userId}`);
            }
        }

        return true;
    } catch (error) {
        console.error('Error in ensureUserProfile:', error);
        return null;
    }
}