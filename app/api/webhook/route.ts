import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getAdminSupabase } from '@/lib/admin-supabase';

// Force dynamic API route to ensure it's never cached
export const dynamic = 'force-dynamic';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2025-02-24.acacia',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(request: Request) {
    try {
        console.log('🔔 Webhook endpoint called at:', new Date().toISOString());

        const body = await request.text();
        const signature = request.headers.get('stripe-signature') || '';

        if (!webhookSecret) {
            console.error('❌ Missing STRIPE_WEBHOOK_SECRET environment variable');
            return NextResponse.json(
                { message: 'Webhook secret is not configured' },
                { status: 500 }
            );
        }

        let event: Stripe.Event;

        try {
            event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
            console.log(`✅ Webhook event received: ${event.type} - ID: ${event.id}`);
        } catch (err: any) {
            console.error(`❌ Webhook signature verification failed: ${err.message}`);
            return NextResponse.json(
                { message: `Webhook signature verification failed: ${err.message}` },
                { status: 400 }
            );
        }

        const adminSupabase = getAdminSupabase();
        // Add to your webhook handler
        if (event.type === 'checkout.session.completed') {
            // Write to a temp file or log for debugging
            console.log('WEBHOOK EVENT:', JSON.stringify(event, null, 2));
        }

        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object as Stripe.Checkout.Session;

                console.log(`🔄 Processing checkout.session.completed, ID: ${session.id}`);
                console.log(`📋 Session metadata:`, session.metadata);

                // Extract userId and planId from metadata
                const userId = session.metadata?.userId;
                const planId = session.metadata?.planId;
                const billingCycle = session.metadata?.billingCycle as 'monthly' | 'yearly' || 'monthly';

                if (!userId || !planId) {
                    console.error('❌ Missing metadata in checkout session, metadata was:', session.metadata);
                    return NextResponse.json({ message: 'Missing metadata' }, { status: 400 });
                }

                if (!session.subscription) {
                    console.error('❌ No subscription ID in session');
                    return NextResponse.json({ message: 'No subscription ID' }, { status: 400 });
                }

                // Log the subscription ID
                const subscriptionId = String(session.subscription);
                console.log(`🔑 Subscription ID: ${subscriptionId}`);

                // Log the customer ID
                const customerId = String(session.customer);
                console.log(`👤 Customer ID: ${customerId}`);

                // Retrieve the subscription details from Stripe
                const subscription = await stripe.subscriptions.retrieve(subscriptionId);

                console.log(`📄 Retrieved subscription: ${JSON.stringify(subscription, null, 2).substring(0, 500)}...`);

                const nextBillingDate = new Date(subscription.current_period_end * 1000)
                    .toISOString()
                    .split('T')[0];

                console.log(`📅 Next billing date: ${nextBillingDate}`);

                // Prepare the subscription data for database
                const subscriptionData = {
                    user_id: userId,
                    plan_id: planId,
                    status: subscription.status,
                    billing_cycle: billingCycle,
                    next_billing_date: nextBillingDate,
                    stripe_subscription_id: subscriptionId,
                    stripe_customer_id: customerId,
                    updated_at: new Date().toISOString()
                };

                console.log(`💾 Preparing to save subscription data:`, subscriptionData);

                // Check if user already has a subscription
                const { data: existingSubscription, error: fetchError } = await adminSupabase
                    .from('user_subscriptions')
                    .select('*')
                    .eq('user_id', userId)
                    .single();

                if (fetchError && fetchError.code !== 'PGRST116') {
                    console.error(`❌ Error fetching existing subscription: ${fetchError.message}`);
                    return NextResponse.json({ message: fetchError.message }, { status: 500 });
                }

                let result;

                if (existingSubscription) {
                    console.log(`🔄 Updating existing subscription for user ${userId}`, existingSubscription);

                    // Before update - log what we're updating from
                    console.log(`Before update: ${JSON.stringify({
                        old_plan_id: existingSubscription.plan_id,
                        old_status: existingSubscription.status,
                        old_stripe_subscription_id: existingSubscription.stripe_subscription_id,
                        old_stripe_customer_id: existingSubscription.stripe_customer_id
                    })}`);

                    const { data, error: updateError } = await adminSupabase
                        .from('user_subscriptions')
                        .update(subscriptionData)
                        .eq('user_id', userId)
                        .select();

                    if (updateError) {
                        console.error(`❌ Error updating subscription: ${updateError.message}`);
                        return NextResponse.json({ message: updateError.message }, { status: 500 });
                    }
                    result = data;

                    // After update - verification
                    console.log(`After update: ${JSON.stringify(data)}`);
                } else {
                    console.log(`➕ Creating new subscription for user ${userId}`);
                    const { data, error: insertError } = await adminSupabase
                        .from('user_subscriptions')
                        .insert({
                            ...subscriptionData,
                            created_at: new Date().toISOString()
                        })
                        .select();

                    if (insertError) {
                        console.error(`❌ Error inserting subscription: ${insertError.message}`);
                        return NextResponse.json({ message: insertError.message }, { status: 500 });
                    }
                    result = data;
                }

                // Verify the result
                if (result && result.length > 0) {
                    console.log(`✅ Subscription successfully saved for user ${userId}, plan ${planId}`);
                    console.log(`Result: ${JSON.stringify(result)}`);

                    // Double-check by fetching again
                    const { data: verifyData, error: verifyError } = await adminSupabase
                        .from('user_subscriptions')
                        .select('*')
                        .eq('user_id', userId)
                        .single();

                    if (verifyError) {
                        console.error(`❌ Error verifying update: ${verifyError.message}`);
                    } else {
                        console.log(`✅ Verification - database now has:`, verifyData);
                    }
                } else {
                    console.error(`⚠️ No error, but no result returned when saving subscription`);
                }

                break;
            }

            case 'customer.subscription.updated': {
                const subscription = event.data.object as Stripe.Subscription;
                console.log(`🔄 Processing customer.subscription.updated, ID: ${subscription.id}`);

                // Get metadata
                console.log(`Subscription metadata:`, subscription.metadata);

                // Get userId from metadata or look it up
                let userId = subscription.metadata?.userId;

                if (!userId) {
                    // Try to find the user by subscription ID
                    const { data: userData, error: userError } = await adminSupabase
                        .from('user_subscriptions')
                        .select('user_id')
                        .eq('stripe_subscription_id', subscription.id)
                        .single();

                    if (userError) {
                        console.error(`❌ Cannot find user for subscription ${subscription.id}: ${userError.message}`);
                        return NextResponse.json({ message: userError.message }, { status: 500 });
                    }

                    userId = userData.user_id;
                    console.log(`🔍 Found user ${userId} for subscription ${subscription.id}`);
                }

                const nextBillingDate = new Date(subscription.current_period_end * 1000)
                    .toISOString()
                    .split('T')[0];

                // Get plan info from metadata or items
                let planId = subscription.metadata?.planId;
                if (!planId && subscription.items?.data?.length > 0) {
                    // Try to extract plan info from the product
                    const productId = subscription.items.data[0].price.product;
                    if (typeof productId === 'string') {
                        const product = await stripe.products.retrieve(productId);
                        // Look for plan info in product metadata
                        planId = product.metadata?.planId;
                        console.log(`Extracted plan ID ${planId} from product ${productId}`);
                    }
                }

                // Default to current plan if we couldn't determine it
                if (!planId) {
                    const { data: currentSub } = await adminSupabase
                        .from('user_subscriptions')
                        .select('plan_id')
                        .eq('user_id', userId)
                        .single();

                    planId = currentSub?.plan_id || 'pro'; // Default to pro if all else fails
                    console.log(`Using existing plan ID: ${planId}`);
                }

                // Update the subscription in the database
                const updateData = {
                    status: subscription.status,
                    next_billing_date: nextBillingDate,
                    plan_id: planId, // Include plan ID in update
                    updated_at: new Date().toISOString()
                };

                console.log(`Updating subscription with data:`, updateData);

                const { data, error: updateError } = await adminSupabase
                    .from('user_subscriptions')
                    .update(updateData)
                    .eq('user_id', userId)
                    .select();

                if (updateError) {
                    console.error(`❌ Error updating subscription: ${updateError.message}`);
                    return NextResponse.json({ message: updateError.message }, { status: 500 });
                } else {
                    console.log(`✅ Successfully updated subscription ${subscription.id}`);
                    console.log(`Updated data:`, data);
                }

                break;
            }

            case 'customer.subscription.deleted': {
                const subscription = event.data.object as Stripe.Subscription;
                console.log(`🔄 Processing customer.subscription.deleted, ID: ${subscription.id}`);

                // Find the user for this subscription
                const { data: userData, error: userError } = await adminSupabase
                    .from('user_subscriptions')
                    .select('user_id')
                    .eq('stripe_subscription_id', subscription.id)
                    .single();

                if (userError && userError.code !== 'PGRST116') {
                    console.error(`❌ Error finding user for deleted subscription: ${userError.message}`);
                    return NextResponse.json({ message: userError.message }, { status: 500 });
                }

                const userId = userData?.user_id;
                if (!userId) {
                    console.error(`❌ Cannot find user for subscription ${subscription.id}`);
                    return NextResponse.json({ message: 'User not found' }, { status: 404 });
                }

                // Update the subscription status in the database
                const { data, error: updateError } = await adminSupabase
                    .from('user_subscriptions')
                    .update({
                        status: 'canceled',
                        plan_id: 'free', // Downgrade to free plan
                        updated_at: new Date().toISOString()
                    })
                    .eq('user_id', userId)
                    .select();

                if (updateError) {
                    console.error(`❌ Error marking subscription as canceled: ${updateError.message}`);
                    return NextResponse.json({ message: updateError.message }, { status: 500 });
                } else {
                    console.log(`✅ Successfully marked subscription ${subscription.id} as canceled and downgraded to free`);
                    console.log(`Updated data:`, data);
                }

                break;
            }

            default:
                console.log(`ℹ️ Unhandled event type: ${event.type}`);
        }

        return NextResponse.json({ received: true });
    } catch (error: any) {
        console.error('❌ Webhook error:', error);
        return NextResponse.json(
            { message: error.message || 'Webhook handler error' },
            { status: 500 }
        );
    }
}