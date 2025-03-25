'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from "next-auth/react";
import { supabase, getUserStorageStats, getUserSubscription, canUploadMoreVideos } from '@/lib/supabase';
import { CheckCircle, XCircle, ArrowRight, Crown, Upload, HardDrive, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'react-hot-toast'; // Add this package if you don't have it
import ConfirmationModal from '@/components/ConfirmationModal';

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
    storageUsedPercent: number;
    videosUsedPercent: number;
}

export default function ManagePlanPage() {
    const router = useRouter();
    const { data: session, status } = useSession();
    const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'monthly' | 'yearly'>('monthly');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [processingPayment, setProcessingPayment] = useState(false);
    const [loadAttempted, setLoadAttempted] = useState(false);

    // Modal states
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [showRenewModal, setShowRenewModal] = useState(false);

    // Current subscription state
    const [currentSubscription, setCurrentSubscription] = useState<UserSubscription>({
        plan: 'free',
        status: 'active',
        nextBillingDate: '2025-04-08',
        videosUsed: 0,
        videosTotal: 1,
        storageUsed: '0',
        storageTotal: '5',
        storageUsedPercent: 0,
        videosUsedPercent: 0
    });

    // Plans data wrapped in useMemo to prevent it from being recreated on every render
    const plans: PlanDetails[] = useMemo(() => [
        {
            id: 'free',
            name: 'Free',
            price: 0,
            videosPerDay: 1,
            storage: '500MB',
            storageBytes: 500 * 1024 * 1024, // 500MB in bytes
            color: 'bg-gray-100 border-gray-300',
            icon: <Upload className="h-8 w-8 text-gray-500" />,
            features: [
                { name: '1 free video translate per day', included: true },
                { name: '500MB storage', included: true },
                { name: 'Basic subtitle editing', included: true },
                { name: 'Support for 100+ languages', included: true },
                { name: 'Standard quality AI', included: true },
                { name: 'Email support', included: true },
            ]
        },
        {
            id: 'pro',
            name: 'Pro',
            price: 14.99,
            videosPerDay: 10,
            storage: '5GB',
            storageBytes: 5 * 1024 * 1024 * 1024,
            color: 'bg-blue-50 border-blue-300',
            icon: <Crown className="h-8 w-8 text-blue-500" />,
            features: [
                { name: '10 video translates per day', included: true },
                { name: '5GB storage', included: true },
                { name: 'Advanced subtitle editing', included: true },
                { name: 'Support for 100+ languages', included: true },
                { name: 'Enhanced quality AI', included: true },
                { name: 'Priority email support', included: true },
            ],
            recommended: true
        },
        {
            id: 'elite',
            name: 'Elite',
            price: 39.99,
            videosPerDay: 30,
            storage: '10GB',
            storageBytes: 10 * 1024 * 1024 * 1024, // 10GB in bytes
            color: 'bg-purple-50 border-purple-300',
            icon: <HardDrive className="h-8 w-8 text-purple-500" />,
            features: [
                { name: '30 video translates per day', included: true },
                { name: '10GB storage', included: true },
                { name: 'Professional subtitle editing', included: true },
                { name: 'Support for 100+ languages', included: true },
                { name: 'Premium quality AI', included: true },
                { name: 'Priority 24/7 support', included: true },
            ]
        },
    ], []);

    // Calculate yearly prices (20% discount)
    const getPrice = (plan: PlanDetails) => {
        if (plan.price === 0) return 0;
        return activeTab === 'yearly' ? (plan.price * 12 * 0.8).toFixed(2) : plan.price.toFixed(2);
    };

    // Load user's subscription data and usage
    const fetchUserData = useCallback(async (forceRefresh = false) => {
        if (status !== "authenticated" || !session?.user?.id) return;

        try {
            setLoading(true);
            setLoadAttempted(true);
            setError(null); // Clear any previous errors

            console.log("Fetching user data for plan management...");

            // Directly query the database first for the most up-to-date subscription information
            const { data: directSubscriptionData, error: subError } = await supabase
                .from('user_subscriptions')
                .select('*, subscription_plans(*)')
                .eq('user_id', session.user.id)
                .single();

            if (subError && subError.code !== 'PGRST116') {
                console.error("Error fetching subscription directly:", subError);
            }

            // Log what we found directly from the database
            if (directSubscriptionData) {
                console.log("Found subscription in database:", directSubscriptionData);
            } else {
                console.log("No subscription found directly in database, will use getUserSubscription");
            }

            // Get user's subscription plan from Supabase - won't throw errors
            const userSubscription = await getUserSubscription(session.user.id);
            console.log("User subscription from getUserSubscription:", userSubscription);

            // Match the plan to get limits - with fallback to free plan
            const userPlanId = directSubscriptionData?.plan_id || userSubscription.plan_id || 'free';
            const userPlan = plans.find(plan => plan.id === userPlanId) || plans[0];

            console.log("Resolved user plan:", userPlan.id);

            try {
                // Get storage statistics - won't throw errors
                const storageStats = await getUserStorageStats(session.user.id);
                console.log("Storage stats:", storageStats);

                // Get daily video usage - won't throw errors
                const videoUsage = await canUploadMoreVideos(session.user.id);
                console.log("Video usage:", videoUsage);

                // Format storage values for display
                const formatBytes = (bytes: number) => {
                    if (bytes === 0) return '0';
                    const k = 1024;
                    const i = Math.floor(Math.log(bytes) / Math.log(k));
                    return parseFloat((bytes / Math.pow(k, i)).toFixed(2));
                };

                // Calculate percentages for progress bars
                const storageUsedPercent = Math.round((storageStats.usedStorage / storageStats.maxStorage) * 100);
                const videosUsedPercent = Math.round((videoUsage.currentCount / videoUsage.limit) * 100);

                // Use the status from direct query if available, otherwise from getUserSubscription
                const subscriptionStatus = directSubscriptionData?.status || userSubscription.status || 'active';

                // Use next_billing_date from direct query if available
                const nextBillingDate = directSubscriptionData?.next_billing_date ||
                    userSubscription.next_billing_date ||
                    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

                // Format storage total based on plan
                let formattedStorageTotal;
                if (userPlan.id === 'free') {
                    // For free plan, use MB
                    formattedStorageTotal = formatBytes(userPlan.storageBytes).toString();
                } else {
                    // For paid plans, use GB
                    formattedStorageTotal = formatBytes(userPlan.storageBytes).toString();
                }

                // Update subscription state with real data
                setCurrentSubscription({
                    plan: userPlan.id,
                    status: subscriptionStatus,
                    nextBillingDate: nextBillingDate,
                    videosUsed: videoUsage.currentCount,
                    videosTotal: userPlan.videosPerDay,
                    storageUsed: formatBytes(storageStats.usedStorage).toString(),
                    storageTotal: formattedStorageTotal,
                    storageUsedPercent: storageUsedPercent,
                    videosUsedPercent: videosUsedPercent
                });

                // Show success toast if this was a manual refresh
                if (forceRefresh) {
                    toast.success("Subscription data refreshed successfully");
                }
            } catch (statsErr) {
                console.error("Error fetching usage stats:", statsErr);

                // If we can't get usage stats, still use the plan info but with default usage
                setCurrentSubscription({
                    plan: userPlan.id,
                    status: directSubscriptionData?.status || userSubscription.status || 'active',
                    nextBillingDate: directSubscriptionData?.next_billing_date || userSubscription.next_billing_date || '2025-04-08',
                    videosUsed: 0,
                    videosTotal: userPlan.videosPerDay,
                    storageUsed: '0',
                    storageTotal: userPlan.storage.replace('GB', '').replace('MB', ''),
                    storageUsedPercent: 0,
                    videosUsedPercent: 0
                });
            }
        } catch (err: unknown) {
            console.error('Error fetching user data:', err);
            const errorMessage = err instanceof Error ? err.message : 'Failed to load your subscription data';
            setError(errorMessage);

            if (forceRefresh) {
                toast.error("Could not refresh subscription data. Please try again.");
            }

            // Default values if everything fails
            setCurrentSubscription({
                plan: 'free',
                status: 'active',
                nextBillingDate: '2025-04-08',
                videosUsed: 0,
                videosTotal: 1,
                storageUsed: '0',
                storageTotal: '5',
                storageUsedPercent: 0,
                videosUsedPercent: 0
            });
        } finally {
            // Always turn off loading after 2 seconds max, even if something is stuck
            setTimeout(() => {
                if (loading) {
                    console.log("Forcing loading state to complete after timeout");
                    setLoading(false);
                }
            }, 2000);

            setLoading(false);
            setRefreshing(false);
        }
    }, [session?.user?.id, status, plans, loading]);  // Removed refreshSubscription from dependencies

    // Improved refreshSubscription function with retry logic - Defined early to avoid dependency issues
    const refreshSubscription = useCallback(async () => {
        setRefreshing(true);
        let retryCount = 0;
        const maxRetries = 3;

        // Add this to your refreshSubscription function
        const forceUpdate = async () => {
            try {
                const response = await fetch('/api/force-subscription-update');
                if (response.ok) {
                    const data = await response.json();
                    console.log('Force update result:', data);
                    return data.success;
                }
            } catch (err) {
                console.error('Error forcing update:', err);
            }
            return false;
        };

        // Call it during refresh
        await forceUpdate();

        // FIXED attemptRefresh function
        const attemptRefresh = async () => {
            try {
                // Verify user is authenticated before proceeding
                if (!session?.user?.id) {
                    console.log("User not authenticated yet, delaying subscription refresh");
                    // Wait a bit and try again later
                    return new Promise(resolve =>
                        setTimeout(() => resolve(attemptRefresh()), 1000)
                    );
                }

                // Clear any previous errors
                setError(null);

                // Get the most up-to-date subscription data directly from the database
                const { data: directSubscriptionData, error: subError } = await supabase
                    .from('user_subscriptions')
                    .select('*, subscription_plans(*)')
                    .eq('user_id', session.user.id)  // Now guaranteed to be defined
                    .single();

                if (subError && subError.code !== 'PGRST116') {
                    console.error("Error fetching subscription directly:", subError);
                    setError(`Database error: ${subError.message}`);
                }

                if (directSubscriptionData) {
                    console.log("Found subscription in database:", directSubscriptionData);

                    // Update UI with fetched data
                    setCurrentSubscription(prev => ({
                        ...prev,
                        plan: directSubscriptionData.plan_id,
                        status: directSubscriptionData.status,
                        nextBillingDate: directSubscriptionData.next_billing_date
                    }));

                    // Then fetch the rest of the plan data
                    await fetchUserData(true);

                    toast.success("Subscription data refreshed successfully!");
                    setRefreshing(false);
                    return true;
                } else {
                    console.log("No subscription found directly, will use getUserSubscription");
                    // Fall back to regular fetch
                    await fetchUserData(true);
                    setRefreshing(false);
                    return true;
                }
            } catch (err) {
                console.error("Error refreshing subscription:", err);
                retryCount++;

                if (retryCount >= maxRetries) {
                    toast.error("Could not refresh subscription after multiple attempts. Please try again later.");
                    setRefreshing(false);
                    return false;
                }

                // Wait before retrying (exponential backoff)
                const delay = Math.pow(2, retryCount) * 1000;
                toast.loading(`Retrying in ${delay/1000} seconds...`, { duration: delay });

                return new Promise(resolve => setTimeout(() => resolve(attemptRefresh()), delay));
            }
        };

        return attemptRefresh();
    }, [session?.user?.id, fetchUserData]); // Added fetchUserData to dependencies

    // Check if returning from Stripe
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const urlParams = new URLSearchParams(window.location.search);
            const success = urlParams.get('success');

            if (success === 'true') {
                // Check if we have session before proceeding
                if (status === "authenticated" && session?.user?.id) {
                    toast.success('Payment successful! Your subscription is being updated...');

                    // Force a direct refresh from the database
                    const checkSubscription = async () => {
                        try {
                            const response = await fetch('/api/user-subscription');
                            if (response.ok) {
                                const data = await response.json();
                                console.log("Subscription after payment:", data.subscription);
                                await refreshSubscription();
                            }
                        } catch (err) {
                            console.error("Error checking subscription:", err);
                        }
                    };

                    // Give the webhook a chance to process
                    setTimeout(checkSubscription, 2000);
                } else {
                    // Save the success state and check after authentication
                    localStorage.setItem('pendingSubscriptionCheck', 'true');
                }

                // Clean up URL
                window.history.replaceState({}, document.title, window.location.pathname);
            }
        }
    }, [status, session?.user?.id, refreshSubscription]);

    // Check localStorage for pending checkout
    const checkPendingCheckout = useCallback(async () => {
        // Don't proceed if not authenticated
        if (status !== "authenticated" || !session?.user?.id) {
            console.log("User not authenticated, delaying checkout verification");
            return;
        }

        if (typeof window !== 'undefined') {
            const pendingCheckout = localStorage.getItem('pendingCheckout');
            const checkoutTime = localStorage.getItem('checkoutTime');

            if (pendingCheckout === 'true' && checkoutTime) {
                // Check if this is recent (within last 10 minutes)
                const timeElapsed = Date.now() - parseInt(checkoutTime);
                const isRecent = timeElapsed < 10 * 60 * 1000; // 10 minutes

                if (isRecent) {
                    console.log('Detected recent checkout. Refreshing subscription data...');

                    toast.loading('Checking subscription status...', {
                        id: 'checking-subscription'
                    });

                    // Call refreshSubscription only if we have a valid session
                    setTimeout(async () => {
                        const success = await refreshSubscription();

                        if (success) {
                            localStorage.removeItem('pendingCheckout');
                            localStorage.removeItem('checkoutTime');

                            toast.success('Subscription updated successfully', {
                                id: 'checking-subscription'
                            });
                        } else {
                            toast.error('Could not verify subscription status', {
                                id: 'checking-subscription'
                            });
                        }
                    }, 2000);
                } else {
                    // Clean up old data
                    localStorage.removeItem('pendingCheckout');
                    localStorage.removeItem('checkoutTime');
                }
            }
        }
    }, [session?.user?.id, status, refreshSubscription]); // Removed unnecessary refreshSubscription dependency

    // Check on component mount
    useEffect(() => {
        if (status === "unauthenticated") {
            router.push('/signin');
            return;
        }

        // Only proceed if authentication is complete
        if (status === "authenticated" && session?.user?.id) {
            if (!loadAttempted) {
                console.log("Authentication confirmed, loading subscription data");
                fetchUserData();

                // Check for pending checkout only after auth is confirmed
                setTimeout(() => {
                    checkPendingCheckout();
                }, 1000); // Give a small delay after initial data fetch
            }
        } else {
            console.log("Waiting for authentication to complete");
        }
    }, [status, router, session?.user?.id, fetchUserData, loadAttempted, checkPendingCheckout]);

    // Handle checkout with Stripe
    const handleUpgrade = async (planId: string) => {
        // In your handleUpgrade function
        if (!session?.user?.id) {
            router.push('/signin');
            return;
        }

        setSelectedPlan(planId);
        setProcessingPayment(true);
        setError(null);

        try {
            // Create a checkout session with Stripe
            const response = await fetch('/api/create-checkout-session', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    planId: planId,
                    billingCycle: activeTab,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to create checkout session');
            }

            const { sessionUrl } = await response.json();

            // Store checkout info in localStorage for verification on return
            localStorage.setItem('pendingCheckout', 'true');
            localStorage.setItem('checkoutTime', Date.now().toString());

            // Redirect to Stripe Checkout
            window.location.href = sessionUrl;
        } catch (err: unknown) {
            console.error('Checkout error:', err);
            toast.error(err instanceof Error ? err.message : 'Failed to process checkout');
            setProcessingPayment(false);
        }
    };

    // Show cancel confirmation modal
    const handleCancel = async () => {
        if (!session?.user?.id) return;
        setShowCancelModal(true);
    };

    // Process cancellation after confirmation
    const confirmCancel = async () => {
        try {
            setProcessingPayment(true);
            setShowCancelModal(false); // Close the modal

            // Force UI update immediately for better UX
            setCurrentSubscription(prev => ({
                ...prev,
                status: 'canceled'  // Use 'canceled' not 'canceling'
            }));

            // Cancel subscription in your database and with Stripe
            const response = await fetch('/api/cancel-subscription', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            // First log the raw response for debugging
            console.log('Raw cancel response:', response);

            const data = await response.json();
            console.log('Cancellation response data:', data);

            if (!response.ok) {
                throw new Error(data.message || 'Failed to cancel subscription');
            }

            toast.success('Your subscription has been canceled. You will be downgraded to Free at the end of your billing cycle.');

            // Reload the data after a short delay
            setTimeout(async () => {
                await refreshSubscription();

                // Make sure UI shows canceled status
                setCurrentSubscription(prev => ({
                    ...prev,
                    status: 'canceled'  // Use 'canceled' not 'canceling'
                }));
            }, 1500);

        } catch (err: unknown) {
            console.error('Error canceling subscription:', err);
            toast.error(err instanceof Error ? err.message : 'Failed to cancel subscription');

            // Revert UI if there was an error
            refreshSubscription();
        } finally {
            setProcessingPayment(false);
        }
    };

    // Show renew confirmation modal
    const handleRenew = async () => {
        if (!session?.user?.id) return;
        setShowRenewModal(true);
    };

    // Process renewal after confirmation
    const confirmRenew = async () => {
        try {
            setProcessingPayment(true);
            setShowRenewModal(false); // Close the modal

            // Call your renewal API endpoint
            const response = await fetch('/api/renew-subscription', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to renew subscription');
            }

            // Update UI immediately
            setCurrentSubscription(prev => ({
                ...prev,
                status: 'active'
            }));

            toast.success('Your subscription has been renewed successfully!');

            // Refresh the subscription data
            setTimeout(() => {
                refreshSubscription();
            }, 1500);

        } catch (err) {
            console.error('Error renewing subscription:', err);
            toast.error(err instanceof Error ? err.message : 'Failed to renew subscription');

            // Refresh the subscription data even on error
            refreshSubscription();
        } finally {
            setProcessingPayment(false);
        }
    };

    if (loading || status === "loading") {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
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
                    <div className="flex justify-between">
                        <h2 className="text-2xl font-semibold border-b pb-3 mb-4">Current Plan: <span className="text-blue-600">{currentSubscription.plan.charAt(0).toUpperCase() + currentSubscription.plan.slice(1)}</span></h2>
                        <button
                            onClick={refreshSubscription}
                            disabled={refreshing}
                            className="text-blue-600 hover:text-blue-800 flex items-center text-sm"
                        >
                            {refreshing ? (
                                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            ) : (
                                <RefreshCw className="h-4 w-4 mr-1" />
                            )}
                            Refresh lol
                        </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <p className="text-gray-700 mb-2">Status: <span className="font-medium">{currentSubscription.status.charAt(0).toUpperCase() + currentSubscription.status.slice(1)}</span></p>
                            <p className="text-gray-700">Next Billing Date: <span className="font-medium">{currentSubscription.nextBillingDate}</span></p>
                        </div>
                        <div>
                            <div className="mb-2">
                                <p className="text-gray-700 mb-1">Videos: <span className="font-medium">{currentSubscription.videosUsed}/{currentSubscription.videosTotal} per day</span></p>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${currentSubscription.videosUsedPercent}%` }}></div>
                                </div>
                            </div>
                            <div>
                                <p className="text-gray-700 mb-1">Storage: <span className="font-medium">{currentSubscription.storageUsed}/{currentSubscription.storageTotal}
                                    {currentSubscription.plan === 'free' ? 'MB' : 'GB'}</span></p>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${currentSubscription.storageUsedPercent}%` }}></div>
                                </div>
                            </div>
                        </div>
                    </div>
                    {currentSubscription.plan !== 'free' && (
                        currentSubscription.status === 'canceled' || currentSubscription.status === 'canceling' ? (
                            <button
                                className="mt-6 bg-green-500 hover:bg-green-600 text-white py-2 px-6 rounded-md transition-colors font-medium flex items-center"
                                onClick={handleRenew}
                                disabled={processingPayment}
                            >
                                {processingPayment && <Loader2 className="animate-spin h-4 w-4 mr-2" />}
                                Renew Subscription
                            </button>
                        ) : (
                            <button
                                className={`mt-6 ${processingPayment
                                    ? 'bg-gray-400 cursor-not-allowed'
                                    : 'bg-red-500 hover:bg-red-600'} text-white py-2 px-6 rounded-md transition-colors font-medium flex items-center`}
                                onClick={handleCancel}
                                disabled={processingPayment}
                            >
                                {processingPayment && <Loader2 className="animate-spin h-4 w-4 mr-2" />}
                                Cancel Subscription
                            </button>
                        )
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
                                        ${processingPayment
                                        ? 'bg-gray-300 cursor-not-allowed text-gray-600'
                                        : currentSubscription.plan === plan.id
                                            ? 'bg-gray-300 cursor-not-allowed text-gray-600'
                                            : plan.id === 'free'
                                                ? 'bg-gray-800 hover:bg-gray-900 text-white'
                                                : 'bg-blue-600 hover:bg-blue-700 text-white'
                                    }`}
                                    onClick={() => currentSubscription.plan !== plan.id && !processingPayment && handleUpgrade(plan.id)}
                                    disabled={currentSubscription.plan === plan.id || processingPayment}
                                >
                                    {processingPayment && selectedPlan === plan.id ? (
                                        <span className="flex items-center">
                                            <Loader2 className="animate-spin h-5 w-5 mr-2" />
                                            Processing
                                        </span>
                                    ) : currentSubscription.plan === plan.id ? (
                                        'Current Plan'
                                    ) : (
                                        <>
                                            Upgrade
                                            <ArrowRight className="ml-2 h-5 w-5" />
                                        </>
                                    )}
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

            {/* Cancel Subscription Modal */}
            <ConfirmationModal
                isOpen={showCancelModal}
                title="Cancel Subscription"
                message="Are you sure you want to cancel your subscription? You will be downgraded to the Free plan at the end of your billing cycle."
                confirmText="Yes, Cancel Subscription"
                cancelText="No, Keep My Plan"
                onConfirm={confirmCancel}
                onCancel={() => setShowCancelModal(false)}
                type="danger"
            />

            {/* Renew Subscription Modal */}
            <ConfirmationModal
                isOpen={showRenewModal}
                title="Renew Subscription"
                message="Would you like to renew your subscription? Your service will continue without interruption."
                confirmText="Yes, Renew Subscription"
                cancelText="Cancel"
                onConfirm={confirmRenew}
                onCancel={() => setShowRenewModal(false)}
                type="success"
            />
        </main>
    );
}