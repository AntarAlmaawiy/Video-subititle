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
    try {
        console.log(`🔔 TEST Webhook received at:`, new Date().toISOString());

        const body = await request.text();
        const signature = request.headers.get('stripe-signature') || '';

        if (!stripeTestWebhookSecret) {
            console.error('❌ Missing STRIPE_TEST_WEBHOOK_SECRET environment variable');
            return NextResponse.json(
                { message: 'Test webhook secret is not configured' },
                { status: 500 }
            );
        }

        let event: Stripe.Event;

        try {
            event = stripe.webhooks.constructEvent(body, signature, stripeTestWebhookSecret);
            console.log(`✅ Test webhook signature verified. Event type: ${event.type}`);
        } catch (err) {
            console.error(`❌ Test webhook signature verification failed:`, err);
            return NextResponse.json(
                {message: `Test webhook signature verification failed`},
                { status: 400 }
            );
        }

        const adminSupabase = getAdminSupabase();

        if (event.type === 'checkout.session.completed') {
            const session = event.data.object as Stripe.Checkout.Session;
            console.log(`🔄 Processing TEST checkout.session.completed, ID: ${session.id}`);
            console.log(`📋 Session metadata:`, session.metadata);

            // Extract userId and planId from metadata
            const userId = session.metadata?.userId;
            const planId = session.metadata?.planId;
            const billingCycle = session.metadata?.billingCycle as 'monthly' | 'yearly' || 'monthly';

            if (!userId || !planId) {
                console.error('❌ Missing metadata in checkout session:', session.metadata);
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
            console.log(`📄 Subscription status: ${subscription.status}`);

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
            const { data: existingSubscription } = await adminSupabase
                .from('user_subscriptions')
                .select('*')
                .eq('user_id', userId)
                .single();

            let result;

            if (existingSubscription) {
                console.log(`🔄 Updating existing subscription for user ${userId}`);

                // Before update - log what we're updating from
                console.log(`Before update: ${JSON.stringify({
                    old_plan_id: existingSubscription.plan_id,
                    old_status: existingSubscription.status,
                    old_stripe_subscription_id: existingSubscription.stripe_subscription_id,
                    old_stripe_customer_id: existingSubscription.stripe_customer_id
                })}`);

                // Update with the full subscription data
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
        }

        return NextResponse.json({ received: true });
    } catch (error) {
        console.error('❌ TEST Webhook error:', error);
        // Return 200 status code to acknowledge receipt to Stripe
        return NextResponse.json({ received: true }, { status: 200 });
    }
}