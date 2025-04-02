// app/api/auth/[...nextauth]/route.ts
import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";
import CredentialsProvider from "next-auth/providers/credentials";
import { supabase } from "@/lib/supabase";
import { getAdminSupabase } from "@/lib/admin-supabase";
import type { User } from "next-auth";
import type { AdapterUser } from "next-auth/adapters";

// Helper function to ensure user profile exists in Supabase
async function ensureUserProfile(user: User | AdapterUser | undefined) {
    // Type guard to ensure user has an id
    if (!user || !user.id) return;

    try {
        console.log(`Ensuring profile exists for user: ${user.id}`);
        const adminSupabase = getAdminSupabase();

        // Check if profile exists
        const { error: profileError } = await adminSupabase
            .from('profiles')
            .select('id')
            .eq('id', user.id)
            .single();

        // If profile not found, create it
        if (profileError && profileError.code === 'PGRST116') {
            console.log(`Profile not found for ${user.id}, creating new profile`);

            const { error: createError } = await adminSupabase
                .from('profiles')
                .insert({
                    id: user.id,
                    username: user.name || user.email?.split('@')[0] || `user_${user.id.slice(0, 8)}`,
                    email: user.email || 'user@example.com',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                });

            if (createError) {
                console.error('Error creating profile:', createError);
            } else {
                console.log(`Successfully created profile for ${user.id}`);
            }
        } else if (profileError) {
            console.error('Error checking profile:', profileError);
        } else {
            console.log(`Profile already exists for ${user.id}`);
        }

        // Check if subscription exists
        const { error: subError } = await adminSupabase
            .from('user_subscriptions')
            .select('id')
            .eq('user_id', user.id)
            .single();

        // If subscription not found, create free plan subscription
        if (subError && subError.code === 'PGRST116') {
            console.log(`Subscription not found for ${user.id}, creating free plan`);

            const { error: createSubError } = await adminSupabase
                .from('user_subscriptions')
                .insert({
                    user_id: user.id,
                    plan_id: 'free',
                    status: 'active',
                    next_billing_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                });

            if (createSubError) {
                console.error('Error creating subscription:', createSubError);
            } else {
                console.log(`Successfully created subscription for ${user.id}`);
            }
        } else if (subError) {
            console.error('Error checking subscription:', subError);
        } else {
            console.log(`Subscription already exists for ${user.id}`);
        }
    } catch (error) {
        console.error('Error ensuring user profile:', error);
    }
}

export const { handlers: { GET, POST }, auth, signIn, signOut } = NextAuth({
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID || "",
            clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
        }),
        GitHubProvider({
            clientId: process.env.GITHUB_CLIENT_ID || "",
            clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
        }),
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
                try {
                    console.log("NextAuth authorize function called with email:", credentials?.email);

                    if (!credentials?.email || !credentials?.password) {
                        console.log("Missing credentials");
                        return null;
                    }

                    // Use Supabase for authentication
                    const { data, error } = await supabase.auth.signInWithPassword({
                        email: String(credentials.email),
                        password: String(credentials.password),
                    });

                    console.log("Supabase auth result:", { user: data?.user ? "exists" : "null", error: error?.message });

                    if (error || !data.user) {
                        console.log("Auth failed:", error?.message);
                        return null;
                    }

                    // Return user data in the format NextAuth expects
                    const user = {
                        id: data.user.id,
                        email: data.user.email,
                        name: data.user.user_metadata?.username || data.user.email,
                    };

                    console.log("Auth successful, returning user:", user);
                    return user;
                } catch (error) {
                    console.error("Exception in NextAuth authorize:", error);
                    return null;
                }
            },
        }),
    ],
    pages: {
        signIn: "/signin",
    },
    session: {
        strategy: "jwt",
        maxAge: 30 * 24 * 60 * 60, // 30 days
    },
    callbacks: {
        // Create or verify profile after successful sign in
        async signIn({ user, account }) {
            console.log(`User signed in: ${user.id}, provider: ${account?.provider}`);

            // For OAuth providers, ensure we create the profile
            if (account?.provider === 'google' || account?.provider === 'github') {
                await ensureUserProfile(user);
            }

            return true;
        },
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
                token.email = user.email;
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                session.user.id = token.id as string;

                // Ensure profile exists on every session creation
                await ensureUserProfile(session.user);
            }
            return session;
        },
        // Add this redirect callback to handle URLs properly
        async redirect({ url, baseUrl }) {
            // Allows relative callback URLs
            if (url.startsWith("/")) return `${baseUrl}${url}`;
            // Allows callback URLs on the same origin
            else if (new URL(url).origin === baseUrl) return url;
            return baseUrl;
        }
    },
    debug: process.env.NODE_ENV === 'development', // Enable debug mode in development
    secret: process.env.NEXTAUTH_SECRET,
});