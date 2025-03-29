// app/api/direct-subscription-fix/route.ts
import { NextResponse } from 'next/server';
import { auth } from '@/app/api/auth/[...nextauth]/route';
import { adminSupabase } from '@/lib/admin-supabase';

export async function GET(request: Request) {
    try {
        // Get the current user
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const userId = session.user.id;

        // Get URL parameters
        const url = new URL(request.url);
        const planId = url.searchParams.get('plan') || 'pro';

        console.log(`🔄 Setting plan ${planId} for user ${userId}`);

        // Update the subscription directly
        const { data, error } = await adminSupabase
            .from('user_subscriptions')
            .upsert({
                user_id: userId,
                plan_id: planId,
                status: 'active',
                next_billing_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                updated_at: new Date().toISOString(),
                created_at: new Date().toISOString()
            }, { onConflict: 'user_id' })
            .select();

        if (error) {
            console.error('❌ Error updating subscription:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: `Subscription set to ${planId}`,
            data
        });
    } catch (error) {
        console.error('❌ Error in direct fix:', error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}