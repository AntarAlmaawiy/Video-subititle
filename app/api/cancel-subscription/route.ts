// app/api/cancel-subscription/route.ts
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { getAdminSupabase } from '@/lib/admin-supabase';

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
                {
                    cancel_at_period_end: true,
                    metadata: {
                        cancelRequested: 'true',
                        cancelRequestTime: new Date().toISOString()
                    }
                }
            );

            console.log(`Subscription updated in Stripe, status: ${canceledSubscription.status}, cancel_at_period_end: ${canceledSubscription.cancel_at_period_end}`);

            // Update only this specific user's subscription
            const { data, error: updateError } = await adminSupabase
                .from('user_subscriptions')
                .update({
                    status: 'canceled',  // Use 'canceled' not 'canceling'
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

            // Verify the update was actually applied
            const { data: verifyData, error: verifyError } = await adminSupabase
                .from('user_subscriptions')
                .select('status')
                .eq('user_id', userId)
                .single();

            if (verifyError) {
                console.error('Error verifying status update:', verifyError);
            } else {
                console.log(`Verified database status: ${verifyData.status}`);

                // If verification shows it's still not canceled, try a second update
                if (verifyData.status !== 'canceled') {
                    console.error('Status not updated to canceled, trying one more time');

                    const { error: finalError } = await adminSupabase
                        .from('user_subscriptions')
                        .update({
                            status: 'canceled',
                            updated_at: new Date().toISOString()
                        })
                        .eq('user_id', userId);

                    if (finalError) {
                        console.error('Final update attempt failed:', finalError);
                    } else {
                        console.log('Final update attempt succeeded');
                    }
                }
            }

            const { error: sqlError } = await adminSupabase.rpc(
                'cancel_user_subscription',
                { user_id_param: userId }
            );

            if (sqlError) {
                console.error('Error executing SQL function:', sqlError);

                // Fall back to direct update
                const { error: updateError } = await adminSupabase
                    .from('user_subscriptions')
                    .update({
                        status: 'canceled',
                        updated_at: new Date().toISOString()
                    })
                    .eq('user_id', userId);

                if (updateError) {
                    console.error('Error updating subscription:', updateError);
                    return NextResponse.json({ message: 'Database update failed' }, { status: 500 });
                }
            } else {
                console.log('Successfully canceled subscription via SQL function');
            }

            return NextResponse.json({
                success: true,
                message: 'Subscription canceled successfully',
                status: 'canceled',
                willEndOn: userSubscription.next_billing_date
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