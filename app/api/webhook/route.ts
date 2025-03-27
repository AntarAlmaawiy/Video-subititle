// app/api/webhook/route.ts
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getAdminSupabase } from '@/lib/admin-supabase';


// Force dynamic API route to ensure it's never cached
export const dynamic = 'force-dynamic';

// Initialize Stripe with correct mode detection
const stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';
const isProduction = !stripeSecretKey.startsWith('sk_test_');

const stripe = new Stripe(stripeSecretKey, {
    apiVersion: '2025-02-24.acacia',
    // Add retries for production reliability
    maxNetworkRetries: isProduction ? 2 : 0,
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Interface for database errors
interface DatabaseError {
    code?: string;
    details?: string;
    hint?: string;
}

// Function to ensure user exists in the database
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ensureUserExists(supabase: any, userId: string, email = ''): Promise<boolean> {
    console.log(`Ensuring user exists in database: ${userId}`);

    try {
        // First check if user exists in auth.users table
        const { data: authUser, error: authError } = await supabase
            .from('auth.users')
            .select('id')
            .eq('id', userId)
            .single();

        if (!authError && authUser) {
            console.log(`User exists in auth.users: ${userId}`);
            return true;
        }

        // Then check profiles table
        const { data: profileUser, error: profileError } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', userId)
            .single();

        if (!profileError && profileUser) {
            console.log(`User exists in profiles: ${userId}`);
            return true;
        }

        console.log(`User ${userId} doesn't exist in database, creating...`);

        // Create in profiles table (this is usually safer than auth.users)
        const { error: insertError } = await supabase
            .from('profiles')
            .insert({
                id: userId,
                email: email,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });

        if (insertError) {
            console.error(`Failed to create user profile: ${insertError.message}`);

            // Try an alternative method - RLS insert as an anonymous user
            const { error: rpcError } = await supabase
                .rpc('create_user_profile', {
                    user_id_param: userId,
                    email_param: email
                });

            if (rpcError) {
                console.error(`RPC create_user_profile failed: ${rpcError.message}`);
                return false;
            }

            console.log(`Created user ${userId} via RPC function`);
            return true;
        }

        console.log(`Created user ${userId} in profiles table`);
        return true;
    } catch (error) {
        console.error('Error in ensureUserExists:', error);
        return false;
    }
}

export async function POST(request: Request): Promise<NextResponse> {
    const startTime = Date.now();

    try {
        console.log(`🔔 ${isProduction ? 'PRODUCTION' : 'TEST'} Webhook called at:`, new Date().toISOString());

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
            console.log(`✅ Webhook event received: ${event.type} - ID: ${event.id}`);
        } catch (err: unknown) {
            console.error(`❌ Webhook signature verification failed: ${
                err instanceof Error ? err.message : 'Unknown error'
            }`);
            return NextResponse.json(
                {message: `Webhook signature verification failed: ${err instanceof Error ? err.message : 'Unknown error'}`},
                { status: 400 }
            );
        }

        const adminSupabase = getAdminSupabase();

        // Add to your webhook handler for debugging
        if (event.type === 'checkout.session.completed') {
            console.log('WEBHOOK EVENT:', JSON.stringify(event, null, 2));
        }

        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object as Stripe.Checkout.Session;

                console.log(`🔄 Processing checkout.session.completed, ID: ${session.id}`);
                console.log(`📋 Session metadata:`, session.metadata);

                // Extract userId and planId from metadata
                const userId = session.metadata?.userId;
                const planId = session.metadata?.planId;
                const billingCycle = session.metadata?.billingCycle as 'monthly' | 'yearly' || 'monthly';

                if (!userId || !planId) {
                    console.error('❌ Missing metadata in checkout session, metadata was:', session.metadata);
                    return NextResponse.json({ message: 'Missing metadata' }, { status: 400 });
                }

                if (!session.subscription) {
                    console.error('❌ No subscription ID in session');
                    return NextResponse.json({ message: 'No subscription ID' }, { status: 400 });
                }

                // Log the subscription ID
                const subscriptionId = String(session.subscription);
                console.log(`🔑 Subscription ID: ${subscriptionId}`);

                // Log the customer ID
                const customerId = String(session.customer);
                console.log(`👤 Customer ID: ${customerId}`);

                // Get customer email from Stripe
                let customerEmail = '';
                try {
                    const customer = await stripe.customers.retrieve(customerId);
                    if (typeof customer !== 'string' && !customer.deleted) {
                        customerEmail = customer.email || '';
                    }
                } catch (err) {
                    console.error('Error fetching customer details:', err);
                }

                // Ensure user exists in the database
                const userExists = await ensureUserExists(adminSupabase, userId, customerEmail);
                if (!userExists) {
                    console.log(`Could not ensure user ${userId} exists. Acknowledging webhook but will try to create subscription anyway.`);
                    // We continue anyway, it might work if the foreign key constraint isn't triggered
                }

                // Retrieve the subscription details from Stripe
                const subscription = await stripe.subscriptions.retrieve(subscriptionId);

                console.log(`📄 Retrieved subscription: ${JSON.stringify(subscription, null, 2).substring(0, 500)}...`);

                const nextBillingDate = new Date(subscription.current_period_end * 1000)
                    .toISOString()
                    .split('T')[0];

                console.log(`📅 Next billing date: ${nextBillingDate}`);

                // Prepare the subscription data for database
                const subscriptionData = {
                    user_id: userId,
                    plan_id: planId,
                    status: subscription.status,
                    billing_cycle: billingCycle,
                    next_billing_date: nextBillingDate,
                    stripe_subscription_id: subscriptionId,
                    stripe_customer_id: customerId,
                    updated_at: new Date().toISOString()
                };

                console.log(`💾 Preparing to save subscription data:`, subscriptionData);

                try {
                    // Check if user already has a subscription
                    const { data: existingSubscription, error: fetchError } = await adminSupabase
                        .from('user_subscriptions')
                        .select('*')
                        .eq('user_id', userId)
                        .single();

                    if (fetchError && fetchError.code !== 'PGRST116') {
                        console.error(`❌ Error fetching existing subscription: ${fetchError.message}`);
                        throw new Error(`Error fetching existing subscription: ${fetchError.message}`);
                    }

                    let result;

                    if (existingSubscription) {
                        console.log(`🔄 Updating existing subscription for user ${userId}`);

                        // Before update - log what we're updating from
                        console.log(`Before update: ${JSON.stringify({
                            old_plan_id: existingSubscription.plan_id,
                            old_status: existingSubscription.status,
                            old_stripe_subscription_id: existingSubscription.stripe_subscription_id,
                            old_stripe_customer_id: existingSubscription.stripe_customer_id
                        })}`);

                        // Update with the full subscription data
                        const { data, error: updateError } = await adminSupabase
                            .from('user_subscriptions')
                            .update(subscriptionData)
                            .eq('user_id', userId)
                            .select();

                        if (updateError) {
                            console.error(`❌ Error updating subscription: ${updateError.message}`);
                            throw new Error(`Error updating subscription: ${updateError.message}`);
                        }
                        result = data;

                        // After update - verification
                        console.log(`After update: ${JSON.stringify(data)}`);
                    } else {
                        console.log(`➕ Creating new subscription for user ${userId}`);

                        // Try RPC function if it exists (to handle RLS)
                        try {
                            const { error: rpcError } = await adminSupabase
                                .rpc('create_user_subscription', {
                                    user_id_param: userId,
                                    plan_id_param: planId,
                                    status_param: subscription.status,
                                    billing_cycle_param: billingCycle,
                                    next_billing_date_param: nextBillingDate,
                                    stripe_subscription_id_param: subscriptionId,
                                    stripe_customer_id_param: customerId
                                });

                            if (rpcError) {
                                console.log(`RPC method failed, trying direct insert: ${rpcError.message}`);
                                // Fall through to direct insert
                            } else {
                                console.log(`Successfully created subscription via RPC function`);
                                result = [{ id: 'created-via-rpc' }]; // Dummy result to indicate success
                                break; // Skip direct insert
                            }
                        } catch (rpcErr) {
                            console.error('Error calling RPC function:', rpcErr);
                            // Fall through to direct insert
                        }

                        // Direct insert if RPC fails or doesn't exist
                        const { data, error: insertError } = await adminSupabase
                            .from('user_subscriptions')
                            .insert({
                                ...subscriptionData,
                                created_at: new Date().toISOString()
                            })
                            .select();

                        if (insertError) {
                            // If insert fails with foreign key error, try special case handling
                            if (insertError.message && insertError.message.includes('violates foreign key constraint')) {
                                console.error(`❌ Foreign key violation: ${insertError.message}`);

                                // Try one more approach - create profiles record if needed
                                const { error: profileError } = await adminSupabase
                                    .from('profiles')
                                    .select('id')
                                    .eq('id', userId)
                                    .single();

                                if (profileError && profileError.code === 'PGRST116') {
                                    console.log(`Creating missing profile for user ${userId}`);
                                    await adminSupabase
                                        .from('profiles')
                                        .insert({
                                            id: userId,
                                            email: customerEmail,
                                            created_at: new Date().toISOString(),
                                            updated_at: new Date().toISOString()
                                        });

                                    // Try insert again after creating profile
                                    const { data: retryData, error: retryError } = await adminSupabase
                                        .from('user_subscriptions')
                                        .insert({
                                            ...subscriptionData,
                                            created_at: new Date().toISOString()
                                        })
                                        .select();

                                    if (retryError) {
                                        console.error(`❌ Retry insert also failed: ${retryError.message}`);
                                        throw new Error(`Error inserting subscription after profile creation: ${retryError.message}`);
                                    }

                                    result = retryData;
                                } else {
                                    throw new Error(`Error inserting subscription: ${insertError.message}`);
                                }
                            } else {
                                console.error(`❌ Error inserting subscription: ${insertError.message}`);
                                throw new Error(`Error inserting subscription: ${insertError.message}`);
                            }
                        } else {
                            result = data;
                        }
                    }

                    // Verify the result
                    if (result && result.length > 0) {
                        console.log(`✅ Subscription successfully saved for user ${userId}, plan ${planId}`);
                    } else {
                        console.error(`⚠️ No error, but no result returned when saving subscription`);
                    }
                } catch (dbError) {
                    const errorMsg = dbError instanceof Error ? dbError.message : 'Unknown database error';
                    console.error(`Database operation failed: ${errorMsg}`);

                    // Always acknowledge receipt to prevent retries
                    return NextResponse.json({
                        received: true,
                        error: `Database operation failed: ${errorMsg}`
                    });
                }

                break;
            }

            case 'customer.subscription.updated': {
                try {
                    const subscription = event.data.object as Stripe.Subscription;
                    console.log(`🔄 Processing customer.subscription.updated, ID: ${subscription.id}`);

                    // Add detailed logging
                    console.log(`Subscription metadata:`, subscription.metadata);

                    // Get userId from metadata or look it up
                    let userId = subscription.metadata?.userId;

                    if (!userId) {
                        // Try to find the user by subscription ID
                        console.log(`User ID not in metadata, looking up by subscription ID`);
                        const { data: userData, error: userError } = await adminSupabase
                            .from('user_subscriptions')
                            .select('user_id, plan_id')
                            .eq('stripe_subscription_id', subscription.id)
                            .single();

                        if (userError) {
                            throw new Error(`Cannot find user for subscription ${subscription.id}: ${userError.message}`);
                        }

                        if (userData) {
                            userId = userData.user_id;
                            console.log(`🔍 Found user ${userId} for subscription ${subscription.id} with current plan ${userData.plan_id}`);
                        } else {
                            throw new Error(`No user data found for subscription ${subscription.id}`);
                        }
                    }

                    // Get customer email from Stripe if we have a customer ID
                    let customerEmail = '';
                    if (subscription.customer) {
                        try {
                            const customer = await stripe.customers.retrieve(String(subscription.customer));
                            if (typeof customer !== 'string' && !customer.deleted) {
                                customerEmail = customer.email || '';
                            }
                        } catch (err) {
                            console.error('Error fetching customer details:', err);
                        }
                    }

                    // Ensure user exists in database
                    const userExists = await ensureUserExists(adminSupabase, userId, customerEmail);
                    if (!userExists) {
                        console.log(`Could not ensure user ${userId} exists, but will try to continue.`);
                    }

                    const nextBillingDate = new Date(subscription.current_period_end * 1000)
                        .toISOString()
                        .split('T')[0];
                    console.log(`Next billing date: ${nextBillingDate}`);

                    const { data: currentSub, error: currentSubError } = await adminSupabase
                        .from('user_subscriptions')
                        .select('plan_id, updated_at, status')
                        .eq('user_id', userId)
                        .single();

                    if (currentSubError && currentSubError.code !== 'PGRST116') {
                        console.error(`Error fetching current subscription: ${currentSubError.message}`);
                    } else if (currentSub) {
                        console.log(`Current subscription in database: Plan=${currentSub.plan_id}, Status=${currentSub.status}`);
                    }

                    if (subscription.cancel_at_period_end) {
                        console.log(`Subscription ${subscription.id} is marked for cancellation. Setting status to canceled.`);

                        // Update with 'canceled' instead of 'canceling'
                        const { error: updateCancelingError } = await adminSupabase
                            .from('user_subscriptions')
                            .update({
                                status: 'canceled', // Changed from 'canceling'
                                next_billing_date: nextBillingDate,
                                updated_at: new Date().toISOString()
                            })
                            .eq('user_id', userId);

                        if (updateCancelingError) {
                            console.error(`Error updating canceled subscription: ${updateCancelingError.message}`);
                        } else {
                            console.log(`Successfully updated next billing date for canceled subscription`);
                        }

                        // Return early to prevent overriding the canceled status
                        return NextResponse.json({ received: true });
                    }

                    // Get plan info from metadata or items
                    let planId = subscription.metadata?.planId;
                    let planSource = 'subscription metadata';

                    // Check if this subscription update is from a recent upgrade
                    const isRecentUpdate = currentSub?.updated_at &&
                        (new Date().getTime() - new Date(currentSub.updated_at).getTime() < 5 * 60 * 1000); // 5 minutes

                    if (isRecentUpdate) {
                        console.log(`Recent database update detected (< 5 min ago)`);
                    }

                    // Special case: If current plan is Elite and we're in a subscription.updated event
                    if (isRecentUpdate && currentSub?.plan_id === 'elite') {
                        console.log(`⚠️ Protecting recent Elite plan upgrade from downgrade`);
                        planId = 'elite';
                        planSource = 'protected elite upgrade';
                    }
                    // If no plan in metadata, try to extract from product
                    else if (!planId && subscription.items?.data?.length > 0) {
                        // Try to extract plan info from the product
                        const productId = subscription.items.data[0].price.product;
                        if (typeof productId === 'string') {
                            try {
                                const product = await stripe.products.retrieve(productId);
                                // Look for plan info in product metadata
                                if (product.metadata?.planId) {
                                    planId = product.metadata.planId;
                                    planSource = 'product metadata';
                                } else if (product.name) {
                                    // Try to determine from product name
                                    const name = product.name.toLowerCase();
                                    if (name.includes('elite')) {
                                        planId = 'elite';
                                        planSource = 'product name (elite)';
                                    }
                                    else if (name.includes('pro')) {
                                        planId = 'pro';
                                        planSource = 'product name (pro)';
                                    }
                                    else if (name.includes('free')) {
                                        planId = 'free';
                                        planSource = 'product name (free)';
                                    }
                                }
                                console.log(`Extracted plan ID ${planId} from product ${productId} via ${planSource}`);
                            } catch (err) {
                                console.error('Error fetching product details:', err);
                            }
                        }
                    }

                    // Default to current plan if we couldn't determine it
                    if (!planId && currentSub) {
                        planId = currentSub.plan_id || 'pro'; // Default to pro if all else fails
                        planSource = 'database (unchanged)';
                        console.log(`Using existing plan ID: ${planId}`);
                    } else if (!planId) {
                        planId = 'pro'; // Absolute fallback
                        planSource = 'default fallback';
                        console.log(`Could not determine plan. Using default: ${planId}`);
                    }

                    console.log(`Preparing update data`);
                    const updateData = {
                        status: subscription.status,
                        next_billing_date: nextBillingDate,
                        plan_id: planId,
                        updated_at: new Date().toISOString()
                    };
                    console.log(`Update data:`, updateData);

                    try {
                        console.log(`Executing database update for user ${userId}`);
                        const { data, error: updateError } = await adminSupabase
                            .from('user_subscriptions')
                            .update(updateData)
                            .eq('user_id', userId)
                            .select();

                        if (updateError) {
                            console.error(`❌ Error updating subscription: ${updateError.message}`);

                            // If subscription doesn't exist yet, try to create it
                            if (updateError.message.includes('no rows')) {
                                console.log(`No subscription found to update, creating a new one`);

                                const { error: insertError } = await adminSupabase
                                    .from('user_subscriptions')
                                    .insert({
                                        ...updateData,
                                        user_id: userId,
                                        stripe_subscription_id: subscription.id,
                                        stripe_customer_id: String(subscription.customer),
                                        created_at: new Date().toISOString()
                                    });

                                if (insertError) {
                                    console.error(`❌ Error creating subscription: ${insertError.message}`);
                                    throw new Error(`Error creating subscription: ${insertError.message}`);
                                }

                                console.log(`✅ Successfully created new subscription for user ${userId}`);
                            } else {
                                throw new Error(`Error updating subscription: ${updateError.message}`);
                            }
                        } else {
                            console.log(`✅ Successfully updated subscription ${subscription.id} to ${planId} via ${planSource}`);
                            console.log(`Updated data:`, data);
                        }
                    } catch (dbError) {
                        const errorMsg = dbError instanceof Error ? dbError.message : String(dbError);
                        console.error(`Database error: ${errorMsg}`);
                        return NextResponse.json({
                            received: true,
                            error: errorMsg
                        });
                    }
                } catch (error) {
                    // Catch and log any errors in this specific event handler
                    const errorMsg = error instanceof Error ? error.message : String(error);
                    console.error("Error processing subscription update:", errorMsg);
                    // Don't throw - respond with 200 to Stripe and handle the error internally
                    return NextResponse.json({
                        received: true,
                        warning: "Error processing subscription, but acknowledging receipt",
                        error: errorMsg
                    });
                }
                break;
            }

            case 'customer.subscription.deleted': {
                const subscription = event.data.object as Stripe.Subscription;
                console.log(`🔄 Processing customer.subscription.deleted, ID: ${subscription.id}`);

                try {
                    // Find the user for this subscription
                    const { data: userData, error: userError } = await adminSupabase
                        .from('user_subscriptions')
                        .select('user_id')
                        .eq('stripe_subscription_id', subscription.id)
                        .single();

                    if (userError && userError.code !== 'PGRST116') {
                        console.error(`❌ Error finding user for deleted subscription: ${userError.message}`);
                        throw new Error(`Error finding user for deleted subscription: ${userError.message}`);
                    }

                    const userId = userData?.user_id;
                    if (!userId) {
                        console.error(`❌ Cannot find user for subscription ${subscription.id}`);
                        return NextResponse.json({
                            received: true,
                            message: 'User not found, but acknowledging receipt'
                        });
                    }

                    // Update the subscription status in the database
                    const { error: updateError } = await adminSupabase
                        .from('user_subscriptions')
                        .update({
                            status: 'canceled',
                            plan_id: 'free', // Downgrade to free plan
                            updated_at: new Date().toISOString()
                        })
                        .eq('user_id', userId);

                    if (updateError) {
                        console.error(`❌ Error marking subscription as canceled: ${updateError.message}`);
                        throw new Error(`Error marking subscription as canceled: ${updateError.message}`);
                    } else {
                        console.log(`✅ Successfully marked subscription ${subscription.id} as canceled and downgraded to free`);
                    }
                } catch (error) {
                    const errorMsg = error instanceof Error ? error.message : String(error);
                    console.error(`Error processing subscription deletion: ${errorMsg}`);
                    return NextResponse.json({
                        received: true,
                        error: errorMsg
                    });
                }

                break;
            }

            default:
                console.log(`ℹ️ Unhandled event type: ${event.type}`);
        }

        const processingTime = Date.now() - startTime;
        console.log(`✅ Webhook processed in ${processingTime}ms`);

        return NextResponse.json({
            received: true,
            processingTime,
            environment: isProduction ? 'production' : 'test'
        });

    } catch (error) {
        const processingTime = Date.now() - startTime;
        console.error(`❌ Webhook error after ${processingTime}ms:`, error);

        // Detailed error logging with proper typing
        if (error instanceof Error) {
            const errorDetails: Record<string, unknown> = {
                name: error.name,
                message: error.message,
                stack: error.stack,
            };

            // Add database-specific properties if they exist
            const dbError = error as Error & Partial<DatabaseError>;
            if (dbError.code) errorDetails.code = dbError.code;
            if (dbError.details) errorDetails.details = dbError.details;
            if (dbError.hint) errorDetails.hint = dbError.hint;

            console.error('Detailed error information:', errorDetails);
        }

        // Return 200 status code to acknowledge receipt to Stripe
        return NextResponse.json(
            {
                received: true,
                error: error instanceof Error ? error.message : String(error),
                processingTime,
                environment: isProduction ? 'production' : 'test'
            },
            { status: 200 }
        );
    }
}