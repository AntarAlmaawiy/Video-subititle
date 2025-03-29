// app/api/db-debug/route.ts
import { NextResponse } from 'next/server';
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { getAdminSupabase } from '@/lib/admin-supabase';

export async function GET() {
    try {
        // Get the user session
        const session = await auth();

        if (!session || !session.user) {
            return NextResponse.json(
                { message: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Now TypeScript knows session and session.user are not null
        const userId = session.user.id;
        console.log(`Running DB fix for user: ${userId}`);

        // Get admin Supabase client
        const adminSupabase = getAdminSupabase();

        // First, check if there's already a record with subscription data
        const { data: userSub, error: fetchError } = await adminSupabase
            .from('user_subscriptions')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

        if (fetchError) {
            console.error('Error fetching subscription:', fetchError);
            return NextResponse.json(
                { message: 'Error fetching subscription data', error: fetchError },
                { status: 500 }
            );
        }

        // Step 1: Update the existing record with correct plan_id
        if (userSub) {
            const { error: updateError } = await adminSupabase
                .from('user_subscriptions')
                .update({
                    plan_id: userSub.plan_id || 'pro', // Use existing or set to 'pro'
                    status: 'active',
                    updated_at: new Date().toISOString()
                })
                .eq('user_id', userId);

            if (updateError) {
                console.error('Error updating subscription:', updateError);
                return NextResponse.json(
                    { message: 'Error updating subscription', error: updateError },
                    { status: 500 }
                );
            }

            // Verify the update was successful
            const { data: verifyData } = await adminSupabase
                .from('user_subscriptions')
                .select('*')
                .eq('user_id', userId)
                .single();

            return NextResponse.json({
                success: true,
                message: 'Subscription repaired',
                before: userSub,
                after: verifyData
            });
        } else {
            // If no subscription found, create one with pro plan
            const { data: insertData, error: insertError } = await adminSupabase
                .from('user_subscriptions')
                .insert({
                    user_id: userId,
                    plan_id: 'pro',
                    status: 'active',
                    next_billing_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .select();

            if (insertError) {
                console.error('Error creating subscription:', insertError);
                return NextResponse.json(
                    { message: 'Error creating subscription', error: insertError },
                    { status: 500 }
                );
            }

            return NextResponse.json({
                success: true,
                message: 'New subscription created',
                subscription: insertData
            });
        }
    } catch (error) {
        console.error('Error in DB debug endpoint:', error);
        return NextResponse.json(
            { message: 'Server error', error: String(error) },
            { status: 500 }
        );
    }
}