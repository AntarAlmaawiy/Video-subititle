// components/EnsureUserData.tsx
'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { supabase } from '@/lib/supabase'; // Use your existing Supabase client

export default function EnsureUserData() {
    const { data: session } = useSession();
    const [isSetup, setIsSetup] = useState(false);

    useEffect(() => {
        if (session?.user && !isSetup) {
            const setupUser = async () => {
                const userId = session.user.id;
                const userEmail = session.user.email;

                if (!userId || !userEmail) return;

                try {
                    // Check/create profile
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('id')
                        .eq('id', userId)
                        .maybeSingle();

                    if (!profile) {
                        await supabase
                            .from('profiles')
                            .insert({
                                id: userId,
                                username: session.user.name || userEmail.split('@')[0],
                                email: userEmail
                            });
                        console.log('Created profile for user:', userId);
                    }

                    // Check/create subscription
                    const { data: subscription } = await supabase
                        .from('user_subscriptions')
                        .select('id')
                        .eq('user_id', userId)
                        .maybeSingle();

                    if (!subscription) {
                        await supabase
                            .from('user_subscriptions')
                            .insert({
                                user_id: userId,
                                plan_id: 'free',
                                status: 'active',
                                next_billing_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                            });
                        console.log('Created subscription for user:', userId);
                    }

                    setIsSetup(true);
                } catch (error) {
                    console.error('Error setting up user data:', error);
                }
            };

            setupUser();
        }
    }, [session, isSetup]);

    return null; // No visual component
}