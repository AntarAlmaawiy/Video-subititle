// app/api/webhook-debug/route.ts
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { adminSupabase } from '@/lib/admin-supabase';

export async function POST(request: Request): Promise<NextResponse> {
    try {
        console.log('⚡ Webhook Debug: Request received');

        // Get the raw body
        const body = await request.text();

        // Log the body length for debugging
        console.log(`📊 Request body length: ${body.length}`);

        // Log a sample of the body
        console.log(`📄 Body sample: ${body.substring(0, 100)}...`);

        const signature = request.headers.get('stripe-signature') || '';

        // Create Stripe instance
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
            apiVersion: '2025-02-24.acacia',
        });

        // Try to parse the event
        let event;
        try {
            // Just try to parse the event without verification first
            event = JSON.parse(body);
            console.log('✅ Parsed event without verification');
        } catch (parseError) {
            console.error('❌ Failed to parse event JSON:', parseError);
            return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
        }

        // Now check if we can verify it with the webhook secret
        if (process.env.STRIPE_WEBHOOK_SECRET) {
            try {
                event = stripe.webhooks.constructEvent(
                    body, signature, process.env.STRIPE_WEBHOOK_SECRET
                );
                console.log('✅ Event signature verified');
            } catch (sigError) {
                console.error('❌ Webhook signature verification failed:', sigError);
                // Continue anyway for debugging
            }
        } else {
            console.log('⚠️ No webhook secret available for verification');
        }

        // Get event details
        const eventType = event.type;
        console.log(`📣 Event type: ${eventType}`);

        // For checkout.session.completed, extract the important information
        if (eventType === 'checkout.session.completed') {
            const session = event.data.object;
            console.log(`💳 Checkout session: ${session.id}`);
            console.log(`👤 Customer: ${session.customer}`);
            console.log(`🔄 Subscription: ${session.subscription}`);
            console.log(`📋 Metadata:`, session.metadata);

            // Try to update the database directly
            const userId = session.metadata?.userId;
            const planId = session.metadata?.planId;

            if (userId && planId && session.subscription) {
                console.log(`🔄 Updating subscription for user ${userId} to plan ${planId}`);

                const subscriptionData = {
                    user_id: userId,
                    plan_id: planId,
                    status: 'active',
                    stripe_subscription_id: session.subscription,
                    stripe_customer_id: session.customer,
                    next_billing_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                    updated_at: new Date().toISOString()
                };

                try {
                    // Check if user exists in profiles
                    const { data: userExists, error: userCheckError } = await adminSupabase
                        .from('profiles')
                        .select('id')
                        .eq('id', userId)
                        .single();

                    if (userCheckError || !userExists) {
                        console.log(`⚠️ User ${userId} not found in profiles table`);
                        // User doesn't exist in profiles, try to fetch from auth
                        const authResponse = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
                            headers: {
                                'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
                                'Content-Type': 'application/json'
                            }
                        });

                        if (authResponse.ok) {
                            const authUser = await authResponse.json();
                            console.log(`✅ Found user in auth:`, authUser);

                            // Create profile record
                            const { error: profileError } = await adminSupabase
                                .from('profiles')
                                .insert({
                                    id: userId,
                                    username: `user_${userId.substring(0, 8)}`,
                                    email: authUser.email || `user_${userId.substring(0, 8)}@example.com`,
                                    created_at: new Date().toISOString(),
                                    updated_at: new Date().toISOString()
                                });

                            if (profileError) {
                                console.error(`❌ Failed to create profile:`, profileError);
                            } else {
                                console.log(`✅ Created profile for user ${userId}`);
                            }
                        } else {
                            console.error(`❌ Failed to find user in auth`);
                        }
                    }

                    // Now upsert the subscription
                    const { data, error } = await adminSupabase
                        .from('user_subscriptions')
                        .upsert(subscriptionData, { onConflict: 'user_id' })
                        .select();

                    if (error) {
                        console.error(`❌ Failed to update subscription:`, error);
                    } else {
                        console.log(`✅ Subscription updated successfully:`, data);
                    }
                } catch (dbError) {
                    console.error(`❌ Database error:`, dbError);
                }
            }
        }

        // Always return success for Stripe
        return NextResponse.json({ received: true });
    } catch (error) {
        console.error(`❌ Webhook debug error:`, error);
        return NextResponse.json({ error: String(error) }, { status: 200 });
    }
}