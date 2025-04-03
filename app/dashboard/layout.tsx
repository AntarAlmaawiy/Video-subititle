// app/dashboard/layout.tsx - Simplified version
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { supabase } from '@/lib/supabase';
import FixOAuthDirect from "@/components/FixOauthDirect";

export default async function DashboardLayout({
                                                  children,
                                              }: {
    children: React.ReactNode;
}) {
    const session = await auth();

    // Check if user is authenticated
    if (!session || !session.user) {
        redirect("/signin");
    }

    // Simple function to ensure database records for the user
    const userId = session.user.id;
    const userEmail = session.user.email;

    if (userId && userEmail) {
        try {
            // Check if profile exists, if not create it
            const { data: profile } = await supabase
                .from('profiles')
                .select('id')
                .eq('id', userId)
                .maybeSingle();

            if (!profile) {
                console.log(`Creating profile for user ${userId}`);
                const { error: profileError } = await supabase
                    .from('profiles')
                    .insert({
                        id: userId,
                        username: session.user.name || userEmail.split('@')[0],
                        email: userEmail,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    });

                if (profileError) {
                    console.error('Error creating profile:', profileError);
                } else {
                    console.log('Successfully created profile');
                }
            }

            // Check if subscription exists, if not create it
            const { data: subscription } = await supabase
                .from('user_subscriptions')
                .select('id')
                .eq('user_id', userId)
                .maybeSingle();

            if (!subscription) {
                console.log(`Creating subscription for user ${userId}`);
                const { error: subError } = await supabase
                    .from('user_subscriptions')
                    .insert({
                        user_id: userId,
                        plan_id: 'free',
                        status: 'active',
                        next_billing_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    });

                if (subError) {
                    console.error('Error creating subscription:', subError);
                } else {
                    console.log('Successfully created subscription');
                }
            }
        } catch (error) {
            console.error('Error setting up user data:', error);
            // Continue anyway to not block the dashboard
        }
    }

    return (
        <div className="flex h-screen bg-gray-50">
            <FixOAuthDirect />
            <Sidebar user={session.user} />
            <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>
    );
}