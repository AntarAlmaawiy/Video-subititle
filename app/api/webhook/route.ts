// app/api/webhook/route.ts - FIXED VERSION
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
            console.error(`❌ Webhook signature verification failed:`, err);
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

            console.log(`User ID: ${userId}, Plan ID: ${planId}, Billing Cycle: ${billingCycle}`);

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

                // SIMPLIFIED APPROACH: First check if the user subscription already exists
                const { data: existingData, error: checkError } = await adminSupabase
                    .from('user_subscriptions')
                    .select('id')
                    .eq('user_id', userId)
                    .maybeSingle();

                if (checkError) {
                    console.error('Error checking for existing subscription:', checkError);
                }

                if (existingData) {
                    // Update existing record - simple update without complex SQL
                    console.log('Updating existing subscription');
                    const { error: updateError } = await adminSupabase
                        .from('user_subscriptions')
                        .update({
                            plan_id: planId,
                            status: subscription.status,
                            billing_cycle: billingCycle,
                            next_billing_date: nextBillingDate,
                            stripe_subscription_id: subscriptionId,
                            stripe_customer_id: customerId,
                            updated_at: new Date().toISOString()
                        })
                        .eq('user_id', userId);

                    if (updateError) {
                        console.error('Update error:', updateError);
                        throw new Error(`Failed to update subscription: ${updateError.message}`);
                    }
                } else {
                    // Insert new record - simple insert without complex SQL
                    console.log('Creating new subscription');
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
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString()
                        });

                    if (insertError) {
                        console.error('Insert error:', insertError);
                        throw new Error(`Failed to create subscription: ${insertError.message}`);
                    }
                }

                // VERIFICATION STEP: Confirm the subscription was updated correctly
                const { data: verifyData, error: verifyError } = await adminSupabase
                    .from('user_subscriptions')
                    .select('*')
                    .eq('user_id', userId)
                    .single();

                if (verifyError) {
                    console.error('❌ Verification error:', verifyError);
                } else {
                    console.log('✅ Verification data:', verifyData);

                    if (verifyData.plan_id !== planId) {
                        console.error(`⚠️ CRITICAL ERROR: Plan not updated correctly. Expected ${planId}, got ${verifyData.plan_id}`);
                    } else {
                        console.log(`✅ SUCCESS: Plan correctly updated to ${planId}`);
                    }
                }

                return NextResponse.json({
                    success: true,
                    message: `Plan updated to ${planId}`
                });
            } catch (error) {
                console.error('❌ Error processing checkout session:', error);
                return NextResponse.json({
                    received: true,
                    error: error instanceof Error ? error.message : 'Unknown error processing checkout'
                });
            }
        }

        // Handle other events with acknowledgment
        console.log(`Event ${event.type} received but not specifically handled`);
        return NextResponse.json({ received: true });

    } catch (error) {
        console.error(`❌ Webhook error:`, error);

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