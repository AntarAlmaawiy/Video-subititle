import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { adminSupabase } from '@/lib/admin-supabase'; // Import the admin client

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2025-02-24.acacia',
});

// Define interface for plan types
interface Plan {
    id: string;
    name: string;
    price: number;
    yearlyPrice?: number;
}

export async function POST(request: Request) {
    try {
        // Get the user session using NextAuth
        const session = await auth();

        if (!session || !session.user) {
            return NextResponse.json(
                { message: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Ensure we have a valid user ID
        if (!session.user.id) {
            return NextResponse.json(
                { message: 'Invalid user ID' },
                { status: 400 }
            );
        }

        // Parse request body
        const body = await request.json();
        const { planId, billingCycle } = body;

        if (!planId) {
            return NextResponse.json(
                { message: 'Plan ID is required' },
                { status: 400 }
            );
        }

        console.log(`Creating checkout session for user ${session.user.id}, plan: ${planId}, cycle: ${billingCycle}`);

        // Define pricing plans
        const plans: Record<string, Plan> = {
            free: {
                id: 'free',
                name: 'Free Plan',
                price: 0
            },
            pro: {
                id: 'pro',
                name: 'Pro Plan',
                price: 1499, // $14.99 in cents
                yearlyPrice: 14388 // Discounted yearly price
            },
            elite: {
                id: 'elite',
                name: 'Elite Plan',
                price: 3999, // $39.99 in cents
                yearlyPrice: 38390 // Discounted yearly price
            }
        };

        // Handle free plan without Stripe
        if (planId === 'free') {
            try {
                const freeData = {
                    user_id: session.user.id,
                    plan_id: 'free',
                    status: 'active',
                    billing_cycle: 'monthly',
                    next_billing_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                    stripe_subscription_id: null,
                    stripe_customer_id: null,
                    updated_at: new Date().toISOString(),
                    created_at: new Date().toISOString()
                };

                console.log(`Switching to free plan, data:`, freeData);

                const { data, error } = await adminSupabase
                    .from('user_subscriptions')
                    .upsert(freeData, { onConflict: 'user_id' })
                    .select();

                if (error) {
                    console.error('Error updating to free plan:', error);
                    return NextResponse.json({ message: 'Database update failed' }, { status: 500 });
                }

                console.log('Successfully updated to free plan:', data);

                return NextResponse.json({
                    success: true,
                    message: 'Switched to Free plan',
                    // No redirect needed - stays on same page with updated data
                    redirect: `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard?success=true&t=${Date.now()}`
                });
            } catch (dbError) {
                console.error('Error updating subscription to free plan:', dbError);
                return NextResponse.json({ message: 'Database update failed' }, { status: 500 });
            }
        }

        // Lookup the selected plan
        const selectedPlan = plans[planId];
        if (!selectedPlan) {
            return NextResponse.json(
                { message: 'Invalid plan selected' },
                { status: 400 }
            );
        }

        // Get or create Stripe customer
        let customerId = null;
        try {
            // Get existing subscription
            const { data: userSubscription, error: subError } = await adminSupabase
                .from('user_subscriptions')
                .select('*')
                .eq('user_id', session.user.id)
                .single();

            if (subError && subError.code !== 'PGRST116') {
                console.error('Error fetching subscription:', subError);
            }

            console.log(`Existing subscription:`, userSubscription);

            if (userSubscription?.stripe_customer_id) {
                customerId = String(userSubscription.stripe_customer_id);
                console.log(`Using existing customer ID: ${customerId}`);
            } else {
                // Make sure we have an email for the new customer
                if (!session.user.email) {
                    return NextResponse.json(
                        { message: 'User email is required for creating a customer' },
                        { status: 400 }
                    );
                }

                // Create a new customer in Stripe
                const customer = await stripe.customers.create({
                    email: session.user.email,
                    name: session.user.name || undefined,
                    metadata: {
                        userId: session.user.id
                    }
                });

                customerId = String(customer.id);
                console.log(`Created new customer ID: ${customerId}`);

                // Save the customer ID
                if (customerId) {
                    const { error: saveError } = await adminSupabase
                        .from('user_subscriptions')
                        .upsert({
                            user_id: session.user.id,
                            plan_id: userSubscription?.plan_id || 'free',
                            status: userSubscription?.status || 'active',
                            stripe_customer_id: customerId,
                            updated_at: new Date().toISOString(),
                            created_at: new Date().toISOString()
                        }, { onConflict: 'user_id' });

                    if (saveError) {
                        console.error('Error saving customer ID:', saveError);
                    } else {
                        console.log('Saved customer ID to database');
                    }
                }
            }
        } catch (error) {
            console.error('Error getting/creating Stripe customer:', error);
            return NextResponse.json(
                { message: 'Error managing customer' },
                { status: 500 }
            );
        }

        // If we still don't have a customer ID, return an error
        if (!customerId) {
            return NextResponse.json(
                { message: 'Failed to create or retrieve customer' },
                { status: 500 }
            );
        }

        // Determine the correct price
        const unitAmount = billingCycle === 'yearly' && selectedPlan.yearlyPrice
            ? selectedPlan.yearlyPrice
            : selectedPlan.price;

        // Add timestamp to success URL for cache busting
        const timestamp = Date.now();
        const success_url = `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard?success=true&t=${timestamp}`;
        const cancel_url = `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/manage-plan?canceled=true&t=${timestamp}`;

        // Prepare checkout session parameters with explicit typings
        const params: Stripe.Checkout.SessionCreateParams = {
            customer: customerId,
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: selectedPlan.name,
                            description: `${billingCycle === 'yearly' ? 'Annual' : 'Monthly'} subscription`,
                        },
                        unit_amount: unitAmount,
                        recurring: {
                            interval: billingCycle === 'yearly' ? 'year' : 'month',
                        },
                    },
                    quantity: 1,
                },
            ],
            mode: 'subscription',
            success_url: success_url,
            cancel_url: cancel_url,
            metadata: {
                userId: session.user.id,
                planId: planId,
                billingCycle: billingCycle
            },
        };

        console.log('Creating checkout session with params:', JSON.stringify({
            customer: customerId,
            mode: params.mode,
            success_url: params.success_url,
            metadata: params.metadata
        }));

        // Create Stripe Checkout Session with typed params
        const checkoutSession = await stripe.checkout.sessions.create(params);

        console.log(`✅ Created checkout session ${checkoutSession.id} for user ${session.user.id}, plan ${planId}`);

        return NextResponse.json({ sessionUrl: checkoutSession.url });
    } catch (error: any) {
        console.error('❌ Error creating checkout session:', error);
        return NextResponse.json(
            { message: error.message || 'Error creating checkout session' },
            { status: 500 }
        );
    }
}