// app/api/debug-database/route.ts
import { NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/admin-supabase';

export async function GET() {
    try {
        const adminSupabase = getAdminSupabase();

        // Check user_subscriptions table structure
        const { data: tableInfo, error: tableError } = await adminSupabase
            .rpc('table_info', { table_name: 'user_subscriptions' });

        // Get any primary key constraints
        const { data: primaryKeys, error: pkError } = await adminSupabase
            .from('information_schema.table_constraints')
            .select('constraint_name, table_name')
            .eq('table_name', 'user_subscriptions')
            .eq('constraint_type', 'PRIMARY KEY');

        // Get foreign key constraints
        const { data: foreignKeys, error: fkError } = await adminSupabase
            .from('information_schema.table_constraints')
            .select('constraint_name, table_name')
            .eq('table_name', 'user_subscriptions')
            .eq('constraint_type', 'FOREIGN KEY');

        // Check most recent subscription updates
        const { data: recentSubs, error: recentError } = await adminSupabase
            .from('user_subscriptions')
            .select('*')
            .order('updated_at', { ascending: false })
            .limit(5);

        return NextResponse.json({
            tableStructure: tableInfo || [],
            primaryKeys: primaryKeys || [],
            foreignKeys: foreignKeys || [],
            recentSubscriptions: recentSubs || [],
            errors: {
                tableError: tableError?.message,
                pkError: pkError?.message,
                fkError: fkError?.message,
                recentError: recentError?.message
            }
        });
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}