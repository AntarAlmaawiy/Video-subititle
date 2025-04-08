// Create a new file: lib/manual-signup.ts
import { supabase } from "@/lib/supabase";

export async function manualSignUp(email: string, password: string, username: string) {
    try {
        // Step 1: Create the auth user
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
        });

        if (error) throw error;
        if (!data.user) throw new Error("No user returned from signup");

        const userId = data.user.id;

        // Step 2: Manually create the profile
        const { error: profileError } = await supabase
            .from('profiles')
            .insert({
                id: userId,
                username,
                email,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });

        if (profileError) console.error("Error creating profile:", profileError);

        // Step 3: Manually create subscription
        const { error: subscriptionError } = await supabase
            .from('user_subscriptions')
            .insert({
                user_id: userId,
                plan_id: 'free',
                status: 'active',
                next_billing_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });

        if (subscriptionError) console.error("Error creating subscription:", subscriptionError);

        return data;
    } catch (error) {
        console.error("Manual signup error:", error);
        throw error;
    }
}