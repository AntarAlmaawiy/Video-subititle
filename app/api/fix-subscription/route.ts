// app/api/fix-subscription/route.ts
import { NextResponse } from 'next/server';
import { auth } from '@/app/api/auth/[...nextauth]/route';
import { adminSupabase } from '@/lib/admin-supabase';

export async function GET() {
    try {
        // Get the current user
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const userId = session.user.id;

        // First, verify the user exists in auth.users
        const { data: authData, error: authError } = await adminSupabase.auth.admin.getUserById(userId);

        if (authError || !authData?.user) {
            return NextResponse.json({
                error: `User not found in auth.users: ${authError?.message || 'Unknown error'}`
            }, { status: 500 });
        }

        console.log('Auth user found:', authData.user);

        // Now try to upsert the subscription with the service role
        const { data: subscription, error: subscriptionError } = await adminSupabase
            .from('user_subscriptions')
            .upsert({
                user_id: userId,
                plan_id: 'pro',
                status: 'active',
                next_billing_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' })
            .select();

        if (subscriptionError) {
            return NextResponse.json({
                error: `Subscription update failed: ${subscriptionError.message}`,
                details: {
                    code: subscriptionError.code,
                    hint: subscriptionError.hint,
                    details: subscriptionError.details
                }
            }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            subscription
        });
    } catch (error) {
        console.error('Error fixing subscription:', error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}