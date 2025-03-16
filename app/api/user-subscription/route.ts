// app/api/user-subscription/route.ts
import { NextResponse } from 'next/server';
import { auth } from '@/app/api/auth/[...nextauth]/route';
import { getAdminSupabase } from '@/lib/admin-supabase';

export async function GET() {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const adminSupabase = getAdminSupabase();

        const { data, error } = await adminSupabase
            .from('user_subscriptions')
            .select('*')
            .eq('user_id', session.user.id)
            .single();

        if (error) {
            console.error('Error fetching subscription:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({
            subscription: data || { plan_id: 'free', status: 'active' }
        });
    } catch (err: any) {
        console.error('Subscription fetch error:', err);
        return NextResponse.json({
            error: err.message || 'Failed to fetch subscription'
        }, { status: 500 });
    }
}