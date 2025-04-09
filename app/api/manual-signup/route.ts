// app/api/manual-signup/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';

export async function POST(request: Request) {
    console.log('Manual signup process started');

    try {
        const { email, password, username } = await request.json();
        console.log('Received signup data:', { email, usernameProvided: !!username });

        if (!email || !password || !username) {
            console.log('Missing required fields');
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Use admin client
        console.log('Creating Supabase admin client');
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            }
        });

        console.log('Creating user with admin API');
        // Create the user directly with admin API
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: {
                username
            }
        });

        if (error) {
            console.error('Error creating user in Auth:', error);
            return NextResponse.json({ error: `Auth error: ${error.message}` }, { status: 500 });
        }

        if (!data.user) {
            console.error('No user data returned from auth creation');
            return NextResponse.json({ error: 'No user created' }, { status: 500 });
        }

        const userId = data.user.id;
        console.log(`User created successfully with ID: ${userId}`);

        // Try to create profile manually
        const timestamp = new Date().toISOString();
        console.log('Creating profile for user');
        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .insert({
                id: userId,
                username,
                email,
                created_at: timestamp,
                updated_at: timestamp
            });

        if (profileError) {
            console.error('Error creating profile:', profileError);
            // Continue anyway
        } else {
            console.log('Profile created successfully');
        }

        // Try to create subscription manually
        console.log('Creating subscription for user');
        const nextBillingDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const { error: subscriptionError } = await supabaseAdmin
            .from('user_subscriptions')
            .insert({
                user_id: userId,
                plan_id: 'free',
                status: 'active',
                next_billing_date: nextBillingDate,
                created_at: timestamp,
                updated_at: timestamp
            });

        if (subscriptionError) {
            console.error('Error creating subscription:', subscriptionError);
            // Continue anyway
        } else {
            console.log('Subscription created successfully');
        }

        console.log('Signup process completed successfully');
        return NextResponse.json({
            success: true,
            user: {
                id: userId,
                email: email
            }
        });

    } catch (error) {
        console.error('Unhandled exception in manual signup:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        console.error(`Error message: ${errorMessage}`);

        return NextResponse.json({
            error: errorMessage
        }, {
            status: 500
        });
    }
}