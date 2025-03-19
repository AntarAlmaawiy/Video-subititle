// app/api/direct-test/route.ts (Final Version)
import { NextResponse } from 'next/server';
import { auth } from '@/app/api/auth/[...nextauth]/route';
import { getAdminSupabase } from '@/lib/admin-supabase';

export async function GET(request: Request) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const url = new URL(request.url);
        const planId = url.searchParams.get('plan') || 'pro';

        const adminSupabase = getAdminSupabase();

        // Get current subscription
        const { data: existingData, error: fetchError } = await adminSupabase
            .from('user_subscriptions')
            .select('*')
            .eq('user_id', session.user.id)
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
            console.error('Error fetching subscription:', fetchError);
        }

        // Update with exact fields that exist in the database
        const subscriptionData = {
            user_id: session.user.id,
            plan_id: planId,
            status: 'active',
            stripe_subscription_id: `test_sub_${Date.now()}`,
            next_billing_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            updated_at: new Date().toISOString()
        };

        // Upsert the subscription with only the fields that exist
        const { data, error } = await adminSupabase
            .from('user_subscriptions')
            .upsert(subscriptionData, { onConflict: 'user_id' })
            .select();

        if (error) {
            console.error('Error updating test subscription:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: `Test subscription updated to ${planId}`,
            before: existingData || null,
            after: data[0]
        });
    } catch (err: unknown) {
        console.error('Test subscription error:', err);
        return NextResponse.json(
            {error: err instanceof Error ? err.message : 'Test failed'},
            { status: 500 }
        );
    }
}