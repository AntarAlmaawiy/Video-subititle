'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from "next-auth/react";
import { getUserStorageStats, getUserVideos, updateUserSubscription } from '@/lib/supabase';
import { CheckCircle, XCircle, ArrowRight, Crown, Upload, HardDrive } from 'lucide-react';

// Plan types
interface PlanFeature {
    name: string;
    included: boolean;
}

interface PlanDetails {
    id: string;
    name: string;
    price: number;
    videosPerDay: number;
    storage: string;
    storageBytes: number;
    features: PlanFeature[];
    recommended?: boolean;
    color: string;
    icon: React.ReactNode;
}

// User subscription type
interface UserSubscription {
    plan: string;
    status: string;
    nextBillingDate: string;
    videosUsed: number;
    videosTotal: number;
    storageUsed: string;
    storageTotal: string;
}

export default function ManagePlanPage() {
    const router = useRouter();
    const { data: session, status } = useSession();
    const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'monthly' | 'yearly'>('monthly');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Current subscription state
    const [currentSubscription, setCurrentSubscription] = useState<UserSubscription>({
        plan: 'free',
        status: 'active',
        nextBillingDate: '2025-04-08',
        videosUsed: 0,
        videosTotal: 1,
        storageUsed: '0',
        storageTotal: '5'
    });

    // Plans data
    const plans: PlanDetails[] = [
        {
            id: 'free',
            name: 'Free',
            price: 0,
            videosPerDay: 1,
            storage: '5GB',
            storageBytes: 5 * 1024 * 1024 * 1024, // 5GB in bytes
            color: 'bg-gray-100 border-gray-300',
            icon: <Upload className="h-8 w-8 text-gray-500" />,
            features: [
                { name: '1 free video translate per day', included: true },
                { name: '5GB storage', included: true },
                { name: 'Basic subtitle editing', included: true },
                { name: 'Support for 10 languages', included: true },
                { name: 'Standard quality AI', included: true },
                { name: 'Email support', included: true },
                { name: 'Premium templates', included: false },
                { name: 'Batch processing', included: false },
            ]
        },
        {
            id: 'pro',
            name: 'Pro',
            price: 14.99,
            videosPerDay: 10,
            storage: '15GB',
            storageBytes: 15 * 1024 * 1024 * 1024, // 15GB in bytes
            color: 'bg-blue-50 border-blue-300',
            icon: <Crown className="h-8 w-8 text-blue-500" />,
            features: [
                { name: '10 video translates per day', included: true },
                { name: '15GB storage', included: true },
                { name: 'Advanced subtitle editing', included: true },
                { name: 'Support for 40 languages', included: true },
                { name: 'Enhanced quality AI', included: true },
                { name: 'Priority email support', included: true },
                { name: 'Premium templates', included: true },
                { name: 'Batch processing', included: false },
            ],
            recommended: true
        },
        {
            id: 'elite',
            name: 'Elite',
            price: 39.99,
            videosPerDay: 30,
            storage: '30GB',
            storageBytes: 30 * 1024 * 1024 * 1024, // 30GB in bytes
            color: 'bg-purple-50 border-purple-300',
            icon: <HardDrive className="h-8 w-8 text-purple-500" />,
            features: [
                { name: '30 video translates per day', included: true },
                { name: '30GB storage', included: true },
                { name: 'Professional subtitle editing', included: true },
                { name: 'Support for 100+ languages', included: true },
                { name: 'Premium quality AI', included: true },
                { name: 'Priority 24/7 support', included: true },
                { name: 'Premium templates', included: true },
                { name: 'Batch processing', included: true },
            ]
        },
    ];

    // Calculate yearly prices (20% discount)
    const getPrice = (plan: PlanDetails) => {
        if (plan.price === 0) return 0;
        return activeTab === 'yearly' ? (plan.price * 12 * 0.8).toFixed(2) : plan.price.toFixed(2);
    };

    // Load user's subscription data and usage from Supabase
    useEffect(() => {
        const fetchUserData = async () => {
            if (status !== "authenticated" || !session?.user?.id) return;

            try {
                setLoading(true);

                // Get storage statistics
                const storageStats = await getUserStorageStats(session.user.id);

                // Get today's video count (or fetch from a dedicated API)
                const todayVideos = await getUserVideos(session.user.id);
                const todayDate = new Date().toISOString().split('T')[0];
                const videosUploadedToday = todayVideos.filter(video =>
                    new Date(video.created_at).toISOString().split('T')[0] === todayDate
                ).length;

                // Get user's subscription plan from Supabase
                // This would be a new function you'd need to implement in supabase.ts
                // to fetch the user's current subscription plan from your database
                const userSubscription = await getUserSubscription(session.user.id);

                // Match the plan to get limits
                const userPlan = plans.find(plan => plan.id === userSubscription?.plan_id) || plans[0];

                // Format storage values for display
                const formatBytes = (bytes: number) => {
                    if (bytes === 0) return '0';
                    const k = 1024;
                    const sizes = ['', 'KB', 'MB', 'GB'];
                    const i = Math.floor(Math.log(bytes) / Math.log(k));
                    return parseFloat((bytes / Math.pow(k, i)).toFixed(2));
                };

                // Update subscription state with real data
                setCurrentSubscription({
                    plan: userPlan.id,
                    status: userSubscription?.status || 'active',
                    nextBillingDate: userSubscription?.next_billing_date || '2025-04-08',
                    videosUsed: videosUploadedToday,
                    videosTotal: userPlan.videosPerDay,
                    storageUsed: formatBytes(storageStats.usedStorage).toString(),
                    storageTotal: formatBytes(userPlan.storageBytes).toString()
                });

            } catch (err: any) {
                console.error('Error fetching user data:', err);
                setError(err.message || 'Failed to load your subscription data');
            } finally {
                setLoading(false);
            }
        };

        fetchUserData();
    }, [session?.user?.id, status]);

    // Handle checkout with Stripe
    const handleUpgrade = async (planId: string) => {
        if (!session?.user?.id) {
            router.push('/signin');
            return;
        }

        setSelectedPlan(planId);

        try {
            // Create a checkout session with Stripe
            const response = await fetch('/api/create-checkout-session', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    planId: planId,
                    userId: session.user.id,
                    billingCycle: activeTab,
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to create checkout session');
            }

            const { sessionUrl } = await response.json();

            // Redirect to Stripe Checkout
            window.location.href = sessionUrl;

        } catch (err: any) {
            console.error('Checkout error:', err);
            setError(err.message || 'Failed to process checkout');
        }
    };

    const handleCancel = async () => {
        if (!session?.user?.id) return;

        if (confirm('Are you sure you want to cancel your subscription? You will be downgraded to the Free plan at the end of your billing cycle.')) {
            try {
                // Cancel subscription in your database and with Stripe
                await fetch('/api/cancel-subscription', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        userId: session.user.id,
                    }),
                });

                // Update UI to show cancellation
                setCurrentSubscription({
                    ...currentSubscription,
                    status: 'canceling',
                });

            } catch (err: any) {
                console.error('Error canceling subscription:', err);
                setError(err.message || 'Failed to cancel subscription');
            }
        }
    };

    // Placeholder function - implement this in supabase.ts
    const getUserSubscription = async (userId: string) => {
        // This would be implemented in your supabase.ts file
        // to fetch the user's current subscription from your database
        // For now, return a placeholder
        return {
            plan_id: 'free',
            status: 'active',
            next_billing_date: '2025-04-08',
            stripe_subscription_id: null
        };
    };

    // Check authentication status
    useEffect(() => {
        if (status === "unauthenticated") {
            router.push('/signin');
        }
    }, [status, router]);

    if (status === "loading" || loading) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    return (
        <main className="min-h-screen bg-gray-50">
            <div className="pt-20 pb-16 px-4">
                <h1 className="text-center text-4xl font-bold mb-2">Manage Your Plan</h1>
                <p className="text-center text-gray-600 mb-8">Choose the perfect plan for your subtitle translation needs</p>

                {error && (
                    <div className="max-w-4xl mx-auto bg-red-50 p-4 rounded-md mb-6 text-red-600">
                        {error}
                    </div>
                )}

                {/* Current Plan Summary */}
                <div className="max-w-4xl mx-auto bg-white p-6 shadow-md rounded-lg mb-10">
                    <h2 className="text-2xl font-semibold border-b pb-3 mb-4">Current Plan: <span className="text-blue-600">{currentSubscription.plan.charAt(0).toUpperCase() + currentSubscription.plan.slice(1)}</span></h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <p className="text-gray-700 mb-2">Status: <span className="font-medium">{currentSubscription.status.charAt(0).toUpperCase() + currentSubscription.status.slice(1)}</span></p>
                            <p className="text-gray-700">Next Billing Date: <span className="font-medium">{currentSubscription.nextBillingDate}</span></p>
                        </div>
                        <div>
                            <div className="mb-2">
                                <p className="text-gray-700 mb-1">Videos: <span className="font-medium">{currentSubscription.videosUsed}/{currentSubscription.videosTotal} per day</span></p>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${(currentSubscription.videosUsed / currentSubscription.videosTotal) * 100}%` }}></div>
                                </div>
                            </div>
                            <div>
                                <p className="text-gray-700 mb-1">Storage: <span className="font-medium">{currentSubscription.storageUsed}/{currentSubscription.storageTotal}GB</span></p>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${(parseFloat(currentSubscription.storageUsed) / parseFloat(currentSubscription.storageTotal)) * 100}%` }}></div>
                                </div>
                            </div>
                        </div>
                    </div>
                    {currentSubscription.plan !== 'free' && (
                        <button
                            className="mt-6 bg-red-500 hover:bg-red-600 text-white py-2 px-6 rounded-md transition-colors font-medium"
                            onClick={handleCancel}
                        >
                            Cancel Subscription
                        </button>
                    )}
                </div>

                {/* Billing Toggle */}
                <div className="flex justify-center mb-8">
                    <div className="bg-white rounded-lg p-1 shadow-md inline-flex">
                        <button
                            className={`py-2 px-6 rounded-lg font-medium transition-colors ${activeTab === 'monthly' ? 'bg-blue-500 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                            onClick={() => setActiveTab('monthly')}
                        >
                            Monthly
                        </button>
                        <button
                            className={`py-2 px-6 rounded-lg font-medium transition-colors ${activeTab === 'yearly' ? 'bg-blue-500 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                            onClick={() => setActiveTab('yearly')}
                        >
                            Yearly <span className="text-xs font-normal ml-1 bg-green-100 text-green-800 py-0.5 px-1.5 rounded">Save 20%</span>
                        </button>
                    </div>
                </div>

                {/* Plans Comparison */}
                <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
                    {plans.map((plan) => (
                        <div
                            key={plan.id}
                            className={`border ${plan.recommended ? 'ring-2 ring-blue-500' : ''} ${plan.color} rounded-xl shadow-md overflow-hidden transition-transform hover:translate-y-[-4px]`}
                        >
                            {plan.recommended && (
                                <div className="bg-blue-500 text-white text-center py-1 text-sm font-medium">
                                    MOST POPULAR
                                </div>
                            )}
                            <div className="p-6">
                                <div className="flex items-center mb-4">
                                    {plan.icon}
                                    <h3 className="text-2xl font-bold ml-3">{plan.name}</h3>
                                </div>
                                <div className="mt-4 mb-6">
                                    <span className="text-4xl font-bold">${getPrice(plan)}</span>
                                    {plan.price > 0 && (
                                        <span className="text-gray-600 ml-1">{activeTab === 'monthly' ? '/month' : '/year'}</span>
                                    )}
                                </div>
                                <div className="mb-6">
                                    <div className="flex items-center mb-3">
                                        <Upload className="h-5 w-5 text-blue-500 mr-2" />
                                        <span className="font-medium">{plan.videosPerDay} video translates per day</span>
                                    </div>
                                    <div className="flex items-center">
                                        <HardDrive className="h-5 w-5 text-blue-500 mr-2" />
                                        <span className="font-medium">{plan.storage} storage</span>
                                    </div>
                                </div>
                                <button
                                    className={`w-full py-3 rounded-lg font-medium transition-colors flex justify-center items-center
                                        ${currentSubscription.plan === plan.id
                                        ? 'bg-gray-300 cursor-not-allowed text-gray-600'
                                        : plan.id === 'free'
                                            ? 'bg-gray-800 hover:bg-gray-900 text-white'
                                            : 'bg-blue-600 hover:bg-blue-700 text-white'
                                    }`}
                                    onClick={() => currentSubscription.plan !== plan.id && handleUpgrade(plan.id)}
                                    disabled={currentSubscription.plan === plan.id}
                                >
                                    {currentSubscription.plan === plan.id ? 'Current Plan' : 'Upgrade'}
                                    {currentSubscription.plan !== plan.id && <ArrowRight className="ml-2 h-5 w-5" />}
                                </button>
                                <div className="mt-6 space-y-3">
                                    {plan.features.map((feature, idx) => (
                                        <div key={idx} className="flex items-start">
                                            {feature.included ? (
                                                <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mr-2" />
                                            ) : (
                                                <XCircle className="h-5 w-5 text-gray-400 flex-shrink-0 mr-2" />
                                            )}
                                            <span className={feature.included ? 'text-gray-800' : 'text-gray-500'}>
                                                {feature.name}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </main>
    );
}