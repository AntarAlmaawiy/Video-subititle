// app/api/test-db-update/route.ts
import { NextResponse } from 'next/server';
import { auth } from '@/app/api/auth/[...nextauth]/route';
import { getAdminSupabase } from '@/lib/admin-supabase';

export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const body = await request.json();
        const { planId = 'pro', status = 'active' } = body;

        const adminSupabase = getAdminSupabase();

        // First try using INSERT with ON CONFLICT
        const { data: upsertData, error: upsertError } = await adminSupabase
            .from('user_subscriptions')
            .upsert({
                user_id: session.user.id,
                plan_id: planId,
                status: status,
                next_billing_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'user_id',
                ignoreDuplicates: false
            })
            .select();

        if (upsertError) {
            console.error('Upsert error:', upsertError);

            // Try direct update as fallback
            const { data: updateData, error: updateError } = await adminSupabase
                .from('user_subscriptions')
                .update({
                    plan_id: planId,
                    status: status,
                    next_billing_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                    updated_at: new Date().toISOString()
                })
                .eq('user_id', session.user.id)
                .select();

            if (updateError) {
                return NextResponse.json({
                    success: false,
                    upsertError: upsertError.message,
                    updateError: updateError.message
                }, { status: 500 });
            }

            return NextResponse.json({
                success: true,
                method: 'update',
                data: updateData
            });
        }

        return NextResponse.json({
            success: true,
            method: 'upsert',
            data: upsertData
        });
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}