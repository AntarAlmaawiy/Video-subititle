// app/api/ensure-user-setup/route.ts
import { NextResponse } from 'next/server';
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { getAdminSupabase } from '@/lib/admin-supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const userId = session.user.id;
        const email = session.user.email;
        const name = session.user.name;

        if (!email) {
            return NextResponse.json({ error: 'User email is required' }, { status: 400 });
        }

        const adminSupabase = getAdminSupabase();

        let profileStatus = 'unchanged';
        let subscriptionStatus = 'unchanged';

        // Check for profile
        const { data: existingProfile, error: profileError } = await adminSupabase
            .from('profiles')
            .select('id')
            .eq('id', userId)
            .maybeSingle();

        // Create profile if it doesn't exist
        if (!existingProfile && (profileError?.code === 'PGRST116' || !profileError)) {
            try {
                const { error, data } = await adminSupabase
                    .from('profiles')
                    .insert({
                        id: userId,
                        username: name || email.split('@')[0],
                        email,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    })
                    .select();

                profileStatus = error ? 'error' : 'created';

                if (error) {
                    console.error('Error creating profile:', {
                        code: error.code,
                        message: error.message,
                        details: error.details,
                        hint: error.hint
                    });
                } else {
                    console.log(`Successfully created profile for ${userId}`, data);
                }
            } catch (err) {
                console.error('Exception creating profile:', err);
                profileStatus = 'exception';
            }
        } else {
            profileStatus = 'existing';
        }

        // Check for subscription
        const { data: existingSub, error: subError } = await adminSupabase
            .from('user_subscriptions')
            .select('id')
            .eq('user_id', userId)
            .maybeSingle();

        // Create subscription if it doesn't exist
        if (!existingSub && (subError?.code === 'PGRST116' || !subError)) {
            try {
                // First check if a subscription already exists with a different user_id structure
                const { data: anySubForUser } = await adminSupabase
                    .from('user_subscriptions')
                    .select('id, user_id')
                    .or(`user_id.eq.${userId},user_id.eq."${userId}"`)
                    .maybeSingle();

                if (anySubForUser) {
                    console.log(`Found subscription with different user_id format: ${anySubForUser.user_id}`);
                    subscriptionStatus = 'existing_different_format';
                } else {
                    // Try to create the subscription
                    const { error, data } = await adminSupabase
                        .from('user_subscriptions')
                        .insert({
                            user_id: userId,
                            plan_id: 'free',
                            status: 'active',
                            next_billing_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString()
                        })
                        .select();

                    subscriptionStatus = error ? 'error' : 'created';

                    if (error) {
                        console.error('Error creating subscription:', {
                            code: error.code,
                            message: error.message,
                            details: error.details,
                            hint: error.hint
                        });
                    } else {
                        console.log(`Successfully created subscription for ${userId}`, data);
                    }
                }
            } catch (err) {
                console.error('Exception creating subscription:', err);
                subscriptionStatus = 'exception';
            }
        } else {
            subscriptionStatus = 'existing';
        }

        // Get the current profiles and subscriptions after our operations
        const { data: currentProfile } = await adminSupabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .maybeSingle();

        const { data: currentSubscription } = await adminSupabase
            .from('user_subscriptions')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

        return NextResponse.json({
            success: true,
            userId,
            email,
            profileStatus,
            subscriptionStatus,
            currentProfile,
            currentSubscription,
            message: "Check server logs for detailed error information if status shows error"
        });
    } catch (error) {
        console.error('Error ensuring user setup:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}