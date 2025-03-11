// app/api/cancel-subscription/route.ts
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { upsertUserSubscription, supabase } from '@/lib/supabase';
import { auth } from "@/app/api/auth/[...nextauth]/route";

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2025-02-24.acacia',
});

export async function POST(request: Request) {
    try {
        // Get the user session
        const session = await auth();

        if (!session || !session.user) {
            return NextResponse.json(
                { message: 'Unauthorized' },
                { status: 401 }
            );
        }

        const userId = session.user.id;
        console.log(`Processing subscription cancellation for user: ${userId}`);

        // Get current subscription from database
        const { data: userSubscription, error } = await supabase
            .from('user_subscriptions')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (error) {
            console.error('Error fetching subscription:', error);
            return NextResponse.json(
                { message: 'Could not find subscription' },
                { status: 404 }
            );
        }

        if (!userSubscription?.stripe_subscription_id) {
            console.error('No Stripe subscription ID found');
            return NextResponse.json(
                { message: 'No subscription found to cancel' },
                { status: 400 }
            );
        }

        console.log(`Found Stripe subscription: ${userSubscription.stripe_subscription_id}`);

        try {
            // Cancel the subscription in Stripe (at period end)
            const canceledSubscription = await stripe.subscriptions.update(
                userSubscription.stripe_subscription_id,
                { cancel_at_period_end: true }
            );

            console.log(`Subscription updated in Stripe, status: ${canceledSubscription.status}`);

            // Update the subscription in our database
            await upsertUserSubscription(userId, {
                plan_id: userSubscription.plan_id, // Keep the current plan until period end
                status: 'canceling', // Set status to canceling
                next_billing_date: userSubscription.next_billing_date,
                stripe_subscription_id: userSubscription.stripe_subscription_id,
                stripe_customer_id: userSubscription.stripe_customer_id,
                billing_cycle: userSubscription.billing_cycle as 'monthly' | 'yearly' | undefined,
            });

            return NextResponse.json({
                success: true,
                message: 'Subscription canceled successfully',
            });
        } catch (stripeError: any) {
            console.error('Stripe cancellation error:', stripeError);
            return NextResponse.json(
                { message: `Error canceling subscription: ${stripeError.message}` },
                { status: 500 }
            );
        }
    } catch (error: any) {
        console.error('Error in cancel-subscription:', error);
        return NextResponse.json(
            { message: error.message || 'An unknown error occurred' },
            { status: 500 }
        );
    }
}