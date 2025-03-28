// app/api/subscription-debug/route.ts
import { NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/admin-supabase';
import { auth } from "@/app/api/auth/[...nextauth]/route";

// Force dynamic API route
export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
    try {
        // Get current user
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const userId = session.user.id;

        // Get admin Supabase client
        const adminSupabase = getAdminSupabase();

        console.log(`📋 Running subscription debug for user: ${userId}`);

        // Check if the user exists in profiles table first
        console.log(`🔍 Checking if user ${userId} exists in profiles table...`);
        const { error: userCheckError } = await adminSupabase
            .from('profiles')
            .select('id')
            .eq('id', userId)
            .single();

        // If user doesn't exist, create it
        if (userCheckError && userCheckError.code === 'PGRST116') {
            // PGRST116 means no rows found
            console.log(`⚠️ User ${userId} not found in profiles table. Creating user profile...`);
            const { data: newUser, error: createError } = await adminSupabase
                .from('profiles')
                .insert({
                    id: userId,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .select();

            if (createError) {
                console.error('❌ Error creating user profile:', createError);
                return NextResponse.json({ success: false, error: 'Failed to create user profile' }, { status: 500 });
            }

            console.log('✅ Created user profile:', newUser);
        } else if (userCheckError) {
            // Some other error occurred checking for the user
            console.error('❌ Error checking for user profile:', userCheckError);
            return NextResponse.json({ success: false, error: userCheckError.message }, { status: 500 });
        } else {
            console.log(`✅ User ${userId} exists in profiles table`);
        }

        // Try to directly update subscription to Pro plan
        const testData = {
            user_id: userId,
            plan_id: 'pro',
            status: 'active',
            billing_cycle: 'monthly',
            next_billing_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            updated_at: new Date().toISOString(),
            created_at: new Date().toISOString()
        };

        console.log('📋 Test data for update:', testData);

        // Attempt to update the subscription
        const { data, error } = await adminSupabase
            .from('user_subscriptions')
            .upsert(testData, { onConflict: 'user_id' })
            .select();

        if (error) {
            console.error('❌ Database update error:', error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        console.log('✅ Subscription updated in database:', data);

        // Try to fetch the updated subscription
        const { data: fetchedData, error: fetchError } = await adminSupabase
            .from('user_subscriptions')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (fetchError) {
            console.error('❌ Error fetching updated subscription:', fetchError);
        } else {
            console.log('📋 Current subscription in database:', fetchedData);
        }

        return NextResponse.json({
            success: true,
            message: 'Debug operation completed successfully',
            updatedData: data,
            currentSubscription: fetchedData || null
        });
    } catch (error) {
        console.error('❌ Subscription debug error:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}