// app/api/webhook-test/route.ts
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getAdminSupabase } from '@/lib/admin-supabase';

// Force dynamic API route
export const dynamic = 'force-dynamic';

// Use test key for this endpoint
const stripeTestSecretKey = process.env.STRIPE_TEST_SECRET_KEY || '';
const stripeTestWebhookSecret = process.env.STRIPE_TEST_WEBHOOK_SECRET || '';

// Be sure to use the TEST keys consistently
const stripe = new Stripe(stripeTestSecretKey, {
    apiVersion: '2025-02-24.acacia',
});

export async function POST(request: Request): Promise<NextResponse> {
    console.log(`🔔 TEST Webhook received at:`, new Date().toISOString());

    try {
        const body = await request.text();
        const signature = request.headers.get('stripe-signature') || '';

        console.log(`📋 TEST Webhook signature: ${signature.substring(0, 20)}...`);
        console.log(`📋 TEST Webhook body length: ${body.length} characters`);

        if (!stripeTestWebhookSecret) {
            console.error('❌ Missing STRIPE_TEST_WEBHOOK_SECRET environment variable');
            return NextResponse.json({ message: 'Test webhook secret is not configured' }, { status: 200 });
        }

        // Verify the webhook signature
        let event: Stripe.Event;
        try {
            event = stripe.webhooks.constructEvent(body, signature, stripeTestWebhookSecret);
            console.log(`✅ Test webhook signature verified. Event type: ${event.type}`);
        } catch (err) {
            console.error(`❌ Test webhook signature verification failed:`, err);
            return NextResponse.json({ message: `Test webhook signature verification failed` }, { status: 200 });
        }

        // Get admin Supabase client
        const adminSupabase = getAdminSupabase();
        console.log(`📋 TEST Event received: ${event.type}`);

        // Process checkout.session.completed event to update user subscription
        if (event.type === 'checkout.session.completed') {
            const session = event.data.object as Stripe.Checkout.Session;
            console.log(`🔄 Processing TEST checkout.session.completed, ID: ${session.id}`);
            console.log(`📋 TEST Session metadata:`, session.metadata);

            // Confirm this is a test mode session
            const isTestMode = session.metadata?.testMode === 'true';
            if (!isTestMode) {
                console.log('⚠️ Received live mode session in test webhook, skipping');
                return NextResponse.json({ message: 'Test webhook received live mode session' }, { status: 200 });
            }

            // Extract important information
            const userId = session.metadata?.userId;
            const planId = session.metadata?.planId;
            const billingCycle = session.metadata?.billingCycle || 'monthly';
            const subscriptionId = session.subscription ? String(session.subscription) : '';
            const customerId = session.customer ? String(session.customer) : '';

            console.log(`User ID: ${userId}, Plan ID: ${planId}`);
            console.log(`Subscription ID: ${subscriptionId}, Customer ID: ${customerId}`);

            if (!userId || !planId || !subscriptionId) {
                console.error('❌ Missing required metadata in TEST checkout session');
                return NextResponse.json({
                    message: 'Missing required information in TEST checkout session'
                }, { status: 200 });
            }

            try {
                // First check if user exists in profiles table
                console.log(`🔍 Checking if user ${userId} exists in profiles table`);
                const {  error: profileError } = await adminSupabase
                    .from('profiles')
                    .select('id')
                    .eq('id', userId)
                    .single();

                if (profileError && profileError.code === 'PGRST116') {
                    console.log('⚠️ TEST: User profile not found, creating it...');

                    // Try to get user info from session or Stripe customer
                    let userEmail = 'user@example.com';
                    let userName = '';

                    // Try to get email from checkout session
                    if (session.customer_details?.email) {
                        userEmail = session.customer_details.email;
                        userName = session.customer_details.name || userEmail.split('@')[0];
                    }
                    // If not available, try to get from Stripe customer
                    else if (customerId) {
                        try {
                            const customer = await stripe.customers.retrieve(customerId);
                            if (customer && !customer.deleted) {
                                userEmail = customer.email || userEmail;
                                userName = customer.name || userEmail.split('@')[0];
                            }
                        } catch (customerErr) {
                            console.error('Error retrieving Stripe customer:', customerErr);
                        }
                    }

                    // Create profile
                    const { data: profileData, error: createProfileError } = await adminSupabase
                        .from('profiles')
                        .insert({
                            id: userId,
                            username: userName || `user_${userId.slice(0, 8)}`,
                            email: userEmail,
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString()
                        })
                        .select();

                    if (createProfileError) {
                        console.error('❌ TEST: Error creating profile:', createProfileError);
                        return NextResponse.json({ message: 'Failed to create user profile' }, { status: 200 });
                    }

                    console.log('✅ TEST: Created new profile for user:', profileData);
                } else if (profileError) {
                    console.error('❌ TEST: Error checking user profile:', profileError);
                } else {
                    console.log('✅ TEST: User profile already exists');
                }

                // Get subscription details from Stripe
                console.log(`🔍 TEST: Retrieving subscription ${subscriptionId} from Stripe...`);
                const subscription = await stripe.subscriptions.retrieve(subscriptionId);

                console.log(`✅ TEST: Retrieved subscription from Stripe:`, {
                    id: subscription.id,
                    status: subscription.status,
                    current_period_end: subscription.current_period_end
                });

                // Check if the user already has a subscription record
                console.log(`🔍 TEST: Checking if user ${userId} already has a subscription record`);
                const { data: existingSubscription, error: subError } = await adminSupabase
                    .from('user_subscriptions')
                    .select('id, plan_id, status, stripe_customer_id, stripe_subscription_id')
                    .eq('user_id', userId)
                    .maybeSingle();

                if (subError && subError.code !== 'PGRST116') {
                    console.error('❌ TEST: Error checking existing subscription:', subError);
                }

                console.log('TEST: Existing subscription:', existingSubscription);

                // Prepare subscription data
                const subscriptionData = {
                    user_id: userId,
                    plan_id: planId,
                    status: subscription.status,
                    stripe_subscription_id: subscriptionId,
                    stripe_customer_id: customerId,
                    billing_cycle: billingCycle,
                    next_billing_date: new Date(subscription.current_period_end * 1000).toISOString().split('T')[0],
                    updated_at: new Date().toISOString()
                };

                let result;

                // Check if we need to create or update
                if (existingSubscription) {
                    // If there's an existing subscription, handle test/live mode properly
                    const existingIsTest = existingSubscription.stripe_customer_id?.startsWith('cus_test_') ||
                        existingSubscription.stripe_subscription_id?.startsWith('sub_test_');

                    // Only update if both are test or both are live
                    if (existingIsTest === isTestMode) {
                        console.log(`🔄 TEST: Updating existing subscription for user ${userId}`);

                        // Update existing record
                        const { data, error } = await adminSupabase
                            .from('user_subscriptions')
                            .update(subscriptionData)
                            .eq('user_id', userId)
                            .select();

                        if (error) {
                            console.error('❌ TEST: Error updating subscription:', error);
                            return NextResponse.json({ message: 'Database update failed' }, { status: 200 });
                        }

                        result = data;
                        console.log('✅ TEST: Updated subscription:', result);
                    } else {
                        // Mode mismatch - insert instead to avoid mixing test/live data
                        console.log(`🆕 TEST: Creating new subscription for user ${userId} (mode mismatch)`);

                        // Add created_at for new records
                        const newSubscriptionData = {
                            ...subscriptionData,
                            created_at: new Date().toISOString()
                        };

                        // Delete existing record with mode mismatch
                        console.log('TEST: Deleting existing subscription with mode mismatch');
                        const { error: deleteError } = await adminSupabase
                            .from('user_subscriptions')
                            .delete()
                            .eq('user_id', userId);

                        if (deleteError) {
                            console.error('❌ TEST: Error deleting existing subscription:', deleteError);
                        }

                        // Insert new record
                        const { data, error } = await adminSupabase
                            .from('user_subscriptions')
                            .insert(newSubscriptionData)
                            .select();

                        if (error) {
                            console.error('❌ TEST: Error creating subscription:', error);
                            console.error('❌ TEST: Error details:', {
                                code: error.code,
                                message: error.message,
                                details: error.details,
                                hint: error.hint
                            });

                            return NextResponse.json({ message: 'Database insert failed' }, { status: 200 });
                        }

                        result = data;
                        console.log('✅ TEST: Created new subscription:', result);
                    }
                } else {
                    console.log(`🆕 TEST: Creating new subscription for user ${userId}`);

                    // Add created_at for new records
                    const newSubscriptionData = {
                        ...subscriptionData,
                        created_at: new Date().toISOString()
                    };

                    // Insert new record
                    const { data, error } = await adminSupabase
                        .from('user_subscriptions')
                        .insert(newSubscriptionData)
                        .select();

                    if (error) {
                        console.error('❌ TEST: Error creating subscription:', error);
                        console.error('❌ TEST: Error details:', {
                            code: error.code,
                            message: error.message,
                            details: error.details,
                            hint: error.hint
                        });

                        return NextResponse.json({ message: 'Database insert failed' }, { status: 200 });
                    }

                    result = data;
                    console.log('✅ TEST: Created new subscription:', result);
                }

                // Double-check the database to ensure it's updated
                console.log('TEST: Verifying database update');
                const { data: checkData, error: checkError } = await adminSupabase
                    .from('user_subscriptions')
                    .select('*')
                    .eq('user_id', userId)
                    .single();

                if (checkError) {
                    console.error('❌ TEST: Error checking updated subscription:', checkError);
                } else {
                    console.log('📋 TEST: Verified subscription in database:', checkData);
                }

                return NextResponse.json({
                    success: true,
                    message: 'TEST: Subscription updated',
                    data: result
                });
            } catch (err) {
                console.error('❌ TEST: Error processing checkout session:', err);
                return NextResponse.json({ message: 'Error processing checkout' }, { status: 200 });
            }
        }
        // Handle subscription updated event
        else if (event.type === 'customer.subscription.updated') {
            const subscription = event.data.object as Stripe.Subscription;
            console.log(`🔄 TEST: Processing customer.subscription.updated, ID: ${subscription.id}`);

            // Check if we can identify the user from this subscription
            try {
                // Find the user from our database using subscription ID
                const { data: subData, error: subError } = await adminSupabase
                    .from('user_subscriptions')
                    .select('user_id, plan_id')
                    .eq('stripe_subscription_id', subscription.id)
                    .single();

                if (subError) {
                    console.error('❌ TEST: Error finding user for subscription:', subError);
                    return NextResponse.json({ message: 'User not found for subscription' }, { status: 200 });
                }

                if (!subData || !subData.user_id) {
                    console.error('❌ TEST: No user found for subscription ID:', subscription.id);
                    return NextResponse.json({ message: 'No user found for subscription' }, { status: 200 });
                }

                console.log(`📋 TEST: Found user ${subData.user_id} for subscription ${subscription.id}`);

                // Determine if subscription is being canceled at period end
                const status = subscription.cancel_at_period_end ? 'canceled' : subscription.status;

                // Update the subscription in database
                const { data, error } = await adminSupabase
                    .from('user_subscriptions')
                    .update({
                        status: status,
                        next_billing_date: new Date(subscription.current_period_end * 1000).toISOString().split('T')[0],
                        updated_at: new Date().toISOString()
                    })
                    .eq('user_id', subData.user_id)
                    .eq('stripe_subscription_id', subscription.id)
                    .select();

                if (error) {
                    console.error('❌ TEST: Error updating subscription status:', error);
                    return NextResponse.json({ message: 'Error updating subscription' }, { status: 200 });
                }

                console.log('✅ TEST: Subscription status updated in database:', data);

                return NextResponse.json({
                    success: true,
                    message: 'TEST: Subscription status updated'
                });
            } catch (err) {
                console.error('❌ TEST: Error processing subscription update:', err);
                return NextResponse.json({ message: 'Error processing update' }, { status: 200 });
            }
        }
        // Handle subscription deleted event
        else if (event.type === 'customer.subscription.deleted') {
            const subscription = event.data.object as Stripe.Subscription;
            console.log(`🔄 TEST: Processing customer.subscription.deleted, ID: ${subscription.id}`);

            try {
                // Find the user from our database using subscription ID
                const { data: subData, error: subError } = await adminSupabase
                    .from('user_subscriptions')
                    .select('user_id')
                    .eq('stripe_subscription_id', subscription.id)
                    .single();

                if (subError) {
                    console.error('❌ TEST: Error finding user for deleted subscription:', subError);
                    return NextResponse.json({ message: 'User not found for subscription' }, { status: 200 });
                }

                // Downgrade to free plan
                const { data, error } = await adminSupabase
                    .from('user_subscriptions')
                    .update({
                        plan_id: 'free',
                        status: 'canceled',
                        stripe_subscription_id: null,
                        updated_at: new Date().toISOString()
                    })
                    .eq('user_id', subData.user_id)
                    .eq('stripe_subscription_id', subscription.id)
                    .select();

                if (error) {
                    console.error('❌ TEST: Error downgrading to free plan:', error);
                    return NextResponse.json({ message: 'Error downgrading subscription' }, { status: 200 });
                }

                console.log('✅ TEST: User downgraded to free plan:', data);

                return NextResponse.json({
                    success: true,
                    message: 'TEST: Subscription deleted and plan downgraded to free'
                });
            } catch (err) {
                console.error('❌ TEST: Error processing subscription deletion:', err);
                return NextResponse.json({ message: 'Error processing deletion' }, { status: 200 });
            }
        }

        // Always return 200 OK to acknowledge receipt
        return NextResponse.json({ received: true, success: true });
    } catch (error) {
        console.error('❌ TEST Webhook error:', error);
        // Return 200 status code to acknowledge receipt to Stripe
        return NextResponse.json({ received: true, error: String(error) }, { status: 200 });
    }}