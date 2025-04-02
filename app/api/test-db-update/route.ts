// app/api/test-db-update/route.ts
import { NextResponse } from 'next/server';
import { auth } from '@/app/api/auth/[...nextauth]/route';
import { getAdminSupabase } from '@/lib/admin-supabase';
// In app/api/test-db-update/route.ts
export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const body = await request.json();
        const { planId = 'pro', status = 'active' } = body;

        const adminSupabase = getAdminSupabase();

        console.log(`Testing DB update for user ${session.user.id}`);

        // First check if the user already has a record
        const { data: existingData, error: checkError } = await adminSupabase
            .from('user_subscriptions')
            .select('id')
            .eq('user_id', session.user.id);

        console.log('Existing subscription check:', existingData, checkError);

        let result;

        if (!existingData || existingData.length === 0) {
            // Insert new record
            const { data, error } = await adminSupabase
                .from('user_subscriptions')
                .insert({
                    user_id: session.user.id,
                    plan_id: planId,
                    status: status,
                    next_billing_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .select();

            console.log('Insert result:', data, error);
            result = { method: 'insert', data, error };
        } else {
            // Update existing record
            const { data, error } = await adminSupabase
                .from('user_subscriptions')
                .update({
                    plan_id: planId,
                    status: status,
                    next_billing_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                    updated_at: new Date().toISOString()
                })
                .eq('user_id', session.user.id)
                .select();

            console.log('Update result:', data, error);
            result = { method: 'update', data, error };
        }

        return NextResponse.json({
            success: !result.error,
            ...result
        });
    } catch (error) {
        console.error('Error in test-db-update:', error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}