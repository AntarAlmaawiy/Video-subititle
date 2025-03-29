// app/api/webhook-test/route.ts
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getAdminSupabase } from '@/lib/admin-supabase';

// Force dynamic API route
export const dynamic = 'force-dynamic';

// Use test key for this endpoint
const stripeTestSecretKey = process.env.STRIPE_TEST_SECRET_KEY || '';
const stripeTestWebhookSecret = process.env.STRIPE_TEST_WEBHOOK_SECRET || '';

const stripe = new Stripe(stripeTestSecretKey, {
    apiVersion: '2025-02-24.acacia',
});

export async function POST(request: Request): Promise<NextResponse> {
    console.log(`🔔 TEST Webhook received at:`, new Date().toISOString());

    try {
        const body = await request.text();
        const signature = request.headers.get('stripe-signature') || '';

        console.log(`📋 Webhook signature: ${signature.substring(0, 20)}...`);
        console.log(`📋 Webhook body length: ${body.length} characters`);

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
        console.log(`📋 Event received: ${event.type}`);
        console.log(`📋 Event data:`, JSON.stringify(event.data.object, null, 2));

        // Process checkout.session.completed event to update user subscription
        if (event.type === 'checkout.session.completed') {
            const session = event.data.object as Stripe.Checkout.Session;
            console.log(`🔄 Processing TEST checkout.session.completed, ID: ${session.id}`);
            console.log(`📋 Session metadata:`, session.metadata);

            // Extract important information
            const userId = session.metadata?.userId;
            const planId = session.metadata?.planId;
            const billingCycle = session.metadata?.billingCycle || 'monthly';
            const subscriptionId = session.subscription ? String(session.subscription) : '';
            const customerId = session.customer ? String(session.customer) : '';

            console.log(`User ID: ${userId}, Plan ID: ${planId}`);
            console.log(`Subscription ID: ${subscriptionId}, Customer ID: ${customerId}`);

            if (!userId || !planId || !subscriptionId) {
                console.error('❌ Missing required metadata in checkout session');
                return NextResponse.json({
                    message: 'Missing required information in checkout session'
                }, { status: 200 });
            }

            try {
                // First check if user exists in profiles table
                console.log(`🔍 Checking if user ${userId} exists in profiles table`);
                const { error: profileError } = await adminSupabase
                    .from('profiles')
                    .select('id')
                    .eq('id', userId)
                    .single();

                if (profileError) {
                    console.log('⚠️ User profile not found, creating it...');

                    // Try to get user info from auth session metadata
                    const userEmail = session.customer_details?.email ||
                        session.metadata?.userEmail ||
                        'user@example.com';

                    const userName = session.customer_details?.name ||
                        session.metadata?.userName ||
                        userEmail.split('@')[0];

                    // Create profile
                    const { error: createProfileError } = await adminSupabase
                        .from('profiles')
                        .insert({
                            id: userId,
                            username: userName || `user_${userId.slice(0, 8)}`,
                            email: userEmail,
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString()
                        });

                    if (createProfileError) {
                        console.error('❌ Error creating profile:', createProfileError);
                        return NextResponse.json({ message: 'Failed to create user profile' }, { status: 200 });
                    }

                    console.log('✅ Created new profile for user');
                }

                // Next, check if the user already has a subscription record
                console.log(`🔍 Checking if user ${userId} already has a subscription record`);
                const { data: existingSubscription } = await adminSupabase
                    .from('user_subscriptions')
                    .select('id, plan_id, status')
                    .eq('user_id', userId)
                    .single();

                // Get subscription details from Stripe
                console.log(`🔍 Retrieving subscription ${subscriptionId} from Stripe...`);
                const subscription = await stripe.subscriptions.retrieve(subscriptionId);

                console.log(`✅ Retrieved subscription from Stripe:`, {
                    id: subscription.id,
                    status: subscription.status,
                    current_period_end: subscription.current_period_end
                });

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

                if (existingSubscription) {
                    console.log(`🔄 Updating existing subscription with ID: ${existingSubscription.id}`);
                    // Update using the record ID instead of relying on user_id
                    const { data, error } = await adminSupabase
                        .from('user_subscriptions')
                        .update(subscriptionData)
                        .eq('id', existingSubscription.id)
                        .select();

                    if (error) {
                        console.error('❌ Error updating subscription by ID:', error);
                        // Fallback to user_id update
                        console.log('⚠️ Falling back to user_id update');
                        const { data: fallbackData, error: fallbackError } = await adminSupabase
                            .from('user_subscriptions')
                            .update(subscriptionData)
                            .eq('user_id', userId)
                            .select();

                        if (fallbackError) {
                            console.error('❌ Fallback update also failed:', fallbackError);
                            return NextResponse.json({ message: 'Database update failed' }, { status: 200 });
                        }
                        result = fallbackData;
                    } else {
                        result = data;
                    }
                } else {
                    console.log(`🆕 Creating new subscription for user ${userId}`);
                    // Add created_at for new records
                    const newSubscriptionData = {
                        ...subscriptionData,
                        created_at: new Date().toISOString()
                    };

                    const { data, error } = await adminSupabase
                        .from('user_subscriptions')
                        .insert(newSubscriptionData)
                        .select();

                    if (error) {
                        console.error('❌ Error creating subscription:', error);
                        console.error('❌ Error details:', {
                            code: error.code,
                            message: error.message,
                            details: error.details,
                            hint: error.hint
                        });

                        return NextResponse.json({ message: 'Database update failed' }, { status: 200 });
                    } else {
                        result = data;
                    }
                }

                console.log('✅ Subscription updated in database:', result);

                // Double-check the database to ensure it's updated
                const { data: checkData, error: checkError } = await adminSupabase
                    .from('user_subscriptions')
                    .select('*')
                    .eq('user_id', userId)
                    .single();

                if (checkError) {
                    console.error('❌ Error checking updated subscription:', checkError);
                } else {
                    console.log('📋 Verified subscription in database:', checkData);
                }

                return NextResponse.json({
                    success: true,
                    message: 'Subscription updated',
                    data: result
                });
            } catch (err) {
                console.error('❌ Error processing checkout session:', err);
                return NextResponse.json({ message: 'Error processing checkout' }, { status: 200 });
            }
        }

        // Always return 200 OK to acknowledge receipt
        return NextResponse.json({ received: true, success: true });
    } catch (error) {
        console.error('❌ TEST Webhook error:', error);
        // Return 200 status code to acknowledge receipt to Stripe
        return NextResponse.json({ received: true, error: String(error) }, { status: 200 });
    }
}