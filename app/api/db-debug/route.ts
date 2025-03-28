// app/api/db-debug/route.ts
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

        console.log(`📋 Running direct database debug for user: ${userId}`);

        // 1. First, check if the user exists in both auth.users and profiles
        console.log(`📋 Checking user existence`);

        // Check in profiles table
        const { data: profileData, error: profileError } = await adminSupabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (profileError) {
            console.error('❌ Error or user not found in profiles table:', profileError);
        } else {
            console.log('✅ User found in profiles table:', profileData);
        }

        // 2. Try a direct SQL query to debug the foreign key constraint
        const { data: sqlResult, error: sqlError } = await adminSupabase.rpc(
            'exec_sql',
            { sql: `
                SELECT
                    EXISTS(SELECT 1 FROM auth.users WHERE id = '${userId}') as auth_exists,
                    EXISTS(SELECT 1 FROM profiles WHERE id = '${userId}') as profile_exists,
                    conname, conrelid::regclass AS table_name, a.attname AS column_name,
                    confrelid::regclass AS foreign_table_name, af.attname AS foreign_column_name
                FROM pg_constraint c
                JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
                JOIN pg_attribute af ON af.attnum = ANY(c.confkey) AND af.attrelid = c.confrelid
                WHERE c.contype = 'f' AND c.conrelid = 'user_subscriptions'::regclass::oid;
            ` }
        );

        if (sqlError) {
            console.error('❌ SQL debug query error:', sqlError);
        } else {
            console.log('📋 SQL debug results:', sqlResult);
        }

        // 3. Try a direct insert using SQL
        console.log(`📋 Attempting direct SQL insert of subscription`);

        const insertResult = await adminSupabase.rpc(
            'exec_sql',
            { sql: `
                INSERT INTO user_subscriptions (
                    user_id, plan_id, status, billing_cycle, next_billing_date, created_at, updated_at
                ) VALUES (
                    '${userId}', 'pro', 'active', 'monthly', 
                    (CURRENT_DATE + INTERVAL '30 days')::date, 
                    now(), now()
                )
                ON CONFLICT (user_id) 
                DO UPDATE SET 
                    plan_id = 'pro',
                    status = 'active',
                    updated_at = now(),
                    next_billing_date = (CURRENT_DATE + INTERVAL '30 days')::date
                RETURNING *;
            ` }
        );

        console.log('📋 Direct SQL insert result:', insertResult);

        return NextResponse.json({
            success: true,
            message: 'Database debugging completed',
            profileCheck: {
                exists: !profileError,
                data: profileData || null,
                error: profileError ? profileError.message : null
            },
            sqlDebug: sqlResult || null,
            directInsert: insertResult || null
        });
    } catch (error) {
        console.error('❌ Database debug error:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}