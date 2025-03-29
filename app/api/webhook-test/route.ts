// app/api/webhook-test/route.ts
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getAdminSupabase } from '@/lib/admin-supabase';

// Force dynamic API route
export const dynamic = 'force-dynamic';

// Use test key for this endpoint
const stripeTestSecretKey = process.env.STRIPE_TEST_SECRET_KEY || '';
const stripeTestWebhookSecret = process.env.STRIPE_TEST_WEBHOOK_SECRET || '';

const stripe = new Stripe(stripeTestSecretKey, {
    apiVersion: '2025-02-24.acacia',
});

export async function POST(request: Request): Promise<NextResponse> {
    console.log(`🔔 TEST Webhook received at:`, new Date().toISOString());

    try {
        const body = await request.text();
        const signature = request.headers.get('stripe-signature') || '';

        console.log(`📋 Webhook signature: ${signature.substring(0, 20)}...`);
        console.log(`📋 Webhook body length: ${body.length} characters`);

        if (!stripeTestWebhookSecret) {
            console.error('❌ Missing STRIPE_TEST_WEBHOOK_SECRET environment variable');
            return NextResponse.json({ message: 'Test webhook secret is not configured' }, { status: 200 });
        }

        // Verify the webhook signature
        let event: Stripe.Event;
        try {
            event = stripe.webhooks.constructEvent(body, signature, stripeTestWebhookSecret);
            console.log(`✅ Test webhook signature verified. Event type: ${event.type}`);
        } catch (err) {
            console.error(`❌ Test webhook signature verification failed:`, err);
            return NextResponse.json({ message: `Test webhook signature verification failed` }, { status: 200 });
        }

        // Get admin Supabase client
        const adminSupabase = getAdminSupabase();
        console.log(`📋 Event received: ${event.type}`);
        console.log(`📋 Event data:`, JSON.stringify(event.data.object, null, 2));

        // Process checkout.session.completed event to update user subscription
        if (event.type === 'checkout.session.completed') {
            const session = event.data.object as Stripe.Checkout.Session;
            console.log(`🔄 Processing TEST checkout.session.completed, ID: ${session.id}`);
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

                // We're now directly linking to auth.users, no profile check needed
                console.log(`🔍 Using direct link to auth.users for user ${userId}`);
                // Get subscription details from Stripe
                console.log(`🔍 Retrieving subscription ${subscriptionId} from Stripe...`);
                const subscription = await stripe.subscriptions.retrieve(subscriptionId);

                console.log(`✅ Retrieved subscription from Stripe:`, {
                    id: subscription.id,
                    status: subscription.status,
                    current_period_end: subscription.current_period_end
                });

                // Update or create user subscription in database
                const subscriptionData = {
                    user_id: userId,
                    plan_id: planId,
                    status: subscription.status,
                    stripe_subscription_id: subscriptionId,
                    stripe_customer_id: customerId,
                    billing_cycle: billingCycle,
                    next_billing_date: new Date(subscription.current_period_end * 1000).toISOString().split('T')[0],
                    updated_at: new Date().toISOString(),
                    created_at: new Date().toISOString()
                };

                console.log(`📋 Updating subscription in database with data:`, JSON.stringify(subscriptionData, null, 2));

                const { data, error } = await adminSupabase
                    .from('user_subscriptions')
                    .upsert(subscriptionData, { onConflict: 'user_id' })
                    .select();

                if (error) {
                    console.error('❌ Database update error:', error);
                    console.error('❌ Error details:', {
                        code: error.code,
                        message: error.message,
                        details: error.details,
                        hint: error.hint
                    });

                    // Special handling for foreign key constraint violation
                    if (error.code === '23503') { // Foreign key violation
                        console.error('❌ This is a foreign key constraint violation. User likely does not exist in the profiles table.');

                        // Try to log detailed information about the user
                        console.log('🔍 Attempting to get auth user info');
                        const { data: authUser, error: authError } = await adminSupabase.auth.admin.getUserById(userId);

                        if (authError) {
                            console.error('❌ Error fetching auth user:', authError);
                        } else {
                            console.log('📋 Auth user info:', authUser);
                        }
                    }

                    return NextResponse.json({ message: 'Database update failed' }, { status: 200 });
                }

                console.log('✅ Subscription updated in database:', data);

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

        // Always return 200 OK to acknowledge receipt
        return NextResponse.json({ received: true, success: true });
    } catch (error) {
        console.error('❌ TEST Webhook error:', error);
        // Return 200 status code to acknowledge receipt to Stripe
        return NextResponse.json({ received: true, error: String(error) }, { status: 200 });
    }
}