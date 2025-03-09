// app/api/webhook/route.ts
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { updateUserSubscription } from '@/lib/supabase';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2025-02-24.acacia',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(request: Request) {
    try {
        const body = await request.text();

        // Verify webhook signature
        const signature = request.headers.get('stripe-signature') || '';

        let event: Stripe.Event;

        try {
            event = stripe.webhooks.constructEvent(body, signature, webhookSecret || '');
        } catch (err: any) {
            console.error(`Webhook signature verification failed: ${err.message}`);
            return NextResponse.json({ message: 'Webhook signature verification failed' }, { status: 400 });
        }

        // Handle the event
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object as Stripe.Checkout.Session;

                // Get metadata
                const userId = session.metadata?.userId;
                const planId = session.metadata?.planId;
                const billingCycle = session.metadata?.billingCycle;

                if (!userId || !planId) {
                    console.error('Missing metadata in checkout session');
                    return NextResponse.json({ message: 'Missing metadata' }, { status: 400 });
                }

                // Get subscription details
                const subscriptionId = session.subscription as string;
                const subscription = await stripe.subscriptions.retrieve(subscriptionId);

                // Calculate next billing date
                const nextBillingDate = new Date(subscription.current_period_end * 1000).toISOString().split('T')[0];

                // Update user subscription in database
                await updateUserSubscription(userId, {
                    plan_id: planId,
                    status: 'active',
                    next_billing_date: nextBillingDate,
                    stripe_subscription_id: subscriptionId,
                    stripe_customer_id: session.customer as string
                });

                break;
            }

            case 'customer.subscription.updated': {
                const subscription = event.data.object as Stripe.Subscription;
                const userId = await getUserIdFromSubscription(subscription);

                if (!userId) {
                    console.error('Could not find user for subscription', subscription.id);
                    return NextResponse.json({ message: 'User not found' }, { status: 400 });
                }

                // Get current plan from subscription
                const planId = getPlanIdFromSubscription(subscription);

                // Calculate next billing date
                const nextBillingDate = new Date(subscription.current_period_end * 1000).toISOString().split('T')[0];

                // Update user subscription
                await updateUserSubscription(userId, {
                    plan_id: planId,
                    status: subscription.status,
                    next_billing_date: nextBillingDate,
                    stripe_subscription_id: subscription.id,
                    stripe_customer_id: subscription.customer as string
                });

                break;
            }

            case 'customer.subscription.deleted': {
                const subscription = event.data.object as Stripe.Subscription;
                const userId = await getUserIdFromSubscription(subscription);

                if (!userId) {
                    console.error('Could not find user for deleted subscription', subscription.id);
                    return NextResponse.json({ message: 'User not found' }, { status: 400 });
                }

                // Downgrade to free plan when subscription is canceled
                await updateUserSubscription(userId, {
                    plan_id: 'free',
                    status: 'active',
                    next_billing_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                    stripe_subscription_id: null,
                    stripe_customer_id: subscription.customer as string
                });

                break;
            }

            default:
                console.log(`Unhandled event type ${event.type}`);
        }

        return NextResponse.json({ received: true });

    } catch (error: any) {
        console.error('Webhook error:', error);
        return NextResponse.json(
            { message: error.message || 'Webhook handler error' },
            { status: 500 }
        );
    }
}

// Helper function to find the user ID from a subscription
async function getUserIdFromSubscription(subscription: Stripe.Subscription): Promise<string | null> {
    try {
        // First try to get user from the subscription metadata
        if (subscription.metadata?.userId) {
            return subscription.metadata.userId;
        }

        // If not in subscription metadata, try to get from customer
        const customer = await stripe.customers.retrieve(subscription.customer as string);

        if (customer.deleted) {
            return null;
        }

        return customer.metadata?.userId || null;
    } catch (error) {
        console.error('Error getting user from subscription:', error);
        return null;
    }
}

// Helper function to determine the plan ID based on the price
function getPlanIdFromSubscription(subscription: Stripe.Subscription): string {
    const item = subscription.items.data[0];
    const priceId = item.price.id;

    // This would need to be updated with your actual price IDs from Stripe
    // For now, just using some logic based on the amount
    const amount = item.price.unit_amount || 0;

    if (amount <= 0) return 'free';
    if (amount <= 1500 || amount <= 15000) return 'pro'; // Handle both monthly and yearly
    return 'elite';
}