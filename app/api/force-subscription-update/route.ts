// In app/api/force-subscription-update/route.ts
import { NextResponse } from 'next/server';
import { auth } from '@/app/api/auth/[...nextauth]/route';
import { getAdminSupabase } from '@/lib/admin-supabase';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2025-02-24.acacia',
});

// Define the custom status type to include our "canceling" status
type ExtendedStatus = Stripe.Subscription.Status | 'canceling' | 'canceled';

export async function GET() {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const adminSupabase = getAdminSupabase();
        console.log(`Force sync requested for user: ${session.user.id}`);

        // Get current subscription
        const { data: currentSub, error: subError } = await adminSupabase
            .from('user_subscriptions')
            .select('*')
            .eq('user_id', session.user.id)
            .single();

        if (subError && subError.code !== 'PGRST116') {
            console.error('Error fetching subscription:', subError);

            // Instead of failing, just return what we know
            return NextResponse.json({
                success: false,
                message: 'Could not fetch subscription from database',
                error: subError.message
            });
        }

        console.log(`Current subscription in database:`, currentSub);

        // If we have a Stripe subscription ID, try to verify with Stripe
        // but don't fail if it doesn't exist in Stripe
        if (currentSub?.stripe_subscription_id) {
            try {
                console.log(`Fetching subscription ${currentSub.stripe_subscription_id} from Stripe`);
                const subscription = await stripe.subscriptions.retrieve(currentSub.stripe_subscription_id);
                console.log(`Stripe subscription status: ${subscription.status}`);
                console.log(`Stripe cancel_at_period_end: ${subscription.cancel_at_period_end}`);

                // Check if this subscription is set to cancel at period end in Stripe
                if (subscription.cancel_at_period_end) {
                    console.log(`Subscription ${subscription.id} is marked for cancellation in Stripe`);

                    // Use 'canceled' instead of 'canceling'
                    const { data: cancelData, error: cancelError } = await adminSupabase
                        .from('user_subscriptions')
                        .update({
                            status: 'canceled' as never,
                            updated_at: new Date().toISOString()
                        })
                        .eq('user_id', session.user.id)
                        .select();

                    if (cancelError) {
                        console.error(`Error updating to canceled status: ${cancelError.message}`);
                    } else {
                        console.log('Successfully set status to canceled');
                        return NextResponse.json({
                            success: true,
                            message: 'Status updated to canceled based on Stripe cancel_at_period_end flag',
                            subscription: cancelData[0]
                        });
                    }
                }

                // Check if this is a recent upgrade (within last 10 minutes)
                const isRecentUpdate = currentSub.updated_at &&
                    (new Date().getTime() - new Date(currentSub.updated_at).getTime() < 10 * 60 * 1000);

                // Log time since last update
                if (currentSub.updated_at) {
                    const timeSinceUpdate = Math.round((new Date().getTime() - new Date(currentSub.updated_at).getTime()) / 1000);
                    console.log(`Time since last update: ${timeSinceUpdate} seconds`);
                }

                // If the user recently upgraded to Elite, don't override it
                if (isRecentUpdate && currentSub.plan_id === 'elite') {
                    console.log('Recent upgrade to Elite detected - preserving this plan');

                    // Just update the status and billing date if needed
                    const { data, error } = await adminSupabase
                        .from('user_subscriptions')
                        .update({
                            status: subscription.status,
                            next_billing_date: new Date(subscription.current_period_end * 1000).toISOString().split('T')[0],
                        })
                        .eq('user_id', session.user.id)
                        .select();

                    if (error) {
                        console.error('Error updating subscription status:', error);
                        // Don't fail the request
                    }

                    return NextResponse.json({
                        success: true,
                        message: 'Maintained Elite plan with updated status',
                        subscription: data ? data[0] : currentSub
                    });
                }

                // Determine plan from Stripe data
                let stripePlanId = null;
                let planSource = 'unknown';

                // First check metadata directly on subscription
                if (subscription.metadata?.planId) {
                    stripePlanId = subscription.metadata.planId;
                    planSource = 'subscription metadata';
                }
                // Then check product metadata
                else if (subscription.items?.data?.length > 0) {
                    const productId = subscription.items.data[0].price.product;
                    if (typeof productId === 'string') {
                        try {
                            const product = await stripe.products.retrieve(productId);
                            console.log(`Retrieved product: ${product.id}, name: ${product.name}`);

                            if (product.metadata?.planId) {
                                stripePlanId = product.metadata.planId;
                                planSource = 'product metadata';
                            }
                            // Try to determine from product name
                            else if (product.name) {
                                const name = product.name.toLowerCase();
                                if (name.includes('elite')) {
                                    stripePlanId = 'elite';
                                    planSource = 'product name (elite)';
                                }
                                else if (name.includes('pro')) {
                                    stripePlanId = 'pro';
                                    planSource = 'product name (pro)';
                                }
                                else if (name.includes('free')) {
                                    stripePlanId = 'free';
                                    planSource = 'product name (free)';
                                }
                            }
                        } catch (err) {
                            console.error('Error fetching product:', err);
                            // Continue anyway
                        }
                    }
                }

                // If we couldn't determine from Stripe, retain current plan
                if (!stripePlanId) {
                    stripePlanId = currentSub.plan_id;
                    planSource = 'database (unchanged)';
                    console.log(`Could not determine plan from Stripe. Keeping current plan: ${stripePlanId}`);
                } else {
                    console.log(`Determined plan from Stripe: ${stripePlanId} (source: ${planSource})`);
                }

                // Don't downgrade from Elite to Pro during a force sync
                // unless subscription is inactive/canceled
                if (currentSub.plan_id === 'elite' && stripePlanId === 'pro' &&
                    subscription.status !== 'canceled' && subscription.status !== 'unpaid') {
                    console.log('Preventing downgrade from Elite to Pro during force sync');
                    stripePlanId = 'elite';
                    planSource = 'preserved elite plan';
                }

                // Special handling for subscriptions marked for cancellation
                let statusToUse: ExtendedStatus = subscription.status;
                if (subscription.cancel_at_period_end) {
                    statusToUse = 'canceled' as ExtendedStatus;
                    console.log('Setting status to "canceled" because cancel_at_period_end is true');
                }

                // Update the subscription with appropriate type handling
                const { data, error } = await adminSupabase
                    .from('user_subscriptions')
                    .update({
                        plan_id: stripePlanId,
                        status: statusToUse as never, // Type assertion to bypass TypeScript check
                        next_billing_date: new Date(subscription.current_period_end * 1000).toISOString().split('T')[0],
                        updated_at: new Date().toISOString()
                    })
                    .eq('user_id', session.user.id)
                    .select();

                if (error) {
                    console.error('Error updating subscription:', error);
                    return NextResponse.json({
                        success: false,
                        error: error.message,
                        message: 'Database update failed but Stripe data was retrieved'
                    }, { status: 500 });
                }

                return NextResponse.json({
                    success: true,
                    message: `Subscription updated to ${stripePlanId} (source: ${planSource})`,
                    subscription: data[0]
                });
            } catch (stripeErr) {
                console.error('Error retrieving subscription from Stripe:', stripeErr);

                // If we can't get the subscription from Stripe, check if it might be due to test/live mode mismatch
                // Instead of failing, update the status to 'canceled' in the database
                const { data: cancelData, error: cancelError } = await adminSupabase
                    .from('user_subscriptions')
                    .update({
                        status: 'canceled' as never,
                        updated_at: new Date().toISOString()
                    })
                    .eq('user_id', session.user.id)
                    .select();

                if (cancelError) {
                    console.error('Error updating to canceled status:', cancelError);
                    return NextResponse.json({
                        success: false,
                        message: 'Failed to update subscription status in database',
                        stripeError: stripeErr instanceof Error ? stripeErr.message : 'Unknown Stripe error'
                    }, { status: 500 });
                }

                return NextResponse.json({
                    success: true,
                    message: 'Subscription marked as canceled due to Stripe retrieval error',
                    subscription: cancelData[0]
                });
            }
        }

        // If no Stripe subscription found, just return what we have
        return NextResponse.json({
            success: true,
            message: 'No Stripe subscription found to update',
            currentSubscription: currentSub || null
        });
    } catch (err) {
        console.error('Error in force update endpoint:', err);
        return NextResponse.json({
            success: false,
            error: err instanceof Error ? err.message : 'Unknown server error',
            message: 'Server error'
        }, { status: 500 });
    }
}