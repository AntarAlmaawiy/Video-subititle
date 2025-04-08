'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, XCircle, ArrowRight, Crown, Upload, HardDrive } from 'lucide-react';
import { useSession } from 'next-auth/react';

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
    features: PlanFeature[];
    recommended?: boolean;
    color: string;
    icon: React.ReactNode;
}

const Pricing = () => {
    const router = useRouter();
    const { data: session } = useSession();
    const [activeTab, setActiveTab] = useState<'monthly' | 'yearly'>('monthly');

    // Plans data - matching the same structure as in your manage-plan page
    const plans: PlanDetails[] = [
        {
            id: 'free',
            name: 'Free',
            price: 0,
            videosPerDay: 1,
            storage: '500MB',
            color: 'bg-gray-100 border-gray-300',
            icon: <Upload className="h-8 w-8 text-gray-500" />,
            features: [
                { name: '1 free video translate per day', included: true },
                { name: '500MB storage', included: true },
                { name: 'Basic subtitle', included: true },
                { name: 'Support for 100+ languages', included: true },
                { name: 'Standard quality AI', included: true },
                { name: 'Basic users', included: true },
                { name: 'Email support', included: true },
            ]
        },
        {
            id: 'pro',
            name: 'Pro',
            price: 14.99,
            videosPerDay: 10,
            storage: '5GB',
            color: 'bg-blue-50 border-blue-300',
            icon: <Crown className="h-8 w-8 text-blue-500" />,
            features: [
                { name: '5 video translates per day', included: true },
                { name: '15GB storage', included: true },
                { name: 'Advanced subtitle', included: true },
                { name: 'Support for 100+ languages', included: true },
                { name: 'Enhanced quality AI', included: true },
                { name: 'Content creators', included: true },
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
            color: 'bg-purple-50 border-purple-300',
            icon: <HardDrive className="h-8 w-8 text-purple-500" />,
            features: [
                { name: '30 video translates per day', included: true },
                { name: '10GB storage', included: true },
                { name: 'Professional subtitle', included: true },
                { name: 'Support for 100+ languages', included: true },
                { name: 'Premium quality AI', included: true },
                { name: 'Power creators', included: true },
                { name: 'Priority 24/7 support', included: true },
            ]
        },
    ];

    // Calculate yearly prices (20% discount)
    const getPrice = (plan: PlanDetails) => {
        if (plan.price === 0) return 0;
        return activeTab === 'yearly' ? (plan.price * 12 * 0.8).toFixed(2) : plan.price.toFixed(2);
    };

    // Handle get started action
    const handleGetStarted = () => {
        // If user is signed in, take them to the dashboard or manage-plan page
        if (session) {
            router.push('/dashboard/manage-plan');
        } else {
            // If not signed in, take them to sign in page
            router.push('/signin');
        }
    };

    return (
        <section id="pricing" className="py-16 bg-gray-50">
            <div className="container mx-auto px-4">
                <div className="text-center mb-12">
                    <h2 className="text-4xl font-bold mb-4">Simple, Transparent Pricing</h2>
                    <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                        Choose the plan that fits your subtitle translation needs, with no hidden fees.
                    </p>
                </div>

                {/* Billing Toggle */}
                <div className="flex justify-center mb-12">
                    <div className="bg-white rounded-lg p-1 shadow-md inline-flex">
                        <button
                            className={`py-2 px-6 rounded-lg font-medium transition-colors ${activeTab === 'monthly' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                            onClick={() => setActiveTab('monthly')}
                        >
                            Monthly
                        </button>
                        <button
                            className={`py-2 px-6 rounded-lg font-medium transition-colors ${activeTab === 'yearly' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
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
                                <div className="bg-blue-600 text-white text-center py-1 text-sm font-medium">
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
                                        <Upload className="h-5 w-5 text-blue-600 mr-2" />
                                        <span className="font-medium">{plan.videosPerDay} video translates per day</span>
                                    </div>
                                    <div className="flex items-center">
                                        <HardDrive className="h-5 w-5 text-blue-600 mr-2" />
                                        <span className="font-medium">{plan.storage} storage</span>
                                    </div>
                                </div>
                                <button
                                    className={`w-full py-3 rounded-lg font-medium transition-colors flex justify-center items-center
                    ${plan.id === 'free'
                                        ? 'bg-gray-800 hover:bg-gray-900 text-white'
                                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                                    }`}
                                    onClick={() => handleGetStarted()}
                                >
                                    {plan.id === 'free' ? 'Get Started' : 'Get Started'}
                                    <ArrowRight className="ml-2 h-5 w-5" />
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
        </section>
    );
};

export default Pricing;