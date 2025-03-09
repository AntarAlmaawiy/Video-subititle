// lib/stripe.ts
import Stripe from 'stripe';
import { loadStripe } from '@stripe/stripe-js';

// Server-side Stripe client
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2025-02-24.acacia',
});

// Client-side Stripe promise for frontend components
// Using let instead of const allows for mocking in tests
let stripePromise: Promise<Stripe | null> | null = null;

export const getStripeJs = () => {
    if (!stripePromise) {
        stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');
    }
    return stripePromise;
};