// app/api/webhook/route.ts
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { upsertUserSubscription } from '@/lib/supabase';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2025-02-24.acacia',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(request: Request) {
    try {
        console.log('Webhook endpoint called');

        const body = await request.text();
        const signature = request.headers.get('stripe-signature') || '';

        if (!webhookSecret) {
            console.error('Missing STRIPE_WEBHOOK_SECRET environment variable');
            return NextResponse.json({ message: 'Webhook secret is not configured' }, { status: 500 });
        }

        let event: Stripe.Event;

        try {
            event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
            console.log(`Webhook event type: ${event.type}`);
        } catch (err: any) {
            console.error(`Webhook signature verification failed: ${err.message}`);
            return NextResponse.json({ message: 'Webhook signature verification failed' }, { status: 400 });
        }

        // Handle checkout.session.completed event
        if (event.type === 'checkout.session.completed') {
            const session = event.data.object as Stripe.Checkout.Session;

            // Log full session details for debugging
            console.log('Checkout session completed:', JSON.stringify(session, null, 2));

            // Get metadata
            const userId = session.metadata?.userId;
            const planId = session.metadata?.planId;

            if (!userId || !planId) {
                console.error('Missing metadata in session:', session.metadata);
                return NextResponse.json({ message: 'Missing metadata' }, { status: 400 });
            }

            console.log(`Updating subscription for user ${userId} to plan ${planId}`);

            // Update the subscription directly
            try {
                const nextBillingDate = new Date();
                nextBillingDate.setDate(nextBillingDate.getDate() + 30); // 30 days from now

                await upsertUserSubscription(userId, {
                    plan_id: planId,
                    status: 'active',
                    next_billing_date: nextBillingDate.toISOString().split('T')[0],
                    stripe_subscription_id: session.subscription as string,
                    stripe_customer_id: session.customer as string
                });

                console.log(`Successfully updated subscription`);
            } catch (updateError) {
                console.error('Error updating subscription:', updateError);
            }
        }

        return NextResponse.json({ received: true });
    } catch (error: any) {
        console.error('Webhook error:', error);
        return NextResponse.json({ message: error.message || 'Webhook handler error' }, { status: 500 });
    }
}