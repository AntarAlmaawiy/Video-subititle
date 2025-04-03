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
            const { error } = await adminSupabase
                .from('profiles')
                .insert({
                    id: userId,
                    username: name || email.split('@')[0],
                    email,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                });

            profileStatus = error ? 'error' : 'created';

            if (error) {
                console.error('Error creating profile:', error);
            } else {
                console.log(`Successfully created profile for ${userId}`);
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
            const { error } = await adminSupabase
                .from('user_subscriptions')
                .insert({
                    user_id: userId,
                    plan_id: 'free',
                    status: 'active',
                    next_billing_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                });

            subscriptionStatus = error ? 'error' : 'created';

            if (error) {
                console.error('Error creating subscription:', error);
            } else {
                console.log(`Successfully created subscription for ${userId}`);
            }
        } else {
            subscriptionStatus = 'existing';
        }

        return NextResponse.json({
            success: true,
            userId,
            email,
            profileStatus,
            subscriptionStatus
        });
    } catch (error) {
        console.error('Error ensuring user setup:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}