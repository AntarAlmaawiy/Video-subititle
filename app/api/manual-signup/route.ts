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

        // Use admin client to bypass triggers
        console.log('Creating Supabase admin client');
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

        // Step 1: Create the auth user
        console.log('Creating user in Supabase Auth');
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

        // Step 2: Check if profile exists (may be created by trigger)
        console.log('Checking if profile exists');
        const { data: existingProfile, error: profileCheckError } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .eq('id', userId)
            .single();

        if (profileCheckError && profileCheckError.code !== 'PGRST116') {
            console.error('Error checking profile:', profileCheckError);
        }

        // Create profile if it doesn't exist
        if (!existingProfile) {
            console.log('Profile not found, creating manually');

            try {
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
                    console.error('Profile error details:', {
                        code: profileError.code,
                        message: profileError.message,
                        details: profileError.details,
                        hint: profileError.hint
                    });
                    // We'll still try to continue with subscription
                } else {
                    console.log('Profile created successfully');
                }
            } catch (profileInsertError) {
                console.error('Exception during profile insert:', profileInsertError);
                // Continue to subscription step
            }
        } else {
            console.log('Profile already exists, skipping creation');
        }

        // Step 3: Check if subscription exists (may be created by trigger)
        console.log('Checking if subscription exists');
        const { data: existingSubscription, error: subCheckError } = await supabaseAdmin
            .from('user_subscriptions')
            .select('user_id')
            .eq('user_id', userId)
            .single();

        if (subCheckError && subCheckError.code !== 'PGRST116') {
            console.error('Error checking subscription:', subCheckError);
        }

        // Create subscription if it doesn't exist
        if (!existingSubscription) {
            console.log('Subscription not found, creating manually');

            try {
                // Generate next billing date (30 days from now)
                const nextBillingDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                console.log(`Setting next billing date to: ${nextBillingDate}`);

                const { error: subscriptionError } = await supabaseAdmin
                    .from('user_subscriptions')
                    .insert({
                        user_id: userId,
                        plan_id: 'free',
                        status: 'active',
                        next_billing_date: nextBillingDate,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    });

                if (subscriptionError) {
                    console.error('Error creating subscription:', subscriptionError);
                    console.error('Subscription error details:', {
                        code: subscriptionError.code,
                        message: subscriptionError.message,
                        details: subscriptionError.details,
                        hint: subscriptionError.hint
                    });
                    // Continue anyway
                } else {
                    console.log('Subscription created successfully');
                }
            } catch (subInsertError) {
                console.error('Exception during subscription insert:', subInsertError);
            }
        } else {
            console.log('Subscription already exists, skipping creation');
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