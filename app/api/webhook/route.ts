// app/api/webhook/route.ts
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getAdminSupabase } from '@/lib/admin-supabase';

// Force dynamic API route
export const dynamic = 'force-dynamic';

// Initialize Stripe with the correct live key
const stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

const stripe = new Stripe(stripeSecretKey, {
    apiVersion: '2025-02-24.acacia',
});

export async function POST(request: Request): Promise<NextResponse> {
    try {
        console.log(`🔔 Webhook received at:`, new Date().toISOString());

        const body = await request.text();
        const signature = request.headers.get('stripe-signature') || '';

        if (!stripeWebhookSecret) {
            console.error('❌ Missing STRIPE_WEBHOOK_SECRET environment variable');
            return NextResponse.json({ message: 'Webhook secret is not configured' }, { status: 200 });
        }

        let event: Stripe.Event;

        try {
            event = stripe.webhooks.constructEvent(body, signature, stripeWebhookSecret);
            console.log(`✅ Webhook signature verified. Event type: ${event.type}`);
        } catch (err) {
            console.error(`❌ Webhook signature verification failed:`, err);
            return NextResponse.json({ message: `Webhook signature verification failed` }, { status: 200 });
        }

        // Get admin Supabase client
        const adminSupabase = getAdminSupabase();

        // Handle different event types
        console.log(`📋 Event received: ${event.type}`);

        // Process checkout.session.completed event to update user subscription
        if (event.type === 'checkout.session.completed') {
            const session = event.data.object as Stripe.Checkout.Session;
            console.log(`🔄 Processing checkout.session.completed, ID: ${session.id}`);
            console.log(`📋 Session metadata:`, session.metadata);

            // Extract important information
            const userId = session.metadata?.userId;
            const planId = session.metadata?.planId;
            const billingCycle = session.metadata?.billingCycle || 'monthly';
            const subscriptionId = session.subscription ? String(session.subscription) : '';
            const customerId = session.customer ? String(session.customer) : '';

            console.log(`User ID: ${userId}, Plan ID: ${planId}`);
            console.log(`Subscription ID: ${subscriptionId}, Customer ID: ${customerId}`);

            if (!userId || !planId || !subscriptionId) {
                console.error('❌ Missing required metadata in checkout session');
                return NextResponse.json({
                    message: 'Missing required information in checkout session'
                }, { status: 200 });
            }

            try {
                // First check if user exists in profiles table
                console.log(`🔍 Checking if user ${userId} exists in profiles table`);
                const { error: profileError } = await adminSupabase
                    .from('profiles')
                    .select('id')
                    .eq('id', userId)
                    .single();

                if (profileError) {
                    console.error('❌ Error checking user profile:', profileError);
                    console.log('⚠️ User may not exist in profiles table, but proceeding anyway');
                }

                // Next, check if the user already has a subscription record
                console.log(`🔍 Checking if user ${userId} already has a subscription record`);
                const { data: existingSubscription } = await adminSupabase
                    .from('user_subscriptions')
                    .select('id, plan_id, status')
                    .eq('user_id', userId)
                    .single();

                // Get subscription details from Stripe
                console.log(`🔍 Retrieving subscription ${subscriptionId} from Stripe...`);
                const subscription = await stripe.subscriptions.retrieve(subscriptionId);

                console.log(`📋 Retrieved subscription from Stripe:`, {
                    id: subscription.id,
                    status: subscription.status,
                    current_period_end: subscription.current_period_end
                });

                // Prepare subscription data
                const subscriptionData = {
                    user_id: userId,
                    plan_id: planId,
                    status: subscription.status,
                    stripe_subscription_id: subscriptionId,
                    stripe_customer_id: customerId,
                    billing_cycle: billingCycle,
                    next_billing_date: new Date(subscription.current_period_end * 1000).toISOString().split('T')[0],
                    updated_at: new Date().toISOString()
                };

                let result;

                if (existingSubscription) {
                    console.log(`🔄 Updating existing subscription with ID: ${existingSubscription.id}`);
                    // Update using the record ID instead of relying on user_id
                    const { data, error } = await adminSupabase
                        .from('user_subscriptions')
                        .update(subscriptionData)
                        .eq('id', existingSubscription.id)
                        .select();

                    if (error) {
                        console.error('❌ Error updating subscription by ID:', error);
                        // Fallback to user_id update
                        console.log('⚠️ Falling back to user_id update');
                        const { data: fallbackData, error: fallbackError } = await adminSupabase
                            .from('user_subscriptions')
                            .update(subscriptionData)
                            .eq('user_id', userId)
                            .select();

                        if (fallbackError) {
                            console.error('❌ Fallback update also failed:', fallbackError);
                            return NextResponse.json({ message: 'Database update failed' }, { status: 200 });
                        }
                        result = fallbackData;
                    } else {
                        result = data;
                    }
                } else {
                    console.log(`🆕 Creating new subscription for user ${userId}`);
                    // Add created_at for new records
                    const newSubscriptionData = {
                        ...subscriptionData,
                        created_at: new Date().toISOString()
                    };

                    const { data, error } = await adminSupabase
                        .from('user_subscriptions')
                        .insert(newSubscriptionData)
                        .select();

                    if (error) {
                        console.error('❌ Error creating subscription:', error);
                        console.error('❌ Error details:', {
                            code: error.code,
                            message: error.message,
                            details: error.details,
                            hint: error.hint
                        });

                        // Special handling for foreign key constraint violation
                        if (error.code === '23503') {
                            console.error('❌ Foreign key constraint violation. Attempting to create profile first.');

                            // Try to get auth user info
                            const { data: authUser } = await adminSupabase.auth.admin.getUserById(userId);

                            if (authUser?.user) {
                                console.log('✅ Found auth user:', authUser.user);

                                // Create a profile record
                                const { error: profileCreateError } = await adminSupabase
                                    .from('profiles')
                                    .insert({
                                        id: userId,
                                        username: authUser.user.email?.split('@')[0] || `user_${userId.slice(0, 8)}`,
                                        email: authUser.user.email || `user_${userId.slice(0, 8)}@example.com`,
                                        created_at: new Date().toISOString(),
                                        updated_at: new Date().toISOString()
                                    });

                                if (profileCreateError) {
                                    console.error('❌ Failed to create profile:', profileCreateError);
                                } else {
                                    console.log('✅ Created profile record, retrying subscription insert');

                                    // Try insert again
                                    const { data: retryData, error: retryError } = await adminSupabase
                                        .from('user_subscriptions')
                                        .insert(newSubscriptionData)
                                        .select();

                                    if (retryError) {
                                        console.error('❌ Retry insert also failed:', retryError);
                                    } else {
                                        console.log('✅ Retry insert succeeded');
                                        result = retryData;
                                    }
                                }
                            }
                        }

                        if (!result) {
                            return NextResponse.json({ message: 'Database update failed' }, { status: 200 });
                        }
                    } else {
                        result = data;
                    }
                }

                console.log('✅ Subscription updated in database:', result);

                // Double-check the database to ensure it's updated
                const { data: checkData, error: checkError } = await adminSupabase
                    .from('user_subscriptions')
                    .select('*')
                    .eq('user_id', userId)
                    .single();

                if (checkError) {
                    console.error('❌ Error checking updated subscription:', checkError);
                } else {
                    console.log('📋 Verified subscription in database:', checkData);
                }
            } catch (err) {
                console.error('❌ Error processing checkout session:', err);
                return NextResponse.json({ message: 'Error processing checkout' }, { status: 200 });
            }
        }
        // Handle subscription updated event
        else if (event.type === 'customer.subscription.updated') {
            const subscription = event.data.object as Stripe.Subscription;
            console.log(`🔄 Processing customer.subscription.updated, ID: ${subscription.id}`);

            // Check if we can identify the user from this subscription
            try {
                // First try to find the user from our database using subscription ID
                const { data: subData, error: subError } = await adminSupabase
                    .from('user_subscriptions')
                    .select('id, user_id, plan_id')
                    .eq('stripe_subscription_id', subscription.id)
                    .single();

                if (subError) {
                    console.error('❌ Error finding user for subscription:', subError);
                    return NextResponse.json({ message: 'User not found for subscription' }, { status: 200 });
                }

                if (!subData || !subData.user_id) {
                    console.error('❌ No user found for subscription ID:', subscription.id);
                    return NextResponse.json({ message: 'No user found for subscription' }, { status: 200 });
                }

                console.log(`📋 Found user ${subData.user_id} for subscription ${subscription.id}`);

                // Determine if subscription is being canceled at period end
                const status = subscription.cancel_at_period_end ? 'canceled' : subscription.status;

                // Update the subscription in database by ID (this is the key improvement)
                const { data, error } = await adminSupabase
                    .from('user_subscriptions')
                    .update({
                        status: status,
                        next_billing_date: new Date(subscription.current_period_end * 1000).toISOString().split('T')[0],
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', subData.id) // Using record ID instead of user_id
                    .select();

                if (error) {
                    console.error('❌ Error updating subscription status by ID:', error);
                    // Fall back to updating by user_id
                    const { data: fallbackData, error: fallbackError } = await adminSupabase
                        .from('user_subscriptions')
                        .update({
                            status: status,
                            next_billing_date: new Date(subscription.current_period_end * 1000).toISOString().split('T')[0],
                            updated_at: new Date().toISOString()
                        })
                        .eq('user_id', subData.user_id)
                        .select();

                    if (fallbackError) {
                        console.error('❌ Error updating subscription status by user_id:', fallbackError);
                        return NextResponse.json({ message: 'Error updating subscription' }, { status: 200 });
                    }

                    console.log('✅ Subscription status updated in database (via user_id fallback):', fallbackData);
                } else {
                    console.log('✅ Subscription status updated in database:', data);
                }
            } catch (err) {
                console.error('❌ Error processing subscription update:', err);
                return NextResponse.json({ message: 'Error processing update' }, { status: 200 });
            }
        }
        // Handle subscription deleted event
        else if (event.type === 'customer.subscription.deleted') {
            const subscription = event.data.object as Stripe.Subscription;
            console.log(`🔄 Processing customer.subscription.deleted, ID: ${subscription.id}`);

            try {
                // Find the user from our database using subscription ID
                const { data: subData, error: subError } = await adminSupabase
                    .from('user_subscriptions')
                    .select('id, user_id')
                    .eq('stripe_subscription_id', subscription.id)
                    .single();

                if (subError) {
                    console.error('❌ Error finding user for deleted subscription:', subError);
                    return NextResponse.json({ message: 'User not found for subscription' }, { status: 200 });
                }

                // Downgrade to free plan - using ID for update
                const { data, error } = await adminSupabase
                    .from('user_subscriptions')
                    .update({
                        plan_id: 'free',
                        status: 'canceled',
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', subData.id) // Use record ID instead of user_id
                    .select();

                if (error) {
                    console.error('❌ Error downgrading to free plan by ID:', error);
                    // Fall back to updating by user_id
                    const { data: fallbackData, error: fallbackError } = await adminSupabase
                        .from('user_subscriptions')
                        .update({
                            plan_id: 'free',
                            status: 'canceled',
                            updated_at: new Date().toISOString()
                        })
                        .eq('user_id', subData.user_id)
                        .select();

                    if (fallbackError) {
                        console.error('❌ Error downgrading by user_id:', fallbackError);
                        return NextResponse.json({ message: 'Error downgrading subscription' }, { status: 200 });
                    }

                    console.log('✅ User downgraded to free plan (via user_id fallback):', fallbackData);
                } else {
                    console.log('✅ User downgraded to free plan:', data);
                }
            } catch (err) {
                console.error('❌ Error processing subscription deletion:', err);
                return NextResponse.json({ message: 'Error processing deletion' }, { status: 200 });
            }
        }

        // Always return 200 OK to acknowledge receipt
        return NextResponse.json({ received: true, success: true });
    } catch (error) {
        console.error('❌ Webhook error:', error);
        // Return 200 status code to acknowledge receipt to Stripe
        return NextResponse.json({ received: true, error: String(error) }, { status: 200 });
    }
}