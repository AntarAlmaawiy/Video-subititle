// app/api/manual-signup/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';

export async function POST(request: Request) {
    try {
        const { email, password, username } = await request.json();

        if (!email || !password || !username) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Use admin client to bypass triggers
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

        // Step 1: Create the user directly
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true
        });

        if (error) {
            console.error('Error creating user:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        if (!data.user) {
            return NextResponse.json({ error: 'No user created' }, { status: 500 });
        }

        const userId = data.user.id;

        // Step 2: Create profile manually
        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .insert({
                id: userId,
                username,
                email,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });

        if (profileError) {
            console.error('Error creating profile:', profileError);
            // Continue anyway
        }

        // Step 3: Create subscription manually
        const { error: subscriptionError } = await supabaseAdmin
            .from('user_subscriptions')
            .insert({
                user_id: userId,
                plan_id: 'free',
                status: 'active',
                next_billing_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });

        if (subscriptionError) {
            console.error('Error creating subscription:', subscriptionError);
            // Continue anyway
        }

        return NextResponse.json({
            success: true,
            user: {
                id: userId,
                email: email
            }
        });

    } catch (error) {
        console.error('Server error in manual signup:', error);
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'An unknown error occurred'
        }, {
            status: 500
        });
    }
}