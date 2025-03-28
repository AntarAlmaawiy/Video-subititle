// app/api/webhook/route.ts
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getAdminSupabase } from '@/lib/admin-supabase';

// Force dynamic API route
export const dynamic = 'force-dynamic';

// Initialize Stripe with the correct live key
const stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

const stripe = new Stripe(stripeSecretKey, {
    apiVersion: '2025-02-24.acacia',
});

export async function POST(request: Request): Promise<NextResponse> {
    try {
        console.log(`🔔 Webhook received at:`, new Date().toISOString());

        const body = await request.text();
        const signature = request.headers.get('stripe-signature') || '';

        if (!stripeWebhookSecret) {
            console.error('❌ Missing STRIPE_WEBHOOK_SECRET environment variable');
            return NextResponse.json({ message: 'Webhook secret is not configured' }, { status: 200 });
        }

        let event: Stripe.Event;

        try {
            event = stripe.webhooks.constructEvent(body, signature, stripeWebhookSecret);
            console.log(`✅ Webhook signature verified. Event type: ${event.type}`);
        } catch (err) {
            console.error(`❌ Webhook signature verification failed:`, err);
            return NextResponse.json({ message: `Webhook signature verification failed` }, { status: 200 });
        }

        // Get admin Supabase client
        const adminSupabase = getAdminSupabase();

        // Handle different event types
        console.log(`📋 Event received: ${event.type}`);

        // Process checkout.session.completed event to update user subscription
        if (event.type === 'checkout.session.completed') {
            const session = event.data.object as Stripe.Checkout.Session;
            console.log(`🔄 Processing checkout.session.completed, ID: ${session.id}`);
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
                // CRITICAL: Check if the user exists in profiles table
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
                        return NextResponse.json({ message: 'Failed to create user profile' }, { status: 200 });
                    }

                    console.log('✅ Created user profile:', newUser);
                } else if (userCheckError) {
                    console.error('❌ Error checking for user profile:', userCheckError);
                    return NextResponse.json({ message: 'Error checking user profile' }, { status: 200 });
                } else {
                    console.log(`✅ User ${userId} exists in profiles table`);
                }

                // Get subscription details from Stripe
                const subscription = await stripe.subscriptions.retrieve(subscriptionId);

                console.log(`📋 Retrieved subscription from Stripe:`, {
                    id: subscription.id,
                    status: subscription.status,
                    current_period_end: subscription.current_period_end
                });

                // Update or create user subscription in database
                const subscriptionData = {
                    user_id: userId,
                    plan_id: planId,
                    status: subscription.status,
                    stripe_subscription_id: subscriptionId,
                    stripe_customer_id: customerId,
                    billing_cycle: billingCycle,
                    next_billing_date: new Date(subscription.current_period_end * 1000).toISOString().split('T')[0],
                    updated_at: new Date().toISOString(),
                    created_at: new Date().toISOString()
                };

                console.log(`📋 Updating subscription in database:`, subscriptionData);

                const { data, error } = await adminSupabase
                    .from('user_subscriptions')
                    .upsert(subscriptionData, { onConflict: 'user_id' })
                    .select();

                if (error) {
                    console.error('❌ Database update error:', error);
                    return NextResponse.json({ message: 'Database update failed' }, { status: 200 });
                }

                console.log('✅ Subscription updated in database:', data);

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
            } catch (err) {
                console.error('❌ Error processing checkout session:', err);
                return NextResponse.json({ message: 'Error processing checkout' }, { status: 200 });
            }
        }
        // Handle subscription updated event
        else if (event.type === 'customer.subscription.updated') {
            const subscription = event.data.object as Stripe.Subscription;
            console.log(`🔄 Processing customer.subscription.updated, ID: ${subscription.id}`);

            // Check if we can identify the user from this subscription
            try {
                // First try to find the user from our database using subscription ID
                const { data: subData, error: subError } = await adminSupabase
                    .from('user_subscriptions')
                    .select('user_id, plan_id')
                    .eq('stripe_subscription_id', subscription.id)
                    .single();

                if (subError) {
                    console.error('❌ Error finding user for subscription:', subError);
                    return NextResponse.json({ message: 'User not found for subscription' }, { status: 200 });
                }

                if (!subData || !subData.user_id) {
                    console.error('❌ No user found for subscription ID:', subscription.id);
                    return NextResponse.json({ message: 'No user found for subscription' }, { status: 200 });
                }

                console.log(`📋 Found user ${subData.user_id} for subscription ${subscription.id}`);

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
                    .select();

                if (error) {
                    console.error('❌ Error updating subscription status:', error);
                    return NextResponse.json({ message: 'Error updating subscription' }, { status: 200 });
                }

                console.log('✅ Subscription status updated in database:', data);
            } catch (err) {
                console.error('❌ Error processing subscription update:', err);
                return NextResponse.json({ message: 'Error processing update' }, { status: 200 });
            }
        }
        // Handle subscription deleted event
        else if (event.type === 'customer.subscription.deleted') {
            const subscription = event.data.object as Stripe.Subscription;
            console.log(`🔄 Processing customer.subscription.deleted, ID: ${subscription.id}`);

            try {
                // Find the user from our database using subscription ID
                const { data: subData, error: subError } = await adminSupabase
                    .from('user_subscriptions')
                    .select('user_id')
                    .eq('stripe_subscription_id', subscription.id)
                    .single();

                if (subError) {
                    console.error('❌ Error finding user for deleted subscription:', subError);
                    return NextResponse.json({ message: 'User not found for subscription' }, { status: 200 });
                }

                // Downgrade to free plan
                const { data, error } = await adminSupabase
                    .from('user_subscriptions')
                    .update({
                        plan_id: 'free',
                        status: 'canceled',
                        updated_at: new Date().toISOString()
                    })
                    .eq('user_id', subData.user_id)
                    .select();

                if (error) {
                    console.error('❌ Error downgrading to free plan:', error);
                    return NextResponse.json({ message: 'Error downgrading subscription' }, { status: 200 });
                }

                console.log('✅ User downgraded to free plan:', data);
            } catch (err) {
                console.error('❌ Error processing subscription deletion:', err);
                return NextResponse.json({ message: 'Error processing deletion' }, { status: 200 });
            }
        }

        // Always return 200 OK to acknowledge receipt
        return NextResponse.json({ received: true, success: true });
    } catch (error) {
        console.error('❌ Webhook error:', error);
        // Return 200 status code to acknowledge receipt to Stripe
        return NextResponse.json({ received: true, error: String(error) }, { status: 200 });
    }
}