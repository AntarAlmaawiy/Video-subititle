// app/api/renew-subscription/route.ts
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { getAdminSupabase } from '@/lib/admin-supabase';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2025-02-24.acacia',
});

export async function POST() {
    try {
        // Get the user session
        const session = await auth();

        if (!session || !session.user) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const userId = session.user.id;
        console.log(`Processing subscription renewal for user: ${userId}`);

        // Get admin Supabase client for database operations
        const adminSupabase = getAdminSupabase();

        // Get current subscription from database
        const { data: userSubscription, error } = await adminSupabase
            .from('user_subscriptions')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (error) {
            console.error('Error fetching subscription:', error);
            return NextResponse.json({ message: 'Could not find subscription' }, { status: 404 });
        }

        if (!userSubscription?.stripe_subscription_id) {
            console.error('No Stripe subscription ID found');
            return NextResponse.json({ message: 'No subscription found to renew' }, { status: 400 });
        }

        try {
            // Update the subscription in Stripe (remove cancel_at_period_end)
            const renewedSubscription = await stripe.subscriptions.update(
                userSubscription.stripe_subscription_id,
                {
                    cancel_at_period_end: false,
                    metadata: {
                        renewedAt: new Date().toISOString()
                    }
                }
            );

            console.log(`Subscription renewed in Stripe, status: ${renewedSubscription.status}`);

            // Update the subscription in our database
            const { data, error: updateError } = await adminSupabase
                .from('user_subscriptions')
                .update({
                    status: 'active',
                    updated_at: new Date().toISOString()
                })
                .eq('user_id', userId)
                .select();

            if (updateError) {
                console.error('Error updating subscription in database:', updateError);
                return NextResponse.json(
                    { message: 'Failed to update subscription status in database' },
                    { status: 500 }
                );
            }

            console.log('Database updated successfully:', data);

            return NextResponse.json({
                success: true,
                message: 'Subscription renewed successfully'
            });
        } catch (stripeError: unknown) {
            console.error('Stripe renewal error:', stripeError);
            return NextResponse.json(
                {
                    message: `Error renewing subscription: ${stripeError instanceof Error ? stripeError.message : 'An unexpected error occurred'}`
                },
                { status: 500 }
            );
        }
    } catch (error: unknown) {
        console.error('Error in renew-subscription:', error);
        return NextResponse.json(
            {message: error instanceof Error ? error.message : 'An unknown error occurred'},
            { status: 500 }
        );
    }
}