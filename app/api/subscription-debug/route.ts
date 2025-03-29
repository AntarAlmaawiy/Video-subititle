// app/api/subscription-debug/route.ts
import { NextResponse } from 'next/server';
import { auth } from '@/app/api/auth/[...nextauth]/route';
import { getAdminSupabase } from '@/lib/admin-supabase';

export async function GET() {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const userId = session.user.id;
        const adminSupabase = getAdminSupabase();

        // Try to get the subscription directly
        const { data: directSub, error: directError } = await adminSupabase
            .from('user_subscriptions')
            .select('*')
            .eq('user_id', userId)
            .single();

        // Also check if there are any subscriptions at all
        const { data: allSubs, error: allError } = await adminSupabase
            .from('user_subscriptions')
            .select('id, user_id, plan_id, status')
            .limit(10);

        // Try a fuzzy search on user ID
        const { data: fuzzySubs, error: fuzzyError } = await adminSupabase
            .from('user_subscriptions')
            .select('id, user_id, plan_id, status')
            .like('user_id', `%${userId.substring(0, 10)}%`)
            .limit(5);

        return NextResponse.json({
            userId,
            directSubscription: {
                found: !!directSub,
                error: directError ? directError.message : null,
                data: directSub
            },
            allSubscriptions: {
                count: allSubs?.length || 0,
                error: allError ? allError.message : null,
                data: allSubs
            },
            fuzzySearch: {
                count: fuzzySubs?.length || 0,
                error: fuzzyError ? fuzzyError.message : null,
                data: fuzzySubs
            }
        });
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}