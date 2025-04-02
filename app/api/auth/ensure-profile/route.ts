// app/api/auth/ensure-profile/route.ts
import { NextResponse } from 'next/server';
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { getAdminSupabase } from '@/lib/admin-supabase';

export async function GET() {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const userId = session.user.id;
        const userEmail = session.user.email || 'user@example.com';
        const userName = session.user.name || userEmail.split('@')[0];

        const adminSupabase = getAdminSupabase();

        // Check if user exists in profiles
        const { data: existingProfile, error: profileError } = await adminSupabase
            .from('profiles')
            .select('id')
            .eq('id', userId)
            .single();

        let profileResult = null;
        let subscriptionResult = null;

        // Create profile if it doesn't exist
        if (profileError && profileError.code === 'PGRST116') {
            console.log(`Profile not found for user ${userId}, creating now...`);

            const { data: newProfile, error: createError } = await adminSupabase
                .from('profiles')
                .insert({
                    id: userId,
                    username: userName,
                    email: userEmail,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .select();

            if (createError) {
                console.error('Error creating profile:', createError);
                return NextResponse.json({ error: createError.message }, { status: 500 });
            }

            profileResult = newProfile;
        } else if (profileError) {
            console.error('Error checking profile:', profileError);
            return NextResponse.json({ error: profileError.message }, { status: 500 });
        } else {
            profileResult = existingProfile;
        }

        // Check if user has a subscription
        const { data: existingSub, error: subError } = await adminSupabase
            .from('user_subscriptions')
            .select('*')
            .eq('user_id', userId)
            .single();

        // Create default subscription if it doesn't exist
        if (subError && subError.code === 'PGRST116') {
            console.log(`No subscription found for user ${userId}, creating default...`);

            const { data: newSub, error: createSubError } = await adminSupabase
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

            if (createSubError) {
                console.error('Error creating subscription:', createSubError);
                return NextResponse.json({
                    profile: profileResult,
                    subscription_error: createSubError.message
                });
            }

            subscriptionResult = newSub;
        } else if (subError) {
            console.error('Error checking subscription:', subError);
            return NextResponse.json({
                profile: profileResult,
                subscription_error: subError.message
            });
        } else {
            subscriptionResult = existingSub;
        }

        return NextResponse.json({
            success: true,
            profile: profileResult,
            subscription: subscriptionResult
        });
    } catch (error) {
        console.error('Error in ensure-profile:', error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}