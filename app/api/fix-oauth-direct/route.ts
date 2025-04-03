// app/api/fix-oauth-direct/route.ts
import { NextResponse } from 'next/server';
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { getAdminSupabase } from '@/lib/admin-supabase';

export async function POST() {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const userId = session.user.id;
        const userEmail = session.user.email || '';
        const userName = session.user.name || userEmail.split('@')[0];

        console.log(`Fixing OAuth user with direct SQL: ${userId}, ${userEmail}`);

        const adminSupabase = getAdminSupabase();
        const now = new Date().toISOString();
        const nextBillingDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        // Use raw SQL for profile creation
        const { data: profileData, error: profileError } = await adminSupabase.rpc(
            'create_profile_direct',
            {
                user_id: userId,
                user_email: userEmail,
                user_name: userName,
                created_timestamp: now
            }
        );

        // Use raw SQL for subscription creation
        const { data: subData, error: subError } = await adminSupabase.rpc(
            'create_subscription_direct',
            {
                user_id: userId,
                plan_type: 'free',
                status_value: 'active',
                billing_date: nextBillingDate,
                created_timestamp: now
            }
        );

        // Fetch the results to confirm
        const { data: profile } = await adminSupabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .maybeSingle();

        const { data: subscription } = await adminSupabase
            .from('user_subscriptions')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

        return NextResponse.json({
            success: profileData && subData,
            userId,
            email: userEmail,
            profile: {
                success: !!profileData,
                error: profileError?.message || null,
                current: profile
            },
            subscription: {
                success: !!subData,
                error: subError?.message || null,
                current: subscription
            }
        });
    } catch (error) {
        console.error('Error fixing OAuth user with direct SQL:', error);
        return NextResponse.json({
            error: 'Server error',
            message: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}