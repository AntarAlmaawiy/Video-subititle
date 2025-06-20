// app/api/auth/[...nextauth]/route.ts
import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";
import CredentialsProvider from "next-auth/providers/credentials";
import { supabase } from "@/lib/supabase";
import { getAdminSupabase } from "@/lib/admin-supabase";
import { ensureUserProfile } from "@/lib/auth-helpers";
import type { User } from "next-auth";
import type { JWT } from "next-auth/jwt";

// Create extended types
interface ExtendedUser extends User {
    supabaseId?: string;
}

interface ExtendedJWT extends JWT {
    supabaseId?: string;
}

// Declare module to extend session.user
declare module "next-auth" {
    interface Session {
        user: User & {
            supabaseId?: string;
        };
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

            // Only for OAuth providers
            if ((account?.provider === 'google' || account?.provider === 'github') && user.email) {
                try {
                    // First create/verify Supabase user
                    const adminSupabase = getAdminSupabase();
                    let supabaseUserId: string | undefined;

                    try {
                        // Try to get existing user by email
                        const { data, error } = await adminSupabase.auth.admin.listUsers();

                        if (!error && data && data.users) {
                            // Find user with matching email
                            const existingUser = data.users.find(u => u.email === user.email);
                            if (existingUser) {
                                supabaseUserId = existingUser.id;
                                console.log(`Found existing Supabase user with ID ${supabaseUserId}`);
                            }
                        }
                    } catch (getUserErr) {
                        console.error('Error checking for existing user:', getUserErr);
                    }

                    // Create user if not found
                    if (!supabaseUserId) {
                        console.log(`Creating new Supabase user for ${user.email}`);
                        const randomPassword = Math.random().toString(36).slice(-12);

                        try {
                            const { data, error: createError } = await adminSupabase.auth.admin.createUser({
                                email: user.email,
                                password: randomPassword,
                                email_confirm: true,
                                user_metadata: {
                                    name: user.name || '',
                                    oauth_provider: account.provider,
                                    oauth_id: user.id
                                }
                            });

                            if (createError) {
                                console.error('Error creating Supabase user:', createError);
                            } else if (data && data.user) {
                                supabaseUserId = data.user.id;
                                console.log(`Created new Supabase user with ID ${supabaseUserId}`);
                            }
                        } catch (createUserErr) {
                            console.error('Exception creating Supabase user:', createUserErr);
                        }
                    }

                    // If we have a Supabase ID, ensure profile and subscription
                    if (supabaseUserId) {
                        // Use the ensureUserProfile helper function
                        await ensureUserProfile(
                            supabaseUserId,
                            user.email,
                            user.name || undefined
                        );

                        // Store Supabase ID with user
                        (user as ExtendedUser).supabaseId = supabaseUserId;
                    }
                } catch (error) {
                    console.error("Error setting up OAuth user:", error);
                    // Continue sign-in even if setup fails
                }
            }

            return true;
        },

        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
                token.email = user.email;

                // Transfer supabaseId from user to token if available
                const extendedUser = user as ExtendedUser;
                if (extendedUser.supabaseId) {
                    (token as ExtendedJWT).supabaseId = extendedUser.supabaseId;
                }
            }
            return token;
        },

        async session({ session, token }) {
            if (session.user) {
                session.user.id = token.id as string;

                // Transfer supabaseId from token to session
                const extendedToken = token as ExtendedJWT;
                if (extendedToken.supabaseId) {
                    session.user.supabaseId = extendedToken.supabaseId;
                }
            }
            return session;
        },

        async redirect({ url, baseUrl }) {
            if (url.startsWith("/")) return `${baseUrl}${url}`;
            else if (new URL(url).origin === baseUrl) return url;
            return baseUrl;
        }
    },
    debug: process.env.NODE_ENV === 'development',
    secret: process.env.NEXTAUTH_SECRET,
});