// app/api/debug-user/route.ts
import { NextResponse } from 'next/server';
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { getAdminSupabase } from '@/lib/admin-supabase';

export async function GET(request: Request) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const userId = session.user.id;
        const adminSupabase = getAdminSupabase();

        // Get URL parameters
        const { searchParams } = new URL(request.url);
        const searchUserId = searchParams.get('userId') || userId;

        // Get the user's profile
        const { data: profileData, error: profileError } = await adminSupabase
            .from('profiles')
            .select('*')
            .eq('id', searchUserId)
            .single();

        // Get the user's subscription
        const { data: directSubscription, error: subError } = await adminSupabase
            .from('user_subscriptions')
            .select('*')
            .eq('user_id', searchUserId)
            .single();

        // Get all subscriptions (for admins)
        const { data: allSubscriptions, error: allSubsError } = await adminSupabase
            .from('user_subscriptions')
            .select('id, user_id, plan_id, status')
            .limit(10);

        // Try fuzzy search by user ID if specified user wasn't found
        let fuzzySearch = null;
        if (searchUserId !== userId && (profileError || subError)) {
            const { data: fuzzyData, error: fuzzyError } = await adminSupabase
                .from('profiles')
                .select('*')
                .filter('id', 'ilike', `%${searchUserId}%`)
                .limit(5);

            fuzzySearch = {
                count: fuzzyData?.length || 0,
                error: fuzzyError?.message || null,
                data: fuzzyData
            };
        }

        return NextResponse.json({
            userId: searchUserId,
            directSubscription: {
                found: !subError,
                error: subError?.message || null,
                data: directSubscription
            },
            allSubscriptions: {
                count: allSubscriptions?.length || 0,
                error: allSubsError?.message || null,
                data: allSubscriptions
            },
            profile: {
                found: !profileError,
                error: profileError?.message || null,
                data: profileData
            },
            fuzzySearch: fuzzySearch
        });
    } catch (error) {
        console.error('Error in debug-user:', error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}