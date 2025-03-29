// app/dashboard/layout.tsx
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { getAdminSupabase } from '@/lib/admin-supabase';

// Helper function to ensure user has a profile and subscription
async function ensureUserSetup(userId: string, email: string, name?: string) {
    if (!userId || !email) return;

    const adminSupabase = getAdminSupabase();

    // Check if profile exists
    const { data: existingProfile, error: profileError } = await adminSupabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .single();

    // Create profile if needed
    if (!existingProfile && (!profileError || profileError.code === 'PGRST116')) {
        console.log(`Creating profile for user ${userId}`);
        await adminSupabase
            .from('profiles')
            .insert({
                id: userId,
                username: name || email.split('@')[0],
                email,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });
    }

    // Check if subscription exists
    const { data: existingSub, error: subError } = await adminSupabase
        .from('user_subscriptions')
        .select('id')
        .eq('user_id', userId)
        .single();

    // Create subscription if needed
    if (!existingSub && (!subError || subError.code === 'PGRST116')) {
        console.log(`Creating free subscription for user ${userId}`);
        await adminSupabase
            .from('user_subscriptions')
            .insert({
                user_id: userId,
                plan_id: 'free',
                status: 'active',
                next_billing_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });
    }
}

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

    // Ensure user has profile and subscription
    if (session.user.id && session.user.email) {
        try {
            await ensureUserSetup(
                session.user.id,
                session.user.email,
                session.user.name || undefined
            );
        } catch (error) {
            console.error('Error setting up user:', error);
            // Continue anyway, as this shouldn't block the dashboard
        }
    }

    return (
        <div className="flex h-screen bg-gray-50">
            <Sidebar user={session.user} />
            <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>
    );
}