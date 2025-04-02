// app/api/reset-stripe-customer/route.ts
import { NextResponse } from 'next/server';
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { getAdminSupabase } from '@/lib/admin-supabase';

export async function GET() {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const adminSupabase = getAdminSupabase();

        // Delete any existing subscription records for this user
        const { data, error } = await adminSupabase
            .from('user_subscriptions')
            .update({
                stripe_customer_id: null,
                stripe_subscription_id: null,
                status: 'inactive',
                plan_id: 'free',
                updated_at: new Date().toISOString()
            })
            .eq('user_id', session.user.id)
            .select();

        if (error) {
            console.error('Error resetting customer:', error);
            return NextResponse.json({
                success: false,
                error: error.message
            });
        }

        return NextResponse.json({
            success: true,
            message: 'Customer ID reset successfully',
            data
        });
    } catch (error) {
        console.error('Error in reset-stripe-customer:', error);
        return NextResponse.json({
            success: false,
            error: String(error)
        }, { status: 500 });
    }
}