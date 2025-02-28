'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { CheckCircle, AlertCircle, ArrowRight } from 'lucide-react';

// Plan types
interface PlanFeature {
    name: string;
    included: boolean;
}

interface PlanDetails {
    id: string;
    name: string;
    price: number;
    videoMinutes: number;
    maxVideoLength: number;
    features: PlanFeature[];
    recommended?: boolean;
}

export default function ManagePlanPage() {
    const router = useRouter();
    const { isLoaded, isSignedIn, user } = useUser();
    const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

    // Mock current subscription - in a real app, this would come from your backend
    const [currentSubscription, setCurrentSubscription] = useState({
        plan: 'free',
        status: 'active',
        nextBillingDate: '2025-03-27',
        minutesUsed: 8,
        minutesTotal: 15
    });

    // Plans data
    const plans: PlanDetails[] = [
        {
            id: 'free',
            name: 'Free',
            price: 0,
            videoMinutes: 15,
            maxVideoLength: 5,
            features: [
                { name: 'Basic video subtitle translation', included: true },
                { name: 'Limited to 10 languages', included: true },
                { name: 'Standard AI translation quality', included: true },
                { name: 'Email support', included: true },
                { name: 'Batch processing', included: false },
                { name: 'Analytics dashboard', included: false },
                { name: 'Premium AI models', included: false },
            ]
        },
        {
            id: 'basic',
            name: 'Basic',
            price: 9.99,
            videoMinutes: 120,
            maxVideoLength: 20,
            features: [
                { name: 'Basic video subtitle translation', included: true },
                { name: 'Support for 40 languages', included: true },
                { name: 'Enhanced AI translation quality', included: true },
                { name: 'Email support', included: true },
                { name: 'Batch processing', included: false },
                { name: 'Analytics dashboard', included: false },
                { name: 'Premium AI models', included: true },
            ]
        },
        {
            id: 'pro',
            name: 'Pro',
            price: 24.99,
            videoMinutes: 600,
            maxVideoLength: 60,
            features: [
                { name: 'Advanced video subtitle translation', included: true },
                { name: 'Support for 100+ languages', included: true },
                { name: 'Premium AI translation quality', included: true },
                { name: 'Email support', included: true },
                { name: 'Batch processing', included: true },
                { name: 'Analytics dashboard', included: true },
                { name: 'Premium AI models', included: true },
            ],
            recommended: true
        },
        {
            id: 'business',
            name: 'Business',
            price: 79.99,
            videoMinutes: 2000,
            maxVideoLength: 180,
            features: [
                { name: 'Advanced video subtitle translation', included: true },
                { name: 'Support for 100+ languages', included: true },
                { name: 'Premium+ AI translation quality', included: true },
                { name: 'Priority support', included: true },
                { name: 'Batch processing', included: true },
                { name: 'Analytics dashboard', included: true },
                { name: 'Premium AI models', included: true },
            ]
        },
    ];

    const handleUpgrade = (planId: string) => {
        setSelectedPlan(planId);
        setTimeout(() => {
            router.push('/checkout?plan=' + planId);
        }, 500);
    };

    const handleCancel = () => {
        if (confirm('Are you sure you want to cancel your subscription? You will be downgraded to the Free plan at the end of your billing cycle.')) {
            setTimeout(() => {
                setCurrentSubscription({
                    ...currentSubscription,
                    status: 'canceling',
                });
            }, 500);
        }
    };

    if (!isLoaded) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
            </div>
        );
    }

    if (!isSignedIn) {
        router.push('/signin');
        return null;
    }

    return (
        <main className="min-h-screen bg-gray-50">
            <Navbar />
            <div className="pt-20 pb-16">
                <h1 className="text-center text-3xl font-bold mb-6">Manage Your Plan</h1>
                <div className="max-w-4xl mx-auto bg-white p-6 shadow rounded-lg">
                    <h2 className="text-xl font-semibold">Current Plan: {currentSubscription.plan.toUpperCase()}</h2>
                    <p className="text-gray-600">Status: {currentSubscription.status}</p>
                    <p className="text-gray-600">Next Billing Date: {currentSubscription.nextBillingDate}</p>
                    <button
                        className="mt-4 bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded"
                        onClick={handleCancel}
                    >Cancel Subscription</button>
                </div>
                <div className="mt-8 max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4">
                    {plans.map((plan) => (
                        <div key={plan.id} className="border p-4 rounded-lg shadow">
                            <h3 className="text-xl font-bold">{plan.name}</h3>
                            <p className="text-gray-600">${plan.price}/month</p>
                            <button
                                className="mt-4 bg-indigo-500 hover:bg-indigo-600 text-white py-2 px-4 rounded"
                                onClick={() => handleUpgrade(plan.id)}
                            >Upgrade</button>
                        </div>
                    ))}
                </div>
            </div>
            <Footer />
        </main>
    );
}
