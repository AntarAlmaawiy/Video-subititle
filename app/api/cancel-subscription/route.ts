// app/api/cancel-subscription/route.ts
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabase, updateUserSubscription } from '@/lib/supabase';
import { auth } from "@/app/api/auth/[...nextauth]/route";

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2025-02-24.acacia',
});

export async function POST(request: Request) {
    try {
        // Get the user session using your existing auth
        const session = await auth();

        if (!session || !session.user) {
            return NextResponse.json(
                { message: 'Unauthorized' },
                { status: 401 }
            );
        }

        const userId = session.user.id;

        // Get the user's subscription from the database
        const { data: userSubscription, error } = await supabase
            .from('user_subscriptions')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (error) {
            console.error('Error fetching subscription:', error);
            return NextResponse.json(
                { message: 'Error fetching subscription details' },
                { status: 500 }
            );
        }

        if (!userSubscription || !userSubscription.stripe_subscription_id) {
            return NextResponse.json(
                { message: 'No active subscription found' },
                { status: 400 }
            );
        }

        // Cancel the subscription at the end of the billing period
        const subscription = await stripe.subscriptions.update(
            userSubscription.stripe_subscription_id,
            { cancel_at_period_end: true }
        );

        // Update the subscription status in the database
        await updateUserSubscription(userId, {
            plan_id: userSubscription.plan_id,
            status: 'canceling',
            next_billing_date: new Date(subscription.current_period_end * 1000).toISOString().split('T')[0],
            stripe_subscription_id: subscription.id,
            stripe_customer_id: userSubscription.stripe_customer_id
        });

        return NextResponse.json({
            success: true,
            message: 'Subscription will be canceled at the end of the billing period',
            endDate: new Date(subscription.current_period_end * 1000).toISOString()
        });

    } catch (error: any) {
        console.error('Error canceling subscription:', error);
        return NextResponse.json(
            { message: error.message || 'Error canceling subscription' },
            { status: 500 }
        );
    }
}