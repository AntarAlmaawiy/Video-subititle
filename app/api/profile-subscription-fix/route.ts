// app/api/profile-subscription-fix/route.ts
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

        // First check if the user exists in profiles
        const { data: profile, error: profileError } = await adminSupabase
            .from('profiles')
            .select('id, username, email')
            .eq('id', userId)
            .single();

        if (profileError) {
            return NextResponse.json({
                error: `Profile check error: ${profileError.message}`,
                errorDetails: profileError
            }, { status: 500 });
        }

        if (!profile) {
            return NextResponse.json({ error: 'User not found in profiles table' }, { status: 404 });
        }

        console.log('Profile found:', profile);

        // Now try to upsert the subscription
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
                errorDetails: subscriptionError
            }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            profile,
            subscription
        });
    } catch (error) {
        console.error('Error fixing subscription:', error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}