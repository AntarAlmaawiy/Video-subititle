// app/api/create-checkout-session/route.ts
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

        // Parse request body
        const body = await request.json();
        const { planId, billingCycle } = body;

        // Validate required fields
        if (!planId) {
            return NextResponse.json(
                { message: 'Plan ID is required' },
                { status: 400 }
            );
        }

        // Define pricing plans
        const plans = {
            free: {
                id: 'free',
                name: 'Free Plan',
                price: 0
            },
            pro: {
                id: 'pro',
                name: 'Pro Plan',
                price: 1499, // in cents ($14.99)
                yearlyPrice: 14388 // in cents ($143.88 = $14.99 * 12 * 0.8)
            },
            elite: {
                id: 'elite',
                name: 'Elite Plan',
                price: 3999, // in cents ($39.99)
                yearlyPrice: 38390 // in cents ($383.90 = $39.99 * 12 * 0.8)
            }
        };

        // Handle free plan separately
        if (planId === 'free') {
            // Update user subscription to free plan
            await updateUserSubscription(session.user.id, {
                plan_id: 'free',
                status: 'active',
                next_billing_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
            });

            return NextResponse.json({ success: true, message: 'Switched to Free plan' });
        }

        // Lookup the selected plan
        const selectedPlan = plans[planId as keyof typeof plans];
        if (!selectedPlan) {
            return NextResponse.json(
                { message: 'Invalid plan selected' },
                { status: 400 }
            );
        }

        // Get or create Stripe customer
        const userSubscription = await getUserSubscription(session.user.id);
        let customerId = userSubscription?.stripe_customer_id;

        if (!customerId) {
            // Create a new customer in Stripe
            const customer = await stripe.customers.create({
                email: session.user.email || undefined,
                name: session.user.name || undefined,
                metadata: {
                    userId: session.user.id
                }
            });
            customerId = customer.id;
        }

        // Create a Checkout Session
        const checkoutSession = await stripe.checkout.sessions.create({
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
                        unit_amount: billingCycle === 'yearly' ? selectedPlan.yearlyPrice : selectedPlan.price,
                        recurring: {
                            interval: billingCycle === 'yearly' ? 'year' : 'month',
                        },
                    },
                    quantity: 1,
                },
            ],
            mode: 'subscription',
            success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard?success=true`,
            cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/manage-plan?canceled=true`,
            metadata: {
                userId: session.user.id,
                planId: planId,
                billingCycle: billingCycle
            },
        });

        return NextResponse.json({ sessionUrl: checkoutSession.url });

    } catch (error: any) {
        console.error('Error creating checkout session:', error);
        return NextResponse.json(
            { message: error.message || 'Error creating checkout session' },
            { status: 500 }
        );
    }
}

// Function to get user subscription - include this if not already defined elsewhere
async function getUserSubscription(userId: string) {
    try {
        const { data, error } = await supabase
            .from('user_subscriptions')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error('Error fetching user subscription:', error);
            return null;
        }

        return data;
    } catch (error) {
        console.error('Error in getUserSubscription:', error);
        return null;
    }
}