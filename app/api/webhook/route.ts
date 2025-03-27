// app/api/webhook/route.ts
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getAdminSupabase } from '@/lib/admin-supabase';

// Force dynamic API route to ensure it's never cached
export const dynamic = 'force-dynamic';

// Initialize Stripe with correct mode detection
const stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

const stripe = new Stripe(stripeSecretKey, {
    apiVersion: '2025-02-24.acacia',
});

export async function POST(request: Request): Promise<NextResponse> {
    const startTime = Date.now();

    try {
        console.log(`🔔 Webhook received at:`, new Date().toISOString());

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
            console.log(`✅ Webhook signature verified. Event type: ${event.type}`);
        } catch (err: unknown) {
            console.error(`❌ Webhook signature verification failed: ${
                err instanceof Error ? err.message : 'Unknown error'
            }`);
            return NextResponse.json(
                {message: `Webhook signature verification failed`},
                { status: 400 }
            );
        }

        const adminSupabase = getAdminSupabase();

        // Handle checkout.session.completed event for new subscriptions
        if (event.type === 'checkout.session.completed') {
            const session = event.data.object as Stripe.Checkout.Session;
            console.log(`🔄 Processing checkout.session.completed, ID: ${session.id}`);

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

            const subscriptionId = String(session.subscription);
            const customerId = String(session.customer);
            console.log(`🔑 Subscription ID: ${subscriptionId}, Customer ID: ${customerId}`);

            try {
                // Get subscription details from Stripe
                const subscription = await stripe.subscriptions.retrieve(subscriptionId);
                console.log(`📄 Subscription status: ${subscription.status}`);

                // Set the next billing date
                const nextBillingDate = new Date(subscription.current_period_end * 1000)
                    .toISOString()
                    .split('T')[0];
                console.log(`📅 Next billing date: ${nextBillingDate}`);

                // DIRECT APPROACH: Use a simpler, more direct database update
                console.log(`Updating subscription for user ${userId} to plan ${planId}`);

                // Try direct upsert first
                const { data: upsertData, error: upsertError } = await adminSupabase
                    .from('user_subscriptions')
                    .upsert({
                        user_id: userId,
                        plan_id: planId,
                        status: subscription.status,
                        billing_cycle: billingCycle,
                        next_billing_date: nextBillingDate,
                        stripe_subscription_id: subscriptionId,
                        stripe_customer_id: customerId,
                        updated_at: new Date().toISOString(),
                        created_at: new Date().toISOString()
                    }, {
                        onConflict: 'user_id',
                        ignoreDuplicates: false
                    })
                    .select();

                if (upsertError) {
                    console.error('Error upserting subscription:', upsertError);

                    // Try a different approach - delete first then insert
                    console.log('Attempting alternative approach - delete then insert');

                    // Delete existing subscription
                    await adminSupabase
                        .from('user_subscriptions')
                        .delete()
                        .eq('user_id', userId);

                    // Insert new subscription
                    const { error: insertError } = await adminSupabase
                        .from('user_subscriptions')
                        .insert({
                            user_id: userId,
                            plan_id: planId,
                            status: subscription.status,
                            billing_cycle: billingCycle,
                            next_billing_date: nextBillingDate,
                            stripe_subscription_id: subscriptionId,
                            stripe_customer_id: customerId,
                            updated_at: new Date().toISOString(),
                            created_at: new Date().toISOString()
                        });

                    if (insertError) {
                        console.error('Error inserting new subscription:', insertError);
                        throw new Error(`Database update failed: ${insertError.message}`);
                    }

                    console.log('Successfully inserted new subscription after deletion');
                } else {
                    console.log('Successfully upserted subscription data:', upsertData);
                }

                // Verify the update was successful
                const { data: verifyData, error: verifyError } = await adminSupabase
                    .from('user_subscriptions')
                    .select('plan_id, status')
                    .eq('user_id', userId)
                    .single();

                if (verifyError) {
                    console.error('Error verifying subscription update:', verifyError);
                } else {
                    console.log('Verified subscription data:', verifyData);

                    // Double-check that the plan was updated correctly
                    if (verifyData.plan_id !== planId) {
                        console.error(`CRITICAL ERROR: Plan not updated correctly. Expected ${planId}, got ${verifyData.plan_id}`);

                        // Try a direct SQL update as last resort
                        const { error: sqlError } = await adminSupabase.rpc(
                            'force_update_subscription', {
                                user_id_param: userId,
                                plan_id_param: planId,
                                status_param: subscription.status
                            }
                        );

                        if (sqlError) {
                            console.error('SQL function error:', sqlError);
                        } else {
                            console.log('Executed SQL function to force update subscription');
                        }
                    }
                }
            } catch (error) {
                console.error('Error processing checkout session:', error);
                return NextResponse.json({
                    received: true,
                    error: error instanceof Error ? error.message : 'Unknown error processing checkout'
                });
            }
        }
        // Handle other subscription events
        else if (event.type === 'customer.subscription.updated' ||
            event.type === 'customer.subscription.deleted') {

            // Log the event for debugging
            console.log(`Processing subscription event: ${event.type}`);

            // Process the subscription similarly to your force-subscription-update endpoint
            const subscription = event.data.object as Stripe.Subscription;

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
                    console.error('Error finding user for subscription:', userError);
                    return NextResponse.json({ received: true, error: 'User not found' });
                }

                if (userData) {
                    userId = userData.user_id;
                    console.log(`Found user ${userId} for subscription ${subscription.id}`);
                } else {
                    console.error('No user found for subscription:', subscription.id);
                    return NextResponse.json({ received: true, error: 'User not found' });
                }
            }

            // For deleted subscriptions, set to free plan
            if (event.type === 'customer.subscription.deleted') {
                console.log(`Subscription ${subscription.id} was deleted, downgrading to free plan`);

                const { error: updateError } = await adminSupabase
                    .from('user_subscriptions')
                    .update({
                        plan_id: 'free',
                        status: 'canceled',
                        updated_at: new Date().toISOString()
                    })
                    .eq('user_id', userId);

                if (updateError) {
                    console.error('Error downgrading to free plan:', updateError);
                }
            }
            // For updated subscriptions
            else {
                console.log(`Subscription ${subscription.id} was updated, status: ${subscription.status}`);

                // Determine the plan ID
                let planId = subscription.metadata?.planId;

                if (!planId) {
                    // Try to get from product metadata
                    if (subscription.items?.data?.length > 0) {
                        const productId = subscription.items.data[0].price.product;
                        if (typeof productId === 'string') {
                            try {
                                const product = await stripe.products.retrieve(productId);
                                if (product.metadata?.planId) {
                                    planId = product.metadata.planId;
                                }
                            } catch (err) {
                                console.error('Error retrieving product:', err);
                            }
                        }
                    }

                    // If we still don't have a plan ID, keep the current one
                    if (!planId) {
                        const { data: currentData } = await adminSupabase
                            .from('user_subscriptions')
                            .select('plan_id')
                            .eq('user_id', userId)
                            .single();

                        planId = currentData?.plan_id || 'pro'; // Default to pro if all else fails
                    }
                }

                // Handle cancel_at_period_end
                let status = subscription.status;
                if (subscription.cancel_at_period_end) {
                    status = 'canceled'; // Use 'canceled' instead of 'canceling'
                }

                // Update the subscription
                const { error: updateError } = await adminSupabase
                    .from('user_subscriptions')
                    .update({
                        plan_id: planId,
                        status: status,
                        next_billing_date: new Date(subscription.current_period_end * 1000).toISOString().split('T')[0],
                        updated_at: new Date().toISOString()
                    })
                    .eq('user_id', userId);

                if (updateError) {
                    console.error('Error updating subscription:', updateError);
                }
            }
        }
        // Unhandled event types
        else {
            console.log(`Unhandled event type: ${event.type}`);
        }

        const processingTime = Date.now() - startTime;
        console.log(`✅ Webhook processed in ${processingTime}ms`);

        return NextResponse.json({ received: true, processingTime });

    } catch (error) {
        const processingTime = Date.now() - startTime;
        console.error(`❌ Webhook error after ${processingTime}ms:`, error);

        // Return 200 status code to acknowledge receipt to Stripe
        return NextResponse.json(
            {
                received: true,
                error: error instanceof Error ? error.message : String(error)
            },
            { status: 200 } // Use 200 even for errors to acknowledge receipt
        );
    }
}