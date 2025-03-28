// app/api/user-subscription/route.ts
import { NextResponse } from 'next/server';
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { getAdminSupabase } from '@/lib/admin-supabase';
import Stripe from 'stripe';

// Force dynamic API route to ensure it's never cached
export const dynamic = 'force-dynamic';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2025-02-24.acacia',
});

export async function GET() {
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
        console.log(`Fetching subscription for user: ${userId}`);

        // Get admin Supabase client
        const adminSupabase = getAdminSupabase();

        // Get current subscription directly from database
        const { data: subscription, error } = await adminSupabase
            .from('user_subscriptions')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

        if (error) {
            console.error('Error fetching subscription:', error);
            return NextResponse.json(
                { message: 'Could not fetch subscription data' },
                { status: 500 }
            );
        }

        // If we have a Stripe subscription ID, verify with Stripe
        if (subscription?.stripe_subscription_id) {
            try {
                console.log(`Verifying Stripe subscription: ${subscription.stripe_subscription_id}`);

                const stripeSubscription = await stripe.subscriptions.retrieve(
                    subscription.stripe_subscription_id
                );

                console.log(`Stripe subscription status: ${stripeSubscription.status}`);

                // If status differs, update our database
                if (stripeSubscription.status !== subscription.status) {
                    console.log(`Updating subscription status from ${subscription.status} to ${stripeSubscription.status}`);

                    const { error: updateError } = await adminSupabase
                        .from('user_subscriptions')
                        .update({
                            status: stripeSubscription.status,
                            updated_at: new Date().toISOString()
                        })
                        .eq('user_id', userId);

                    if (updateError) {
                        console.error('Error updating subscription status:', updateError);
                    } else {
                        // Update our local copy
                        subscription.status = stripeSubscription.status;
                    }
                }

                return NextResponse.json({
                    success: true,
                    subscription: subscription,
                    stripeStatus: stripeSubscription.status
                });
            } catch (stripeError) {
                console.error('Error verifying with Stripe:', stripeError);
                // Return what we have from the database
                return NextResponse.json({
                    success: true,
                    subscription: subscription,
                    stripeError: true
                });
            }
        }

        // Return the subscription data
        return NextResponse.json({
            success: true,
            subscription: subscription || {
                plan_id: 'free',
                status: 'active',
                next_billing_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
            }
        });
    } catch (error: unknown) {
        console.error('Error in user-subscription API:', error);
        return NextResponse.json(
            {
                success: false,
                message: error instanceof Error ? error.message : 'An unknown error occurred'
            },
            { status: 500 }
        );
    }
}